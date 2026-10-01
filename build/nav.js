/* =====================================================================
   Navigation: four pages in one swipeable track, bottom tab bar, sheets

   The pages used to be two (Dictionary / Revision), each with a segmented
   switch on top.  They are four now - Discover, My Cards, Records, Quiz - laid
   out side by side in a horizontal track, so moving between them is a swipe
   and the tab bar at the bottom is the map.  The old two-level model is kept
   alive in the state (state.view / state.dictSub / state.revSub) because the
   rest of the app asks "am I on a card or on a list?" in those terms.
   ===================================================================== */

/* the pages, in swipe order.  `view` is the old grouping, kept in the state. */
const PAGES = [
  { id: 'discover', view: 'dictionary', label: 'Discover' },
  { id: 'mine',     view: 'dictionary', label: 'My Cards' },
  { id: 'records',  view: 'revision',  label: 'Records' },
  { id: 'quiz',     view: 'revision',  label: 'Quiz' }
];

function pageIndex(id) {
  for (let i = 0; i < PAGES.length; i++) if (PAGES[i].id === id) return i;
  return -1;
}
function pageAt(i) { return PAGES[clamp(i, 0, PAGES.length - 1)]; }

/* How far to slide the track, as a percentage OF THE TRACK.
   The track is four pages wide, so one page is 100/4 = 25% of it: a plain
   -100% per page would jump four screens and leave pages 2-4 in blank space.
   Every offset in here goes through this one function so the drag, the snap and
   the tab-bar jump can never disagree about where a page sits. */
function pageOffsetPct(i) { return -(i * 100) / PAGES.length; }

/* ------------------------------ bottom sheets ------------------------------ */
function openSheet(id) {
  const sheet = document.getElementById(id);
  if (!sheet) return;
  sheet.classList.add('is-open');
  sheet.setAttribute('aria-hidden', 'false');
  const scrim = $('#scrim');
  if (scrim) scrim.classList.add('is-open');
  document.body.classList.add('sheet-open');
  if (id === 'sheetData') syncSettingsUI();
  if (id === 'sheetInfo') syncInfoUI();
  if (id === 'sheetGuide' && typeof syncGuideUI === 'function') syncGuideUI();
}

function closeSheet(id) {
  const sheet = document.getElementById(id);
  if (!sheet) return;
  sheet.classList.remove('is-open');
  sheet.setAttribute('aria-hidden', 'true');
  const stillOpen = $$('.sheet.is-open').length > 0;
  const scrim = $('#scrim');
  if (scrim && !stillOpen) scrim.classList.remove('is-open');
  if (!stillOpen) document.body.classList.remove('sheet-open');
}

function closeAllSheets() {
  $$('.sheet').forEach(s => closeSheet(s.id));
}

function initSheets() {
  const scrim = $('#scrim');
  if (scrim) scrim.addEventListener('click', closeAllSheets);
  $$('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeSheet(btn.getAttribute('data-close')));
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllSheets(); });
}

/* --------------------------------- pages --------------------------------- */
/* Go to a page by id.  `silent` skips the transition (used when a drag ends and
   the page snaps back, so it must not animate a second time). */
function setPage(id, opts) {
  const i = pageIndex(id);
  if (i < 0) return;
  const o = opts || {};
  const prev = state.page;
  state.page = PAGES[i].id;
  state.view = PAGES[i].view;
  if (PAGES[i].view === 'dictionary') state.dictSub = PAGES[i].id;
  else state.revSub = PAGES[i].id;
  document.body.setAttribute('data-page', state.page);
  document.body.setAttribute('data-revsub', state.view === 'revision' ? state.revSub : '');

  $$('#pagerTrack .view').forEach(v => v.classList.toggle('is-active', v.getAttribute('data-page') === state.page));
  $$('#mainTabs .tabbar__btn').forEach(b => b.classList.toggle('is-active', b.getAttribute('data-page') === state.page));

  /* slide the track with a transform, so a swipe can follow the finger and a
     tap on the tab bar animates exactly the same way */
  const track = $('#pagerTrack');
  if (track) {
    if (o.silent) track.classList.add('is-nofx');
    track.style.transform = 'translate3d(' + pageOffsetPct(i) + '%,0,0)';
    if (o.silent) {
      /* drop the class again once the browser painted the snapped position */
      requestAnimationFrame(() => requestAnimationFrame(() => track.classList.remove('is-nofx')));
    }
  }
  if (!o.keepScroll) {
    const pane = $('.card__scroller.is-open', $('#pagerTrack')) || $('.list', $('#pagerTrack'));
    if (pane) pane.scrollTop = 0;
  }
  window.scrollTo(0, 0);

  if (prev === state.page) return;
  /* only the page that was actually left needs tearing down / refreshing */
  if (PAGES[i].view === 'dictionary') {
    if (state.dictSub === 'mine') rebuildDeck();
    else updateProgress();
  } else if (state.revSub === 'quiz') {
    refreshQuizState();
  } else {
    refreshRecords();
  }
}

/* The old entry points, kept so the rest of the app (and the tests) does not
   have to care that the navigation was flattened into one list of pages.
   setDictSub lives in dict.js, next to the two card pages it switches. */
function setView(view) {
  if (view === 'dictionary') setPage(state.dictSub === 'mine' ? 'mine' : 'discover');
  else setPage(state.revSub === 'quiz' ? 'quiz' : 'records');
}
function setRevSub(sub) {
  setPage(sub === 'quiz' ? 'quiz' : 'records');
}


/* ------------------------- swipe between the pages ------------------------- */
/* A horizontal drag on the page background moves between pages.  The gesture
   has to beat two other claims on it: the card swipe (which only starts on a
   card) and the vertical scrollers.  So the drag is only taken over once it is
   clearly horizontal, and only when it did not start on something that owns it
   itself - a card, a chip, a button, a form control. */
const pager = { id: null, x0: 0, y0: 0, dx: 0, active: false, decided: false, width: 0,
  lastX: 0, lastT: 0, vx: 0 };

/* How far a drag has to travel to turn the page, as a fraction of the pager's
   width.  It used to be 0.28 - more than a quarter of the screen - which felt
   like work on a phone, so it is 0.18 now.  A quick flick covers the rest:
   SWIPE_VELOCITY (the same flick threshold the card swipe uses) lets a short
   drag turn the page too, so the gesture never feels like it "didn't take". */
const PAGE_SWIPE_RATIO = 0.18;

function pagerWidth() {
  const p = $('#pager');
  return p ? p.getBoundingClientRect().width || window.innerWidth : window.innerWidth;
}

function pagerStart(e) {
  if (pager.id !== null) return;
  if (gesture.mode !== 'idle' || state.swiping) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if ($('.sheet.is-open')) return;
  if (e.target && e.target.closest &&
      e.target.closest('.card, .chip, button, a, input, select, textarea')) return;
  pager.id = e.pointerId;
  pager.x0 = e.clientX; pager.y0 = e.clientY;
  pager.dx = 0; pager.active = false; pager.decided = false;
  pager.lastX = e.clientX; pager.lastT = performance.now(); pager.vx = 0;
  pager.width = pagerWidth();
}

function pagerMove(e) {
  if (pager.id !== e.pointerId) return;
  const dx = e.clientX - pager.x0;
  const dy = e.clientY - pager.y0;
  const now = performance.now();
  if (now - pager.lastT > 0) pager.vx = (e.clientX - pager.lastX) / (now - pager.lastT);
  pager.lastX = e.clientX; pager.lastT = now;
  if (!pager.decided) {
    /* a clearly vertical drag is a scroll, not a page change */
    if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { pager.id = null; return; }
    if (Math.abs(dx) < 14) return;
    pager.decided = true;
    const i = pageIndex(state.page);
    /* the first and the last page have nowhere to go: let the gesture go */
    if ((i <= 0 && dx > 0) || (i >= PAGES.length - 1 && dx < 0)) { pager.id = null; return; }
    pager.active = true;
    const track = $('#pagerTrack');
    if (track) track.classList.add('is-nofx');
  }
  if (!pager.active) return;
  if (e.cancelable) e.preventDefault();
  pager.dx = dx;
  const i = pageIndex(state.page);
  let shift = dx;
  if ((i <= 0 && dx > 0) || (i >= PAGES.length - 1 && dx < 0)) shift = dx * 0.32;  /* rubber band */
  const track = $('#pagerTrack');
  if (track) track.style.transform = 'translate3d(calc(' + pageOffsetPct(i) + '% + ' + shift + 'px),0,0)';
}

function pagerEnd(e) {
  if (pager.id !== e.pointerId) return;
  const wasActive = pager.active;
  const dx = pager.dx;
  const vx = pager.vx;
  pager.id = null; pager.active = false; pager.dx = 0; pager.vx = 0;
  if (!wasActive) return;
  const track = $('#pagerTrack');
  if (track) track.classList.remove('is-nofx');
  const width = pager.width || pagerWidth();
  /* a short drag that moved far enough, or a quick flick, turns the page */
  const flick = Math.abs(vx) > SWIPE_VELOCITY && Math.abs(dx) > 24;
  if (Math.abs(dx) > width * PAGE_SWIPE_RATIO || flick) nextPage(dx < 0 ? 1 : -1);
  else setPage(state.page, { silent: true });
}

function nextPage(dir) {
  const i = clamp(pageIndex(state.page) + dir, 0, PAGES.length - 1);
  setPage(PAGES[i].id);
}



/* ------------------------------- page icons -------------------------------
   One small inline SVG per page, drawn into both the page title and the tab
   bar so the two can never drift apart.  A skin replaces this whole map, which
   is why it lives in one place and is applied by name. */
const PAGE_ICONS = {
  /* a dictionary: the open book behind the Discover deck */
  discover: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5.2A1.6 1.6 0 0 1 4.6 3.6H10a2 2 0 0 1 2 2v13a1.6 1.6 0 0 0-1.6-1.6H4.6A1.6 1.6 0 0 1 3 15.4z"/><path d="M21 5.2a1.6 1.6 0 0 0-1.6-1.6H14a2 2 0 0 0-2 2v13a1.6 1.6 0 0 1 1.6-1.6h5.8a1.6 1.6 0 0 0 1.6-1.6z"/></svg>',
  /* two stacked cards: what the user saved */
  mine: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="3.4" width="13.6" height="11" rx="2.2"/><path d="M4.6 6.6v11.8a2.2 2.2 0 0 0 2.2 2.2h10.4"/></svg>',
  /* a ticked list: the records */
  records: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8.4 6.5H20M8.4 12H20M8.4 17.5H20"/><path d="M3.6 6.5l1.3 1.3L7.3 5.2M3.6 12l1.3 1.3 2.4-2.6M3.6 17.5l1.3 1.3 2.4-2.6"/></svg>',
  /* a question mark in a bubble: the quiz */
  quiz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.4 9.4a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.2-2.6 3.9"/><path d="M12 17.2v.2"/></svg>'
};

/* a skin may bring its own icon set; the built-in one is the fallback */
function pageIconSet() {
  const skin = (typeof currentSkin === 'function') ? currentSkin() : null;
  return (skin && skin.icons) || PAGE_ICONS;
}

function paintPageIcons() {
  const map = pageIconSet();
  $$('[data-pageicon]').forEach(el => {
    const name = el.getAttribute('data-pageicon');
    el.innerHTML = map[name] || PAGE_ICONS[name] || '';
  });
}

/* --------------------------------- wiring --------------------------------- */
function initNav() {
  const tabs = $('#mainTabs');
  if (tabs) tabs.addEventListener('click', e => {
    const btn = e.target.closest('.tabbar__btn');
    if (btn && btn.getAttribute('data-page')) setPage(btn.getAttribute('data-page'));
  });

  const pagerEl = $('#pager');
  if (pagerEl) {
    pagerEl.addEventListener('pointerdown', pagerStart);
    pagerEl.addEventListener('pointermove', pagerMove);
    pagerEl.addEventListener('pointerup', pagerEnd);
    pagerEl.addEventListener('pointercancel', pagerEnd);
  }

  /* desktop: PageUp / PageDown walk the pages */
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if ($('.sheet.is-open')) return;
    const tag = ((e.target && e.target.tagName) || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (e.key === 'PageDown') nextPage(1);
    else if (e.key === 'PageUp') nextPage(-1);
  });

  paintPageIcons();
  initSheets();
}
