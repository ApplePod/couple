/**
 * 애니 스타일 펫 — 베이크된 포즈 플립북 (캐릭터 단위 재생)
 */

import { PET_POSES, PET_POSE_COUNT } from "./pet-poses-manifest.js";

let _raf = null;
let _state = null;
let _charTimer = null;
let _activeCharacterKey = null;

const FRAME_MS = 105;
const HOLD_MS = 240;
const CHAR_ROTATE_MIN_MS = 5000;
const CHAR_ROTATE_MAX_MS = 12000;

const CHARACTER_KEYS = [...new Set(PET_POSES.map((p) => p.key))];

/** 동작 클립별 3컷 재생 */
function buildCharacterLibrary(characterKey) {
  const pool = PET_POSES.filter((p) => p.key === characterKey);
  const groups = new Map();

  for (const p of pool) {
    const gkey = `${p.key}:${p.motion}`;
    if (!groups.has(gkey)) groups.set(gkey, []);
    groups.get(gkey).push(p);
  }

  const ordered = [...groups.values()]
    .sort((a, b) => a[0].id - b[0].id)
    .flatMap((poses) => poses.sort((a, b) => a.id - b.id));

  const frames = [];
  let clip = [];
  for (const p of ordered) {
    clip.push(p);
    if (clip.length >= 3) {
      for (const f of clip) frames.push({ src: f.src, ms: FRAME_MS });
      frames.push({ src: clip[clip.length - 1].src, ms: HOLD_MS });
      clip = [];
    }
  }
  if (clip.length) {
    for (const f of clip) frames.push({ src: f.src, ms: FRAME_MS });
    frames.push({ src: clip[clip.length - 1].src, ms: HOLD_MS });
  }

  return frames;
}

function buildDOM(firstKf) {
  return `<div class="fm-panda-motion">
    <img src="${firstKf.src}" alt="" class="fm-panda-art" draggable="false" decoding="async">
  </div>`;
}

function swapPose(img, kf) {
  if (!img || img.getAttribute("src") === kf.src) return;
  img.setAttribute("src", kf.src);
}

function animationLoop(now) {
  if (!_state) return;

  const { frames, frameIdx, frameStart, img } = _state;
  const kf = frames[frameIdx];
  const elapsed = now - frameStart;

  if (elapsed >= kf.ms) {
    const nextIdx = (frameIdx + 1) % frames.length;
    swapPose(img, frames[nextIdx]);
    _state.frameIdx = nextIdx;
    _state.frameStart = now;
  }

  _raf = requestAnimationFrame(animationLoop);
}

export function pickRandomCharacterKey(exclude) {
  const pool = exclude
    ? CHARACTER_KEYS.filter((k) => k !== exclude)
    : CHARACTER_KEYS;
  return pool[Math.floor(Math.random() * pool.length)] || CHARACTER_KEYS[0];
}

export const PANDA_FRAME_COUNT = PET_POSE_COUNT;

export function getPoseFrames(characterKey) {
  return buildCharacterLibrary(characterKey);
}

export function getActiveCharacterKey() {
  return _activeCharacterKey;
}

function playGrowPop() {
  const box = document.querySelector(".fm-panda-box");
  if (!box) return;
  box.classList.remove("fm-grow");
  void box.offsetWidth;
  box.classList.add("fm-grow");
}

export function startPandaAnimation(characterKey) {
  stopPandaAnimation();
  const sprite = document.querySelector(".fm-panda-sprite");
  if (!sprite) return;

  const key =
    characterKey ??
    _activeCharacterKey ??
    pickRandomCharacterKey();
  _activeCharacterKey = key;

  const frames = getPoseFrames(key);
  if (!frames.length) return;

  const first = frames[0];
  sprite.innerHTML = buildDOM(first);
  const img = sprite.querySelector(".fm-panda-art");

  _state = {
    characterKey: key,
    frames,
    frameIdx: 0,
    frameStart: performance.now(),
    img,
  };

  _raf = requestAnimationFrame(animationLoop);
}

export function rotatePandaCharacter() {
  if (!document.querySelector(".fm-panda-sprite")) return;
  const next = pickRandomCharacterKey(_activeCharacterKey);
  _activeCharacterKey = next;
  playGrowPop();
  startPandaAnimation(next);
}

export function stopPandaCharacterRotation() {
  if (_charTimer) {
    clearTimeout(_charTimer);
    _charTimer = null;
  }
}

export function isCharacterRotationScheduled() {
  return _charTimer != null;
}

export function schedulePandaCharacterRotation({ force = false } = {}) {
  if (_charTimer && !force) return;
  stopPandaCharacterRotation();
  const delay =
    CHAR_ROTATE_MIN_MS +
    Math.random() * (CHAR_ROTATE_MAX_MS - CHAR_ROTATE_MIN_MS);
  _charTimer = setTimeout(() => {
    rotatePandaCharacter();
    schedulePandaCharacterRotation({ force: true });
  }, delay);
}

export function stopPandaAnimation() {
  if (_raf) {
    cancelAnimationFrame(_raf);
    _raf = null;
  }
  _state = null;
}
