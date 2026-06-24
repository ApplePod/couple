/** 사용자가 그린 캐릭터 PNG — 성장 단계별 포즈 + 프레임 애니메이션 */

const PET = {
  front: "assets/pet/char-front.png",
  heart: "assets/pet/char-heart.png",
  wave: "assets/pet/char-wave.png",
};

const STAGE_CONFIG = {
  1: { src: "front", egg: true },
  2: { src: "front" },
  3: { src: "front" },
  4: { src: "heart" },
  5: { src: "wave" },
  6: { src: "wave" },
};

const FRAME_CLASSES = [
  "fm-frame-0",
  "fm-frame-1",
  "fm-frame-2",
  "fm-frame-3",
  "fm-frame-4",
];

function eggShell() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" aria-hidden="true" class="fm-egg-shell">
    <ellipse cx="60" cy="82" rx="36" ry="30" fill="#B6D8F2" stroke="#1a1a1a" stroke-width="3.4" stroke-linejoin="round"/>
    <path d="M30 72 Q60 58 90 72" stroke="#1a1a1a" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  </svg>`;
}

function buildSprite(stageId) {
  const cfg = STAGE_CONFIG[stageId] || STAGE_CONFIG[1];
  const src = PET[cfg.src];

  if (cfg.egg) {
    return `<div class="fm-panda-egg">
      <img src="${src}" alt="" class="fm-panda-art fm-panda-peek" draggable="false" decoding="async">
      ${eggShell()}
    </div>`;
  }

  return `<img src="${src}" alt="" class="fm-panda-art" draggable="false" decoding="async">`;
}

export const PANDA_FRAME_COUNT = FRAME_CLASSES.length;

export function getPandaSpriteHtml(stageId) {
  return buildSprite(stageId);
}

let _animTimer = null;

export function startPandaAnimation(stageId) {
  stopPandaAnimation();
  const el = document.querySelector(".fm-panda-sprite");
  if (!el) return;

  el.innerHTML = buildSprite(stageId);
  el.classList.remove(...FRAME_CLASSES);
  el.classList.add("fm-frame-0");

  let i = 0;
  _animTimer = setInterval(() => {
    el.classList.remove(...FRAME_CLASSES);
    i = (i + 1) % FRAME_CLASSES.length;
    el.classList.add(FRAME_CLASSES[i]);
  }, 420);
}

export function stopPandaAnimation() {
  if (_animTimer) {
    clearInterval(_animTimer);
    _animTimer = null;
  }
}
