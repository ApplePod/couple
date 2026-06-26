/**
 * 포트폴리오 시세·환율 — Supabase Edge Function (Yahoo v8 chart) 경유
 */
import { calcPosition, isUsMarket, positionCurrency } from "./portfolio-calc.js";

const POLL_MS = 60_000;
const FX_SYMBOL = "KRW=X";

let quoteState = {
  quotes: new Map(),
  fxRate: null,
  updatedAt: null,
  status: "idle",
  error: null,
};
let pollTimer = null;
let getDataFn = null;
let onUpdateFn = null;

export function quoteKey(code, market) {
  const c = String(code || "").trim();
  if (!c) return null;
  return isUsMarket(market) ? `${c.toUpperCase()}:US` : `${c}:KR`;
}

export function getQuoteState() {
  return quoteState;
}

export function quoteOptsForPosition(pos) {
  const key = quoteKey(pos.code, pos.market);
  const base = {
    currency: positionCurrency(pos.market),
    fxRate: quoteState.fxRate || 1,
  };
  if (!key) return base;
  const q = quoteState.quotes.get(key);
  if (!q?.price) return base;
  return {
    currentPrice: q.price,
    currency: q.currency || base.currency,
    fxRate: quoteState.fxRate || 1,
  };
}

export function calcPositionWithQuotes(pos) {
  return calcPosition(pos.lots, pos.sells, quoteOptsForPosition(pos));
}

/** 보유 종목만 시세 요청 */
export function collectQuoteSymbols(data) {
  const seen = new Set();
  const out = [];
  for (const person of ["yj", "sn"]) {
    for (const pos of data[person]?.positions || []) {
      const code = String(pos.code || "").trim();
      if (!code) continue;
      const stats = calcPosition(pos.lots, pos.sells);
      if (stats.heldShares <= 0) continue;
      const key = quoteKey(code, pos.market);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ key, code, market: pos.market || "KOSPI" });
    }
  }
  return out;
}

function quotesUrl() {
  const url = window.SUPABASE_CONFIG?.url;
  if (!url) return null;
  return `${url.replace(/\/$/, "")}/functions/v1/portfolio-quotes`;
}

export async function fetchPortfolioQuotes(symbols) {
  const endpoint = quotesUrl();
  const anonKey = window.SUPABASE_CONFIG?.anonKey;
  if (!endpoint || !anonKey) {
    throw new Error("Supabase 미설정");
  }
  if (!symbols.length) {
    return { quotes: {}, fx: { USDKRW: quoteState.fxRate }, at: new Date().toISOString() };
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ symbols }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `시세 API ${res.status}`);
  }
  return res.json();
}

async function refreshQuotes() {
  if (!getDataFn) return;
  const data = getDataFn();
  const symbols = collectQuoteSymbols(data);
  if (!symbols.length) {
    quoteState = { ...quoteState, status: "idle", error: null };
    onUpdateFn?.(quoteState);
    return;
  }

  quoteState = { ...quoteState, status: "loading" };
  onUpdateFn?.(quoteState);

  try {
    const payload = await fetchPortfolioQuotes(symbols);
    const map = new Map(quoteState.quotes);
    for (const [key, val] of Object.entries(payload.quotes || {})) {
      if (val?.price != null) map.set(key, val);
    }
    const fx = Number(payload.fx?.USDKRW);
    quoteState = {
      quotes: map,
      fxRate: Number.isFinite(fx) && fx > 0 ? fx : quoteState.fxRate,
      updatedAt: payload.at || new Date().toISOString(),
      status: "ok",
      error: null,
    };
  } catch (e) {
    console.warn("[portfolio-quotes]", e);
    quoteState = {
      ...quoteState,
      status: "error",
      error: e.message || "시세 조회 실패",
    };
  }
  onUpdateFn?.(quoteState);
}

function onVisibility() {
  if (document.visibilityState === "visible") {
    refreshQuotes();
    startPoll();
  } else {
    stopPoll();
  }
}

function startPoll() {
  stopPoll();
  pollTimer = setInterval(refreshQuotes, POLL_MS);
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function startPortfolioQuotes(getData, onUpdate) {
  getDataFn = getData;
  onUpdateFn = onUpdate;
  document.removeEventListener("visibilitychange", onVisibility);
  document.addEventListener("visibilitychange", onVisibility);
  refreshQuotes();
  startPoll();
}

export function stopPortfolioQuotes() {
  stopPoll();
  document.removeEventListener("visibilitychange", onVisibility);
  getDataFn = null;
  onUpdateFn = null;
}

export function formatFxRate(n) {
  if (!n) return "—";
  return `${Number(n).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원`;
}

export function formatQuoteTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export function formatReturnPct(n) {
  if (n == null || !Number.isFinite(n)) return "";
  const sign = n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(1)}%`;
}

export function requestQuoteRefresh() {
  return refreshQuotes();
}
