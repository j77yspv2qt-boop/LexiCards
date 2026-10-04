/* =====================================================================
   Daily activity: the counters behind the Quiz page's goal ring.

   One tiny object in localStorage keyed by the *local* date, so the day
   flips at midnight where the learner actually lives, not at UTC.  Only
   counts are stored (two integers per day) and the table is trimmed to
   about a year, so this stays a few kilobytes at most.
   ===================================================================== */

function dayKey(d) {
  const x = d || new Date();
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') +
    '-' + String(x.getDate()).padStart(2, '0');
}

function loadActivity() {
  const a = Store.read(LS_KEYS.activity, null);
  state.activity = (a && typeof a === 'object' && !Array.isArray(a)) ? a : {};
}

function saveActivity() { Store.write(LS_KEYS.activity, state.activity); }

function activityToday() {
  return state.activity[dayKey()] || { reviewed: 0, correct: 0 };
}

/* called from answerQuiz() for every answered question, whether or not the
   word is a saved record - the goal counts effort, not storage */
function recordActivity(ok) {
  const k = dayKey();
  const before = state.activity[k] || (state.activity[k] = { reviewed: 0, correct: 0 });
  const goal = Math.max(1, state.settings.dailyGoal || 20);
  const wasBelow = before.reviewed < goal;
  before.reviewed++;
  if (ok) before.correct++;

  /* keep roughly a year of days; keys sort chronologically as YYYY-MM-DD */
  const keys = Object.keys(state.activity);
  if (keys.length > 400) {
    keys.sort();
    keys.slice(0, keys.length - 365).forEach(x => { delete state.activity[x]; });
  }
  saveActivity();
  /* crossing the daily goal gets the same little pulse as a save */
  if (wasBelow && before.reviewed >= goal) vibrate(HAPTIC.saved);
  renderDailyCard();
}

/* consecutive local days with at least one review; today still empty means
   yesterday's work keeps the streak alive until the day actually ends */
function activityStreak() {
  let n = 0;
  const d = new Date();
  if (!activityToday().reviewed) d.setDate(d.getDate() - 1);
  for (;;) {
    const t = state.activity[dayKey(d)];
    if (!t || !t.reviewed) break;
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/* correct / reviewed over the last seven days, null when nothing was reviewed */
function weekAccuracy() {
  let ok = 0, all = 0;
  const d = new Date();
  for (let i = 0; i < 7; i++) {
    const t = state.activity[dayKey(d)];
    if (t) { all += t.reviewed || 0; ok += t.correct || 0; }
    d.setDate(d.getDate() - 1);
  }
  return all ? Math.round((ok / all) * 100) : null;
}

/* the card at the top of the Quiz page: goal ring, streak, due count,
   week accuracy and the "start reviewing" button */
function renderDailyCard() {
  const card = $('#dailyCard');
  if (!card) return;
  card.hidden = !state.records.length;
  const goal = Math.max(1, state.settings.dailyGoal || 20);
  const t = activityToday();
  const pct = clamp(Math.round((t.reviewed / goal) * 100), 0, 100);
  const ring = $('#dailyRing');
  if (ring) ring.style.background =
    'conic-gradient(var(--primary) ' + pct + '%, var(--track, #E3ECF7) 0%)';
  setText('#dailyPct', pct + '%');
  setText('#dailyCount', t.reviewed + ' / ' + goal);
  setText('#dailyStreak', String(activityStreak()));
  setText('#dailyDue', String(dueRecords().length));
  const wk = weekAccuracy();
  setText('#dailyWeek', wk === null ? '\u2014' : wk + '%');
  const go = $('#btnStartDue');
  if (go) {
    const due = dueRecords().length;
    go.disabled = due === 0;
    go.textContent = due ? 'Review due words (' + due + ')' : 'All caught up \u2713';
  }
}
