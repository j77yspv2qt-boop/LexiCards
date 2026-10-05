/* =====================================================================
   Word family and related words (v2.4)

   Two different sources, two different rules:

   - the word family is worked out from the bundled deck at runtime, so it is
     there offline and costs nothing to store;
   - synonyms, antonyms and related words come from Datamuse and live in the
     same meaning cache (30 days, same trimming, failures cached for five
     minutes), so a weak connection is not re-asked for every card.

   Phrases and sentence patterns are skipped on purpose: there is nothing to
   hear, nothing to spell and nothing Datamuse would relate them to.
   ===================================================================== */

/* longest first: "ationally" must win over "ally" */
const FAMILY_SUFFIXES = [
  'ationally', 'ability', 'ibility', 'ousness', 'iveness', 'fulness', 'lessness',
  'ization', 'isation', 'ically', 'ically', 'ations', 'ation', 'ition', 'ution',
  'sion', 'ments', 'ment', 'nesses', 'ness', 'ities', 'ity', 'ingly', 'edly',
  'able', 'ible', 'less', 'ful', 'ive', 'ous', 'ical', 'ally', 'ise', 'ize',
  'ties', 'ing', 'ers', 'est', 'ies', 'ied', 'ion', 'ed', 'er', 'ly', 'es', 'al',
  'ic', 'y', 's'
];
const FAMILY_MAX = 6;

const FAMILY_INDEX = { stem: null, head: null };

/* the part of a word that survives its most common ending */
function stemKey(word) {
  const w = String(word || '').toLowerCase();
  for (let i = 0; i < FAMILY_SUFFIXES.length; i++) {
    const s = FAMILY_SUFFIXES[i];
    if (w.length - s.length >= 4 && w.slice(-s.length) === s) return w.slice(0, -s.length);
  }
  return w;
}

/* built once, on first use, from the words the deck already carries */
function familyIndex() {
  if (FAMILY_INDEX.stem) return FAMILY_INDEX;
  const stem = Object.create(null), head = Object.create(null);
  sourceTerms('all').forEach(d => {
    if (d.type !== 'word') return;
    const w = String(d.term).toLowerCase();
    if (!/^[a-z][a-z-]*$/.test(w) || w.length < 3) return;
    const sk = stemKey(w);
    if (!stem[sk]) stem[sk] = [];
    stem[sk].push(d.term);
    if (w.length >= 5) {
      const h = w.slice(0, 5);
      if (!head[h]) head[h] = [];
      head[h].push(d.term);
    }
  });
  FAMILY_INDEX.stem = stem;
  FAMILY_INDEX.head = head;
  return FAMILY_INDEX;
}

/* Words sharing this one's root: the same five-letter head (create /
   creation / creative) or the same stem (help / helper / helpful).  The five
   letter floor keeps port away from import, adapt away from adopt.  A big
   bucket (deci- has a dozen) is ranked by how much the candidate still looks
   like the word asked about, so the chip list starts with its closest kin
   instead of whatever the deck happened to list first. */
function wordFamily(term) {
  const w = String(term || '').toLowerCase();
  if (w.length < 3) return [];
  const idx = familyIndex();
  const seen = Object.create(null);
  const pool = [];
  const collect = list => (list || []).forEach(t => {
    if (seen[t] || t === term) return;
    seen[t] = true;
    pool.push(t);
  });
  if (w.length >= 5) collect(idx.head[w.slice(0, 5)]);
  collect(idx.stem[stemKey(w)]);
  if (pool.length <= FAMILY_MAX) return pool;
  const rank = t => sharedPrefix(w, t.toLowerCase()) * 2 - Math.abs(t.length - w.length);
  pool.sort((a, b) => rank(b) - rank(a) || (a < b ? -1 : 1));
  return pool.slice(0, FAMILY_MAX);
}
/* ------------------------------- online relations ---------------------------- */

const REL_KINDS = [
  { key: 'syn', label: 'Similar', rel: 'rel_syn' },
  { key: 'ant', label: 'Opposite', rel: 'rel_ant' },
  { key: 'trg', label: 'Related', rel: 'rel_trg' }
];
const REL_MAX = 5;
const REL_INFLIGHT = new Map();

function relatedKey(term) { return 'rel|' + normKey(term); }

function cachedRelated(term) {
  const hit = state.cache[relatedKey(term)];
  if (!hit) return null;
  const ttl = hit.ok ? CACHE_TTL : CACHE_FAIL_TTL;
  if (Date.now() - (hit.fetchedAt || 0) > ttl) return null;
  return hit;
}

function datamuseRelatedURL(rel, term) {
  return 'https://api.datamuse.com/words?rel=' + rel + '&max=' + REL_MAX +
    '&sp=' + encodeURIComponent(term);
}

function storeRelated(term, value) {
  state.cache[relatedKey(term)] = value;
  trimCaches();
  saveCacheSoon();
}

/* Kick the relations off for a card.  Resolves with the (possibly empty)
   result either way - nothing here is allowed to hold a card hostage. */
function ensureRelated(term) {
  const words = String(term || '').trim();
  const key = relatedKey(words);
  const hit = cachedRelated(words);
  if (hit) { paintRelated(words); return Promise.resolve(hit); }
  if (REL_INFLIGHT.has(key)) return REL_INFLIGHT.get(key);
  const empty = { syn: [], ant: [], trg: [], ok: false, fetchedAt: Date.now() };
  if (!/^[A-Za-z][A-Za-z-]*$/.test(words) || typeof navigator !== 'undefined' && navigator.onLine === false) {
    return Promise.resolve(empty);
  }
  const job = Promise.all(REL_KINDS.map(k =>
    fetchJSON(datamuseRelatedURL(k.rel, words), 3500)
      .then(list => (Array.isArray(list) ? list : [])
        .map(x => (x && x.word) || '')
        .filter(Boolean)
        .filter(w => normKey(w) !== normKey(words))
        .slice(0, REL_MAX))
      .catch(() => [])
  )).then(parts => {
    const out = { syn: parts[0], ant: parts[1], trg: parts[2],
                  ok: parts.some(p => p.length), fetchedAt: Date.now() };
    storeRelated(words, out);
    paintRelated(words);
    return out;
  }, () => {
    storeRelated(words, empty);          /* five minutes, then one more try */
    paintRelated(words);
    return empty;
  });
  REL_INFLIGHT.set(key, job);
  job.then(() => REL_INFLIGHT.delete(key), () => REL_INFLIGHT.delete(key));
  return job;
}

/* ------------------------------- rendering ------------------------------- */

function relatedChipsHTML(words) {
  return words.map(w =>
    '<button type="button" class="related__chip" data-related-term="' + escapeHTML(w) + '">' +
    escapeHTML(w) + '</button>').join('');
}

function relatedGroupsHTML(term, fam, rel) {
  let html = '';
  if (fam && fam.length) {
    html += '<div class="related__group"><div class="related__glabel">Word family</div>' +
      '<div class="related__chips">' + relatedChipsHTML(fam) + '</div></div>';
  }
  if (rel) {
    REL_KINDS.forEach(k => {
      const list = rel[k.key] || [];
      if (!list.length) return;
      html += '<div class="related__group"><div class="related__glabel">' + k.label + '</div>' +
        '<div class="related__chips">' + relatedChipsHTML(list) + '</div></div>';
    });
  }
  return html;
}

/* rendered under the example on every card; the online groups simply stay
   empty until their request lands and the block is repainted */
function relatedBlockHTML(term, type) {
  const fam = (type === 'phrase' || type === 'pattern') ? [] : wordFamily(term);
  const rel = cachedRelated(term);
  return '<div class="related" data-related data-term="' + escapeHTML(term) + '">' +
    relatedGroupsHTML(term, fam, rel) + '</div>';
}

/* repaint every card showing this term (the request answers long after the
   card was drawn) */
function paintRelated(term) {
  const key = normKey(term);
  $$('[data-related]').forEach(box => {
    if (normKey(box.getAttribute('data-term')) !== key) return;
    const fam = wordFamily(term);
    box.innerHTML = relatedGroupsHTML(term, fam, cachedRelated(term));
  });
}