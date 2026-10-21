// Эффекты для детей: живая копилка и праздник после игр. При «уменьшить движение» в системе анимации отключаются (см. styles.css).
import { useEffect, useMemo, useState } from 'react';

/**
 * Копилка-свинка. fill — насколько полна цель (0–1): внутри поднимается «уровень монет».
 * happy — глаза-улыбки и румянец, когда в копилку только что положили деньги.
 */
export function Piggy({ fill, happy = false, size = 120, className = '' }: { fill: number; happy?: boolean; size?: number; className?: string }) {
  const id = useMemo(() => `pig${Math.random().toString(36).slice(2, 8)}`, []);
  const level = 92 - Math.max(0, Math.min(1, fill)) * 62; // верх тела 30, низ 92
  return (
    <svg className={`piggy ${happy ? 'happy' : ''} ${className}`} width={size} height={size * 0.86} viewBox="0 0 140 120" aria-hidden="true">
      <defs><clipPath id={id}><ellipse cx="66" cy="61" rx="46" ry="33" /></clipPath></defs>
      <path d="M20 58c-9-3-12 6-6 9 4 2 7-2 4-4" fill="none" stroke="#E4252F" strokeWidth="3" strokeLinecap="round" />
      <rect x="34" y="84" width="12" height="18" rx="5" fill="#FFB3AD" stroke="#E4252F" strokeWidth="2.5" />
      <rect x="82" y="84" width="12" height="18" rx="5" fill="#FFB3AD" stroke="#E4252F" strokeWidth="2.5" />
      <ellipse cx="66" cy="61" rx="46" ry="33" fill="#FFD3CF" />
      <g clipPath={`url(#${id})`}>
        <rect className="pig-level" x="18" y={level} width="96" height="70" fill="#FF9B93" />
        <path className="pig-wave" d={`M18 ${level} q12 -5 24 0 t24 0 t24 0 t24 0`} fill="none" stroke="#FFC4BF" strokeWidth="3" />
      </g>
      <ellipse cx="66" cy="61" rx="46" ry="33" fill="none" stroke="#E4252F" strokeWidth="3" />
      <path d="M86 33 L96 14 L100 38 Z" fill="#FFB3AD" stroke="#E4252F" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="54" y="26" width="22" height="5" rx="2.5" fill="#B3122A" />
      <ellipse cx="113" cy="63" rx="11" ry="10" fill="#FFB3AD" stroke="#E4252F" strokeWidth="2.5" />
      <circle cx="110" cy="62" r="2" fill="#B3122A" /><circle cx="116" cy="62" r="2" fill="#B3122A" />
      {happy
        ? <><path d="M88 50 q5 -7 10 0" fill="none" stroke="#141416" strokeWidth="3" strokeLinecap="round" /><ellipse className="pig-blush" cx="96" cy="70" rx="7" ry="4" fill="#FF6F66" opacity=".55" />
          <path d="M84 78 q8 7 16 0" fill="none" stroke="#B3122A" strokeWidth="2.5" strokeLinecap="round" /></>
        : <><circle cx="93" cy="50" r="3.5" fill="#141416" /><path d="M86 78 q6 3 12 0" fill="none" stroke="#B3122A" strokeWidth="2.5" strokeLinecap="round" /></>}
    </svg>
  );
}

/** Праздник копилки: монетки падают в прорезь, свинка радуется, уровень поднимается */
export function PiggyParty({ from, to, amount }: { from: number; to: number; amount: string }) {
  const [fill, setFill] = useState(from);
  const [happy, setHappy] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => { setFill(to); setHappy(true); }, 650);
    return () => clearTimeout(a);
  }, [to]);
  return (
    <div className="pigparty">
      <div className="pig-stage">
        {[0, 1, 2].map(i => <span key={i} className="pig-coin" style={{ animationDelay: `${i * 160}ms`, left: `${44 + i * 3}%` }}>М</span>)}
        <Piggy fill={fill} happy={happy} size={180} className={happy ? 'pig-jump' : ''} />
        {happy && [0, 1, 2, 3].map(i => <span key={i} className="pig-heart" style={{ left: `${20 + i * 20}%`, animationDelay: `${i * 120}ms` }}>♥</span>)}
      </div>
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
