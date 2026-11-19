// 准考證「加入行事曆」：產生 .ics（Apple／Google／Outlook 行事曆都讀得懂）
// 同一時間的關卡會合併成一個事件；登錄答案截止前 1 天、2 小時各提醒一次。

const pad = (n) => String(n).padStart(2, '0');
const utc = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const escText = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

// RFC 5545：每行最多 75 bytes，超過要折行（中文一個字 3 bytes，要照 bytes 切）
const enc = new TextEncoder();
function fold(line) {
  const out = [];
  let cur = '', bytes = 0, limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) { out.push(cur); cur = ' '; bytes = 1; limit = 75; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join('\r\n');
}

const MIN = 60 * 1000;

/** 這場考試要放進行事曆的時間點 */
export function calendarItems(exam) {
  const items = [];
  const add = (ts, label, opts = {}) => { if (ts) items.push({ t: new Date(ts), label, ...opts }); };
  add(exam.exam_start, '題本開放・開始作答', { alarms: ['-PT15M'] });
  if (exam.answer_start && exam.answer_start !== exam.exam_start) add(exam.answer_start, '開放登錄答案');
  add(exam.release_key_at, '公布正解');
  add(exam.release_score_at, '成績單公布', { alarms: ['PT0M'] });
  add(exam.release_solution_at, '詳解公布');
  if (exam.rank_mode && exam.rank_mode !== 'none') add(exam.release_rank_at, '排名公布');
  add(exam.release_report_at, '全體分析公布');

  // 同一分鐘的合併
  const merged = [];
  for (const it of items.sort((a, b) => a.t - b.t)) {
    const last = merged[merged.length - 1];
    if (last && Math.abs(last.t - it.t) < MIN) {
      last.label += '、' + it.label;
      last.alarms = [...new Set([...(last.alarms || []), ...(it.alarms || [])])];
    } else merged.push({ ...it });
  }
  // 截止是最重要的：獨立事件、結束時間就是截止時間
  if (exam.answer_end) {
    const end = new Date(exam.answer_end);
    merged.push({ t: new Date(end - 30 * MIN), end, label: '【截止】登錄答案', alarms: ['-P1D', '-PT2H'], related: 'END' });
  }
  return merged.sort((a, b) => a.t - b.t);
}

export function buildICS(exam, ticketNo, url) {
  const now = utc(new Date());
  const desc = `准考證號：${ticketNo}\n考試頁面：${url}`;
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//suhao//mock-exam//ZH-TW', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${escText(exam.title)}`,
  ];
  calendarItems(exam).forEach((it, i) => {
    const end = it.end || new Date(it.t.getTime() + 30 * MIN);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${exam.id}-${i}-${it.t.getTime()}@mock-exam`,
      `DTSTAMP:${now}`,
      `DTSTART:${utc(it.t)}`,
      `DTEND:${utc(end)}`,
      `SUMMARY:${escText(`${exam.title}｜${it.label}`)}`,
      `DESCRIPTION:${escText(desc)}`,
      `URL:${url}`,
    );
    for (const a of it.alarms || []) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escText(it.label)}`,
        it.related === 'END' ? `TRIGGER;RELATED=END:${a}` : `TRIGGER:${a}`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function downloadICS(exam, ticketNo, url) {
  const blob = new Blob([buildICS(exam, ticketNo, url)], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${exam.code || 'mock-exam'}.ics`;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/** Google 日曆一次只能加一個事件：給最重要的「登錄答案截止」 */
export function googleCalendarURL(exam, ticketNo, url) {
  if (!exam.answer_end) return null;
  const end = new Date(exam.answer_end);
  const start = new Date(end - 30 * MIN);
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${exam.title}｜【截止】登錄答案`,
    dates: `${utc(start)}/${utc(end)}`,
    details: `准考證號：${ticketNo}\n考試頁面：${url}`,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}
