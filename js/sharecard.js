// 成績分享圖：1080×1920 直式（限動／Threads 尺寸）
// 只放考試名稱、等級、答對題數、得分、PR、作答對錯格；不放 email、暱稱、學校、准考證號。

import { SITE_NAME, AUTHOR } from './config.js';

const W = 1080, H = 1920;
const C = {
  paper: '#f5f1e6', sheet: '#fffdf7', ink: '#23263a', ink2: '#4a4e63', muted: '#7b7d8c',
  rule: '#d9d2bf', grid: 'rgba(60,80,140,.08)', stamp: '#c4432d', line: '#d4627a',
  ok: '#2f7a4d', okSoft: '#e1f0e5', blank: '#e8e3d4',
};
const SERIF = '"Noto Serif TC", "Songti TC", serif';
const SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

export const bandOfLevel = (lv) => (!lv ? '' : lv[0] === 'A' ? '精熟' : lv[0] === 'B' ? '基礎' : '待加強');
export const siteURL = () => location.origin + location.pathname.replace(/[^/]*$/, '');

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 依寬度換行（中文逐字切）
function wrap(ctx, text, maxW, maxLines) {
  const lines = [];
  let cur = '';
  for (const ch of String(text)) {
    if (ctx.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; }
    else cur += ch;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (ctx.measureText(last + '…').width > maxW && last) last = last.slice(0, -1);
    lines[maxLines - 1] = last + '…';
  }
  return lines;
}

// Google Fonts 用 unicode-range 分片載入，canvas 要先指定實際用到的字才會下載
async function loadFonts(texts) {
  if (!document.fonts?.load) return;
  const t = texts.join('');
  await Promise.allSettled([
    document.fonts.load(`900 100px ${SERIF}`, t),
    document.fonts.load(`700 40px ${SERIF}`, t),
    document.fonts.load(`500 40px ${SANS}`, t),
    document.fonts.load(`700 40px ${SANS}`, t),
    document.fonts.load(`600 40px ${MONO}`, '0123456789/%PR'),
  ]);
}

/**
 * @param {object} exam    exams 列
 * @param {object} r       my_result 回傳（correct, points, total_points, level, show_rank, pr, n, questions）
 * @returns {Promise<Blob>}
 */
export async function drawShareCard(exam, r) {
  const band = bandOfLevel(r.level);
  const url = siteURL().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const threads = '@' + (AUTHOR.threads.split('@').pop() || '');
  const texts = [SITE_NAME, exam.title, band, '答對題數得分百分等級作答紀錄正確錯誤未答你也來挑戰下一場模擬考追蹤公布消息成績單等級', url, threads, exam.code || ''];
  await loadFonts(texts);

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.textBaseline = 'alphabetic';

  // 底：方格紙
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.grid; ctx.lineWidth = 2;
  for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // 成績單紙張（墨線框＋位移陰影，跟網站一致）
  const X = 80, Y = 150, SW = W - 160, SH = 1560;
  ctx.fillStyle = C.ink; roundRect(ctx, X + 16, Y + 16, SW, SH, 28); ctx.fill();
  ctx.fillStyle = C.sheet; roundRect(ctx, X, Y, SW, SH, 28); ctx.fill();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 5; roundRect(ctx, X, Y, SW, SH, 28); ctx.stroke();

  // 頂端：網站名
  ctx.fillStyle = C.ink;
  ctx.font = `700 40px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.fillText(SITE_NAME, W / 2, 98);

  const cx = W / 2, inner = SW - 120;

  // 標題列：成績單＋粉紅雙線（答案卡風格）
  ctx.fillStyle = C.line;
  ctx.font = `900 46px ${SERIF}`;
  ctx.fillText('成　績　單', cx, Y + 100);
  ctx.strokeStyle = C.line; ctx.lineWidth = 3;
  [Y + 128, Y + 138].forEach((yy) => { ctx.beginPath(); ctx.moveTo(X + 60, yy); ctx.lineTo(X + SW - 60, yy); ctx.stroke(); });

  // 考試名稱
  ctx.fillStyle = C.ink;
  ctx.font = `900 62px ${SERIF}`;
  const titleLines = wrap(ctx, exam.title, inner, 2);
  titleLines.forEach((l, i) => ctx.fillText(l, cx, Y + 230 + i * 80));
  let y = Y + 230 + (titleLines.length - 1) * 80;
  if (exam.code) {
    ctx.fillStyle = C.muted; ctx.font = `600 32px ${MONO}`;
    ctx.fillText(exam.code, cx, y + 60);
  }
  y += 100;

  // 等級章
  const sy = y + 250, R = 220;
  ctx.save();
  ctx.translate(cx, sy);
  ctx.rotate(-10 * Math.PI / 180);
  ctx.strokeStyle = C.stamp; ctx.fillStyle = C.stamp;
  ctx.globalAlpha = 0.93;
  ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, R - 24, 0, Math.PI * 2); ctx.stroke();
  ctx.textAlign = 'center';
  if (r.level) {
    let fs = 190;
    ctx.font = `900 ${fs}px ${SERIF}`;
    while (ctx.measureText(r.level).width > R * 1.55 && fs > 80) { fs -= 8; ctx.font = `900 ${fs}px ${SERIF}`; }
    ctx.fillText(r.level, 0, 40);
    ctx.font = `700 58px ${SERIF}`;
    ctx.fillText(band.split('').join(' '), 0, 130);
  } else {
    ctx.font = `900 90px ${SERIF}`;
    ctx.fillText(`${r.correct}`, 0, 30);
    ctx.font = `700 46px ${SERIF}`;
    ctx.fillText('題答對', 0, 110);
  }
  ctx.restore();
  y = sy + R + 70;

  // 數字三格
  // 每題 1 分時「得分」跟「答對題數」一樣，就不重複放
  const weighted = Number(r.total_points) !== Number(exam.num_questions) || Number(r.points) !== Number(r.correct);
  const boxes = [{ k: '答對題數', v: String(r.correct), s: `/ ${exam.num_questions}` }];
  if (weighted) boxes.push({ k: '得分', v: String(Number(r.points)), s: `/ ${Number(r.total_points)}` });
  if (r.show_rank && r.pr != null) boxes.push({ k: '百分等級', v: `PR ${r.pr}`, s: '' });
  if (boxes.length < 2 && band) boxes.push({ k: '等級', v: band, s: '' });
  const gap = 24, bw = (inner - gap * (boxes.length - 1)) / boxes.length, bh = 190;
  boxes.forEach((b, i) => {
    const bx = X + 60 + i * (bw + gap);
    ctx.fillStyle = '#fbf8f0'; roundRect(ctx, bx, y, bw, bh, 18); ctx.fill();
    ctx.strokeStyle = C.rule; ctx.lineWidth = 3; roundRect(ctx, bx, y, bw, bh, 18); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = C.muted; ctx.font = `500 32px ${SANS}`;
    ctx.fillText(b.k, bx + bw / 2, y + 52);
    ctx.fillStyle = C.ink;
    let fs = 72;
    const isNum = /^[\d.]+$/.test(b.v) || b.v.startsWith('PR');
    const face = isNum ? MONO : SERIF;
    ctx.font = `${isNum ? 600 : 900} ${fs}px ${face}`;
    const full = () => ctx.measureText(b.v).width + (b.s ? 12 + b.s.length * 20 : 0);
    while (full() > bw - 30 && fs > 40) { fs -= 4; ctx.font = `${isNum ? 600 : 900} ${fs}px ${face}`; }
    const vFont = ctx.font;
    const vw = ctx.measureText(b.v).width;
    let sw = 0;
    if (b.s) { ctx.font = `600 32px ${MONO}`; sw = ctx.measureText(b.s).width + 12; ctx.font = vFont; }
    const startX = bx + bw / 2 - (vw + sw) / 2;
    ctx.textAlign = 'left';
    ctx.fillText(b.v, startX, y + 142);
    if (b.s) { ctx.fillStyle = C.muted; ctx.font = `600 32px ${MONO}`; ctx.fillText(b.s, startX + vw + 12, y + 142); }
  });
  y += bh + 80;

  // 作答紀錄格：綠＝對、紅框＝錯、灰＝未答
  const qs = (r.questions || []).slice().sort((a, b) => a.q_no - b.q_no);
  if (qs.length) {
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ink2; ctx.font = `700 34px ${SANS}`;
    ctx.fillText('作答紀錄', X + 60, y);
    // 圖例
    const legend = [['正確', 'ok'], ['錯誤', 'bad'], ['未答', 'blank']];
    ctx.font = `500 26px ${SANS}`;
    let lx = X + SW - 60;
    for (let i = legend.length - 1; i >= 0; i--) {
      const [t, kind] = legend[i];
      const tw = ctx.measureText(t).width;
      lx -= tw; ctx.fillStyle = C.muted; ctx.fillText(t, lx, y - 2);
      lx -= 34; cell(ctx, lx, y - 26, 24, kind); lx -= 24;
    }
    y += 30;
    const perRow = qs.length <= 30 ? 15 : 18;
    const cg = 10, cs = Math.min(44, (inner - cg * (perRow - 1)) / perRow);
    const rowW = perRow * cs + (perRow - 1) * cg;
    const ox = X + 60 + (inner - rowW) / 2;
    const rows = Math.ceil(qs.length / perRow);
    const maxRows = Math.floor((Y + SH - 60 - y) / (cs + cg));
    qs.slice(0, Math.min(rows, maxRows) * perRow).forEach((q, i) => {
      const kind = q.mine === '-' || !q.mine ? 'blank' : q.mine === q.answer ? 'ok' : 'bad';
      cell(ctx, ox + (i % perRow) * (cs + cg), y + Math.floor(i / perRow) * (cs + cg), cs, kind);
    });
  }

  // 紙張底部：邀請
  ctx.textAlign = 'center';
  ctx.fillStyle = C.ink; ctx.font = `900 44px ${SERIF}`;
  ctx.fillText('你也來挑戰下一場模擬考', cx, Y + SH - 92);
  ctx.fillStyle = C.muted; ctx.font = `500 30px ${SANS}`;
  ctx.fillText('考試頁面與公布消息見下方', cx, Y + SH - 44);

  // 紙外底部：網址、Threads
  ctx.fillStyle = C.ink; ctx.font = `600 36px ${MONO}`;
  let fsu = 36;
  while (ctx.measureText(url).width > W - 120 && fsu > 22) { fsu -= 2; ctx.font = `600 ${fsu}px ${MONO}`; }
  ctx.fillText(url, cx, H - 110);
  ctx.fillStyle = C.ink2; ctx.font = `500 32px ${SANS}`;
  ctx.fillText(`追蹤 Threads ${threads}`, cx, H - 60);

  return new Promise((res) => cv.toBlob(res, 'image/png'));
}

function cell(ctx, x, y, s, kind) {
  const r = Math.max(4, s * 0.22);
  if (kind === 'ok') {
    ctx.fillStyle = C.ok; roundRect(ctx, x, y, s, s, r); ctx.fill();
  } else if (kind === 'bad') {
    ctx.fillStyle = '#f6e1da'; roundRect(ctx, x, y, s, s, r); ctx.fill();
    ctx.strokeStyle = C.stamp; ctx.lineWidth = Math.max(2, s * 0.08); roundRect(ctx, x + 1, y + 1, s - 2, s - 2, r); ctx.stroke();
  } else {
    ctx.fillStyle = C.blank; roundRect(ctx, x, y, s, s, r); ctx.fill();
  }
}
