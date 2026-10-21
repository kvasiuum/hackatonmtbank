// Moby ребёнка (7–13) и подростка (14–17).
import { useRef, useState } from 'react';
import {
  BYN, CARD_COLORS, CARD_TYPES, CATEGORY_NAMES, ERIP_SERVICES, FRAUD_CASES, FRAUD_REWARD_PER_ANSWER, GAME_REWARD, LESSONS, LESSON_REWARD, LEVELS, MEMORY_PARTNERS, PRICE_GAME,
  MAX_CARDS, MERCHANTS, PARTNER_OFFERS, SETTING_LABELS, SUBS_MONTHLY_LIMIT, levelOf, nextLevel,
} from '../../server/src/content';
import type { CardType, ChildOverview, PayDecision, PayMethod, SettingPath } from '../../server/src/types';
import { Confetti, CountUp, MegaPig, PigBurst, PigStage } from './fx';
import { Icon } from './icons';
import { fmt, fmtPhone, initial, plural, toKop, useData, useDevice } from './lib';
import { TaskTag } from './parent';
import { Act, AmountField, BankCard, Bar, CardManager, CardTypePicker, ChildCardCarousel, Chev, Coin, OpsList, PlainTop, Row, RowIcon, Swatches, Toggle, TopBar, cardIcon, mainCard, useBusy } from './ui';

export const useChild = () => useData<ChildOverview>('/api/child/overview').data;
const Loading = () => <div className="loading">Загрузка…</div>;

const REQ_LABEL: Record<string, string> = {
  money: 'Просил(а) деньги', perm: 'Просил(а) доступ', card: 'Просил(а) карту', purchase: 'Покупка ждёт родителя',
  limit: 'Просил(а) лимит', level: 'Новый уровень', task: 'Задание на проверке', goal: 'Просил(а) в копилку',
  proposal: 'Предложил(а) задание',
};

function useAsk() {
  const { run, call } = useDevice();
  return {
    perm: (key: SettingPath) => run(() => call('/api/child/requests', { type: 'perm', key, reason: `Хочу пользоваться: ${SETTING_LABELS[key].title.toLowerCase()}` }), `Запрос «${SETTING_LABELS[key].title}» отправлен родителю`),
    limit: (day: number) => run(() => call('/api/child/requests', { type: 'limit', day }), 'Запрос на лимит отправлен родителю'),
  };
}

function PayResult({ d, close }: { d: PayDecision; close: () => void }) {
  const ask = useAsk();
  const { sheet } = useDevice();
  const kind = d.status === 'approved' ? 'ok' : d.status === 'pending' ? 'wait' : 'no';
  return <>
    <div className="result">
      <div className={`big ${kind}`}><Icon name={kind === 'ok' ? 'check' : kind === 'wait' ? 'clock' : 'ban'} size={34} sw={2.2} /></div>
      <h2>{d.status === 'approved' ? 'Оплачено' : d.status === 'pending' ? 'Ждём подтверждения' : d.title}</h2>
      <p>{d.text}</p>
    </div>
    {d.status === 'declined' && d.ask?.type === 'perm' && <button className="btn" onClick={() => { ask.perm((d.ask as { key: SettingPath }).key); close(); }}><Icon name="send" size={20} /> Попросить доступ у родителя</button>}
    {d.status === 'declined' && d.ask?.type === 'money' && <button className="btn" onClick={() => sheet(c => <AskMoneySheet close={c} amount={(d.ask as { amount: number }).amount} />)}><Icon name="send" size={20} /> Попросить {fmt(d.ask.amount)}</button>}
    {d.status === 'declined' && d.ask?.type === 'limit' && <button className="btn" onClick={() => { ask.limit((d.ask as { day: number }).day); close(); }}><Icon name="send" size={20} /> Попросить увеличить лимит</button>}
    <button className="btn ghost" onClick={close}>Понятно</button>
  </>;
}

function AskMoneySheet({ close, amount }: { close: () => void; amount?: number }) {
  const { run, call } = useDevice();
  const [sum, setSum] = useState(String(amount ? amount / 100 : 5));
  const [reason, setReason] = useState('');
  const [busy, wrap] = useBusy();
  return <>
    <h2>Попросить у родителей</h2>
    <AmountField label="Сколько, BYN" value={sum} onChange={setSum} presets={[2, 5, 10, 20]} />
    <div className="field"><label>На что</label><input maxLength={80} placeholder="Например, на экскурсию" value={reason} onChange={e => setReason(e.target.value)} /></div>
    <div className="pills">{['Обед в школе', 'Подарок другу', 'Проезд', 'Кино с друзьями'].map(t => <button key={t} className="pill" onClick={() => setReason(t)}>{t}</button>)}</div>
    <button className="btn" disabled={busy || toKop(sum) <= 0} onClick={() => wrap(async () => { if (await run(() => call('/api/child/requests', { type: 'money', amount: toKop(sum), reason }), 'Запрос отправлен родителям')) close(); })}><Icon name="send" size={20} /> Отправить запрос</button>
  </>;
}

function CardRequestSheet({ close, o }: { close: () => void; o: ChildOverview }) {
  const { run, call } = useDevice();
  const self = o.me.settings.perms.newCards;
  const types: CardType[] = self ? ['virtual'] : o.me.group === 'kid' ? ['bracelet', 'sticker', 'virtual'] : ['virtual', 'plastic', 'sticker'];
  const [type, setType] = useState<CardType>(types[0]);
  const [color, setColor] = useState(CARD_COLORS[0]);
  const [reason, setReason] = useState('');
  const [busy, wrap] = useBusy();
  if (o.me.cards.length >= MAX_CARDS) return <><h2>Новая карта</h2><div className="legal"><Icon name="info" size={18} /><span>У тебя уже {MAX_CARDS} карты — это максимум.</span></div></>;
  return <>
    <h2>{self ? 'Виртуальная карта' : 'Попросить карту'}</h2>
    <p className="muted">{self ? 'Родитель разрешил выпускать виртуальные карты. Лимиты те же, что у основной.' : 'Запрос уйдёт родителю. Карта появится, когда он одобрит.'}</p>
    <BankCard name={o.me.name} card={{ type, color, status: 'active', last4: '••••' }} />
    <Swatches value={color} onChange={setColor} />
    {types.length > 1 && <CardTypePicker types={types} value={type} onChange={setType} />}
    {!self && <div className="field"><label>Зачем</label><input maxLength={80} placeholder="Например, чтобы платить на тренировке" value={reason} onChange={e => setReason(e.target.value)} /></div>}
    <button className="btn" disabled={busy} onClick={() => wrap(async () => {
      const r = self ? await run(() => call('/api/child/cards', { color }), 'Виртуальная карта готова') : await run(() => call('/api/child/requests', { type: 'card', cardType: type, color, reason }), 'Запрос на карту отправлен родителю');
      if (r) close();
    })}>{self ? 'Выпустить' : 'Отправить запрос'}</button>
  </>;
}

function GoalSheet({ o, goalId, close }: { o: ChildOverview; goalId: string; close: () => void }) {
  const { run, call } = useDevice();
  const g = o.me.goals.find(x => x.id === goalId)!;
  const [sum, setSum] = useState('2');
  const [busy, wrap] = useBusy();
  const bonus = o.me.settings.parentBonus;
  const amount = toKop(sum);
  const short = amount > o.me.balance;
  return <>
    <div className="goal-h"><RowIcon name={g.icon} tone="red" /><div className="tx"><h2>{g.title}</h2><small className="muted">На счёте {fmt(o.me.balance)}{bonus ? ', родители добавят 10%' : ''}</small></div></div>
    <AmountField label="Сколько положить, BYN" value={sum} onChange={setSum} presets={[1, 2, 5, 10]} />
    {short ? <small style={{ color: 'var(--red)' }}>Недостаточно средств: на счёте {fmt(o.me.balance)}</small>
      : g.target > g.saved && <small className="muted">До цели осталось {fmt(g.target - g.saved)}</small>}
    <button className="btn" disabled={busy || short || amount <= 0} onClick={() => wrap(async () => {
      if (await run(() => call<{ added: number }>(`/api/child/goals/${goalId}/deposit`, { amount }), r => `+${fmt(r.added)} в копилку`)) close();
    })}>Положить {fmt(amount)}{bonus && amount > 0 ? `, в копилку упадёт ${fmt(Math.round(amount * 1.1))}` : ''}</button>
    <button className="btn ghost" disabled={busy || amount <= 0} onClick={() => wrap(async () => { if (await run(() => call('/api/child/requests', { type: 'goal', goalId, amount, reason: `Помогите накопить на «${g.title}»` }), 'Попросили родителей поддержать копилку')) close(); })}>Попросить у родителей {fmt(amount)}</button>
  </>;
}

const GOAL_ICONS = ['bike', 'headphones', 'smartphone', 'gamepad-2', 'toy-brick', 'plane', 'book-open', 'tent', 'target'];
function NewGoalSheet({ close }: { close: () => void }) {
  const { run, call } = useDevice();
  const [icon, setIcon] = useState('target');
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('50');
  const [busy, wrap] = useBusy();
  return <>
    <h2>Новая цель</h2>
    <div className="pills">{GOAL_ICONS.map(e => <button key={e} className={`pill ${icon === e ? 'on' : ''}`} onClick={() => setIcon(e)} aria-label={e}><Icon name={e} size={22} /></button>)}</div>
    <div className="field"><label>На что копим</label><input maxLength={30} placeholder="Например, велосипед" value={title} onChange={e => setTitle(e.target.value)} /></div>
    <AmountField label="Сколько нужно, BYN" value={target} onChange={setTarget} />
    <button className="btn" disabled={busy || title.trim().length < 2 || toKop(target) <= 0} onClick={() => wrap(async () => { if (await run(() => call('/api/child/goals', { title, icon, target: toKop(target) }), 'Цель создана')) close(); })}>Создать</button>
  </>;
}

/** Какую копилку открыть на вкладке «Копилки», когда ребёнок нажал карточку на главной */
let pickedGoal: string | null = null;

function GoalCard({ o, id }: { o: ChildOverview; id: string }) {
  const { sheet, tab } = useDevice();
  const g = o.me.goals.find(x => x.id === id)!;
  const weeks = o.me.settings.allowance.on ? Math.ceil((g.target - g.saved) / o.me.settings.allowance.amount) : null;
  // Ребёнку 7–13 — карточка-витрина копилки: всё пополнение и анимация на вкладке «Копилки»
  if (o.me.group === 'kid') return <button className="card kidgoal press" onClick={() => { pickedGoal = g.id; tab('goals'); }}>
    <div className="np-tile"><MegaPig fill={g.saved / g.target} /></div>
    <div className="tx">
      <small className="muted">Моя копилка</small>
      <b className="kg-title"><Icon name={g.icon} size={17} />{g.title}</b>
      <div className="kg-sum"><b>{fmt(g.saved)}</b> из {fmt(g.target)}</div>
      <Bar value={g.saved} max={g.target} />
    </div>
    <Chev />
  </button>;
  return <div className="card goal">
    <div className="goal-h"><RowIcon name={g.icon} tone="red" />
      <div className="tx"><b>{g.title}</b><small className="muted">{fmt(g.saved)} из {fmt(g.target)}</small></div>
      <button className="sbtn" onClick={() => sheet(c => <GoalSheet o={o} goalId={id} close={c} />)}>Положить</button></div>
    <Bar value={g.saved} max={g.target} red />
    {g.saved >= g.target ? <span className="tag" style={{ alignSelf: 'flex-start' }}>Цель достигнута</span>
      : <small className="muted">Осталось {fmt(g.target - g.saved)}{weeks ? `, около ${weeks} нед. с карманных` : ''}</small>}
  </div>;
}

/** Шторка «положить любую сумму»: копилка, вклад, семейная цель */
function MoneySheet({ title, sub, cta, max, min = 1, presets, send, ok, close, maxLabel = 'на счёте' }: {
  title: string; sub?: string; cta: string; max: number; min?: number; presets: number[]; maxLabel?: string;
  send: (amount: number) => Promise<unknown>; ok: (amount: number) => string; close: () => void;
}) {
  const { run } = useDevice();
  const [sum, setSum] = useState(String(presets[1] ?? presets[0]));
  const [busy, wrap] = useBusy();
  const amount = toKop(sum);
  const short = amount > max;
  return <>
    <h2>{title}</h2>
    {sub && <p className="muted" style={{ marginTop: -8 }}>{sub}</p>}
    <AmountField label="Сумма, BYN" value={sum} onChange={setSum} presets={presets} />
    {short ? <small style={{ color: 'var(--red)' }}>Недостаточно средств: {maxLabel} {fmt(max)}</small>
      : amount > 0 && amount < min ? <small style={{ color: 'var(--red)' }}>Минимум {fmt(min)}</small> : <small className="muted">{maxLabel[0].toUpperCase() + maxLabel.slice(1)} {fmt(max)}</small>}
    <button className="btn" disabled={busy || short || amount <= 0 || amount < min} onClick={() => wrap(async () => { if (await run(() => send(amount), ok(amount))) close(); })}>{cta} {amount > 0 ? fmt(amount) : ''}</button>
  </>;
}

function FamilyGoalCard({ o }: { o: ChildOverview }) {
  const { call, sheet } = useDevice();
  const g = o.familyGoal;
  return <div className="card goal">
    <div className="goal-h"><RowIcon name={g.icon} /><div className="tx"><small className="muted">Семейная цель</small><b>{g.title}</b></div><b>{Math.round(g.saved / g.target * 100)}%</b></div>
    <Bar value={g.saved} max={g.target} />
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <small className="muted">{fmt(g.saved)} из {fmt(g.target)}, копит вся семья</small>
      <button className="sbtn" onClick={() => sheet(c => <MoneySheet title="В семейную цель" sub={g.title} cta="Положить" max={o.me.balance} presets={[1, 2, 5, 10]}
        send={amount => call('/api/family/goal', { amount })} ok={a => `+${fmt(a)} в семейную цель`} close={c} />)}>Положить</button>
    </div>
  </div>;
}

function MyRequests({ o }: { o: ChildOverview }) {
  // Показываем ожидающие и свежие ответы за сутки, остальное — в ленте родителя
  const fresh = o.requests.filter(r => r.status === 'pending' || Date.now() - Date.parse(r.createdAt) < 864e5).slice(0, 3);
  if (!fresh.length) return null;
  return <div className="card"><h3>Мои запросы</h3>{fresh.map(r => (
    <Row key={r.id} icon="send" title={REQ_LABEL[r.type]} sub={`${r.summary}${r.amount != null ? `, ${fmt(r.amount)}` : ''}`}
      right={<span className={`tag ${r.status === 'declined' ? 'solid-red' : r.status === 'pending' ? 'red' : ''}`}>{r.status === 'pending' ? 'Ждём ответа' : r.status === 'approved' ? 'Одобрено' : 'Отказ'}</span>} />
  ))}</div>;
}

/** Карты ребёнка в шторке: данные берём свежие, чтобы блокировка сразу отражалась */
/** Карты ребёнка в шторке: данные берём свежие, чтобы блокировка сразу отражалась */
function CardsSheet({ close }: { close: () => void }) {
  const o = useChild();
  const { sheet } = useDevice();
  if (!o) return <Loading />;
  return <>
    <h2>{o.me.cards.length > 1 ? 'Мои карты' : 'Моя карта'}</h2>
    <CardManager name={o.me.name} cards={o.me.cards} who={o.me.group}>
      {o.me.cards.length < MAX_CARDS && <button className="btn ghost" onClick={() => { close(); sheet(c => <CardRequestSheet o={o} close={c} />); }}>
        <Icon name={o.me.settings.perms.newCards ? 'plus' : 'send'} size={20} /> {o.me.settings.perms.newCards ? 'Выпустить виртуальную карту' : 'Попросить новую карту'}</button>}
    </CardManager>
  </>;
}

function OpsSheet({ title }: { title: string }) {
  const o = useChild();
  if (!o) return <Loading />;
  return <><h2>{title}</h2><div><OpsList ops={o.me.ops} limit={20} /></div></>;
}

/** Ожидающие ответа запросы одной строкой: подробности ребёнку не нужны */
function Waiting({ o }: { o: ChildOverview }) {
  const p = o.requests.filter(r => r.status === 'pending');
  if (!p.length) return null;
  const r = p[0];
  return <div className="waitline"><Icon name="clock" size={20} /><span>Ждём ответа родителей: <b>{r.summary}{r.amount != null ? `, ${fmt(r.amount)}` : ''}</b>{p.length > 1 ? ` и ещё ${p.length - 1}` : ''}</span></div>;
}

function CashbackCard({ o }: { o: ChildOverview }) {
  const cb = o.me.cashbackWeek;
  const pct = Math.round(cb.rate * 100);
  return <div className="cashback"><div className="ic"><Icon name="percent" size={22} /></div>
    <div className="tx"><b>Кешбэк недели {pct}%</b><small>{cb.unit === 'coins'
      ? (cb.spent ? `У партнёров потрачено ${fmt(cb.spent)}. В понедельник придут Манички` : 'Плати у партнёров Moby — в понедельник получишь Манички')
      : (cb.spent ? `У партнёров потрачено ${fmt(cb.spent)}. Вернётся в понедельник` : 'Плати у партнёров Moby — часть денег вернётся в понедельник')}</small></div>
    {cb.expected > 0 && <span className="sum">{cb.unit === 'coins' ? <>+{cb.expected} <Coin /></> : `+${fmt(cb.expected)}`}</span>}
  </div>;
}

function ProposeTaskSheet({ close }: { close: () => void }) {
  const { run, call } = useDevice();
  const [title, setTitle] = useState('');
  const [reward, setReward] = useState('3');
  const [busy, wrap] = useBusy();
  return <>
    <h2>Предложить задание</h2>
    <p className="muted">Придумай дело и награду. Если родитель согласится, задание появится в списке.</p>
    <div className="field"><label>Что сделаю</label><input maxLength={60} placeholder="Например, помою машину" value={title} onChange={e => setTitle(e.target.value)} /></div>
    <div className="pills">{['Помою посуду', 'Погуляю с собакой', 'Уберу балкон'].map(t => <button key={t} className="pill" onClick={() => setTitle(t)}>{t}</button>)}</div>
    <AmountField label="Награда, BYN" value={reward} onChange={setReward} presets={[2, 3, 5, 10]} />
    <button className="btn" disabled={busy || title.trim().length < 2 || toKop(reward) <= 0} onClick={() => wrap(async () => {
      if (await run(() => call('/api/child/requests', { type: 'proposal', title: title.trim(), reward: toKop(reward) }), 'Предложение отправлено родителю')) close();
    })}><Icon name="send" size={20} /> Отправить</button>
  </>;
}

function TaskList({ o }: { o: ChildOverview }) {
  const { run, call, sheet } = useDevice();
  return <>
    <div className="card">{o.me.tasks.length ? o.me.tasks.map(t => (
      <Row key={t.id} icon={t.status === 'paid' ? 'check' : t.status === 'review' ? 'clock' : t.shared ? 'users' : 'list-checks'} title={t.title}
        sub={t.status === 'taken' ? 'Другой ребёнок уже выполнил' : `+${fmt(t.reward)} и 40 опыта${t.shared && t.status === 'open' ? ' · кто первый' : ''}`}
        right={t.status === 'open' ? <button className="sbtn solid" onClick={() => run(() => call(`/api/child/tasks/${t.id}/done`, {}), 'Родитель проверит и отправит награду')}>Сделал</button> : <TaskTag s={t.status} />} />
    )) : <div className="empty">Заданий пока нет</div>}</div>
    <button className="btn ghost" onClick={() => sheet(c => <ProposeTaskSheet close={c} />)}><Icon name="plus" size={20} /> Предложить своё задание</button>
  </>;
}

/** Ближайшее задание на главной. always — показывать карточку и без заданий (у ребёнка 7–13 это вход в задания) */
function NextTask({ o, to, always }: { o: ChildOverview; to: () => void; always?: boolean }) {
  const { run, call, sheet } = useDevice();
  const open = o.me.tasks.filter(t => t.status === 'open');
  if (!open.length) return always ? <div className="card"><h3>Задания <button className="link" onClick={to}>Все</button></h3>
    <Row icon="list-checks" title="Сейчас заданий нет" sub="Придумай дело и предложи родителям" right={<button className="sbtn" onClick={() => sheet(c => <ProposeTaskSheet close={c} />)}>Предложить</button>} />
  </div> : null;
  const t = open[0];
  return <div className="card"><h3>Задание <button className="link" onClick={to}>Все{open.length > 1 ? ` (${open.length})` : ''}</button></h3>
    <Row icon="list-checks" title={t.title} sub={`+${fmt(t.reward)} и 40 опыта`} right={<button className="sbtn solid" onClick={() => run(() => call(`/api/child/tasks/${t.id}/done`, {}), 'Родитель проверит и отправит награду')}>Сделал</button>} />
  </div>;
}

// ---------- ребёнок 7–13 ----------
export function KidHome() {
  const o = useChild();
  const { push, tab, sheet } = useDevice();
  const ask = useAsk();
  const [hide, setHide] = useHidden();
  if (!o) return <Loading />;
  const main = mainCard(o.me.cards);
  const virtualOk = o.me.cards.some(c => c.type === 'virtual' && c.status === 'active');
  const left = Math.max(0, Math.min(o.me.settings.limits.day - o.me.spentToday, o.me.balance));
  return <>
    <div className="hero">
      <div className="hero-top"><div className="ava">{initial(o.me.name)}</div><div className="hero-name">Привет, {o.me.name}</div></div>
      <div className="chips"><button className="chip" onClick={() => tab('play')}>Уровень {o.me.level}</button><button className="chip" onClick={() => tab('play')}><Coin />{o.me.coins}</button></div>
      <div className="bal-row"><div className="bal">{hide ? '**** BYN' : fmt(o.me.balance)}</div><button className="iconbtn" onClick={() => setHide(!hide)} aria-label={hide ? 'Показать баланс' : 'Скрыть баланс'}><Icon name={hide ? 'eye' : 'eye-off'} size={30} sw={1.6} /></button></div>
      <div className="hero-sub">Сегодня можно потратить ещё {hide ? '****' : fmt(left)}</div>
      <div className="actions">
        <Act icon="pay" label="Оплатить" onClick={() => push('pay')} />
        <Act icon="transfer" label="Перевести" onClick={() => (o.me.settings.perms.p2p ? sheet(c => <TransferSheet close={c} />) : ask.perm('perms.p2p'))} />
        <Act icon="send" label="Попросить" onClick={() => sheet(c => <AskMoneySheet close={c} />)} />
      </div>
    </div>
    <div className="body">
      {main && main.status !== 'active' && <div className="legal"><Icon name={main.status === 'blocked' ? 'lock' : 'clock'} size={18} /><span>
        {main.status === 'blocked' ? `${CARD_TYPES[main.type].label}: карта заблокирована. Нашлась? Попроси родителя разблокировать.` : `${CARD_TYPES[main.type].label} в пути.`}
        {virtualOk ? ' Пока плати виртуальной картой в телефоне' : ''}{o.me.settings.perms.qr ? `${virtualOk ? ' или' : ' Плати'} по QR КРОК.` : virtualOk ? '.' : ''}</span></div>}
      <Waiting o={o} />
      <NextTask o={o} to={() => push('tasks')} always />
      {o.me.goals[0] && <GoalCard o={o} id={o.me.goals[0].id} />}
      <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
        <Row icon="credit-card" title="Моя карта" sub={main ? `${CARD_TYPES[main.type].label} •• ${main.last4}` : 'Карт нет'} onClick={() => sheet(c => <CardsSheet close={c} />)} />
        <Row icon="history" title="Мои покупки" sub={o.me.ops[0] ? `${o.me.ops[0].title}, ${fmt(o.me.ops[0].amount)}` : 'Покупок пока нет'} onClick={() => sheet(() => <OpsSheet title="Мои покупки" />)} />
      </div>
    </div>
  </>;
}

/** Шторка суммы для копилки ребёнка 7–13: сама анимация пополнения идёт на экране копилки */
function DepositSheet({ o, goalId, close, onPut }: { o: ChildOverview; goalId: string; close: () => void; onPut: (amount: number) => void }) {
  const { run, call } = useDevice();
  const g = o.me.goals.find(x => x.id === goalId)!;
  const [sum, setSum] = useState('2');
  const [busy, wrap] = useBusy();
  const amount = toKop(sum);
  const short = amount > o.me.balance;
  const bonus = o.me.settings.parentBonus;
  return <>
    <div className="goal-h"><span className="gi-ic"><Icon name={g.icon} size={20} /></span><div className="tx"><h2>{g.title}</h2><small className="muted">На счёте {fmt(o.me.balance)}{bonus ? ', родители добавят 10%' : ''}</small></div></div>
    <AmountField label="Сколько положить, BYN" value={sum} onChange={setSum} presets={[1, 2, 5, 10]} />
    {short ? <small style={{ color: 'var(--red)' }}>Недостаточно средств: на счёте {fmt(o.me.balance)}</small>
      : g.target > g.saved && <small className="muted">До цели осталось {fmt(g.target - g.saved)}</small>}
    <button className="btn" disabled={short || amount <= 0} onClick={() => { close(); onPut(amount); }}>
      Положить {amount > 0 ? fmt(amount) : ''}{bonus && amount > 0 ? `, в копилку упадёт ${fmt(Math.round(amount * 1.1))}` : ''}</button>
    <button className="btn ghost" disabled={busy || amount <= 0} onClick={() => wrap(async () => {
      if (await run(() => call('/api/child/requests', { type: 'goal', goalId, amount, reason: `Помогите накопить на «${g.title}»` }), 'Попросили родителей поддержать копилку')) close();
    })}>Попросить у родителей {amount > 0 ? fmt(amount) : ''}</button>
  </>;
}

export function KidGoals() {
  const o = useChild();
  const { sheet, run, call } = useDevice();
  const [sel, setSel] = useState<string | null>(() => { const p = pickedGoal; pickedGoal = null; return p; });
  // Сумму выбирают в шторке, а анимация идёт здесь: монеты падают внутрь и свинка подпрыгивает
  const [anim, setAnim] = useState<{ from: number; added: number; bonus: number } | null>(null);
  // Разбиваем копилку: свинка трясётся, взрывается, деньги приходят на счёт
  const [smash, setSmash] = useState<{ title: string; amount: number; phase: 'shake' | 'boom' | 'done' } | null>(null);
  const [busy, wrap] = useBusy();
  const card = useRef<HTMLDivElement>(null);
  // Анимация должна быть на виду: подкручиваем экран к свинке
  const showPig = () => card.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (!o) return <Loading />;
  const goals = o.me.goals;
  const g = goals.find(x => x.id === sel) ?? goals[0];
  const full = !!g && g.saved >= g.target;
  const weeks = g && o.me.settings.allowance.on ? Math.ceil((g.target - g.saved) / o.me.settings.allowance.amount) : null;
  const pct = g ? Math.min(100, Math.round(g.saved / g.target * 100)) : 0;
  const breakIt = (goalId: string, title: string, saved: number) => {
    setSmash({ title, amount: saved, phase: 'shake' });
    showPig();
    setTimeout(async () => {
      setSmash(s => s && { ...s, phase: 'boom' });
      await run(() => call(`/api/child/goals/${goalId}/break`, {}));
      setTimeout(() => setSmash(s => s && { ...s, phase: 'done' }), 1300);
    }, 1400);
  };
  const put = (amount: number) => wrap(async () => {
    const from = g.saved / g.target;
    const r = await run(() => call<{ added: number; bonus: number }>(`/api/child/goals/${g.id}/deposit`, { amount }));
    if (!r) return;
    showPig();
    setAnim({ from, added: r.added, bonus: r.bonus });
    const saved = g.saved + r.added;
    if (saved >= g.target) setTimeout(() => { setAnim(null); breakIt(g.id, g.title, saved); }, 1600);
    else setTimeout(() => setAnim(null), 2400);
  });
  return <>
    <PlainTop title="Копилки" />
    <div className="page tight">
      {o.me.settings.parentBonus && <div className="family-entry"><div className="ic red"><Icon name="gift" size={24} /></div><div className="tx"><b>Родители добавляют 10%</b><small>Положишь 10 BYN, в копилке станет 11 BYN</small></div></div>}
      {smash ? <div className="card pigcard" ref={card}>
        <PigStage>{smash.phase === 'shake' ? <MegaPig fill={1} mood="full" cracking className="pig-shake" /> : <><PigBurst /><div className="pig-hole" /></>}</PigStage>
        {smash.phase === 'done' && <Confetti />}
        <h2 style={{ textAlign: 'center' }}>{smash.phase === 'done' ? 'Бум! Копилка разбита' : 'Копилка полная! Разбиваем…'}</h2>
        {smash.phase === 'done' && <><p className="muted" style={{ textAlign: 'center', marginTop: -6 }}>{fmt(smash.amount)} уже на счёте — можно покупать «{smash.title}»</p>
          <button className="btn" onClick={() => { setSmash(null); setSel(null); }}>Ура!</button></>}
      </div> : g ? <div className="card pigcard" ref={card}>
        <PigStage top={goals.length > 1 && <div className="ps-goals" role="tablist">{goals.map(x => (
          <button key={x.id} role="tab" aria-selected={x.id === g.id} className={`ps-goal ${x.id === g.id ? 'on' : ''}`} onClick={() => setSel(x.id)}><Icon name={x.icon} size={16} />{x.title}</button>))}</div>}>
          {anim && [0, 1, 2].map(i => <span key={i} className="pig-coin" style={{ animationDelay: `${i * 160}ms`, left: `${46 + i * 3}%` }}>М</span>)}
          <MegaPig key={g.id} fill={g.saved / g.target} prevFill={anim?.from} mood={full ? 'full' : anim ? 'happy' : 'idle'} className={anim ? 'pig-jump' : ''} />
          {anim && <div className="pig-plus">+{fmt(anim.added)}{anim.bonus > 0 && <small>из них {fmt(anim.bonus)} от родителей</small>}</div>}
        </PigStage>
        <div className="goalinfo">
          <div className="gi-head"><span className="gi-ic"><Icon name={g.icon} size={20} /></span><b>{g.title}</b><span className="gi-pct">{pct}%</span></div>
          <div className="gi-sum"><b>{fmt(g.saved)}</b><span>из {fmt(g.target)}</span></div>
          <Bar value={g.saved} max={g.target} />
          <small className="muted">{full ? 'Копилка полная! Разбей её — деньги придут на счёт'
            : `Осталось ${fmt(g.target - g.saved)}${weeks ? ` · около ${weeks} нед. с карманных` : ''}${o.me.settings.roundup && g.id === goals.find(x => x.saved < x.target)?.id ? ' · сюда падает сдача с покупок' : ''}`}</small>
        </div>
        {full ? <button className="btn" onClick={() => breakIt(g.id, g.title, g.saved)}>Разбить копилку!</button>
          : <button className="btn" disabled={!!anim || busy} onClick={() => sheet(c => <DepositSheet o={o} goalId={g.id} close={c} onPut={put} />)}>Положить</button>}
      </div> : <div className="card empty">Копилок пока нет. Придумай, на что копить</div>}
      {o.me.settings.perms.goals && <button className="btn ghost" onClick={() => sheet(c => <NewGoalSheet close={c} />)}><Icon name="plus" size={20} /> Новая цель</button>}
      <CashbackCard o={o} />
      <FamilyGoalCard o={o} />
      {o.me.deposit && <div className="family-entry"><div className="ic"><Icon name="landmark" size={24} /></div>
        <div className="tx"><b>Вклад «На вырост»: {fmt(o.me.deposit.amount)}</b><small>Копят родители, {o.me.deposit.rate}% годовых. Через год будет около {fmt(Math.round(o.me.deposit.amount * (1 + o.me.deposit.rate / 100)))}</small></div></div>}
    </div>
  </>;
}

export function KidTasks() {
  const o = useChild();
  if (!o) return <Loading />;
  return <>
    <TopBar title="Задания" />
    <div className="page">
      <p className="muted">Выполняй задания от родителей и получай деньги и опыт для нового уровня. Можно придумать своё.</p>
      <TaskList o={o} />
    </div>
  </>;
}

export function Quiz({ id }: { id: string }) {
  const o = useChild();
  const { run, call, back } = useDevice();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<{ correct: number; total: number; rewarded: boolean; level: number | null } | null>(null);
  if (!o) return <Loading />;
  const lesson = LESSONS[o.me.group].find(l => l.id === id)!;
  if (result) return <><TopBar title={lesson.title} /><div className="page">
    <Confetti />
    <div className="result"><div className="big ok win"><Icon name="trophy" size={34} /></div><h2>Урок пройден</h2><p>Верных ответов: {result.correct} из {result.total}</p>
      <p><b>{result.rewarded ? `+${LESSON_REWARD.xp} опыта, +${LESSON_REWARD.coins} Маничек` : 'Награда за этот урок уже получена'}</b></p>
      {result.level && <p>Новый уровень {result.level}! Родителю отправлено предложение расширить лимиты.</p>}</div>
    <button className="btn" onClick={back}>Готово</button></div></>;
  const q = lesson.questions[i];
  const picked = answers[i];
  const finish = async () => { const r = await run(() => call(`/api/child/lessons/${id}`, { answers })); if (r) setResult(r); };
  return <><TopBar title={lesson.title} /><div className="page">
    <small className="muted">Вопрос {i + 1} из {lesson.questions.length}</small>
    <Bar value={i} max={lesson.questions.length} />
    <div className="quiz-q">{q.q}</div>
    {q.options.map((opt, k) => <button key={k} className={`opt press ${picked !== undefined ? (k === q.answer ? 'right' : k === picked ? 'wrong' : '') : ''}`} disabled={picked !== undefined}
      onClick={() => setAnswers(a => { const n = [...a]; n[i] = k; return n; })}>{opt}</button>)}
    {picked !== undefined && <button className="btn" onClick={() => (i + 1 < lesson.questions.length ? setI(i + 1) : finish())}>{i + 1 < lesson.questions.length ? 'Дальше' : 'Завершить'}</button>}
  </div></>;
}

export function Fraud() {
  const { run, call, back } = useDevice();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [result, setResult] = useState<{ correct: number; total: number; rewarded: boolean; level: number | null } | null>(null);
  if (result) return <><TopBar title="Распознай мошенника" /><div className="page">
    {result.correct >= 4 && <Confetti />}
    <div className="result"><div className="big ok win"><Icon name="shield-check" size={34} /></div><h2>{result.correct} из {result.total}</h2>
      <p>{result.correct >= 5 ? 'Мошенникам будет непросто тебя обмануть.' : 'Перечитай подсказки и попробуй ещё раз.'}</p>
      <p><b>{result.rewarded ? `+${result.correct * FRAUD_REWARD_PER_ANSWER.coins} Маничек, +${result.correct * FRAUD_REWARD_PER_ANSWER.xp} опыта` : 'Награда уже получена, но тренироваться полезно'}</b></p>
      {result.level && <p>Новый уровень {result.level}! Родителю отправлено предложение расширить лимиты.</p>}</div>
    <button className="btn" onClick={back}>Готово</button></div></>;
  const f = FRAUD_CASES[i];
  const picked = answers[i];
  const correct = picked !== undefined && picked === f.fraud;
  const pick = (v: boolean) => setAnswers(a => { const n = [...a]; n[i] = v; return n; });
  const next = async () => { if (i + 1 < FRAUD_CASES.length) setI(i + 1); else { const r = await run(() => call('/api/child/fraud', { answers })); if (r) setResult(r); } };
  return <><TopBar title="Распознай мошенника" /><div className="page">
    <small className="muted">Ситуация {i + 1} из {FRAUD_CASES.length} · верно {answers.filter((a, k) => a === FRAUD_CASES[k].fraud).length}</small>
    <div className="msg"><RowIcon name={f.icon} /><div><div className="muted" style={{ fontWeight: 600, fontSize: 12.5 }}>{f.from}</div><div style={{ fontSize: 16, marginTop: 4 }}>{f.text}</div></div></div>
    {picked === undefined ? <div className="btns"><button className="btn" onClick={() => pick(false)}>Безопасно</button><button className="btn solid-red" onClick={() => pick(true)}>Мошенники</button></div> : <>
      <div className={`card ${correct ? 'fx-right' : 'fx-wrong'}`} style={{ border: `2px solid ${correct ? 'var(--blue)' : 'var(--red)'}` }}><b>{correct ? 'Верно. ' : 'Не совсем. '}{f.fraud ? 'Это мошенники.' : 'Это безопасно.'}</b><p style={{ marginTop: 6, fontSize: 14.5, color: '#4F5A6E' }}>{f.why}</p></div>
      <button className="btn" onClick={next}>{i + 1 < FRAUD_CASES.length ? 'Дальше' : 'Завершить'}</button></>}
  </div></>;
}

export function Pay({ method: initial }: { method?: PayMethod }) {
  const o = useChild();
  const { call, sheet, run } = useDevice();
  const [method, setMethod] = useState<PayMethod>(initial ?? 'card');
  const [picked, setPicked] = useState<string | null>(null);
  if (!o) return <Loading />;
  const qr = method === 'qr';
  // Избранная карта первой; выбрать можно только работающую
  const active = o.me.cards.filter(c => c.status === 'active');
  const card = active.find(c => c.id === picked) ?? active.find(c => c.favorite) ?? active.find(c => CARD_TYPES[c.type].physical) ?? active[0];
  const pay = async (merchantId: string) => {
    const d = await run(() => call<PayDecision>('/api/child/pay', { merchantId, method, ...(qr || !card ? {} : { cardId: card.id }) }));
    if (d) sheet(c => <PayResult d={d} close={c} />);
  };
  return <><TopBar title="Оплатить" /><div className="page">
    <div className="seg"><button className={qr ? '' : 'on'} onClick={() => setMethod('card')}>Картой</button><button className={qr ? 'on' : ''} onClick={() => setMethod('qr')}>По QR КРОК</button></div>
    <div className="legal"><Icon name={qr ? 'qr-code' : 'info'} size={18} /><span>{qr
      ? `КРОК — национальный сервис QR-платежей (Нацбанк, ЕРИП). Сканируешь QR на кассе в Moby, деньги списываются со счёта мгновенно, карта не нужна. Лимиты и запреты родителя действуют так же.${o.me.settings.perms.qr ? '' : ' Сейчас QR-оплата выключена родителем.'}`
      : 'Выбери, где прикладываешь карту. Решение принимается по настройкам родителя и защите банка.'}</span></div>
    {!qr && card && <ChildCardCarousel name={o.me.name} cards={active} value={card.id} onChange={setPicked} />}
    {!qr && o.me.cards.length > active.length && <small className="muted">Заблокированные карты и карты в доставке здесь не показываем</small>}
    <small className="muted">{qr ? 'Платим по QR со счёта' : card ? `Платим: ${(card.label || CARD_TYPES[card.type].label).toLowerCase()} •• ${card.last4}` : 'Нет активной карты'} · сегодня {fmt(o.me.spentToday)} из {fmt(o.me.settings.limits.day)} · подтверждение от {fmt(o.me.settings.confirmAbove)}</small>
    {MERCHANTS[o.me.group].map(m => (
      <button key={m.id} className="merchant press" onClick={() => pay(m.id)}>
        <RowIcon name={m.icon} tone={m.category === 'gambling' || m.category === 'adult' ? 'red' : undefined} />
        <span className="tx"><b>{m.title}</b><small style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{CATEGORY_NAMES[m.category]}{m.partner && <span className="partner">кешбэк {Math.round(o.me.cashbackWeek.rate * 100)}%</span>}</small></span><b>{fmt(m.amount)}</b>
      </button>
    ))}
  </div></>;
}

// ---------- подросток 14–17 ----------
export function TeenHome() {
  const o = useChild();
  const { push, sheet } = useDevice();
  const [hide, setHide] = useHidden();
  if (!o) return <Loading />;
  const s = o.me.settings;
  const main = mainCard(o.me.cards);
  return <>
    <div className="hero">
      <div className="hero-top"><div className="ava">{initial(o.me.name)}</div><div><div className="hero-name">{o.me.name}</div><div className="hero-sub">Moby 14+</div></div></div>
      <div className="chips"><button className="chip" onClick={() => push('path')}>Уровень {o.me.level} <Icon name="chevron-right" size={14} /></button>{main && <span className="chip">5*{main.last4}</span>}<span className="chip"><Coin />{o.me.coins}</span></div>
      <div className="bal-row"><div className="bal">{hide ? '**** BYN' : fmt(o.me.balance)}</div><button className="iconbtn" onClick={() => setHide(!hide)} aria-label="Скрыть баланс"><Icon name={hide ? 'eye' : 'eye-off'} size={30} sw={1.6} /></button></div>
      <div className="actions">
        <Act icon="pay" label="Оплатить" onClick={() => push('pay')} />
        <Act icon="transfer" label="Платежи" onClick={() => push('payments')} />
        <Act icon="send" label="Попросить" onClick={() => sheet(c => <AskMoneySheet close={c} />)} />
      </div>
    </div>
    <div className="body">
      <Waiting o={o} />
      <button className="card press" style={{ textAlign: 'left', width: '100%' }} onClick={() => push('analytics')}>
        <h3>Потрачено в этом месяце <Chev /></h3>
        <div className="bal" style={{ fontSize: 26, margin: '6px 0 8px', color: 'var(--text)' }}>{fmt(o.me.spentMonth)}</div>
        <Bar value={o.me.spentMonth} max={s.limits.month} red={o.me.spentMonth >= s.limits.month} />
        <div className="limitline"><span>Лимит {fmt(s.limits.month)} в месяц</span><span>сегодня {fmt(o.me.spentToday)} из {fmt(s.limits.day)}</span></div>
      </button>
      <NextTask o={o} to={() => push('earn')} />
      <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
        <Row icon="credit-card" title="Мои карты" sub={main ? `${CARD_TYPES[main.type].label} •• ${main.last4}${o.me.cards.length > 1 ? ` и ещё ${o.me.cards.length - 1}` : ''}` : 'Карт нет'} onClick={() => sheet(c => <CardsSheet close={c} />)} />
        <Row icon="history" title="История" sub={o.me.ops[0] ? `${o.me.ops[0].title}, ${fmt(o.me.ops[0].amount)}` : 'Операций пока нет'} onClick={() => sheet(() => <OpsSheet title="История" />)} />
        <Row icon="rocket" title={`Путь к 18: уровень ${o.me.level} из 5`} sub="Новый уровень — больше свободы и лимитов" onClick={() => push('path')} />
      </div>
    </div>
  </>;
}

function SpendBars({ o, n }: { o: ChildOverview; n: number }) {
  const by: Record<string, number> = {};
  o.me.ops.filter(x => x.amount < 0).forEach(x => { by[x.category] = (by[x.category] ?? 0) - x.amount; });
  const arr = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, n);
  if (!arr.length) return <div className="empty">Трат пока нет</div>;
  return <div className="bars">{arr.map(([c, v]) => <div className="b" key={c}><div><span>{c}</span><b>{fmt(v)}</b></div><Bar value={v} max={arr[0][1]} /></div>)}</div>;
}

export function TeenAnalytics() {
  const o = useChild();
  if (!o) return <Loading />;
  const allowanceMonth = o.me.settings.allowance.amount * 4;
  return <><TopBar title="Аналитика" /><div className="page">
    <div className="card"><small className="muted">Потрачено в этом месяце</small><div className="bal" style={{ fontSize: 28, marginTop: 4 }}>{fmt(o.me.spentMonth)}</div><SpendBars o={o} n={8} /></div>
    <div className="card"><h3>Совет Moby</h3><p style={{ marginTop: 8, fontSize: 14.5 }}>По правилу 50/30/20 из карманных {fmt(allowanceMonth)} в месяц стоит откладывать {fmt(allowanceMonth * 0.2)}. Сейчас в копилках {fmt(o.me.goals.reduce((a, g) => a + g.saved, 0))}.</p></div>
  </div></>;
}

/** Подсказка под суммой: сколько на счёте и хватает ли */
function FundsHint({ amount }: { amount: number }) {
  const o = useChild();
  if (!o) return null;
  return amount > o.me.balance ? <small style={{ color: 'var(--red)' }}>Недостаточно средств: на счёте {fmt(o.me.balance)}</small> : <small className="muted">На счёте {fmt(o.me.balance)}</small>;
}
const useShort = (amount: number) => { const o = useChild(); return !!o && amount > o.me.balance; };

function EripSheet({ id, close }: { id: string; close: () => void }) {
  const { call, run, sheet } = useDevice();
  const svc = ERIP_SERVICES.find(x => x.id === id)!;
  const [amount, setAmount] = useState(String(svc.amount / 100));
  const short = useShort(toKop(amount));
  return <>
    <h2>ЕРИП: {svc.title}</h2><p className="muted">{svc.sub}</p>
    <AmountField label="Сумма, BYN" value={amount} onChange={setAmount} />
    <FundsHint amount={toKop(amount)} />
    <button className="btn" disabled={toKop(amount) <= 0 || short} onClick={async () => { const d = await run(() => call<PayDecision>('/api/child/erip', { serviceId: id, amount: toKop(amount) })); if (d) sheet(c => <PayResult d={d} close={c} />); else close(); }}>Оплатить</button>
  </>;
}

/** 4111111111111111 → 4111 1111 1111 1111 */
const fmtCard = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
function TransferSheet({ close }: { close: () => void }) {
  const o = useChild();
  const { call, run, sheet } = useDevice();
  const [by, setBy] = useState<'card' | 'phone'>('card');
  const [card, setCard] = useState('');
  const [phone, setPhone] = useState('+375 (29) ');
  const [amount, setAmount] = useState('5');
  const short = useShort(toKop(amount));
  const teen = o?.me.group === 'teen';
  const to = by === 'card' ? { card: card.replace(/\s/g, '') } : { phone: phone.trim() };
  const filled = by === 'card' ? card.replace(/\s/g, '').length === 16 : phone.replace(/\D/g, '').length === 12;
  return <>
    <h2>Перевод другу</h2>
    {teen && <div className="seg"><button className={by === 'card' ? 'on' : ''} onClick={() => setBy('card')}>По номеру карты</button><button className={by === 'phone' ? 'on' : ''} onClick={() => setBy('phone')}>По телефону</button></div>}
    {by === 'card'
      ? <div className="field"><label>Номер карты друга</label><input inputMode="numeric" autoComplete="off" placeholder="0000 0000 0000 0000" value={card} onChange={e => setCard(fmtCard(e.target.value))} /></div>
      : <div className="field"><label>Номер телефона</label><input inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} /></div>}
    {by === 'card' && <div className="hint" style={{ fontSize: 13 }}>Демо: <button className="link" onClick={() => setCard(fmtCard('4111111111111111'))}>4111 1111 1111 1111</button></div>}
    <AmountField label="Сумма, BYN" value={amount} onChange={setAmount} presets={[2, 5, 10]} />
    <FundsHint amount={toKop(amount)} />
    <div className="legal"><Icon name="shield" size={18} /><span>Переводи только тем, кого знаешь лично. Если «друг» пишет с нового номера, сначала позвони ему.</span></div>
    <button className="btn" disabled={toKop(amount) <= 0 || short || !filled} onClick={async () => { const d = await run(() => call<PayDecision>('/api/child/transfer', { ...to, amount: toKop(amount) })); if (d) sheet(c => <PayResult d={d} close={c} />); }}>Перевести</button>
  </>;
}

export function TeenPayments() {
  const o = useChild();
  const { push, sheet } = useDevice();
  const ask = useAsk();
  if (!o) return <Loading />;
  const p = o.me.settings.perms;
  const subs = o.me.subscriptions.filter(x => x.active);
  return <><TopBar title="Платежи" /><div className="page">
    <div className="card"><h3>QR-оплата КРОК {!p.qr && <span className="tag solid-red">Закрыто</span>}</h3>
      <Row icon="qr-code" tone="dash" title="Оплатить по QR на кассе" sub="Со счёта, мгновенно, без карты" onClick={() => (p.qr ? push('pay', { method: 'qr' }) : ask.perm('perms.qr'))} /></div>
    <div className="card"><h3>ЕРИП {!p.erip && <span className="tag solid-red">Закрыто</span>}</h3>
      {ERIP_SERVICES.map(s => <Row key={s.id} icon={s.icon} tone="dash" title={s.title} sub={s.sub} onClick={() => (p.erip ? sheet(c => <EripSheet id={s.id} close={c} />) : ask.perm('perms.erip'))} />)}</div>
    <div className="card"><h3>Переводы</h3>
      <Row icon="transfer" tone="dash" title="Другу по номеру карты или телефона" sub="Мгновенно, внутри Беларуси" onClick={() => (p.p2p ? sheet(c => <TransferSheet close={c} />) : ask.perm('perms.p2p'))} />
      <Row icon="send" tone="dash" title="Попросить у родителей" sub="Запрос придёт в их Moby" onClick={() => sheet(c => <AskMoneySheet close={c} />)} />
    </div>
    <div className="card"><h3>Подписки {!p.subs && <span className="tag solid-red">Закрыто</span>}</h3>
      <Row icon="repeat" tone="dash" title="Карта для подписок" sub={p.subs ? `${subs.length} ${plural(subs.length, 'подписка', 'подписки', 'подписок')}, ${fmt(subs.reduce((a, x) => a + x.price, 0))} в месяц` : 'Отдельная карта с лимитом, нужно разрешение родителя'}
        onClick={() => (p.subs ? push('subs') : ask.perm('perms.subs'))} />
    </div>
  </div></>;
}

export function TeenSubs() {
  const o = useChild();
  const { run, call } = useDevice();
  if (!o) return <Loading />;
  const sum = o.me.subscriptions.filter(s => s.active).reduce((a, s) => a + s.price, 0);
  return <><TopBar title="Подписки" /><div className="page">
    <div className="card"><small className="muted">В месяц</small><div className="bal" style={{ fontSize: 28 }}>{fmt(sum)}</div>
      <div style={{ margin: '10px 0 6px' }}><Bar value={sum} max={SUBS_MONTHLY_LIMIT} red={sum > SUBS_MONTHLY_LIMIT} /></div>
      <small className="muted">Лимит карты подписок {fmt(SUBS_MONTHLY_LIMIT)} · за год это {fmt(sum * 12)}</small></div>
    <div className="card">{o.me.subscriptions.map(s => (
      <div className="setrow" key={s.id}><RowIcon name={s.icon} /><div className="tx"><b>{s.title}</b><small>{fmt(s.price)} в месяц{s.active ? '' : ', отключена'}</small></div>
        <Toggle on={s.active} label={s.title} onChange={v => run(() => call(`/api/child/subscriptions/${s.id}`, { active: v }), v ? 'Подписка включена' : 'Подписка отключена, списаний больше не будет')} /></div>
    ))}</div>
    <div className="legal"><Icon name="bell" size={18} /><span>За 3 дня до списания Moby напомнит о подписке, а после пробного периода спросит, продлевать ли её.</span></div>
  </div></>;
}

export function TeenEarn() {
  const o = useChild();
  const { call, tab, sheet } = useDevice();
  if (!o) return <Loading />;
  const g = o.me.goals.find(x => x.saved < x.target);
  return <><TopBar title="Заработок и задания" /><div className="page">
    <div className="card"><small className="muted">Собственные средства</small><div className="bal" style={{ fontSize: 28 }}>{fmt(o.me.income)}</div><small className="muted">Подработка и стипендия</small></div>
    <div className="sec">Задания от родителей</div>
    <TaskList o={o} />
    <div className="legal"><Icon name="file-text" size={18} /><span>С 14 лет ты сам(а) распоряжаешься заработком и стипендией и можешь открыть вклад (ст. 26 ГК РБ). Лимиты родителя на эти деньги не действуют.</span></div>
    {g && <button className="btn" disabled={o.me.income <= 0} onClick={() => sheet(c => <MoneySheet title={`Отложить на «${g.title}»`} sub="Из собственных средств" cta="Отложить" max={o.me.income} maxLabel="собственных"
      presets={[5, 10, 20, 50]} send={amount => call('/api/child/income-to-goal', { goalId: g.id, amount })} ok={a => `${fmt(a)} отложено на «${g.title}»`} close={c} />)}>Отложить на «{g.title}»</button>}
    <button className="btn ghost" onClick={() => tab('savings')}>Перейти к вкладу</button>
  </div></>;
}

export function TeenSavings() {
  const o = useChild();
  const { run, call, sheet, push } = useDevice();
  if (!o) return <Loading />;
  const d = o.me.deposit;
  return <><PlainTop title="Накопления" /><div className="page tight">
    <button className="family-entry press" onClick={() => push('earn')}><div className="ic"><Icon name="briefcase" size={24} /></div>
      <div className="tx"><b>Заработок {fmt(o.me.income)}</b><small>Задания от родителей и подработка: распоряжаешься сам(а)</small></div><Chev /></button>
    <div className="card"><h3>Вклад «Мой старт»</h3>
      {d ? <>
        <div className="bal" style={{ fontSize: 28, marginTop: 8 }}>{fmt(d.amount)}</div>
        <small className="muted">{d.rate}% годовых, через год около {fmt(Math.round(d.amount * (1 + d.rate / 100)))}</small>
        <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => sheet(c => <MoneySheet title="Пополнить вклад" cta="Пополнить" max={o.me.balance} min={10 * BYN} presets={[10, 20, 50]}
          send={amount => call('/api/child/deposit', { action: 'topup', amount })} ok={a => `+${fmt(a)} на вклад`} close={c} />)}>Пополнить</button>
      </> : <>
        <p className="muted" style={{ marginTop: 6 }}>Отзывный вклад от 10 BYN. С 14 лет можно открыть самостоятельно.</p>
        <button className="btn" style={{ marginTop: 12 }} onClick={() => sheet(c => <MoneySheet title="Открыть вклад «Мой старт»" sub="От 10 BYN" cta="Открыть с" max={o.me.balance} min={10 * BYN} presets={[10, 20, 50]}
          send={amount => call('/api/child/deposit', { action: 'open', amount })} ok={() => 'Вклад открыт'} close={c} />)}>Открыть вклад</button>
      </>}
    </div>
    {o.me.goals.map(g => <GoalCard key={g.id} o={o} id={g.id} />)}
    <CashbackCard o={o} />
    <FamilyGoalCard o={o} />
    {o.me.settings.perms.goals && <button className="btn" onClick={() => sheet(c => <NewGoalSheet close={c} />)}><Icon name="plus" size={20} /> Новая цель</button>}
  </div></>;
}

// ---------- MobyPlay: игры, уроки, предложения партнёров ----------
export function MobyPlay() {
  const o = useChild();
  const { push, toast } = useDevice();
  if (!o) return <Loading />;
  const game = (icon: string, tone: 'red' | undefined, title: string, sub: string, to: string, done?: boolean) => (
    <button className="family-entry press" onClick={() => push(to)}><div className={`ic ${tone ?? ''}`}><Icon name={icon} size={24} /></div>
      <div className="tx"><b>{title}</b><small>{sub}</small></div>{done ? <span className="tag">Пройдено</span> : <Chev />}</button>);
  return <>
    <PlainTop title="MobyPlay" right={<span className="tag" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13 }}><Coin />{o.me.coins}</span>} />
    <div className="page tight">
      <div className="sec">Игры</div>
      {game('shield-alert', 'red', 'Распознай мошенника', `${FRAUD_CASES.length} ситуаций, +${FRAUD_REWARD_PER_ANSWER.coins} Маничек за верный ответ`, 'fraud', o.me.lessons.includes('fraud'))}
      {game('layout-grid', undefined, 'Карты по памяти', `Найди пары партнёров Moby, +${GAME_REWARD.memory.coins} Маничек в день`, 'memory')}
      {game('tag', undefined, 'Угадай цену', `Сколько стоят вещи вокруг, +${GAME_REWARD.price.coins} Манички за верный ответ`, 'price')}
      <div className="sec">Уроки</div>
      <div className="card">{LESSONS[o.me.group].map(l => (
        <Row key={l.id} icon={l.icon} title={l.title} sub={`${l.questions.length} вопроса · ${LESSON_REWARD.xp} опыта · ${LESSON_REWARD.coins} Маничек`}
          right={o.me.lessons.includes(l.id) ? <span className="tag">Пройден</span> : <Chev />} onClick={() => push('quiz', { id: l.id })} />
      ))}</div>
      <div className="sec">Предложения партнёров</div>
      <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>{PARTNER_OFFERS[o.me.group].map(p => <Row key={p.title} icon={p.icon} title={p.title} sub={p.sub} onClick={() => toast('Предложение сохранено в Маничках')} />)}</div>
    </div>
  </>;
}

type GameResult = { rewarded: boolean; coins: number; xp: number; level: number | null };
function GameDone({ icon, title, text, r, onAgain }: { icon: string; title: string; text: string; r: GameResult; onAgain: () => void }) {
  const { back } = useDevice();
  return <div className="page">
    <Confetti />
    <div className="result"><div className="big ok win"><Icon name={icon} size={34} /></div><h2>{title}</h2><p>{text}</p>
      {r.rewarded ? <div className="reward-pop"><Coin /> +<CountUp to={r.coins} /> Маничек · +<CountUp to={r.xp} /> опыта</div>
        : <p><b>Награда за сегодня уже получена. Возвращайся завтра</b></p>}
      {r.level && <p>Новый уровень {r.level}! Родителю отправлено предложение расширить лимиты.</p>}</div>
    <button className="btn" onClick={back}>Готово</button>
    <button className="btn ghost" onClick={onAgain}>Сыграть ещё</button>
  </div>;
}

const shuffle = <T,>(a: T[]) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

/** «Карты по памяти»: 6 пар партнёров Moby на поле 3×4 */
export function Memory() {
  const { run, call } = useDevice();
  const deal = () => shuffle([...MEMORY_PARTNERS, ...MEMORY_PARTNERS]);
  const [deck, setDeck] = useState(deal);
  const [open, setOpen] = useState<number[]>([]);
  const [found, setFound] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [miss, setMiss] = useState<number[]>([]);
  const [result, setResult] = useState<GameResult | null>(null);
  const again = () => { setDeck(deal()); setOpen([]); setFound([]); setMoves(0); setResult(null); };
  const flip = (i: number) => {
    if (open.length === 2 || open.includes(i) || found.includes(deck[i].id)) return;
    const next = [...open, i];
    setOpen(next);
    if (next.length < 2) return;
    setMoves(m => m + 1);
    if (deck[next[0]].id !== deck[next[1]].id) { setTimeout(() => setMiss(next), 380); setTimeout(() => { setOpen([]); setMiss([]); }, 850); return; }
    const f = [...found, deck[i].id];
    setFound(f); setOpen([]);
    if (f.length === MEMORY_PARTNERS.length) run(() => call<GameResult>('/api/child/games/memory', { score: 1 })).then(r => r && setTimeout(() => setResult(r), 400));
  };
  if (result) return <><TopBar title="Карты по памяти" /><GameDone icon="trophy" title={`Все пары за ${moves} ${plural(moves, 'ход', 'хода', 'ходов')}`}
    text="Это партнёры Moby: плати у них картой — в понедельник часть денег вернётся кешбэком." r={result} onAgain={again} /></>;
  return <><TopBar title="Карты по памяти" /><div className="page">
    <small className="muted">Открывай по две карты и находи одинаковых партнёров · ходов {moves} · пар {found.length} из {MEMORY_PARTNERS.length}</small>
    <div className="memgrid">{deck.map((p, i) => {
      const up = open.includes(i) || found.includes(p.id);
      return <button key={i} className={`mem ${up ? 'up' : ''} ${found.includes(p.id) ? 'found' : ''} ${miss.includes(i) ? 'miss' : ''}`} onClick={() => flip(i)} aria-label={up ? p.title : 'Закрытая карта'}>
        <span className="mem-in"><span className="mem-back">M</span><span className="mem-face"><Icon name={p.icon} size={28} /><small>{p.title}</small></span></span>
      </button>;
    })}</div>
  </div></>;
}

/** «Угадай цену»: 6 вещей, три варианта цены */
export function PriceGame() {
  const { run, call } = useDevice();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<GameResult | null>(null);
  const again = () => { setI(0); setAnswers([]); setResult(null); };
  const correct = answers.filter((a, k) => a === PRICE_GAME[k].answer).length;
  if (result) return <><TopBar title="Угадай цену" /><GameDone icon="tag" title={`${correct} из ${PRICE_GAME.length}`}
    text={correct >= 4 ? 'Отлично чувствуешь цены — с таким навыком проще планировать покупки.' : 'Цены легко недооценить. Загляни в «Уроки», там про бюджет.'} r={result} onAgain={again} /></>;
  const q = PRICE_GAME[i];
  const picked = answers[i];
  const next = async () => {
    if (i + 1 < PRICE_GAME.length) return setI(i + 1);
    const r = await run(() => call<GameResult>('/api/child/games/price', { score: correct }));
    if (r) setResult(r);
  };
  return <><TopBar title="Угадай цену" /><div className="page">
    <small className="muted">Вещь {i + 1} из {PRICE_GAME.length} · верно {correct}</small>
    <Bar value={i} max={PRICE_GAME.length} />
    <div className="msg" style={{ alignItems: 'center' }}><RowIcon name={q.icon} /><div style={{ fontSize: 18, fontWeight: 600 }}>{q.item}</div></div>
    <p className="muted">Сколько это примерно стоит в Минске?</p>
    {q.options.map((v, k) => <button key={k} className={`opt press ${picked !== undefined ? (k === q.answer ? 'right' : k === picked ? 'wrong' : '') : ''}`} disabled={picked !== undefined}
      onClick={() => setAnswers(a => { const n = [...a]; n[i] = k; return n; })}>{fmt(v)}</button>)}
    {picked !== undefined && <><div className="legal"><Icon name="info" size={18} /><span>{q.note}</span></div>
      <button className="btn" onClick={next}>{i + 1 < PRICE_GAME.length ? 'Дальше' : 'Завершить'}</button></>}
  </div></>;
}

// ---------- подросток: «Путь к 18», «Ещё» и настройки ----------
export function PathScreen() {
  const o = useChild();
  if (!o) return <Loading />;
  const lv = levelOf(o.me.xp), nx = nextLevel(o.me.xp);
  return <><TopBar title="Путь к 18" /><div className="page">
    <div className="card"><h3>Уровень {lv.n}: {lv.title}</h3>
      <div style={{ margin: '12px 0 6px' }}><Bar value={nx ? o.me.xp - lv.xp : 1} max={nx ? nx.xp - lv.xp : 1} /></div>
      <small className="muted">{nx ? `${o.me.xp} из ${nx.xp} опыта до уровня ${nx.n}. Опыт дают задания, уроки и игры в MobyPlay` : 'Максимальный уровень'}</small></div>
    <div className="card"><h3>Уровни самостоятельности</h3><p className="muted" style={{ margin: '4px 0 14px' }}>Каждый уровень предлагает родителю дать тебе больше свободы.</p>
      {LEVELS.map(l => <div key={l.n} className={`pstep ${l.n < lv.n ? 'done' : l.n === lv.n ? 'cur' : ''}`}><div className="n">{l.n}</div><div><b style={{ fontWeight: 600 }}>{l.title}</b><br /><small>{l.perk}</small></div></div>)}
      <div className="pstep"><div className="n">18</div><div><b style={{ fontWeight: 600 }}>Взрослый Moby</b><br /><small>Карта переоформляется на тебя, копилки, вклад и Манички сохраняются. 3 месяца пакета «Шоппер» бесплатно</small></div></div>
    </div>
  </div></>;
}

/** Скрыть баланс на главной: запоминается на этом телефоне */
function useHidden() {
  const { userId } = useDevice();
  const key = `moby-family:hide:${userId}`;
  const [hide, setHide] = useState(() => { try { return localStorage.getItem(key) === '1'; } catch { return false; } });
  const set = (v: boolean) => { setHide(v); try { localStorage.setItem(key, v ? '1' : '0'); } catch { /* приватный режим */ } };
  return [hide, set] as const;
}

/** Все запросы ребёнка родителям с ответами */
function RequestsSheet() {
  const o = useChild();
  if (!o) return <Loading />;
  return <><h2>Мои запросы</h2>
    {o.requests.length ? <div>{o.requests.map(r => (
      <Row key={r.id} icon="send" title={REQ_LABEL[r.type]} sub={`${r.summary}${r.amount != null ? `, ${fmt(r.amount)}` : ''}`}
        right={<span className={`tag ${r.status === 'declined' ? 'solid-red' : r.status === 'pending' ? 'red' : ''}`}>{r.status === 'pending' ? 'Ждём' : r.status === 'approved' ? 'Одобрено' : 'Отказ'}</span>} />
    ))}</div> : <div className="empty">Ты ещё ничего не просил(а)</div>}
  </>;
}

/** «Ещё»: как у взрослого Moby, но только то, что нужно ребёнку 7–13 или подростку 14–17 */
export function ChildMore() {
  const o = useChild();
  const { push, tab, sheet, toast, logout } = useDevice();
  const ask = useAsk();
  if (!o) return <Loading />;
  const soon = () => toast('Этот раздел Moby не входит в модуль «Семья»');
  const ins = o.me.insurance;
  // Страховку оформляет родитель; ребёнок видит, что он защищён
  const insurance: [string, string, () => void][] = ins ? [['umbrella', 'Моя страховка', () => sheet(() => <><h2>Ты застрахован(а)</h2>
    <Row icon="shield-check" title={`«${ins.title}»`} sub={`Покрытие до ${fmt(ins.cover)}. Оформили родители`} />
    <div className="legal"><Icon name="info" size={18} /><span>Если что-то случилось — травма в школе, на тренировке или дома, — скажи родителям: заявление они подадут в Moby, выплата придёт им на карту.</span></div></>)]] : [];
  const items: [string, string, () => void][] = o.me.group === 'kid' ? [
    ['settings', 'Настройки', () => push('settings')],
    ['credit-card', 'Моя карта', () => sheet(c => <CardsSheet close={c} />)],
    ['list-checks', 'Задания', () => push('tasks')],
    ['history', 'Мои покупки', () => sheet(() => <OpsSheet title="Мои покупки" />)],
    ['send', 'Мои запросы', () => sheet(() => <RequestsSheet />)],
    ['coins', `Манички: ${o.me.coins}`, () => tab('play')],
    ...insurance,
    ['shield', 'Ваша безопасность', () => push('fraud')],
    ['info', 'О Банке', soon],
  ] : [
    ['settings', 'Настройки', () => push('settings')],
    ['credit-card', 'Мои карты', () => sheet(c => <CardsSheet close={c} />)],
    ['rocket', 'Путь к 18', () => push('path')],
    ['chart-column', 'Аналитика трат', () => push('analytics')],
    ['repeat', 'Подписки', () => (o.me.settings.perms.subs ? push('subs') : ask.perm('perms.subs'))],
    ['briefcase', 'Заработок и задания', () => push('earn')],
    ['coins', `Манички: ${o.me.coins}`, () => tab('play')],
    ...insurance,
    ['shield', 'Ваша безопасность', () => push('fraud')],
    ['info', 'О Банке', soon],
  ];
  return <div className="page" style={{ paddingTop: 56 }}>
    <div className="menu">{items.map(([ic, t, fn]) => <button key={ic} className="item press" onClick={fn}><RowIcon name={ic} tone="dash" /><div className="tx">{t}</div><Chev /></button>)}</div>
    <button className="btn ghost" onClick={logout}>Выйти</button>
  </div>;
}

export function ChildSettings() {
  const o = useChild();
  const { logout } = useDevice();
  const [hide, setHide] = useHidden();
  const [notify, setNotify] = useState(true);
  if (!o) return <Loading />;
  return <>
    <TopBar title="Настройки" />
    <div className="page" style={{ background: '#fff', minHeight: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '30px 0 24px' }}>
        <div className="avatar-xl">{initial(o.me.name)}</div><div style={{ fontSize: 26 }}>{o.me.name}</div>
        <div className="muted">{o.me.phone ? fmtPhone(o.me.phone) : 'Номер телефона не указан'}</div>
      </div>
      <div className="srow">Скрывать баланс на главной <Toggle on={hide} label="Скрывать баланс" onChange={setHide} /></div>
      <div className="srow">Уведомления о тратах <Toggle on={notify} label="Уведомления о тратах" onChange={setNotify} /></div>
      <div className="srow" style={{ color: 'var(--muted)', fontSize: 14 }}>Лимиты и разрешения настраивает родитель</div>
      <button className="srow" style={{ color: 'var(--red)' }} onClick={logout}>Выйти</button>
    </div>
  </>;
}
