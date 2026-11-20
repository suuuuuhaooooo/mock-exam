import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SITE_NAME, AUTHOR } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/* ------------------------------------------------------------------ *
 * 小工具
 * ------------------------------------------------------------------ */
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pct = (v, d = 0) => (v == null || Number.isNaN(v) ? '—' : (v * 100).toFixed(d) + '%');
export const num = (v, d = 2) => (v == null || Number.isNaN(v) ? '—' : Number(v).toFixed(d));
export const qs = (k) => new URLSearchParams(location.search).get(k);

const TZ = 'Asia/Taipei';
export function fmt(ts, withYear = true) {
  if (!ts) return '未設定';
  const d = new Date(ts);
  const o = { timeZone: TZ, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' };
  if (withYear) o.year = 'numeric';
  return d.toLocaleString('zh-TW', o);
}

// datetime-local <-> ISO（以瀏覽器時區，管理員在台灣時即為台灣時間）
export function toLocalInput(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d - off).toISOString().slice(0, 16);
}
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

export function rpcError(e) {
  const m = e?.message || String(e);
  return m.replace(/^.*?ERROR:\s*/, '');
}

/* ------------------------------------------------------------------ *
 * 圖示（手繪感線條 SVG）
 * ------------------------------------------------------------------ */
const P = {
  pencil: '<path d="M4 20l1.2-4.6L15.6 5a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8 4 20z"/><path d="M13.5 7.2l3.3 3.3"/>',
  ticket: '<path d="M3.5 7.5a1.5 1.5 0 0 1 1.5-1.5h14a1.5 1.5 0 0 1 1.5 1.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-2a2.5 2.5 0 0 0 0-5z"/><path d="M14.5 6.5v11" stroke-dasharray="1.6 2.2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.2V12l3.2 2"/>',
  user: '<circle cx="12" cy="8.2" r="3.7"/><path d="M4.6 20c.9-3.6 3.9-5.6 7.4-5.6s6.5 2 7.4 5.6"/>',
  users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c.7-3.1 3.1-4.8 6-4.8s5.3 1.7 6 4.8"/><path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.5 14.9c1.8.6 3 2.1 3.5 4.4"/>',
  logout: '<path d="M14 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H14"/><path d="M10.5 12h10M17 8.5l3.5 3.5-3.5 3.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  moon: '<path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1z"/>',
  system: '<rect x="3" y="4.5" width="18" height="12" rx="1.8"/><path d="M8.5 20h7M12 16.5V20"/><path d="M12 4.5v12" stroke-dasharray="1.5 2"/>',
  chart: '<path d="M4 20V4"/><path d="M4 20h16"/><rect x="7" y="11" width="3" height="6" rx=".6"/><rect x="12" y="7" width="3" height="10" rx=".6"/><rect x="17" y="13" width="3" height="4" rx=".6"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/><circle cx="12" cy="15.5" r="1.3"/>',
  check: '<path d="M5 12.5l4.3 4.3L19 7.2"/>',
  cross: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M4.5 19.5h15"/>',
  printer: '<path d="M7 9V4h10v5"/><rect x="3.5" y="9" width="17" height="7.5" rx="1.6"/><path d="M7 14h10v6H7z"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l1 13h9l1-13"/><path d="M10.2 10.5v6M13.8 10.5v6"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="1.8"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  shield: '<path d="M12 3.5l7 2.6v5.4c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V6.1z"/><path d="M9 12l2.2 2.2L15.2 10"/>',
  book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15.5H5.5A1.5 1.5 0 0 1 4 18z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15.5h5.5A1.5 1.5 0 0 0 20 18z"/>',
  flag: '<path d="M5.5 21V4"/><path d="M5.5 4.5h11.5l-2.5 4 2.5 4H5.5"/>',
  history: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4.5v3.8h3.8"/><path d="M12 8v4.3l2.8 1.7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M5.5 18.5l1.9-1.9M16.6 7.4l1.9-1.9"/>',
  alert: '<path d="M12 4l9 15.5H3z"/><path d="M12 10v4.3"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
  star: '<path d="M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z"/>',
  share: '<circle cx="17.5" cy="5.8" r="2.4"/><circle cx="6.5" cy="12" r="2.4"/><circle cx="17.5" cy="18.2" r="2.4"/><path d="M8.6 10.8l6.8-3.8M8.6 13.2l6.8 3.8"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="9.5" r="1.7"/><path d="M4 17.5l5-4.6 3.6 3.2 2.6-2.2 4.8 4"/>',
  bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.8h-14z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>',
  send: '<path d="M20.5 3.5 10 14"/><path d="M20.5 3.5 14 20.5l-4-6.5-6.5-4z"/>',
};
export function icon(name, cls = '') {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

// 品牌標誌：答案卡上的劃記圈＋筆跡
export const LOGO = `<svg class="logo" viewBox="0 0 48 48" aria-hidden="true">
  <rect x="5" y="6" width="38" height="36" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <path d="M5 15h38" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 2.6"/>
  <ellipse cx="15" cy="27" rx="4.2" ry="3.2" fill="none" stroke="var(--card-line)" stroke-width="1.6"/>
  <ellipse cx="24" cy="27" rx="4.2" ry="3.2" fill="var(--ink)"/>
  <ellipse cx="33" cy="27" rx="4.2" ry="3.2" fill="none" stroke="var(--card-line)" stroke-width="1.6"/>
  <path d="M12 36.5c5-1.8 10 1.6 15-.4s7.5-.6 9.5.2" fill="none" stroke="var(--stamp)" stroke-width="1.8" stroke-linecap="round"/>
</svg>`;

/* ------------------------------------------------------------------ *
 * 主題：淺色／深色／跟隨系統
 * ------------------------------------------------------------------ */
const THEMES = ['light', 'dark', 'system'];
const THEME_LABEL = { light: '淺色', dark: '深色', system: '跟隨系統' };
const THEME_ICON = { light: 'sun', dark: 'moon', system: 'system' };
function getTheme() { try { return localStorage.getItem('me-theme') || 'system'; } catch { return 'system'; } }
function applyTheme(t) {
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.themePref = t;
}
applyTheme(getTheme());
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(getTheme()));

/* ------------------------------------------------------------------ *
 * 前端保護：禁止右鍵、選取、複製、拖曳、常見開發者工具快捷鍵
 * （真正的資料保護在後端的存取規則與時間鎖）
 * ------------------------------------------------------------------ */
const editable = (el) => {
  const n = el?.nodeType === 3 ? el.parentElement : el;
  return !!n?.closest?.('input, textarea, select, [contenteditable="true"]');
};
document.addEventListener('contextmenu', (e) => { if (!editable(e.target)) e.preventDefault(); });
document.addEventListener('selectstart', (e) => { if (!editable(e.target)) e.preventDefault(); });
['copy', 'cut'].forEach((t) => document.addEventListener(t, (e) => { if (!editable(e.target)) e.preventDefault(); }));
document.addEventListener('dragstart', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  if (k === 'f12' ||
      (mod && e.shiftKey && ['i', 'j', 'c', 'k'].includes(k)) ||
      (e.metaKey && e.altKey && ['i', 'j', 'c', 'u'].includes(k)) ||
      (mod && ['u', 's', 'p'].includes(k)) ||
      (mod && k === 'a' && !editable(e.target))) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

/* ------------------------------------------------------------------ *
 * 提示訊息、對話框
 * ------------------------------------------------------------------ */
export function toast(msg, tone = 'info') {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.append(box); }
  const t = document.createElement('div');
  t.className = `toast toast-${tone}`;
  t.innerHTML = `${icon(tone === 'error' ? 'alert' : 'check')}<span>${esc(msg)}</span>`;
  box.append(t);
  setTimeout(() => t.classList.add('out'), 3200);
  setTimeout(() => t.remove(), 3700);
}

export function modal({ title, body, confirmText = '確定', cancelText = '取消', danger = false, typeToConfirm = null, wide = false }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      <h3>${esc(title)}</h3>
      <div class="modal-body">${body || ''}</div>
      ${typeToConfirm ? `<label class="field"><span>請輸入 <b>${esc(typeToConfirm)}</b> 確認</span><input class="ttc" autocomplete="off"></label>` : ''}
      <div class="modal-actions">
        ${cancelText ? `<button class="btn ghost" data-a="no">${esc(cancelText)}</button>` : ''}
        <button class="btn ${danger ? 'danger' : 'primary'}" data-a="ok">${esc(confirmText)}</button>
      </div></div>`;
    document.body.append(wrap);
    const ok = $('[data-a="ok"]', wrap);
    if (typeToConfirm) {
      ok.disabled = true;
      $('.ttc', wrap).addEventListener('input', (e) => { ok.disabled = e.target.value.trim() !== typeToConfirm; });
    }
    // 沒有「取消」按鈕的對話框（例如第一次登入必填資料）不能用點背景或 Esc 關掉
    const dismissable = !!cancelText;
    const close = (v) => { document.removeEventListener('keydown', onKey, true); wrap.remove(); resolve(v); };
    const onKey = (e) => {
      if (e.key === 'Escape' && dismissable) { e.preventDefault(); close(null); }
      else if (e.key === 'Enter' && e.target.matches?.('input') && !ok.disabled) { e.preventDefault(); close(wrap); }
    };
    document.addEventListener('keydown', onKey, true);
    wrap.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'ok') close(wrap);
      else if (a === 'no' || (e.target === wrap && dismissable)) close(null);
    });
    setTimeout(() => ($('input, select, textarea', wrap) || ok).focus(), 30);
  });
}

// 只列印指定區塊
export function printSection(el) {
  el.classList.add('print-target');
  document.body.classList.add('printing');
  const done = () => { el.classList.remove('print-target'); document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
  setTimeout(done, 1500);
}

/* ------------------------------------------------------------------ *
 * 考試時間軸
 * ------------------------------------------------------------------ */
export function stagesOf(e) {
  return [
    { key: 'register', label: '報名', start: e.register_start, end: e.register_end },
    { key: 'exam', label: '題本開放', start: e.exam_start },
    { key: 'answer', label: '登錄答案', start: e.answer_start, end: e.answer_end },
    { key: 'key', label: '公布正解', start: e.release_key_at },
    { key: 'score', label: '成績單', start: e.release_score_at },
    { key: 'solution', label: '詳解', start: e.release_solution_at },
    { key: 'rank', label: '排名', start: e.release_rank_at, hidden: e.rank_mode === 'none' },
    { key: 'report', label: '全體分析', start: e.release_report_at },
  ].filter((s) => !s.hidden);
}
export const reached = (ts, now) => !!ts && now >= new Date(ts).getTime();
export const within = (s, e, now) => reached(s, now) && (!e || now <= new Date(e).getTime());

export function statusOf(e, now) {
  if (reached(e.release_report_at, now)) return { label: '分析報告已公布', tone: 'done' };
  if (reached(e.release_score_at, now)) return { label: '成績已公布', tone: 'done' };
  if (within(e.answer_start, e.answer_end, now)) return { label: '答案登錄中', tone: 'live' };
  if (e.answer_end && reached(e.answer_end, now)) return { label: '已截止・成績待公布', tone: 'wait' };
  if (within(e.register_start, e.register_end, now)) return { label: '報名中', tone: 'live' };
  if (!reached(e.register_start, now)) return { label: '即將開放報名', tone: 'soon' };
  return { label: '報名已截止・等待開考', tone: 'wait' };
}

export function nextMilestone(e, now) {
  const pts = [];
  for (const s of stagesOf(e)) {
    if (s.start) pts.push({ t: new Date(s.start).getTime(), label: s.label + (s.end ? '開始' : '') });
    if (s.end) pts.push({ t: new Date(s.end).getTime(), label: s.label + '截止' });
  }
  return pts.filter((p) => p.t > now).sort((a, b) => a.t - b.t)[0] || null;
}

export function timelineHTML(e, now) {
  return `<ol class="timeline">${stagesOf(e).map((s) => {
    const started = reached(s.start, now);
    const ended = s.end ? reached(s.end, now) : started;
    const state = !s.start ? 'unset' : ended ? 'done' : started ? 'now' : 'todo';
    return `<li class="tl-${state}"><span class="tl-dot"></span>
      <b>${esc(s.label)}</b>
      <small>${s.start ? fmt(s.start, false) : '未排定'}${s.end ? ' ～ ' + fmt(s.end, false) : ''}</small></li>`;
  }).join('')}</ol>`;
}

export function countdown(ts, now) {
  let ms = new Date(ts).getTime() - now;
  if (ms <= 0) return '即將更新';
  const d = Math.floor(ms / 864e5); ms -= d * 864e5;
  const h = Math.floor(ms / 36e5); ms -= h * 36e5;
  const m = Math.ceil(ms / 6e4);
  return (d ? `${d} 天 ` : '') + (h ? `${h} 小時 ` : '') + `${m} 分`;
}

/* ------------------------------------------------------------------ *
 * 登入、個人資料、頁首頁尾
 * ------------------------------------------------------------------ */
export const app = { session: null, user: null, profile: null, isAdmin: false, groups: [] };

export async function signIn() {
  const redirectTo = location.href.split('#')[0];
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  if (error) toast(rpcError(error), 'error');
}
export async function signOut() { await sb.auth.signOut(); location.href = 'index.html'; }

async function loadProfile() {
  if (!app.user) return;
  const { data } = await sb.from('profiles').select('*').eq('id', app.user.id).maybeSingle();
  app.profile = data;
  app.isAdmin = data?.role === 'admin';
  const g = await sb.rpc('my_groups');
  app.groups = g.data || [];
}

export const GRADES = ['國一', '國二', '國三', '高中', '其他'];
// 考生資料是否齊全（報名需要暱稱、年級、學校）
export const profileComplete = (p) => !!(p?.display_name && p?.grade && p?.school);

export async function editProfile(required = false, draft = null) {
  const p = app.profile || {};
  const { SCHOOLS } = await import('./schools.js').catch(() => ({ SCHOOLS: [] }));
  const hasList = SCHOOLS.length > 0;
  const d = draft || { dn: p.display_name || '', gr: p.grade || '', code: p.school_code || '', school: p.school || '' };
  // 從學校代碼找回縣市
  let county = '';
  if (d.code) for (const [c, list] of SCHOOLS) if (list.some((s) => s[0] === d.code)) county = c;
  const manual = !hasList || (!county && !!d.school);
  if (manual && hasList && d.school) county = '__other';
  const missing = p.display_name && !profileComplete(p);

  const pr = modal({
    title: !p.display_name ? '第一次登入：填寫考生資料' : required ? '請補填考生資料' : '編輯考生資料',
    body: `${missing && required ? '<div class="notice warn" style="margin-bottom:12px"><span>報名需要年級和學校，請補填後再繼續。</span></div>' : ''}
      <p class="muted">暱稱會出現在准考證和排行榜上，請不要填真實全名。</p>
      ${!p.display_name ? '<p class="muted" style="font-size:.85rem">繼續使用即表示同意<a href="terms.html" target="_blank">使用條款</a>與<a href="privacy.html" target="_blank">隱私權政策</a>。未滿 18 歲請先經家長同意。</p>' : ''}
      <label class="field"><span>暱稱（必填，20 字內）</span><input name="dn" maxlength="20" value="${esc(d.dn)}"></label>
      <label class="field"><span>年級（必填）</span><select name="gr"><option value="">請選擇</option>${GRADES.map((g) => `<option ${d.gr === g ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
      <div class="field"><span>學校（必填）</span>
        ${hasList ? `<div class="school-pick">
          <select name="county" aria-label="縣市"><option value="">選擇縣市</option>${SCHOOLS.map(([c]) => `<option ${county === c ? 'selected' : ''}>${c}</option>`).join('')}
            <option value="__other" ${county === '__other' ? 'selected' : ''}>其他（自學、實驗教育、海外等）</option></select>
          <select name="sch" aria-label="學校"></select>
        </div>` : ''}
        <input name="sc" maxlength="40" placeholder="請輸入學校全名，例如：臺北市立大安國中" value="${esc(manual ? d.school : '')}">
      </div>`,
    confirmText: '儲存', cancelText: required ? '' : '取消',
  });
  const w = $$('.modal-wrap').at(-1);
  const cSel = $('[name=county]', w), sSel = $('[name=sch]', w), scIn = $('[name=sc]', w);
  const fillSchools = (keep) => {
    if (!cSel) return;
    const c = cSel.value;
    const list = SCHOOLS.find(([x]) => x === c)?.[1] || [];
    sSel.innerHTML = c === '__other' ? '' : `<option value="">${c ? '選擇學校' : '先選縣市'}</option>${list.map(([code, name]) => `<option value="${code}" ${keep === code ? 'selected' : ''}>${esc(name)}</option>`).join('')}
      ${c ? '<option value="__manual">找不到我的學校，自行填寫</option>' : ''}`;
    if (keep === '__manual') sSel.value = '__manual';
    sSel.style.display = c === '__other' ? 'none' : '';
    sSel.disabled = !c;
    const typing = c === '__other' || sSel.value === '__manual';
    scIn.style.display = typing ? '' : 'none';
    if (typing && document.activeElement !== scIn) scIn.focus();
  };
  if (cSel) {
    fillSchools(d.code || (manual && county !== '__other' && d.school ? '__manual' : ''));
    cSel.onchange = () => { fillSchools(''); };
    sSel.onchange = () => fillSchools(sSel.value);
  }

  if (!(await pr)) return false;
  const dn = $('[name=dn]', w).value.trim();
  const gr = $('[name=gr]', w).value;
  let code = null, school = '';
  const typed = !cSel || cSel.value === '__other' || sSel.value === '__manual';
  if (typed) school = scIn.value.trim();
  else if (sSel.value) {
    const hit = SCHOOLS.find(([x]) => x === cSel.value)[1].find((s) => s[0] === sSel.value);
    code = hit[0]; school = hit[2];
  }
  const next = { dn, gr, code: code || (typed ? '' : d.code), school: typed ? school : (school || '') };
  const err = !dn ? '請填寫暱稱' : !gr ? '請選擇年級' : !school ? (typed ? '請輸入學校名稱' : '請選擇學校') : '';
  if (err) { toast(err, 'error'); return editProfile(required, { ...next, code: typed ? '' : sSel?.value || '', school: typed ? scIn.value : '' }); }

  const { error } = await sb.from('profiles').update({ display_name: dn, grade: gr, school, school_code: code }).eq('id', app.user.id);
  if (error) { toast(rpcError(error), 'error'); return editProfile(required, next); }
  await loadProfile();
  renderHeader();
  toast('已儲存考生資料');
  return true;
}

function renderHeader() {
  const here = location.pathname.split('/').pop() || 'index.html';
  const link = (href, label, ic) => `<a href="${href}" class="${here === href ? 'on' : ''}">${icon(ic)}<span>${label}</span></a>`;
  const pref = document.documentElement.dataset.themePref;
  const head = $('#site-header');
  head.innerHTML = `
    <a class="brand" href="index.html">${LOGO}<span><b>蘇昊數理</b><i>．</i>會考模擬考</span></a>
    <nav class="nav">
      ${link('index.html', '考試總覽', 'calendar')}
      ${app.user ? link('history.html', '我的紀錄', 'history') : ''}
      ${app.groups.length || app.isAdmin ? link('group.html', '團體成績', 'users') : ''}
      ${app.isAdmin ? link('admin.html', '後台', 'gear') : ''}
    </nav>
    <div class="head-tools">
      <button class="icon-btn" id="theme-btn" title="主題：${THEME_LABEL[pref]}">${icon(THEME_ICON[pref])}</button>
      ${app.user
        ? `<button class="chip" id="me-btn">${icon('user')}<span>${esc(app.profile?.display_name || '考生')}</span></button>
           <button class="icon-btn" id="out-btn" title="登出">${icon('logout')}</button>`
        : `<button class="btn primary sm" id="in-btn">${GOOGLE_G}<span>Google 登入</span></button>`}
    </div>`;
  $('#theme-btn').onclick = () => {
    const next = THEMES[(THEMES.indexOf(getTheme()) + 1) % 3];
    try { localStorage.setItem('me-theme', next); } catch {}
    applyTheme(next); renderHeader(); toast(`主題：${THEME_LABEL[next]}`);
  };
  $('#in-btn')?.addEventListener('click', signIn);
  $('#out-btn')?.addEventListener('click', signOut);
  $('#me-btn')?.addEventListener('click', () => editProfile(false));
}

const GOOGLE_G = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" opacity=".95"/><path fill="#fff" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" opacity=".8"/><path fill="#fff" d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9z" opacity=".65"/><path fill="#fff" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5L6.4 10C7.2 7.8 9.4 6 12 6z" opacity=".9"/></svg>`;

// 授權標章：Creative Commons 官方 SVG（向量，任何縮放、高解析螢幕都不會糊）
const CC = {
  label: 'CC BY-NC-ND 4.0（網站說明文字；題本、詳解除外）',
  deed: 'https://creativecommons.org/licenses/by-nc-nd/4.0/deed.zh_TW',
  badge: 'https://mirrors.creativecommons.org/presskit/buttons/88x31/svg/by-nc-nd.svg',
};

function renderFooter() {
  const f = $('#site-footer');
  if (!f) return;
  f.innerHTML = `
    <div class="foot-inner">
      <div class="foot-brand">${LOGO}<div><b>${esc(SITE_NAME)}</b><small>題本、詳解與試題分析保留所有權利，未經同意不得轉載。</small></div></div>
      <div class="foot-links">
        <a href="${AUTHOR.threads}" target="_blank" rel="noopener">Threads @suuuuuhaooooo</a>
        <a href="${AUTHOR.sponsor}" target="_blank" rel="noopener">贊助作者</a>
        <a href="terms.html">使用條款</a>
        <a href="privacy.html">隱私權政策</a>
      </div>
      <div class="foot-cc">
        <a href="${CC.deed}" target="_blank" rel="noopener license" title="${CC.label}">
          <img class="cc" src="${CC.badge}" width="88" height="31" alt="${CC.label}" loading="lazy" decoding="async">
        </a>
        <span>made by suuuuuhaooooo</span>
      </div>
    </div>`;
}

/** 每個頁面一開始呼叫：載入登入狀態、畫頁首頁尾 */
export async function boot() {
  const { data } = await sb.auth.getSession();
  app.session = data.session;
  app.user = data.session?.user || null;
  await loadProfile();
  renderHeader();
  renderFooter();
  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === 'SIGNED_IN' && !app.user) location.reload();
    if (ev === 'SIGNED_OUT') { app.user = null; app.profile = null; }
    app.session = session;
  });
  // 第一次登入要填暱稱；一般考生缺年級或學校也要補填（管理員只需要暱稱）
  if (app.user && app.profile && !app.profile.display_name) await editProfile(true);
  else if (app.user && app.profile && !app.isAdmin && !profileComplete(app.profile)) editProfile(true);   // 頁面照常載入，表單蓋在上面
  return app;
}

export function loginPrompt(msg = '請先登入才能使用這個功能') {
  return `<div class="empty">${icon('lock', 'big')}<p>${esc(msg)}</p>
    <button class="btn primary" onclick="window.__signIn()">${GOOGLE_G}<span>使用 Google 登入</span></button></div>`;
}
window.__signIn = signIn;

export function csvDownload(filename, rows) {
  const text = rows.map((r) => r.map((c) => {
    let s = String(c ?? '');
    // 暱稱、學校是學生自己填的：開頭是 = + @ 之類的字元，Excel 會當成公式執行，前面加 ' 擋掉
    if (/^[=+@\t\r]/.test(s) || /^-[^\d-]/.test(s)) s = "'" + s;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
