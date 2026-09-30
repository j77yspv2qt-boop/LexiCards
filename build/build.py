#!/usr/bin/env python3
"""Build the single-file LexiCards index.html from the parts inside build/."""
import os
import re
import subprocess

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(BASE), "index.html")

CSS = ["style1.css", "style2.css"]
JS = ["core.js", "core2.js",
      "data_cefr.js", "data_gloss.js", "data_examples.js", "data_extra.js",
      "seed.js", "seed2.js", "offline.js",
      "api.js", "api2.js",
      "cards.js", "cards2.js", "gesture.js", "gesture2.js", "dict.js",
      "records.js", "entry.js", "data.js", "quiz.js", "quiz2.js",
      "nav.js", "native.js", "update.js", "init.js"]

# The bundled vocabulary tables are large and arrive from the data pipeline;
# the app still builds without them (it just falls back to live API lookups).
OPTIONAL_JS = {"data_cefr.js", "data_gloss.js", "data_examples.js", "data_extra.js"}
missing_optional = [n for n in JS if n in OPTIONAL_JS and not os.path.exists(os.path.join(BASE, n))]
JS = [n for n in JS if n not in OPTIONAL_JS or os.path.exists(os.path.join(BASE, n))]


def read(name):
    with open(os.path.join(BASE, name), "r", encoding="utf-8") as fh:
        return fh.read()


head = read("head.html")
body = read("body.html")

doc = [head, "\n<style>\n"]
for name in CSS:
    doc.append(read(name))
    doc.append("\n")
doc.append("</style>\n</head>\n<body>\n")
doc.append(body)
doc.append("\n<script>\n")

js_parts = []
for name in JS:
    src = read(name)
    js_parts.append(src)
    doc.append(src)
    doc.append("\n")
doc.append("</script>\n</body>\n</html>\n")
doc = "".join(doc)

leftovers = [m for m in ("@@END-STYLE1@@", "@@END-STYLE2@@", "END-BODY") if m in doc]

with open(OUT, "w", encoding="utf-8") as fh:
    fh.write(doc)

js = "\n".join(js_parts)
js_path = os.path.join(BASE, "_combined.js")
with open(js_path, "w", encoding="utf-8") as fh:
    fh.write(js)

print("wrote %s (%d bytes, %d lines)" % (OUT, len(doc), doc.count("\n") + 1))
if leftovers:
    print("WARNING: leftover build markers:", leftovers)
if missing_optional:
    print("NOTE: bundled vocabulary tables absent:", missing_optional)


try:
    r = subprocess.run(["node", "--check", js_path], capture_output=True, text=True)
    print("node --check:", "OK" if r.returncode == 0 else "FAILED")
    if r.returncode:
        print(r.stderr[:3000])
except FileNotFoundError:
    print("node not found - skipped syntax check")

ids = set(re.findall(r'\bid="([^"]+)"', doc))
used = set(re.findall(r"\$\('#([A-Za-z0-9_-]+)'", js))
used |= set(re.findall(r"getElementById\('([A-Za-z0-9_-]+)'\)", js))
missing = sorted(used - ids)
print("html ids: %d | referenced in js: %d" % (len(ids), len(used)))
print("ids referenced but missing in html:", missing if missing else "none")

names = {}
dupes = []
for name in JS:
    src = read(name)
    for m in re.finditer(r"^(?:const|let|function)\s+([A-Za-z_$][\w$]*)", src, re.M):
        n = m.group(1)
        if n in names and n not in dupes:
            dupes.append(n)
        names[n] = name
print("duplicate top-level names:", dupes if dupes else "none")

unused = sorted(i for i in ids if i not in used and not i.startswith("view-"))
print("html ids never referenced by js:", unused if unused else "none")
