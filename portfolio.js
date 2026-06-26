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
} from "./portfolio-charts.js";
import { calcPosition } from "./portfolio-calc.js";

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

let portfolioData = loadPortfolio();
let saveTimer = null;
let cloudSaveInFlight = false;
let lastCloudJson = JSON.stringify(portfolioData);
const expandedIds = new Set();
/** @type {Map<string, Set<'buy'|'sell'>>} */
const tradeOpenByPos = new Map();

function tradeOpenSet(posId) {
  if (!tradeOpenByPos.has(posId)) tradeOpenByPos.set(posId, new Set());
  return tradeOpenByPos.get(posId);
}

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

function calcPersonSummary(positions) {
  let positionCount = 0;
  let totalCost = 0;
  let totalShares = 0;
  let totalRealized = 0;
  for (const pos of positions || []) {
    const s = calcPosition(pos.lots, pos.sells);
    const hasData =
      pos.symbol?.trim() ||
      (pos.lots || []).some((l) => l.price || l.shares) ||
      (pos.sells || []).some((l) => l.price || l.shares);
    if (!hasData) continue;
    positionCount++;
    totalCost += s.remainingCost;
    totalShares += Math.max(0, s.heldShares);
    totalRealized += s.realizedPnl;
  }
  return { positionCount, totalCost, totalShares, totalRealized };
}


function brokerOptions(selected) {
  return BROKERS.map(
    (b) => `<option value="${esc(b)}"${b === selected ? " selected" : ""}>${esc(b)}</option>`
  ).join("");
}

function renderLotRow(person, posId, lot, i) {
  const sh = Number(lot.shares) || 0;
  const pr = Number(lot.price) || 0;
  const lineTotal = sh > 0 && pr >= 0 ? sh * pr : 0;
  return `<tr class="pf-lot" data-person="${person}" data-pos-id="${esc(posId)}" data-lot-id="${esc(lot.id)}" data-idx="${i}">
    <td><select class="pf-broker">${brokerOptions(lot.broker || BROKERS[0])}</select></td>
    <td><input type="date" class="pf-date" value="${esc(lot.date || "")}"></td>
    <td><input type="text" class="pf-price" inputmode="numeric" placeholder="단가" value="${lot.price !== "" && lot.price != null ? Number(lot.price).toLocaleString("ko-KR") : ""}"></td>
    <td><input type="text" class="pf-shares" inputmode="decimal" placeholder="수량" value="${esc(lot.shares ?? "")}"></td>
    <td class="pf-lot-total">${lineTotal ? fmtWon(lineTotal) : "—"}</td>
    <td><button type="button" class="pf-lot-remove" title="매수 내역 삭제" aria-label="삭제">×</button></td>
  </tr>`;
}

function renderSellRow(person, posId, sell, i) {
  const sh = Number(sell.shares) || 0;
  const pr = Number(sell.price) || 0;
  const lineTotal = sh > 0 && pr >= 0 ? sh * pr : 0;
  return `<tr class="pf-sell" data-person="${person}" data-pos-id="${esc(posId)}" data-sell-id="${esc(sell.id)}" data-idx="${i}">
    <td><select class="pf-broker">${brokerOptions(sell.broker || BROKERS[0])}</select></td>
    <td><input type="date" class="pf-date" value="${esc(sell.date || "")}"></td>
    <td><input type="text" class="pf-price" inputmode="numeric" placeholder="단가" value="${sell.price !== "" && sell.price != null ? Number(sell.price).toLocaleString("ko-KR") : ""}"></td>
    <td><input type="text" class="pf-shares" inputmode="decimal" placeholder="수량" value="${esc(sell.shares ?? "")}"></td>
    <td class="pf-lot-total">${lineTotal ? fmtWon(lineTotal) : "—"}</td>
    <td><button type="button" class="pf-sell-remove" title="매도 내역 삭제" aria-label="삭제">×</button></td>
  </tr>`;
}

function formatPnl(n) {
  if (!n && n !== 0) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${Math.round(n).toLocaleString("ko-KR")}원`;
}

function renderPosition(person, pos, renderSymbolInput) {
  const stats = calcPosition(pos.lots, pos.sells);
  const open = expandedIds.has(pos.id);
  const lots = (pos.lots || []).length
    ? pos.lots
    : [{ id: uid("lot"), broker: BROKERS[0], date: "", price: "", shares: "" }];
  const sells = pos.sells || [];
  const meta = pos.code
    ? `<span class="pf-code">${esc(pos.code)}</span><span class="pf-market">${esc(pos.market || "")}</span>`
    : "";
  const pnlClass = stats.realizedPnl > 0 ? "gain" : stats.realizedPnl < 0 ? "loss" : "";
  const openBuy = tradeOpenSet(pos.id).has("buy");
  const openSell = tradeOpenSet(pos.id).has("sell");

  return `<div class="pf-position${open ? " is-open" : ""}" data-person="${person}" data-pos-id="${esc(pos.id)}">
    <button type="button" class="pf-pos-head" aria-expanded="${open}">
      <div class="pf-pos-head-left">
        <span class="pf-pos-symbol">${esc(pos.symbol || "종목 미입력")}</span>
        ${meta}
      </div>
      <div class="pf-pos-head-stats">
        <span><em>평단</em>${stats.avgPrice ? fmtWon(stats.avgPrice) : "—"}</span>
        <span><em>보유</em>${stats.heldShares > 0 ? stats.heldShares.toLocaleString("ko-KR") : stats.buyShares ? "0" : "—"}</span>
        <span><em>잔여원금</em>${stats.remainingCost ? fmtWon(stats.remainingCost) : "—"}</span>
        ${stats.realizedPnl ? `<span class="pf-pnl ${pnlClass}"><em>실현</em>${formatPnl(stats.realizedPnl)}</span>` : ""}
      </div>
      <span class="pf-chevron" aria-hidden="true"></span>
    </button>
    <div class="pf-pos-body"${open ? "" : " hidden"}>
      <div class="pf-symbol-edit">
        <label>종목</label>
        ${renderSymbolInput(pos.symbol)}
        <input type="hidden" class="pf-code-inp" value="${esc(pos.code || "")}">
        <input type="hidden" class="pf-market-inp" value="${esc(pos.market || "")}">
      </div>
      ${`<p class="pf-warn"${stats.overSold ? "" : " hidden"}>매도 수량이 매수 합계를 초과했습니다.</p>`}
      <div class="pf-trade-bar">
        <button type="button" class="pf-trade-toggle buy${openBuy ? " is-open" : ""}" data-trade-toggle="buy" aria-expanded="${openBuy}">+ 매수 내역</button>
        <button type="button" class="pf-trade-toggle sell${openSell ? " is-open" : ""}" data-trade-toggle="sell" aria-expanded="${openSell}">+ 매도 내역</button>
        <button type="button" class="pf-remove-pos" data-person="${person}" data-pos-id="${esc(pos.id)}">종목 삭제</button>
      </div>
      <div class="pf-trade-drop buy"${openBuy ? "" : " hidden"}>
        <table class="pf-lot-table">
          <thead>
            <tr><th>증권사</th><th>매수일</th><th>단가</th><th>수량</th><th>합계</th><th></th></tr>
          </thead>
          <tbody>${lots.map((lot, i) => renderLotRow(person, pos.id, lot, i)).join("")}</tbody>
        </table>
        <button type="button" class="pf-add-lot" data-person="${person}" data-pos-id="${esc(pos.id)}">+ 매수 내역</button>
      </div>
      <div class="pf-trade-drop sell"${openSell ? "" : " hidden"}>
        <table class="pf-lot-table pf-sell-table">
          <thead>
            <tr><th>증권사</th><th>매도일</th><th>단가</th><th>수량</th><th>합계</th><th></th></tr>
          </thead>
          <tbody>${sells.length ? sells.map((sell, i) => renderSellRow(person, pos.id, sell, i)).join("") : '<tr class="pf-sell-empty"><td colspan="6">매도 내역 없음</td></tr>'}</tbody>
        </table>
        <button type="button" class="pf-add-sell" data-person="${person}" data-pos-id="${esc(pos.id)}">+ 매도 내역</button>
      </div>
    </div>
  </div>`;
}

function renderPersonColumn(person, label, colorClass, data, renderSymbolInput) {
  const summary = calcPersonSummary(data.positions);
  const positions = (data.positions || [])
    .map((p) => renderPosition(person, p, renderSymbolInput))
    .join("");

  return `<div class="pf-col ${colorClass}">
    <div class="pf-col-head">
      <h3>${label}</h3>
      <div class="pf-col-summary">
        <span>종목 <strong>${summary.positionCount}</strong></span>
        <span>잔여원금 <strong>${summary.totalCost ? fmtWon(summary.totalCost) : "—"}</strong></span>
        ${summary.totalRealized ? `<span>실현손익 <strong class="${summary.totalRealized > 0 ? "gain" : "loss"}">${formatPnl(summary.totalRealized)}</strong></span>` : ""}
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
  const lots = [...posEl.querySelectorAll(".pf-lot")].map((row) => ({
    id: row.dataset.lotId || uid("lot"),
    broker: row.querySelector(".pf-broker")?.value || BROKERS[0],
    date: row.querySelector(".pf-date")?.value || "",
    price: parseNum(row.querySelector(".pf-price")?.value),
    shares: row.querySelector(".pf-shares")?.value?.trim() || "",
  }));
  const sells = [...posEl.querySelectorAll(".pf-sell")].map((row) => ({
    id: row.dataset.sellId || uid("sell"),
    broker: row.querySelector(".pf-broker")?.value || BROKERS[0],
    date: row.querySelector(".pf-date")?.value || "",
    price: parseNum(row.querySelector(".pf-price")?.value),
    shares: row.querySelector(".pf-shares")?.value?.trim() || "",
  }));
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
  const stats = calcPosition(pos.lots, pos.sells);
  const head = posEl.querySelector(".pf-pos-head");
  if (!head) return;
  const symEl = head.querySelector(".pf-pos-symbol");
  if (symEl) symEl.textContent = pos.symbol || "종목 미입력";
  const pnlClass = stats.realizedPnl > 0 ? "gain" : stats.realizedPnl < 0 ? "loss" : "";
  const statsEl = head.querySelector(".pf-pos-head-stats");
  if (statsEl) {
    statsEl.innerHTML = `
      <span><em>평단</em>${stats.avgPrice ? fmtWon(stats.avgPrice) : "—"}</span>
      <span><em>보유</em>${stats.heldShares > 0 ? stats.heldShares.toLocaleString("ko-KR") : stats.buyShares ? "0" : "—"}</span>
      <span><em>잔여원금</em>${stats.remainingCost ? fmtWon(stats.remainingCost) : "—"}</span>
      ${stats.realizedPnl ? `<span class="pf-pnl ${pnlClass}"><em>실현</em>${formatPnl(stats.realizedPnl)}</span>` : ""}`;
  }
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

function refreshSummaries() {
  const section = document.getElementById("portfolio-section");
  if (!section) return;
  for (const person of ["yj", "sn"]) {
    const col = section.querySelector(`.pf-col.${person}`);
    if (!col) continue;
    const s = calcPersonSummary(portfolioData[person]?.positions);
    const strongs = col.querySelectorAll(".pf-col-summary strong");
    if (strongs[0]) strongs[0].textContent = String(s.positionCount);
    if (strongs[1]) strongs[1].textContent = s.totalCost ? fmtWon(s.totalCost) : "—";
  }
  updatePortfolioCharts(section, portfolioData);
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
    ${renderPortfolioDashboard(portfolioData)}
    <div class="pf-dual">
      ${renderPersonColumn("yj", "영재", "yj", portfolioData.yj, renderSymbolInput)}
      ${renderPersonColumn("sn", "시온", "sn", portfolioData.sn, renderSymbolInput)}
    </div>`;

  attachPortfolioEvents(section, renderSymbolInput);
  attachSymbolAutocomplete(section);
}

function syncTradePanels(posEl) {
  const posId = posEl?.dataset.posId;
  if (!posId) return;
  const open = tradeOpenByPos.get(posId) || new Set();
  posEl.querySelector(".pf-trade-drop.buy")?.toggleAttribute("hidden", !open.has("buy"));
  posEl.querySelector(".pf-trade-drop.sell")?.toggleAttribute("hidden", !open.has("sell"));
  const buyBtn = posEl.querySelector('.pf-trade-toggle[data-trade-toggle="buy"]');
  const sellBtn = posEl.querySelector('.pf-trade-toggle[data-trade-toggle="sell"]');
  buyBtn?.classList.toggle("is-open", open.has("buy"));
  sellBtn?.classList.toggle("is-open", open.has("sell"));
  buyBtn?.setAttribute("aria-expanded", String(open.has("buy")));
  sellBtn?.setAttribute("aria-expanded", String(open.has("sell")));
}

function toggleTradeSection(posEl, kind) {
  const posId = posEl?.dataset.posId;
  if (!posId) return;
  const open = tradeOpenSet(posId);
  if (open.has(kind)) open.delete(kind);
  else open.add(kind);
  syncTradePanels(posEl);
}

function attachPortfolioEvents(section, renderSymbolInput) {
  if (section._pfAttached) return;
  section._pfAttached = true;

  section.addEventListener("click", (e) => {
    const head = e.target.closest(".pf-pos-head");
    if (head && !e.target.closest(".pf-pos-body")) {
      const pos = head.closest(".pf-position");
      const id = pos?.dataset.posId;
      if (!id) return;
      const open = pos.classList.toggle("is-open");
      head.setAttribute("aria-expanded", String(open));
      pos.querySelector(".pf-pos-body")?.toggleAttribute("hidden", !open);
      if (open) expandedIds.add(id);
      else expandedIds.delete(id);
      return;
    }

    const tradeToggle = e.target.closest(".pf-trade-toggle");
    if (tradeToggle) {
      const posEl = tradeToggle.closest(".pf-position");
      toggleTradeSection(posEl, tradeToggle.dataset.tradeToggle);
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
      tradeOpenSet(posId).add("buy");
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
      tradeOpenSet(posId).add("sell");
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
      tradeOpenByPos.delete(posId);
      persistPortfolioLocal(portfolioData);
      schedulePortfolioSave();
      renderPortfolioPage(renderSymbolInput);
      return;
    }

    const rmLot = e.target.closest(".pf-lot-remove");
    if (rmLot) {
      const row = rmLot.closest(".pf-lot");
      const posEl = rmLot.closest(".pf-position");
      row?.remove();
      if (posEl) {
        if (!posEl.querySelectorAll(".pf-lot").length) {
          const tbody = posEl.querySelector(".pf-trade-drop.buy .pf-lot-table tbody");
          const person = posEl.dataset.person;
          const posId = posEl.dataset.posId;
          const pos = portfolioData[person]?.positions?.find((p) => p.id === posId);
          const lot = { id: uid("lot"), broker: BROKERS[0], date: "", price: "", shares: "" };
          pos?.lots.push(lot);
          tbody?.insertAdjacentHTML("beforeend", renderLotRow(person, posId, lot, 0));
        }
        syncFromDom();
        updatePositionHead(posEl);
        refreshSummaries();
      }
      return;
    }

    const rmSell = e.target.closest(".pf-sell-remove");
    if (rmSell) {
      const row = rmSell.closest(".pf-sell");
      const posEl = rmSell.closest(".pf-position");
      row?.remove();
      if (posEl) {
        const tbody = posEl.querySelector(".pf-sell-table tbody");
        if (tbody && !tbody.querySelector(".pf-sell")) {
          tbody.innerHTML = '<tr class="pf-sell-empty"><td colspan="6">매도 내역 없음</td></tr>';
        }
        syncFromDom();
        updatePositionHead(posEl);
        refreshSummaries();
      }
      return;
    }
  });

  section.addEventListener("input", (e) => {
    const row = e.target.closest(".pf-lot, .pf-sell");
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
      }, 200);
    }
  });

  section.addEventListener("change", (e) => {
    if (e.target.closest(".pf-broker, .pf-date")) {
      syncFromDom();
      const posEl = e.target.closest(".pf-position");
      if (posEl) updatePositionHead(posEl);
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
