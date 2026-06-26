/**
 * 투자 포트폴리오 — 영재/시온/전체 합산
 */
import {
  loadPortfolio,
  persistPortfolioLocal,
  markPortfolioDirty,
  savePortfolioToCloud,
  defaultPortfolio,
} from "./portfolio-store.js";
import { attachSymbolAutocomplete } from "./symbol-search.js";
import {
  renderPortfolioDashboard,
  updatePortfolioCharts,
  attachChartInteractions,
} from "./portfolio-charts.js";
import { calcPosition, isUsMarket, positionCurrency } from "./portfolio-calc.js";
import {
  startPortfolioQuotes,
  getQuoteState,
  quoteOptsForPosition,
  formatFxRate,
  formatQuoteTime,
  formatReturnPct,
  requestQuoteRefresh,
} from "./portfolio-quotes.js";

export const BROKERS = [
  "한국투자증권",
  "키움증권",
  "미래에셋증권",
  "삼성증권",
  "NH투자증권",
  "KB증권",
  "신한투자증권",
  "하나증권",
  "카카오페이증권",
  "토스증권",
  "기타",
];

const BROKER_SHORT = {
  한국투자증권: "한투",
  키움증권: "키움",
  미래에셋증권: "미래",
  삼성증권: "삼성",
  NH투자증권: "NH",
  KB증권: "KB",
  신한투자증권: "신한",
  하나증권: "하나",
  카카오페이증권: "카카오",
  토스증권: "토스",
  기타: "기타",
};

let portfolioData = loadPortfolio();
let saveTimer = null;
let cloudSaveInFlight = false;
let lastCloudJson = JSON.stringify(portfolioData);
const expandedIds = new Set();
const portfolioEditMode = { yj: false, sn: false };

function pfJson(d) {
  return JSON.stringify(d);
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

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

function parseNum(str) {
  const n = String(str ?? "").replace(/[^0-9.]/g, "");
  if (!n) return "";
  const v = Number(n);
  return Number.isFinite(v) ? v : "";
}

function calcLots(lots) {
  return calcPosition(lots, []);
}

function statsForPosition(pos) {
  return calcPosition(pos.lots, pos.sells, quoteOptsForPosition(pos));
}

function calcPersonSummary(positions) {
  let positionCount = 0;
  let totalCost = 0;
  let totalMarket = 0;
  let totalUnrealized = 0;
  let totalShares = 0;
  let totalRealized = 0;
  let hasQuotes = false;
  for (const pos of positions || []) {
    const s = statsForPosition(pos);
    const hasData =
      pos.symbol?.trim() ||
      (pos.lots || []).some((l) => l.price || l.shares) ||
      (pos.sells || []).some((l) => l.price || l.shares);
    if (!hasData) continue;
    positionCount++;
    totalCost += s.remainingCostKrw ?? s.remainingCost;
    totalShares += Math.max(0, s.heldShares);
    totalRealized += s.realizedPnlKrw ?? s.realizedPnl;
    if (s.marketValueKrw != null) {
      hasQuotes = true;
      totalMarket += s.marketValueKrw;
      totalUnrealized += s.unrealizedPnlKrw || 0;
    }
  }
  return {
    positionCount,
    totalCost,
    totalMarket: hasQuotes ? totalMarket : null,
    totalUnrealized: hasQuotes ? totalUnrealized : null,
    totalShares,
    totalRealized,
  };
}

function fmtPrice(n, currency) {
  if (n == null || !Number.isFinite(n)) return "—";
  if (currency === "USD") {
    return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return fmtWon(n);
}

function renderPositionHeadStats(pos, stats) {
  const pnlClass =
    stats.unrealizedPnlKrw > 0 ? "gain" : stats.unrealizedPnlKrw < 0 ? "loss" : "";
  const realizedClass = stats.realizedPnlKrw > 0 ? "gain" : stats.realizedPnlKrw < 0 ? "loss" : "";
  const parts = [
    `<span><em>평단</em>${stats.avgPrice ? fmtPrice(stats.avgPrice, stats.currency) : "—"}</span>`,
    `<span><em>보유</em>${stats.heldShares > 0 ? stats.heldShares.toLocaleString("ko-KR") : stats.buyShares ? "0" : "—"}</span>`,
    `<span><em>잔여원금</em>${stats.remainingCostKrw ? fmtWon(stats.remainingCostKrw) : stats.remainingCost ? fmtWon(stats.remainingCost) : "—"}</span>`,
  ];
  if (stats.currentPrice != null && stats.heldShares > 0) {
    parts.push(`<span class="pf-live"><em>현재가</em>${fmtPrice(stats.currentPrice, stats.currency)}</span>`);
  }
  if (stats.unrealizedPnlKrw != null && stats.heldShares > 0) {
    const pct = formatReturnPct(stats.returnPct);
    parts.push(
      `<span class="pf-pnl pf-pnl-eval ${pnlClass}">
        <span class="pf-pnl-top"><em>평가</em>${pct ? `<b class="pf-pnl-pct">${pct}</b>` : ""}</span>
        <span class="pf-pnl-amt">${formatPnl(stats.unrealizedPnlKrw)}</span>
      </span>`
    );
  }
  if (stats.realizedPnlKrw) {
    parts.push(
      `<span class="pf-pnl ${realizedClass}"><em>실현</em>${formatPnl(stats.realizedPnlKrw)}</span>`
    );
  }
  return parts.join("");
}

function renderColSummary(summary) {
  return `<span>종목 <strong>${summary.positionCount}</strong></span>
        <span>잔여원금 <strong>${summary.totalCost ? fmtWon(summary.totalCost) : "—"}</strong></span>
        ${summary.totalMarket != null ? `<span>평가금액 <strong>${fmtWon(summary.totalMarket)}</strong></span>` : ""}
        ${summary.totalUnrealized != null && summary.totalUnrealized !== 0 ? `<span>평가손익 <strong class="${summary.totalUnrealized > 0 ? "gain" : "loss"}">${formatPnl(summary.totalUnrealized)}</strong></span>` : ""}
        ${summary.totalRealized ? `<span>실현손익 <strong class="${summary.totalRealized > 0 ? "gain" : "loss"}">${formatPnl(summary.totalRealized)}</strong></span>` : ""}`;
}

function renderQuoteBar() {
  const qs = getQuoteState();
  const cls = qs.status === "error" ? "error" : qs.status === "loading" ? "loading" : "ok";
  const fx = qs.fxRate ? `USD/KRW ${formatFxRate(qs.fxRate)}` : "환율 —";
  const time = qs.updatedAt ? `갱신 ${formatQuoteTime(qs.updatedAt)}` : "";
  let msg = "";
  if (qs.status === "error") {
    msg = qs.error?.includes("404") || qs.error?.includes("Failed")
      ? "시세 함수 미배포 — supabase functions deploy portfolio-quotes"
      : qs.error || "시세 조회 실패";
  } else if (qs.status === "loading" && !qs.updatedAt) {
    msg = "시세 불러오는 중…";
  } else if (qs.status === "ok" && qs.updatedAt) {
    msg = "국내 키움 · 미국·환율 Yahoo";
  }
  return `<div class="pf-quote-bar ${cls}" data-pf-quote-bar>
    <span class="pf-quote-fx">💱 ${fx}</span>
    ${time ? `<span class="pf-quote-time">${time}</span>` : ""}
    ${msg ? `<span class="pf-quote-msg">${esc(msg)}</span>` : ""}
  </div>`;
}


function brokerOptions(selected) {
  return BROKERS.map((b) => {
    const label = BROKER_SHORT[b] || b;
    return `<option value="${esc(b)}"${b === selected ? " selected" : ""}>${esc(label)}</option>`;
  }).join("");
}

function formatTradeDate(iso) {
  if (!iso) return "날짜";
  const parts = String(iso).split("-");
  if (parts.length !== 3) return "날짜";
  const [y, m, d] = parts;
  return `${y.slice(-2)}.${m}.${d}`;
}

function renderTradeDatePill(date) {
  const has = !!date;
  return `<div class="ci-date-wrap pf-trade-date-wrap">
    <button type="button" class="ci-date-pill${has ? " has-value" : ""}" aria-label="거래일 선택">
      <span class="ci-date-text">${formatTradeDate(date)}</span>
    </button>
    <input type="date" class="ci-date-input pf-trade-date-input" value="${esc(date || "")}" tabindex="-1" aria-hidden="true">
  </div>`;
}

function syncTradeDatePill(input) {
  const wrap = input.closest(".ci-date-wrap");
  const pill = wrap?.querySelector(".ci-date-pill");
  const text = pill?.querySelector(".ci-date-text");
  if (!pill || !text) return;
  text.textContent = formatTradeDate(input.value);
  pill.classList.toggle("has-value", !!input.value);
}

function openPfDatePicker(wrap) {
  const input = wrap?.querySelector(".ci-date-input");
  if (!input) return;
  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
      return;
    } catch (_) { /* fall through */ }
  }
  const pill = wrap.querySelector(".ci-date-pill");
  const rect = pill?.getBoundingClientRect();
  const prev = input.style.cssText;
  input.style.cssText = [
    "position:fixed",
    `left:${rect?.left ?? 0}px`,
    `top:${rect?.top ?? 0}px`,
    `width:${rect?.width ?? 76}px`,
    `height:${rect?.height ?? 30}px`,
    "opacity:0.01",
    "pointer-events:auto",
    "z-index:9999",
    "border:0",
    "margin:0",
    "padding:0",
    "clip:auto",
    "overflow:visible",
  ].join(";");
  input.focus({ preventScroll: true });
  input.click();
  setTimeout(() => {
    input.style.cssText = prev;
  }, 400);
}

function mergeTrades(pos) {
  const items = [
    ...(pos.lots || []).map((l) => ({ ...l, type: "buy" })),
    ...(pos.sells || []).map((s) => ({ ...s, type: "sell" })),
  ];
  items.sort((a, b) => {
    const da = a.date || "";
    const db = b.date || "";
    if (da && db) return da.localeCompare(db);
    if (da) return -1;
    if (db) return 1;
    return a.type === b.type ? 0 : a.type === "buy" ? -1 : 1;
  });
  return items;
}

function renderTradeHead() {
  return `<div class="pf-trade-head">
    <span class="pf-th-tag"></span>
    <span class="pf-th-broker">증권사</span>
    <span class="pf-th-date">거래일</span>
    <span class="pf-th-price">단가</span>
    <span class="pf-th-shares">수량</span>
    <span class="pf-th-total">합계</span>
    <span class="pf-trade-act-h"></span>
  </div>`;
}

function renderTradeRow(person, posId, trade) {
  const isBuy = trade.type === "buy";
  const sh = Number(trade.shares) || 0;
  const pr = Number(trade.price) || 0;
  const lineTotal = sh > 0 && pr >= 0 ? sh * pr : 0;
  return `<div class="pf-trade ${isBuy ? "pf-trade-buy" : "pf-trade-sell"}" data-person="${person}" data-pos-id="${esc(posId)}" data-trade-type="${trade.type}" data-trade-id="${esc(trade.id)}">
    <span class="pf-trade-tag ${isBuy ? "buy" : "sell"}">${isBuy ? "매수" : "매도"}</span>
    <select class="pf-broker">${brokerOptions(trade.broker || BROKERS[0])}</select>
    <div class="pf-trade-date-cell">${renderTradeDatePill(trade.date)}</div>
    <input type="text" class="pf-price" inputmode="numeric" placeholder="단가" value="${trade.price !== "" && trade.price != null ? Number(trade.price).toLocaleString("ko-KR") : ""}">
    <input type="text" class="pf-shares" inputmode="decimal" placeholder="0" value="${esc(trade.shares ?? "")}">
    <span class="pf-lot-total">${lineTotal ? fmtWon(lineTotal) : "—"}</span>
    <button type="button" class="pf-row-remove pf-trade-act" title="내역 삭제" aria-label="삭제">×</button>
  </div>`;
}

function marketLabel(market) {
  const m = String(market || "").toUpperCase();
  if (m === "US" || m === "NASDAQ" || m === "NYSE" || m === "AMEX") return "미국";
  if (m === "KOSDAQ") return "코스닥";
  if (m === "KOSPI") return "코스피";
  if (m === "ETF") return "ETF";
  return "";
}

function marketBadgeHtml(market) {
  const label = marketLabel(market);
  if (!label) return "";
  const m = String(market || "").toUpperCase();
  let kind = "kr";
  if (isUsMarket(market)) kind = "us";
  else if (m === "KOSDAQ") kind = "kosdaq";
  else if (m === "ETF") kind = "etf";
  return `<span class="pf-market-badge ${kind}">${esc(label)}</span>`;
}

function formatPnl(n) {
  if (!n && n !== 0) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${Math.round(n).toLocaleString("ko-KR")}원`;
}

function renderPosition(person, pos, renderSymbolInput) {
  const stats = statsForPosition(pos);
  const open = expandedIds.has(pos.id);
  if (!(pos.lots || []).length && !(pos.sells || []).length) {
    pos.lots = [{ id: uid("lot"), broker: BROKERS[0], date: "", price: "", shares: "" }];
  }
  const trades = mergeTrades(pos);
  const meta = marketBadgeHtml(pos.market);
  const usHint = isUsMarket(pos.market)
    ? `<span class="pf-us-hint">달러 매매 · 원화 환산</span>`
    : "";

  return `<div class="pf-position${open ? " is-open" : ""}" data-person="${person}" data-pos-id="${esc(pos.id)}">
    <button type="button" class="pf-pos-head" aria-expanded="${open}">
      <div class="pf-pos-head-left">
        <span class="pf-pos-symbol">${esc(pos.symbol || "종목 미입력")}</span>
        ${meta ? `<span class="pf-pos-meta">${meta}</span>` : ""}
      </div>
      <div class="pf-pos-head-stats">
        ${renderPositionHeadStats(pos, stats)}
      </div>
      <span class="pf-chevron" aria-hidden="true"></span>
    </button>
    <div class="pf-pos-body">
      <div class="pf-pos-body-inner">
      <div class="pf-symbol-edit">
        <label>종목</label>
        ${renderSymbolInput(pos.symbol)}
        <input type="hidden" class="pf-code-inp" value="${esc(pos.code || "")}">
        <input type="hidden" class="pf-market-inp" value="${esc(pos.market || "")}">
        ${usHint}
      </div>
      ${`<p class="pf-warn"${stats.overSold ? "" : " hidden"}>매도 수량이 매수 합계를 초과했습니다.</p>`}
      <div class="pf-trade-list">
        ${renderTradeHead()}
        ${trades.map((t) => renderTradeRow(person, pos.id, t)).join("")}
      </div>
      <div class="pf-trade-foot">
        <button type="button" class="pf-add-lot pf-trade-btn buy" data-person="${person}" data-pos-id="${esc(pos.id)}">+ 매수 내역</button>
        <button type="button" class="pf-add-sell pf-trade-btn sell" data-person="${person}" data-pos-id="${esc(pos.id)}">+ 매도 내역</button>
        <button type="button" class="pf-remove-pos pf-edit-only" data-person="${person}" data-pos-id="${esc(pos.id)}">종목 삭제</button>
      </div>
      </div>
    </div>
  </div>`;
}

function renderPersonColumn(person, label, colorClass, data, renderSymbolInput) {
  const summary = calcPersonSummary(data.positions);
  const editing = portfolioEditMode[person];
  const positions = (data.positions || [])
    .map((p) => renderPosition(person, p, renderSymbolInput))
    .join("");

  return `<div class="pf-col ${colorClass}${editing ? " edit-mode" : ""}" data-person="${person}">
    <div class="pf-col-head">
      <div class="pf-col-head-row">
        <h3>${label}</h3>
        <button type="button" class="pf-edit-btn tracker-edit-btn" data-person="${person}">${editing ? "완료" : "편집"}</button>
      </div>
      <div class="pf-col-summary">
        ${renderColSummary(summary)}
      </div>
    </div>
    <div class="pf-positions">${positions || '<p class="pf-empty">등록된 종목이 없습니다.</p>'}</div>
    <button type="button" class="pf-add-pos" data-person="${person}">+ 종목 추가</button>
  </div>`;
}

export function getPortfolioData() {
  return portfolioData;
}

export function applyRemotePortfolio(remote) {
  if (pfJson(remote) === pfJson(portfolioData)) return;
  portfolioData = remote;
  lastCloudJson = pfJson(remote);
  persistPortfolioLocal(remote);
  renderPortfolioPage(window._portfolioRenderSymbolInput);
}

function schedulePortfolioSave() {
  persistPortfolioLocal(portfolioData);
  markPortfolioDirty();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushPortfolioCloud, 500);
}

async function flushPortfolioCloud() {
  if (pfJson(portfolioData) === lastCloudJson) return;
  cloudSaveInFlight = true;
  const snapshot = pfJson(portfolioData);
  const res = await savePortfolioToCloud(portfolioData);
  cloudSaveInFlight = false;
  if (res.ok) lastCloudJson = pfJson(res.data || portfolioData);
}

function readPositionFromDom(posEl) {
  const person = posEl.dataset.person;
  const posId = posEl.dataset.posId;
  const symbolInp = posEl.querySelector(".dl-symbol");
  const lots = [];
  const sells = [];
  for (const row of posEl.querySelectorAll(".pf-trade")) {
    const type = row.dataset.tradeType;
    const record = {
      id: row.dataset.tradeId || uid(type === "buy" ? "lot" : "sell"),
      broker: row.querySelector(".pf-broker")?.value || BROKERS[0],
      date: row.querySelector(".pf-trade-date-input, .ci-date-input")?.value || "",
      price: parseNum(row.querySelector(".pf-price")?.value),
      shares: row.querySelector(".pf-shares")?.value?.trim() || "",
    };
    if (type === "buy") lots.push(record);
    else sells.push(record);
  }
  return {
    person,
    pos: {
      id: posId,
      symbol: symbolInp?.value?.trim() || "",
      code: posEl.querySelector(".pf-code-inp")?.value || symbolInp?.dataset?.symbolCode || "",
      market: posEl.querySelector(".pf-market-inp")?.value || symbolInp?.dataset?.symbolMarket || "",
      lots,
      sells,
    },
  };
}

function syncFromDom() {
  const section = document.getElementById("portfolio-section");
  if (!section) return;
  for (const person of ["yj", "sn"]) {
    const positions = [...section.querySelectorAll(`.pf-position[data-person="${person}"]`)].map(
      (el) => readPositionFromDom(el).pos
    );
    portfolioData[person].positions = positions;
  }
  schedulePortfolioSave();
}

function updatePositionHead(posEl) {
  const { pos } = readPositionFromDom(posEl);
  const stats = calcPosition(pos.lots, pos.sells, quoteOptsForPosition(pos));
  const head = posEl.querySelector(".pf-pos-head");
  if (!head) return;
  const symEl = head.querySelector(".pf-pos-symbol");
  if (symEl) symEl.textContent = pos.symbol || "종목 미입력";
  const metaWrap = head.querySelector(".pf-pos-meta");
  const badge = marketBadgeHtml(pos.market);
  if (metaWrap) metaWrap.innerHTML = badge;
  else if (badge) {
    const left = head.querySelector(".pf-pos-head-left");
    left?.insertAdjacentHTML("beforeend", `<span class="pf-pos-meta">${badge}</span>`);
  } else metaWrap?.remove();
  const statsEl = head.querySelector(".pf-pos-head-stats");
  if (statsEl) statsEl.innerHTML = renderPositionHeadStats(pos, stats);
  const warn = posEl.querySelector(".pf-warn");
  if (warn) warn.hidden = !stats.overSold;
  const codeInp = posEl.querySelector(".pf-code-inp");
  const marketInp = posEl.querySelector(".pf-market-inp");
  const symbolInp = posEl.querySelector(".dl-symbol");
  if (codeInp && symbolInp?.dataset.symbolCode) codeInp.value = symbolInp.dataset.symbolCode;
  if (marketInp && symbolInp?.dataset.symbolMarket) marketInp.value = symbolInp.dataset.symbolMarket;
}

function updateLotTotal(row) {
  const sh = Number(parseNum(row.querySelector(".pf-shares")?.value)) || 0;
  const pr = Number(parseNum(row.querySelector(".pf-price")?.value)) || 0;
  const cell = row.querySelector(".pf-lot-total");
  if (cell) cell.textContent = sh > 0 && pr >= 0 ? fmtWon(sh * pr) : "—";
}

function resortTradeTable(posEl) {
  const person = posEl.dataset.person;
  const posId = posEl.dataset.posId;
  const pos = portfolioData[person]?.positions?.find((p) => p.id === posId);
  if (!pos) return;
  const list = posEl.querySelector(".pf-trade-list");
  if (!list) return;
  const head = list.querySelector(".pf-trade-head");
  list.innerHTML = (head ? head.outerHTML : renderTradeHead()) + mergeTrades(pos).map((t) => renderTradeRow(person, posId, t)).join("");
}

function refreshSummaries() {
  const section = document.getElementById("portfolio-section");
  if (!section) return;
  for (const person of ["yj", "sn"]) {
    const col = section.querySelector(`.pf-col.${person}`);
    if (!col) continue;
    const summaryEl = col.querySelector(".pf-col-summary");
    if (summaryEl) {
      summaryEl.innerHTML = renderColSummary(calcPersonSummary(portfolioData[person]?.positions));
    }
  }
  updatePortfolioCharts(section, portfolioData, getQuoteState());
}

function refreshQuoteUI() {
  const section = document.getElementById("portfolio-section");
  if (!section) return;
  const bar = section.querySelector("[data-pf-quote-bar]");
  if (bar) {
    const tmp = document.createElement("div");
    tmp.innerHTML = renderQuoteBar();
    bar.replaceWith(tmp.firstElementChild);
  }
  for (const posEl of section.querySelectorAll(".pf-position")) {
    updatePositionHead(posEl);
  }
  refreshSummaries();
}

export function renderPortfolioPage(renderSymbolInput) {
  window._portfolioRenderSymbolInput = renderSymbolInput;
  const section = document.getElementById("portfolio-section");
  if (!section) return;

  const syncStatus =
    window._portfolioStoreMode === "supabase"
      ? '<span class="pf-sync ok">Supabase 동기화</span>'
      : '<span class="pf-sync local">브라우저 저장</span>';

  section.innerHTML = `
    <div class="pf-header">
      <h2>💼 투자 포트폴리오</h2>
      ${syncStatus}
    </div>
    ${renderQuoteBar()}
    ${renderPortfolioDashboard(portfolioData, getQuoteState())}
    <div class="pf-dual">
      ${renderPersonColumn("yj", "영재", "yj", portfolioData.yj, renderSymbolInput)}
      ${renderPersonColumn("sn", "시온", "sn", portfolioData.sn, renderSymbolInput)}
    </div>`;

  attachPortfolioEvents(section, renderSymbolInput);
  attachSymbolAutocomplete(section);
  attachChartInteractions(section);
}

function togglePositionOpen(pos, open) {
  if (!pos) return;
  const head = pos.querySelector(".pf-pos-head");
  const shouldOpen = open ?? !pos.classList.contains("is-open");
  pos.classList.toggle("is-open", shouldOpen);
  head?.setAttribute("aria-expanded", String(shouldOpen));
  const id = pos.dataset.posId;
  if (id) {
    if (shouldOpen) expandedIds.add(id);
    else expandedIds.delete(id);
  }
}

function attachPortfolioEvents(section, renderSymbolInput) {
  if (section._pfAttached) return;
  section._pfAttached = true;

  section.addEventListener("click", (e) => {
    const head = e.target.closest(".pf-pos-head");
    if (head && !e.target.closest(".pf-pos-body")) {
      const pos = head.closest(".pf-position");
      if (!pos?.dataset.posId) return;
      togglePositionOpen(pos);
      return;
    }

    const datePill = e.target.closest(".ci-date-pill");
    if (datePill?.closest("#portfolio-section")) {
      openPfDatePicker(datePill.closest(".ci-date-wrap"));
      return;
    }

    const editBtn = e.target.closest(".pf-edit-btn");
    if (editBtn) {
      const person = editBtn.dataset.person;
      portfolioEditMode[person] = !portfolioEditMode[person];
      renderPortfolioPage(renderSymbolInput);
      return;
    }

    const addPos = e.target.closest(".pf-add-pos");
    if (addPos) {
      const person = addPos.dataset.person;
      const newPos = {
        id: uid("pos"),
        symbol: "",
        code: "",
        market: "",
        lots: [{ id: uid("lot"), broker: BROKERS[0], date: "", price: "", shares: "" }],
        sells: [],
      };
      portfolioData[person].positions.push(newPos);
      expandedIds.add(newPos.id);
      persistPortfolioLocal(portfolioData);
      schedulePortfolioSave();
      renderPortfolioPage(renderSymbolInput);
      return;
    }

    const addLot = e.target.closest(".pf-add-lot");
    if (addLot) {
      const person = addLot.dataset.person;
      const posId = addLot.dataset.posId;
      const pos = portfolioData[person]?.positions?.find((p) => p.id === posId);
      if (!pos) return;
      pos.lots.push({ id: uid("lot"), broker: BROKERS[0], date: "", price: "", shares: "" });
      expandedIds.add(posId);
      persistPortfolioLocal(portfolioData);
      schedulePortfolioSave();
      renderPortfolioPage(renderSymbolInput);
      return;
    }

    const addSell = e.target.closest(".pf-add-sell");
    if (addSell) {
      const person = addSell.dataset.person;
      const posId = addSell.dataset.posId;
      const pos = portfolioData[person]?.positions?.find((p) => p.id === posId);
      if (!pos) return;
      if (!pos.sells) pos.sells = [];
      pos.sells.push({ id: uid("sell"), broker: BROKERS[0], date: "", price: "", shares: "" });
      expandedIds.add(posId);
      persistPortfolioLocal(portfolioData);
      schedulePortfolioSave();
      renderPortfolioPage(renderSymbolInput);
      return;
    }

    const rmPos = e.target.closest(".pf-remove-pos");
    if (rmPos) {
      const person = rmPos.dataset.person;
      const posId = rmPos.dataset.posId;
      portfolioData[person].positions = portfolioData[person].positions.filter((p) => p.id !== posId);
      expandedIds.delete(posId);
      persistPortfolioLocal(portfolioData);
      schedulePortfolioSave();
      renderPortfolioPage(renderSymbolInput);
      return;
    }

    const rmTrade = e.target.closest(".pf-row-remove");
    if (rmTrade) {
      const col = rmTrade.closest(".pf-col");
      if (!col?.classList.contains("edit-mode")) return;
      const row = rmTrade.closest(".pf-trade");
      const posEl = rmTrade.closest(".pf-position");
      row?.remove();
      if (posEl) {
        if (!posEl.querySelectorAll(".pf-trade").length) {
          const person = posEl.dataset.person;
          const posId = posEl.dataset.posId;
          const pos = portfolioData[person]?.positions?.find((p) => p.id === posId);
          const lot = { id: uid("lot"), broker: BROKERS[0], date: "", price: "", shares: "" };
          if (pos) {
            pos.lots = [lot];
            pos.sells = [];
          }
          const list = posEl.querySelector(".pf-trade-list");
          list?.insertAdjacentHTML("beforeend", renderTradeRow(person, posId, { ...lot, type: "buy" }));
        }
        syncFromDom();
        updatePositionHead(posEl);
        refreshSummaries();
      }
      return;
    }
  });

  section.addEventListener("input", (e) => {
    const row = e.target.closest(".pf-trade");
    const posEl = e.target.closest(".pf-position");
    if (row) updateLotTotal(row);
    if (posEl) {
      clearTimeout(posEl._pfTimer);
      posEl._pfTimer = setTimeout(() => {
        syncFromDom();
        updatePositionHead(posEl);
        refreshSummaries();
      }, 300);
    }
    if (e.target.closest(".dl-symbol") && posEl) {
      clearTimeout(posEl._symTimer);
      posEl._symTimer = setTimeout(() => {
        syncFromDom();
        updatePositionHead(posEl);
        refreshSummaries();
        requestQuoteRefresh();
      }, 200);
    }
  });

  section.addEventListener("change", (e) => {
    if (e.target.closest(".pf-broker, .pf-trade-date-input, .ci-date-input")) {
      syncFromDom();
      const posEl = e.target.closest(".pf-position");
      const dateInp = e.target.closest(".pf-trade-date-input, .ci-date-input");
      if (dateInp) syncTradeDatePill(dateInp);
      if (posEl) {
        if (dateInp) resortTradeTable(posEl);
        updatePositionHead(posEl);
      }
      refreshSummaries();
    }
  });

  section.addEventListener("blur", (e) => {
    const price = e.target.closest(".pf-price");
    if (price) {
      const n = parseNum(price.value);
      price.value = n !== "" ? Number(n).toLocaleString("ko-KR") : "";
    }
  }, true);
}

export function initPortfolioModule(renderSymbolInput, storeMode) {
  window._portfolioStoreMode = storeMode;
  portfolioData = loadPortfolio();
  lastCloudJson = pfJson(portfolioData);
  renderPortfolioPage(renderSymbolInput);
  startPortfolioQuotes(() => portfolioData, refreshQuoteUI);
}

export function setPortfolioFromRemote(remote, meta = {}) {
  if (meta.source === "initial") {
    portfolioData = remote?.yj ? remote : defaultPortfolio();
    lastCloudJson = pfJson(portfolioData);
    persistPortfolioLocal(portfolioData);
    renderPortfolioPage(window._portfolioRenderSymbolInput);
    return;
  }
  if (cloudSaveInFlight) return;
  if (pfJson(remote) === pfJson(portfolioData)) {
    lastCloudJson = pfJson(remote);
    return;
  }
  portfolioData = remote;
  lastCloudJson = pfJson(remote);
  persistPortfolioLocal(remote);
  renderPortfolioPage(window._portfolioRenderSymbolInput);
}
