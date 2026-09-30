/* ---------------------------- meaning hydration ---------------------------- */
function hydrateCard(el, descriptor, force) {
  const scroller = $('[data-scroller]', el);
  if (!scroller) return;

  if (descriptor.record) {
    const m = descriptorMeaning(descriptor);
    const btnSpeak = $('[data-speak]', el);
    if (btnSpeak) btnSpeak.setAttribute('data-audio', m.audio || '');
    if (m.zh.length || m.en.length) {
      scroller.innerHTML = meaningBlocksHTML(m, descriptor.type);
      setCardSource(el, m.source);
      return;
    }
    scroller.innerHTML = skeletonsHTML();
    enrichRecord(descriptor.record).then(() => {
      const m2 = descriptorMeaning(descriptor);
      if (el.isConnected) {
        scroller.innerHTML = meaningBlocksHTML(m2, descriptor.type);
        setCardSource(el, m2.source === 'none' ? 'Manual' : m2.source);
      }
      if (typeof refreshRecords === 'function') refreshRecords();
    });
    return;
  }

  getMeaning(descriptor.term, descriptor.type, force).then(m => {
    if (!el.isConnected) return;
    scroller.innerHTML = meaningBlocksHTML(m, descriptor.type, {
      pendingDefZh: hasPendingPatch(descriptor.term, descriptor.type)
    });
    const phon = $('.card__phon', el);
    if (phon && m.phonetic) phon.textContent = m.phonetic;
    const btnSpeak = $('[data-speak]', el);
    if (btnSpeak) {
      btnSpeak.setAttribute('data-audio', m.audio || '');
    }
    setCardSource(el, m.source);
  }).catch(() => {
    if (el.isConnected) scroller.innerHTML = meaningBlocksHTML({ zh: [], en: [], defZh: [], failed: true });
  });
}

function setCardSource(el, src) {
  const chip = $('[data-src]', el);
  if (chip) chip.textContent = sourceLabel(src);
}

function markCardSaved(el) {
  const saved = $('[data-saved]', el);
  if (saved) {
    saved.hidden = false;
    el.classList.add('card--saved');
    setTimeout(() => { el.classList.remove('card--saved'); }, 900);
  }
}

/* ---------------- read-ahead: warm the meanings of the next cards ----------------
   Swiping / shuffling used to start from an empty cache, so every new card sat
   on a skeleton until the network answered.  As soon as a deck is rendered the
   following PREFETCH_AHEAD terms are fetched in the background (at most
   PREFETCH_CONCURRENCY requests at a time) and land in the same cache the cards
   read from - so the next flip is instant. */
const PREFETCH = { queue: [], active: 0, gen: 0 };

function prefetchBlocked() {
  if (document.hidden) return true;                                  /* app in the background */
  if (typeof navigator.onLine === 'boolean' && !navigator.onLine) return true;
  if (navigator.connection && navigator.connection.saveData) return true;
  return false;
}

function pumpPrefetch() {
  while (PREFETCH.active < PREFETCH_CONCURRENCY && PREFETCH.queue.length) {
    const item = PREFETCH.queue.shift();
    if (item.gen !== PREFETCH.gen) continue;                         /* deck changed - drop it */
    if (isMeaningReady(item.term, item.type)) continue;
    PREFETCH.active++;
    getMeaning(item.term, item.type, false).then(() => {}, () => {}).then(() => {
      PREFETCH.active--;
      pumpPrefetch();
    });
  }
}

function warmDeck() {
  PREFETCH.gen++;
  PREFETCH.queue = [];
  if (prefetchBlocked() || state.view !== 'dictionary') return;
  const gen = PREFETCH.gen;
  currentCards(PREFETCH_AHEAD + 1).slice(1).forEach(d => {
    if (!d || !d.term || d.record) return;                           /* records carry their own text */
    if (isMeaningReady(d.term, d.type)) return;
    PREFETCH.queue.push({ term: d.term, type: d.type, gen: gen });
  });
  pumpPrefetch();
}

/* the bilingual "Definition in Chinese" and example translation block arrives after the card is drawn */
function applyMeaningPatch(m) {
  if (!m || !m.term) return;
  const key = normKey(m.term);
  $$('#stage .card').forEach(el => {
    const d = el._descriptor;
    if (!d || normKey(d.term) !== key) return;
    const block = $('[data-defzh]', el);
    if (block) {
      const cnLabel = '<div class="defblock__label defblock__label--en">Definition in Chinese</div>';
      if (m.defZh && m.defZh.length) {
        block.innerHTML = cnLabel +
          '<div class="defblock__zh" style="font-size:14.5px">' + escapeHTML(displayZh(m.defZh[0])) + '</div>';
      } else if (m.zh && m.zh.length) {
        /* the full definition never arrived - keep the short gloss instead */
        block.innerHTML = cnLabel +
          '<div class="defblock__zh" style="font-size:14.5px">' + escapeHTML(displayZh(m.zh[0])) + '</div>';
      } else {
        block.remove();                       /* translation unavailable - drop the placeholder */
      }
    }
    const exBlock = $('[data-example]', el);
    if (exBlock && m.exampleZh) {
      let zhEl = $('.card__example-zh', exBlock);
      if (!zhEl) {
        zhEl = document.createElement('div');
        zhEl.className = 'card__example-zh';
        exBlock.appendChild(zhEl);
      }
      /* keep the highlight: this line used to be plain text, which is why the
         word was lit up in the English sentence but never in the Chinese one */
      zhEl.innerHTML = markZhHits(displayZh(m.exampleZh), displayZh((m.zh && m.zh.length) ? m.zh[0] : ''));
    } else if (!exBlock && m.example) {
      /* the example itself only turned up now (a cached entry that had none, or
         a slow sentence lookup) - draw the block instead of dropping it */
      const scroller = $('[data-scroller]', el);
      if (scroller) {
        const gloss = (m.zh && m.zh.length) ? m.zh[0] : '';
        const block = document.createElement('div');
        block.className = 'defblock defblock--example';
        block.setAttribute('data-example', '');
        block.innerHTML = '<div class="defblock__label defblock__label--en">Example Sentence</div>' +
          '<div class="card__example">' + markHits(m.example, m.term) + '</div>' +
          (m.exampleZh ? '<div class="card__example-zh">' + markZhHits(displayZh(m.exampleZh), displayZh(gloss)) + '</div>' : '');
        scroller.appendChild(block);
      }
    }
  });
}

/* ---------------------------- stack rendering ---------------------------- */
function renderStack() {
  const stage = $('#stage');
  if (!stage) return;
  $$('.card', stage).forEach(c => c.remove());
  const empty = $('#stageEmpty');
  const cards = currentCards(3);

  if (!cards.length) {
    if (empty) {
      empty.hidden = false;
      empty.innerHTML = state.dictSub === 'mine'
        ? '<div><strong style="color:#0D47A1;display:block;margin-bottom:6px">No saved cards yet</strong>' +
          'Drag the bottom handle of a card onto the save panel,<br>' +
          'or add entries from Revision &rarr; Records.</div>'
        : '<div><strong style="color:#0D47A1;display:block;margin-bottom:6px">Deck is empty</strong>' +
          'Try another filter, or add your own terms with &ldquo;My list&rdquo;.</div>';
    }
    updateProgress();
    warmDeck();
    return;
  }
  if (empty) empty.hidden = true;

  const els = cards.map((d, i) => {
    const el = buildCardEl(d, i);
    stage.appendChild(el);
    return el;
  });

  /* hydrate the visible card straight away; the two behind it follow almost
     immediately now that their meanings are pre-fetched */
  hydrateCard(els[0], cards[0], false);
  if (els[1]) setTimeout(() => { if (els[1] && els[1].isConnected) hydrateCard(els[1], cards[1], false); }, 220);
  if (els[2]) setTimeout(() => { if (els[2] && els[2].isConnected) hydrateCard(els[2], cards[2], false); }, 480);
  attachCardGestures(els[0], cards[0]);
  updateProgress();
  warmDeck();
}

onMeaningPatch(applyMeaningPatch);

function updateProgress() {
  const p = progressLabel();
  const pos = $('#dictPos'), fill = $('#dictFill'), mode = $('#dictMode');
  if (pos) pos.textContent = p.pos + ' / ' + p.total;
  if (fill) fill.style.width = p.pct + '%';
  if (mode) mode.textContent = state.dictSub === 'mine' ? 'My Cards' : 'Discover';
}

/* ------------------------------- animations ------------------------------- */
function animateCardOut(el, dir) {
  el.classList.add('card--out');
  el.style.transform = 'translateX(' + (dir * 130) + '%) rotate(' + (dir * 13) + 'deg)';
}

function snapCardBack(el) {
  el.style.transition = 'transform .28s cubic-bezier(.22,.61,.36,1)';
  el.style.transform = '';
  setTimeout(() => { el.style.transition = ''; }, 300);
}
