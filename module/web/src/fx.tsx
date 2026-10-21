// Эффекты для детей: живая копилка и праздник после игр. При «уменьшить движение» в системе анимации отключаются (см. styles.css).
import { useEffect, useMemo, useState, type ReactNode } from 'react';

// ---------- Мега-копилка: стеклянная свинка на подиуме, внутри видны деньги ----------
const BODY = { cx: 130, cy: 112, rx: 92, ry: 70 };
const BOTTOM = BODY.cy + BODY.ry - 6, TOP = BODY.cy - BODY.ry + 14;
type Money = { x: number; y: number; kind: 'blue' | 'sky' | 'note'; tilt: number };
/** Раскладка монет и купюр внутри стекла: ряды снизу вверх, каждый ряд по ширине эллипса */
function pile(fill: number): Money[] {
  const level = BOTTOM - Math.max(0, Math.min(1, fill)) * (BOTTOM - TOP);
  const out: Money[] = [];
  let row = 0;
  for (let y = BOTTOM; y > level; y -= 7, row++) {
    const half = BODY.rx * Math.sqrt(Math.max(0, 1 - ((y - BODY.cy) / BODY.ry) ** 2)) - 12;
    for (let x = BODY.cx - half + (row % 2 ? 10 : 0); x <= BODY.cx + half; x += 20) {
      const k = (row * 7 + Math.round(x)) % 11;
      out.push({ x: x + ((k % 3) - 1) * 2, y, kind: k === 0 || k === 6 ? 'note' : k % 2 ? 'blue' : 'sky', tilt: (k - 5) * 3 });
    }
  }
  return out;
}

/**
 * Копилка ребёнка. fill — доля накопленного (0–1), prevFill — сколько было до пополнения:
 * новые монеты падают сверху. mood: happy — улыбается после пополнения, full — светится и ждёт, чтобы её разбили.
 */
export function MegaPig({ fill, prevFill, mood = 'idle', className = '' }: { fill: number; prevFill?: number; mood?: 'idle' | 'happy' | 'full'; className?: string }) {
  const uid = useMemo(() => Math.random().toString(36).slice(2, 8), []);
  const money = useMemo(() => pile(fill), [fill]);
  const was = prevFill === undefined ? money.length : pile(prevFill).length;
  const id = (n: string) => `${n}${uid}`;
  const happy = mood !== 'idle';
  return (
    <svg className={`megapig ${mood} ${className}`} viewBox="0 0 260 222" aria-hidden="true">
      <defs>
        <radialGradient id={id('glass')} cx="38%" cy="30%" r="75%">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity=".95" /><stop offset=".55" stopColor="#E7F4FF" stopOpacity=".55" /><stop offset="1" stopColor="#97CFFF" stopOpacity=".7" />
        </radialGradient>
        <linearGradient id={id('red')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FF6F66" /><stop offset="1" stopColor="#E42C26" /></linearGradient>
        <linearGradient id={id('podium')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E42C26" /><stop offset="1" stopColor="#9E1426" /></linearGradient>
        <clipPath id={id('in')}><ellipse cx={BODY.cx} cy={BODY.cy} rx={BODY.rx - 4} ry={BODY.ry - 4} /></clipPath>
      </defs>
      {/* подиум */}
      <ellipse cx="130" cy="208" rx="88" ry="13" fill="#7A0F1E" />
      <rect x="42" y="194" width="176" height="14" fill={`url(#${id('podium')})`} />
      <ellipse cx="130" cy="194" rx="88" ry="13" fill="#FF6F66" />
      {[-70, -46, -22, 2, 26, 50, 70].map((dx, i) => <circle key={i} cx={130 + dx} cy={201 + Math.abs(dx) / 20} r="2.6" fill="#FFE1DE" />)}
      {/* ножки и хвостик */}
      {[72, 102, 152, 182].map(x => <rect key={x} x={x - 11} y="160" width="22" height="34" rx="9" fill={`url(#${id('red')})`} />)}
      <path d="M42 108 c-16 -6 -20 12 -8 15 c10 2 10 -10 1 -9" fill="none" stroke="#E42C26" strokeWidth="4.5" strokeLinecap="round" />
      {/* стекло с деньгами внутри */}
      <ellipse cx={BODY.cx} cy={BODY.cy} rx={BODY.rx} ry={BODY.ry} fill={`url(#${id('glass')})`} />
      <g clipPath={`url(#${id('in')})`}>
        {money.map((m, i) => (
          <g key={i} transform={`translate(${m.x} ${m.y}) rotate(${m.tilt})`}><g className={i >= was ? 'pm-new' : ''} style={i >= was ? { animationDelay: `${(i - was) * 22}ms` } : undefined}>
            {m.kind === 'note'
              ? <><rect x="-13" y="-6" width="26" height="12" rx="2" fill="#FF8E87" /><rect x="-9" y="-3.5" width="18" height="7" rx="1.5" fill="none" stroke="#FFE1DE" strokeWidth="1.4" /></>
              : <><ellipse cx="0" cy="3" rx="11" ry="5" fill={m.kind === 'blue' ? '#1446B8' : '#5C9BF3'} /><ellipse cx="0" cy="0" rx="11" ry="5" fill={m.kind === 'blue' ? '#1F5FD6' : '#97CFFF'} />
                <ellipse cx="0" cy="0" rx="6.5" ry="2.6" fill="none" stroke="#FFFFFF" strokeOpacity=".7" strokeWidth="1.2" /></>}
          </g></g>
        ))}
      </g>
      <ellipse cx={BODY.cx} cy={BODY.cy} rx={BODY.rx} ry={BODY.ry} fill="none" stroke="#5C9BF3" strokeWidth="3.5" />
      {/* блики на стекле */}
      <path d="M66 86 Q80 58 116 48" fill="none" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" opacity=".85" />
      <path d="M58 104 Q59 97 62 92" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" opacity=".7" />
      <ellipse cx="176" cy="160" rx="16" ry="5" fill="#FFFFFF" opacity=".35" transform="rotate(-25 176 160)" />
      {/* уши, прорезь, пятачок, глаза */}
      <path d="M80 62 Q84 30 94 22 Q108 36 114 52 Z" fill={`url(#${id('red')})`} stroke="#B3122A" strokeWidth="2" strokeLinejoin="round" />
      <path d="M90 52 Q93 38 97 33 Q103 42 106 50 Z" fill="#FFB3AD" />
      <path d="M150 50 Q160 30 176 20 Q182 40 178 60 Z" fill={`url(#${id('red')})`} stroke="#B3122A" strokeWidth="2" strokeLinejoin="round" />
      <path d="M158 50 Q164 38 172 32 Q174 44 172 54 Z" fill="#FFB3AD" />
      <rect x="108" y="40" width="44" height="9" rx="4.5" fill="#0F2F7A" />
      <ellipse cx="223" cy="118" rx="21" ry="26" fill={`url(#${id('red')})`} stroke="#B3122A" strokeWidth="2" />
      <ellipse cx="216" cy="118" rx="4.5" ry="8" fill="#7A0F1E" /><ellipse cx="231" cy="118" rx="4.5" ry="8" fill="#7A0F1E" />
      {happy
        ? <><path d="M170 88 q7 -9 14 0" fill="none" stroke="#141416" strokeWidth="4" strokeLinecap="round" /><path d="M190 86 q6 -8 12 0" fill="none" stroke="#141416" strokeWidth="4" strokeLinecap="round" />
          <ellipse className="pm-blush" cx="174" cy="106" rx="9" ry="5" fill="#FF6F66" opacity=".6" /></>
        : <><ellipse cx="177" cy="88" rx="7" ry="9" fill="#FFFFFF" /><circle cx="179" cy="90" r="4.6" fill="#141416" /><circle cx="181" cy="87" r="1.6" fill="#FFFFFF" />
          <ellipse cx="197" cy="86" rx="6" ry="8" fill="#FFFFFF" /><circle cx="199" cy="88" r="4" fill="#141416" /><circle cx="200.5" cy="85.5" r="1.4" fill="#FFFFFF" /></>}
      {mood === 'full' && [[30, 40], [228, 52], [44, 170], [232, 172]].map(([x, y], i) => <path key={i} className="pm-spark" style={{ animationDelay: `${i * 220}ms` }}
        d={`M${x} ${y - 9} L${x + 2.5} ${y - 2.5} L${x + 9} ${y} L${x + 2.5} ${y + 2.5} L${x} ${y + 9} L${x - 2.5} ${y + 2.5} L${x - 9} ${y} L${x - 2.5} ${y - 2.5} Z`} fill="#FFFFFF" />)}
    </svg>
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
        <polygon points={pts} fill={i % 3 === 0 ? '#FF6F66' : '#E7F4FF'} stroke={i % 3 === 0 ? '#B3122A' : '#97CFFF'} strokeWidth="2.5" strokeLinejoin="round" opacity=".95" />
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
