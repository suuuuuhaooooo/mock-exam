import { sb, boot, app, $, esc, fmt, icon, pct, statusOf, reached, loginPrompt } from './core.js';
import { lineChart } from './charts.js';

await boot();
const main = $('#main');

if (!app.user) {
  main.innerHTML = `<section class="sheet">${loginPrompt('登入後可以查看你參加過的每一場模擬考')}</section>`;
} else {
  const { data, error } = await sb.from('registrations')
    .select('id, ticket_no, registered_at, exam_id, exams(*), submissions(answers, updated_at)')
    .eq('user_id', app.user.id)   // 管理員看得到所有人的報名，這裡只列自己的
    .order('registered_at', { ascending: false });
  const rows = (data || []).filter((r) => r.exams);
  const now = Date.now();

  // 已公布成績的場次，取成績單
  await Promise.all(rows.map(async (r) => {
    r.sub = Array.isArray(r.submissions) ? r.submissions[0] : r.submissions;
    if (r.sub && reached(r.exams.release_score_at, now)) {
      const res = await sb.rpc('my_result', { p_exam: r.exam_id });
      if (!res.error) r.result = res.data;
    }
  }));

  const scored = rows.filter((r) => r.result)
    .sort((a, b) => new Date(a.exams.answer_end || 0) - new Date(b.exams.answer_end || 0));

  main.innerHTML = `
    <section class="sheet">
      <div class="sheet-head"><h2>${icon('history')} 我的紀錄</h2><span class="muted">${esc(app.profile?.display_name || '')}・共 ${rows.length} 場</span></div>
      ${error ? `<div class="notice err">${icon('alert')}<span>${esc(error.message)}</span></div>` : ''}
      ${rows.length ? `<div class="table-wrap"><table>
        <thead><tr><th>考試</th><th>准考證號</th><th>狀態</th><th class="num">答對</th><th class="c">等級</th><th class="num">PR</th><th></th></tr></thead>
        <tbody>${rows.map((r) => {
          const st = statusOf(r.exams, now);
          const res = r.result;
          return `<tr><td><b>${esc(r.exams.title)}</b><br><small class="muted mono">${esc(r.exams.code)}</small></td>
            <td class="mono">${esc(r.ticket_no)}</td>
            <td><span class="badge ${st.tone}">${esc(st.label)}</span>${!r.sub ? '<br><span class="tag amber">未送出答案</span>' : ''}</td>
            <td class="num">${res ? `${res.correct} / ${r.exams.num_questions}` : '—'}</td>
            <td class="c">${res?.level ? `<b>${esc(res.level)}</b>` : '—'}</td>
            <td class="num">${res?.show_rank ? res.pr : '—'}</td>
            <td><a class="btn xs" href="exam.html?id=${r.exam_id}">${res ? '成績單' : '進入'}</a></td></tr>`;
        }).join('')}</tbody></table></div>`
      : `<div class="empty">${icon('ticket', 'big')}<p>你還沒有報名任何考試。</p><a class="btn primary" href="index.html">去看看有哪些考試</a></div>`}
      <p class="muted" style="margin-top:10px">依資料保留政策，部分舊場次的個人作答可能已匿名化，就不會出現在這裡。</p>
    </section>
    ${scored.length ? `<section class="sheet">
      <div class="sheet-head"><h2>${icon('chart')} 成長曲線</h2><span class="muted">答對率（%）</span></div>
      ${lineChart(scored.map((r) => ({ label: r.exams.code, value: r.result.correct / r.exams.num_questions })))}
      ${scored.length >= 2 ? (() => {
        const a = scored[scored.length - 2], b = scored[scored.length - 1];
        const d = b.result.correct / b.exams.num_questions - a.result.correct / a.exams.num_questions;
        return `<p>和上一場相比，答對率 ${d >= 0 ? '進步' : '退步'} <b>${pct(Math.abs(d))}</b>。</p>`;
      })() : ''}
    </section>` : ''}`;
}
