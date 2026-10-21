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
  'perms.p2p': { title: 'Переводы друзьям', sub: 'По номеру карты, с 14 лет и по номеру телефона' },
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

export interface Merchant { id: string; title: string; category: Category; amount: number; icon: string; partner?: boolean }
export const MERCHANTS: Record<AgeGroup, Merchant[]> = {
  kid: [
    { id: 'canteen', title: 'Школьная столовая', category: 'food', amount: 350, icon: 'utensils' },
    { id: 'stationery', title: 'Канцтовары', category: 'shop', amount: 620, icon: 'pencil', partner: true },
    { id: 'burger', title: 'Бургерная', category: 'fastfood', amount: 740, icon: 'sandwich' },
    { id: 'toys', title: 'Магазин игрушек', category: 'shop', amount: 1490, icon: 'toy-brick' },
    { id: 'donate', title: 'Донат в онлайн-игре', category: 'games', amount: 1200, icon: 'gamepad-2' },
    { id: 'cinema', title: 'Кинотеатр', category: 'fun', amount: 800, icon: 'clapperboard', partner: true },
    { id: 'atm', title: 'Банкомат', category: 'cash', amount: 2000, icon: 'banknote' },
    { id: 'bookmaker', title: 'Букмекерская контора', category: 'gambling', amount: 1000, icon: 'dices' },
    { id: 'tobacco', title: 'Табачный магазин', category: 'adult', amount: 600, icon: 'cigarette' },
  ],
  teen: [
    { id: 'coffee', title: 'Кофейня', category: 'fastfood', amount: 480, icon: 'coffee', partner: true },
    { id: 'market', title: 'Маркетплейс', category: 'online', amount: 3990, icon: 'package' },
    { id: 'ingame', title: 'Покупка в игре', category: 'games', amount: 1500, icon: 'gamepad-2' },
    { id: 'cinema', title: 'Кинотеатр', category: 'fun', amount: 1200, icon: 'clapperboard', partner: true },
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

// ---------- MobyPlay: мини-игры ----------
/** Партнёры на картах игры «Карты по памяти» */
export const MEMORY_PARTNERS = [
  { id: 'cinema', icon: 'clapperboard', title: 'Кинотеатр' },
  { id: 'books', icon: 'book-open', title: 'Книжный' },
  { id: 'coffee', icon: 'coffee', title: 'Кофейня' },
  { id: 'sport', icon: 'dumbbell', title: 'Спортзал' },
  { id: 'stationery', icon: 'pencil', title: 'Канцтовары' },
  { id: 'fun', icon: 'ferris-wheel', title: 'Парк развлечений' },
];
/** «Угадай цену»: примерные цены в Минске, чтобы ребёнок чувствовал стоимость вещей */
export const PRICE_GAME: { icon: string; item: string; options: number[]; answer: number; note: string }[] = [
  { icon: 'bus', item: 'Поездка в метро', options: [90, 350, 900], answer: 0, note: 'Около 90 копеек — поэтому проездной на месяц выгоднее для тех, кто ездит каждый день.' },
  { icon: 'sandwich', item: 'Буханка хлеба', options: [40, 180, 900], answer: 1, note: 'Около 1.80 BYN. Цены на продукты меняются: полезно сравнивать магазины.' },
  { icon: 'clapperboard', item: 'Билет в кино', options: [300, 1200, 4500], answer: 1, note: 'Около 12 BYN. У партнёров Moby в будни дешевле, а 10% вернутся кешбэком.' },
  { icon: 'pencil', item: 'Тетрадь на 48 листов', options: [250, 900, 2000], answer: 0, note: 'Около 2.50 BYN. За год на тетради уходит больше, чем кажется.' },
  { icon: 'smartphone', item: 'Мобильная связь на месяц', options: [200, 1500, 9000], answer: 1, note: 'Около 15 BYN: столько же, сколько неделя обедов в школе.' },
  { icon: 'headphones', item: 'Беспроводные наушники', options: [1500, 9000, 50000], answer: 1, note: 'Около 90 BYN. Если откладывать 10 BYN в неделю, накопишь за 9 недель.' },
];
export const GAME_REWARD = { memory: { xp: 15, coins: 10 }, price: { xp: 5, coins: 3 } } as const;
export type GameId = keyof typeof GAME_REWARD;

// ---------- страхование ребёнка ----------
export const INSURANCE_PLANS = {
  accident: { title: 'Несчастный случай', sub: 'Травмы в школе, на улице и дома, 24/7', price: 200, cover: 5000 * BYN },
  sport: { title: 'Спорт и активный отдых', sub: 'Плюс тренировки, соревнования и летний лагерь', price: 350, cover: 10000 * BYN },
} as const;
export type InsurancePlan = keyof typeof INSURANCE_PLANS;
/** Скидка на страхование в «Семья+» */
export const INSURANCE_PLUS_DISCOUNT = 0.3;

// ---------- для родителя: партнёры и советы ----------
export const FAMILY_OFFERS = [
  { icon: 'ferris-wheel', title: 'Детский развлекательный центр', sub: '−15% всей семье в выходные' },
  { icon: 'stethoscope', title: 'Детская клиника', sub: '−10% на педиатра и стоматолога' },
  { icon: 'dumbbell', title: 'Кружки и секции', sub: 'Оплата через ЕРИП без комиссии, Манички ×2' },
  { icon: 'tent', title: 'Семейный отдых на Нарочи', sub: '−7% при оплате картой МТБанка' },
];
export const PARENT_TIPS = [
  { icon: 'coins', title: 'Сколько давать на карманные', text: 'Ориентир — 1–2 BYN в неделю за каждый год возраста младшего школьника и 15–30 BYN в неделю подростку. Важнее регулярность: одна и та же сумма в один и тот же день учит планировать. В Moby это автоперевод по понедельникам.' },
  { icon: 'message-circle', title: 'Как говорить с ребёнком о деньгах', text: 'Обсуждайте реальные решения: почему выбрали этот магазин, сколько стоит поездка, на что копите семьёй. Не делайте деньги запретной темой — ребёнок, который задаёт вопросы дома, реже ошибается вне дома.' },
  { icon: 'list-checks', title: 'Задания вместо платы за оценки', text: 'Платите за дополнительные дела, а не за обязанности и учёбу: так ребёнок связывает деньги с трудом, а интерес к учёбе не превращается в торг. Пусть ребёнок сам предлагает задания — в Moby это кнопка «Предложить своё».' },
  { icon: 'shield-check', title: 'Если карта потерялась', text: 'Ребёнок блокирует карту сам кнопкой «Я потерял карту», вы видите это в ленте. Пока физическая карта перевыпускается, работают виртуальная карта и QR КРОК. Спорную операцию можно оспорить прямо из истории.' },
];

// ---------- программа лояльности ----------
/** Манички родителя: за переводы детям (1 за каждые 5 BYN, в «Семья+» ×2), за принятые задания и пройденные ребёнком уроки */
export const PARENT_COINS = { per: 5 * BYN, taskApproved: 3, childLesson: 2 };
/** Ребёнку 7–13 кешбэк недели приходит Маничками: 1 Маничка за каждые 10 копеек кешбэка */
export const KID_CASHBACK_KOP_PER_COIN = 10;
export const DISPUTE_REASONS = ['Я не совершал(а) эту операцию', 'Списали дважды', 'Товар или услугу не получил(а)', 'Сумма не совпадает с чеком'];

export const groupOf = (age: number): AgeGroup => (age < 14 ? 'kid' : 'teen');
export const SUBS_MONTHLY_LIMIT = 20 * BYN;
export const PARENT_BONUS_RATE = 0.1;
export const DEPOSIT_RATE = 9;

// ---------- пакет «Семья»: тарифы и спецусловия ----------
export const TARIFFS = {
  start: {
    title: 'Семья Старт', price: 0, maxKids: 1, cashbackRate: 0.05,
    cards: ['virtual', 'sticker'] as CardType[],
    perks: [
      'Один ребёнок, виртуальная карта и платёжный стикер',
      'Лимиты, категории, подтверждение покупок',
      'Копилки, задания и уроки финграмотности',
      'Кешбэк недели у партнёров 5% в копилку ребёнка',
    ],
  },
  plus: {
    title: 'Семья+', price: 490, maxKids: 4, cashbackRate: 0.10,
    /** Плата не списывается, если семья потратила за прошлый месяц не меньше этой суммы */
    waiverSpend: 400 * BYN,
    cards: ['virtual', 'sticker', 'bracelet', 'plastic'] as CardType[],
    perks: [
      'До 4 детей, браслет и пластиковая карта бесплатно',
      'Кешбэк недели у партнёров 10% в копилку ребёнка',
      'Манички ×2 в детских категориях: школа, кружки, аптеки, детские товары',
      '+1% к ставке по вкладу родителя, пока у ребёнка есть копилка',
      'Халва: рассрочка 0% на школьные покупки до 6 месяцев',
      'Страхование ребёнка со скидкой 30%',
      'Бесплатные переводы внутри семьи и в ЕРИП за кружки',
    ],
  },
} as const;
export type TariffKey = keyof typeof TARIFFS;

// ---------- экономика модуля (допущения для расчёта окупаемости) ----------
export interface EconInputs {
  families: number;          // семей за первый год
  cac: number;               // привлечение семьи: реклама в Moby + приветственный бонус, BYN
  cardCost: number;          // выпуск и доставка физической карты/браслета, BYN
  kidsPerFamily: number;     // детей в семье
  kidSpend: number;          // траты ребёнка в месяц, BYN
  parentExtraSpend: number;  // дополнительные траты родителя (перенёс основную карту в МТБанк), BYN
  interchange: number;       // доход банка с оборота по картам, %
  balances: number;          // средние остатки семьи (счета детей, копилки, вклады), BYN
  margin: number;            // процентная маржа на остатки, % годовых
  plusShare: number;         // доля семей на «Семья+», %
  plusPaying: number;        // из них платят (не набрали 400 BYN трат), %
  partnerShare: number;      // доля трат детей у партнёров, %
  partnerFee: number;        // комиссия партнёра банку, %
  bonusRate: number;         // Манички и бонусы за счёт банка, % от трат детей
  opex: number;              // обслуживание семьи (процессинг, поддержка, SMS), BYN в месяц
  devCost: number;           // разработка и запуск, BYN
}
export const ECON_DEFAULTS: EconInputs = {
  families: 10000, cac: 25, cardCost: 10, kidsPerFamily: 1.6, kidSpend: 90, parentExtraSpend: 150,
  interchange: 1.2, balances: 300, margin: 8, plusShare: 40, plusPaying: 50, partnerShare: 20, partnerFee: 3,
  bonusRate: 1, opex: 1, devCost: 150000,
};
export function economics(i: EconInputs) {
  const kidsSpend = i.kidsPerFamily * i.kidSpend;
  const interchange = (kidsSpend + i.parentExtraSpend) * i.interchange / 100;
  const balances = i.balances * i.margin / 100 / 12;
  const tariff = (TARIFFS.plus.price / BYN) * (i.plusShare / 100) * (i.plusPaying / 100);
  const partners = kidsSpend * (i.partnerShare / 100) * (i.partnerFee / 100);
  const revenue = interchange + balances + tariff + partners;
  // Кешбэк недели оплачивают партнёры из своей комиссии, банк платит только Манички
  const bonuses = kidsSpend * i.bonusRate / 100;
  const contribution = revenue - bonuses - i.opex;
  const acquisition = i.cac + i.cardCost * i.kidsPerFamily * 0.6; // 60% детей берут физическую карту
  const devPerFamily = i.devCost / Math.max(1, i.families);
  const payback = contribution > 0 ? (acquisition + devPerFamily) / contribution : Infinity;
  return {
    revenue: { interchange, balances, tariff, partners, total: revenue },
    bonuses, opex: i.opex, contribution, acquisition, devPerFamily,
    paybackMonths: payback, yearProfit: (contribution * 12 - acquisition - devPerFamily) * i.families,
  };
}
