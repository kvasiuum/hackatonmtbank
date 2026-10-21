// Маршруты API без привязки к HTTP-серверу. Их используют и Fastify (app.ts),
// и браузерная сборка для GitHub Pages, поэтому поведение одинаковое.
import { z } from 'zod';
import { CARD_COLORS } from './content';
import { type DB, DEMO_PIN, TABLES, checkPin, hashPin, nowIso, seed } from './schema';
import { platform } from './platform';
import { AppError, FamilyService, normPhone } from './service';
import type { Device } from './types';

export interface Session { userId: string; role: 'parent' | 'child' }
export interface ApiRequest { body: unknown; params: Record<string, string>; token?: string; session?: Session }
export interface RouteDef { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; path: string; role?: 'parent' | 'child' | 'any'; handler: (req: ApiRequest) => unknown }

const money = z.number().int().positive().max(10_000_00); // до 10 000 BYN за операцию
const pin = z.string().regex(/^\d{4}$/, 'Смарт-код — 4 цифры');
const cardColor = z.string().refine(c => CARD_COLORS.includes(c), 'Неизвестный цвет карты');
const settingsPatch = z.object({
  limits: z.object({ day: money, month: money }).partial().optional(),
  confirmAbove: money.optional(),
  cats: z.object({ online: z.boolean(), games: z.boolean(), cash: z.boolean(), fastfood: z.boolean() }).partial().optional(),
  perms: z.object({ qr: z.boolean(), goals: z.boolean(), erip: z.boolean(), p2p: z.boolean(), deposit: z.boolean(), subs: z.boolean(), newCards: z.boolean() }).partial().optional(),
  allowance: z.object({ on: z.boolean(), amount: money }).partial().optional(),
  parentBonus: z.boolean().optional(),
  roundup: z.boolean().optional(),
  mobyAccess: z.boolean().optional(),
}).strict();
const reason = z.string().max(80).optional();
/** Номер карты: 16 цифр и контрольная сумма Луна */
export function luhn(n: string) {
  if (!/^\d{16}$/.test(n)) return false;
  let sum = 0;
  for (let i = 0; i < 16; i++) { let d = Number(n[15 - i]); if (i % 2) { d *= 2; if (d > 9) d -= 9; } sum += d; }
  return sum % 10 === 0;
}
const phone = z.string().transform((v, ctx) => normPhone(v) ?? (ctx.addIssue({ code: 'custom', message: 'Номер в формате +375 (29) 123-45-67' }), z.NEVER));
const consents = z.object({ legalRep: z.boolean(), personalData: z.boolean(), terms: z.boolean(), marketing: z.boolean() });
const preset = z.enum(['strict', 'normal', 'free']);
/** Карта родителя, с которой списываем; по умолчанию основная */
const cardId = z.string().max(40).optional();
const cardOf = (body: unknown) => z.object({ cardId }).parse(body ?? {}).cardId;

export interface ApiOptions { demo: boolean; emit: (familyId: string) => void; emitReset: () => void }

export function createApi(db: DB, opts: ApiOptions) {
  const svc = new FamilyService(db, opts.emit);
  const ok = { ok: true };

  const sessionOf = (token: string | undefined): Session | undefined => {
    if (!token) return;
    const row = db.prepare('SELECT s.user_id, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?').get(token) as { user_id: string; role: Session['role'] } | undefined;
    return row && { userId: row.user_id, role: row.role };
  };
  const issueSession = (userId: string) => {
    const token = platform().randomHex(24);
    db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(token, userId, nowIso());
    return token;
  };
  const me = (r: ApiRequest) => r.session!;
  // Коды из SMS живут 5 минут. В демо код показывается на экране вместо отправки SMS
  const otps = new Map<string, { code: string; exp: number }>();
  // Код сгорает только после успешного входа, чтобы ошибка в анкете не заставляла запрашивать SMS заново
  const checkOtp = (ph: string, code: string) => {
    const o = otps.get(ph);
    if (!o || o.exp < Date.now() || o.code !== code) throw new AppError(400, 'bad_otp', 'Неверный или устаревший код из SMS');
  };
  const id = (r: ApiRequest) => r.params.id;

  const routes: RouteDef[] = [
    { method: 'GET', path: '/api/health', handler: () => ok },

    // Учётные записи семьи для демо-стенда (в продакшене вход идёт через Moby по номеру телефона)
    { method: 'GET', path: '/api/auth/devices', handler: (): Device[] => {
      const rows = db.prepare(`SELECT u.id, u.name, u.role, c.grp, c.joined, c.invite_code FROM users u LEFT JOIN children c ON c.user_id = u.id ORDER BY u.role DESC, c.age DESC`).all() as
        { id: string; name: string; role: 'parent' | 'child'; grp: 'kid' | 'teen' | null; joined: number | null; invite_code: string | null }[];
      return rows.map(r => ({ userId: r.id, name: r.name, role: r.role, group: r.grp, joined: r.role === 'parent' || !!r.joined, inviteCode: opts.demo && !r.joined ? r.invite_code : null }));
    } },
    { method: 'POST', path: '/api/auth/login', handler: r => {
      const b = z.object({ userId: z.string(), pin }).parse(r.body);
      const u = db.prepare('SELECT u.id, u.role, u.pin_hash, c.settings FROM users u LEFT JOIN children c ON c.user_id = u.id WHERE u.id = ?').get(b.userId) as
        { id: string; role: string; pin_hash: string | null; settings: string | null } | undefined;
      if (!u || !checkPin(b.pin, u.pin_hash)) throw new AppError(401, 'bad_pin', 'Неверный смарт-код');
      if (u.settings && JSON.parse(u.settings).mobyAccess === false) throw new AppError(403, 'access_off', 'Родитель приостановил доступ в Moby');
      return { token: issueSession(u.id), role: u.role };
    } },
    // Ребёнок активирует приглашение родителя и задаёт свой смарт-код
    { method: 'POST', path: '/api/auth/join', handler: r => {
      const b = z.object({ code: z.string().trim().toUpperCase(), pin }).parse(r.body);
      const c = db.prepare('SELECT user_id, joined FROM children WHERE invite_code = ?').get(b.code) as { user_id: string; joined: number } | undefined;
      if (!c || c.joined) throw new AppError(400, 'bad_code', 'Код приглашения не найден или уже использован');
      db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashPin(b.pin), c.user_id);
      db.prepare('UPDATE children SET joined = 1 WHERE user_id = ?').run(c.user_id);
      opts.emit(svc.familyOfUser(c.user_id));
      return { token: issueSession(c.user_id), role: 'child' };
    } },
    // Вход по номеру телефона: Moby присылает код в SMS
    { method: 'POST', path: '/api/auth/phone/start', handler: r => {
      const ph = z.object({ phone }).parse(r.body).phone;
      const code = String(1000 + (parseInt(platform().randomHex(2), 16) % 9000));
      otps.set(ph, { code, exp: Date.now() + 5 * 60_000 });
      const u = svc.userByPhone(ph);
      return { known: !!u, demoCode: opts.demo ? code : undefined };
    } },
    // Номер уже в Moby (родитель добавил ребёнка по номеру): код из SMS + новый смарт-код
    { method: 'POST', path: '/api/auth/phone/verify', handler: r => {
      const b = z.object({ phone, code: z.string(), pin }).parse(r.body);
      const u = svc.userByPhone(b.phone);
      if (!u) throw new AppError(404, 'unknown_phone', 'Номер не найден в Moby');
      const c = db.prepare('SELECT settings FROM children WHERE user_id = ?').get(u.id) as { settings: string } | undefined;
      if (c && JSON.parse(c.settings).mobyAccess === false) throw new AppError(403, 'access_off', 'Родитель приостановил доступ в Moby');
      checkOtp(b.phone, b.code);
      db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashPin(b.pin), u.id);
      if (c) db.prepare('UPDATE children SET joined = 1 WHERE user_id = ?').run(u.id);
      otps.delete(b.phone);
      opts.emit(svc.familyOfUser(u.id));
      return { token: issueSession(u.id), role: u.role, userId: u.id };
    } },
    // Подросток 14+ без приглашения просится в семью по номеру родителя
    { method: 'POST', path: '/api/auth/join-request', handler: r => {
      const b = z.object({ phone, code: z.string(), parentPhone: phone, name: z.string().trim().min(2).max(20), age: z.number().int().min(7).max(17), pin }).parse(r.body);
      checkOtp(b.phone, b.code);
      const res = svc.createJoinRequest(b);
      otps.delete(b.phone);
      return res;
    } },
    { method: 'POST', path: '/api/auth/join-status', handler: r => {
      const j = svc.joinStatus(z.object({ ticket: z.string() }).parse(r.body).ticket);
      return j.status === 'approved' && j.child_id ? { status: j.status, token: issueSession(j.child_id), role: 'child', userId: j.child_id } : { status: j.status };
    } },
    { method: 'POST', path: '/api/auth/logout', role: 'any', handler: r => { db.prepare('DELETE FROM sessions WHERE token = ?').run(r.token!); return ok; } },

    // ---------- родитель ----------
    { method: 'GET', path: '/api/parent/overview', role: 'parent', handler: r => svc.parentOverview(me(r).userId) },
    { method: 'GET', path: '/api/parent/children/:id', role: 'parent', handler: r => svc.childForParent(me(r).userId, id(r)) },
    { method: 'POST', path: '/api/parent/children', role: 'parent', handler: r => {
      const b = z.object({
        name: z.string().trim().min(2).max(20),
        age: z.number().int().min(7).max(17),
        consents,
        card: z.object({ type: z.enum(['plastic', 'sticker', 'bracelet']), color: cardColor }).optional(),
        preset,
        settings: settingsPatch.optional(),
        phone: phone.nullish(),
        tariff: z.enum(['start', 'plus']).optional(),
      }).parse(r.body);
      return svc.addChild(me(r).userId, b as Parameters<FamilyService['addChild']>[1]);
    } },
    { method: 'PATCH', path: '/api/parent/children/:id/settings', role: 'parent', handler: r => svc.updateSettings(me(r).userId, id(r), settingsPatch.parse(r.body)) },
    { method: 'POST', path: '/api/parent/children/:id/topup', role: 'parent', handler: r => {
      const b = z.object({ amount: money, cardId }).parse(r.body);
      svc.topup(me(r).userId, id(r), b.amount, b.cardId); return ok;
    } },
    { method: 'POST', path: '/api/parent/children/:id/allowance', role: 'parent', handler: r => { svc.payAllowanceNow(me(r).userId, id(r), cardOf(r.body)); return ok; } },
    { method: 'POST', path: '/api/parent/children/:id/cards', role: 'parent', handler: r => {
      const b = z.object({ type: z.enum(['plastic', 'sticker', 'bracelet', 'virtual']), color: cardColor }).parse(r.body);
      return svc.issueCard({ id: me(r).userId, role: 'parent' }, id(r), b.type, b.color);
    } },
    { method: 'POST', path: '/api/parent/children/:id/reissue', role: 'parent', handler: r => { svc.reissue(me(r).userId, id(r)); return ok; } },
    { method: 'POST', path: '/api/parent/children/:id/tasks', role: 'parent', handler: r => {
      const b = z.object({ title: z.string().trim().min(2).max(60), reward: money }).parse(r.body);
      svc.createTask(me(r).userId, id(r), b.title, b.reward); return ok;
    } },
    { method: 'POST', path: '/api/parent/tasks/shared', role: 'parent', handler: r => {
      const b = z.object({ title: z.string().trim().min(2).max(60), reward: money }).parse(r.body);
      svc.createSharedTask(me(r).userId, b.title, b.reward); return ok;
    } },
    { method: 'POST', path: '/api/parent/children/:id/insurance', role: 'parent', handler: r => {
      const b = z.object({ plan: z.enum(['accident', 'sport']), cardId }).parse(r.body);
      return svc.buyInsurance(me(r).userId, id(r), b.plan, b.cardId);
    } },
    { method: 'DELETE', path: '/api/parent/children/:id/insurance', role: 'parent', handler: r => { svc.cancelInsurance(me(r).userId, id(r)); return ok; } },
    { method: 'POST', path: '/api/parent/children/:id/deposit', role: 'parent', handler: r => {
      const b = z.object({ amount: money, cardId }).parse(r.body);
      svc.depositForChild(me(r).userId, id(r), b.amount, b.cardId); return ok;
    } },
    { method: 'POST', path: '/api/disputes', role: 'any', handler: r => {
      const b = z.object({ txId: z.string().max(40), reason: z.string().max(80) }).parse(r.body);
      svc.openDispute({ id: me(r).userId, role: me(r).role }, b.txId, b.reason); return ok;
    } },
    { method: 'POST', path: '/api/parent/children/:id/withdraw', role: 'parent', handler: r => {
      const b = z.object({ amount: money, cardId }).parse(r.body);
      svc.withdraw(me(r).userId, id(r), b.amount, b.cardId); return ok;
    } },
    { method: 'GET', path: '/api/parent/tasks', role: 'parent', handler: r => svc.parentTasks(me(r).userId) },
    { method: 'PATCH', path: '/api/parent/tasks/:id', role: 'parent', handler: r => {
      const b = z.object({ title: z.string().trim().min(2).max(60), reward: money }).parse(r.body);
      svc.updateTask(me(r).userId, id(r), b.title, b.reward); return ok;
    } },
    { method: 'DELETE', path: '/api/parent/tasks/:id', role: 'parent', handler: r => { svc.deleteTask(me(r).userId, id(r)); return ok; } },
    { method: 'POST', path: '/api/parent/plan', role: 'parent', handler: r => svc.setTariff(me(r).userId, z.object({ tariff: z.enum(['start', 'plus']) }).parse(r.body).tariff) },
    { method: 'POST', path: '/api/parent/intro-seen', role: 'parent', handler: r => { svc.markIntroSeen(me(r).userId); return ok; } },
    { method: 'POST', path: '/api/parent/join-requests/:id', role: 'parent', handler: r => {
      const b = z.object({ approve: z.boolean(), consents: consents.optional(), preset: preset.optional() }).parse(r.body);
      return svc.resolveJoinRequest(me(r).userId, id(r), b);
    } },
    { method: 'POST', path: '/api/parent/requests/:id', role: 'parent', handler: r => {
      const b = z.object({ approve: z.boolean(), cardId }).parse(r.body);
      svc.resolveRequest(me(r).userId, id(r), b.approve, b.cardId); return ok;
    } },

    // ---------- общее ----------
    { method: 'PATCH', path: '/api/cards/:id', role: 'any', handler: r => {
      const b = z.object({ label: z.string().max(20).nullable().optional(), color: cardColor.optional(), favorite: z.boolean().optional() }).strict().parse(r.body);
      return svc.updateCard({ id: me(r).userId, role: me(r).role }, id(r), b);
    } },
    { method: 'POST', path: '/api/cards/:id', role: 'any', handler: r => {
      svc.cardAction({ id: me(r).userId, role: me(r).role }, id(r), z.object({ action: z.enum(['block', 'unblock', 'activate', 'close']) }).parse(r.body).action); return ok;
    } },
    { method: 'POST', path: '/api/family/goal', role: 'any', handler: r => {
      const b = z.object({ amount: money, cardId }).parse(r.body);
      svc.contributeFamilyGoal({ id: me(r).userId, role: me(r).role }, b.amount, b.cardId); return ok;
    } },

    // ---------- ребёнок ----------
    { method: 'GET', path: '/api/child/overview', role: 'child', handler: r => svc.childOverview(me(r).userId) },
    { method: 'POST', path: '/api/child/requests', role: 'child', handler: r => {
      const b = z.discriminatedUnion('type', [
        z.object({ type: z.literal('money'), amount: money, reason }),
        z.object({ type: z.literal('perm'), key: z.enum(['cats.online', 'cats.games', 'cats.cash', 'cats.fastfood', 'perms.qr', 'perms.goals', 'perms.erip', 'perms.p2p', 'perms.subs', 'perms.newCards', 'perms.deposit']), reason }),
        z.object({ type: z.literal('card'), cardType: z.enum(['plastic', 'sticker', 'bracelet', 'virtual']), color: cardColor, reason }),
        z.object({ type: z.literal('limit'), day: money, reason }),
        z.object({ type: z.literal('goal'), goalId: z.string(), amount: money, reason }),
        z.object({ type: z.literal('proposal'), title: z.string().trim().min(2).max(60), reward: money, reason }),
      ]).parse(r.body);
      const { type, reason: why, ...payload } = b;
      return { id: svc.createRequest(me(r).userId, type, payload, why?.trim() || null) };
    } },
    { method: 'POST', path: '/api/child/pay', role: 'child', handler: r => {
      const b = z.object({ merchantId: z.string(), method: z.enum(['card', 'qr']), cardId: z.string().max(40).optional() }).parse(r.body);
      return svc.payMerchant(me(r).userId, b.merchantId, b.method, b.cardId);
    } },
    { method: 'POST', path: '/api/child/erip', role: 'child', handler: r => { const b = z.object({ serviceId: z.string(), amount: money }).parse(r.body); return svc.payErip(me(r).userId, b.serviceId, b.amount); } },
    { method: 'POST', path: '/api/child/transfer', role: 'child', handler: r => {
      const b = z.object({
        amount: money,
        phone: z.string().regex(/^\+375\s?\(?\d{2}\)?\s?\d{3}-?\d{2}-?\d{2}$/, 'Номер в формате +375 (29) 123-45-67').optional(),
        card: z.string().transform(v => v.replace(/\D/g, '')).refine(luhn, 'Проверьте номер карты: 16 цифр').optional(),
      }).refine(x => !!x.phone !== !!x.card, 'Укажите номер карты или телефона').parse(r.body);
      return svc.transfer(me(r).userId, b.card ? { card: b.card } : { phone: b.phone! }, b.amount);
    } },
    { method: 'POST', path: '/api/child/cards', role: 'child', handler: r => { const b = z.object({ color: cardColor }).parse(r.body); return svc.issueCard({ id: me(r).userId, role: 'child' }, me(r).userId, 'virtual', b.color); } },
    { method: 'POST', path: '/api/child/tasks/:id/done', role: 'child', handler: r => { svc.taskDone(me(r).userId, id(r)); return ok; } },
    { method: 'POST', path: '/api/child/goals', role: 'child', handler: r => {
      const b = z.object({ title: z.string().trim().min(2).max(30), icon: z.string().max(30), target: money }).parse(r.body);
      svc.createGoal(me(r).userId, b.title, b.icon, b.target); return ok;
    } },
    { method: 'POST', path: '/api/child/goals/:id/break', role: 'child', handler: r => svc.breakGoal(me(r).userId, id(r)) },
    { method: 'POST', path: '/api/child/goals/:id/deposit', role: 'child', handler: r => svc.depositGoal(me(r).userId, id(r), z.object({ amount: money }).parse(r.body).amount) },
    { method: 'POST', path: '/api/child/lessons/:id', role: 'child', handler: r => svc.completeLesson(me(r).userId, id(r), z.object({ answers: z.array(z.number().int()) }).parse(r.body).answers) },
    { method: 'POST', path: '/api/child/games/:id', role: 'child', handler: r => {
      const game = z.enum(['memory', 'price']).parse(id(r));
      return svc.playGame(me(r).userId, game, z.object({ score: z.number().int().min(0).max(game === 'price' ? 6 : 1) }).parse(r.body).score);
    } },
    { method: 'POST', path: '/api/child/fraud', role: 'child', handler: r => svc.completeFraud(me(r).userId, z.object({ answers: z.array(z.boolean()) }).parse(r.body).answers) },
    { method: 'POST', path: '/api/child/subscriptions/:id', role: 'child', handler: r => { svc.setSubscription(me(r).userId, id(r), z.object({ active: z.boolean() }).parse(r.body).active); return ok; } },
    { method: 'POST', path: '/api/child/deposit', role: 'child', handler: r => { const b = z.object({ action: z.enum(['open', 'topup']), amount: money }).parse(r.body); svc.deposit(me(r).userId, b.action, b.amount); return ok; } },
    { method: 'POST', path: '/api/child/income-to-goal', role: 'child', handler: r => { const b = z.object({ goalId: z.string(), amount: money }).parse(r.body); svc.incomeToGoal(me(r).userId, b.goalId, b.amount); return ok; } },
  ];

  if (opts.demo) {
    routes.push({ method: 'POST', path: '/api/demo/reset', handler: r => {
      const empty = z.object({ empty: z.boolean().default(false) }).parse(r.body ?? {}).empty;
      db.exec(TABLES.map(t => `DELETE FROM ${t};`).join(' '));
      seed(db);
      // Новая семья: детей нет, пакет «Старт», рассказ о новинке ещё не показан
      if (empty) db.exec(`DELETE FROM feed; DELETE FROM partner_spend; DELETE FROM deposits; DELETE FROM subscriptions; DELETE FROM goals; DELETE FROM tasks; DELETE FROM requests; DELETE FROM cards; DELETE FROM consents;
        DELETE FROM transactions WHERE user_id IN (SELECT user_id FROM children); DELETE FROM children; DELETE FROM users WHERE role = 'child';
        UPDATE family_meta SET tariff = 'start', intro_seen = 0;`);
      otps.clear();
      opts.emitReset();
      return { ok: true, pin: DEMO_PIN };
    } });
  }

  /** Проверка доступа и вызов обработчика */
  function exec(route: RouteDef, req: ApiRequest) {
    if (route.role) {
      const s = sessionOf(req.token);
      if (!s) throw new AppError(401, 'unauthorized', 'Нужно войти');
      if (route.role !== 'any' && s.role !== route.role) throw new AppError(403, 'forbidden', 'Недоступно для этой роли');
      req.session = s;
    }
    return route.handler(req);
  }

  /** Ответ об ошибке в едином формате */
  function errorResponse(err: unknown): { status: number; body: { error: { code: string; message: string } } } | null {
    if (err instanceof AppError) return { status: err.status, body: { error: { code: err.code, message: err.message } } };
    if (err instanceof z.ZodError) return { status: 400, body: { error: { code: 'validation', message: err.issues[0]?.message ?? 'Неверные данные' } } };
    return null;
  }

  /** Диспетчер для транспорта без HTTP-сервера (браузерная сборка) */
  function handle(method: string, path: string, body: unknown, token?: string): { status: number; body: unknown } {
    for (const route of routes) {
      if (route.method !== method) continue;
      const params = matchPath(route.path, path);
      if (!params) continue;
      try { return { status: 200, body: exec(route, { body, params, token }) }; }
      catch (e) { const r = errorResponse(e); if (r) return r; console.error(e); return { status: 500, body: { error: { code: 'internal', message: 'Внутренняя ошибка' } } }; }
    }
    return { status: 404, body: { error: { code: 'not_found', message: 'Нет такого метода' } } };
  }

  return { svc, routes, exec, handle, errorResponse, sessionOf };
}

function matchPath(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/'), b = path.split('?')[0].split('/');
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}
