/** 투자 전망 — 체크리스트 실제 금액 기준 */

export const INVEST_CATEGORY_IDS = ["isa", "irp", "pension", "kr", "us", "crypto"];

export const INVEST_CATEGORIES = [
  { id: "isa", name: "ISA", color: "#4f8ef7" },
  { id: "irp", name: "IRP", color: "#6366f1" },
  { id: "pension", name: "연금저축", color: "#8b5cf6" },
  { id: "kr", name: "국장", color: "#22c55e" },
  { id: "us", name: "미장", color: "#06b6d4" },
  { id: "crypto", name: "코인+금", color: "#f59e0b" },
];

function emptyYearBucket() {
  return Object.fromEntries(INVEST_CATEGORY_IDS.map((id) => [id, 0]));
}

function isInvestItem(it) {
  return INVEST_CATEGORY_IDS.includes(it.id);
}

/** 체크리스트 실제 금액을 연도·항목별로 합산 */
export function aggregateActualInvestments(checks, getActual, { yjItems, snItems }) {
  const byYear = {};

  const add = (person, items) => {
    for (const [year, months] of Object.entries(checks || {})) {
      if (!byYear[year]) byYear[year] = emptyYearBucket();
      for (const [month] of Object.entries(months || {})) {
        for (const it of items) {
          if (!isInvestItem(it)) continue;
          if (it.julyOnly && month !== "7") continue;
          const actual = getActual(checks, year, month, person, it.id);
          if (actual === null || actual === undefined || actual === "") continue;
          const n = Number(actual);
          if (!n) continue;
          byYear[year][it.id] += n;
        }
      }
    }
  };

  add("yj", yjItems);
  add("sn", snItems);
  return byYear;
}

/** 실제 금액이 하나라도 있는 월 수 */
export function countRecordedMonths(checks, getActual, { yjItems, snItems }) {
  let count = 0;
  const seen = new Set();

  const scan = (person, items) => {
    for (const [year, months] of Object.entries(checks || {})) {
      for (const [month] of Object.entries(months || {})) {
        for (const it of items) {
          if (!isInvestItem(it)) continue;
          if (it.julyOnly && month !== "7") continue;
          const actual = getActual(checks, year, month, person, it.id);
          if (actual === null || actual === undefined || actual === "") continue;
          if (!Number(actual)) continue;
          const key = `${year}-${month}`;
          if (!seen.has(key)) {
            seen.add(key);
            count++;
          }
        }
      }
    }
  };

  scan("yj", yjItems);
  scan("sn", snItems);
  return count;
}

export function getForecastYears(byYear, minYears = []) {
  const set = new Set(minYears.map(String));
  for (const [y, cats] of Object.entries(byYear)) {
    if (Object.values(cats).some((v) => v > 0)) set.add(y);
  }
  if (!set.size) minYears.forEach((y) => set.add(String(y)));
  return [...set].map(Number).sort((a, b) => a - b);
}

export function calcYearBreakdown(byYear, year) {
  const bucket = byYear[String(year)] || emptyYearBucket();
  const breakdown = {};
  let total = 0;
  for (const cat of INVEST_CATEGORIES) {
    const amount = bucket[cat.id] || 0;
    breakdown[cat.id] = { name: cat.name, color: cat.color, amount };
    total += amount;
  }
  return { breakdown, total };
}

export function calcCumulative(byYear, years) {
  let cum = 0;
  const result = {};
  for (const y of years) {
    const { total } = calcYearBreakdown(byYear, y);
    cum += total;
    result[y] = { annual: total, cumulative: cum };
  }
  return result;
}

export function totalInvested(byYear) {
  return Object.values(byYear).reduce(
    (sum, bucket) => sum + Object.values(bucket).reduce((s, v) => s + v, 0),
    0
  );
}
