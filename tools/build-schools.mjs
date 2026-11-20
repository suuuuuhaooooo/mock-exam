// 把教育部「國民中學名錄」「附設國中部名錄」CSV 轉成 js/schools.js
//
// 用法（在 repo 根目錄）：
//   node tools/build-schools.mjs 國民中學名錄.csv 附設國中部名錄.csv
//
// CSV 從政府資料開放平臺下載（每學年更新一次）：
//   國民中學名錄   https://data.gov.tw/dataset/6088
//   附設國中部名錄  在上面那頁的「相關資料集」
// 檔案是 UTF-8 或 Big5 都可以。

import { readFileSync, writeFileSync } from 'node:fs';

const COUNTIES = ['臺北市', '新北市', '基隆市', '桃園市', '新竹市', '新竹縣', '苗栗縣', '臺中市', '彰化縣', '南投縣', '雲林縣',
  '嘉義市', '嘉義縣', '臺南市', '高雄市', '屏東縣', '宜蘭縣', '花蓮縣', '臺東縣', '澎湖縣', '金門縣', '連江縣'];

function decode(buf) {
  const utf8 = new TextDecoder('utf-8').decode(buf);
  if (!utf8.includes('�')) return utf8;
  return new TextDecoder('big5').decode(buf);
}

function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

const norm = (s) => String(s ?? '').replace(/^﻿/, '').trim();
const fixTai = (s) => s.replace(/台/g, '臺');

function countyOf(raw, addr) {
  const s = fixTai(norm(raw).replace(/^\[?\d+\]?\s*/, ''));
  const hit = COUNTIES.find((c) => s.includes(c));
  if (hit) return hit;
  const a = fixTai(norm(addr).replace(/^\[\d+\]/, ''));
  return COUNTIES.find((c) => a.startsWith(c) || a.includes(c)) || '';
}

const all = new Map();
const years = new Set();
for (const file of process.argv.slice(2)) {
  const rows = parseCsv(decode(readFileSync(file)));
  const head = rows[0].map(norm);
  const col = (...names) => head.findIndex((h) => names.some((n) => h.includes(n)));
  const iCode = col('代碼'), iName = col('學校名稱'), iCounty = col('縣市'), iAddr = col('地址'), iYear = col('學年');
  if (iCode < 0 || iName < 0) { console.error(`${file}：找不到「代碼」或「學校名稱」欄位，表頭是 ${head.join(',')}`); process.exit(1); }
  // 檔案裡有多個學年時，只取最新的
  const latest = iYear >= 0 ? Math.max(...rows.slice(1).map((r) => +norm(r[iYear]) || 0)) : 0;
  let n = 0;
  for (const r of rows.slice(1)) {
    if (iYear >= 0 && latest && (+norm(r[iYear]) || 0) !== latest) continue;
    const code = norm(r[iCode]), name = fixTai(norm(r[iName]));
    if (!code || !name || !/^[0-9A-Za-z]{1,10}$/.test(code)) continue;
    const county = countyOf(iCounty >= 0 ? r[iCounty] : '', iAddr >= 0 ? r[iAddr] : '');
    if (!county) { console.warn(`略過（看不出縣市）：${code} ${name}`); continue; }
    all.set(code, { code, name, county });
    n++;
  }
  if (latest) years.add(latest);
  console.log(`${file}：${n} 所${latest ? `（${latest} 學年）` : ''}`);
}
if (!all.size) { console.error('沒有讀到任何學校'); process.exit(1); }

// 存到資料庫的完整校名：「市立大安國中」→「臺北市立大安國中」；國立、私立在後面加縣市
function fullName(s) {
  const { name, county } = s;
  if (name.startsWith(county)) return name;
  if (/^[市縣]立/.test(name) && county.endsWith(name[0])) return county + name.slice(1);
  return `${name}（${county}）`;
}

const out = COUNTIES.map((c) => [c, [...all.values()].filter((s) => s.county === c)
  .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant-TW'))
  .map((s) => [s.code, s.name, fullName(s)])]).filter(([, l]) => l.length);

const yearTxt = [...years].sort().join('、');
writeFileSync(new URL('../js/schools.js', import.meta.url), `// 全台國中名錄（含高中附設國中部），由 tools/build-schools.mjs 產生，請勿手動修改
// 資料來源：教育部統計處，政府資料開放平臺（政府資料開放授權條款－第1版）${yearTxt ? `，${yearTxt} 學年` : ''}
// 格式：[縣市, [[學校代碼, 選單顯示名稱, 存檔用完整校名], ...]]
export const SCHOOLS_YEAR = ${JSON.stringify(yearTxt || null)};
export const SCHOOLS = ${JSON.stringify(out)};
`);
console.log(`完成：${all.size} 所，寫入 js/schools.js`);
