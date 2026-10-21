// Один телефон: вход по смарт-коду, затем Moby родителя или ребёнка.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Device as DeviceInfo } from '../../server/src/types';
import {
  Fraud, KidGoals, KidHome, KidTasks, Memory, MobyPlay, PathScreen, Pay, PriceGame, Quiz,
  ChildMore, ChildSettings, TeenAnalytics, TeenEarn, TeenHome, TeenPayments, TeenSavings, TeenSubs,
} from './child';
import { Icon, MobyLogo } from './icons';
import { api, ApiError, DeviceProvider, useDevice, type Route } from './lib';
import { ChildScreen, FamilyScreen, Onboarding, PackageScreen, TasksScreen, ParentChat, ParentHome, ParentMore, ParentProducts, ParentSettings } from './parent';
import { Sheet } from './ui';

const tokenKey = (userId: string) => `moby-family:token:${userId}`;
const readToken = (userId: string) => { try { return localStorage.getItem(tokenKey(userId)); } catch { return null; } };
export const writeToken = (userId: string, t: string | null) => { try { t ? localStorage.setItem(tokenKey(userId), t) : localStorage.removeItem(tokenKey(userId)); } catch { /* приватный режим */ } };

export function Device({ info }: { info: DeviceInfo }) {
  const [token, setToken] = useState<string | null>(() => readToken(info.userId));
  const logout = useCallback(() => { writeToken(info.userId, null); setToken(null); }, [info.userId]);
  const login = (t: string) => { writeToken(info.userId, t); setToken(t); };
  return (
    <div className="phone"><div className="screen">
      {token ? <Shell key={token} info={info} token={token} onLogout={logout} />
        : info.joined ? <SmartCode info={info} onToken={login} /> : <Join info={info} onToken={login} />}
    </div></div>
  );
}

function Keypad({ onDigit, onDelete }: { onDigit: (d: string) => void; onDelete: () => void }) {
  return <div className="keypad">
    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => <button key={d} onClick={() => onDigit(d)}>{d}</button>)}
    <span className="blank" /><button onClick={() => onDigit('0')}>0</button>
    <button className="blank" onClick={onDelete} aria-label="Стереть" style={{ color: 'var(--blue)' }}><Icon name="arrow-left" size={30} /></button>
  </div>;
}

function usePin(onComplete: (pin: string) => Promise<boolean>) {
  // Значение держим в ref: цифры могут прийти быстрее, чем React перерисует экран
  const ref = useRef('');
  const [pin, setPinState] = useState('');
  const [err, setErr] = useState(false);
  const setPin = (v: string) => { ref.current = v; setPinState(v); };
  const digit = async (d: string) => {
    if (ref.current.length >= 4) return;
    const next = ref.current + d;
    setPin(next); setErr(false);
    if (next.length === 4) { const ok = await onComplete(next); if (!ok) { setErr(true); setTimeout(() => setPin(''), 400); } }
  };
  return { pin, err, digit, del: () => setPin(ref.current.slice(0, -1)), reset: () => setPin('') };
}
const Dots = ({ n, err }: { n: number; err: boolean }) => <div className={`pinDots ${err ? 'err' : ''}`}>{[0, 1, 2, 3].map(i => <i key={i} className={i < n ? 'on' : ''} />)}</div>;
const Brand = () => <div className="brand"><MobyLogo active size={34} /> Moby</div>;

function SmartCode({ info, onToken }: { info: DeviceInfo; onToken: (t: string) => void }) {
  const [msg, setMsg] = useState('');
  const p = usePin(async pin => {
    try { const r = await api<{ token: string }>('/api/auth/login', { body: { userId: info.userId, pin } }); onToken(r.token); return true; }
    catch (e) { setMsg(e instanceof ApiError ? e.message : 'Нет связи'); return false; }
  });
  return <div className="login">
    <Brand />
    <h2>Введите смарт-код</h2>
    <div className="who">{info.name}{info.role === 'child' ? (info.group === 'kid' ? ' · детский режим' : ' · 14+') : ''}</div>
    <Dots n={p.pin.length} err={p.err} />
    <div className="hint">{msg ? <span style={{ color: 'var(--red)' }}>{msg}</span> : <>Демо-стенд: смарт-код 1111 <button onClick={() => '1111'.split('').forEach((d, i) => setTimeout(() => p.digit(d), i * 60))}>Ввести</button></>}</div>
    <Keypad onDigit={p.digit} onDelete={p.del} />
  </div>;
}

function Join({ info, onToken }: { info: DeviceInfo; onToken: (t: string) => void }) {
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'code' | 'pin' | 'repeat'>('code');
  const [first, setFirst] = useState('');
  const [msg, setMsg] = useState('');
  const p = usePin(async pin => {
    if (stage === 'pin') { setFirst(pin); setStage('repeat'); p.reset(); return true; }
    if (pin !== first) { setMsg('Смарт-коды не совпали, придумай заново'); setStage('pin'); return false; }
    try { const r = await api<{ token: string }>('/api/auth/join', { body: { code, pin } }); onToken(r.token); return true; }
    catch (e) { setMsg(e instanceof ApiError ? e.message : 'Нет связи'); setStage('code'); return false; }
  });
  if (stage === 'code') return <div className="login">
    <Brand />
    <h2 style={{ marginTop: 50 }}>Я ребёнок</h2>
    <p className="who">Попроси родителя показать QR-код или код приглашения из раздела «Семья»</p>
    <div className="field" style={{ marginTop: 24 }}><label>Код приглашения</label><input value={code} placeholder="MOBY-0000" onChange={e => setCode(e.target.value.toUpperCase())} /></div>
    {info.inviteCode && <div className="hint" style={{ marginTop: 10 }}>Демо-стенд: код {info.name} — {info.inviteCode} <button onClick={() => setCode(info.inviteCode!)}>Вставить</button></div>}
    {msg && <div className="hint" style={{ color: 'var(--red)' }}>{msg}</div>}
    <button className="btn" style={{ marginTop: 'auto' }} disabled={!/^MOBY-\d{4}$/.test(code.trim())} onClick={() => { setMsg(''); setStage('pin'); }}>Продолжить</button>
  </div>;
  return <div className="login">
    <Brand />
    <h2>{stage === 'pin' ? 'Придумай смарт-код' : 'Повтори смарт-код'}</h2>
    <div className="who">{msg ? <span style={{ color: 'var(--red)' }}>{msg}</span> : 'Четыре цифры, которые знаешь только ты'}</div>
    <Dots n={p.pin.length} err={p.err} />
    <Keypad onDigit={p.digit} onDelete={p.del} />
  </div>;
}

const errText = (e: unknown) => (e instanceof ApiError ? e.message : 'Нет связи');

/**
 * Новый телефон: вход по номеру. Если номер уже есть в Moby (родитель добавил ребёнка по номеру) —
 * код из SMS и новый смарт-код. Если нет — подросток с 14 лет сам просится в семью по номеру родителя.
 */
export function PhoneDevice({ onDone }: { onDone: (userId: string, token: string, role: string) => void }) {
  const [stage, setStage] = useState<'phone' | 'code' | 'about' | 'pin' | 'repeat' | 'wait'>('phone');
  const [phone, setPhone] = useState('+375 ');
  const [sms, setSms] = useState<{ known: boolean; demoCode?: string } | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState<number | null>(null);
  const [parentPhone, setParentPhone] = useState('+375 ');
  const [first, setFirst] = useState('');
  const [ticket, setTicket] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const start = async () => {
    try { setSms(await api('/api/auth/phone/start', { body: { phone } })); setCode(''); setMsg(''); setStage('code'); }
    catch (e) { setMsg(errText(e)); }
  };
  const p = usePin(async pin => {
    if (stage === 'pin') { setFirst(pin); setStage('repeat'); p.reset(); return true; }
    if (pin !== first) { setMsg('Смарт-коды не совпали, придумай заново'); setStage('pin'); return false; }
    try {
      if (sms?.known) { const r = await api('/api/auth/phone/verify', { body: { phone, code, pin } }); onDone(r.userId, r.token, r.role); }
      else { const r = await api('/api/auth/join-request', { body: { phone, code, parentPhone, name: name.trim(), age, pin } }); setTicket(r.ticket); setStage('wait'); }
      return true;
    } catch (e) {
      setMsg(errText(e));
      setStage(e instanceof ApiError && e.code === 'bad_otp' ? 'code' : sms?.known ? 'code' : 'about');
      return false;
    }
  });
  // Ждём решения родителя: как только он примет заявку, входим без повторного смарт-кода
  useEffect(() => {
    if (stage !== 'wait' || !ticket) return;
    const t = setInterval(async () => {
      try {
        const r = await api('/api/auth/join-status', { body: { ticket } });
        if (r.status === 'approved') onDone(r.userId, r.token, 'child');
        if (r.status === 'declined') { setMsg('Родитель отклонил заявку'); setStage('phone'); }
      } catch { /* повторим */ }
    }, 1500);
    return () => clearInterval(t);
  }, [stage, ticket, onDone]);

  const phoneOk = /^\+?375\s?\(?(25|29|33|44)\)?\s?\d{3}-?\d{2}-?\d{2}$/.test(phone.trim());
  return <div className="phone"><div className="screen">
    {stage === 'phone' && <div className="login">
      <Brand />
      <h2 style={{ marginTop: 50 }}>Вход по номеру</h2>
      <p className="who">Номер, на который придёт SMS с кодом</p>
      <div className="field" style={{ marginTop: 24 }}><label>Телефон</label><input type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} /></div>
      <div className="hint" style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>Демо:
        <button onClick={() => setPhone('+375 29 765-43-21')}>Ребёнок 1</button>
        <button onClick={() => setPhone('+375 44 777-88-99')}>Новый подросток</button></div>
      {msg && <div className="hint" style={{ color: 'var(--red)' }}>{msg}</div>}
      <button className="btn" style={{ marginTop: 'auto' }} disabled={!phoneOk} onClick={start}>Получить код</button>
    </div>}
    {stage === 'code' && sms && <div className="login">
      <Brand />
      <h2 style={{ marginTop: 50 }}>Код из SMS</h2>
      <p className="who">Отправили на {phone.trim()}</p>
      {sms.demoCode && <div className="demo-sms" style={{ marginTop: 16 }}><Icon name="message-circle" size={18} /><span>Демо-SMS: код <b>{sms.demoCode}</b></span></div>}
      <div className="field" style={{ marginTop: 16 }}><label>Код</label><input inputMode="numeric" maxLength={4} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /></div>
      {msg && <div className="hint" style={{ color: 'var(--red)' }}>{msg}</div>}
      <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setStage('phone')}>Другой номер</button>
      <button className="btn" style={{ marginTop: 'auto' }} disabled={code.length !== 4} onClick={() => { setMsg(''); setStage(sms.known ? 'pin' : 'about'); }}>Продолжить</button>
    </div>}
    {stage === 'about' && <div className="login" style={{ overflowY: 'auto' }}>
      <Brand />
      <h2 style={{ marginTop: 30 }}>Попроситься в семью</h2>
      <p className="who">Номера нет в Moby. С 14 лет можно отправить заявку родителю, он подтвердит в своём Moby</p>
      <div className="field" style={{ marginTop: 16 }}><label>Как тебя зовут</label><input maxLength={20} value={name} onChange={e => setName(e.target.value)} /></div>
      <div className="field"><label>Возраст</label><div className="pills">{[12, 13, 14, 15, 16, 17].map(a => <button key={a} className={`pill ${age === a ? 'on' : ''}`} onClick={() => setAge(a)}>{a}</button>)}</div></div>
      {age !== null && age < 14 && <div className="hint" style={{ color: 'var(--red)' }}>До 14 лет к семье подключает родитель (ст. 25 ГК РБ). Попроси его добавить тебя в Moby по твоему номеру</div>}
      <div className="field"><label>Телефон родителя</label><input type="tel" inputMode="tel" value={parentPhone} onChange={e => setParentPhone(e.target.value)} /></div>
      <div className="hint">Демо: <button onClick={() => setParentPhone('+375 29 123-45-67')}>номер родителя</button></div>
      {msg && <div className="hint" style={{ color: 'var(--red)' }}>{msg}</div>}
      <button className="btn" style={{ marginTop: 'auto' }} disabled={name.trim().length < 2 || !age || age < 14 || parentPhone.replace(/\D/g, '').length < 12} onClick={() => { setMsg(''); setStage('pin'); }}>Далее</button>
    </div>}
    {(stage === 'pin' || stage === 'repeat') && <div className="login">
      <Brand />
      <h2>{stage === 'pin' ? 'Придумай смарт-код' : 'Повтори смарт-код'}</h2>
      <div className="who">{msg ? <span style={{ color: 'var(--red)' }}>{msg}</span> : 'Четыре цифры, которые знаешь только ты'}</div>
      <Dots n={p.pin.length} err={p.err} />
      <Keypad onDigit={p.digit} onDelete={p.del} />
    </div>}
    {stage === 'wait' && <div className="login">
      <Brand />
      <div className="result" style={{ marginTop: 60 }}><div className="big wait"><Icon name="clock" size={34} sw={2.2} /></div>
        <h2>Заявка у родителя</h2><p>Как только родитель примет её в разделе «Семья», ты войдёшь в Moby автоматически.</p></div>
    </div>}
  </div></div>;
}

type Screen = (r: Route) => ReactNode;
const PARENT: Record<string, Screen> = {
  home: () => <ParentHome />, products: () => <ParentProducts />, chat: () => <ParentChat />, more: () => <ParentMore />,
  settings: () => <ParentSettings />, family: () => <FamilyScreen />, child: r => <ChildScreen id={r.params!.id} />, onboard: () => <Onboarding />,
  package: () => <PackageScreen />, tasks: r => <TasksScreen childId={r.params?.childId} />,
};
const KID: Record<string, Screen> = {
  home: () => <KidHome />, goals: () => <KidGoals />, tasks: () => <KidTasks />, play: () => <MobyPlay />, memory: () => <Memory />, price: () => <PriceGame />,
  more: () => <ChildMore />, settings: () => <ChildSettings />,
  quiz: r => <Quiz id={r.params!.id} />, fraud: () => <Fraud />, pay: r => <Pay method={r.params?.method} />,
};
const TEEN: Record<string, Screen> = {
  home: () => <TeenHome />, savings: () => <TeenSavings />, play: () => <MobyPlay />, more: () => <ChildMore />,
  payments: () => <TeenPayments />, path: () => <PathScreen />, settings: () => <ChildSettings />, memory: () => <Memory />, price: () => <PriceGame />,
  quiz: r => <Quiz id={r.params!.id} />, fraud: () => <Fraud />, pay: r => <Pay method={r.params?.method} />,
  subs: () => <TeenSubs />, earn: () => <TeenEarn />, analytics: () => <TeenAnalytics />,
};
const TABS: Record<'parent' | 'kid' | 'teen', [string, string, string][]> = {
  parent: [['home', 'Главная', 'moby'], ['products', 'Продукты', 'products'], ['chat', 'Чат', 'chat'], ['more', 'Ещё', 'more']],
  kid: [['home', 'Главная', 'moby'], ['goals', 'Копилки', 'piggy-bank'], ['tasks', 'Задания', 'list-checks'], ['play', 'MobyPlay', 'gamepad-2'], ['more', 'Ещё', 'more']],
  teen: [['home', 'Главная', 'moby'], ['savings', 'Накопления', 'piggy-bank'], ['play', 'MobyPlay', 'gamepad-2'], ['more', 'Ещё', 'more']],
};

function Shell({ info, token, onLogout }: { info: DeviceInfo; token: string; onLogout: () => void }) {
  const kind = info.role === 'parent' ? 'parent' : info.group === 'kid' ? 'kid' : 'teen';
  const screens = kind === 'parent' ? PARENT : kind === 'kid' ? KID : TEEN;
  return <DeviceProvider token={token} userId={info.userId} onLogout={onLogout} root="home">
    {({ route, depth, sheet, toast, closeSheet }) => {
      const light = (depth === 1 && route.name === 'home') || route.name === 'child';
      return <>
        <div className={`statusbar ${light ? 'light' : ''}`}><span>13:08</span><span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="wifi" size={16} /><span style={{ border: '1.5px solid currentColor', borderRadius: 4, padding: '0 4px', fontSize: 11 }}>71</span></span></div>
        <div className={`scroll ${depth === 1 ? 'tabs' : ''}`} key={`${route.name}-${depth}`}>{(screens[route.name] ?? screens.home)(route)}</div>
        {depth === 1 && <TabBar kind={kind} current={route.name} />}
        {sheet && <Sheet onClose={closeSheet}>{sheet.render(closeSheet)}</Sheet>}
        {toast && <div className={`toast ${toast.err ? 'err' : ''}`} role="status">{toast.text}</div>}
      </>;
    }}
  </DeviceProvider>;
}

function TabBar({ kind, current }: { kind: 'parent' | 'kid' | 'teen'; current: string }) {
  const { tab } = useDevice();
  return <nav className={`tabbar ${TABS[kind].length > 4 ? 'five' : ''}`}>{TABS[kind].map(([name, label, ic]) => (
    <button key={name} className={`tab ${current === name ? 'on' : ''}`} onClick={() => tab(name)}>
      {ic === 'moby' ? <MobyLogo active={current === name} /> : <Icon name={ic} size={28} sw={1.5} />}{label}
      {kind === 'parent' && name === 'more' && <span className="badge">10</span>}
    </button>
  ))}</nav>;
}
