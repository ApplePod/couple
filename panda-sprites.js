/**
 * 애니 스타일 펫 — 베이크된 포즈 250장 플립북
 * (5종 원본 × 동작 × 좌우반전 × 샘플 — scripts/generate-pet-poses.py)
 */

import { PET_POSES, PET_POSE_COUNT } from "./pet-poses-manifest.js";

let _raf = null;
let _state = null;

const STAGE_LIBRARIES = Object.fromEntries(
  [1, 2, 3, 4, 5, 6].map((id) => [id, buildStageLibrary(id)])
);

function buildStageLibrary(stageId) {
  return PET_POSES.filter((p) => p.stageMin <= stageId).map((p) => ({
    src: p.src,
    ms: p.ms,
  }));
}

function buildDOM(firstKf) {
  return `<div class="fm-panda-motion">
    <div class="fm-panda-layers">
      <img src="${firstKf.src}" alt="" class="fm-panda-art fm-layer fm-layer-a fm-layer-visible" draggable="false" decoding="async">
      <img src="${firstKf.src}" alt="" class="fm-panda-art fm-layer fm-layer-b" hidden draggable="false" decoding="async">
    </div>
  </div>`;
}

function crossfadePose(layers, kf) {
  const a = layers.querySelector(".fm-layer-a");
  const b = layers.querySelector(".fm-layer-b");
  if (!a || !b) return;

  const visible = a.classList.contains("fm-layer-visible") ? a : b;
  if (visible.getAttribute("src") === kf.src) return;

  const incoming = a.classList.contains("fm-layer-visible") ? b : a;
  const outgoing = incoming === a ? b : a;

  incoming.setAttribute("src", kf.src);
  incoming.classList.remove("fm-panda-flip");
  incoming.hidden = false;
  incoming.classList.add("fm-layer-visible", "fm-layer-in");
  outgoing.classList.add("fm-layer-out");
  outgoing.classList.remove("fm-layer-visible");

  setTimeout(() => {
    outgoing.classList.remove("fm-layer-out");
    incoming.classList.remove("fm-layer-in");
  }, 90);
}

function animationLoop(now) {
  if (!_state) return;

  const { frames, frameIdx, frameStart, layers } = _state;
  const kf = frames[frameIdx];
  const elapsed = now - frameStart;

  if (elapsed >= kf.ms) {
    const nextIdx = (frameIdx + 1) % frames.length;
    crossfadePose(layers, frames[nextIdx]);
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

  const layers = sprite.querySelector(".fm-panda-layers");
  const layerA = sprite.querySelector(".fm-layer-a");
  if (layerA) layerA.classList.add("fm-layer-visible");

  _state = {
    stageId,
    frames,
    frameIdx: 0,
    frameStart: performance.now(),
    layers,
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
