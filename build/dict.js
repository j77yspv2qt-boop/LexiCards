/* =====================================================================
   Dictionary page controller (Discover / My Cards)
   ===================================================================== */
function setDictSub(sub) {
  state.dictSub = sub;
  $$('#dictSeg .seg').forEach(b => b.classList.toggle('is-active', b.dataset.sub === sub));
  rebuildDeck();
}

function rebuildDeck() {
  buildDeck();
  renderStack();
}

function initDictionary() {
  const seg = $('#dictSeg');
  if (seg) seg.addEventListener('click', e => {
    const btn = e.target.closest('.seg');
    if (btn && btn.dataset.sub) setDictSub(btn.dataset.sub);
  });

  const filter = $('#filterLevel');
  if (filter) filter.addEventListener('change', () => { state.filter = filter.value; rebuildDeck(); });

  const shuffleBtn = $('#btnShuffle');
  if (shuffleBtn) shuffleBtn.addEventListener('click', () => {
    rebuildDeck();
    showToast('Deck shuffled');
  });

  const listBtn = $('#btnCustomList');
  if (listBtn) listBtn.addEventListener('click', openCustomSheet);

  /* delegate the Retry button and Speak button inside a card */
  const stage = $('#stage');
  if (stage) {
    function handleSpeak(e) {
      const speakBtn = e.target.closest('[data-speak]');
      if (!speakBtn) return;
      e.stopPropagation();
      e.preventDefault();
      const card = speakBtn.closest('.card');
      const term = card ? card.getAttribute('data-term') : '';
      const audio = speakBtn.getAttribute('data-audio') || '';
      speakTerm(term, audio);
      speakBtn.classList.add('is-speaking');
      setTimeout(() => speakBtn.classList.remove('is-speaking'), 800);
    }
    stage.addEventListener('click', e => {
      const speakBtn = e.target.closest('[data-speak]');
      if (speakBtn) { handleSpeak(e); return; }
      const btn = e.target.closest('[data-retry]');
    if (!btn) return;
    const card = btn.closest('.card');
    if (!card) return;
    const idx = $$('.card', stage).indexOf(card);
    const descriptor = currentCards(3)[idx];
    if (descriptor) hydrateCard(card, descriptor, true);
  });
  stage.addEventListener('pointerup', e => {
    if (e.target.closest('[data-speak]')) handleSpeak(e);
  });
  }

  /* search input for instant lookup */
  const searchInput = $('#searchDiscover');
  if (searchInput) {
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const val = searchInput.value.trim();
        if (!val) return;
        searchInput.value = '';
        searchInput.blur();
        lookupInstantTerm(val);
      }
    });
  }

  /* desktop shortcuts: arrows flip, S saves, R reshuffles */
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if ($('.sheet.is-open')) return;
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (state.view !== 'dictionary' || state.swiping) return;
    if (e.key === 'ArrowRight') flipCard(1);
    else if (e.key === 'ArrowLeft') flipCard(-1);
    else if (e.key === 's' || e.key === 'S') saveCurrentCard();
    else if (e.key === 'r' || e.key === 'R') { rebuildDeck(); showToast('Deck shuffled'); }
  });
}

function saveCurrentCard() {
  const top = $('.card--top', $('#stage'));
  if (!top) return;
  saveDescriptorToRecords(top._descriptor, top);
}

/* ------------------------------ custom list ------------------------------ */
function openCustomSheet() {
  const ta = $('#fCustom');
  if (ta) ta.value = (state.custom || []).join('\n');
  openSheet('sheetCustom');
}

function initCustomSheet() {
  const save = $('#btnSaveCustom');
  if (save) save.addEventListener('click', () => {
    const ta = $('#fCustom');
    state.custom = String(ta ? ta.value : '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    saveCustom();
    closeSheet('sheetCustom');
    if (state.dictSub !== 'discover') setDictSub('discover');
    rebuildDeck();
    showToast('My list saved (' + state.custom.length + ' terms)', 'ok');
  });
}

/* ------------------------------ instant lookup ------------------------------ */
function lookupInstantTerm(term) {
  if (!term) return;
  const item = {
    term: term,
    type: guessType(term),
    level: 'custom',
    source: 'custom'
  };
  /* Put at top of current deck */
  if (state.dictSub !== 'discover') setDictSub('discover');
  state.deck.splice(state.deckIndex, 0, item);
  renderStack();
  showToast('Looking up: ' + term, 'ok');
}
