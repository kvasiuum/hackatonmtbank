// Moby родителя: главная и «Продукты» как в приложении, плюс раздел «Семья».
import { useState } from 'react';
import { BYN, CARD_COLORS, CARD_TYPES, MAX_CARDS, PRESETS, groupOf, levelOf, nextLevel, type PresetKey } from '../../server/src/content';
import type { CardType, ChildDetail, ChildRequest, ChildSettings, ParentOverview, SettingPath } from '../../server/src/types';
import { Icon } from './icons';
import { fmt, plural, toKop, useData, useDevice, when, years } from './lib';
import {
  Act, AmountField, BankCard, BankLocked, Bar, CardStatus, CardTypePicker, Chev, GroupTag, InviteQr, Kava, OpsList, PermissionToggles,
  PlainTop, Row, RowIcon, SetRow, Stepper, Swatches, Toggle, TopBar, cardIcon, mainCard, useBusy,
} from './ui';

const useOverview = () => useData<ParentOverview>('/api/parent/overview').data;

// ---------- главная ----------
export function ParentHome() {
  const o = useOverview();
  const { push, sheet, toast } = useDevice();
  const [hide, setHide] = useState(false);
  if (!o) return <div className="loading">Загрузка…</div>;
  const pending = o.requests.filter(r => r.status === 'pending');
  const soon = () => toast('Этот раздел Moby не входит в модуль «Семья»');
  const familySub = o.children.length
    ? `${o.children.map(c => c.name).join(', ')}${pending.length ? ` · ${pending.length} ${plural(pending.length, 'запрос', 'запроса', 'запросов')}` : ''}`
    : 'Карта ребёнку с 7 лет и вход в Moby';
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
        <div className="hcar">
          {o.parent.ops.map(op => (
            <div className="hop" key={op.id}>
              <div className="ic sq"><Icon name={op.amount > 0 ? 'topup' : 'upload'} size={24} /><span className="clock"><Icon name="clock" size={14} /></span></div>
              <div className="tx"><b className="ellipsis">{op.title}</b><small className="ellipsis">ШОППЕР · {when(op.createdAt)}</small></div>
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
      <div className="promo"><div style={{ flex: 1 }}><h2>Семья в Moby</h2><p>Карта ребёнку с 7 лет, свой вход в Moby, лимиты и копилки. Обслуживание 0 BYN.</p>
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
        <div className="avatar-xl">{o?.parent.name[0]}</div><div style={{ fontSize: 26 }}>{o?.parent.name}</div><div className="muted">+375 (29) ••• ••-••</div>
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
};

function RequestItem({ r, o }: { r: ChildRequest; o: ParentOverview }) {
  const { run, call } = useDevice();
  const [busy, wrap] = useBusy();
  const c = o.children.find(x => x.id === r.childId);
  if (!c) return null;
  const resolve = (approve: boolean) => wrap(() => run(() => call(`/api/parent/requests/${r.id}`, { approve }), approve ? 'Одобрено' : 'Отклонено. Ребёнок увидит ответ в Moby'));
  return (
    <div className="req">
      <div className="kidline"><Kava c={c} /><div className="tx"><small>{c.name} · {REQ_LABEL[r.type]} · {when(r.createdAt)}</small><b>{r.summary}</b></div></div>
      {r.reason && <div className="reason">{r.reason}</div>}
      <div className="btns">
        <button className="btn red" disabled={busy} onClick={() => resolve(false)}>Отклонить</button>
        <button className="btn" disabled={busy} onClick={() => resolve(true)}>{r.type === 'level' ? 'Расширить' : 'Одобрить'}</button>
      </div>
    </div>
  );
}

export function FamilyScreen() {
  const o = useOverview();
  const { push, sheet, run, call } = useDevice();
  if (!o) return <><TopBar title="Семья" /><div className="loading">Загрузка…</div></>;
  const pending = o.requests.filter(r => r.status === 'pending');
  const history = o.requests.filter(r => r.status !== 'pending').slice(0, 5);
  const g = o.familyGoal;
  return <>
    <TopBar title="Семья" />
    <div className="page">
      {pending.length > 0 && <>
        <div className="sec">Запросы детей · {pending.length}</div>
        <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>{pending.map(r => <RequestItem key={r.id} r={r} o={o} />)}</div>
      </>}
      <div className="sec">Дети</div>
      {o.children.map(c => (
        <button key={c.id} className="kidcard press" onClick={() => push('child', { id: c.id })}>
          <div className="kidline">
            <Kava c={c} />
            <div className="tx"><div className="kidname">{c.name}, {c.age} {years(c.age)} <GroupTag g={c.group} /></div></div>
            <b className="amt" style={{ fontSize: 16 }}>{fmt(c.balance)}</b>
          </div>
          <div className="kidmeta">
            <span>{c.joined ? `Уровень ${c.level} · ${c.cards.length} ${plural(c.cards.length, 'карта', 'карты', 'карт')}` : 'Ждём первого входа в Moby'}</span>
            <span>сегодня {fmt(-c.spentToday)}</span>
          </div>
        </button>
      ))}
      <button className="btn ghost" onClick={() => push('onboard')}><Icon name="plus" size={20} /> Добавить ребёнка</button>
      <div className="grid3">
        <button className="tile press" onClick={() => sheet(close => <TopupSheet o={o} close={close} />)}><RowIcon name="transfer" />Перевести</button>
        <button className="tile press" onClick={() => sheet(close => <TaskSheet o={o} close={close} />)}><RowIcon name="list-checks" />Задание</button>
        <button className="tile press" onClick={() => sheet(close => <NewCardSheet o={o} close={close} />)}><RowIcon name="credit-card" />Новая карта</button>
      </div>
      <div className="card goal">
        <div className="goal-h"><RowIcon name={g.icon} /><div className="tx"><small className="muted">Семейная цель</small><b>{g.title}</b></div><b>{Math.round(g.saved / g.target * 100)}%</b></div>
        <Bar value={g.saved} max={g.target} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <small className="muted">{fmt(g.saved)} из {fmt(g.target)}, копит вся семья</small>
          <button className="sbtn" onClick={() => run(() => call('/api/family/goal', { amount: 50 * BYN }), '+50.00 BYN в семейную цель')}>+50 BYN</button>
        </div>
      </div>
      <div className="card"><h3>Лента семьи</h3>
        {o.feed.length ? o.feed.slice(0, 6).map(f => <Row key={f.id} icon={f.amount ? 'pay' : 'star'} title={<span style={{ fontSize: 14.5 }}>{f.text}</span>} sub={when(f.createdAt)}
          right={f.amount ? <span className={`amt ${f.amount > 0 ? 'plus' : ''}`}>{f.amount > 0 ? '+' : ''}{fmt(f.amount)}</span> : undefined} />) : <div className="empty">Здесь появятся покупки и успехи детей</div>}
      </div>
      {history.length > 0 && <div className="card"><h3>Решённые запросы</h3>
        {history.map(r => { const c = o.children.find(x => x.id === r.childId); return c && <Row key={r.id} title={REQ_LABEL[r.type]} sub={`${c.name} · ${r.summary}`} right={<span className={`tag ${r.status === 'approved' ? '' : 'red'}`}>{r.status === 'approved' ? 'Одобрено' : 'Отклонено'}</span>} />; })}
      </div>}
      <div className="card"><h3>Пакет «Семья»</h3>
        <Row icon="credit-card" title="Детские карты: 0 BYN" sub={`До ${MAX_CARDS} карт у каждого ребёнка`} />
        <Row icon="coins" title="Манички ×2 в детских категориях" sub="Детские товары, аптеки, образование, досуг" />
        <Row icon="piggy-bank" title="+1% к ставке по вкладу родителя" sub="Пока у ребёнка есть активная копилка" />
        <Row icon="shield-check" title="Страхование ребёнка" sub="Несчастный случай и спорт, от 2 BYN в месяц" />
      </div>
    </div>
  </>;
}

// ---------- карточка ребёнка ----------
export function ChildScreen({ id }: { id: string }) {
  const { data: c } = useData<ChildDetail>(`/api/parent/children/${id}`);
  const o = useOverview();
  const { back, sheet, run, call } = useDevice();
  if (!c || !o) return <div className="loading">Загрузка…</div>;
  const s = c.settings;
  const patch = (body: Partial<Record<keyof ChildSettings, unknown>>, ok?: string) => run(() => call(`/api/parent/children/${id}/settings`, body, 'PATCH'), ok);
  const setPath = (path: SettingPath, v: boolean) => { const [g, k] = path.split('.'); patch({ [g]: { [k]: v } }); };
  const lv = levelOf(c.xp), nx = nextLevel(c.xp);
  const main = mainCard(c.cards);
  const cardAct = (cardId: string, action: string, ok: string) => run(() => call(`/api/cards/${cardId}`, { action }), ok);
  return <>
    <div className="hero" style={{ paddingTop: 50 }}>
      <div className="hero-top"><button className="iconbtn" onClick={back} aria-label="Назад"><Icon name="arrow-left" size={28} /></button><Kava c={c} />
        <div><div className="hero-name">{c.name}, {c.age}</div><div className="hero-sub">{c.group === 'kid' ? 'Дополнительная карта к вашему счёту' : 'Собственный счёт с вашего согласия'}</div></div></div>
      <div className="bal-row"><div className="bal">{fmt(c.balance)}</div></div>
      <div className="actions">
        <Act icon="topup" label="Пополнить" onClick={() => sheet(close => <TopupSheet o={o} close={close} childId={id} />)} />
        <Act icon="credit-card" label="Новая карта" onClick={() => sheet(close => <NewCardSheet o={o} close={close} childId={id} />)} />
        <Act icon="list-checks" label="Задание" onClick={() => sheet(close => <TaskSheet o={o} close={close} childId={id} />)} />
      </div>
    </div>
    <div className="body">
      {!c.joined && c.inviteCode && <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <InviteQr code={c.inviteCode} /><div><b>Ждём первого входа</b><p className="muted" style={{ marginTop: 4 }}>Код приглашения</p><div className="code" style={{ fontSize: 18, textAlign: 'left' }}>{c.inviteCode}</div></div>
      </div>}
      {main && <BankCard name={c.name} card={main} />}
      <div className="card"><h3>Карты <span className="muted" style={{ fontWeight: 500 }}>{c.cards.length} из {MAX_CARDS}</span></h3>
        {c.cards.map(card => (
          <div className="row" key={card.id}>
            <div className="ic" style={{ background: card.color, color: '#fff' }}><Icon name={cardIcon(card.type)} size={22} /></div>
            <div className="tx"><b>{CARD_TYPES[card.type].label}</b><small style={{ display: 'flex', gap: 6, alignItems: 'center' }}>•• {card.last4} <CardStatus c={card} /></small></div>
            {card.status === 'delivery' ? <button className="sbtn" onClick={() => cardAct(card.id, 'activate', 'Карта получена и активирована')}>Получена</button>
              : card.status === 'blocked' ? <button className="sbtn" onClick={() => cardAct(card.id, 'unblock', 'Карта снова работает')}>Разблок.</button>
                : <button className="sbtn red" onClick={() => cardAct(card.id, 'block', 'Карта заблокирована')}>Блок</button>}
          </div>
        ))}
        {c.cards.length < MAX_CARDS && <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => sheet(close => <NewCardSheet o={o} close={close} childId={id} />)}><Icon name="plus" size={20} /> Выпустить карту</button>}
      </div>
      <div className="card">
        <h3>Прогресс <span className={`tag ${c.group === 'kid' ? 'red' : ''}`}>Уровень {lv.n}: {lv.title}</span></h3>
        <div style={{ margin: '12px 0 6px' }}><Bar value={nx ? c.xp - lv.xp : 1} max={nx ? nx.xp - lv.xp : 1} /></div>
        <small className="muted">{nx ? `${c.xp} из ${nx.xp} опыта до уровня ${nx.n}` : 'Максимальный уровень'} · уроков: {c.lessons.length} · Маничек: {c.coins}</small>
      </div>
      <div className="card"><h3>Что можно покупать</h3><PermissionToggles s={s} group={c.group} keys="cats" onChange={setPath} /><BankLocked /></div>
      <div className="card"><h3>Лимиты и подтверждение</h3>
        <SetRow title="В день" sub={`Сегодня потрачено ${fmt(c.spentToday)}`}><Stepper value={s.limits.day} step={5 * BYN} onChange={v => patch({ limits: { day: v } })} /></SetRow>
        <SetRow title="В месяц" sub={`Потрачено ${fmt(c.spentMonth)}`}><Stepper value={s.limits.month} step={50 * BYN} onChange={v => patch({ limits: { month: v } })} /></SetRow>
        <SetRow title="Подтверждать" sub="Покупки дороже этой суммы"><Stepper value={s.confirmAbove} step={5 * BYN} onChange={v => patch({ confirmAbove: v })} /></SetRow>
      </div>
      <div className="card"><h3>Что доступно в Moby</h3><PermissionToggles s={s} group={c.group} keys="perms" onChange={setPath} />
        <SetRow title="Кредиты и рассрочка" sub="Недоступны до 18 лет"><Toggle on={false} locked label="Кредиты" /></SetRow></div>
      <div className="card"><h3>Карманные деньги</h3>
        <SetRow title="Каждый понедельник" sub={`Автоперевод с вашей карты ${o.parent.cardMask}`}><Toggle on={s.allowance.on} label="Карманные деньги" onChange={v => patch({ allowance: { on: v } })} /></SetRow>
        <SetRow title="Сумма" sub="В неделю"><Stepper value={s.allowance.amount} step={(c.group === 'kid' ? 1 : 5) * BYN} onChange={v => patch({ allowance: { amount: v } })} /></SetRow>
        <SetRow title="Доплата к копилке +10%" sub="Вы добавляете 10% к каждому взносу"><Toggle on={s.parentBonus} label="Доплата к копилке" onChange={v => patch({ parentBonus: v })} /></SetRow>
        <SetRow title="Сдачу в копилку" sub="Округлять покупки до целых рублей"><Toggle on={s.roundup} label="Сдачу в копилку" onChange={v => patch({ roundup: v })} /></SetRow>
        <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => run(() => call(`/api/parent/children/${id}/allowance`, {}), `Карманные деньги отправлены: ${fmt(s.allowance.amount)}`)}>Выплатить сейчас</button>
      </div>
      <div className="card"><h3>Задания</h3>
        {c.tasks.length ? c.tasks.map(t => <Row key={t.id} icon="list-checks" title={t.title} sub={`Награда ${fmt(t.reward)}`} right={<TaskTag s={t.status} />} />) : <div className="empty">Заданий пока нет</div>}
        <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => sheet(close => <TaskSheet o={o} close={close} childId={id} />)}><Icon name="plus" size={20} /> Новое задание</button>
      </div>
      {c.group === 'teen' && <div className="card"><h3>Собственные средства</h3>
        <Row title={`Заработок: ${fmt(c.income)}`} sub="По ст. 26 ГК РБ подросток сам распоряжается заработком, лимиты на него не действуют" />
        {c.deposit && <Row title={`Вклад: ${fmt(c.deposit.amount)}`} sub={`${c.deposit.rate}% годовых`} />}
      </div>}
      <div className="card"><h3>Операции</h3><OpsList ops={c.ops} limit={8} /></div>
      <div className="card"><h3>Безопасность</h3>
        <SetRow title="Вход в Moby" sub="Если выключить, ребёнок выйдет из приложения, карта продолжит работать"><Toggle on={s.mobyAccess} label="Вход в Moby" onChange={v => patch({ mobyAccess: v }, v ? 'Доступ возвращён' : 'Доступ приостановлен')} /></SetRow>
        {c.cards.some(x => CARD_TYPES[x.type].physical) && <Row icon="repeat" tone="dash" title="Карта потерялась" sub="Закрыть и перевыпустить; виртуальная карта работает сразу"
          onClick={() => run(() => call(`/api/parent/children/${id}/reissue`, {}), 'Старая карта закрыта, новая придёт через 3–5 дней')} />}
      </div>
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
  const [busy, wrap] = useBusy();
  if (!id) return <><h2>Перевести</h2><div className="empty">Сначала добавьте ребёнка</div></>;
  const name = o.children.find(c => c.id === id)?.name;
  return <>
    <h2>Перевести ребёнку</h2>
    <ChildPills o={o} value={id} onChange={setId} />
    <AmountField label="Сумма, BYN" value={amount} onChange={setAmount} presets={[5, 10, 20, 50]} />
    <small className="muted">С карты {o.parent.cardMask}, {fmt(o.parent.balance)}, без комиссии</small>
    <button className="btn" disabled={busy || toKop(amount) <= 0} onClick={() => wrap(async () => { if (await run(() => call(`/api/parent/children/${id}/topup`, { amount: toKop(amount) }), `${fmt(toKop(amount))} пришло: ${name}`)) close(); })}>Перевести</button>
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
    <h2>Новое задание</h2>
    <ChildPills o={o} value={id} onChange={setId} />
    <div className="field"><label>Что нужно сделать</label><input maxLength={60} placeholder="Например, полить цветы" value={title} onChange={e => setTitle(e.target.value)} /></div>
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
      <CardTypePicker types={['virtual', 'bracelet', 'sticker', 'plastic']} value={type} onChange={setType} />
      <small className="muted">{CARD_TYPES[type].physical ? 'Доставка в отделение или курьером, 3–5 дней. Выпуск 0 BYN.' : 'Выпускается сразу и появляется в Moby ребёнка. 0 BYN.'} Лимиты и категории общие для всех карт ребёнка.</small>
      <button className="btn" disabled={busy} onClick={() => wrap(async () => { if (await run(() => call(`/api/parent/children/${id}/cards`, { type, color }), CARD_TYPES[type].physical ? 'Карта заказана, доставка 3–5 дней' : 'Виртуальная карта уже в Moby ребёнка')) close(); })}>Выпустить</button>
    </>}
  </>;
}

// ---------- добавление ребёнка ----------
const STEPS = 6;
export function Onboarding() {
  const { push, tab, run, call, toast } = useDevice();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [age, setAge] = useState<number | null>(null);
  const [consents, setConsents] = useState({ legalRep: false, personalData: false, terms: false, marketing: false });
  const [card, setCard] = useState<{ type: Exclude<CardType, 'virtual'>; color: string }>({ type: 'bracelet', color: CARD_COLORS[3] });
  const [preset, setPreset] = useState<PresetKey>('normal');
  const [settings, setSettings] = useState<ChildSettings | null>(null);
  const [created, setCreated] = useState<{ childId: string; inviteCode: string } | null>(null);
  const [busy, wrap] = useBusy();
  const group = age ? groupOf(age) : null;

  const pickAge = (a: number) => {
    setAge(a);
    const g = groupOf(a);
    if (g !== group) {
      const p = PRESETS[g][preset];
      setSettings({ limits: { ...p.limits }, confirmAbove: p.confirmAbove, cats: { ...p.cats }, perms: { ...p.perms }, allowance: { on: true, amount: (g === 'kid' ? 10 : 25) * BYN }, parentBonus: g === 'kid', roundup: g === 'kid', mobyAccess: true });
      setCard(c => ({ ...c, type: g === 'kid' ? 'bracelet' : 'plastic' }));
    }
  };
  const applyPreset = (k: PresetKey) => {
    setPreset(k);
    const p = PRESETS[group!][k];
    setSettings(s => s && { ...s, limits: { ...p.limits }, confirmAbove: p.confirmAbove, cats: { ...p.cats }, perms: { ...p.perms } });
  };
  const create = () => wrap(async () => {
    const r = await run(() => call<{ childId: string; inviteCode: string }>('/api/parent/children', { name: name.trim(), age, consents, card, preset, settings }));
    if (r) { setCreated(r); setStep(5); toast('Согласия подписаны, карта заказана, виртуальная выпущена'); }
  });

  let body: React.ReactNode = null, cta = 'Далее', ok = true, next = () => setStep(step + 1);
  if (step === 0) {
    body = <>
      <h2 style={{ fontSize: 22 }}>Пакет «Семья»</h2><p className="muted">Всё для финансов ребёнка в вашем Moby. Оформление онлайн, около 3 минут.</p>
      <div className="card">
        <Row icon="credit-card" title="Карта ребёнку с 7 лет" sub="Браслет, стикер или пластик плюс виртуальная карта. 0 BYN" />
        <Row icon="smartphone" title="Свой вход в Moby" sub="Детский или подростковый режим, доступ даёте вы" />
        <Row icon="sliders-horizontal" title="Вы решаете, что можно" sub="Категории, лимиты, подтверждение покупок, блокировка" />
        <Row icon="qr-code" title="Оплата по QR через КРОК" sub="Без карты, со счёта, с вашими лимитами" />
        <Row icon="piggy-bank" title="Копилки, задания и уроки" sub="Карманные деньги, награды за дела, уровни самостоятельности" />
      </div>
      <div className="legal"><Icon name="info" size={18} /><span>До 14 лет понадобятся данные свидетельства о рождении, с 14 лет — паспорт или ID-карта ребёнка.</span></div>
    </>;
    cta = 'Начать';
  } else if (step === 1) {
    ok = name.trim().length > 1 && !!age;
    body = <>
      <h2 style={{ fontSize: 22 }}>Кто ваш ребёнок?</h2>
      <div className="field"><label>Имя</label><input value={name} maxLength={20} placeholder="Например, Соня" autoComplete="off" onChange={e => setName(e.target.value)} /></div>
      <div className="field"><label>Возраст</label>
        <div className="pills">{Array.from({ length: 11 }, (_, i) => i + 7).map(a => <button key={a} className={`pill ${age === a ? 'on' : ''}`} style={{ minWidth: 48 }} onClick={() => pickAge(a)}>{a}</button>)}</div></div>
      {group === 'kid' && <div className="choice on"><RowIcon name="smile" tone="red" /><span><b>«Первая карта», 7–13 лет</b><small>Карта оформляется как дополнительная к вашему счёту, договор заключаете вы: до 14 лет ребёнок сам совершает только мелкие бытовые сделки (ст. 25 ГК РБ).</small></span></div>}
      {group === 'teen' && <div className="choice on"><RowIcon name="user" /><span><b>«Свой счёт», 14–17 лет</b><small>Счёт и карта на имя подростка с вашего письменного согласия. Заработком и вкладом подросток распоряжается сам (ст. 26 ГК РБ).</small></span></div>}
    </>;
  } else if (step === 2) {
    ok = consents.legalRep && consents.personalData && consents.terms;
    const ck = (k: keyof typeof consents, t: string, s: string) => (
      <button className={`check ${consents[k] ? 'on' : ''}`} role="checkbox" aria-checked={consents[k]} onClick={() => setConsents({ ...consents, [k]: !consents[k] })}>
        <span className="box">{consents[k] && <Icon name="check" size={16} sw={3} />}</span><span>{t}<small>{s}</small></span>
      </button>);
    body = <>
      <h2 style={{ fontSize: 22 }}>Согласия</h2><p className="muted">Подписываются в приложении смарт-кодом, приходить в банк не нужно.</p>
      <div className="card" style={{ padding: '6px 16px' }}>
        {ck('legalRep', 'Я законный представитель ребёнка', 'Данные сверяются через МСИ')}
        {ck('personalData', 'Согласие на обработку персональных данных ребёнка', 'Закон РБ № 99-З. Данные ребёнка не передаются партнёрам')}
        {ck('terms', group === 'kid' ? 'Выпуск дополнительной карты к моему счёту' : 'Согласие на открытие счёта подростку', 'Условия пакета «Семья», обслуживание 0 BYN')}
        {ck('marketing', 'Предложения партнёров для ребёнка', 'Необязательно. Только образование, спорт и досуг')}
      </div>
    </>;
    cta = 'Подписать';
  } else if (step === 3) {
    body = <>
      <h2 style={{ fontSize: 22 }}>Карта для {name}</h2>
      <BankCard name={name} card={{ type: card.type, color: card.color, status: 'active', last4: '••••' }} />
      <Swatches value={card.color} onChange={color => setCard({ ...card, color })} />
      <CardTypePicker types={['bracelet', 'sticker', 'plastic']} value={card.type} onChange={t => setCard({ ...card, type: t as typeof card.type })} />
      <div className="legal"><Icon name="smartphone" size={18} /><span>Виртуальная карта выпускается сразу: ребёнок сможет платить телефоном, пока физическая карта в пути.</span></div>
    </>;
  } else if (step === 4 && settings && group) {
    const setPath = (path: SettingPath, v: boolean) => { const [g, k] = path.split('.') as ['cats' | 'perms', string]; setSettings({ ...settings, [g]: { ...settings[g], [k]: v } }); };
    body = <>
      <h2 style={{ fontSize: 22 }}>Что можно {name}</h2><p className="muted">Выберите режим и поправьте детали. Всё меняется в любой момент.</p>
      <div className="seg">{(Object.keys(PRESETS[group]) as PresetKey[]).map(k => <button key={k} className={preset === k ? 'on' : ''} onClick={() => applyPreset(k)}>{PRESETS[group][k].label}</button>)}</div>
      <div className="card"><h3>Покупки</h3><PermissionToggles s={settings} group={group} keys="cats" onChange={setPath} /><BankLocked /></div>
      <div className="card"><h3>Лимиты</h3>
        <SetRow title="В день"><Stepper value={settings.limits.day} step={5 * BYN} onChange={v => setSettings({ ...settings, limits: { ...settings.limits, day: v, month: Math.max(settings.limits.month, v) } })} /></SetRow>
        <SetRow title="Подтверждать от"><Stepper value={settings.confirmAbove} step={5 * BYN} onChange={v => setSettings({ ...settings, confirmAbove: v })} /></SetRow>
        <SetRow title="Карманные в неделю"><Stepper value={settings.allowance.amount} step={(group === 'kid' ? 1 : 5) * BYN} onChange={v => setSettings({ ...settings, allowance: { ...settings.allowance, amount: v } })} /></SetRow>
      </div>
      <div className="card"><h3>Moby</h3><PermissionToggles s={settings} group={group} keys="perms" onChange={setPath} /></div>
    </>;
    cta = 'Оформить'; next = create;
  } else if (step === 5 && created) {
    body = <>
      <h2 style={{ fontSize: 22 }}>Вход в Moby для {name}</h2>
      <p className="muted">Ребёнок устанавливает Moby на свой телефон, выбирает «Я ребёнок», сканирует код и придумывает смарт-код.</p>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <InviteQr code={created.inviteCode} /><div className="code">{created.inviteCode}</div><small className="muted">Код действует один раз</small>
      </div>
      <div className="legal"><Icon name="shield" size={18} /><span>На демо-стенде выберите {name} над правым телефоном и введите этот код.</span></div>
    </>;
    cta = 'Готово'; next = () => { tab('home'); push('family'); push('child', { id: created.childId }); };
  }
  return <>
    <TopBar title={step === 0 ? 'Семья в Moby' : 'Добавить ребёнка'} />
    <div className="steps">{Array.from({ length: STEPS }, (_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
    <div className="page">{body}<button className="btn" disabled={!ok || busy} onClick={next}>{cta}</button></div>
  </>;
}

