/**
 * 종목 자동완성 — 국내(kr-symbols.json) + 미국(Yahoo Search via Edge Function)
 */
const SYMBOLS_URL = "data/kr-symbols.json";
const MAX_RESULTS = 12;
const MIN_QUERY_LEN = 1;
const US_SEARCH_MIN = 2;
const US_SEARCH_DEBOUNCE_MS = 280;

/** 자주 찾는 종목 (동점·접두어 일치 시 우선) */
const POPULAR_CODES = new Set([
  "005930", "000660", "035420", "005380", "035720", "000270", "051910", "006400",
  "003670", "068270", "105560", "055550", "032830", "015760", "034730",
]);

let symbols = [];
let loadPromise = null;
let usSearchSeq = 0;

export function initSymbolSearch() {
  if (!loadPromise) {
    loadPromise = fetch(SYMBOLS_URL)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data) => {
        symbols = Array.isArray(data) ? data : [];
      })
      .catch((e) => {
        console.warn("[symbol-search] 목록 로드 실패:", e);
        symbols = [];
      });
  }
  return loadPromise;
}

function normQ(q) {
  return String(q ?? "").trim();
}

function symbolSearchUrl() {
  const url = window.SUPABASE_CONFIG?.url;
  if (!url) return null;
  return `${url.replace(/\/$/, "")}/functions/v1/portfolio-symbol-search`;
}

async function fetchUsSymbolSearch(query, limit = MAX_RESULTS) {
  const endpoint = symbolSearchUrl();
  const anonKey = window.SUPABASE_CONFIG?.anonKey;
  if (!endpoint || !anonKey) return [];

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ q: query, limit }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.results) ? data.results : [];
  } catch (e) {
    console.warn("[symbol-search] 미국 검색 실패:", e);
    return [];
  }
}

function shouldSearchUs(query) {
  const q = normQ(query);
  if (q.length < US_SEARCH_MIN) return false;
  if (/^\d+$/.test(compact(q))) return false;
  return true;
}

function mergeSearchResults(kr, us, limit = MAX_RESULTS) {
  const seen = new Set(kr.map((s) => s.code));
  const out = [...kr];
  for (const s of us) {
    if (!s?.code || seen.has(s.code)) continue;
    seen.add(s.code);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

/** 한글·약어 → 영문 브랜드 (ETF 검색용) */
const QUERY_ALIASES = [
  ["티거", "tiger"],
  ["타이거", "tiger"],
  ["코덱스", "kodex"],
  ["코스텍", "kodex"],
  ["에이스", "ace"],
  ["한라로", "hanaro"],
  ["하나로", "hanaro"],
  ["플러스", "plus"],
  ["라이즈", "rise"],
  ["아이비케이", "ibk"],
];

function expandQuery(q) {
  let out = normQ(q);
  const c = compact(out);
  for (const [ko, en] of QUERY_ALIASES) {
    const koc = compact(ko);
    if (c === koc) return en;
    if (c.includes(koc)) {
      out = out.replace(new RegExp(ko, "gi"), en);
    }
  }
  return out;
}

/** 글자만 모두 포함 (순서 무관, 느슨 매칭) */
function charBagScore(comp, qCompact) {
  if (qCompact.length < 2) return 0;
  const need = new Map();
  for (const ch of qCompact) need.set(ch, (need.get(ch) || 0) + 1);
  for (const ch of comp) {
    const n = need.get(ch);
    if (n) need.set(ch, n - 1);
  }
  for (const n of need.values()) if (n > 0) return 0;
  return 85 + qCompact.length * 10;
}

/** 검색어 단어가 종목명 어디에든 포함되는 비율 */
function wordCoverageScore(s, qRaw) {
  const qWords = qRaw.split(/\s+/).map(compact).filter((w) => w.length > 0);
  if (qWords.length < 2) return 0;
  const blob = compact([s.name, s.abbr, s.eng].filter(Boolean).join(" "));
  let hit = 0;
  for (const w of qWords) {
    if (blob.includes(w)) hit++;
  }
  if (!hit) return 0;
  const ratio = hit / qWords.length;
  return 320 * ratio * ratio;
}

function fold(s) {
  return String(s ?? "").toLowerCase();
}

/** 공백·기호 제거 후 비교용 (KODEX 200 ↔ kodex200) */
function compact(s) {
  return fold(s).replace(/[\s\-_.·()/&,+]/g, "");
}

/** needle 글자가 hay에 순서대로 얼마나 들어가는지 (불연속 허용) */
function subsequenceScore(hay, needle) {
  if (!needle || !hay) return 0;
  let hi = 0;
  let matched = 0;
  let run = 0;
  let bestRun = 0;
  for (const ch of needle) {
    const idx = hay.indexOf(ch, hi);
    if (idx === -1) return 0;
    matched++;
    run = idx === hi ? run + 1 : 1;
    bestRun = Math.max(bestRun, run);
    hi = idx + 1;
  }
  const coverage = matched / needle.length;
  const span = hi / hay.length;
  return coverage * 280 + bestRun * 25 + (1 - span) * 40;
}

function fieldScore(field, qRaw, qCompact, digitsOnly, isCode) {
  if (!field) return 0;
  const raw = fold(field);
  const comp = compact(field);
  let score = 0;

  if (digitsOnly && isCode) {
    if (comp === qCompact) score = 1000;
    else if (qCompact.length >= 4 && comp.startsWith(qCompact)) score = 850;
    if (score > 0) {
      score += (qCompact.length / Math.max(comp.length, 1)) * 120;
      score += 50;
    }
    return score;
  }

  if (raw === qRaw || comp === qCompact) score = 1000;
  else if (raw.startsWith(qRaw) || comp.startsWith(qCompact)) score = 850;
  else if (raw.includes(qRaw) || comp.includes(qCompact)) {
    const at = comp.indexOf(qCompact);
    score = 650 - Math.min(at, 200);
  } else if (!digitsOnly) {
    score = subsequenceScore(comp, qCompact);
    if (!score) score = charBagScore(comp, qCompact);
  }

  if (score > 0) {
    const ratio = (qCompact.length / Math.max(comp.length, 1)) * (score >= 850 ? 120 : 180);
    score += ratio;
    let overlap = 0;
    for (const ch of qCompact) {
      if (comp.includes(ch)) overlap++;
    }
    score += (overlap / qCompact.length) * 50;
  }

  return score;
}

function symbolScore(s, q) {
  const qRaw = fold(q);
  const qCompact = compact(q);
  if (!qCompact) return 0;
  const digitsOnly = /^\d+$/.test(qCompact);

  const fields = [
    { f: s.name, w: 1, code: false },
    { f: s.abbr, w: 1.08, code: false },
    { f: s.code, w: 1.1, code: true },
    { f: s.eng, w: 0.88, code: false },
  ];

  let best = 0;
  for (const { f, w, code } of fields) {
    best = Math.max(best, fieldScore(f, qRaw, qCompact, digitsOnly, code) * w);
  }

  const tokens = qRaw.split(/\s+/).map(compact).filter((t) => t.length > 0);
  if (tokens.length > 1) {
    let sum = 0;
    let hit = 0;
    for (const t of tokens) {
      const tDigits = /^\d+$/.test(t);
      let ts = 0;
      for (const { f, w, code } of fields) {
        ts = Math.max(ts, fieldScore(f, fold(t), t, tDigits, code) * w);
      }
      if (ts > 0) {
        sum += ts;
        hit++;
      }
    }
    if (hit > 0) {
      const avg = sum / hit;
      const coverage = hit / tokens.length;
      best = Math.max(best, avg * (0.55 + coverage * 0.45));
    }
  }

  best = Math.max(best, wordCoverageScore(s, qRaw));
  if (POPULAR_CODES.has(s.code)) best += 75;
  return best;
}

function minScoreFor(q) {
  const n = compact(q).length;
  if (/^\d+$/.test(compact(q))) return n <= 3 ? 400 : 250;
  if (n <= 1) return 90;
  if (n === 2) return 60;
  return 40;
}

/** 대소문자 무시 · 부분·순서·단어 일치 · 일치도 높은 순 */
export function searchKrSymbols(query, limit = MAX_RESULTS) {
  const q = expandQuery(query);
  if (q.length < MIN_QUERY_LEN || !symbols.length) return [];
  const floor = minScoreFor(q);
  const qTokens = fold(q)
    .split(/\s+/)
    .map(compact)
    .filter((t) => t.length > 0);
  const scored = [];
  for (const s of symbols) {
    if (qTokens.length > 1) {
      const blob = compact([s.name, s.abbr, s.eng].filter(Boolean).join(" "));
      const hit = qTokens.filter((t) => blob.includes(t)).length;
      if (hit < qTokens.length) continue;
    }
    const score = symbolScore(s, q);
    if (score < floor) continue;
    scored.push({ s, score });
  }
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const al = compact(a.s.name).length;
    const bl = compact(b.s.name).length;
    if (al !== bl) return al - bl;
    return (a.s.name || "").localeCompare(b.s.name || "", "ko");
  });
  return scored.slice(0, limit).map((x) => x.s);
}

function usTickerCandidate(query) {
  const raw = normQ(query);
  const upper = raw.toUpperCase();
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(upper)) return null;
  if (/^\d+$/.test(upper)) return null;
  return { code: upper, name: upper, market: "US", abbr: upper };
}

/** 국내 즉시 검색 (동기) */
export function searchSymbolsLocal(query, limit = MAX_RESULTS) {
  const kr = searchKrSymbols(query, limit);
  const us = usTickerCandidate(query);
  if (!us) return kr;
  if (kr.some((s) => s.code === us.code)) return kr;
  return [us, ...kr].slice(0, limit);
}

/** 국내 + 미국 Yahoo 검색 (비동기) */
export async function searchSymbols(query, limit = MAX_RESULTS) {
  const q = expandQuery(query);
  const kr = searchKrSymbols(q, limit);
  if (!shouldSearchUs(q)) {
    return searchSymbolsLocal(q, limit);
  }
  const us = await fetchUsSymbolSearch(q, limit);
  return mergeSearchResults(kr, us, limit);
}

function marketLabel(s) {
  if (s.market === "US") {
    return s.exchange ? `미국 · ${s.exchange}` : "미국";
  }
  if (s.market === "KOSPI") return "코스피";
  if (s.market === "KOSDAQ") return "코스닥";
  if (s.market === "ETF") return "ETF";
  return s.market || "";
}

function renderList(listEl, items, opts = {}) {
  if (opts.loading) {
    listEl.hidden = false;
    listEl.innerHTML = `<div class="symbol-ac-status">미국 종목 검색 중…</div>`;
    return;
  }
  if (!items.length) {
    listEl.hidden = true;
    listEl.innerHTML = "";
    return;
  }
  listEl.innerHTML = items
    .map((s, i) => {
      const sub =
        s.market === "US" && s.code && s.name !== s.code
          ? `<span class="symbol-ac-ticker">${esc(s.code)}</span>`
          : "";
      return `<button type="button" class="symbol-ac-item" data-idx="${i}" role="option">
          <span class="symbol-ac-name">${esc(s.name)}</span>
          ${sub}
          <span class="symbol-ac-meta">${esc(marketLabel(s))}</span>
        </button>`;
    })
    .join("");
  listEl.hidden = false;
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function closeList(wrap) {
  const list = wrap?.querySelector(".symbol-ac-list");
  if (!list) return;
  list.hidden = true;
  list.innerHTML = "";
  wrap.querySelector(".dl-symbol")?.removeAttribute("aria-expanded");
  if (wrap._usSearchTimer) {
    clearTimeout(wrap._usSearchTimer);
    wrap._usSearchTimer = null;
  }
}

async function openList(wrap, query) {
  const input = wrap.querySelector(".dl-symbol");
  const list = wrap.querySelector(".symbol-ac-list");
  if (!input || !list) return;

  const q = normQ(query);
  if (!q) {
    closeList(wrap);
    return;
  }

  delete wrap.dataset.acActive;
  const local = searchSymbolsLocal(q, MAX_RESULTS);

  if (!shouldSearchUs(q)) {
    wrap._acItems = local;
    renderList(list, local);
    input.setAttribute("aria-expanded", local.length ? "true" : "false");
    return;
  }

  const seq = ++usSearchSeq;
  wrap._searchSeq = seq;
  wrap._acItems = local;
  renderList(list, local, { loading: true });
  input.setAttribute("aria-expanded", "true");

  if (wrap._usSearchTimer) clearTimeout(wrap._usSearchTimer);
  wrap._usSearchTimer = setTimeout(async () => {
    wrap._usSearchTimer = null;
    const us = await fetchUsSymbolSearch(expandQuery(q), MAX_RESULTS);
    if (wrap._searchSeq !== seq) return;
    const merged = mergeSearchResults(searchKrSymbols(expandQuery(q), MAX_RESULTS), us, MAX_RESULTS);
    wrap._acItems = merged;
    renderList(list, merged);
    input.setAttribute("aria-expanded", merged.length ? "true" : "false");
  }, US_SEARCH_DEBOUNCE_MS);
}

function selectItem(wrap, item) {
  const input = wrap.querySelector(".dl-symbol");
  if (!input || !item) return;
  input.value = item.name;
  if (item.code) input.dataset.symbolCode = item.code;
  else delete input.dataset.symbolCode;
  if (item.market) input.dataset.symbolMarket = item.market;
  else delete input.dataset.symbolMarket;
  closeList(wrap);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function activeWrapItem(wrap, delta) {
  const list = wrap.querySelector(".symbol-ac-list");
  const items = list?.querySelectorAll(".symbol-ac-item");
  if (!items?.length) return;
  let idx = Number(wrap.dataset.acActive ?? -1) + delta;
  if (idx < 0) idx = items.length - 1;
  if (idx >= items.length) idx = 0;
  wrap.dataset.acActive = String(idx);
  items.forEach((el, i) => el.classList.toggle("is-active", i === idx));
  items[idx].scrollIntoView({ block: "nearest" });
}

export function attachSymbolAutocomplete(section) {
  if (section._symbolAcAttached) return;
  section._symbolAcAttached = true;

  section.addEventListener("input", (e) => {
    const input = e.target.closest(".dl-symbol");
    if (!input) return;
    const wrap = input.closest(".symbol-ac-wrap");
    if (!wrap) return;
    void openList(wrap, input.value);
  });

  section.addEventListener("focusin", (e) => {
    const input = e.target.closest(".dl-symbol");
    if (!input?.value?.trim()) return;
    void openList(input.closest(".symbol-ac-wrap"), input.value);
  });

  section.addEventListener("keydown", (e) => {
    const input = e.target.closest(".dl-symbol");
    if (!input) return;
    const wrap = input.closest(".symbol-ac-wrap");
    const list = wrap?.querySelector(".symbol-ac-list:not([hidden])");
    if (!list) return;
    const items = wrap._acItems || [];
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeWrapItem(wrap, 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeWrapItem(wrap, -1);
    } else if (e.key === "Enter") {
      const idx = Number(wrap.dataset.acActive ?? -1);
      if (idx >= 0 && items[idx]) {
        e.preventDefault();
        selectItem(wrap, items[idx]);
      }
    } else if (e.key === "Escape") {
      closeList(wrap);
    }
  });

  section.addEventListener("mousedown", (e) => {
    const item = e.target.closest(".symbol-ac-item");
    if (!item) return;
    e.preventDefault();
    const wrap = item.closest(".symbol-ac-wrap");
    const idx = Number(item.dataset.idx);
    selectItem(wrap, wrap._acItems?.[idx]);
  });

  section.addEventListener("focusout", (e) => {
    const wrap = e.target.closest?.(".symbol-ac-wrap");
    if (!wrap) return;
    setTimeout(() => {
      if (!wrap.contains(document.activeElement)) closeList(wrap);
    }, 120);
  });
}

export function renderSymbolInput(value) {
  const v = String(value ?? "");
  return `<div class="symbol-ac-wrap">
    <input type="text" class="dl-symbol" placeholder="종목명·코드·티커" autocomplete="off"
      spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="false"
      value="${esc(v)}">
    <div class="symbol-ac-list" role="listbox" hidden></div>
  </div>`;
}
