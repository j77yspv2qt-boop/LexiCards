/* ---------------------- deck building, shuffle bag, queues ---------------------- */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function guessType(term) {
  const t = String(term || '').trim();
  if (/\.\.\.|\u2026|\[|\{/.test(t)) return 'pattern';
  const words = t.split(/\s+/).filter(Boolean);
  return words.length > 1 ? 'phrase' : 'word';
}

/* The built-in deck is assembled once and cached: the data behind it is
   static, and the Quiz rebuilds pools on every tap.  Each word carries a CEFR
   level (A1-B2) taken from the bundled CEFR table, falling back to the bucket
   it shipped in; EXTRA_WORDS adds the words the deck did not have. */
let SEED_CACHE = null;
function seedTerms() {
  if (SEED_CACHE) return SEED_CACHE;
  const out = [];
  const seen = Object.create(null);
  const push = (term, type, level) => {
    const key = normKey(term);
    if (!key || seen[key]) return;
    seen[key] = true;
    out.push({ term: term, type: type, level: level, source: 'seed' });
  };
  const addWords = (list, bucket) => {
    const fallback = LEVEL_FALLBACK[bucket] || 'B2';
    (list || []).forEach(term => push(term, 'word', cefrOf(term) || fallback));
  };
  addWords(SEED_WORDS.core, 'core');
  addWords(SEED_WORDS.intermediate, 'intermediate');
  addWords(SEED_WORDS.advanced, 'advanced');
  const extra = extraTable();
  Object.keys(extra).forEach(lv =>
    (extra[lv] || []).forEach(term => push(term, 'word', cefrOf(term) || lv)));
  (SEED_PHRASES || []).forEach(t => push(t, 'phrase', 'phrase'));
  (SEED_PATTERNS || []).forEach(t => push(t, 'pattern', 'pattern'));

  SEED_CACHE = out;
  return out;
}

function customTerms() {
  return (state.custom || []).map(t => ({ term: t, type: guessType(t), level: 'custom', source: 'custom' }));
}

function sourceTerms(filter) {
  const list = seedTerms().concat(customTerms());
  if (!filter || filter === 'all') return list;
  if (filter === 'word' || filter === 'phrase' || filter === 'pattern') {
    return list.filter(x => x.type === filter);
  }
  /* A1-B2 ranges: B2 also carries the C1 words, since the deck tops out there */
  const bucket = CEFR_BUCKET[filter] || [filter];
  if (CEFR_LEVELS.indexOf(filter) >= 0) {
    return list.filter(x => x.type === 'word' && bucket.indexOf(x.level) >= 0);
  }
  return list.filter(x => x.level === filter);
}



function recordCards(filter) {
  let list = state.records.map(r => ({ term: r.term, type: r.type, level: 'record', source: 'record', record: r }));
  if (filter === 'word' || filter === 'phrase' || filter === 'pattern') list = list.filter(x => x.type === filter);
  return list;
}

/* a deck = shuffled list of card descriptors, walked with a cursor */
function buildDeck() {
  const items = state.dictSub === 'mine' ? recordCards(state.filter) : sourceTerms(state.filter);
  const seen = state.deckIndex;                       // remember where we were for the same source
  state.deck = shuffle(items);
  state.deckIndex = 0;
  if (!state.deck.length) return;
  if (items.length > 2 && seen > 0 && seen < state.deck.length) state.deckIndex = 0;
}

function currentCards(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const card = state.deck[state.deckIndex + i];
    if (card) out.push(card);
  }
  return out;
}

function advanceDeck() {
  state.deckIndex++;
  if (state.deckIndex >= state.deck.length) {
    if (state.deck.length > 1) {
      const previous = state.deck[state.deck.length - 1];
      state.deck = shuffle(state.deck);
      if (normKey(state.deck[0].term) === normKey(previous.term) && state.deck.length > 1) {
        state.deck.push(state.deck.shift());
      }
    }
    state.deckIndex = 0;
  }
}

/* step back to the previous card (swipe left / ArrowLeft) */
function retreatDeck() {
  if (!state.deck.length) return;
  state.deckIndex = state.deckIndex > 0 ? state.deckIndex - 1 : state.deck.length - 1;
}

function progressLabel() {
  const total = state.deck.length || 0;
  const pos = total ? Math.min(state.deckIndex + 1, total) : 0;
  return { pos: pos, total: total, pct: total ? Math.round(pos / total * 100) : 0 };
}
