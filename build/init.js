/* =====================================================================
   Bootstrap
   ===================================================================== */
function initGlobalGuards() {
  /* keep the page still while a card is being dragged to the save panel */
  document.addEventListener('touchmove', function (e) {
    if (gesture.mode === 'dragging' && e.cancelable) e.preventDefault();
  }, { passive: false });

  /* tapping the save panel is an extra shortcut for mouse / keyboard users */
  const zone = dzEl();
  if (zone) zone.addEventListener('click', function () {
    if (zone.classList.contains('is-visible')) saveCurrentCard();
  });

  window.addEventListener('visibilitychange', function () {
    if (!document.hidden && state.view === 'dictionary' && !state.deck.length) rebuildDeck();
  });
}

function init() {
  loadAll();
  state.view = 'dictionary';
  state.deck = [];
  state.deckIndex = 0;
  state.round = newRound();
  document.body.setAttribute('data-revsub', 'records');

  initNav();
  initDictionary();
  initRecords();
  initEntrySheet();
  initCustomSheet();
  initDataSheet();
  initInfoSheet();
  initQuiz();
  initGlobalGuards();

  setEntryType('word');
  syncSettingsUI();
  setView('dictionary');
  setRevSub('records');
  rebuildDeck();
  refreshRecords();
  updateQuizStats();

  if (!storageOK) {
    showToast('This browser blocks local storage - records will not persist.', 'warn', 4200);
  }
  /* the main record slot came back empty but the backup had them */
  if (state.backupRestored) {
    showToast('Records were empty - restored ' + state.backupRestored + ' saved ' +
      (state.backupRestored === 1 ? 'word' : 'words') + ' from the backup', 'warn', 5200);
    state.backupRestored = 0;
  }
}


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
