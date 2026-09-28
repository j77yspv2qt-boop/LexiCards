/* ------------------- cache + orchestrator: getMeaning() ------------------- */
const INFLIGHT = new Map();
const PATCHES = new Map();                 /* meaningKey -> promise of the bilingual step */
const MEANING_PATCH_LISTENERS = [];

/* the card layer subscribes here to fill in the "Definition in Chinese" block
   that arrives a moment after the card itself is already on screen */
function onMeaningPatch(fn) { MEANING_PATCH_LISTENERS.push(fn); }
function notifyMeaningPatch(m) {
  MEANING_PATCH_LISTENERS.forEach(fn => { try { fn(m); } catch (e) { /* listener error only */ } });
}

/* every network step that belongs to this meaning has finished */
function whenMeaningSettled(term, type) {
  const pending = PATCHES.get(meaningKey(term, type));
  return pending || Promise.resolve(state.cache[meaningKey(term, type)] || null);
}

/* true while the bilingual step of this term is still on the wire */
function hasPendingPatch(term, type) {
  return PATCHES.has(meaningKey(term, type));
}

function meaningKey(term, type) { return normKey(term) + '|' + (type || ''); }

function cachedMeaning(term, type, force) {
  const hit = state.cache[meaningKey(term, type)];
  if (!hit) return null;
  const age = Date.now() - (hit.fetchedAt || 0);
  const ttl = hit.ok ? CACHE_TTL : CACHE_FAIL_TTL;
  if (!force && age > ttl) return null;
  return hit;
}

function isMeaningReady(term, type) {
  return !!cachedMeaning(term, type, false);
}

function sourceLabel(src) {
  const map = {
    dictionaryapi: 'Dictionary API',
    wiktionary: 'Wiktionary',
    datamuse: 'Datamuse',
    translation: 'Translation only',
    offline: 'Built-in list',
    manual: 'Manual',
    none: 'Not found'
  };
  return map[src] || 'Not found';
}


function errText(e) {
  return (e && e.message) ? String(e.message) : 'translation failed';
}

/* one-line health report for the Data & settings sheet */
function speedSummary() {
  const m = state.metrics;
  const parts = [];
  if (m.lookups) parts.push(m.lookups + ' lookups, ' + Math.round(m.lookupMs / m.lookups) + ' ms average');
  if (m.cacheHits) parts.push(m.cacheHits + ' instant cache hits');
  if (m.translations) parts.push(m.translations + ' translations fetched');
  parts.push('providers: ' + activeProviderLabel());
  return parts.join(' - ');
}

/* ---- phase 2 of a lookup: the bilingual "Definition in Chinese" and the
       example translation.  Deliberately not awaited by getMeaning(): the
       card is already readable, and this block pops in as soon as the
       translation answers.  Shared by a fresh lookup and by the cache-hit
       healer, so an entry saved before its Chinese explanation landed (or
       when the translation quota had run out) still gets one later. ---- */
function startBilingualPatch(key, out) {
  if (PATCHES.has(key)) return PATCHES.get(key);
  const patchJobs = [];
  if (out.en.length && (!out.defZh || !out.defZh.length)) {
    patchJobs.push(translateCached(out.en[0].text).then(fz => {
      const trad = toTrad(fz);
      if (trad) out.defZh = [trad];
    }, () => {}));
  }
  if (out.example && !out.exampleZh) {
    patchJobs.push(translateCached(out.example).then(fz => {
      const trad = toTrad(fz);
      if (trad) out.exampleZh = trad;
    }, () => {}));
  }
  if (!patchJobs.length) return Promise.resolve(out);
  const patch = Promise.all(patchJobs).then(() => {
    state.cache[key] = out;
    saveCacheSoon();
    notifyMeaningPatch(out);
    return out;
  }, () => {
    notifyMeaningPatch(out);
    return out;
  });
  PATCHES.set(key, patch);
  patch.then(() => PATCHES.delete(key), () => PATCHES.delete(key));
  return patch;
}

function getMeaning(term, type, force) {
  const key = meaningKey(term, type);
  if (!force) {
    const hit = cachedMeaning(term, type, false);
    if (hit) {
      state.metrics.cacheHits++;
      /* self-heal: a cached entry without its Chinese explanation (saved
         before the patch landed, or while translations were failing) kicks
         the bilingual step off again instead of staying Chinese-less */
      const needsDefZh = hit.en && hit.en.length && (!hit.defZh || !hit.defZh.length);
      const needsExampleZh = hit.example && !hit.exampleZh;
      if ((needsDefZh || needsExampleZh) && !PATCHES.has(key) && (hit.patchTries || 0) < 3) {
        hit.patchTries = (hit.patchTries || 0) + 1;
        startBilingualPatch(key, hit);
      }
      return Promise.resolve(hit);
    }
    if (INFLIGHT.has(key)) return INFLIGHT.get(key);
  }

  const job = (async function () {
    const out = {
      term: term, en: [], zh: [], defZh: [], phonetic: '', audio: '',
      example: '', exampleZh: '',
      source: 'none', ok: false, note: '', fetchedAt: Date.now()
    };

    /* ---- phase 1: English definition and the Chinese gloss at the same time ----
       They used to run one after the other, so a card waited for the sum of the
       two round trips.  Now the card is ready after the slower of the two. */
    const jobs = [];

    if (type === 'word') {
      jobs.push(lookupEnglish(term).then(r => {
        out.en = r.en;
        out.phonetic = r.phonetic || '';
        out.audio = r.audio || '';
        out.example = r.example || '';
        out.source = r.source;
        out.ok = true;
      }, () => { /* every English provider failed - the gloss may still work */ }));
    }

    jobs.push(translateCached(term).then(zh => {
      if (!zh) return;
      const trad = toTrad(zh);
      out.zh = [trad || zh];
      out.ok = true;
      if (out.source === 'none') out.source = 'translation';
    }, e => {
      out.note = errText(e);
    }));

    await Promise.all(jobs);

    /* ---- bundled vocabulary fills the gaps ---------------------------------
       The offline tables carry a Chinese gloss, a phonetic and an example for
       every built-in entry, so a card is complete even with no network: what
       the APIs did not return is taken from them instead of leaving a blank
       "No meaning found" card. */
    const off = offlineMeaning(term);
    if (!out.zh.length && off.zh.length) {
      out.zh = off.zh;
      out.ok = true;
      if (out.source === 'none') out.source = 'offline';
    }
    if (!out.phonetic && off.phonetic) out.phonetic = off.phonetic;
    if (!out.example && off.example) out.example = off.example;

    if (!out.ok) out.source = 'none';

    state.cache[key] = out;
    trimCaches();
    saveCacheSoon();

    /* ---- phase 2: bilingual explanation and example translation ----
       Deliberately not awaited: the card is already readable, and this block
       pops in as soon as the translation answers. */
    startBilingualPatch(key, out);

    return out;
  })();

  INFLIGHT.set(key, job);
  job.then(() => INFLIGHT.delete(key), () => INFLIGHT.delete(key));
  return job;
}

/* used by the Records page: fill in a meaning the API knows but the user did not type */
function enrichRecord(rec) {
  return getMeaning(rec.term, rec.type).then(m => {
    let changed = false;
    if ((!rec.zh || !rec.zh.length) && m.zh && m.zh.length) { rec.zh = m.zh.slice(); changed = true; }
    if ((!rec.en || !rec.en.length) && m.en && m.en.length) { rec.en = m.en.slice(); changed = true; }
    if (!rec.phonetic && m.phonetic) { rec.phonetic = m.phonetic; changed = true; }
    if (!rec.audio && m.audio) { rec.audio = m.audio; changed = true; }
    if (!rec.example && m.example) { rec.example = m.example; changed = true; }
    if (changed) { rec.updatedAt = Date.now(); saveRecords(); }
    return rec;
  }).catch(() => rec);
}
