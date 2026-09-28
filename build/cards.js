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
function markHits(text, needle) {
  const t = String(text || '');
  const raw = String(needle || '').replace(/^[a-z]+\.\s*/i, '').trim();
  if (!t || !raw) return escapeHTML(t);

  const needles = raw.indexOf('...') >= 0
    ? raw.split(/\.\.\./).map(s => s.trim()).filter(s => s.length >= 2)
    : [raw];
  const lo = t.toLowerCase();
  const hits = [];
  needles.forEach(n => {
    const ln = n.toLowerCase();
    if (!ln) return;
    const whole = /^[a-z]+$/i.test(n);
    let from = 0, at;
    while ((at = lo.indexOf(ln, from)) >= 0) {
      const before = at > 0 ? t[at - 1] : '';
      const after = at + ln.length < t.length ? t[at + ln.length] : '';
      if (!whole || (!/[a-z]/i.test(before) && !/[a-z]/i.test(after))) hits.push([at, ln.length]);
      from = at + 1;
    }
  });
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
      '<div class="defblock__en" style="color:#5B7290">The free dictionary API only covers single words, so ' +
      (type === 'pattern' ? 'sentence patterns' : 'phrases') + ' get a Chinese gloss only. ' +
      'Save the card and write your own English explanation - it is kept from then on.</div></div>';
  }
  if (m.example) {
    const gloss = (m.zh && m.zh.length) ? m.zh[0] : '';
    html += '<div class="defblock defblock--example" data-example>' +
      '<div class="defblock__label defblock__label--en">Example Sentence</div>' +
      '<div class="card__example">' + markHits(m.example, m.term) + '</div>' +
      (m.exampleZh ? '<div class="card__example-zh">' + markHits(displayZh(m.exampleZh), gloss) + '</div>' : '') +
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
        '<span class="chip chip--src" data-saved hidden style="background:#E8F5E9;color:#1B5E20">Saved</span>' +
        (descriptor.source === 'custom' ? '<span class="chip chip--src">My list</span>' : '') +
        (descriptor.source === 'record' ? '<span class="chip chip--src">Record</span>' : '') +
      '</div>' +
      '<div class="card__hint">Drag the handle to save</div>' +
    '</div>' +
    '<div class="card__handle" data-drag-handle role="button" aria-label="Drag to save" title="Drag to save"><span></span></div>';
  return el;
}
