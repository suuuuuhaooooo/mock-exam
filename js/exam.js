import {
  sb, boot, app, $, $$, esc, fmt, icon, qs, toast, modal, rpcError, pct, printSection,
  timelineHTML, reached, within, statusOf, nextMilestone, countdown, loginPrompt, LOGO,
} from './core.js';
import { unitCompare, validity } from './stats.js';
import { ratioBar } from './charts.js';
import { downloadICS, googleCalendarURL } from './ics.js';
import { drawShareCard } from './sharecard.js';

await boot();
const main = $('#main');
const id = qs('id');

let exam, state, offset = 0, answers = '', dirty = false, result = null, board = null;
const now = () => Date.now() + offset;
const draftKey = () => `me-draft-${id}-${app.user?.id}`;

async function load() {
  const { data, error } = await sb.from('exams').select('*').eq('id', id).maybeSingle();
  if (error || !data) {
    main.innerHTML = `<div class="sheet empty">${icon('alert', 'big')}<p>找不到這場考試。</p><a class="btn" href="index.html">回考試總覽</a></div>`;
    return false;
  }
  exam = data;
  const s = await sb.rpc('my_exam_state', { p_exam: id });
  if (s.error) { toast(rpcError(s.error), 'error'); return false; }
  state = s.data;
  offset = new Date(state.server_now).getTime() - Date.now();
  answers = state.submission?.answers || '-'.repeat(exam.num_questions);
  try {
    const d = localStorage.getItem(draftKey());
    if (d && d.length === exam.num_questions && canAnswer() && d !== answers) { answers = d; dirty = true; }
    else if (d && (state.submission || reached(exam.answer_end, now()))) localStorage.removeItem(draftKey());   // 已送出或已截止就清掉草稿
  } catch {}

  result = null; board = null;
  if (state.submission && reached(exam.release_score_at, now())) {
    const r = await sb.rpc('my_result', { p_exam: id });
    if (!r.error) result = r.data;
  }
  if (['board', 'both'].includes(exam.rank_mode) && reached(exam.release_rank_at, now())) {
    const b = await sb.rpc('leaderboard', { p_exam: id });
    if (!b.error) board = b.data;
  }
  return true;
}

const canRegister = () => within(exam.register_start, exam.register_end, now());
// 只能送出一次：送出過就不能再劃記
const canAnswer = () => !!state?.registration && !state.submission && within(exam.answer_start, exam.answer_end, now());

function render() {
  const t = now();
  const st = statusOf(exam, t);
  const nx = nextMilestone(exam, t);
  document.title = `${exam.title}｜蘇昊數理．會考模擬考`;
  main.innerHTML = `
    <section class="sheet">
      <div class="sheet-head">
        <div>
          <span class="mono muted">${esc(exam.code)}・${esc(exam.subject)}・${exam.num_questions} 題・選項 ${esc(exam.options.split('').join(' '))}</span>
          <h1 style="margin:.1em 0 .2em">${esc(exam.title)}</h1>
          <span class="badge ${st.tone}">${esc(st.label)}</span>
          ${exam.status === 'draft' ? '<span class="badge draft">草稿（只有管理員看得到）</span>' : ''}
        </div>
        ${nx ? `<div class="kpi"><small>下一階段・${esc(nx.label)}</small><b style="font-size:1.25rem">${countdown(nx.t, t)}</b><em>${fmt(new Date(nx.t))}</em></div>` : ''}
      </div>
      ${exam.description ? `<p>${esc(exam.description).replace(/\n/g, '<br>')}</p>` : ''}
      ${timelineHTML(exam, t)}
    </section>
    ${!app.user ? `<section class="sheet">${loginPrompt('登入後即可報名、登錄答案與查看成績單')}</section>` : ''}
    ${app.user ? registrationHTML() : ''}
    ${linksHTML()}
    ${app.user && state.registration ? answerCardHTML() : ''}
    ${result ? resultHTML() : scoreWaitHTML()}
    ${board ? boardHTML() : ''}`;
  bind();
}

function registrationHTML() {
  const r = state.registration;
  if (r) {
    const p = app.profile || {};
    return `<section class="sheet" id="ticket-sec">
      <div class="sheet-head no-print"><h2>${icon('ticket')} 准考證</h2>
        <div class="btn-row">
          <button class="btn sm" id="cal-ics">${icon('calendar')}<span>加入行事曆</span></button>
          ${exam.answer_end ? `<a class="btn sm ghost" id="cal-google" target="_blank" rel="noopener">${icon('bell')}<span>Google 日曆提醒截止</span></a>` : ''}
          <button class="btn sm" id="print-ticket">${icon('printer')}<span>列印准考證</span></button>
        </div></div>
      <div class="ticket">
        <dl>
          <dt>考試</dt><dd>${esc(exam.title)}</dd>
          <dt>准考證號</dt><dd class="tno">${esc(r.ticket_no)}</dd>
          <dt>暱稱</dt><dd>${esc(p.display_name || '')}</dd>
          ${p.grade ? `<dt>年級</dt><dd>${esc(p.grade)}</dd>` : ''}
          ${p.school ? `<dt>學校</dt><dd>${esc(p.school)}</dd>` : ''}
          ${r.group_name ? `<dt>團體</dt><dd>${esc(r.group_name)}</dd>` : ''}
          <dt>登錄答案</dt><dd>${fmt(exam.answer_start)} ～ ${fmt(exam.answer_end)}</dd>
          <dt>成績公布</dt><dd>${fmt(exam.release_score_at)}</dd>
        </dl>
        <div class="seal">蘇昊數理<br>模擬考<br>${esc(exam.code)}</div>
      </div>
      <p class="muted no-print" style="margin-top:10px">報名時間：${fmt(r.registered_at)}</p>
      <p class="muted no-print" style="font-size:.85rem">「加入行事曆」會把題本開放、登錄答案截止（前 1 天和前 2 小時提醒）、成績公布等時間一次存進手機行事曆。在 Threads／IG 裡打開網頁如果下載不了，請點右上角改用 Safari 或 Chrome 開啟。</p>
    </section>`;
  }
  if (canRegister()) {
    return `<section class="sheet">
      <div class="sheet-head"><h2>${icon('pencil')} 報名</h2><span class="muted">報名截止：${fmt(exam.register_end)}</span></div>
      <p>報名後會自動產生准考證號，登錄答案和查看成績都需要它。${exam.capacity ? `本場名額 ${exam.capacity} 人，額滿為止。` : ''}</p>
      ${rulesHTML()}
      ${exam.group_enabled ? `<label class="field" style="max-width:320px"><span>團報代碼（跟補習班或老師一起報名才需要填）</span><input id="gcode" maxlength="12" placeholder="例如 AB12CD"></label>` : ''}
      <button class="btn primary" id="reg-btn">${icon('ticket')}<span>確認報名</span></button>
    </section>`;
  }
  return `<section class="sheet"><div class="notice warn">${icon('clock')}<span>${
    reached(exam.register_end, now()) ? '報名已截止，你沒有報名這場考試。' : `報名將於 ${fmt(exam.register_start)} 開放。`}</span></div></section>`;
}

function linksHTML() {
  const items = [];
  if (state.booklet_url) items.push(`<a class="btn" href="${esc(state.booklet_url)}" target="_blank" rel="noopener">${icon('book')}<span>下載題本</span></a>`);
  if (state.solution_url) items.push(`<a class="btn" href="${esc(state.solution_url)}" target="_blank" rel="noopener">${icon('link')}<span>詳解</span></a>`);
  if (reached(exam.release_report_at, now()) || app.isAdmin) items.push(`<a class="btn" href="report.html?id=${exam.id}">${icon('chart')}<span>全體分析報告</span></a>`);
  const locked = [];
  if (!state.booklet_url && exam.exam_start && !reached(exam.exam_start, now())) locked.push(`題本 ${fmt(exam.exam_start, false)}`);
  if (!state.solution_url && exam.release_solution_at && !reached(exam.release_solution_at, now())) locked.push(`詳解 ${fmt(exam.release_solution_at, false)}`);
  if (exam.release_report_at && !reached(exam.release_report_at, now())) locked.push(`全體分析 ${fmt(exam.release_report_at, false)}`);
  // 題本、詳解只給有報名的考生（後端也只回傳給報名者）
  const regOnly = !state.registration && !app.isAdmin && (exam.exam_start || exam.release_solution_at)
    ? `<div class="notice warn" style="margin-top:12px">${icon('lock')}<span>題本與詳解只開放給<b>已報名</b>的考生下載${
        !app.user ? '，請先登入並報名。' : canRegister() ? '，請先完成上方報名。' : '。'}</span></div>` : '';
  if (!items.length && !locked.length && !regOnly) return '';
  return `<section class="sheet"><div class="sheet-head"><h2>${icon('book')} 題本與資料</h2></div>
    ${items.length ? `<div class="btn-row">${items.join('')}</div>` : ''}
    ${locked.length ? `<p class="muted" style="margin:12px 0 0">${icon('lock')} 尚未開放：${locked.map(esc).join('、')}</p>` : ''}
    ${regOnly}</section>`;
}

function answerCardHTML() {
  const editable = canAnswer();
  const key = state.key ? Object.fromEntries(state.key.map((k) => [k.q_no, k.answer])) : null;
  const opts = exam.options.split('');
  const n = exam.num_questions;
  const blocks = [];
  for (let b = 0; b < n; b += 5) {
    let rows = '';
    for (let q = b + 1; q <= Math.min(n, b + 5); q++) {
      const mine = answers[q - 1];
      const k = key?.[q];
      const cls = k ? (mine === k ? 'right' : 'wrong') : '';
      rows += `<div class="arow ${cls}" data-q="${q}"><span class="qn">${q}</span>
        ${opts.map((o) => `<button class="bub ${mine === o ? 'on' : ''} ${k === o ? 'key' : ''} ${k && mine === o && k !== o ? 'wrong' : ''}"
          data-o="${o}" ${editable ? '' : 'disabled'} aria-label="第${q}題 ${o}">${o}</button>`).join('')}
        <span class="mk">${k ? icon(mine === k ? 'check' : 'cross') : ''}</span></div>`;
    }
    blocks.push(`<div class="ablock">${rows}</div>`);
  }
  const answered = [...answers].filter((c) => c !== '-').length;
  let tip = '';
  if (editable) tip = `<div class="notice">${icon('pencil')}<span>點選泡泡劃記，再點一次可以取消。答案<b>只能送出一次</b>，送出後就不能修改，請檢查完再按「送出答案」。截止時間：${fmt(exam.answer_end)}。</span></div>${rulesHTML()}`;
  else if (!reached(exam.answer_start, now())) tip = `<div class="notice warn">${icon('clock')}<span>答案登錄將於 ${fmt(exam.answer_start)} 開放。</span></div>`;
  else if (!state.submission) tip = `<div class="notice err">${icon('alert')}<span>答案登錄已截止，你沒有送出答案。</span></div>`;
  else tip = `<div class="notice ok">${icon('check')}<span>${reached(exam.answer_end, now()) ? '已截止。' : ''}你已在 ${fmt(state.submission.updated_at)} 送出答案，不能再修改。${key ? '綠框是正解。' : `正解將於 ${fmt(exam.release_key_at)} 公布。`}</span></div>`;
  return `<section class="sheet">
    <div class="sheet-head"><h2>${icon('pencil')} 答案卡</h2>
      ${state.submission ? `<span class="muted">送出時間：${fmt(state.submission.updated_at)}</span>` : ''}</div>
    ${tip}
    <div class="acard">
      <div class="acard-head"><span>國中教育會考模擬考　答案卡</span><span class="mono">${esc(state.registration.ticket_no)}</span></div>
      <div class="acard-grid">${blocks.join('')}</div>
    </div>
    ${editable ? `<div class="acard-foot">
      <span class="progress">${dirty ? '<span class="dirty-dot"></span>尚未送出・' : ''}已作答 ${answered} / ${n} 題</span>
      <div class="btn-row"><button class="btn ghost" id="clear-btn">${icon('trash')}<span>全部清除</span></button>
      <button class="btn primary" id="save-btn">${icon('check')}<span>送出答案</span></button></div></div>` : ''}
  </section>`;
}

function rulesHTML() {
  const r = [];
  if (exam.min_answered) r.push(`至少作答 ${exam.min_answered} 題`);
  if (exam.max_same_ratio) r.push(`同一個選項不超過 ${Math.round(exam.max_same_ratio * 100)}%`);
  r.push('一人一個帳號');
  return `<p class="muted">${icon('shield')} 有效作答規則：${r.join('、')}。不符合的作答不列入全體統計、百分等級和排行榜。</p>`;
}

function scoreWaitHTML() {
  if (!app.user || !state.registration) return '';
  if (!state.submission) return '';
  if (reached(exam.release_score_at, now())) return '';
  return `<section class="sheet empty">${icon('lock', 'big')}<p>成績單將於 <b>${fmt(exam.release_score_at)}</b> 公布<br><span class="muted">還有 ${countdown(exam.release_score_at, now())}</span></p></section>`;
}

function resultHTML() {
  const r = result;
  const units = unitCompare(r.questions).sort((a, b) => (a.mineRate - a.allRate) - (b.mineRate - b.allRate));
  const band = !r.level ? '' : r.level[0] === 'A' ? '精熟' : r.level[0] === 'B' ? '基礎' : '待加強';
  const p = app.profile || {};
  const diag = (q) => {
    const ok = q.mine === q.answer, pr = Number(q.pass_rate);
    if (!ok && pr >= 0.7) return '<span class="tag red">失分警示</span>';
    if (ok && pr < 0.4) return '<span class="tag green">答對難題</span>';
    if (!ok && q.mine === '-') return '<span class="tag amber">未作答</span>';
    return '';
  };
  return `<section class="sheet" id="result-sec">
    <div class="sheet-head"><h2>${icon('star')} 個人成績單</h2>
      <div class="btn-row no-print">
        ${r.valid !== false ? `<button class="btn sm primary" id="share-result">${icon('share')}<span>產生分享圖</span></button>` : ''}
        <button class="btn sm" id="print-result">${icon('printer')}<span>列印成績單</span></button>
      </div></div>
    <div class="btn-row" style="justify-content:space-between;margin-bottom:14px">
      <div style="display:flex;gap:10px;align-items:center">${LOGO}<div><b style="font-family:var(--serif)">${esc(exam.title)}</b><br>
        <span class="muted mono">${esc(state.registration.ticket_no)}・${esc(p.display_name || '')}${p.school ? '・' + esc(p.school) : ''}</span></div></div>
    </div>
    ${r.valid === false ? `<div class="notice err">${icon('alert')}<span>這份作答判定為<b>無效作答</b>${r.exclude_reason ? `（${esc(r.exclude_reason)}）` : '（作答題數太少，或大部分選同一個選項）'}，不列入全體統計、百分等級和排行榜。下面的成績僅供參考。</span></div>` : ''}
    <div class="report-top">
      <div class="kpi"><small>答對題數</small><b>${r.correct}</b><em> / ${exam.num_questions}</em></div>
      <div class="kpi"><small>得分</small><b>${Number(r.points)}</b><em> / ${Number(r.total_points)}</em></div>
      <div class="kpi"><small>${r.show_rank ? `百分等級 PR（${r.n} 人應考）` : '排名'}</small>
        ${r.show_rank ? `<b>${r.pr}</b><em>　第 ${r.rank} 名</em>` : `<b style="font-size:1rem">${exam.rank_mode === 'none' ? '本場不公布' : exam.rank_mode === 'board' ? '請見排行榜' : '於 ' + fmt(exam.release_rank_at, false) + ' 公布'}</b>`}</div>
      <div class="kpi stamp">${r.level ? `<div class="level-stamp"><span>${esc(r.level)}</span><small>${band}</small></div>` : '<small>未設定等級</small>'}</div>
    </div>

    <h3>${icon('chart')} 單元分析</h3>
    <p class="muted">藍條是你的答對率，紅線是全體平均。排在最上面的單元是你和全體差距最大的地方，最優先複習。</p>
    <div class="table-wrap"><table>
      <thead><tr><th>單元</th><th class="num">題數</th><th class="num">你答對</th><th>答對率（紅線＝全體）</th><th class="num">全體</th><th>判讀</th></tr></thead>
      <tbody>${units.map((u) => {
        const gap = u.mineRate - u.allRate;
        return `<tr><td>${esc(u.unit)}</td><td class="num">${u.count}</td><td class="num">${u.mine}</td>
          <td>${ratioBar(u.mineRate, u.allRate)} ${pct(u.mineRate)}</td><td class="num">${pct(u.allRate)}</td>
          <td>${gap <= -0.15 ? '<span class="tag red">優先加強</span>' : gap >= 0.15 ? '<span class="tag green">優勢單元</span>' : '<span class="tag">與全體相當</span>'}</td></tr>`;
      }).join('')}</tbody></table></div>

    <h3 style="margin-top:22px">${icon('pencil')} 逐題診斷</h3>
    <div class="table-wrap tall"><table>
      <thead><tr><th class="c">題號</th><th>單元</th><th class="c">你的答案</th><th class="c">正解</th><th class="c">對錯</th><th>全體通過率</th><th>提醒</th></tr></thead>
      <tbody>${r.questions.map((q) => {
        const ok = q.mine === q.answer;
        return `<tr class="${!ok && Number(q.pass_rate) >= 0.7 ? 'flag' : ''}"><td class="c mono">${q.q_no}</td><td>${esc(q.unit || '—')}</td>
          <td class="c mono">${q.mine === '-' ? '—' : esc(q.mine)}</td><td class="c mono">${esc(q.answer)}</td>
          <td class="c" style="color:var(--${ok ? 'ok' : 'stamp'})">${icon(ok ? 'check' : 'cross')}</td>
          <td>${ratioBar(Number(q.pass_rate))} ${pct(Number(q.pass_rate))}</td><td>${diag(q)}</td></tr>`;
      }).join('')}</tbody></table></div>
    <p class="muted" style="margin-top:10px">「失分警示」：全體通過率 70% 以上、你卻答錯的題目，通常是觀念漏洞或粗心，最值得訂正。</p>
  </section>`;
}

async function openShare(ev) {
  const btn = ev.currentTarget;
  btn.disabled = true;
  let blob;
  try { blob = await drawShareCard(exam, result); } catch (e) { toast('產生圖片失敗：' + e.message, 'error'); btn.disabled = false; return; }
  btn.disabled = false;
  const url = URL.createObjectURL(blob);
  const file = new File([blob], `${exam.code || 'mock-exam'}-成績.png`, { type: 'image/png' });
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  const p = modal({
    title: '成績分享圖',
    body: `<img src="${url}" alt="成績分享圖" class="share-preview">
      <p class="muted" style="font-size:.85rem;margin:10px 0 0">圖上只有考試名稱、等級和答對題數，不會出現你的暱稱、學校或准考證號。${canShare ? '按「分享」可以直接傳到 Threads、IG 限動或 LINE。' : '下載後再到 Threads 或 IG 發文。'}</p>
      ${canShare ? `<button class="btn" id="share-native" style="margin-top:10px;width:100%;justify-content:center">${icon('share')}<span>分享</span></button>` : ''}`,
    confirmText: '下載圖片', cancelText: '關閉',
  });
  $('#share-native')?.addEventListener('click', async () => {
    try { await navigator.share({ files: [file], text: `我在「${exam.title}」拿到 ${result.level || result.correct + ' 題'}！` }); }
    catch (e) { if (e.name !== 'AbortError') toast('這個瀏覽器不支援直接分享，請改用下載', 'error'); }
  });
  const ok = await p;
  if (ok) {
    const a = document.createElement('a');
    a.href = url; a.download = file.name;
    document.body.append(a); a.click(); a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function boardHTML() {
  return `<section class="sheet"><div class="sheet-head"><h2>${icon('flag')} 排行榜</h2><span class="muted">前 ${exam.board_size} 名・只顯示暱稱</span></div>
    ${board.length ? `<div class="table-wrap"><table><thead><tr><th class="c">名次</th><th>暱稱</th><th class="num">得分</th><th class="c">等級</th></tr></thead>
    <tbody>${board.map((b) => `<tr${b.display_name === app.profile?.display_name ? ' class="flag"' : ''}><td class="c mono">${b.place}</td><td>${esc(b.display_name)}</td><td class="num">${Number(b.pts)}</td><td class="c">${esc(b.level || '—')}</td></tr>`).join('')}</tbody></table></div>`
    : '<p class="muted">目前沒有資料。</p>'}</section>`;
}

function bind() {
  // 注意：await 之後 ev.currentTarget 會變成 null，按鈕要先存起來
  $('#reg-btn')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    btn.disabled = true;
    const { data, error } = await sb.rpc('register_exam', { p_exam: id, p_group_code: $('#gcode')?.value.trim() || null });
    if (error) { toast(rpcError(error), 'error'); btn.disabled = false; return; }
    toast(`報名成功！准考證號 ${data.ticket_no}`);
    await refresh();
  });
  $('#print-ticket')?.addEventListener('click', () => printSection($('#ticket-sec')));
  $('#print-result')?.addEventListener('click', () => printSection($('#result-sec')));
  const pageURL = location.href.split('#')[0];
  $('#cal-ics')?.addEventListener('click', () => { downloadICS(exam, state.registration.ticket_no, pageURL); toast('已下載行事曆檔，打開它就能加入行事曆'); });
  const g = $('#cal-google');
  if (g) g.href = googleCalendarURL(exam, state.registration.ticket_no, pageURL);
  $('#share-result')?.addEventListener('click', openShare);

  $$('.arow').forEach((row) => row.addEventListener('click', (e) => {
    const b = e.target.closest('.bub');
    if (!b || b.disabled) return;
    const q = Number(row.dataset.q), o = b.dataset.o;
    const cur = answers[q - 1];
    const next = cur === o ? '-' : o;
    answers = answers.slice(0, q - 1) + next + answers.slice(q);
    $$('.bub', row).forEach((x) => x.classList.toggle('on', x.dataset.o === next));
    dirty = true;
    try { localStorage.setItem(draftKey(), answers); } catch {}
    const answered = [...answers].filter((c) => c !== '-').length;
    $('.progress').innerHTML = `<span class="dirty-dot"></span>尚未送出・已作答 ${answered} / ${exam.num_questions} 題`;
  }));

  $('#clear-btn')?.addEventListener('click', async () => {
    if (!(await modal({ title: '清除全部劃記？', body: '<p>只會清除畫面上的劃記，還沒有送出。</p>', confirmText: '清除', danger: true }))) return;
    answers = '-'.repeat(exam.num_questions); dirty = true; render();
  });

  $('#save-btn')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    const blank = [...answers].map((c, i) => (c === '-' ? i + 1 : null)).filter(Boolean);
    const v = validity(answers, exam);
    // 只能送出一次：不論有沒有漏題，送出前都要確認
    const warn = !v.valid
      ? `<div class="notice err">${icon('alert')}<span>這份答案會被判定為<b>無效作答</b>（${esc(v.reason)}），不列入全體統計、百分等級和排行榜。</span></div>`
      : blank.length
        ? `<div class="notice warn">${icon('alert')}<span>還有 ${blank.length} 題未作答：${blank.slice(0, 30).join('、')}${blank.length > 30 ? '…' : ''}</span></div>`
        : '';
    const ok = await modal({
      title: '確定送出答案？', danger: !v.valid, confirmText: '確定送出', cancelText: '再檢查一下',
      body: `${warn}<p>已作答 ${exam.num_questions - blank.length} / ${exam.num_questions} 題。</p>
        <p><b>答案只能送出一次，送出後就不能修改。</b></p>`,
    });
    if (!ok) return;
    btn.disabled = true;
    const { error } = await sb.rpc('submit_answers', { p_exam: id, p_answers: answers });
    if (error) {
      toast(rpcError(error), 'error');
      if (/已送出/.test(error.message)) { dirty = false; try { localStorage.removeItem(draftKey()); } catch {} await refresh(); }
      else btn.disabled = false;
      return;
    }
    dirty = false;
    try { localStorage.removeItem(draftKey()); } catch {}
    toast('答案已送出');
    await refresh();
  });
}

window.addEventListener('beforeunload', (e) => { if (dirty && canAnswer()) { e.preventDefault(); e.returnValue = ''; } });

async function refresh() { if (await load()) { render(); schedule(); } }

// 到下一個時間點自動更新畫面
let timer, tick;
function schedule() {
  clearTimeout(timer); clearInterval(tick);
  const nx = nextMilestone(exam, now());
  if (nx) {
    const ms = nx.t - now() + 1500;
    if (ms < 2 ** 31) timer = setTimeout(refresh, ms);
  }
  tick = setInterval(() => {
    const k = $('.sheet-head .kpi b');
    const n2 = nextMilestone(exam, now());
    if (k && n2) k.textContent = countdown(n2.t, now());
  }, 30000);
}

if (!id) location.href = 'index.html';
else await refresh();
