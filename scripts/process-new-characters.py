#!/usr/bin/env python3
"""Process raw character art into transparent pet sprites."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PET = ROOT / "assets" / "pet"
TARGET_H = 420

# filename in assets/pet -> optional source path if importing from cursor assets
IMPORTS = {
    "char-pink-shy.png": Path("/Users/harry/.cursor/projects/Users-harry-Desktop/assets/char-pink-shy.png"),
    "char-green-wave.png": Path("/Users/harry/.cursor/projects/Users-harry-Desktop/assets/char-green-wave.png"),
    "char-sleep.png": Path("/Users/harry/.cursor/projects/Users-harry-Desktop/assets/char-sleep.png"),
    "char-scarf-celebrate.png": Path("/Users/harry/.cursor/projects/Users-harry-Desktop/assets/char-scarf-celebrate.png"),
    "char-purple-hop.png": Path("/Users/harry/.cursor/projects/Users-harry-Desktop/assets/char-purple-hop.png"),
    "char-orange-peek.png": Path("/Users/harry/.cursor/projects/Users-harry-Desktop/assets/char-orange-peek.png"),
}


def is_bg(r: int, g: int, b: int, a: int = 255) -> bool:
    if a < 20:
        return True
    if r > 235 and g > 235 and b > 230:
        return True
    if b > r + 8 and b > g + 5 and r > 170 and g > 190 and b > 210:
        return True
    if abs(r - g) < 15 and abs(g - b) < 25 and min(r, g, b) > 210:
        return True
    return False


def remove_bg(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_bg(r, g, b, a):
                px[x, y] = (0, 0, 0, 0)
    return im


def normalize(im: Image.Image) -> Image.Image:
    b = im.getbbox()
    if not b:
        return im
    x0, y0, x1, y1 = b
    pad = 8
    im = im.crop(
        (max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad))
    )
    scale = TARGET_H / im.height
    nw = max(1, int(im.width * scale))
    return im.resize((nw, TARGET_H), Image.Resampling.LANCZOS)


def main() -> None:
    for dest_name, src in IMPORTS.items():
        if not src.exists():
            print("skip missing", src)
            continue
        im = remove_bg(Image.open(src))
        im = normalize(im)
        out = PET / dest_name
        im.save(out, optimize=True)
        print(dest_name, im.size)


if __name__ == "__main__":
    main()
