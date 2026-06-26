import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function toYahoo(code: string, market: string): string {
  const m = String(market || "").toUpperCase();
  const c = String(code || "").trim();
  if (!c) return "";
  if (m === "US" || m === "NASDAQ" || m === "NYSE" || m === "AMEX") {
    return c.toUpperCase();
  }
  if (m === "KOSDAQ") return `${c}.KQ`;
  return `${c}.KS`;
}

async function fetchChart(yahooSymbol: string) {
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
    symbol: meta.symbol || yahooSymbol,
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const symbols: { key: string; code: string; market: string }[] = Array.isArray(body.symbols)
      ? body.symbols
      : [];

    const fxRow = await fetchChart("KRW=X");
    const fx = fxRow?.price && fxRow.price > 0 ? { USDKRW: fxRow.price } : {};

    const pairs = symbols
      .map((s) => ({
        key: s.key || `${s.code}:${String(s.market || "").toUpperCase() === "US" ? "US" : "KR"}`,
        yahoo: toYahoo(s.code, s.market),
      }))
      .filter((p) => p.yahoo);

    const results = await mapLimit(pairs, 8, async (p) => {
      const q = await fetchChart(p.yahoo);
      return { key: p.key, quote: q };
    });

    const quotes: Record<string, { price: number; currency: string }> = {};
    for (const row of results) {
      if (row.quote?.price != null) {
        quotes[row.key] = { price: row.quote.price, currency: row.quote.currency };
      }
    }

    return new Response(
      JSON.stringify({ quotes, fx, at: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "quote error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
