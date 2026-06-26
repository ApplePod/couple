/** 포트폴리오 보유·손익 계산 (평단법) + 시세 반영 */

function sumTrades(rows) {
  let totalShares = 0;
  let totalAmount = 0;
  for (const row of rows || []) {
    const sh = Number(row.shares) || 0;
    const pr = Number(row.price) || 0;
    if (sh > 0 && pr >= 0) {
      totalShares += sh;
      totalAmount += sh * pr;
    }
  }
  return { totalShares, totalAmount };
}

export function isUsMarket(market) {
  const m = String(market || "").toUpperCase();
  return m === "US" || m === "NASDAQ" || m === "NYSE" || m === "AMEX";
}

export function positionCurrency(market) {
  return isUsMarket(market) ? "USD" : "KRW";
}

/**
 * @param {object} [opts]
 * @param {number|null} [opts.currentPrice] — 시세 통화(USD/KRW) 기준
 * @param {string} [opts.currency] — KRW | USD
 * @param {number} [opts.fxRate] — 1 USD = N KRW
 */
export function calcPosition(lots, sells, opts = {}) {
  const buy = sumTrades(lots);
  const avgPrice = buy.totalShares > 0 ? buy.totalAmount / buy.totalShares : 0;

  let sellShares = 0;
  let sellProceeds = 0;
  let realizedPnl = 0;
  for (const row of sells || []) {
    const sh = Number(row.shares) || 0;
    const pr = Number(row.price) || 0;
    if (sh > 0 && pr >= 0) {
      sellShares += sh;
      sellProceeds += sh * pr;
      if (avgPrice > 0) realizedPnl += (pr - avgPrice) * sh;
    }
  }

  const heldShares = buy.totalShares - sellShares;
  const remainingCost = heldShares > 0 && avgPrice > 0 ? avgPrice * heldShares : 0;

  const currency = opts.currency || "KRW";
  const fxRate = Number(opts.fxRate) > 0 ? Number(opts.fxRate) : 1;
  const realizedPnlKrw = currency === "USD" ? realizedPnl * fxRate : realizedPnl;
  const currentPrice =
    opts.currentPrice != null && Number.isFinite(Number(opts.currentPrice))
      ? Number(opts.currentPrice)
      : null;

  let marketValueKrw = null;
  let unrealizedPnlKrw = null;
  let returnPct = null;
  let remainingCostKrw = remainingCost;

  if (currency === "USD") {
    remainingCostKrw = remainingCost * fxRate;
    if (currentPrice != null && heldShares > 0) {
      const valueUsd = currentPrice * heldShares;
      const costUsd = avgPrice * heldShares;
      marketValueKrw = valueUsd * fxRate;
      unrealizedPnlKrw = (valueUsd - costUsd) * fxRate;
      if (avgPrice > 0) returnPct = (currentPrice - avgPrice) / avgPrice;
    }
  } else if (currentPrice != null && heldShares > 0) {
    marketValueKrw = currentPrice * heldShares;
    unrealizedPnlKrw = marketValueKrw - remainingCost;
    if (avgPrice > 0) returnPct = (currentPrice - avgPrice) / avgPrice;
  }

  return {
    buyShares: buy.totalShares,
    buyCost: buy.totalAmount,
    avgPrice,
    sellShares,
    sellProceeds,
    realizedPnl,
    realizedPnlKrw,
    heldShares,
    remainingCost,
    remainingCostKrw,
    overSold: sellShares > buy.totalShares && buy.totalShares >= 0,
    currency,
    currentPrice,
    marketValueKrw,
    unrealizedPnlKrw,
    returnPct,
  };
}
