// Эффекты для детей: живая копилка и праздник после игр. При «уменьшить движение» в системе анимации отключаются (см. styles.css).
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import pigUrl from './assets/glass-pig.webp'; // стеклянная свинка с прозрачным фоном

// ---------- Мега-копилка: стеклянная свинка, внутри видны деньги ----------
// Координаты монет — в пикселях картинки свинки 600×600
const BODY = { cx: 290, cy: 285, rx: 198, ry: 168 }; // внутренняя полость стекла
const BOTTOM = BODY.cy + BODY.ry - 10, TOP = BODY.cy - BODY.ry + 24;
type Money = { x: number; y: number; kind: 'blue' | 'sky' | 'note'; tilt: number };
/** Раскладка денег внутри: ряды снизу вверх, каждый ряд по ширине полости на этой высоте */
function pile(fill: number): Money[] {
  const level = BOTTOM - Math.max(0, Math.min(1, fill)) * (BOTTOM - TOP);
  const out: Money[] = [];
  let row = 0;
  for (let y = BOTTOM; y > level; y -= 13, row++) {
    const half = BODY.rx * Math.sqrt(Math.max(0, 1 - ((y - BODY.cy) / BODY.ry) ** 2)) - 18;
    for (let x = BODY.cx - half + (row % 2 ? 19 : 0); x <= BODY.cx + half; x += 38) {
      const k = (row * 7 + Math.round(x)) % 11;
      out.push({ x: x + ((k % 3) - 1) * 4, y: y + ((k % 2) * 3), kind: k === 0 || k === 6 ? 'note' : k % 2 ? 'blue' : 'sky', tilt: (k - 5) * 3 });
    }
  }
  return out;
}

// Картинку грузим заранее, как только открылся модуль, чтобы копилка появлялась сразу
if (typeof Image !== 'undefined') { const im = new Image(); im.src = pigUrl; }

/** Деньги внутри стекла. Монеты рисуются через <use> по трём шаблонам: так в разметке в разы меньше узлов */
function PigCoins({ fill, prevFill }: { fill: number; prevFill?: number }) {
  const uid = useMemo(() => Math.random().toString(36).slice(2, 8), []);
  const money = useMemo(() => pile(fill), [fill]);
  const was = prevFill === undefined ? money.length : pile(prevFill).length;
  const level = BOTTOM - Math.max(0, Math.min(1, fill)) * (BOTTOM - TOP);
  const ref = (k: Money['kind']) => `#${k}${uid}`;
  return (
    <svg className="np-money" viewBox="0 0 600 600">
      <defs>
        <clipPath id={`in${uid}`}><ellipse cx={BODY.cx} cy={BODY.cy} rx={BODY.rx} ry={BODY.ry} /></clipPath>
        <radialGradient id={`glow${uid}`}><stop offset="0" stopColor="#FFFFFF" stopOpacity=".9" /><stop offset="1" stopColor="#FFFFFF" stopOpacity="0" /></radialGradient>
        <g id={`note${uid}`}><rect x="-25" y="-10" width="50" height="20" rx="3.5" fill="#FF8E87" /><rect x="-18" y="-6" width="36" height="12" rx="2.5" fill="none" stroke="#FFE1DE" strokeWidth="2" /></g>
        {(['blue', 'sky'] as const).map(k => <g key={k} id={`${k}${uid}`}>
          <ellipse cx="0" cy="5.5" rx="21" ry="9" fill={k === 'blue' ? '#0F2F7A' : '#1F5FD6'} /><ellipse cx="0" cy="0" rx="21" ry="9" fill={k === 'blue' ? '#1F5FD6' : '#5C9BF3'} />
          <ellipse cx="0" cy="0" rx="12.5" ry="4.8" fill="none" stroke="#FFFFFF" strokeOpacity=".8" strokeWidth="2" /></g>)}
      </defs>
      <g clipPath={`url(#in${uid})`}>
        {money.map((m, i) => (
          <g key={i} transform={`translate(${m.x} ${m.y}) rotate(${m.tilt})`}>
            <use href={ref(m.kind)} className={i >= was ? 'pm-new' : undefined}
              style={i >= was ? { animationDelay: `${(i - was) * 18}ms`, ['--fall' as string]: `${-(m.y - 60)}px` } : undefined} />
          </g>
        ))}
        {/* вспышка на поверхности, когда деньги легли */}
        {prevFill !== undefined && money.length > was && <ellipse className="pm-surface" cx={BODY.cx} cy={level} rx={BODY.rx * .8} ry="24" fill={`url(#glow${uid})`} />}
      </g>
    </svg>
  );
}

// ---------- осколки: свинка трескается по линиям от центра и разлетается кусками самой картинки ----------
function seeded(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }
type Piece = { poly: [number, number][]; cx: number; cy: number; dx: number; dy: number; r: number };
const CRACK = (() => {
  const rnd = seeded(7);
  const C: [number, number] = [48, 48]; // центр удара, % от картинки
  const N = 9;
  const ang = Array.from({ length: N }, (_, i) => (i / N) * Math.PI * 2 + (rnd() - .5) * .45);
  const at = (a: number, r: number): [number, number] => [C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r * .9];
  const A = ang.map(a => at(a, 13 + rnd() * 9)); // внутреннее кольцо
  const K = ang.map(a => at(a + (rnd() - .5) * .12, 34 + rnd() * 8)); // излом трещины
  const B = ang.map(a => at(a, 80)); // за краями свинки, чтобы захватить уши, ноги, пятачок
  const pieces: Piece[] = [];
  const add = (poly: [number, number][], power: number) => {
    const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    const len = Math.hypot(cx - C[0], cy - C[1]) || 1;
    const dist = power * (0.8 + rnd() * .5);
    pieces.push({ poly, cx, cy, dx: (cx - C[0]) / len * dist, dy: (cy - C[1]) / len * dist - 30, r: (rnd() > .5 ? 1 : -1) * (60 + rnd() * 220) });
  };
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    add([C, A[i], A[j]], 70);
    add([A[i], K[i], K[j], A[j]], 130);
    add([K[i], B[i], B[j], K[j]], 170);
  }
  // линии трещин для фазы «трескается»
  const lines = ang.map((_, i) => [C, A[i], K[i], B[i]]);
  const rings = [A, K];
  return { pieces, lines, rings };
})();

/**
 * Копилка ребёнка. fill — доля накопленного (0–1), prevFill — сколько было до пополнения:
 * новые монеты падают сверху через прорезь и ложатся на кучу, поверхность вспыхивает.
 * mood: happy — свинка подсвечивается, full — пульсирует и ждёт, чтобы её разбили. cracking — по стеклу бегут трещины.
 */
export function MegaPig({ fill, prevFill, mood = 'idle', cracking = false, className = '' }: {
  fill: number; prevFill?: number; mood?: 'idle' | 'happy' | 'full'; cracking?: boolean; className?: string;
}) {
  return (
    <div className={`neonpig ${mood} ${className}`} aria-hidden="true">
      <i className="np-glow" />
      <PigCoins fill={fill} prevFill={prevFill} />
      <img className="np-img" src={pigUrl} alt="" draggable={false} />
      {cracking && <svg className="np-cracks" viewBox="0 0 100 100" preserveAspectRatio="none">
        {CRACK.lines.map((l, i) => <polyline key={i} pathLength={100} points={l.map(p => p.join(',')).join(' ')} style={{ animationDelay: `${i * 70}ms` }} />)}
        {CRACK.rings.map((r, k) => <polygon key={k} pathLength={100} points={r.map(p => p.join(',')).join(' ')} style={{ animationDelay: `${500 + k * 200}ms` }} />)}
      </svg>}
      {mood === 'full' && [[8, 18], [86, 14], [6, 70], [90, 66]].map(([x, y], i) => <i key={i} className="np-spark" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 220}ms` }} />)}
    </div>
  );
}

/** Взрыв копилки: стекло разлетается осколками самой свинки, деньги высыпаются, блеск */
export function PigBurst() {
  const coins = useMemo(() => Array.from({ length: 26 }, (_, i) => {
    const a = (i / 26) * Math.PI * 2 + Math.random() * .4;
    const d = 70 + Math.random() * 100;
    return { dx: Math.cos(a) * d, up: -50 - Math.random() * 80, r: Math.random() * 540 - 270, delay: 60 + Math.random() * 160, kind: i % 5 === 0 ? 'note' : i % 2 ? 'blue' : 'sky' };
  }), []);
  return <div className="pigburst" aria-hidden="true">
    <div className="pb-box">
      <div className="pb-spill"><PigCoins fill={1} /></div>
      {CRACK.pieces.map((p, i) => <img key={i} className="pb-piece" src={pigUrl} alt="" draggable={false}
        style={{ clipPath: `polygon(${p.poly.map(([x, y]) => `${x}% ${y}%`).join(', ')})`, transformOrigin: `${p.cx}% ${p.cy}%`,
          ['--dx' as string]: `${p.dx}px`, ['--dy' as string]: `${p.dy}px`, ['--r' as string]: `${p.r}deg` }} />)}
      {coins.map((c, i) => <i key={i} className={`pb-coin ${c.kind}`} style={{ ['--dx' as string]: `${c.dx}px`, ['--up' as string]: `${c.up}px`, ['--r' as string]: `${c.r}deg`, animationDelay: `${c.delay}ms` }} />)}
      <i className="pb-flash" />
    </div>
  </div>;
}

/** Сцена с софитами для копилки (как витрина в игре) */
export function PigStage({ children, top }: { children: ReactNode; top?: ReactNode }) {
  return <div className="pigstage">
    <i className="ps-beam l" /><i className="ps-beam r" />
    {[[12, 18], [86, 12], [8, 62], [92, 54], [50, 6]].map(([x, y], i) => <i key={i} className="ps-star" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 400}ms` }} />)}
    {top && <div className="ps-top">{top}</div>}
    <div className="ps-pig">{children}</div>
  </div>;
}

const COLORS = ['#1F5FD6', '#E4252F', '#97CFFF', '#2334C8', '#FFB3AD', '#5C9BF3'];
/** Конфетти поверх экрана телефона */
export function Confetti({ count = 46 }: { count?: number }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 500, dur: 1600 + Math.random() * 1400,
    color: COLORS[i % COLORS.length], w: 6 + Math.random() * 6, round: Math.random() > .6, drift: (Math.random() - .5) * 120,
  })), [count]);
  return <div className="confetti" aria-hidden="true">{pieces.map((p, i) => (
    <i key={i} style={{ left: `${p.left}%`, width: p.w, height: p.round ? p.w : p.w * 1.6, background: p.color, borderRadius: p.round ? '50%' : 2,
      animationDelay: `${p.delay}ms`, animationDuration: `${p.dur}ms`, ['--drift' as string]: `${p.drift}px` }} />
  ))}</div>;
}

/** Число, которое «набегает» от 0 — для наград */
export function CountUp({ to, ms = 900 }: { to: number; ms?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!to) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => { const k = Math.min(1, (t - t0) / ms); setV(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return <>{v}</>;
}
