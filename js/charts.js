// 簡單的 SVG 圖表（配色跟著主題的 CSS 變數）
import { esc } from './core.js';

/** 直條圖：items = [{label, value, note}] */
export function columnChart(items, { height = 200, yLabel = '', valueFmt = (v) => v, highlight = null } = {}) {
  const W = 640, H = height, L = 40, B = 28, T = 14;
  const max = Math.max(1, ...items.map((d) => d.value));
  const bw = (W - L - 10) / items.length;
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const ticks = 4;
  let g = '';
  for (let i = 0; i <= ticks; i++) {
    const v = (max * i) / ticks, yy = y(v);
    g += `<line x1="${L}" x2="${W - 6}" y1="${yy}" y2="${yy}" class="grid"/>
          <text x="${L - 6}" y="${yy + 4}" text-anchor="end" class="tick">${Math.round(v)}</text>`;
  }
  const every = Math.ceil(items.length / 25);
  const bars = items.map((d, i) => {
    const x = L + i * bw + bw * 0.14, w = bw * 0.72, yy = y(d.value);
    const hl = highlight != null && highlight(d) ? ' hl' : '';
    return `<rect x="${x}" y="${yy}" width="${w}" height="${Math.max(0, H - B - yy)}" rx="2" class="bar${hl}"><title>${esc(d.label)}：${esc(valueFmt(d.value))}</title></rect>
      ${i % every === 0 ? `<text x="${x + w / 2}" y="${H - B + 15}" text-anchor="middle" class="tick">${esc(d.label)}</text>` : ''}`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMid meet" role="img">
    ${g}<line x1="${L}" x2="${W - 6}" y1="${H - B}" y2="${H - B}" class="axis"/>${bars}
    ${yLabel ? `<text x="4" y="10" class="tick">${esc(yLabel)}</text>` : ''}</svg>`;
}

/** 比例長條（0～1），可疊第二條做比較 */
export function ratioBar(v, compare = null) {
  const w = (x) => Math.max(0, Math.min(1, x ?? 0)) * 100;
  return `<span class="rbar"><span class="rbar-fill" style="width:${w(v)}%"></span>${
    compare != null ? `<span class="rbar-mark" style="left:${w(compare)}%" title="全體 ${(compare * 100).toFixed(0)}%"></span>` : ''}</span>`;
}

/** 折線圖：points = [{label, value(0~1)}] */
export function lineChart(points, { height = 180 } = {}) {
  if (!points.length) return '';
  const W = Math.max(320, points.length * 80), H = height, L = 36, B = 30, T = 14, R = 20;
  const x = (i) => (points.length === 1 ? (L + W - R) / 2 : L + ((W - L - R) * i) / (points.length - 1));
  const y = (v) => T + (H - T - B) * (1 - v);
  let g = '';
  [0, 0.25, 0.5, 0.75, 1].forEach((v) => {
    g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="tick">${v * 100}</text>`;
  });
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ');
  const dots = points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.value)}" r="4.5" class="dot"><title>${esc(p.label)}：${(p.value * 100).toFixed(0)}%</title></circle>
    <text x="${x(i)}" y="${H - 10}" text-anchor="middle" class="tick">${esc(p.label)}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMid meet">${g}<path d="${path}" class="line"/>${dots}</svg>`;
}
