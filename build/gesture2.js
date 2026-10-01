/* ------------------------------- release ------------------------------- */
function onPointerUp(e) {
  if (gesture.id !== e.pointerId) return;
  clearTimeout(gesture.timer);
  const el = gesture.cardEl;
  const mode = gesture.mode;
  const descriptor = gesture.descriptor;
  const dx = e.clientX - gesture.x0;
  const vx = gesture.vx;
  const hit = mode === 'dragging' && dropzoneHitTest(e.clientX, e.clientY);

  gesture.mode = 'idle'; gesture.id = null; gesture.hot = false;

  if (!el) { hideDropzone(); return; }

  if (mode === 'dragging') {
    document.body.classList.remove('is-dragging');
    el.classList.remove('card--dragging', 'card--hot');
    hideDropzone();
    if (hit) {
      saveDescriptorToRecords(descriptor, el);
      el.style.transition = 'transform .34s cubic-bezier(.22,.61,.36,1)';
      el.style.transform = '';
      setTimeout(() => { el.style.transition = ''; }, 380);
    } else {
      snapCardBack(el);
    }
  } else if (mode === 'swiping') {
    const width = el.getBoundingClientRect().width || 300;
    const fast = Math.abs(vx) > SWIPE_VELOCITY;
    if (Math.abs(dx) > width * SWIPE_RATIO || (fast && Math.abs(dx) > 24)) {
      flipCard(dx < 0 ? -1 : 1, el);
    } else {
      snapCardBack(el);
    }
  } else if (mode === 'pending') {
    /* a plain tap: small press feedback */
    el.style.transition = 'transform .2s cubic-bezier(.22,.61,.36,1)';
    el.style.transform = 'scale(.99)';
    setTimeout(() => {
      el.style.transform = '';
      setTimeout(() => { el.style.transition = ''; }, 230);
    }, 90);
  }

  gesture.cardEl = null;
  gesture.descriptor = null;
}

function onPointerCancel(e) {
  if (gesture.id !== e.pointerId) return;
  clearTimeout(gesture.timer);
  const el = gesture.cardEl;
  document.body.classList.remove('is-dragging');
  hideDropzone();
  if (el) {
    el.classList.remove('card--dragging', 'card--hot');
    el.style.transition = 'transform .26s cubic-bezier(.22,.61,.36,1)';
    el.style.transform = '';
    setTimeout(() => { el.style.transition = ''; }, 300);
  }
  gesture.mode = 'idle'; gesture.id = null; gesture.hot = false;
  gesture.cardEl = null; gesture.descriptor = null;
}

function attachCardGestures(el, descriptor) {
  el._descriptor = descriptor;
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerCancel);
  el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
}

/* flip to the previous card (dir < 0, swipe left) or the next one (dir > 0,
   swipe right / Shuffle) from a swipe gesture or a key press */
function flipCard(dir, el) {
  const card = el || $('.card--top', dictStage());
  if (card) animateCardOut(card, dir < 0 ? -1 : 1);
  state.swiping = true;
  setTimeout(() => {
    if (dir < 0) retreatDeck();
    else advanceDeck();
    renderStack();
    state.swiping = false;
  }, 175);
}

/* --------------------- save a card into the Revision records --------------------- */
function saveDescriptorToRecords(descriptor, el) {
  if (!descriptor || !descriptor.term) return;
  const m = descriptorMeaning(descriptor);
  const existing = findRecordByTerm(descriptor.term);

  if (existing) {
    let changed = false;
    if ((!existing.zh || !existing.zh.length) && m.zh.length) { existing.zh = m.zh.slice(0, 3); changed = true; }
    if ((!existing.en || !existing.en.length) && m.en.length) { existing.en = m.en.slice(0, 4); changed = true; }
    if (!existing.phonetic && m.phonetic) { existing.phonetic = m.phonetic; changed = true; }
    if (changed) { existing.updatedAt = Date.now(); saveRecords(); }
    showToast('Already in Records - meaning filled in', 'warn');
  } else {
    upsertRecord({
      term: descriptor.term,
      type: descriptor.type || guessType(descriptor.term),
      zh: m.zh.slice(0, 3),
      en: m.en.slice(0, 4),
      phonetic: m.phonetic || '',
      source: (m.zh.length || m.en.length) ? 'api' : 'manual'
    });
    showToast('Saved to Revision', 'ok');
  }

  if (el) markCardSaved(el);
  if (typeof refreshRecords === 'function') refreshRecords();
  if (typeof onRecordsChanged === 'function') onRecordsChanged();
}
