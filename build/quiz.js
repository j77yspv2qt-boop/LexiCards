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

/* one question = the term plus QUIZ_OPTIONS Chinese meanings, exactly one of
   which is right, in random order */
function buildQuestion(item) {
  const correct = glossText(item);
  if (!correct) return null;
  const wrongs = pickDistractors(item, distractorPool(item), QUIZ_OPTIONS - 1);
  if (wrongs.length < QUIZ_OPTIONS - 1) return null;
  const options = [{ text: correct, correct: true }]
    .concat(wrongs.map(w => ({ text: w.text, correct: false })));
  const q = {
    term: item.term, type: item.type || 'word', level: item.level || '',
    zh: item.zh || [], phonetic: item.phonetic || '', example: item.example || '',
    record: item.record || null, options: shuffle(options), picked: -1
  };
  return q;
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
