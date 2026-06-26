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
      const remote = data.checks;
      const local = loadChecks();
      const localStr = JSON.stringify(local);
      const remoteStr = JSON.stringify(remote);
      if (localStr === remoteStr) {
        onRemoteChange?.(remote, { source: "initial" });
      } else if (Object.keys(local).length === 0) {
        localStorage.setItem(LS_KEY, remoteStr);
        onRemoteChange?.(remote, { source: "initial" });
      } else {
        // 로컬에 미동기화 변경이 있으면 로컬 우선 후 클라우드에 반영
        console.info("[budget] 로컬·원격 불일치 → 로컬 우선");
        localStorage.setItem(LS_KEY, localStr);
        onRemoteChange?.(local, { source: "initial" });
        saveChecks(local).catch((e) => console.warn("[budget] 로컬 동기화:", e));
      }
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
          if (checks) onRemoteChange?.(checks, { source: "realtime" });
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

export function persistChecksLocal(checks) {
  localStorage.setItem(LS_KEY, JSON.stringify(checks));
}

export async function saveChecksToCloud(checks) {
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

export async function saveChecks(checks) {
  persistChecksLocal(checks);
  return saveChecksToCloud(checks);
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

export function depositKey(person, itemId) {
  return `${person}_${itemId}_deposit`;
}

export function getDeposit(checks, year, month, person, itemId) {
  const key = depositKey(person, itemId);
  const m = checks?.[year]?.[month];
  if (!m || !m[key]) return '';
  return String(m[key]);
}

export function setDeposit(checks, year, month, person, itemId, value) {
  const next = structuredClone(checks);
  if (!next[year]) next[year] = {};
  if (!next[year][month]) next[year][month] = {};
  next[year][month][depositKey(person, itemId)] = value || '';
  return next;
}

export function setSavingsExtra(checks, year, month, person, lines) {
  const next = structuredClone(checks);
  if (!next[year]) next[year] = {};
  if (!next[year][month]) next[year][month] = {};
  next[year][month][savingsExtraKey(person)] = lines;
  return next;
}

export function monthlyExtraKey(person) {
  return `${person}_monthly_extra`;
}

export function getMonthlyExtra(checks, year, month, person) {
  const key = monthlyExtraKey(person);
  const m = checks?.[year]?.[month]?.[key];
  return Array.isArray(m) ? m : [];
}

export function setMonthlyExtra(checks, year, month, person, lines) {
  const next = structuredClone(checks);
  if (!next[year]) next[year] = {};
  if (!next[year][month]) next[year][month] = {};
  next[year][month][monthlyExtraKey(person)] = lines;
  return next;
}

export function hiddenItemsKey(person) {
  return `${person}_hidden_items`;
}

export function getHiddenItems(checks, year, month, person) {
  const key = hiddenItemsKey(person);
  const m = checks?.[year]?.[month]?.[key];
  return Array.isArray(m) ? m : [];
}

export function setHiddenItems(checks, year, month, person, ids) {
  const next = structuredClone(checks);
  if (!next[year]) next[year] = {};
  if (!next[year][month]) next[year][month] = {};
  next[year][month][hiddenItemsKey(person)] = ids;
  return next;
}
