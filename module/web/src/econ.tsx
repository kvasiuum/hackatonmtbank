// Экономика модуля для жюри: допущения можно менять, окупаемость пересчитывается сразу.
import { useState } from 'react';
import { ECON_DEFAULTS, TARIFFS, economics, type EconInputs } from '../../server/src/content';
import { Icon } from './icons';

const FIELDS: [keyof EconInputs, string][] = [
  ['families', 'Семей за первый год'],
  ['cac', 'Привлечение семьи, BYN (реклама в Moby, приветственный бонус)'],
  ['cardCost', 'Выпуск и доставка физической карты, BYN'],
  ['kidsPerFamily', 'Детей в семье'],
  ['kidSpend', 'Траты ребёнка в месяц, BYN'],
  ['parentExtraSpend', 'Новые траты родителя в МТБанке, BYN/мес'],
  ['interchange', 'Доход с оборота по картам, %'],
  ['balances', 'Средние остатки семьи, BYN'],
  ['margin', 'Маржа на остатки, % годовых'],
  ['plusShare', 'Доля семей на «Семья+», %'],
  ['plusPaying', 'Из них платят за пакет, %'],
  ['partnerShare', 'Доля трат детей у партнёров, %'],
  ['partnerFee', 'Комиссия партнёра банку, %'],
  ['bonusRate', 'Манички за счёт банка, % трат детей'],
  ['opex', 'Обслуживание семьи, BYN/мес'],
  ['devCost', 'Разработка и запуск, BYN'],
];

const n = (v: number, d = 2) => v.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });

export function Economics({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState<EconInputs>(ECON_DEFAULTS);
  const e = economics(i);
  const rows: [string, number][] = [
    ['Доход с оборота по картам', e.revenue.interchange],
    ['Процентный доход на остатки', e.revenue.balances],
    [`Плата за «${TARIFFS.plus.title}»`, e.revenue.tariff],
    ['Комиссия партнёров', e.revenue.partners],
    ['Манички и бонусы', -e.bonuses],
    ['Обслуживание', -e.opex],
  ];
  return (
    <div className="econ-modal" role="dialog" aria-modal="true" aria-label="Экономика модуля">
      <div className="econ-panel">
        <div className="econ-top"><h2>Экономика модуля</h2><button className="iconbtn" onClick={onClose} aria-label="Закрыть"><Icon name="x" size={24} /></button></div>
        <div className="econ">
          <div className="kpi">
            <div><b>{Number.isFinite(e.paybackMonths) ? `${n(e.paybackMonths, 1)} мес.` : 'не окупается'}</b><small>Окупаемость семьи с учётом разработки</small></div>
            <div><b>{n(e.contribution)} BYN</b><small>Прибыль с семьи в месяц</small></div>
            <div><b>{n(e.acquisition)} BYN</b><small>Привлечение семьи с картой</small></div>
            <div><b>{n(e.yearProfit / 1000, 0)} тыс. BYN</b><small>Результат первого года по всем семьям</small></div>
          </div>
          <table><tbody>
            {rows.map(([t, v]) => <tr key={t}><td>{t}</td><td style={{ color: v < 0 ? 'var(--mt-red)' : undefined }}>{v < 0 ? '−' : '+'}{n(Math.abs(v))}</td></tr>)}
            <tr><td><b>Итого с семьи в месяц, BYN</b></td><td>{n(e.contribution)}</td></tr>
          </tbody></table>
          <small className="muted">Кешбэк недели у партнёров платит партнёр из маркетингового бюджета, банк получает комиссию. Пакет «{TARIFFS.plus.title}» бесплатен при тратах семьи от 400 BYN, поэтому плата — стимул перенести траты в МТБанк, а не основной доход.</small>
          {FIELDS.map(([k, label]) => (
            <label key={k}>{label}<input type="number" inputMode="decimal" value={i[k]} onChange={ev => setI({ ...i, [k]: Number(ev.target.value) || 0 })} /></label>
          ))}
          <button className="btn ghost" onClick={() => setI(ECON_DEFAULTS)}>Вернуть допущения</button>
        </div>
      </div>
    </div>
  );
}
