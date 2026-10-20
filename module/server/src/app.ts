// HTTP API модуля. Все запросы, кроме входа, требуют Bearer-токен сессии.
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import { z } from 'zod';
import { CARD_COLORS } from './content';
import { type DB, DEMO_PIN, checkPin, hashPin, nowIso, openDb, seed } from './db';
import { AppError, FamilyService } from './service';
import type { Device } from './types';

interface Session { userId: string; role: 'parent' | 'child' }
declare module 'fastify' { interface FastifyRequest { session?: Session } }

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

export interface AppOptions { dbFile?: string; demo?: boolean; webDist?: string; logger?: boolean }

export function buildApp(opts: AppOptions = {}) {
  const db: DB = openDb(opts.dbFile);
  const listeners = new Map<string, Set<FastifyReply>>();
  const emit = (familyId: string) => {
    for (const reply of listeners.get(familyId) ?? []) reply.raw.write(`event: changed\ndata: ${Date.now()}\n\n`);
  };
  const svc = new FamilyService(db, emit);
  const app = Fastify({ logger: opts.logger ?? false });
  const demo = opts.demo ?? true;

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) return reply.status(err.status).send({ error: { code: err.code, message: err.message } });
    if (err instanceof z.ZodError) return reply.status(400).send({ error: { code: 'validation', message: err.issues[0]?.message ?? 'Неверные данные' } });
    app.log.error(err);
    return reply.status(500).send({ error: { code: 'internal', message: 'Внутренняя ошибка' } });
  });

  const sessionOf = (token: string | undefined): Session | undefined => {
    if (!token) return;
    const row = db.prepare('SELECT s.user_id, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?').get(token) as { user_id: string; role: Session['role'] } | undefined;
    return row && { userId: row.user_id, role: row.role };
  };
  const auth = (role?: Session['role']) => async (req: FastifyRequest) => {
    const s = sessionOf(req.headers.authorization?.replace(/^Bearer /, ''));
    if (!s) throw new AppError(401, 'unauthorized', 'Нужно войти');
    if (role && s.role !== role) throw new AppError(403, 'forbidden', 'Недоступно для этой роли');
    req.session = s;
  };
  const me = (req: FastifyRequest) => req.session!;
  const issueSession = (userId: string) => {
    const token = randomBytes(24).toString('base64url');
    db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(token, userId, nowIso());
    return token;
  };
  const ok = { ok: true };

  // ---------- вход ----------
  app.get('/api/health', async () => ({ ok: true }));

  // Список учётных записей семьи для демо-стенда (в продакшене вход идёт через Moby по номеру телефона)
  app.get('/api/auth/devices', async (): Promise<Device[]> => {
    const rows = db.prepare(`SELECT u.id, u.name, u.role, c.grp, c.joined, c.invite_code FROM users u LEFT JOIN children c ON c.user_id = u.id ORDER BY u.role DESC, c.age DESC`).all() as
      { id: string; name: string; role: 'parent' | 'child'; grp: 'kid' | 'teen' | null; joined: number | null; invite_code: string | null }[];
    return rows.map(r => ({ userId: r.id, name: r.name, role: r.role, group: r.grp, joined: r.role === 'parent' || !!r.joined, inviteCode: demo && !r.joined ? r.invite_code : null }));
  });

  app.post('/api/auth/login', async req => {
    const body = z.object({ userId: z.string(), pin }).parse(req.body);
    const u = db.prepare('SELECT u.id, u.role, u.pin_hash, c.settings FROM users u LEFT JOIN children c ON c.user_id = u.id WHERE u.id = ?').get(body.userId) as
      { id: string; role: string; pin_hash: string | null; settings: string | null } | undefined;
    if (!u || !checkPin(body.pin, u.pin_hash)) throw new AppError(401, 'bad_pin', 'Неверный смарт-код');
    if (u.settings && JSON.parse(u.settings).mobyAccess === false) throw new AppError(403, 'access_off', 'Родитель приостановил доступ в Moby');
    return { token: issueSession(u.id), role: u.role };
  });

  // Ребёнок активирует приглашение родителя и задаёт свой смарт-код
  app.post('/api/auth/join', async req => {
    const body = z.object({ code: z.string().trim().toUpperCase(), pin }).parse(req.body);
    const c = db.prepare('SELECT user_id, joined FROM children WHERE invite_code = ?').get(body.code) as { user_id: string; joined: number } | undefined;
    if (!c || c.joined) throw new AppError(400, 'bad_code', 'Код приглашения не найден или уже использован');
    db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashPin(body.pin), c.user_id);
    db.prepare('UPDATE children SET joined = 1 WHERE user_id = ?').run(c.user_id);
    emit(svc.familyOfUser(c.user_id));
    return { token: issueSession(c.user_id), role: 'child' };
  });

  app.post('/api/auth/logout', { preHandler: auth() }, async req => {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(req.headers.authorization!.replace(/^Bearer /, ''));
    return ok;
  });

  // Живые обновления: сервер шлёт «changed», клиент перечитывает данные
  app.get('/api/events', async (req, reply) => {
    const s = sessionOf((req.query as { token?: string }).token);
    if (!s) throw new AppError(401, 'unauthorized', 'Нужно войти');
    const familyId = svc.familyOfUser(s.userId);
    reply.hijack();
    reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    reply.raw.write('retry: 2000\n\n');
    const set = listeners.get(familyId) ?? new Set();
    set.add(reply); listeners.set(familyId, set);
    const ping = setInterval(() => reply.raw.write(': ping\n\n'), 25_000);
    req.raw.on('close', () => { clearInterval(ping); set.delete(reply); });
  });

  // ---------- родитель ----------
  const P = { preHandler: auth('parent') };
  app.get('/api/parent/overview', P, async req => svc.parentOverview(me(req).userId));
  app.get('/api/parent/children/:id', P, async req => svc.childForParent(me(req).userId, (req.params as { id: string }).id));
  app.post('/api/parent/children', P, async req => {
    const body = z.object({
      name: z.string().trim().min(2).max(20),
      age: z.number().int().min(7).max(17),
      consents: z.object({ legalRep: z.boolean(), personalData: z.boolean(), terms: z.boolean(), marketing: z.boolean() }),
      card: z.object({ type: z.enum(['plastic', 'sticker', 'bracelet']), color: cardColor }),
      preset: z.enum(['strict', 'normal', 'free']),
      settings: settingsPatch.optional(),
    }).parse(req.body);
    return svc.addChild(me(req).userId, body as Parameters<FamilyService['addChild']>[1]);
  });
  app.patch('/api/parent/children/:id/settings', P, async req => svc.updateSettings(me(req).userId, (req.params as { id: string }).id, settingsPatch.parse(req.body)));
  app.post('/api/parent/children/:id/topup', P, async req => { svc.topup(me(req).userId, (req.params as { id: string }).id, z.object({ amount: money }).parse(req.body).amount); return ok; });
  app.post('/api/parent/children/:id/allowance', P, async req => { svc.payAllowanceNow(me(req).userId, (req.params as { id: string }).id); return ok; });
  app.post('/api/parent/children/:id/cards', P, async req => {
    const b = z.object({ type: z.enum(['plastic', 'sticker', 'bracelet', 'virtual']), color: cardColor }).parse(req.body);
    return svc.issueCard({ id: me(req).userId, role: 'parent' }, (req.params as { id: string }).id, b.type, b.color);
  });
  app.post('/api/parent/children/:id/reissue', P, async req => { svc.reissue(me(req).userId, (req.params as { id: string }).id); return ok; });
  app.post('/api/parent/children/:id/tasks', P, async req => {
    const b = z.object({ title: z.string().trim().min(2).max(60), reward: money }).parse(req.body);
    svc.createTask(me(req).userId, (req.params as { id: string }).id, b.title, b.reward); return ok;
  });
  app.post('/api/parent/requests/:id', P, async req => {
    svc.resolveRequest(me(req).userId, (req.params as { id: string }).id, z.object({ approve: z.boolean() }).parse(req.body).approve); return ok;
  });

  // ---------- общее ----------
  const A = { preHandler: auth() };
  app.post('/api/cards/:id', A, async req => {
    const s = me(req);
    svc.cardAction({ id: s.userId, role: s.role }, (req.params as { id: string }).id, z.object({ action: z.enum(['block', 'unblock', 'activate', 'close']) }).parse(req.body).action);
    return ok;
  });
  app.post('/api/family/goal', A, async req => {
    const s = me(req); svc.contributeFamilyGoal({ id: s.userId, role: s.role }, z.object({ amount: money }).parse(req.body).amount); return ok;
  });

  // ---------- ребёнок ----------
  const C = { preHandler: auth('child') };
  const cid = (req: FastifyRequest) => me(req).userId;
  app.get('/api/child/overview', C, async req => svc.childOverview(cid(req)));
  app.post('/api/child/requests', C, async req => {
    const b = z.discriminatedUnion('type', [
      z.object({ type: z.literal('money'), amount: money, reason: z.string().max(80).optional() }),
      z.object({ type: z.literal('perm'), key: z.enum(['cats.online', 'cats.games', 'cats.cash', 'cats.fastfood', 'perms.qr', 'perms.goals', 'perms.erip', 'perms.p2p', 'perms.subs', 'perms.newCards', 'perms.deposit']), reason: z.string().max(80).optional() }),
      z.object({ type: z.literal('card'), cardType: z.enum(['plastic', 'sticker', 'bracelet', 'virtual']), color: cardColor, reason: z.string().max(80).optional() }),
      z.object({ type: z.literal('limit'), day: money, reason: z.string().max(80).optional() }),
      z.object({ type: z.literal('goal'), goalId: z.string(), amount: money, reason: z.string().max(80).optional() }),
    ]).parse(req.body);
    const { type, reason, ...payload } = b;
    return { id: svc.createRequest(cid(req), type, payload, reason?.trim() || null) };
  });
  app.post('/api/child/pay', C, async req => {
    const b = z.object({ merchantId: z.string(), method: z.enum(['card', 'qr']) }).parse(req.body);
    return svc.payMerchant(cid(req), b.merchantId, b.method);
  });
  app.post('/api/child/erip', C, async req => { const b = z.object({ serviceId: z.string(), amount: money }).parse(req.body); return svc.payErip(cid(req), b.serviceId, b.amount); });
  app.post('/api/child/transfer', C, async req => {
    const b = z.object({ phone: z.string().regex(/^\+375\s?\(?\d{2}\)?\s?\d{3}-?\d{2}-?\d{2}$/, 'Номер в формате +375 (29) 123-45-67'), amount: money }).parse(req.body);
    return svc.transfer(cid(req), b.phone, b.amount);
  });
  app.post('/api/child/cards', C, async req => { const b = z.object({ color: cardColor }).parse(req.body); return svc.issueCard({ id: cid(req), role: 'child' }, cid(req), 'virtual', b.color); });
  app.post('/api/child/tasks/:id/done', C, async req => { svc.taskDone(cid(req), (req.params as { id: string }).id); return ok; });
  app.post('/api/child/goals', C, async req => {
    const b = z.object({ title: z.string().trim().min(2).max(30), icon: z.string().max(30), target: money }).parse(req.body);
    svc.createGoal(cid(req), b.title, b.icon, b.target); return ok;
  });
  app.post('/api/child/goals/:id/deposit', C, async req => svc.depositGoal(cid(req), (req.params as { id: string }).id, z.object({ amount: money }).parse(req.body).amount));
  app.post('/api/child/lessons/:id', C, async req => svc.completeLesson(cid(req), (req.params as { id: string }).id, z.object({ answers: z.array(z.number().int()) }).parse(req.body).answers));
  app.post('/api/child/fraud', C, async req => svc.completeFraud(cid(req), z.object({ answers: z.array(z.boolean()) }).parse(req.body).answers));
  app.post('/api/child/subscriptions/:id', C, async req => { svc.setSubscription(cid(req), (req.params as { id: string }).id, z.object({ active: z.boolean() }).parse(req.body).active); return ok; });
  app.post('/api/child/deposit', C, async req => { const b = z.object({ action: z.enum(['open', 'topup']), amount: money }).parse(req.body); svc.deposit(cid(req), b.action, b.amount); return ok; });
  app.post('/api/child/income-to-goal', C, async req => { const b = z.object({ goalId: z.string(), amount: money }).parse(req.body); svc.incomeToGoal(cid(req), b.goalId, b.amount); return ok; });

  // ---------- демо-стенд ----------
  if (demo) {
    app.post('/api/demo/reset', async req => {
      const empty = z.object({ empty: z.boolean().default(false) }).parse(req.body ?? {}).empty;
      db.exec(`DELETE FROM sessions; DELETE FROM feed; DELETE FROM deposits; DELETE FROM subscriptions; DELETE FROM goals; DELETE FROM tasks;
        DELETE FROM transactions; DELETE FROM requests; DELETE FROM cards; DELETE FROM consents; DELETE FROM children; DELETE FROM families; DELETE FROM parents; DELETE FROM users;`);
      seed(db);
      if (empty) db.exec(`DELETE FROM feed; DELETE FROM deposits; DELETE FROM subscriptions; DELETE FROM goals; DELETE FROM tasks; DELETE FROM requests; DELETE FROM cards; DELETE FROM consents;
        DELETE FROM transactions WHERE user_id IN (SELECT user_id FROM children); DELETE FROM children; DELETE FROM users WHERE role = 'child';`);
      for (const set of listeners.values()) for (const r of set) r.raw.write('event: reset\ndata: 1\n\n');
      return { ok: true, pin: DEMO_PIN };
    });
  }

  const dist = opts.webDist ?? join(import.meta.dirname, '../../web/dist');
  if (existsSync(dist)) {
    app.register(fastifyStatic, { root: dist });
    app.setNotFoundHandler((req, reply) => req.url.startsWith('/api/') ? reply.status(404).send({ error: { code: 'not_found', message: 'Нет такого метода' } }) : reply.sendFile('index.html'));
  }

  const timer = setInterval(() => svc.processAllowances(), 60_000);
  app.addHook('onClose', async () => { clearInterval(timer); db.close(); });
  svc.processAllowances();
  return { app, db, svc };
}
