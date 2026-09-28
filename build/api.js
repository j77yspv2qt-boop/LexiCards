/* =====================================================================
   LexiCards - meaning pipeline
   English explanation : Free Dictionary API -> Wiktionary -> Datamuse
   Traditional Chinese : MyMemory translation API (en -> zh-TW)
   ===================================================================== */

function fetchJSON(url, ms) {
  return new Promise((resolve, reject) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms || API_TIMEOUT);
    fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
      .then(res => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(data => { clearTimeout(timer); resolve(data); })
      .catch(err => { clearTimeout(timer); reject(err); });
  });
}

function stripHTML(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = String(html || '');
  return (tmp.textContent || '').replace(/\s+/g, ' ').trim();
}

/* ---- 1) Free Dictionary API (primary, as requested) ---- */
function lookupFreeDictionary(term) {
  const url = 'https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(term);
  return fetchJSON(url, API_TIMEOUT).then(data => {
    const entry = Array.isArray(data) ? data[0] : null;
    if (!entry) throw new Error('no entry');
    const en = [];
    let example = '';
    (entry.meanings || []).slice(0, 3).forEach(m => {
      (m.definitions || []).slice(0, 2).forEach(d => {
        if (d.definition) en.push({ pos: m.partOfSpeech || '', text: d.definition });
        if (!example && d.example) example = String(d.example).trim();
      });
    });
    if (!en.length) throw new Error('no definitions');
    let phonetic = entry.phonetic || '';
    let audio = '';
    if (Array.isArray(entry.phonetics)) {
      for (let i = 0; i < entry.phonetics.length; i++) {
        const p = entry.phonetics[i];
        if (!phonetic && p && p.text) phonetic = p.text;
        if (!audio && p && p.audio) audio = p.audio;
      }
    }
    return { en: en.slice(0, 4), phonetic: phonetic, audio: audio, example: example, source: 'dictionaryapi' };
  });
}

/* ---- 2) Wiktionary REST fallback ---- */
function lookupWiktionary(term) {
  const url = 'https://en.wiktionary.org/api/rest_v1/page/definition/' + encodeURIComponent(term);
  return fetchJSON(url, API_TIMEOUT).then(data => {
    const langKey = (data && data.en) ? 'en' : Object.keys(data || {})[0];
    const groups = (data && data[langKey]) || [];
    const en = [];
    let example = '';
    groups.slice(0, 2).forEach(g => {
      (g.definitions || []).slice(0, 2).forEach(d => {
        const txt = stripHTML(d.definition);
        if (txt) en.push({ pos: (g.partOfSpeech || '').toLowerCase(), text: txt });
        if (!example && Array.isArray(d.examples) && d.examples.length) {
          example = stripHTML(d.examples[0]);
        }
      });
    });
    if (!en.length) throw new Error('no definitions');
    return { en: en.slice(0, 4), phonetic: '', audio: '', example: example, source: 'wiktionary' };
  });
}

/* ---- 3) Datamuse fallback ---- */
function lookupDatamuse(term) {
  const url = 'https://api.datamuse.com/words?sp=' + encodeURIComponent(term) + '&md=d&max=1';
  return fetchJSON(url, API_TIMEOUT).then(data => {
    const first = Array.isArray(data) ? data[0] : null;
    if (!first || !first.defs || !first.defs.length) throw new Error('no definitions');
    const en = [];
    first.defs.slice(0, 4).forEach(d => {
      const parts = String(d).split('\t');
      const text = parts[parts.length - 1] || '';
      if (text) en.push({ pos: (parts[0] || '').toLowerCase(), text: text });
    });
    if (!en.length) throw new Error('no definitions');
    return { en: en, phonetic: '', audio: '', example: '', source: 'datamuse' };
  });
}

/* ---- Traditional Chinese translation (en -> zh-TW) ---- */
function translateToZh(text) {
  const url = 'https://api.mymemory.translated.net/get?q=' +
    encodeURIComponent(String(text).slice(0, 480)) + '&langpair=en|zh-TW';
  return fetchJSON(url, API_TIMEOUT).then(data => {
    if (!data || Number(data.responseStatus) !== 200) {
      throw new Error((data && data.responseDetails) ? String(data.responseDetails) : 'translation failed');
    }
    if (data.quotaFinished) throw new Error('quota reached');
    const raw = data.responseData && data.responseData.translatedText;
    if (!raw) throw new Error('empty translation');
    const out = String(raw).trim();
    if (/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(out)) throw new Error('quota reached');
    return out;
  });
}

/* ---- Google translate (unofficial gtx endpoint): keyless, CORS-enabled ----
   This is the primary translator: the free MyMemory tier only allows a few
   thousand characters per day, which a single browsing session can burn. */
function translateViaGoogle(text) {
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&q=' +
    encodeURIComponent(String(text).slice(0, 2000));
  return fetchJSON(url, API_TIMEOUT).then(data => {
    if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error('bad translation response');
    const out = data[0].map(seg => (Array.isArray(seg) ? seg[0] : '')).join('').trim();
    if (!out) throw new Error('empty translation');
    return out;
  });
}

/* =====================================================================
   Lookup orchestrator

   The three English providers are no longer walked one after the other:
   provider 1 is started immediately, provider 2 is started API_HEDGE_MS
   later if provider 1 has not answered yet, then provider 3, and the first
   provider that succeeds wins.  Priority is still respected (a fast
   provider 1 always beats provider 2), but a hanging or dead provider can
   only ever cost API_HEDGE_MS instead of the full API_TIMEOUT.

   A provider that fails API_PROVIDER_MAX_FAILS times in a row is skipped
   for API_PROVIDER_COOLDOWN, so the currently unreachable Free Dictionary
   API costs nothing at all after the first card.
   ===================================================================== */
const PROVIDER_CHAIN = [
  { id: 'dictionaryapi', label: 'Dictionary API', fn: lookupFreeDictionary },
  { id: 'wiktionary',    label: 'Wiktionary',     fn: lookupWiktionary },
  { id: 'datamuse',      label: 'Datamuse',       fn: lookupDatamuse }
];

const PROVIDER_STATE = Object.create(null);

function providerHealth(id) {
  return PROVIDER_STATE[id] || (PROVIDER_STATE[id] = { fails: 0, deadUntil: 0, lastMs: 0, ok: 0 });
}
function providerIsDown(id) {
  const p = PROVIDER_STATE[id];
  if (!p || !p.deadUntil) return false;
  if (Date.now() >= p.deadUntil) { p.deadUntil = 0; p.fails = 0; return false; }
  return true;
}
function noteProviderResult(id, ok, ms) {
  const p = providerHealth(id);
  p.lastMs = ms || 0;
  if (ok) { p.fails = 0; p.deadUntil = 0; p.ok++; return; }
  p.fails++;
  if (p.fails >= API_PROVIDER_MAX_FAILS) p.deadUntil = Date.now() + API_PROVIDER_COOLDOWN;
}
function liveProviders() {
  const live = PROVIDER_CHAIN.filter(p => !providerIsDown(p.id));
  /* everything is marked down (offline, or every endpoint changed): try again
     from the top instead of failing straight away */
  return live.length ? live : PROVIDER_CHAIN.slice();
}
function activeProviderLabel() {
  const live = PROVIDER_CHAIN.filter(p => !providerIsDown(p.id));
  if (!live.length) return 'none reachable';
  return live.map(p => p.label).join(' > ');
}

/* hedged, first-success-wins lookup */
function lookupEnglish(term) {
  const t0 = Date.now();
  state.metrics.lookups++;
  return new Promise((resolve, reject) => {
    const list = liveProviders();
    let started = 0, finished = 0, settled = false, firstErr = null, hedge = null;

    function clearHedge() { if (hedge) { clearTimeout(hedge); hedge = null; } }
    function settle(value, err) {
      settled = true;
      clearHedge();
      if (err) reject(err); else resolve(value);
    }

    function startNext() {
      if (settled || started >= list.length) return;
      clearHedge();
      const p = list[started++];
      const at = Date.now();
      let run;
      try { run = p.fn(term); } catch (e) { run = Promise.reject(e); }
      Promise.resolve(run).then(res => {
        noteProviderResult(p.id, true, Date.now() - at);
        state.metrics.lookupMs += Date.now() - t0;
        if (!settled) settle(res, null);
      }, err => {
        noteProviderResult(p.id, false, Date.now() - at);
        if (!firstErr) firstErr = err;
        finished++;
        if (settled) return;
        if (finished === list.length) {
          state.metrics.lookupMs += Date.now() - t0;
          settle(null, firstErr);
          return;
        }
        startNext();
      });
      if (started < list.length) hedge = setTimeout(startNext, API_HEDGE_MS);
    }

    startNext();
  });
}

/* ---- translation provider chain: the same cooldown machinery as the
       English providers, so a dead endpoint costs nothing after a while.
       Google first (no quota worries for our volume), MyMemory as backup
       for when Google is blocked - and vice versa on quota days. ---- */
const TRANSLATORS = [
  { id: 'google-trans', fn: translateViaGoogle },
  { id: 'mymemory',     fn: translateToZh }
];

function translateToZhSmart(text) {
  let live = TRANSLATORS.filter(t => !providerIsDown(t.id));
  if (!live.length) live = TRANSLATORS.slice();
  let chain = Promise.reject(new Error('no translator available'));
  live.forEach(t => {
    chain = chain.catch(() => {
      const at = Date.now();
      return t.fn(text).then(res => {
        noteProviderResult(t.id, true, Date.now() - at);
        return res;
      }, err => {
        noteProviderResult(t.id, false, Date.now() - at);
        throw err;
      });
    });
  });
  return chain;
}

/* ---- translation cache: the same sentence is never translated twice ---- */
const TR_INFLIGHT = new Map();

function translateCached(text) {
  const body = String(text || '').trim();
  if (!body) return Promise.reject(new Error('empty text'));
  const key = 'tr|' + normKey(body);
  const hit = state.tr[key];
  if (hit && (Date.now() - (hit.at || 0)) < TR_CACHE_TTL) return Promise.resolve(hit.text);
  if (TR_INFLIGHT.has(key)) return TR_INFLIGHT.get(key);

  const job = translateToZhSmart(body).then(txt => {
    state.metrics.translations++;
    if (txt) {
      state.tr[key] = { text: txt, at: Date.now() };
      trimCaches();
      saveTrCacheSoon();
    }
    TR_INFLIGHT.delete(key);
    return txt;
  }, err => {
    TR_INFLIGHT.delete(key);
    throw err;
  });
  TR_INFLIGHT.set(key, job);
  return job;
}
