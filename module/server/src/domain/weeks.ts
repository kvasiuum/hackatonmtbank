// «Трать меньше — получай скидку»: месяц делится на 4 недели (1–7, 8–14, 15–21, 22–конец),
// каждая неделя сравнивается с предыдущей. Чистые функции, время — по Минску (UTC+3).
const MINSK = 3 * 3600_000;
const DAY = 24 * 3600_000;

/** Потолок скидки за месяц, % */
export const SAVE_CAP = 20;
/** Сколько BYN экономии дают 1% скидки */
export const SAVE_BYN_PER_PERCENT = 10;
export const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

export function monthStartMs(now: number) {
  const d = new Date(now + MINSK);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - MINSK;
}
export function nextMonthMs(monthStart: number) {
  const d = new Date(monthStart + MINSK);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - MINSK;
}
export const monthName = (monthStart: number) => MONTHS[new Date(monthStart + MINSK).getUTCMonth()];

/** Границы четырёх недель месяца: [начало, конец) в мс */
export function monthWeeks(monthStart: number): [number, number][] {
  const end = nextMonthMs(monthStart);
  return [0, 7, 14, 21].map((d, i) => [monthStart + d * DAY, i === 3 ? end : monthStart + (d + 7) * DAY] as [number, number]);
}

/** Скидка за пару недель: на сколько BYN потрачено меньше, делённое на 10. Траты в копейках, результат в % с шагом 0.1 */
export function weekPercent(prev: number, cur: number) {
  return Math.floor(Math.max(0, prev - cur) / (SAVE_BYN_PER_PERCENT * 100) * 10) / 10;
}

/**
 * Проценты по неделям месяца. spent — траты по 4 неделям, done — сколько недель уже закончилось.
 * Первая неделя — только база для сравнения. Итог не больше SAVE_CAP.
 */
export function savePercents(spent: number[], done: number) {
  const pct = spent.map((s, i) => (i === 0 || i >= done ? null : weekPercent(spent[i - 1], s)));
  const sum = pct.reduce<number>((a, p) => a + (p ?? 0), 0);
  return { pct, earned: Math.min(SAVE_CAP, Math.round(sum * 10) / 10) };
}
