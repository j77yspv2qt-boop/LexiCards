/* =====================================================================
   Quiz page: question building, confusable options, round stats
   ===================================================================== */

const QUIZ_OPTIONS = 3;                       /* one right answer, two wrong */
const QUIZ_HISTORY = 12;                      /* do not repeat these yet */

/* What the Quiz draws from: the user's own Records, the subset due for
   review, the words they keep missing, or one CEFR level of the built-in
   deck.  Level ranges work fully offline - the bundled tables carry the
   Chinese glosses the options are made of. */
function quizScope() {
  const s = state.settings.quizScope || 'records';
  return isQuizScope(s) ? s : 'records';
}

function recordQuizItem(r) {
  const off = offlineMeaning(r.term);
  return {
    term: r.term, type: r.type || 'word', level: cefrOf(r.term) || '',
    zh: (r.zh || []).slice(0, 3),
    phonetic: r.phonetic || off.phonetic,
    example: r.example || off.example,
    record: r
  };
}

/* the two scopes that are not CEFR levels */
function isQuizScope(s) {
  return s === 'records' || s === 'due' || s === 'wrong' || CEFR_LEVELS.indexOf(s) >= 0;
}

function quizItems() {
  const s = quizScope();
  if (s === 'records') return recordsPool().map(recordQuizItem);
  if (s === 'due') return dueRecords().map(recordQuizItem);
  if (s === 'wrong') return wrongRecords().map(recordQuizItem);
  return levelPool(s);
}

/* Wrong options may come from anywhere in the same level, not only from the
   words on screen - a learner with five saved words still gets real choices. */
function distractorPool(item) {
  const level = cefrOf(item.term) || 'A2';
  const base = quizItems();
  if (level === quizScope()) return base;
  return base.concat(levelPool(level));
}

/* --------------------------- spaced repetition (v2.2) ----------------------
   A saved word carries dueAt / ease / interval in stats (see applySrs).
   dueRecords() and wrongRecords() are the two review pools the Quiz can
   point at; both are derived from stats, never stored on their own. */

function isDueRecord(r) {
  const st = r && r.stats;
  if (!st || !st.dueAt) return true;        /* never scheduled = needs review */
  return st.dueAt <= Date.now();
}
function dueRecords() { return recordsPool().filter(isDueRecord); }
function wrongRecords() {
  return recordsPool().filter(r => {
    const st = r.stats;
    /* in the wrong list while misses still outrank hits; answering well
       enough graduates the word automatically */
    return st && (st.wrong || 0) > 0 && (st.correct || 0) <= (st.wrong || 0);
  });
}

/* Narrow a candidate pool to the overdue words.  With the switch off this
   is the identity, so the old weighting behaviour is one flag away. */
function duePreferred(pool) {
  if (!state.settings.srsEnabled) return pool;
  const due = pool.filter(x => x.record && isDueRecord(x.record));
  return due.length ? due : pool;
}

function pickWeighted(pool) {
  if (!pool || !pool.length) return null;
  const round = state.round || newRound();
  const recent = Object.create(null);
  (round.recent || []).forEach(k => { recent[k] = true; });
  const cur = round.current;
  let candidates = pool;
  if (pool.length > 1) candidates = pool.filter(x => (!cur || x.term !== cur.term) && !recent[normKey(x.term)]);
  if (!candidates.length) candidates = pool.filter(x => !cur || x.term !== cur.term);
  if (!candidates.length) candidates = pool;

  /* spaced repetition: an overdue word beats a fresh one, but only inside
     the pool the scope already chose - a due word still loses to "not asked
     in the last twelve questions" */
  const dueOnly = duePreferred(candidates);
  if (dueOnly.length) candidates = dueOnly;

  const weights = candidates.map(x => {
    const st = (x.record && x.record.stats) || {};
    const overdue = Math.min(6, daysSince(st.lastReviewedAt) / 3);
    return 1 + (st.wrong || 0) * 2 + overdue;
  });
  let total = 0;
  for (let i = 0; i < weights.length; i++) total += weights[i];
  let roll = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

/* ------------------------------- question types -------------------------------
   'meaning' is the original three-Chinese-choices question.  The other three
   turn it into production instead of recognition: 'reverse' shows the Chinese
   and asks for the word, 'listen' only plays the audio, and 'spell' makes the
   learner type it.  All four share buildQuestion / answerQuiz - only what the
   prompt shows and what the options contain changes. */
const QUIZ_MODES = ['meaning', 'spell', 'listen', 'reverse'];

function quizMode() {
  const m = state.settings.quizMode || 'meaning';
  return QUIZ_MODES.indexOf(m) >= 0 ? m : 'meaning';
}

/* Word options for the reverse / listening modes: the term plus two look-alike
   words, scored with the same confusion metric the Chinese distractors use
   (edit distance, shared prefix, shared gloss characters). */
function pickWordOptions(item) {
  const key = normKey(item.term);
  const pool = distractorPool(item);
  const scored = [];
  for (let i = 0; i < pool.length; i++) {
    const c = pool[i];
    if (!c || !c.term || normKey(c.term) === key) continue;
    scored.push({ term: c.term, s: confusionScore(item.term, glossText(item), c.term, glossText(c)) });
  }
  if (!scored.length) return null;
  let candidates = scored;
  if (state.settings.quizTricky) {
    scored.sort((x, y) => y.s - x.s);
    candidates = scored.slice(0, Math.min(scored.length, QUIZ_OPTIONS * 8));
  }
  const picked = [];
  const used = Object.create(null);
  used[key] = true;
  const bag = shuffle(candidates);
  for (let i = 0; i < bag.length && picked.length < QUIZ_OPTIONS - 1; i++) {
    const k = normKey(bag[i].term);
    if (used[k]) continue;
    used[k] = true;
    picked.push({ text: bag[i].term, correct: false });
  }
  if (picked.length < QUIZ_OPTIONS - 1) return null;
  return shuffle([{ text: item.term, correct: true }].concat(picked));
}

/* one question = the term plus QUIZ_OPTIONS answers, exactly one of which is
   right, in random order */
function buildQuestion(item) {
  const correct = glossText(item);
  if (!correct) return null;
  const type = item.type || 'word';
  /* a phrase or a sentence pattern cannot be spelled out or heard as a word */
  const mode = type === 'word' ? quizMode() : 'meaning';
  let options = null;
  if (mode === 'meaning') {
    const wrongs = pickDistractors(item, distractorPool(item), QUIZ_OPTIONS - 1);
    if (wrongs.length < QUIZ_OPTIONS - 1) return null;
    options = shuffle([{ text: correct, correct: true }]
      .concat(wrongs.map(w => ({ text: w.text, correct: false }))));
  } else if (mode === 'reverse' || mode === 'listen') {
    options = pickWordOptions(item);
    if (!options) return null;              /* nextQuestion() retries, then shows the empty state */
  }
  const q = {
    term: item.term, type: type, level: item.level || '', mode: mode,
    zh: item.zh || [], phonetic: item.phonetic || '', example: item.example || '',
    record: item.record || null, options: options || [], picked: -1, typed: ''
  };
  return q;
}

/* marks from the first differing character on, so a near miss shows where it
   went wrong without spelling the whole word out */
function spellDiffHTML(typed, term) {
  const a = String(typed || '').trim(), b = String(term || '');
  if (!a.length || !b.length) return '';
  let i = 0;
  while (i < a.length && i < b.length && a.charAt(i) === b.charAt(i)) i++;
  const rest = a.slice(i) || b.slice(i);
  return escapeHTML(a.slice(0, i)) + '<span class="spell-diff">' + escapeHTML(rest) + '</span>' +
    (a.slice(i) ? ' &rarr; ' + escapeHTML(b) : '');
}

function nextQuestion() {
  const items = quizItems();
  for (let tries = 0; tries < 10; tries++) {
    const item = pickWeighted(items);
    if (!item) return null;
    const q = buildQuestion(item);
    if (q) {
      if (!state.round.recent) state.round.recent = [];
      state.round.recent.push(normKey(q.term));
      while (state.round.recent.length > QUIZ_HISTORY) state.round.recent.shift();
      return q;
    }
  }
  return null;
}

function newRound() {
  return {
    total: 0, correct: 0, wrong: 0, streak: 0,
    current: null, answered: false, recent: [], wrongList: [], timer: null
  };
}

function setText(selector, value) {
  const el = $(selector);
  if (el) el.textContent = value;
}

function updateQuizStats() {
  const r = state.round || newRound();
  const answered = r.correct + r.wrong;
  setText('#stTotal', String(r.total));
  setText('#stCorrect', String(r.correct));
  setText('#stWrong', String(r.wrong));
  setText('#stStreak', String(r.streak));
  setText('#stAcc', answered ? Math.round(r.correct / answered * 100) + '%' : '\u2014');
}

/* SM-2, simplified to the two grades this Quiz actually has: a right answer
   stretches the interval by the current ease (capped at half a year), a miss
   sends the word back to tomorrow and lowers the ease.  0-20% jitter keeps
   a batch of words saved on the same day from coming due on the same day. */
function applySrs(rec, ok) {
  const st = rec.stats;
  if (typeof st.ease !== 'number' || st.ease < 1) st.ease = 2.5;
  if (typeof st.interval !== 'number' || st.interval < 1) st.interval = 0;
  if (ok) {
    st.interval = st.interval < 1 ? 1 : Math.min(180, Math.round(st.interval * st.ease));
    if (st.ease < 2.5) st.ease = Math.min(2.5, st.ease + 0.05);
  } else {
    st.interval = 1;
    st.ease = Math.max(1.3, st.ease - 0.2);
  }
  const jitter = Math.round(Math.random() * 0.2 * st.interval * 86400000);
  st.dueAt = Date.now() + st.interval * 86400000 + jitter;
}

function touchStats(rec, ok) {
  if (!rec) return;
  if (!rec.stats) rec.stats = { seen: 0, correct: 0, wrong: 0, streak: 0, lastReviewedAt: 0 };
  rec.stats.seen = (rec.stats.seen || 0) + 1;
  rec.stats.lastReviewedAt = Date.now();
  if (ok) {
    rec.stats.correct = (rec.stats.correct || 0) + 1;
    rec.stats.streak = (rec.stats.streak || 0) + 1;
  } else {
    rec.stats.wrong = (rec.stats.wrong || 0) + 1;
    rec.stats.streak = 0;
  }
  applySrs(rec, ok);
  saveRecords();
}
