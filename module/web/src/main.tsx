// Демо-стенд: телефон родителя и телефон ребёнка рядом, данные общие и обновляются вживую.
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Device as DeviceInfo } from '../../server/src/types';
import { Device } from './device';
import { api } from './lib';
import './styles.css';

function Stand() {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [childId, setChildId] = useState<string | null>(null);
  const [mobile, setMobile] = useState<'parent' | 'child'>('parent');
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () => api<DeviceInfo[]>('/api/auth/devices').then(d => { if (alive) setDevices(d); }).catch(() => {});
    load();
    const t = setInterval(load, 3000);
    return () => { alive = false; clearInterval(t); };
  }, [epoch]);

  const parent = devices.find(d => d.role === 'parent');
  const kids = devices.filter(d => d.role === 'child');
  const current = kids.find(k => k.userId === childId) ?? kids[0];

  const reset = async (empty: boolean) => {
    await api('/api/demo/reset', { body: { empty } });
    try { Object.keys(localStorage).filter(k => k.startsWith('moby-family:token:')).forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }
    setChildId(null); setEpoch(e => e + 1);
  };

  return <>
    <div className="mobile-switch">
      <button className={mobile === 'parent' ? 'on' : ''} onClick={() => setMobile('parent')}>Родитель</button>
      <button className={mobile === 'child' ? 'on' : ''} onClick={() => setMobile('child')}>Ребёнок</button>
    </div>
    <div className="stand" key={epoch}>
      <aside className="side">
        <h1>Семья в Moby</h1>
        <p>Модуль детско-семейного банкинга МТБанка. Слева телефон родителя, справа — ребёнка. Всё работает через настоящий API: запрос ребёнка сразу появляется у родителя.</p>
        <div className="box"><b>Попробуйте</b><ol>
          <li>Ребёнок → «Оплатить» → «Донат в игре» → попросить доступ. Родитель → «Семья» → одобрить.</li>
          <li>Ребёнок → «Магазин игрушек»: покупку дороже лимита подтверждает родитель.</li>
          <li>Ребёнок → «Я потерял карту»: оплата пройдёт виртуальной картой или по QR КРОК.</li>
          <li>Родитель → «Семья» → «Добавить ребёнка», затем войдите за него по коду приглашения.</li>
          <li>Подросток → «Платежи»: ЕРИП, перевод другу, QR КРОК.</li>
        </ol></div>
        <div className="reset"><button onClick={() => reset(false)}>Сбросить демо</button><button onClick={() => reset(true)}>Семья без детей</button></div>
        <small>Смарт-код всех демо-пользователей: 1111. Данные хранятся в SQLite на сервере.</small>
      </aside>
      <div className={`slot ${mobile === 'parent' ? '' : 'hidden'}`}>
        <div className="slot-head"><span className="lbl">Телефон родителя</span>{parent && <span className="chipbtn on">{parent.name}</span>}</div>
        {parent && <Device key={parent.userId} info={parent} />}
      </div>
      <div className={`slot ${mobile === 'child' ? '' : 'hidden'}`}>
        <div className="slot-head"><span className="lbl">Телефон ребёнка</span>
          {kids.map(k => <button key={k.userId} className={`chipbtn ${current?.userId === k.userId ? 'on' : ''}`} onClick={() => setChildId(k.userId)}>
            {k.name} <small>{k.group === 'kid' ? '7–13' : '14–17'}{k.joined ? '' : ' · новый'}</small></button>)}
        </div>
        {current ? <Device key={current.userId + String(current.joined)} info={current} />
          : <div className="phone"><div className="screen"><div className="loading" style={{ padding: 30, textAlign: 'center' }}>Детей пока нет. Добавьте ребёнка в Moby родителя.</div></div></div>}
      </div>
    </div>
  </>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><Stand /></StrictMode>);
