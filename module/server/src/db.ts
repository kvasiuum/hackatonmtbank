// Серверное хранилище: встроенный node:sqlite, без нативных зависимостей.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { setPlatform } from './platform';
import { type DB, initDb } from './schema';

export * from './schema';

setPlatform({
  randomHex: n => randomBytes(n).toString('hex'),
  hashPin(pin) {
    const salt = randomBytes(16);
    return `${salt.toString('hex')}:${scryptSync(pin, salt, 32).toString('hex')}`;
  },
  checkPin(pin, stored) {
    if (!stored) return false;
    const [salt, hash] = stored.split(':');
    return timingSafeEqual(scryptSync(pin, Buffer.from(salt, 'hex'), 32), Buffer.from(hash, 'hex'));
  },
});

export function openDb(file = process.env.DB_FILE ?? 'data/family.db'): DB {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  initDb(db as unknown as DB);
  return db as unknown as DB;
}
