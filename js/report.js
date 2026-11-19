import { sb, boot, app, $, $$, esc, fmt, icon, qs, pct, num, rpcError, csvDownload, reached } from './core.js';
import { analyze, BANDS } from './stats.js';
import { columnChart, ratioBar } from './charts.js';

await boot();
const main = $('#main');
const id = qs('id');

const { data: exam } = await sb.from('exams').select('*').eq('id', id).maybeSingle();
const rep = exam ? await sb.rpc('exam_report', { p_exam: id }) : null;

if (!exam) {
  main.innerHTML = `<div class="sheet empty">${icon('alert', 'big')}<p>找不到這場考試。</p></div>`;
} else if (rep.error) {
  main.innerHTML = `<div class="sheet empty">${icon('lock', 'big')}<p>${esc(rpcError(rep.error))}</p>
    ${exam.release_report_at ? `<p class="muted">公布時間：${fmt(exam.release_report_at)}</p>` : ''}<a class="btn" href="exam.html?id=${id}">回考場</a></div>`;
} else {
  const R = rep.data;
  const A = analyze(R.answers, R.key, R.levels, exam.options);
  const opts = A.options;
  document.title = `${exam.title} 全體分析｜蘇昊數理．會考模擬考`;

  const discTag = (d) => d == null ? '<span class="tag">—</span>'
    : d < 0.2 ? `<span class="tag red">${num(d)}</span>` : d >= 0.4 ? `<span class="tag green">${num(d)}</span>` : `<span class="tag">${num(d)}</span>`;

  main.innerHTML = `
    <section class="sheet">
      <div class="sheet-head"><div><span class="mono muted">${esc(exam.code)}・${esc(exam.subject)}</span><h1 style="margin:.1em 0 0">${esc(exam.title)}<br><small style="font-size:.55em">全體試題分析報告</small></h1></div>
        <div class="btn-row no-print"><button class="btn sm" id="csv">${icon('download')}<span>匯出 CSV</span></button>
        <a class="btn sm ghost" href="exam.html?id=${id}">回考場</a></div></div>
      ${!reached(exam.release_report_at, Date.now()) && app.isAdmin ? `<div class="notice warn">${icon('lock')}<span>管理員預覽：學生要到 ${fmt(exam.release_report_at)} 才看得到。</span></div>` : ''}
      <p class="muted">「通過率」是答對該題的人數比例，數值愈大題目愈簡單。「鑑別度」是點二系列相關（答對者與答錯者總分差距），介於 −1～+1，愈大愈能區分程度，低於 0.20 標紅。分組依本場等級對照表：A 等級為精熟、B 等級為基礎、C 為待加強。所有統計只計入有效作答（作答題數太少、大部分選同一個選項，或被主辦人排除的作答都不列入）。</p>
      <div class="report-top">
        <div class="kpi"><small>有效份數（交卷 ${R.total ?? A.n}・報名 ${R.registered ?? '—'}）</small><b>${A.n}</b><em>${R.total > A.n ? `　排除 ${R.total - A.n} 份無效` : ''}</em></div>
        <div class="kpi"><small>平均得分</small><b>${num(A.mean, 1)}</b><em> / ${A.totalPoints}</em></div>
        <div class="kpi"><small>標準差</small><b>${num(A.sd, 2)}</b></div>
        <div class="kpi"><small>中位數・最高・最低</small><b style="font-size:1.3rem">${num(A.median, 1)}・${A.max ?? '—'}・${A.min ?? '—'}</b></div>
      </div>
    </section>

    <section class="cols-2">
      <div class="sheet">
        <h2>${icon('star')} 各等級人數百分比</h2>
        <div class="table-wrap"><table>
          <thead><tr><th>表現</th><th>等級</th><th class="num">答對題數</th><th class="num">人數</th><th class="num">百分比</th></tr></thead>
          <tbody>${A.levelDist.map((l, i, arr) => {
            const lv = R.levels.find((x) => x.level === l.level);
            const upper = i === 0 ? exam.num_questions : (R.levels.find((x) => x.level === arr[i - 1].level)?.min_correct ?? exam.num_questions + 1) - 1;
            return `<tr><td>${esc(l.band)}</td><td><b>${esc(l.level)}</b></td><td class="num mono">${lv.min_correct}–${upper}</td><td class="num">${l.count}</td><td class="num">${pct(l.ratio, 2)}</td></tr>`;
          }).join('')}</tbody>
          <tfoot>${A.bandDist.map((b) => `<tr><th colspan="3">${b.band}合計</th><th class="num">${b.count}</th><th class="num">${pct(b.ratio, 2)}</th></tr>`).join('')}</tfoot>
        </table></div>
      </div>
      <div class="sheet">
        <h2>${icon('chart')} 得分分布</h2>
        ${columnChart(A.hist.map((h) => ({ label: String(h.x), value: h.count })), { yLabel: '人數', valueFmt: (v) => v + ' 人', height: 320 })}
        <h3 style="margin-top:14px">各單元平均通過率</h3>
        <div class="table-wrap"><table><tbody>${[...A.units].sort((a, b) => a.p - b.p).map((u) => `<tr><td>${esc(u.unit)}</td><td class="num">${u.count} 題</td><td>${ratioBar(u.p)} ${pct(u.p)}</td></tr>`).join('')}</tbody></table></div>
      </div>
    </section>

    <section class="sheet">
      <div class="sheet-head"><h2>${icon('pencil')} 各題通過率與鑑別度</h2>
        <div class="btn-row no-print"><label class="check" style="margin:0"><input type="checkbox" id="byband"> 選項分析依組別展開</label></div></div>
      ${columnChart(A.questions.map((q) => ({ label: String(q.q), value: Math.round((q.p ?? 0) * 100), low: (q.p ?? 0) < 0.4 })), { yLabel: '通過率 %', valueFmt: (v) => v + '%', highlight: (d) => d.low })}
      <p class="muted">紅色長條是通過率低於 40% 的難題。</p>
      <div class="table-wrap tall" id="qtable"></div>
    </section>`;

  const qTable = (expand) => `<table>
    <thead><tr><th class="c">題號</th><th>單元</th><th class="c">正解</th><th class="num">全體</th>${BANDS.map((b) => `<th class="num">${b}</th>`).join('')}<th class="c">鑑別度</th>
      ${expand ? '<th>組別</th>' : ''}${opts.map((o) => `<th class="num">${o === '-' ? '未作答' : o}</th>`).join('')}</tr></thead>
    <tbody>${A.questions.map((q) => {
      const head = (span) => `<td class="c mono" rowspan="${span}">${q.q}</td><td rowspan="${span}">${esc(q.unit || '—')}</td><td class="c mono" rowspan="${span}"><b>${q.key}</b></td>
        <td class="num" rowspan="${span}">${pct(q.p, 1)}</td>${BANDS.map((b) => `<td class="num" rowspan="${span}">${pct(q.byBand[b], 1)}</td>`).join('')}<td class="c" rowspan="${span}">${discTag(q.disc)}</td>`;
      const cells = (d) => opts.map((o) => `<td class="num ${o === q.key ? 'opt-key' : ''}">${pct(d[o], 1)}</td>`).join('');
      if (!expand) return `<tr>${head(1)}${cells(q.dist)}</tr>`;
      return [['全體', q.dist], ...BANDS.map((b) => [b, q.distByBand[b]])].map(([g, d], i) =>
        `<tr>${i === 0 ? head(4) : ''}<td>${g}</td>${cells(d)}</tr>`).join('');
    }).join('')}</tbody></table>`;
  $('#qtable').innerHTML = qTable(false);
  $('#byband').addEventListener('change', (e) => { $('#qtable').innerHTML = qTable(e.target.checked); });

  $('#csv').addEventListener('click', () => {
    const rows = [['題號', '單元', '正解', '全體通過率', ...BANDS.map((b) => b + '通過率'), '鑑別度', ...opts.map((o) => (o === '-' ? '未作答' : o) + '%')]];
    A.questions.forEach((q) => rows.push([q.q, q.unit, q.key, num(q.p, 4), ...BANDS.map((b) => num(q.byBand[b], 4)), num(q.disc, 4), ...opts.map((o) => num(q.dist[o], 4))]));
    rows.push([]);
    rows.push(['等級', '人數', '百分比']);
    A.levelDist.forEach((l) => rows.push([l.level, l.count, num(l.ratio, 4)]));
    csvDownload(`${exam.code}_試題分析.csv`, rows);
  });
}
