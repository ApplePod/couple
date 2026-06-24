/** 투자 전망 — 연도별 적립 계획 (만원 단위 표시용 데이터) */

export const FORECAST_YEARS = [2026, 2027, 2028, 2029, 2030];

export const INVEST_CATEGORIES = [
  {
    id: "isa", name: "ISA", color: "#4f8ef7",
    parts: [
      { label: "시온 월 50만", monthly: 500000, who: "시온" },
      { label: "영재 목돈 2천", lump: 20000000, year: 2026, who: "영재" },
    ],
  },
  {
    id: "irp", name: "IRP", color: "#6366f1",
    parts: [
      { label: "영재 월 50만", monthly: 500000, who: "영재" },
      { label: "시온 월 50만", monthly: 500000, who: "시온" },
    ],
  },
  {
    id: "pension", name: "연금저축", color: "#8b5cf6",
    parts: [
      { label: "영재 월 100만", monthly: 1000000, who: "영재" },
      { label: "시온 월 100만", monthly: 1000000, who: "시온" },
    ],
  },
  {
    id: "kr", name: "국장", color: "#22c55e",
    parts: [
      { label: "영재 월 50만", monthly: 500000, who: "영재" },
      { label: "시온 월 30만", monthly: 300000, who: "시온" },
    ],
  },
  {
    id: "us", name: "미장", color: "#06b6d4",
    parts: [{ label: "시온 월 30만", monthly: 300000, who: "시온" }],
  },
  {
    id: "crypto", name: "코인+금", color: "#f59e0b",
    parts: [{ label: "시온 월 20만", monthly: 200000, who: "시온" }],
  },
];

export function calcYearBreakdown(year) {
  const breakdown = {};
  let total = 0;
  for (const cat of INVEST_CATEGORIES) {
    let sum = 0;
    for (const p of cat.parts) {
      if (p.monthly) sum += p.monthly * 12;
      if (p.lump && p.year === year) sum += p.lump;
    }
    breakdown[cat.id] = { name: cat.name, color: cat.color, amount: sum };
    total += sum;
  }
  return { breakdown, total };
}

export function calcCumulative(throughYear) {
  let cum = 0;
  const byYear = {};
  for (const y of FORECAST_YEARS) {
    if (y > throughYear) break;
    const { total } = calcYearBreakdown(y);
    cum += total;
    byYear[y] = { annual: total, cumulative: cum };
  }
  return byYear;
}
