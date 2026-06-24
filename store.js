/**
 * Supabase + localStorage 예산 체크 저장
 */
const LS_KEY = "couple_budget_checks";

let supabase = null;
let supabaseReady = false;
let realtimeChannel = null;

function isSupabaseConfigured() {
  const c = window.SUPABASE_CONFIG;
  return c && c.url && c.anonKey;
}

function table() {
  return window.SUPABASE_PATH?.table || "budget_checks";
}

function rowId() {
  return window.SUPABASE_PATH?.rowId || "sion_checks";
}

export async function initStore(onRemoteChange) {
  if (!isSupabaseConfigured()) {
    console.info("[budget] Supabase 미설정 → localStorage 사용");
    return { mode: "local" };
  }

  try {
    const { createClient } = await import(
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm"
    );

    const { url, anonKey } = window.SUPABASE_CONFIG;
    supabase = createClient(url, anonKey);
    supabaseReady = true;

    const { data, error } = await supabase
      .from(table())
      .select("checks")
      .eq("id", rowId())
      .maybeSingle();

    if (error) console.warn("[budget] Supabase load:", error.message);
    else if (data?.checks) {
      localStorage.setItem(LS_KEY, JSON.stringify(data.checks));
      onRemoteChange?.(data.checks);
    }

    realtimeChannel = supabase
      .channel(`budget-${rowId()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: table(),
          filter: `id=eq.${rowId()}`,
        },
        (payload) => {
          const checks = payload.new?.checks;
          if (checks) {
            localStorage.setItem(LS_KEY, JSON.stringify(checks));
            onRemoteChange?.(checks);
          }
        }
      )
      .subscribe();

    return { mode: "supabase" };
  } catch (e) {
    console.warn("[budget] Supabase 초기화 실패:", e);
    return { mode: "local" };
  }
}

export function loadChecks() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    return {};
  }
}

export async function saveChecks(checks) {
  localStorage.setItem(LS_KEY, JSON.stringify(checks));

  if (!supabaseReady || !supabase) return { ok: true, mode: "local" };

  try {
    const { error } = await supabase.from(table()).upsert({
      id: rowId(),
      checks,
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;
    return { ok: true, mode: "supabase" };
  } catch (e) {
    console.warn("[budget] Supabase save:", e);
    return { ok: false, mode: "local", error: e.message };
  }
}

export function checkKey(person, itemId) {
  return `${person}_${itemId}`;
}

export function getCheck(checks, year, month, person, itemId) {
  const key = checkKey(person, itemId);
  const m = checks?.[year]?.[month];
  if (!m) return false;
  if (key in m) return !!m[key];
  if (person === "sn" && itemId in m) return !!m[itemId];
  return false;
}

export function actualKey(person, itemId) {
  return `${person}_${itemId}_actual`;
}

export function getActual(checks, year, month, person, itemId) {
  const key = actualKey(person, itemId);
  const m = checks?.[year]?.[month];
  if (!m || m[key] === undefined || m[key] === null || m[key] === "") return null;
  return Number(m[key]);
}

export function setActual(checks, year, month, person, itemId, value) {
  const next = structuredClone(checks);
  if (!next[year]) next[year] = {};
  if (!next[year][month]) next[year][month] = {};
  const n = String(value).replace(/,/g, "").trim();
  next[year][month][actualKey(person, itemId)] = n === "" ? "" : Number(n);
  return next;
}

export function setCheck(checks, year, month, person, itemId, value) {
  const next = structuredClone(checks);
  if (!next[year]) next[year] = {};
  if (!next[year][month]) next[year][month] = {};
  next[year][month][checkKey(person, itemId)] = value;
  return next;
}

export function detailKey(person, itemId) {
  return `${person}_${itemId}_detail`;
}

export function getDetail(checks, year, month, person, itemId) {
  const key = detailKey(person, itemId);
  const m = checks?.[year]?.[month]?.[key];
  return m && typeof m === "object" ? m : null;
}

export function setDetail(checks, year, month, person, itemId, detail) {
  const next = structuredClone(checks);
  if (!next[year]) next[year] = {};
  if (!next[year][month]) next[year][month] = {};
  next[year][month][detailKey(person, itemId)] = detail;
  return next;
}

export function savingsExtraKey(person) {
  return `${person}_savings_extra`;
}

export function getSavingsExtra(checks, year, month, person) {
  const key = savingsExtraKey(person);
  const m = checks?.[year]?.[month]?.[key];
  return Array.isArray(m) ? m : [];
}

export function setSavingsExtra(checks, year, month, person, lines) {
  const next = structuredClone(checks);
  if (!next[year]) next[year] = {};
  if (!next[year][month]) next[year][month] = {};
  next[year][month][savingsExtraKey(person)] = lines;
  return next;
}
