/**
 * 포트폴리오 월별 매매 — 입력·저장 UI (ledger 기준)
 */
import { isUsMarket } from "./portfolio-calc.js";
import { TRACKER_YEARS, MONTH_LABELS } from "./app-period.js";
import {
  getMonthTrades,
  defaultTradeDate,
  parseTradeDate,
} from "./portfolio-data.js";

export { parseTradeDate };

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

const PERSON_LABEL = { yj: "영재", sn: "시온" };

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

function fmtSignedWon(n) {
  if (!n && n !== 0) return "0원";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.round(Math.abs(n)).toLocaleString("ko-KR")}원`;
}

export function tradeAmountKrw(trade, fxRate = 1) {
  const sh = Number(trade.shares) || 0;
  const pr = Number(trade.price) || 0;
  const amt = sh * pr;
  if (!amt) return 0;
  return isUsMarket(trade.market) ? amt * (Number(fxRate) > 0 ? Number(fxRate) : 1) : amt;
}

export function summarizeMonthTrades(trades, fxRate = 1) {
  let buyKrw = 0;
  let sellKrw = 0;
  let buyDomestic = 0;
  let buyUs = 0;
  let buyCount = 0;
  let sellCount = 0;
  for (const t of trades) {
    const krw = tradeAmountKrw(t, fxRate);
    if (!krw) continue;
    if (t.type === "buy") {
      buyKrw += krw;
      buyCount++;
      if (isUsMarket(t.market)) buyUs += krw;
      else buyDomestic += krw;
    } else {
      sellKrw += krw;
      sellCount++;
    }
  }
  return {
    buyKrw,
    sellKrw,
    netKrw: buyKrw - sellKrw,
    buyDomestic,
    buyUs,
    buyCount,
    sellCount,
    count: trades.length,
  };
}

export function collectMonthTrades(data, year, month) {
  const trades = [];
  for (const person of ["yj", "sn"]) {
    for (const t of getMonthTrades(data, year, month, person)) {
      trades.push({ ...t, person, personLabel: PERSON_LABEL[person] || person });
    }
  }
  trades.sort((a, b) => {
    const da = a.date || "";
    const db = b.date || "";
    if (da !== db) return db.localeCompare(da);
    if (a.person !== b.person) return a.person.localeCompare(b.person);
    return (a.symbol || "").localeCompare(b.symbol || "", "ko");
  });
  return { inMonth: trades, undated: [] };
}

function personMarketBuyKrw(trades, person, bucket, fxRate) {
  return trades
    .filter((t) => {
      if (t.person !== person || t.type !== "buy") return false;
      return bucket === "us" ? isUsMarket(t.market) : !isUsMarket(t.market);
    })
    .reduce((s, t) => s + tradeAmountKrw(t, fxRate), 0);
}

function brokerOptions(selected) {
  return BROKERS.map((b) => `<option value="${esc(b)}"${b === selected ? " selected" : ""}>${esc(b)}</option>`).join("");
}

function fmtPriceInputValue(n, market) {
  if (n === "" || n == null) return "";
  const num = Number(n);
  if (!Number.isFinite(num)) return "";
  if (isUsMarket(market)) {
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  return num.toLocaleString("ko-KR");
}

function fmtTradeTotal(n, market) {
  if (!n && n !== 0) return "—";
  if (isUsMarket(market)) {
    return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return fmtWon(n);
}

function formatTradeDate(date) {
  if (!date) return "날짜";
  const p = parseTradeDate(date);
  if (!p) return date;
  return `${p.month}/${p.day}`;
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

function renderPriceField(trade) {
  const us = isUsMarket(trade.market);
  const value = fmtPriceInputValue(trade.price, trade.market);
  const placeholder = us ? "0.00" : "0";
  const prefix = us ? `<span class="pf-currency-mark pf-currency-prefix" aria-hidden="true">$</span>` : "";
  const suffix = us ? "" : `<span class="pf-currency-mark pf-currency-suffix" aria-hidden="true">원</span>`;
  return `<div class="pf-price-field ${us ? "usd" : "krw"}">
    ${prefix}
    <input type="text" class="pf-price" inputmode="decimal" placeholder="${placeholder}" value="${esc(value)}">
    ${suffix}
  </div>`;
}

function renderTradeHead(market = "") {
  const unit = isUsMarket(market) ? "$" : "원";
  return `<div class="pf-trade-head pf-mm-trade-head">
    <span class="pf-th-tag"></span>
    <span class="pf-th-symbol">종목</span>
    <span class="pf-th-broker">증권사</span>
    <span class="pf-th-date">거래일</span>
    <span class="pf-th-price">단가 <span class="pf-th-unit">(${unit})</span></span>
    <span class="pf-th-shares">수량</span>
    <span class="pf-th-total">합계</span>
    <span class="pf-trade-act-h"></span>
  </div>`;
}

export function renderEditableTradeRow(person, trade, renderSymbolInput) {
  const isBuy = trade.type !== "sell";
  const sh = Number(trade.shares) || 0;
  const pr = Number(trade.price) || 0;
  const lineTotal = sh > 0 && pr >= 0 ? sh * pr : 0;
  const usHint = isUsMarket(trade.market)
    ? `<span class="pf-us-hint pf-mm-us-hint">달러 · 원화 환산</span>`
    : "";

  return `<div class="pf-trade pf-mm-trade ${isBuy ? "pf-trade-buy" : "pf-trade-sell"}" data-person="${person}" data-trade-id="${esc(trade.id)}" data-trade-type="${isBuy ? "buy" : "sell"}">
    <span class="pf-trade-tag ${isBuy ? "buy" : "sell"}">${isBuy ? "매수" : "매도"}</span>
    <div class="pf-mm-symbol-cell">
      ${renderSymbolInput(trade.symbol, { code: trade.code, market: trade.market })}
      <input type="hidden" class="pf-code-inp" value="${esc(trade.code || "")}">
      <input type="hidden" class="pf-market-inp" value="${esc(trade.market || "")}">
      ${usHint}
    </div>
    <select class="pf-broker">${brokerOptions(trade.broker || BROKERS[0])}</select>
    <div class="pf-trade-date-cell">${renderTradeDatePill(trade.date)}</div>
    ${renderPriceField(trade)}
    <input type="text" class="pf-shares" inputmode="decimal" placeholder="0" value="${esc(trade.shares ?? "")}">
    <span class="pf-lot-total">${lineTotal ? fmtTradeTotal(lineTotal, trade.market) : "—"}</span>
    <button type="button" class="pf-row-remove pf-trade-act" title="삭제" aria-label="삭제">×</button>
  </div>`;
}

function renderPersonMonthColumn(person, label, colorClass, trades, renderSymbolInput, editMode) {
  const headMarket = trades.find((t) => t.market)?.market || "";
  const rows = trades.length
    ? trades.map((t) => renderEditableTradeRow(person, t, renderSymbolInput)).join("")
    : "";

  return `<div class="pf-mm-col ${colorClass}${editMode ? " edit-mode" : ""}" data-person="${person}">
    <div class="pf-mm-col-head">
      <h4>${label}</h4>
      <button type="button" class="pf-edit-btn tracker-edit-btn pf-mm-edit-btn" data-person="${person}">${editMode ? "완료" : "편집"}</button>
    </div>
    <div class="pf-mm-trade-list">
      ${trades.length ? renderTradeHead(headMarket) : ""}
      ${rows || '<p class="pf-mm-empty">+ 매수 / + 매도로 이 달 기록을 추가하세요.</p>'}
    </div>
    <div class="pf-mm-actions">
      <button type="button" class="pf-mm-add pf-trade-btn buy" data-person="${person}" data-trade-type="buy">+ 매수</button>
      <button type="button" class="pf-mm-add pf-trade-btn sell" data-person="${person}" data-trade-type="sell">+ 매도</button>
    </div>
  </div>`;
}

function renderBudgetRows(trades, budgetCtx, fxRate) {
  if (!budgetCtx?.rows?.length) return "";
  const rows = budgetCtx.rows
    .map((row) => {
      const bought = personMarketBuyKrw(trades, row.person, row.market, fxRate);
      const plan = Number(row.plan) || 0;
      const diff = bought - plan;
      const checkAmt = row.checkActual != null && row.checkActual !== "" ? Number(row.checkActual) : null;
      const diffCls = diff > 0 ? "over" : diff < 0 ? "under" : "";
      return `<div class="pf-budget-row">
        <span class="pf-budget-label">${esc(row.label)}</span>
        <span class="pf-budget-plan">예산 ${fmtWon(plan)}</span>
        <span class="pf-budget-buy">매수 ${fmtWon(bought)}</span>
        <span class="pf-budget-diff ${diffCls}">${diff === 0 ? "일치" : fmtSignedWon(diff)}</span>
        ${checkAmt != null ? `<span class="pf-budget-check">체크 ${fmtWon(checkAmt)}</span>` : ""}
      </div>`;
    })
    .join("");
  return `<div class="pf-month-budget">
    <h4 class="pf-month-subtitle">예산 대비 <span class="pf-month-sub-hint">체크리스트 계획 · 원화 환산</span></h4>
    <div class="pf-budget-rows">${rows}</div>
  </div>`;
}

function renderPeriodTabs(year, month) {
  const yearBtns = TRACKER_YEARS.map(
    (y) =>
      `<button type="button" class="year-tab pf-period-tab${y === year ? " active" : ""}" data-pf-year="${y}">${y}년</button>`
  ).join("");
  const monthBtns = MONTH_LABELS.map((lbl, i) => {
    const m = String(i + 1);
    return `<button type="button" class="month-tab pf-period-tab${m === String(+month) ? " active" : ""}" data-pf-month="${m}">${lbl}</button>`;
  }).join("");
  return `<div class="pf-period-tabs">
    <div class="year-tabs pf-year-tabs">${yearBtns}</div>
    <div class="month-tabs pf-month-tabs">${monthBtns}</div>
  </div>`;
}

export function renderPortfolioMonthlySection(
  data,
  period,
  quoteState,
  renderSymbolInput,
  editMode = { yj: false, sn: false }
) {
  const year = period?.year ?? TRACKER_YEARS[0];
  const month = String(period?.month ?? "7");
  const fx = quoteState?.fxRate || 1;
  const yjTrades = getMonthTrades(data, year, month, "yj");
  const snTrades = getMonthTrades(data, year, month, "sn");
  const allTrades = [
    ...yjTrades.map((t) => ({ ...t, person: "yj", personLabel: PERSON_LABEL.yj })),
    ...snTrades.map((t) => ({ ...t, person: "sn", personLabel: PERSON_LABEL.sn })),
  ];
  const summary = summarizeMonthTrades(allTrades, fx);

  const summaryCards = [
    { lbl: "매수", val: summary.buyKrw ? fmtWon(summary.buyKrw) : "0원", sub: summary.buyCount ? `${summary.buyCount}건` : "" },
    { lbl: "매도", val: summary.sellKrw ? fmtWon(summary.sellKrw) : "0원", sub: summary.sellCount ? `${summary.sellCount}건` : "" },
    {
      lbl: "순투자",
      val: summary.netKrw ? fmtSignedWon(summary.netKrw) : "0원",
      hi: true,
      gain: summary.netKrw > 0,
      loss: summary.netKrw < 0,
    },
    {
      lbl: "국내 / 미국",
      val: summary.buyKrw ? `${fmtWon(summary.buyDomestic)} · ${fmtWon(summary.buyUs)}` : "—",
      sub: "매수 기준",
    },
  ];

  return `<section class="pf-monthly" data-pf-monthly data-year="${year}" data-month="${month}">
    <div class="pf-monthly-head">
      <h3>📅 월별 매매 정리</h3>
      <p class="pf-monthly-desc">${year}년 ${month}월 · 아래에 적은 기록만 저장·표시 · 체크리스트와 같은 년·월 탭</p>
    </div>
    ${renderPeriodTabs(year, month)}
    <div class="pf-month-title">${year}년 ${month}월 합계</div>
    <div class="pf-month-summary">
      ${summaryCards
        .map(
          (s) =>
            `<div class="pf-ms-card${s.hi ? " highlight" : ""}${s.gain ? " gain" : ""}${s.loss ? " loss" : ""}">
        <div class="pf-ms-val">${s.val}</div>
        <div class="pf-ms-lbl">${s.lbl}${s.sub ? `<span class="pf-ms-sub">${s.sub}</span>` : ""}</div>
      </div>`
        )
        .join("")}
    </div>
    <div class="pf-mm-dual">
      ${renderPersonMonthColumn("yj", "영재", "yj", yjTrades, renderSymbolInput, editMode.yj)}
      ${renderPersonMonthColumn("sn", "시온", "sn", snTrades, renderSymbolInput, editMode.sn)}
    </div>
  </section>`;
}

export function parseNum(str) {
  const n = String(str ?? "").replace(/[^0-9.]/g, "");
  if (!n) return "";
  const v = Number(n);
  return Number.isFinite(v) ? v : "";
}

export function readMonthTradesFromDom(monthlyEl, person) {
  const col = monthlyEl.querySelector(`.pf-mm-col[data-person="${person}"]`);
  if (!col) return [];
  const trades = [];
  for (const row of col.querySelectorAll(".pf-mm-trade")) {
    const symbolInp = row.querySelector(".dl-symbol");
    trades.push({
      id: row.dataset.tradeId || `trade_${Date.now()}`,
      type: row.dataset.tradeType === "sell" ? "sell" : "buy",
      symbol: symbolInp?.value?.trim() || "",
      code: row.querySelector(".pf-code-inp")?.value || symbolInp?.dataset?.symbolCode || "",
      market: row.querySelector(".pf-market-inp")?.value || symbolInp?.dataset?.symbolMarket || "",
      broker: row.querySelector(".pf-broker")?.value || BROKERS[0],
      date: row.querySelector(".pf-trade-date-input, .ci-date-input")?.value || "",
      price: parseNum(row.querySelector(".pf-price")?.value),
      shares: row.querySelector(".pf-shares")?.value?.trim() || "",
    });
  }
  return trades;
}

export function syncTradeDatePill(input) {
  const wrap = input?.closest(".ci-date-wrap");
  const pill = wrap?.querySelector(".ci-date-pill");
  const text = pill?.querySelector(".ci-date-text");
  if (!pill || !text) return;
  const v = input.value;
  text.textContent = v ? formatTradeDate(v) : "날짜";
  pill.classList.toggle("has-value", !!v);
}

export function updateMmLotTotal(row) {
  const sh = Number(parseNum(row.querySelector(".pf-shares")?.value)) || 0;
  const pr = Number(parseNum(row.querySelector(".pf-price")?.value)) || 0;
  const market = row.querySelector(".pf-market-inp")?.value || "";
  const cell = row.querySelector(".pf-lot-total");
  if (cell) cell.textContent = sh > 0 && pr >= 0 ? fmtTradeTotal(sh * pr, market) : "—";
}

export function enrichTrade(trade, lookupSymbol) {
  if (!trade || !lookupSymbol) return trade;
  const hit = lookupSymbol(trade.symbol, trade.code);
  if (!hit) return trade;
  return {
    ...trade,
    symbol: trade.symbol || hit.name,
    code: String(trade.code || "").trim() || hit.code,
    market: String(trade.market || "").trim() || hit.market,
  };
}

export function blankTrade(year, month) {
  return {
    id: `trade_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: "buy",
    symbol: "",
    code: "",
    market: "",
    broker: BROKERS[0],
    date: defaultTradeDate(year, month),
    price: "",
    shares: "",
  };
}
