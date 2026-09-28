/* ------------------------------- rendering ------------------------------- */
function clearRoundTimer() {
  if (state.round && state.round.timer) { clearTimeout(state.round.timer); state.round.timer = null; }
}

function quizOptionHTML(opt, i) {
  return '<button type="button" class="qopt" data-opt="' + i + '">' +
      '<span class="qopt__k">' + 'ABC'.charAt(i) + '</span>' +
      '<span class="qopt__t">' + escapeHTML(displayZh(opt.text)) + '</span>' +
    '</button>';
}

function flash(el, cls) {
  if (!el) return;
  el.classList.remove('is-correct', 'is-wrong');
  void el.offsetWidth;                    /* restart the animation */
  el.classList.add(cls);
}

function paintQuestion(q) {
  const chip = $('#quizType');
  if (chip) {
    chip.className = 'chip chip--' + (q.type || 'word');
    chip.textContent = TYPE_LABEL[q.type] || 'Word';
  }
  const lvl = $('#quizLevel');
  if (lvl) {
    lvl.hidden = !q.level;
    lvl.textContent = q.level || '';
  }
  setText('#quizTerm', q.term);
  setText('#quizPhon', q.phonetic || '');

  const box = $('#quizOptions');
  if (box) {
    box.hidden = false;
    box.className = 'quiz__options';
    box.innerHTML = q.options.map(quizOptionHTML).join('');
  }
  const prompt = $('#quizPrompt');
  if (prompt) prompt.className = 'quiz__prompt';
  const fb = $('#quizFeedback');
  if (fb) { fb.textContent = ''; fb.className = 'quiz__feedback'; }
  const ans = $('#quizAnswer');
  if (ans) { ans.hidden = true; ans.innerHTML = ''; }
  const next = $('#btnQuizNext');
  if (next) next.hidden = true;
  const add = $('#btnQuizAdd');
  if (add) {
    const known = !!findRecordByTerm(q.term);
    add.hidden = false;
    add.disabled = known;
    add.textContent = known ? '\u2713 In Records' : '+ Add to Records';
    add.classList.toggle('is-done', known);
  }
  updateQuizStats();
  updatePoolInfo();
}

/* Pull a question and put it on screen. */
function renderQuestion() {
  if (!state.round) state.round = newRound();
  clearRoundTimer();
  const q = nextQuestion();
  if (!q) {
    state.round.current = null;
    const box = $('#quizOptions');
    if (box) box.innerHTML = '';
    showQuizEmpty(true, quizScope() === 'records'
      ? '<div class="empty__title">Not enough meanings yet</div>' +
        '<div>Save a few words with a meaning first &mdash; a question needs<br>' +
        'three different meanings to choose from.</div>'
      : '<div class="empty__title">Nothing to ask at this level</div>' +
        '<div>These words have no bundled meaning yet. Try another level,<br>' +
        'or connect once so meanings can be fetched.</div>');
    updateQuizStats();
    updatePoolInfo();
    return;
  }
  showQuizEmpty(false);
  state.round.current = q;
  state.round.answered = false;
  paintQuestion(q);
}

function showQuizEmpty(show, html) {
  const empty = $('#quizEmpty');
  const options = $('#quizOptions');
  const prompt = $('#quizPrompt');
  if (empty) {
    empty.hidden = !show;
    if (show && html) empty.innerHTML = '<div class="empty__icon" aria-hidden="true">&#128221;</div>' + html;
  }
  if (options) options.hidden = show;
  if (prompt) prompt.hidden = show;
}

function updatePoolInfo() {
  const info = $('#quizPoolInfo');
  if (!info) return;
  const scope = quizScope();
  const n = poolSizeFor(scope);
  info.textContent = n + (scope === 'records'
    ? (n === 1 ? ' saved word' : ' saved words')
    : ' ' + scope + ' words');
}

function renderAnswerPanel(q) {
  const ans = $('#quizAnswer');
  if (!ans) return;
  ans.innerHTML = meaningBlocksHTML({
    term: q.term,
    zh: q.zh || [], en: [], defZh: [], example: q.example || ''
  }, q.type);

  ans.hidden = false;

  /* the example arrives in English; translate it once and drop it underneath,
     through the same cache the cards use */
  if (q.example && !q.exampleZh) {
    const key = normKey(q.example);
    translateCached(q.example).then(zh => {
      if (!zh || !state.round || !state.round.current) return;
      if (normKey(state.round.current.example) !== key) return;
      state.round.current.exampleZh = zh;
      const host = $('#quizAnswer');
      if (!host) return;
      let el = $('.card__example-zh', host);
      if (!el) {
        const block = $('[data-example]', host);
        if (!block) return;
        el = document.createElement('div');
        el.className = 'card__example-zh';
        block.appendChild(el);
      }
      el.textContent = displayZh(zh);
    }, () => { /* offline - the English sentence stands on its own */ });
  }
}

function renderWrongList() {
  const box = $('#quizWrongList');
  if (!box) return;
  const list = (state.round && state.round.wrongList) ? state.round.wrongList : [];
  if (!list.length) { box.innerHTML = ''; return; }
  box.innerHTML = '<div class="count" style="margin:0 0 8px">Missed in this round</div>' +
    list.map(r => '<div class="item" style="cursor:default"><div class="item__main">' +
        '<div class="item__head"><span class="item__term">' + escapeHTML(r.term) + '</span>' +
        '<span class="chip chip--' + (r.type || 'word') + '">' + (TYPE_LABEL[r.type] || 'Word') + '</span></div>' +
        '<div class="item__zh">' + ((r.zh && r.zh.length) ? r.zh.map(escapeHTML).join(' &middot; ') : 'No Chinese meaning yet') + '</div>' +
      '</div></div>').join('');
}

/* ------------------------------- actions ------------------------------- */
function answerQuiz(index) {
  const q = state.round && state.round.current;
  if (!q || state.round.answered) return;
  const chosen = q.options[index];
  if (!chosen) return;

  state.round.answered = true;
  q.picked = index;
  const ok = !!chosen.correct;

  const box = $('#quizOptions');
  if (box) {
    $$('.qopt', box).forEach((el, i) => {
      el.disabled = true;
      if (q.options[i] && q.options[i].correct) el.classList.add('is-correct');
      else if (i === index) el.classList.add('is-wrong');
    });
  }

  state.round.total++;
  if (ok) {
    state.round.correct++;
    state.round.streak++;
    flash($('#quizPrompt'), 'is-correct');
    vibrate(HAPTIC.right);
    const fb = $('#quizFeedback');
    if (fb) { fb.className = 'quiz__feedback ok'; fb.textContent = 'Correct'; }
  } else {
    state.round.wrong++;
    state.round.streak = 0;
    if (!state.round.wrongList.some(r => r.term === q.term)) state.round.wrongList.push(q);
    flash($('#quizPrompt'), 'is-wrong');
    vibrate(HAPTIC.wrong);                        /* two light pulses */
    const fb = $('#quizFeedback');
    if (fb) { fb.className = 'quiz__feedback no'; fb.textContent = 'Not quite - the right meaning is highlighted'; }
    renderAnswerPanel(q);
  }
  touchStats(q.record, ok);
  updateQuizStats();
  renderWrongList();

  const next = $('#btnQuizNext');
  if (next) next.hidden = false;
  refreshRecords();
}

function nextCard() {
  if (!state.round) state.round = newRound();
  renderQuestion();
}

/* both outcomes let the word join Records - that is how a level-range Quiz
   feeds the personal list */
function saveQuizWord() {
  const q = state.round && state.round.current;
  if (!q) return;
  const btn = $('#btnQuizAdd');
  if (findRecordByTerm(q.term)) {
    if (btn) { btn.disabled = true; btn.textContent = '\u2713 In Records'; btn.classList.add('is-done'); }
    return;
  }
  upsertRecord({
    term: q.term, type: q.type || 'word',
    zh: (q.zh || []).slice(0, 3),
    en: [], phonetic: q.phonetic || '',
    example: q.example || '',
    source: 'quiz',
    tags: q.level ? [q.level] : []
  });
  if (btn) { btn.disabled = true; btn.textContent = '\u2713 Added'; btn.classList.add('is-done'); }
  vibrate(HAPTIC.saved);
  showToast('Added to Records', 'ok');
  refreshRecords();
  updatePoolInfo();
}

function skipQuestion() {
  nextCard();
}

function resetRound() {
  clearRoundTimer();
  state.round = newRound();
  renderWrongList();
  updateQuizStats();
  renderQuestion();
  showToast('Round reset', 'ok');
}

function setQuizScope(scope) {
  state.settings.quizScope = (scope === 'records' || CEFR_LEVELS.indexOf(scope) >= 0) ? scope : 'records';
  saveSettings();
  clearRoundTimer();
  state.round = newRound();
  renderWrongList();
  renderQuestion();
}

/* kept for refreshRecords() - show or hide the Quiz surfaces */
function refreshQuizState() {
  const pane = $('#quizPane');
  if (!pane) return;
  if (!state.round) state.round = newRound();
  const scope = quizScope();
  const select = $('#quizScope');
  if (select && select.value !== scope) select.value = scope;
  if (!poolSizeFor(scope) || !state.round.current) {
    renderQuestion();
  } else {
    updateQuizStats();
    updatePoolInfo();
  }
}

function initQuiz() {
  const scope = $('#quizScope');
  if (scope) {
    scope.value = quizScope();
    scope.addEventListener('change', () => setQuizScope(scope.value));
  }
  const box = $('#quizOptions');
  if (box) box.addEventListener('click', e => {
    const btn = e.target.closest('.qopt');
    if (!btn || btn.disabled) return;
    answerQuiz(parseInt(btn.getAttribute('data-opt'), 10));
  });
  const next = $('#btnQuizNext');
  if (next) next.addEventListener('click', nextCard);
  const add = $('#btnQuizAdd');
  if (add) add.addEventListener('click', saveQuizWord);
  const skip = $('#btnQuizSkip');
  if (skip) skip.addEventListener('click', skipQuestion);
  const reset = $('#btnQuizReset');
  if (reset) reset.addEventListener('click', resetRound);

  /* desktop: 1 / 2 / 3 pick an option, Enter or Space moves on */
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (state.view !== 'revision' || state.revSub !== 'quiz') return;
    if ($('.sheet.is-open')) return;
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (e.key === '1' || e.key === '2' || e.key === '3') {
      const i = parseInt(e.key, 10) - 1;
      const btn = box ? $$('.qopt', box)[i] : null;
      if (btn && !btn.disabled) { e.preventDefault(); answerQuiz(i); }
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (state.round && state.round.answered) { e.preventDefault(); nextCard(); }
    }
  });
}

