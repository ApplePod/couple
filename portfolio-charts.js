/** 포트폴리오 시각화 — 도넛·비중·증권사 */

import { calcPosition } from "./portfolio-calc.js";
import { quoteOptsForPosition } from "./portfolio-quotes.js";

const PERSON_COLORS = { yj: "#5a8fc9", sn: "#f98f75" };
const YJ_TINTS = ["#5a8fc9", "#6e9ed4", "#88b1de", "#a4c5e8", "#c2d9f2"];
const SN_TINTS = ["#f98f75", "#faa18a", "#fbb59f", "#fccab5", "#fddfce"];
const SLICE_COLORS = [
  "#5a8fc9", "#f98f75", "#22c55e", "#8b5cf6", "#06b6d4",
  "#f59e0b", "#ec4899", "#6366f1", "#14b8a6", "#a855f7",
  "#84cc16", "#f97316",
];
const OTHER_COLOR = "#c4c4c4";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function fmtWon(n) {
  if (!n && n !== 0) return "—";
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

function fmtPct(n) {
  if (!n && n !== 0) return "0%";
  return `${(n * 100).toFixed(1)}%`;
}

function positionStats(pos) {
  return calcPosition(pos.lots, pos.sells, quoteOptsForPosition(pos));
}

function positionSliceValue(stats) {
  return stats.marketValueKrw ?? stats.remainingCostKrw ?? stats.remainingCost;
}

/** @returns {{ label, value, meta? }[]} */
export function getPositionSlices(positions, max = 8) {
  const items = [];
  for (const pos of positions || []) {
    const stats = positionStats(pos);
    const value = positionSliceValue(stats);
    if (value <= 0) continue;
    const label = pos.symbol?.trim() || pos.code || "미입력";
    items.push({
      label,
      value,
      code: pos.code,
      shares: stats.heldShares,
      avgPrice: stats.avgPrice,
      marketValue: stats.marketValueKrw,
    });
  }
  items.sort((a, b) => b.value - a.value);
  return collapseSlices(items, max);
}

export function getPersonSlices(data) {
  const yj = sumPositions(data.yj?.positions);
  const sn = sumPositions(data.sn?.positions);
  const slices = [];
  if (yj > 0) slices.push({ label: "영재", value: yj, color: PERSON_COLORS.yj });
  if (sn > 0) slices.push({ label: "시온", value: sn, color: PERSON_COLORS.sn });
  return slices;
}

function sumPositions(positions) {
  let t = 0;
  for (const pos of positions || []) {
    t += positionSliceValue(positionStats(pos));
  }
  return t;
}

/** 가구 전체 — 동일 종목 합산 */
export function getHouseholdSymbolSlices(data, max = 10) {
  const map = new Map();
  for (const person of ["yj", "sn"]) {
    for (const pos of data[person]?.positions || []) {
      const stats = positionStats(pos);
      const value = positionSliceValue(stats);
      if (value <= 0) continue;
      const key = pos.code || pos.symbol?.trim() || pos.id;
      const cur = map.get(key) || {
        label: pos.symbol?.trim() || pos.code || "미입력",
        value: 0,
        code: pos.code,
        shares: 0,
        yjCost: 0,
        snCost: 0,
      };
      cur.value += value;
      cur.shares += Math.max(0, stats.heldShares);
      if (person === "yj") cur.yjCost += value;
      else cur.snCost += value;
      map.set(key, cur);
    }
  }
  const items = [...map.values()]
    .map((it) => ({
      ...it,
      avgPrice: it.shares > 0 ? it.value / it.shares : 0,
    }))
    .sort((a, b) => b.value - a.value);
  return collapseSlices(items, max);
}

export function getBrokerSlices(data, person = null, max = 8) {
  const map = new Map();
  const persons = person ? [person] : ["yj", "sn"];
  for (const p of persons) {
    for (const pos of data[p]?.positions || []) {
      for (const lot of pos.lots || []) {
        const sh = Number(lot.shares) || 0;
        const pr = Number(lot.price) || 0;
        if (sh <= 0 || pr < 0) continue;
        const broker = lot.broker || "기타";
        map.set(broker, (map.get(broker) || 0) + sh * pr);
      }
    }
  }
  const items = [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  return collapseSlices(items, max);
}

function collapseSlices(items, max) {
  if (items.length <= max) {
    return items.map((it, i) => ({ ...it, color: it.color || SLICE_COLORS[i % SLICE_COLORS.length] }));
  }
  const head = items.slice(0, max - 1);
  const tail = items.slice(max - 1);
  const otherVal = tail.reduce((s, x) => s + x.value, 0);
  return [
    ...head.map((it, i) => ({ ...it, color: it.color || SLICE_COLORS[i % SLICE_COLORS.length] })),
    { label: "기타", value: otherVal, color: OTHER_COLOR },
  ];
}

function donutSegments(slices, radius) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return { total: 0, segments: [] };
  const circ = 2 * Math.PI * radius;
  let cumulative = 0;
  const segments = slices.map((sl) => {
    const fraction = sl.value / total;
    const length = fraction * circ;
    const rotation = (cumulative / total) * 360 - 90;
    cumulative += sl.value;
    return { ...sl, fraction, length, gap: circ - length, rotation };
  });
  return { total, segments };
}

export function renderDonut(slices, opts = {}) {
  const size = opts.size ?? 168;
  const stroke = opts.stroke ?? 26;
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const { total, segments } = donutSegments(slices, radius);

  if (total <= 0) {
    return `<div class="pf-donut pf-donut-empty" style="--pf-donut-size:${size}px">
      <svg viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle cx="${cx}" cy="${cx}" r="${radius}" fill="none" stroke="var(--border)" stroke-width="${stroke}" opacity=".5"/>
      </svg>
      <div class="pf-donut-center">
        <span class="pf-donut-center-sub">${esc(opts.emptyLabel || "데이터 없음")}</span>
      </div>
    </div>`;
  }

  const rings = segments
    .map(
      (s) =>
        `<circle class="pf-donut-seg" cx="${cx}" cy="${cx}" r="${radius}" fill="none"
          stroke="${s.color}" stroke-width="${stroke}"
          stroke-dasharray="${s.length} ${s.gap}"
          transform="rotate(${s.rotation} ${cx} ${cx})"
          data-label="${esc(s.label)}" data-pct="${(s.fraction * 100).toFixed(1)}">
          <title>${esc(s.label)} ${fmtPct(s.fraction)}</title>
        </circle>`
    )
    .join("");

  const centerTitle = opts.centerTitle ?? "합계";
  const centerValue = opts.centerValue ?? fmtWon(total);

  return `<div class="pf-donut" style="--pf-donut-size:${size}px">
    <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(centerTitle)} ${esc(centerValue)}">
      <circle cx="${cx}" cy="${cx}" r="${radius}" fill="none" stroke="var(--surface2)" stroke-width="${stroke}"/>
      ${rings}
    </svg>
    <div class="pf-donut-center">
      <span class="pf-donut-center-title">${esc(centerTitle)}</span>
      <span class="pf-donut-center-val">${centerValue}</span>
    </div>
  </div>`;
}

export function renderLegend(slices) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return "";
  return `<ul class="pf-legend">
    ${slices
      .map(
        (s) => `<li class="pf-legend-item">
          <span class="pf-legend-dot" style="background:${s.color}"></span>
          <span class="pf-legend-label">${esc(s.label)}</span>
          <span class="pf-legend-pct">${fmtPct(s.value / total)}</span>
          <span class="pf-legend-amt">${fmtWon(s.value)}</span>
        </li>`
      )
      .join("")}
  </ul>`;
}

export function renderAllocationTable(rows, opts = {}) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (total <= 0) {
    return `<p class="pf-table-empty">${esc(opts.emptyLabel || "표시할 종목이 없습니다.")}</p>`;
  }
  const showWho = opts.showWho;
  return `<div class="pf-table-wrap">
    <table class="pf-alloc-table">
      <thead>
        <tr>
          <th>종목</th>
          ${showWho ? "<th>보유</th>" : ""}
          <th>비중</th>
          <th>${opts.hasQuotes ? "평가금액" : "투자원금"}</th>
          <th>수량</th>
          <th>평단</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((r) => {
            const who =
              showWho && (r.yjCost || r.snCost)
                ? [
                    r.yjCost ? "영재" : "",
                    r.snCost ? "시온" : "",
                  ]
                    .filter(Boolean)
                    .join("·")
                : "";
            return `<tr>
              <td class="pf-td-name">
                <span class="pf-legend-dot" style="background:${r.color || SLICE_COLORS[0]}"></span>
                ${esc(r.label)}${r.code ? `<span class="pf-td-code">${esc(r.code)}</span>` : ""}
              </td>
              ${showWho ? `<td class="pf-td-who">${esc(who || "—")}</td>` : ""}
              <td class="pf-td-pct">${fmtPct(r.value / total)}</td>
              <td class="pf-td-amt">${fmtWon(r.value)}</td>
              <td>${r.shares ? r.shares.toLocaleString("ko-KR") : "—"}</td>
              <td>${r.avgPrice ? fmtWon(r.avgPrice) : "—"}</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>
  </div>`;
}

function countBrokers(data) {
  const keys = new Set();
  for (const person of ["yj", "sn"]) {
    for (const pos of data[person]?.positions || []) {
      for (const lot of pos.lots || []) {
        const sh = Number(lot.shares) || 0;
        const pr = Number(lot.price) || 0;
        if (sh > 0 && pr >= 0) keys.add(lot.broker || "기타");
      }
    }
  }
  return keys.size;
}

function countHouseholdSymbols(data) {
  const keys = new Set();
  for (const person of ["yj", "sn"]) {
    for (const pos of data[person]?.positions || []) {
      if (positionStats(pos).heldShares > 0) {
        keys.add(pos.code || pos.symbol?.trim() || pos.id);
      }
    }
  }
  return keys.size;
}

export function renderPortfolioDashboard(data, quoteState) {
  const personSlices = getPersonSlices(data);
  const symbolSlices = getHouseholdSymbolSlices(data);
  const brokerSlices = getBrokerSlices(data);
  const hTotal = personSlices.reduce((s, x) => s + x.value, 0);
  const topSymbol = symbolSlices[0];
  const symbolCount = countHouseholdSymbols(data);
  const hasQuotes = quoteState?.status === "ok" && quoteState?.quotes?.size > 0;

  let totalCost = 0;
  let totalMarket = 0;
  let totalUnrealized = 0;
  for (const person of ["yj", "sn"]) {
    for (const pos of data[person]?.positions || []) {
      const s = positionStats(pos);
      if (s.heldShares <= 0) continue;
      totalCost += s.remainingCostKrw ?? s.remainingCost;
      if (s.marketValueKrw != null) {
        totalMarket += s.marketValueKrw;
        totalUnrealized += s.unrealizedPnlKrw || 0;
      }
    }
  }

  const stats = [
    {
      lbl: hasQuotes ? "총 평가금액" : "총 투자원금",
      val: hasQuotes ? fmtWon(totalMarket) : hTotal ? fmtWon(hTotal) : "—",
      hi: true,
    },
    {
      lbl: hasQuotes ? "평가손익" : "보유 종목",
      val: hasQuotes
        ? totalUnrealized
          ? `${totalUnrealized > 0 ? "+" : ""}${Math.round(totalUnrealized).toLocaleString("ko-KR")}원`
          : "0원"
        : symbolCount
          ? String(symbolCount)
          : "—",
      hi: hasQuotes && totalUnrealized !== 0,
      gain: hasQuotes && totalUnrealized > 0,
      loss: hasQuotes && totalUnrealized < 0,
    },
    {
      lbl: hasQuotes ? "투자원금" : "최대 비중",
      val: hasQuotes
        ? totalCost
          ? fmtWon(totalCost)
          : "—"
        : topSymbol && hTotal
          ? `${topSymbol.label} ${fmtPct(topSymbol.value / hTotal)}`
          : "—",
    },
    {
      lbl: hasQuotes ? "보유 종목" : "증권사",
      val: hasQuotes
        ? symbolCount
          ? String(symbolCount)
          : "—"
        : countBrokers(data)
          ? String(countBrokers(data))
          : "—",
    },
  ];

  return `<div class="pf-dashboard" data-pf-dashboard>
    <div class="pf-dash-stats">
      ${stats
        .map(
          (s) => `<div class="pf-dash-stat${s.hi ? " highlight" : ""}${s.gain ? " gain" : ""}${s.loss ? " loss" : ""}">
        <div class="pf-dash-stat-val">${s.val}</div>
        <div class="pf-dash-stat-lbl">${s.lbl}</div>
      </div>`
        )
        .join("")}
    </div>
    <div class="pf-charts-grid">
      <div class="pf-chart-card">
        <h4 class="pf-chart-title">👫 영재 · 시온 비중</h4>
        <div class="pf-chart-body">
          ${renderDonut(personSlices, {
            centerTitle: hasQuotes ? "평가 합계" : "가구 합계",
            centerValue: hTotal ? fmtWon(hTotal) : "—",
          })}
          ${renderLegend(personSlices)}
        </div>
      </div>
      <div class="pf-chart-card pf-chart-wide">
        <h4 class="pf-chart-title">📊 종목별 비중</h4>
        <div class="pf-chart-body pf-chart-body-row">
          ${renderDonut(symbolSlices, {
            size: 180,
            stroke: 28,
            centerTitle: "종목 수",
            centerValue: String(symbolCount || "0"),
          })}
          ${renderLegend(symbolSlices)}
        </div>
      </div>
      <div class="pf-chart-card">
        <h4 class="pf-chart-title">🏦 증권사별</h4>
        <div class="pf-chart-body">
          ${renderDonut(brokerSlices, { size: 152, stroke: 22, centerTitle: "계좌", centerValue: `${brokerSlices.length}곳` })}
          ${renderLegend(brokerSlices)}
        </div>
      </div>
    </div>
    <div class="pf-table-section">
      <h4 class="pf-chart-title">종목 상세 · 가구 합산</h4>
      ${renderAllocationTable(symbolSlices, { showWho: true, hasQuotes })}
    </div>
    <p class="pf-hw-note">잔여원금·평단은 매수−매도(평단법) · 평가금액·손익은 Yahoo 시세+환율(약 1분 갱신) · 미국주는 USD 매매·원화 환산</p>
  </div>`;
}

export function renderPersonChart(person, label, positions) {
  const slices = getPositionSlices(positions);
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) {
    return `<div class="pf-person-chart pf-person-chart-empty" data-pf-person-chart="${person}">
      <span>종목 입력 후 비중 차트가 표시됩니다</span>
    </div>`;
  }
  const tinted = slices.map((s, i) => ({
    ...s,
    color: (person === "yj" ? YJ_TINTS : SN_TINTS)[i % 5],
  }));
  return `<div class="pf-person-chart" data-pf-person-chart="${person}">
    <div class="pf-person-chart-inner">
      ${renderDonut(tinted, { size: 120, stroke: 18, centerTitle: label, centerValue: fmtWon(total) })}
      <div class="pf-person-mini-legend">
        ${tinted
          .slice(0, 5)
          .map(
            (s) => `<span class="pf-mini-leg">
              <i style="background:${s.color}"></i>${esc(s.label)} <b>${fmtPct(s.value / total)}</b>
            </span>`
          )
          .join("")}
        ${tinted.length > 5 ? `<span class="pf-mini-more">+${tinted.length - 5}</span>` : ""}
      </div>
    </div>
  </div>`;
}

export function updatePortfolioCharts(section, data, quoteState) {
  const dash = section.querySelector("[data-pf-dashboard]");
  if (dash) {
    const tmp = document.createElement("div");
    tmp.innerHTML = renderPortfolioDashboard(data, quoteState);
    dash.replaceWith(tmp.firstElementChild);
  }
  for (const person of ["yj", "sn"]) {
    const el = section.querySelector(`[data-pf-person-chart="${person}"]`);
    if (!el) continue;
    const label = person === "yj" ? "영재" : "시온";
    const html = renderPersonChart(person, label, data[person]?.positions);
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    el.replaceWith(wrap.firstElementChild);
  }
}
