// Схема БД, демо-данные и общие помощники. Не зависит от платформы:
// работает и с node:sqlite на сервере, и с sql.js в браузере.
import { BYN, defaultSettings } from './content';
import { platform } from './platform';

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
  user_id TEXT PRIMARY KEY REFERENCES users(id), balance INTEGER NOT NULL, card_mask TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY, parent_id TEXT NOT NULL REFERENCES users(id),
  goal_title TEXT NOT NULL, goal_icon TEXT NOT NULL, goal_target INTEGER NOT NULL, goal_saved INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS children (
  user_id TEXT PRIMARY KEY REFERENCES users(id), family_id TEXT NOT NULL REFERENCES families(id),
  age INTEGER NOT NULL, grp TEXT NOT NULL CHECK (grp IN ('kid','teen')), color TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0, income INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0, coins INTEGER NOT NULL DEFAULT 0,
  settings TEXT NOT NULL, lessons TEXT NOT NULL DEFAULT '[]',
  allowance_paid_at TEXT, invite_code TEXT UNIQUE, joined INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY, child_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, signed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY, child_id TEXT NOT NULL REFERENCES users(id), type TEXT NOT NULL,
  last4 TEXT NOT NULL, color TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL
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
  reward INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL
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
  child_id TEXT PRIMARY KEY REFERENCES users(id), amount INTEGER NOT NULL, rate REAL NOT NULL, opened_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS feed (
  id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id), child_id TEXT,
  text TEXT NOT NULL, amount INTEGER, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
`;

/** Создаёт таблицы и при пустой базе заполняет демо-семью */
export function initDb(db: DB) {
  db.exec(SCHEMA);
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

/** Демо-семья: родитель, ребёнок 9 лет и подросток 15 лет */
export function seed(db: DB) {
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  const ins = (sql: string, ...args: (string | number | null)[]) => db.prepare(sql).run(...args);
  tx(db, () => {
    const pin = hashPin(DEMO_PIN);
    ins('INSERT INTO users VALUES (?,?,?,?,?,?)', 'u_parent', 'parent', 'Андрей', '+375291234567', pin, ago(60 * 24 * 400));
    ins('INSERT INTO parents VALUES (?,?,?)', 'u_parent', 124050, '4*2110');
    ins('INSERT INTO families VALUES (?,?,?,?,?,?)', 'f_demo', 'u_parent', 'Отпуск на Нарочи', 'tent', 150000, 62000);
    const pOps: [string, number, string, number][] = [
      ['UNIVERSAM', -1408, 'Покупки', 35], ['Гипермаркет', -2735, 'Покупки', 60 * 5], ['Зарплата', 185000, 'Пополнение', 60 * 26],
      ['ЕРИП: коммунальные', -9842, 'Платежи', 60 * 30], ['Аптека', -1255, 'Здоровье', 60 * 50],
    ];
    for (const [t, a, c, m] of pOps) ins('INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?)', newId('t'), 'u_parent', t, a, c, 'card', a > 0 ? 'income' : 'spend', ago(m));

    const kidSettings = defaultSettings('kid');
    ins('INSERT INTO users VALUES (?,?,?,?,?,?)', 'u_misha', 'child', 'Миша', null, pin, ago(60 * 24 * 90));
    ins(`INSERT INTO children (user_id,family_id,age,grp,color,balance,income,xp,coins,settings,lessons,allowance_paid_at,invite_code,joined)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`, 'u_misha', 'f_demo', 9, 'kid', '#E4252F', 2340, 0, 140, 85, JSON.stringify(kidSettings), '["money"]', nowIso(), null);
    ins('INSERT INTO cards VALUES (?,?,?,?,?,?,?)', 'c_misha1', 'u_misha', 'sticker', '4417', '#E4252F', 'active', ago(60 * 24 * 80));
    ins('INSERT INTO cards VALUES (?,?,?,?,?,?,?)', 'c_misha2', 'u_misha', 'virtual', '9921', '#1F5FD6', 'active', ago(60 * 24 * 80));
    const kOps: [string, number, string, 'spend' | 'income', number][] = [
      ['Школьная столовая', -350, 'Еда', 'spend', 90], ['Карманные деньги', 1000, 'Пополнение', 'income', 60 * 30],
      ['Канцтовары', -420, 'Покупки', 'spend', 60 * 50], ['Награда: вынести мусор', 400, 'Награда', 'income', 60 * 70],
    ];
    for (const [t, a, c, k, m] of kOps) ins('INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?)', newId('t'), 'u_misha', t, a, c, 'card', k, ago(m));
    ins('INSERT INTO goals VALUES (?,?,?,?,?,?,?)', 'g_scooter', 'u_misha', 'Самокат', 'bike', 120 * BYN, 4600, ago(60 * 24 * 20));
    ins('INSERT INTO goals VALUES (?,?,?,?,?,?,?)', 'g_lego', 'u_misha', 'Конструктор', 'toy-brick', 60 * BYN, 1200, ago(60 * 24 * 10));
    ins('INSERT INTO tasks VALUES (?,?,?,?,?,?)', 'k_vacuum', 'u_misha', 'Пропылесосить комнату', 300, 'open', ago(60 * 5));
    ins('INSERT INTO tasks VALUES (?,?,?,?,?,?)', 'k_book', 'u_misha', 'Прочитать 50 страниц книги', 500, 'open', ago(60 * 24));
    ins('INSERT INTO tasks VALUES (?,?,?,?,?,?)', 'k_trash', 'u_misha', 'Выносить мусор всю неделю', 400, 'paid', ago(60 * 70));

    const teenSettings = defaultSettings('teen');
    ins('INSERT INTO users VALUES (?,?,?,?,?,?)', 'u_anya', 'child', 'Аня', '+375297654321', pin, ago(60 * 24 * 200));
    ins(`INSERT INTO children (user_id,family_id,age,grp,color,balance,income,xp,coins,settings,lessons,allowance_paid_at,invite_code,joined)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`, 'u_anya', 'f_demo', 15, 'teen', '#1F5FD6', 8670, 6500, 470, 310, JSON.stringify(teenSettings), '["budget"]', nowIso(), null);
    ins('INSERT INTO cards VALUES (?,?,?,?,?,?,?)', 'c_anya1', 'u_anya', 'plastic', '9032', '#0F2F7A', 'active', ago(60 * 24 * 190));
    ins('INSERT INTO cards VALUES (?,?,?,?,?,?,?)', 'c_anya2', 'u_anya', 'virtual', '3310', '#1F5FD6', 'active', ago(60 * 24 * 190));
    const tOps: [string, number, string, 'spend' | 'income', number][] = [
      ['Кофейня', -480, 'Кафе', 'spend', 60 * 20], ['ЕРИП: мобильная связь', -1000, 'Платежи', 'spend', 60 * 26],
      ['Карманные деньги', 2500, 'Пополнение', 'income', 60 * 30], ['Маркетплейс', -2750, 'Онлайн', 'spend', 60 * 48],
      ['Музыкальный сервис', -549, 'Подписки', 'spend', 60 * 24 * 6], ['Кинотеатр', -1200, 'Развлечения', 'spend', 60 * 24 * 7],
    ];
    for (const [t, a, c, k, m] of tOps) ins('INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?)', newId('t'), 'u_anya', t, a, c, 'card', k, ago(m));
    ins('INSERT INTO goals VALUES (?,?,?,?,?,?,?)', 'g_phones', 'u_anya', 'Наушники', 'headphones', 180 * BYN, 9500, ago(60 * 24 * 30));
    ins('INSERT INTO tasks VALUES (?,?,?,?,?,?)', 'k_balcony', 'u_anya', 'Помочь с покраской балкона', 1500, 'open', ago(60 * 24));
    ins('INSERT INTO subscriptions VALUES (?,?,?,?,?,?)', 's_music', 'u_anya', 'Музыкальный сервис', 549, 1, 'music');
    ins('INSERT INTO subscriptions VALUES (?,?,?,?,?,?)', 's_tv', 'u_anya', 'Онлайн-кинотеатр', 990, 1, 'tv');
    ins('INSERT INTO subscriptions VALUES (?,?,?,?,?,?)', 's_cloud', 'u_anya', 'Облако для фото', 290, 0, 'cloud');
    ins('INSERT INTO deposits VALUES (?,?,?,?)', 'u_anya', 15000, 9, ago(60 * 24 * 60));

    for (const kind of ['legal_rep', 'personal_data', 'card_issue']) {
      ins('INSERT INTO consents VALUES (?,?,?,?)', newId('cs'), 'u_misha', kind, ago(60 * 24 * 90));
      ins('INSERT INTO consents VALUES (?,?,?,?)', newId('cs'), 'u_anya', kind, ago(60 * 24 * 200));
    }
    ins('INSERT INTO requests VALUES (?,?,?,?,?,?,?,?)', 'r_seed1', 'u_misha', 'money', JSON.stringify({ amount: 500 }), 'Открытка другу на день рождения', 'pending', ago(40), null);
    ins('INSERT INTO requests VALUES (?,?,?,?,?,?,?,?)', 'r_seed2', 'u_anya', 'perm', JSON.stringify({ key: 'cats.games' }), 'Хочу купить боевой пропуск в игре на месяц', 'pending', ago(60 * 14), null);
    ins('INSERT INTO feed VALUES (?,?,?,?,?,?)', newId('fd'), 'f_demo', 'u_misha', 'Миша: школьная столовая', -350, ago(90));
    ins('INSERT INTO feed VALUES (?,?,?,?,?,?)', newId('fd'), 'f_demo', 'u_anya', 'Аня: ЕРИП, мобильная связь', -1000, ago(60 * 26));
    ins('INSERT INTO feed VALUES (?,?,?,?,?,?)', newId('fd'), 'f_demo', 'u_misha', 'Миша выполнил задание «Выносить мусор»', null, ago(60 * 70));
  });
}
