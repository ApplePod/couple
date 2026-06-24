/** 손그림 느낌 노랑 판다 펫 — 굵은 선, 점눈, 윙 입, 파란 잠옷 */

const C = {
  ink: "#1a1a1a",
  cream: "#F9E4B7",
  blue: "#B6D8F2",
  blush: "#FF6B5A",
  heart: "#EF7C6C",
  egg: "#B6D8F2",
  tri: "#EF7C6C",
  dot: "#8FD694",
  sq: "#FFD166",
  balloon: "#FF8F75",
};

const SW = 3.4;

function svgWrap(body, { y = 0, rot = 0 } = {}) {
  const inner = rot || y
    ? `<g transform="translate(60 ${72 + y}) rotate(${rot}) translate(-60 -72)">${body}</g>`
    : body;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">${inner}</svg>`;
}

function blush(x, y, r = 10) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.blush}" opacity=".28"/>`;
}

function fluffyHead(cx, cy, r) {
  return `<path d="M${cx} ${cy - r + 3}
    C${cx - r - 3} ${cy - r} ${cx - r - 2} ${cy + r * 0.35} ${cx - r + 3} ${cy + r - 2}
    C${cx - r * 0.4} ${cy + r + 2} ${cx + r * 0.4} ${cy + r + 2} ${cx + r - 3} ${cy + r - 2}
    C${cx + r + 2} ${cy + r * 0.35} ${cx + r + 3} ${cy - r} ${cx} ${cy - r + 3}Z"
    fill="${C.cream}" stroke="${C.ink}" stroke-width="${SW}" stroke-linejoin="round" stroke-linecap="round"/>`;
}

function doodleEars(cx, cy, r, s = 1) {
  const ex = 13 * s;
  const ey = 15 * s;
  return `
    <ellipse cx="${cx - ex}" cy="${cy - r + 6}" rx="${7 * s}" ry="${8 * s}" fill="${C.ink}" stroke="${C.ink}" stroke-width="${SW * 0.7}"/>
    <ellipse cx="${cx + ex}" cy="${cy - r + 6}" rx="${7 * s}" ry="${8 * s}" fill="${C.ink}" stroke="${C.ink}" stroke-width="${SW * 0.7}"/>`;
}

function doodleFace(cx, cy, { blink = false, brows = 1 } = {}) {
  const eyes = blink
    ? `<path d="M${cx - 12} ${cy + 2}h5 M${cx + 7} ${cy + 2}h5" stroke="${C.ink}" stroke-width="2.8" stroke-linecap="round"/>`
    : `<circle cx="${cx - 9}" cy="${cy}" r="2.5" fill="${C.ink}"/>
       <circle cx="${cx + 9}" cy="${cy}" r="2.5" fill="${C.ink}"/>`;
  return `
    ${blush(cx - 18, cy + 11)}
    ${blush(cx + 18, cy + 11)}
    <ellipse cx="${cx - 12}" cy="${cy - 1}" rx="10" ry="11" fill="${C.ink}"/>
    <ellipse cx="${cx + 12}" cy="${cy - 1}" rx="10" ry="11" fill="${C.ink}"/>
    <path d="M${cx - 18} ${cy - 11}l6 ${3 * brows}" stroke="${C.ink}" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M${cx + 12} ${cy - 11}l6 ${3 * brows}" stroke="${C.ink}" stroke-width="2.8" stroke-linecap="round"/>
    ${eyes}
    <path d="M${cx - 4} ${cy + 10}l4 3l4-3" stroke="${C.ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
}

function onesie(cx, cy, w, h, pattern = "dots") {
  let deco = "";
  if (pattern === "dots") {
    deco = `<circle cx="${cx - 7}" cy="${cy + 5}" r="2.2" fill="#fff"/>
            <circle cx="${cx}" cy="${cy + 8}" r="2.2" fill="#fff"/>
            <circle cx="${cx + 7}" cy="${cy + 5}" r="2.2" fill="#fff"/>`;
  } else {
    deco = `<polygon points="${cx - 8},${cy + 3} ${cx - 3},${cy + 10} ${cx - 13},${cy + 10}" fill="${C.tri}" stroke="${C.ink}" stroke-width="1.2"/>
            <circle cx="${cx + 2}" cy="${cy + 7}" r="2.8" fill="${C.dot}" stroke="${C.ink}" stroke-width="1.2"/>
            <rect x="${cx + 7}" y="${cy + 4}" width="5" height="5" fill="${C.sq}" stroke="${C.ink}" stroke-width="1.2"/>`;
  }
  return `<path d="M${cx - w} ${cy}
      Q${cx} ${cy + h + 5} ${cx + w} ${cy}
      L${cx + w - 3} ${cy + h}
      Q${cx} ${cy + h + 7} ${cx - w + 3} ${cy + h}Z"
      fill="${C.blue}" stroke="${C.ink}" stroke-width="${SW}" stroke-linejoin="round"/>
    ${deco}
    <circle cx="${cx}" cy="${cy + 10}" r="4" fill="#fff" stroke="${C.ink}" stroke-width="1.6"/>`;
}

function stubArm(x, y, rot, long = false) {
  const h = long ? 14 : 10;
  return `<g transform="translate(${x} ${y}) rotate(${rot})">
    <ellipse cx="0" cy="${h / 2}" rx="5.5" ry="${h / 2}" fill="${C.cream}" stroke="${C.ink}" stroke-width="${SW - 0.8}"/>
  </g>`;
}

function doodleHeart(x, y, s = 1) {
  return `<path transform="translate(${x} ${y}) scale(${s})"
    d="M0 2 C-5.5-4.5 -10 1.5 0 9.5 C10 1.5 5.5-4.5 0 2Z"
    fill="${C.heart}" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round"/>`;
}

function buildPet(stage, frame, scale) {
  const s = scale;
  const cx = 60;
  const headY = 38 - (stage - 1) * 1.5;
  const headR = 22 + stage * 1.8;
  const bounce = frame === 2 ? -5 : frame === 4 ? -3 : frame === 1 ? -2 : 0;
  const tilt = frame === 3 ? -4 : frame === 4 ? 3 : 0;
  const blink = frame === 3;

  if (stage === 1) {
    const body = `
      <ellipse cx="${cx}" cy="88" rx="${34 * s}" ry="${26 * s}" fill="${C.egg}" stroke="${C.ink}" stroke-width="${SW}"/>
      <path d="M32 78 Q60 66 88 78" stroke="${C.ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <g transform="translate(${cx} ${headY + 30}) scale(${0.72 * s})">
        ${doodleEars(0, -8, 14)}
        ${fluffyHead(0, 2, 14)}
        ${doodleFace(0, 6, { blink, brows: 1.2 })}
      </g>
      ${frame === 2 ? doodleHeart(cx + 18, 28, 0.9) : ""}
      ${frame === 4 ? doodleHeart(cx - 20, 32, 0.7) : ""}`;
    return svgWrap(body, { y: bounce, rot: tilt });
  }

  const bodyY = headY + headR - 4;
  const bodyW = 14 + stage * 1.5;
  const bodyH = 16 + stage * 1.2;
  const pattern = stage >= 5 ? "shapes" : "dots";

  let arms = `${stubArm(cx - bodyW - 2, bodyY + 6, -25)}
              ${stubArm(cx + bodyW + 2, bodyY + 6, 25)}`;
  let extra = "";

  if (stage === 2) {
    if (frame === 2 || frame === 4) {
      arms = `${stubArm(cx - bodyW - 2, bodyY + 4, -35)}
              ${stubArm(cx + bodyW + 2, bodyY + 2, -50, true)}`;
    }
  } else if (stage === 3) {
    arms = `${stubArm(cx - 10, bodyY + 2, -60, true)}
            ${stubArm(cx + 10, bodyY + 2, 60, true)}`;
    if (frame === 1 || frame === 2) {
      extra = `<ellipse cx="${cx}" cy="${bodyY + 14}" rx="12" ry="8" fill="${C.blush}" opacity=".18"/>`;
    }
  } else if (stage === 4) {
    arms = `${stubArm(cx - bodyW - 4, bodyY + 8, -20)}
            ${stubArm(cx + bodyW + 6, bodyY - 2, -55, true)}`;
    extra = doodleHeart(cx + 28, bodyY - 8, frame === 2 || frame === 4 ? 1.1 : 0.95);
  } else if (stage === 5) {
    if (frame === 2 || frame === 4) {
      arms = `${stubArm(cx - bodyW - 2, bodyY + 6, -15)}
              ${stubArm(cx + bodyW + 4, bodyY - 6, -70, true)}`;
    }
    if (frame === 4) extra = `<text x="${cx + 22}" y="${bodyY - 14}" font-size="11" fill="${C.ink}" font-weight="700">z z</text>`;
  } else if (stage === 6) {
    arms = `${stubArm(cx - bodyW - 2, bodyY + 6, -25)}
            ${stubArm(cx + bodyW + 8, bodyY - 4, -40, true)}`;
    extra = `
      <line x1="88" y1="18" x2="88" y2="40" stroke="${C.ink}" stroke-width="2"/>
      <ellipse cx="88" cy="14" rx="11" ry="13" fill="${C.balloon}" stroke="${C.ink}" stroke-width="${SW - 1}"/>
      ${frame === 2 ? `<circle cx="24" cy="30" r="3" fill="${C.sq}"/><circle cx="100" cy="48" r="2.5" fill="${C.tri}"/>` : ""}`;
  }

  const body = `
    ${doodleEars(cx, headY, headR, s)}
    ${fluffyHead(cx, headY, headR * s)}
    ${doodleFace(cx, headY + 8, { blink, brows: stage >= 4 ? 1.15 : 1 })}
    ${onesie(cx, bodyY, bodyW * s, bodyH * s, pattern)}
    ${arms}
    ${extra}
    <ellipse cx="${cx}" cy="108" rx="${20 + stage * 2}" ry="3" fill="#000" opacity=".05"/>`;

  return svgWrap(body, { y: bounce, rot: tilt });
}

const STAGE_SCALES = [0.78, 0.86, 0.94, 1.02, 1.1, 1.18];

const STAGE_BUILDERS = Object.fromEntries(
  [1, 2, 3, 4, 5, 6].map((id) => [
    id,
    (f) => buildPet(id, f, STAGE_SCALES[id - 1]),
  ])
);

export const PANDA_FRAME_COUNT = 5;

export function getPandaFrames(stageId) {
  const build = STAGE_BUILDERS[stageId] || STAGE_BUILDERS[1];
  return Array.from({ length: PANDA_FRAME_COUNT }, (_, i) => build(i));
}

let _animTimer = null;

export function startPandaAnimation(stageId) {
  stopPandaAnimation();
  const el = document.querySelector(".fm-panda-sprite");
  if (!el) return;
  const frames = getPandaFrames(stageId);
  let i = 0;
  const render = () => {
    el.innerHTML = frames[i];
    i = (i + 1) % frames.length;
  };
  render();
  _animTimer = setInterval(render, 420);
}

export function stopPandaAnimation() {
  if (_animTimer) {
    clearInterval(_animTimer);
    _animTimer = null;
  }
}
