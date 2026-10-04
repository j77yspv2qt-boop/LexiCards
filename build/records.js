/* =====================================================================
   Records page: list, search, sort, delete
   ===================================================================== */
function enTexts(rec) {
  return (rec.en || []).map(e => (typeof e === 'string' ? e : (e && e.text) || '')).filter(Boolean);
}

function visibleRecords() {
  const searchEl = $('#searchRecords');
  const sortEl = $('#sortRecords');
  const q = normText(searchEl ? searchEl.value : '');
  const sort = sortEl ? sortEl.value : 'newest';
  let list = state.records.slice();

  if (q) {
    list = list.filter(r => {
      const hay = normText([
        r.term, (r.zh || []).join(' '), enTexts(r).join(' '), (r.tags || []).join(' '), r.note || ''
      ].join(' '));
      return hay.indexOf(q) >= 0;
    });
  }
  if (sort === 'az') list.sort((a, b) => a.term.toLowerCase() < b.term.toLowerCase() ? -1 : 1);
  else if (sort === 'wrong') list.sort((a, b) => ((b.stats && b.stats.wrong) || 0) - ((a.stats && a.stats.wrong) || 0));
  else if (sort === 'seen') list.sort((a, b) => ((b.stats && b.stats.seen) || 0) - ((a.stats && a.stats.seen) || 0));
  else if (sort === 'due') list.sort((a, b) => ((a.stats && a.stats.dueAt) || 0) - ((b.stats && b.stats.dueAt) || 0));
  else list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return list;
}

function recordItemHTML(r) {
  const zh = r.zh || [];
  const en = enTexts(r);
  const stats = r.stats || { correct: 0, wrong: 0, seen: 0 };
  const tags = (r.tags || []).slice(0, 2);
  const date = r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : '';
  return '<li class="item" data-id="' + escapeHTML(r.id) + '">' +
      '<div class="item__main">' +
        '<div class="item__head">' +
          '<span class="item__term">' + escapeHTML(r.term) + '</span>' +
          '<span class="chip chip--' + (r.type || 'word') + '">' + (TYPE_LABEL[r.type] || 'Word') + '</span>' +
          (cefrOf(r.term) ? '<span class="chip chip--level">' + cefrOf(r.term) + '</span>' : '') +
          tags.map(t => '<span class="chip chip--src">' + escapeHTML(t) + '</span>').join('') +
        '</div>' +

        (zh.length
          ? '<div class="item__zh">' + zh.map(z => escapeHTML(displayZh(z))).join(' &middot; ') + '</div>'
          : '<div class="item__zh" style="color:var(--placeholder,#9FB2CB)">No Chinese meaning yet - tap to add</div>') +
        (en.length ? '<div class="item__en">' + escapeHTML(en[0]) + '</div>' : '') +
        '<div class="item__meta">' +
          '<span>' + (stats.seen ? stats.seen + ' reviews' : 'Not reviewed yet') + '</span>' +
          (date ? '<span>' + escapeHTML(date) + '</span>' : '') +
          (isDueRecord(r) ? '<span class="item__due">Due today</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="item__side">' +
        '<div class="item__stats"><b>' + (stats.correct || 0) + '</b> / <i>' + (stats.wrong || 0) + '</i></div>' +
        '<button type="button" class="iconbtn iconbtn--danger" data-del="' + escapeHTML(r.id) + '" aria-label="Delete entry" title="Delete">&#10005;</button>' +

      '</div>' +
    '</li>';
}

function renderRecordsList() {
  const list = $('#recordsList');
  const empty = $('#recordsEmpty');
  const count = $('#recordsCount');
  if (!list) return;
  const items = visibleRecords();
  list.innerHTML = items.map(recordItemHTML).join('');
  if (empty) empty.hidden = state.records.length > 0;
  if (count) {
    if (!state.records.length) count.textContent = 'No records yet';
    else if (items.length === state.records.length) {
      count.textContent = state.records.length + (state.records.length === 1 ? ' record' : ' records');
    } else {
      count.textContent = items.length + ' of ' + state.records.length + ' records';
    }
  }

  $$('.item', list).forEach(el => {
    el.addEventListener('click', ev => {
      if (ev.target.closest('[data-del]')) return;
      openEntrySheet(el.getAttribute('data-id'));
    });
  });
  $$('[data-del]', list).forEach(btn => {
    btn.addEventListener('click', ev => {
      ev.stopPropagation();
      const rec = findRecordById(btn.getAttribute('data-del'));
      if (!rec) return;
      if (window.confirm('Delete "' + rec.term + '" from your records?')) {
        removeRecord(rec.id);
        refreshRecords();
        onRecordsChanged();
        showToast('Deleted', 'ok');
      }
    });
  });
}

function refreshRecords() {
  renderRecordsList();
  if (typeof refreshQuizState === 'function') refreshQuizState();
}

/* called whenever the record set changes */
function onRecordsChanged() {
  if (state.dictSub === 'mine') rebuildDeck();
  refreshRecords();
}

function initRecords() {
  const search = $('#searchRecords');
  if (search) search.addEventListener('input', debounce(renderRecordsList, 180));
  const sort = $('#sortRecords');
  if (sort) sort.addEventListener('change', renderRecordsList);
  const newBtn = $('#fabAdd');
  if (newBtn) newBtn.addEventListener('click', () => openEntrySheet(null));
  const dataBtn = $('#btnData');
  if (dataBtn) dataBtn.addEventListener('click', () => openSheet('sheetData'));
}
