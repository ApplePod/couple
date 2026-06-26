import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** 키움 조회 초당 5건 — 여유 두고 ~4.5건/초 */
const KIWOOM_GAP_MS = 220;

type SymbolRow = { key: string; code: string; market: string };
type Quote = { price: number; currency: string };

let kiwoomTokenCache: { token: string; expiresAt: number } | null = null;

function isUsMarket(market: string): boolean {
  const m = String(market || "").toUpperCase();
  return m === "US" || m === "NASDAQ" || m === "NYSE" || m === "AMEX";
}

function kiwoomBase(): string {
  return (Deno.env.get("KIWOOM_API_BASE") || "https://api.kiwoom.com").replace(/\/$/, "");
}

function hasKiwoomConfig(): boolean {
  return Boolean(Deno.env.get("KIWOOM_APP_KEY") && Deno.env.get("KIWOOM_SECRET_KEY"));
}

function parseKiwoomPrice(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).replace(/,/g, "").trim();
  const n = Number(s.replace(/^[+-]/, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseKiwoomExpires(raw: string): number {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(String(raw || ""));
  if (!m) return Date.now() + 23 * 60 * 60 * 1000;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function getKiwoomToken(): Promise<string> {
  const appkey = Deno.env.get("KIWOOM_APP_KEY");
  const secretkey = Deno.env.get("KIWOOM_SECRET_KEY");
  if (!appkey || !secretkey) {
    throw new Error("KIWOOM_APP_KEY / KIWOOM_SECRET_KEY 미설정");
  }

  const now = Date.now();
  if (kiwoomTokenCache && kiwoomTokenCache.expiresAt > now + 60_000) {
    return kiwoomTokenCache.token;
  }

  const res = await fetch(`${kiwoomBase()}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json;charset=UTF-8" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey,
      secretkey,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `키움 토큰 발급 실패 (${res.status})`);
  }

  const data = await res.json();
  const token = String(data.token || "");
  if (!token || (data.return_code != null && data.return_code !== 0)) {
    throw new Error(data.return_msg || "키움 토큰 발급 실패");
  }

  kiwoomTokenCache = {
    token,
    expiresAt: parseKiwoomExpires(data.expires_dt),
  };
  return token;
}

async function kiwoomApi(
  token: string,
  apiId: string,
  path: string,
  body: Record<string, string>,
): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${kiwoomBase()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      authorization: `Bearer ${token}`,
      "api-id": apiId,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (data.return_code != null && data.return_code !== 0) return null;
  return data;
}

/** ka10001 — 주식기본정보 (국내주식·ETF 공통 6자리 코드) */
async function fetchKiwoomKrQuote(token: string, code: string): Promise<Quote | null> {
  const stkCd = String(code || "").trim().padStart(6, "0");
  const data = await kiwoomApi(token, "ka10001", "/api/dostk/stkinfo", { stk_cd: stkCd });
  if (!data) return null;
  const price = parseKiwoomPrice(data.cur_prc);
  if (price == null) return null;
  return { price, currency: "KRW" };
}

function toYahoo(code: string, market: string): string {
  const m = String(market || "").toUpperCase();
  const c = String(code || "").trim().padStart(6, "0");
  if (!c) return "";
  if (isUsMarket(m)) return c.toUpperCase();
  if (m === "KOSDAQ") return `${c}.KQ`;
  return `${c}.KS`;
}

function yahooKrCandidates(code: string, market: string): string[] {
  const c = String(code || "").trim().padStart(6, "0");
  if (!c) return [];
  const m = String(market || "").toUpperCase();
  if (m === "KOSDAQ") return [`${c}.KQ`, `${c}.KS`];
  if (m === "KOSPI" || m === "ETF") return [`${c}.KS`, `${c}.KQ`];
  return [`${c}.KS`, `${c}.KQ`];
}

async function fetchYahooKrQuote(code: string, market: string): Promise<Quote | null> {
  for (const yahoo of yahooKrCandidates(code, market)) {
    const q = await fetchYahooChart(yahoo);
    if (q) return q;
  }
  return null;
}

async function fetchYahooChart(yahooSymbol: string): Promise<Quote | null> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SionPortfolio/1.0)" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta || meta.regularMarketPrice == null) return null;
  return {
    price: Number(meta.regularMarketPrice),
    currency: meta.currency || "KRW",
  };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

async function fetchKrQuotes(
  rows: SymbolRow[],
  quotes: Record<string, Quote>,
): Promise<{ provider: string; warnings: string[] }> {
  const warnings: string[] = [];
  if (!rows.length) return { provider: "none", warnings };

  if (hasKiwoomConfig()) {
    try {
      const token = await getKiwoomToken();
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        let q = await fetchKiwoomKrQuote(token, row.code);
        if (!q) {
          q = await fetchYahooKrQuote(row.code, row.market);
          if (q) warnings.push(`${row.code}: 키움 실패 → Yahoo`);
          else warnings.push(`${row.code}: 시세 없음`);
        }
        if (q) quotes[row.key] = q;
        if (i < rows.length - 1) await sleep(KIWOOM_GAP_MS);
      }
      return { provider: "kiwoom", warnings };
    } catch (e) {
      warnings.push(e instanceof Error ? e.message : "키움 조회 실패");
    }
  } else {
    warnings.push("KIWOOM_APP_KEY 미설정 — 국내 Yahoo 대체");
  }

  const yahooRows = rows.map((s) => ({
    key: s.key,
    code: s.code,
    market: s.market,
  }));
  const results = await mapLimit(yahooRows, 4, async (p) => {
    const q = await fetchYahooKrQuote(p.code, p.market);
    return { key: p.key, quote: q };
  });
  for (const row of results) {
    if (row.quote) quotes[row.key] = row.quote;
  }
  return { provider: "yahoo", warnings };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const symbols: SymbolRow[] = Array.isArray(body.symbols) ? body.symbols : [];

    const krRows: SymbolRow[] = [];
    const usRows: SymbolRow[] = [];
    for (const s of symbols) {
      const row: SymbolRow = {
        key: s.key || `${s.code}:${isUsMarket(s.market) ? "US" : "KR"}`,
        code: String(s.code || "").trim(),
        market: s.market || "KOSPI",
      };
      if (!row.code) continue;
      if (isUsMarket(row.market)) usRows.push(row);
      else krRows.push(row);
    }

    const quotes: Record<string, Quote> = {};
    const warnings: string[] = [];

    const krMeta = await fetchKrQuotes(krRows, quotes);
    warnings.push(...krMeta.warnings);

    const usResults = await mapLimit(
      usRows.map((s) => ({ key: s.key, yahoo: toYahoo(s.code, s.market) })),
      4,
      async (p) => {
        const q = await fetchYahooChart(p.yahoo);
        return { key: p.key, quote: q };
      },
    );
    for (const row of usResults) {
      if (row.quote) quotes[row.key] = row.quote;
    }

    const fxRow = await fetchYahooChart("KRW=X");
    const fx = fxRow?.price && fxRow.price > 0 ? { USDKRW: fxRow.price } : {};

    return new Response(
      JSON.stringify({
        quotes,
        fx,
        at: new Date().toISOString(),
        meta: {
          krProvider: krRows.length ? krMeta.provider : null,
          usProvider: usRows.length ? "yahoo" : null,
          warnings: warnings.length ? warnings : undefined,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "quote error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
