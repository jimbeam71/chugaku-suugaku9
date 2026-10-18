// レベル9の問題データ生成: node gen9.js -> src/data.js
// 手書き10問（src/handmade.js）＋ 計算で作る問題。誤答は「よくあるまちがい」から作り、理由も一緒に付ける。
const fs = require('fs'), path = require('path');

let seed = 20261020;
function R() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const MINUS = '−';
const lab = v => (v < 0 ? MINUS + (-v) : String(v));
const T = v => String(v);
const fr = (n, d) => '\\dfrac{' + n + '}{' + d + '}';
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
function lcmBrute(a, b) { for (let x = Math.max(a, b); ; x++) if (x % a === 0 && x % b === 0) return x; }
const key = v => (v == null ? 'null:' + Math.random() : Array.isArray(v) ? v.map(x => x.toFixed(9)).join(',') : v.toFixed(9));

/* 問題を組み立てる。truth={v,tex}, cands=[{v,tex,why}]（先のものほど優先） */
function build(o) {
  const unit = o.unit || '';
  const wrap = (tex, raw) => (raw ? tex : '$' + tex + '$' + unit);
  const seen = [o.truth.tex], seenV = [key(o.truth.v)], wrongs = [];
  for (const c of o.cands) {
    if (wrongs.length >= 3) break;
    if (seen.includes(c.tex)) continue;
    if (!c.same && seenV.includes(key(c.v))) continue;
    seen.push(c.tex); seenV.push(key(c.v)); wrongs.push(c);
  }
  if (wrongs.length < 3) throw new Error(o.id + ': 誤答の候補が足りない');
  const all = shuffle([{ t: wrap(o.truth.tex, o.truth.raw), v: o.truth.v, ok: true }].concat(wrongs.map(c => (c.same ? { t: wrap(c.tex, c.raw), v: c.v, why: c.why, same: true } : { t: wrap(c.tex, c.raw), v: c.v, why: c.why }))));
  const ans = all.findIndex(x => x.ok);
  all.forEach(x => delete x.ok);
  const q = { id: o.id, expr: o.expr, p: o.p, ch: all, ans, steps: o.steps, point: o.point };
  if (o.fig) q.fig = o.fig;
  if (o.figAfter) q.figAfter = o.figAfter;
  return q;
}

/* ---------- 共通の小物 ---------- */
const LT = a => a.join(',\\ ');                                  // 数のならび（TeX）
const dfmt = x => String(+x.toFixed(8));                         // 小数の表示
const divisors = n => { const r = []; for (let i = 1; i <= n; i++) if (n % i === 0) r.push(i); return r; };
const reduceF = (n, d) => { const g = gcd(n, d); return [n / g, d / g]; };
const frT = (n, d) => (d === 1 ? String(n) : fr(n, d));           // 分母1なら整数で表示
const Fv = (n, d) => { const [a, b] = reduceF(n, d); return { v: n / d, tex: frT(a, b) }; };
const C = (n, d, why, same) => { const o = { v: n / d, tex: (n * d < 0 ? '-' : '') + frT(Math.abs(n), Math.abs(d)), why }; if (same) o.same = true; return o; };
const mixT = (w, n, d) => String(w) + fr(n, d);
function fracOfDec(x) { const s = Math.round(x * 10000); const g = gcd(s, 10000); return [s / g, 10000 / g]; }
const RAWQ = (id, p, truth, wrongs, steps, point, extra) => build(Object.assign({
  id, expr: '1', p, raw: true, truth: { v: 1, tex: truth, raw: true },
  cands: wrongs.map(([t, why]) => ({ v: null, raw: true, tex: t, why })), steps, point
}, extra || {}));
const lcmOf = (a, b) => a / gcd(a, b) * b;

/* ---------- 共通の小物（レベル9） ---------- */
const fp = n => (n < 0 ? '(' + n + ')' : String(n));       // かっこつきで表示
const sgnWord = s => (s < 0 ? 'マイナス' : 'プラス');
const cnt = a => a.filter(x => x < 0).length;


/* ---------- 文字式の道具 ---------- */
const D = s => (String(s).includes('$') || /[ぁ-んァ-ヶ一-龥]/.test(String(s)) ? s : '$' + s + '$');
// RQ: 4択（式が選択肢）。texはそのまま渡すと $…$ で包む
const RQ = (id, p, t, ws, steps, point, extra) => RAWQ(id, p, D(t), ws.map(([w, why]) => [D(w), why]), steps, point, extra);
// 1次式 a x + b を TeX に
const xt = (a, v) => (a === 1 ? v : a === -1 ? '-' + v : a + v);
const lin = (a, b, v) => { v = v || 'x'; if (a === 0) return String(b); let s = xt(a, v); if (b > 0) s += '+' + b; else if (b < 0) s += '-' + (-b); return s; };
const sgn = n => (n < 0 ? '-' + (-n) : '+' + n);
const num = n => String(n);
// 数値問題（答えがひとつの数）
const NQ = (id, p, t, ws, steps, point, unit) => build({ id, expr: String(t), p, truth: { v: t, tex: dfmt(t) }, cands: ws.map(([v, why]) => ({ v, tex: dfmt(v), why })), steps, point, unit });


/* ---------- 座標グラフの図（SVG） ---------- */
const ct = (x, y) => '(' + x + ',' + y + ')';
const rdc = (n, d) => { const g = gcd(n, d); n /= g; d /= g; if (d < 0) { n = -n; d = -d; } return [n, d]; };
const slope = (n, d) => { [n, d] = rdc(n, d); return d === 1 ? (n === 1 ? '' : n === -1 ? '-' : String(n)) + 'x' : (n < 0 ? '-' : '') + '\\dfrac{' + Math.abs(n) + '}{' + d + '}x'; };
const yEq = (n, d) => 'y=' + slope(n, d);
const hyEq = a => 'y=' + (a < 0 ? '-' : '') + '\\dfrac{' + Math.abs(a) + '}{x}';
const QN = ['第1象限', '第2象限', '第3象限', '第4象限'];

const PI = n => (n === 1 ? '\\pi' : n + '\\pi');

const PU = (n, u) => '$' + PI(n) + '$ ' + u;
const S_ = s => ' style="' + s + '"';
const svgW = (h, inner) => '<svg viewBox="0 0 260 ' + h + '" role="img" aria-label="図"' + S_('width:100%;max-width:320px;height:auto;display:block;margin:8px auto') + '>' + inner + '</svg>';
const ln = (x1, y1, x2, y2, c, w, dash) => '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"' + S_('stroke:var(' + c + ');stroke-width:' + (w || 2) + ';stroke-linecap:round' + (dash ? ';stroke-dasharray:5 4' : '')) + '/>';
const tx = (x, y, t, a) => '<text x="' + x + '" y="' + y + '"' + S_('font:700 13px sans-serif;fill:var(--fg);text-anchor:' + (a || 'middle')) + '>' + t + '</text>';
const circ = (cx, cy, r) => '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="var(--card)"' + S_('stroke:var(--fg);stroke-width:2.5') + '/>';
const GR = 6, GS = 22, GC = 150;
const gx = x => GC + GS * x, gy = y => GC - GS * y;
function graph(o) {
  o = o || {};
  const st = (s) => ' style="' + s + '"';
  let s = '<svg viewBox="0 0 300 300" role="img" aria-label="座標平面"' + st('width:100%;max-width:340px;height:auto;display:block;margin:8px auto') + '>';
  for (let i = -GR; i <= GR; i++) {
    if (i === 0) continue;
    s += '<line x1="' + gx(i) + '" y1="' + gy(-GR) + '" x2="' + gx(i) + '" y2="' + gy(GR) + '"' + st('stroke:var(--line);stroke-width:1') + '/>';
    s += '<line x1="' + gx(-GR) + '" y1="' + gy(i) + '" x2="' + gx(GR) + '" y2="' + gy(i) + '"' + st('stroke:var(--line);stroke-width:1') + '/>';
  }
  s += '<line x1="' + gx(-GR - .4) + '" y1="' + GC + '" x2="' + gx(GR + .4) + '" y2="' + GC + '"' + st('stroke:var(--fg);stroke-width:2') + '/>';
  s += '<line x1="' + GC + '" y1="' + gy(-GR - .4) + '" x2="' + GC + '" y2="' + gy(GR + .4) + '"' + st('stroke:var(--fg);stroke-width:2') + '/>';
  const tx = 'font:700 10px sans-serif;fill:var(--muted);text-anchor:middle';
  for (let i = -GR; i <= GR; i++) {
    if (i === 0) continue;
    s += '<text x="' + gx(i) + '" y="' + (GC + 13) + '"' + st(tx) + '>' + i + '</text>';
    s += '<text x="' + (GC - 9) + '" y="' + (gy(i) + 3.5) + '"' + st(tx) + '>' + i + '</text>';
  }
  s += '<text x="' + (GC - 8) + '" y="' + (GC + 13) + '"' + st(tx) + '>O</text>';
  s += '<text x="' + gx(GR + .4) + '" y="' + (GC + 24) + '"' + st('font:700 12px sans-serif;fill:var(--fg);text-anchor:end') + '>x</text>';
  s += '<text x="' + (GC + 10) + '" y="' + (gy(GR + .4) + 8) + '"' + st('font:700 12px sans-serif;fill:var(--fg)') + '>y</text>';
  const clip = (a, b) => {                                  // y = a x + b を、枠の中で描く
    const pts = [];
    [-GR, GR].forEach(x => { const y = a * x + b; if (y >= -GR - 1e-9 && y <= GR + 1e-9) pts.push([x, y]); });
    if (a !== 0) [-GR, GR].forEach(y => { const x = (y - b) / a; if (x > -GR + 1e-9 && x < GR - 1e-9) pts.push([x, y]); });
    return pts.length >= 2 ? [pts[0], pts[pts.length - 1]] : null;
  };
  (o.lines || []).forEach((L, i) => {
    const seg = clip(L.a, L.b); if (!seg) return;
    s += '<line x1="' + gx(seg[0][0]) + '" y1="' + gy(seg[0][1]) + '" x2="' + gx(seg[1][0]) + '" y2="' + gy(seg[1][1]) + '"' + st('stroke:var(' + (L.c || (i ? '--pos' : '--neg')) + ');stroke-width:2.5;stroke-linecap:round') + '/>';
  });
  (o.pts || []).forEach(p => {
    s += '<circle cx="' + gx(p.x) + '" cy="' + gy(p.y) + '" r="4.5"' + st('fill:var(--fg);stroke:var(--card);stroke-width:1.5') + '/>';
    if (p.l) s += '<text x="' + (gx(p.x) + 7) + '" y="' + (gy(p.y) - 6) + '"' + st('font:700 13px sans-serif;fill:var(--fg)') + '>' + p.l + '</text>';
  });
  return { type: 'svg', html: s + '</svg>' };
}
const TT = s => '$' + s + '$';
const eqL = (a, b) => 'y=' + lin(a, b);
const RTV = rows => '<table class="rtab">' + rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</table>';
const gfig = (lines, pts) => graph({ lines, pts });

/* 式の候補（まちがい）を作る：傾き・切片をずらす */
function lineQ(id, p, a, b, why, steps, point, fig) {
  const wr = [
    [TT(eqL(-a, b)), '傾きの符号が、ちがうよ。'],
    [TT(eqL(a, -b)), '切片の符号が、ちがうよ。'],
    [TT(eqL(a, b + 2)), '切片が、ちがうよ。もう一度、通る点を代入してたしかめよう。'],
    [TT(eqL(a + 1, b)), '傾きが、ちがうよ。変化の割合を、もう一度出してみよう。'],
    [TT(eqL(b === 0 ? a + 2 : b, a)), '傾きと切片が、入れかわっているよ。$y=ax+b$ の $a$ が傾き、$b$ が切片。']
  ];
  return RAWQ(id, p, TT(eqL(a, b)), wr, steps, point, fig ? { fig } : undefined);
}

/* ================= パートA: 一次関数の基本 ================= */
function genHenka() {
  return [
    RQ('hk-1', '$y$ が $x$ の一次関数であるものは？', '$y=2x+1$', [['$y=x^2$', '$x$ の2乗がある式は、一次関数ではない。'], ['$y=\\dfrac{6}{x}$', 'これは、反比例の式。'], ['$y=2x^2+1$', '$x^2$ があるので、一次関数ではない。']], ['$y=ax+b$ の形が、一次関数。', '$a=2$、$b=1$。'], '一次関数は、$y=ax+b$ の形。'),
    NQ('hk-2', '一次関数 $y=3x+2$ の、変化の割合は？', 3, [[2, '2 は、切片（$b$）。変化の割合は、$x$ の係数（$a$）。'], [5, '$3+2$ ではないよ。変化の割合は、$a$ の値。'], [6, '$3\\times2$ ではないよ。変化の割合は、$x$ の係数。']], ['$y=ax+b$ の $a$ が、変化の割合。', '$a=3$。'], '変化の割合 ＝ $x$ の係数 $a$。'),
    NQ('hk-3', '$x$ と $y$ の関係が次の表のとき、変化の割合は？' + RTV([['$x$', '1', '2', '3', '4'], ['$y$', '5', '8', '11', '14']]), 3, [[5, '5 は、$x=1$ のときの $y$。変化の割合 ＝ $y$ の増加量 ÷ $x$ の増加量。'], [4, '4 は、$x$ の最大値。$y$ の増加量 ÷ $x$ の増加量。'], [1, '$x$ の増加量は 1。$y$ の増加量は？']], ['$x$ が1増えると、$y$ は3増える。', '変化の割合 ＝ $3\\div1=3$。'], '変化の割合 ＝ $y$ の増加量 ÷ $x$ の増加量。'),
    NQ('hk-4', '一次関数 $y=-2x+5$ で、$x$ が1から4まで増えるとき、$y$ の増加量は？', -6, [[6, '符号がちがうよ。変化の割合が $-2$ なので、$y$ は減る。'], [-2, '$-2$ は、変化の割合。$x$ の増加量 3 をかける。'], [-3, '$x$ の増加量は 3。$-2\\times3$。']], ['$x$ の増加量：$4-1=3$。', '$y$ の増加量 ＝ 変化の割合 × $x$ の増加量 ＝ $-2\\times3=-6$。'], '$y$ の増加量 ＝ 変化の割合 × $x$ の増加量。'),
    NQ('hk-5', '変化の割合が4の一次関数で、$x$ が3増えるとき、$y$ の増加量は？', 12, [[7, '足し算ではないよ。$y$ の増加量 ＝ 変化の割合 × $x$ の増加量。'], [0.75, '$3\\div4$ ではないよ。かけ算。'], [1, '$4\\div3$ ではないよ。かけ算。']], ['$4\\times3=12$。'], '$y$ の増加量 ＝ 変化の割合 × $x$ の増加量。'),
    NQ('hk-6', '$x$ が2増えると $y$ が $-6$ 増える一次関数の、変化の割合は？', -3, [[3, '符号がちがうよ。$y$ が減っているので、負。'], [-12, '$-6\\times2$ ではないよ。わり算。'], [-4, '$-6+2$ ではないよ。$-6\\div2$。']], ['変化の割合 ＝ $y$ の増加量 ÷ $x$ の増加量。', '$-6\\div2=-3$。'], '変化の割合 ＝ $y$ の増加量 ÷ $x$ の増加量。'),
    RQ('hk-7', '一次関数 $y=ax+b$ の $b$ を、何という？', '切片（グラフと $y$ 軸の交点の $y$ 座標）', [['傾き（変化の割合）', '傾き（変化の割合）は、$a$。'], ['比例定数', '比例定数は、$y=ax$ の $a$。$b$ とは、ちがう。'], ['原点', '原点は、$(0,0)$ のこと。']], ['$x=0$ を代入すると $y=b$。', 'グラフが $y$ 軸と交わる点は $(0,b)$。'], '$b$ ＝ 切片（グラフが $y$ 軸と交わる点の $y$ 座標）。')
  ];
}
function genGraphYomu() {
  return [
    RAWQ('gr-1', '一次関数 $y=2x+1$ のグラフが、$y$ 軸と交わる点は？', TT(ct(0, 1)), [[TT(ct(1, 0)), '$x$ 軸との交点は、$y=0$。$y$ 軸との交点は、$x=0$。'], [TT(ct(0, 2)), '2 は、傾き。切片 1 が、$y$ 座標。'], [TT(ct(1, 3)), '$x=1$ のときの点。$y$ 軸との交点は、$x=0$。']], ['$y$ 軸上は、$x=0$。', '$y=2\\times0+1=1$。$(0,1)$。'], '$y$ 軸との交点 ＝ $(0,\\ b)$。'),
    NQ('gr-2', '一次関数 $y=-x+3$ の、傾きは？', -1, [[1, '符号がちがうよ。$-x$ の係数は $-1$。'], [3, '3 は、切片。傾きは $x$ の係数。'], [-3, '$-3$ は、切片のこと？傾きは $x$ の係数。']], ['$-x=-1\\times x$。', '傾きは $-1$。'], '傾き ＝ $x$ の係数。'),
    lineQ('gr-3', '図のグラフの式は？', 2, -1, '', ['$y$ 軸と $(0,-1)$ で交わる。切片 $-1$。', '右に1進むと、上に2。傾き 2。', '$y=2x-1$。'], '切片と傾きを読みとる。', gfig([{ a: 2, b: -1 }], [{ x: 0, y: -1, l: '' }, { x: 1, y: 1, l: '' }])),
    lineQ('gr-4', '図のグラフの式は？', -1, 2, '', ['$y$ 軸と $(0,2)$ で交わる。切片 2。', '右に1進むと、下に1。傾き $-1$。', '$y=-x+2$。'], '切片と傾きを読みとる。', gfig([{ a: -1, b: 2 }], [{ x: 0, y: 2, l: '' }, { x: 2, y: 0, l: '' }])),
    RAWQ('gr-5', '一次関数 $y=2x-4$ のグラフが、$x$ 軸と交わる点は？', TT(ct(2, 0)), [[TT(ct(0, -4)), '$(0,-4)$ は、$y$ 軸との交点。$x$ 軸との交点は、$y=0$。'], [TT(ct(-2, 0)), '符号がちがうよ。$0=2x-4$ を解く。'], [TT(ct(4, 0)), '$0=2x-4$ より、$x=2$。']], ['$x$ 軸上は、$y=0$。', '$0=2x-4$、$x=2$。$(2,0)$。'], '$x$ 軸との交点：$y=0$ を代入。'),
    RQ('gr-6', '一次関数 $y=-3x+1$ のグラフは？', '右下がりの直線', [['右上がりの直線', '傾きが負（$-3$）なので、右下がり。'], ['原点を通る直線', '切片が 1 なので、原点は通らない。'], ['$x$ 軸に平行な直線', '傾きが 0 ではないので、平行ではない。']], ['傾き $-3<0$ → 右下がり。'], '傾き $>0$ → 右上がり、傾き $<0$ → 右下がり。'),
    RAWQ('gr-7', '一次関数 $y=3x-2$ のグラフが通る点は？', TT(ct(1, 1)), [[TT(ct(1, 5)), '$3\\times1-2=1$。$3\\times1+2$ ではない。'], [TT(ct(2, 3)), '$x=2$ のとき、$y=3\\times2-2=4$。'], [TT(ct(0, 2)), '$x=0$ のとき、$y=-2$。']], ['$x=1$ を代入：$y=3\\times1-2=1$。', '$(1,1)$ を通る。'], '通る点は、$x$ を代入して $y$ を出して確かめる。')
  ];
}
function genShikiMotome() {
  return [
    lineQ('sk-1', '傾きが2、切片が3の一次関数の式は？', 2, 3, '', ['$y=ax+b$ に、$a=2$、$b=3$。', '$y=2x+3$。'], '傾き＝$a$、切片＝$b$。'),
    lineQ('sk-2', '傾きが $-1$ で、点 $(0,4)$ を通る一次関数の式は？', -1, 4, '', ['$(0,4)$ は、$y$ 軸上の点。切片は 4。', '$y=-x+4$。'], '$x=0$ の点を通るとき、$y$ 座標が切片。'),
    lineQ('sk-3', '傾きが3で、点 $(1,5)$ を通る一次関数の式は？', 3, 2, '', ['$y=3x+b$ に、$(1,5)$ を代入：$5=3+b$。', '$b=2$。$y=3x+2$。'], '傾きがわかっているとき、通る点を代入して、$b$ を求める。'),
    lineQ('sk-4', '2点 $(0,1)$、$(2,5)$ を通る一次関数の式は？', 2, 1, '', ['切片は 1。傾き ＝ $(5-1)\\div(2-0)=2$。', '$y=2x+1$。'], '2点から、傾き（変化の割合）を出す。'),
    lineQ('sk-5', '2点 $(1,2)$、$(3,8)$ を通る一次関数の式は？', 3, -1, '', ['傾き ＝ $(8-2)\\div(3-1)=3$。', '$y=3x+b$ に $(1,2)$ を代入：$2=3+b$、$b=-1$。', '$y=3x-1$。'], '傾きを出して、1点を代入して、$b$ を求める。'),
    lineQ('sk-6', '変化の割合が $-1$ で、点 $(2,3)$ を通る一次関数の式は？', -1, 5, '', ['$y=-x+b$ に $(2,3)$ を代入：$3=-2+b$。', '$b=5$。$y=-x+5$。'], '傾きがわかっているとき、通る点を代入して、$b$ を求める。'),
    lineQ('sk-7', '2点 $(-1,4)$、$(2,-2)$ を通る一次関数の式は？', -2, 2, '', ['傾き ＝ $(-2-4)\\div(2-(-1))=-6\\div3=-2$。', '$y=-2x+b$ に $(2,-2)$ を代入：$-2=-4+b$、$b=2$。', '$y=-2x+2$。'], '負の数の引き算は、かっこをつけて、ていねいに。')
  ];
}
/* ================= パートB: 方程式とグラフ・利用 ================= */
function genHouGraph() {
  return [
    NQ('hg-1', '方程式 $2x+y=4$ を、$y=ax+b$ の形にしたときの、傾きは？', -2, [[2, '符号がちがうよ。$2x$ を移項すると、$-2x$。'], [4, '4 は、切片。傾きは $x$ の係数。'], [-4, '$-4$ ではなく、$-2$。']], ['$2x$ を移項：$y=-2x+4$。', '傾きは $-2$。'], '$y=\\sim$ の形にして、傾きと切片を読む。'),
    RQ('hg-2', '方程式 $x=3$ のグラフは？', '$y$ 軸に平行な直線', [['$x$ 軸に平行な直線', '$x$ 軸に平行なのは、$y=\\sim$ のグラフ。'], ['原点を通る直線', '$x=3$ は、原点を通らない。'], ['右上がりの直線', '$x=3$ のグラフは、まっすぐ上下の線。']], ['$x=3$ は、$x$ 座標がいつも 3 の点の集まり。', '$y$ 軸に平行な直線。'], '$x=k$ は $y$ 軸に平行、$y=k$ は $x$ 軸に平行。'),
    RQ('hg-3', '方程式 $y=2$ のグラフは？', '$x$ 軸に平行な直線', [['$y$ 軸に平行な直線', '$y$ 軸に平行なのは、$x=\\sim$ のグラフ。'], ['原点を通る直線', '$y=2$ は、原点を通らない。'], ['右下がりの直線', '$y=2$ は、傾きが 0（水平）。']], ['$y=2$ は、$y$ 座標がいつも 2 の点の集まり。', '$x$ 軸に平行な直線。'], '$x=k$ は $y$ 軸に平行、$y=k$ は $x$ 軸に平行。'),
    RAWQ('hg-4', '2直線 $y=x+1$、$y=-x+5$ の交点の座標は？', TT(ct(2, 3)), [[TT(ct(3, 2)), '$x$ と $y$ が、入れかわっているよ。'], [TT(ct(1, 4)), '1つの式にしか合っていないよ。$y=x+1$ に $x=1$ を入れると、$y=2$。'], [TT(ct(2, 5)), '$y=x+1$ に $x=2$ を入れると $y=3$。']], ['$x+1=-x+5$ を解く：$2x=4$、$x=2$。', '$y=2+1=3$。$(2,3)$。'], '交点の $x$ 座標は、2つの式の右辺を等しいとおいて求める。'),
    RAWQ('hg-5', '連立方程式 $\\begin{cases} x+y=5 \\\\ x-y=1 \\end{cases}$ の解は、2直線のどんな点の座標？', '交点', [['切片', '切片は、$y$ 軸との交点。連立方程式の解は、2直線の交点。'], ['原点', '連立方程式の解は、2直線の交点。'], ['$x$ 軸との交点', '連立方程式の解は、2直線の交点。']], ['連立方程式の解は、2つの式をどちらも成り立たせる $(x,y)$。', 'それは、2直線の交点。'], '連立方程式の解 ＝ 2直線の交点の座標。'),
    RAWQ('hg-6', '2直線 $y=2x-1$、$y=x+2$ の交点の座標は？', TT(ct(3, 5)), [[TT(ct(5, 3)), '$x$ と $y$ が、入れかわっているよ。'], [TT(ct(3, 6)), '$y=2x-1$ に $x=3$ を入れると $y=5$。'], [TT(ct(1, 3)), '$2x-1=x+2$ を解く。$x=3$。']], ['$2x-1=x+2$：$x=3$。', '$y=3+2=5$。$(3,5)$。'], '交点の $x$ 座標は、2つの式の右辺を等しいとおいて求める。'),
    Object.assign(RAWQ('hg-7', '図の2直線の交点の座標は？', TT(ct(2, 3)), [[TT(ct(3, 2)), '$x$ と $y$ が、入れかわっているよ。'], [TT(ct(2, 4)), '$x$ 座標が 2 で、$y$ 座標が 3。目もりを読みとり直そう。'], [TT(ct(1, 2)), '目もりを読みとり直そう。']], ['2直線が交わる点の目もりを読む。', '$x=2$、$y=3$。'], 'グラフの交点は、目もりから読みとる。'), { fig: gfig([{ a: 1, b: 1 }, { a: -1, b: 5 }], [{ x: 2, y: 3, l: '' }]) })
  ];
}
function genRiyoIC() {
  return [
    NQ('ri-1', '水そうに水が20 L 入っている。毎分3 L ずつ水を入れる。$x$ 分後の水の量を $y$ L とすると、5分後は？', 35, [[15, '足し算になっているよ。$y=3x+20$ に $x=5$。'], [23, '$3+20$ になっているよ。$3\\times5+20$。'], [100, '$20\\times5$ になっているよ。$3\\times5+20$。']], ['式：$y=3x+20$。', '$x=5$：$y=15+20=35$。'], '最初の量が切片、1あたりの量が傾き。', 'L'),
    NQ('ri-2', 'タクシーの料金は、初乗り500円、そのあと1 km ごとに200円。8 km 走ったときの料金は？', 2100, [[1600, '200 × 8 だけ。初乗り500円も足す。'], [700, '$500+200$ ではないよ。$200\\times8+500$。'], [1500, '$500\\times3$ ではないよ。$200x+500$。']], ['式：$y=200x+500$。', '$x=8$：$y=1600+500=2100$。'], '最初の量が切片、1あたりの量が傾き。', '円'),
    NQ('ri-3', '30 cm のろうそくが、1分で0.5 cm ずつ短くなる。$x$ 分後の長さを $y$ cm とすると、長さが10 cm になるのは何分後？', 40, [[20, '$y=30-0.5x$ に $y=10$ を入れる。$0.5x=20$。'], [60, '30÷0.5 は、全部燃えるまでの時間。10 cm になるまで。'], [80, '$20\\div0.25$ ではないよ。$0.5x=20$。']], ['式：$y=-0.5x+30$。', '$10=-0.5x+30$、$0.5x=20$、$x=40$。'], '減っていくときは、傾きが負。', '分'),
    NQ('ri-4', '地上の気温が20℃で、1 km 上がるごとに6℃ずつ下がる。高さ3 km では？', 2, [[38, '符号がちがうよ。上がると、気温は下がる。'], [14, '6 を、1回しか引いていないよ。$20-6\\times3$。'], [-2, '$6\\times3=18$、$20-18=2$。']], ['式：$y=20-6x$。', '$x=3$：$y=20-18=2$。'], '1あたりの変化が、傾き。下がるときは負。', '℃'),
    NQ('ri-5', '家から300 m の地点を、分速60 m で、まっすぐ歩いている。歩きはじめて15分後には、家から何 m？', 1200, [[900, '$60\\times15$ だけ。最初の300 m も足す。'], [375, '$300+60+15$ ではないよ。$60\\times15+300$。'], [1500, '$300\\times5$ ではないよ。$60x+300$。']], ['式：$y=60x+300$。', '$x=15$：$y=900+300=1200$。'], '最初の位置が切片、速さが傾き。', 'm'),
    RQ('ri-6', '水そうの問題で、$y=3x+20$ の「20」は何を表す？', '最初に入っていた水の量', [['1分あたりに入れる水の量', 'それは、傾き（3）。'], ['入れはじめてからの時間', 'それは、$x$。'], ['水そうの大きさ', '大きさとは限らない。$x=0$ のときの水の量。']], ['$x=0$ のとき、$y=20$。', '最初の水の量。'], '切片 ＝ $x=0$ のときの値。'),
    NQ('ri-7', 'Aプランは、基本料500円で、1人100円。Bプランは、1人200円（基本料なし）。何人のとき、料金が同じになる？', 5, [[3, '$100x+500=200x$ を解く。'], [500, '500 は、基本料。人数を求める。'], [10, '$100x+500=200x$ より $100x=500$。']], ['Aプラン：$y=100x+500$。Bプラン：$y=200x$。', '同じになるのは、$100x+500=200x$、$x=5$。'], '2つの式が等しいとき ＝ グラフの交点。', '人')
  ];
}

/* ---------- 組み立て ---------- */
const RT = rows => '<table class="rtab">' + rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</table>';
const I = {
  hk: '$y$ が $x$ の式 $y=ax+b$ で表されるとき、$y$ は $x$ の<b>一次関数</b>。<br><b>変化の割合</b> ＝ $y$ の増加量 ÷ $x$ の増加量 ＝ $a$。<br>$y$ の増加量 ＝ 変化の割合 × $x$ の増加量。<br>$b$ は<b>切片</b>（グラフと $y$ 軸の交点の $y$ 座標）。',
  gr: '一次関数 $y=ax+b$ のグラフは<b>直線</b>。<br>・<b>傾き</b>は $a$（右に1進むと、上に $a$）<br>・<b>切片</b>は $b$（$y$ 軸との交点 $(0,b)$）<br>$a>0$ なら<b>右上がり</b>、$a<0$ なら<b>右下がり</b>。<br>$x$ 軸との交点は、$y=0$ を代入して求める。' + graph({ lines: [{ a: 2, b: -1 }], pts: [{ x: 0, y: -1, l: '' }] }).html,
  sk: '式の求め方は、2通り。<br>① <b>傾きと1点</b>：$y=ax+b$ に、傾き $a$ と、通る点を代入して、$b$ を求める。<br>② <b>2点</b>：傾き ＝ $y$ の増加量 ÷ $x$ の増加量 を出してから、①へ。<br>$x=0$ の点がわかれば、その $y$ 座標が $b$。',
  hg: '二元一次方程式 $ax+by=c$ のグラフも、直線。$y=\\sim$ の形にして、傾きと切片を読む。<br>$x=k$ は<b>$y$ 軸に平行</b>、$y=k$ は<b>$x$ 軸に平行</b>。<br>2直線の<b>交点の座標</b> ＝ 連立方程式の<b>解</b>。<br>交点は、右辺を等しいとおいて、$x$ を求め、$y$ を出す。',
  ri: '一次関数の利用：<br>・<b>最初の量</b>が切片 $b$<br>・<b>1あたりの量（速さ、毎分の量など）</b>が傾き $a$<br>式 $y=ax+b$ を作って、$x$ や $y$ に代入する。<br>減っていくときは、$a$ が負。'
};
const ABOUT = {
  kihon: [
    { p: '<b>一次関数</b>は $y=ax+b$。$a$ が変化の割合（傾き）、$b$ が切片。' },
    { p: RT([['変化の割合', '→', '$y$の増加量 ÷ $x$の増加量'], ['傾き$a>0$', '→', '右上がり'], ['切片$b$', '→', '$y$軸との交点']]) },
    { cap: '$x$ が1増えると、$y$ は $a$ 増える。' }
  ],
  riyo: [
    { p: '2直線の<b>交点</b>は、連立方程式の<b>解</b>。' },
    { p: RT([['$x=k$', '→', '$y$軸に平行'], ['$y=k$', '→', '$x$軸に平行'], ['利用', '→', '最初の量が切片']]) },
    { cap: '式にして、代入。' }
  ]
};
const PARTS = [
  {
    id: 'kihon', title: '一次関数の基本', sub: '変化の割合・グラフ・式', about: ABOUT.kihon, aboutTitle: 'まず見てみよう：一次関数', aboutSub: 'y = ax + b',
    steps: [
      { id: 'kihon-1', title: '一次関数と変化の割合', sub: 'a は変化の割合', intro: I.hk, qs: genHenka() },
      { id: 'kihon-2', title: '式とグラフ', sub: '傾きと切片', intro: I.gr, qs: genGraphYomu() },
      { id: 'kihon-3', title: '式の求め方', sub: '傾きと1点、2点', intro: I.sk, qs: genShikiMotome() }
    ]
  },
  {
    id: 'riyo', title: '方程式とグラフ・利用', sub: '交点・連立方程式・利用', about: ABOUT.riyo, aboutTitle: 'まず見てみよう：交点と利用', aboutSub: '交点＝連立方程式の解',
    steps: [
      { id: 'riyo-1', title: '方程式とグラフ', sub: '交点の座標', intro: I.hg, qs: genHouGraph() },
      { id: 'riyo-2', title: '一次関数の利用', sub: '式を作って代入', intro: I.ri, qs: genRiyoIC() }
    ]
  }
];
const RB = s => s.replace(/一次関数/g, '<ruby>一次関数<rt>いちじかんすう</rt></ruby>').replace(/変化の割合/g, '<ruby>変化の割合<rt>へんかのわりあい</rt></ruby>').replace(/切片/g, '<ruby>切片<rt>せっぺん</rt></ruby>').replace(/傾き/g, '<ruby>傾<rt>かたむ</rt></ruby>き').replace(/増加量/g, '<ruby>増加量<rt>ぞうかりょう</rt></ruby>').replace(/交点/g, '<ruby>交点<rt>こうてん</rt></ruby>').replace(/連立/g, '<ruby>連立<rt>れんりつ</rt></ruby>').replace(/解(?=[はがをにのと、。<」）＝ ]|$)/g, '<ruby>解<rt>かい</rt></ruby>');
const ruby = o => typeof o === 'string' ? o.split(/(<svg[\s\S]*?<\/svg>)/).map((t, k) => k % 2 ? t : RB(t)).join('')
  : Array.isArray(o) ? o.map(ruby) : (o && typeof o === 'object') ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, (k === 'expr' || k === 'id' || k === 'html') ? v : ruby(v)])) : o;
const out = '// 自動生成（node gen9.js）。手で直すときは gen9.js を直す。\nconst PARTS = ' + JSON.stringify(ruby(PARTS)) + ';\nif (typeof module !== \'undefined\') module.exports = PARTS;\n';
fs.writeFileSync(path.join(__dirname, 'src/data.js'), out);
let n = 0; PARTS.forEach(P => P.steps.forEach(s => { n += s.qs.length; }));
console.log('src/data.js を作成：' + n + '問、' + (out.length / 1024).toFixed(0) + 'KB');
