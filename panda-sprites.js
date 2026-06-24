/**
 * 애니 스타일 펫 — 포즈 이미지(12종) × 동작 곡선 × 키프레임 ≈ 200컷
 * 각 컷: 어떤 그림(포즈) + 그 포즈 전용 움직임 한 순간
 */

const POSES = {
  front: "assets/pet/char-front.png",
  heart: "assets/pet/char-heart.png",
  wave: "assets/pet/char-wave.png",
};

const HAIR = Array.from({ length: 9 }, (_, i) =>
  `assets/pet/hair-${String(i + 1).padStart(2, "0")}.png`
);

const KEYFRAME_COUNT = 200;

const STAGE_CLIPS = {
  1: [
    ["peek", POSES.front, 14, 58, { egg: true }],
    ["stand", POSES.front, 12, 68, { egg: true }],
    ["hop", POSES.front, 16, 48, { egg: true }],
    ["shy", POSES.front, 10, 62, { egg: true }],
    ["peek", POSES.front, 12, 55, { egg: true }],
  ],
  2: [
    ["hairNod", HAIR[0], 10, 56, { bust: true }],
    ["stand", POSES.front, 12, 64, {}],
    ["hop", POSES.front, 16, 46, {}],
    ["happy", POSES.front, 14, 52, {}],
    ["hairNod", HAIR[1], 10, 58, { bust: true }],
    ["stand", POSES.front, 10, 66, {}],
    ["hop", POSES.front, 14, 48, {}],
  ],
  3: [
    ["hairNod", HAIR[2], 10, 56, { bust: true }],
    ["stand", POSES.front, 12, 62, {}],
    ["wave", POSES.wave, 18, 48, {}],
    ["hop", POSES.front, 16, 46, {}],
    ["happy", POSES.front, 14, 52, {}],
    ["wave", POSES.wave, 16, 50, { flip: true }],
    ["hairNod", HAIR[3], 10, 58, { bust: true }],
    ["stand", POSES.front, 10, 64, {}],
  ],
  4: [
    ["stand", POSES.heart, 10, 66, {}],
    ["heart", POSES.heart, 18, 50, {}],
    ["hop", POSES.heart, 14, 48, {}],
    ["happy", POSES.heart, 14, 54, {}],
    ["heart", POSES.heart, 16, 48, { flip: true }],
    ["stand", POSES.front, 10, 62, {}],
    ["hop", POSES.front, 14, 46, {}],
    ["heart", POSES.heart, 14, 52, {}],
  ],
  5: [
    ["wave", POSES.wave, 18, 48, {}],
    ["stand", POSES.wave, 10, 66, {}],
    ["hop", POSES.wave, 14, 46, {}],
    ["happy", POSES.wave, 14, 52, {}],
    ["wave", POSES.wave, 16, 50, { flip: true }],
    ["heart", POSES.heart, 16, 50, {}],
    ["hairNod", HAIR[7], 10, 58, { bust: true }],
    ["wave", POSES.wave, 14, 48, {}],
  ],
  6: [
    ["wave", POSES.wave, 18, 46, {}],
    ["heart", POSES.heart, 18, 50, {}],
    ["happy", POSES.wave, 14, 52, {}],
    ["hop", POSES.wave, 16, 44, {}],
    ["wave", POSES.wave, 16, 48, { flip: true }],
    ["heart", POSES.heart, 14, 52, {}],
    ["hairNod", HAIR[8], 10, 58, { bust: true }],
    ["proud", POSES.wave, 12, 60, {}],
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
        bust: !!opts.bust,
        egg: !!opts.egg,
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

function eggShell() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" aria-hidden="true" class="fm-egg-shell">
    <ellipse cx="60" cy="82" rx="36" ry="30" fill="#B6D8F2" stroke="#1a1a1a" stroke-width="3.4" stroke-linejoin="round"/>
    <path d="M30 72 Q60 58 90 72" stroke="#1a1a1a" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  </svg>`;
}

function buildDOM(firstKf) {
  const layers = `<div class="fm-panda-layers">
    <img src="${firstKf.src}" alt="" class="fm-panda-art fm-layer fm-layer-a${firstKf.bust ? " fm-panda-bust" : ""}${firstKf.flip ? " fm-panda-flip" : ""}" draggable="false" decoding="async">
    <img src="${firstKf.src}" alt="" class="fm-panda-art fm-layer fm-layer-b" hidden draggable="false" decoding="async">
  </div>`;

  if (firstKf.egg) {
    return `<div class="fm-panda-motion">
      <div class="fm-panda-egg"><div class="fm-panda-peek-wrap">${layers}</div>${eggShell()}</div>
    </div>`;
  }
  return `<div class="fm-panda-motion">${layers}</div>`;
}

function applyTransform(el, m) {
  el.style.transform = `translate3d(${m.tx}px, ${m.ty}px, 0) rotate(${m.rot}deg) scale(${m.sx}, ${m.sy})`;
}

function crossfadePose(layers, kf) {
  const a = layers.querySelector(".fm-layer-a");
  const b = layers.querySelector(".fm-layer-b");
  if (!a || !b) return;

  const nextSrc = kf.src;
  if (a.getAttribute("src") === nextSrc && !kf.flip) {
    a.classList.toggle("fm-panda-bust", !!kf.bust);
    a.classList.toggle("fm-panda-flip", !!kf.flip);
    return;
  }

  const incoming = a.classList.contains("fm-layer-visible") ? b : a;
  const outgoing = incoming === a ? b : a;

  incoming.setAttribute("src", nextSrc);
  incoming.classList.toggle("fm-panda-bust", !!kf.bust);
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
    if (next.src !== kf.src || next.flip !== kf.flip || next.bust !== kf.bust) {
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
