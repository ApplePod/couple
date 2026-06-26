import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Yahoo Finance search — US 주식·ETF (NASDAQ/NYSE/AMEX 등) */
const US_EXCHANGES = new Set([
  "NMS", "NYQ", "ASE", "NCM", "NGM", "NGMS", "PCX", "BTS", "OTC", "PNK", "OQB",
]);
const US_QUOTE_TYPES = new Set(["EQUITY", "ETF"]);

type SearchRow = {
  code: string;
  name: string;
  abbr: string;
  market: "US";
  exchange: string;
};

function isUsTradableSymbol(symbol: string): boolean {
  if (!symbol) return false;
  if (symbol.includes(".") || symbol.includes("=")) return false;
  if (/-W(T)?$/i.test(symbol)) return false;
  return /^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol);
}

function mapYahooQuote(q: Record<string, unknown>): SearchRow | null {
  const quoteType = String(q.quoteType || "");
  const exchange = String(q.exchange || "");
  const symbol = String(q.symbol || "").toUpperCase();
  if (!US_QUOTE_TYPES.has(quoteType)) return null;
  if (!US_EXCHANGES.has(exchange)) return null;
  if (!isUsTradableSymbol(symbol)) return null;

  const name = String(q.longname || q.shortname || symbol).trim();
  return {
    code: symbol,
    name,
    abbr: symbol,
    market: "US",
    exchange: String(q.exchDisp || exchange),
  };
}

async function searchYahoo(q: string, limit: number): Promise<SearchRow[]> {
  const url =
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=${Math.min(limit * 2, 25)}&newsCount=0&listsCount=0`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SionPortfolio/1.0)" },
  });
  if (!res.ok) return [];

  const data = await res.json();
  const out: SearchRow[] = [];
  const seen = new Set<string>();
  for (const row of data?.quotes || []) {
    const mapped = mapYahooQuote(row as Record<string, unknown>);
    if (!mapped || seen.has(mapped.code)) continue;
    seen.add(mapped.code);
    out.push(mapped);
    if (out.length >= limit) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const q = String(body.q || body.query || "").trim();
    const limit = Math.min(Math.max(Number(body.limit) || 12, 1), 20);

    if (q.length < 1) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = await searchYahoo(q, limit);
    return new Response(JSON.stringify({ results, at: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "search error", results: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
