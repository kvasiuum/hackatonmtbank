// Эффекты для детей: живая копилка и праздник после игр. При «уменьшить движение» в системе анимации отключаются (см. styles.css).
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import pigUrl from './assets/neon-pig.webp'; // неоновая свинка с прозрачным фоном

// ---------- Мега-копилка: неоновая стеклянная свинка, внутри видны деньги ----------
// Координаты монет — в пикселях исходной картинки свинки 896×896
const BODY = { cx: 442, cy: 438, rx: 278, ry: 238 }; // внутренняя полость стекла
const BOTTOM = BODY.cy + BODY.ry - 14, TOP = BODY.cy - BODY.ry + 34;
type Money = { x: number; y: number; kind: 'blue' | 'sky' | 'note'; tilt: number };
/** Раскладка денег внутри: ряды снизу вверх, каждый ряд по ширине полости на этой высоте */
function pile(fill: number): Money[] {
  const level = BOTTOM - Math.max(0, Math.min(1, fill)) * (BOTTOM - TOP);
  const out: Money[] = [];
  let row = 0;
  for (let y = BOTTOM; y > level; y -= 19, row++) {
    const half = BODY.rx * Math.sqrt(Math.max(0, 1 - ((y - BODY.cy) / BODY.ry) ** 2)) - 26;
    for (let x = BODY.cx - half + (row % 2 ? 27 : 0); x <= BODY.cx + half; x += 54) {
      const k = (row * 7 + Math.round(x)) % 11;
      out.push({ x: x + ((k % 3) - 1) * 6, y: y + ((k % 2) * 4), kind: k === 0 || k === 6 ? 'note' : k % 2 ? 'blue' : 'sky', tilt: (k - 5) * 3 });
    }
  }
  return out;
}

/**
 * Копилка ребёнка. fill — доля накопленного (0–1), prevFill — сколько было до пополнения:
 * новые монеты падают сверху через прорезь и ложатся на кучу, поверхность вспыхивает.
 * mood: happy — свинка светится ярче, full — пульсирует и ждёт, чтобы её разбили.
 */
export function MegaPig({ fill, prevFill, mood = 'idle', className = '' }: { fill: number; prevFill?: number; mood?: 'idle' | 'happy' | 'full'; className?: string }) {
  const uid = useMemo(() => Math.random().toString(36).slice(2, 8), []);
  const money = useMemo(() => pile(fill), [fill]);
  const was = prevFill === undefined ? money.length : pile(prevFill).length;
  const level = BOTTOM - Math.max(0, Math.min(1, fill)) * (BOTTOM - TOP);
  const clip = `in${uid}`;
  return (
    <div className={`neonpig ${mood} ${className}`} aria-hidden="true">
      <svg className="np-money" viewBox="0 0 896 896">
        <defs>
          <clipPath id={clip}><ellipse cx={BODY.cx} cy={BODY.cy} rx={BODY.rx} ry={BODY.ry} /></clipPath>
          <radialGradient id={`glow${uid}`}><stop offset="0" stopColor="#97CFFF" stopOpacity=".55" /><stop offset="1" stopColor="#97CFFF" stopOpacity="0" /></radialGradient>
        </defs>
        <g clipPath={`url(#${clip})`}>
          {money.map((m, i) => (
            <g key={i} transform={`translate(${m.x} ${m.y}) rotate(${m.tilt})`}>
              <g className={i >= was ? 'pm-new' : ''} style={i >= was ? { animationDelay: `${(i - was) * 18}ms`, ['--fall' as string]: `${-(m.y - 120)}px` } : undefined}>
                {m.kind === 'note'
                  ? <><rect x="-36" y="-15" width="72" height="30" rx="5" fill="#FF8E87" /><rect x="-26" y="-9" width="52" height="18" rx="4" fill="none" stroke="#FFE1DE" strokeWidth="3" /></>
                  : <><ellipse cx="0" cy="8" rx="30" ry="13" fill={m.kind === 'blue' ? '#1446B8' : '#2F7BEF'} /><ellipse cx="0" cy="0" rx="30" ry="13" fill={m.kind === 'blue' ? '#3D86F5' : '#B9DEFF'} />
                    <ellipse cx="0" cy="0" rx="18" ry="7" fill="none" stroke="#FFFFFF" strokeOpacity=".75" strokeWidth="3" /></>}
              </g>
            </g>
          ))}
          {/* вспышка на поверхности, когда деньги легли */}
          {prevFill !== undefined && money.length > was && <ellipse className="pm-surface" cx={BODY.cx} cy={level} rx={BODY.rx * .8} ry="34" fill={`url(#glow${uid})`} />}
        </g>
      </svg>
      <img className="np-img" src={pigUrl} alt="" draggable={false} />
      {mood === 'full' && [[8, 18], [86, 14], [6, 70], [90, 66]].map(([x, y], i) => <i key={i} className="np-spark" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 220}ms` }} />)}
    </div>
  );
}

const SHARDS = ['0,0 40,-6 26,30', '0,0 -34,-14 -18,26', '0,0 22,-38 -16,-30', '0,0 36,22 8,40', '0,0 -30,20 -40,-12', '0,0 -8,-44 24,-30', '0,0 44,8 30,-26', '0,0 -20,40 -44,18'];
/** Взрыв копилки: вспышка, осколки стекла, монеты и купюры разлетаются */
export function PigBurst() {
  const coins = useMemo(() => Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2 + Math.random() * .4;
    const d = 90 + Math.random() * 90;
    return { dx: Math.cos(a) * d, up: -60 - Math.random() * 90, r: Math.random() * 720 - 360, delay: Math.random() * 120, kind: i % 5 === 0 ? 'note' : i % 2 ? 'blue' : 'sky' };
  }), []);
  return <div className="pigburst" aria-hidden="true">
    <i className="pb-flash" />
    <i className="pb-ring" />
    {SHARDS.map((pts, i) => {
      const a = (i / SHARDS.length) * Math.PI * 2;
      return <svg key={i} className="pb-shard" viewBox="-50 -50 100 100" style={{ ['--dx' as string]: `${Math.cos(a) * 150}px`, ['--dy' as string]: `${Math.sin(a) * 120 - 30}px`, ['--r' as string]: `${(i % 2 ? 1 : -1) * (160 + i * 25)}deg` }}>
        <polygon points={pts} fill={i % 3 === 0 ? '#5C9BF3' : '#E7F4FF'} stroke={i % 3 === 0 ? '#97CFFF' : '#5C9BF3'} strokeWidth="2.5" strokeLinejoin="round" opacity=".95" />
      </svg>;
    })}
    {coins.map((c, i) => <i key={i} className={`pb-coin ${c.kind}`} style={{ ['--dx' as string]: `${c.dx}px`, ['--up' as string]: `${c.up}px`, ['--r' as string]: `${c.r}deg`, animationDelay: `${c.delay}ms` }} />)}
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

/** Праздник после пополнения: монетки падают внутрь, свинка радуется; если цель набрана — светится и взрывается */
export function PiggyParty({ from, to, amount, onBurst }: { from: number; to: number; amount: string; onBurst?: () => Promise<unknown> }) {
  const [stage, setStage] = useState<'drop' | 'happy' | 'full' | 'boom'>('drop');
  useEffect(() => {
    const t = [setTimeout(() => setStage(to >= 1 ? 'full' : 'happy'), 700)];
    if (to >= 1) t.push(setTimeout(() => { setStage('boom'); onBurst?.(); }, 2300));
    return () => t.forEach(clearTimeout);
  }, [to]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="pigparty">
      <PigStage>
        {[0, 1, 2].map(i => <span key={i} className="pig-coin" style={{ animationDelay: `${i * 160}ms`, left: `${46 + i * 3}%` }}>М</span>)}
        {stage !== 'boom' && <MegaPig fill={stage === 'drop' ? from : to} prevFill={from} mood={stage === 'drop' ? 'idle' : stage === 'full' ? 'full' : 'happy'} className={stage === 'happy' ? 'pig-jump' : stage === 'full' ? 'pig-shake' : ''} />}
        {stage === 'boom' && <><PigBurst /><div className="pig-hole" /></>}
      </PigStage>
      <div className="pig-amount">+{amount}</div>
    </div>
  );
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
