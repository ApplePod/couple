/**
 * 포트폴리오 월별 매매 정리 — 거래일 기준 필터
 */
import { isUsMarket } from "./portfolio-calc.js";
import { TRACKER_YEARS, MONTH_LABELS } from "./app-period.js";

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

function fmtTradeAmt(trade) {
  const sh = Number(trade.shares) || 0;
  const pr = Number(trade.price) || 0;
  const amt = sh * pr;
  if (!amt) return "—";
  if (isUsMarket(trade.market)) {
    return `$${amt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return fmtWon(amt);
}

export function parseTradeDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return null;
  return { year: +m[1], month: +m[2], day: +m[3] };
}

function tradeInMonth(dateStr, year, month) {
  const p = parseTradeDate(dateStr);
  if (!p) return false;
  return p.year === +year && p.month === +month;
}

function flattenTrade(pos, person, type, row) {
  return {
    person,
    personLabel: PERSON_LABEL[person] || person,
    symbol: pos.symbol || pos.code || "종목 미입력",
    code: pos.code || "",
    market: pos.market || "",
    type,
    id: row.id,
    broker: row.broker || "",
    date: row.date || "",
    price: row.price,
    shares: row.shares,
  };
}

/** @returns {{ inMonth: object[], undated: object[] }} */
export function collectMonthTrades(data, year, month) {
  const inMonth = [];
  const undated = [];
  for (const person of ["yj", "sn"]) {
    for (const pos of data[person]?.positions || []) {
      for (const lot of pos.lots || []) {
        const t = flattenTrade(pos, person, "buy", lot);
        const sh = Number(t.shares) || 0;
        const pr = Number(t.price) || 0;
        if (sh <= 0 && pr <= 0) continue;
        if (!t.date) undated.push(t);
        else if (tradeInMonth(t.date, year, month)) inMonth.push(t);
      }
      for (const sell of pos.sells || []) {
        const t = flattenTrade(pos, person, "sell", sell);
        const sh = Number(t.shares) || 0;
        const pr = Number(t.price) || 0;
        if (sh <= 0 && pr <= 0) continue;
        if (!t.date) undated.push(t);
        else if (tradeInMonth(t.date, year, month)) inMonth.push(t);
      }
    }
  }
  inMonth.sort((a, b) => {
    const da = a.date || "";
    const db = b.date || "";
    if (da !== db) return db.localeCompare(da);
    if (a.person !== b.person) return a.person.localeCompare(b.person);
    return (a.symbol || "").localeCompare(b.symbol || "", "ko");
  });
  return { inMonth, undated };
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

function personMarketBuyKrw(trades, person, bucket, fxRate) {
  return trades
    .filter((t) => {
      if (t.person !== person || t.type !== "buy") return false;
      return bucket === "us" ? isUsMarket(t.market) : !isUsMarket(t.market);
    })
    .reduce((s, t) => s + tradeAmountKrw(t, fxRate), 0);
}

function formatShortDate(dateStr) {
  const p = parseTradeDate(dateStr);
  if (!p) return "—";
  return `${p.month}/${p.day}`;
}

function renderTradeRow(trade, undated = false) {
  const sh = Number(trade.shares) || 0;
  const kind = trade.type === "buy" ? "매수" : "매도";
  const dateLabel = undated ? "미입력" : formatShortDate(trade.date);
  return `<div class="pf-mt-row ${trade.type}${undated ? " undated" : ""}">
    <span class="pf-mt-date">${dateLabel}</span>
    <span class="pf-mt-person ${trade.person}">${esc(trade.personLabel)}</span>
    <span class="pf-mt-symbol" title="${esc(trade.symbol)}">${esc(trade.symbol)}</span>
    <span class="pf-mt-tag ${trade.type}">${kind}</span>
    <span class="pf-mt-detail">${sh > 0 ? `${sh.toLocaleString("ko-KR")}주 · ` : ""}${fmtTradeAmt(trade)}</span>
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

export function renderPortfolioMonthlySection(data, period, quoteState, budgetCtx) {
  const year = period?.year ?? TRACKER_YEARS[0];
  const month = String(period?.month ?? "7");
  const fx = quoteState?.fxRate || 1;
  const { inMonth, undated } = collectMonthTrades(data, year, month);
  const summary = summarizeMonthTrades(inMonth, fx);

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

  const timeline =
    inMonth.length > 0
      ? `<div class="pf-mt-list">${inMonth.map(renderTradeRow).join("")}</div>`
      : `<p class="pf-month-empty">이 달 거래일이 있는 매매 내역이 없습니다.</p>`;

  const undatedBlock =
    undated.length > 0
      ? `<details class="pf-month-undated">
    <summary>거래일 미입력 ${undated.length}건</summary>
    <div class="pf-mt-list">${undated.map((t) => renderTradeRow(t, true)).join("")}</div>
  </details>`
      : "";

  return `<section class="pf-monthly" data-pf-monthly>
    <div class="pf-monthly-head">
      <h3>📅 월별 매매 정리</h3>
      <p class="pf-monthly-desc">체크리스트와 같은 년·월 · 거래일 기준 · 미국 주식은 환율로 원화 환산</p>
    </div>
    ${renderPeriodTabs(year, month)}
    <div class="pf-month-title">${year}년 ${month}월</div>
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
    ${renderBudgetRows(inMonth, budgetCtx, fx)}
    <h4 class="pf-month-subtitle">매매 타임라인</h4>
    ${timeline}
    ${undatedBlock}
  </section>`;
}
