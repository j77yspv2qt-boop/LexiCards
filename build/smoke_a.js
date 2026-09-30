/* Smoke test harness part A - builder wraps A+B in one IIFE */
var R = { steps: [], errors: [], ok: true };
function step(name, cond, info) {
  R.steps.push({ name: name, pass: !!cond, info: info === undefined ? '' : String(info) });
  if (!cond) R.ok = false;
}
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function finish() {
  R.errors = (window.__errs || []).slice(0, 10);
  if (R.errors.length) R.ok = false;
  try {
    ['lexi.records.v1', 'lexi.records.bak.v1', 'lexi.cache.v1', 'lexi.settings.v1', 'lexi.custom.v1', 'lexi.cards.v1']

      .forEach(function (k) { localStorage.removeItem(k); });
  } catch (e) { /* ignore */ }
  var pre = document.getElementById('smoke-report');
  if (pre) pre.textContent = JSON.stringify(R);
}

async function run() {
  try {
    await wait(250);
    step('smoke: network stubs installed before the app asked anything',
      typeof window.__fetchMode === 'string' && Array.isArray(window.__fetchLog),
      typeof window.__fetchMode + ' | ' + (window.__fetchLog || []).length + ' calls so far');

    /* ---- 1. deck renders ---- */
    var cards = document.querySelectorAll('#stage .card');
    step('Discover renders a 3-card stack', cards.length === 3, cards.length);
    var topTerm = document.querySelector('#stage .card__term');
    step('top card shows a term', !!topTerm && topTerm.textContent.trim().length > 0, topTerm ? topTerm.textContent : '');
    step('progress label counts the deck', /\d+ \/ \d+/.test(document.getElementById('dictPos').textContent),
      document.getElementById('dictPos').textContent);
    step('card depth classes applied', !!document.querySelector('#stage .card--top') &&
      !!document.querySelector('#stage .card--depth1'));

    /* ---- 2. swipe / flip ---- */
    var before = document.querySelector('#stage .card__term').textContent;
    flipCard(1);
    await wait(320);
    var after = document.querySelector('#stage .card__term').textContent;
    step('flipCard advances the deck', before !== after, before + ' -> ' + after);

    /* ---- 3. records list ---- */
    upsertRecord({ term: 'serendipity', type: 'word', zh: ['偶然性'], en: ['the occurrence of events by chance'], source: 'manual' });
    refreshRecords();
    step('records list renders one row', document.querySelectorAll('#recordsList .item').length === 1,
      document.querySelectorAll('#recordsList .item').length);
    step('empty state hidden when records exist', document.getElementById('recordsEmpty').hidden === true);
    step('count label shows 1 record', /1 record/.test(document.getElementById('recordsCount').textContent),
      document.getElementById('recordsCount').textContent);

    /* ---- 4. drop-to-save path ---- */
    saveDescriptorToRecords({ term: 'give up the ghost', type: 'phrase' }, null);
    await wait(200);
    step('drop-save adds a record', state.records.length === 2, state.records.length);
    saveDescriptorToRecords({ term: 'serendipity', type: 'word' }, null);
    step('saving a duplicate does not add a row', state.records.length === 2, state.records.length);

    /* ---- 5. entry sheet ---- */
    openEntrySheet(null);
    step('entry sheet opens', document.getElementById('sheetEntry').classList.contains('is-open'));
    document.getElementById('fTerm').value = 'resilient';
    setEntryType('word');
    document.getElementById('fZh').value = '有韌性的 / 適應力強的';
    document.getElementById('fEn').value = 'able to recover quickly';
    saveEntry();
    await wait(150);
    var rec = findRecordByTerm('resilient');
    step('entry saved with two senses', !!rec && rec.zh.length === 2, rec ? JSON.stringify(rec.zh) : 'missing');
    step('entry sheet closes after save', !document.getElementById('sheetEntry').classList.contains('is-open'));

    /* ---- 6. quiz pool ---- */
    /* a three-choice question needs at least three different meanings */
    if (recordsPool().length < 3) {
      upsertRecord({ term: 'ephemeral', type: 'word', zh: ['短暫的'], en: ['lasting a very short time'], source: 'manual' });
      refreshRecords();
    }
    var pool = recordsPool();
    step('quiz pool holds the saved words', pool.length >= 3, pool.length);

    /* ---- 7. three-choice quiz flow ---- */
    setView('revision');
    setRevSub('quiz');
    setQuizScope('records');
    await wait(160);
    step('quiz offers three options', document.querySelectorAll('#quizOptions .qopt').length === 3,
      document.querySelectorAll('#quizOptions .qopt').length);
    var q = state.round.current;
    step('quiz shows a prompt', !!q && document.getElementById('quizTerm').textContent.trim().length > 0,
      document.getElementById('quizTerm').textContent);
    if (!q) {
      step('three-choice flow', false, 'no question could be built');
    }
    if (q) {
    var correctIdx = -1, correctCount = 0;

    for (var i = 0; i < q.options.length; i++) if (q.options[i].correct) { correctIdx = i; correctCount++; }
    step('exactly one option is correct', correctIdx >= 0 && correctCount === 1, correctCount);

    window.__vib = 0;
    try { navigator.vibrate = function (p) { window.__vib++; return true; }; } catch (e) { /* ignore */ }
    answerQuiz(correctIdx);
    step('correct answer feedback', document.getElementById('quizFeedback').textContent === 'Correct',
      document.getElementById('quizFeedback').textContent);
    step('correct counter increments', document.getElementById('stCorrect').textContent === '1',
      document.getElementById('stCorrect').textContent);
    step('prompt flashes green on a right answer', document.getElementById('quizPrompt').classList.contains('is-correct'));
    step('vibration fired on a correct answer', window.__vib > 0, window.__vib);
    step('Next button appears after answering', document.getElementById('btnQuizNext').hidden === false);
    step('options lock once answered', Array.prototype.every.call(
      document.querySelectorAll('#quizOptions .qopt'), function (el) { return el.disabled; }));
    step('a saved word cannot be added twice',
      document.getElementById('btnQuizAdd').disabled === true, document.getElementById('btnQuizAdd').textContent);

    nextCard();
    await wait(60);
    var q2 = state.round.current;
    var wrongIdx = -1;
    for (var j = 0; j < q2.options.length; j++) if (!q2.options[j].correct) { wrongIdx = j; break; }
    var vibsBefore = window.__vib;
    answerQuiz(wrongIdx);
    var optsNow = document.querySelectorAll('#quizOptions .qopt');
    step('wrong answer counted', state.round.wrong === 1, state.round.wrong);
    step('chosen option turns red', optsNow[wrongIdx].classList.contains('is-wrong'));
    var rightDomIdx = -1;
    for (var k = 0; k < q2.options.length; k++) if (q2.options[k].correct) rightDomIdx = k;
    step('right option stays green', optsNow[rightDomIdx].classList.contains('is-correct'));
    step('prompt flashes red on a miss', document.getElementById('quizPrompt').classList.contains('is-wrong'));
    step('missed word lands in the round list', state.round.wrongList.length >= 1, state.round.wrongList.length);
    step('a miss reveals the full meaning', document.getElementById('quizAnswer').hidden === false);
    step('vibration fired on a wrong answer', window.__vib > vibsBefore, window.__vib);

    /* a CEFR range question can be saved straight into Records */
    if (poolSizeFor('A2') > 2) {
      var recsBefore = state.records.length;
      setQuizScope('A2');
      await wait(160);
      var addBtn = document.getElementById('btnQuizAdd');
      step('level range quiz runs', !!state.round.current, state.round.current ? state.round.current.term : '');
      step('level question offers Add to Records', addBtn.hidden === false, addBtn.textContent);
      if (addBtn.disabled) {
        step('Add to Records already saved', true, addBtn.textContent);
      } else {
        addBtn.click();
        step('Add to Records saves the word', state.records.length === recsBefore + 1, state.records.length);
      }

      setQuizScope('records');
      await wait(140);
    } else {
      step('level range quiz (bundled tables absent)', true, 'skipped');
    }
    } /* end if (q) */

    resetRound();

    step('reset round clears the counters', state.round.correct === 0 && state.round.wrong === 0);

