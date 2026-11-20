import {
  sb, boot, app, $, $$, esc, fmt, icon, toast, modal, rpcError, csvDownload,
  toLocalInput, fromLocalInput, statusOf, loginPrompt, qs,
} from './core.js';
import { CAP_NATURE_115, normKey, score, levelOf, bandOf, validity } from './stats.js';
import { MAIL_VARS, DEFAULT_MAIL, mailVars, fill, unknownVars, toHtml } from './mailtpl.js';

await boot();
const main = $('#main');

const TABS = [
  ['exams', '考試管理', 'calendar'],
  ['regs', '報名與作答', 'ticket'],
  ['groups', '團體', 'users'],
  ['users', '使用者', 'user'],
  ['logs', '操作紀錄', 'history'],
];
const TIME_FIELDS = [
  ['register_start', '報名開始'], ['register_end', '報名截止'],
  ['exam_start', '題本開放閱覽'], ['answer_start', '登錄答案開始'],
  ['answer_end', '登錄答案截止'], ['release_key_at', '公布正解'],
  ['release_score_at', '公布成績單'], ['release_solution_at', '公布詳解連結'],
  ['release_rank_at', '公布排名'], ['release_report_at', '公布全體分析'],
];
let exams = [];

if (!app.user) main.innerHTML = `<section class="sheet">${loginPrompt('請用管理員帳號登入')}</section>`;
else if (!app.isAdmin) main.innerHTML = `<section class="sheet empty">${icon('shield', 'big')}<p>這個頁面只有管理員可以使用。</p></section>`;
else {
  main.innerHTML = `<div class="tabs no-print">${TABS.map(([k, l, i]) => `<button data-tab="${k}">${icon(i)}<span>${l}</span></button>`).join('')}</div><div id="pane"></div>`;
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => go(b.dataset.tab)));
  await loadExams();
  go(qs('tab') || 'exams');
}

async function loadExams() {
  const { data } = await sb.from('exams').select('*').order('created_at', { ascending: false });
  exams = data || [];
}

function go(tab, arg) {
  $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  history.replaceState(null, '', `?tab=${tab}`);
  ({ exams: tabExams, regs: tabRegs, groups: tabGroups, users: tabUsers, logs: tabLogs })[tab](arg);
}

const examOptions = (sel) => exams.map((e) => `<option value="${e.id}" ${e.id === sel ? 'selected' : ''}>${esc(e.code)}｜${esc(e.title)}</option>`).join('');

/* ================================================================
   考試管理
   ================================================================ */
async function tabExams() {
  const pane = $('#pane');
  const { data: counts } = await sb.rpc('admin_exam_counts');
  const now = Date.now();
  pane.innerHTML = `<section class="sheet">
    <div class="sheet-head"><h2>${icon('calendar')} 考試管理</h2><button class="btn primary sm" id="new-exam">${icon('plus')}<span>新增考試</span></button></div>
    ${exams.length ? `<div class="table-wrap"><table>
      <thead><tr><th>代碼</th><th>名稱</th><th>狀態</th><th>答案截止</th><th class="num">報名</th><th class="num">交卷</th><th class="num">有效</th><th class="num">匿名封存</th><th>操作</th></tr></thead>
      <tbody>${exams.map((e) => {
        const c = counts?.[e.id] || {};
        const st = statusOf(e, now);
        return `<tr><td class="mono">${esc(e.code)}</td><td><b>${esc(e.title)}</b></td>
          <td>${e.status === 'draft' ? '<span class="badge draft">草稿</span>' : `<span class="badge ${st.tone}">${esc(st.label)}</span>`}</td>
          <td>${fmt(e.answer_end, false)}</td><td class="num">${c.registered ?? 0}</td><td class="num">${c.submitted ?? 0}</td><td class="num">${c.valid ?? 0}</td><td class="num">${c.anon ?? 0}</td>
          <td><div class="btn-row">
            <button class="btn xs" data-edit="${e.id}">編輯</button>
            <button class="btn xs" data-copy="${e.id}">複製</button>
            <button class="btn xs" data-regs="${e.id}">作答</button>
            <a class="btn xs" href="report.html?id=${e.id}">分析</a>
            <a class="btn xs" href="exam.html?id=${e.id}">考場</a>
            <button class="btn xs" data-del="${e.id}" style="color:var(--stamp)">刪除</button></div></td></tr>`;
      }).join('')}</tbody></table></div>`
    : `<div class="empty">${icon('calendar', 'big')}<p>還沒有任何考試，先新增一場吧。</p></div>`}
  </section>`;
  $('#new-exam').onclick = () => editor(null);
  $$('[data-edit]').forEach((b) => (b.onclick = () => editor(b.dataset.edit)));
  $$('[data-copy]').forEach((b) => (b.onclick = () => editor(b.dataset.copy, true)));
  $$('[data-regs]').forEach((b) => (b.onclick = () => go('regs', b.dataset.regs)));
  $$('[data-del]').forEach((b) => (b.onclick = () => deleteExam(b.dataset.del)));
}

async function deleteExam(eid) {
  const e = exams.find((x) => x.id === eid);
  const ok = await modal({
    title: `刪除考試 ${e.code}？`, danger: true, confirmText: '永久刪除', typeToConfirm: e.code,
    body: '<p>會一併刪除這場考試的正解、等級表、團體、所有報名、作答和匿名封存資料，<b>無法復原</b>。</p><p class="muted">如果只想清除學生資料、保留考試設定，請到「報名與作答」使用匿名化或清除功能。</p>',
  });
  if (!ok) return;
  const { error } = await sb.from('exams').delete().eq('id', eid);
  if (error) return toast(rpcError(error), 'error');
  toast('已刪除'); await loadExams(); tabExams();
}

async function editor(eid, copy = false) {
  let e = { code: '', title: '', subject: '自然', description: '', num_questions: 50, options: 'ABCD', status: 'draft',
    rank_mode: 'pr', board_size: 20, group_enabled: false, retain_days: null, retain_action: 'anonymize',
    capacity: null, min_answered: 40, max_same_ratio: 0.7 };
  let links = {}, keys = [], levels = CAP_NATURE_115.map((x) => ({ ...x }));
  if (eid) {
    const [a, b, c, d] = await Promise.all([
      sb.from('exams').select('*').eq('id', eid).single(),
      sb.from('exam_links').select('*').eq('exam_id', eid).maybeSingle(),
      sb.from('exam_keys').select('*').eq('exam_id', eid).order('q_no'),
      sb.from('level_rules').select('*').eq('exam_id', eid).order('min_correct', { ascending: false }),
    ]);
    e = a.data; links = b.data || {}; keys = c.data || []; levels = d.data?.length ? d.data : levels;
    if (copy) {
      e = { ...e, id: null, code: '', title: `${e.title}（複製）`, status: 'draft', retained_at: null };
      TIME_FIELDS.forEach(([f]) => (e[f] = null));
      links = {};
    }
  }
  const keyMap = Object.fromEntries(keys.map((k) => [k.q_no, k]));
  const pane = $('#pane');
  pane.innerHTML = `<section class="sheet">
    <div class="sheet-head"><h2>${icon('pencil')} ${eid && !copy ? `編輯：${esc(e.code)}` : copy ? '複製考試' : '新增考試'}</h2>
      <button class="btn ghost sm" id="back">← 回列表</button></div>
    <form id="ef" autocomplete="off">
      <fieldset><legend>基本資料</legend>
        <div class="grid-3">
          <label class="field"><span>考試代碼（英數 2～12 字，准考證號開頭）</span><input name="code" required pattern="[A-Za-z0-9]{2,12}" value="${esc(e.code)}" placeholder="115N01"></label>
          <label class="field"><span>名稱</span><input name="title" required value="${esc(e.title)}" placeholder="第一次會考模擬考"></label>
          <label class="field"><span>科目</span><input name="subject" value="${esc(e.subject)}"></label>
          <label class="field"><span>題數</span><input name="num_questions" type="number" min="1" max="200" value="${e.num_questions}"></label>
          <label class="field"><span>選項（例如 ABCD）</span><input name="options" pattern="[A-Z]{2,6}" value="${esc(e.options)}"></label>
          <label class="field"><span>狀態</span><select name="status"><option value="draft" ${e.status === 'draft' ? 'selected' : ''}>草稿（只有你看得到）</option><option value="published" ${e.status === 'published' ? 'selected' : ''}>發布</option></select></label>
        </div>
        <label class="field"><span>說明（顯示在考場頁）</span><textarea name="description">${esc(e.description)}</textarea></label>
      </fieldset>

      <fieldset><legend>時間軸</legend>
        <div class="toolbar"><label class="field"><span>快速排程：以「登錄答案開始」為基準</span>
          <select id="preset"><option value="">選擇範本…</option><option value="3">答案登錄 3 天，隔天公布成績</option><option value="1">答案登錄 1 天，隔天公布成績</option><option value="7">答案登錄 7 天，隔天公布成績</option></select></label>
          <span class="muted" style="padding-bottom:8px">先填「登錄答案開始」，再選範本。</span></div>
        <div class="grid-2">${TIME_FIELDS.map(([f, l]) => `<label class="field"><span>${l}</span><input type="datetime-local" name="${f}" value="${toLocalInput(e[f])}"></label>`).join('')}</div>
        <div id="time-warn"></div>
      </fieldset>

      <fieldset><legend>題本與詳解</legend>
        <p class="muted">放雲端硬碟或任何網址。題本在「題本開放閱覽」之後、詳解在「公布詳解連結」之後才會出現在考場頁；時間到之前，學生連網址都拿不到；時間到了，也只有<b>已報名</b>的考生拿得到（沒報名、沒登入的人看不到）。</p>
        <p class="muted">提醒：題本只開放線上閱覽的話，記得在雲端硬碟的共用設定（齒輪）取消勾選「檢視者和加入者可以看到下載、列印和複製選項」。連結如果設成「知道連結的人都能檢視」，報名者還是可以把網址轉給別人。</p>
        <div class="grid-2">
          <label class="field"><span>題本連結</span><input name="booklet_url" type="url" value="${esc(links.booklet_url || '')}" placeholder="https://"></label>
          <label class="field"><span>詳解連結</span><input name="solution_url" type="url" value="${esc(links.solution_url || '')}" placeholder="https://"></label>
        </div>
      </fieldset>

      <fieldset><legend>正解、單元、配分</legend>
        <div class="toolbar">
          <label class="field" style="flex:1;min-width:280px"><span>一次貼上正解（例如 ABDC CADB…，空白會自動忽略）</span><input id="paste-key"></label>
          <button type="button" class="btn sm" id="apply-key">套用正解</button>
        </div>
        <div class="toolbar">
          <label class="field" style="min-width:90px"><span>從第</span><input id="u-from" type="number" min="1"></label>
          <label class="field" style="min-width:90px"><span>到第</span><input id="u-to" type="number" min="1"></label>
          <label class="field"><span>單元</span><input id="u-name" placeholder="例如 電學"></label>
          <label class="field" style="min-width:90px"><span>配分</span><input id="u-pts" type="number" step="0.5" min="0" placeholder="不改"></label>
          <button type="button" class="btn sm" id="apply-unit">批次套用</button>
        </div>
        <div class="key-grid" id="key-grid"></div>
        <p class="muted" id="key-count" style="margin-top:8px"></p>
      </fieldset>

      <fieldset><legend>等級對照表（答對題數下限）</legend>
        <div class="btn-row" style="margin-bottom:10px"><button type="button" class="btn sm" id="cap115">套用 115 會考自然標準</button><span class="muted">A 開頭＝精熟、B 開頭＝基礎、其他＝待加強</span></div>
        <div class="grid-4" id="lv-grid"></div>
        <button type="button" class="btn xs" id="lv-add">${icon('plus')} 新增等級</button>
      </fieldset>

      <fieldset><legend>排名與團體</legend>
        <div class="grid-3">
          <label class="field"><span>排名公布方式</span><select name="rank_mode">
            ${[['none', '不公布'], ['pr', '只顯示百分等級 PR'], ['board', '只公布排行榜'], ['both', 'PR＋排行榜']].map(([v, l]) => `<option value="${v}" ${e.rank_mode === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="field"><span>排行榜人數</span><input name="board_size" type="number" min="1" max="200" value="${e.board_size}"></label>
          <label class="check" style="margin-top:26px"><input type="checkbox" name="group_enabled" ${e.group_enabled ? 'checked' : ''}> 開放團體報名</label>
        </div>
      </fieldset>

      <fieldset><legend>防止亂報名・有效作答規則</legend>
        <p class="muted">每個 Google 帳號每場只能申請一次准考證，流水號不會重複使用。另外可以設定：不符合規則的作答會自動判定為無效，不列入全體統計、PR 和排行榜（學生仍看得到自己的成績，但會標示無效）。</p>
        <div class="grid-3">
          <label class="field"><span>報名名額上限（空白＝不限）</span><input name="capacity" type="number" min="1" value="${e.capacity ?? ''}"></label>
          <label class="field"><span>至少作答幾題才算有效（空白＝至少 1 題）</span><input name="min_answered" type="number" min="1" value="${e.min_answered ?? ''}"></label>
          <label class="field"><span>同一選項比例達幾 % 視為亂填（空白＝不檢查）</span><input name="max_same_ratio" type="number" min="1" max="100" value="${e.max_same_ratio != null ? Math.round(e.max_same_ratio * 100) : ''}"></label>
        </div>
      </fieldset>

      <fieldset><legend>資料保留</legend>
        <div class="grid-2">
          <label class="field"><span>「公布全體分析」後保留幾天（空白＝永久保留）</span><input name="retain_days" type="number" min="0" value="${e.retain_days ?? ''}"></label>
          <label class="field"><span>到期後</span><select name="retain_action">
            <option value="anonymize" ${e.retain_action === 'anonymize' ? 'selected' : ''}>匿名化：刪除報名與個人資料，只留匿名作答供統計</option>
            <option value="delete" ${e.retain_action === 'delete' ? 'selected' : ''}>全部刪除：連匿名作答也刪除</option></select></label>
        </div>
        ${e.retained_at ? `<p class="muted">已於 ${fmt(e.retained_at)} 執行保留政策。</p>` : ''}
      </fieldset>

      <div class="btn-row"><button class="btn primary" type="submit">${icon('check')}<span>儲存</span></button><span class="muted">儲存後才會生效。</span></div>
    </form></section>`;

  const f = $('#ef');
  $('#back').onclick = () => tabExams();

  // 正解格
  const drawKeys = () => {
    const n = Math.max(1, Math.min(200, Number(f.num_questions.value) || 1));
    const opts = (f.options.value || 'ABCD').toUpperCase();
    const prev = readKeys();
    prev.forEach((k) => (keyMap[k.q_no] = k));
    let h = '';
    for (let q = 1; q <= n; q++) {
      const k = keyMap[q] || {};
      h += `<div class="key-row" data-q="${q}"><span class="qn">${q}</span>
        <select class="k-a"><option value="">—</option>${[...opts].map((o) => `<option ${k.answer === o ? 'selected' : ''}>${o}</option>`).join('')}</select>
        <input class="k-u" placeholder="單元" value="${esc(k.unit || '')}">
        <input class="k-p" type="number" step="0.5" min="0" value="${k.points ?? 1}" title="配分"></div>`;
    }
    $('#key-grid').innerHTML = h;
    countKeys();
  };
  const readKeys = () => $$('.key-row').map((r) => ({
    q_no: Number(r.dataset.q), answer: $('.k-a', r).value, unit: $('.k-u', r).value.trim(), points: Number($('.k-p', r).value || 1),
  }));
  const countKeys = () => {
    const ks = readKeys();
    const miss = ks.filter((k) => !k.answer).map((k) => k.q_no);
    $('#key-count').innerHTML = miss.length ? `<span style="color:var(--stamp)">還有 ${miss.length} 題沒有正解：${miss.slice(0, 20).join('、')}${miss.length > 20 ? '…' : ''}</span>` : `${icon('check')} ${ks.length} 題正解都已設定，總分 ${ks.reduce((s, k) => s + k.points, 0)}`;
  };
  drawKeys();
  f.num_questions.addEventListener('change', drawKeys);
  f.options.addEventListener('change', drawKeys);
  $('#key-grid').addEventListener('change', countKeys);
  $('#apply-key').onclick = () => {
    const s = $('#paste-key').value.toUpperCase().replace(/[^A-Z]/g, '');
    $$('.key-row').forEach((r, i) => { if (s[i]) $('.k-a', r).value = s[i]; });
    countKeys(); toast(`已套用 ${Math.min(s.length, $$('.key-row').length)} 題`);
  };
  $('#apply-unit').onclick = () => {
    const a = Number($('#u-from').value), b = Number($('#u-to').value) || a;
    const name = $('#u-name').value.trim(), pts = $('#u-pts').value;
    if (!a) return toast('請填題號範圍', 'error');
    $$('.key-row').forEach((r) => {
      const q = Number(r.dataset.q);
      if (q >= a && q <= b) { if (name) $('.k-u', r).value = name; if (pts !== '') $('.k-p', r).value = pts; }
    });
    countKeys(); toast(`已套用第 ${a}～${b} 題`);
  };

  // 等級表
  const drawLevels = () => {
    $('#lv-grid').innerHTML = levels.map((l, i) => `<div class="lv-row btn-row" style="margin-bottom:8px;flex-wrap:nowrap">
      <input class="lv-n" value="${esc(l.level)}" style="width:70px"><input class="lv-m" type="number" min="0" value="${l.min_correct}" style="width:80px" title="答對題數下限">
      <button type="button" class="icon-btn" data-lvdel="${i}" title="刪除">${icon('trash')}</button></div>`).join('');
    $$('[data-lvdel]').forEach((b) => (b.onclick = () => { levels = readLevels(); levels.splice(Number(b.dataset.lvdel), 1); drawLevels(); }));
  };
  const readLevels = () => $$('.lv-row').map((r) => ({ level: $('.lv-n', r).value.trim(), min_correct: Number($('.lv-m', r).value || 0) })).filter((l) => l.level);
  drawLevels();
  $('#cap115').onclick = () => { levels = CAP_NATURE_115.map((x) => ({ ...x })); drawLevels(); };
  $('#lv-add').onclick = () => { levels = [...readLevels(), { level: '', min_correct: 0 }]; drawLevels(); };

  // 快速排程
  $('#preset').onchange = (ev) => {
    const days = Number(ev.target.value);
    ev.target.value = '';
    if (!days) return;
    if (!f.answer_start.value) return toast('請先填「登錄答案開始」', 'error');
    const s = new Date(f.answer_start.value).getTime();
    const end = s + days * 864e5;
    const set = (name, t) => (f[name].value = toLocalInput(new Date(t)));
    if (!f.register_start.value) set('register_start', Date.now());
    set('register_end', end);
    set('exam_start', s);
    set('answer_end', end);
    set('release_key_at', end + 36e5);
    set('release_score_at', end + 864e5);
    set('release_solution_at', end + 864e5);
    set('release_rank_at', end + 864e5);
    set('release_report_at', end + 2 * 864e5);
    checkTimes(); toast('已套用排程，可以再個別微調');
  };
  const checkTimes = () => {
    const t = Object.fromEntries(TIME_FIELDS.map(([k]) => [k, f[k].value ? new Date(f[k].value).getTime() : null]));
    const w = [];
    const lt = (a, b, msg) => { if (t[a] && t[b] && t[a] > t[b]) w.push(msg); };
    lt('register_start', 'register_end', '報名開始晚於報名截止');
    lt('answer_start', 'answer_end', '登錄答案開始晚於截止');
    lt('answer_end', 'release_key_at', '正解在答案截止前就公布了，學生可以照抄改答案');
    lt('answer_end', 'release_score_at', '成績單在答案截止前就公布了');
    lt('release_key_at', 'release_score_at', '成績單比正解早公布（成績單裡會看到正解）');
    lt('answer_end', 'release_solution_at', '詳解在答案截止前就公布了');
    lt('answer_end', 'release_rank_at', '排名在答案截止前就公布了');
    if (t.release_rank_at && t.release_score_at && t.release_rank_at < t.release_score_at) w.push('排名比成績單早公布，學生要等成績單公布後才看得到 PR');
    if (!t.answer_start || !t.answer_end) w.push('還沒設定答案登錄期間');
    $('#time-warn').innerHTML = w.map((x) => `<div class="notice warn">${icon('alert')}<span>${x}</span></div>`).join('');
    return w;
  };
  TIME_FIELDS.forEach(([k]) => f[k].addEventListener('change', checkTimes));
  checkTimes();

  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!f.reportValidity()) return;
    const w = checkTimes();
    if (w.length && !(await modal({ title: '時間設定有疑慮', body: `<ul>${w.map((x) => `<li>${x}</li>`).join('')}</ul><p>仍然要儲存嗎？</p>`, confirmText: '仍然儲存' }))) return;
    const ks = readKeys();
    const p = {
      id: eid && !copy ? eid : null,
      code: f.code.value.trim().toUpperCase(), title: f.title.value.trim(), subject: f.subject.value.trim() || '自然',
      description: f.description.value, num_questions: Number(f.num_questions.value), options: f.options.value.toUpperCase(),
      status: f.status.value, rank_mode: f.rank_mode.value, board_size: Number(f.board_size.value || 20),
      group_enabled: f.group_enabled.checked,
      retain_days: f.retain_days.value === '' ? null : Number(f.retain_days.value), retain_action: f.retain_action.value,
      capacity: f.capacity.value === '' ? null : Number(f.capacity.value),
      min_answered: f.min_answered.value === '' ? null : Number(f.min_answered.value),
      max_same_ratio: f.max_same_ratio.value === '' ? null : Number(f.max_same_ratio.value) / 100,
      booklet_url: f.booklet_url.value.trim(), solution_url: f.solution_url.value.trim(),
      keys: ks.filter((k) => k.answer), levels: readLevels(),
    };
    TIME_FIELDS.forEach(([k]) => (p[k] = fromLocalInput(f[k].value)));
    if (p.status === 'published' && p.keys.length < p.num_questions &&
        !(await modal({ title: '正解還沒填完', body: `<p>只設定了 ${p.keys.length} / ${p.num_questions} 題正解，仍然要發布嗎？</p>`, confirmText: '仍然發布' }))) return;
    const btn = $('button[type=submit]', f); btn.disabled = true;
    const { data, error } = await sb.rpc('admin_save_exam', { p });
    btn.disabled = false;
    if (error) return toast(rpcError(error).includes('exams_code_key') ? '考試代碼已經有人用了' : rpcError(error), 'error');
    toast('已儲存');
    await loadExams();
    editor(data);
  });
}

/* ================================================================
   報名與作答
   ================================================================ */
async function tabRegs(sel) {
  const pane = $('#pane');
  await loadExams();
  if (!exams.length) { pane.innerHTML = `<section class="sheet empty"><p>還沒有考試。</p></section>`; return; }
  sel = sel || exams[0].id;
  const e = exams.find((x) => x.id === sel);
  pane.innerHTML = `<section class="sheet">
    <div class="sheet-head"><h2>${icon('ticket')} 報名與作答</h2>
      <label class="field" style="margin:0;min-width:300px"><select id="esel">${examOptions(sel)}</select></label></div>
    <div class="toolbar">
      <label class="field"><span>搜尋（准考證、暱稱、email、學校）</span><input id="q"></label>
      <button class="btn sm primary" id="mail" disabled>${icon('mail')}<span>寄提醒信</span></button>
      <button class="btn sm" id="csv">${icon('download')}<span>匯出 CSV</span></button>
      <a class="btn sm" href="report.html?id=${sel}">${icon('chart')}<span>分析報告</span></a>
      <button class="btn sm" id="anon">${icon('shield')}<span>匿名化本場個資</span></button>
      <button class="btn sm danger" id="purge">${icon('trash')}<span>刪除本場全部作答</span></button>
      <button class="btn sm ghost" id="allow">${icon('ticket')}<span>允許某帳號重新申請</span></button>
    </div>
    <div id="regs-body"><div class="skeleton"></div></div></section>`;
  $('#esel').onchange = (ev) => tabRegs(ev.target.value);

  const [r, k, l] = await Promise.all([
    sb.from('registrations').select('id, ticket_no, seq, registered_at, user_id, profiles(email, display_name, grade, school, banned), groups(name), submissions(answers, updated_at, excluded, exclude_reason)').eq('exam_id', sel).order('seq'),
    sb.from('exam_keys').select('*').eq('exam_id', sel).order('q_no'),
    sb.from('level_rules').select('*').eq('exam_id', sel),
  ]);
  if (r.error) { $('#regs-body').innerHTML = `<div class="notice err">${esc(r.error.message)}</div>`; return; }
  const key = normKey(k.data);
  const rows = r.data.map((x) => {
    const sub = Array.isArray(x.submissions) ? x.submissions[0] : x.submissions;
    const s = sub ? score(sub.answers, key) : null;
    const level = s ? levelOf(s.correct, l.data) : null;
    const v = validity(sub?.answers, e, sub?.excluded, sub?.exclude_reason);
    return { ...x, sub, s, level, v };
  });

  const draw = () => {
    const q = $('#q').value.trim().toLowerCase();
    const list = rows.filter((x) => !q || [x.ticket_no, x.profiles?.display_name, x.profiles?.email, x.profiles?.school].some((v) => (v || '').toLowerCase().includes(q)));
    $('#regs-body').innerHTML = `<p class="muted">報名 ${rows.length} 人・交卷 ${rows.filter((x) => x.sub).length} 人・有效 ${rows.filter((x) => x.v.valid).length} 人・已發出流水號 ${e.last_seq} 號${q ? `・符合搜尋 ${list.length} 人` : ''}</p>
      <div class="table-wrap tall"><table>
      <thead><tr><th>准考證號</th><th>暱稱</th><th>Email</th><th>年級</th><th>學校</th><th>團體</th><th>交卷時間</th><th class="num">答對</th><th class="c">等級</th><th>有效</th><th>操作</th></tr></thead>
      <tbody>${list.map((x) => `<tr><td class="mono">${esc(x.ticket_no)}</td><td>${esc(x.profiles?.display_name)}</td><td>${esc(x.profiles?.email)}</td>
        <td>${esc(x.profiles?.grade || '')}</td><td>${esc(x.profiles?.school || '')}</td><td>${esc(x.groups?.name || '')}</td>
        <td>${x.sub ? fmt(x.sub.updated_at, false) : '<span class="tag amber">未交卷</span>'}</td>
        <td class="num">${x.s ? x.s.correct : ''}</td><td class="c">${esc(x.level || '')}</td>
        <td>${x.sub ? (x.v.valid ? '<span class="tag green">有效</span>' : `<span class="tag red" title="${esc(x.v.reason)}">無效</span><br><small class="muted">${esc(x.v.reason)}</small>`) : ''}${x.profiles?.banned ? '<br><span class="tag red">已停權</span>' : ''}</td>
        <td><div class="btn-row">${x.sub ? `<button class="btn xs" data-view="${x.id}">作答</button>
          <button class="btn xs" data-excl="${x.id}">${x.sub.excluded ? '恢復有效' : '標記無效'}</button>
          <button class="btn xs" data-clear="${x.id}">清除作答</button>` : ''}
          <button class="btn xs" data-unreg="${x.id}" style="color:var(--stamp)">刪除報名</button></div></td></tr>`).join('')}</tbody></table></div>`;
    $$('[data-view]').forEach((b) => (b.onclick = () => {
      const x = rows.find((y) => y.id === b.dataset.view);
      const a = x.sub.answers;
      modal({ title: `${x.ticket_no}｜${x.profiles?.display_name}`, wide: true, cancelText: '', confirmText: '關閉',
        body: `<p class="mono" style="word-break:break-all;line-height:2">${[...a].map((c, i) => {
          const kk = key.find((z) => z.q === i + 1);
          const ok = kk && c === kk.a;
          return `<span title="第${i + 1}題" style="display:inline-block;width:2.4em;text-align:center;border-bottom:2px solid var(--${kk ? (ok ? 'ok' : 'stamp') : 'rule'})"><small class="muted">${i + 1}</small><br>${c}</span>`;
        }).join('')}</p>` });
    }));
    $$('[data-clear]').forEach((b) => (b.onclick = async () => {
      if (!(await modal({ title: '清除這位考生的作答？', body: '<p>會保留報名與准考證號，只刪除答案，無法復原。</p><p>清除後，如果還在登錄期間，考生可以<b>重新送出一次</b>（答案只能送出一次，學生按錯時用這個）。</p>', danger: true, confirmText: '清除' }))) return;
      const { error } = await sb.from('submissions').delete().eq('registration_id', b.dataset.clear);
      if (error) return toast(rpcError(error), 'error');
      toast('已清除'); tabRegs(sel);
    }));
    $$('[data-excl]').forEach((b) => (b.onclick = async () => {
      const x = rows.find((y) => y.id === b.dataset.excl);
      let reason = null;
      if (!x.sub.excluded) {
        const w = await modal({ title: `把 ${x.ticket_no} 標記為無效？`, confirmText: '標記無效', danger: true,
          body: '<p>這份作答不會列入全體統計、PR 和排行榜，學生的成績單會顯示原因。之後可以恢復。</p><label class="field"><span>原因（學生看得到）</span><input name="r" maxlength="60" placeholder="例如：重複帳號、明顯亂填"></label>' });
        if (!w) return;
        reason = $('[name=r]', w).value.trim() || '主辦人判定無效';
      }
      const { error } = await sb.from('submissions').update({ excluded: !x.sub.excluded, exclude_reason: reason }).eq('registration_id', x.id);
      if (error) return toast(rpcError(error), 'error');
      toast(x.sub.excluded ? '已恢復有效' : '已標記無效'); tabRegs(sel);
    }));
    $$('[data-unreg]').forEach((b) => (b.onclick = async () => {
      const w = await modal({ title: '刪除報名？', danger: true, confirmText: '刪除',
        body: '<p>會刪除報名、准考證號和作答，無法復原。這個流水號不會再發給別人。</p><label class="check"><input type="checkbox" name="allow"> 允許這個 Google 帳號重新申請（會拿到新的流水號）</label><p class="muted">沒勾選的話，這個帳號這場就不能再報名。</p>' });
      if (!w) return;
      const { error } = await sb.rpc('admin_delete_registration', { p_reg: b.dataset.unreg, p_allow: $('[name=allow]', w).checked });
      if (error) return toast(rpcError(error), 'error');
      toast('已刪除'); tabRegs(sel);
    }));
  };
  $('#q').oninput = draw;
  draw();

  const pending = rows.filter((x) => !x.sub && !x.profiles?.banned && x.profiles?.email);
  $('#mail').disabled = false;
  $('#mail span').textContent = `寄提醒信（未交卷 ${pending.length} 人）`;
  $('#mail').onclick = () => mailComposer(e, rows, () => { $('.toolbar').style.display = ''; draw(); });

  $('#csv').onclick = () => {
    const out = [['准考證號', '暱稱', 'Email', '年級', '學校', '團體', '報名時間', '交卷時間', '答對', '得分', '等級', '表現', '有效', '無效原因', ...key.map((z) => `Q${z.q}`)]];
    rows.forEach((x) => out.push([x.ticket_no, x.profiles?.display_name, x.profiles?.email, x.profiles?.grade, x.profiles?.school, x.groups?.name,
      fmt(x.registered_at), x.sub ? fmt(x.sub.updated_at) : '', x.s?.correct ?? '', x.s?.points ?? '', x.level ?? '', bandOf(x.level) ?? '',
      x.sub ? (x.v.valid ? '是' : '否') : '', x.sub && !x.v.valid ? x.v.reason : '',
      ...key.map((z) => x.sub?.answers[z.q - 1] ?? '')]));
    csvDownload(`${e.code}_報名與作答.csv`, out);
  };
  $('#allow').onclick = async () => {
    const w = await modal({ title: '允許重新申請准考證', confirmText: '允許',
      body: '<p>適用於報名已被刪除、但當時沒有勾選「允許重新申請」的帳號。重新申請會拿到新的流水號。</p><label class="field"><span>Google 帳號 email</span><input name="em" type="email"></label>' });
    if (!w) return;
    const { data, error } = await sb.rpc('admin_allow_reregister', { p_exam: sel, p_email: $('[name=em]', w).value });
    if (error) return toast(rpcError(error), 'error');
    toast(data ? '已允許重新申請' : '找不到可以解除的紀錄（可能還在報名中，或從未申請）', data ? 'info' : 'error');
  };
  $('#anon').onclick = async () => {
    if (!(await modal({ title: `匿名化 ${e.code} 的個人資料？`, danger: true, confirmText: '匿名化', typeToConfirm: e.code,
      body: '<p>會把作答移到匿名封存（只留答案字串，供分析報告使用），並刪除所有報名、准考證號和個人連結。學生之後就看不到自己的成績單。<b>無法復原。</b></p><p class="muted">建議先匯出 CSV 備份。</p>' }))) return;
    const { data, error } = await sb.rpc('admin_anonymize_exam', { p_exam: sel });
    if (error) return toast(rpcError(error), 'error');
    toast(`已匿名化 ${data} 筆作答`); tabRegs(sel);
  };
  $('#purge').onclick = async () => {
    if (!(await modal({ title: `刪除 ${e.code} 的全部作答？`, danger: true, confirmText: '全部刪除', typeToConfirm: e.code,
      body: '<p>會刪除所有報名、作答和匿名封存資料，分析報告也會變成空的。考試設定與正解會保留。<b>無法復原。</b></p>' }))) return;
    const { error } = await sb.rpc('admin_purge_exam', { p_exam: sel });
    if (error) return toast(rpcError(error), 'error');
    toast('已刪除'); tabRegs(sel);
  };
}

/* ================================================================
   團體
   ================================================================ */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genCode = () => Array.from(crypto.getRandomValues(new Uint32Array(6)), (v) => CODE_CHARS[v % CODE_CHARS.length]).join('');

async function tabGroups(sel) {
  const pane = $('#pane');
  if (!exams.length) { pane.innerHTML = `<section class="sheet empty"><p>還沒有考試。</p></section>`; return; }
  sel = sel || exams[0].id;
  const e = exams.find((x) => x.id === sel);
  const [g, r] = await Promise.all([
    sb.from('groups').select('*').eq('exam_id', sel).order('created_at'),
    sb.from('registrations').select('group_id').eq('exam_id', sel),
  ]);
  const cnt = {};
  (r.data || []).forEach((x) => { if (x.group_id) cnt[x.group_id] = (cnt[x.group_id] || 0) + 1; });
  pane.innerHTML = `<section class="sheet">
    <div class="sheet-head"><h2>${icon('users')} 團體</h2>
      <label class="field" style="margin:0;min-width:300px"><select id="esel">${examOptions(sel)}</select></label></div>
    ${!e.group_enabled ? `<div class="notice warn">${icon('alert')}<span>這場考試沒有開放團體報名，學生輸入代碼會失敗。請到「考試管理 → 編輯」勾選「開放團體報名」。</span></div>` : ''}
    <p class="muted">負責人用登記的 Google 帳號登入後，可以在「團體成績」頁看到自己學生的成績（成績單公布之後）。</p>
    <form class="toolbar" id="gf">
      <label class="field"><span>團體名稱</span><input name="name" required placeholder="例如 ○○補習班"></label>
      <label class="field"><span>負責人 Google 帳號</span><input name="leader" type="email" placeholder="teacher@gmail.com"></label>
      <button class="btn primary sm">${icon('plus')}<span>新增團體</span></button>
    </form>
    <div class="table-wrap"><table>
      <thead><tr><th>名稱</th><th>團報代碼</th><th>負責人</th><th class="num">報名人數</th><th>操作</th></tr></thead>
      <tbody>${(g.data || []).map((x) => `<tr data-id="${x.id}"><td>${esc(x.name)}</td>
        <td class="mono"><b>${esc(x.code)}</b> <button class="btn xs" data-cp="${esc(x.code)}">${icon('copy')}</button></td>
        <td><input class="leader" type="email" value="${esc(x.leader_email || '')}" style="min-width:220px"></td>
        <td class="num">${cnt[x.id] || 0}</td>
        <td><div class="btn-row"><button class="btn xs" data-save>儲存負責人</button><a class="btn xs" href="group.html?g=${x.id}">成績</a>
          <button class="btn xs" data-gdel style="color:var(--stamp)">刪除</button></div></td></tr>`).join('') || '<tr><td colspan="5" class="muted">還沒有團體</td></tr>'}</tbody>
    </table></div></section>`;
  $('#esel').onchange = (ev) => tabGroups(ev.target.value);
  $('#gf').onsubmit = async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    const { error } = await sb.from('groups').insert({ exam_id: sel, name: f.name.value.trim(), leader_email: f.leader.value.trim().toLowerCase() || null, code: genCode() });
    if (error) return toast(rpcError(error), 'error');
    toast('已新增'); tabGroups(sel);
  };
  $$('[data-cp]').forEach((b) => (b.onclick = async () => {
    try { await navigator.clipboard.writeText(b.dataset.cp); toast('已複製代碼'); } catch { toast('複製失敗', 'error'); }
  }));
  $$('[data-save]').forEach((b) => (b.onclick = async () => {
    const tr = b.closest('tr');
    const { error } = await sb.from('groups').update({ leader_email: $('.leader', tr).value.trim().toLowerCase() || null }).eq('id', tr.dataset.id);
    if (error) return toast(rpcError(error), 'error');
    toast('已儲存');
  }));
  $$('[data-gdel]').forEach((b) => (b.onclick = async () => {
    if (!(await modal({ title: '刪除團體？', body: '<p>學生的報名和作答會保留，只是不再屬於這個團體。</p>', danger: true, confirmText: '刪除' }))) return;
    const { error } = await sb.from('groups').delete().eq('id', b.closest('tr').dataset.id);
    if (error) return toast(rpcError(error), 'error');
    toast('已刪除'); tabGroups(sel);
  }));
}

/* ================================================================
   使用者
   ================================================================ */
async function tabUsers() {
  const pane = $('#pane');
  const { data, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
  pane.innerHTML = `<section class="sheet">
    <div class="sheet-head"><h2>${icon('user')} 使用者</h2><span class="muted">共 ${data?.length || 0} 人</span></div>
    ${error ? `<div class="notice err">${esc(error.message)}</div>` : ''}
    <div class="toolbar"><label class="field"><span>搜尋</span><input id="uq"></label>
      <button class="btn sm" id="ucsv">${icon('download')}<span>匯出 CSV</span></button></div>
    <div class="table-wrap tall" id="ubody"></div></section>`;
  const draw = () => {
    const q = $('#uq').value.trim().toLowerCase();
    const list = (data || []).filter((u) => !q || [u.email, u.display_name, u.school].some((v) => (v || '').toLowerCase().includes(q)));
    $('#ubody').innerHTML = `<table><thead><tr><th>Email</th><th>暱稱</th><th>年級</th><th>學校</th><th>角色</th><th>停權</th><th>加入時間</th><th>操作</th></tr></thead>
      <tbody>${list.map((u) => `<tr data-id="${u.id}"><td>${esc(u.email)}</td><td>${esc(u.display_name || '')}</td><td>${esc(u.grade || '')}</td><td>${esc(u.school || '')}</td>
        <td><select class="role" ${u.id === app.user.id ? 'disabled' : ''}><option value="student" ${u.role === 'student' ? 'selected' : ''}>學生</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>管理員</option></select></td>
        <td>${u.id === app.user.id ? '' : `<label class="check" style="margin:0"><input type="checkbox" class="ban" ${u.banned ? 'checked' : ''}> 停權</label>`}</td>
        <td>${fmt(u.created_at, false)}</td>
        <td>${u.id === app.user.id ? '<span class="muted">你自己</span>' : `<button class="btn xs" data-udel style="color:var(--stamp)">刪除帳號</button>`}</td></tr>`).join('')}</tbody></table>`;
    $$('.role').forEach((s) => (s.onchange = async () => {
      const tr = s.closest('tr');
      if (s.value === 'admin' && !(await modal({ title: '設為管理員？', body: '<p>管理員可以看到所有學生資料，也能刪除任何資料。</p>', confirmText: '確定' }))) { s.value = 'student'; return; }
      const { error: er } = await sb.from('profiles').update({ role: s.value }).eq('id', tr.dataset.id);
      if (er) return toast(rpcError(er), 'error');
      toast('已更新角色');
    }));
    $$('.ban').forEach((c) => (c.onchange = async () => {
      const tr = c.closest('tr');
      if (c.checked && !(await modal({ title: '停權這個帳號？', danger: true, confirmText: '停權', body: '<p>停權後不能再報名任何考試，也不能送出答案。已經交的作答不受影響，要排除請到「報名與作答」標記無效。</p>' }))) { c.checked = false; return; }
      const { error: er } = await sb.from('profiles').update({ banned: c.checked }).eq('id', tr.dataset.id);
      if (er) { c.checked = !c.checked; return toast(rpcError(er), 'error'); }
      const u = data.find((x) => x.id === tr.dataset.id); if (u) u.banned = c.checked;
      toast(c.checked ? '已停權' : '已解除停權');
    }));
    $$('[data-udel]').forEach((b) => (b.onclick = async () => {
      const u = data.find((x) => x.id === b.closest('tr').dataset.id);
      if (!(await modal({ title: '刪除這個帳號？', danger: true, confirmText: '永久刪除', typeToConfirm: u.email,
        body: '<p>會刪除登入帳號、考生資料，以及這個人在所有考試的報名和作答。<b>無法復原。</b></p>' }))) return;
      const { error: er } = await sb.rpc('admin_delete_user', { p_uid: u.id });
      if (er) return toast(rpcError(er), 'error');
      toast('已刪除帳號'); tabUsers();
    }));
  };
  $('#uq').oninput = draw;
  draw();
  $('#ucsv').onclick = () => csvDownload('使用者.csv', [['Email', '暱稱', '年級', '學校', '角色', '加入時間'],
    ...(data || []).map((u) => [u.email, u.display_name, u.grade, u.school, u.role, fmt(u.created_at)])]);
}

/* ================================================================
   操作紀錄
   ================================================================ */
const ACTION_LABEL = { INSERT: '新增', UPDATE: '修改', DELETE: '刪除', SAVE_EXAM: '儲存考試', DELETE_REGISTRATION: '刪除報名', ALLOW_REREGISTER: '允許重新申請', ANONYMIZE_EXAM: '匿名化', PURGE_EXAM: '刪除全部作答', DELETE_USER: '刪除帳號' };
const TARGET_LABEL = { exams: '考試', groups: '團體', registrations: '報名', submissions: '作答', profiles: '使用者', ticket_ledger: '准考證紀錄', 'auth.users': '登入帳號' };

async function tabLogs() {
  const pane = $('#pane');
  const { data, error } = await sb.from('audit_log').select('*').order('at', { ascending: false }).limit(300);
  pane.innerHTML = `<section class="sheet">
    <div class="sheet-head"><h2>${icon('history')} 操作紀錄</h2><span class="muted">最近 300 筆</span></div>
    ${error ? `<div class="notice err">${esc(error.message)}</div>` : ''}
    <div class="toolbar">
      <label class="field" style="min-width:140px"><span>刪除幾天前的紀錄</span><input id="days" type="number" min="1" value="90"></label>
      <button class="btn sm" id="del-old">${icon('trash')}<span>刪除舊紀錄</span></button>
      <button class="btn sm danger" id="del-all">${icon('trash')}<span>清空全部紀錄</span></button>
    </div>
    <div class="table-wrap tall"><table><thead><tr><th>時間</th><th>操作者</th><th>動作</th><th>對象</th><th>內容</th></tr></thead>
    <tbody>${(data || []).map((x, i) => {
      const d = x.detail || {};
      const o = d.new || d.old || d;
      const brief = o.code || o.title || o.name || o.ticket_no || o.email || o.display_name || o.id || '';
      return `<tr><td>${fmt(x.at, false)}</td><td>${esc(x.actor_email || '系統')}</td><td>${esc(ACTION_LABEL[x.action] || x.action)}</td>
        <td>${esc(TARGET_LABEL[x.target] || x.target)}</td><td>${esc(String(brief).slice(0, 40))} <button class="btn xs" data-det="${i}">詳細</button></td></tr>`;
    }).join('')}</tbody></table></div></section>`;
  $$('[data-det]').forEach((b) => (b.onclick = () => modal({ title: '紀錄內容', wide: true, cancelText: '', confirmText: '關閉',
    body: `<pre class="mono" style="white-space:pre-wrap;font-size:.8rem;max-height:60vh;overflow:auto">${esc(JSON.stringify(data[b.dataset.det].detail, null, 2))}</pre>` })));
  $('#del-old').onclick = async () => {
    const days = Number($('#days').value || 0);
    if (!days || !(await modal({ title: `刪除 ${days} 天前的紀錄？`, danger: true, confirmText: '刪除', body: '<p>無法復原。</p>' }))) return;
    const { error: er } = await sb.from('audit_log').delete().lt('at', new Date(Date.now() - days * 864e5).toISOString());
    if (er) return toast(rpcError(er), 'error');
    toast('已刪除'); tabLogs();
  };
  $('#del-all').onclick = async () => {
    if (!(await modal({ title: '清空全部操作紀錄？', danger: true, confirmText: '清空', typeToConfirm: '清空', body: '<p>無法復原。</p>' }))) return;
    const { error: er } = await sb.from('audit_log').delete().gte('id', 0);
    if (er) return toast(rpcError(er), 'error');
    toast('已清空'); tabLogs();
  };
}

/* ================================================================
   寄提醒信給未交卷的考生
   ================================================================ */
const BATCH = 40;              // Edge Function 每次最多 40 人
const GMAIL_DAILY = 500;       // Gmail 每天寄信上限（一般帳號）
let mailDraft = null;          // 切換考試時保留編輯中的內容

async function mailComposer(e, rows, back) {
  $('.toolbar').style.display = 'none';
  const body = $('#regs-body');
  body.innerHTML = '<div class="skeleton"></div>';

  const [tpl, log] = await Promise.all([
    sb.from('mail_templates').select('subject, body').eq('key', 'unsubmitted').maybeSingle(),
    sb.from('mail_sends').select('registration_id, sent_at, ok, mail_batches!inner(exam_id)').eq('mail_batches.exam_id', e.id).order('sent_at', { ascending: false }),
  ]);
  if (tpl.error || log.error) {
    const msg = (tpl.error || log.error).message;
    body.innerHTML = `<div class="notice err">${icon('alert')}<span>讀不到寄信資料：${esc(msg)}<br>請先在 Supabase 執行 <code>0004_mail.sql</code>。</span></div>
      <button class="btn sm" id="mback">返回名單</button>`;
    $('#mback').onclick = back;
    return;
  }
  const saved = tpl.data || DEFAULT_MAIL;
  const draft = mailDraft || { subject: saved.subject, body: saved.body };
  const last = {};
  for (const r of log.data) if (r.ok && !last[r.registration_id]) last[r.registration_id] = r.sent_at;

  // 收件人：已報名、未交卷；停權或沒有 email 的列出來但不能勾
  const people = rows.filter((x) => !x.sub).map((x) => ({
    id: x.id, ticket_no: x.ticket_no, display_name: x.profiles?.display_name, email: x.profiles?.email,
    blocked: x.profiles?.banned ? '已停權' : !x.profiles?.email ? '沒有 email' : '',
  }));
  const picked = new Set(people.filter((p) => !p.blocked).map((p) => p.id));
  const now = Date.now();
  const closed = e.answer_end && new Date(e.answer_end).getTime() <= now;

  body.innerHTML = `
    <div class="mail-head">
      <button class="btn sm ghost" id="mback">← 返回名單</button>
      <h3>寄提醒信：${esc(e.code)}｜${esc(e.title)}</h3>
    </div>
    ${closed ? `<div class="notice warn">${icon('alert')}<span>登錄答案已經在 ${fmt(e.answer_end)} 截止，學生收到信也無法再送出。</span></div>` : ''}
    <div class="mail-grid">
      <div class="mail-col">
        <div class="mail-col-head"><b>收件人</b><span class="muted" id="mcount"></span></div>
        ${people.length ? `<div class="table-wrap mail-list"><table>
          <thead><tr><th class="c"><input type="checkbox" id="mall" title="全選"></th><th>准考證號</th><th>暱稱</th><th>Email</th><th>上次提醒</th></tr></thead>
          <tbody>${people.map((p) => `<tr class="${p.blocked ? 'off' : ''}">
            <td class="c"><input type="checkbox" data-pick="${p.id}" ${p.blocked ? 'disabled' : 'checked'}></td>
            <td class="mono">${esc(p.ticket_no)}</td><td>${esc(p.display_name || '')}</td>
            <td>${p.blocked ? `<span class="tag red">${p.blocked}</span>` : esc(p.email)}</td>
            <td>${last[p.id] ? `<span class="tag amber">${fmt(last[p.id], false)}</span>` : '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody></table></div>`
          : '<p class="muted">這場沒有未交卷的考生。</p>'}
        <p class="muted mail-note">只會寄給「已報名、還沒送出答案、沒被停權」的考生，伺服器寄出前會再檢查一次。已經交卷的人不會出現在這裡。</p>
      </div>

      <div class="mail-col">
        <label class="field"><span>主旨</span><input id="msub" maxlength="200"></label>
        <div class="field"><span>內文（點下面的變數插入到游標位置，寄出時會換成每個人自己的資料）</span>
          <div class="chips">${MAIL_VARS.map(([k, d]) => `<button type="button" class="chip" data-var="${k}" title="${esc(d)}">{${k}}</button>`).join('')}</div>
          <textarea id="mbody" rows="15" maxlength="5000"></textarea></div>
        <div id="mwarn"></div>
        <div class="btn-row">
          <button class="btn xs ghost" id="mreset">還原成預設範本</button>
          <button class="btn xs ghost" id="msave">存成預設範本</button>
        </div>
      </div>
    </div>

    <div class="mail-preview-wrap">
      <div class="mail-col-head"><b>預覽</b>
        <label class="field" style="margin:0"><select id="mwho"></select></label></div>
      <div class="mail-preview" id="mprev"></div>
    </div>

    <div class="btn-row mail-actions">
      <button class="btn" id="mtest">${icon('mail')}<span>寄測試信給自己</span></button>
      <button class="btn primary" id="msend">${icon('send')}<span>寄出</span></button>
      <span class="muted">寄件人是你在 Supabase 設定的 Gmail，學生直接回信就會寄到那個信箱。</span>
    </div>`;

  const subEl = $('#msub'), bodyEl = $('#mbody');
  subEl.value = draft.subject; bodyEl.value = draft.body;
  $('#mback').onclick = () => { mailDraft = null; back(); };

  const chosen = () => people.filter((p) => picked.has(p.id));
  const refresh = () => {
    mailDraft = { subject: subEl.value, body: bodyEl.value };
    const list = chosen();
    $('#mcount') && ($('#mcount').textContent = `已選 ${list.length} / ${people.filter((p) => !p.blocked).length} 人`);
    if ($('#mall')) {
      const avail = people.filter((p) => !p.blocked).length;
      $('#mall').checked = avail > 0 && list.length === avail;
      $('#mall').indeterminate = list.length > 0 && list.length < avail;
    }
    // 預覽對象
    const who = $('#mwho');
    const keep = who.value;
    const pool = list.length ? list : people.filter((p) => !p.blocked);
    who.innerHTML = pool.length ? pool.map((p) => `<option value="${p.id}">${esc(p.ticket_no)}｜${esc(p.display_name || '')}</option>`).join('')
      : '<option value="">（範例考生）</option>';
    if (pool.some((p) => p.id === keep)) who.value = keep;
    const p = pool.find((x) => x.id === who.value) || { ticket_no: `${e.code}-0001`, display_name: '小明', email: 'student@example.com' };
    const vars = mailVars(e, p, siteUrl());
    $('#mprev').innerHTML = `<div class="mp-meta"><div><span>收件人</span>${esc(p.email || '')}</div><div><span>主旨</span><b>${esc(fill(subEl.value, vars))}</b></div></div>${toHtml(fill(bodyEl.value, vars))}`;
    // 檢查
    const bad = unknownVars(subEl.value, bodyEl.value);
    const warns = [];
    if (bad.length) warns.push(`不認得的變數：${bad.map((k) => `{${esc(k)}}`).join('、')}。請改成上面列出的變數，或把大括號拿掉。`);
    if (!subEl.value.trim() || !bodyEl.value.trim()) warns.push('主旨和內文都不能空白。');
    if (list.length > GMAIL_DAILY - 50) warns.push(`一般 Gmail 帳號每天大約只能寄 ${GMAIL_DAILY} 封，這次選了 ${list.length} 人，超過的部分會寄送失敗。`);
    $('#mwarn').innerHTML = warns.map((w) => `<div class="notice ${bad.length || !subEl.value.trim() || !bodyEl.value.trim() ? 'err' : 'warn'}">${icon('alert')}<span>${w}</span></div>`).join('');
    const blocking = bad.length > 0 || !subEl.value.trim() || !bodyEl.value.trim();
    $('#msend').disabled = blocking || !list.length;
    $('#mtest').disabled = blocking || !pool.length;
    $('#msend span').textContent = list.length ? `寄出（${list.length} 人）` : '寄出';
  };

  $$('[data-pick]').forEach((c) => (c.onchange = () => { c.checked ? picked.add(c.dataset.pick) : picked.delete(c.dataset.pick); refresh(); }));
  $('#mall') && ($('#mall').onchange = (ev) => {
    $$('[data-pick]:not(:disabled)').forEach((c) => { c.checked = ev.target.checked; c.checked ? picked.add(c.dataset.pick) : picked.delete(c.dataset.pick); });
    refresh();
  });
  subEl.oninput = refresh; bodyEl.oninput = refresh; $('#mwho').onchange = refresh;
  let lastFocus = bodyEl;
  subEl.onfocus = () => (lastFocus = subEl); bodyEl.onfocus = () => (lastFocus = bodyEl);
  $$('[data-var]').forEach((b) => (b.onclick = () => {
    const el = lastFocus, v = `{${b.dataset.var}}`;
    const s = el.selectionStart ?? el.value.length, en = el.selectionEnd ?? s;
    el.value = el.value.slice(0, s) + v + el.value.slice(en);
    el.focus(); el.selectionStart = el.selectionEnd = s + v.length;
    refresh();
  }));
  $('#mreset').onclick = async () => {
    if (!(await modal({ title: '還原成預設範本？', body: '<p>目前編輯的主旨和內文會被取代。</p>', confirmText: '還原' }))) return;
    subEl.value = saved.subject; bodyEl.value = saved.body; refresh();
  };
  $('#msave').onclick = async () => {
    const { error } = await sb.from('mail_templates').upsert({ key: 'unsubmitted', subject: subEl.value, body: bodyEl.value, updated_at: new Date().toISOString() });
    if (error) return toast(rpcError(error), 'error');
    saved.subject = subEl.value; saved.body = bodyEl.value;
    toast('已存成預設範本，之後每場都會用這份');
  };

  const call = async (ids, test) => {
    const { data, error } = await sb.functions.invoke('send-reminder', {
      body: { exam_id: e.id, registration_ids: ids, subject: subEl.value, body: bodyEl.value, test },
    });
    if (error) {
      let msg = error.message;
      try { msg = (await error.context.json()).error || msg; } catch {}
      if (/Failed to send a request|Failed to fetch/i.test(msg)) msg = '連不到寄信服務，請確認 Edge Function「send-reminder」已部署';
      throw new Error(msg);
    }
    return data;
  };

  $('#mtest').onclick = async (ev) => {
    const btn = ev.currentTarget;
    const id = $('#mwho').value || people.find((p) => !p.blocked)?.id;
    if (!id) return;
    btn.disabled = true;
    try {
      const r = await call([id], true);
      if (r.failed?.length) toast(`測試信寄送失敗：${r.failed[0].error}`, 'error');
      else if (r.sent?.length) toast(`已寄測試信到 ${r.to}，內容用 ${$('#mwho').selectedOptions[0]?.textContent} 的資料`);
      else toast('這位考生已交卷或不能收信，換一位試試', 'error');
    } catch (err) { toast(err.message, 'error'); }
    btn.disabled = false;
  };

  $('#msend').onclick = async (ev) => {
    const btn = ev.currentTarget;
    const list = chosen();
    if (!list.length) return;
    const again = list.filter((p) => last[p.id]).length;
    const vars = mailVars(e, list[0], siteUrl());
    if (!(await modal({ title: `寄提醒信給 ${list.length} 位考生？`, confirmText: '確定寄出',
      body: `<p>主旨：<b>${esc(fill(subEl.value, vars))}</b>${list.length > 1 ? '（每個人的暱稱、准考證號會不一樣）' : ''}</p>
        ${again ? `<div class="notice warn">${icon('alert')}<span>其中 ${again} 人之前已經收過提醒信。</span></div>` : ''}
        <p class="muted">寄出後無法收回。建議先按「寄測試信給自己」確認內容。</p>` }))) return;

    btn.disabled = true;
    const sent = [], failed = [];
    let skipped = 0;
    for (let i = 0; i < list.length; i += BATCH) {
      btn.querySelector('span').textContent = `寄送中 ${Math.min(i + BATCH, list.length)} / ${list.length}`;
      try {
        const r = await call(list.slice(i, i + BATCH).map((p) => p.id), false);
        sent.push(...r.sent); failed.push(...r.failed); skipped += r.skipped || 0;
      } catch (err) {
        list.slice(i, i + BATCH).forEach((p) => failed.push({ ticket_no: p.ticket_no, error: err.message }));
        if (i === 0) break;   // 第一批就失敗（例如沒部署、Gmail 密碼錯）就不用繼續試
      }
    }
    mailDraft = { subject: subEl.value, body: bodyEl.value };
    await modal({ title: failed.length ? '部分信件沒有寄出' : '寄送完成', cancelText: '', confirmText: '好',
      body: `<p>成功 <b>${sent.length}</b> 封${failed.length ? `・失敗 <b style="color:var(--stamp)">${failed.length}</b> 封` : ''}${skipped ? `・略過 ${skipped} 人（寄送前已交卷或被停權）` : ''}。</p>
        ${failed.length ? `<div class="table-wrap" style="max-height:240px"><table><thead><tr><th>准考證號</th><th>原因</th></tr></thead><tbody>${
          failed.map((f) => `<tr><td class="mono">${esc(f.ticket_no)}</td><td class="wrap">${esc(f.error)}</td></tr>`).join('')}</tbody></table></div>` : ''}` });
    mailComposer(e, rows, back);   // 重新載入「上次提醒」
  };

  refresh();
}

// 前端網址（考場連結用；伺服器寄信時用 SITE_URL 設定）
const siteUrl = () => location.href.replace(/\/[^/]*$/, '');
