/**
 * 포트폴리오 Supabase + localStorage
 * budget_checks 테이블에 id=sion_portfolio 행 사용 (checks 컬럼에 JSON)
 */
const LS_KEY = "couple_portfolio";
const LS_DIRTY_KEY = "couple_portfolio_dirty";
const ROW_ID = "sion_portfolio";

let supabase = null;
let supabaseReady = false;
let lastSynced = null;

function table() {
  return window.SUPABASE_PATH?.table || "budget_checks";
}

function isConfigured() {
  const c = window.SUPABASE_CONFIG;
  return c && c.url && c.anonKey;
}

export function defaultPortfolio() {
  return { yj: { positions: [] }, sn: { positions: [] } };
}

export function loadPortfolio() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    if (!raw?.yj || !raw?.sn) return defaultPortfolio();
    return raw;
  } catch {
    return defaultPortfolio();
  }
}

export function persistPortfolioLocal(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

export function markPortfolioDirty() {
  try {
    localStorage.setItem(LS_DIRTY_KEY, "1");
  } catch { /* ignore */ }
}

export function clearPortfolioDirty() {
  try {
    localStorage.removeItem(LS_DIRTY_KEY);
  } catch { /* ignore */ }
}

function isDirty() {
  try {
    return localStorage.getItem(LS_DIRTY_KEY) === "1";
  } catch {
    return false;
  }
}

export function setLastSyncedPortfolio(data) {
  lastSynced = data ? structuredClone(data) : null;
}

export async function savePortfolioToCloud(data) {
  if (!supabaseReady || !supabase) return { ok: true, mode: "local", data };

  try {
    const { error } = await supabase.from(table()).upsert({
      id: ROW_ID,
      checks: data,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    setLastSyncedPortfolio(data);
    clearPortfolioDirty();
    return { ok: true, mode: "supabase", data };
  } catch (e) {
    console.warn("[portfolio] Supabase save:", e);
    markPortfolioDirty();
    return { ok: false, mode: "local", error: e.message, data };
  }
}

export async function fetchRemotePortfolio() {
  if (!supabaseReady || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from(table())
      .select("checks")
      .eq("id", ROW_ID)
      .maybeSingle();
    if (error || !data?.checks) return null;
    return data.checks;
  } catch {
    return null;
  }
}

export async function initPortfolioStore(onRemoteChange) {
  if (!isConfigured()) {
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
      .eq("id", ROW_ID)
      .maybeSingle();

    if (error) console.warn("[portfolio] Supabase load:", error.message);
    else if (data?.checks) {
      const remote = data.checks;
      const local = loadPortfolio();
      const dirty = isDirty();

      if (dirty && (local.yj?.positions?.length || local.sn?.positions?.length)) {
        persistPortfolioLocal(local);
        clearPortfolioDirty();
        onRemoteChange?.(local, { source: "initial" });
        savePortfolioToCloud(local);
      } else {
        persistPortfolioLocal(remote);
        clearPortfolioDirty();
        setLastSyncedPortfolio(remote);
        onRemoteChange?.(remote, { source: "initial" });
      }
    } else {
      const local = loadPortfolio();
      const hasData = local.yj?.positions?.length || local.sn?.positions?.length;
      if (hasData) {
        onRemoteChange?.(local, { source: "initial" });
        savePortfolioToCloud(local);
      }
    }

    supabase
      .channel(`portfolio-${ROW_ID}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: table(),
          filter: `id=eq.${ROW_ID}`,
        },
        (payload) => {
          const holdings = payload.new?.checks;
          if (holdings) onRemoteChange?.(holdings, { source: "realtime" });
        }
      )
      .subscribe();

    return { mode: "supabase" };
  } catch (e) {
    console.warn("[portfolio] Supabase 초기화 실패:", e);
    return { mode: "local" };
  }
}
