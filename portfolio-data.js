/**
 * 포트폴리오 저장 — 년·월별 ledger (체크리스트와 동일한 끊김)
 * { ledger: { "2026": { "7": { yj: { trades: [] }, sn: { trades: [] } } } } }
 */

export function parseTradeDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return null;
  return { year: +m[1], month: +m[2], day: +m[3] };
}

export function defaultPortfolio() {
  return { ledger: {} };
}

export function ensureMonth(data, year, month) {
  const y = String(year);
  const m = String(+month);
  if (!data.ledger) data.ledger = {};
  if (!data.ledger[y]) data.ledger[y] = {};
  if (!data.ledger[y][m]) {
    data.ledger[y][m] = { yj: { trades: [] }, sn: { trades: [] } };
  }
  if (!data.ledger[y][m].yj) data.ledger[y][m].yj = { trades: [] };
  if (!data.ledger[y][m].sn) data.ledger[y][m].sn = { trades: [] };
  if (!Array.isArray(data.ledger[y][m].yj.trades)) data.ledger[y][m].yj.trades = [];
  if (!Array.isArray(data.ledger[y][m].sn.trades)) data.ledger[y][m].sn.trades = [];
  return data.ledger[y][m];
}

export function getMonthBucket(data, year, month) {
  const y = String(year);
  const m = String(+month);
  return data.ledger?.[y]?.[m] ?? { yj: { trades: [] }, sn: { trades: [] } };
}

export function getMonthTrades(data, year, month, person) {
  return getMonthBucket(data, year, month)[person]?.trades ?? [];
}

export function setMonthTrades(data, year, month, person, trades) {
  const bucket = ensureMonth(data, year, month);
  bucket[person].trades = trades;
  return data;
}

export function hasLedgerData(data) {
  for (const y of Object.values(data?.ledger || {})) {
    for (const m of Object.values(y)) {
      if (m.yj?.trades?.length || m.sn?.trades?.length) return true;
    }
  }
  return false;
}

function legacyHasData(raw) {
  return (raw?.yj?.positions?.length || 0) > 0 || (raw?.sn?.positions?.length || 0) > 0;
}

function fallbackYearMonth(dateStr) {
  const p = parseTradeDate(dateStr);
  if (p) return { year: p.year, month: p.month };
  return { year: 2026, month: 7 };
}

function toTradeRecord(pos, row, type) {
  const sh = Number(row.shares) || 0;
  const pr = Number(row.price) || 0;
  if (sh <= 0 && pr <= 0 && !row.symbol && !pos.symbol) return null;
  const { year, month } = fallbackYearMonth(row.date);
  const date =
    row.date ||
    `${year}-${String(month).padStart(2, "0")}-01`;
  return {
    year,
    month,
    trade: {
      id: row.id || `mig_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      symbol: pos.symbol || "",
      code: pos.code || "",
      market: pos.market || "",
      broker: row.broker || "",
      date,
      price: row.price ?? "",
      shares: row.shares ?? "",
    },
  };
}

export function migrateLegacyPositions(raw) {
  const ledger = {};
  const data = { ledger };

  for (const person of ["yj", "sn"]) {
    for (const pos of raw?.[person]?.positions || []) {
      for (const lot of pos.lots || []) {
        const rec = toTradeRecord(pos, lot, "buy");
        if (!rec) continue;
        ensureMonth(data, rec.year, rec.month)[person].trades.push(rec.trade);
      }
      for (const sell of pos.sells || []) {
        const rec = toTradeRecord(pos, sell, "sell");
        if (!rec) continue;
        ensureMonth(data, rec.year, rec.month)[person].trades.push(rec.trade);
      }
    }
  }
  return data;
}

export function normalizePortfolio(raw) {
  if (!raw || typeof raw !== "object") return defaultPortfolio();
  if (raw.ledger && typeof raw.ledger === "object") {
    return { ledger: structuredClone(raw.ledger) };
  }
  if (legacyHasData(raw)) return migrateLegacyPositions(raw);
  return defaultPortfolio();
}

/** 전체 월 매매 → 종목별 보유 (도넛·시세·손익용) */
export function aggregatePositions(data) {
  const byPerson = { yj: new Map(), sn: new Map() };

  for (const y of Object.keys(data.ledger || {})) {
    for (const m of Object.keys(data.ledger[y])) {
      for (const person of ["yj", "sn"]) {
        const map = byPerson[person];
        for (const t of data.ledger[y][m][person]?.trades || []) {
          const code = String(t.code || "").trim();
          const symbol = String(t.symbol || "").trim();
          const key = code || symbol || t.id;
          if (!key) continue;

          if (!map.has(key)) {
            map.set(key, {
              id: `agg_${person}_${key}`,
              symbol: symbol || code,
              code,
              market: t.market || "",
              lots: [],
              sells: [],
            });
          }
          const pos = map.get(key);
          if (!pos.symbol && symbol) pos.symbol = symbol;
          if (!pos.code && code) pos.code = code;
          if (!pos.market && t.market) pos.market = t.market;

          const row = {
            id: t.id,
            broker: t.broker || "",
            date: t.date || "",
            price: t.price ?? "",
            shares: t.shares ?? "",
          };
          if (t.type === "sell") pos.sells.push(row);
          else pos.lots.push(row);
        }
      }
    }
  }

  return {
    yj: { positions: [...byPerson.yj.values()] },
    sn: { positions: [...byPerson.sn.values()] },
  };
}

export function aggregatedView(data) {
  return aggregatePositions(data);
}

export function defaultTradeDate(year, month) {
  const y = +year;
  const m = +month;
  const now = new Date();
  if (now.getFullYear() === y && now.getMonth() + 1 === m) {
    return now.toISOString().slice(0, 10);
  }
  return `${y}-${String(m).padStart(2, "0")}-15`;
}
