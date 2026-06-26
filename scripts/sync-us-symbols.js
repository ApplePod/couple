#!/usr/bin/env node
/**
 * NASDAQ Trader 심볼 디렉터리 → data/us-symbols.json
 * 사용: node scripts/sync-us-symbols.js
 *
 * 출처: https://www.nasdaqtrader.com/ (nasdaqlisted.txt + otherlisted.txt)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "data", "us-symbols.json");

const SOURCES = [
  {
    url: "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt",
    exchange: "NASDAQ",
    parseLine(parts) {
      const [symbol, name, , testIssue, , , etf] = parts;
      return { symbol, name, testIssue, etf: etf === "Y" };
    },
  },
  {
    url: "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt",
    exchange: null,
    parseLine(parts) {
      const [symbol, name, exchangeCode, , etf, , testIssue] = parts;
      const exchange = mapExchange(exchangeCode);
      return { symbol, name, testIssue, etf: etf === "Y", exchange };
    },
  },
];

const EXCHANGE_MAP = {
  N: "NYSE",
  A: "AMEX",
  P: "ARCA",
  Z: "BATS",
  V: "IEX",
  Q: "NASDAQ",
};

function mapExchange(code) {
  return EXCHANGE_MAP[String(code || "").trim().toUpperCase()] || "US";
}

function cleanName(name) {
  return String(name || "")
    .replace(/\s+-\s+Class\s.*$/i, "")
    .replace(/\s+-\s+Common Stock$/i, "")
    .replace(/\s+-\s+Ordinary Shares$/i, "")
    .replace(/\s+Common Stock$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isSkippableSymbol(symbol) {
  const s = String(symbol || "").trim().toUpperCase();
  if (!s || s.includes("$")) return true;
  if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(s)) return true;
  if (/\.[A-Z]+$/.test(s)) return true;
  if (/-W(T)?$/i.test(s)) return true;
  if (/[UR]$/i.test(s) && s.length > 4 && /[0-9]/.test(s)) return true;
  return false;
}

function isSkippableName(name) {
  const n = name.toLowerCase();
  return (
    n.includes(" - warrant") ||
    n.includes(" - warrants") ||
    n.includes(" - right") ||
    n.includes(" - rights") ||
    n.includes(" - unit") ||
    n.includes(" - units") ||
    n.endsWith(" warrant") ||
    n.endsWith(" warrants") ||
    n.endsWith(" right") ||
    n.endsWith(" rights") ||
    n.endsWith(" unit") ||
    n.endsWith(" units")
  );
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SionPortfolio/1.0)" },
  });
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  return res.text();
}

function parseFile(text, source) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const out = [];
  for (const line of lines) {
    if (line.startsWith("Symbol|") || line.startsWith("ACT Symbol|")) continue;
    if (line.includes("File Creation Time")) continue;
    const parts = line.split("|");
    const row = source.parseLine(parts);
    if (!row?.symbol || !row.name) continue;
    if (row.testIssue === "Y") continue;
    const symbol = row.symbol.trim().toUpperCase();
    const name = cleanName(row.name);
    if (!symbol || !name) continue;
    if (isSkippableSymbol(symbol)) continue;
    if (isSkippableName(name)) continue;
    const exchange = row.exchange || source.exchange || "US";
    out.push({
      code: symbol,
      name,
      abbr: symbol,
      eng: name,
      market: "US",
      exchange,
      etf: Boolean(row.etf),
    });
  }
  return out;
}

async function main() {
  const byCode = new Map();
  for (const source of SOURCES) {
    const text = await fetchText(source.url);
    const rows = parseFile(text, source);
    console.info(source.url.split("/").pop(), rows.length, "건");
    for (const row of rows) {
      if (!byCode.has(row.code)) byCode.set(row.code, row);
    }
  }
  const list = [...byCode.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" })
  );
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(list) + "\n");
  console.info("저장:", OUT, `(${list.length}종목)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
