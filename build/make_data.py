#!/usr/bin/env python3
"""Build the bundled vocabulary tables that ship inside index.html.

Raw source datasets (kept outside git, in .lcdata/ or $LC_DATA_DIR):
  oxford_full.json      Oxford learner entries: word + CEFR level + example + IPA
  kolia_package.txt     A1-B2 word lists (secondary CEFR source)
  ecdict.csv            English-Chinese dictionary: translation + phonetic + exam tags
  eng_sentences.tsv.bz2 Tatoeba English sentences (natural example sentences)

Outputs (merged into the app by build.py):
  build/data_cefr.js    word -> CEFR level (A1..C1)
  build/data_gloss.js   term -> Chinese glosses + phonetic
  build/data_examples.js term -> example sentence containing the term
  build/data_extra.js   level -> extra words to grow the built-in deck

Needs `pip install opencc-python-reimplemented` (Traditional conversion) and the
raw datasets above; the four tables are optional at runtime - without them the
app simply falls back to live API lookups.

Run:  python3 build/make_data.py
"""
import bz2
import csv
import io
import json
import os
import re
import sys

BUILD = os.path.dirname(os.path.abspath(__file__))

# Raw source datasets live outside git (see README).  Point LC_DATA_DIR at
# another folder to keep them somewhere else.
SRC = os.environ.get("LC_DATA_DIR") or os.path.join(os.path.dirname(BUILD), ".lcdata")
if not os.path.isdir(SRC):
    os.makedirs(SRC, exist_ok=True)

SEED = os.path.join(BUILD, "seed.js")
REPORT = os.path.join(SRC, "DATA_REPORT.md")

LEVELS = ["A1", "A2", "B1", "B2"]
ALL_LEVELS = ["A1", "A2", "B1", "B2", "C1"]
LEVEL_ORDER = {lv: i for i, lv in enumerate(ALL_LEVELS)}
SENT_CHARS = re.compile(r"^[A-Za-z ,.'\"!?()-]+$")
WORD_CHARS = re.compile(r"^[a-z]+$")

# The app shows Traditional Chinese by default, so the bundled table is stored
# in that script.  OpenCC does the conversion at build time (and the app keeps a
# full character map for anything the user types or the APIs return).
try:
    import opencc as _opencc
    OPENCC = _opencc.OpenCC('s2t')
except Exception:                                   # build still works without it
    OPENCC = None



def log(msg):
    print(msg, flush=True)


# ---------------------------------------------------------------- deck terms
def parse_seed():
    """Read SEED_WORDS / SEED_PHRASES / SEED_PATTERNS straight from seed.js."""
    src = io.open(SEED, encoding="utf-8").read()
    words_block = re.search(r"const SEED_WORDS\s*=\s*\{(.*?)\n\};", src, re.S).group(1)
    buckets = {}
    for name in ("core", "intermediate", "advanced"):
        m = re.search(name + r":\s*\((.*?)\)", words_block, re.S)
        if not m:
            raise SystemExit("SEED_WORDS." + name + " not found")
        text = re.sub(r"'\s*\+\s*'", "", m.group(1))       # join string concatenation
        buckets[name] = re.sub(r"[\"']", "", text).split()
    phrases = parse_js_string_array(re.search(r"const SEED_PHRASES\s*=\s*(\[.*?\]);", src, re.S).group(1))
    patterns = parse_js_string_array(re.search(r"const SEED_PATTERNS\s*=\s*(\[.*?\]);", src, re.S).group(1))
    return buckets, phrases, patterns


def parse_js_string_array(text):
    """SEED_PHRASES / SEED_PATTERNS are JS arrays with mixed quote styles."""
    out = []
    for m in re.finditer(r"'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\"", text):
        s = m.group(1) if m.group(1) is not None else m.group(2)
        out.append(s.replace("\\'", "'").replace('\\"', '"'))
    if not out:
        raise SystemExit("could not parse a JS string array")
    return out



# ------------------------------------------------------------------- CEFR map
def load_cefr(deck_words):
    """word -> A1..C1.  Sources merged, conflicts resolved in favour of the
    LOWER level (a word you know at A1 should show up in the A1 filter)."""
    cefr = {}

    def put(word, level, source):
        w = word.strip().lower()
        if not w or level not in ALL_LEVELS:
            return
        cur = cefr.get(w)
        if cur is None or LEVEL_ORDER[level] < LEVEL_ORDER[cur]:
            cefr[w] = level
            if source:
                pass

    path = os.path.join(SRC, "oxford_full.json")
    data = json.load(io.open(path, encoding="utf-8"))
    oxford_words = set()
    for entry in data:
        v = entry.get("value") or {}
        w = (v.get("word") or "").strip().lower()
        if not w:
            continue
        oxford_words.add(w)
        lv = (v.get("level") or "").strip()
        if lv in ALL_LEVELS:
            put(w, lv, "oxford")
    log("cefr: oxford_full entries=%d" % len(data))

    path = os.path.join(SRC, "kolia_package.txt")
    kolia = json.load(io.open(path, encoding="utf-8"))
    for lv, words in kolia.items():
        for w in words:
            put(w, lv.upper(), "kolia")
    log("cefr: after oxford+kolia = %d" % len(cefr))

    # exam tags from ECDICT, only for deck words that are still untagged
    tag_map = [("gk", "A1"), ("zk", "A1"), ("cet4", "A2"), ("cet6", "B1"),
               ("ky", "B1"), ("ielts", "B2"), ("toefl", "B2"), ("gre", "B2")]
    need = {w for w in deck_words if w not in cefr}
    rows = load_ecdict(need)
    for w, row in rows.items():
        tags = (row.get("tag") or "").lower()
        for key, lv in tag_map:
            if key in tags:
                put(w, lv, "ecdict")
                break
    log("cefr: final = %d (deck covered %d/%d)" %
        (len(cefr), sum(1 for w in deck_words if w in cefr), len(deck_words)))
    return cefr, oxford_words


# ------------------------------------------------------------------- ECDICT
def load_ecdict(need):
    """word -> row.  Streamed; only the words we actually asked for."""
    out = {}
    path = os.path.join(SRC, "ecdict.csv")
    with io.open(path, encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            w = (row.get("word") or "").strip().lower()
            if w in need and w not in out:
                out[w] = row
    return out


BAD_PHON = re.compile(r"[ѣ]")
PHON_OK = re.compile(r"^[A-Za-zəɪæɑɒɜɔʌʊeɛuːiːoːaːˈˌ .()+:'-]+$")


def clean_phon(s):
    s = (s or "").strip()
    if s.startswith("/") and s.endswith("/") and len(s) > 2:
        s = s[1:-1]
    if not s or len(s) > 40 or BAD_PHON.search(s):
        return ""
    if not PHON_OK.match(s):
        return ""
    return s


POS_LINE = re.compile(r"^([a-z]+)\.\s*(.+)$")
DOMAIN_TAG = re.compile(r"^\[[^\]]{1,8}\]\s*")
HAS_CJK = re.compile(r"[一-鿿]")


def clean_senses(translation, max_body=18, max_n=3):
    """ECdict keeps senses as '\\n' separated lines like 'vt. 放弃, 抛弃'.
    Split them into short individual glosses: POS-prefixed, Chinese only, and
    never longer than the quiz option they end up in."""
    out = []
    for raw in (translation or "").split("\\n"):
        line = raw.strip()
        if not line:
            continue
        line = DOMAIN_TAG.sub("", line).strip()      # [医] / [计] / [经] tag
        if not line or line[0] in "〔【":
            continue
        m = POS_LINE.match(line)
        pos = (m.group(1) + ". ") if m else ""
        body = (m.group(2) if m else line).strip().rstrip("。.;，, ；")
        for part in re.split(r"[、,，/]", body):
            part = part.strip().strip("（）()")
            if not part or "(" in part or ")" in part:
                continue                            # parenthetical notes
            if len(part) > max_body:
                continue
            if not HAS_CJK.search(part):
                continue                            # must be Chinese
            sense = pos + part
            if sense not in out:
                out.append(sense)
            if len(out) >= max_n:
                return out
    return out



def to_traditional(senses):
    """Store the glosses in the script the app opens with."""
    if OPENCC is None:
        return senses
    return [OPENCC.convert(s) for s in senses]


# ------------------------------------------------------- Oxford (level/IPA/EN)
def contains_term(sentence, term):
    s = sentence.lower()
    t = term.lower()
    if not t:
        return False
    if " " in t or "-" in t:
        return t in s
    idx = 0
    while True:
        at = s.find(t, idx)
        if at < 0:
            return False
        before = s[at - 1] if at > 0 else " "
        after = s[at + len(t)] if at + len(t) < len(s) else " "
        if not before.isalpha() and not after.isalpha():
            return True
        idx = at + 1


def sentence_shape(s, min_words=4, max_words=14):
    """Structural checks every example must pass, independent of the term."""
    s = s.strip()
    if len(s) < 14 or len(s) > 115:
        return False
    if not SENT_CHARS.match(s):
        return False
    if not s.endswith((".", "!", "?")):
        return False
    words = s.split()
    return min_words <= len(words) <= max_words


def sentence_ok(s, term):
    if not sentence_shape(s):
        return False
    return contains_term(s, term)


def fragments(term):
    """Literal pieces of a pattern like 'the more ..., the more ...' - the
    corpus will never contain the dots, but it does contain the pieces."""
    parts = [p.strip().lower() for p in re.split(r"\.\.\.|\…|\.\s*$", term)]
    return [p for p in parts if len(p) >= 3]


def pattern_ok(s, term):
    if not sentence_shape(s):
        return False
    frs = fragments(term)
    if not frs:
        return False
    low = s.lower()
    return all(f in low for f in frs)



def load_oxford():
    """word -> {level, phon, examples} merged over duplicate entries."""
    data = json.load(io.open(os.path.join(SRC, "oxford_full.json"), encoding="utf-8"))
    best = {}
    for entry in data:
        v = entry.get("value") or {}
        w = (v.get("word") or "").strip().lower()
        if not w:
            continue
        rec = best.setdefault(w, {"level": "", "phon": "", "examples": []})
        lv = (v.get("level") or "").strip()
        if lv in ALL_LEVELS and (not rec["level"] or LEVEL_ORDER[lv] < LEVEL_ORDER[rec["level"]]):
            rec["level"] = lv
        if not rec["phon"]:
            ph = v.get("phonetics") or {}
            rec["phon"] = clean_phon(ph.get("us") or ph.get("uk") or "")
        for ex in (v.get("examples") or [])[:4]:
            if isinstance(ex, str) and sentence_ok(ex, w) and ex not in rec["examples"]:
                rec["examples"].append(ex)
    return best


# ----------------------------------------------------------- Tatoeba examples
def load_tatoeba(needed_words, phrases, patterns, max_cand=30):
    """Stream the corpus once, keeping a few clean candidate sentences per
    word.  Phrases are indexed by their first word; patterns (which contain
    '...') are indexed by the first word of their first literal fragment."""
    cands = {}
    phrase_first = {}
    frag_first = {}
    for p in phrases:
        phrase_first.setdefault(p.split()[0].lower(), []).append(p)
    for p in patterns:
        frs = fragments(p)
        if frs:
            frag_first.setdefault(frs[0].split()[0], []).append(p)
    hits = {}
    path = os.path.join(SRC, "eng_sentences.tsv.bz2")
    with bz2.open(path, "rt", encoding="utf-8") as fh:
        for line in fh:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 3 or parts[1] != "eng":
                continue
            s = parts[2].strip()
            if not s or len(s) > 120 or not SENT_CHARS.match(s):
                continue
            if not s.endswith((".", "!", "?")):
                continue
            words = s.split()
            if not (4 <= len(words) <= 14):
                continue
            low = s.lower()
            low_words = [w.lower() for w in words]
            for w in set(x for x in low_words if len(x) > 1):
                if w in needed_words:
                    lst = cands.get(w)
                    if lst is None:
                        cands[w] = [s]
                    elif len(lst) < max_cand:
                        lst.append(s)
            for fw in set(low_words):
                for p in phrase_first.get(fw, ()):
                    if p in low:
                        lst = hits.get(p)
                        if lst is None:
                            hits[p] = [s]
                        elif len(lst) < max_cand:
                            lst.append(s)
                for p in frag_first.get(fw, ()):
                    if all(f in low for f in fragments(p)):
                        lst = hits.get(p)
                        if lst is None:
                            hits[p] = [s]
                        elif len(lst) < max_cand:
                            lst.append(s)
    for p, lst in hits.items():
        cands.setdefault(p, [])
        cands[p].extend(lst)
    log("tatoeba: candidate terms=%d" % len(cands))
    return cands


def pick_examples(terms, word_cands, oxford, oks=None):
    """One sentence per term: close to eight words, the term not sitting in
    first position, and no sentence doing duty for more than three terms.
    `oks` are progressively looser matchers - the first that yields a
    candidate wins, so a term is only left without an example as a last
    resort."""
    matchers = oks or [sentence_ok]
    used = {}
    out = {}

    def score(term, s):
        words = s.split()
        v = abs(len(words) - 8)
        if words and words[0].lower().startswith(term[:4].lower()):
            v += 4
        if s.endswith("!") or s.endswith("?"):
            v += 1
        return v

    for term in sorted(terms):
        raw = list(word_cands.get(term, ()))
        if not raw and " " not in term:
            raw = list((oxford.get(term) or {}).get("examples", ()))
        pool = []
        for ok in matchers:
            pool = [s for s in raw if ok(s, term)]
            if pool:
                break
        if not pool:
            continue
        pool.sort(key=lambda s: score(term, s))
        for s in pool:
            if used.get(s, 0) >= 3:
                continue
            out[term] = s
            used[s] = used.get(s, 0) + 1
            break
    return out


# --------------------------------------------- fallbacks and new vocabulary
def relaxed_word_ok(s, term):
    """Last resort for a term with no tidy sentence: allow a longer one."""
    return sentence_shape(s, 3, 16) and contains_term(s, term)


def relaxed_phrase_ok(s, term):
    return sentence_shape(s, 3, 16) and term.lower() in s.lower()


def relaxed_pattern_ok(s, term):
    frs = fragments(term)
    low = s.lower()
    return sentence_shape(s, 3, 16) and bool(frs) and all(f in low for f in frs)


TAG_LEVELS = [("gk", "A1"), ("zk", "A1"), ("cet4", "A2"), ("cet6", "B1"),
              ("ky", "B1"), ("ielts", "B2"), ("toefl", "B2"), ("gre", "B2")]


def find_extras(deck_set, cefr, per_level=400, max_frq=30000):
    """Second pass over ECDICT: useful single words the deck does not have
    yet, levelled from the CEFR tables or from the exam tags, most frequent
    first.  Proper nouns and grammar-only entries are skipped - they make
    poor flashcards."""
    cands = {lv: [] for lv in LEVELS}
    path = os.path.join(SRC, "ecdict.csv")
    with io.open(path, encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            raw = (row.get("word") or "").strip()
            w = raw.lower()
            if not raw or raw[0].isupper():
                continue                        # proper noun or acronym
            if w in deck_set or not WORD_CHARS.match(w) or not (3 <= len(w) <= 12):
                continue
            lv = cefr.get(w, "")
            if lv not in LEVELS:
                tags = (row.get("tag") or "").lower()
                lv = ""
                for key, lv_tag in TAG_LEVELS:
                    if key in tags:
                        lv = lv_tag
                        break
                if lv not in LEVELS:
                    continue
            try:
                frq = int(row.get("frq") or 999999)
            except ValueError:
                frq = 999999
            if frq > max_frq:
                continue
            senses = clean_senses(row.get("translation"))
            if not senses:
                continue
            # a real word has at least one part-of-speech gloss ("n. ", "v. ")
            lines = (row.get("translation") or "").split("\\n")
            if not any(POS_LINE.match(ln.strip()) for ln in lines[:3]):
                continue
            cands[lv].append((frq, w, row))

    out = {}
    rows = {}
    for lv in LEVELS:
        seen = set()
        ranked = []
        for frq, w, row in sorted(cands[lv]):
            if w in seen:
                continue
            seen.add(w)
            ranked.append(w)
            rows[w] = row
            if len(ranked) >= per_level:
                break
        out[lv] = ranked
    log("extras candidates: " + ", ".join("%s=%d" % (lv, len(out[lv])) for lv in LEVELS))
    return out, rows



TR_CACHE_PATH = os.path.join(SRC, "tr_cache.json")


def google_translate(text, cache):
    """Build-time gloss for the entries ECDICT does not know.  One cached
    request per phrase; a second engine covers the occasional 429."""
    if cache.get(text):
        return cache[text]
    import time
    import urllib.error
    import urllib.parse
    import urllib.request
    zh = ""

    def get(url):
        with urllib.request.urlopen(url, timeout=12) as resp:
            return json.loads(resp.read().decode("utf-8"))

    try:
        data = get("https://translate.googleapis.com/translate_a/single?client=gtx"
                   "&sl=en&tl=zh-CN&dt=t&q=" + urllib.parse.quote(text))
        zh = "".join(p[0] for p in (data[0] or []) if p and p[0]).strip()
    except Exception as exc:                     # offline build still works
        log("gtx failed for %r: %s" % (text[:40], exc))
    if not zh:
        try:
            data = get("https://api.mymemory.translated.net/get?langpair=en|zh-CN&q="
                       + urllib.parse.quote(text))
            zh = ((data.get("responseData") or {}).get("translatedText") or "").strip()
        except Exception as exc:
            log("mymemory failed for %r: %s" % (text[:40], exc))
    cache[text] = zh
    try:
        io.open(TR_CACHE_PATH, "w", encoding="utf-8").write(
            json.dumps(cache, ensure_ascii=False, indent=0))
    except Exception:
        pass
    time.sleep(0.35)
    return zh



def gloss_from_translation(zh):
    """Turn a machine translation into the same short POS-less gloss shape
    the bundled table uses."""
    zh = (zh or "").strip().rstrip("。.!！？?")
    if not zh or not HAS_CJK.search(zh):
        return []
    parts = [p.strip() for p in re.split(r"[、,，;；]", zh) if p.strip()]
    out = []
    for p in parts:
        if p and HAS_CJK.search(p) and len(p) <= 18 and p not in out:
            out.append(p)
        if len(out) >= 3:
            break
    return out


# Hand-written examples for the handful of entries neither the corpus nor the
# dictionary covers.  Written to the same shape as the rest of the table:
# natural English, 4-12 words, the term sitting inside the sentence.
HAND_EXAMPLES = {
    "benchmark": "The new factory set a benchmark for energy efficiency.",
    "capitulate": "After hours of negotiation, the team refused to capitulate.",
    "contender": "She is a strong contender for the national title.",
    "delineate": "Please delineate the steps of the process clearly.",
    "ephemeral": "Fame in the world of fashion is often ephemeral.",
    "equivocal": "The minister gave an equivocal answer to the question.",
    "grandparent": "My grandparent tells me stories about the old town.",
    "qualification": "You need this qualification to apply for the job.",
    "regulator": "The regulator fined the company for unsafe practices.",
    "spokeswoman": "The spokeswoman refused to comment on the case.",
    "sublist": "Each sublist must be sorted before the merge step.",
    "tonne": "The crate weighs half a tonne.",
    "ahead of the curve": "Cutting-edge firms like to stay ahead of the curve.",
    "give up the ghost": "It is time to give up the ghost and buy a new car.",
    "weather the storm": "The whole team worked together to weather the storm.",
    "it's not that ..., it's just that ...":
        "It's not that I mind the work, it's just that I need a break.",
    "that being said, ...": "That being said, we should check the numbers once.",
}

# Glosses the dictionary and the machine translation both could not supply.
HAND_GLOSS = {
    "dvd": ["數位光碟"],
    "yours": ["你的"],
    "ahead of the curve": ["走在時代尖端", "超前於潮流"],
}






# --------------------------------------------------------------------- emit
def emit(path, decl, obj):
    text = "const %s = %s;\n" % (decl, json.dumps(obj, ensure_ascii=False,
                                                   separators=(",", ":"), sort_keys=True))
    text = text.replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    io.open(path, "w", encoding="utf-8").write(text)
    return len(text.encode("utf-8"))


def main():
    buckets, phrases, patterns = parse_seed()
    deck_words = sorted({w.lower() for lst in buckets.values() for w in lst})
    log("deck: words=%d phrases=%d patterns=%d" % (len(deck_words), len(phrases), len(patterns)))

    oxford = load_oxford()
    log("oxford entries merged: %d" % len(oxford))
    cefr, oxford_words = load_cefr(deck_words)

    # --- new words to add to the deck (ECdict, levelled) --------------------
    deck_set = set(deck_words)
    extras_cand, extras_rows = find_extras(deck_set, cefr)
    for lv in LEVELS:
        for w in extras_cand[lv]:
            cefr.setdefault(w, lv)

    wanted = set(deck_words) | set(phrases)
    ec = load_ecdict(wanted)
    ec.update(extras_rows)
    log("ecdict rows matched: %d / wanted %d" % (len(ec), len(wanted)))

    cand_words = [w for lv in LEVELS for w in extras_cand[lv]]
    word_cands = load_tatoeba(set(deck_words) | set(phrases) | set(cand_words),
                               phrases, patterns)

    word_ok = [sentence_ok, relaxed_word_ok]
    ph_ok = [sentence_ok, relaxed_phrase_ok]
    pt_ok = [pattern_ok, relaxed_pattern_ok]

    examples = pick_examples(set(deck_words), word_cands, oxford, word_ok)
    examples.update(pick_examples(set(cand_words), word_cands, oxford, word_ok))
    examples.update(pick_examples(set(phrases), word_cands, oxford, ph_ok))
    examples.update(pick_examples(set(patterns), word_cands, oxford, pt_ok))

    # Oxford's own sentences fill whatever the corpus missed
    def backfill(terms, ok):
        for t in terms:
            if t in examples:
                continue
            for ex in (oxford.get(t) or {}).get("examples", ()):
                if ok(ex, t):
                    examples[t] = ex
                    break

    backfill(list(deck_words) + cand_words, sentence_ok)
    backfill(list(phrases), sentence_ok)
    backfill(list(patterns), pattern_ok)

    # the handful of entries nothing else covered have written-by-hand ones
    for t, s in HAND_EXAMPLES.items():
        if t in examples:
            continue
        ok = pattern_ok if "..." in t else sentence_ok
        if ok(s, t):
            examples[t] = s



    ph_all = list(phrases) + list(patterns)
    log("examples: words=%d/%d  phrases+patterns=%d/%d" % (
        sum(1 for w in deck_words if w in examples), len(deck_words),
        sum(1 for t in ph_all if t in examples), len(ph_all)))

    # --- only keep extras that ship with both a gloss and an example --------
    TARGET_EXTRA = 170
    extras = {}
    for lv in LEVELS:
        keep = []
        for w in extras_cand[lv]:
            if w in examples and clean_senses((ec.get(w) or {}).get("translation")):
                keep.append(w)
            if len(keep) >= TARGET_EXTRA:
                break
        extras[lv] = keep
    log("extras kept: " + ", ".join("%s=%d" % (lv, len(extras[lv])) for lv in LEVELS))

    all_extra_words = [w for lv in LEVELS for w in extras[lv]]

    # --- glosses (Simplified Chinese + IPA) --------------------------------
    gloss = {}
    for w in list(deck_words) + all_extra_words + ph_all:
        row = ec.get(w)
        senses = to_traditional(clean_senses(row.get("translation") if row else ""))
        phon = (oxford.get(w) or {}).get("phon", "")
        if not phon and row:
            phon = clean_phon(row.get("phonetic") or "")
        rec = {}
        if senses:
            rec["z"] = senses
        if phon:
            rec["p"] = phon
        if rec:
            gloss[w] = rec

    # idioms ECDICT does not carry get one cached machine-translated gloss,
    # so every phrase and pattern still has Chinese meaning offline
    tr_cache = {}
    if os.path.exists(TR_CACHE_PATH):
        try:
            tr_cache = json.load(io.open(TR_CACHE_PATH, encoding="utf-8"))
        except Exception:
            tr_cache = {}
    filled = 0
    for t in ph_all + [w for w in deck_words if not gloss.get(w, {}).get("z")]:
        if gloss.get(t, {}).get("z"):
            continue
        senses = to_traditional(gloss_from_translation(google_translate(t, tr_cache)))
        if senses:
            gloss[t] = {"z": senses}
            filled += 1
    for t, senses in HAND_GLOSS.items():
        if not gloss.get(t, {}).get("z"):
            gloss[t] = {"z": senses}
            filled += 1
    log("machine-translated and hand-written glosses added: %d" % filled)


    log("gloss: words=%d/%d  phrases+patterns=%d/%d  total=%d" % (
        sum(1 for w in deck_words if gloss.get(w, {}).get("z")), len(deck_words),
        sum(1 for t in ph_all if gloss.get(t, {}).get("z")), len(ph_all), len(gloss)))

    # --- write the four tables --------------------------------------------
    cefr_out = {w: cefr[w] for w in sorted(cefr)}
    sizes = {
        "data_cefr.js": emit(os.path.join(BUILD, "data_cefr.js"), "CEFR", cefr_out),
        "data_gloss.js": emit(os.path.join(BUILD, "data_gloss.js"), "GLOSS", gloss),
        "data_examples.js": emit(os.path.join(BUILD, "data_examples.js"), "EXAMPLES", examples),
        "data_extra.js": emit(os.path.join(BUILD, "data_extra.js"), "EXTRA_WORDS", extras),
    }

    # --- report ------------------------------------------------------------
    dist = {}
    for w in deck_words:
        lv = cefr.get(w, "untagged")
        dist[lv] = dist.get(lv, 0) + 1
    miss_ex = [w for w in deck_words if w not in examples]
    miss_gl = [w for w in deck_words if not gloss.get(w, {}).get("z")]
    io.open(os.path.join(SRC, "example_missing.txt"), "w", encoding="utf-8").write("\n".join(miss_ex))
    io.open(os.path.join(SRC, "gloss_missing.txt"), "w", encoding="utf-8").write("\n".join(miss_gl))

    import random
    random.seed(7)
    lines = [
        "# LexiCards bundled vocabulary report", "",
        "## Sources",
        "- oxford_full.json: Oxford learner entries (word, CEFR level, IPA, examples) - 5948 rows",
        "- kolia_package.txt: A1-B2 word lists - %s" %
        ", ".join("%s=%d" % (k, len(v)) for k, v in
                  json.load(io.open(os.path.join(SRC, "kolia_package.txt"), encoding="utf-8")).items()),
        "- ecdict.csv: English-Chinese dictionary (translation, phonetic, exam tags) - 770612 rows",
        "- eng_sentences.tsv.bz2: Tatoeba English example sentences", "",
        "## Output sizes",
    ]
    lines += ["- %s: %.1f KB" % (k, v / 1024.0) for k, v in sizes.items()]
    lines += [
        "", "## Coverage",
        "- deck words: %d" % len(deck_words),
        "- CEFR tagged: %s" % ", ".join("%s=%d" % (k, dist.get(k, 0)) for k in sorted(dist)),
        "- gloss for deck words: %d/%d" %
        (sum(1 for w in deck_words if gloss.get(w, {}).get("z")), len(deck_words)),
        "- example for deck words: %d/%d" % (sum(1 for w in deck_words if w in examples), len(deck_words)),
        "- gloss for phrases+patterns: %d/%d" %
        (sum(1 for t in ph_all if gloss.get(t, {}).get("z")), len(ph_all)),
        "- example for phrases+patterns: %d/%d" % (sum(1 for t in ph_all if t in examples), len(ph_all)),
        "- extras: %s" % ", ".join("%s=%d" % (lv, len(extras[lv])) for lv in LEVELS),
        "- missing examples (deck): %d -> %s" % (len(miss_ex), os.path.join(SRC, "example_missing.txt")),
        "- missing glosses (deck): %d -> %s" % (len(miss_gl), os.path.join(SRC, "gloss_missing.txt")),
        "", "## Samples",
    ]
    for w in random.sample(deck_words, 8):
        lines.append("- %s [%s] %s | %s | %s" % (w, cefr.get(w, "?"),
                     (gloss.get(w) or {}).get("z"), (gloss.get(w) or {}).get("p"), examples.get(w)))
    for w in all_extra_words[:4]:
        lines.append("- extra %s [%s] %s | %s" %
                     (w, cefr.get(w, "?"), (gloss.get(w) or {}).get("z"), examples.get(w)))
    report = "\n".join(lines)
    io.open(REPORT, "w", encoding="utf-8").write(report + "\n")
    log("")
    log(report)
    log("WROTE " + ", ".join("%s (%.0f KB)" % (k, v / 1024.0) for k, v in sizes.items()))


if __name__ == "__main__":
    main()




