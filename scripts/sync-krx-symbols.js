#!/usr/bin/env node
/**
 * KRX OPEN API → data/kr-symbols.json
 * 사용: KRX_API_KEY=발급키 node scripts/sync-krx-symbols.js
 *
 * 마켓플레이스에서 아래 API 활용 신청 필요:
 * - 유가증권 종목기본정보
 * - 코스닥 종목기본정보
 * - ETF 일별매매정보
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "data", "kr-symbols.json");
const AUTH_KEY = process.env.KRX_API_KEY;

const ENDPOINTS = [
  {
    url: "https://data-dbg.krx.co.kr/svc/apis/sto/stk_isu_base_info",
    market: "KOSPI",
    map: (r) => ({
      code: r.ISU_SRT_CD,
      name: r.ISU_NM,
      abbr: r.ISU_ABBRV || r.ISU_NM,
      eng: r.ISU_ENG_NM || "",
      market: "KOSPI",
    }),
  },
  {
    url: "https://data-dbg.krx.co.kr/svc/apis/sto/ksq_isu_base_info",
    market: "KOSDAQ",
    map: (r) => ({
      code: r.ISU_SRT_CD,
      name: r.ISU_NM,
      abbr: r.ISU_ABBRV || r.ISU_NM,
      eng: r.ISU_ENG_NM || "",
      market: "KOSDAQ",
    }),
  },
  {
    url: "https://data-dbg.krx.co.kr/svc/apis/etp/etf_bydd_trd",
    market: "ETF",
    map: (r) => ({
      code: r.ISU_CD,
      name: r.ISU_NM,
      abbr: r.ISU_NM,
      eng: "",
      market: "ETF",
    }),
  },
];

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

async function fetchBlock(url, basDd) {
  const res = await fetch(`${url}?basDd=${basDd}`, {
    headers: { AUTH_KEY },
  });
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  const json = await res.json();
  return json.OutBlock_1 || [];
}

async function findBusinessDay() {
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    const basDd = ymd(d);
    const sample = await fetchBlock(ENDPOINTS[0].url, basDd);
    if (sample.length) return basDd;
    d.setDate(d.getDate() - 1);
  }
  throw new Error("최근 영업일 데이터를 찾지 못했습니다.");
}

async function main() {
  if (!AUTH_KEY) {
    console.error("KRX_API_KEY 환경변수를 설정하세요.");
    process.exit(1);
  }
  const basDd = await findBusinessDay();
  console.info("기준일:", basDd);
  const byCode = new Map();
  for (const ep of ENDPOINTS) {
    const rows = await fetchBlock(ep.url, basDd);
    console.info(ep.market, rows.length, "건");
    for (const r of rows) {
      const item = ep.map(r);
      if (!item.code || !item.name) continue;
      byCode.set(item.code, item);
    }
  }
  const list = [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(list, null, 2) + "\n");
  console.info("저장:", OUT, `(${list.length}종목)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
