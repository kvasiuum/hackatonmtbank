import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { normPhone, startOfMonth, startOfWeek } from '../src/service';

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

  it('в запросах видна сумма', async () => {
    const parent = await login('u_parent');
    const reqs = (await call('GET', '/api/parent/overview', parent)).body.requests;
    expect(reqs.find((x: any) => x.id === 'r_seed1').amount).toBe(500);
    expect(reqs.find((x: any) => x.id === 'r_seed2').amount).toBeNull();
  });

  it('родитель удаляет задание, ребёнок предлагает своё', async () => {
    const kid = await login('u_misha'); const parent = await login('u_parent');
    await call('POST', '/api/child/tasks/k_book/done', kid);
    expect((await call('DELETE', '/api/parent/tasks/k_book', parent)).status).toBe(200);
    const ov = (await call('GET', '/api/parent/overview', parent)).body;
    expect(ov.requests.some((x: any) => x.type === 'task' && x.status === 'pending')).toBe(false);
    expect((await call('DELETE', '/api/parent/tasks/k_balcony', await login('u_anya'))).status).toBe(403);

    const p = await call('POST', '/api/child/requests', kid, { type: 'proposal', title: 'Помыть машину', reward: 700 });
    await call('POST', '/api/parent/requests/' + p.body.id, parent, { approve: true });
    const tasks = (await call('GET', '/api/child/overview', kid)).body.me.tasks;
    expect(tasks.find((t: any) => t.title === 'Помыть машину')).toMatchObject({ reward: 700, status: 'open' });
  });

  it('тариф «Старт»: один ребёнок и без браслета', async () => {
    const parent = await login('u_parent');
    expect((await call('POST', '/api/parent/plan', parent, { tariff: 'start' })).status).toBe(400); // двое детей
    await call('POST', '/api/demo/reset', undefined, { empty: true });
    const p2 = await login('u_parent');
    const ov = (await call('GET', '/api/parent/overview', p2)).body;
    expect(ov.plan.tariff).toBe('start');
    expect(ov.introSeen).toBe(false);
    const child = (age: number, type: string, tariff?: string) => call('POST', '/api/parent/children', p2, {
      name: 'Соня', age, preset: 'normal', consents: { legalRep: true, personalData: true, terms: true, marketing: false },
      card: { type, color: '#E4252F' }, tariff,
    });
    expect((await child(8, 'bracelet')).body.error.code).toBe('tariff_card');
    expect((await child(8, 'sticker')).status).toBe(200);
    expect((await child(10, 'sticker')).body.error.code).toBe('tariff_kids');
    expect((await child(10, 'bracelet', 'plus')).status).toBe(200);
    await call('POST', '/api/parent/intro-seen', p2);
    expect((await call('GET', '/api/parent/overview', p2)).body.introSeen).toBe(true);
  });

  it('плата за «Семья+» не берётся при тратах семьи от 400 BYN', async () => {
    const parent = await login('u_parent');
    const balance = async () => (await call('GET', '/api/parent/overview', parent)).body.parent.balance;
    ctx.db.prepare("UPDATE family_meta SET since = '2020-01-01T00:00:00.000Z'").run();
    const before = await balance();
    ctx.svc.processFees();
    ctx.svc.processFees();
    expect(await balance()).toBe(before - 490); // за прошлый месяц трат в базе нет
    ctx.db.prepare('UPDATE family_meta SET fee_month = NULL').run();
    const lastMonth = new Date(Date.parse(startOfMonth()) - 5 * 24 * 3600_000).toISOString();
    ctx.db.prepare("INSERT INTO transactions VALUES ('t_big','u_parent','Мебель',-50000,'Покупки','card','spend',?)").run(lastMonth);
    ctx.svc.processFees();
    expect(await balance()).toBe(before - 490);
  });

  it('кешбэк недели: ребёнку 7–13 Маничками, подростку в BYN', async () => {
    const kid = await login('u_misha'); const teen = await login('u_anya');
    await call('POST', '/api/child/pay', kid, { merchantId: 'stationery', method: 'card' });
    const me = (await call('GET', '/api/child/overview', kid)).body.me;
    expect(me.cashbackWeek).toEqual({ spent: 420 + 800 + 620, rate: 0.1, expected: 18, unit: 'coins' });
    const t = (await call('GET', '/api/child/overview', teen)).body.me;
    expect(t.cashbackWeek).toEqual({ spent: 480 + 1200, rate: 0.1, expected: 168, unit: 'byn' });
    ctx.svc.processWeeklyCashback(Date.now() + 8 * 24 * 3600_000);
    const after = (await call('GET', '/api/child/overview', kid)).body.me;
    expect(after.balance).toBe(me.balance);
    expect(after.coins).toBe(me.coins + 18);
    expect(after.cashbackWeek.spent).toBe(0);
    expect((await call('GET', '/api/child/overview', teen)).body.me.balance).toBe(t.balance + 168);
  });

  it('вход по номеру: родитель добавил ребёнка по телефону, подросток просится в семью сам', async () => {
    expect(normPhone('+375 (29) 111-22-33')).toBe('+375291112233');
    expect(normPhone('8029 1112233')).toBe('+375291112233');
    expect(normPhone('+7 999 1112233')).toBeNull();
    const parent = await login('u_parent');
    await call('POST', '/api/parent/children', parent, {
      name: 'Петя', age: 12, preset: 'normal', phone: '+375 29 111-22-33',
      consents: { legalRep: true, personalData: true, terms: true, marketing: false }, card: { type: 'sticker', color: '#E4252F' },
    });
    const s = await call('POST', '/api/auth/phone/start', undefined, { phone: '+375291112233' });
    expect(s.body.known).toBe(true);
    expect((await call('POST', '/api/auth/phone/verify', undefined, { phone: '+375291112233', code: '0', pin: '2468' })).status).toBe(400);
    const v = await call('POST', '/api/auth/phone/verify', undefined, { phone: '+375291112233', code: s.body.demoCode, pin: '2468' });
    expect(v.body.role).toBe('child');

    // Подросток без приглашения
    const t = await call('POST', '/api/auth/phone/start', undefined, { phone: '+375447778899' });
    expect(t.body.known).toBe(false);
    const young = await call('POST', '/api/auth/join-request', undefined, { phone: '+375447778899', code: t.body.demoCode, parentPhone: '+375291234567', name: 'Лиза', age: 12, pin: '1357' });
    expect(young.body.error.code).toBe('age');
    const t2 = await call('POST', '/api/auth/phone/start', undefined, { phone: '+375447778899' });
    const jr = await call('POST', '/api/auth/join-request', undefined, { phone: '+375447778899', code: t2.body.demoCode, parentPhone: '+375291234567', name: 'Лиза', age: 16, pin: '1357' });
    expect(jr.status).toBe(200);
    expect((await call('POST', '/api/auth/join-status', undefined, { ticket: jr.body.ticket })).body.status).toBe('pending');
    const ov = (await call('GET', '/api/parent/overview', parent)).body;
    expect(ov.joinRequests).toHaveLength(1);
    const ok = await call('POST', '/api/parent/join-requests/' + ov.joinRequests[0].id, parent, {
      approve: true, consents: { legalRep: true, personalData: true, terms: true, marketing: false },
    });
    expect(ok.status).toBe(200);
    const st = await call('POST', '/api/auth/join-status', undefined, { ticket: jr.body.ticket });
    expect(st.body.status).toBe('approved');
    const me = (await call('GET', '/api/child/overview', st.body.token)).body.me;
    expect(me).toMatchObject({ name: 'Лиза', group: 'teen', phone: '+375447778899', joined: true });
    expect((await call('POST', '/api/auth/login', undefined, { userId: me.id, pin: '1357' })).status).toBe(200);
  });

  it('родитель меняет задание и переводит с другой карты', async () => {
    const parent = await login('u_parent');
    expect((await call('PATCH', '/api/parent/tasks/k_vacuum', parent, { title: 'Пропылесосить всю квартиру', reward: 600 })).status).toBe(200);
    const tasks = (await call('GET', '/api/parent/tasks', parent)).body;
    expect(tasks.find((t: any) => t.id === 'k_vacuum')).toMatchObject({ childId: 'u_misha', title: 'Пропылесосить всю квартиру', reward: 600 });
    expect((await call('PATCH', '/api/parent/tasks/k_trash', parent, { title: 'Мусор', reward: 100 })).status).toBe(400); // уже оплачено

    const cards = (await call('GET', '/api/parent/overview', parent)).body.parent.cards;
    expect(cards.map((c: any) => c.id)).toEqual(['main', 'pc_salary', 'pc_personal', 'pc_halva']);
    expect((await call('POST', '/api/parent/children/u_misha/topup', parent, { amount: 2000, cardId: 'pc_salary' })).body.error.code).toBe('parent_funds');
    expect((await call('POST', '/api/parent/children/u_misha/topup', parent, { amount: 2000, cardId: 'pc_halva' })).status).toBe(200);
    const after = (await call('GET', '/api/parent/overview', parent)).body;
    expect(after.parent.cards.find((c: any) => c.id === 'pc_halva').balance).toBe(31200 - 2000);
    expect(after.parent.balance).toBe(124050);
    expect(after.children.find((k: any) => k.id === 'u_misha').balance).toBe(2340 + 2000);
  });

  it('баланс нигде не уходит в минус', async () => {
    const parent = await login('u_parent'); const kid = await login('u_misha');
    // родитель: одобрение запроса с карты, где не хватает, не проходит и запрос остаётся
    const r = await call('POST', '/api/child/requests', kid, { type: 'money', amount: 2000 });
    const no = await call('POST', `/api/parent/requests/${r.body.id}`, parent, { approve: true, cardId: 'pc_salary' });
    expect(no.body.error.message).toContain('Недостаточно средств');
    expect((await call('POST', `/api/parent/requests/${r.body.id}`, parent, { approve: true, cardId: 'pc_personal' })).status).toBe(200);
    expect((await call('POST', '/api/family/goal', parent, { amount: 5000, cardId: 'pc_salary' })).status).toBe(400);
    expect((await call('POST', '/api/parent/children/u_misha/allowance', parent, { cardId: 'pc_salary' })).status).toBe(200); // 10 BYN из 12.46
    expect((await call('POST', '/api/parent/children/u_misha/allowance', parent, { cardId: 'pc_salary' })).status).toBe(400);
    // ребёнок: копилка, семейная цель, вклад
    const bal = (await call('GET', '/api/child/overview', kid)).body.me.balance;
    expect((await call('POST', '/api/child/goals/g_lego/deposit', kid, { amount: bal + 100 })).body.error.code).toBe('funds');
    expect((await call('POST', '/api/family/goal', kid, { amount: bal + 100 })).status).toBe(400);
    expect((await call('GET', '/api/child/overview', kid)).body.me.balance).toBe(bal);
    // автосписания: пакет не уводит карты в минус
    ctx.db.prepare('UPDATE parents SET balance = 100').run();
    ctx.db.prepare('UPDATE parent_cards SET balance = 100').run();
    ctx.db.prepare("UPDATE family_meta SET since = '2020-01-01T00:00:00.000Z'").run();
    ctx.svc.processFees();
    const cards = (await call('GET', '/api/parent/overview', parent)).body.parent.cards;
    expect(cards.every((c: any) => c.balance === 100)).toBe(true);
  });

  it('общее задание: награду получает тот, кто выполнил первым', async () => {
    const parent = await login('u_parent'); const misha = await login('u_misha'); const anya = await login('u_anya');
    await call('POST', '/api/parent/tasks/shared', parent, { title: 'Вынести мусор', reward: 300 });
    const mine = (tok: string) => call('GET', '/api/child/overview', tok).then(r => r.body.me.tasks.find((t: any) => t.title === 'Вынести мусор'));
    const tm = await mine(misha), ta = await mine(anya);
    expect(tm).toMatchObject({ shared: true, status: 'open' });
    await call('POST', `/api/child/tasks/${ta.id}/done`, anya);
    expect((await mine(misha)).status).toBe('taken');
    expect((await call('POST', `/api/child/tasks/${tm.id}/done`, misha)).status).toBe(400);
    // родитель отклонил — задание снова у всех
    let req = (await call('GET', '/api/parent/overview', parent)).body.requests.find((x: any) => x.type === 'task' && x.status === 'pending');
    await call('POST', '/api/parent/requests/' + req.id, parent, { approve: false });
    expect((await mine(misha)).status).toBe('open');
    await call('POST', `/api/child/tasks/${tm.id}/done`, misha);
    req = (await call('GET', '/api/parent/overview', parent)).body.requests.find((x: any) => x.type === 'task' && x.status === 'pending');
    await call('POST', '/api/parent/requests/' + req.id, parent, { approve: true });
    expect((await mine(misha)).status).toBe('paid');
    expect(await mine(anya)).toBeUndefined();
  });

  it('родитель возвращает себе деньги ребёнка, не больше баланса', async () => {
    const parent = await login('u_parent');
    expect((await call('POST', '/api/parent/children/u_misha/withdraw', parent, { amount: 2341, cardId: 'pc_salary' })).body.error.code).toBe('funds');
    expect((await call('POST', '/api/parent/children/u_misha/withdraw', parent, { amount: 2340, cardId: 'pc_salary' })).status).toBe(200);
    const o = (await call('GET', '/api/parent/overview', parent)).body;
    expect(o.children.find((k: any) => k.id === 'u_misha').balance).toBe(0);
    expect(o.parent.cards.find((c: any) => c.id === 'pc_salary').balance).toBe(1246 + 2340);
  });

  it('перевод другу: по карте всем, по телефону с 14 лет', async () => {
    const parent = await login('u_parent'); const kid = await login('u_misha'); const teen = await login('u_anya');
    await call('PATCH', '/api/parent/children/u_misha/settings', parent, { perms: { p2p: true } });
    expect((await call('POST', '/api/child/transfer', kid, { card: '4111 1111 1111 1112', amount: 100 })).status).toBe(400); // Луна не сходится
    const ok = await call('POST', '/api/child/transfer', kid, { card: '4111 1111 1111 1111', amount: 100 });
    expect(ok.body.status).toBe('approved');
    expect((await call('POST', '/api/child/transfer', kid, { phone: '+375291112233', amount: 100 })).status).toBe(403);
    await call('PATCH', '/api/parent/children/u_anya/settings', parent, { perms: { p2p: true } });
    expect((await call('POST', '/api/child/transfer', teen, { phone: '+375291112233', amount: 100 })).body.status).toBe('approved');
  });

  it('мини-игры награждают раз в день', async () => {
    const kid = await login('u_misha');
    const coins = (await call('GET', '/api/child/overview', kid)).body.me.coins;
    expect((await call('POST', '/api/child/games/memory', kid, { score: 1 })).body).toMatchObject({ rewarded: true, coins: 10 });
    expect((await call('POST', '/api/child/games/memory', kid, { score: 1 })).body.rewarded).toBe(false);
    expect((await call('POST', '/api/child/games/price', kid, { score: 4 })).body).toMatchObject({ rewarded: true, coins: 12 });
    expect((await call('GET', '/api/child/overview', kid)).body.me.coins).toBe(coins + 22);
    expect((await call('POST', '/api/child/games/price', kid, { score: 99 })).status).toBe(400);
  });

  it('подпись, цвет и избранная карта; оплата выбранной картой', async () => {
    const kid = await login('u_misha'); const teen = await login('u_anya');
    const r = await call('PATCH', '/api/cards/c_misha2', kid, { label: 'Для школы', color: '#E4252F', favorite: true });
    expect(r.body).toMatchObject({ id: 'c_misha2', label: 'Для школы', color: '#E4252F', favorite: true });
    expect((await call('PATCH', '/api/cards/c_misha2', teen, { label: 'Чужая' })).status).toBe(403);
    expect((await call('PATCH', '/api/cards/c_misha2', kid, { color: '#123456' })).status).toBe(400);
    const me = (await call('GET', '/api/child/overview', kid)).body.me;
    expect(me.cards[0].id).toBe('c_misha2'); // избранная первой
    const paid = await call('POST', '/api/child/pay', kid, { merchantId: 'canteen', method: 'card' });
    expect(paid.body.text).toContain('•• 9921');
    const byPhys = await call('POST', '/api/child/pay', kid, { merchantId: 'canteen', method: 'card', cardId: 'c_misha1' });
    expect(byPhys.body.text).toContain('•• 4417');
    await call('POST', '/api/cards/c_misha1', kid, { action: 'block' });
    const blocked = await call('POST', '/api/child/pay', kid, { merchantId: 'canteen', method: 'card', cardId: 'c_misha1' });
    expect(blocked.body).toMatchObject({ status: 'declined', title: 'Эта карта не работает' });
  });

  it('Манички родителя: за переводы детям (×2 в «Семья+»), задания и уроки', async () => {
    const parent = await login('u_parent'); const kid = await login('u_misha');
    const coins = async () => (await call('GET', '/api/parent/overview', parent)).body.parent.coins;
    expect(await coins()).toBe(240);
    await call('POST', '/api/parent/children/u_misha/topup', parent, { amount: 1000 }); // 10 BYN → 2 × 2
    expect(await coins()).toBe(244);
    await call('POST', '/api/child/tasks/k_vacuum/done', kid);
    const req = (await call('GET', '/api/parent/overview', parent)).body.requests.find((x: any) => x.type === 'task' && x.status === 'pending');
    await call('POST', '/api/parent/requests/' + req.id, parent, { approve: true }); // 3 BYN → 0, задание +3
    expect(await coins()).toBe(247);
    await call('POST', '/api/child/lessons/save', kid, { answers: [1, 0, 1] });
    expect(await coins()).toBe(249);
  });

  it('страхование и вклад на ребёнка с карты родителя', async () => {
    const parent = await login('u_parent'); const kid = await login('u_misha');
    const ins = await call('POST', '/api/parent/children/u_misha/insurance', parent, { plan: 'sport', cardId: 'pc_halva' });
    expect(ins.body).toMatchObject({ plan: 'sport', price: 245 }); // −30% в «Семья+»
    expect((await call('POST', '/api/parent/children/u_misha/insurance', parent, { plan: 'accident' })).status).toBe(400);
    expect((await call('GET', '/api/child/overview', kid)).body.me.insurance.title).toBe('Спорт и активный отдых');
    ctx.svc.processInsurance(Date.now() + 40 * 24 * 3600_000);
    expect((await call('DELETE', '/api/parent/children/u_misha/insurance', parent)).status).toBe(200);
    expect((await call('POST', '/api/parent/children/u_misha/deposit', parent, { amount: 500 })).body.error.code).toBe('min');
    expect((await call('POST', '/api/parent/children/u_misha/deposit', parent, { amount: 2000, cardId: 'pc_salary' })).body.error.code).toBe('parent_funds');
    await call('POST', '/api/parent/children/u_misha/deposit', parent, { amount: 2000, cardId: 'pc_halva' });
    await call('POST', '/api/parent/children/u_misha/deposit', parent, { amount: 1000 });
    expect((await call('GET', '/api/child/overview', kid)).body.me.deposit.amount).toBe(3000);
    const halva = (await call('GET', '/api/parent/overview', parent)).body.parent.cards.find((c: any) => c.id === 'pc_halva').balance;
    expect(halva).toBe(31200 - 245 - 2000);
  });

  it('оспорить операцию: свою или ребёнка, только списание и один раз', async () => {
    const parent = await login('u_parent'); const kid = await login('u_misha'); const teen = await login('u_anya');
    const op = (await call('GET', '/api/child/overview', kid)).body.me.ops.find((o: any) => o.amount < 0 && o.title === 'Канцтовары');
    const reason = 'Списали дважды';
    expect((await call('POST', '/api/disputes', teen, { txId: op.id, reason })).status).toBe(403);
    expect((await call('POST', '/api/disputes', parent, { txId: op.id, reason: 'просто так' })).status).toBe(400);
    expect((await call('POST', '/api/disputes', parent, { txId: op.id, reason })).status).toBe(200);
    expect((await call('POST', '/api/disputes', kid, { txId: op.id, reason })).body.error.code).toBe('exists');
    expect((await call('GET', '/api/child/overview', kid)).body.me.ops.find((o: any) => o.id === op.id).dispute).toBe('review');
    const income = (await call('GET', '/api/child/overview', kid)).body.me.ops.find((o: any) => o.amount > 0);
    expect((await call('POST', '/api/disputes', kid, { txId: income.id, reason })).body.error.code).toBe('kind');
  });

  it('разбить копилку можно только полную: деньги возвращаются на счёт', async () => {
    const kid = await login('u_misha');
    expect((await call('POST', '/api/child/goals/g_lego/break', kid)).body.error.code).toBe('not_full');
    ctx.db.prepare("UPDATE goals SET saved = target WHERE id = 'g_lego'").run();
    const before = (await call('GET', '/api/child/overview', kid)).body.me.balance;
    expect((await call('POST', '/api/child/goals/g_lego/break', kid)).body.amount).toBe(6000);
    const me = (await call('GET', '/api/child/overview', kid)).body.me;
    expect(me.balance).toBe(before + 6000);
    expect(me.goals.some((g: any) => g.id === 'g_lego')).toBe(false);
  });
});
