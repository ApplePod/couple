/**
 * 애니 스타일 펫 — 베이크된 포즈 플립북 (클립 단위 재생, 반짝임 최소화)
 */

import { PET_POSES, PET_POSE_COUNT } from "./pet-poses-manifest.js";

let _raf = null;
let _state = null;

const FRAME_MS = 105;
const HOLD_MS = 240;

const STAGE_LIBRARIES = Object.fromEntries(
  [1, 2, 3, 4, 5, 6].map((id) => [id, buildStageLibrary(id)])
);

/** 동작 클립별 3컷만 재생 — 좌우반전 매 프레임 교체 제거 */
function buildStageLibrary(stageId) {
  const pool = PET_POSES.filter((p) => p.stageMin <= stageId);
  const groups = new Map();

  for (const p of pool) {
    const key = `${p.base}:${p.motion}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }

  const orderedKeys = [...groups.keys()].sort((a, b) => {
    const pa = groups.get(a)[0];
    const pb = groups.get(b)[0];
    if (pa.stageMin !== pb.stageMin) return pa.stageMin - pb.stageMin;
    return pa.id - pb.id;
  });

  const frames = [];
  for (const key of orderedKeys) {
    const poses = groups.get(key);
    const half = poses.length / 2;
    const side = poses.slice(0, half);
    const picks = [side[0], side[2], side[4]].filter(Boolean);
    if (!picks.length) continue;

    for (const p of picks) {
      frames.push({ src: p.src, ms: FRAME_MS });
    }
    frames.push({ src: picks[picks.length - 1].src, ms: HOLD_MS });
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

export const PANDA_FRAME_COUNT = PET_POSE_COUNT;

export function getPoseFrames(stageId) {
  return STAGE_LIBRARIES[stageId] || STAGE_LIBRARIES[1];
}

export function startPandaAnimation(stageId) {
  stopPandaAnimation();
  const sprite = document.querySelector(".fm-panda-sprite");
  if (!sprite) return;

  const frames = getPoseFrames(stageId);
  if (!frames.length) return;

  const first = frames[0];
  sprite.innerHTML = buildDOM(first);
  const img = sprite.querySelector(".fm-panda-art");

  _state = {
    stageId,
    frames,
    frameIdx: 0,
    frameStart: performance.now(),
    img,
  };

  _raf = requestAnimationFrame(animationLoop);
}

export function stopPandaAnimation() {
  if (_raf) {
    cancelAnimationFrame(_raf);
    _raf = null;
  }
  _state = null;
}
