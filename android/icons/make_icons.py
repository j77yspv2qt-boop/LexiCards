#!/usr/bin/env python3
"""Turn the master artwork into every Android icon resource LexiCards needs."""
import os
import struct
import subprocess
import sys
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.path.join(os.path.dirname(HERE), "res")
SOURCE = os.path.join(HERE, "icon-source.jpg")
WORK = os.path.join(HERE, ".work")

DENSITIES = [("mdpi", 1), ("hdpi", 1.5), ("xhdpi", 2), ("xxhdpi", 3), ("xxxhdpi", 4)]
LAUNCHER_DP = 48
FOREGROUND_DP = 108
FOREGROUND_ART = 0.68
SPLASH_DP = 96


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
    with open(path, "wb") as fh:
        fh.write(png)


def to_srgb(source, target):
    subprocess.run(["sips", "-s", "format", "png", "--deleteColorManagementProperties",
                    source, "--out", target],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def cut_out_black(width, height, rows):
    for y in range(height):
        row = rows[y]
        for x in range(width):
            o = x * 4
            peak = max(row[o], row[o + 1], row[o + 2])
            if peak >= 90:
                continue
            if peak <= 30:
                row[o:o + 4] = b"\x00\x00\x00\x00"
            else:
                row[o + 3] = min(row[o + 3], int(round((peak - 30) * 255.0 / 60.0)))


def fill_holes(width, height, rows):
    for y in range(height):
        row = rows[y]
        first = -1
        for x in range(width):
            if row[x * 4 + 3] == 255:
                first = x
                break
        if first < 0:
            continue
        src = bytes(row[first * 4:first * 4 + 3])
        for x in range(first):
            row[x * 4:x * 4 + 3] = src
            row[x * 4 + 3] = 255
        last = width - 1
        while last >= 0 and row[last * 4 + 3] != 255:
            last -= 1
        src = bytes(row[last * 4:last * 4 + 3])
        for x in range(last + 1, width):
            row[x * 4:x * 4 + 3] = src
            row[x * 4 + 3] = 255
    for y in range(height):
        if rows[y][3] == 255:
            continue
        for step in range(1, height):
            done = False
            for cand in ((y - step) if y - step >= 0 else None,
                         (y + step) if y + step < height else None):
                if cand is not None and rows[cand][3] == 255:
                    rows[y] = bytearray(rows[cand])
                    done = True
                    break
            if done:
                break


def resize(width, height, rows, nw, nh):
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


def save(path, width, height, rows):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    write_png(path, width, height, rows)
    print("  %-34s %4dx%-4d" % (os.path.join(os.path.basename(os.path.dirname(path)),
                                             os.path.basename(path)), width, height))


def main():
    if not os.path.exists(SOURCE):
        print("master artwork not found:", SOURCE)
        return 2
    os.makedirs(WORK, exist_ok=True)
    raw_png = os.path.join(WORK, "source.png")
    to_srgb(SOURCE, raw_png)

    width, height, rows = read_png(raw_png)
    print("master: %dx%d" % (width, height))
    cut_out_black(width, height, rows)
    art = [bytearray(r) for r in rows]
    filled = [bytearray(r) for r in rows]
    fill_holes(width, height, filled)

    for name, scale in DENSITIES:
        folder = os.path.join(RES, "mipmap-" + name)

        launcher = int(LAUNCHER_DP * scale)
        save(os.path.join(folder, "ic_launcher.png"), launcher, launcher,
             resize(width, height, filled, launcher, launcher))

        rnd = [bytearray(r) for r in resize(width, height, filled, launcher, launcher)]
        circle_mask(rnd, launcher)
        save(os.path.join(folder, "ic_launcher_round.png"), launcher, launcher, rnd)

        canvas = int(FOREGROUND_DP * scale)
        art_size = int(canvas * FOREGROUND_ART)
        small = resize(width, height, art, art_size, art_size)
        fg = blank(canvas, canvas)
        off = (canvas - art_size) // 2
        blit(fg, canvas, canvas, small, art_size, art_size, off, off)
        save(os.path.join(folder, "ic_launcher_foreground.png"), canvas, canvas, fg)

        splash = int(SPLASH_DP * scale)
        save(os.path.join(folder, "ic_splash.png"), splash, splash,
             resize(width, height, filled, splash, splash))

    print("\nwritten into", RES)
    return 0


if __name__ == "__main__":
    sys.exit(main())
