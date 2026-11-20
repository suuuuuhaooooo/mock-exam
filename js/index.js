import { sb, boot, app, $, esc, fmt, icon, statusOf, nextMilestone, countdown, signIn } from './core.js';

const HERO_ART = `<svg viewBox="0 0 320 220" aria-hidden="true">
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <rect x="58" y="22" width="190" height="176" rx="8" fill="var(--sheet)" stroke="var(--ink)" stroke-width="2" transform="rotate(-4 153 110)"/>
    <rect x="72" y="16" width="190" height="176" rx="8" fill="var(--card-tint)" stroke="var(--card-line)" stroke-width="2"/>
    <path d="M86 40h120" stroke="var(--card-line)" stroke-width="2"/>
    <text x="88" y="35" font-family="Noto Serif TC" font-weight="900" font-size="13" fill="var(--card-line)" stroke="none" letter-spacing="3">答 案 卡</text>
    ${[0, 1, 2, 3, 4, 5].map((r) => `
      <text x="92" y="${69 + r * 22}" font-family="IBM Plex Mono" font-size="11" fill="var(--card-line)" stroke="none" text-anchor="end">${r + 1}</text>
      ${[0, 1, 2, 3].map((c) => {
        const filled = [1, 3, 0, 2, 1, 3][r] === c;
        return `<ellipse cx="${112 + c * 30}" cy="${65 + r * 22}" rx="10" ry="6.5" stroke="${filled ? 'var(--ink)' : 'var(--card-line)'}" stroke-width="1.6" fill="${filled ? 'var(--ink)' : 'none'}"/>`;
      }).join('')}`).join('')}
    <circle cx="250" cy="168" r="30" stroke="var(--stamp)" stroke-width="3" fill="var(--sheet)" opacity=".92" transform="rotate(-12 250 168)"/>
    <text x="250" y="166" text-anchor="middle" font-family="Noto Serif TC" font-weight="900" font-size="17" fill="var(--stamp)" stroke="none" transform="rotate(-12 250 168)">A++</text>
    <text x="250" y="183" text-anchor="middle" font-family="Noto Serif TC" font-weight="700" font-size="9" fill="var(--stamp)" stroke="none" transform="rotate(-12 250 168)">精 熟</text>
    <path d="M196 110l52-52 9 9-52 52-13 4z" fill="var(--warn-soft)" stroke="var(--ink)" stroke-width="1.8"/>
    <path d="M241 65l9 9" stroke="var(--ink)" stroke-width="1.8"/>
    <path d="M30 200c40-8 80 4 120-2s70-6 140 0" stroke="var(--rule)" stroke-width="1.6" stroke-dasharray="3 5"/>
  </g></svg>`;

await boot();
const main = $('#main');

const { data: exams, error } = await sb.from('exams').select('*')
  .eq('status', 'published').order('answer_start', { ascending: false, nullsFirst: false });

const now = Date.now();
let myRegs = new Set();
if (app.user) {
  // 管理員的存取規則看得到所有人的報名，所以要限定自己
  const { data } = await sb.from('registrations').select('exam_id').eq('user_id', app.user.id);
  myRegs = new Set((data || []).map((r) => r.exam_id));
}

main.innerHTML = `
  <section class="sheet hero tape">
    <div>
      <div class="kicker">MOCK EXAM・CAP SCIENCE</div>
      <h1>蘇昊數理<span class="dot">．</span>會考模擬考</h1>
      <p class="muted">比照會考規格出題，線上報名、登錄答案，依排定時間公布正解、個人成績單、詳解和全體試題分析。</p>
      <div class="btn-row">
        ${app.user
          ? `<a class="btn primary" href="#list">${icon('calendar')}<span>查看考試</span></a>
             <a class="btn" href="history.html">${icon('history')}<span>我的紀錄</span></a>`
          : `<button class="btn primary" id="hero-login">${icon('user')}<span>Google 登入報名</span></button>`}
      </div>
      <div class="steps">
        <div><span class="n">01</span><b>報名</b>領取准考證號</div>
        <div><span class="n">02</span><b>應考</b>下載題本，計時作答</div>
        <div><span class="n">03</span><b>登錄答案</b>截止前可修改</div>
        <div><span class="n">04</span><b>成績單</b>等級、PR、弱點分析</div>
      </div>
    </div>
    <div class="hero-art">${HERO_ART}</div>
  </section>

  <section id="list">
    <div class="sheet-head" style="border:0"><h2>${icon('calendar')} 考試總覽</h2></div>
    ${error ? `<div class="notice err">${icon('alert')}<span>讀取失敗：${esc(error.message)}</span></div>` : ''}
    ${!exams?.length && !error ? `<div class="sheet empty">${icon('calendar', 'big')}<p>目前還沒有公布的考試，請留意 Threads 公告。</p></div>` : ''}
    <div class="exam-list">${(exams || []).map((e) => {
      const st = statusOf(e, now);
      const nx = nextMilestone(e, now);
      return `<a class="exam-card" href="exam.html?id=${e.id}">
        <span class="code">${esc(e.code)}・${esc(e.subject)}・${e.num_questions} 題</span>
        <h3>${esc(e.title)}</h3>
        <span class="badge ${st.tone}">${esc(st.label)}</span>
        ${myRegs.has(e.id) ? `<span class="tag green">${icon('check')} 已報名</span>` : ''}
        <span class="next">${icon('clock')}${nx ? `${esc(nx.label)}：${fmt(new Date(nx.t), false)}（${countdown(nx.t, now)}後）` : '所有階段皆已公布'}</span>
      </a>`;
    }).join('')}</div>
  </section>`;

$('#hero-login')?.addEventListener('click', signIn);
