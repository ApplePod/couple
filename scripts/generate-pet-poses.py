#!/usr/bin/env python3
"""Bake mascot pose library from full character catalog (outfits, hair, expressions)."""

from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "assets" / "pet"
OUT_DIR = SRC_DIR / "poses"
MANIFEST_JS = ROOT / "pet-poses-manifest.js"
CATALOG_JS = ROOT / "pet-character-catalog.js"

CANVAS = 200
ANCHOR_Y = 188
ANCHOR_X = 100
DISPLAY_H = 132
MOTION_SCALE = DISPLAY_H / 132.0

SAMPLES = [0.0, 0.35, 0.7]

CORE = [
    {
        "key": "front",
        "file": "char-front.png",
        "stage": 1,
        "outfit": "물방울 잠옷",
        "expression": "힘내",
        "accessory": None,
        "motions": ["stand", "hop", "shy", "happy", "proud"],
    },
    {
        "key": "laugh",
        "file": "char-laugh.png",
        "stage": 2,
        "outfit": "하늘색 잠옷",
        "expression": "헤헤",
        "accessory": None,
        "motions": ["stand", "laugh", "happy", "hop"],
    },
    {
        "key": "wave",
        "file": "char-wave.png",
        "stage": 3,
        "outfit": "도형 패턴 잠옷",
        "expression": "반가워",
        "accessory": None,
        "motions": ["stand", "wave", "hop", "happy"],
    },
    {
        "key": "heart",
        "file": "char-heart.png",
        "stage": 4,
        "outfit": "물방울 잠옷",
        "expression": "사랑해",
        "accessory": None,
        "motions": ["stand", "heart", "hop", "happy", "proud"],
    },
    {
        "key": "peek",
        "file": "char-peek.png",
        "stage": 5,
        "outfit": "노란 셔츠",
        "expression": "궁금",
        "accessory": None,
        "motions": ["stand", "peek", "happy", "laugh"],
    },
    {
        "key": "pink-shy",
        "file": "char-pink-shy.png",
        "stage": 2,
        "outfit": "핑크 하트 잠옷",
        "expression": "수줍",
        "accessory": None,
        "motions": ["stand", "shy", "happy"],
    },
    {
        "key": "green-wave",
        "file": "char-green-wave.png",
        "stage": 3,
        "outfit": "민트 후드",
        "expression": "반가워",
        "accessory": None,
        "motions": ["stand", "wave", "happy", "hop"],
    },
    {
        "key": "sleep",
        "file": "char-sleep.png",
        "stage": 4,
        "outfit": "물방울 잠옷",
        "expression": "졸림",
        "accessory": None,
        "motions": ["stand", "shy", "happy"],
    },
    {
        "key": "scarf-celebrate",
        "file": "char-scarf-celebrate.png",
        "stage": 4,
        "outfit": "빨간 목도리",
        "expression": "신남",
        "accessory": "목도리",
        "motions": ["happy", "hop", "proud", "laugh"],
    },
    {
        "key": "purple-hop",
        "file": "char-purple-hop.png",
        "stage": 5,
        "outfit": "보라 별 잠옷",
        "expression": "신남",
        "accessory": None,
        "motions": ["hop", "happy", "proud", "stand"],
    },
    {
        "key": "orange-peek",
        "file": "char-orange-peek.png",
        "stage": 5,
        "outfit": "주황 줄티",
        "expression": "호기심",
        "accessory": None,
        "motions": ["peek", "stand", "happy", "shy"],
    },
]

HAIR_NAMES = {
    "01": "리본",
    "02": "별핀",
    "03": "클로버",
    "04": "벚꽃",
    "05": "왕관",
    "06": "모자",
    "07": "삔",
    "08": "고양이귀",
    "09": "토끼귀",
}


def build_catalog() -> list[dict]:
    catalog = [dict(c) for c in CORE]
    variants_dir = SRC_DIR / "variants"
    if not variants_dir.exists():
        return catalog

    base_meta = {c["key"]: c for c in CORE if not c["key"].endswith("-hair")}
    for path in sorted(variants_dir.glob("*.png")):
        stem = path.stem
        if "-hair" not in stem:
            continue
        base_key, hair_part = stem.split("-hair", 1)
        hair_id = hair_part
        parent = base_meta.get(base_key)
        if not parent:
            continue
        catalog.append(
            {
                "key": stem,
                "file": f"variants/{path.name}",
                "stage": min(6, parent["stage"] + 1),
                "outfit": parent["outfit"],
                "expression": parent["expression"],
                "accessory": HAIR_NAMES.get(hair_id, f"헤어{hair_id}"),
                "motions": parent["motions"][:4],
            }
        )
    return catalog


def ease_in_out_sine(t: float) -> float:
    return -(math.cos(math.pi * t) - 1) / 2


def ease_out_quad(t: float) -> float:
    return 1 - (1 - t) * (1 - t)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def motion_stand(p: float, v: int = 0) -> dict:
    o = v * 0.22
    s = math.sin((p + o) * math.pi * 2)
    return {
        "ty": s * 1.6,
        "tx": math.sin((p + o) * math.pi) * 0.5,
        "rot": s * 1.1,
        "sx": 1 - s * 0.004,
        "sy": 1 + s * 0.011,
    }


def motion_hop(p: float, _v: int = 0) -> dict:
    if p < 0.12:
        t = p / 0.12
        return {"ty": t * 2, "tx": 0, "rot": 0, "sx": 1 + t * 0.04, "sy": 1 - t * 0.06}
    if p < 0.42:
        t = (p - 0.12) / 0.3
        up = math.sin(t * math.pi)
        return {"ty": -up * 12, "tx": 0, "rot": -up * 2.5, "sx": 1.02 - t * 0.02, "sy": 1.04}
    if p < 0.58:
        t = (p - 0.42) / 0.16
        return {
            "ty": lerp(-12, 2, t),
            "tx": 0,
            "rot": lerp(-2.5, 0, t),
            "sx": 1.06,
            "sy": lerp(1.04, 0.88, t),
        }
    t = (p - 0.58) / 0.42
    return {
        "ty": 2 * (1 - ease_out_quad(t)),
        "tx": 0,
        "rot": 0,
        "sx": lerp(1.06, 1, t),
        "sy": lerp(0.88, 1, t),
    }


def motion_wave(p: float, v: int = 0) -> dict:
    flip = -1 if v % 2 else 1
    s = math.sin(p * math.pi)
    w = math.sin(p * math.pi * 3) * s
    return {
        "ty": -s * 5 - w * 0.8,
        "tx": flip * (s * 2.5 + w * 0.5),
        "rot": flip * (s * 5 + w * 0.4),
        "sx": 1 + s * 0.015,
        "sy": 1 + s * 0.01,
    }


def motion_heart(p: float, v: int = 0) -> dict:
    flip = -1 if v % 2 else 1
    e = ease_in_out_sine(p)
    throw_p = (p - 0.5) * 2 if p > 0.5 else 0
    return {
        "ty": -e * 4 - throw_p * 2,
        "tx": flip * (-e * 3 + throw_p * 4),
        "rot": flip * (-e * 5 - throw_p * 3),
        "sx": 1 + e * 0.02,
        "sy": 1 + e * 0.015,
    }


def motion_happy(p: float, _v: int = 0) -> dict:
    e = ease_in_out_sine(min(1, p * 1.2))
    w = math.sin(p * math.pi * 5) * (1 - p * 0.35) * 4
    return {"ty": -e * 3.5, "tx": w, "rot": w * 0.55, "sx": 1, "sy": 1 + e * 0.008}


def motion_laugh(p: float, v: int = 0) -> dict:
    o = v * 0.18
    bounce = math.sin((p + o) * math.pi * 2)
    giggle = math.sin((p + o) * math.pi * 6) * (1 - p * 0.2) * 2.5
    return {
        "ty": -abs(bounce) * 4 - giggle * 0.6,
        "tx": giggle,
        "rot": bounce * 2.2 + giggle * 0.35,
        "sx": 1 + bounce * 0.018,
        "sy": 1 + abs(bounce) * 0.012,
    }


def motion_peek(p: float, _v: int = 0) -> dict:
    rise = math.sin(ease_in_out_sine(p) * math.pi)
    return {"ty": -rise * 7, "tx": 0, "rot": rise * 3, "sx": 1, "sy": 1 - rise * 0.02}


def motion_shy(p: float, _v: int = 0) -> dict:
    e = math.sin(p * math.pi)
    return {"ty": e * 1.5, "tx": 0, "rot": 0, "sx": 1 - e * 0.05, "sy": 1 - e * 0.03}


def motion_proud(p: float, _v: int = 0) -> dict:
    e = ease_in_out_sine(p)
    return {"ty": -e * 4, "tx": 0, "rot": 0, "sx": 1 + e * 0.04, "sy": 1 + e * 0.03}


MOTIONS = {
    "stand": motion_stand,
    "hop": motion_hop,
    "wave": motion_wave,
    "heart": motion_heart,
    "happy": motion_happy,
    "laugh": motion_laugh,
    "peek": motion_peek,
    "shy": motion_shy,
    "proud": motion_proud,
}


def render_pose(base_img: Image.Image, m: dict, flip: bool) -> Image.Image:
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    w, h = base_img.size
    target_h = int(DISPLAY_H * 1.05)
    scale0 = target_h / h
    sx = scale0 * m["sx"] * (-1 if flip else 1)
    sy = scale0 * m["sy"]
    nw = max(1, int(abs(w * sx)))
    nh = max(1, int(abs(h * sy)))
    scaled = base_img.resize((nw, nh), Image.Resampling.LANCZOS)
    if flip:
        scaled = scaled.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    rot = scaled.rotate(-m["rot"], resample=Image.Resampling.BICUBIC, expand=True)
    tx = ANCHOR_X + m["tx"] * MOTION_SCALE
    ty = ANCHOR_Y + m["ty"] * MOTION_SCALE
    px = int(tx - rot.width / 2)
    py = int(ty - rot.height)
    canvas.alpha_composite(rot, (px, py))
    return canvas


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("pose-*.png"):
        old.unlink()

    catalog = build_catalog()
    manifest: list[dict] = []
    idx = 1
    variation = 0

    for char in catalog:
        path = SRC_DIR / char["file"]
        if not path.exists():
            print("skip missing", path)
            continue
        base_img = Image.open(path).convert("RGBA")
        for motion_name in char["motions"]:
            motion_fn = MOTIONS[motion_name]
            flip = motion_name in ("wave", "heart")
            for p in SAMPLES:
                m = motion_fn(p, variation % 12)
                frame = render_pose(base_img, m, flip)
                fname = f"pose-{idx:04d}.png"
                frame.save(OUT_DIR / fname, optimize=True)
                manifest.append(
                    {
                        "id": idx,
                        "src": f"assets/pet/poses/{fname}",
                        "key": char["key"],
                        "outfit": char["outfit"],
                        "expression": char["expression"],
                        "accessory": char["accessory"],
                        "motion": motion_name,
                        "stageMin": char["stage"],
                    }
                )
                idx += 1
                variation += 1

    manifest_js = (
        "/** Auto-generated by scripts/generate-pet-poses.py */\n"
        f"export const PET_POSE_COUNT = {len(manifest)};\n"
        f"export const PET_POSES = {json.dumps(manifest, ensure_ascii=False, indent=2)};\n"
    )
    MANIFEST_JS.write_text(manifest_js, encoding="utf-8")

    catalog_js = (
        "/** Character catalog — outfits, expressions, accessories */\n"
        f"export const PET_CHARACTERS = {json.dumps(catalog, ensure_ascii=False, indent=2)};\n"
    )
    CATALOG_JS.write_text(catalog_js, encoding="utf-8")

    print(f"Characters: {len(catalog)}")
    print(f"Generated {len(manifest)} poses -> {OUT_DIR}")


if __name__ == "__main__":
    main()
