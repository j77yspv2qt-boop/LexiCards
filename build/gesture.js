/* =====================================================================
   Gesture engine: swipe left/right to change card, drag the bottom
   handle down to the save panel (long-press on the card itself was
   removed so it can no longer be triggered by accident)
   ===================================================================== */
const gesture = {
  id: null, mode: 'idle', hot: false,
  x0: 0, y0: 0, lastX: 0, lastT: 0, vx: 0,
  timer: null, cardEl: null, descriptor: null
};

function dzEl() { return $('#dropzone'); }

function showDropzone() {
  const el = dzEl(); if (!el) return;
  el.classList.add('is-visible');
  el.setAttribute('aria-hidden', 'false');
}

function hideDropzone() {
  const el = dzEl(); if (!el) return;
  el.classList.remove('is-visible', 'is-hot');
  el.setAttribute('aria-hidden', 'true');
  const t = $('#dzTitle'), s = $('#dzSub');
  if (t) t.textContent = 'Drop to save';
  if (s) s.textContent = 'Release here to add this card to Revision';
}

function dropzoneHitTest(x, y) {
  const el = dzEl();
  if (!el || !el.classList.contains('is-visible')) return false;
  const inner = $('.dropzone__inner', el) || el;
  const r = inner.getBoundingClientRect();
  const pad = 16;
  return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
}

function setDropzoneHot(hot, descriptor) {
  const el = dzEl(); if (!el) return;
  el.classList.toggle('is-hot', hot);
  const t = $('#dzTitle'), s = $('#dzSub');
  if (t) t.textContent = hot ? 'Release to save' : 'Drop to save';
  if (s) s.textContent = hot
    ? ((descriptor && descriptor.term) ? descriptor.term : '')
    : 'Release here to add this card to Revision';
  if (gesture.cardEl) gesture.cardEl.classList.toggle('card--hot', hot);
  if (hot) vibrate(14);
}

/* ------------------------------- press / move ------------------------------- */
function onPointerDown(e) {
  if (gesture.mode !== 'idle' || state.swiping) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  /* Only the bottom handle starts a save-drag (and it grabs immediately), so an
     accidental long-press anywhere on the card can no longer open the panel.
     The rest of the press is only tracked so horizontal movement can swipe. */
  const fromHandle = !!(e.target && e.target.closest && e.target.closest('[data-drag-handle]'));
  if (!fromHandle && e.target && e.target.closest('[data-speak], [data-retry], button, a')) return;
  const el = e.currentTarget;
  gesture.id = e.pointerId;
  gesture.cardEl = el;
  gesture.descriptor = el._descriptor || null;
  gesture.x0 = e.clientX; gesture.y0 = e.clientY;
  gesture.lastX = e.clientX; gesture.lastT = performance.now();
  gesture.vx = 0; gesture.hot = false;
  gesture.mode = 'pending';
  clearTimeout(gesture.timer);
  if (fromHandle) startDrag();
}

function startDrag() {
  if (gesture.mode !== 'pending') return;
  const el = gesture.cardEl;
  if (!el || !el.isConnected) return;
  gesture.mode = 'dragging';
  el.style.transition = 'none';
  try { el.setPointerCapture(gesture.id); } catch (err) { /* ignore */ }
  document.body.classList.add('is-dragging');
  el.classList.add('card--dragging');
  showDropzone();
  vibrate(18);
}

function onPointerMove(e) {
  if (gesture.id !== e.pointerId) return;
  const dx = e.clientX - gesture.x0;
  const dy = e.clientY - gesture.y0;
  const now = performance.now();
  if (now - gesture.lastT > 0) gesture.vx = (e.clientX - gesture.lastX) / (now - gesture.lastT);
  gesture.lastX = e.clientX; gesture.lastT = now;

  if (gesture.mode === 'pending') {
    if (Math.hypot(dx, dy) > MOVE_TOLERANCE) {
      clearTimeout(gesture.timer);
      if (Math.abs(dx) > Math.abs(dy)) {
        gesture.mode = 'swiping';
        try { gesture.cardEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      } else {
        gesture.mode = 'scrolling';   /* vertical movement belongs to the inner scroller */
      }
    }
    return;
  }

  if (gesture.mode === 'swiping') {
    if (e.cancelable) e.preventDefault();
    gesture.cardEl.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx / 22) + 'deg)';
    return;
  }

  if (gesture.mode === 'dragging') {
    if (e.cancelable) e.preventDefault();
    gesture.cardEl.style.transform =
      'translate(' + dx + 'px,' + dy + 'px) scale(1.05) rotate(' + (dx / 45) + 'deg)';
    const hit = dropzoneHitTest(e.clientX, e.clientY);
    if (hit !== gesture.hot) { gesture.hot = hit; setDropzoneHot(hit, gesture.descriptor); }
  }
}
