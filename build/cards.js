/* =====================================================================
   Cards: meaning resolution, DOM building
   ===================================================================== */
const DEPTH_CLASSES = ['card--top', 'card--depth1', 'card--depth2'];

/* meaning available right now for a descriptor (records carry their own) */
function descriptorMeaning(descriptor) {
  /* bundled gloss / example - the floor every card stands on, so a card is
     never left without a meaning or an example while the network is down */
  const off = offlineMeaning(descriptor.term);
  const term = descriptor.term;

  if (descriptor.record) {
    const r = descriptor.record;
    const cached = cachedMeaning(r.term, r.type, false);
    const zh = (r.zh && r.zh.length) ? r.zh : (cached ? cached.zh : []);
    const en = (r.en && r.en.length) ? r.en : (cached ? cached.en : []);
    const src = (r.zh && r.zh.length) ? 'Manual' : (r.source === 'manual' ? 'Manual' : (cached ? cached.source : 'none'));
    return {
      term: term,
      zh: zh || [], en: en || [], defZh: (cached && cached.defZh) ? cached.defZh : [],
      phonetic: r.phonetic || (cached ? cached.phonetic : '') || off.phonetic,
      audio: r.audio || (cached ? cached.audio : ''),
      example: r.example || (cached ? cached.example : '') || off.example,
      exampleZh: (cached && cached.exampleZh) ? cached.exampleZh : '',
      source: src, loaded: true
    };
  }
  const hit = cachedMeaning(descriptor.term, descriptor.type, false);
  if (!hit) {
    if (off.zh.length || off.example) {
      return {
        term: term,
        zh: off.zh, en: [], defZh: [], phonetic: off.phonetic, audio: '',
        example: off.example, exampleZh: '', source: 'offline', loaded: true
      };
    }
    return { term: term, zh: [], en: [], defZh: [], phonetic: '', audio: '', example: '', exampleZh: '', source: 'none', loaded: false };
  }
  return {
    term: term,
    zh: (hit.zh && hit.zh.length) ? hit.zh : off.zh,
    en: hit.en || [], defZh: hit.defZh || [],
    phonetic: hit.phonetic || off.phonetic,
    audio: hit.audio || '',
    example: hit.example || off.example,
    exampleZh: hit.exampleZh || '',
    source: hit.source, loaded: true, failed: !hit.ok && !off.zh.length, note: hit.note
  };
}


function skeletonsHTML() {
  return '<div class="defblock" data-defzh><div class="defblock__label defblock__label--en">Definition in Chinese</div>' +
    '<div class="skeleton" style="width:62%"></div><div class="skeleton" style="width:44%"></div></div>' +
    '<div class="defblock"><div class="defblock__label defblock__label--en">English explanation</div>' +
    '<div class="skeleton" style="width:88%"></div><div class="skeleton" style="width:70%"></div></div>';
}

/* Highlight every hit of `term` inside a sentence (and the matching gloss
   inside its translation), so the learner sees where the word lives.  Single
   words must match on a word boundary - "an" never lights up inside "and" -
   and a pattern like "the more ..., the more ..." is highlighted piece by
   piece, since the dots never appear in the sentence. */
/* a corpus sentence rarely repeats the headword exactly (adopt -> adopted,
   study -> studies, sing -> singing); without the inflections the example of
   such a word never lights up at all */
function wordForms(word) {
  const w = String(word || '').toLowerCase();
  if (!/^[a-z]+$/.test(w)) return [];
  const out = [];
  const add = f => { if (f && f !== w && out.indexOf(f) < 0) out.push(f); };
  add(w + 's'); add(w + 'es'); add(w + 'ed'); add(w + 'd'); add(w + 'ing');
  add(w + 'ly'); add(w + 'er'); add(w + 'est');
  if (/e$/.test(w)) { add(w.slice(0, -1) + 'ing'); add(w.slice(0, -1) + 'ed'); }
  if (/y$/.test(w)) { add(w.slice(0, -1) + 'ies'); add(w.slice(0, -1) + 'ied'); add(w.slice(0, -1) + 'ier'); add(w.slice(0, -1) + 'iest'); }
  if (/[^aeiou][aeiou][^aeiouwxy]$/.test(w)) { const c = w[w.length - 1]; add(w + c + 'ed'); add(w + c + 'ing'); }
  return out;
}

function markHits(text, needle) {
  const t = String(text || '');
  const raw = String(needle || '').replace(/^[a-z]+\.\s*/i, '').trim();
  if (!t || !raw) return escapeHTML(t);

  const needles = raw.indexOf('...') >= 0
    ? raw.split(/\.\.\./).map(s => s.trim()).filter(s => s.length >= 2)
    : [raw];
  const lo = t.toLowerCase();
  const hits = [];
  function collect(n, whole) {
    const ln = n.toLowerCase();
    if (!ln) return;
    let from = 0, at;
    while ((at = lo.indexOf(ln, from)) >= 0) {
      const before = at > 0 ? t[at - 1] : '';
      const after = at + ln.length < t.length ? t[at + ln.length] : '';
      if (!whole || (!/[a-z]/i.test(before) && !/[a-z]/i.test(after))) hits.push([at, ln.length]);
      from = at + 1;
    }
  }
  needles.forEach(n => collect(n, /^[a-z]+$/i.test(n)));
  /* second pass: an inflected form of a single-word headword */
  if (!hits.length && needles.length === 1 && /^[a-z]+$/i.test(raw) && raw.length >= 3) {
    wordForms(raw).forEach(f => collect(f, true));
  }
  if (!hits.length) return escapeHTML(t);

  hits.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  let out = '', at = 0;
  hits.forEach(h => {
    if (h[0] < at) return;                          // skip overlaps
    out += escapeHTML(t.slice(at, h[0]));
    out += '<b class="ex-hit">' + escapeHTML(t.substr(h[0], h[1])) + '</b>';
    at = h[0] + h[1];
  });
  return out + escapeHTML(t.slice(at));
}

/* ---- where does the term sit in the English sentence? ----
   The last-resort layer needs it: knowing that "hike" sits in the middle of
   the English sentence tells us where its Chinese rendering has to sit in the
   translation, which is the only way to light up 健行 in 明天我們要去健行。 -
   a word that shares not one character with the glossary. */
function termAnchor(text, needle) {
  const t = String(text || '');
  const forms = [String(needle || '')].concat(wordForms(needle));
  const lo = t.toLowerCase();
  for (let i = 0; i < forms.length; i++) {
    const f = String(forms[i] || '').toLowerCase().trim();
    if (f.length < 2) continue;
    const at = lo.indexOf(f);
    if (at < 0) continue;
    if (/^[a-z ]+$/.test(f)) {
      const before = at > 0 ? t[at - 1] : '';
      const after = at + f.length < t.length ? t[at + f.length] : '';
      if (/[a-z]/i.test(before) || /[a-z]/i.test(after)) continue;   /* inside a word */
    }
    return { at: at, len: f.length, ratio: at / Math.max(1, t.length) };
  }
  return null;
}

/* ---------------------- Chinese side of the example ----------------------
   The translation is machine-made, so it seldom repeats the glossary wording:
   the gloss of "sing" is 唱歌 while the sentence reads 唱這首歌.  Searching for
   the gloss verbatim therefore misses most of the time and the Chinese line
   shows no highlight at all.  Three passes, cheapest first:

     1. a sense appears as it stands           -> mark every hit
     2. the longest run a sense and the
        sentence really share                  -> mark that run
     3. nothing in common at all (the machine
        picked a word of its own, e.g. 健行
        for 徒步)                              -> place the term by its
        position in the English sentence and mark the best window there

   Only pass 3 guesses, so it runs last and is biased towards the shortest
   window that still carries a character of the meaning. */
function zhSenses(gloss) {
  const list = Array.isArray(gloss) ? gloss : [gloss];
  const out = [];
  list.forEach(g => {
    String(g == null ? '' : g)
      .split(/[\/、；;，,（）()【】\[\]]|\s+/)
      .map(s => s.replace(/^[a-z]+\.\s*/i, '').trim())
      .forEach(s => {
        if (/[\u3400-\u9FFF\uF900-\uFAFF]/.test(s) && out.indexOf(s) < 0) out.push(s);
      });
  });
  return out;
}

function longestSharedRun(text, sense) {
  const a = String(text || ''), b = String(sense || '');
  let best = null;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let n = 0;
      while (i + n < a.length && j + n < b.length && a[i + n] === b[j + n]) n++;
      if (n > 0 && (!best || n > best.len)) best = { at: i, len: n, whole: n === b.length };
    }
  }
  return best;
}

/* characters of the sentence that actually carry meaning (punctuation and the
   stray spaces a machine translator sprinkles around are skipped) */
function zhContentSlots(text) {
  const slots = [];
  for (let i = 0; i < text.length; i++) {
    if (/[\u3400-\u9FFF\uF900-\uFAFF\u3040-\u30FF]/.test(text[i])) slots.push(i);
  }
  return slots;
}

/* pass 3: no character in common with the glossary, so the word is placed by
   where the English term sits.  Chinese keeps the order of the English, so the
   same relative spot is a good enough guess; the window around it is then
   narrowed to the shortest run that still shares a character with a sense. */
function markZhByAnchor(text, senses, anchor) {
  const slots = zhContentSlots(text);
  if (!anchor || slots.length < 2) return null;
  const guess = Math.round(anchor.ratio * (slots.length - 1));
  const TOL = 3;

  let best = null;
  for (let len = 1; len <= 4; len++) {
    const from = Math.max(0, guess - TOL);
    const to = Math.min(slots.length - len, guess + TOL);
    for (let at = from; at <= to; at++) {
      let shared = 0;
      for (let i = 0; i < len; i++) {
        const ch = text[slots[at + i]];
        for (let s = 0; s < senses.length; s++) {
          if (senses[s].indexOf(ch) >= 0) { shared++; break; }
        }
      }
      if (shared < 1) continue;            /* a window with no link at all is a coin flip */
      const dist = Math.abs(at - guess);
      /* Characters of the meaning decide the window outright - that is the only
         real evidence there is.  Among the windows that tie on that, the one
         shaped like a Chinese word (two characters) wins over a stray single
         character, so 健行 beats the bare 行 of 旅行.  The guessed position is
         only a weak tie-breaker on top: a machine translator reorders freely. */
      const score = shared * 100 - dist - Math.abs(len - 2) * 8;
      if (!best || score > best.score) best = { at: at, len: len, score: score };
    }
  }
  if (!best) return null;
  const start = slots[best.at];
  return { at: start, len: slots[best.at + best.len - 1] - start + 1 };
}

function markZhHits(text, gloss, opts) {
  const t = String(text == null ? '' : text);
  if (!t) return '';
  const senses = zhSenses(gloss);
  for (let i = 0; i < senses.length; i++) {
    const marked = markHits(t, senses[i]);
    if (marked.indexOf('ex-hit') >= 0) return marked;
  }
  /* no sense appears as it stands: mark the longest stretch a sense and the
     sentence really share.  A single character is enough for a short gloss
     (唱歌 -> 唱這首歌), two are required for a longer one, so a stray 的 or 是
     never lights up. */
  let best = null;
  senses.forEach(s => {
    const run = longestSharedRun(t, s);
    if (!run || run.len < (s.length <= 2 ? 1 : 2)) return;
    if (!best || run.len > best.len) best = run;
  });
  if (!best && opts && opts.anchorText) {
    /* the machine translator used a word of its own - place the term by its
       position in the English sentence */
    best = markZhByAnchor(t, senses, termAnchor(opts.anchorText, opts.anchorTerm));
  }
  if (!best) return escapeHTML(t);
  return escapeHTML(t.slice(0, best.at)) +
    '<b class="ex-hit">' + escapeHTML(t.substr(best.at, best.len)) + '</b>' +
    escapeHTML(t.slice(best.at + best.len));
}

/* the Chinese line of an example, with the term lit up.  Takes the whole
   meaning, so every sense of the gloss and the English sentence are on hand -
   one sense alone left most sentences unhighlighted. */
function exampleZhHTML(m) {
  if (!m || !m.exampleZh) return '';
  return markZhHits(displayZh(m.exampleZh), m.zh, {
    anchorText: m.example, anchorTerm: m.term
  });
}

function meaningBlocksHTML(m, type, opts) {

  const zh = m.zh || [], en = m.en || [], defZh = m.defZh || [];
  const pendingDefZh = !!(opts && opts.pendingDefZh) && !defZh.length;
  if (!zh.length && !en.length && !defZh.length) {
    const msg = m.failed
      ? 'Definition unavailable - tap Retry, or save the card and type your own meaning.'
      : 'No meaning found for this entry.';
    return '<div class="defblock"><div class="defblock__label defblock__label--en">Meaning</div>' +
      '<div class="defblock__en">' + escapeHTML(msg) + '</div>' +
      '<button type="button" class="btn btn--ghost btn--sm" data-retry style="margin-top:9px">Retry</button></div>';
  }
  let html = '';
  /* One Chinese block only - the translated definition.  The short gloss (zh)
     stands in until the full bilingual definition lands (or if the translation
     fails), and the script follows the Traditional / Simplified setting from
     the App info sheet. */
  const cnOpen = '<div class="defblock" data-defzh><div class="defblock__label defblock__label--en">Definition in Chinese</div>';
  if (defZh.length) {
    html += cnOpen +
      '<div class="defblock__zh" style="font-size:14.5px">' + escapeHTML(displayZh(defZh[0])) + '</div></div>';
  } else if (pendingDefZh) {
    /* the Chinese explanation is on the wire - keep its place with a skeleton
       instead of flashing the short gloss, which the user does not want to see
       on word cards */
    html += cnOpen +
      '<div class="skeleton" style="width:76%"></div><div class="skeleton" style="width:48%"></div></div>';
  } else if (zh.length) {
    /* no explanation coming (phrases, patterns, manual entries, or the
       translation failed) - the gloss is all the Chinese there is */
    html += cnOpen +
      '<div class="defblock__zh" style="font-size:14.5px">' + zh.map((z, i) =>
        (zh.length > 1 ? '<span class="sense-idx">' + (i + 1) + '.</span> ' : '') + escapeHTML(displayZh(z))
      ).join('<br>') + '</div></div>';
  }
  if (en.length) {
    html += '<div class="defblock"><div class="defblock__label defblock__label--en">English explanation</div>' +
      '<ul class="defblock__en">' + en.map(e =>
        '<li>' + (e.pos ? '<span class="pos">' + escapeHTML(e.pos) + '</span>' : '') + escapeHTML(e.text) + '</li>'
      ).join('') + '</ul></div>';
  } else if (type === 'phrase' || type === 'pattern') {
    html += '<div class="defblock"><div class="defblock__label defblock__label--en">English explanation</div>' +
      '<div class="defblock__en" style="color:var(--muted,#5B7290)">The free dictionary API only covers single words, so ' +
      (type === 'pattern' ? 'sentence patterns' : 'phrases') + ' get a Chinese gloss only. ' +
      'Save the card and write your own English explanation - it is kept from then on.</div></div>';
  }
  if (m.example) {
    html += '<div class="defblock defblock--example" data-example>' +
      '<div class="defblock__label defblock__label--en">Example Sentence</div>' +
      '<div class="card__example">' + markHits(m.example, m.term) + '</div>' +
      (m.exampleZh ? '<div class="card__example-zh">' + exampleZhHTML(m) + '</div>' : '') +
      '</div>';
  }
  return html;
}

function buildCardEl(descriptor, depth) {
  const el = document.createElement('article');
  el.className = 'card ' + DEPTH_CLASSES[Math.min(depth, 2)];
  el.setAttribute('data-term', descriptor.term);
  el.style.zIndex = String(10 - depth);
  const m = descriptorMeaning(descriptor);
  const type = descriptor.type || 'word';
  el.innerHTML =
    '<div class="card__top">' +
      '<div style="min-width:0;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">' +
        '<h3 class="card__term">' + escapeHTML(descriptor.term) + '</h3>' +
        '<div class="card__phon">' + escapeHTML(m.phonetic || '') + '</div>' +
        '<button type="button" class="btn-speak" data-speak aria-label="Pronounce" title="Pronounce"><svg class="icon-waves" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 9a4.5 4.5 0 0 1 0 6"/><path d="M11 6a8.5 8.5 0 0 1 0 12"/><path d="M16 3a13 13 0 0 1 0 18"/></svg></button>' +
      '</div>' +
      '<span style="display:inline-flex;gap:5px;align-items:center;flex:0 0 auto">' +
        (CEFR_LEVELS.indexOf(descriptor.level) >= 0 ? '<span class="chip chip--level">' + escapeHTML(descriptor.level) + '</span>' : '') +
        '<span class="chip chip--' + type + '">' + (TYPE_LABEL[type] || 'Word') + '</span>' +
      '</span>' +

    '</div>' +
    '<div class="card__scroller" data-scroller>' + (m.loaded ? meaningBlocksHTML(m, type) : skeletonsHTML()) + '</div>' +
    '<div class="card__foot">' +
      '<div class="card__meta">' +
        '<span class="chip chip--src" data-src>' + escapeHTML(m.loaded ? sourceLabel(m.source) : 'Loading...') + '</span>' +
        '<span class="chip chip--src" data-saved hidden style="background:var(--success-soft,#E8F5E9);color:var(--success-ink,#1B5E20)">Saved</span>' +
        (descriptor.source === 'custom' ? '<span class="chip chip--src">My list</span>' : '') +
        (descriptor.source === 'record' ? '<span class="chip chip--src">Record</span>' : '') +
      '</div>' +
      '<div class="card__hint">Drag the handle to save</div>' +
    '</div>' +
    '<div class="card__handle" data-drag-handle role="button" aria-label="Drag to save" title="Drag to save"><span></span></div>';
  return el;
}
