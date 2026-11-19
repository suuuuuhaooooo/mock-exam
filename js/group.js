import { sb, boot, app, $, esc, fmt, icon, qs, pct, num, rpcError, csvDownload, loginPrompt, toast } from './core.js';
import { normKey, score, levelOf, bandOf, BANDS } from './stats.js';
import { ratioBar } from './charts.js';

await boot();
const main = $('#main');

if (!app.user) {
  main.innerHTML = `<section class="sheet">${loginPrompt('團體負責人請用登記的 Google 帳號登入')}</section>`;
} else {
  let groups = app.groups;
  if (app.isAdmin) {
    const { data } = await sb.from('groups').select('id, name, code, exam_id, exams(title, release_score_at)').order('created_at', { ascending: false });
    groups = (data || []).map((g) => ({ ...g, exam_title: g.exams?.title, release_score_at: g.exams?.release_score_at }));
  }
  if (!groups.length) {
    main.innerHTML = `<section class="sheet empty">${icon('users', 'big')}<p>你目前沒有負責的團體。<br><span class="muted">請聯絡主辦人，把你的 Google 帳號登記為團體負責人。</span></p></section>`;
  } else {
    const sel = qs('g') || groups[0].id;
    main.innerHTML = `<section class="sheet">
      <div class="sheet-head"><h2>${icon('users')} 團體成績</h2>
        <label class="field" style="margin:0;min-width:280px"><select id="gsel">${groups.map((g) => `<option value="${g.id}" ${g.id === sel ? 'selected' : ''}>${esc(g.exam_title)}｜${esc(g.name)}</option>`).join('')}</select></label></div>
      <div id="gbody"><div class="skeleton"></div></div></section>`;
    $('#gsel').addEventListener('change', (e) => { history.replaceState(null, '', `?g=${e.target.value}`); show(e.target.value); });
    show(sel);
  }
}

async function show(gid) {
  const box = $('#gbody');
  const { data, error } = await sb.rpc('group_results', { p_group: gid });
  if (error) {
    const g = app.groups.find((x) => x.id === gid);
    box.innerHTML = `<div class="empty">${icon('lock', 'big')}<p>${esc(rpcError(error))}</p>${g?.release_score_at ? `<p class="muted">成績公布：${fmt(g.release_score_at)}</p>` : ''}</div>`;
    return;
  }
  const key = normKey(data.key);
  const rows = data.rows.map((r) => {
    if (!r.answers) return { ...r, submitted: false };
    const s = score(r.answers, key);
    const level = levelOf(s.correct, data.levels);
    return { ...r, submitted: true, ...s, level, band: bandOf(level) };
  });
  const done = rows.filter((r) => r.submitted && r.valid !== false).sort((a, b) => b.points - a.points);
  const invalid = rows.filter((r) => r.submitted && r.valid === false);
  done.forEach((r, i) => { r.place = i > 0 && done[i - 1].points === r.points ? done[i - 1].place : i + 1; });
  const avg = done.length ? done.reduce((s, r) => s + r.points, 0) / done.length : null;
  const qRates = key.map((k) => ({ q: k.q, unit: k.unit, p: done.length ? done.filter((r) => r.answers[k.q - 1] === k.a).length / done.length : null }));

  box.innerHTML = `
    <div class="report-top">
      <div class="kpi"><small>團報代碼</small><b class="mono" style="font-size:1.3rem">${esc(data.group.code)}</b></div>
      <div class="kpi"><small>報名・有效交卷${invalid.length ? `・無效 ${invalid.length}` : ''}</small><b>${rows.length}</b><em>・${done.length}</em></div>
      <div class="kpi"><small>團體平均得分</small><b>${num(avg, 1)}</b></div>
      <div class="kpi"><small>精熟・基礎・待加強</small><b style="font-size:1.3rem">${BANDS.map((b) => done.filter((r) => r.band === b).length).join('・')}</b></div>
    </div>
    <div class="btn-row" style="margin-bottom:12px"><button class="btn sm" id="gcsv">${icon('download')}<span>匯出 CSV</span></button></div>
    <div class="table-wrap tall"><table>
      <thead><tr><th class="c">團體名次</th><th>准考證號</th><th>暱稱</th><th>年級</th><th>學校</th><th class="num">答對</th><th class="num">得分</th><th class="c">等級</th></tr></thead>
      <tbody>${[...done, ...invalid, ...rows.filter((r) => !r.submitted)].map((r) => `<tr>
        <td class="c mono">${r.place ?? (r.valid === false ? '<span class="tag red">無效</span>' : '—')}</td><td class="mono">${esc(r.ticket_no)}</td><td>${esc(r.display_name)}</td>
        <td>${esc(r.grade || '')}</td><td>${esc(r.school || '')}</td>
        <td class="num">${r.submitted ? r.correct : '<span class="tag amber">未交卷</span>'}</td>
        <td class="num">${r.submitted ? r.points : ''}</td><td class="c">${esc(r.level || '')}</td></tr>`).join('')}</tbody></table></div>
    <h3 style="margin-top:20px">${icon('chart')} 團體各題通過率</h3>
    <div class="table-wrap tall"><table><thead><tr><th class="c">題號</th><th>單元</th><th>通過率</th></tr></thead>
      <tbody>${qRates.map((q) => `<tr class="${q.p != null && q.p < 0.4 ? 'flag' : ''}"><td class="c mono">${q.q}</td><td>${esc(q.unit || '—')}</td><td>${ratioBar(q.p)} ${pct(q.p)}</td></tr>`).join('')}</tbody></table></div>`;

  $('#gcsv').onclick = () => {
    const out = [['團體名次', '准考證號', '暱稱', '年級', '學校', '答對', '得分', '等級', ...key.map((k) => `Q${k.q}`)]];
    rows.forEach((r) => out.push([r.place ?? '', r.ticket_no, r.display_name, r.grade, r.school, r.correct ?? '', r.points ?? '', r.level ?? '',
      ...key.map((k) => r.answers?.[k.q - 1] ?? '')]));
    csvDownload(`${data.exam.title}_${data.group.name}.csv`, out);
    toast('已匯出');
  };
}
