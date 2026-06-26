/** 포트폴리오 시각화 — 도넛·비중 */

import { calcPosition, isUsMarket } from "./portfolio-calc.js";
import { quoteOptsForPosition, getQuoteState } from "./portfolio-quotes.js";

const PERSON_COLORS = { yj: "#5a8fc9", sn: "#f98f75" };
/** 영재 — 블루 파스텔 */
const YJ_PASTELS = [
  "#6fa3dc", "#8eb8e8", "#a8c9f0", "#c2daf7",
  "#5a8fc9", "#b3cff0", "#7eb5e4", "#d4e8fb",
];
/** 시온 — 피치·코랄 파스텔 */
const SN_PASTELS = [
  "#f5a090", "#f8b5a8", "#fbc8be", "#ffd8cf",
  "#f98f75", "#f0a898", "#ffc9b8", "#ffe5dc",
];
const YJ_TINTS = YJ_PASTELS;
const SN_TINTS = SN_PASTELS;
const SLICE_COLORS = [
  "#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b",
  "#fb923c", "#06b6d4", "#60a5fa", "#a78bfa",
  "#14b8a6", "#ec4899", "#84cc16", "#f97316",
];
const OTHER_COLOR = "#d1d5db";

const ASSET_META = {
  stock: { label: "국내주식", color: "#3b82f6" },
  etf: { label: "ETF", color: "#22c55e" },
  us: { label: "미국주식", color: "#8b5cf6" },
  other: { label: "기타", color: "#d1d5db" },
};
const ASSET_ORDER = ["stock", "etf", "us", "other"];

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

function assetTypeKey(market) {
  const m = String(market || "").toUpperCase();
  if (m === "ETF") return "etf";
  if (isUsMarket(market)) return "us";
  if (m === "KOSPI" || m === "KOSDAQ") return "stock";
  return "other";
}

function buyCostKrw(pos) {
  const stats = positionStats(pos);
  if (stats.buyCost <= 0) return 0;
  if (isUsMarket(pos.market)) {
    const fx = quoteOptsForPosition(pos).fxRate || getQuoteState()?.fxRate || 1;
    return stats.buyCost * fx;
  }
  return stats.buyCost;
}

function sumSliceValues(slices) {
  return slices.reduce((s, x) => s + x.value, 0);
}

function positionKey(pos) {
  return pos.code || pos.symbol?.trim() || pos.id;
}

/** 가구 전체 매수금액 순 — 동일 종목은 모든 차트에서 같은 색 */
function buildSymbolColorMap(data) {
  const totals = new Map();
  for (const person of ["yj", "sn"]) {
    for (const pos of data[person]?.positions || []) {
      const cost = buyCostKrw(pos);
      if (cost <= 0) continue;
      const key = positionKey(pos);
      const label = pos.symbol?.trim() || "미입력";
      const cur = totals.get(key) || { key, label, value: 0 };
      cur.value += cost;
      totals.set(key, cur);
    }
  }
  const ranked = [...totals.values()].sort((a, b) => b.value - a.value);
  const byKey = new Map();
  const byLabel = new Map();
  ranked.forEach((item, i) => {
    const color = SLICE_COLORS[i % SLICE_COLORS.length];
    byKey.set(item.key, color);
    byLabel.set(item.label, color);
  });
  return { byKey, byLabel };
}

function resolveSliceColor(slice, colorMap) {
  if (slice.label === "기타") return OTHER_COLOR;
  if (!colorMap) return null;
  return colorMap.byKey.get(slice.colorKey) || colorMap.byLabel.get(slice.label) || OTHER_COLOR;
}

function applySliceColors(slices, colorMap) {
  return slices.map((s) => ({ ...s, color: resolveSliceColor(s, colorMap) }));
}

/** 자산 유형별 매수 금액 (국내주식·ETF·미국주식) */
export function getAssetTypeSlices(data) {
  const map = new Map();
  for (const person of ["yj", "sn"]) {
    for (const pos of data[person]?.positions || []) {
      const cost = buyCostKrw(pos);
      if (cost <= 0) continue;
      const key = assetTypeKey(pos.market);
      map.set(key, (map.get(key) || 0) + cost);
    }
  }
  return ASSET_ORDER.filter((k) => map.get(k) > 0).map((k) => ({
    label: ASSET_META[k].label,
    value: map.get(k),
    color: ASSET_META[k].color,
  }));
}

/** 종목별 매수 금액 */
export function getBuySlices(positions, max = 8, colorMap = null) {
  const items = [];
  for (const pos of positions || []) {
    const cost = buyCostKrw(pos);
    if (cost <= 0) continue;
    const stats = positionStats(pos);
    items.push({
      label: pos.symbol?.trim() || "미입력",
      colorKey: positionKey(pos),
      value: cost,
      shares: stats.buyShares,
      avgPrice: stats.avgPrice,
    });
  }
  items.sort((a, b) => b.value - a.value);
  const out = collapseSlices(items, max, !colorMap);
  return colorMap ? applySliceColors(out, colorMap) : out;
}

/** 가구 전체 — 동일 종목 매수 합산 */
export function getHouseholdBuySlices(data, max = 10, colorMap = null) {
  const map = new Map();
  for (const person of ["yj", "sn"]) {
    for (const pos of data[person]?.positions || []) {
      const cost = buyCostKrw(pos);
      if (cost <= 0) continue;
      const key = positionKey(pos);
      const cur = map.get(key) || {
        label: pos.symbol?.trim() || "미입력",
        colorKey: key,
        value: 0,
        shares: 0,
        yjCost: 0,
        snCost: 0,
      };
      const stats = positionStats(pos);
      cur.value += cost;
      cur.shares += stats.buyShares;
      if (person === "yj") cur.yjCost += cost;
      else cur.snCost += cost;
      map.set(key, cur);
    }
  }
  const items = [...map.values()]
    .map((it) => ({
      ...it,
      avgPrice: it.shares > 0 ? it.value / it.shares : 0,
    }))
    .sort((a, b) => b.value - a.value);
  const out = collapseSlices(items, max, !colorMap);
  return colorMap ? applySliceColors(out, colorMap) : out;
}

function totalBuyCost(data) {
  let t = 0;
  for (const person of ["yj", "sn"]) {
    for (const pos of data[person]?.positions || []) {
      t += buyCostKrw(pos);
    }
  }
  return t;
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

function collapseSlices(items, max, assignDefaultColors = true) {
  if (items.length <= max) {
    return items.map((it, i) =>
      assignDefaultColors
        ? { ...it, color: it.color || SLICE_COLORS[i % SLICE_COLORS.length] }
        : { ...it }
    );
  }
  const head = items.slice(0, max - 1);
  const tail = items.slice(max - 1);
  const otherVal = tail.reduce((s, x) => s + x.value, 0);
  return [
    ...(assignDefaultColors
      ? head.map((it, i) => ({ ...it, color: it.color || SLICE_COLORS[i % SLICE_COLORS.length] }))
      : head),
    { label: "기타", value: otherVal, color: OTHER_COLOR },
  ];
}

function donutSegments(slices, radius, padDeg = 2.8) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return { total: 0, segments: [] };
  const circ = 2 * Math.PI * radius;
  const n = slices.length;
  const pad = (padDeg / 360) * circ;
  const avail = Math.max(0, circ - pad * n);
  let angle = -90;
  const segments = slices.map((sl) => {
    const fraction = sl.value / total;
    const length = fraction * avail;
    const rotation = angle;
    angle += (length / circ) * 360 + padDeg;
    return { ...sl, fraction, length, dashGap: circ - length, rotation };
  });
  return { total, segments };
}

function renderSegCircle(s, cx, stroke, extraClass = "") {
  return `<circle class="pf-donut-seg${extraClass}" cx="${cx}" cy="${cx}" r="${(cx * 2 - stroke) / 2}" fill="none"
    stroke="${s.color}" stroke-width="${stroke}"
    stroke-linecap="round"
    stroke-dasharray="${s.length} ${s.dashGap}"
    transform="rotate(${s.rotation} ${cx} ${cx})"
    data-label="${esc(s.label)}" data-pct="${(s.fraction * 100).toFixed(1)}">
    <title>${esc(s.label)} ${fmtPct(s.fraction)}</title>
  </circle>`;
}

export function renderDonut(slices, opts = {}) {
  const size = opts.size ?? 168;
  const stroke = opts.stroke ?? 26;
  const gapped = opts.gapped !== false && opts.hideCenter;
  const padDeg = opts.padDeg ?? 2.8;
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const { total, segments } = donutSegments(slices, radius, gapped ? padDeg : 0);

  if (total <= 0) {
    return `<div class="pf-donut pf-donut-empty" style="--pf-donut-size:${size}px">
      <svg viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle cx="${cx}" cy="${cx}" r="${radius}" fill="none" stroke="#eef0f3" stroke-width="${stroke}" stroke-linecap="round"/>
      </svg>
      <div class="pf-donut-center">
        <span class="pf-donut-center-sub">${esc(opts.emptyLabel || "데이터 없음")}</span>
      </div>
    </div>`;
  }

  const top = segments[0];
  const glow =
    gapped && top
      ? `<circle class="pf-donut-glow" cx="${cx}" cy="${cx}" r="${radius}" fill="none"
          stroke="${top.color}" stroke-width="${stroke + 14}" opacity="0.22"
          stroke-linecap="round"
          stroke-dasharray="${top.length} ${top.dashGap}"
          transform="rotate(${top.rotation} ${cx} ${cx})"/>`
      : "";

  const rings = segments
    .map((s, i) => renderSegCircle(s, cx, stroke, i === 0 ? " is-top" : ""))
    .join("");

  const centerTitle = opts.centerTitle ?? "합계";
  const centerValue = opts.centerValue ?? fmtWon(total);
  const hideCenter = opts.hideCenter;

  return `<div class="pf-donut${hideCenter ? " pf-donut-hollow" : ""}" style="--pf-donut-size:${size}px">
    <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(centerTitle)} ${esc(centerValue)}">
      <circle cx="${cx}" cy="${cx}" r="${radius}" fill="none" stroke="#eef0f3" stroke-width="${stroke}" stroke-linecap="round"/>
      ${glow}
      ${rings}
    </svg>
    ${hideCenter ? "" : `<div class="pf-donut-center">
      <span class="pf-donut-center-title">${esc(centerTitle)}</span>
      <span class="pf-donut-center-val">${centerValue}</span>
    </div>`}
  </div>`;
}

function renderChartSplit(slices, donutOpts = {}, tone = null) {
  const size = donutOpts.size ?? 128;
  const stroke = donutOpts.stroke ?? 22;
  const toneCls = tone ? ` pf-chart-tone-${tone}` : "";
  return `<div class="pf-chart-split${toneCls}">
    <div class="pf-chart-donut-col">
      ${renderDonut(slices, { size, stroke, hideCenter: true, gapped: true })}
    </div>
    <div class="pf-chart-legend-col">
      ${renderLegend(slices, { compact: true })}
    </div>
  </div>`;
}

export function renderLegend(slices, opts = {}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return "";
  if (opts.compact) {
    return `<ul class="pf-legend pf-legend-compact">
      ${slices
        .map(
          (s, i) => `<li class="pf-legend-item${i === 0 ? " is-top is-active" : ""}" data-seg-idx="${i}">
          <span class="pf-legend-swatch" style="background:${s.color}"></span>
          <span class="pf-legend-label">${esc(s.label)}</span>
          <span class="pf-legend-pct">${fmtPct(s.value / total)}</span>
        </li>`
        )
        .join("")}
    </ul>`;
  }
  const side = opts.side ? " pf-legend-side" : "";
  return `<ul class="pf-legend${side}">
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
          <th>${opts.amountLabel || "매수금액"}</th>
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
                ${esc(r.label)}
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

function countBuySymbols(data) {
  const keys = new Set();
  for (const person of ["yj", "sn"]) {
    for (const pos of data[person]?.positions || []) {
      if (buyCostKrw(pos) > 0) keys.add(pos.code || pos.symbol?.trim() || pos.id);
    }
  }
  return keys.size;
}

export function renderPortfolioDashboard(data, quoteState) {
  const symbolColors = buildSymbolColorMap(data);
  const assetSlices = getAssetTypeSlices(data);
  const yjBuySlices = getBuySlices(data.yj?.positions, 8, symbolColors);
  const snBuySlices = getBuySlices(data.sn?.positions, 8, symbolColors);
  const totalBuySlices = getHouseholdBuySlices(data, 10, symbolColors);
  const buyTotal = totalBuyCost(data);
  const topBuy = totalBuySlices[0];
  const symbolCount = countBuySymbols(data);
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

  const yjBuyTotal = sumSliceValues(yjBuySlices);
  const snBuyTotal = sumSliceValues(snBuySlices);

  const stats = [
    {
      lbl: hasQuotes ? "총 평가금액" : "총 매수금액",
      val: hasQuotes ? fmtWon(totalMarket) : buyTotal ? fmtWon(buyTotal) : "—",
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
      lbl: hasQuotes ? "잔여원금" : "최대 비중",
      val: hasQuotes
        ? totalCost
          ? fmtWon(totalCost)
          : "—"
        : topBuy && buyTotal
          ? `${topBuy.label} ${fmtPct(topBuy.value / buyTotal)}`
          : "—",
    },
    {
      lbl: hasQuotes ? "보유 종목" : "매수 종목",
      val: symbolCount ? String(symbolCount) : "—",
    },
  ];

  const splitOpts = { size: 128, stroke: 22 };

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
    <div class="pf-charts-grid pf-charts-4">
      <div class="pf-chart-card">
        <h4 class="pf-chart-title">자산 유형</h4>
        ${renderChartSplit(assetSlices, splitOpts)}
      </div>
      <div class="pf-chart-card">
        <h4 class="pf-chart-title">전체 매수 비중</h4>
        ${renderChartSplit(totalBuySlices, splitOpts)}
      </div>
      <div class="pf-chart-card pf-chart-yj">
        <h4 class="pf-chart-title">영재 매수 비중</h4>
        ${renderChartSplit(yjBuySlices, splitOpts, "yj")}
      </div>
      <div class="pf-chart-card pf-chart-sn">
        <h4 class="pf-chart-title">시온 매수 비중</h4>
        ${renderChartSplit(snBuySlices, splitOpts, "sn")}
      </div>
    </div>
    <div class="pf-table-section">
      <h4 class="pf-chart-title">종목 상세 · 매수 합산</h4>
      ${renderAllocationTable(totalBuySlices, { showWho: true, amountLabel: "매수금액" })}
    </div>
    <p class="pf-hw-note">도넛·표는 매수 금액 기준 · 잔여원금·평가손익은 매수−매도(평단법) · 시세는 약 1분 갱신</p>
  </div>`;
}

export function renderPersonChart(person, label, positions, colorMap) {
  const slices = getBuySlices(positions, 8, colorMap);
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) {
    return `<div class="pf-person-chart pf-person-chart-empty" data-pf-person-chart="${person}">
      <span>종목 입력 후 비중 차트가 표시됩니다</span>
    </div>`;
  }
  return `<div class="pf-person-chart" data-pf-person-chart="${person}">
    <div class="pf-person-chart-inner">
      ${renderDonut(slices, { size: 120, stroke: 18, centerTitle: label, centerValue: fmtWon(total) })}
      <div class="pf-person-mini-legend">
        ${slices
          .slice(0, 5)
          .map(
            (s) => `<span class="pf-mini-leg">
              <i style="background:${s.color}"></i>${esc(s.label)} <b>${fmtPct(s.value / total)}</b>
            </span>`
          )
          .join("")}
        ${slices.length > 5 ? `<span class="pf-mini-more">+${slices.length - 5}</span>` : ""}
      </div>
    </div>
  </div>`;
}

export function attachChartInteractions(root) {
  if (!root || root._pfChartIx) return;
  root._pfChartIx = true;
  root.addEventListener("mouseover", (e) => {
    const item = e.target.closest(".pf-legend-compact .pf-legend-item");
    const split = item?.closest(".pf-chart-split");
    if (!item || !split) return;
    const idx = Number(item.dataset.segIdx);
    if (!Number.isFinite(idx)) return;
    const segs = split.querySelectorAll(".pf-donut-seg");
    const items = split.querySelectorAll(".pf-legend-item");
    segs.forEach((s, i) => s.classList.toggle("dim", i !== idx));
    items.forEach((it, i) => it.classList.toggle("is-active", i === idx));
  });
  root.addEventListener("mouseout", (e) => {
    const split = e.target.closest(".pf-chart-split");
    if (!split) return;
    const related = e.relatedTarget;
    if (related && split.contains(related)) return;
    split.querySelectorAll(".pf-donut-seg").forEach((s) => s.classList.remove("dim"));
    split.querySelectorAll(".pf-legend-item").forEach((it, i) => {
      it.classList.toggle("is-active", i === 0);
    });
  });
}

export function updatePortfolioCharts(section, data, quoteState) {
  const dash = section.querySelector("[data-pf-dashboard]");
  if (dash) {
    const tmp = document.createElement("div");
    tmp.innerHTML = renderPortfolioDashboard(data, quoteState);
    dash.replaceWith(tmp.firstElementChild);
    attachChartInteractions(section);
  }
  for (const person of ["yj", "sn"]) {
    const el = section.querySelector(`[data-pf-person-chart="${person}"]`);
    if (!el) continue;
    const label = person === "yj" ? "영재" : "시온";
    const colorMap = buildSymbolColorMap(data);
    const html = renderPersonChart(person, label, data[person]?.positions, colorMap);
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    el.replaceWith(wrap.firstElementChild);
  }
}
