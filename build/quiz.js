/* =====================================================================
   Quiz page: question building, confusable options, round stats
   ===================================================================== */

const QUIZ_OPTIONS = 3;                       /* one right answer, two wrong */
const QUIZ_HISTORY = 12;                      /* do not repeat these yet */

/* What the Quiz draws from: the user's own Records, or one CEFR level of the
   built-in deck.  Level ranges work fully offline - the bundled tables carry
   the Chinese glosses the options are made of. */
function quizScope() {
  const s = state.settings.quizScope || 'records';
  return (s === 'records' || CEFR_LEVELS.indexOf(s) >= 0) ? s : 'records';
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

function quizItems() {
  if (quizScope() === 'records') return recordsPool().map(recordQuizItem);
  return levelPool(quizScope());
}

/* Wrong options may come from anywhere in the same level, not only from the
   words on screen - a learner with five saved words still gets real choices. */
function distractorPool(item) {
  const level = cefrOf(item.term) || 'A2';
  const base = quizItems();
  if (level === quizScope()) return base;
  return base.concat(levelPool(level));
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
  saveRecords();
}
