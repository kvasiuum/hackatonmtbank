// Moby ребёнка (7–13) и подростка (14–17).
import { useState } from 'react';
import {
  BYN, CARD_COLORS, CARD_TYPES, CATEGORY_NAMES, ERIP_SERVICES, FRAUD_CASES, FRAUD_REWARD_PER_ANSWER, LESSONS, LESSON_REWARD, LEVELS,
  MAX_CARDS, MERCHANTS, PARTNER_OFFERS, SETTING_LABELS, SUBS_MONTHLY_LIMIT, levelOf, nextLevel,
} from '../../server/src/content';
import type { CardType, ChildOverview, PayDecision, PayMethod, SettingPath } from '../../server/src/types';
import { Icon } from './icons';
import { fmt, toKop, useData, useDevice } from './lib';
import { TaskTag } from './parent';
import { Act, AmountField, BankCard, Bar, CardStatus, CardTypePicker, Chev, Coin, OpsList, PlainTop, Row, RowIcon, Swatches, Toggle, TopBar, cardIcon, mainCard, useBusy } from './ui';

export const useChild = () => useData<ChildOverview>('/api/child/overview').data;
const Loading = () => <div className="loading">Загрузка…</div>;

const REQ_LABEL: Record<string, string> = {
  money: 'Просил(а) деньги', perm: 'Просил(а) доступ', card: 'Просил(а) карту', purchase: 'Покупка ждёт родителя',
  limit: 'Просил(а) лимит', level: 'Новый уровень', task: 'Задание на проверке', goal: 'Просил(а) в копилку',
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
  const [amount, setAmount] = useState(2);
  const [busy, wrap] = useBusy();
  const bonus = o.me.settings.parentBonus;
  return <>
    <div className="goal-h"><RowIcon name={g.icon} tone="red" /><div className="tx"><h2>{g.title}</h2><small className="muted">На счёте {fmt(o.me.balance)}{bonus ? ', родители добавят 10%' : ''}</small></div></div>
    <div className="pills">{[1, 2, 5, 10].map(x => <button key={x} className={`pill ${amount === x ? 'on' : ''}`} onClick={() => setAmount(x)}>{x} BYN</button>)}</div>
    <button className="btn" disabled={busy} onClick={() => wrap(async () => {
      if (await run(() => call<{ added: number }>(`/api/child/goals/${goalId}/deposit`, { amount: amount * BYN }), r => `+${fmt(r.added)} в копилку`)) close();
    })}>Положить {fmt(amount * BYN)}{bonus ? `, в копилку упадёт ${fmt(amount * BYN * 1.1)}` : ''}</button>
    <button className="btn ghost" onClick={() => wrap(async () => { if (await run(() => call('/api/child/requests', { type: 'goal', goalId, amount: 5 * BYN, reason: `Помогите накопить на «${g.title}»` }), 'Попросили родителей поддержать копилку')) close(); })}>Попросить родителей добавить 5 BYN</button>
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

function GoalCard({ o, id }: { o: ChildOverview; id: string }) {
  const { sheet } = useDevice();
  const g = o.me.goals.find(x => x.id === id)!;
  const weeks = o.me.settings.allowance.on ? Math.ceil((g.target - g.saved) / o.me.settings.allowance.amount) : null;
  return <div className="card goal">
    <div className="goal-h"><RowIcon name={g.icon} tone="red" /><div className="tx"><b>{g.title}</b><small className="muted">{fmt(g.saved)} из {fmt(g.target)}</small></div>
      <button className="sbtn" onClick={() => sheet(c => <GoalSheet o={o} goalId={id} close={c} />)}>Положить</button></div>
    <Bar value={g.saved} max={g.target} red />
    {g.saved >= g.target ? <span className="tag" style={{ alignSelf: 'flex-start' }}>Цель достигнута</span>
      : <small className="muted">Осталось {fmt(g.target - g.saved)}{weeks ? `, около ${weeks} нед. с карманных` : ''}</small>}
  </div>;
}

function FamilyGoalCard({ o }: { o: ChildOverview }) {
  const { run, call } = useDevice();
  const g = o.familyGoal;
  return <div className="card goal">
    <div className="goal-h"><RowIcon name={g.icon} /><div className="tx"><small className="muted">Семейная цель</small><b>{g.title}</b></div><b>{Math.round(g.saved / g.target * 100)}%</b></div>
    <Bar value={g.saved} max={g.target} />
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <small className="muted">{fmt(g.saved)} из {fmt(g.target)}, копит вся семья</small>
      <button className="sbtn" onClick={() => run(() => call('/api/family/goal', { amount: 2 * BYN }), '+2.00 BYN в семейную цель')}>+2 BYN</button>
    </div>
  </div>;
}

function LevelBox({ o, to }: { o: ChildOverview; to: string }) {
  const { tab } = useDevice();
  const lv = levelOf(o.me.xp), nx = nextLevel(o.me.xp);
  return <button className="lvl" onClick={() => tab(to)}>
    <div className="n">{lv.n}</div>
    <div className="tx" style={{ fontSize: 13 }}><b style={{ fontSize: 14 }}>Уровень {lv.n}: {lv.title}</b>{nx ? `${o.me.xp} из ${nx.xp} опыта` : 'Максимальный уровень'}<Bar value={nx ? o.me.xp - lv.xp : 1} max={nx ? nx.xp - lv.xp : 1} /></div>
    <span className="chip"><Coin />{o.me.coins}</span>
  </button>;
}

function MyRequests({ o }: { o: ChildOverview }) {
  if (!o.requests.length) return null;
  return <div className="card"><h3>Мои запросы</h3>{o.requests.slice(0, 3).map(r => (
    <Row key={r.id} icon="send" title={REQ_LABEL[r.type]} sub={r.summary}
      right={<span className={`tag ${r.status === 'declined' ? 'solid-red' : r.status === 'pending' ? 'red' : ''}`}>{r.status === 'pending' ? 'Ждём ответа' : r.status === 'approved' ? 'Одобрено' : 'Отказ'}</span>} />
  ))}</div>;
}

function MyCards({ o }: { o: ChildOverview }) {
  const { run, call, sheet } = useDevice();
  const kid = o.me.group === 'kid';
  return <div className="card"><h3>Мои карты</h3>
    {o.me.cards.map(c => (
      <div className="row" key={c.id}>
        <div className="ic" style={{ background: c.color, color: '#fff' }}><Icon name={cardIcon(c.type)} size={22} /></div>
        <div className="tx"><b>{CARD_TYPES[c.type].label}</b><small style={{ display: 'flex', gap: 6, alignItems: 'center' }}>•• {c.last4} <CardStatus c={c} /></small></div>
        {c.status === 'active' && <button className="sbtn red" onClick={() => run(() => call(`/api/cards/${c.id}`, { action: 'block' }), 'Карта заблокирована, родители получили уведомление')}>Блок</button>}
        {c.status === 'blocked' && !kid && <button className="sbtn" onClick={() => run(() => call(`/api/cards/${c.id}`, { action: 'unblock' }), 'Карта снова работает')}>Разблок.</button>}
      </div>
    ))}
    {o.me.cards.length < MAX_CARDS && <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => sheet(c => <CardRequestSheet o={o} close={c} />)}>
      <Icon name={o.me.settings.perms.newCards ? 'plus' : 'send'} size={20} /> {o.me.settings.perms.newCards ? 'Выпустить виртуальную карту' : 'Попросить новую карту'}</button>}
  </div>;
}

// ---------- ребёнок 7–13 ----------
export function KidHome() {
  const o = useChild();
  const { push, tab, sheet, run, call } = useDevice();
  if (!o) return <Loading />;
  const main = mainCard(o.me.cards);
  const virtualOk = o.me.cards.some(c => c.type === 'virtual' && c.status === 'active');
  const open = o.me.tasks.filter(t => t.status === 'open');
  return <>
    <div className="hero">
      <div className="hero-top"><div className="ava">{o.me.name[0]}</div><div><div className="hero-name">Привет, {o.me.name}</div><div className="hero-sub">У тебя на счёте</div></div></div>
      <div className="bal-row"><div className="bal">{fmt(o.me.balance)}</div></div>
      <LevelBox o={o} to="learn" />
      <div className="actions">
        <Act icon="send" label="Попросить" onClick={() => sheet(c => <AskMoneySheet close={c} />)} />
        <Act icon="pay" label="Оплатить" onClick={() => push('pay')} />
        <Act icon="piggy-bank" label="Копилки" onClick={() => tab('goals')} />
      </div>
    </div>
    <div className="body">
      {main && <BankCard name={o.me.name} card={main} />}
      {main?.status === 'active' && CARD_TYPES[main.type].physical && <button className="btn red" onClick={() => run(() => call(`/api/cards/${main.id}`, { action: 'block' }), 'Карта заблокирована, родители получили уведомление')}><Icon name="lock" size={20} /> Я потерял карту</button>}
      {main && main.status !== 'active' && <div className="legal"><Icon name={main.status === 'blocked' ? 'lock' : 'clock'} size={18} /><span>
        {main.status === 'blocked' ? `${CARD_TYPES[main.type].label}: карта заблокирована. Нашлась? Попроси родителя разблокировать.` : `${CARD_TYPES[main.type].label} в пути.`}
        {virtualOk ? ' Пока плати виртуальной картой в телефоне' : ''}{o.me.settings.perms.qr ? `${virtualOk ? ' или' : ' Плати'} по QR КРОК.` : virtualOk ? '.' : ''}</span></div>}
      {open.length > 0 && <div className="card"><h3>Задания от родителей <button className="link" onClick={() => tab('tasks')}>Все</button></h3>
        {open.slice(0, 2).map(t => <Row key={t.id} icon="list-checks" title={t.title} sub={`+${fmt(t.reward)} и 40 опыта`} right={<button className="sbtn solid" onClick={() => run(() => call(`/api/child/tasks/${t.id}/done`, {}), 'Родитель проверит и отправит награду')}>Сделал</button>} />)}
      </div>}
      {o.me.goals[0] && <GoalCard o={o} id={o.me.goals[0].id} />}
      <button className="family-entry press" onClick={() => push('fraud')}><div className="ic red"><Icon name="shield-alert" size={24} /></div><div className="tx"><b>Игра «Распознай мошенника»</b><small>+5 Маничек за каждый верный ответ</small></div><Chev /></button>
      <MyRequests o={o} />
      <MyCards o={o} />
      <div className="card"><h3>Мои покупки</h3><OpsList ops={o.me.ops} limit={5} /></div>
    </div>
  </>;
}

export function KidGoals() {
  const o = useChild();
  const { sheet } = useDevice();
  if (!o) return <Loading />;
  return <>
    <PlainTop title="Копилки" />
    <div className="page tight">
      {o.me.settings.parentBonus && <div className="family-entry"><div className="ic red"><Icon name="gift" size={24} /></div><div className="tx"><b>Родители добавляют 10%</b><small>Положишь 10 BYN, в копилке станет 11 BYN</small></div></div>}
      {o.me.goals.length ? o.me.goals.map(g => <GoalCard key={g.id} o={o} id={g.id} />) : <div className="empty">Копилок пока нет</div>}
      {o.me.settings.roundup && o.me.goals[0] && <div className="legal"><Icon name="coins" size={18} /><span>Сдача с покупок округляется и падает в первую незаполненную копилку.</span></div>}
      <FamilyGoalCard o={o} />
      {o.me.settings.perms.goals && <button className="btn" onClick={() => sheet(c => <NewGoalSheet close={c} />)}><Icon name="plus" size={20} /> Новая цель</button>}
    </div>
  </>;
}

export function KidTasks() {
  const o = useChild();
  const { run, call } = useDevice();
  if (!o) return <Loading />;
  return <>
    <PlainTop title="Задания" />
    <div className="page tight">
      <p className="muted">Выполняй задания от родителей и получай деньги и опыт для нового уровня.</p>
      <div className="card">{o.me.tasks.length ? o.me.tasks.map(t => (
        <Row key={t.id} icon={t.status === 'paid' ? 'check' : t.status === 'review' ? 'clock' : 'list-checks'} title={t.title} sub={`+${fmt(t.reward)} и 40 опыта`}
          right={t.status === 'open' ? <button className="sbtn solid" onClick={() => run(() => call(`/api/child/tasks/${t.id}/done`, {}), 'Родитель проверит и отправит награду')}>Сделал</button> : <TaskTag s={t.status} />} />
      )) : <div className="empty">Заданий пока нет. Попроси родителей придумать</div>}</div>
    </div>
  </>;
}

function LearnBlock({ o }: { o: ChildOverview }) {
  const { push, toast } = useDevice();
  return <>
    <button className="family-entry press" onClick={() => push('fraud')}><div className="ic red"><Icon name="shield-alert" size={24} /></div>
      <div className="tx"><b>Распознай мошенника</b><small>{FRAUD_CASES.length} ситуаций, +{FRAUD_REWARD_PER_ANSWER.coins} Маничек за верный ответ</small></div>{o.me.lessons.includes('fraud') ? <span className="tag">Пройдено</span> : <Chev />}</button>
    <div className="sec">Уроки</div>
    <div className="card">{LESSONS[o.me.group].map(l => (
      <Row key={l.id} icon={l.icon} title={l.title} sub={`${l.questions.length} вопроса · ${LESSON_REWARD.xp} опыта · ${LESSON_REWARD.coins} Маничек`}
        right={o.me.lessons.includes(l.id) ? <span className="tag">Пройден</span> : <Chev />} onClick={() => push('quiz', { id: l.id })} />
    ))}</div>
    <div className="sec">Предложения партнёров</div>
    <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>{PARTNER_OFFERS[o.me.group].map(p => <Row key={p.title} icon={p.icon} title={p.title} sub={p.sub} onClick={() => toast('Предложение сохранено в Маничках')} />)}</div>
  </>;
}

export function KidLearn() {
  const o = useChild();
  if (!o) return <Loading />;
  return <><PlainTop title="Игры и уроки" right={<span className="tag red" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13 }}><Coin />{o.me.coins}</span>} />
    <div className="page tight"><LearnBlock o={o} /></div></>;
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
    <div className="result"><div className="big ok"><Icon name="trophy" size={34} /></div><h2>Урок пройден</h2><p>Верных ответов: {result.correct} из {result.total}</p>
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
    <div className="result"><div className="big ok"><Icon name="shield-check" size={34} /></div><h2>{result.correct} из {result.total}</h2>
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
      <div className="card" style={{ border: `2px solid ${correct ? 'var(--blue)' : 'var(--red)'}` }}><b>{correct ? 'Верно. ' : 'Не совсем. '}{f.fraud ? 'Это мошенники.' : 'Это безопасно.'}</b><p style={{ marginTop: 6, fontSize: 14.5, color: '#4F5A6E' }}>{f.why}</p></div>
      <button className="btn" onClick={next}>{i + 1 < FRAUD_CASES.length ? 'Дальше' : 'Завершить'}</button></>}
  </div></>;
}

export function Pay({ method: initial }: { method?: PayMethod }) {
  const o = useChild();
  const { call, sheet, run } = useDevice();
  const [method, setMethod] = useState<PayMethod>(initial ?? 'card');
  if (!o) return <Loading />;
  const qr = method === 'qr';
  const pay = async (merchantId: string) => {
    const d = await run(() => call<PayDecision>('/api/child/pay', { merchantId, method }));
    if (d) sheet(c => <PayResult d={d} close={c} />);
  };
  const card = o.me.cards.find(c => c.status === 'active' && CARD_TYPES[c.type].physical) ?? o.me.cards.find(c => c.status === 'active');
  return <><TopBar title="Оплатить" /><div className="page">
    <div className="seg"><button className={qr ? '' : 'on'} onClick={() => setMethod('card')}>Картой</button><button className={qr ? 'on' : ''} onClick={() => setMethod('qr')}>По QR КРОК</button></div>
    <div className="legal"><Icon name={qr ? 'qr-code' : 'info'} size={18} /><span>{qr
      ? `КРОК — национальный сервис QR-платежей (Нацбанк, ЕРИП). Сканируешь QR на кассе в Moby, деньги списываются со счёта мгновенно, карта не нужна. Лимиты и запреты родителя действуют так же.${o.me.settings.perms.qr ? '' : ' Сейчас QR-оплата выключена родителем.'}`
      : 'Выбери, где прикладываешь карту. Решение принимается по настройкам родителя и защите банка.'}</span></div>
    <small className="muted">{qr ? 'Платим по QR со счёта' : card ? `Платим: ${CARD_TYPES[card.type].label.toLowerCase()} •• ${card.last4}` : 'Нет активной карты'} · сегодня {fmt(o.me.spentToday)} из {fmt(o.me.settings.limits.day)} · подтверждение от {fmt(o.me.settings.confirmAbove)}</small>
    {MERCHANTS[o.me.group].map(m => (
      <button key={m.id} className="merchant press" onClick={() => pay(m.id)}>
        <RowIcon name={m.icon} tone={m.category === 'gambling' || m.category === 'adult' ? 'red' : undefined} />
        <span className="tx"><b>{m.title}</b><small>{CATEGORY_NAMES[m.category]}</small></span><b>{fmt(m.amount)}</b>
      </button>
    ))}
  </div></>;
}

// ---------- подросток 14–17 ----------
export function TeenHome() {
  const o = useChild();
  const { push, tab, sheet } = useDevice();
  const ask = useAsk();
  const [hide, setHide] = useState(false);
  if (!o) return <Loading />;
  const s = o.me.settings;
  const subs = o.me.subscriptions.filter(x => x.active);
  return <>
    <div className="hero">
      <div className="hero-top"><div className="ava">{o.me.name[0]}</div><div><div className="hero-name">{o.me.name}</div><div className="hero-sub">Moby 14+</div></div></div>
      <div className="chips"><span className="chip">УРОВЕНЬ {o.me.level}</span>{o.me.cards[0] && <span className="chip">5*{mainCard(o.me.cards).last4}</span>}<span className="chip"><Coin />{o.me.coins}</span></div>
      <div className="bal-row"><div className="bal">{hide ? '**** BYN' : fmt(o.me.balance)}</div><button className="iconbtn" onClick={() => setHide(!hide)} aria-label="Скрыть баланс"><Icon name={hide ? 'eye' : 'eye-off'} size={30} sw={1.6} /></button></div>
      <div className="actions">
        <Act icon="send" label="Попросить" onClick={() => sheet(c => <AskMoneySheet close={c} />)} />
        <Act icon="transfer" label="Перевести" onClick={() => (s.perms.p2p ? sheet(c => <TransferSheet close={c} />) : ask.perm('perms.p2p'))} />
        <Act icon="pay" label="Оплатить" onClick={() => push('pay')} />
      </div>
    </div>
    <div className="body">
      <MyCards o={o} />
      <div className="card"><h3>Ещё счета</h3>
        <Row icon="repeat" title="Карта для подписок" sub={s.perms.subs ? `${subs.length} ${subs.length === 1 ? 'подписка' : 'подписки'}, ${fmt(subs.reduce((a, x) => a + x.price, 0))} в месяц` : 'Нужно разрешение родителя'}
          onClick={() => (s.perms.subs ? push('subs') : ask.perm('perms.subs'))} />
        <Row icon="briefcase" title="Мой заработок" sub={`${fmt(o.me.income)}, распоряжаюсь сам(а)`} onClick={() => push('earn')} />
      </div>
      <div className="card"><h3>Траты за месяц <button className="link" onClick={() => push('analytics')}>Подробнее</button></h3><SpendBars o={o} n={3} /></div>
      {o.me.goals[0] && <GoalCard o={o} id={o.me.goals[0].id} />}
      <button className="family-entry press" onClick={() => tab('growth')}><div className="ic"><Icon name="rocket" size={24} /></div><div className="tx"><b>Путь к 18: уровень {o.me.level} из 5</b><small>Новый уровень — больше свободы и лимитов</small></div><Chev /></button>
      <MyRequests o={o} />
      <div className="card"><h3>История</h3><OpsList ops={o.me.ops} limit={5} /></div>
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

function EripSheet({ id, close }: { id: string; close: () => void }) {
  const { call, run, sheet } = useDevice();
  const svc = ERIP_SERVICES.find(x => x.id === id)!;
  const [amount, setAmount] = useState(String(svc.amount / 100));
  return <>
    <h2>ЕРИП: {svc.title}</h2><p className="muted">{svc.sub}</p>
    <AmountField label="Сумма, BYN" value={amount} onChange={setAmount} />
    <button className="btn" disabled={toKop(amount) <= 0} onClick={async () => { const d = await run(() => call<PayDecision>('/api/child/erip', { serviceId: id, amount: toKop(amount) })); if (d) sheet(c => <PayResult d={d} close={c} />); else close(); }}>Оплатить</button>
  </>;
}

function TransferSheet({ close }: { close: () => void }) {
  const { call, run, sheet } = useDevice();
  const [phone, setPhone] = useState('+375 (29) ');
  const [amount, setAmount] = useState('5');
  return <>
    <h2>Перевод другу</h2>
    <div className="field"><label>Номер телефона</label><input inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} /></div>
    <AmountField label="Сумма, BYN" value={amount} onChange={setAmount} presets={[2, 5, 10]} />
    <div className="legal"><Icon name="shield" size={18} /><span>Переводи только тем, кого знаешь лично. Если «друг» пишет с нового номера, сначала позвони ему.</span></div>
    <button className="btn" disabled={toKop(amount) <= 0} onClick={async () => { const d = await run(() => call<PayDecision>('/api/child/transfer', { phone: phone.trim(), amount: toKop(amount) })); if (d) sheet(c => <PayResult d={d} close={c} />); else close(); }}>Перевести</button>
  </>;
}

export function TeenPayments() {
  const o = useChild();
  const { push, sheet } = useDevice();
  const ask = useAsk();
  if (!o) return <Loading />;
  const p = o.me.settings.perms;
  return <><PlainTop title="Платежи" /><div className="page tight">
    <div className="card"><h3>QR-оплата КРОК {!p.qr && <span className="tag solid-red">Закрыто</span>}</h3>
      <Row icon="qr-code" tone="dash" title="Оплатить по QR на кассе" sub="Со счёта, мгновенно, без карты" onClick={() => (p.qr ? push('pay', { method: 'qr' }) : ask.perm('perms.qr'))} /></div>
    <div className="card"><h3>ЕРИП {!p.erip && <span className="tag solid-red">Закрыто</span>}</h3>
      {ERIP_SERVICES.map(s => <Row key={s.id} icon={s.icon} tone="dash" title={s.title} sub={s.sub} onClick={() => (p.erip ? sheet(c => <EripSheet id={s.id} close={c} />) : ask.perm('perms.erip'))} />)}</div>
    <div className="card"><h3>Переводы</h3>
      <Row icon="transfer" tone="dash" title="Другу по номеру телефона" sub="Мгновенно, внутри Беларуси" onClick={() => (p.p2p ? sheet(c => <TransferSheet close={c} />) : ask.perm('perms.p2p'))} />
      <Row icon="send" tone="dash" title="Попросить у родителей" sub="Запрос придёт в их Moby" onClick={() => sheet(c => <AskMoneySheet close={c} />)} />
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
  const { run, call, tab } = useDevice();
  if (!o) return <Loading />;
  const g = o.me.goals.find(x => x.saved < x.target);
  return <><TopBar title="Мой заработок" /><div className="page">
    <div className="card"><small className="muted">Собственные средства</small><div className="bal" style={{ fontSize: 28 }}>{fmt(o.me.income)}</div><small className="muted">Подработка и стипендия</small></div>
    <div className="legal"><Icon name="file-text" size={18} /><span>С 14 лет ты сам(а) распоряжаешься заработком и стипендией и можешь открыть вклад (ст. 26 ГК РБ). Лимиты родителя на эти деньги не действуют.</span></div>
    {g && <button className="btn" disabled={o.me.income < 20 * BYN} onClick={() => run(() => call('/api/child/income-to-goal', { goalId: g.id, amount: 20 * BYN }), `20.00 BYN отложено на «${g.title}»`)}>Отложить 20 BYN на «{g.title}»</button>}
    <button className="btn ghost" onClick={() => tab('savings')}>Перейти к вкладу</button>
  </div></>;
}

export function TeenSavings() {
  const o = useChild();
  const { run, call, sheet } = useDevice();
  if (!o) return <Loading />;
  const d = o.me.deposit;
  return <><PlainTop title="Накопления" /><div className="page tight">
    <div className="card"><h3>Вклад «Мой старт»</h3>
      {d ? <>
        <div className="bal" style={{ fontSize: 28, marginTop: 8 }}>{fmt(d.amount)}</div>
        <small className="muted">{d.rate}% годовых, через год около {fmt(Math.round(d.amount * (1 + d.rate / 100)))}</small>
        <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => run(() => call('/api/child/deposit', { action: 'topup', amount: 10 * BYN }), '+10.00 BYN на вклад')}>Пополнить на 10 BYN</button>
      </> : <>
        <p className="muted" style={{ marginTop: 6 }}>Отзывный вклад от 10 BYN. С 14 лет можно открыть самостоятельно.</p>
        <button className="btn" style={{ marginTop: 12 }} onClick={() => run(() => call('/api/child/deposit', { action: 'open', amount: 10 * BYN }), 'Вклад открыт')}>Открыть вклад</button>
      </>}
    </div>
    {o.me.goals.map(g => <GoalCard key={g.id} o={o} id={g.id} />)}
    <FamilyGoalCard o={o} />
    {o.me.settings.perms.goals && <button className="btn" onClick={() => sheet(c => <NewGoalSheet close={c} />)}><Icon name="plus" size={20} /> Новая цель</button>}
  </div></>;
}

export function TeenGrowth() {
  const o = useChild();
  if (!o) return <Loading />;
  const lv = levelOf(o.me.xp);
  return <><PlainTop title="Путь к 18" right={<span className="tag" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13 }}><Coin />{o.me.coins}</span>} />
    <div className="page tight">
      <div className="card"><h3>Уровни самостоятельности</h3><p className="muted" style={{ margin: '4px 0 14px' }}>Каждый уровень предлагает родителю дать тебе больше свободы.</p>
        {LEVELS.map(l => <div key={l.n} className={`pstep ${l.n < lv.n ? 'done' : l.n === lv.n ? 'cur' : ''}`}><div className="n">{l.n}</div><div><b style={{ fontWeight: 600 }}>{l.title}</b><br /><small>{l.perk}</small></div></div>)}
        <div className="pstep"><div className="n">18</div><div><b style={{ fontWeight: 600 }}>Взрослый Moby</b><br /><small>Карта переоформляется на тебя, копилки, вклад и Манички сохраняются. 3 месяца пакета «Шоппер» бесплатно</small></div></div>
      </div>
      <LearnBlock o={o} />
    </div></>;
}
