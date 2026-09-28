/* =====================================================================
   Offline vocabulary layer.

   data_gloss.js / data_cefr.js / data_examples.js / data_extra.js carry a
   bundled table of Chinese glosses, CEFR levels and example sentences, so
   Discover and Quiz stay useful with no network at all and every built-in
   entry has an example.  Everything here is defensive: if a table is missing
   the app behaves exactly like it did before (API lookups only).
   ===================================================================== */
const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
/* A1-B2 are the ranges the UI offers; B2 doubles as "B2 and above" because
   the deck stops at C1. */
const CEFR_BUCKET = { A1: ['A1'], A2: ['A2'], B1: ['B1'], B2: ['B2', 'C1'], C1: ['C1'] };
/* words that carry no CEFR tag fall back to the bucket they came from */
const LEVEL_FALLBACK = { core: 'A2', intermediate: 'B1', advanced: 'B2' };


function glossTable()   { return (typeof GLOSS !== 'undefined' && GLOSS) ? GLOSS : {}; }
function cefrTable()    { return (typeof CEFR !== 'undefined' && CEFR) ? CEFR : {}; }
function exampleTable() { return (typeof EXAMPLES !== 'undefined' && EXAMPLES) ? EXAMPLES : {}; }
function extraTable()   { return (typeof EXTRA_WORDS !== 'undefined' && EXTRA_WORDS) ? EXTRA_WORDS : {}; }

function cefrOf(term) { return cefrTable()[normKey(term)] || ''; }
function offlineGloss(term) { return glossTable()[normKey(term)] || null; }
function offlineExample(term) { return exampleTable()[normKey(term)] || ''; }

function offlineZh(term) {
  const g = offlineGloss(term);
  return (g && Array.isArray(g.z)) ? g.z.filter(Boolean).slice(0, 3) : [];
}
function offlinePhon(term) {
  const g = offlineGloss(term);
  return (g && g.p) ? '/' + g.p + '/' : '';
}
function hasOffline(term) { return offlineZh(term).length > 0; }
function offlineMeaning(term) {
  return { zh: offlineZh(term), phonetic: offlinePhon(term), example: offlineExample(term) };
}
/* a gloss is only usable as a quiz option when it carries a real meaning */
function glossText(item) { return (item.zh && item.zh.length) ? String(item.zh[0]) : ''; }

/* ------------------------------ level pools ------------------------------ */
const LEVEL_POOLS = Object.create(null);

/* every built-in word of one CEFR level that we can quiz on offline */
function levelPool(level) {
  if (LEVEL_POOLS[level]) return LEVEL_POOLS[level];
  const out = [];
  sourceTerms(level).forEach(d => {
    if (d.type !== 'word') return;
    const zh = offlineZh(d.term);
    if (!zh.length) return;
    out.push({
      term: d.term, level: level, zh: zh,
      phonetic: offlinePhon(d.term), example: offlineExample(d.term)
    });
  });
  LEVEL_POOLS[level] = out;
  return out;
}

/* saved words, keeping only entries we actually have a meaning to ask about */
function recordsPool() {
  return state.records.filter(r => r.zh && r.zh.length);
}
function poolSizeFor(scope) {
  if (scope === 'records') return recordsPool().length;
  return levelPool(scope).length;
}

/* --------------------------- confusable options ---------------------------
   The wrong options are picked to be *plausible*: a look-alike / sound-alike
   of the term, or a word whose Chinese meaning overlaps.  Edit distance is the
   strong signal (adopt / adapt), the shared first letter and shared gloss
   characters are weaker ones. */
function editDistance(a, b, cap) {
  const limit = cap || 5;
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let prev = new Array(b.length + 1);
  let cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > limit) return limit + 1;
    const tmp = prev; prev = cur; cur = tmp;
  }
  return prev[b.length];
}
function sharedPrefix(a, b) {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}
function sharedSuffix(a, b) {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}
function glossOverlap(a, b) {
  const seen = Object.create(null);
  String(a || '').split('').forEach(ch => { if (!/\s/.test(ch)) seen[ch] = true; });
  let hits = 0;
  String(b || '').split('').forEach(ch => { if (ch in seen) { hits++; seen[ch] = false; } });
  return hits;
}

function confusionScore(termA, glossA, termB, glossB) {
  const a = String(termA).toLowerCase(), b = String(termB).toLowerCase();
  if (!b || a === b) return -1;
  let s = 0;
  const d = editDistance(a, b, 4);
  if (d <= 1) s += 6;
  else if (d <= 2) s += 4;
  else if (d <= 3) s += 2;
  s += Math.min(2, sharedPrefix(a, b));
  if (sharedSuffix(a, b) >= 3) s += 1;
  if (a[0] === b[0]) s += 1;
  if (Math.abs(a.length - b.length) <= 1) s += 1;
  s += Math.min(3, glossOverlap(glossA, glossB));
  return s;
}

/* n wrong options for `item`, drawn from `pool` */
function pickDistractors(item, pool, n) {
  const correctText = glossText(item);
  const scored = [];
  for (let i = 0; i < pool.length; i++) {
    const c = pool[i];
    if (!c || c.term === item.term) continue;
    const t = glossText(c);
    if (!t || t === correctText) continue;
    scored.push({ cand: c, text: t, s: confusionScore(item.term, correctText, c.term, t) });
  }
  if (!scored.length) return [];
  let candidates;
  if (state.settings.quizTricky) {
    scored.sort((x, y) => y.s - x.s);
    /* the trickiest handful - but never just the single best match, or the
       same distractor would follow every question */
    candidates = scored.slice(0, Math.min(scored.length, Math.max(n * 8, 16)));
  } else {
    candidates = scored;
  }
  const picked = [];
  const used = Object.create(null);
  used[normKey(correctText)] = true;
  const bag = shuffle(candidates);
  for (let i = 0; i < bag.length && picked.length < n; i++) {
    const key = normKey(bag[i].text);
    if (used[key]) continue;
    used[key] = true;
    picked.push(bag[i]);
  }
  return picked;
}

