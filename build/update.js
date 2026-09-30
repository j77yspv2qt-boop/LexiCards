/* =====================================================================
   Update check - ask GitHub for the newest release

   A release is published as a tag (v1.6) with the built LexiCards.apk as its
   asset, so one API call tells the app everything: the newest version, the
   release notes and the APK URL.  The GitHub API is tried first, the
   version.json that lives in the repository is the fallback for a rate limit
   or a blocked API; both answer with an Access-Control-Allow-Origin header, so
   a browser tab and the Android WebView can read them.  The answer is kept in
   the settings, and it is always compared against the *running* version - after
   installing the update the sheet says "up to date" again by itself.
   ===================================================================== */
const UPDATE_REPO     = 'j77yspv2qt-boop/LexiCards';
const UPDATE_API      = 'https://api.github.com/repos/' + UPDATE_REPO + '/releases/latest';
const UPDATE_JSON     = 'https://raw.githubusercontent.com/' + UPDATE_REPO + '/main/version.json';
const UPDATE_RELEASES = 'https://github.com/' + UPDATE_REPO + '/releases/latest';
const UPDATE_CHECK_MS = 6 * 60 * 60 * 1000;      /* do not ask GitHub more often than this */

const updateState = {
  checking: false, checked: false, at: 0,
  version: '', url: UPDATE_RELEASES, notes: '', error: '', newer: false
};

/* "1.10" is newer than "1.9" - a plain string compare would say the opposite */
function versionParts(v) {
  return String(v == null ? '' : v).replace(/^[vV]/, '').split(/[.\-+]/)
    .map(p => parseInt(p, 10)).filter(n => !isNaN(n));
}
function compareVersion(a, b) {
  const x = versionParts(a), y = versionParts(b);
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) {
    const l = x[i] || 0, r = y[i] || 0;
    if (l > r) return 1;
    if (l < r) return -1;
  }
  return 0;
}
function currentAppVersion() {
  return (NATIVE.isNative && NATIVE.version) ? NATIVE.version : APP_VERSION;
}

function loadUpdateState() {
  const saved = state.settings && state.settings.lastUpdate;
  if (saved && saved.version) {
    updateState.version = String(saved.version);
    updateState.url = saved.url || UPDATE_RELEASES;
    updateState.notes = String(saved.notes || '');
    updateState.at = saved.at || 0;
    updateState.checked = true;
    updateState.newer = compareVersion(updateState.version, currentAppVersion()) > 0;
  }
}
function saveUpdateState() {
  state.settings.lastUpdate = {
    version: updateState.version, url: updateState.url,
    notes: updateState.notes, at: updateState.at
  };
  saveSettings();
}

function parseGithubRelease(data) {
  if (!data || !data.tag_name) return null;
  let apk = '';
  (data.assets || []).forEach(a => {
    if (!apk && a && /\.apk$/i.test(a.name || '')) apk = a.browser_download_url || '';
  });
  return {
    version: String(data.tag_name).replace(/^[vV]/, ''),
    url: apk || data.html_url || UPDATE_RELEASES,
    notes: String(data.body || '').split('\n').filter(l => l.trim()).slice(0, 3).join(' ').trim(),
    at: Date.now()
  };
}
function parseVersionFile(data) {
  if (!data || !data.version) return null;
  return {
    version: String(data.version).replace(/^[vV]/, ''),
    url: data.apk || data.url || UPDATE_RELEASES,
    notes: String(data.notes || '').trim(),
    at: Date.now()
  };
}


function applyUpdateInfo(info) {
  if (!info || !info.version) return false;
  updateState.version = info.version;
  updateState.url = info.url;
  updateState.notes = info.notes || '';
  updateState.at = info.at || Date.now();
  updateState.error = '';
  updateState.checked = true;
  updateState.newer = compareVersion(info.version, currentAppVersion()) > 0;
  saveUpdateState();
  syncUpdateUI();
  return updateState.newer;
}

/* manual === the user pressed the button: always asks, and reports failures */
function checkForUpdate(manual) {
  if (updateState.checking) return Promise.resolve(updateState);
  if (!manual && updateState.checked && (Date.now() - updateState.at) < UPDATE_CHECK_MS) {
    return Promise.resolve(updateState);
  }
  updateState.checking = true;
  syncUpdateUI();
  const get = (url) => fetchJSON(url, 8000);
  return get(UPDATE_API)
    .then(d => parseGithubRelease(d) || Promise.reject(new Error('no release yet')), () => get(UPDATE_JSON))
    .then(d => {
      const info = parseGithubRelease(d) || parseVersionFile(d);
      if (!info) throw new Error('bad release data');
      applyUpdateInfo(info);
    })
    .catch(err => {
      updateState.checked = true;
      updateState.at = Date.now();
      updateState.error = errText(err);
      if (manual) showToast('Could not reach GitHub - try the releases page', 'warn');
      syncUpdateUI();
    })
    .then(() => { updateState.checking = false; syncUpdateUI(); return updateState; });
}

function updateHintText() {
  const cur = currentAppVersion();
  if (updateState.checking) return 'Checking GitHub for the newest release...';
  if (updateState.version && updateState.newer) {
    return 'v' + updateState.version + ' is available - you have v' + cur + '.' +
      (updateState.notes ? ' ' + updateState.notes : '');
  }
  if (updateState.version) return 'Up to date - v' + cur + ' is the newest release.';
  if (updateState.checked && updateState.error) {
    return 'You have v' + cur + '. GitHub could not be reached (' + updateState.error +
      ') - open the releases page to check by hand.';
  }
  return 'You have v' + cur + '. Tap "Check for updates" to look for a newer release on GitHub.';
}

function syncUpdateUI() {
  const hint = $('#updateInfo');
  if (!hint) return;
  hint.textContent = updateHintText();
  const check = $('#btnCheckUpdate');
  if (check) {
    check.disabled = updateState.checking;
    check.textContent = updateState.checking ? 'Checking...' : 'Check for updates';
  }
  const install = $('#btnInstallUpdate');
  if (install) {
    const show = !!(updateState.version && updateState.newer);
    install.hidden = !show;
    if (show) install.textContent = 'Download v' + updateState.version;
  }
}

function updateDownloadUrl() {
  return updateState.url || UPDATE_RELEASES;
}
function startUpdateDownload() {
  const url = updateDownloadUrl();
  if (NATIVE.isNative) showToast('Downloading in your browser - tap the file to install', 'ok', 3600);
  openExternalUrl(url);
}

function initUpdateSheet() {
  const check = $('#btnCheckUpdate');
  if (check) check.addEventListener('click', () => checkForUpdate(true));
  const install = $('#btnInstallUpdate');
  if (install) install.addEventListener('click', startUpdateDownload);
  const page = $('#btnReleasePage');
  if (page) page.addEventListener('click', () => openExternalUrl(UPDATE_RELEASES));

  loadUpdateState();
  syncUpdateUI();
  /* No check on start-up: the sheet asks GitHub when it is opened (that is the
     moment the answer is useful), and the answer is then cached for a few hours
     so a second tap costs nothing. */
}
