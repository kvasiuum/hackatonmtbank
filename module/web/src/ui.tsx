// Базовые элементы интерфейса в стиле Moby.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CARD_COLORS, CARD_TYPES, CAT_KEYS, DISPUTE_REASONS, PERM_KEYS, SETTING_LABELS } from '../../server/src/content';
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

export function BankCard({ name, card }: { name: string; card: Pick<Card, 'type' | 'color' | 'status' | 'last4'> & Partial<Pick<Card, 'label' | 'favorite'>> }) {
  const t = CARD_TYPES[card.type];
  return (
    <div className="bankcard" style={{ background: card.color }}>
      <div className="top"><span className="bc-label">{card.favorite && <Icon name="star" size={15} sw={2.2} />}{card.label || 'Moby Семья'}</span><span><Icon name={t.physical ? (card.type === 'bracelet' ? 'watch' : card.type === 'sticker' ? 'sticker' : 'credit-card') : 'smartphone'} size={16} />{t.label}</span></div>
      {card.type === 'virtual' ? <div /> : <div className="chipm" />}
      <div className="bot"><span>{(name || 'ИМЯ РЕБЁНКА').toUpperCase()}</span><span className="num">•• {card.last4}</span></div>
      {card.status === 'blocked' && <div className="veil">Заблокирована</div>}
      {card.status === 'delivery' && <div className="veil">Доставка 3–5 дней</div>}
    </div>
  );
}
export const cardIcon = (t: CardType) => (t === 'bracelet' ? 'watch' : t === 'sticker' ? 'sticker' : t === 'plastic' ? 'credit-card' : 'smartphone');
/** Карта «по умолчанию»: избранная, иначе физическая, иначе первая */
export const mainCard = (cards: Card[]) => cards.find(c => c.favorite) ?? cards.find(c => CARD_TYPES[c.type].physical) ?? cards[0];

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

/** Карусель: листается пальцем, выбранным считается элемент, на котором остановилась лента */
export function Carousel<T extends { id: string }>({ items, value, onChange, render, label }: {
  items: T[]; value: string; onChange: (id: string) => void; render: (item: T, on: boolean) => ReactNode; label: (item: T) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const step = () => { const el = ref.current!; const first = el.firstElementChild as HTMLElement | null; return (first?.offsetWidth ?? 1) + 12; };
  const onScroll = () => { const i = Math.round(ref.current!.scrollLeft / step()); if (items[i] && items[i].id !== value) onChange(items[i].id); };
  const go = (i: number, behavior: ScrollBehavior = 'smooth') => ref.current?.scrollTo({ left: i * step(), behavior });
  // Открываемся сразу на выбранном элементе
  useEffect(() => { const i = items.findIndex(c => c.id === value); if (i > 0) go(i, 'instant' as ScrollBehavior); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <>
    <div className="mccar" ref={ref} onScroll={onScroll}>
      {items.map((c, i) => <button key={c.id} className="mcitem" onClick={() => { go(i); onChange(c.id); }} aria-label={label(c)} aria-pressed={c.id === value}>{render(c, c.id === value)}</button>)}
    </div>
    {items.length > 1 && <div className="mcdots">{items.map((c, i) => <button key={c.id} className={c.id === value ? 'on' : ''} onClick={() => { go(i); onChange(c.id); }} aria-label={`Карта ${i + 1}`} />)}</div>}
  </>;
}

/** Карусель карт родителя */
export const CardCarousel = ({ cards, value, onChange }: { cards: ParentCard[]; value: string; onChange: (id: string) => void }) =>
  <Carousel items={cards} value={value} onChange={onChange} render={(c, on) => <MiniCard c={c} on={on} />} label={c => `Карта ${c.title} ${c.mask}`} />;

/** Карусель карт ребёнка для оплаты: те же карты, что он видит в «Мои карты» */
export const ChildCardCarousel = ({ name, cards, value, onChange }: { name: string; cards: Card[]; value: string; onChange: (id: string) => void }) =>
  <Carousel items={cards} value={value} onChange={onChange} render={(c, on) => <div className={`cc-item ${on ? 'on' : ''}`}><BankCard name={name} card={c} /></div>}
    label={c => `${c.label || CARD_TYPES[c.type].label} •• ${c.last4}`} />;

/** Управление картами ребёнка: подпись, цвет, избранная, блокировка с подтверждением. Общее для ребёнка и родителя */
export function CardManager({ name, cards, who, children }: { name: string; cards: Card[]; who: 'kid' | 'teen' | 'parent'; children?: ReactNode }) {
  const { run, call } = useDevice();
  const [mode, setMode] = useState<{ kind: 'edit' | 'block' | 'lost'; id: string } | null>(null);
  const main = mainCard(cards);
  // «Я потерял карту» — про физическую карту, даже если избранная виртуальная
  const physical = cards.find(c => c.status === 'active' && CARD_TYPES[c.type].physical);
  const card = mode && cards.find(c => c.id === mode.id);
  const act = (id: string, action: string, ok: string) => run(() => call(`/api/cards/${id}`, { action }), ok);
  if (mode && card) {
    if (mode.kind === 'edit') return <CardEdit name={name} card={card} done={() => setMode(null)} />;
    return <div className="cm-confirm">
      <h3>{mode.kind === 'lost' ? 'Карта потерялась?' : 'Заблокировать карту?'}</h3>
      <BankCard name={name} card={card} />
      <p className="muted">{CARD_TYPES[card.type].label} •• {card.last4} перестанет работать сразу.
        {who === 'kid' ? ' Разблокировать её сможет только родитель.' : ' Разблокировать можно здесь же.'}{who !== 'parent' ? ' Родители получат уведомление.' : ''}
        {mode.kind === 'lost' && cards.some(c => c.id !== card.id && c.status === 'active') ? ' Пока плати другой картой или по QR КРОК.' : ''}</p>
      <button className="btn solid-red" onClick={async () => { if (await act(card.id, 'block', 'Карта заблокирована')) setMode(null); }}><Icon name="lock" size={20} /> Заблокировать</button>
      <button className="btn ghost" onClick={() => setMode(null)}>Отмена</button>
    </div>;
  }
  return <>
    {main && <button className="cm-main press" onClick={() => setMode({ kind: 'edit', id: main.id })} aria-label="Изменить карту"><BankCard name={name} card={main} /><span className="cm-edit"><Icon name="pencil" size={16} /> Изменить</span></button>}
    {who !== 'parent' && physical && <button className="btn red" onClick={() => setMode({ kind: 'lost', id: physical.id })}><Icon name="lock" size={20} /> Я потерял карту</button>}
    <div>{cards.map(c => (
      <div className="row" key={c.id}>
        <button className="cm-row" onClick={() => setMode({ kind: 'edit', id: c.id })} aria-label={`Изменить карту •• ${c.last4}`}>
          <div className="ic" style={{ background: c.color, color: '#fff' }}><Icon name={cardIcon(c.type)} size={22} /></div>
          <div className="tx"><b>{c.label || CARD_TYPES[c.type].label}</b>
            <small style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>•• {c.last4} <CardStatus c={c} />{c.favorite && <span className="tag fav"><Icon name="star" size={12} sw={2.4} /> Избранная</span>}</small></div>
        </button>
        {c.status === 'delivery' && who === 'parent' ? <button className="sbtn" onClick={() => act(c.id, 'activate', 'Карта получена и активирована')}>Получена</button>
          : c.status === 'blocked' ? (who !== 'kid' && <button className="sbtn" onClick={() => act(c.id, 'unblock', 'Карта снова работает')}>Разблок.</button>)
            : c.status === 'active' && <button className="sbtn red" onClick={() => setMode({ kind: 'block', id: c.id })}>Блок</button>}
      </div>
    ))}</div>
    {children}
  </>;
}

function CardEdit({ name, card, done }: { name: string; card: Card; done: () => void }) {
  const { run, call } = useDevice();
  const [label, setLabel] = useState(card.label ?? '');
  const [color, setColor] = useState(card.color);
  const [fav, setFav] = useState(card.favorite);
  const [busy, wrap] = useBusy();
  return <div className="cm-confirm">
    <h3>{CARD_TYPES[card.type].label} •• {card.last4}</h3>
    <BankCard name={name} card={{ ...card, color, label: label.trim() || null, favorite: fav }} />
    <div className="field"><label>Подпись на карте</label><input maxLength={20} placeholder="Moby Семья" value={label} onChange={e => setLabel(e.target.value)} /></div>
    <div className="pills">{['Для школы', 'На кино', 'Для спорта', 'Подписки'].map(t => <button key={t} className="pill" onClick={() => setLabel(t)}>{t}</button>)}</div>
    <Swatches value={color} onChange={setColor} />
    <SetRow title="Избранная карта" sub="Ею платим по умолчанию, при оплате она первая"><Toggle on={fav} label="Избранная карта" onChange={setFav} /></SetRow>
    <button className="btn" disabled={busy} onClick={() => wrap(async () => {
      if (await run(() => call(`/api/cards/${card.id}`, { label: label.trim() || null, color, favorite: fav }, 'PATCH'), 'Карта сохранена')) done();
    })}>Сохранить</button>
    <button className="btn ghost" onClick={done}>Отмена</button>
  </div>;
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

/** История операций. Оплату и перевод можно открыть и оспорить */
export function OpsList({ ops, limit = 6 }: { ops: Tx[]; limit?: number }) {
  const { sheet } = useDevice();
  if (!ops.length) return <div className="empty">Операций пока нет</div>;
  return <>{ops.slice(0, limit).map(o => (
    <Row key={o.id} icon={o.amount > 0 ? 'topup' : o.method === 'qr' ? 'qr-code' : 'pay'} title={o.title}
      sub={<>{when(o.createdAt)} · {o.category}{o.dispute && <span className="tag red" style={{ marginLeft: 6 }}>Оспаривается</span>}</>}
      onClick={o.disputable ? () => sheet(close => <DisputeSheet op={o} close={close} />) : undefined}
      right={<span className={`amt ${o.amount > 0 ? 'plus' : ''}`}>{o.amount > 0 ? '+' : ''}{fmt(o.amount)}</span>} />
  ))}</>;
}

function DisputeSheet({ op, close }: { op: Tx; close: () => void }) {
  const { run, call } = useDevice();
  const [reason, setReason] = useState<string | null>(null);
  const [busy, wrap] = useBusy();
  return <>
    <h2>{op.title}</h2>
    <div className="bal" style={{ fontSize: 28, color: 'var(--text)', marginTop: -6 }}>{fmt(op.amount)}</div>
    <small className="muted">{when(op.createdAt)} · {op.category}</small>
    <b>Что не так с операцией?</b>
    {DISPUTE_REASONS.map(r => <button key={r} className={`choice ${reason === r ? 'on' : ''}`} onClick={() => setReason(r)}><span>{r}</span></button>)}
    <div className="legal"><Icon name="info" size={18} /><span>Банк рассмотрит заявку до 10 рабочих дней, деньги вернутся на счёт, если операция ошибочная. Если её совершили не вы — сразу заблокируйте карту.</span></div>
    <button className="btn" disabled={!reason || busy} onClick={() => wrap(async () => {
      if (await run(() => call('/api/disputes', { txId: op.id, reason }), 'Заявка отправлена в банк')) close();
    })}>Оспорить операцию</button>
  </>;
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
