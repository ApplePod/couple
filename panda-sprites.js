/**
 * 애니 스타일 펫 — 전신 포즈 5종 × 옷 변화 × 200키프레임
 * 물방울 잠옷 / 웃음 / 도형 패턴 / 하트 / 노란 셔츠
 */

const POSES = {
  front: "assets/pet/char-front.png",
  laugh: "assets/pet/char-laugh.png",
  heart: "assets/pet/char-heart.png",
  wave: "assets/pet/char-wave.png",
  peek: "assets/pet/char-peek.png",
};

const KEYFRAME_COUNT = 200;

/** [동작이름, 포즈이미지, 컷수, ms, { flip? }] */
const STAGE_CLIPS = {
  1: [
    ["stand", POSES.front, 14, 70, {}],
    ["hop", POSES.front, 16, 50, {}],
    ["shy", POSES.front, 12, 64, {}],
    ["happy", POSES.front, 14, 56, {}],
    ["stand", POSES.front, 12, 68, {}],
  ],
  2: [
    ["stand", POSES.front, 12, 66, {}],
    ["laugh", POSES.laugh, 18, 52, {}],
    ["hop", POSES.front, 14, 48, {}],
    ["happy", POSES.laugh, 14, 54, {}],
    ["stand", POSES.laugh, 10, 68, {}],
    ["shy", POSES.front, 10, 62, {}],
  ],
  3: [
    ["stand", POSES.front, 10, 64, {}],
    ["wave", POSES.wave, 20, 48, {}],
    ["laugh", POSES.laugh, 16, 50, {}],
    ["hop", POSES.wave, 14, 46, {}],
    ["happy", POSES.wave, 14, 52, {}],
    ["wave", POSES.wave, 16, 48, { flip: true }],
  ],
  4: [
    ["heart", POSES.heart, 18, 50, {}],
    ["wave", POSES.wave, 16, 48, {}],
    ["laugh", POSES.laugh, 14, 52, {}],
    ["hop", POSES.heart, 14, 46, {}],
    ["happy", POSES.heart, 12, 54, {}],
    ["heart", POSES.heart, 14, 48, { flip: true }],
    ["stand", POSES.wave, 10, 64, {}],
  ],
  5: [
    ["peek", POSES.peek, 16, 54, {}],
    ["wave", POSES.wave, 18, 48, {}],
    ["heart", POSES.heart, 16, 50, {}],
    ["laugh", POSES.laugh, 14, 52, {}],
    ["hop", POSES.peek, 14, 44, {}],
    ["happy", POSES.peek, 12, 56, {}],
    ["wave", POSES.wave, 14, 48, { flip: true }],
  ],
  6: [
    ["peek", POSES.peek, 16, 50, {}],
    ["wave", POSES.wave, 18, 46, {}],
    ["heart", POSES.heart, 18, 48, {}],
    ["laugh", POSES.laugh, 16, 50, {}],
    ["happy", POSES.peek, 14, 52, {}],
    ["hop", POSES.wave, 14, 44, {}],
    ["proud", POSES.heart, 12, 58, {}],
    ["peek", POSES.peek, 12, 54, { flip: true }],
  ],
};

let _raf = null;
let _state = null;

function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpMotion(a, b, t) {
  return {
    ty: lerp(a.ty, b.ty, t),
    tx: lerp(a.tx, b.tx, t),
    rot: lerp(a.rot, b.rot, t),
    sx: lerp(a.sx, b.sx, t),
    sy: lerp(a.sy, b.sy, t),
  };
}

/** 포즈별 전용 동작 곡선 — p: 0~1 컷 내 진행도, v: 변형 번호 */
const MOTION = {
  stand(p, v = 0) {
    const o = v * 0.22;
    const s = Math.sin((p + o) * Math.PI * 2);
    return {
      ty: s * 1.6,
      tx: Math.sin((p + o) * Math.PI) * 0.5,
      rot: s * 1.1,
      sx: 1 - s * 0.004,
      sy: 1 + s * 0.011,
    };
  },
  hop(p) {
    if (p < 0.12) {
      const t = p / 0.12;
      return { ty: t * 2, tx: 0, rot: 0, sx: 1 + t * 0.04, sy: 1 - t * 0.06 };
    }
    if (p < 0.42) {
      const t = (p - 0.12) / 0.3;
      const up = Math.sin(t * Math.PI);
      return { ty: -up * 12, tx: 0, rot: -up * 2.5, sx: 1.02 - t * 0.02, sy: 1.04 };
    }
    if (p < 0.58) {
      const t = (p - 0.42) / 0.16;
      return { ty: lerp(-12, 2, t), tx: 0, rot: lerp(-2.5, 0, t), sx: 1.06, sy: lerp(1.04, 0.88, t) };
    }
    const t = (p - 0.58) / 0.42;
    return { ty: 2 * (1 - easeOutQuad(t)), tx: 0, rot: 0, sx: lerp(1.06, 1, t), sy: lerp(0.88, 1, t) };
  },
  wave(p, v = 0) {
    const flip = v % 2 ? -1 : 1;
    const s = Math.sin(p * Math.PI);
    const w = Math.sin(p * Math.PI * 3) * s;
    return {
      ty: -s * 5 - w * 0.8,
      tx: flip * (s * 2.5 + w * 0.5),
      rot: flip * (s * 5 + w * 0.4),
      sx: 1 + s * 0.015,
      sy: 1 + s * 0.01,
    };
  },
  heart(p, v = 0) {
    const flip = v % 2 ? -1 : 1;
    const e = easeInOutSine(p);
    const throwP = p > 0.5 ? (p - 0.5) * 2 : 0;
    return {
      ty: -e * 4 - throwP * 2,
      tx: flip * (-e * 3 + throwP * 4),
      rot: flip * (-e * 5 - throwP * 3),
      sx: 1 + e * 0.02,
      sy: 1 + e * 0.015,
    };
  },
  happy(p) {
    const e = easeInOutSine(Math.min(1, p * 1.2));
    const w = Math.sin(p * Math.PI * 5) * (1 - p * 0.35) * 4;
    return { ty: -e * 3.5, tx: w, rot: w * 0.55, sx: 1, sy: 1 + e * 0.008 };
  },
  laugh(p, v = 0) {
    const o = v * 0.18;
    const bounce = Math.sin((p + o) * Math.PI * 2);
    const giggle = Math.sin((p + o) * Math.PI * 6) * (1 - p * 0.2) * 2.5;
    return {
      ty: -Math.abs(bounce) * 4 - giggle * 0.6,
      tx: giggle,
      rot: bounce * 2.2 + giggle * 0.35,
      sx: 1 + bounce * 0.018,
      sy: 1 + Math.abs(bounce) * 0.012,
    };
  },
  peek(p) {
    const rise = Math.sin(easeInOutSine(p) * Math.PI);
    return { ty: -rise * 7, tx: 0, rot: rise * 3, sx: 1, sy: 1 - rise * 0.02 };
  },
  shy(p) {
    const e = Math.sin(p * Math.PI);
    return { ty: e * 1.5, tx: 0, rot: 0, sx: 1 - e * 0.05, sy: 1 - e * 0.03 };
  },
  proud(p) {
    const e = easeInOutSine(p);
    return { ty: -e * 4, tx: 0, rot: 0, sx: 1 + e * 0.04, sy: 1 + e * 0.03 };
  },
  hairNod(p, v = 0) {
    const o = v * 0.1;
    const s = Math.sin((p + o) * Math.PI * 2);
    return { ty: s * 2.2, tx: 0, rot: s * 2.8, sx: 1, sy: 1 + s * 0.008 };
  },
};

function sampleMotion(name, p, variation) {
  const fn = MOTION[name] || MOTION.stand;
  return fn(p, variation);
}

function buildKeyframeLibrary(stageId) {
  const clips = STAGE_CLIPS[stageId] || STAGE_CLIPS[1];
  const frames = [];
  let clipIdx = 0;
  let variation = 0;

  while (frames.length < KEYFRAME_COUNT) {
    const [motion, src, count, ms, opts = {}] = clips[clipIdx % clips.length];
    for (let i = 0; i < count && frames.length < KEYFRAME_COUNT; i++) {
      frames.push({
        src,
        motion,
        p: count > 1 ? i / (count - 1) : 0.5,
        ms: ms + (variation % 4) * 3,
        variation: variation % 12,
        flip: !!opts.flip,
      });
      variation++;
    }
    clipIdx++;
  }

  return frames;
}

const STAGE_LIBRARIES = Object.fromEntries(
  [1, 2, 3, 4, 5, 6].map((id) => [id, buildKeyframeLibrary(id)])
);

function buildDOM(firstKf) {
  const flip = firstKf.flip ? " fm-panda-flip" : "";
  return `<div class="fm-panda-motion">
    <div class="fm-panda-layers">
      <img src="${firstKf.src}" alt="" class="fm-panda-art fm-layer fm-layer-a fm-layer-visible${flip}" draggable="false" decoding="async">
      <img src="${firstKf.src}" alt="" class="fm-panda-art fm-layer fm-layer-b" hidden draggable="false" decoding="async">
    </div>
  </div>`;
}

function applyTransform(el, m) {
  el.style.transform = `translate3d(${m.tx}px, ${m.ty}px, 0) rotate(${m.rot}deg) scale(${m.sx}, ${m.sy})`;
}

function crossfadePose(layers, kf) {
  const a = layers.querySelector(".fm-layer-a");
  const b = layers.querySelector(".fm-layer-b");
  if (!a || !b) return;

  const nextSrc = kf.src;
  const visible = a.classList.contains("fm-layer-visible") ? a : b;
  if (visible.getAttribute("src") === nextSrc && visible.classList.contains("fm-panda-flip") === !!kf.flip) {
    return;
  }

  const incoming = a.classList.contains("fm-layer-visible") ? b : a;
  const outgoing = incoming === a ? b : a;

  incoming.setAttribute("src", nextSrc);
  incoming.classList.toggle("fm-panda-flip", !!kf.flip);
  incoming.hidden = false;
  incoming.classList.add("fm-layer-visible", "fm-layer-in");
  outgoing.classList.add("fm-layer-out");
  outgoing.classList.remove("fm-layer-visible");

  setTimeout(() => {
    outgoing.classList.remove("fm-layer-out");
    incoming.classList.remove("fm-layer-in");
  }, 120);
}

function animationLoop(now) {
  if (!_state) return;

  const { frames, frameIdx, frameStart, motionEl, layers } = _state;
  const kf = frames[frameIdx];
  const nextKf = frames[(frameIdx + 1) % frames.length];
  const elapsed = now - frameStart;
  const t = Math.min(1, elapsed / kf.ms);

  const m0 = sampleMotion(kf.motion, kf.p, kf.variation);
  const m1 = sampleMotion(nextKf.motion, nextKf.p, nextKf.variation);
  const blend = easeInOutSine(t);
  applyTransform(motionEl, lerpMotion(m0, m1, blend * 0.35));

  if (elapsed >= kf.ms) {
    const nextIdx = (frameIdx + 1) % frames.length;
    const next = frames[nextIdx];
    if (next.src !== kf.src || next.flip !== kf.flip) {
      crossfadePose(layers, next);
    }
    _state.frameIdx = nextIdx;
    _state.frameStart = now;
  }

  _raf = requestAnimationFrame(animationLoop);
}

export const PANDA_FRAME_COUNT = KEYFRAME_COUNT;

export function getPoseFrames(stageId) {
  return STAGE_LIBRARIES[stageId] || STAGE_LIBRARIES[1];
}

export function startPandaAnimation(stageId) {
  stopPandaAnimation();
  const sprite = document.querySelector(".fm-panda-sprite");
  if (!sprite) return;

  const frames = getPoseFrames(stageId);
  const first = frames[0];
  sprite.innerHTML = buildDOM(first);

  const motionEl = sprite.querySelector(".fm-panda-motion");
  const layers = sprite.querySelector(".fm-panda-layers");
  const layerA = sprite.querySelector(".fm-layer-a");
  if (layerA) layerA.classList.add("fm-layer-visible");

  _state = {
    stageId,
    frames,
    frameIdx: 0,
    frameStart: performance.now(),
    motionEl,
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
