// 計分與試題分析（公式同心測中心《會考試題分析》）

export const CAP_NATURE_115 = [
  { level: 'A++', min_correct: 47 }, { level: 'A+', min_correct: 46 }, { level: 'A', min_correct: 43 },
  { level: 'B++', min_correct: 36 }, { level: 'B+', min_correct: 29 }, { level: 'B', min_correct: 19 },
  { level: 'C', min_correct: 0 },
];
export const BANDS = ['精熟', '基礎', '待加強'];

const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

export function normKey(key) {
  return (key || []).map((k) => ({ q: k.q_no, a: k.answer, unit: k.unit || '', pts: Number(k.points ?? 1) }));
}

export function score(ans, key) {
  let correct = 0, points = 0;
  for (const k of key) if (ans[k.q - 1] === k.a) { correct++; points += k.pts; }
  return { correct, points };
}

export function levelOf(correct, levels) {
  const s = [...(levels || [])].sort((a, b) => b.min_correct - a.min_correct);
  for (const l of s) if (correct >= l.min_correct) return l.level;
  return null;
}

export function bandOf(level) {
  if (!level) return null;
  if (level[0] === 'A') return '精熟';
  if (level[0] === 'B') return '基礎';
  return '待加強';
}

/** 百分等級：(低於者 + 同分者/2) / 全體，取 1～99 */
export function prOf(points, allPoints) {
  const n = allPoints.length;
  if (!n) return null;
  const below = allPoints.filter((p) => p < points).length;
  const equal = allPoints.filter((p) => p === points).length;
  return Math.min(99, Math.max(1, Math.floor(((below + equal / 2) * 100) / n)));
}

/**
 * @param {string[]} answers  每位考生的作答字串，'-' 表示未作答
 * @param {object[]} keyRaw   [{q_no, answer, unit, points}]
 * @param {object[]} levels   [{level, min_correct}]
 */
export function analyze(answers, keyRaw, levels, options = 'ABCD') {
  const key = normKey(keyRaw);
  const n = answers.length;
  const rows = answers.map((a) => {
    const s = score(a, key);
    const level = levelOf(s.correct, levels);
    return { a, ...s, level, band: bandOf(level) };
  });
  const pts = rows.map((r) => r.points);
  const mean = avg(pts);
  const sd = n ? Math.sqrt(avg(pts.map((x) => (x - mean) ** 2))) : null;
  const totalPoints = key.reduce((s, k) => s + k.pts, 0);
  const optList = [...options, '-'];

  const questions = key.map((k) => {
    const pick = (r) => { const c = r.a[k.q - 1] || '-'; return optList.includes(c) ? c : '-'; };
    const right = rows.filter((r) => r.a[k.q - 1] === k.a);
    const wrong = rows.filter((r) => r.a[k.q - 1] !== k.a);
    const p = n ? right.length / n : null;
    const q = p == null ? null : 1 - p;
    // 點二系列相關：(答對者平均總分 − 答錯者平均總分) / 總分標準差 × √(pq)
    const disc = n && sd > 0 && p > 0 && p < 1
      ? ((avg(right.map((r) => r.points)) - avg(wrong.map((r) => r.points))) / sd) * Math.sqrt(p * q)
      : null;
    const dist = (group) => {
      const o = Object.fromEntries(optList.map((x) => [x, 0]));
      group.forEach((r) => o[pick(r)]++);
      const m = group.length || 1;
      return Object.fromEntries(optList.map((x) => [x, group.length ? o[x] / m : null]));
    };
    const counts = Object.fromEntries(optList.map((x) => [x, 0]));
    rows.forEach((r) => counts[pick(r)]++);
    const byBand = {}, distByBand = {};
    for (const b of BANDS) {
      const g = rows.filter((r) => r.band === b);
      byBand[b] = g.length ? g.filter((r) => r.a[k.q - 1] === k.a).length / g.length : null;
      distByBand[b] = dist(g);
    }
    return { q: k.q, key: k.a, unit: k.unit, pts: k.pts, p, disc, counts, dist: dist(rows), byBand, distByBand };
  });

  const levelOrder = [...(levels || [])].sort((a, b) => b.min_correct - a.min_correct).map((l) => l.level);
  const levelDist = levelOrder.map((lv) => {
    const c = rows.filter((r) => r.level === lv).length;
    return { level: lv, band: bandOf(lv), count: c, ratio: n ? c / n : null };
  });
  const bandDist = BANDS.map((b) => {
    const c = rows.filter((r) => r.band === b).length;
    return { band: b, count: c, ratio: n ? c / n : null };
  });

  const maxPts = Math.ceil(totalPoints);
  const hist = Array.from({ length: maxPts + 1 }, (_, i) => ({ x: i, count: 0 }));
  rows.forEach((r) => { const i = Math.min(maxPts, Math.max(0, Math.floor(r.points))); hist[i].count++; });

  const unitMap = new Map();
  questions.forEach((qq) => {
    const u = qq.unit || '未分類';
    if (!unitMap.has(u)) unitMap.set(u, []);
    unitMap.get(u).push(qq);
  });
  const units = [...unitMap].map(([unit, qs]) => ({ unit, count: qs.length, p: avg(qs.map((x) => x.p ?? 0)), qs: qs.map((x) => x.q) }));

  const sorted = [...pts].sort((a, b) => a - b);
  const median = n ? (n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2) : null;

  return { n, mean, sd, median, max: n ? sorted[n - 1] : null, min: n ? sorted[0] : null,
           totalPoints, rows, questions, levelDist, bandDist, hist, units, options: optList };
}

/** 有效作答判定（規則與後端 sub_valid 相同） */
export function validity(answers, exam, excluded = false, reason = '') {
  if (!answers) return { valid: false, reason: '未交卷' };
  if (excluded) return { valid: false, reason: reason ? `手動排除：${reason}` : '手動排除' };
  const filled = answers.replace(/-/g, '');
  if (!filled.length) return { valid: false, reason: '全部空白' };
  if (exam.min_answered && filled.length < exam.min_answered) return { valid: false, reason: `只作答 ${filled.length} 題（少於 ${exam.min_answered} 題）` };
  if (exam.max_same_ratio) {
    const c = {};
    for (const ch of filled) c[ch] = (c[ch] || 0) + 1;
    const [opt, max] = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
    if (max / filled.length >= Number(exam.max_same_ratio)) return { valid: false, reason: `${Math.round((max / filled.length) * 100)}% 都選 ${opt}` };
  }
  return { valid: true, reason: '' };
}

/** 個人單元分析：自己每單元答對率 vs 全體 */
export function unitCompare(questions) {
  const m = new Map();
  for (const q of questions) {
    const u = q.unit || '未分類';
    if (!m.has(u)) m.set(u, { unit: u, count: 0, mine: 0, all: 0 });
    const o = m.get(u);
    o.count++;
    if (q.mine === q.answer) o.mine++;
    o.all += Number(q.pass_rate || 0);
  }
  return [...m.values()].map((o) => ({ ...o, mineRate: o.mine / o.count, allRate: o.all / o.count }));
}
