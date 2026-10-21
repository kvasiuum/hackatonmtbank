// Базовые элементы интерфейса в стиле Moby.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CARD_COLORS, CARD_TYPES, CAT_KEYS, PERM_KEYS, SETTING_LABELS } from '../../server/src/content';
import type { Card, CardType, ChildSettings, ChildSummary, ParentCard, SettingPath, Tx } from '../../server/src/types';
import { Icon } from './icons';
import { fmt, initial, useDevice, when } from './lib';

export const TopBar = ({ title, right }: { title: string; right?: ReactNode }) => {
  const { back } = useDevice();
  return <div className="topbar"><button className="back" onClick={back} aria-label="Назад"><Icon name="arrow-left" size={26} /></button><h1>{title}</h1>{right}</div>;
};
export const PlainTop = ({ title, right }: { title: string; right?: ReactNode }) => <div className="topbar plain"><h1>{title}</h1>{right}</div>;

export const Act = ({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) => (
  <button className="act" onClick={onClick}><span className="box"><Icon name={icon} size={30} sw={1.5} /></span>{label}</button>
);

export const RowIcon = ({ name, tone }: { name: string; tone?: 'red' | 'dash' | 'sq' }) => <div className={`ic ${tone ?? ''}`}><Icon name={name} size={22} /></div>;
export const Chev = () => <span className="chev"><Icon name="chevron-right" size={20} /></span>;

export function Row({ icon, tone, title, sub, right, onClick }: { icon?: string; tone?: 'red' | 'dash' | 'sq'; title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void }) {
  const inner = <>{icon && <RowIcon name={icon} tone={tone} />}<div className="tx"><b>{title}</b>{sub && <small>{sub}</small>}</div>{right ?? (onClick ? <Chev /> : null)}</>;
  return onClick ? <button className="row" onClick={onClick}>{inner}</button> : <div className="row">{inner}</div>;
}

export const Toggle = ({ on, onChange, locked, label }: { on: boolean; onChange?: (v: boolean) => void; locked?: boolean; label: string }) => {
  const { toast } = useDevice();
  return <button className={`toggle ${on ? 'on' : ''} ${locked ? 'locked' : ''}`} role="switch" aria-checked={on} aria-label={label}
    onClick={() => (locked ? toast('Эту защиту установил банк, её нельзя отключить до 18 лет') : onChange?.(!on))} />;
};

/** Свёртываемый блок настроек: заголовок с кратким итогом, детали по нажатию */
export function Fold({ icon, title, sub, children, open: initial = false }: { icon?: string; title: ReactNode; sub?: ReactNode; children: ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(initial);
  return <div className={`card fold ${open ? 'open' : ''}`}>
    <button className="fold-h" onClick={() => setOpen(!open)} aria-expanded={open}>
      {icon && <RowIcon name={icon} />}<div className="tx"><b>{title}</b>{sub && <small>{sub}</small>}</div>
      <span className="chev"><Icon name="chevron-down" size={20} /></span>
    </button>
    {open && <div className="fold-b">{children}</div>}
  </div>;
}

export const SetRow = ({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children: ReactNode }) => (
  <div className="setrow"><div className="tx"><b>{title}</b>{sub && <small>{sub}</small>}</div>{children}</div>
);

export const Stepper = ({ value, step, min = step, onChange }: { value: number; step: number; min?: number; onChange: (v: number) => void }) => (
  <div className="stepper">
    <button onClick={() => onChange(Math.max(min, value - step))} aria-label="Меньше">−</button>
    <span>{fmt(value)}</span>
    <button onClick={() => onChange(value + step)} aria-label="Больше">+</button>
  </div>
);

export const Bar = ({ value, max, red }: { value: number; max: number; red?: boolean }) => (
  <div className={`bar ${red ? 'red' : ''}`}><i style={{ width: `${Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100))}%` }} /></div>
);

export const Kava = ({ c, size }: { c: Pick<ChildSummary, 'name' | 'color'>; size?: number }) => (
  <div className="kava" style={{ background: c.color, ...(size ? { width: size, height: size } : {}) }}>{initial(c.name)}</div>
);
export const GroupTag = ({ g }: { g: 'kid' | 'teen' }) => <span className={`tag ${g === 'kid' ? 'red' : ''}`}>{g === 'kid' ? '7–13' : '14–17'}</span>;
export const Coin = () => <span className="coin">М</span>;

export function BankCard({ name, card }: { name: string; card: Pick<Card, 'type' | 'color' | 'status' | 'last4'> }) {
  const t = CARD_TYPES[card.type];
  return (
    <div className="bankcard" style={{ background: card.color }}>
      <div className="top"><span>Moby Семья</span><span><Icon name={t.physical ? (card.type === 'bracelet' ? 'watch' : card.type === 'sticker' ? 'sticker' : 'credit-card') : 'smartphone'} size={16} />{t.label}</span></div>
      {card.type === 'virtual' ? <div /> : <div className="chipm" />}
      <div className="bot"><span>{(name || 'ИМЯ РЕБЁНКА').toUpperCase()}</span><span className="num">•• {card.last4}</span></div>
      {card.status === 'blocked' && <div className="veil">Заблокирована</div>}
      {card.status === 'delivery' && <div className="veil">Доставка 3–5 дней</div>}
    </div>
  );
}
export const cardIcon = (t: CardType) => (t === 'bracelet' ? 'watch' : t === 'sticker' ? 'sticker' : t === 'plastic' ? 'credit-card' : 'smartphone');
export const mainCard = (cards: Card[]) => cards.find(c => CARD_TYPES[c.type].physical) ?? cards[0];

const NetworkLogo = ({ n }: { n: ParentCard['network'] }) => n === 'visa' ? <b className="mc-visa">VISA</b>
  : n === 'mastercard' ? <svg width="34" height="22" viewBox="0 0 34 22" aria-label="Mastercard"><circle cx="12" cy="11" r="10" fill="#E42C26" /><circle cx="22" cy="11" r="10" fill="#FF5912" fillOpacity=".85" /></svg>
    : <b className="mc-belkart">БЕЛКАРТ</b>;

/** Миниатюра карты родителя, как в Moby */
export function MiniCard({ c, on }: { c: ParentCard; on?: boolean }) {
  return <div className={`minicard ${on ? 'on' : ''}`}>
    <div className="mc-top"><span>{c.title.toUpperCase()}</span><i className="mc-chip" /></div>
    <div className="mc-bal">{fmt(c.balance).replace(' BYN', '')}<span> BYN</span></div>
    <div className="mc-bot"><span>{c.mask} · {c.expiry}</span><NetworkLogo n={c.network} /></div>
  </div>;
}

/** Карусель карт: листается пальцем, выбранной считается карта, на которой остановилась лента */
export function CardCarousel({ cards, value, onChange }: { cards: ParentCard[]; value: string; onChange: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const step = () => { const el = ref.current!; const first = el.firstElementChild as HTMLElement | null; return (first?.offsetWidth ?? 1) + 12; };
  const onScroll = () => { const i = Math.round(ref.current!.scrollLeft / step()); if (cards[i] && cards[i].id !== value) onChange(cards[i].id); };
  const go = (i: number) => ref.current?.scrollTo({ left: i * step(), behavior: 'smooth' });
  return <>
    <div className="mccar" ref={ref} onScroll={onScroll}>
      {cards.map((c, i) => <button key={c.id} className="mcitem" onClick={() => { go(i); onChange(c.id); }} aria-label={`Карта ${c.title} ${c.mask}`}><MiniCard c={c} on={c.id === value} /></button>)}
    </div>
    {cards.length > 1 && <div className="mcdots">{cards.map((c, i) => <button key={c.id} className={c.id === value ? 'on' : ''} onClick={() => { go(i); onChange(c.id); }} aria-label={`Карта ${i + 1}`} />)}</div>}
  </>;
}

export function CardStatus({ c }: { c: Card }) {
  if (c.status === 'blocked') return <span className="tag solid-red">Заблокирована</span>;
  if (c.status === 'delivery') return <span className="tag red">В доставке</span>;
  return <span className="tag">Активна</span>;
}

export function Swatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="swatches" role="radiogroup" aria-label="Цвет карты">
      {CARD_COLORS.map(c => (
        <button key={c} className={`swatch press ${value === c ? 'on' : ''}`} style={{ background: c }} role="radio" aria-checked={value === c} aria-label="Цвет карты" onClick={() => onChange(c)}>
          {value === c && <Icon name="check" size={26} sw={2.6} />}
        </button>
      ))}
    </div>
  );
}

export function CardTypePicker({ types, value, onChange }: { types: CardType[]; value: CardType; onChange: (t: CardType) => void }) {
  return <>{types.map(t => (
    <button key={t} className={`choice press ${value === t ? 'on' : ''}`} onClick={() => onChange(t)}>
      <RowIcon name={cardIcon(t)} /><span><b>{CARD_TYPES[t].label}</b><small>{CARD_TYPES[t].sub}</small></span>
    </button>
  ))}</>;
}

export function OpsList({ ops, limit = 6 }: { ops: Tx[]; limit?: number }) {
  if (!ops.length) return <div className="empty">Операций пока нет</div>;
  return <>{ops.slice(0, limit).map(o => (
    <Row key={o.id} icon={o.amount > 0 ? 'topup' : o.method === 'qr' ? 'qr-code' : 'pay'} title={o.title} sub={`${when(o.createdAt)} · ${o.category}`}
      right={<span className={`amt ${o.amount > 0 ? 'plus' : ''}`}>{o.amount > 0 ? '+' : ''}{fmt(o.amount)}</span>} />
  ))}</>;
}

export const BankLocked = () => <>
  <SetRow title="Азартные игры и ставки" sub="Запрещено банком до 18 лет"><Toggle on={false} locked label="Азартные игры" /></SetRow>
  <SetRow title="Товары 18+" sub="Табак, алкоголь, вейпы: запрещено банком"><Toggle on={false} locked label="Товары 18+" /></SetRow>
</>;

/** Переключатели разрешений: используются и в карточке ребёнка, и при оформлении */
export function PermissionToggles({ s, group, keys, onChange }: { s: ChildSettings; group: 'kid' | 'teen'; keys: 'cats' | 'perms'; onChange: (path: SettingPath, v: boolean) => void }) {
  const list = keys === 'cats' ? CAT_KEYS.map(k => `cats.${k}` as SettingPath) : PERM_KEYS.map(k => `perms.${k}` as SettingPath);
  return <>{list.map(path => {
    const [g, k] = path.split('.') as ['cats' | 'perms', string];
    if (path === 'perms.deposit' && group === 'teen') {
      return <SetRow key={path} title="Свой вклад" sub="С 14 лет открывается самостоятельно (ст. 26 ГК РБ)"><span className="tag">По закону</span></SetRow>;
    }
    return <SetRow key={path} title={SETTING_LABELS[path].title} sub={SETTING_LABELS[path].sub}>
      <Toggle on={(s[g] as Record<string, boolean>)[k]} label={SETTING_LABELS[path].title} onChange={v => onChange(path, v)} />
    </SetRow>;
  })}</>;
}

export function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true"><div className="grab" />{children}</div>
    </div>
  );
}

export function AmountField({ label, value, onChange, presets }: { label: string; value: string; onChange: (v: string) => void; presets?: number[] }) {
  return <>
    <div className="field"><label>{label}</label><input type="number" inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} /></div>
    {presets && <div className="pills">{presets.map(v => <button key={v} className="pill" onClick={() => onChange(String(v))}>{v} BYN</button>)}</div>}
  </>;
}

export function useBusy() {
  const [busy, setBusy] = useState(false);
  const wrap = async (fn: () => Promise<unknown>) => { if (busy) return; setBusy(true); try { await fn(); } finally { setBusy(false); } };
  return [busy, wrap] as const;
}

/** Псевдо-QR для приглашения: детерминированный узор из кода */
export function InviteQr({ code }: { code: string }) {
  let seed = [...code].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7);
  const cells: boolean[] = [];
  for (let i = 0; i < 441; i++) {
    const x = i % 21, y = Math.floor(i / 21);
    const fx = x < 7 ? x : x > 13 ? x - 14 : -1, fy = y < 7 ? y : y > 13 ? y - 14 : -1;
    if (fx >= 0 && fy >= 0 && !(x > 13 && y > 13)) {
      cells.push(fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4));
    } else { seed = (seed * 1103515245 + 12345) & 0x7fffffff; cells.push(seed % 3 === 0); }
  }
  return <div className="qr" role="img" aria-label={`QR-код приглашения ${code}`}>{cells.map((on, i) => <i key={i} className={on ? '' : 'w'} />)}</div>;
}

/**
 * Горизонтальная лента, которую можно тянуть мышью с инерцией (как пальцем на телефоне).
 * На сенсорных экранах работает родная прокрутка браузера, её не трогаем.
 */
export function useDragScroll<T extends HTMLElement>(ready = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let down = false, moved = false, startX = 0, startLeft = 0, lastX = 0, lastT = 0, v = 0, raf = 0;
    const glide = () => {
      v *= 0.94; // трение
      el.scrollLeft -= v * 16;
      if (Math.abs(v) > 0.02) raf = requestAnimationFrame(glide);
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      cancelAnimationFrame(raf);
      down = true; moved = false; v = 0;
      startX = lastX = e.clientX; startLeft = el.scrollLeft; lastT = performance.now();
      el.classList.add('dragging');
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const now = performance.now();
      v = 0.8 * ((e.clientX - lastX) / Math.max(1, now - lastT)) + 0.2 * v;
      lastX = e.clientX; lastT = now;
      if (Math.abs(e.clientX - startX) > 4) moved = true;
      el.scrollLeft = startLeft - (e.clientX - startX);
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      el.classList.remove('dragging');
      if (performance.now() - lastT < 100) raf = requestAnimationFrame(glide);
    };
    // После перетаскивания клик по карточке не срабатывает
    const onClick = (e: MouseEvent) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } };
    const noDrag = (e: Event) => e.preventDefault();
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    el.addEventListener('click', onClick, true);
    el.addEventListener('dragstart', noDrag);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('click', onClick, true);
      el.removeEventListener('dragstart', noDrag);
    };
  }, [ready]);
  return ref;
}
