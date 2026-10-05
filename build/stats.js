/* =====================================================================
   Learning statistics (v2.3)

   Everything is derived from what is already stored - record stats for the
   totals and the mastery bars, state.activity for the daily trend - so the
   sheet can never disagree with the pages it summarises.  Charts are hand-
   rolled SVG using only the skin's CSS variables: no library, no canvas,
   and every skin keeps its own colours.
   ===================================================================== */

function statsTotals() {
  let seen = 0, correct = 0, wrong = 0;
  state.records.forEach(r => {
    const st = (r && r.stats) || {};
    seen += st.seen || 0;
    correct += st.correct || 0;
    wrong += st.wrong || 0;
  });
  const answered = correct + wrong;
  return {
    saved: state.records.length,
    seen: seen, correct: correct, wrong: wrong,
    accuracy: answered ? Math.round(correct / answered * 100) : null
  };
}

/* saved words per CEFR level (words the deck has no level for land in the
   last row) with the share of right answers in each */
function statsLevelRows() {
  const rows = CEFR_LEVELS.map(level => ({ level: level, words: 0, correct: 0, wrong: 0 }));
  const unleveled = { level: '—', words: 0, correct: 0, wrong: 0 };
  state.records.forEach(r => {
    const lv = cefrOf(r.term);
    let row = lv ? null : unleveled;
    if (lv) rows.forEach(x => { if (x.level === lv) row = x; });
    if (!row) return;
    row.words++;
    row.correct += (r.stats && r.stats.correct) || 0;
    row.wrong += (r.stats && r.stats.wrong) || 0;
  });
  return rows.concat(unleveled.words ? [unleveled] : []).filter(x => x.words);
}

/* one entry per local day, oldest first, missing days included as zeros */
function statsSeries(days) {
  const out = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime());
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    const t = state.activity[key];
    out.push({ date: key, reviewed: t ? t.reviewed || 0 : 0, correct: t ? t.correct || 0 : 0 });
  }
  return out;
}
/* a line of daily accuracy; days with no reviews are a gap, not a zero, so
   the chart never claims a 0% the learner never earned */
function statsTrendSVG(series) {
  const known = series.filter(d => d.reviewed > 0);
  if (!known.length) {
    return '<p class="stats__empty">No reviews in this window yet &mdash; the line shows up once you answer a few questions.</p>';
  }
  const W = 320, H = 96, padX = 8, padY = 12;
  const span = series.length - 1 || 1;
  const xOf = i => padX + i * (W - padX * 2) / span;
  const yOf = acc => padY + (1 - acc) * (H - padY * 2);
  const pts = series.map((d, i) => ({
    x: xOf(i), y: yOf(d.correct / d.reviewed), acc: d.correct / d.reviewed, d: d
  })).filter(p => p.d.reviewed > 0);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
  const area = line + ' L' + pts[pts.length - 1].x.toFixed(1) + ' ' + (H - padY) +
    ' L' + pts[0].x.toFixed(1) + ' ' + (H - padY) + ' Z';
  const dots = pts.map(p =>
    '<circle class="stats__dot" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="2.4">' +
    '<title>' + p.d.date + ': ' + Math.round(p.acc * 100) + '% (' + p.d.reviewed + ')</title></circle>').join('');
  return '<svg class="stats__svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" ' +
    'role="img" aria-label="Daily accuracy over the last ' + series.length + ' days">' +
    '<line class="stats__axis" x1="' + padX + '" y1="' + (H - padY) + '" x2="' + (W - padX) + '" y2="' + (H - padY) + '"/>' +
    '<line class="stats__axis" x1="' + padX + '" y1="' + padY + '" x2="' + (W - padX) + '" y2="' + padY + '"/>' +
    '<path class="stats__area" d="' + area + '"/>' +
    '<path class="stats__line" d="' + line + '"/>' + dots + '</svg>' +
    '<div class="stats__axislabels"><span>' + series[0].date.slice(5) + '</span>' +
    '<span>' + series[series.length - 1].date.slice(5) + '</span></div>';
}

/* the words the learner keeps missing, worst first, each one a link into its
   own entry sheet */
function statsTopMissed(n) {
  return state.records
    .filter(r => r.stats && r.stats.wrong > 0)
    .slice()
    .sort((a, b) => (b.stats.wrong - a.stats.wrong) || ((a.stats.correct || 0) - (b.stats.correct || 0)))
    .slice(0, n || 10);
}

function statsTile(label, value) {
  return '<div class="stat"><div class="stat__v">' + value + '</div>' +
    '<div class="stat__k">' + escapeHTML(label) + '</div></div>';
}

function renderStats() {
  const t = statsTotals();
  const ov = $('#statsOverview');
  if (ov) {
    ov.innerHTML = statsTile('Saved', t.saved) + statsTile('Reviews', t.seen) +
      statsTile('Accuracy', t.accuracy === null ? '—' : t.accuracy + '%') +
      statsTile('Due now', dueRecords().length);
  }
  const lv = $('#statsLevels');
  if (lv) {
    const rows = statsLevelRows();
    lv.innerHTML = rows.length ? rows.map(r => {
      const answered = r.correct + r.wrong;
      const pct = answered ? Math.round(r.correct / answered * 100) : 0;
      return '<div class="stats__row">' +
        '<span class="stats__lv">' + escapeHTML(r.level) + '</span>' +
        '<span class="stats__bar"><span class="stats__fill" style="width:' + (answered ? pct : 0) + '%"></span></span>' +
        '<span class="stats__num">' + r.words + ' word' + (r.words === 1 ? '' : 's') +
        (answered ? ' &middot; ' + pct + '%' : ' &middot; untested') + '</span></div>';
    }).join('') : '<p class="stats__empty">No saved words yet &mdash; save a few and the levels fill up.</p>';
  }
  const tr = $('#statsTrend');
  if (tr) tr.innerHTML = statsTrendSVG(statsSeries(30));
  const top = $('#statsTop');
  if (top) {
    const list = statsTopMissed(10);
    top.innerHTML = list.length ? list.map(r =>
      '<button type="button" class="stats__word" data-id="' + escapeHTML(r.id) + '">' +
      '<span class="stats__term">' + escapeHTML(r.term) + '</span>' +
      '<span class="stats__meta">' + r.stats.wrong + ' missed &middot; ' +
      (r.stats.correct || 0) + ' correct</span></button>').join('')
      : '<p class="stats__empty">No misses yet &mdash; that is the whole idea.</p>';
  }
}

function openStats() {
  renderStats();
  openSheet('sheetStats');
}

function initStats() {
  const btn = $('#btnStats');
  if (btn) btn.addEventListener('click', openStats);
  /* a word in the "most missed" list opens that entry, the sheet gets out of the way */
  const top = $('#statsTop');
  if (top) top.addEventListener('click', e => {
    const b = e.target.closest('.stats__word');
    if (!b) return;
    closeSheet('sheetStats');
    openEntrySheet(b.getAttribute('data-id'));
  });
}