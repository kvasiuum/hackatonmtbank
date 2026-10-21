// Схема БД, демо-данные и общие помощники. Не зависит от платформы:
// работает и с node:sqlite на сервере, и с sql.js в браузере.
import { BYN, defaultSettings } from './content';
import { platform } from './platform';
import { monthStartMs, monthWeeks } from './domain/weeks';

/** Минимальный интерфейс SQLite, который нужен модулю */
export interface Stmt {
  all(...args: (string | number | null)[]): unknown[];
  get(...args: (string | number | null)[]): unknown;
  run(...args: (string | number | null)[]): { changes: number | bigint };
}
export interface DB { exec(sql: string): void; prepare(sql: string): Stmt; close(): void }

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, role TEXT NOT NULL CHECK (role IN ('parent','child')),
  name TEXT NOT NULL, phone TEXT, pin_hash TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS parents (
  user_id TEXT PRIMARY KEY REFERENCES users(id), balance INTEGER NOT NULL CHECK (balance >= 0), card_mask TEXT NOT NULL,
  coins INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY, parent_id TEXT NOT NULL REFERENCES users(id),
  goal_title TEXT NOT NULL, goal_icon TEXT NOT NULL, goal_target INTEGER NOT NULL, goal_saved INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS children (
  user_id TEXT PRIMARY KEY REFERENCES users(id), family_id TEXT NOT NULL REFERENCES families(id),
  age INTEGER NOT NULL, grp TEXT NOT NULL CHECK (grp IN ('kid','teen')), color TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0), income INTEGER NOT NULL DEFAULT 0 CHECK (income >= 0),
  xp INTEGER NOT NULL DEFAULT 0, coins INTEGER NOT NULL DEFAULT 0,
  settings TEXT NOT NULL, lessons TEXT NOT NULL DEFAULT '[]',
  allowance_paid_at TEXT, invite_code TEXT UNIQUE, joined INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY, child_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, signed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY, child_id TEXT NOT NULL REFERENCES users(id), type TEXT NOT NULL,
  last4 TEXT NOT NULL, color TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, label TEXT, fav INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY, child_id TEXT NOT NULL REFERENCES users(id), type TEXT NOT NULL,
  payload TEXT NOT NULL, reason TEXT, status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL, resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
  amount INTEGER NOT NULL, category TEXT NOT NULL, method TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('spend','income','internal')), created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tx_user_time ON transactions(user_id, created_at);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, child_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
  reward INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, grp TEXT
);
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY, child_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
  icon TEXT NOT NULL, target INTEGER NOT NULL, saved INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY, child_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
  price INTEGER NOT NULL, active INTEGER NOT NULL, icon TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS deposits (
  child_id TEXT PRIMARY KEY REFERENCES users(id), amount INTEGER NOT NULL CHECK (amount >= 0), rate REAL NOT NULL, opened_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS feed (
  id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id), child_id TEXT,
  text TEXT NOT NULL, amount INTEGER, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS parent_cards (
  id TEXT PRIMARY KEY, parent_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, mask TEXT NOT NULL,
  expiry TEXT NOT NULL, network TEXT NOT NULL, balance INTEGER NOT NULL CHECK (balance >= 0), sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS family_parents (
  family_id TEXT NOT NULL REFERENCES families(id), user_id TEXT NOT NULL REFERENCES users(id), PRIMARY KEY (family_id, user_id)
);
CREATE TABLE IF NOT EXISTS family_meta (
  family_id TEXT PRIMARY KEY REFERENCES families(id), tariff TEXT NOT NULL DEFAULT 'start',
  since TEXT NOT NULL, fee_month TEXT, intro_seen INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS join_requests (
  id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id), name TEXT NOT NULL, age INTEGER NOT NULL,
  phone TEXT NOT NULL, pin_hash TEXT NOT NULL, ticket TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  child_id TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS partner_spend (
  id TEXT PRIMARY KEY, child_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
  amount INTEGER NOT NULL, paid INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS game_plays (
  child_id TEXT NOT NULL REFERENCES users(id), game TEXT NOT NULL, day TEXT NOT NULL, score INTEGER NOT NULL,
  PRIMARY KEY (child_id, game, day)
);
CREATE TABLE IF NOT EXISTS insurance (
  child_id TEXT PRIMARY KEY REFERENCES users(id), plan TEXT NOT NULL, price INTEGER NOT NULL, since TEXT NOT NULL, paid_month TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS disputes (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), tx_id TEXT NOT NULL UNIQUE, reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'review', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS save_rewards (
  child_id TEXT NOT NULL REFERENCES users(id), month TEXT NOT NULL, percent REAL NOT NULL, partner TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, PRIMARY KEY (child_id, month)
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
`;

/** Создаёт таблицы и при пустой базе заполняет демо-семью */
export function initDb(db: DB) {
  db.exec(SCHEMA);
  // Базы до общих заданий: добавляем колонку группы
  const cols = db.prepare('PRAGMA table_info(tasks)').all() as { name: string }[];
  if (!cols.some(c => c.name === 'grp')) db.exec('ALTER TABLE tasks ADD COLUMN grp TEXT');
  // Базы до Маничек родителя
  const parentCols = db.prepare('PRAGMA table_info(parents)').all() as { name: string }[];
  if (!parentCols.some(c => c.name === 'coins')) db.exec('ALTER TABLE parents ADD COLUMN coins INTEGER NOT NULL DEFAULT 0');
  // Базы до подписей и избранных карт
  const cardCols = db.prepare('PRAGMA table_info(cards)').all() as { name: string }[];
  if (!cardCols.some(c => c.name === 'label')) db.exec('ALTER TABLE cards ADD COLUMN label TEXT; ALTER TABLE cards ADD COLUMN fav INTEGER NOT NULL DEFAULT 0;');
  const row = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
  if (Number(row.n) === 0) seed(db);
}

export function tx<T>(db: DB, fn: () => T): T {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}

export const newId = (prefix: string) => `${prefix}_${platform().randomHex(6)}`;
export const nowIso = () => new Date().toISOString();

export const hashPin = (pin: string) => platform().hashPin(pin);
export const checkPin = (pin: string, stored: string | null) => platform().checkPin(pin, stored);

export const DEMO_PIN = '1111';

/** Таблицы, которые очищает сброс демо (порядок учитывает внешние ключи) */
export const TABLES = ['sessions', 'save_rewards', 'family_parents', 'game_plays', 'disputes', 'insurance', 'feed', 'partner_spend', 'join_requests', 'family_meta', 'deposits', 'subscriptions', 'goals', 'tasks',
  'transactions', 'requests', 'cards', 'consents', 'children', 'families', 'parent_cards', 'parents', 'users'];

/** Демо-семья: родитель, ребёнок 9 лет и подросток 15 лет */
export function seed(db: DB) {
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  const ins = (sql: string, ...args: (string | number | null)[]) => db.prepare(sql).run(...args);
  tx(db, () => {
    const pin = hashPin(DEMO_PIN);
    ins('INSERT INTO users VALUES (?,?,?,?,?,?)', 'u_parent', 'parent', 'Родитель 1', '+375291234567', pin, ago(60 * 24 * 400));
    ins('INSERT INTO parents (user_id,balance,card_mask,coins) VALUES (?,?,?,?)', 'u_parent', 124050, '4*2110', 240);
    ins('INSERT INTO parent_cards VALUES (?,?,?,?,?,?,?,?)', 'pc_salary', 'u_parent', 'Зарплатная', '9*4405', '11/27', 'belkart', 1246, 1);
    ins('INSERT INTO parent_cards VALUES (?,?,?,?,?,?,?,?)', 'pc_personal', 'u_parent', 'Личная', '4*8837', '05/30', 'visa', 5420, 2);
    ins('INSERT INTO parent_cards VALUES (?,?,?,?,?,?,?,?)', 'pc_halva', 'u_parent', 'Халва', '5*7731', '08/28', 'mastercard', 31200, 3);
    ins('INSERT INTO families VALUES (?,?,?,?,?,?)', 'f_demo', 'u_parent', 'Отпуск на Нарочи', 'tent', 150000, 62000);
    // Второй родитель семьи: свои карты и свои Манички, видит тех же детей
    ins('INSERT INTO users VALUES (?,?,?,?,?,?)', 'u_parent2', 'parent', 'Родитель 2', '+375447001122', pin, ago(60 * 24 * 300));
    ins('INSERT INTO parents (user_id,balance,card_mask,coins) VALUES (?,?,?,?)', 'u_parent2', 86340, '4*5518', 95);
    ins('INSERT INTO parent_cards VALUES (?,?,?,?,?,?,?,?)', 'pc_p2_salary', 'u_parent2', 'Зарплатная', '9*6230', '03/28', 'belkart', 41500, 1);
    ins('INSERT INTO family_parents VALUES (?,?)', 'f_demo', 'u_parent');
    ins('INSERT INTO family_parents VALUES (?,?)', 'f_demo', 'u_parent2');
    ins('INSERT INTO family_meta VALUES (?,?,?,?,?)', 'f_demo', 'plus', ago(60 * 24 * 12), null, 0);
    const pOps: [string, number, string, number][] = [
      ['UNIVERSAM', -1408, 'Покупки', 35], ['Гипермаркет', -2735, 'Покупки', 60 * 5], ['Зарплата', 185000, 'Пополнение', 60 * 26],
      ['ЕРИП: коммунальные', -9842, 'Платежи', 60 * 30], ['Аптека', -1255, 'Здоровье', 60 * 50],
    ];
    for (const [t, a, c, m] of pOps) ins('INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?)', newId('t'), 'u_parent', t, a, c, 'card', a > 0 ? 'income' : 'spend', ago(m));

    const kidSettings = defaultSettings('kid');
    ins('INSERT INTO users VALUES (?,?,?,?,?,?)', 'u_misha', 'child', 'Ребёнок 2', null, pin, ago(60 * 24 * 90));
    ins(`INSERT INTO children (user_id,family_id,age,grp,color,balance,income,xp,coins,settings,lessons,allowance_paid_at,invite_code,joined)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`, 'u_misha', 'f_demo', 9, 'kid', '#E4252F', 2340, 0, 140, 85, JSON.stringify(kidSettings), '["money"]', nowIso(), null);
    ins('INSERT INTO cards (id,child_id,type,last4,color,status,created_at) VALUES (?,?,?,?,?,?,?)', 'c_misha1', 'u_misha', 'sticker', '4417', '#E4252F', 'active', ago(60 * 24 * 80));
    ins('INSERT INTO cards (id,child_id,type,last4,color,status,created_at) VALUES (?,?,?,?,?,?,?)', 'c_misha2', 'u_misha', 'virtual', '9921', '#1F5FD6', 'active', ago(60 * 24 * 80));
    const kOps: [string, number, string, 'spend' | 'income', number][] = [
      ['Школьная столовая', -350, 'Еда', 'spend', 90], ['Карманные деньги', 1000, 'Пополнение', 'income', 60 * 30],
      ['Канцтовары', -420, 'Покупки', 'spend', 60 * 50], ['Награда: вынести мусор', 400, 'Награда', 'income', 60 * 70],
    ];
    for (const [t, a, c, k, m] of kOps) ins('INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?)', newId('t'), 'u_misha', t, a, c, 'card', k, ago(m));
    ins('INSERT INTO goals VALUES (?,?,?,?,?,?,?)', 'g_scooter', 'u_misha', 'Самокат', 'bike', 120 * BYN, 4600, ago(60 * 24 * 20));
    ins('INSERT INTO goals VALUES (?,?,?,?,?,?,?)', 'g_lego', 'u_misha', 'Конструктор', 'toy-brick', 60 * BYN, 1200, ago(60 * 24 * 10));
    ins('INSERT INTO tasks (id,child_id,title,reward,status,created_at) VALUES (?,?,?,?,?,?)', 'k_vacuum', 'u_misha', 'Пропылесосить комнату', 300, 'open', ago(60 * 5));
    ins('INSERT INTO tasks (id,child_id,title,reward,status,created_at) VALUES (?,?,?,?,?,?)', 'k_book', 'u_misha', 'Прочитать 50 страниц книги', 500, 'open', ago(60 * 24));
    ins('INSERT INTO tasks (id,child_id,title,reward,status,created_at) VALUES (?,?,?,?,?,?)', 'k_trash', 'u_misha', 'Выносить мусор всю неделю', 400, 'paid', ago(60 * 70));

    const teenSettings = defaultSettings('teen');
    ins('INSERT INTO users VALUES (?,?,?,?,?,?)', 'u_anya', 'child', 'Ребёнок 1', '+375297654321', pin, ago(60 * 24 * 200));
    ins(`INSERT INTO children (user_id,family_id,age,grp,color,balance,income,xp,coins,settings,lessons,allowance_paid_at,invite_code,joined)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`, 'u_anya', 'f_demo', 15, 'teen', '#1F5FD6', 8670, 6500, 470, 310, JSON.stringify(teenSettings), '["budget"]', nowIso(), null);
    ins('INSERT INTO cards (id,child_id,type,last4,color,status,created_at) VALUES (?,?,?,?,?,?,?)', 'c_anya1', 'u_anya', 'plastic', '9032', '#0F2F7A', 'active', ago(60 * 24 * 190));
    ins('INSERT INTO cards (id,child_id,type,last4,color,status,created_at) VALUES (?,?,?,?,?,?,?)', 'c_anya2', 'u_anya', 'virtual', '3310', '#1F5FD6', 'active', ago(60 * 24 * 190));
    const tOps: [string, number, string, 'spend' | 'income', number][] = [
      ['Кофейня', -480, 'Кафе', 'spend', 60 * 20], ['ЕРИП: мобильная связь', -1000, 'Платежи', 'spend', 60 * 26],
      ['Карманные деньги', 2500, 'Пополнение', 'income', 60 * 30], ['Маркетплейс', -2750, 'Онлайн', 'spend', 60 * 48],
      ['Музыкальный сервис', -549, 'Подписки', 'spend', 60 * 24 * 6], ['Кинотеатр', -1200, 'Развлечения', 'spend', 60 * 24 * 7],
    ];
    for (const [t, a, c, k, m] of tOps) ins('INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?)', newId('t'), 'u_anya', t, a, c, 'card', k, ago(m));
    ins('INSERT INTO goals VALUES (?,?,?,?,?,?,?)', 'g_phones', 'u_anya', 'Наушники', 'headphones', 180 * BYN, 9500, ago(60 * 24 * 30));
    ins('INSERT INTO tasks (id,child_id,title,reward,status,created_at) VALUES (?,?,?,?,?,?)', 'k_balcony', 'u_anya', 'Помочь с покраской балкона', 1500, 'open', ago(60 * 24));
    ins('INSERT INTO subscriptions VALUES (?,?,?,?,?,?)', 's_music', 'u_anya', 'Музыкальный сервис', 549, 1, 'music');
    ins('INSERT INTO subscriptions VALUES (?,?,?,?,?,?)', 's_tv', 'u_anya', 'Онлайн-кинотеатр', 990, 1, 'tv');
    ins('INSERT INTO subscriptions VALUES (?,?,?,?,?,?)', 's_cloud', 'u_anya', 'Облако для фото', 290, 0, 'cloud');
    ins('INSERT INTO deposits VALUES (?,?,?,?)', 'u_anya', 15000, 9, ago(60 * 24 * 60));
    // Траты у партнёров на этой неделе: кешбэк придёт в понедельник
    const week: [string, string, number][] = [['u_misha', 'Канцтовары', 420], ['u_misha', 'Кинотеатр', 800], ['u_anya', 'Кофейня', 480], ['u_anya', 'Кинотеатр', 1200]];
    for (const [c, t, a] of week) ins('INSERT INTO partner_spend VALUES (?,?,?,?,?,?)', newId('ps'), c, t, a, 0, nowIso());

    // История трат по неделям: прошлый и текущий месяц, чтобы скидка «Трать меньше» была видна сразу.
    // Сумма недели раскладывается на 3 покупки; последние сутки не трогаем, чтобы не съесть дневной лимит
    const now = Date.now();
    const thisMonth = monthStartMs(now);
    const prevMonth = monthStartMs(thisMonth - 1);
    const weekly: [string, number[], number[]][] = [
      ['u_misha', [3600, 2500, 2900, 1800], [3200, 2100, 2600, 1500]],
      ['u_anya', [11000, 8000, 8500, 6000], [9000, 6000, 7000, 4500]],
    ];
    for (const [child, prev, cur] of weekly) {
      for (const [month, sums] of [[prevMonth, prev], [thisMonth, cur]] as const) {
        monthWeeks(month).forEach(([from], i) => {
          const parts = [.45, .35, .2];
          parts.forEach((k, j) => {
            const at = from + (1 + j * 2) * 24 * 3600_000 + 11 * 3600_000;
            if (at > now - 26 * 3600_000) return;
            ins('INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?)', newId('t'), child, ['Продукты', 'Транспорт', 'Развлечения'][j], -Math.round(sums[i] * k), 'Покупки', 'card', 'spend', new Date(at).toISOString());
          });
        });
      }
    }

    for (const kind of ['legal_rep', 'personal_data', 'card_issue']) {
      ins('INSERT INTO consents VALUES (?,?,?,?)', newId('cs'), 'u_misha', kind, ago(60 * 24 * 90));
      ins('INSERT INTO consents VALUES (?,?,?,?)', newId('cs'), 'u_anya', kind, ago(60 * 24 * 200));
    }
    ins('INSERT INTO requests VALUES (?,?,?,?,?,?,?,?)', 'r_seed1', 'u_misha', 'money', JSON.stringify({ amount: 500 }), 'Открытка другу на день рождения', 'pending', ago(40), null);
    ins('INSERT INTO requests VALUES (?,?,?,?,?,?,?,?)', 'r_seed2', 'u_anya', 'perm', JSON.stringify({ key: 'cats.games' }), 'Хочу купить боевой пропуск в игре на месяц', 'pending', ago(60 * 14), null);
    ins('INSERT INTO feed VALUES (?,?,?,?,?,?)', newId('fd'), 'f_demo', 'u_misha', 'Ребёнок 2: школьная столовая', -350, ago(90));
    ins('INSERT INTO feed VALUES (?,?,?,?,?,?)', newId('fd'), 'f_demo', 'u_anya', 'Ребёнок 1: ЕРИП, мобильная связь', -1000, ago(60 * 26));
    ins('INSERT INTO feed VALUES (?,?,?,?,?,?)', newId('fd'), 'f_demo', 'u_misha', 'Ребёнок 2 выполнил задание «Выносить мусор»', null, ago(60 * 70));
  });
}
