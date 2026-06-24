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

export function getCheck(checks, year, month, itemId) {
  return !!checks?.[year]?.[month]?.[itemId];
}

export function setCheck(checks, year, month, itemId, value) {
  const next = structuredClone(checks);
  if (!next[year]) next[year] = {};
  if (!next[year][month]) next[year][month] = {};
  next[year][month][itemId] = value;
  return next;
}
