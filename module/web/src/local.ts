// Автономный режим для GitHub Pages: API модуля выполняется прямо в браузере.
// Та же схема БД, те же маршруты и бизнес-логика, что на сервере; SQLite — sql.js (WebAssembly),
// база сохраняется в localStorage телефона.
import initSqlJs, { type Database } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { setPlatform } from '../../server/src/platform';
import { initDb, type DB, type Stmt } from '../../server/src/schema';
import { createApi } from '../../server/src/routes';
import { sha256Hex } from './sha256';

const STORE = 'moby-family:db:v2';
type Arg = string | number | null;

class SqlJsDb implements DB {
  constructor(public raw: Database) {}
  exec(sql: string) { this.raw.exec(sql); }
  close() { this.raw.close(); }
  prepare(sql: string): Stmt {
    const db = this.raw;
    const rows = (args: Arg[]) => {
      const st = db.prepare(sql);
      try { st.bind(args); const out: unknown[] = []; while (st.step()) out.push(st.getAsObject()); return out; } finally { st.free(); }
    };
    return {
      all: (...args) => rows(args),
      get: (...args) => rows(args)[0],
      run: (...args) => { db.run(sql, args); return { changes: db.getRowsModified() }; },
    };
  }
}

const hex = (bytes: Uint8Array) => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
setPlatform({
  randomHex: n => hex(crypto.getRandomValues(new Uint8Array(n))),
  // На устройстве смарт-код хранится как SHA-256 с солью: данные демо не покидают телефон
  hashPin(pin) { const salt = hex(crypto.getRandomValues(new Uint8Array(16))); return `${salt}:${sha256Hex(salt + pin)}`; },
  checkPin(pin, stored) { if (!stored) return false; const [salt, h] = stored.split(':'); return sha256Hex(salt + pin) === h; },
});

type Listener = { familyId: string; onChange: () => void; onReset: () => void };
const listeners = new Set<Listener>();
let engine: Promise<{ api: ReturnType<typeof createApi>; db: SqlJsDb }> | null = null;

function load() {
  return (engine ??= (async () => {
    const SQL = await initSqlJs({ locateFile: () => wasmUrl });
    let raw: Database;
    try {
      const saved = localStorage.getItem(STORE);
      raw = saved ? new SQL.Database(Uint8Array.from(atob(saved), c => c.charCodeAt(0))) : new SQL.Database();
    } catch { raw = new SQL.Database(); }
    const db = new SqlJsDb(raw);
    db.exec('PRAGMA foreign_keys = ON;');
    initDb(db);
    const api = createApi(db, {
      demo: true,
      emit: familyId => setTimeout(() => listeners.forEach(l => l.familyId === familyId && l.onChange()), 0),
      emitReset: () => setTimeout(() => listeners.forEach(l => l.onReset()), 0),
    });
    api.svc.processAllowances();
    setInterval(() => api.svc.processAllowances(), 60_000);
    return { api, db };
  })());
}

function persist(db: SqlJsDb) {
  try {
    const bytes = db.raw.export();
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    localStorage.setItem(STORE, btoa(s));
  } catch { /* приватный режим: работаем без сохранения */ }
}

export async function request(method: string, path: string, body: unknown, token?: string | null) {
  const { api, db } = await load();
  const res = api.handle(method, path, body, token ?? undefined);
  if (method !== 'GET') persist(db);
  return res;
}

export function subscribe(token: string, onChange: () => void, onReset: () => void) {
  let l: Listener | null = null, closed = false;
  load().then(({ api }) => {
    if (closed) return;
    const s = api.sessionOf(token);
    if (!s) return onReset();
    l = { familyId: api.svc.familyOfUser(s.userId), onChange, onReset };
    listeners.add(l);
  });
  return () => { closed = true; if (l) listeners.delete(l); };
}
