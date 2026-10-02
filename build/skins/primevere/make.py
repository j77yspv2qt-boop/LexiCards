#!/usr/bin/env python3
"""Turn the master Primevere artwork into every asset the skin needs.

Primevere is the spring skin: green and light green, cream paper and a little
gilt.  The artwork arrives as antiques - a tree, a swan, a rose, a robin, a
garland of bellflowers, the calligraphic wordmark and the launcher tile -
already cut out on transparency.  The tile is a squircle drawn to the very
edge of its square, so it drops in as it is: nothing to flood-fill, nothing
to crop - except on the Android launcher, where only the middle 72dp of the
108dp adaptive-icon canvas is ever shown (see FOREGROUND_ART).

Nothing is recoloured here.  Gothic drove its art onto the grey axis because a
monochrome skin demands it; this skin is the opposite, so every piece keeps the
colours it was drawn in and only the margins are trimmed and the image scaled
to the size the app asks for.  The one adjustment is the
page icons: they sit next to a page title at 19-27 px, so they are rendered
square and centred on a transparent canvas (see PAGE_ICONS) instead of being
cropped to whatever shape a render came in.

The Android chrome - the window behind the WebView, the two system bars and the
splash gradient - is painted before any of the app has run, so its colours are
read out of the skin's own table in build/skin.js (see skin_token) rather than
written a second time here.  The launcher's backdrop is the one exception: it
has to continue the tile's own painted gradient, so it is sampled from the
artwork instead (see background_xml).

Outputs
  out/*.png                  the in-app images (also committed, so the skin can
                             be inspected without running this script)
  ../skin_primevere.js       the same images as data: URIs, which is what
                             build.py folds into index.html
  ../../android/res/...      the Android launcher, splash and theme resources

Run from anywhere:  python3 build/skins/primevere/make.py
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
SKIN_ID = "primevere"

def skin_table(skin_id):
    """The body of one skin's entry in build/skin.js.

    Scoping the search to the skin's own block matters: skin.js defines several
    skins and they all name the same custom properties, so a plain search for
    `'--page-top'` would answer with whichever skin happens to be written
    first."""
    path = os.path.join(BUILD, "skin.js")
    if not os.path.exists(path):
        return ""
    src = open(path, "r", encoding="utf-8").read()
    at = src.find("SKINS." + skin_id + " = {")
    if at < 0:
        return ""
    end = src.find("};", at)          # the entry's own closing brace
    return src[at:end + 2] if end > 0 else src[at:]


def skin_token(name, fallback):
    """One colour out of this skin's table in build/skin.js.

    The Android chrome - the window behind the WebView, the two system bars and
    the splash gradient - is painted before any JavaScript runs, so it cannot be
    driven by CSS variables.  Reading the values from the skin table instead of
    repeating them here is what stops the launch colours and the running app
    from drifting apart."""
    found = re.search(r"'%s':\s*'(#[0-9A-Fa-f]{6})'" % re.escape(name), skin_table(SKIN_ID))
    return found.group(1) if found else fallback


# The Android chrome colours, read from the skin table (see skin_token).
# The launcher's backdrop is not one of them: it has to continue the tile's
# own painted gradient, so it is sampled from the artwork instead - see
# background_xml.
SPLASH_FROM = skin_token("--page-top", "#F3F9EC")
SPLASH_TO = skin_token("--page-bottom", "#DCECCF")
WINDOW_BG = skin_token("--bg", "#EAF4E1")
STATUS_BAR = skin_token("--appbar-from", "#4E8C4E")
NAV_BAR = skin_token("--tabbar-bg", "#FBFDF7")

# the density buckets the launcher icon needs (name, scale)
DENSITIES = [("mdpi", 1), ("hdpi", 1.5), ("xhdpi", 2), ("xxhdpi", 3), ("xxxhdpi", 4)]
LAUNCHER_DP = 48
FOREGROUND_DP = 108
SPLASH_DP = 96

# The launcher art is the whole tile, not a mark floating in a field - but the
# foreground layer covers the visible window, not the whole canvas.  Android
# lays an adaptive icon out on 108dp and the launcher only ever shows the
# middle 72dp of it, through a mask of its own choosing (circle, squircle or
# rounded square).  At 1.0 that took the middle two thirds of the tile, which
# cut the wreath in half on the home screen while the card grew into the whole
# icon (the screenshot in README's v2.1.1 note).  The tile is therefore drawn
# at 73dp - a hair over the 72dp window - so its paint always reaches past the
# mask: the home screen shows the PNG as it stands, edge to edge, with no
# canvas of the launcher's left beside it to seam against (at exactly 72dp the
# source's anti-aliased rim left a one-pixel band of backdrop showing, and on
# the left edge it stepped 27/255 away from the tile's own colour).  The size
# is set by what the mask may hide, not by what it shows: measured against a
# One UI squircle nothing of the drawing falls outside it - only the tile's own
# corner background does, which the mask hides by definition - while a circular
# mask shaves the corners, the circle's shape rather than a crop added here.
# The background layer is therefore never visible; it stays as the adaptive
# icon's required second layer, carrying the tile's painted gradient.
FOREGROUND_ART = 73.0 / 108.0

# the four page icons: square artwork, centred on a transparent canvas
PAGE_ICONS = [("discover", 128), ("mine", 128), ("records", 128), ("quiz", 128)]
WORDMARK_WIDTH = 400
DECO_WIDTH = 420
APPICON = 192


# --------------------------------------------------------------------------
# a tiny PNG codec - same dependency-free helpers as android/icons/make_icons.py
# and build/skins/gothic/make.py, and for the same reason: there is no Pillow on
# this machine and the artwork is plain 8-bit RGBA
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
    bleeds into the cream and gold edges."""
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


def crop_to_content(width, height, rows, threshold=32, margin=0.02):
    """Trim the empty margin around the mark, which is what makes the
    wordmark usable at 26px tall."""
    minx, miny, maxx, maxy = width, height, -1, -1
    for y in range(height):
        row = rows[y]
        for x in range(width):
            o = x * 4
            if row[o + 3] and max(row[o], row[o + 1], row[o + 2]) > threshold:
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
    return maxx - minx + 1, maxy - miny + 1, [bytearray(r[minx * 4:(maxx + 1) * 4])
                                              for r in rows[miny:maxy + 1]]


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


ADAPTIVE = ('<?xml version="1.0" encoding="utf-8"?>\n'
            '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
            '    <background android:drawable="@drawable/ic_launcher_primevere_background" />\n'
            '    <foreground android:drawable="@mipmap/ic_launcher_primevere_foreground" />\n'
            '</adaptive-icon>\n')

def hex_colour(rgb):
    """A clamped RGB triple as the #RRGGBB the Android resources want."""
    return "#%02X%02X%02X" % tuple(max(0, min(255, int(round(c)))) for c in rgb)


def tile_background(width, height, rows, dx, dy):
    """The tile's own painted colour where its gradient meets its edge.

    Walks from the centre outwards along (dx, dy) and keeps the last opaque
    pixel - the outermost paint, past the wreath - because that is the colour
    the launcher's backdrop has to carry on with."""
    cx, cy = width // 2, height // 2
    best = None
    for i in range(max(width, height)):
        x = int(round(cx + dx * i))
        y = int(round(cy + dy * i))
        if not (0 <= x < width and 0 <= y < height):
            break
        o = x * 4
        if rows[y][o + 3] >= 250:
            best = (rows[y][o], rows[y][o + 1], rows[y][o + 2])
    return best


def background_xml(width, height, rows):
    """The launcher backdrop: the tile's own painted gradient, carried past its edge.

    At 72dp the tile meets the window on every edge, so the canvas the mask can
    still show is where it curves inside the window at the corners, plus the
    tile's anti-aliased rim; a flat colour there would ring the artwork in a
    colour it never draws with - the tile's edge runs light green at the top
    left and olive at the bottom right.  Both samples sit on that same diagonal
    and at the same distance from the centre, so together they are the two
    stops of the gradient the tile was painted with.  Android draws its
    gradient across the whole 108dp drawable (angle 315, corner to corner),
    which reaches further out than the 72dp tile, so each stop is pushed out by
    the same factor: the line still passes
    through both sampled colours exactly where the tile ends."""
    top = tile_background(width, height, rows, 0, -1)
    left = tile_background(width, height, rows, -1, 0)
    right = tile_background(width, height, rows, 1, 0)
    bottom = tile_background(width, height, rows, 0, 1)
    if not all([top, left, right, bottom]):
        raise SystemExit("primevere: the tile has no opaque edge to sample")
    start = [(top[i] + left[i]) / 2.0 for i in range(3)]     # the top-left half
    end = [(bottom[i] + right[i]) / 2.0 for i in range(3)]   # the bottom-right half
    reach = (2.0 - FOREGROUND_ART) / 4.0    # the tile edge, as a share of the diagonal
    push = reach / (1.0 - 2.0 * reach)      # ... and out to the drawable's own corners
    span = [end[i] - start[i] for i in range(3)]
    # Each channel only pushes out as far as 8-bit gamut allows: the top-left
    # stop runs light, and clipping one channel to white would bend the line
    # away from the tile's edge exactly where it has to meet it.
    step = []
    for i in range(3):
        p = push
        if span[i] < 0:
            p = min(p, (255.0 - start[i]) / -span[i], end[i] / -span[i])
        elif span[i] > 0:
            p = min(p, start[i] / span[i], (255.0 - end[i]) / span[i])
        step.append(max(0.0, p))
    start = [start[i] - step[i] * span[i] for i in range(3)]
    end = [end[i] + step[i] * span[i] for i in range(3)]
    print("  backdrop gradient %s -> %s" % (hex_colour(start), hex_colour(end)))
    return ('<?xml version="1.0" encoding="utf-8"?>\n'
            '<shape xmlns:android="http://schemas.android.com/apk/res/android"\n'
            '    android:shape="rectangle">\n'
            '    <gradient\n'
            '        android:type="linear"\n'
            '        android:angle="315"\n'
            '        android:startColor="%s"\n'
            '        android:endColor="%s" />\n'
            '</shape>\n' % (hex_colour(start), hex_colour(end)))

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
          '        android:drawable="@mipmap/ic_splash_primevere" />\n'
          '</layer-list>\n') % (SPLASH_FROM, SPLASH_TO)

PRIMEVERE_VALUES = ('<?xml version="1.0" encoding="utf-8"?>\n'
                    '<resources>\n'
                    '    <!-- Primevere: a light spring-green page with cream panels.\n'
                    '         These are the same colours the skin table gives the running\n'
                    '         app (build/skin.js), for the parts of a launch that are\n'
                    '         painted before any of it has run. -->\n'
                    '    <color name="primevere_window_background">%s</color>\n'
                    '    <color name="primevere_status_bar">%s</color>\n'
                    '    <color name="primevere_nav_bar">%s</color>\n'
                    '    <!-- the theme MainActivity switches to when the Primevere launcher\n'
                    '         alias started it: the remembered skin is whichever alias\n'
                    '         is enabled -->\n'
                    '    <style name="PrimevereTheme" parent="@android:style/Theme.Material.Light.NoActionBar">\n'
                    '        <item name="android:windowBackground">@color/primevere_window_background</item>\n'
                    '        <item name="android:statusBarColor">@color/primevere_status_bar</item>\n'
                    '        <item name="android:navigationBarColor">@color/primevere_nav_bar</item>\n'
                    '        <item name="android:windowLightStatusBar">false</item>\n'
                    '        <item name="android:windowLightNavigationBar">true</item>\n'
                    '    </style>\n'
                    '    <!-- the starting window that alias shows; the running activity\n'
                    '         then swaps to PrimevereTheme in onCreate -->\n'
                    '    <style name="PrimevereSplashTheme" parent="@android:style/Theme.Material.Light.NoActionBar">\n'
                    '        <item name="android:windowBackground">@drawable/splash_background_primevere</item>\n'
                    '        <item name="android:statusBarColor">@color/primevere_status_bar</item>\n'
                    '        <item name="android:navigationBarColor">@color/primevere_nav_bar</item>\n'
                    '        <item name="android:windowLightStatusBar">false</item>\n'
                    '        <item name="android:windowLightNavigationBar">true</item>\n'
                    '    </style>\n'
                    '</resources>\n') % (WINDOW_BG, STATUS_BAR, NAV_BAR)


def main():
    if not os.path.isdir(SOURCE):
        print("source art missing:", SOURCE)
        return 2

    print("--- Primevere skin: in-app images ---")
    icons = {}
    for name, size in PAGE_ICONS:
        w, h, rows = load(name)
        w, h, rows = crop_to_content(w, h, rows)
        icons[name] = save_out("icon-%s.png" % name, size, size,
                               centred(w, h, rows, size, 1.0))

    w, h, rows = load("wordmark")
    w, h, rows = crop_to_content(w, h, rows)
    nw, nh, art = fit(w, h, rows, WORDMARK_WIDTH)
    wordmark = save_out("wordmark.png", nw, nh, art)

    # The garland keeps its colour here (unlike Gothic's sword, the one colour
    # that skin allowed): cream and gilt on the green app bar is the point of
    # this skin, so only the background is dropped and the margins trimmed.
    w, h, rows = load("deco")
    w, h, rows = crop_to_content(w, h, rows)
    nw, nh, art = fit(w, h, rows, DECO_WIDTH)
    deco = save_out("deco.png", nw, nh, art)

    tile_w, tile_h, tile = load("appicon")
    appicon = save_out("appicon-%d.png" % APPICON, APPICON, APPICON,
                       resize(tile_w, tile_h, tile, APPICON, APPICON))

    print("--- Primevere skin: skin_primevere.js ---")
    order = [n for n, _ in PAGE_ICONS]
    js = ["/* generated by build/skins/primevere/make.py - edit the source art, not this */",
          "const SKIN_PRIMEVERE = {",
          "  icons: {"]
    for i, name in enumerate(order):
        js.append("    %s: '<img class=\"pageicon__img\" alt=\"\" src=\"%s\">'%s"
                  % (name, data_uri(icons[name]), "," if i < len(order) - 1 else ""))
    js += ["  },",
           "  wordmark: '%s'," % data_uri(wordmark),
           "  appbar: '%s'," % data_uri(deco),
           "  appIcon: '%s'" % data_uri(appicon),
           "};"]
    js_path = os.path.join(BUILD, "skin_primevere.js")
    write_text(js_path, "\n".join(js) + "\n")
    print("  %-28s %6d B" % (os.path.relpath(js_path, os.path.dirname(BUILD)),
                             os.path.getsize(js_path)))
    return android(tile_w, tile_h, tile)


def android(tile_w, tile_h, tile):
    print("--- Primevere skin: Android resources ---")
    for bucket, scale in DENSITIES:
        dst = os.path.join(ANDROID, "res", "mipmap-" + bucket)

        legacy = int(round(LAUNCHER_DP * scale))
        art = resize(tile_w, tile_h, tile, legacy, legacy)
        write_png(os.path.join(dst, "ic_launcher_primevere.png"), legacy, legacy, art)
        round_rows = [bytearray(r) for r in art]
        circle_mask(round_rows, legacy)
        write_png(os.path.join(dst, "ic_launcher_primevere_round.png"), legacy, legacy, round_rows)

        fg = int(round(FOREGROUND_DP * scale))
        write_png(os.path.join(dst, "ic_launcher_primevere_foreground.png"), fg, fg,
                  centred(tile_w, tile_h, tile, fg, FOREGROUND_ART))

        sp = int(round(SPLASH_DP * scale))
        write_png(os.path.join(dst, "ic_splash_primevere.png"), sp, sp,
                  centred(tile_w, tile_h, tile, sp, 0.86))
        print("  mipmap-%-8s launcher %d, round, foreground %d, splash %d"
              % (bucket, legacy, fg, sp))

    res = os.path.join(ANDROID, "res")
    write_text(os.path.join(res, "mipmap-anydpi-v26", "ic_launcher_primevere.xml"), ADAPTIVE)
    write_text(os.path.join(res, "mipmap-anydpi-v26", "ic_launcher_primevere_round.xml"), ADAPTIVE)
    write_text(os.path.join(res, "drawable", "ic_launcher_primevere_background.xml"),
               background_xml(tile_w, tile_h, tile))
    write_text(os.path.join(res, "drawable", "splash_background_primevere.xml"), SPLASH)
    write_text(os.path.join(res, "values", "primevere.xml"), PRIMEVERE_VALUES)
    print("  adaptive-icon, background, splash and PrimevereSplashTheme written")
    print("done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
