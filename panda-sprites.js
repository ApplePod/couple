/** 귀여운 노랑 판다 성장 스프라이트 — 단계별 컬러 SVG + 프레임 */

const C = {
  cream: "#FFF4D6",
  creamDark: "#F5E6B8",
  patch: "#2F2F2F",
  blush: "#FFB4A8",
  egg: "#7EC8E3",
  eggLight: "#B8E6F5",
  eggCrack: "#5BA8C9",
  heart: "#FF8FAB",
  heartDark: "#FF6B8A",
  leaf: "#8FD694",
  coin: "#FFD166",
  balloon: "#FF8F75",
  balloonStr: "#E85D4A",
  star: "#FFE566",
};

function svgWrap(body, { bounce = 0, tilt = 0 } = {}) {
  const ty = bounce ? ` translate(0 ${bounce})` : "";
  const rot = tilt ? ` rotate(${tilt} 60 78)` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
  <g transform="translate(60 78)${rot}${ty} translate(-60 -78)">${body}</g>
</svg>`;
}

function pandaFace({ blink = false, smile = 0.6, big = false } = {}) {
  const r = big ? 22 : 18;
  const eyeY = big ? -2 : 0;
  const eyes = blink
    ? `<path d="M-9 ${eyeY + 2} Q-6 ${eyeY} -3 ${eyeY + 2}" stroke="${C.patch}" stroke-width="2" fill="none" stroke-linecap="round"/>
       <path d="M3 ${eyeY + 2} Q6 ${eyeY} 9 ${eyeY + 2}" stroke="${C.patch}" stroke-width="2" fill="none" stroke-linecap="round"/>`
    : `<circle cx="-7" cy="${eyeY}" r="2.2" fill="${C.patch}"/>
       <circle cx="7" cy="${eyeY}" r="2.2" fill="${C.patch}"/>
       <circle cx="-6.2" cy="${eyeY - 0.8}" r="0.7" fill="#fff"/>
       <circle cx="7.8" cy="${eyeY - 0.8}" r="0.7" fill="#fff"/>`;
  return `
    <ellipse cx="0" cy="0" rx="${r}" ry="${r + 1}" fill="${C.cream}"/>
    <ellipse cx="-${r - 2}" cy="-${r - 1}" rx="7" ry="8" fill="${C.patch}"/>
    <ellipse cx="${r - 2}" cy="-${r - 1}" rx="7" ry="8" fill="${C.patch}"/>
    <ellipse cx="-${r + 4}" cy="4" rx="4" ry="2.5" fill="${C.blush}" opacity=".65"/>
    <ellipse cx="${r + 4}" cy="4" rx="4" ry="2.5" fill="${C.blush}" opacity=".65"/>
    ${eyes}
    <ellipse cx="0" cy="6" rx="2.2" ry="1.6" fill="${C.patch}"/>
    <path d="M-${smile * 8} 10 Q0 ${12 + smile * 2} ${smile * 8} 10" stroke="${C.patch}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
}

function ears(big = false) {
  const s = big ? 1.15 : 1;
  return `
    <ellipse cx="-16" cy="-18" rx="${7 * s}" ry="${8 * s}" fill="${C.patch}"/>
    <ellipse cx="16" cy="-18" rx="${7 * s}" ry="${8 * s}" fill="${C.patch}"/>
    <ellipse cx="-16" cy="-17" rx="${3.5 * s}" ry="${4 * s}" fill="#FFB6C1"/>
    <ellipse cx="16" cy="-17" rx="${3.5 * s}" ry="${4 * s}" fill="#FFB6C1"/>`;
}

function heart(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <path d="M0 3 C-6 -4 -12 2 0 10 C12 2 6 -4 0 3Z" fill="${C.heart}"/>
    <circle cx="-2.5" cy="1" r="1.2" fill="#fff" opacity=".45"/>
  </g>`;
}

function speckles() {
  let s = "";
  const pts = [[-12, -28], [8, -32], [18, -18], [-20, -12], [0, -36], [14, -8]];
  pts.forEach(([x, y], i) => {
    s += `<circle cx="${x}" cy="${y}" r="${1.2 + (i % 2)}" fill="${C.eggLight}" opacity=".85"/>`;
  });
  return s;
}

const STAGE_BUILDERS = {
  1: (f) => {
    const bounce = f === 2 ? -4 : f === 1 ? -2 : 0;
    const blink = f === 3;
    return svgWrap(`
      <ellipse cx="60" cy="82" rx="34" ry="28" fill="${C.egg}"/>
      ${speckles()}
      <path d="M28 70 Q60 58 92 70 L88 96 Q60 108 32 96Z" fill="${C.eggCrack}" opacity=".35"/>
      <path d="M34 74 Q60 64 86 74" stroke="${C.eggLight}" stroke-width="2" fill="none" opacity=".6"/>
      <g transform="translate(60 72)">${pandaFace({ blink, smile: 0.4 })}</g>
      ${heart(60, 28, f === 1 ? 1.08 : 1)}
      ${f === 2 ? heart(44, 36, 0.55) : ""}
    `, { bounce, tilt: f === 3 ? -2 : 0 });
  },

  2: (f) => {
    const bounce = f === 2 ? -5 : f === 0 ? -1 : 0;
    const blink = f === 3;
    const wave = f === 1 ? 8 : 0;
    return svgWrap(`
      <path d="M38 98 Q60 88 82 98 L78 108 Q60 114 40 108Z" fill="${C.egg}" opacity=".7"/>
      <path d="M42 96 Q60 90 78 96" stroke="${C.eggCrack}" stroke-width="2" fill="none"/>
      <g transform="translate(60 70)">
        ${ears()}
        <ellipse cx="0" cy="8" rx="20" ry="22" fill="${C.cream}"/>
        <ellipse cx="-14" cy="2" rx="7" ry="9" fill="${C.patch}"/>
        <ellipse cx="14" cy="2" rx="7" ry="9" fill="${C.patch}"/>
        ${pandaFace({ blink, smile: 0.7 })}
        <ellipse cx="-10" cy="22" rx="7" ry="9" fill="${C.creamDark}"/>
        <ellipse cx="10" cy="22" rx="7" ry="9" fill="${C.creamDark}"/>
        <g transform="translate(18 14) rotate(${wave})"><ellipse cx="0" cy="0" rx="5" ry="6" fill="${C.creamDark}"/></g>
      </g>
      ${heart(60, 24, 0.9)}
    `, { bounce, tilt: f === 3 ? 2 : 0 });
  },

  3: (f) => {
    const bounce = f === 2 ? -4 : 0;
    const blink = f === 3;
    const shy = f === 1;
    return svgWrap(`
      <g transform="translate(60 68)">
        ${ears()}
        <ellipse cx="0" cy="10" rx="24" ry="26" fill="${C.cream}"/>
        <ellipse cx="-17" cy="2" rx="8" ry="10" fill="${C.patch}"/>
        <ellipse cx="17" cy="2" rx="8" ry="10" fill="${C.patch}"/>
        ${pandaFace({ blink, smile: shy ? 0.3 : 0.5 })}
        <ellipse cx="-12" cy="28" rx="8" ry="10" fill="${C.creamDark}"/>
        <ellipse cx="12" cy="28" rx="8" ry="10" fill="${C.creamDark}"/>
        ${shy ? `<ellipse cx="0" cy="20" rx="10" ry="7" fill="${C.blush}" opacity=".35"/>` : ""}
        <g transform="translate(0 22)">
          <ellipse cx="-8" cy="0" rx="6" ry="7" fill="${C.creamDark}"/>
          <ellipse cx="8" cy="0" rx="6" ry="7" fill="${C.creamDark}"/>
        </g>
      </g>
      <ellipse cx="60" cy="108" rx="28" ry="4" fill="#000" opacity=".06"/>
    `, { bounce, tilt: f === 3 ? -3 : 0 });
  },

  4: (f) => {
    const bounce = f === 2 ? -5 : f === 0 ? -2 : 0;
    const blink = f === 3;
    const thumb = f === 1 ? -6 : 0;
    return svgWrap(`
      <g transform="translate(60 66)">
        ${ears(true)}
        <ellipse cx="0" cy="12" rx="28" ry="30" fill="${C.cream}"/>
        <ellipse cx="-19" cy="0" rx="9" ry="11" fill="${C.patch}"/>
        <ellipse cx="19" cy="0" rx="9" ry="11" fill="${C.patch}"/>
        ${pandaFace({ blink, smile: 0.85, big: true })}
        <ellipse cx="-14" cy="32" rx="9" ry="11" fill="${C.creamDark}"/>
        <ellipse cx="14" cy="32" rx="9" ry="11" fill="${C.creamDark}"/>
        <g transform="translate(-22 8) rotate(${-12 + thumb})">
          <ellipse cx="0" cy="6" rx="7" ry="9" fill="${C.creamDark}"/>
          <ellipse cx="0" cy="-2" rx="5" ry="5" fill="${C.creamDark}"/>
        </g>
        <g transform="translate(24 4)">
          <rect x="-4" y="2" width="8" height="10" rx="3" fill="${C.creamDark}"/>
          <ellipse cx="0" cy="-2" rx="5" ry="5" fill="${C.creamDark}"/>
        </g>
      </g>
      ${f === 2 ? `<circle cx="28" cy="40" r="3" fill="${C.star}"/><circle cx="92" cy="44" r="2.5" fill="${C.star}"/>` : ""}
      <ellipse cx="60" cy="110" rx="30" ry="4" fill="#000" opacity=".06"/>
    `, { bounce, tilt: f === 3 ? 2 : 0 });
  },

  5: (f) => {
    const bounce = f === 2 ? -3 : 0;
    const blink = f === 3;
    const zzz = f === 1;
    return svgWrap(`
      <g transform="translate(60 70)">
        ${ears(true)}
        <ellipse cx="0" cy="10" rx="30" ry="32" fill="${C.cream}"/>
        <ellipse cx="-20" cy="-2" rx="10" ry="12" fill="${C.patch}"/>
        <ellipse cx="20" cy="-2" rx="10" ry="12" fill="${C.patch}"/>
        ${pandaFace({ blink, smile: zzz ? 0.9 : 0.7, big: true })}
        <ellipse cx="-16" cy="34" rx="10" ry="12" fill="${C.creamDark}"/>
        <ellipse cx="16" cy="34" rx="10" ry="12" fill="${C.creamDark}"/>
        <ellipse cx="0" cy="30" rx="14" ry="10" fill="${C.coin}" opacity=".9"/>
        <text x="0" y="34" text-anchor="middle" font-size="10" font-weight="700" fill="#C9922E">₩</text>
        ${zzz ? `<text x="28" y="-18" font-size="11" fill="${C.eggCrack}" opacity=".8">z z</text>` : ""}
      </g>
      <ellipse cx="60" cy="112" rx="32" ry="4" fill="#000" opacity=".06"/>
    `, { bounce, tilt: f === 3 ? -2 : 0 });
  },

  6: (f) => {
    const bounce = f === 2 ? -6 : f === 0 ? -2 : 0;
    const blink = f === 3;
    const sway = f === 1 ? 4 : 0;
    return svgWrap(`
      <line x1="88" y1="18" x2="88" y2="42" stroke="${C.balloonStr}" stroke-width="2"/>
      <ellipse cx="88" cy="14" rx="12" ry="15" fill="${C.balloon}"/>
      <ellipse cx="84" cy="10" rx="4" ry="5" fill="#fff" opacity=".35"/>
      <g transform="translate(60 68)">
        ${ears(true)}
        <ellipse cx="0" cy="12" rx="32" ry="34" fill="${C.cream}"/>
        <ellipse cx="-22" cy="-2" rx="11" ry="13" fill="${C.patch}"/>
        <ellipse cx="22" cy="-2" rx="11" ry="13" fill="${C.patch}"/>
        ${pandaFace({ blink, smile: 1, big: true })}
        <ellipse cx="-18" cy="36" rx="11" ry="13" fill="${C.creamDark}"/>
        <ellipse cx="18" cy="36" rx="11" ry="13" fill="${C.creamDark}"/>
        <g transform="translate(26 0) rotate(${sway})">
          <ellipse cx="0" cy="8" rx="8" ry="10" fill="${C.creamDark}"/>
        </g>
      </g>
      ${f === 2 ? `
        <circle cx="24" cy="36" r="3" fill="${C.heart}"/>
        <circle cx="100" cy="52" r="2.5" fill="${C.star}"/>
        <circle cx="18" cy="58" r="2" fill="${C.leaf}"/>
      ` : ""}
      <ellipse cx="60" cy="114" rx="34" ry="4" fill="#000" opacity=".06"/>
    `, { bounce, tilt: f === 3 ? 3 : 0 });
  },
};

export const PANDA_FRAME_COUNT = 4;

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
  _animTimer = setInterval(render, 380);
}

export function stopPandaAnimation() {
  if (_animTimer) {
    clearInterval(_animTimer);
    _animTimer = null;
  }
}
