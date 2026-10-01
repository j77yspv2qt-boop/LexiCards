#!/usr/bin/env python3
"""Turn the master Gothic artwork into every asset the skin needs.

The artwork arrives as black-backed renders of silver chrome - every piece is
either an illustration that has to sit ON a dark surface (the four page icons,
the wordmark, the app-bar decoration) or the launcher tile itself.  For the
first group the black backdrop is turned into transparency so the mark floats,
and the page icons and the wordmark are driven onto the grey axis so they sit
in the monochrome chrome whatever colour a render came in (the app-bar deco
keeps its colour: that red is the art's accent, and the skin allows one).  For
the launcher the tile is kept, and a cut-out copy is centred on a transparent
canvas to make the adaptive icon's foreground.

The Android chrome - the window behind the WebView, the two system bars, the
splash gradient and the icon tile - is painted before any of the app has run,
so its colours are read out of the skin's own table in build/skin.js (see
skin_token) rather than written a second time here.

Outputs
  out/*.png                  the in-app images (also committed, so the skin can
                             be inspected without running this script)
  ../skin_gothic.js          the same images as data: URIs, which is what
                             build.py folds into index.html
  ../../android/res/...      the Android launcher, splash and theme resources

Run from anywhere:  python3 build/skins/gothic/make.py
"""
import base64
import os
import re
import struct
import sys
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(HERE, "source")
OUT = os.path.join(HERE, "out")
BUILD = os.path.dirname(os.path.dirname(HERE))             # .../build
ANDROID = os.path.join(os.path.dirname(BUILD), "android")  # .../android

def skin_token(name, fallback):
    """One colour out of the skin's own table in build/skin.js.

    The Android chrome - the window behind the WebView, the two system bars and
    the splash gradient - is painted before any JavaScript runs, so it cannot be
    driven by CSS variables.  Reading the values from the skin table instead of
    repeating them here is what stops the launch colours and the running app
    from drifting apart."""
    path = os.path.join(BUILD, "skin.js")
    if os.path.exists(path):
        src = open(path, "r", encoding="utf-8").read()
        found = re.search(r"'%s':\s*'(#[0-9A-Fa-f]{6})'" % re.escape(name), src)
        if found:
            return found.group(1)
    return fallback


# the Android chrome colours, read from the skin table (see skin_token)
ICON_BACKGROUND = skin_token('--hot-a', '#0B0B0C')   # the launcher tile stays black
SPLASH_FROM = skin_token('--page-top', '#141416')
SPLASH_TO = skin_token('--page-bottom', '#000000')
WINDOW_BG = skin_token('--bg', '#0B0B0C')
STATUS_BAR = skin_token('--appbar-from', '#000000')
NAV_BAR = skin_token('--tabbar-bg', '#0B0B0C')

# the density buckets the launcher icon needs (name, scale)
DENSITIES = [("mdpi", 1), ("hdpi", 1.5), ("xhdpi", 2), ("xxhdpi", 3), ("xxxhdpi", 4)]
LAUNCHER_DP = 48
FOREGROUND_DP = 108
FOREGROUND_ART = 0.62        # how much of the 108dp canvas the mark fills
SPLASH_DP = 96

# the four page icons: square full-bleed artwork, black backdrop dropped
PAGE_ICONS = [("discover", 128), ("mine", 128), ("records", 128), ("quiz", 128)]


# --------------------------------------------------------------------------
# a tiny PNG codec - no Pillow on this machine, and the artwork is plain 8-bit
# RGBA, so the helpers from android/icons/make_icons.py were the cheapest way in
# --------------------------------------------------------------------------
def read_png(path):
    data = open(path, "rb").read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG: " + path)
    pos, idat, width, height, depth, ctype = 8, b"", 0, 0, 8, 6
    while pos < len(data):
        (ln,) = struct.unpack(">I", data[pos:pos + 4])
        typ = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + ln]
        pos += 12 + ln
        if typ == b"IHDR":
            width, height, depth, ctype = struct.unpack(">IIBB", chunk[:10])
        elif typ == b"IDAT":
            idat += chunk
        elif typ == b"IEND":
            break
    if depth != 8:
        raise ValueError("only 8-bit PNGs are supported: " + path)
    channels = {0: 1, 2: 3, 4: 2, 6: 4}[ctype]
    raw = zlib.decompress(idat)
    stride = width * channels
    rows, prev, i = [], bytearray(stride), 0
    for _ in range(height):
        filt = raw[i]
        i += 1
        line = bytearray(raw[i:i + stride])
        i += stride
        if filt:
            for x in range(stride):
                a = line[x - channels] if x >= channels else 0
                b = prev[x]
                c = prev[x - channels] if x >= channels else 0
                if filt == 1:
                    line[x] = (line[x] + a) & 255
                elif filt == 2:
                    line[x] = (line[x] + b) & 255
                elif filt == 3:
                    line[x] = (line[x] + (a + b) // 2) & 255
                elif filt == 4:
                    p = a + b - c
                    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                    pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                    line[x] = (line[x] + pr) & 255
        rows.append(line)
        prev = line
    out = []
    for row in rows:
        px = bytearray(width * 4)
        for x in range(width):
            o = x * channels
            if channels == 1:
                px[x * 4:x * 4 + 4] = bytes((row[o], row[o], row[o], 255))
            elif channels == 2:
                px[x * 4:x * 4 + 4] = bytes((row[o], row[o], row[o], row[o + 1]))
            elif channels == 3:
                px[x * 4:x * 4 + 4] = bytes((row[o], row[o + 1], row[o + 2], 255))
            else:
                px[x * 4:x * 4 + 4] = bytes((row[o], row[o + 1], row[o + 2], row[o + 3]))
        out.append(px)
    return width, height, out


def write_png(path, width, height, rows):
    raw = bytearray()
    for row in rows:
        raw += b"\x00" + bytes(row)

    def chunk(tag, payload):
        return (struct.pack(">I", len(payload)) + tag + payload +
                struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF))

    png = (b"\x89PNG\r\n\x1a\n" +
           chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)) +
           chunk(b"IDAT", zlib.compress(bytes(raw), 9)) +
           chunk(b"IEND", b""))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(png)

def resize(width, height, rows, nw, nh):
    """Box-average downscale, weighted by alpha so transparent black never
    bleeds into the silver edges."""
    out = []
    for ny in range(nh):
        y0 = ny * height / float(nh)
        y1 = (ny + 1) * height / float(nh)
        sy, ey = int(y0), max(int(y1), int(y0) + 1)
        line = bytearray(nw * 4)
        for nx in range(nw):
            x0 = nx * width / float(nw)
            x1 = (nx + 1) * width / float(nw)
            sx, ex = int(x0), max(int(x1), int(x0) + 1)
            r = g = b = a = n = 0
            for yy in range(sy, min(ey, height)):
                row = rows[yy]
                for xx in range(sx, min(ex, width)):
                    o = xx * 4
                    pa = row[o + 3]
                    r += row[o] * pa
                    g += row[o + 1] * pa
                    b += row[o + 2] * pa
                    a += pa
                    n += 1
            o = nx * 4
            if a and n:
                line[o] = min(255, int(r / a + 0.5))
                line[o + 1] = min(255, int(g / a + 0.5))
                line[o + 2] = min(255, int(b / a + 0.5))
                line[o + 3] = min(255, int(a / n + 0.5))
        out.append(line)
    return out


def blank(width, height):
    return [bytearray(width * 4) for _ in range(height)]


def blit(dst, dw, dh, src, sw, sh, left, top):
    for y in range(sh):
        dy = top + y
        if dy < 0 or dy >= dh:
            continue
        drow, srow = dst[dy], src[y]
        for x in range(sw):
            dx = left + x
            if dx < 0 or dx >= dw:
                continue
            o, d = x * 4, dx * 4
            drow[d:d + 4] = srow[o:o + 4]


def circle_mask(rows, size, feather=1.0):
    r = size / 2.0 - 0.5
    c = size / 2.0 - 0.5
    for y in range(size):
        row = rows[y]
        for x in range(size):
            d = ((x - c) ** 2 + (y - c) ** 2) ** 0.5
            if d <= r - feather:
                continue
            if d >= r + feather:
                row[x * 4 + 3] = 0
            else:
                row[x * 4 + 3] = int(row[x * 4 + 3] * (r + feather - d) / (2 * feather))

def cut_out_black(width, height, rows, low=30, high=90):
    """Drop the studio-black backdrop, feathered so the anti-aliased rim does
    not turn into a hard black outline."""
    for y in range(height):
        row = rows[y]
        for x in range(width):
            o = x * 4
            peak = max(row[o], row[o + 1], row[o + 2])
            if peak >= high:
                continue
            if peak <= low:
                row[o:o + 4] = b"\x00\x00\x00\x00"
            else:
                row[o + 3] = min(row[o + 3],
                                 int(round((peak - low) * 255.0 / (high - low))))


def to_greyscale(width, height, rows):
    """Drive every pixel of the chrome art onto the grey axis.

    The skin promises a black-and-white-grey app, and the app-bar decoration is
    the one piece that arrives with colour in it (a red in the sword).  The
    channels are averaged, which keeps the shading and the alpha exactly as
    drawn and only removes the hue, so the mark reads like the wordmark and the
    page icons next to it."""
    for y in range(height):
        row = rows[y]
        for x in range(width):
            o = x * 4
            if row[o + 3] == 0:
                continue
            grey = int(round(0.299 * row[o] + 0.587 * row[o + 1] + 0.114 * row[o + 2]))
            row[o] = row[o + 1] = row[o + 2] = grey


def crop_to_content(width, height, rows, threshold=32, margin=0.02):
    """Trim the empty margin around the mark, which is what makes the
    wordmark usable at 24px tall."""
    minx, miny, maxx, maxy = width, height, -1, -1
    for y in range(height):
        row = rows[y]
        for x in range(width):
            o = x * 4
            if max(row[o], row[o + 1], row[o + 2]) > threshold:
                if x < minx:
                    minx = x
                if x > maxx:
                    maxx = x
                if y < miny:
                    miny = y
                if y > maxy:
                    maxy = y
    if maxx < 0:
        return width, height, rows
    pad = int(round(max(maxx - minx, maxy - miny) * margin))
    minx, miny = max(0, minx - pad), max(0, miny - pad)
    maxx, maxy = min(width - 1, maxx + pad), min(height - 1, maxy + pad)
    nw, nh = maxx - minx + 1, maxy - miny + 1
    return nw, nh, [bytearray(r[minx * 4:(maxx + 1) * 4]) for r in rows[miny:maxy + 1]]


def fit(width, height, rows, longest):
    """Scale so the longest side is `longest` px."""
    if width >= height:
        nw, nh = longest, max(1, int(round(height * longest / float(width))))
    else:
        nh, nw = longest, max(1, int(round(width * longest / float(height))))
    return nw, nh, resize(width, height, rows, nw, nh)


def centred(width, height, rows, canvas, frac):
    """Scale the mark to `frac` of a square canvas and centre it, so an
    adaptive icon never loses the point of the artwork to the launcher mask."""
    nw, nh, art = fit(width, height, rows, max(1, int(canvas * frac)))
    out = blank(canvas, canvas)
    blit(out, canvas, canvas, art, nw, nh, (canvas - nw) // 2, (canvas - nh) // 2)
    return out


def data_uri(path):
    with open(path, "rb") as fh:
        return "data:image/png;base64," + base64.b64encode(fh.read()).decode("ascii")

ADAPTIVE = ('<?xml version="1.0" encoding="utf-8"?>\n'
            '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
            '    <background android:drawable="@drawable/ic_launcher_gothic_background" />\n'
            '    <foreground android:drawable="@mipmap/ic_launcher_gothic_foreground" />\n'
            '</adaptive-icon>\n')

BACKGROUND = ('<?xml version="1.0" encoding="utf-8"?>\n'
              '<shape xmlns:android="http://schemas.android.com/apk/res/android"\n'
              '    android:shape="rectangle">\n'
              '    <solid android:color="%s" />\n'
              '</shape>\n' % ICON_BACKGROUND)

SPLASH = ('<?xml version="1.0" encoding="utf-8"?>\n'
          '<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n'
          '    <item>\n'
          '        <shape android:shape="rectangle">\n'
          '            <gradient\n'
          '                android:type="linear"\n'
          '                android:angle="270"\n'
          '                android:startColor="%s"\n'
          '                android:endColor="%s" />\n'
          '        </shape>\n'
          '    </item>\n'
          '    <item\n'
          '        android:width="108dp"\n'
          '        android:height="108dp"\n'
          '        android:gravity="center"\n'
          '        android:drawable="@mipmap/ic_splash_gothic" />\n'
          '</layer-list>\n') % (SPLASH_FROM, SPLASH_TO)

GOTHIC_VALUES = ('<?xml version="1.0" encoding="utf-8"?>\n'
                 '<resources>\n'
                 '    <!-- Gothic: a grey page with near-black panels.  These are the\n'
                 '         same colours the skin table gives the running app\n'
                 '         (build/skin.js), for the parts of a launch that are\n'
                 '         painted before any of it has run. -->\n'
                 '    <color name="gothic_window_background">%s</color>\n'
                 '    <color name="gothic_status_bar">%s</color>\n'
                 '    <color name="gothic_nav_bar">%s</color>\n'
                 '    <!-- the theme MainActivity switches to when the Gothic launcher\n'
                 '         alias started it: the remembered skin is whichever alias\n'
                 '         is enabled -->\n'
                 '    <style name="GothicTheme" parent="@android:style/Theme.Material.NoActionBar">\n'
                 '        <item name="android:windowBackground">@color/gothic_window_background</item>\n'
                 '        <item name="android:statusBarColor">@color/gothic_status_bar</item>\n'
                 '        <item name="android:navigationBarColor">@color/gothic_nav_bar</item>\n'
                 '        <item name="android:windowLightStatusBar">false</item>\n'
                 '        <item name="android:windowLightNavigationBar">false</item>\n'
                 '    </style>\n'
                 '    <!-- the starting window that alias shows; the running activity\n'
                 '         then swaps to GothicTheme in onCreate -->\n'
                 '    <style name="GothicSplashTheme" parent="@android:style/Theme.Material.NoActionBar">\n'
                 '        <item name="android:windowBackground">@drawable/splash_background_gothic</item>\n'
                 '        <item name="android:statusBarColor">@color/gothic_status_bar</item>\n'
                 '        <item name="android:navigationBarColor">@color/gothic_nav_bar</item>\n'
                 '        <item name="android:windowLightStatusBar">false</item>\n'
                 '        <item name="android:windowLightNavigationBar">false</item>\n'
                 '    </style>\n'
                 '</resources>\n' % (WINDOW_BG, STATUS_BAR, NAV_BAR))


def write_text(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)

def load(name):
    return read_png(os.path.join(SOURCE, name + ".png"))


def save_out(name, width, height, rows):
    path = os.path.join(OUT, name)
    write_png(path, width, height, rows)
    print("  out/%-26s %4dx%-4d %6d B" % (name, width, height, os.path.getsize(path)))
    return path


def main():
    if not os.path.isdir(SOURCE):
        print("source art missing:", SOURCE)
        return 2

    print("--- Gothic skin: in-app images ---")
    icons = {}
    for name, size in PAGE_ICONS:
        w, h, rows = load(name)
        cut_out_black(w, h, rows)
        to_greyscale(w, h, rows)
        icons[name] = save_out("icon-%s.png" % name, size, size, centred(w, h, rows, size, 1.0))

    w, h, rows = load("wordmark")
    cut_out_black(w, h, rows)
    to_greyscale(w, h, rows)
    w, h, rows = crop_to_content(w, h, rows)
    nw, nh, art = fit(w, h, rows, 400)
    wordmark = save_out("wordmark.png", nw, nh, art)

    # The deco is the one piece that keeps its colour: its red is the art's
    # own accent, and the skin allows an accent on top of the black, white and
    # grey chrome.  The page icons and the wordmark are the pieces that have to
    # disappear into that chrome, so only they are driven onto the grey axis.
    w, h, rows = load("deco")
    cut_out_black(w, h, rows)
    w, h, rows = crop_to_content(w, h, rows)
    nw, nh, art = fit(w, h, rows, 420)
    deco = save_out("deco.png", nw, nh, art)

    _w, _h, art = 192, 192, resize(*load("appicon"), 192, 192)
    appicon = save_out("appicon-192.png", 192, 192, art)

    print("--- Gothic skin: skin_gothic.js ---")
    order = [n for n, _ in PAGE_ICONS]
    js = ["/* generated by build/skins/gothic/make.py - edit the source art, not this */",
          "const SKIN_GOTHIC = {",
          "  icons: {"]
    for i, name in enumerate(order):
        js.append("    %s: '<img class=\"pageicon__img\" alt=\"\" src=\"%s\">'%s"
                  % (name, data_uri(icons[name]), "," if i < len(order) - 1 else ""))
    js += ["  },",
           "  wordmark: '%s'," % data_uri(wordmark),
           "  appbar: '%s'," % data_uri(deco),
           "  appIcon: '%s'" % data_uri(appicon),
           "};"]
    js_path = os.path.join(BUILD, "skin_gothic.js")
    write_text(js_path, "\n".join(js) + "\n")
    print("  %-28s %6d B" % (os.path.relpath(js_path, os.path.dirname(BUILD)), os.path.getsize(js_path)))

    print("--- Gothic skin: Android resources ---")
    for bucket, scale in DENSITIES:
        legacy = int(round(LAUNCHER_DP * scale))
        dst = os.path.join(ANDROID, "res", "mipmap-" + bucket)
        nw, nh, art = legacy, legacy, resize(*load("appicon"), legacy, legacy)
        write_png(os.path.join(dst, "ic_launcher_gothic.png"), nw, nh, art)
        round_rows = [bytearray(r) for r in art]
        circle_mask(round_rows, legacy)
        write_png(os.path.join(dst, "ic_launcher_gothic_round.png"), nw, nh, round_rows)

        fg = int(round(FOREGROUND_DP * scale))
        w, h, rows = load("appicon")
        cut_out_black(w, h, rows)
        write_png(os.path.join(dst, "ic_launcher_gothic_foreground.png"),
                  fg, fg, centred(w, h, rows, fg, FOREGROUND_ART))

        sp = int(round(SPLASH_DP * scale))
        w, h, rows = load("appicon")
        cut_out_black(w, h, rows)
        write_png(os.path.join(dst, "ic_splash_gothic.png"),
                  sp, sp, centred(w, h, rows, sp, 0.86))
        print("  mipmap-%-8s launcher %d, round, foreground %d, splash %d" % (bucket, legacy, fg, sp))

    res = os.path.join(ANDROID, "res")
    write_text(os.path.join(res, "mipmap-anydpi-v26", "ic_launcher_gothic.xml"), ADAPTIVE)
    write_text(os.path.join(res, "mipmap-anydpi-v26", "ic_launcher_gothic_round.xml"), ADAPTIVE)
    write_text(os.path.join(res, "drawable", "ic_launcher_gothic_background.xml"), BACKGROUND)
    write_text(os.path.join(res, "drawable", "splash_background_gothic.xml"), SPLASH)
    write_text(os.path.join(res, "values", "gothic.xml"), GOTHIC_VALUES)
    print("  adaptive-icon, background, splash and GothicSplashTheme written")
    print("done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
