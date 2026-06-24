/** 투자 전망 — 실제(체크리스트) + 예상(월 계획·연 한도) */

export const INVEST_CATEGORY_IDS = ["isa", "irp", "pension", "kr", "us", "crypto"];

export const INVEST_CATEGORIES = [
  { id: "isa", name: "ISA", color: "#4f8ef7" },
  { id: "irp", name: "IRP", color: "#6366f1", limitNote: "연 한도 인당 300만" },
  { id: "pension", name: "연금저축", color: "#8b5cf6", limitNote: "연 한도 인당 600만" },
  { id: "kr", name: "국장", color: "#22c55e" },
  { id: "us", name: "미장", color: "#06b6d4" },
  { id: "crypto", name: "코인+금", color: "#f59e0b" },
];

export const PLAN_START = { year: 2026, month: 7 };

export const ANNUAL_LIMIT_PER_PERSON = {
  irp: 3_000_000,
  pension: 6_000_000,
};

function emptyYearBucket() {
  return Object.fromEntries(INVEST_CATEGORY_IDS.map((id) => [id, 0]));
}

function isInvestItem(it) {
  return INVEST_CATEGORY_IDS.includes(it.id);
}

function applyPersonCap(itemId, annual) {
  if (itemId === "irp") return Math.min(annual, ANNUAL_LIMIT_PER_PERSON.irp);
  if (itemId === "pension") return Math.min(annual, ANNUAL_LIMIT_PER_PERSON.pension);
  return annual;
}

/** 해당 연도 계획에 포함되는 월 수 (2026년 7월 시작 → 6개월) */
export function planMonthsInYear(year) {
  const { year: sy, month: sm } = PLAN_START;
  if (year < sy) return 0;
  if (year > sy) return 12;
  return 12 - sm + 1;
}

/** 월 계획·연 한도 반영 연간 예상 */
export function aggregateProjectedYear(year, { yjItems, snItems }) {
  const months = planMonthsInYear(year);
  const bucket = emptyYearBucket();

  const addPerson = (person, items) => {
    for (const it of items) {
      if (!isInvestItem(it)) continue;

      if (it.julyOnly && it.fromSavings) {
        if (year === PLAN_START.year) bucket[it.id] += it.amt;
        continue;
      }

      const annual = applyPersonCap(it.id, it.amt * months);
      bucket[it.id] += annual;
    }
  };

  addPerson("yj", yjItems);
  addPerson("sn", snItems);
  return bucket;
}

export function aggregateProjectedInvestments(years, opts) {
  const byYear = {};
  for (const y of years) {
    byYear[String(y)] = aggregateProjectedYear(y, opts);
  }
  return byYear;
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

export function countRecordedMonths(checks, getActual, { yjItems, snItems }) {
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
          seen.add(`${year}-${month}`);
        }
      }
    }
  };

  scan("yj", yjItems);
  scan("sn", snItems);
  return seen.size;
}

export function getForecastYears(actualByYear, projectedByYear, minYears = []) {
  const set = new Set(minYears.map(String));
  for (const by of [actualByYear, projectedByYear]) {
    for (const [y, cats] of Object.entries(by || {})) {
      if (Object.values(cats).some((v) => v > 0)) set.add(y);
    }
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

export function totalInvested(byYear, years) {
  return years.reduce((sum, y) => sum + calcYearBreakdown(byYear, y).total, 0);
}

export function achievementPct(actual, planned) {
  if (!planned) return actual > 0 ? 100 : 0;
  return Math.round((actual / planned) * 1000) / 10;
}

export function achievementStatus(pct) {
  if (pct >= 100) return "done";
  if (pct >= 70) return "good";
  if (pct >= 40) return "mid";
  return "low";
}
