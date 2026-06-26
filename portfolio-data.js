/**
 * 포트폴리오 저장 — 종목별 positions (yj/sn) 가 기준
 * 예전 ledger 데이터는 불러올 때 자동으로 positions 로 복구
 */

export function parseTradeDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return null;
  return { year: +m[1], month: +m[2], day: +m[3] };
}

export function defaultPortfolio() {
  return { yj: { positions: [] }, sn: { positions: [] } };
}

function legacyHasData(raw) {
  return (raw?.yj?.positions?.length || 0) > 0 || (raw?.sn?.positions?.length || 0) > 0;
}

export function hasLedgerData(data) {
  for (const y of Object.values(data?.ledger || {})) {
    for (const m of Object.values(y)) {
      if (m.yj?.trades?.length || m.sn?.trades?.length) return true;
    }
  }
  return false;
}

export function hasPortfolioData(data) {
  return legacyHasData(data) || hasLedgerData(data);
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
  const date = row.date || `${year}-${String(month).padStart(2, "0")}-01`;
  return {
    id: row.id || `mig_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    symbol: pos.symbol || "",
    code: pos.code || "",
    market: pos.market || "",
    broker: row.broker || "",
    date,
    price: row.price ?? "",
    shares: row.shares ?? "",
  };
}

/** ledger → 종목별 positions (데이터 복구용) */
export function ledgerToPositions(data) {
  const byPerson = { yj: new Map(), sn: new Map() };

  for (const y of Object.keys(data.ledger || {})) {
    for (const m of Object.keys(data.ledger[y])) {
      for (const person of ["yj", "sn"]) {
        const map = byPerson[person];
        for (const t of data.ledger[y][m][person]?.trades || []) {
          const sh = Number(t.shares) || 0;
          const pr = Number(t.price) || 0;
          const symbol = String(t.symbol || "").trim();
          const code = String(t.code || "").trim();
          if (sh <= 0 && pr <= 0 && !symbol && !code) continue;

          const key = code || symbol || t.id;
          if (!key) continue;

          if (!map.has(key)) {
            map.set(key, {
              id: `pos_${person}_${key}`,
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

export function normalizePortfolio(raw) {
  if (!raw || typeof raw !== "object") return defaultPortfolio();

  // 1) 예전 방식 — 종목 목록이 있으면 그대로 사용
  if (legacyHasData(raw)) {
    return {
      yj: { positions: structuredClone(raw.yj?.positions || []) },
      sn: { positions: structuredClone(raw.sn?.positions || []) },
    };
  }

  // 2) ledger 만 남아 있으면 positions 로 복구
  if (raw.ledger && hasLedgerData(raw)) {
    return ledgerToPositions(raw);
  }

  return defaultPortfolio();
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
