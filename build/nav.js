/* =====================================================================
   Navigation: main tabs, revision sub-tabs, bottom sheets
   ===================================================================== */
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

function setView(view) {
  state.view = view;
  $$('#mainTabs .maintab').forEach(b => b.classList.toggle('is-active', b.dataset.view === view));
  const dict = $('#view-dictionary'), rev = $('#view-revision');
  if (dict) dict.classList.toggle('is-active', view === 'dictionary');
  if (rev) rev.classList.toggle('is-active', view === 'revision');
  window.scrollTo(0, 0);

  if (view === 'dictionary') {
    updateProgress();
  } else if (state.revSub === 'quiz') {
    refreshQuizState();
  } else {
    refreshRecords();
  }
}

function setRevSub(sub) {
  state.revSub = sub;
  document.body.setAttribute('data-revsub', sub);
  $$('#revSeg .seg').forEach(b => b.classList.toggle('is-active', b.dataset.sub === sub));
  const recs = $('#sub-records'), quiz = $('#sub-quiz');
  if (recs) recs.classList.toggle('is-active', sub === 'records');
  if (quiz) quiz.classList.toggle('is-active', sub === 'quiz');

  if (sub === 'quiz') {
    refreshQuizState();
  } else {
    refreshRecords();
  }

}

function initNav() {
  const tabs = $('#mainTabs');
  if (tabs) tabs.addEventListener('click', e => {
    const btn = e.target.closest('.maintab');
    if (btn && btn.dataset.view) setView(btn.dataset.view);
  });

  const seg = $('#revSeg');
  if (seg) seg.addEventListener('click', e => {
    const btn = e.target.closest('.seg');
    if (btn && btn.dataset.sub) setRevSub(btn.dataset.sub);
  });

  initSheets();
}
