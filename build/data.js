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
    /* related-word entries share the cache but are not meanings */
    const meaningKeys = Object.keys(state.cache).filter(k => k.indexOf('rel|') !== 0).length;
    const relKeys = Object.keys(state.cache).length - meaningKeys;
    info.textContent = state.records.length + ' records - ' + meaningKeys +
      ' cached meanings - ' + relKeys + ' cached relations - ' +
      Object.keys(state.tr).length + ' cached translations - about ' +
      Math.max(1, Math.round(bytes / 1024)) + ' KB. ' + nativeDescribe() + ' ' +
      (storageOK ? 'Kept on this device (localStorage).' : 'This browser blocks storage, so data is temporary.');
  }
  const exp = $('#exportInfo');
  if (exp) exp.textContent = exportReminderText();
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

function exportStamp() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function exportData() {
  const payload = {
    app: 'LexiCards', version: 1, exportedAt: new Date().toISOString(),
    records: state.records, settings: state.settings, custom: state.custom
  };
  download('lexicards-' + exportStamp() + '.json', JSON.stringify(payload, null, 2));
  markExported();
  showToast('Exported ' + state.records.length + ' records', 'ok');
}

/* --- tabular exports (v2.4) ---------------------------------------------------
   JSON is the faithful backup; these two are for the tools people actually
   open a word list in: a spreadsheet, or Anki.  Nothing is re-derived here -
   the text is built from the records, so what lands in the file is what is
   stored, not what the app would fetch again. */

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function tsvCell(v) {
  return String(v == null ? '' : v).replace(/[\t\r\n]+/g, ' ').trim();
}

function recordsCSVText() {
  const head = ['term', 'type', 'level', 'phonetic', 'zh', 'en', 'example', 'tags', 'note', 'reviews', 'correct', 'wrong'];
  const lines = [head.join(',')];
  state.records.forEach(r => {
    const st = r.stats || {};
    lines.push([
      csvCell(r.term), csvCell(r.type || 'word'), csvCell(cefrOf(r.term) || ''),
      csvCell(r.phonetic || ''), csvCell((r.zh || []).join(' / ')),
      csvCell(enTexts(r).join(' / ')), csvCell(r.example || ''),
      csvCell((r.tags || []).join(' ')), csvCell(r.note || ''),
      st.seen || 0, st.correct || 0, st.wrong || 0
    ].join(','));
  });
  return lines.join('\r\n');
}

/* the three columns Anki's text importer asks for; the Chinese goes on the
   first line of the back, the English below it */
function recordsAnkiText() {
  const lines = ['#separator:tab', '#html:true', '#columns:Term\tChinese\tTags'];
  state.records.forEach(r => {
    const tags = (r.tags || []).slice();
    const lv = cefrOf(r.term);
    if (lv && tags.indexOf(lv) < 0) tags.push(lv);
    const back = (r.zh || []).map(z => displayZh(z)).join(' / ') +
      (enTexts(r).length ? '\n' + enTexts(r).join('\n') : '');
    lines.push([tsvCell(r.term), tsvCell(back), tsvCell(tags.join(' '))].join('\t'));
  });
  return lines.join('\r\n');
}

function exportCSV() {
  download('lexicards-' + exportStamp() + '.csv', '\uFEFF' + recordsCSVText());
  markExported();
  showToast('Exported ' + state.records.length + ' records as CSV', 'ok');
}
function exportAnki() {
  download('lexicards-' + exportStamp() + '.txt', recordsAnkiText());
  markExported();
  showToast('Exported ' + state.records.length + ' cards for Anki', 'ok');
}
/* --- tabular import ----------------------------------------------------------
   Accepts what we export (CSV), what Anki exports (tab separated, with its
   #comments) and plain "one term per line" files.  Existing entries are only
   ever filled in, never overwritten - a word you corrected stays corrected. */

/* One pass over the whole text rather than one line at a time: Anki writes a
   back field that holds both languages as "Chinese\nEnglish", so a quoted cell
   can span lines and a line split would tear it in two.  A quoted cell also
   doubles any quote inside it ("say ""hi"""). */
function parseDelimited(text) {
  const body = String(text || '').replace(/^\uFEFF/, '');
  const firstLine = body.split(/\r?\n/).filter(l => l.trim() && l.charAt(0) !== '#')[0] || '';
  const delim = (firstLine.indexOf('\t') >= 0 && firstLine.indexOf(',') < 0) ? '\t' : ',';
  const rows = [];
  let cells = [], cur = '', quoted = false;
  const endCell = () => { cells.push(cur); cur = ''; };
  const endRow = () => {
    endCell();
    if (cells.some(c => String(c).trim())) rows.push(cells);
    cells = [];
  };
  for (let i = 0; i < body.length; i++) {
    const ch = body.charAt(i);
    if (quoted) {
      if (ch !== '"') { cur += ch; continue; }
      if (body.charAt(i + 1) === '"') { cur += '"'; i++; } else quoted = false;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delim) {
      endCell();
    } else if (ch === '\n') {
      endRow();
    } else if (ch !== '\r') {
      cur += ch;
    }
  }
  if (cur.length || cells.length) endRow();
  /* Anki's own comments (#separator, #columns, ...) are metadata, not rows */
  while (rows.length && String(rows[0][0] || '').charAt(0) === '#') rows.shift();
  if (rows.length && String(rows[0][0] || '').trim().toLowerCase() === 'term') rows.shift();
  return rows;
}

function importDelimitedText(text) {
  const rows = parseDelimited(text);
  let added = 0, updated = 0, skipped = 0;
  rows.forEach(cells => {
    const term = String(cells[0] || '').trim();
    if (!term) { skipped++; return; }
    const wide = cells.length >= 4;              /* our own CSV column layout */
    const back = String(cells[1] || '');
    const nl = back.indexOf('\n');
    const zhText = wide ? (cells[4] || '') : (nl >= 0 ? back.slice(0, nl) : back);
    const enText = wide ? (cells[5] || '') : (nl >= 0 ? back.slice(nl + 1).replace(/\n/g, ' / ') : '');
    const data = {
      term: term,
      type: wide && TYPE_LABEL[cells[1]] ? cells[1] : guessType(term),
      zh: splitSenses(zhText),
      en: enText ? enText.split(/\s*\/\s*/).map(t => t.trim()).filter(Boolean) : [],
      phonetic: wide ? (cells[3] || '') : '',
      example: wide ? (cells[6] || '') : '',
      tags: String(wide ? (cells[7] || '') : (cells[2] || '')).split(/\s+/).filter(Boolean),
      note: wide ? (cells[8] || '') : '',
      source: 'import'
    };
    const existing = findRecordByTerm(term);
    if (existing) {
      let changed = false;
      if ((!existing.zh || !existing.zh.length) && data.zh.length) { existing.zh = data.zh; changed = true; }
      if ((!existing.en || !existing.en.length) && data.en.length) { existing.en = data.en; changed = true; }
      if (!existing.phonetic && data.phonetic) { existing.phonetic = data.phonetic; changed = true; }
      if (!existing.example && data.example) { existing.example = data.example; changed = true; }
      const fresh = data.tags.filter(t => (existing.tags || []).indexOf(t) < 0);
      if (fresh.length) { existing.tags = (existing.tags || []).concat(fresh); changed = true; }
      if (!existing.note && data.note) { existing.note = data.note; changed = true; }
      if (changed) { existing.updatedAt = Date.now(); updated++; } else skipped++;
    } else {
      upsertRecord(data);
      added++;
    }
  });
  if (added || updated) { saveRecords(); onRecordsChanged(); }
  return { added: added, updated: updated, skipped: skipped };
}

function importDelimitedFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const res = importDelimitedText(String(reader.result));
      if (!res.added && !res.updated) showToast('Nothing new in that file', 'warn');
      else showToast('Imported: ' + res.added + ' new, ' + res.updated + ' filled in', 'ok');
    } catch (err) {
      showToast('Could not read that file', 'err');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

/* --- export reminder ---------------------------------------------------------
   Nothing here is uploaded anywhere, so the copy on this device is the only
   copy - the reminder is a nudge, once, never a nag. */
const EXPORT_NUDGE_DAYS = 30;

function markExported() {
  state.settings.lastExportAt = Date.now();
  saveSettings();
  syncSettingsUI();
}

function exportReminderText() {
  const at = state.settings.lastExportAt || 0;
  if (!at) return 'You have never exported a backup - the records live only on this device.';
  const days = Math.floor((Date.now() - at) / 86400000);
  if (days <= 0) return 'Exported today.';
  return 'Last export ' + days + ' day' + (days === 1 ? '' : 's') + ' ago.';
}

function exportIsOverdue() {
  const at = state.settings.lastExportAt || 0;
  return !at || (Date.now() - at) > EXPORT_NUDGE_DAYS * 86400000;
}

function maybeRemindExport() {
  if (!exportIsOverdue() || state.settings.exportReminderShown) return false;
  state.settings.exportReminderShown = true;
  saveSettings();
  showToast('Records live only on this device - a periodic Export keeps them safe', 'warn', 5200);
  return true;
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

  const csvBtn = $('#btnExportCSV');
  if (csvBtn) csvBtn.addEventListener('click', exportCSV);
  const ankiBtn = $('#btnExportAnki');
  if (ankiBtn) ankiBtn.addEventListener('click', exportAnki);
  const importCsvBtn = $('#btnImportCSV');
  const fileImportCsv = $('#fileImportCSV');
  if (importCsvBtn && fileImportCsv) importCsvBtn.addEventListener('click', () => fileImportCsv.click());
  if (fileImportCsv) fileImportCsv.addEventListener('change', importDelimitedFile);

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

