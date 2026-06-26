/**
 * Supabase + localStorage 예산 체크 저장
 */
const LS_KEY = "couple_budget_checks";
const LS_DIRTY_KEY = "couple_budget_checks_dirty";

let supabase = null;
let supabaseReady = false;
let realtimeChannel = null;
let lastSyncedChecks = null;

export function setLastSyncedChecks(checks) {
  lastSyncedChecks = checks ? structuredClone(checks) : null;
}

export function markDirty() {
  try {
    localStorage.setItem(LS_DIRTY_KEY, "1");
  } catch { /* ignore */ }
}

export function clearDirty() {
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
      const dirty = isDirty();

      if (dirty && Object.keys(local).length > 0) {
        const merged = mergeChecks(remote, local, remote);
        const mergedStr = JSON.stringify(merged);
        console.info("[budget] 미동기화 로컬 변경 → 병합 후 업로드");
        localStorage.setItem(LS_KEY, mergedStr);
        clearDirty();
        setLastSyncedChecks(remote);
        onRemoteChange?.(merged, { source: "initial" });
        saveChecksToCloud(merged)
          .then((res) => {
            if (res.ok && res.checks) setLastSyncedChecks(res.checks);
          })
          .catch((e) => console.warn("[budget] 병합 동기화:", e));
      } else {
        const remoteStr = JSON.stringify(remote);
        localStorage.setItem(LS_KEY, remoteStr);
        clearDirty();
        setLastSyncedChecks(remote);
        onRemoteChange?.(remote, { source: "initial" });
      }
    } else {
      const local = loadChecks();
      if (Object.keys(local).length > 0) {
        setLastSyncedChecks(null);
        onRemoteChange?.(local, { source: "initial" });
        saveChecks(local).catch((e) => console.warn("[budget] 초기 업로드:", e));
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
  if (!supabaseReady || !supabase) return { ok: true, mode: "local", checks };

  try {
    const { data: current, error: fetchErr } = await supabase
      .from(table())
      .select("checks")
      .eq("id", rowId())
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    let toSave = checks;
    if (current?.checks) {
      const base = lastSyncedChecks ?? current.checks;
      toSave = mergeChecks(base, checks, current.checks);
    }

    const { error } = await supabase.from(table()).upsert({
      id: rowId(),
      checks: toSave,
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;
    setLastSyncedChecks(toSave);
    return { ok: true, mode: "supabase", checks: toSave };
  } catch (e) {
    console.warn("[budget] Supabase save:", e);
    markDirty();
    return { ok: false, mode: "local", error: e.message, checks };
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

function jsonEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function lineMergeKey(ln, i) {
  if (ln?.slotId) return `slot:${ln.slotId}`;
  if (ln?.id) return `id:${ln.id}`;
  return `i:${i}`;
}

/** 배열 항목(생활비·월급추가 등) — 로컬·원격 각각 바뀐 필드만 합침 */
function mergeLineArrays(baseArr, localArr, remoteArr) {
  const base = baseArr || [];
  const local = localArr || [];
  const remote = remoteArr || [];
  const keys = new Set();
  for (const arr of [base, local, remote]) {
    arr.forEach((ln, i) => keys.add(lineMergeKey(ln, i)));
  }
  const out = [];
  for (const key of keys) {
    const pick = (arr) => {
      const idx = arr.findIndex((ln, i) => lineMergeKey(ln, i) === key);
      return idx === -1 ? undefined : arr[idx];
    };
    const b = pick(base);
    const l = pick(local);
    const r = pick(remote);
    if (l === undefined && r === undefined) continue;
    if (l === undefined) {
      out.push(structuredClone(r));
      continue;
    }
    if (r === undefined) {
      out.push(structuredClone(l));
      continue;
    }
    const merged = { ...r };
    for (const k of new Set([...Object.keys(b || {}), ...Object.keys(l), ...Object.keys(r)])) {
      const lc = !jsonEqual(l[k], b?.[k]);
      const rc = !jsonEqual(r[k], b?.[k]);
      if (lc) merged[k] = l[k];
      else if (rc) merged[k] = r[k];
    }
    out.push(merged);
  }
  return out;
}

function mergeMonthBlob(baseMonth, localMonth, remoteMonth) {
  const base = baseMonth || {};
  const local = localMonth || {};
  const remote = remoteMonth || {};
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
  const out = { ...remote };

  for (const key of keys) {
    const b = base[key];
    const l = local[key];
    const r = remote[key];
    const lc = !jsonEqual(l, b);
    const rc = !jsonEqual(r, b);

    if (key.endsWith("_monthly_extra") || key.endsWith("_savings_extra")) {
      out[key] = mergeLineArrays(
        Array.isArray(b) ? b : [],
        Array.isArray(l) ? l : [],
        Array.isArray(r) ? r : []
      );
      continue;
    }

    if (key.endsWith("_detail") && (l || r)) {
      const ld = l && typeof l === "object" ? l : r;
      const rd = r && typeof r === "object" ? r : l;
      const bd = b && typeof b === "object" ? b : {};
      out[key] = {
        type: ld?.type ?? rd?.type ?? bd?.type,
        lines: mergeLineArrays(bd?.lines, ld?.lines, rd?.lines),
      };
      continue;
    }

    if (key.endsWith("_hidden_items")) {
      const la = Array.isArray(l) ? l : [];
      const ra = Array.isArray(r) ? r : [];
      out[key] = lc && !rc ? la : rc ? ra : la.length ? la : ra;
      continue;
    }

    if (lc && rc) out[key] = l;
    else if (lc) out[key] = l;
    else if (rc) out[key] = r;
    else if (r !== undefined) out[key] = r;
    else if (l !== undefined) out[key] = l;
  }

  return out;
}

/** 마지막 동기화(base) 기준 3-way 병합 — 동시 편집 시 서로 덮어쓰지 않음 */
export function mergeChecks(base, local, remote) {
  const b = base || {};
  const l = local || {};
  const r = remote || {};
  const years = new Set([
    ...Object.keys(b),
    ...Object.keys(l),
    ...Object.keys(r),
  ]);
  const out = structuredClone(r);

  for (const year of years) {
    if (!out[year]) out[year] = {};
    const months = new Set([
      ...Object.keys(b[year] || {}),
      ...Object.keys(l[year] || {}),
      ...Object.keys(r[year] || {}),
    ]);
    for (const month of months) {
      out[year][month] = mergeMonthBlob(b[year]?.[month], l[year]?.[month], r[year]?.[month]);
    }
  }

  return out;
}

export async function fetchRemoteChecks() {
  if (!supabaseReady || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from(table())
      .select("checks")
      .eq("id", rowId())
      .maybeSingle();
    if (error || !data?.checks) return null;
    return data.checks;
  } catch {
    return null;
  }
}
