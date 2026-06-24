/** 자연스러운 펫 모션 — 연속 호흡·흔들림 + 가끔 제스처 */

const POSES = {
  front: "assets/pet/char-front.png",
  heart: "assets/pet/char-heart.png",
  wave: "assets/pet/char-wave.png",
};

const STAGE_CFG = {
  1: { src: POSES.front, egg: true, gestures: ["peek", "hop"] },
  2: { src: POSES.front, gestures: ["hop", "happy"] },
  3: { src: POSES.front, gestures: ["hop", "happy", "wave"], gestureSrc: POSES.wave },
  4: { src: POSES.heart, gestures: ["happy", "hop"] },
  5: { src: POSES.wave, gestures: ["wave", "hop", "happy"] },
  6: { src: POSES.wave, gestures: ["wave", "happy", "hop"], gestureSrc: POSES.heart },
};

let _raf = null;
let _gestureTimer = null;
let _state = null;

function eggShell() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" aria-hidden="true" class="fm-egg-shell">
    <ellipse cx="60" cy="82" rx="36" ry="30" fill="#B6D8F2" stroke="#1a1a1a" stroke-width="3.4" stroke-linejoin="round"/>
    <path d="M30 72 Q60 58 90 72" stroke="#1a1a1a" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  </svg>`;
}

function buildDOM(cfg) {
  const img = `<img src="${cfg.src}" alt="" class="fm-panda-art" draggable="false" decoding="async">`;
  const inner = cfg.egg
    ? `<div class="fm-panda-egg"><div class="fm-panda-peek-wrap">${img}</div>${eggShell()}</div>`
    : img;
  return `<div class="fm-panda-motion">${inner}</div>`;
}

function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

/** 매 프레임 부드러운 idle — 여러 sin파를 섞어 살아있는 느낌 */
function idleMotion(t, stageId) {
  const amp = stageId === 1 ? 0.65 : 1;
  const ty =
    (Math.sin(t * 1.12) * 1.6 + Math.sin(t * 2.27 + 0.4) * 0.35) * amp;
  const tx = Math.sin(t * 0.36 + 1.1) * 0.7 * amp;
  const rot =
    (Math.sin(t * 0.41 + 0.2) * 0.9 + Math.sin(t * 0.19) * 0.35) * amp;
  const sy = 1 + Math.sin(t * 1.12) * 0.01 * amp;
  const sx = 1 - Math.sin(t * 1.12) * 0.005 * amp;
  return { ty, tx, rot, sx, sy };
}

/** 제스처는 짧고 물리감 있게 — idle 위에 더함 */
function gestureOffset(name, p) {
  const e = easeInOutSine(Math.min(1, Math.max(0, p)));

  switch (name) {
    case "hop": {
      const up = p < 0.38 ? Math.sin((p / 0.38) * Math.PI) : 0;
      const land = p >= 0.38 ? Math.exp(-((p - 0.38) * 9)) * 0.55 : 0;
      const ty = -(up * 10 + land * 2.5);
      const sy = p > 0.36 && p < 0.52 ? 0.9 + (p - 0.36) * 0.5 : 1;
      const sx = p > 0.36 && p < 0.52 ? 1.04 - (p - 0.36) * 0.2 : 1;
      return { ty, tx: 0, rot: up * -2, sx, sy };
    }
    case "happy": {
      const wiggle = Math.sin(p * Math.PI * 4) * (1 - e) * 3.5;
      return { ty: -e * 3, tx: wiggle, rot: wiggle * 0.55, sx: 1, sy: 1 };
    }
    case "peek": {
      const rise = Math.sin(e * Math.PI) * 5;
      return { ty: -rise, tx: 0, rot: e * 2.5, sx: 1, sy: 1 };
    }
    case "wave": {
      const sway = Math.sin(e * Math.PI) * 4;
      return { ty: -sway * 0.6, tx: sway * 0.35, rot: sway * 0.45, sx: 1, sy: 1 };
    }
    case "heart": {
      const lean = Math.sin(e * Math.PI);
      return { ty: -lean * 2, tx: -lean * 1.5, rot: -lean * 3, sx: 1, sy: 1 };
    }
    default:
      return { ty: 0, tx: 0, rot: 0, sx: 1, sy: 1 };
  }
}

function gestureDuration(name) {
  return { hop: 820, happy: 1050, peek: 1300, wave: 1150, heart: 980 }[name] || 900;
}

function applyTransform(el, m) {
  el.style.transform = `translate3d(${m.tx}px, ${m.ty}px, 0) rotate(${m.rot}deg) scale(${m.sx}, ${m.sy})`;
}

function blendMotion(a, b, amount) {
  const k = Math.min(1, Math.max(0, amount));
  return {
    ty: a.ty + b.ty * k,
    tx: a.tx + b.tx * k,
    rot: a.rot + b.rot * k,
    sx: a.sx * (1 + (b.sx - 1) * k),
    sy: a.sy * (1 + (b.sy - 1) * k),
  };
}

function swapPoseImage(imgEl, src, homeSrc) {
  if (!imgEl || imgEl.getAttribute("src") === src) return;
  imgEl.classList.add("fm-panda-fade");
  requestAnimationFrame(() => {
    imgEl.src = src;
    imgEl.classList.remove("fm-panda-fade");
  });
  if (homeSrc && src !== homeSrc) {
    clearTimeout(imgEl._restoreTimer);
    imgEl._restoreTimer = setTimeout(() => {
      swapPoseImage(imgEl, homeSrc, homeSrc);
    }, gestureDuration("wave") + 200);
  }
}

function pickGesture(cfg) {
  const list = cfg.gestures || ["hop"];
  return list[Math.floor(Math.random() * list.length)];
}

function scheduleGesture() {
  if (!_state) return;
  const wait = 9000 + Math.random() * 9000;
  _gestureTimer = setTimeout(() => {
    if (!_state) return;
    if (_state.gesture) {
      scheduleGesture();
      return;
    }
    const name = pickGesture(_state.cfg);
    const useAlt =
      (name === "wave" || name === "heart") && _state.cfg.gestureSrc;
    if (useAlt && _state.imgEl) {
      swapPoseImage(_state.imgEl, _state.cfg.gestureSrc, _state.cfg.src);
    }
    _state.gesture = {
      name,
      start: performance.now(),
      duration: gestureDuration(name),
    };
  }, wait);
}

function animationLoop(now) {
  if (!_state) return;
  const t = (now - _state.t0) / 1000;
  let motion = idleMotion(t, _state.stageId);

  if (_state.gesture) {
    const g = _state.gesture;
    const p = (now - g.start) / g.duration;
    if (p >= 1) {
      _state.gesture = null;
      scheduleGesture();
    } else {
      const fade = p < 0.12 ? p / 0.12 : p > 0.88 ? (1 - p) / 0.12 : 1;
      motion = blendMotion(motion, gestureOffset(g.name, p), fade);
    }
  }

  applyTransform(_state.motionEl, motion);
  _raf = requestAnimationFrame(animationLoop);
}

export const PANDA_FRAME_COUNT = 1;

export function startPandaAnimation(stageId) {
  stopPandaAnimation();
  const sprite = document.querySelector(".fm-panda-sprite");
  if (!sprite) return;

  const cfg = STAGE_CFG[stageId] || STAGE_CFG[1];
  sprite.innerHTML = buildDOM(cfg);

  _state = {
    stageId,
    cfg,
    motionEl: sprite.querySelector(".fm-panda-motion"),
    imgEl: sprite.querySelector(".fm-panda-art"),
    t0: performance.now(),
    gesture: null,
  };

  _raf = requestAnimationFrame(animationLoop);
  scheduleGesture();
}

export function stopPandaAnimation() {
  if (_raf) {
    cancelAnimationFrame(_raf);
    _raf = null;
  }
  if (_gestureTimer) {
    clearTimeout(_gestureTimer);
    _gestureTimer = null;
  }
  if (_state?.imgEl?._restoreTimer) {
    clearTimeout(_state.imgEl._restoreTimer);
  }
  _state = null;
}
