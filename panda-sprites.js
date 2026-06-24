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

/** 동작 클립별 3컷 재생 — 옷·표정·꾸밈이 섞이도록 라운드로빈 */
function buildStageLibrary(stageId) {
  const pool = PET_POSES.filter((p) => p.stageMin <= stageId);
  const groups = new Map();

  for (const p of pool) {
    const key = `${p.key}:${p.motion}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }

  const byStage = [...groups.entries()].sort((a, b) => {
    const pa = a[1][0];
    const pb = b[1][0];
    if (pa.stageMin !== pb.stageMin) return pa.stageMin - pb.stageMin;
    if (pa.outfit !== pb.outfit) return pa.outfit.localeCompare(pb.outfit, "ko");
    return pa.id - pb.id;
  });

  const buckets = new Map();
  for (const [gkey, poses] of byStage) {
    const stage = poses[0].stageMin;
    if (!buckets.has(stage)) buckets.set(stage, []);
    buckets.get(stage).push({ gkey, poses });
  }

  const ordered = [];
  for (const stage of [...buckets.keys()].sort((a, b) => a - b)) {
    const list = buckets.get(stage);
    let round = 0;
    let added = true;
    while (added) {
      added = false;
      for (const { poses } of list) {
        if (round < poses.length) {
          ordered.push(poses[round]);
          added = true;
        }
      }
      round += 1;
    }
  }

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
