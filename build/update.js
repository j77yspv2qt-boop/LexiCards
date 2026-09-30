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
const UPDATE_RELEASES = 'https://github.com/' + UPDATE_REPO + '/releases/latest';
const UPDATE_CHECK_MS = 6 * 60 * 60 * 1000;      /* do not ask GitHub more often than this */

/* Where the newest version can be read from.  Every entry answers with an
   Access-Control-Allow-Origin header, so a browser tab and the Android WebView
   can both read it, and all of them are asked at the same time - the first
   usable answer wins, no waiting in line.

   The GitHub API gives the richest answer (tag, release notes, APK asset), but
   api.github.com and raw.githubusercontent.com are unreachable on some
   networks (mainland China in particular).  jsDelivr serves the same
   version.json straight out of the repository through three separate CDNs
   (Cloudflare, Fastly, Gcore) and stays reachable there, so the check keeps
   working. */
const UPDATE_SOURCES = [
  { id: 'github',  url: 'https://api.github.com/repos/' + UPDATE_REPO + '/releases/latest' },
  { id: 'jsdelivr',       url: 'https://cdn.jsdelivr.net/gh/' + UPDATE_REPO + '@main/version.json' },
  { id: 'jsdelivr-fastly', url: 'https://fastly.jsdelivr.net/gh/' + UPDATE_REPO + '@main/version.json' },
  { id: 'jsdelivr-gcore',  url: 'https://gcore.jsdelivr.net/gh/' + UPDATE_REPO + '@main/version.json' },
  { id: 'raw', url: 'https://raw.githubusercontent.com/' + UPDATE_REPO + '/main/version.json' }
];
const UPDATE_TIMEOUT_MS = 8000;
/* branch refs on a CDN are cached for a while - a day stamp keeps the answer
   from going stale for longer than that */
const UPDATE_STAMP = new Date().toISOString().slice(0, 10);

const updateState = {
  checking: false, checked: false, at: 0,
  version: '', url: UPDATE_RELEASES, mirror: '', page: UPDATE_RELEASES,
  notes: '', error: '', source: '', newer: false
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
    updateState.mirror = saved.mirror || '';
    updateState.page = saved.page || UPDATE_RELEASES;
    updateState.notes = String(saved.notes || '');
    updateState.source = String(saved.source || '');
    updateState.at = saved.at || 0;
    updateState.checked = true;
    updateState.newer = compareVersion(updateState.version, currentAppVersion()) > 0;
  }
}
function saveUpdateState() {
  state.settings.lastUpdate = {
    version: updateState.version, url: updateState.url, mirror: updateState.mirror,
    page: updateState.page, notes: updateState.notes, source: updateState.source,
    at: updateState.at
  };
  saveSettings();
}

function parseGithubRelease(data) {
  if (!data || !data.tag_name) return null;
  let apk = '';
  (data.assets || []).forEach(a => {
    if (!apk && a && /\.apk$/i.test(a.name || '')) apk = a.browser_download_url || '';
  });
  const tag = String(data.tag_name).replace(/^[vV]/, '');
  return {
    version: tag,
    url: apk || data.html_url || UPDATE_RELEASES,
    /* a copy of the APK inside the repository, served by jsDelivr, for the
       networks where the release asset cannot be downloaded */
    mirror: 'https://cdn.jsdelivr.net/gh/' + UPDATE_REPO + '@v' + tag + '/LexiCards.apk',
    page: data.html_url || UPDATE_RELEASES,
    notes: String(data.body || '').split('\n').filter(l => l.trim()).slice(0, 3).join(' ').trim(),
    at: Date.now()
  };
}
function parseVersionFile(data) {
  if (!data || !data.version) return null;
  return {
    version: String(data.version).replace(/^[vV]/, ''),
    url: data.apk || data.url || UPDATE_RELEASES,
    mirror: data.apk_mirror || data.apk_cn || '',
    page: data.mirror_page || data.page || UPDATE_RELEASES,
    notes: String(data.notes || '').trim(),
    at: Date.now()
  };
}


function applyUpdateInfo(info, source) {
  if (!info || !info.version) return false;
  updateState.version = info.version;
  updateState.url = info.url;
  updateState.mirror = info.mirror || '';
  updateState.page = info.page || UPDATE_RELEASES;
  updateState.notes = info.notes || '';
  updateState.source = source || '';
  updateState.at = info.at || Date.now();
  updateState.error = '';
  updateState.checked = true;
  updateState.newer = compareVersion(info.version, currentAppVersion()) > 0;
  saveUpdateState();
  syncUpdateUI();
  return updateState.newer;
}

/* first usable answer wins; the rest keep running but are ignored */
function firstUpdateInfo() {
  const tries = UPDATE_SOURCES.map(src => {
    const url = src.url + (src.url.indexOf('?') >= 0 ? '&' : '?') + 'd=' + UPDATE_STAMP;
    return fetchJSON(url, UPDATE_TIMEOUT_MS).then(data => {
      const info = (src.id === 'github') ? parseGithubRelease(data) : parseVersionFile(data);
      if (!info || !info.version) throw new Error('no version in ' + src.id);
      return { info: info, source: src.id };
    });
  });
  return new Promise((resolve, reject) => {
    let failed = 0, firstErr = null;
    tries.forEach(p => p.then(hit => resolve(hit), err => {
      if (!firstErr) firstErr = err;
      failed++;
      if (failed === tries.length) reject(firstErr || new Error('no update source answered'));
    }));
  });
}

/* manual === the user pressed the button: always asks, and reports failures */
function checkForUpdate(manual) {
  if (updateState.checking) return Promise.resolve(updateState);
  if (!manual && updateState.checked && (Date.now() - updateState.at) < UPDATE_CHECK_MS) {
    return Promise.resolve(updateState);
  }
  updateState.checking = true;
  syncUpdateUI();
  return firstUpdateInfo()
    .then(hit => { applyUpdateInfo(hit.info, hit.source); })
    .catch(err => {
      updateState.checked = true;
      updateState.at = Date.now();
      updateState.error = errText(err);
      if (manual) showToast('Could not reach the update servers - try again later', 'warn');
      syncUpdateUI();
    })
    .then(() => { updateState.checking = false; syncUpdateUI(); return updateState; });
}

function updateSourceLabel(id) {
  const map = {
    'github': 'GitHub', 'jsdelivr': 'jsDelivr', 'jsdelivr-fastly': 'jsDelivr (Fastly)',
    'jsdelivr-gcore': 'jsDelivr (Gcore)', 'raw': 'GitHub raw'
  };
  return map[id] || id || '';
}

function updateHintText() {
  const cur = currentAppVersion();
  if (updateState.checking) return 'Checking for the newest release...';
  if (updateState.version && updateState.newer) {
    return 'v' + updateState.version + ' is available - you have v' + cur + '.' +
      (updateState.notes ? ' ' + updateState.notes : '');
  }
  if (updateState.version) {
    return 'Up to date - v' + cur + ' is the newest release' +
      (updateState.source ? ' (checked via ' + updateSourceLabel(updateState.source) + ').' : '.');
  }
  if (updateState.checked && updateState.error) {
    return 'You have v' + cur + '. The update servers could not be reached (' +
      updateState.error + ') - open the releases page to check by hand.';
  }
  return 'You have v' + cur + '. Tap "Check for updates" to look for a newer release.';
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
  const mirror = $('#btnInstallMirror');
  if (mirror) {
    const show = !!(updateState.version && updateState.newer && updateState.mirror);
    mirror.hidden = !show;
    if (show) mirror.textContent = 'Mirror download';
  }
}

function updateDownloadUrl() {
  return updateState.url || UPDATE_RELEASES;
}
function updateMirrorUrl() {
  return updateState.mirror || '';
}
function startUpdateDownload(useMirror) {
  const url = (useMirror && updateMirrorUrl()) ? updateMirrorUrl() : updateDownloadUrl();
  if (NATIVE.isNative) {
    showToast(useMirror ? 'Downloading the mirror copy - tap the file to install'
                        : 'Downloading in your browser - tap the file to install', 'ok', 3600);
  }
  openExternalUrl(url);
}

function openUpdatePage() {
  openExternalUrl(updateState.page || UPDATE_RELEASES);
}

function initUpdateSheet() {
  const check = $('#btnCheckUpdate');
  if (check) check.addEventListener('click', () => checkForUpdate(true));
  const install = $('#btnInstallUpdate');
  if (install) install.addEventListener('click', () => startUpdateDownload(false));
  const mirror = $('#btnInstallMirror');
  if (mirror) mirror.addEventListener('click', () => startUpdateDownload(true));
  const page = $('#btnReleasePage');
  if (page) page.addEventListener('click', openUpdatePage);

  loadUpdateState();
  syncUpdateUI();
  /* No check on start-up: the sheet asks when it is opened (that is the moment
     the answer is useful), and the answer is then cached for a few hours so a
     second tap costs nothing. */
}
