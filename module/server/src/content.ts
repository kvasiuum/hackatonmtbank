// Справочники модуля: общие для сервера и клиента.
import type { AgeGroup, CardType, CatKey, Category, ChildSettings, PermKey, SettingPath } from './types';

export const BYN = 100; // копеек в рубле

export const CARD_TYPES: Record<CardType, { label: string; sub: string; physical: boolean }> = {
  plastic: { label: 'Пластиковая карта', sub: 'Классическая карта, доставка 3–5 дней', physical: true },
  sticker: { label: 'Платёжный стикер', sub: 'Клеится на телефон или пенал', physical: true },
  bracelet: { label: 'Браслет NFC', sub: 'Не выпадает из кармана, подходит младшим', physical: true },
  virtual: { label: 'Виртуальная карта', sub: 'Работает сразу, оплата телефоном', physical: false },
};
export const MAX_CARDS = 3;

// Палитра модуля: синие (Moby) и красные (МТБанк) оттенки
export const CARD_COLORS = ['#1F5FD6', '#0F2F7A', 'linear-gradient(135deg,#1A52C9,#5C9BF3)', '#E4252F', '#9E1426'];
export const AVATAR_COLORS = ['#E4252F', '#1F5FD6', '#9E1426', '#0F2F7A', '#FF5A4E'];

export const LEVELS = [
  { n: 1, xp: 0, title: 'Старт', perk: 'Карта и карманные деньги' },
  { n: 2, xp: 100, title: 'Знаю цену', perk: 'Копилки и платежи ЕРИП' },
  { n: 3, xp: 250, title: 'Планирую', perk: 'Онлайн-покупки и переводы друзьям' },
  { n: 4, xp: 400, title: 'Самостоятельный', perk: 'Подписки, вклад, повышенные лимиты' },
  { n: 5, xp: 600, title: 'Почти взрослый', perk: 'Почти без ограничений, кроме 18+' },
];
export const levelOf = (xp: number) => LEVELS.filter(l => l.xp <= xp).pop()!;
export const nextLevel = (xp: number) => LEVELS.find(l => l.xp > xp) ?? null;

export const SETTING_LABELS: Record<SettingPath, { title: string; sub: string }> = {
  'cats.online': { title: 'Онлайн-покупки', sub: 'Маркетплейсы и интернет-магазины' },
  'cats.games': { title: 'Покупки в играх', sub: 'Внутриигровые покупки и донаты' },
  'cats.cash': { title: 'Снятие наличных', sub: 'Банкоматы' },
  'cats.fastfood': { title: 'Кафе и фастфуд', sub: 'Кофейни, бургерные, кафе' },
  'perms.qr': { title: 'QR-оплата КРОК', sub: 'Оплата по QR на кассе прямо со счёта, без карты' },
  'perms.goals': { title: 'Копилки', sub: 'Создавать цели и откладывать деньги' },
  'perms.erip': { title: 'Платежи ЕРИП', sub: 'Связь, проезд, кружки' },
  'perms.p2p': { title: 'Переводы друзьям', sub: 'По номеру телефона +375' },
  'perms.subs': { title: 'Карта для подписок', sub: 'Отдельный лимит 20 BYN в месяц' },
  'perms.newCards': { title: 'Выпуск виртуальных карт', sub: 'Иначе запрос на карту придёт вам' },
  'perms.deposit': { title: 'Свой вклад', sub: 'До 14 лет только с вашего согласия' },
};
export const CAT_KEYS: CatKey[] = ['online', 'games', 'cash', 'fastfood'];
export const PERM_KEYS: PermKey[] = ['qr', 'goals', 'erip', 'p2p', 'subs', 'newCards', 'deposit'];

export const CATEGORY_NAMES: Record<Category, string> = {
  food: 'Еда', shop: 'Покупки', fun: 'Развлечения', fastfood: 'Кафе', online: 'Онлайн', games: 'Игры',
  cash: 'Наличные', erip: 'Платежи', p2p: 'Переводы', subs: 'Подписки', gambling: 'Азартные игры', adult: 'Товары 18+',
};

/** Категории, закрытые банком для всех клиентов до 18 лет, без возможности отключения */
export const BANK_BLOCKED: Category[] = ['gambling', 'adult'];
/** Какая настройка родителя открывает категорию */
export const CATEGORY_SETTING: Partial<Record<Category, SettingPath>> = {
  online: 'cats.online', games: 'cats.games', cash: 'cats.cash', fastfood: 'cats.fastfood',
  erip: 'perms.erip', p2p: 'perms.p2p', subs: 'perms.subs',
};

export type PresetKey = 'strict' | 'normal' | 'free';
type Preset = Pick<ChildSettings, 'limits' | 'confirmAbove' | 'cats' | 'perms'> & { label: string };
const p = (label: string, day: number, month: number, confirm: number, cats: [boolean, boolean, boolean, boolean], perms: [boolean, boolean, boolean, boolean, boolean, boolean, boolean]): Preset => ({
  label,
  limits: { day: day * BYN, month: month * BYN },
  confirmAbove: confirm * BYN,
  cats: { online: cats[0], games: cats[1], cash: cats[2], fastfood: cats[3] },
  perms: { qr: perms[0], goals: perms[1], erip: perms[2], p2p: perms[3], subs: perms[4], newCards: perms[5], deposit: perms[6] },
});
export const PRESETS: Record<AgeGroup, Record<PresetKey, Preset>> = {
  kid: {
    strict: p('Строгий', 10, 100, 5, [false, false, false, false], [false, true, false, false, false, false, false]),
    normal: p('Обычный', 15, 150, 10, [false, false, false, true], [false, true, false, false, false, false, false]),
    free: p('Свободный', 25, 250, 15, [true, false, false, true], [true, true, true, false, false, false, false]),
  },
  teen: {
    strict: p('Строгий', 30, 250, 25, [false, false, true, true], [true, true, true, false, false, false, true]),
    normal: p('Обычный', 60, 400, 50, [true, false, true, true], [true, true, true, true, false, true, true]),
    free: p('Свободный', 100, 700, 80, [true, true, true, true], [true, true, true, true, true, true, true]),
  },
};
export function defaultSettings(group: AgeGroup, preset: PresetKey = 'normal'): ChildSettings {
  const pr = PRESETS[group][preset];
  return {
    limits: { ...pr.limits }, confirmAbove: pr.confirmAbove, cats: { ...pr.cats }, perms: { ...pr.perms },
    allowance: { on: true, amount: (group === 'kid' ? 10 : 25) * BYN },
    parentBonus: group === 'kid', roundup: group === 'kid', mobyAccess: true,
  };
}

export interface Merchant { id: string; title: string; category: Category; amount: number; icon: string }
export const MERCHANTS: Record<AgeGroup, Merchant[]> = {
  kid: [
    { id: 'canteen', title: 'Школьная столовая', category: 'food', amount: 350, icon: 'utensils' },
    { id: 'stationery', title: 'Канцтовары', category: 'shop', amount: 620, icon: 'pencil' },
    { id: 'burger', title: 'Бургерная', category: 'fastfood', amount: 740, icon: 'sandwich' },
    { id: 'toys', title: 'Магазин игрушек', category: 'shop', amount: 1490, icon: 'toy-brick' },
    { id: 'donate', title: 'Донат в онлайн-игре', category: 'games', amount: 1200, icon: 'gamepad-2' },
    { id: 'cinema', title: 'Кинотеатр', category: 'fun', amount: 800, icon: 'clapperboard' },
    { id: 'atm', title: 'Банкомат', category: 'cash', amount: 2000, icon: 'banknote' },
    { id: 'bookmaker', title: 'Букмекерская контора', category: 'gambling', amount: 1000, icon: 'dices' },
    { id: 'tobacco', title: 'Табачный магазин', category: 'adult', amount: 600, icon: 'cigarette' },
  ],
  teen: [
    { id: 'coffee', title: 'Кофейня', category: 'fastfood', amount: 480, icon: 'coffee' },
    { id: 'market', title: 'Маркетплейс', category: 'online', amount: 3990, icon: 'package' },
    { id: 'ingame', title: 'Покупка в игре', category: 'games', amount: 1500, icon: 'gamepad-2' },
    { id: 'cinema', title: 'Кинотеатр', category: 'fun', amount: 1200, icon: 'clapperboard' },
    { id: 'sneakers', title: 'Кроссовки', category: 'shop', amount: 18900, icon: 'footprints' },
    { id: 'atm', title: 'Банкомат', category: 'cash', amount: 3000, icon: 'banknote' },
    { id: 'bets', title: 'Ставки на спорт', category: 'gambling', amount: 2000, icon: 'dices' },
    { id: 'vape', title: 'Вейп-шоп', category: 'adult', amount: 2500, icon: 'cigarette' },
  ],
};

export const ERIP_SERVICES = [
  { id: 'mobile', title: 'Мобильная связь', sub: '+375 (29) 123-45-67', amount: 1000, icon: 'smartphone' },
  { id: 'transport', title: 'Проездной', sub: 'Городской транспорт, месяц', amount: 1860, icon: 'bus' },
  { id: 'internet', title: 'Домашний интернет', sub: 'Лицевой счёт 7741025', amount: 2500, icon: 'wifi' },
  { id: 'clubs', title: 'Кружки и секции', sub: 'Робототехника, октябрь', amount: 3500, icon: 'graduation-cap' },
];

export interface Lesson { id: string; title: string; icon: string; questions: { q: string; options: string[]; answer: number }[] }
export const LESSONS: Record<AgeGroup, Lesson[]> = {
  kid: [
    { id: 'money', title: 'Откуда берутся деньги', icon: 'coins', questions: [
      { q: 'Откуда у родителей деньги на карте?', options: ['Банк их дарит', 'Родители зарабатывают их на работе', 'Они появляются сами'], answer: 1 },
      { q: 'Хочешь игрушку прямо сейчас. Что лучше сделать?', options: ['Подождать день: вдруг желание пройдёт', 'Сразу купить, пока не передумал'], answer: 0 },
      { q: 'Карманные деньги — это…', options: ['Деньги, которыми ты учишься распоряжаться сам', 'Деньги только на сладости'], answer: 0 },
    ] },
    { id: 'save', title: 'Копить или тратить', icon: 'piggy-bank', questions: [
      { q: 'Самокат стоит 120 BYN, ты получаешь 10 BYN в неделю. Сколько недель копить?', options: ['6', '12', '20'], answer: 1 },
      { q: 'Что такое копилка-цель?', options: ['Деньги, которые откладываешь на что-то важное', 'Деньги для игр', 'Долг'], answer: 0 },
      { q: 'Родители добавляют 10% к взносу. Ты положил 10 BYN. Сколько стало?', options: ['10 BYN', '11 BYN', '20 BYN'], answer: 1 },
    ] },
    { id: 'safe', title: 'Безопасность карты', icon: 'lock', questions: [
      { q: 'Ты потерял карту. Что делать?', options: ['Ничего, найдётся', 'Сразу заблокировать в Moby и сказать родителям', 'Попросить друга поискать'], answer: 1 },
      { q: 'Пишут: «Скажи код из SMS и получишь скин в игре». Что делать?', options: ['Сказать код', 'Никому не говорить и показать родителям'], answer: 1 },
      { q: 'PIN-код от карты можно…', options: ['Написать на карте', 'Сказать лучшему другу', 'Держать в секрете'], answer: 2 },
    ] },
  ],
  teen: [
    { id: 'budget', title: 'Бюджет 50/30/20', icon: 'chart-column', questions: [
      { q: 'Правило 50/30/20 — это…', options: ['50% нужное, 30% желания, 20% накопления', '50% накопления, 30% игры, 20% еда'], answer: 0 },
      { q: 'Получила 100 BYN. Сколько отложить по правилу?', options: ['5 BYN', '20 BYN', '50 BYN'], answer: 1 },
      { q: 'Что лучше помогает понять, куда уходят деньги?', options: ['Аналитика трат по категориям', 'Угадывать'], answer: 0 },
    ] },
    { id: 'deposit', title: 'Как работает вклад', icon: 'landmark', questions: [
      { q: '100 BYN на год под 10% годовых. Сколько будет через год?', options: ['101 BYN', '110 BYN', '200 BYN'], answer: 1 },
      { q: 'Чем вклад отличается от копилки?', options: ['Банк начисляет проценты', 'Ничем'], answer: 0 },
      { q: 'С какого возраста в Беларуси можно самому открыть вклад?', options: ['С 18 лет', 'С 14 лет', 'С 10 лет'], answer: 1 },
    ] },
    { id: 'subs', title: 'Подписки без сюрпризов', icon: 'repeat', questions: [
      { q: 'Пробный период 0 BYN, потом 15 BYN в месяц. Что сделать сразу?', options: ['Отключить автопродление или поставить напоминание', 'Ничего'], answer: 0 },
      { q: 'Где удобнее держать подписки?', options: ['На отдельной виртуальной карте с лимитом', 'На основной карте без лимита'], answer: 0 },
      { q: '5 подписок по 7 BYN — это в год:', options: ['35 BYN', '84 BYN', '420 BYN'], answer: 2 },
    ] },
  ],
};
export const LESSON_REWARD = { xp: 60, coins: 15 };

export const FRAUD_CASES = [
  { from: 'SMS от «Банка»', icon: 'message-circle', text: 'Ваша карта заблокирована. Срочно перейдите по ссылке bank-unlock.online и введите номер карты и CVV.', fraud: true, why: 'Банк никогда не просит ввести данные карты по ссылке. Адрес сайта поддельный.' },
  { from: 'Звонок', icon: 'phone', text: '«Служба безопасности банка. Назовите код из SMS, чтобы отменить подозрительный перевод».', fraud: true, why: 'Сотрудники банка никогда не спрашивают коды из SMS. Положи трубку и расскажи родителям.' },
  { from: 'Moby', icon: 'bell', text: 'Карманные деньги: +10.00 BYN от папы.', fraud: false, why: 'Обычное уведомление в приложении: оно ничего не просит.' },
  { from: 'Мессенджер, «друг»', icon: 'message-circle', text: 'Привет, пишу с нового номера. Срочно скинь 20 BYN, вечером верну.', fraud: true, why: 'Аккаунт друга могли взломать. Позвони другу и проверь.' },
  { from: 'Игра', icon: 'gamepad-2', text: 'Бесплатные 10 000 кристаллов. Введи номер карты и срок действия, чтобы получить.', fraud: true, why: 'Бесплатное не требует данных карты. Это ловушка.' },
  { from: 'Электронный дневник', icon: 'school', text: 'Оплата экскурсии через ЕРИП: номер услуги указан в дневнике класса.', fraud: false, why: 'Оплата через ЕРИП по официальному номеру безопасна. Сомневаешься — спроси родителей.' },
];
export const FRAUD_REWARD_PER_ANSWER = { xp: 15, coins: 5 };

export const PARTNER_OFFERS: Record<AgeGroup, { icon: string; title: string; sub: string }[]> = {
  kid: [
    { icon: 'ferris-wheel', title: 'Детский развлекательный центр', sub: '−15% на батуты и квесты' },
    { icon: 'clapperboard', title: 'Кинотеатр', sub: '2 детских билета по цене 1 по средам' },
    { icon: 'book-open', title: 'Книжный магазин', sub: 'Кешбэк 7% Маничками' },
    { icon: 'dumbbell', title: 'Спортивные секции', sub: '−10% на первый месяц' },
  ],
  teen: [
    { icon: 'clapperboard', title: 'Кинотеатр', sub: '−20% по будням до 18:00' },
    { icon: 'coffee', title: 'Кофейни-партнёры', sub: 'Кешбэк 5% Маничками' },
    { icon: 'code', title: 'Курсы программирования', sub: '−15% для клиентов Moby 14+' },
    { icon: 'bus', title: 'Проездной через ЕРИП', sub: 'Кешбэк 3%' },
  ],
};

export const groupOf = (age: number): AgeGroup => (age < 14 ? 'kid' : 'teen');
export const SUBS_MONTHLY_LIMIT = 20 * BYN;
export const PARENT_BONUS_RATE = 0.1;
export const DEPOSIT_RATE = 9;
