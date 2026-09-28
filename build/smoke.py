#!/usr/bin/env python3
"""Headless smoke test for LexiCards: runs the real app in Chromium and reports results."""
import html as htmlmod
import json
import os
import re
import subprocess
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(os.path.dirname(BASE), "index.html")
CHROME = ("/Users/wongty99/Library/Caches/ms-playwright/chromium_headless_shell-1217/"
          "chrome-headless-shell-mac-arm64/chrome-headless-shell")
TEST_HTML = "/tmp/lexicards-smoke.html"
SHOT = "/tmp/lexicards-shot.png"

PROBE = """<script>
window.__errs = [];
window.addEventListener('error', function (e) { window.__errs.push('error: ' + (e.message || e.type)); });
window.addEventListener('unhandledrejection', function (e) { window.__errs.push('rejection: ' + String(e.reason)); });

/* deterministic offline stand-in for the four real endpoints */
window.__fetchMode = 'ok';
window.__fetchLog = [];
window.__realFetch = window.fetch ? window.fetch.bind(window) : null;
window.fetch = function (url, opts) {
  var u = String(url);
  window.__fetchLog.push(u);
  function json(obj, ok) {
    return Promise.resolve(new Response(JSON.stringify(obj), {
      status: ok === false ? 500 : 200,
      headers: { 'Content-Type': 'application/json' }
    }));
  }
  var mode = window.__fetchMode;
  if (u.indexOf('api.dictionaryapi.dev') >= 0) {
    if (mode === 'ok') {
      return json([{ word: 'stub', phonetic: '/stub/', phonetics: [{ text: '/stub/', audio: 'https://example.com/hello.mp3' }],
        meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'a greeting', example: 'hello world' }, { definition: 'an utterance used to greet' }] }] }]);
    }
    if (mode === 'no-dict') return json({ title: 'No Definitions Found' }, false);
    return Promise.reject(new TypeError('Failed to fetch'));
  }
  if (u.indexOf('en.wiktionary.org') >= 0) {
    if (mode === 'all-fail') return Promise.reject(new TypeError('Failed to fetch'));
    return json({ en: [{ partOfSpeech: 'Interjection', definitions: [{ definition: 'A <a href="/wiki/greeting">greeting</a> said on meeting.' }] }] });
  }
  if (u.indexOf('api.datamuse.com') >= 0) {
    if (mode === 'all-fail') return Promise.reject(new TypeError('Failed to fetch'));
    return json([{ word: 'stub', defs: ['n\\ta greeting used on meeting'] }]);
  }
  if (u.indexOf('translate.googleapis.com') >= 0) {
    if (mode === 'all-fail' || mode === 'no-google') return Promise.reject(new TypeError('Failed to fetch'));
    return json([[['你好', 'stub', null, null, 3]], null, 'en']);
  }
  if (u.indexOf('mymemory.translated.net') >= 0) {
    if (mode === 'all-fail') return Promise.reject(new TypeError('Failed to fetch'));
    return json({ responseData: { translatedText: '你好', match: 0.9 }, responseStatus: 200, quotaFinished: false });
  }
  return window.__realFetch ? window.__realFetch(u, opts) : Promise.reject(new Error('blocked'));
};
</script>
"""


def read(name):
    with open(os.path.join(BASE, name), encoding="utf-8") as fh:
        return fh.read()


def build_test_page():
    doc = open(APP, encoding="utf-8").read()
    harness = read("smoke_a.js") + "\n" + read("smoke_b.js")
    doc = doc.replace("<body>\n", "<body>\n" + PROBE, 1)
    doc = doc.replace(
        "</body>",
        '<pre id="smoke-report">pending</pre>\n<script>\n(function () {\n' + harness + "\n})();\n</script>\n</body>",
        1,
    )
    with open(TEST_HTML, "w", encoding="utf-8") as fh:
        fh.write(doc)
    return TEST_HTML


def chrome(*args, url, timeout=60):
    cmd = [CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--dump-dom",
           "--hide-scrollbars", "--force-device-scale-factor=2",
           "--window-size=480,900", "--virtual-time-budget=12000"] + list(args) + [url]
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def main():
    if not os.path.exists(CHROME):
        print("chrome-headless-shell not found:", CHROME)
        return 2

    build_test_page()
    res = chrome(url="file://" + TEST_HTML)
    dom = res.stdout
    m = re.search(r'<pre id="smoke-report">(.*?)</pre>', dom, re.S)
    if not m:
        print("could not find the smoke report in the rendered DOM")
        print("stderr:", res.stderr[-1500:])
        return 2

    report = json.loads(htmlmod.unescape(m.group(1)))
    passed = sum(1 for s in report["steps"] if s["pass"])
    failed = [s for s in report["steps"] if not s["pass"]]
    for s in report["steps"]:
        print(("  PASS  " if s["pass"] else "  FAIL  ") + s["name"] + ("   [" + s["info"] + "]" if s["info"] else ""))
    print("\n%d/%d steps passed" % (passed, len(report["steps"])))
    if report["errors"]:
        print("console errors:", report["errors"])
    if failed:
        print("FAILURES:", [s["name"] for s in failed])

    shot = None
    try:
        shot = chrome("--screenshot=" + SHOT, url="file://" + APP, timeout=150)
        print("screenshot:", SHOT if os.path.exists(SHOT) else "FAILED " + (shot.stderr[-300:] if shot else ""))
    except subprocess.TimeoutExpired:
        # the live app talks to four APIs; a slow network must not fail the run
        print("screenshot: skipped (renderer timed out on the live network)")
    return 0 if report["ok"] else 1



if __name__ == "__main__":
    sys.exit(main())
