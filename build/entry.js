/* =====================================================================
   Entry sheet: create / edit a record by hand
   ===================================================================== */
let entryType = 'word';
let lastFetchedTerm = '';

function setEntryType(type) {
  entryType = type;
  $$('#fType .seg').forEach(b => b.classList.toggle('is-active', b.dataset.type === type));
}

function setFetchStatus(text, kind) {
  const el = $('#fetchStatus');
  if (!el) return;
  el.textContent = text;
  el.className = 'fetchrow__status' + (kind ? ' is-' + kind : '');
}

function openEntrySheet(id) {
  state.editingId = id || null;
  const rec = id ? findRecordById(id) : null;
  lastFetchedTerm = '';
  $('#entryTitle').textContent = rec ? 'Edit entry' : 'New entry';
  $('#fTerm').value = rec ? rec.term : '';
  setEntryType(rec ? (rec.type || guessType(rec.term)) : 'word');
  $('#fZh').value = rec ? (rec.zh || []).join('\n') : '';
  $('#fEn').value = rec ? enTexts(rec).join('\n') : '';
  $('#fPhon').value = rec ? (rec.phonetic || '') : '';
  $('#fNote').value = rec ? (rec.note || '') : '';
  $('#fTags').value = rec ? (rec.tags || []).join(', ') : '';
  $('#btnDeleteEntry').hidden = !rec;
  setFetchStatus(rec
    ? 'Your own text is kept - the API never overwrites it.'
    : 'Free Dictionary API + translation, then you can edit everything.', '');
  openSheet('sheetEntry');
  if (!rec) setTimeout(() => { const t = $('#fTerm'); if (t) t.focus(); }, 280);
}

function fetchIntoForm() {
  const term = ($('#fTerm').value || '').trim();
  if (!term) { setFetchStatus('Type a term first.', 'err'); return; }
  setFetchStatus('Fetching...', '');
  getMeaning(term, entryType, true).then(m => {
    lastFetchedTerm = term;
    if (m.zh && m.zh.length) $('#fZh').value = m.zh.join('\n');
    if (m.en && m.en.length) $('#fEn').value = m.en.map(e => e.text).join('\n');
    if (m.phonetic) $('#fPhon').value = m.phonetic;
    const got = [];
    if (m.zh && m.zh.length) got.push('Chinese meaning');
    if (m.en && m.en.length) got.push('English explanation');
    if (got.length) {
      setFetchStatus('Filled in ' + got.join(' + ') + ' from ' + sourceLabel(m.source) + '.', 'ok');
    } else {
      setFetchStatus(m.note ? ('No result (' + m.note + ') - type the meaning yourself.') : 'Nothing found - type the meaning yourself.', 'err');
    }
  }).catch(() => setFetchStatus('Lookup failed - type the meaning yourself.', 'err'));
}

function saveEntry() {
  const term = ($('#fTerm').value || '').trim();
  if (!term) { showToast('Type the term first', 'err'); $('#fTerm').focus(); return; }

  const zh = splitSenses($('#fZh').value);
  const en = String($('#fEn').value || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const tags = String($('#fTags').value || '').split(',').map(s => s.trim()).filter(Boolean);

  const payload = {
    term: term,
    type: entryType,
    zh: zh,
    en: en,
    phonetic: ($('#fPhon').value || '').trim(),
    note: ($('#fNote').value || '').trim(),
    tags: tags,
    source: 'manual'
  };

  if (state.editingId) {
    payload.id = state.editingId;
    upsertRecord(payload);
    showToast('Entry updated', 'ok');
  } else {
    const dup = findRecordByTerm(term);
    if (dup) {
      payload.id = dup.id;
      upsertRecord(payload);
      showToast('Entry updated', 'ok');
    } else {
      upsertRecord(payload);
      showToast('Saved to Records', 'ok');
    }
  }

  closeSheet('sheetEntry');
  onRecordsChanged();
}

function deleteEntry() {
  const rec = state.editingId ? findRecordById(state.editingId) : null;
  if (!rec) return;
  if (!window.confirm('Delete "' + rec.term + '" from your records?')) return;
  removeRecord(rec.id);
  closeSheet('sheetEntry');
  onRecordsChanged();
  showToast('Deleted', 'ok');
}

function initEntrySheet() {
  const typeSeg = $('#fType');
  if (typeSeg) typeSeg.addEventListener('click', e => {
    const btn = e.target.closest('.seg');
    if (btn && btn.dataset.type) setEntryType(btn.dataset.type);
  });

  const fetchBtn = $('#btnFetch');
  if (fetchBtn) fetchBtn.addEventListener('click', fetchIntoForm);

  const saveBtn = $('#btnSaveEntry');
  if (saveBtn) saveBtn.addEventListener('click', saveEntry);

  const delBtn = $('#btnDeleteEntry');
  if (delBtn) delBtn.addEventListener('click', deleteEntry);

  /* auto-fill while typing, but never overwrite what the user already wrote */
  const termEl = $('#fTerm');
  if (termEl) termEl.addEventListener('input', debounce(() => {
    const term = termEl.value.trim();
    if (term.length < 3 || term === lastFetchedTerm) return;
    if (($('#fZh').value || '').trim() || ($('#fEn').value || '').trim()) return;
    fetchIntoForm();
  }, 900));
}
