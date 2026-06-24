#!/usr/bin/env python3
"""Compose hair/accessory variants onto base mascot sprites."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PET = ROOT / "assets" / "pet"
OUT = PET / "variants"

# base_key -> (file, head_anchor_y_ratio from top of bbox)
BASES = {
    "front": ("char-front.png", 0.08),
    "laugh": ("char-laugh.png", 0.06),
    "wave": ("char-wave.png", 0.10),
    "heart": ("char-heart.png", 0.10),
    "peek": ("char-peek.png", 0.12),
}

HAIR_SCALE = 0.52
HAIR_Y_OFFSET = -0.02


def is_bg(r: int, g: int, b: int, a: int = 255) -> bool:
    if a < 20:
        return True
    if r > 235 and g > 235 and b > 230:
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


def bbox(im: Image.Image) -> tuple[int, int, int, int]:
    b = im.getbbox()
    return b if b else (0, 0, im.width, im.height)


def composite_hair(base: Image.Image, hair: Image.Image, anchor_ratio: float) -> Image.Image:
    base = base.copy()
    x0, y0, x1, y1 = bbox(base)
    bw, bh = x1 - x0, y1 - y0
    cx = (x0 + x1) // 2

    hw = max(1, int(bw * HAIR_SCALE))
    hh = max(1, int(hair.height * (hw / hair.width)))
    hair_s = hair.resize((hw, hh), Image.Resampling.LANCZOS)

    hx = cx - hw // 2
    hy = y0 + int(bh * anchor_ratio) + int(bh * HAIR_Y_OFFSET)
    base.alpha_composite(hair_s, (hx, hy))
    return base


def normalize(im: Image.Image, target_h: int = 420) -> Image.Image:
    b = im.getbbox()
    if not b:
        return im
    im = im.crop(b)
    scale = target_h / im.height
    nw = max(1, int(im.width * scale))
    return im.resize((nw, target_h), Image.Resampling.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.png"):
        old.unlink()

    hairs = sorted(PET.glob("hair-*.png"))
    count = 0

    for base_key, (fname, anchor) in BASES.items():
        base_path = PET / fname
        if not base_path.exists():
            continue
        base = remove_bg(Image.open(base_path))

        for hair_path in hairs:
            hair_id = hair_path.stem.replace("hair-", "")
            hair = remove_bg(Image.open(hair_path))
            composed = composite_hair(base, hair, anchor)
            composed = normalize(composed)
            out_name = f"{base_key}-hair{hair_id}.png"
            composed.save(OUT / out_name, optimize=True)
            count += 1

    print(f"Composed {count} hair variants -> {OUT}")


if __name__ == "__main__":
    main()
