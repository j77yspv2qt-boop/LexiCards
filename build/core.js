'use strict';
/* =====================================================================
   LexiCards - core: constants, helpers, toast, storage, app state
   ===================================================================== */

const LS_KEYS = {
  records : 'lexi.records.v1',
  cache   : 'lexi.cache.v1',
  settings: 'lexi.settings.v1',
  cards   : 'lexi.cards.v1',
  custom  : 'lexi.custom.v1',
  tr      : 'lexi.trcache.v1',
  /* Per-day review counters behind the daily goal ring and the streak (v2.2).
     One small object keyed by local date; trimmed to roughly a year. */
  activity: 'lexi.activity.v1',
  /* Rolling safety copy of the records.  Clearing site data or a crashed
     write used to take the word list down with it, so every save also mirrors
     the records here and loadAll() can put them back. */
  backup  : 'lexi.records.bak.v1'
};

const APP_VERSION = '2.5';

const DEFAULT_SETTINGS = {
  definitionLang: 'traditional',   /* script for "Definition in Chinese" (App info) */
  acceptEnglishInQuiz: true,
  haptics: true,
  autoNext: true,
  autoNextDelayMs: 850,
  strictQuiz: false,
  quizScope: 'records',            /* what the Quiz draws questions from */
  quizMode: 'meaning',             /* meaning | spell | listen | reverse (v2.3) */
  quizTricky: true,                /* build the wrong options from confusable words */
  srsEnabled: true,                /* quiz due words first (spaced repetition) */
  dailyGoal: 20,                   /* questions per day shown on the Quiz ring */
  lastExportAt: 0,                 /* when a backup was last exported (v2.4) */
  exportReminderShown: false,      /* the one-time nudge has been seen */
  reminderOn: false,               /* daily reminder at 20:00 (v2.5, Android only) */
  skin: 'classic'                  /* the look: colours, icons, wordmark, app icon */
};


const LONG_PRESS_MS  = 450;
const MOVE_TOLERANCE = 10;
const SWIPE_RATIO    = 0.30;
const SWIPE_VELOCITY = 0.5;
const CACHE_TTL      = 30 * 24 * 60 * 60 * 1000;
const CACHE_FAIL_TTL = 5 * 60 * 1000;
const TR_CACHE_TTL   = 30 * 24 * 60 * 60 * 1000;   /* machine translation is stable for a month */
const CACHE_MAX      = 400;                        /* keep localStorage small and writes fast */
const TR_CACHE_MAX   = 300;

/* --- lookup speed ---------------------------------------------------------
   A provider that hangs used to stall the whole lookup: the request had to
   time out before the next provider was even tried.  Now every provider gets
   a shorter deadline, the next provider is started in parallel after
   API_HEDGE_MS, and the first one that answers wins.  A provider that fails
   twice in a row is skipped until API_PROVIDER_COOLDOWN passes, so a dead
   endpoint stops costing us anything. */
const API_TIMEOUT           = 4500;
const API_HEDGE_MS          = 350;
/* the translator chain hedges the same way: if the first engine stays quiet
   for this long the next one is started in parallel and the first answer wins.
   On a network where one engine is unreachable that turns a 4.5 s timeout into
   a few hundred milliseconds. */
const TR_HEDGE_MS           = 350;
const API_PROVIDER_MAX_FAILS = 2;
const API_PROVIDER_COOLDOWN = 10 * 60 * 1000;

/* --- read-ahead ----------------------------------------------------------
   After a deck is (re)built the next few cards are fetched in the background,
   so swiping / shuffling shows a finished meaning instead of a skeleton. */
const PREFETCH_AHEAD       = 4;
const PREFETCH_CONCURRENCY = 2;

const TYPE_LABEL = { word: 'Word', phrase: 'Phrase', pattern: 'Pattern' };

/* ------------------------------- helpers ------------------------------- */
const $  = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

function escapeHTML(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function uid() {
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function debounce(fn, ms) {
  let t = null;
  return function () { const args = arguments; clearTimeout(t); t = setTimeout(() => fn.apply(null, args), ms); };
}
function normKey(term) { return String(term || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function daysSince(ts) { return ts ? Math.floor((Date.now() - ts) / 86400000) : 999; }

/* normalise text before comparing quiz answers */
function normText(s) {
  return String(s == null ? '' : s)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[.,!?;:、，。！？；：'"`“”‘’()（）[\]{}<>~\-_/\\|*+=#@$%^&]/g, '');
}

/* split a textarea value into senses / alternative answers */
function splitSenses(raw) {
  const out = [];
  String(raw || '').split(/\r?\n|\/|；|;/).forEach(part => {
    const v = part.trim();
    if (v) out.push(v);
  });
  return out;
}

function vibrate(ms) {
  if (!state.settings.haptics) return;
  /* ms may be a number or a [vibrate, pause, vibrate, ...] pattern */
  try { if (navigator.vibrate) { navigator.vibrate(ms); return; } } catch (e) { /* ignore */ }
  try {
    if (window.LexiNative && window.LexiNative.vibrate) {
      if (Array.isArray(ms)) {
        /* the native bridge only takes one pulse - play the pattern by hand */
        let at = 0;
        ms.forEach((d, i) => {
          if (i % 2 === 0) setTimeout(() => { try { window.LexiNative.vibrate(d); } catch (e) { /* ignore */ } }, at);
          at += d;
        });
      } else {
        window.LexiNative.vibrate(ms);
      }
    }
  } catch (e) { /* ignore */ }
}

/* the three Quiz feels, kept in one place so they stay consistent */
const HAPTIC = {
  right : 18,                    /* a short tick */
  wrong : [28, 45, 28],          /* two light pulses - noticeable, not harsh */
  saved : [12, 30, 12]
};


function download(filename, text) {
  /* inside the Android wrapper the native save dialog is used - a blob
     download does nothing in a WebView */
  if (NATIVE.isNative && NATIVE.api && NATIVE.api.saveFile) {
    try { NATIVE.api.saveFile(filename, text); return; } catch (e) { /* fall through */ }
  }
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 600);
}

function showToast(msg, kind, ms) {
  const box = $('#toasts');
  if (!box) return;
  const mark = kind === 'ok' ? '\u2713' : kind === 'err' ? '!' : kind === 'warn' ? '!' : 'i';
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' toast--' + kind : '');
  el.innerHTML = '<span aria-hidden="true">' + mark + '</span><span>' + escapeHTML(msg) + '</span>';
  box.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  setTimeout(() => { el.classList.remove('is-in'); setTimeout(() => el.remove(), 280); }, ms || 2300);
}

/* ------------------------------- storage ------------------------------- */
const memFallback = {};
let storageOK = true;
try { localStorage.setItem('lexi.__t', '1'); localStorage.removeItem('lexi.__t'); }
catch (e) { storageOK = false; }

const Store = {
  read(key, fallback) {
    try {
      const raw = storageOK ? localStorage.getItem(key) : memFallback[key];
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  },
  write(key, value) {
    const raw = JSON.stringify(value);
    try {
      if (storageOK) localStorage.setItem(key, raw); else memFallback[key] = raw;
      return true;
    } catch (e) {
      memFallback[key] = raw;
      showToast('Storage is full or blocked - changes live in this tab only.', 'err', 3400);
      return false;
    }
  }
};
