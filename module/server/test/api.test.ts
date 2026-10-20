import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { startOfWeek } from '../src/service';

let ctx: ReturnType<typeof buildApp>;
beforeEach(() => { ctx = buildApp({ dbFile: ':memory:', webDist: '/nonexistent' }); });
afterEach(async () => { await ctx.app.close(); });

async function call(method: string, url: string, token?: string, body?: unknown) {
  const res = await ctx.app.inject({ method: method as any, url, payload: body as any, headers: token ? { authorization: `Bearer ${token}` } : {} });
  return { status: res.statusCode, body: res.json() };
}
async function login(userId: string) {
  const r = await call('POST', '/api/auth/login', undefined, { userId, pin: '1111' });
  expect(r.status).toBe(200);
  return r.body.token as string;
}

describe('API модуля «Семья»', () => {
  it('отклоняет неверный смарт-код и запросы без входа', async () => {
    expect((await call('POST', '/api/auth/login', undefined, { userId: 'u_parent', pin: '0000' })).status).toBe(401);
    expect((await call('GET', '/api/parent/overview')).status).toBe(401);
  });

  it('ребёнок не видит родительские методы', async () => {
    const kid = await login('u_misha');
    expect((await call('GET', '/api/parent/overview', kid)).status).toBe(403);
  });

  it('запрос денег: ребёнок просит → родитель одобряет → деньги переводятся', async () => {
    const kid = await login('u_misha'); const parent = await login('u_parent');
    const before = (await call('GET', '/api/child/overview', kid)).body.me.balance;
    const r = await call('POST', '/api/child/requests', kid, { type: 'money', amount: 300, reason: 'Проезд' });
    expect(r.status).toBe(200);
    expect((await call('POST', `/api/parent/requests/${r.body.id}`, parent, { approve: true })).status).toBe(200);
    expect((await call('GET', '/api/child/overview', kid)).body.me.balance).toBe(before + 300);
    expect((await call('POST', `/api/parent/requests/${r.body.id}`, parent, { approve: true })).status).toBe(400);
  });

  it('дорогая покупка ждёт родителя и проходит после одобрения', async () => {
    const kid = await login('u_misha'); const parent = await login('u_parent');
    const d = await call('POST', '/api/child/pay', kid, { merchantId: 'toys', method: 'card' });
    expect(d.body.status).toBe('pending');
    const req = (await call('GET', '/api/parent/overview', parent)).body.requests.find((x: any) => x.type === 'purchase');
    await call('POST', '/api/parent/requests/' + req.id, parent, { approve: true });
    const me = (await call('GET', '/api/child/overview', kid)).body.me;
    expect(me.balance).toBe(2340 - 1490 - 10); // 10 копеек сдачи ушли в копилку
    expect(me.ops.map((o: any) => o.title)).toContain('Магазин игрушек');
    expect(me.goals[0].saved).toBe(4600 + 10);
  });

  it('родитель добавляет ребёнка, ребёнок входит по коду приглашения с новыми настройками', async () => {
    const parent = await login('u_parent');
    const created = await call('POST', '/api/parent/children', parent, {
      name: 'Соня', age: 8, preset: 'normal',
      consents: { legalRep: true, personalData: true, terms: true, marketing: false },
      card: { type: 'bracelet', color: '#E4252F' },
      settings: { cats: { games: true }, perms: { qr: true } },
    });
    expect(created.status).toBe(200);
    const join = await call('POST', '/api/auth/join', undefined, { code: created.body.inviteCode, pin: '2580' });
    expect(join.status).toBe(200);
    const me = (await call('GET', '/api/child/overview', join.body.token)).body.me;
    expect(me.group).toBe('kid');
    expect(me.settings.cats.games).toBe(true);
    expect(me.cards.map((c: any) => [c.type, c.status])).toEqual([['bracelet', 'delivery'], ['virtual', 'active']]);
    expect((await call('POST', '/api/auth/join', undefined, { code: created.body.inviteCode, pin: '1234' })).status).toBe(400);
  });

  it('без обязательных согласий ребёнка добавить нельзя', async () => {
    const parent = await login('u_parent');
    const r = await call('POST', '/api/parent/children', parent, {
      name: 'Соня', age: 8, preset: 'normal', consents: { legalRep: true, personalData: false, terms: true, marketing: false },
      card: { type: 'bracelet', color: '#E4252F' },
    });
    expect(r.status).toBe(400);
  });

  it('потерянная карта: ребёнок блокирует, но разблокировать может только родитель', async () => {
    const kid = await login('u_misha'); const parent = await login('u_parent');
    expect((await call('POST', '/api/cards/c_misha1', kid, { action: 'block' })).status).toBe(200);
    expect((await call('POST', '/api/cards/c_misha1', kid, { action: 'unblock' })).status).toBe(403);
    const paid = await call('POST', '/api/child/pay', kid, { merchantId: 'canteen', method: 'card' });
    expect(paid.body.text).toContain('Виртуальная карта');
    expect((await call('POST', '/api/cards/c_misha1', parent, { action: 'unblock' })).status).toBe(200);
  });

  it('чужой родитель не может управлять ребёнком', async () => {
    const kid = await login('u_anya');
    expect((await call('POST', '/api/cards/c_misha1', kid, { action: 'block' })).status).toBe(403);
  });

  it('задание: ребёнок отмечает → родитель платит награду и начисляет опыт', async () => {
    const kid = await login('u_misha'); const parent = await login('u_parent');
    await call('POST', '/api/child/tasks/k_vacuum/done', kid);
    const req = (await call('GET', '/api/parent/overview', parent)).body.requests.find((x: any) => x.type === 'task');
    await call('POST', '/api/parent/requests/' + req.id, parent, { approve: true });
    const me = (await call('GET', '/api/child/overview', kid)).body.me;
    expect(me.tasks.find((t: any) => t.id === 'k_vacuum').status).toBe('paid');
    expect(me.xp).toBe(180);
  });

  it('урок начисляет награду один раз, новый уровень создаёт предложение родителю', async () => {
    const kid = await login('u_misha'); const parent = await login('u_parent');
    await call('POST', '/api/child/lessons/save', kid, { answers: [1, 0, 1] }); // 140 → 200
    const r = await call('POST', '/api/child/lessons/safe', kid, { answers: [1, 1, 2] }); // 200 → 260, уровень 3
    expect(r.body).toMatchObject({ correct: 3, rewarded: true, level: 3 });
    const again = await call('POST', '/api/child/lessons/safe', kid, { answers: [1, 1, 2] });
    expect(again.body.rewarded).toBe(false);
    const reqs = (await call('GET', '/api/parent/overview', parent)).body.requests;
    expect(reqs.some((x: any) => x.type === 'level' && x.payload.level === 3)).toBe(true);
  });

  it('карманные деньги начисляются раз в неделю', async () => {
    const parent = await login('u_parent');
    ctx.db.prepare('UPDATE children SET allowance_paid_at = ?').run(new Date(Date.parse(startOfWeek()) - 1000).toISOString());
    ctx.svc.processAllowances();
    ctx.svc.processAllowances();
    const kids = (await call('GET', '/api/parent/overview', parent)).body.children;
    expect(kids.find((k: any) => k.id === 'u_misha').balance).toBe(2340 + 1000);
    expect(kids.find((k: any) => k.id === 'u_anya').balance).toBe(8670 + 2500);
  });

  it('родитель может приостановить вход ребёнка в Moby', async () => {
    const parent = await login('u_parent');
    await call('PATCH', '/api/parent/children/u_misha/settings', parent, { mobyAccess: false });
    expect((await call('POST', '/api/auth/login', undefined, { userId: 'u_misha', pin: '1111' })).status).toBe(403);
  });
});
