/** 포트폴리오 보유·손익 계산 (평단법) */

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

export function calcPosition(lots, sells) {
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

  return {
    buyShares: buy.totalShares,
    buyCost: buy.totalAmount,
    avgPrice,
    sellShares,
    sellProceeds,
    realizedPnl,
    heldShares,
    remainingCost,
    overSold: sellShares > buy.totalShares && buy.totalShares >= 0,
  };
}
