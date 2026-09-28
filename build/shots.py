#!/usr/bin/env python3
"""Render stage screenshots of LexiCards (records list and quiz panel)."""
import os
import subprocess

BASE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(os.path.dirname(BASE), "index.html")
CHROME = ("/Users/wongty99/Library/Caches/ms-playwright/chromium_headless_shell-1217/"
          "chrome-headless-shell-mac-arm64/chrome-headless-shell")

SEED = """
var DEMO = [
  { term: 'serendipity', type: 'word', phonetic: '/\\u02ccser\\u0259n\\u02c8d\\u026ap\\u0259ti/',
    zh: ['\\u5076\\u7136\\u6027', '\\u610f\\u5916\\u767c\\u73fe\\u73cd\\u5947\\u4e8b\\u7269\\u7684\\u80fd\\u529b'],
    en: ['the occurrence of events by chance in a happy way'], tags: ['reading'] },
  { term: 'give up the ghost', type: 'phrase',
    zh: ['\\u653e\\u68c4\\uff0c\\u6b7b\\u5fc3', '\\uff08\\u6a5f\\u5668\\uff09\\u5fb9\\u5e95\\u58de\\u6389'],
    en: ['to die; to stop working completely'],
    stats: { seen: 12, correct: 9, wrong: 3, streak: 2, lastReviewedAt: Date.now() - 86400000 } },
  { term: "it's not that ..., it's just that ...", type: 'pattern',
    zh: ['\\u4e0d\\u662f\\u8aaa\\u2026\\u2026\\uff0c\\u53ea\\u662f\\u2026\\u2026'],
    en: ['used to soften a disagreement'], tags: ['speaking'] },
  { term: 'resilient', type: 'word', zh: ['\\u6709\\u97cc\\u6027\\u7684', '\\u9069\\u61c9\\u529b\\u5f37\\u7684'],
    en: ['able to recover quickly from difficulties'],
    stats: { seen: 5, correct: 4, wrong: 1 } }
];
function demoRecords() {
  DEMO.forEach(function (r) {
    var copy = JSON.parse(JSON.stringify(r));
    copy.source = 'manual';
    upsertRecord(copy);
  });
}
"""

PREP_RECORDS = SEED + """
window.addEventListener('load', function () {
  setTimeout(function () {
    demoRecords();
    setView('revision');
    setRevSub('records');
    refreshRecords();
  }, 200);
});
"""

PREP_QUIZ = SEED + """
window.addEventListener('load', function () {
  setTimeout(function () {
    demoRecords();
    state.records = state.records.filter(function (r) { return r.term === 'serendipity'; });
    saveRecords();
    setView('revision');
    setQuizScope('records');
    setRevSub('quiz');
    refreshQuizState();
  }, 200);
});
"""

# the answered state: a wrong pick, so the screenshot shows the red flash, the
# revealed correct option and the Next / Add buttons
PREP_QUIZ_DONE = SEED + """
window.addEventListener('load', function () {
  setTimeout(function () {
    demoRecords();
    state.records = state.records.filter(function (r) { return r.term === 'serendipity'; });
    saveRecords();
    setView('revision');
    setQuizScope('A2');
    setRevSub('quiz');
    refreshQuizState();
    var q = state.round.current;
    if (q) {
      for (var i = 0; i < q.options.length; i++) if (!q.options[i].correct) { answerQuiz(i); break; }
    }
  }, 200);
});
"""

PAGES = [
    ("records", PREP_RECORDS, "/tmp/shot-records.png"),
    ("quiz", PREP_QUIZ, "/tmp/shot-quiz.png"),
    ("quiz-answered", PREP_QUIZ_DONE, "/tmp/shot-quiz-answered.png"),
]



STUB = """<script>
/* screenshots only need the Records / Quiz screens: fail fast so nothing hangs */
window.fetch = function (url) {
  var u = String(url);
  if (u.indexOf('mymemory') >= 0) {
    return Promise.resolve(new Response(JSON.stringify({ responseData: { translatedText: '\\u4f60\\u597d' }, responseStatus: 200 }), { status: 200 }));
  }
  return Promise.reject(new TypeError('offline during screenshot'));
};
</script>
"""


def main():
    doc = open(APP, encoding="utf-8").read()
    for name, prep, shot in PAGES:
        page = "/tmp/lexicards-%s.html" % name
        out = doc.replace("<body>\n", "<body>\n" + STUB, 1)
        out = out.replace("</body>", "<script>\n" + prep + "\n</script>\n</body>", 1)
        with open(page, "w", encoding="utf-8") as fh:
            fh.write(out)
        cmd = [CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
               "--force-device-scale-factor=2", "--window-size=480,900",
               "--virtual-time-budget=8000", "--screenshot=" + shot, "file://" + page]
        subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        print(name, "->", shot, "ok" if os.path.exists(shot) else "FAILED")


if __name__ == "__main__":
    main()
