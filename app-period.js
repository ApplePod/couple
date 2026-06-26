/** 체크리스트·포트폴리오 공통 년·월 선택 */
export const TRACKER_YEARS = [2026, 2027];
export const MONTH_LABELS = [
  "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
];

let state = { year: TRACKER_YEARS[0], month: "7" };
const listeners = new Set();

export function getPeriod() {
  return { year: state.year, month: state.month };
}

export function setPeriod(year, month) {
  state = { year: +year, month: String(+month) };
  for (const fn of listeners) fn(getPeriod());
}

export function onPeriodChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
