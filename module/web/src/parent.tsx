// Moby родителя: главная и «Продукты» как в приложении, плюс раздел «Семья».
import { useEffect, useRef, useState } from 'react';
import { BYN, CARD_COLORS, CARD_TYPES, CAT_KEYS, MAX_CARDS, PERM_KEYS, PRESETS, SETTING_LABELS, TARIFFS, groupOf, levelOf, nextLevel, type PresetKey } from '../../server/src/content';
import type { AgeGroup, CardType, ChildDetail, ChildRequest, ChildSettings, FamilyPlan, JoinRequest, ParentOverview, ParentTask, SettingPath, Tariff, Task } from '../../server/src/types';
import { Icon } from './icons';
import { fmt, fmtPhone, plural, toKop, useData, useDevice, when, years, initial } from './lib';
import {
  useDragScroll,
  Act, AmountField, BankCard, BankLocked, Bar, CardCarousel, CardStatus, CardTypePicker, Chev, Fold, GroupTag, InviteQr, Kava, OpsList, PermissionToggles,
  PlainTop, Row, RowIcon, SetRow, Stepper, Swatches, Toggle, TopBar, cardIcon, mainCard, useBusy,
} from './ui';

const useOverview = () => useData<ParentOverview>('/api/parent/overview').data;

// ---------- главная ----------
export function ParentHome() {
  const o = useOverview();
  const { push, sheet, toast, call } = useDevice();
  const [hide, setHide] = useState(false);
  const carousel = useDragScroll<HTMLDivElement>(!!o);
  // При первом входе после обновления коротко рассказываем о «Семье», дальше — только точки входа
  const introShown = useRef(false);
  useEffect(() => {
    if (!o || o.introSeen || introShown.current) return;
    introShown.current = true;
    call('/api/parent/intro-seen', {}).catch(() => {});
    sheet(close => <WhatsNew hasKids={o.children.length > 0} close={close} onOpen={() => { close(); push(o.children.length ? 'family' : 'onboard'); }} />);
  }, [o, call, sheet, push]);
  if (!o) return <div className="loading">Загрузка…</div>;
  const pending = o.requests.filter(r => r.status === 'pending');
  const soon = () => toast('Этот раздел Moby не входит в модуль «Семья»');
  const familySub = o.children.length
    ? `${o.children.map(c => c.name).join(', ')}${pending.length ? ` · ${pending.length} ${plural(pending.length, 'запрос', 'запроса', 'запросов')}` : ''}`
    : 'Новое: карта ребёнку с 7 лет и вход в Moby';
  return <>
    <div className="hero">
      <div className="hero-top"><div className="ava"><Icon name="user" size={28} />{pending.length > 0 && <span className="badge">{pending.length}</span>}</div><div className="hero-name">{o.parent.name}</div></div>
      <div className="chips"><span className="chip">ШОППЕР</span><span className="chip">{o.parent.cardMask}</span><Icon name="info" size={22} /></div>
      <div className="bal-row"><div className="bal">{hide ? '**** BYN' : fmt(o.parent.balance)}</div>
        <button className="iconbtn" onClick={() => setHide(!hide)} aria-label={hide ? 'Показать баланс' : 'Скрыть баланс'}><Icon name={hide ? 'eye' : 'eye-off'} size={30} sw={1.6} /></button></div>
      <div className="actions">
        <Act icon="topup" label="Пополнить" onClick={soon} />
        <Act icon="transfer" label="Перевести" onClick={() => sheet(close => <TopupSheet o={o} close={close} />)} />
        <Act icon="pay" label="Оплатить" onClick={soon} />
      </div>
    </div>
    <div className="body">
      <div className="hist">
        <button className="hbtn" onClick={soon} aria-label="История операций"><Icon name="history" size={30} /></button>
        <div className="hcar" ref={carousel}>
          {o.parent.ops.map(op => (
            <div className="hop" key={op.id}>
              <div className="ic sq"><Icon name={op.amount > 0 ? 'topup' : 'upload'} size={24} /><span className="clock"><Icon name="clock" size={14} /></span></div>
              <div className="tx"><b className="ellipsis">{op.title}</b><small className="ellipsis">ШОППЕР</small></div>
              <span className={`amt ${op.amount > 0 ? 'plus' : ''}`}>{op.amount > 0 ? '+' : ''}{fmt(op.amount)}</span>
            </div>
          ))}
        </div>
      </div>
      <button className="family-entry press" onClick={() => (o.children.length ? push('family') : push('onboard'))}>
        <div className="ic"><Icon name="users" size={24} />{pending.length > 0 && <span className="badge">{pending.length}</span>}</div>
        <div className="tx"><b>Семья</b><small className="ellipsis">{familySub}</small></div><Chev />
      </button>
      <button className="mbanner press" onClick={soon}><b>ОБМЕННИК MOBY</b><span>Обмен валют по выгодному курсу</span></button>
      <button className="mbanner press" onClick={soon}><b>ПАКЕТ УСЛУГ</b><span>Оформите МТкарту, чтобы получать <strong>дополнительные бонусы</strong></span><em>Оформить карту <Icon name="chevron-right" size={16} /></em></button>
      <button className="card addcard press" onClick={soon}><div className="ic sq" style={{ width: 56, height: 56 }}><Icon name="card" size={30} /></div>Добавить карту</button>
    </div>
  </>;
}

export function ParentProducts() {
  const o = useOverview();
  const { push, sheet, toast } = useDevice();
  const soon = () => toast('Этот раздел Moby не входит в модуль «Семья»');
  const family = () => (o?.children.length ? push('family') : push('onboard'));
  return <>
    <div className="page" style={{ paddingTop: 56, paddingBottom: 120 }}>
      <div className="promo"><div style={{ flex: 1 }}><h2>Семья в Moby</h2><p>Карта ребёнку с 7 лет, свой вход в Moby, лимиты и копилки. Пакет «Старт» — 0 BYN.</p>
        <button className="btn white" style={{ width: 'auto', padding: '10px 18px', minHeight: 0 }} onClick={() => push('onboard')}>Оформить</button></div>
        <div className="mini"><span>Moby</span><i /></div></div>
      <div className="dots"><i className="on" />{Array.from({ length: 12 }, (_, i) => <i key={i} />)}</div>
      <button className="prod" onClick={soon}><Icon name="products" size={34} /><div><b>Карты и счета</b><small>Ваши карты и счета</small></div></button>
      <button className="prod" onClick={soon}><Icon name="pay" size={34} /><div><b>Кредиты</b><small>Ваши кредитные продукты</small></div></button>
      <button className="prod" onClick={soon}><Icon name="piggy-bank" size={34} sw={1.5} /><div><b>Вклады</b><small>Ваши сбережения и вклады</small></div></button>
      <button className="prod" onClick={family}><Icon name="users" size={34} sw={1.5} /><div><b>Семья</b><small>Карты детей, лимиты, задания и копилки</small></div></button>
      <div style={{ borderTop: '1px solid var(--line)', margin: '4px 0' }} />
      <button className="prod" onClick={soon}><Icon name="briefcase" size={34} sw={1.5} /><div><b>Заявки на продукты</b><small>Ваши заявки на кредитные и иные продукты банка</small></div></button>
    </div>
    <button className="fab press" onClick={() => sheet(close => <>
      <h2>Оформить</h2>
      <Row icon="users" title="Карту ребёнку" sub="Пакет «Семья»: карта с 7 лет и вход в Moby" onClick={() => { close(); push('onboard'); }} />
      <Row icon="credit-card" title="Карту" sub="МТкарта, Халва и другие" onClick={soon} />
      <Row icon="pay" title="Кредит" sub="Онлайн-заявка" onClick={soon} />
      <Row icon="piggy-bank" title="Вклад" sub="Сбережения в BYN и валюте" onClick={soon} />
    </>)}><Icon name="credit-card" size={28} /> Оформить</button>
  </>;
}

function WhatsNew({ hasKids, close, onOpen }: { hasKids: boolean; close: () => void; onOpen: () => void }) {
  const item = (icon: string, t: string, sub: string) => <li><RowIcon name={icon} /><span><b>{t}</b><small>{sub}</small></span></li>;
  return <>
    <div className="news-art"><i /><i /><b>Новое в Moby:<br />Семья</b></div>
    <ul className="news">
      {item('credit-card', 'Карта ребёнку с 7 лет', 'Браслет, стикер или пластик и свой вход в Moby')}
      {item('sliders-horizontal', 'Вы решаете, что можно', 'Лимиты, категории и подтверждение покупок')}
      {item('piggy-bank', 'Копилки, задания и уроки', 'Ребёнок учится обращаться с деньгами')}
      {item('percent', 'Спецусловия для семьи', 'Кешбэк у партнёров, Манички ×2, +1% к вкладу')}
    </ul>
    <small className="muted">Тарифы и условия покажем при добавлении ребёнка. Раздел всегда на главной: «Семья».</small>
    <button className="btn" onClick={onOpen}>{hasKids ? 'Открыть «Семью»' : 'Добавить ребёнка'}</button>
    <button className="btn ghost" onClick={close}>Позже</button>
  </>;
}

export const ParentChat = () => <>
  <TopBar title="Чат" right={<span style={{ color: 'var(--blue)' }}><Icon name="search" size={26} /></span>} />
  <div className="page" style={{ background: '#fff', minHeight: '100%' }}><div className="empty" style={{ paddingTop: 200 }}>Отправьте сообщение, чтобы начать чат</div></div>
</>;

export function ParentMore() {
  const { push, toast, logout } = useDevice();
  const soon = () => toast('Этот раздел Moby не входит в модуль «Семья»');
  const items: [string, string, () => void][] = [
    ['settings', 'Настройки', () => push('settings')], ['user', 'Персональные данные', soon], ['file-text', 'Документы', soon],
    ['users', 'Семья и дети', () => push('family')], ['bell', 'Уведомления', soon], ['coins', 'Манички. Вход в программу приятностей', soon],
    ['circle-dollar-sign', 'Обменник Moby', soon], ['map-pin', 'Банк на карте', soon], ['info', 'О Банке', soon], ['shield', 'Ваша безопасность', soon],
  ];
  return <div className="page" style={{ paddingTop: 56 }}>
    <div className="menu">{items.map(([ic, t, fn]) => <button key={t} className="item press" onClick={fn}><RowIcon name={ic} tone="dash" /><div className="tx">{t}</div><Chev /></button>)}</div>
    <button className="btn ghost" onClick={logout}>Выйти</button>
  </div>;
}

export function ParentSettings() {
  const o = useOverview();
  const { push, toast, logout } = useDevice();
  const soon = () => toast('Этот раздел Moby не входит в модуль «Семья»');
  return <>
    <TopBar title="Настройки" right={<span style={{ color: 'var(--blue)' }}><Icon name="bell" size={28} /></span>} />
    <div className="page" style={{ background: '#fff', minHeight: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '30px 0 24px' }}>
        <div className="avatar-xl">{o ? initial(o.parent.name) : ''}</div><div style={{ fontSize: 26 }}>{o?.parent.name}</div><div className="muted">+375 (29) ••• ••-••</div>
      </div>
      <button className="srow" onClick={soon}>Переводы по номеру телефона <Chev /></button>
      <button className="srow" onClick={() => push('family')}>Семья и дети <Chev /></button>
      <div className="srow">Тёмная тема <Toggle on={false} label="Тёмная тема" onChange={soon} /></div>
      <button className="srow" onClick={soon}>Изменить смарт-код <Chev /></button>
      <button className="srow" onClick={soon}>Изменить Email <Chev /></button>
      <div className="srow">Запрет скриншотов <Toggle on={false} label="Запрет скриншотов" onChange={soon} /></div>
      <button className="srow" style={{ color: 'var(--red)' }} onClick={logout}>Выйти</button>
    </div>
  </>;
}

// ---------- раздел «Семья» ----------
const REQ_LABEL: Record<ChildRequest['type'], string> = {
  money: 'Просит деньги', perm: 'Просит доступ', card: 'Просит карту', purchase: 'Покупка ждёт подтверждения',
  limit: 'Просит увеличить лимит', level: 'Новый уровень', task: 'Задание выполнено', goal: 'Просит поддержать копилку',
  proposal: 'Предлагает задание',
};

function RequestItem({ r, o, showName = true }: { r: ChildRequest; o: ParentOverview; showName?: boolean }) {
  const { run, call } = useDevice();
  const [busy, wrap] = useBusy();
  const c = o.children.find(x => x.id === r.childId);
  if (!c) return null;
  const resolve = (approve: boolean) => wrap(() => run(() => call(`/api/parent/requests/${r.id}`, { approve }), approve ? 'Одобрено' : 'Отклонено. Ребёнок увидит ответ в Moby'));
  return (
    <div className="req">
      <div className="req-h">
        {showName && <Kava c={c} />}
        <div className="tx"><small>{showName ? `${c.name} · ` : ''}{when(r.createdAt)}</small><b>{REQ_LABEL[r.type]}</b>{r.type !== 'money' && <small>{r.summary}</small>}</div>
        {r.amount != null && <span className="req-sum">{fmt(r.amount)}</span>}
      </div>
      {r.reason && <div className="reason">{r.reason}</div>}
      <div className="btns">
        <button className="btn red" disabled={busy} onClick={() => resolve(false)}>Отклонить</button>
        <button className="btn" disabled={busy} onClick={() => resolve(true)}>{r.type === 'level' ? 'Расширить' : r.type === 'money' || r.type === 'task' ? 'Перевести' : 'Одобрить'}</button>
      </div>
    </div>
  );
}

type Consents = { legalRep: boolean; personalData: boolean; terms: boolean; marketing: boolean };
const NO_CONSENTS: Consents = { legalRep: false, personalData: false, terms: false, marketing: false };
const consentsOk = (c: Consents) => c.legalRep && c.personalData && c.terms;
function ConsentChecks({ value, onChange, group }: { value: Consents; onChange: (c: Consents) => void; group: AgeGroup | null }) {
  const ck = (k: keyof Consents, t: string, s: string) => (
    <button className={`check ${value[k] ? 'on' : ''}`} role="checkbox" aria-checked={value[k]} onClick={() => onChange({ ...value, [k]: !value[k] })}>
      <span className="box">{value[k] && <Icon name="check" size={16} sw={3} />}</span><span>{t}<small>{s}</small></span>
    </button>);
  return <div className="card" style={{ padding: '6px 16px' }}>
    {ck('legalRep', 'Я законный представитель ребёнка', 'Данные сверяются через МСИ')}
    {ck('personalData', 'Согласие на обработку персональных данных ребёнка', 'Закон РБ № 99-З. Данные ребёнка не передаются партнёрам')}
    {ck('terms', group === 'kid' ? 'Выпуск дополнительной карты к моему счёту' : 'Согласие на открытие счёта подростку', 'Условия пакета «Семья»')}
    {ck('marketing', 'Предложения партнёров для ребёнка', 'Необязательно. Только образование, спорт и досуг')}
  </div>;
}

function JoinItem({ j }: { j: JoinRequest }) {
  const { run, call, sheet } = useDevice();
  const [busy, wrap] = useBusy();
  return <div className="req">
    <div className="req-h"><div className="ic"><Icon name="user-plus" size={22} /></div>
      <div className="tx"><small>По номеру {fmtPhone(j.phone)} · {when(j.createdAt)}</small><b>{j.name}, {j.age} {years(j.age)}, просится в семью</b></div></div>
    <div className="btns">
      <button className="btn red" disabled={busy} onClick={() => wrap(() => run(() => call(`/api/parent/join-requests/${j.id}`, { approve: false }), 'Заявка отклонена'))}>Отклонить</button>
      <button className="btn" onClick={() => sheet(close => <JoinApproveSheet j={j} close={close} />)}>Принять</button>
    </div>
  </div>;
}

function JoinApproveSheet({ j, close }: { j: JoinRequest; close: () => void }) {
  const { run, call } = useDevice();
  const [consents, setConsents] = useState<Consents>(NO_CONSENTS);
  const [preset, setPreset] = useState<PresetKey>('normal');
  const [busy, wrap] = useBusy();
  return <>
    <h2>{j.name} в семье</h2>
    <p className="muted">С 14 лет подросток открывает счёт сам, но нужно ваше письменное согласие (ст. 26 ГК РБ). Сразу выпустим виртуальную карту, физическую закажете потом.</p>
    <ConsentChecks value={consents} onChange={setConsents} group="teen" />
    <div className="seg">{(Object.keys(PRESETS.teen) as PresetKey[]).map(k => <button key={k} className={preset === k ? 'on' : ''} onClick={() => setPreset(k)}>{PRESETS.teen[k].label}</button>)}</div>
    <button className="btn" disabled={busy || !consentsOk(consents)} onClick={() => wrap(async () => {
      if (await run(() => call(`/api/parent/join-requests/${j.id}`, { approve: true, consents, preset }), `${j.name} в семье и уже может войти в Moby`)) close();
    })}>Подписать и принять</button>
  </>;
}

const isFirstMonth = (p: FamilyPlan) => Date.now() - Date.parse(p.since) < 30 * 864e5;
function PlanBar({ plan, onClick }: { plan: FamilyPlan; onClick?: () => void }) {
  const t = TARIFFS[plan.tariff];
  const waiver = TARIFFS.plus.waiverSpend;
  const left = waiver - plan.spendMonth;
  return <button className="planbar press" onClick={onClick} style={{ width: '100%', textAlign: 'left' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b>Пакет «{t.title}»</b><b style={{ color: 'var(--mt-blue)' }}>{t.price ? `${fmt(t.price)} в месяц` : '0 BYN'}</b></div>
    {plan.tariff === 'plus' ? <>
      <Bar value={plan.spendMonth} max={waiver} />
      <small className="muted">{isFirstMonth(plan) ? `Первый месяц бесплатно. Дальше пакет бесплатный при тратах семьи от ${fmt(waiver)}, сейчас ${fmt(plan.spendMonth)}`
        : left > 0 ? `Траты семьи ${fmt(plan.spendMonth)}. Ещё ${fmt(left)} — и пакет за этот месяц бесплатный` : `Траты семьи ${fmt(plan.spendMonth)}: пакет за этот месяц бесплатный`}</small>
    </> : <small className="muted">Один ребёнок. «Семья+»: до 4 детей, кешбэк 10% у партнёров и спецусловия</small>}
  </button>;
}

function TariffCard({ t, on, onPick, disabled }: { t: Tariff; on: boolean; onPick?: () => void; disabled?: string }) {
  const x = TARIFFS[t];
  return <div className={`plan ${t === 'plus' ? 'plus' : ''} ${on ? 'on' : ''}`}>
    <div className="plan-h"><b>{x.title}</b><span>{x.price ? `${fmt(x.price)} / мес` : '0 BYN'}</span></div>
    {t === 'plus' && <small>Бесплатно, если семья тратит по картам МТБанка от {fmt(TARIFFS.plus.waiverSpend)} в месяц. Первый месяц бесплатно</small>}
    <ul>{x.perks.map(p => <li key={p}><Icon name="check" size={16} sw={2.4} /><span>{p}</span></li>)}</ul>
    {on ? <span className="tag">{onPick ? 'Выбран' : 'Подключён'}</span>
      : disabled ? <small>{disabled}</small>
        : onPick && <button className={`btn ${t === 'plus' ? 'white' : 'ghost'}`} onClick={onPick}>Выбрать</button>}
  </div>;
}

const PARTNERS = [
  { icon: 'pencil', title: 'Канцтовары', sub: 'Школьные товары' },
  { icon: 'clapperboard', title: 'Кинотеатр', sub: 'Билеты и попкорн' },
  { icon: 'coffee', title: 'Кофейня', sub: 'Для подростков 14+' },
];

export function PackageScreen() {
  const o = useOverview();
  const { run, call } = useDevice();
  if (!o) return <><TopBar title="Пакет «Семья»" /><div className="loading">Загрузка…</div></>;
  const choose = (t: Tariff) => run(() => call('/api/parent/plan', { tariff: t }), t === 'plus' ? 'Подключён «Семья+»' : 'Подключён «Семья Старт»');
  const kids = o.children.length;
  return <>
    <TopBar title="Пакет «Семья»" />
    <div className="page">
      <PlanBar plan={o.plan} />
      <TariffCard t="plus" on={o.plan.tariff === 'plus'} onPick={() => choose('plus')} />
      <TariffCard t="start" on={o.plan.tariff === 'start'} onPick={() => choose('start')} disabled={kids > 1 ? `В «Старт» один ребёнок, у вас ${kids}` : undefined} />
      <div className="card"><h3>Кешбэк недели у партнёров</h3>
        <p className="muted" style={{ margin: '4px 0 6px', fontSize: 14 }}>Ребёнок платит у партнёра — в понедельник {Math.round(TARIFFS[o.plan.tariff].cashbackRate * 100)}% трат за неделю возвращаются на его счёт. Кешбэк оплачивает партнёр.</p>
        {PARTNERS.map(p => <Row key={p.title} icon={p.icon} title={p.title} sub={p.sub} right={<span className="partner">Партнёр</span>} />)}
      </div>
      <div className="legal"><Icon name="info" size={18} /><span>Плата за «Семья+» списывается с карты родителя раз в месяц. Не списывается в первый месяц и если семья потратила за прошлый месяц от {fmt(TARIFFS.plus.waiverSpend)}.</span></div>
    </div>
  </>;
}

export function FamilyScreen() {
  const o = useOverview();
  const { push, sheet, run, call } = useDevice();
  if (!o) return <><TopBar title="Семья" /><div className="loading">Загрузка…</div></>;
  const pending = o.requests.filter(r => r.status === 'pending');
  const waiting = pending.length + o.joinRequests.length;
  const g = o.familyGoal;
  return <>
    <TopBar title="Семья" />
    <div className="page">
      {waiting > 0 && <>
        <div className="sec">Ждут ответа · {waiting}</div>
        <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
          {o.joinRequests.map(j => <JoinItem key={j.id} j={j} />)}
          {pending.map(r => <RequestItem key={r.id} r={r} o={o} />)}
        </div>
      </>}
      <div className="sec">Дети</div>
      {o.children.map(c => (
        <button key={c.id} className="kidcard press" onClick={() => push('child', { id: c.id })}>
          <div className="kidline">
            <Kava c={c} />
            <div className="tx"><div className="kidname">{c.name}, {c.age} {years(c.age)}</div></div>
            <b className="amt" style={{ fontSize: 16 }}>{fmt(c.balance)}</b>
          </div>
          <div className="kidmeta">
            <span><GroupTag g={c.group} />{c.joined ? `Уровень ${c.level} · ${c.cards.length} ${plural(c.cards.length, 'карта', 'карты', 'карт')}` : 'Ждём входа'}</span>
            <span>сегодня {fmt(-c.spentToday)}</span>
          </div>
        </button>
      ))}
      <button className="btn ghost" onClick={() => push('onboard')}><Icon name="plus" size={20} /> Добавить ребёнка</button>
      <div className="grid3">
        <button className="tile press" onClick={() => sheet(close => <TopupSheet o={o} close={close} />)}><RowIcon name="transfer" />Перевести</button>
        <button className="tile press" onClick={() => push('tasks')}><RowIcon name="list-checks" />Задания</button>
        <button className="tile press" onClick={() => sheet(close => <NewCardSheet o={o} close={close} />)}><RowIcon name="credit-card" />Новая карта</button>
      </div>
      <PlanBar plan={o.plan} onClick={() => push('package')} />
      <div className="card goal">
        <div className="goal-h"><RowIcon name={g.icon} /><div className="tx"><small className="muted">Семейная цель</small><b>{g.title}</b></div><b>{Math.round(g.saved / g.target * 100)}%</b></div>
        <Bar value={g.saved} max={g.target} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <small className="muted">{fmt(g.saved)} из {fmt(g.target)}, копит вся семья</small>
          <button className="sbtn" onClick={() => run(() => call('/api/family/goal', { amount: 50 * BYN }), '+50.00 BYN в семейную цель')}>+50 BYN</button>
        </div>
      </div>
      <Fold icon="bell" title="Лента семьи" sub={o.feed[0]?.text ?? 'Покупки и успехи детей'}>
        {o.feed.length ? o.feed.slice(0, 12).map(f => <Row key={f.id} title={<span style={{ fontSize: 14.5, fontWeight: 500 }}>{f.text}</span>} sub={when(f.createdAt)}
          right={f.amount ? <span className={`amt ${f.amount > 0 ? 'plus' : ''}`}>{f.amount > 0 ? '+' : ''}{fmt(f.amount)}</span> : undefined} />) : <div className="empty">Здесь появятся покупки и успехи детей</div>}
      </Fold>
    </div>
  </>;
}

// ---------- карточка ребёнка ----------
const onList = (s: ChildSettings, keys: SettingPath[]) => keys.filter(p => { const [g, k] = p.split('.') as ['cats' | 'perms', string]; return (s[g] as Record<string, boolean>)[k]; });

export function ChildScreen({ id }: { id: string }) {
  const { data: c } = useData<ChildDetail>(`/api/parent/children/${id}`);
  const o = useOverview();
  const { back, sheet, run, call, push } = useDevice();
  if (!c || !o) return <div className="loading">Загрузка…</div>;
  const s = c.settings;
  const patch = (body: Partial<Record<keyof ChildSettings, unknown>>, ok?: string) => run(() => call(`/api/parent/children/${id}/settings`, body, 'PATCH'), ok);
  const setPath = (path: SettingPath, v: boolean) => { const [g, k] = path.split('.'); patch({ [g]: { [k]: v } }); };
  const lv = levelOf(c.xp), nx = nextLevel(c.xp);
  const main = mainCard(c.cards);
  const cardAct = (cardId: string, action: string, ok: string) => run(() => call(`/api/cards/${cardId}`, { action }), ok);
  const pending = o.requests.filter(r => r.childId === id && r.status === 'pending');
  const cats = onList(s, CAT_KEYS.map(k => `cats.${k}` as SettingPath));
  const perms = onList(s, PERM_KEYS.map(k => `perms.${k}` as SettingPath));
  const open = c.tasks.filter(t => t.status !== 'paid'), done = c.tasks.filter(t => t.status === 'paid');
  const editTask = (t: Task) => sheet(close => <TaskEditSheet t={t} close={close} />);
  return <>
    <div className="hero" style={{ paddingTop: 50 }}>
      <div className="hero-top"><button className="iconbtn" onClick={back} aria-label="Назад"><Icon name="arrow-left" size={28} /></button><Kava c={c} />
        <div><div className="hero-name">{c.name}, {c.age}</div><div className="hero-sub">{c.group === 'kid' ? 'Дополнительная карта к вашему счёту' : 'Собственный счёт с вашего согласия'}</div></div></div>
      <div className="bal-row"><div className="bal">{fmt(c.balance)}</div></div>
      <div className="actions">
        <Act icon="topup" label="Пополнить" onClick={() => sheet(close => <TopupSheet o={o} close={close} childId={id} />)} />
        <Act icon="list-checks" label="Задание" onClick={() => sheet(close => <TaskSheet o={o} close={close} childId={id} />)} />
        <Act icon="credit-card" label="Новая карта" onClick={() => sheet(close => <NewCardSheet o={o} close={close} childId={id} />)} />
      </div>
    </div>
    <div className="body">
      {!c.joined && c.inviteCode && <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <InviteQr code={c.inviteCode} /><div><b>Ждём первого входа</b>
          <p className="muted" style={{ marginTop: 4 }}>{c.phone ? `Войдёт по номеру ${fmtPhone(c.phone)} или по коду` : 'Код приглашения'}</p>
          <div className="code" style={{ fontSize: 18, textAlign: 'left' }}>{c.inviteCode}</div></div>
      </div>}
      {pending.length > 0 && <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>{pending.map(r => <RequestItem key={r.id} r={r} o={o} showName={false} />)}</div>}
      <div className="card">
        <h3>Сегодня потрачено <span>{fmt(c.spentToday)}</span></h3>
        <div style={{ marginTop: 10 }}><Bar value={c.spentToday} max={s.limits.day} red={c.spentToday >= s.limits.day} /></div>
        <div className="limitline"><span>Лимит в день {fmt(s.limits.day)}</span><span>За месяц {fmt(c.spentMonth)} из {fmt(s.limits.month)}</span></div>
      </div>
      <div className="card"><h3>Задания <button className="link" onClick={() => push('tasks', { childId: id })}>Все</button></h3>
        {open.map(t => <TaskRow key={t.id} t={t} onClick={() => editTask(t)} />)}
        {!open.length && <div className="empty" style={{ padding: '14px 0' }}>Активных заданий нет</div>}
        {done.length > 0 && <small className="muted">Выполнено и оплачено: {done.length}</small>}
        <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => sheet(close => <TaskSheet o={o} close={close} childId={id} />)}><Icon name="plus" size={20} /> Своё задание</button>
      </div>
      <div className="sec">Настройки</div>
      <Fold icon="credit-card" title="Карты" sub={`${c.cards.length} из ${MAX_CARDS}${main ? ` · ${CARD_TYPES[main.type].label.toLowerCase()} •• ${main.last4}` : ''}`}>
        {c.cards.map(card => (
          <div className="row" key={card.id}>
            <div className="ic" style={{ background: card.color, color: '#fff' }}><Icon name={cardIcon(card.type)} size={22} /></div>
            <div className="tx"><b>{CARD_TYPES[card.type].label}</b><small style={{ display: 'flex', gap: 6, alignItems: 'center' }}>•• {card.last4} <CardStatus c={card} /></small></div>
            {card.status === 'delivery' ? <button className="sbtn" onClick={() => cardAct(card.id, 'activate', 'Карта получена и активирована')}>Получена</button>
              : card.status === 'blocked' ? <button className="sbtn" onClick={() => cardAct(card.id, 'unblock', 'Карта снова работает')}>Разблок.</button>
                : <button className="sbtn red" onClick={() => cardAct(card.id, 'block', 'Карта заблокирована')}>Блок</button>}
          </div>
        ))}
        {c.cards.some(x => CARD_TYPES[x.type].physical) && <Row icon="repeat" tone="dash" title="Карта потерялась" sub="Закрыть и перевыпустить; виртуальная карта работает сразу"
          onClick={() => run(() => call(`/api/parent/children/${id}/reissue`, {}), 'Старая карта закрыта, новая придёт через 3–5 дней')} />}
      </Fold>
      <Fold icon="shield-check" title="Что можно покупать" sub={cats.length ? `Можно: ${cats.map(p => SETTING_LABELS[p].title.toLowerCase()).join(', ')}` : 'Только обычные покупки в магазинах'}>
        <PermissionToggles s={s} group={c.group} keys="cats" onChange={setPath} /><BankLocked />
      </Fold>
      <Fold icon="sliders-horizontal" title="Лимиты и подтверждение" sub={`${fmt(s.limits.day)} в день · подтверждать от ${fmt(s.confirmAbove)}`}>
        <SetRow title="В день" sub={`Сегодня потрачено ${fmt(c.spentToday)}`}><Stepper value={s.limits.day} step={5 * BYN} onChange={v => patch({ limits: { day: v } })} /></SetRow>
        <SetRow title="В месяц" sub={`Потрачено ${fmt(c.spentMonth)}`}><Stepper value={s.limits.month} step={50 * BYN} onChange={v => patch({ limits: { month: v } })} /></SetRow>
        <SetRow title="Подтверждать" sub="Покупки дороже этой суммы"><Stepper value={s.confirmAbove} step={5 * BYN} onChange={v => patch({ confirmAbove: v })} /></SetRow>
      </Fold>
      <Fold icon="smartphone" title="Возможности в Moby" sub={`Включено ${perms.length} из ${PERM_KEYS.length}: ${perms.slice(0, 3).map(p => SETTING_LABELS[p].title).join(', ')}${perms.length > 3 ? '…' : ''}`}>
        <PermissionToggles s={s} group={c.group} keys="perms" onChange={setPath} />
        <SetRow title="Кредиты и рассрочка" sub="Недоступны до 18 лет"><Toggle on={false} locked label="Кредиты" /></SetRow>
      </Fold>
      <Fold icon="piggy-bank" title="Карманные деньги и копилки" sub={s.allowance.on ? `${fmt(s.allowance.amount)} каждый понедельник` : 'Автоперевод выключен'}>
        <SetRow title="Каждый понедельник" sub={`Автоперевод с вашей карты ${o.parent.cardMask}`}><Toggle on={s.allowance.on} label="Карманные деньги" onChange={v => patch({ allowance: { on: v } })} /></SetRow>
        <SetRow title="Сумма" sub="В неделю"><Stepper value={s.allowance.amount} step={(c.group === 'kid' ? 1 : 5) * BYN} onChange={v => patch({ allowance: { amount: v } })} /></SetRow>
        <SetRow title="Доплата к копилке +10%" sub="Вы добавляете 10% к каждому взносу"><Toggle on={s.parentBonus} label="Доплата к копилке" onChange={v => patch({ parentBonus: v })} /></SetRow>
        <SetRow title="Сдачу в копилку" sub="Округлять покупки до целых рублей"><Toggle on={s.roundup} label="Сдачу в копилку" onChange={v => patch({ roundup: v })} /></SetRow>
        <button className="btn ghost" onClick={() => run(() => call(`/api/parent/children/${id}/allowance`, {}), `Карманные деньги отправлены: ${fmt(s.allowance.amount)}`)}>Выплатить сейчас</button>
      </Fold>
      <Fold icon="trophy" title="Успехи" sub={`Уровень ${lv.n} «${lv.title}» · уроков ${c.lessons.length} · Маничек ${c.coins}`}>
        <div style={{ margin: '14px 0 6px' }}><Bar value={nx ? c.xp - lv.xp : 1} max={nx ? nx.xp - lv.xp : 1} /></div>
        <small className="muted">{nx ? `${c.xp} из ${nx.xp} опыта до уровня ${nx.n}` : 'Максимальный уровень'}</small>
        {c.goals.map(g => <Row key={g.id} icon={g.icon} title={g.title} sub={`${fmt(g.saved)} из ${fmt(g.target)}`} />)}
        {c.group === 'teen' && <Row icon="briefcase" title={`Заработок: ${fmt(c.income)}`} sub="По ст. 26 ГК РБ подросток сам распоряжается заработком, лимиты на него не действуют" />}
        {c.deposit && <Row icon="landmark" title={`Вклад: ${fmt(c.deposit.amount)}`} sub={`${c.deposit.rate}% годовых`} />}
      </Fold>
      <Fold icon="history" title="Операции" sub={c.ops[0] ? `${c.ops[0].title}, ${fmt(c.ops[0].amount)}` : 'Операций пока нет'}><OpsList ops={c.ops} limit={10} /></Fold>
      <Fold icon="shield" title="Безопасность" sub={s.mobyAccess ? 'Вход в Moby разрешён' : 'Вход в Moby приостановлен'}>
        <SetRow title="Вход в Moby" sub="Если выключить, ребёнок выйдет из приложения, карта продолжит работать"><Toggle on={s.mobyAccess} label="Вход в Moby" onChange={v => patch({ mobyAccess: v }, v ? 'Доступ возвращён' : 'Доступ приостановлен')} /></SetRow>
      </Fold>
    </div>
  </>;
}
function TaskRow({ t, sub, onClick }: { t: Task; sub?: string; onClick: () => void }) {
  return <button className="row" onClick={onClick} aria-label={`Изменить задание «${t.title}»`}>
    <RowIcon name={t.status === 'paid' ? 'check' : t.status === 'review' ? 'clock' : 'list-checks'} />
    <div className="tx"><b>{t.title}</b><small style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{sub ? `${sub} · ` : ''}{fmt(t.reward)} <TaskTag s={t.status} /></small></div>
    <span className="chev edit"><Icon name="pencil" size={18} /></span>
  </button>;
}

/** Изменить или удалить задание. На проверке и оплаченные — только удалить */
function TaskEditSheet({ t, close }: { t: Task; close: () => void }) {
  const { run, call } = useDevice();
  const [title, setTitle] = useState(t.title);
  const [reward, setReward] = useState(String(t.reward / 100));
  const [busy, wrap] = useBusy();
  const editable = t.status === 'open';
  const del = () => wrap(async () => { if (await run(() => call(`/api/parent/tasks/${t.id}`, undefined, 'DELETE'), 'Задание удалено')) close(); });
  return <>
    <h2>{editable ? 'Изменить задание' : t.title}</h2>
    {editable ? <>
      <div className="field"><label>Что нужно сделать</label><input maxLength={60} value={title} onChange={e => setTitle(e.target.value)} /></div>
      <AmountField label="Награда, BYN" value={reward} onChange={setReward} presets={[1, 3, 5, 10]} />
      <button className="btn" disabled={busy || title.trim().length < 2 || toKop(reward) <= 0} onClick={() => wrap(async () => {
        if (await run(() => call(`/api/parent/tasks/${t.id}`, { title: title.trim(), reward: toKop(reward) }, 'PATCH'), 'Задание изменено')) close();
      })}>Сохранить</button>
    </> : <p className="muted">{t.status === 'review' ? `Ребёнок отметил задание выполненным. Принять и перевести ${fmt(t.reward)} можно в «Ждут ответа». Если удалить, награда не будет выплачена.` : `Задание выполнено, награда ${fmt(t.reward)} выплачена. Можно убрать его из списка.`}</p>}
    <button className="btn red" disabled={busy} onClick={del}><Icon name="trash" size={20} /> {t.status === 'paid' ? 'Убрать из списка' : 'Удалить задание'}</button>
  </>;
}

/** Все задания семьи: по детям, с изменением и удалением */
export function TasksScreen({ childId }: { childId?: string }) {
  const o = useOverview();
  const { data: tasks } = useData<ParentTask[]>('/api/parent/tasks');
  const { sheet } = useDevice();
  const [who, setWho] = useState(childId ?? 'all');
  if (!o || !tasks) return <><TopBar title="Задания" /><div className="loading">Загрузка…</div></>;
  const list = tasks.filter(t => who === 'all' || t.childId === who);
  const name = (id: string) => o.children.find(c => c.id === id)?.name ?? '';
  const many = who === 'all' && o.children.length > 1;
  const group = (title: string, items: ParentTask[]) => items.length > 0 && <div className="card"><h3>{title} <span className="muted" style={{ fontWeight: 500 }}>{items.length}</span></h3>
    {items.map(t => <TaskRow key={t.id} t={t} sub={many ? name(t.childId) : undefined} onClick={() => sheet(close => <TaskEditSheet t={t} close={close} />)} />)}</div>;
  const paid = list.filter(t => t.status === 'paid');
  return <>
    <TopBar title="Задания" />
    <div className="page">
      {o.children.length > 1 && <div className="pills">
        <button className={`pill ${who === 'all' ? 'on' : ''}`} onClick={() => setWho('all')}>Все</button>
        {o.children.map(c => <button key={c.id} className={`pill ${who === c.id ? 'on' : ''}`} onClick={() => setWho(c.id)}>{c.name}</button>)}
      </div>}
      <button className="btn" onClick={() => sheet(close => <TaskSheet o={o} close={close} childId={who === 'all' ? undefined : who} />)}><Icon name="plus" size={20} /> Новое задание</button>
      {group('На проверке', list.filter(t => t.status === 'review'))}
      {group('В работе', list.filter(t => t.status === 'open'))}
      {!list.some(t => t.status !== 'paid') && <div className="empty">Активных заданий нет. Придумайте своё или предложите ребёнку придумать</div>}
      {paid.length > 0 && <Fold icon="check" title="Выполнено" sub={`${paid.length} · выплачено ${fmt(paid.reduce((a, t) => a + t.reward, 0))}`}>
        {paid.map(t => <TaskRow key={t.id} t={t} sub={many ? name(t.childId) : undefined} onClick={() => sheet(close => <TaskEditSheet t={t} close={close} />)} />)}
      </Fold>}
      <small className="muted">Нажмите на задание, чтобы изменить текст и награду или удалить его.</small>
    </div>
  </>;
}

export const TaskTag = ({ s }: { s: 'open' | 'review' | 'paid' }) => s === 'paid' ? <span className="tag">Оплачено</span> : s === 'review' ? <span className="tag red">На проверке</span> : <span className="tag navy">В работе</span>;

// ---------- шторки ----------
function ChildPills({ o, value, onChange }: { o: ParentOverview; value: string; onChange: (id: string) => void }) {
  return <div className="pills">{o.children.map(c => <button key={c.id} className={`pill ${c.id === value ? 'on' : ''}`} onClick={() => onChange(c.id)}>{c.name}</button>)}</div>;
}

function TopupSheet({ o, close, childId }: { o: ParentOverview; close: () => void; childId?: string }) {
  const { run, call } = useDevice();
  const [id, setId] = useState(childId ?? o.children[0]?.id);
  const [amount, setAmount] = useState('10');
  const [cardId, setCardId] = useState(o.parent.cards[0]?.id ?? 'main');
  const [busy, wrap] = useBusy();
  if (!id) return <><h2>Перевести</h2><div className="empty">Сначала добавьте ребёнка</div></>;
  const name = o.children.find(c => c.id === id)?.name;
  const card = o.parent.cards.find(c => c.id === cardId)!;
  const sum = toKop(amount);
  return <>
    <h2>Перевести ребёнку</h2>
    <ChildPills o={o} value={id} onChange={setId} />
    <small className="muted">С карты</small>
    <CardCarousel cards={o.parent.cards} value={cardId} onChange={setCardId} />
    <AmountField label="Сумма, BYN" value={amount} onChange={setAmount} presets={[5, 10, 20, 50]} />
    {sum > card.balance ? <small style={{ color: 'var(--red)' }}>На карте {card.mask} недостаточно средств</small> : <small className="muted">Без комиссии, деньги придут сразу</small>}
    <button className="btn" disabled={busy || sum <= 0 || sum > card.balance} onClick={() => wrap(async () => {
      if (await run(() => call(`/api/parent/children/${id}/topup`, { amount: sum, cardId }), `${fmt(sum)} пришло: ${name}`)) close();
    })}>Перевести</button>
  </>;
}

function TaskSheet({ o, close, childId }: { o: ParentOverview; close: () => void; childId?: string }) {
  const { run, call } = useDevice();
  const [id, setId] = useState(childId ?? o.children[0]?.id);
  const [title, setTitle] = useState('');
  const [reward, setReward] = useState('3');
  const [busy, wrap] = useBusy();
  if (!id) return <><h2>Задание</h2><div className="empty">Сначала добавьте ребёнка</div></>;
  return <>
    <h2>Своё задание</h2>
    <ChildPills o={o} value={id} onChange={setId} />
    <div className="field"><label>Что нужно сделать</label><input maxLength={60} placeholder="Напишите своими словами" value={title} onChange={e => setTitle(e.target.value)} /></div>
    <small className="muted">Или возьмите готовое:</small>
    <div className="pills">{['Убрать в комнате', 'Сделать уроки без напоминаний', 'Погулять с собакой', 'Помыть посуду'].map(t => <button key={t} className="pill" onClick={() => setTitle(t)}>{t}</button>)}</div>
    <AmountField label="Награда, BYN" value={reward} onChange={setReward} presets={[1, 3, 5, 10]} />
    <button className="btn" disabled={busy || title.trim().length < 2 || toKop(reward) <= 0} onClick={() => wrap(async () => { if (await run(() => call(`/api/parent/children/${id}/tasks`, { title, reward: toKop(reward) }), 'Задание отправлено')) close(); })}>Отправить задание</button>
  </>;
}

function NewCardSheet({ o, close, childId }: { o: ParentOverview; close: () => void; childId?: string }) {
  const { run, call } = useDevice();
  const [id, setId] = useState(childId ?? o.children[0]?.id);
  const [type, setType] = useState<CardType>('virtual');
  const [color, setColor] = useState(CARD_COLORS[0]);
  const [busy, wrap] = useBusy();
  if (!id) return <><h2>Новая карта</h2><div className="empty">Сначала добавьте ребёнка</div></>;
  const child = o.children.find(c => c.id === id)!;
  const full = child.cards.length >= MAX_CARDS;
  return <>
    <h2>Новая карта</h2>
    <ChildPills o={o} value={id} onChange={setId} />
    {full ? <div className="legal"><Icon name="info" size={18} /><span>У {child.name} уже {MAX_CARDS} карты — это максимум. Закройте одну через «Карта потерялась» или заблокируйте.</span></div> : <>
      <BankCard name={child.name} card={{ type, color, status: 'active', last4: '••••' }} />
      <Swatches value={color} onChange={setColor} />
      <CardTypePicker types={[...TARIFFS[o.plan.tariff].cards]} value={type} onChange={setType} />
      {o.plan.tariff === 'start' && <small className="muted">Браслет и пластиковая карта — в пакете «{TARIFFS.plus.title}».</small>}
      <small className="muted">{CARD_TYPES[type].physical ? 'Доставка в отделение или курьером, 3–5 дней. Выпуск 0 BYN.' : 'Выпускается сразу и появляется в Moby ребёнка. 0 BYN.'} Лимиты и категории общие для всех карт ребёнка.</small>
      <button className="btn" disabled={busy} onClick={() => wrap(async () => { if (await run(() => call(`/api/parent/children/${id}/cards`, { type, color }), CARD_TYPES[type].physical ? 'Карта заказана, доставка 3–5 дней' : 'Виртуальная карта уже в Moby ребёнка')) close(); })}>Выпустить</button>
    </>}
  </>;
}

// ---------- добавление ребёнка ----------
type Step = 'intro' | 'who' | 'consents' | 'plan' | 'card' | 'perms' | 'done';
export function Onboarding() {
  const o = useOverview();
  const { push, tab, run, call, toast } = useDevice();
  const [step, setStep] = useState<Step>('intro');
  const [name, setName] = useState('');
  const [age, setAge] = useState<number | null>(null);
  const [phone, setPhone] = useState('');
  const [consents, setConsents] = useState<Consents>(NO_CONSENTS);
  const [tariff, setTariff] = useState<Tariff | null>(null);
  const [card, setCard] = useState<{ type: Exclude<CardType, 'virtual'>; color: string }>({ type: 'sticker', color: CARD_COLORS[3] });
  const [preset, setPreset] = useState<PresetKey>('normal');
  const [settings, setSettings] = useState<ChildSettings | null>(null);
  const [created, setCreated] = useState<{ childId: string; inviteCode: string; phone: string | null } | null>(null);
  const [busy, wrap] = useBusy();
  if (!o) return <><TopBar title="Добавить ребёнка" /><div className="loading">Загрузка…</div></>;
  const group = age ? groupOf(age) : null;
  const kids = o.children.length;
  // Пакет выбираем, только если текущий не подходит или семья ещё на «Старт»
  const plan: Tariff = tariff ?? (kids >= TARIFFS.start.maxKids ? 'plus' : o.plan.tariff);
  const steps: Step[] = ['intro', 'who', 'consents', ...(o.plan.tariff === 'plus' ? [] : ['plan' as Step]), 'card', 'perms', 'done'];
  const idx = steps.indexOf(step);
  const go = (d: number) => setStep(steps[idx + d]);
  const physical = TARIFFS[plan].cards.filter(t => t !== 'virtual') as Exclude<CardType, 'virtual'>[];

  const pickAge = (a: number) => {
    setAge(a);
    const g = groupOf(a);
    if (g !== group) {
      const p = PRESETS[g][preset];
      setSettings({ limits: { ...p.limits }, confirmAbove: p.confirmAbove, cats: { ...p.cats }, perms: { ...p.perms }, allowance: { on: true, amount: (g === 'kid' ? 10 : 25) * BYN }, parentBonus: g === 'kid', roundup: g === 'kid', mobyAccess: true });
    }
  };
  const applyPreset = (k: PresetKey) => {
    setPreset(k);
    const p = PRESETS[group!][k];
    setSettings(s => s && { ...s, limits: { ...p.limits }, confirmAbove: p.confirmAbove, cats: { ...p.cats }, perms: { ...p.perms } });
  };
  const create = () => wrap(async () => {
    const r = await run(() => call<{ childId: string; inviteCode: string; phone: string | null }>('/api/parent/children',
      { name: name.trim(), age, consents, card, preset, settings, phone: phone.trim() || null, tariff: plan }));
    if (r) { setCreated(r); setStep('done'); toast('Согласия подписаны, карта заказана, виртуальная выпущена'); }
  });

  let body: React.ReactNode = null, cta = 'Далее', ok = true, next = () => go(1);
  if (step === 'intro') {
    body = <>
      <h2 style={{ fontSize: 22 }}>Пакет «Семья»</h2><p className="muted">Всё для финансов ребёнка в вашем Moby. Оформление онлайн, около 3 минут.</p>
      <div className="card">
        <Row icon="credit-card" title="Карта ребёнку с 7 лет" sub="Браслет, стикер или пластик плюс виртуальная карта" />
        <Row icon="smartphone" title="Свой вход в Moby" sub="По коду приглашения или по номеру телефона ребёнка" />
        <Row icon="sliders-horizontal" title="Вы решаете, что можно" sub="Категории, лимиты, подтверждение покупок, блокировка" />
        <Row icon="piggy-bank" title="Копилки, задания и уроки" sub="Карманные деньги, награды за дела, уровни самостоятельности" />
      </div>
      <div className="planbar"><b>Условия</b>
        <small className="muted">«{TARIFFS.start.title}» — 0 BYN, один ребёнок. «{TARIFFS.plus.title}» — {fmt(TARIFFS.plus.price)} в месяц: до 4 детей и спецусловия. Бесплатно, если семья тратит от {fmt(TARIFFS.plus.waiverSpend)} в месяц.</small></div>
      <div className="legal"><Icon name="info" size={18} /><span>До 14 лет понадобятся данные свидетельства о рождении, с 14 лет — паспорт или ID-карта ребёнка.</span></div>
    </>;
    cta = 'Начать';
  } else if (step === 'who') {
    const phoneOk = !phone.trim() || /^\+?375\s?\(?(25|29|33|44)\)?\s?\d{3}-?\d{2}-?\d{2}$/.test(phone.trim().replace(/\s+/g, ' '));
    ok = name.trim().length > 1 && !!age && phoneOk;
    body = <>
      <h2 style={{ fontSize: 22 }}>Кто ваш ребёнок?</h2>
      <div className="field"><label>Имя</label><input value={name} maxLength={20} placeholder="Например, Соня" autoComplete="off" onChange={e => setName(e.target.value)} /></div>
      <div className="field"><label>Возраст</label>
        <div className="pills">{Array.from({ length: 11 }, (_, i) => i + 7).map(a => <button key={a} className={`pill ${age === a ? 'on' : ''}`} style={{ minWidth: 48 }} onClick={() => pickAge(a)}>{a}</button>)}</div></div>
      <div className="field"><label>Телефон ребёнка, если есть</label><input type="tel" inputMode="tel" value={phone} placeholder="+375 (29) 123-45-67" onChange={e => setPhone(e.target.value)} /></div>
      {!phoneOk && <small style={{ color: 'var(--red)' }}>Номер белорусского оператора: +375 25, 29, 33 или 44</small>}
      {group === 'kid' && <div className="choice on"><RowIcon name="smile" tone="red" /><span><b>«Первая карта», 7–13 лет</b><small>Карта оформляется как дополнительная к вашему счёту, договор заключаете вы: до 14 лет ребёнок сам совершает только мелкие бытовые сделки (ст. 25 ГК РБ).</small></span></div>}
      {group === 'teen' && <div className="choice on"><RowIcon name="user" /><span><b>«Свой счёт», 14–17 лет</b><small>Счёт и карта на имя подростка с вашего письменного согласия. Заработком и вкладом подросток распоряжается сам (ст. 26 ГК РБ).</small></span></div>}
    </>;
  } else if (step === 'consents') {
    ok = consentsOk(consents);
    body = <>
      <h2 style={{ fontSize: 22 }}>Согласия</h2><p className="muted">Подписываются в приложении смарт-кодом, приходить в банк не нужно.</p>
      <ConsentChecks value={consents} onChange={setConsents} group={group} />
    </>;
    cta = 'Подписать';
  } else if (step === 'plan') {
    body = <>
      <h2 style={{ fontSize: 22 }}>Выберите пакет</h2><p className="muted">Поменять можно в любой момент в разделе «Семья».</p>
      <TariffCard t="plus" on={plan === 'plus'} onPick={() => setTariff('plus')} />
      <TariffCard t="start" on={plan === 'start'} onPick={() => setTariff('start')} disabled={kids >= TARIFFS.start.maxKids ? 'В «Старт» один ребёнок: для второго нужен «Семья+»' : undefined} />
    </>;
    next = () => { if (!physical.includes(card.type)) setCard({ ...card, type: physical[0] }); go(1); };
  } else if (step === 'card') {
    body = <>
      <h2 style={{ fontSize: 22 }}>Карта для {name}</h2>
      <BankCard name={name} card={{ type: card.type, color: card.color, status: 'active', last4: '••••' }} />
      <Swatches value={card.color} onChange={color => setCard({ ...card, color })} />
      <CardTypePicker types={physical} value={card.type} onChange={t => setCard({ ...card, type: t as typeof card.type })} />
      <div className="legal"><Icon name="smartphone" size={18} /><span>Виртуальная карта выпускается сразу: ребёнок сможет платить телефоном, пока физическая карта в пути.</span></div>
    </>;
  } else if (step === 'perms' && settings && group) {
    const setPath = (path: SettingPath, v: boolean) => { const [g, k] = path.split('.') as ['cats' | 'perms', string]; setSettings({ ...settings, [g]: { ...settings[g], [k]: v } }); };
    body = <>
      <h2 style={{ fontSize: 22 }}>Что можно {name}</h2><p className="muted">Выберите режим. Детали можно поправить сейчас или потом.</p>
      <div className="seg">{(Object.keys(PRESETS[group]) as PresetKey[]).map(k => <button key={k} className={preset === k ? 'on' : ''} onClick={() => applyPreset(k)}>{PRESETS[group][k].label}</button>)}</div>
      <Fold icon="shield-check" title="Покупки" sub="Онлайн, игры, наличные, кафе"><PermissionToggles s={settings} group={group} keys="cats" onChange={setPath} /><BankLocked /></Fold>
      <Fold icon="sliders-horizontal" title="Лимиты и карманные" sub={`${fmt(settings.limits.day)} в день · ${fmt(settings.allowance.amount)} в неделю`}>
        <SetRow title="В день"><Stepper value={settings.limits.day} step={5 * BYN} onChange={v => setSettings({ ...settings, limits: { ...settings.limits, day: v, month: Math.max(settings.limits.month, v) } })} /></SetRow>
        <SetRow title="Подтверждать от"><Stepper value={settings.confirmAbove} step={5 * BYN} onChange={v => setSettings({ ...settings, confirmAbove: v })} /></SetRow>
        <SetRow title="Карманные в неделю"><Stepper value={settings.allowance.amount} step={(group === 'kid' ? 1 : 5) * BYN} onChange={v => setSettings({ ...settings, allowance: { ...settings.allowance, amount: v } })} /></SetRow>
      </Fold>
      <Fold icon="smartphone" title="Возможности в Moby" sub="QR КРОК, копилки, ЕРИП, переводы"><PermissionToggles s={settings} group={group} keys="perms" onChange={setPath} /></Fold>
    </>;
    cta = 'Оформить'; next = create;
  } else if (step === 'done' && created) {
    body = <>
      <h2 style={{ fontSize: 22 }}>Вход в Moby для {name}</h2>
      {created.phone && <div className="choice on"><RowIcon name="phone" /><span><b>По номеру {fmtPhone(created.phone)}</b><small>Отправили SMS со ссылкой. {name} устанавливает Moby, входит по номеру и коду из SMS, придумывает смарт-код.</small></span></div>}
      <p className="muted">{created.phone ? 'Или по коду приглашения:' : 'Ребёнок устанавливает Moby на свой телефон, выбирает «Я ребёнок», сканирует код и придумывает смарт-код.'}</p>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <InviteQr code={created.inviteCode} /><div className="code">{created.inviteCode}</div><small className="muted">Код действует один раз</small>
      </div>
      <div className="legal"><Icon name="shield" size={18} /><span>На демо-стенде выберите {name} над правым телефоном{created.phone ? ' или «По номеру»' : ''}.</span></div>
    </>;
    cta = 'Готово'; next = () => { tab('home'); push('family'); push('child', { id: created.childId }); };
  }
  return <>
    <TopBar title={step === 'intro' ? 'Семья в Moby' : 'Добавить ребёнка'} />
    <div className="steps">{steps.map((st, i) => <i key={st} className={i <= idx ? 'on' : ''} />)}</div>
    <div className="page">{body}<button className="btn" disabled={!ok || busy} onClick={next}>{cta}</button></div>
  </>;
}
