/** 사용자 손그림 PNG — 200+ 프로시저럴 몸동작 포즈 */

const POSES = {
  front: "assets/pet/char-front.png",
  heart: "assets/pet/char-heart.png",
  wave: "assets/pet/char-wave.png",
};

const HAIR = [
  "assets/pet/hair-01.png",
  "assets/pet/hair-02.png",
  "assets/pet/hair-03.png",
  "assets/pet/hair-04.png",
  "assets/pet/hair-05.png",
  "assets/pet/hair-06.png",
  "assets/pet/hair-07.png",
  "assets/pet/hair-08.png",
  "assets/pet/hair-09.png",
];

const POSE_COUNT = 200;

/** 20가지 기본 동작 × 10 variation = 200포즈 */
const BASE_MOTIONS = [
  { tag: "서있기", ty: 0, tx: 0, rot: 0, sx: 1, sy: 1 },
  { tag: "살짝왼쪽", ty: -1, tx: -2, rot: -3, sx: 1, sy: 1 },
  { tag: "살짝오른쪽", ty: -1, tx: 2, rot: 3, sx: 1, sy: 1 },
  { tag: "통통1", ty: -4, tx: 0, rot: -1, sx: 1.02, sy: 1.03 },
  { tag: "통통2", ty: -8, tx: 0, rot: 0, sx: 1.03, sy: 1.04 },
  { tag: "높이뛰기", ty: -13, tx: 0, rot: 1, sx: 1.06, sy: 1.06 },
  { tag: "착지눌림", ty: 2, tx: 0, rot: 0, sx: 1.07, sy: 0.88 },
  { tag: "흔들왼", ty: -3, tx: -4, rot: -8, sx: 1.01, sy: 1 },
  { tag: "흔들오른", ty: -3, tx: 4, rot: 8, sx: 1.01, sy: 1 },
  { tag: "앞으로숙임", ty: -2, tx: -3, rot: -6, sx: 1.02, sy: 0.96 },
  { tag: "뒤로쪼그림", ty: 1, tx: 0, rot: 2, sx: 0.96, sy: 0.94 },
  { tag: "손흔들기", ty: -6, tx: 2, rot: 5, sx: 1.03, sy: 1.02 },
  { tag: "하트던지기", ty: -5, tx: -2, rot: -5, sx: 1.02, sy: 1.02 },
  { tag: "깡총깡총", ty: -10, tx: 1, rot: -4, sx: 1.04, sy: 1.05 },
  { tag: "수줍", ty: 0, tx: 0, rot: 0, sx: 0.94, sy: 0.96 },
  { tag: "뿌듯", ty: -4, tx: 0, rot: 0, sx: 1.05, sy: 1.05 },
  { tag: "알에서고개", ty: -5, tx: 0, rot: 2, sx: 0.95, sy: 0.97 },
  { tag: "알에서삐짐", ty: -3, tx: -3, rot: -6, sx: 0.93, sy: 0.95 },
  { tag: "빙글", ty: -4, tx: 0, rot: -11, sx: 1.02, sy: 1.01 },
  { tag: "콩닥콩닥", ty: -6, tx: -2, rot: 6, sx: 1.03, sy: 0.98 },
];

const STAGE_SRC_POOL = {
  1: () => [POSES.front],
  2: () => [HAIR[0], HAIR[1], POSES.front, POSES.front],
  3: () => [HAIR[2], HAIR[3], POSES.front, POSES.wave, POSES.front],
  4: () => [POSES.front, POSES.heart, POSES.heart, POSES.front, HAIR[4]],
  5: () => [POSES.wave, POSES.front, POSES.heart, POSES.wave, HAIR[7], POSES.front],
  6: () => [POSES.wave, POSES.heart, POSES.wave, POSES.front, HAIR[8], POSES.heart],
};

function isHairSrc(src) {
  return src.includes("hair-");
}

function isBodySrc(src, key) {
  return src === POSES[key];
}

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function generatePoseLibrary(stageId) {
  const pool = STAGE_SRC_POOL[stageId]?.() || STAGE_SRC_POOL[1]();
  const rand = mulberry32(stageId * 9973 + 42);
  const poses = [];

  for (let i = 0; i < POSE_COUNT; i++) {
    const base = BASE_MOTIONS[i % BASE_MOTIONS.length];
    const varIdx = Math.floor(i / BASE_MOTIONS.length);
    const jitter = rand() * 2 - 1;
    const src = pool[i % pool.length];
    const egg = stageId === 1 && (base.tag.startsWith("알") || i % 4 === 0);
    const bust = isHairSrc(src);
    const flip =
      (isBodySrc(src, "wave") && i % 3 === 0) ||
      (isBodySrc(src, "heart") && i % 5 === 1) ||
      (bust && i % 6 === 2);

    poses.push({
      src,
      egg,
      bust,
      flip,
      ty: round1(base.ty + varIdx * -0.35 + jitter * 0.8),
      tx: round1(base.tx + (varIdx % 3 - 1) * 1.2 + jitter * 1.5),
      rot: round1(base.rot + (varIdx % 5 - 2) * 1.8 + jitter * 2),
      sx: round1(Math.max(0.9, Math.min(1.1, base.sx + varIdx * 0.004 + jitter * 0.01))),
      sy: round1(Math.max(0.86, Math.min(1.08, base.sy + varIdx * 0.003 + jitter * 0.01))),
      ms: 260 + (i % 9) * 35 + Math.floor(rand() * 40),
    });
  }

  return poses;
}

const STAGE_POSES = Object.fromEntries(
  [1, 2, 3, 4, 5, 6].map((id) => [id, generatePoseLibrary(id)])
);

function eggShell() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" aria-hidden="true" class="fm-egg-shell">
    <ellipse cx="60" cy="82" rx="36" ry="30" fill="#B6D8F2" stroke="#1a1a1a" stroke-width="3.4" stroke-linejoin="round"/>
    <path d="M30 72 Q60 58 90 72" stroke="#1a1a1a" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  </svg>`;
}

function buildFrame(frame) {
  const bust = frame.bust ? " fm-panda-bust" : "";
  const flip = frame.flip ? " fm-panda-flip" : "";
  const img = `<img src="${frame.src}" alt="" class="fm-panda-art${bust}${flip}" draggable="false" decoding="async">`;

  if (frame.egg) {
    return `<div class="fm-panda-egg">
      <div class="fm-panda-peek-wrap">${img}</div>
      ${eggShell()}
    </div>`;
  }

  return img;
}

function applyPoseTransform(el, frame) {
  el.style.setProperty("--fm-tx", `${frame.tx}px`);
  el.style.setProperty("--fm-ty", `${frame.ty}px`);
  el.style.setProperty("--fm-rot", `${frame.rot}deg`);
  el.style.setProperty("--fm-sx", String(frame.sx));
  el.style.setProperty("--fm-sy", String(frame.sy));
}

export const PANDA_FRAME_COUNT = POSE_COUNT;

export function getPoseFrames(stageId) {
  return STAGE_POSES[stageId] || STAGE_POSES[1];
}

let _animTimer = null;

export function startPandaAnimation(stageId) {
  stopPandaAnimation();
  const el = document.querySelector(".fm-panda-sprite");
  if (!el) return;

  const frames = getPoseFrames(stageId);
  let i = 0;

  const tick = () => {
    const frame = frames[i];
    el.innerHTML = buildFrame(frame);
    el.className = "fm-panda-sprite";
    applyPoseTransform(el, frame);
    const ms = frame.ms || 340;
    i = (i + 1) % frames.length;
    _animTimer = setTimeout(tick, ms);
  };

  tick();
}

export function stopPandaAnimation() {
  if (_animTimer) {
    clearTimeout(_animTimer);
    _animTimer = null;
  }
}
