// Клиент API, форматирование и контекст «устройства» (одного телефона на стенде).
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export class ApiError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }

/** Сборка для GitHub Pages: API выполняется в браузере (см. local.ts) */
export const LOCAL = import.meta.env.VITE_LOCAL === '1';

export async function api<T = any>(path: string, opts: { token?: string | null; method?: string; body?: unknown } = {}): Promise<T> {
  if (LOCAL) {
    const { request } = await import('./local');
    const r = await request(opts.method ?? (opts.body ? 'POST' : 'GET'), path, opts.body, opts.token);
    const data = r.body as any;
    if (r.status >= 400) throw new ApiError(r.status, data.error?.code ?? 'error', data.error?.message ?? 'Ошибка');
    return data as T;
  }
  const res = await fetch(path, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers: { ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error?.code ?? 'error', data.error?.message ?? 'Ошибка сети');
  return data as T;
}

/** Живые обновления: SSE с сервера или события браузерного движка */
export function subscribe(token: string, onChange: () => void, onReset: () => void): () => void {
  if (LOCAL) {
    let off: (() => void) | null = null, closed = false;
    import('./local').then(m => { if (!closed) off = m.subscribe(token, onChange, onReset); });
    return () => { closed = true; off?.(); };
  }
  const es = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
  es.addEventListener('changed', onChange);
  es.addEventListener('reset', onReset);
  return () => es.close();
}

/** Буква или номер для аватарки: «Ребёнок 2» → «2», «Соня» → «С» */
export const initial = (name: string) => /\d+$/.exec(name.trim())?.[0] ?? name.trim()[0] ?? '?';

export function fmt(k: number) {
  const [i, d] = (Math.abs(k) / 100).toFixed(2).split('.');
  return `${k < 0 ? '−' : ''}${i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${d} BYN`;
}
/** +375447778899 → +375 44 777-88-99 */
export const fmtPhone = (p: string) => p.replace(/^\+375(\d{2})(\d{3})(\d{2})(\d{2})$/, '+375 $1 $2-$3-$4');
export const toKop = (s: string | number) => Math.round(parseFloat(String(s).replace(',', '.')) * 100) || 0;
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export function when(iso: string) {
  const d = new Date(iso), now = new Date();
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 864e5);
  if (days === 0) return `Сегодня, ${hm}`;
  if (days === 1) return `Вчера, ${hm}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export const years = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'год' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'года' : 'лет');
export const plural = (n: number, one: string, few: string, many: string) => (n % 10 === 1 && n % 100 !== 11 ? one : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? few : many);

// ---------- устройство ----------
export interface Route { name: string; params?: Record<string, any> }
export interface SheetState { render: (close: () => void) => ReactNode }

interface DeviceCtx {
  token: string;
  userId: string;
  version: number;
  route: Route;
  depth: number;
  push: (name: string, params?: Record<string, any>) => void;
  back: () => void;
  tab: (name: string) => void;
  sheet: (render: SheetState['render']) => void;
  closeSheet: () => void;
  toast: (text: string, err?: boolean) => void;
  /** Выполнить действие API: ошибки показываются тостом, данные перечитываются */
  run: <T>(fn: () => Promise<T>, okText?: string | ((r: T) => string | undefined)) => Promise<T | undefined>;
  call: <T = any>(path: string, body?: unknown, method?: string) => Promise<T>;
  logout: () => void;
}
const Ctx = createContext<DeviceCtx | null>(null);
/** Обработчики кнопки «Назад» по устройствам: true — нажатие обработано */
export const backHandlers = new Map<string, () => boolean>();
export const useDevice = () => useContext(Ctx)!;

export function DeviceProvider({ token, userId, onLogout, children, root }: { token: string; userId: string; onLogout: () => void; children: (p: { route: Route; depth: number; sheet: SheetState | null; toast: { text: string; err: boolean } | null; closeSheet: () => void }) => ReactNode; root: string }) {
  const [stack, setStack] = useState<Route[]>([{ name: root }]);
  const [version, setVersion] = useState(0);
  const [sheetState, setSheet] = useState<SheetState | null>(null);
  const [toastState, setToast] = useState<{ text: string; err: boolean } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const bump = useCallback(() => setVersion(v => v + 1), []);

  useEffect(() => subscribe(token, bump, onLogout), [token, bump, onLogout]);

  const toast = useCallback((text: string, err = false) => {
    setToast({ text, err });
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 2800);
  }, []);
  const call = useCallback(<T,>(path: string, body?: unknown, method?: string) => api<T>(path, { token, body, method }), [token]);
  const run = useCallback(async <T,>(fn: () => Promise<T>, okText?: string | ((r: T) => string | undefined)) => {
    try {
      const r = await fn();
      const t = typeof okText === 'function' ? okText(r) : okText;
      if (t) toast(t);
      bump();
      return r;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { onLogout(); return; }
      toast(e instanceof Error ? e.message : 'Ошибка', true);
      return undefined;
    }
  }, [toast, bump, onLogout]);

  const nav = useRef({ depth: stack.length, sheet: !!sheetState });
  nav.current = { depth: stack.length, sheet: !!sheetState };
  useEffect(() => {
    backHandlers.set(userId, () => {
      if (nav.current.sheet) { setSheet(null); return true; }
      if (nav.current.depth > 1) { setStack(s => s.slice(0, -1)); return true; }
      return false;
    });
    return () => { backHandlers.delete(userId); };
  }, [userId]);

  const value: DeviceCtx = {
    token, userId, version, route: stack[stack.length - 1], depth: stack.length,
    push: (name, params) => { setSheet(null); setStack(s => [...s, { name, params }]); },
    back: () => setStack(s => (s.length > 1 ? s.slice(0, -1) : s)),
    tab: name => { setSheet(null); setStack([{ name }]); },
    sheet: render => setSheet({ render }),
    closeSheet: () => setSheet(null),
    toast, run, call, logout: onLogout,
  };
  return <Ctx.Provider value={value}>{children({ route: value.route, depth: value.depth, sheet: sheetState, toast: toastState, closeSheet: value.closeSheet })}</Ctx.Provider>;
}

/** Загружает данные и перечитывает их при любом изменении в семье */
export function useData<T>(path: string | null): { data: T | null; reload: () => void } {
  const { call, version, logout } = useDevice();
  const [data, setData] = useState<T | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    call<T>(path).then(d => { if (alive) setData(d); }).catch(e => { if (e instanceof ApiError && e.status === 401) logout(); });
    return () => { alive = false; };
  }, [path, version, n, call, logout]);
  return { data, reload: () => setN(x => x + 1) };
}
