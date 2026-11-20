// 提醒信範本：後台預覽和伺服器寄信用同一套規則
// 伺服器那份在 mock-exam-api 的 supabase/functions/send-reminder/mailtpl.js，兩邊內容要一致

export const MAIL_VARS = [
  ['暱稱', '考生暱稱'],
  ['准考證號', '例如 N3-0012'],
  ['考試名稱', '考試標題'],
  ['考試代碼', '例如 N3'],
  ['登錄開始', '登錄答案開始時間'],
  ['截止時間', '登錄答案截止時間'],
  ['考場連結', '這場考試的考場網址'],
];

export const DEFAULT_MAIL = {
  subject: '【{考試代碼}】提醒你還沒送出答案',
  body: `{暱稱} 你好：

你報名了「{考試名稱}」（准考證號 {准考證號}），目前系統還沒有收到你的答案。

登錄答案截止：{截止時間}
截止後就不能再送出，也不會有成績單。

考場連結：{考場連結}

答案只能送出一次，送出前請再檢查一遍。
如果你已經送出卻收到這封信，或有任何問題，直接回覆這封信就可以。

蘇昊數理．會考模擬考`,
};

const WD = ['日', '一', '二', '三', '四', '五', '六'];
// 一律用台灣時間：2026/11/21（週六）08:58
export function fmtTW(ts) {
  if (!ts) return '未設定';
  const d = new Date(new Date(ts).getTime() + 8 * 3600e3);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}（週${WD[d.getUTCDay()]}）${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export function examUrl(siteUrl, examId) {
  return `${String(siteUrl || '').replace(/\/+$/, '')}/exam.html?id=${examId}`;
}

// 範本變數：{暱稱} 這種寫法；不認得的大括號原樣保留
export function mailVars(exam, reg, siteUrl) {
  return {
    暱稱: reg.display_name || '同學',
    准考證號: reg.ticket_no || '',
    考試名稱: exam.title || '',
    考試代碼: exam.code || '',
    登錄開始: fmtTW(exam.answer_start),
    截止時間: fmtTW(exam.answer_end),
    考場連結: examUrl(siteUrl, exam.id),
  };
}

export function fill(tpl, vars) {
  return String(tpl ?? '').replace(/\{([^{}\s]{1,10})\}/g, (m, k) => (k in vars ? vars[k] : m));
}

// 範本裡打錯的變數名稱（例如 {姓名}），寄出前提醒
export function unknownVars(...tpls) {
  const ok = new Set(MAIL_VARS.map(([k]) => k));
  const bad = new Set();
  for (const t of tpls) for (const [, k] of String(t ?? '').matchAll(/\{([^{}\s]{1,10})\}/g)) if (!ok.has(k)) bad.add(k);
  return [...bad];
}

const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// 信件的 HTML 版本：保留換行，網址變成可以點的連結
export function toHtml(text) {
  const body = escHtml(text)
    .replace(/https?:\/\/[^\s<>"']+/g, (u) => `<a href="${u}" style="color:#1f4f7a">${u}</a>`)
    .replace(/\n/g, '<br>');
  return `<div style="font-family:'PingFang TC','Microsoft JhengHei',sans-serif;font-size:15px;line-height:1.8;color:#23263a;max-width:560px">${body}</div>`;
}
