/**
 * 국내 주식·ETF 종목 자동완성 (data/kr-symbols.json)
 */
const SYMBOLS_URL = "data/kr-symbols.json";
const MAX_RESULTS = 8;
const MIN_QUERY_LEN = 1;

let symbols = [];
let loadPromise = null;

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

/** 앞글자부터 일치 (종목명·약명·코드) */
export function searchKrSymbols(query, limit = MAX_RESULTS) {
  const q = normQ(query);
  if (q.length < MIN_QUERY_LEN || !symbols.length) return [];
  const qLower = q.toLowerCase();
  const out = [];
  for (const s of symbols) {
    const name = s.name || "";
    const abbr = s.abbr || "";
    const code = s.code || "";
    const eng = (s.eng || "").toLowerCase();
    const hit =
      name.startsWith(q) ||
      abbr.startsWith(q) ||
      code.startsWith(q) ||
      (eng && eng.startsWith(qLower));
    if (!hit) continue;
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

function marketLabel(m) {
  if (m === "KOSPI") return "코스피";
  if (m === "KOSDAQ") return "코스닥";
  if (m === "ETF") return "ETF";
  return m || "";
}

function renderList(listEl, items) {
  if (!items.length) {
    listEl.hidden = true;
    listEl.innerHTML = "";
    return;
  }
  listEl.innerHTML = items
    .map(
      (s, i) =>
        `<button type="button" class="symbol-ac-item" data-idx="${i}" role="option">
          <span class="symbol-ac-name">${esc(s.name)}</span>
          <span class="symbol-ac-meta">${esc(s.code)} · ${esc(marketLabel(s.market))}</span>
        </button>`
    )
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
}

function openList(wrap, query) {
  const input = wrap.querySelector(".dl-symbol");
  const list = wrap.querySelector(".symbol-ac-list");
  if (!input || !list) return;
  const items = searchKrSymbols(query);
  wrap._acItems = items;
  renderList(list, items);
  input.setAttribute("aria-expanded", items.length ? "true" : "false");
}

function selectItem(wrap, item) {
  const input = wrap.querySelector(".dl-symbol");
  if (!input || !item) return;
  input.value = item.name;
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
    delete wrap.dataset.acActive;
    openList(wrap, input.value);
  });

  section.addEventListener("focusin", (e) => {
    const input = e.target.closest(".dl-symbol");
    if (!input?.value?.trim()) return;
    openList(input.closest(".symbol-ac-wrap"), input.value);
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
    <input type="text" class="dl-symbol" placeholder="종목명·코드" autocomplete="off"
      spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="false"
      value="${esc(v)}">
    <div class="symbol-ac-list" role="listbox" hidden></div>
  </div>`;
}
