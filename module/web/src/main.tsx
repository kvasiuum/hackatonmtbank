// Демо-стенд: телефон родителя и телефон ребёнка рядом, данные общие и обновляются вживую.
import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Device as DeviceInfo } from '../../server/src/types';
import { Device, PhoneDevice, writeToken } from './device';
import { Economics } from './econ';
import { Icon } from './icons';
import { api, backHandlers, LOCAL } from './lib';
import './fonts';
import './styles.css';

/** Запущено внутри Android-приложения (см. android/), а не в браузере */
const IN_APP = navigator.userAgent.includes('MobyFamilyApp');

function Stand() {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [childId, setChildId] = useState<string | null>(null);
  const [mobile, setMobile] = useState<'parent' | 'child'>('parent');
  const [epoch, setEpoch] = useState(0);
  const [tick, setTick] = useState(0);
  const [econ, setEcon] = useState(false);
  const PHONE = '__phone';

  useEffect(() => {
    let alive = true;
    const load = () => api<DeviceInfo[]>('/api/auth/devices').then(d => { if (alive) setDevices(d); }).catch(() => {});
    load();
    const t = setInterval(load, 3000);
    return () => { alive = false; clearInterval(t); };
  }, [epoch, tick]);

  const parent = devices.find(d => d.role === 'parent');
  const kids = devices.filter(d => d.role === 'child');
  const byPhone = childId === PHONE;
  const current = byPhone ? undefined : kids.find(k => k.userId === childId) ?? kids[0];
  // Вход по номеру завершён: кладём токен этому пользователю и показываем его телефон
  const phoneDone = useCallback((userId: string, token: string, role: string) => {
    writeToken(userId, token);
    if (role === 'parent') { setMobile('parent'); setChildId(null); } else setChildId(userId);
    setTick(t => t + 1);
  }, []);

  // Системная кнопка «Назад» Android: закрыть шторку или вернуться на экран назад в видимом телефоне
  useEffect(() => {
    const active = mobile === 'parent' ? parent?.userId : current?.userId;
    (window as any).mobyBack = () => (active ? backHandlers.get(active)?.() ?? false : false);
  }, [mobile, parent?.userId, current?.userId]);

  const reset = async (empty: boolean) => {
    await api('/api/demo/reset', { body: { empty } });
    try { Object.keys(localStorage).filter(k => k.startsWith('moby-family:token:')).forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }
    setChildId(null); setEpoch(e => e + 1);
  };

  return <div className="app-root">
    <div className="mobile-switch">
      <button className={mobile === 'parent' ? 'on' : ''} onClick={() => setMobile('parent')}>Родитель</button>
      {kids.map((k, i) => (
        <button key={k.userId} className={mobile === 'child' && current?.userId === k.userId ? 'on' : ''} title={k.name}
          onClick={() => { setChildId(k.userId); setMobile('child'); }}>Ребёнок {i + 1}</button>
      ))}
      <button className={mobile === 'child' && byPhone ? 'on' : ''} onClick={() => { setChildId(PHONE); setMobile('child'); }}>По номеру</button>
      <button onClick={() => setEcon(true)}>Экономика</button>
      <button className="reset-mini" onClick={() => { if (confirm('Сбросить демо-данные к исходным?')) reset(false); }} aria-label="Сбросить демо">↺</button>
    </div>
    <div className="stand" key={epoch}>
      <aside className="side">
        <h1>Семья в Moby</h1>
        <p>Модуль детско-семейного банкинга МТБанка. Слева телефон родителя, справа — ребёнка. Всё работает через настоящий API: запрос ребёнка сразу появляется у родителя.</p>
        <div className="box"><b>Попробуйте</b><ol>
          <li>Ребёнок → «Оплатить» → «Донат в игре» → попросить доступ. Родитель → «Семья» → одобрить.</li>
          <li>Ребёнок → «Магазин игрушек»: покупку дороже лимита подтверждает родитель.</li>
          <li>Ребёнок → «Мои карты» → «Я потерял карту»: оплата пройдёт виртуальной картой или по QR КРОК.</li>
          <li>Ребёнок → «Задания» → «Предложить своё»; родитель видит сумму и одобряет.</li>
          <li>«По номеру» → «Новый подросток»: заявка в семью, родитель принимает её в «Семье».</li>
          <li>«Семья без детей»: рассказ о новинке, выбор пакета и добавление ребёнка.</li>
        </ol></div>
        <button className="econ-btn press" onClick={() => setEcon(true)}><Icon name="calculator" size={18} /> Экономика модуля</button>
        <div className="reset"><button onClick={() => reset(false)}>Сбросить демо</button><button onClick={() => reset(true)}>Семья без детей</button></div>
        <small>Смарт-код всех демо-пользователей: 1111. {LOCAL ? 'Данные хранятся на этом устройстве.' : 'Данные хранятся в SQLite на сервере.'}</small>
      </aside>
      <div className={`slot ${mobile === 'parent' ? '' : 'hidden'}`}>
        <div className="slot-head">{parent && <span className="chipbtn on" title={parent.name}>Родитель</span>}</div>
        {parent && <Device key={parent.userId} info={parent} />}
      </div>
      <div className={`slot ${mobile === 'child' ? '' : 'hidden'}`}>
        <div className="slot-head">
          {kids.map((k, i) => <button key={k.userId} className={`chipbtn ${current?.userId === k.userId ? 'on' : ''}`} title={k.name} onClick={() => setChildId(k.userId)}>
            Ребёнок {i + 1}</button>)}
          <button className={`chipbtn ${byPhone ? 'on' : ''}`} onClick={() => setChildId(PHONE)}>По номеру</button>
        </div>
        {byPhone ? <PhoneDevice key={epoch} onDone={phoneDone} /> : current ? <Device key={current.userId + String(current.joined)} info={current} />
          : <div className="phone"><div className="screen"><div className="loading" style={{ padding: 30, textAlign: 'center' }}>Детей пока нет. Добавьте ребёнка в Moby родителя.</div></div></div>}
      </div>
    </div>
    {econ && <Economics onClose={() => setEcon(false)} />}
  </div>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><Stand /></StrictMode>);

// Автономная сборка ставится на Android как приложение и работает офлайн
if (LOCAL && !IN_APP && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
