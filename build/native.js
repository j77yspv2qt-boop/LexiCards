/* =====================================================================
   Native host bridge - Android APK wrapper

   Everything here is optional.  In a normal browser window.LexiNative does
   not exist, NATIVE.isNative is false and the app behaves exactly as it
   always did (localStorage, blob download, no hardware back button).
   ===================================================================== */
const NATIVE = (function () {
  const api = (typeof window !== 'undefined' && window.LexiNative) ? window.LexiNative : null;
  const info = { api: api, isNative: !!api, platform: 'browser', sdk: 0, version: '' };
  if (api) {
    try { info.platform = String(api.platform() || 'android'); } catch (e) { info.platform = 'android'; }
    try { info.sdk = Number(api.sdk()) || 0; } catch (e) { info.sdk = 0; }
    try { info.version = String(api.appVersion() || ''); } catch (e) { info.version = ''; }
  }
  return info;
})();

function nativeDescribe() {
  if (!NATIVE.isNative) return 'Running in a browser.';
  return 'Installed app v' + (NATIVE.version || '?') + ' - ' + NATIVE.platform +
    (NATIVE.sdk ? ' (API ' + NATIVE.sdk + ')' : '') + '.';
}

/* Android hardware / gesture back button: close a sheet first, step back one
   level inside the app, and only then let Android leave the app. */
/* the pages run Discover -> My Cards -> Records -> Quiz, so "back" walks one
   step up that list and leaves the app from the first page */
window.lexiHandleBack = function () {
  if ($('.sheet.is-open')) { closeAllSheets(); return true; }
  const i = pageIndex(state.page);
  if (i > 0) { setPage(PAGES[i - 1].id); return true; }
  return false;
};

/* open a link outside the app: inside the Android wrapper the system browser
   takes it (the APK download / the releases page), a normal tab gets a new
   window instead of navigating the app away */
function openExternalUrl(url) {
  const u = String(url || '');
  if (!/^https?:\/\//i.test(u)) return false;
  if (NATIVE.isNative && NATIVE.api && typeof NATIVE.api.openExternal === 'function') {
    try { NATIVE.api.openExternal(u); return true; } catch (e) { /* fall through */ }
  }
  try {
    const a = document.createElement('a');
    a.href = u;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch (e) { return false; }
}

if (NATIVE.isNative) {
  document.documentElement.setAttribute('data-native', NATIVE.platform);
}

/* --------------------------- daily reminder (v2.5) ---------------------------
   The switch lives in Data & settings, but arming the alarm is native work:
   AlarmManager only exists inside the APK.  So the web side owns the setting
   and pushes two things over the same LexiNative bridge the vibration and
   system-bar calls already use - on/off (with the fixed 20:00 time) and the
   current due count, which is what the notification text quotes.  In a
   browser every call here is a no-op and the switch itself stays hidden. */
const REMINDER_HOUR = 20;

function pushReminder() {
  if (!NATIVE.isNative || !NATIVE.api || typeof NATIVE.api.setDailyReminder !== 'function') return;
  try {
    NATIVE.api.setDailyReminder(!!state.settings.reminderOn, REMINDER_HOUR, 0);
  } catch (e) { /* bridge unavailable - the setting still persists */ }
}

function pushReminderDue() {
  if (!NATIVE.isNative || !NATIVE.api || typeof NATIVE.api.setReminderDue !== 'function') return;
  try {
    NATIVE.api.setReminderDue(typeof dueRecords === 'function' ? dueRecords().length : 0);
  } catch (e) { /* ignore */ }
}

/* Called from native code after the Android 13+ permission dialog resolves.
   A refusal cannot silently leave the switch ON promising a notification that
   will never come - flip it back, save, and say why. */
window.onReminderPermission = function (granted) {
  if (granted) {
    showToast('Daily reminder on - every day at ' + REMINDER_HOUR + ':00', 'ok');
    return;
  }
  if (state.settings.reminderOn) {
    state.settings.reminderOn = false;
    saveSettings();
    syncSettingsUI();
  }
  showToast('Notifications are blocked - the daily reminder stays off', 'warn');
};

/* the one line under the switch that says what turning it on actually does */
function reminderInfoText() {
  if (!NATIVE.isNative) return '';
  return state.settings.reminderOn
    ? 'Every day at ' + REMINDER_HOUR + ':00, one notification with today\'s due count. ' +
      'Opening the app clears today\'s notification.'
    : 'Off. Turn it on and the Android app notifies you once a day at ' +
      REMINDER_HOUR + ':00, when words are due.';
}

/* Text-to-speech helper: plays MP3 URL if present, or fallback online audio, native TTS, or Web Speech Synthesis */
let _currentAudio = null;
function speakTerm(term, audioUrl) {
  if (!term) return;
  if (_currentAudio) {
    try { _currentAudio.pause(); _currentAudio.currentTime = 0; } catch (e) {}
    _currentAudio = null;
  }

  /* Candidate audio sources */
  const cleanTerm = term.trim();
  const urls = [];
  if (audioUrl) urls.push(audioUrl);
  urls.push('https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(cleanTerm) + '&type=2');

  function tryPlayUrls(idx) {
    if (idx >= urls.length) {
      speakFallback(cleanTerm);
      return;
    }
    try {
      const a = new Audio(urls[idx]);
      _currentAudio = a;
      const playPromise = a.play();
      if (playPromise && playPromise.catch) {
        playPromise.catch(() => {
          tryPlayUrls(idx + 1);
        });
      }
    } catch (e) {
      tryPlayUrls(idx + 1);
    }
  }

  tryPlayUrls(0);
}

function speakFallback(term) {
  if (NATIVE.isNative && NATIVE.api && typeof NATIVE.api.speak === 'function') {
    try { NATIVE.api.speak(term); return; } catch (e) {}
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(term);
      u.lang = 'en-US';
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }
}
