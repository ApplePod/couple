/**
 * 투자 포트폴리오 — 월별 ledger 저장 · 상단은 전체 합산 뷰
 */
import {
  loadPortfolio,
  persistPortfolioLocal,
  markPortfolioDirty,
  savePortfolioToCloud,
  defaultPortfolio,
} from "./portfolio-store.js";
import { attachSymbolAutocomplete, lookupSymbol } from "./symbol-search.js";
import {
  renderPortfolioDashboard,
  updatePortfolioCharts,
  attachChartInteractions,
} from "./portfolio-charts.js";
import { isUsMarket } from "./portfolio-calc.js";
import {
  startPortfolioQuotes,
  getQuoteState,
  formatFxRate,
  formatQuoteTime,
  requestQuoteRefresh,
} from "./portfolio-quotes.js";
import {
  renderPortfolioMonthlySection,
  readMonthTradesFromDom,
  syncTradeDatePill,
  updateMmLotTotal,
  enrichTrade,
  blankTrade,
  parseNum,
  BROKERS,
} from "./portfolio-monthly.js";
import {
  normalizePortfolio,
  aggregatedView,
  setMonthTrades,
  ensureMonth,
  hasLedgerData,
} from "./portfolio-data.js";

export { BROKERS };

function enrichPortfolioData(data) {
  const normalized = normalizePortfolio(data);
  for (const y of Object.keys(normalized.ledger || {})) {
    for (const m of Object.keys(normalized.ledger[y])) {
      for (const person of ["yj", "sn"]) {
        const trades = normalized.ledger[y][m][person]?.trades || [];
        normalized.ledger[y][m][person].trades = trades.map((t) => enrichTrade(t, lookupSymbol));
      }
    }
  }
  return normalized;
}

let portfolioData = enrichPortfolioData(loadPortfolio());
let saveTimer = null;
let cloudSaveInFlight = false;
let lastCloudJson = JSON.stringify(portfolioData);
const portfolioEditMode = { yj: false, sn: false };
let periodApi = null;
let getBudgetContext = null;

function pfJson(d) {
  return JSON.stringify(d);
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function viewData() {
  return aggregatedView(portfolioData);
}

function currentPeriod() {
  return periodApi?.getPeriod?.() ?? { year: 2026, month: "7" };
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
  const res = await savePortfolioToCloud(portfolioData);
  cloudSaveInFlight = false;
  if (res.ok) lastCloudJson = pfJson(res.data || portfolioData);
}

function syncMonthFromDom() {
  const section = document.getElementById("portfolio-section");
  const monthly = section?.querySelector("[data-pf-monthly]");
  if (!monthly) return;
  const year = +monthly.dataset.year;
  const month = monthly.dataset.month;
  if (!year || !month) return;
  for (const person of ["yj", "sn"]) {
    const trades = readMonthTradesFromDom(monthly, person).map((t) => enrichTrade(t, lookupSymbol));
    setMonthTrades(portfolioData, year, month, person, trades);
  }
  schedulePortfolioSave();
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

function renderMonthlyBlock(renderSymbolInput) {
  return renderPortfolioMonthlySection(
    portfolioData,
    currentPeriod(),
    getQuoteState(),
    getBudgetContext?.() ?? null,
    renderSymbolInput,
    portfolioEditMode
  );
}

function refreshDashboard() {
  const section = document.getElementById("portfolio-section");
  if (!section) return;
  const dash = section.querySelector("[data-pf-dashboard]");
  if (dash) {
    const tmp = document.createElement("div");
    tmp.innerHTML = renderPortfolioDashboard(viewData(), getQuoteState());
    dash.replaceWith(tmp.firstElementChild);
  } else {
    updatePortfolioCharts(section, viewData(), getQuoteState());
    return;
  }
  updatePortfolioCharts(section, viewData(), getQuoteState());
}

export function refreshPortfolioMonthly() {
  onPortfolioPeriodChange();
}

export function refreshPortfolioBudget() {
  const section = document.getElementById("portfolio-section");
  const monthly = section?.querySelector("[data-pf-monthly]");
  if (!monthly || !window._portfolioRenderSymbolInput) return;
  syncMonthFromDom();
  const tmp = document.createElement("div");
  tmp.innerHTML = renderMonthlyBlock(window._portfolioRenderSymbolInput);
  monthly.replaceWith(tmp.firstElementChild);
  attachSymbolAutocomplete(section);
  refreshDashboard();
}

export function onPortfolioPeriodChange() {
  syncMonthFromDom();
  renderPortfolioPage(window._portfolioRenderSymbolInput);
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
  refreshDashboard();
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
    ${renderPortfolioDashboard(viewData(), getQuoteState())}
    ${renderMonthlyBlock(renderSymbolInput)}`;

  attachPortfolioEvents(section, renderSymbolInput);
  attachSymbolAutocomplete(section);
  attachChartInteractions(section);
}

function openPfDatePicker(wrap) {
  const input = wrap?.querySelector(".ci-date-input");
  if (!input) return;
  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
      return;
    } catch { /* ignore */ }
  }
  input.focus();
  input.click();
}

function addMonthTrade(person, type) {
  const { year, month } = currentPeriod();
  syncMonthFromDom();
  const bucket = ensureMonth(portfolioData, year, month);
  const trade = { ...blankTrade(year, month), type: type === "sell" ? "sell" : "buy" };
  bucket[person].trades.push(trade);
  schedulePortfolioSave();
  renderPortfolioPage(window._portfolioRenderSymbolInput);
}

function attachPortfolioEvents(section, renderSymbolInput) {
  if (section._pfAttached) return;
  section._pfAttached = true;

  section.addEventListener("click", (e) => {
    const yearBtn = e.target.closest("[data-pf-year]");
    if (yearBtn && periodApi?.setPeriod) {
      syncMonthFromDom();
      periodApi.setPeriod(+yearBtn.dataset.pfYear, periodApi.getPeriod().month);
      return;
    }
    const monthBtn = e.target.closest("[data-pf-month]");
    if (monthBtn && periodApi?.setPeriod) {
      syncMonthFromDom();
      periodApi.setPeriod(periodApi.getPeriod().year, monthBtn.dataset.pfMonth);
      return;
    }

    const datePill = e.target.closest(".ci-date-pill");
    if (datePill?.closest("#portfolio-section")) {
      openPfDatePicker(datePill.closest(".ci-date-wrap"));
      return;
    }

    const editBtn = e.target.closest(".pf-mm-edit-btn");
    if (editBtn) {
      syncMonthFromDom();
      const person = editBtn.dataset.person;
      portfolioEditMode[person] = !portfolioEditMode[person];
      renderPortfolioPage(renderSymbolInput);
      return;
    }

    const addBtn = e.target.closest(".pf-mm-add");
    if (addBtn) {
      addMonthTrade(addBtn.dataset.person, addBtn.dataset.tradeType);
      return;
    }

    const rm = e.target.closest(".pf-row-remove");
    if (rm) {
      const col = rm.closest(".pf-mm-col");
      if (!col?.classList.contains("edit-mode")) return;
      rm.closest(".pf-mm-trade")?.remove();
      syncMonthFromDom();
      renderPortfolioPage(renderSymbolInput);
      return;
    }
  });

  section.addEventListener("input", (e) => {
    const row = e.target.closest(".pf-mm-trade");
    if (row) updateMmLotTotal(row);
    const monthly = e.target.closest("[data-pf-monthly]");
    if (monthly) {
      clearTimeout(monthly._pfTimer);
      monthly._pfTimer = setTimeout(() => {
        syncMonthFromDom();
        refreshDashboard();
      }, 300);
    }
    if (e.target.closest(".dl-symbol") && monthly) {
      clearTimeout(monthly._symTimer);
      monthly._symTimer = setTimeout(() => {
        syncMonthFromDom();
        refreshDashboard();
        requestQuoteRefresh();
      }, 200);
    }
  });

  section.addEventListener("change", (e) => {
    if (e.target.closest(".pf-broker, .pf-trade-date-input, .ci-date-input")) {
      const dateInp = e.target.closest(".pf-trade-date-input, .ci-date-input");
      if (dateInp) syncTradeDatePill(dateInp);
      syncMonthFromDom();
      refreshDashboard();
    }
  });

  section.addEventListener("blur", (e) => {
    const price = e.target.closest(".pf-price");
    if (price) {
      const row = price.closest(".pf-mm-trade");
      const market = row?.querySelector(".pf-market-inp")?.value || "";
      const n = parseNum(price.value);
      if (isUsMarket(market)) {
        price.value = n !== "" ? Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "";
      } else {
        price.value = n !== "" ? Number(n).toLocaleString("ko-KR") : "";
      }
    }
  }, true);
}

export function getPortfolioData() {
  return portfolioData;
}

export function initPortfolioModule(renderSymbolInput, storeMode, api = {}) {
  window._portfolioStoreMode = storeMode;
  periodApi = { getPeriod: api.getPeriod, setPeriod: api.setPeriod };
  getBudgetContext = api.getBudgetContext ?? null;
  portfolioData = enrichPortfolioData(loadPortfolio());
  lastCloudJson = pfJson(portfolioData);
  renderPortfolioPage(renderSymbolInput);
  startPortfolioQuotes(() => viewData(), refreshQuoteUI);
}

export function setPortfolioFromRemote(remote, meta = {}) {
  if (meta.source === "initial") {
    portfolioData = enrichPortfolioData(remote?.ledger || remote?.yj ? remote : defaultPortfolio());
    lastCloudJson = pfJson(portfolioData);
    persistPortfolioLocal(portfolioData);
    renderPortfolioPage(window._portfolioRenderSymbolInput);
    return;
  }
  if (cloudSaveInFlight) return;
  const enriched = enrichPortfolioData(remote);
  if (pfJson(enriched) === pfJson(portfolioData)) {
    lastCloudJson = pfJson(enriched);
    return;
  }
  portfolioData = enriched;
  lastCloudJson = pfJson(portfolioData);
  persistPortfolioLocal(portfolioData);
  renderPortfolioPage(window._portfolioRenderSymbolInput);
}
