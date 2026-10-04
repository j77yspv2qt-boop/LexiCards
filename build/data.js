/* =====================================================================
   Data & settings sheet: switches, export, import, cleanup
   ===================================================================== */
const SWITCHES = [
  { id: 'swHaptics', key: 'haptics' },
  { id: 'swTricky', key: 'quizTricky' },
  { id: 'swSrs', key: 'srsEnabled' }
];

function syncSettingsUI() {
  SWITCHES.forEach(s => {
    const el = document.getElementById(s.id);
    if (el) el.setAttribute('aria-checked', state.settings[s.key] ? 'true' : 'false');
  });
  const info = $('#storageInfo');
  if (info) {
    let bytes = 0;
    try { bytes = JSON.stringify(state.records).length + JSON.stringify(state.cache).length + JSON.stringify(state.tr).length; } catch (e) { bytes = 0; }
    info.textContent = state.records.length + ' records - ' + Object.keys(state.cache).length +
      ' cached meanings - ' + Object.keys(state.tr).length + ' cached translations - about ' +
      Math.max(1, Math.round(bytes / 1024)) + ' KB. ' + nativeDescribe() + ' ' +
      (storageOK ? 'Kept on this device (localStorage).' : 'This browser blocks storage, so data is temporary.');
  }
  const bak = $('#backupInfo');
  if (bak) bak.textContent = backupInfo();
  const speed = $('#speedInfo');
  if (speed) speed.textContent = speedSummary();
  const goal = $('#fDailyGoal');
  if (goal && document.activeElement !== goal) goal.value = String(state.settings.dailyGoal || 20);
}


/* ------------------------------ app info sheet ------------------------------ */
function syncInfoUI() {
  const v = $('#appVersionInfo');
  if (v) v.textContent = 'Version ' + ((NATIVE.isNative && NATIVE.version) ? NATIVE.version : APP_VERSION);
  $$('#defLangSeg .seg').forEach(b =>
    b.classList.toggle('is-active', b.dataset.lang === (state.settings.definitionLang || 'traditional')));
  syncSkinUI();
  if (typeof syncUpdateUI === 'function') syncUpdateUI();
}

function setDefLang(lang) {
  state.settings.definitionLang = lang === 'simplified' ? 'simplified' : 'traditional';
  saveSettings();
  syncInfoUI();
  if (state.view === 'dictionary') renderStack();
  if (typeof refreshRecords === 'function') refreshRecords();
}

function initInfoSheet() {
  const btn = $('#btnAppInfo');
  /* opening the sheet asks GitHub for the newest release (the answer is cached
     for a few hours, so this is one request a day at most) */
  if (btn) btn.addEventListener('click', () => { openSheet('sheetInfo'); checkForUpdate(false); });
  $$('#defLangSeg .seg').forEach(b =>
    b.addEventListener('click', () => setDefLang(b.dataset.lang)));
  initSkins();
  initGuide();
  initUpdateSheet();
}

function toggleSwitch(id) {
  const cfg = SWITCHES.find(s => s.id === id);
  if (!cfg) return;
  state.settings[cfg.key] = !state.settings[cfg.key];
  saveSettings();
  syncSettingsUI();
}

function exportData() {
  const payload = {
    app: 'LexiCards', version: 1, exportedAt: new Date().toISOString(),
    records: state.records, settings: state.settings, custom: state.custom
  };
  const d = new Date();
  const stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  download('lexicards-' + stamp + '.json', JSON.stringify(payload, null, 2));
  showToast('Exported ' + state.records.length + ' records', 'ok');
}

function importData(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      const recs = Array.isArray(data) ? data : (data.records || []);
      if (!Array.isArray(recs)) throw new Error('bad file');
      let added = 0, updated = 0;

      recs.forEach(r => {
        if (!r || !r.term) return;
        const type = (r.type === 'phrase' || r.type === 'pattern') ? r.type : 'word';
        const zh = Array.isArray(r.zh) ? r.zh.filter(Boolean).map(String) : [];
        const en = Array.isArray(r.en)
          ? r.en.map(x => (typeof x === 'string' ? x : (x && x.text) || '')).filter(Boolean)
          : [];
        const existing = findRecordByTerm(r.term);
        if (existing) {
          let changed = false;
          if ((!existing.zh || !existing.zh.length) && zh.length) { existing.zh = zh; changed = true; }
          if ((!existing.en || !existing.en.length) && en.length) { existing.en = en; changed = true; }
          if (!existing.phonetic && r.phonetic) { existing.phonetic = r.phonetic; changed = true; }
          if (changed) { existing.updatedAt = Date.now(); updated++; }
        } else {
          state.records.push({
            id: (r.id && !findRecordById(r.id)) ? r.id : uid(),
            term: String(r.term), type: type, zh: zh, en: en,
            phonetic: r.phonetic || '', note: r.note || '',
            tags: Array.isArray(r.tags) ? r.tags : [],
            source: r.source || 'manual',
            createdAt: r.createdAt || Date.now(), updatedAt: Date.now(),
            stats: (r.stats && typeof r.stats === 'object') ? r.stats
              : { seen: 0, correct: 0, wrong: 0, streak: 0, lastReviewedAt: 0,
                  dueAt: Date.now(), ease: 2.5, interval: 0 }
          });
          added++;
        }
      });

      if (Array.isArray(data.custom)) {
        state.custom = state.custom.concat(data.custom.map(String))
          .map(s => s.trim())
          .filter(Boolean)
          .filter((v, i, a) => a.indexOf(v) === i);
      }
      if (data.settings && typeof data.settings === 'object') {
        state.settings = Object.assign({}, state.settings, data.settings);
        saveSettings();
      }

      saveRecords(); saveCustom();
      syncSettingsUI();
      onRecordsChanged();
      showToast('Imported: ' + added + ' new, ' + updated + ' filled in', 'ok');
    } catch (err) {
      showToast('Could not read that JSON file', 'err');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

function initDataSheet() {
  SWITCHES.forEach(s => {
    const el = document.getElementById(s.id);
    if (!el) return;
    el.addEventListener('click', () => toggleSwitch(s.id));
    el.addEventListener('keydown', ev => {
      if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); toggleSwitch(s.id); }
    });
  });

  const exportBtn = $('#btnExport');
  if (exportBtn) exportBtn.addEventListener('click', exportData);

  const importBtn = $('#btnImport');
  const fileInput = $('#fileImport');
  if (importBtn && fileInput) importBtn.addEventListener('click', () => fileInput.click());
  if (fileInput) fileInput.addEventListener('change', importData);

  /* daily goal: live-clamped while typing so the ring never divides by 0 */
  const goal = $('#fDailyGoal');
  if (goal) goal.addEventListener('input', () => {
    const v = parseInt(goal.value, 10);
    if (!isFinite(v)) return;
    state.settings.dailyGoal = clamp(v, 5, 200);
    saveSettings();
    renderDailyCard();
  });

  const clearCache = $('#btnClearCache');
  if (clearCache) clearCache.addEventListener('click', () => {
    state.cache = {};
    state.tr = {};
    saveCache();
    saveTrCache();
    syncSettingsUI();
    renderStack();
    showToast('Meaning cache cleared', 'ok');
  });

  const restore = $('#btnRestore');
  if (restore) restore.addEventListener('click', () => {
    const added = restoreFromBackup();
    if (!added) { showToast('Backup is empty or already merged', 'warn'); syncSettingsUI(); return; }
    onRecordsChanged();
    syncSettingsUI();
    showToast('Restored ' + added + ' ' + (added === 1 ? 'record' : 'records') + ' from backup', 'ok');
  });

  const clearAll = $('#btnClearAll');
  if (clearAll) clearAll.addEventListener('click', () => {
    if (!state.records.length) { showToast('There are no records to delete', 'warn'); return; }
    if (!window.confirm('Delete all ' + state.records.length + ' records? The backup copy stays, so you can restore them here.')) return;
    state.records = [];
    saveRecords();
    onRecordsChanged();
    syncSettingsUI();
    showToast('All records deleted - use "Restore from backup" to get them back', 'ok');
  });
}

