// HTTP-сервер модуля: Fastify поверх общих маршрутов из routes.ts.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Fastify, { type FastifyReply } from 'fastify';
import fastifyStatic from '@fastify/static';
import { openDb } from './db';
import { AppError } from './service';
import { createApi } from './routes';

export interface AppOptions { dbFile?: string; demo?: boolean; webDist?: string; logger?: boolean }

export function buildApp(opts: AppOptions = {}) {
  const db = openDb(opts.dbFile);
  const listeners = new Map<string, Set<FastifyReply>>();
  const broadcast = (familyId: string | null, event: string) => {
    const sets = familyId ? [listeners.get(familyId) ?? new Set<FastifyReply>()] : [...listeners.values()];
    for (const set of sets) for (const reply of set) reply.raw.write(`event: ${event}\ndata: ${Date.now()}\n\n`);
  };
  const api = createApi(db, { demo: opts.demo ?? true, emit: id => broadcast(id, 'changed'), emitReset: () => broadcast(null, 'reset') });
  const app = Fastify({ logger: opts.logger ?? false });

  app.setErrorHandler((err, _req, reply) => {
    const r = api.errorResponse(err);
    if (r) return reply.status(r.status).send(r.body);
    app.log.error(err);
    return reply.status(500).send({ error: { code: 'internal', message: 'Внутренняя ошибка' } });
  });

  for (const route of api.routes) {
    app.route({
      method: route.method,
      url: route.path,
      handler: async req => api.exec(route, {
        body: req.body,
        params: req.params as Record<string, string>,
        token: req.headers.authorization?.replace(/^Bearer /, ''),
      }),
    });
  }

  // Живые обновления: сервер шлёт «changed», клиент перечитывает данные
  app.get('/api/events', async (req, reply) => {
    const s = api.sessionOf((req.query as { token?: string }).token);
    if (!s) throw new AppError(401, 'unauthorized', 'Нужно войти');
    const familyId = api.svc.familyOfUser(s.userId);
    reply.hijack();
    reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    reply.raw.write('retry: 2000\n\n');
    const set = listeners.get(familyId) ?? new Set();
    set.add(reply); listeners.set(familyId, set);
    const ping = setInterval(() => reply.raw.write(': ping\n\n'), 25_000);
    req.raw.on('close', () => { clearInterval(ping); set.delete(reply); });
  });

  const dist = opts.webDist ?? join(import.meta.dirname, '../../web/dist');
  if (existsSync(dist)) {
    app.register(fastifyStatic, { root: dist });
    app.setNotFoundHandler((req, reply) => req.url.startsWith('/api/') ? reply.status(404).send({ error: { code: 'not_found', message: 'Нет такого метода' } }) : reply.sendFile('index.html'));
  }

  const timer = setInterval(() => api.svc.processAllowances(), 60_000);
  app.addHook('onClose', async () => { clearInterval(timer); db.close(); });
  api.svc.processAllowances();
  return { app, db, svc: api.svc };
}
