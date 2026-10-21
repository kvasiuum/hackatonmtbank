// Бизнес-логика модуля «Семья». Маршруты API только проверяют вход и вызывают эти методы.
import { authorize, payingCard, type PayInput } from './domain/authorize';
import { fmt } from './domain/money';
import {
  AVATAR_COLORS, BYN, CARD_TYPES, CATEGORY_NAMES, DEPOSIT_RATE, ERIP_SERVICES, FRAUD_CASES, FRAUD_REWARD_PER_ANSWER,
  LESSONS, LESSON_REWARD, MAX_CARDS, MERCHANTS, PARENT_BONUS_RATE, PRESETS, SETTING_LABELS, TARIFFS, defaultSettings, groupOf, levelOf, type PresetKey,
} from './content';
import { type DB, hashPin, newId, nowIso, tx } from './schema';
import type {
  AgeGroup, Card, CardType, ChildDetail, ChildOverview, ChildRequest, ChildSettings, ChildSummary, FamilyGoal,
  FamilyPlan, FeedItem, Goal, JoinRequest, ParentCard, ParentOverview, ParentTask, PayDecision, PayMethod, RequestType, SettingPath, Subscription, Tariff, Task, Tx,
} from './types';

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
const notFound = (what: string) => new AppError(404, 'not_found', `${what} не найден`);
const forbidden = (msg = 'Недостаточно прав') => new AppError(403, 'forbidden', msg);
const bad = (code: string, msg: string) => new AppError(400, code, msg);

// Беларусь живёт по UTC+3 без перехода на летнее время
const MINSK_OFFSET = 3 * 3600_000;
const DAY = 24 * 3600_000;
export function startOfDay(now = Date.now()) { return new Date(Math.floor((now + MINSK_OFFSET) / DAY) * DAY - MINSK_OFFSET).toISOString(); }
export function startOfMonth(now = Date.now()) {
  const d = new Date(now + MINSK_OFFSET);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - MINSK_OFFSET).toISOString();
}
/** Номер телефона РБ в виде +375XXXXXXXXX или null, если формат неверный */
export function normPhone(raw: string) {
  const d = raw.replace(/\D/g, '');
  const full = d.startsWith('375') ? d : d.startsWith('80') ? '375' + d.slice(2) : d.length === 9 ? '375' + d : d;
  return /^375(25|29|33|44)\d{7}$/.test(full) ? `+${full}` : null;
}
export function startOfWeek(now = Date.now()) {
  const d = new Date(now + MINSK_OFFSET);
  const dow = (d.getUTCDay() + 6) % 7; // понедельник = 0
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow) - MINSK_OFFSET).toISOString();
}

interface ChildRow {
  user_id: string; family_id: string; age: number; grp: AgeGroup; color: string; balance: number; income: number;
  xp: number; coins: number; settings: string; lessons: string; allowance_paid_at: string | null; invite_code: string | null; joined: number; name: string;
}
interface CardRow { id: string; child_id: string; type: CardType; last4: string; color: string; status: Card['status']; created_at: string }
interface MetaRow { family_id: string; tariff: Tariff; since: string; fee_month: string | null; intro_seen: number }
interface ReqRow { id: string; child_id: string; type: RequestType; payload: string; reason: string | null; status: ChildRequest['status']; created_at: string }

export type Emit = (familyId: string) => void;

export class FamilyService {
  constructor(private db: DB, private emit: Emit = () => {}) {}

  // ---------- низкоуровневые помощники ----------
  private q<T>(sql: string, ...args: (string | number | null)[]): T[] { return this.db.prepare(sql).all(...args) as T[]; }
  private one<T>(sql: string, ...args: (string | number | null)[]): T | undefined { return this.db.prepare(sql).get(...args) as T | undefined; }
  private run(sql: string, ...args: (string | number | null)[]) { return this.db.prepare(sql).run(...args); }

  private childRow(childId: string): ChildRow {
    const r = this.one<ChildRow>('SELECT c.*, u.name FROM children c JOIN users u ON u.id = c.user_id WHERE c.user_id = ?', childId);
    if (!r) throw notFound('Ребёнок');
    return r;
  }
  private familyOfParent(parentId: string) {
    const f = this.one<{ id: string }>('SELECT id FROM families WHERE parent_id = ?', parentId);
    if (!f) throw notFound('Семья');
    return f.id;
  }
  private parentOfFamily(familyId: string) {
    return this.one<{ parent_id: string }>('SELECT parent_id FROM families WHERE id = ?', familyId)!.parent_id;
  }
  /** Проверяет, что ребёнок из семьи этого родителя */
  private ownChild(parentId: string, childId: string): ChildRow {
    const c = this.childRow(childId);
    if (c.family_id !== this.familyOfParent(parentId)) throw forbidden();
    return c;
  }
  /** Тариф и служебные отметки семьи; строка создаётся при первом обращении */
  private meta(familyId: string): MetaRow {
    let m = this.one<MetaRow>('SELECT * FROM family_meta WHERE family_id = ?', familyId);
    if (!m) {
      this.run('INSERT INTO family_meta VALUES (?,?,?,?,?)', familyId, 'start', nowIso(), null, 0);
      m = this.one<MetaRow>('SELECT * FROM family_meta WHERE family_id = ?', familyId)!;
    }
    return m;
  }
  private tariff(familyId: string) { return TARIFFS[this.meta(familyId).tariff]; }
  /** Траты всей семьи (родитель и дети) с указанной даты */
  private familySpend(familyId: string, since: string, until = '9999') {
    const r = this.one<{ s: number | null }>(`SELECT -SUM(t.amount) AS s FROM transactions t WHERE t.kind = 'spend' AND t.amount < 0 AND t.created_at >= ? AND t.created_at < ?
      AND (t.user_id = (SELECT parent_id FROM families WHERE id = ?) OR t.user_id IN (SELECT user_id FROM children WHERE family_id = ?))`, since, until, familyId, familyId);
    return r?.s ?? 0;
  }
  private plan(familyId: string): FamilyPlan {
    const m = this.meta(familyId);
    const spendMonth = this.familySpend(familyId, startOfMonth());
    const firstMonth = Date.now() - Date.parse(m.since) < 30 * DAY;
    const t = TARIFFS[m.tariff];
    return { tariff: m.tariff, since: m.since, spendMonth, feeWaived: t.price === 0 || firstMonth || spendMonth >= TARIFFS.plus.waiverSpend };
  }
  private checkCardAllowed(familyId: string, type: CardType) {
    const t = this.tariff(familyId);
    if (!(t.cards as readonly CardType[]).includes(type)) throw bad('tariff_card', `${CARD_TYPES[type].label} доступна в пакете «${TARIFFS.plus.title}»`);
  }
  private settings(c: ChildRow): ChildSettings { return JSON.parse(c.settings); }
  private saveSettings(childId: string, s: ChildSettings) { this.run('UPDATE children SET settings = ? WHERE user_id = ?', JSON.stringify(s), childId); }
  private cards(childId: string): Card[] {
    return this.q<CardRow>("SELECT * FROM cards WHERE child_id = ? AND status != 'closed' ORDER BY created_at", childId)
      .map(r => ({ id: r.id, type: r.type, last4: r.last4, color: r.color, status: r.status }));
  }
  private spent(userId: string, since: string) {
    const r = this.one<{ s: number | null }>("SELECT -SUM(amount) AS s FROM transactions WHERE user_id = ? AND kind = 'spend' AND amount < 0 AND created_at >= ?", userId, since);
    return r?.s ?? 0;
  }
  private addTx(userId: string, title: string, amount: number, category: string, kind: 'spend' | 'income' | 'internal', method: string | null = null) {
    this.run('INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?)', newId('t'), userId, title, amount, category, method, kind, nowIso());
  }
  private addFeed(familyId: string, childId: string | null, text: string, amount: number | null = null) {
    this.run('INSERT INTO feed VALUES (?,?,?,?,?,?)', newId('fd'), familyId, childId, text, amount, nowIso());
  }
  private moveFromParent(familyId: string, childId: string, amount: number, title: string, cardId = 'main') {
    const parentId = this.parentOfFamily(familyId);
    const card = this.parentCards(parentId).find(c => c.id === cardId);
    if (!card) throw notFound('Карта');
    if (card.balance < amount) throw bad('parent_funds', `На карте ${card.mask} недостаточно средств`);
    const name = this.childRow(childId).name;
    if (cardId === 'main') this.run('UPDATE parents SET balance = balance - ? WHERE user_id = ?', amount, parentId);
    else this.run('UPDATE parent_cards SET balance = balance - ? WHERE id = ?', amount, cardId);
    this.run('UPDATE children SET balance = balance + ? WHERE user_id = ?', amount, childId);
    this.addTx(parentId, `${title}: ${name}${cardId === 'main' ? '' : ` · ${card.title}`}`, -amount, 'Семья', 'internal');
    this.addTx(childId, title, amount, 'Пополнение', 'income');
  }
  private parentCards(parentId: string): ParentCard[] {
    const main = this.one<{ balance: number; card_mask: string }>('SELECT balance, card_mask FROM parents WHERE user_id = ?', parentId)!;
    const extra = this.q<{ id: string; title: string; mask: string; expiry: string; network: ParentCard['network']; balance: number }>(
      'SELECT id, title, mask, expiry, network, balance FROM parent_cards WHERE parent_id = ? ORDER BY sort', parentId);
    return [{ id: 'main', title: 'ШОППЕР', mask: main.card_mask, expiry: '02/29', network: 'visa', balance: main.balance }, ...extra];
  }
  private addRequest(childId: string, type: RequestType, payload: object, reason: string | null) {
    const id = newId('r');
    this.run('INSERT INTO requests VALUES (?,?,?,?,?,?,?,?)', id, childId, type, JSON.stringify(payload), reason, 'pending', nowIso(), null);
    return id;
  }
  private addXp(c: ChildRow, xp: number, coins = 0) {
    const before = levelOf(c.xp), after = levelOf(c.xp + xp);
    this.run('UPDATE children SET xp = xp + ?, coins = coins + ? WHERE user_id = ?', xp, coins, c.user_id);
    if (after.n > before.n) {
      const s = this.settings(c);
      const day = Math.round(s.limits.day * 1.2 / BYN) * BYN;
      this.addRequest(c.user_id, 'level', { level: after.n, day },
        `${c.name} достиг уровня ${after.n} «${after.title}». Moby предлагает дать больше самостоятельности: дневной лимит ${fmt(s.limits.day)} → ${fmt(day)}.`);
      return after.n;
    }
    return null;
  }
  private touch(familyId: string) { this.emit(familyId); }

  // ---------- представления ----------
  private summary(c: ChildRow): ChildSummary {
    return {
      id: c.user_id, name: c.name, age: c.age, group: c.grp, color: c.color, balance: c.balance,
      spentToday: this.spent(c.user_id, startOfDay()), xp: c.xp, level: levelOf(c.xp).n, coins: c.coins,
      cards: this.cards(c.user_id), joined: !!c.joined, inviteCode: c.joined ? null : c.invite_code,
    };
  }
  private detail(c: ChildRow): ChildDetail {
    const dep = this.one<{ amount: number; rate: number }>('SELECT amount, rate FROM deposits WHERE child_id = ?', c.user_id);
    return {
      ...this.summary(c),
      settings: this.settings(c),
      spentMonth: this.spent(c.user_id, startOfMonth()),
      income: c.income,
      lessons: JSON.parse(c.lessons),
      goals: this.q<Goal>('SELECT id, title, icon, target, saved FROM goals WHERE child_id = ? ORDER BY created_at', c.user_id),
      tasks: this.q<Task>("SELECT id, title, reward, status FROM tasks WHERE child_id = ? ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'review' THEN 1 ELSE 2 END, created_at DESC", c.user_id),
      ops: this.ops(c.user_id, 30),
      subscriptions: this.q<{ id: string; title: string; price: number; active: number; icon: string }>('SELECT * FROM subscriptions WHERE child_id = ?', c.user_id)
        .map(s => ({ id: s.id, title: s.title, price: s.price, active: !!s.active, icon: s.icon })),
      deposit: dep ?? null,
      cashbackWeek: this.cashbackWeek(c),
      phone: this.one<{ phone: string | null }>('SELECT phone FROM users WHERE id = ?', c.user_id)?.phone ?? null,
    };
  }
  private cashbackWeek(c: ChildRow) {
    const spent = this.one<{ s: number | null }>('SELECT SUM(amount) AS s FROM partner_spend WHERE child_id = ? AND paid = 0', c.user_id)?.s ?? 0;
    const rate = this.tariff(c.family_id).cashbackRate;
    return { spent, rate, expected: Math.round(spent * rate) };
  }
  private ops(userId: string, limit: number): Tx[] {
    return this.q<{ id: string; title: string; amount: number; category: string; method: string | null; created_at: string }>(
      'SELECT id, title, amount, category, method, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', userId, limit,
    ).map(r => ({ id: r.id, title: r.title, amount: r.amount, category: r.category, method: r.method, createdAt: r.created_at }));
  }
  private request(r: ReqRow): ChildRequest {
    const p = JSON.parse(r.payload);
    let summary = '';
    let amount: number | null = null;
    switch (r.type) {
      case 'money': summary = 'Перевод на карту'; amount = p.amount; break;
      case 'perm': summary = SETTING_LABELS[p.key as SettingPath].title; break;
      case 'card': summary = CARD_TYPES[p.cardType as CardType].label; break;
      case 'purchase': summary = `Покупка: ${p.payment.title}`; amount = p.payment.amount; break;
      case 'limit': summary = 'Новый дневной лимит'; amount = p.day; break;
      case 'level': summary = `Уровень ${p.level}: новый дневной лимит`; amount = p.day; break;
      case 'task': { const t = this.one<{ title: string; reward: number }>('SELECT title, reward FROM tasks WHERE id = ?', p.taskId); summary = t ? `Выполнено: ${t.title}` : 'Задание удалено'; amount = t?.reward ?? null; break; }
      case 'goal': { const g = this.one<{ title: string }>('SELECT title FROM goals WHERE id = ?', p.goalId); summary = `В копилку «${g?.title ?? ''}»`; amount = p.amount; break; }
      case 'proposal': summary = `Своё задание: ${p.title}`; amount = p.reward; break;
    }
    return { id: r.id, childId: r.child_id, type: r.type, payload: p, reason: r.reason, status: r.status, createdAt: r.created_at, summary, amount };
  }
  private familyGoal(familyId: string): FamilyGoal {
    const f = this.one<{ goal_title: string; goal_icon: string; goal_target: number; goal_saved: number }>('SELECT * FROM families WHERE id = ?', familyId)!;
    return { title: f.goal_title, icon: f.goal_icon, target: f.goal_target, saved: f.goal_saved };
  }

  // ---------- родитель ----------
  parentOverview(parentId: string): ParentOverview {
    const familyId = this.familyOfParent(parentId);
    const u = this.one<{ name: string; balance: number; card_mask: string; phone: string | null }>('SELECT u.name, u.phone, p.balance, p.card_mask FROM users u JOIN parents p ON p.user_id = u.id WHERE u.id = ?', parentId)!;
    const kids = this.q<ChildRow>('SELECT c.*, u.name FROM children c JOIN users u ON u.id = c.user_id WHERE c.family_id = ? ORDER BY c.age DESC', familyId);
    const requests = this.q<ReqRow>(
      'SELECT r.* FROM requests r JOIN children c ON c.user_id = r.child_id WHERE c.family_id = ? ORDER BY r.status = \'pending\' DESC, r.created_at DESC LIMIT 30', familyId,
    ).map(r => this.request(r));
    const feed = this.q<{ id: string; child_id: string | null; text: string; amount: number | null; created_at: string }>(
      'SELECT * FROM feed WHERE family_id = ? ORDER BY created_at DESC LIMIT 20', familyId,
    ).map<FeedItem>(f => ({ id: f.id, childId: f.child_id, text: f.text, amount: f.amount, createdAt: f.created_at }));
    const joinRequests = this.q<{ id: string; name: string; age: number; phone: string; created_at: string }>(
      "SELECT * FROM join_requests WHERE family_id = ? AND status = 'pending' ORDER BY created_at DESC", familyId,
    ).map<JoinRequest>(j => ({ id: j.id, name: j.name, age: j.age, phone: j.phone, createdAt: j.created_at }));
    return {
      parent: { id: parentId, name: u.name, balance: u.balance, cardMask: u.card_mask, ops: this.ops(parentId, 10), phone: u.phone, cards: this.parentCards(parentId) },
      introSeen: !!this.meta(familyId).intro_seen, plan: this.plan(familyId), joinRequests,
      children: kids.map(k => this.summary(k)), requests, feed, familyGoal: this.familyGoal(familyId),
    };
  }

  markIntroSeen(parentId: string) {
    const familyId = this.familyOfParent(parentId);
    this.meta(familyId);
    this.run('UPDATE family_meta SET intro_seen = 1 WHERE family_id = ?', familyId);
  }

  setTariff(parentId: string, tariff: Tariff) {
    const familyId = this.familyOfParent(parentId);
    const m = this.meta(familyId);
    if (m.tariff === tariff) return this.plan(familyId);
    const kids = this.q<{ user_id: string }>('SELECT user_id FROM children WHERE family_id = ?', familyId);
    const t = TARIFFS[tariff];
    if (kids.length > t.maxKids) throw bad('tariff_kids', `В пакете «${t.title}» можно подключить ${t.maxKids} ребёнка`);
    const extra = this.one<{ n: number }>(`SELECT COUNT(*) AS n FROM cards WHERE status != 'closed' AND child_id IN (SELECT user_id FROM children WHERE family_id = ?)
      AND type NOT IN (${t.cards.map(() => '?').join(',')})`, familyId, ...t.cards)!.n;
    if (extra) throw bad('tariff_card', 'Сначала закройте браслеты и пластиковые карты: в пакете «Старт» их нет');
    this.run('UPDATE family_meta SET tariff = ?, since = ?, fee_month = NULL WHERE family_id = ?', tariff, nowIso(), familyId);
    this.addFeed(familyId, null, `Пакет изменён: «${t.title}»`);
    this.touch(familyId);
    return this.plan(familyId);
  }

  /** Плата за «Семья+» раз в месяц: не берём в первый месяц и если семья потратила за прошлый месяц от 400 BYN */
  processFees(now = Date.now()) {
    const month = startOfMonth(now);
    const prev = startOfMonth(Date.parse(month) - DAY);
    for (const m of this.q<MetaRow>("SELECT * FROM family_meta WHERE tariff = 'plus' AND (fee_month IS NULL OR fee_month < ?)", month)) {
      if (now - Date.parse(m.since) < 30 * DAY) continue;
      const parentId = this.parentOfFamily(m.family_id);
      const spent = this.familySpend(m.family_id, prev, month);
      tx(this.db, () => {
        this.run('UPDATE family_meta SET fee_month = ? WHERE family_id = ?', month, m.family_id);
        if (spent >= TARIFFS.plus.waiverSpend) { this.addFeed(m.family_id, null, `«Семья+» бесплатно: в прошлом месяце семья потратила ${fmt(spent)}`); return; }
        this.run('UPDATE parents SET balance = balance - ? WHERE user_id = ?', TARIFFS.plus.price, parentId);
        this.addTx(parentId, 'Пакет «Семья+»', -TARIFFS.plus.price, 'Обслуживание', 'internal');
      });
      this.touch(m.family_id);
    }
  }

  /** Кешбэк недели у партнёров: в понедельник за прошлую неделю, на счёт ребёнка */
  processWeeklyCashback(now = Date.now()) {
    const week = startOfWeek(now);
    const due = this.q<{ child_id: string; s: number }>('SELECT child_id, SUM(amount) AS s FROM partner_spend WHERE paid = 0 AND created_at < ? GROUP BY child_id', week);
    for (const d of due) {
      const c = this.childRow(d.child_id);
      const bonus = Math.round(d.s * this.tariff(c.family_id).cashbackRate);
      tx(this.db, () => {
        this.run('UPDATE partner_spend SET paid = 1 WHERE child_id = ? AND paid = 0 AND created_at < ?', d.child_id, week);
        if (bonus <= 0) return;
        this.run('UPDATE children SET balance = balance + ? WHERE user_id = ?', bonus, d.child_id);
        this.addTx(d.child_id, 'Кешбэк недели у партнёров', bonus, 'Бонусы', 'income');
        this.addFeed(c.family_id, d.child_id, `${c.name}: кешбэк недели у партнёров`, bonus);
      });
      this.touch(c.family_id);
    }
  }

  // ---------- вход в семью по номеру телефона ----------
  userByPhone(phone: string) {
    return this.one<{ id: string; role: 'parent' | 'child' }>('SELECT id, role FROM users WHERE phone = ?', phone);
  }

  /** Подросток с 14 лет сам просится в семью по номеру родителя (ГК РБ ст. 26); младше — только через родителя */
  createJoinRequest(input: { phone: string; parentPhone: string; name: string; age: number; pin: string }) {
    if (input.age < 14) throw bad('age', 'До 14 лет к семье подключает родитель. Попроси его добавить тебя в Moby по твоему номеру');
    if (input.age > 17) throw bad('age', 'Пакет «Семья» — для детей до 18 лет');
    if (this.userByPhone(input.phone)) throw bad('exists', 'Этот номер уже есть в Moby: войдите по коду из SMS');
    const parent = this.one<{ id: string }>("SELECT id FROM users WHERE phone = ? AND role = 'parent'", input.parentPhone);
    if (!parent) throw bad('no_parent', 'Не нашли родителя с таким номером в Moby');
    const familyId = this.familyOfParent(parent.id);
    const dup = this.one("SELECT 1 FROM join_requests WHERE phone = ? AND status = 'pending'", input.phone);
    if (dup) throw bad('duplicate', 'Заявка уже отправлена, ждём родителя');
    const id = newId('j'), ticket = newId('tk') + newId('tk');
    this.run('INSERT INTO join_requests VALUES (?,?,?,?,?,?,?,?,?,?)', id, familyId, input.name.trim(), input.age, input.phone, hashPin(input.pin), ticket, 'pending', null, nowIso());
    this.addFeed(familyId, null, `${input.name.trim()} просится в семью по номеру ${input.phone}`);
    this.touch(familyId);
    return { ticket };
  }

  joinStatus(ticket: string) {
    const j = this.one<{ status: string; child_id: string | null }>('SELECT status, child_id FROM join_requests WHERE ticket = ?', ticket);
    if (!j) throw notFound('Заявка');
    return j;
  }

  resolveJoinRequest(parentId: string, joinId: string, input: { approve: boolean; consents?: { legalRep: boolean; personalData: boolean; terms: boolean; marketing: boolean }; preset?: PresetKey }) {
    const familyId = this.familyOfParent(parentId);
    const j = this.one<{ id: string; family_id: string; name: string; age: number; phone: string; pin_hash: string; status: string }>('SELECT * FROM join_requests WHERE id = ?', joinId);
    if (!j || j.family_id !== familyId) throw notFound('Заявка');
    if (j.status !== 'pending') throw bad('resolved', 'Заявка уже обработана');
    if (!input.approve) {
      this.run("UPDATE join_requests SET status = 'declined' WHERE id = ?", joinId);
      this.touch(familyId);
      return { childId: null };
    }
    let childId = '';
    tx(this.db, () => {
      childId = this.addChild(parentId, { name: j.name, age: j.age, phone: j.phone, consents: input.consents!, preset: input.preset ?? 'normal' }, { pinHash: j.pin_hash, nested: true }).childId;
      this.run("UPDATE join_requests SET status = 'approved', child_id = ? WHERE id = ?", childId, joinId);
    });
    this.touch(familyId);
    return { childId };
  }

  childForParent(parentId: string, childId: string): ChildDetail { return this.detail(this.ownChild(parentId, childId)); }

  addChild(parentId: string, input: {
    name: string; age: number; consents: { legalRep: boolean; personalData: boolean; terms: boolean; marketing: boolean };
    card?: { type: Exclude<CardType, 'virtual'>; color: string }; preset: PresetKey; settings?: Partial<ChildSettings>;
    phone?: string | null; tariff?: Tariff;
  }, internal: { pinHash?: string; nested?: boolean } = {}) {
    const familyId = this.familyOfParent(parentId);
    const { consents } = input;
    if (!consents?.legalRep || !consents.personalData || !consents.terms) throw bad('consents', 'Нужны обязательные согласия законного представителя');
    if (input.age < 7 || input.age > 17) throw bad('age', 'Пакет доступен для детей 7–17 лет');
    if (input.phone && this.userByPhone(input.phone)) throw bad('phone_taken', 'Этот номер уже подключён к Moby');
    const group = groupOf(input.age);
    const base = defaultSettings(group, input.preset);
    const settings: ChildSettings = { ...base, ...input.settings, limits: { ...base.limits, ...input.settings?.limits }, cats: { ...base.cats, ...input.settings?.cats }, perms: { ...base.perms, ...input.settings?.perms }, allowance: { ...base.allowance, ...input.settings?.allowance } };
    if (group === 'teen') settings.perms.deposit = true; // с 14 лет вклад по закону открывается самостоятельно
    const id = newId('u');
    const count = this.one<{ n: number }>('SELECT COUNT(*) AS n FROM children WHERE family_id = ?', familyId)!.n;
    const invite = `MOBY-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const joined = internal.pinHash ? 1 : 0;
    const body = () => {
      if (input.tariff && input.tariff !== this.meta(familyId).tariff) this.setTariff(parentId, input.tariff);
      const t = this.tariff(familyId);
      if (count >= t.maxKids) throw bad('tariff_kids', `В пакете «${t.title}» ${t.maxKids === 1 ? 'один ребёнок' : `до ${t.maxKids} детей`}. Подключите «${TARIFFS.plus.title}»`);
      if (input.card) this.checkCardAllowed(familyId, input.card.type);
      this.run('INSERT INTO users VALUES (?,?,?,?,?,?)', id, 'child', input.name.trim(), input.phone ?? null, internal.pinHash ?? null, nowIso());
      this.run(`INSERT INTO children (user_id,family_id,age,grp,color,settings,allowance_paid_at,invite_code,joined) VALUES (?,?,?,?,?,?,?,?,?)`,
        id, familyId, input.age, group, AVATAR_COLORS[count % AVATAR_COLORS.length], JSON.stringify(settings), nowIso(), invite, joined);
      for (const [kind, ok] of [['legal_rep', consents.legalRep], ['personal_data', consents.personalData], ['card_issue', consents.terms], ['marketing', consents.marketing]] as const) {
        if (ok) this.run('INSERT INTO consents VALUES (?,?,?,?)', newId('cs'), id, kind, nowIso());
      }
      if (input.card) this.insertCard(id, input.card.type, input.card.color);
      this.insertCard(id, 'virtual', '#1F5FD6');
      this.addFeed(familyId, id, `${input.name.trim()} подключён к пакету «Семья»`);
    };
    if (internal.nested) body(); else tx(this.db, body);
    this.touch(familyId);
    return { childId: id, inviteCode: invite, phone: input.phone ?? null };
  }

  updateSettings(parentId: string, childId: string, patch: Partial<Omit<ChildSettings, 'cats' | 'perms' | 'limits' | 'allowance'>> & {
    cats?: Partial<ChildSettings['cats']>; perms?: Partial<ChildSettings['perms']>; limits?: Partial<ChildSettings['limits']>; allowance?: Partial<ChildSettings['allowance']>;
  }) {
    const c = this.ownChild(parentId, childId);
    const s = this.settings(c);
    const next: ChildSettings = {
      ...s, ...patch,
      cats: { ...s.cats, ...patch.cats }, perms: { ...s.perms, ...patch.perms },
      limits: { ...s.limits, ...patch.limits }, allowance: { ...s.allowance, ...patch.allowance },
    };
    if (c.grp === 'teen') next.perms.deposit = true;
    if (next.limits.day > next.limits.month) next.limits.month = next.limits.day;
    this.saveSettings(childId, next);
    const changed = [...Object.entries(patch.cats ?? {}).map(([k, v]) => [`cats.${k}`, v]), ...Object.entries(patch.perms ?? {}).map(([k, v]) => [`perms.${k}`, v])] as [SettingPath, boolean][];
    for (const [k, v] of changed) this.addFeed(c.family_id, childId, `${c.name}: «${SETTING_LABELS[k].title}» ${v ? 'включено' : 'выключено'}`);
    if (patch.mobyAccess === false) this.run('DELETE FROM sessions WHERE user_id = ?', childId);
    this.touch(c.family_id);
    return this.detail(this.childRow(childId));
  }

  topup(parentId: string, childId: string, amount: number, cardId = 'main') {
    const c = this.ownChild(parentId, childId);
    tx(this.db, () => {
      this.moveFromParent(c.family_id, childId, amount, 'Перевод от родителя', cardId);
      this.addFeed(c.family_id, childId, `Вы перевели: ${c.name}`, amount);
    });
    this.touch(c.family_id);
  }

  payAllowanceNow(parentId: string, childId: string) {
    const c = this.ownChild(parentId, childId);
    const s = this.settings(c);
    tx(this.db, () => {
      this.moveFromParent(c.family_id, childId, s.allowance.amount, 'Карманные деньги');
      this.run('UPDATE children SET allowance_paid_at = ? WHERE user_id = ?', nowIso(), childId);
      this.addFeed(c.family_id, childId, `Карманные деньги: ${c.name}`, s.allowance.amount);
    });
    this.touch(c.family_id);
  }

  /** Плановые карманные деньги: раз в неделю, в понедельник по Минску */
  processAllowances(now = Date.now()) {
    const weekStart = startOfWeek(now);
    const due = this.q<ChildRow>('SELECT c.*, u.name FROM children c JOIN users u ON u.id = c.user_id WHERE c.allowance_paid_at IS NULL OR c.allowance_paid_at < ?', weekStart);
    for (const c of due) {
      const s = this.settings(c);
      if (!s.allowance.on) continue;
      try {
        tx(this.db, () => {
          this.moveFromParent(c.family_id, c.user_id, s.allowance.amount, 'Карманные деньги');
          this.run('UPDATE children SET allowance_paid_at = ? WHERE user_id = ?', new Date(now).toISOString(), c.user_id);
          this.addFeed(c.family_id, c.user_id, `Карманные деньги: ${c.name}`, s.allowance.amount);
        });
      } catch (e) {
        if (!(e instanceof AppError)) throw e;
        this.addFeed(c.family_id, c.user_id, `Не хватило средств на карманные деньги для ${c.name}`);
      }
      this.touch(c.family_id);
    }
  }

  private insertCard(childId: string, type: CardType, color: string) {
    const status = CARD_TYPES[type].physical ? 'delivery' : 'active';
    const id = newId('c');
    this.run('INSERT INTO cards VALUES (?,?,?,?,?,?,?)', id, childId, type, String(1000 + Math.floor(Math.random() * 9000)), color, status, nowIso());
    return id;
  }

  issueCard(actor: { id: string; role: 'parent' | 'child' }, childId: string, type: CardType, color: string) {
    const c = actor.role === 'parent' ? this.ownChild(actor.id, childId) : this.childRow(childId);
    if (actor.role === 'child') {
      if (actor.id !== childId) throw forbidden();
      if (type !== 'virtual') throw forbidden('Физическую карту выпускает родитель');
      if (!this.settings(c).perms.newCards) throw forbidden('Родитель не разрешил выпуск карт');
    }
    if (this.cards(childId).length >= MAX_CARDS) throw bad('max_cards', `У ребёнка уже ${MAX_CARDS} карты — это максимум`);
    this.checkCardAllowed(c.family_id, type);
    const id = this.insertCard(childId, type, color);
    this.addFeed(c.family_id, childId, `${c.name}: выпущена карта «${CARD_TYPES[type].label}»`);
    this.touch(c.family_id);
    return this.cards(childId).find(x => x.id === id)!;
  }

  cardAction(actor: { id: string; role: 'parent' | 'child' }, cardId: string, action: 'block' | 'unblock' | 'activate' | 'close') {
    const card = this.one<CardRow>('SELECT * FROM cards WHERE id = ?', cardId);
    if (!card) throw notFound('Карта');
    const c = actor.role === 'parent' ? this.ownChild(actor.id, card.child_id) : this.childRow(card.child_id);
    if (actor.role === 'child') {
      if (actor.id !== card.child_id) throw forbidden();
      if (action === 'unblock' && c.grp === 'kid') throw forbidden('Разблокировать карту может родитель');
      if (action === 'activate' || action === 'close') throw forbidden();
    }
    const next = { block: 'blocked', unblock: 'active', activate: 'active', close: 'closed' }[action];
    if (action === 'unblock' && card.status !== 'blocked') throw bad('state', 'Карта не заблокирована');
    if (action === 'activate' && card.status !== 'delivery') throw bad('state', 'Карта уже активна');
    this.run('UPDATE cards SET status = ? WHERE id = ?', next, cardId);
    const label = CARD_TYPES[card.type].label;
    const verb = { block: 'заблокирована', unblock: 'разблокирована', activate: 'получена и активирована', close: 'закрыта' }[action];
    this.addFeed(c.family_id, c.user_id, `${c.name}: ${label.toLowerCase()} •• ${card.last4} ${verb}`);
    this.touch(c.family_id);
  }

  reissue(parentId: string, childId: string) {
    const c = this.ownChild(parentId, childId);
    const main = this.cards(childId).find(x => CARD_TYPES[x.type].physical);
    if (!main) throw bad('no_physical', 'Нет физической карты для перевыпуска');
    tx(this.db, () => {
      this.run("UPDATE cards SET status = 'closed' WHERE id = ?", main.id);
      this.insertCard(childId, main.type, main.color);
      this.addFeed(c.family_id, childId, `${c.name}: карта •• ${main.last4} закрыта, заказан перевыпуск`);
    });
    this.touch(c.family_id);
  }

  createTask(parentId: string, childId: string, title: string, reward: number) {
    const c = this.ownChild(parentId, childId);
    this.run('INSERT INTO tasks VALUES (?,?,?,?,?,?)', newId('k'), childId, title.trim(), reward, 'open', nowIso());
    this.touch(c.family_id);
  }

  parentTasks(parentId: string): ParentTask[] {
    const familyId = this.familyOfParent(parentId);
    return this.q<{ id: string; child_id: string; title: string; reward: number; status: Task['status'] }>(
      `SELECT t.id, t.child_id, t.title, t.reward, t.status FROM tasks t JOIN children c ON c.user_id = t.child_id WHERE c.family_id = ?
       ORDER BY CASE t.status WHEN 'review' THEN 0 WHEN 'open' THEN 1 ELSE 2 END, t.created_at DESC`, familyId,
    ).map(t => ({ id: t.id, childId: t.child_id, title: t.title, reward: t.reward, status: t.status }));
  }

  updateTask(parentId: string, taskId: string, title: string, reward: number) {
    const t = this.one<{ child_id: string; status: string }>('SELECT child_id, status FROM tasks WHERE id = ?', taskId);
    if (!t) throw notFound('Задание');
    const c = this.ownChild(parentId, t.child_id);
    if (t.status !== 'open') throw bad('state', t.status === 'review' ? 'Задание уже на проверке: примите его или удалите' : 'Задание уже оплачено');
    this.run('UPDATE tasks SET title = ?, reward = ? WHERE id = ?', title.trim(), reward, taskId);
    this.touch(c.family_id);
  }

  deleteTask(parentId: string, taskId: string) {
    const t = this.one<{ child_id: string; title: string }>('SELECT child_id, title FROM tasks WHERE id = ?', taskId);
    if (!t) throw notFound('Задание');
    const c = this.ownChild(parentId, t.child_id);
    tx(this.db, () => {
      // Задание на проверке: снимаем и запрос на награду
      this.run("UPDATE requests SET status = 'declined', resolved_at = ? WHERE type = 'task' AND status = 'pending' AND json_extract(payload, '$.taskId') = ?", nowIso(), taskId);
      this.run('DELETE FROM tasks WHERE id = ?', taskId);
      this.addFeed(c.family_id, c.user_id, `Задание удалено: «${t.title}»`);
    });
    this.touch(c.family_id);
  }

  resolveRequest(parentId: string, requestId: string, approve: boolean) {
    const r = this.one<ReqRow>('SELECT * FROM requests WHERE id = ?', requestId);
    if (!r) throw notFound('Запрос');
    const c = this.ownChild(parentId, r.child_id);
    if (r.status !== 'pending') throw bad('resolved', 'Запрос уже обработан');
    const p = JSON.parse(r.payload);
    tx(this.db, () => {
      if (approve) {
        const s = this.settings(c);
        switch (r.type) {
          case 'money': this.moveFromParent(c.family_id, c.user_id, p.amount, 'Перевод от родителя'); break;
          case 'perm': { const [g, k] = (p.key as string).split('.'); (s as any)[g][k] = true; this.saveSettings(c.user_id, s); break; }
          case 'limit': s.limits.day = p.day; s.limits.month = Math.max(s.limits.month, p.day); this.saveSettings(c.user_id, s); break;
          case 'level': s.limits.day = p.day; s.limits.month = Math.max(s.limits.month, p.day); s.confirmAbove = Math.round(s.confirmAbove * 1.2); this.saveSettings(c.user_id, s); break;
          case 'card':
            if (this.cards(c.user_id).length >= MAX_CARDS) throw bad('max_cards', `У ${c.name} уже ${MAX_CARDS} карты`);
            this.checkCardAllowed(c.family_id, p.cardType);
            this.insertCard(c.user_id, p.cardType, p.color); break;
          case 'proposal':
            this.run('INSERT INTO tasks VALUES (?,?,?,?,?,?)', newId('k'), c.user_id, p.title, p.reward, 'open', nowIso()); break;
          case 'purchase': {
            const d = this.executePayment(c, p.payment, { parentApproved: true });
            if (d.status !== 'approved') throw bad('purchase_failed', d.status === 'declined' ? d.text : 'Не удалось провести оплату');
            break;
          }
          case 'task': {
            const t = this.one<{ reward: number; title: string }>('SELECT reward, title FROM tasks WHERE id = ?', p.taskId);
            if (!t) throw notFound('Задание');
            this.moveFromParent(c.family_id, c.user_id, t.reward, `Награда: ${t.title}`);
            this.run("UPDATE tasks SET status = 'paid' WHERE id = ?", p.taskId);
            this.addXp(c, 40, 10);
            break;
          }
          case 'goal': {
            const parentIdOf = this.parentOfFamily(c.family_id);
            const bal = this.one<{ balance: number }>('SELECT balance FROM parents WHERE user_id = ?', parentIdOf)!.balance;
            if (bal < p.amount) throw bad('parent_funds', 'На вашей карте недостаточно средств');
            this.run('UPDATE parents SET balance = balance - ? WHERE user_id = ?', p.amount, parentIdOf);
            this.run('UPDATE goals SET saved = saved + ? WHERE id = ? AND child_id = ?', p.amount, p.goalId, c.user_id);
            this.addTx(parentIdOf, `В копилку: ${c.name}`, -p.amount, 'Семья', 'internal');
            break;
          }
        }
      } else if (r.type === 'task') {
        this.run("UPDATE tasks SET status = 'open' WHERE id = ?", p.taskId);
      }
      this.run('UPDATE requests SET status = ?, resolved_at = ? WHERE id = ?', approve ? 'approved' : 'declined', nowIso(), requestId);
      const info = this.request({ ...r });
      this.addFeed(c.family_id, c.user_id, `${approve ? 'Одобрено' : 'Отклонено'}: ${c.name}, ${info.summary}${info.amount ? `, ${fmt(info.amount)}` : ''}`);
    });
    this.touch(c.family_id);
  }

  contributeFamilyGoal(user: { id: string; role: 'parent' | 'child' }, amount: number) {
    let familyId: string;
    tx(this.db, () => {
      if (user.role === 'parent') {
        familyId = this.familyOfParent(user.id);
        const bal = this.one<{ balance: number }>('SELECT balance FROM parents WHERE user_id = ?', user.id)!.balance;
        if (bal < amount) throw bad('funds', 'Недостаточно средств');
        this.run('UPDATE parents SET balance = balance - ? WHERE user_id = ?', amount, user.id);
        this.addTx(user.id, 'Семейная цель', -amount, 'Семья', 'internal');
      } else {
        const c = this.childRow(user.id); familyId = c.family_id;
        if (c.balance < amount) throw bad('funds', 'Не хватает денег');
        this.run('UPDATE children SET balance = balance - ? WHERE user_id = ?', amount, user.id);
        this.addTx(user.id, 'Семейная цель', -amount, 'Копилки', 'internal');
        this.addXp(c, 10);
      }
      this.run('UPDATE families SET goal_saved = goal_saved + ? WHERE id = ?', amount, familyId);
      this.addFeed(familyId, user.role === 'child' ? user.id : null, `+${fmt(amount)} в семейную цель`);
    });
    this.touch(familyId!);
  }

  // ---------- ребёнок ----------
  childOverview(childId: string): ChildOverview {
    const c = this.childRow(childId);
    const requests = this.q<ReqRow>('SELECT * FROM requests WHERE child_id = ? ORDER BY created_at DESC LIMIT 10', childId).map(r => this.request(r));
    return { me: this.detail(c), requests, familyGoal: this.familyGoal(c.family_id) };
  }

  createRequest(childId: string, type: 'money' | 'perm' | 'card' | 'limit' | 'goal' | 'proposal', payload: Record<string, unknown>, reason: string | null) {
    const c = this.childRow(childId);
    if (type === 'card') this.checkCardAllowed(c.family_id, payload.cardType as CardType);
    if (type === 'perm') {
      const dup = this.one('SELECT 1 FROM requests WHERE child_id = ? AND type = ? AND status = ? AND json_extract(payload, \'$.key\') = ?', childId, 'perm', 'pending', String(payload.key));
      if (dup) throw bad('duplicate', 'Такой запрос уже ждёт ответа');
    }
    if (type === 'card' && this.cards(childId).length >= MAX_CARDS) throw bad('max_cards', `Уже ${MAX_CARDS} карты — это максимум`);
    const id = this.addRequest(childId, type, payload, reason);
    this.touch(c.family_id);
    return id;
  }

  private executePayment(c: ChildRow, p: PayInput, opts: { parentApproved?: boolean } = {}): PayDecision {
    const s = this.settings(c);
    const cards = this.cards(c.user_id);
    const state = { settings: s, balance: c.balance, spentToday: this.spent(c.user_id, startOfDay()), spentMonth: this.spent(c.user_id, startOfMonth()), cards };
    const d = authorize(state, p, opts);
    if (d.status === 'pending') {
      this.addRequest(c.user_id, 'purchase', { payment: p }, `${p.title}, ${fmt(p.amount)}`);
      return d;
    }
    if (d.status === 'declined') return d;
    const card = p.method === 'card' ? payingCard(cards) : null;
    const title = p.method === 'qr' ? `${p.title} · QR КРОК` : p.title;
    this.run('UPDATE children SET balance = balance - ?, coins = coins + ? WHERE user_id = ?', p.amount, Math.floor(p.amount / (5 * BYN)), c.user_id);
    this.addTx(c.user_id, title, -p.amount, CATEGORY_NAMES[p.category], 'spend', p.method);
    this.addFeed(c.family_id, c.user_id, `${c.name}: ${title}`, -p.amount);
    if (p.partner) this.run('INSERT INTO partner_spend VALUES (?,?,?,?,?,?)', newId('ps'), c.user_id, p.title, p.amount, 0, nowIso());
    let change = 0;
    const goal = this.one<{ id: string }>('SELECT id FROM goals WHERE child_id = ? AND saved < target ORDER BY created_at LIMIT 1', c.user_id);
    if (s.roundup && goal && p.amount % BYN) {
      change = BYN - (p.amount % BYN);
      if (c.balance - p.amount >= change) {
        this.run('UPDATE children SET balance = balance - ? WHERE user_id = ?', change, c.user_id);
        this.run('UPDATE goals SET saved = saved + ? WHERE id = ?', change, goal.id);
        this.addTx(c.user_id, 'Сдача в копилку', -change, 'Копилки', 'internal');
      } else change = 0;
    }
    const via = p.method === 'qr' ? 'Списано со счёта мгновенно через КРОК' : card ? `${CARD_TYPES[card.type].label} •• ${card.last4}` : 'Со счёта';
    const cb = p.partner ? ` Партнёр Moby: ${Math.round(this.tariff(c.family_id).cashbackRate * 100)}% вернутся в понедельник.` : '';
    return { status: 'approved', text: `${title}, ${fmt(p.amount)}. ${via}.${change ? ` Сдача ${fmt(change)} ушла в копилку.` : ''}${cb}` };
  }

  private pay(childId: string, p: PayInput) {
    const c = this.childRow(childId);
    const d = tx(this.db, () => this.executePayment(c, p));
    this.touch(c.family_id);
    return d;
  }
  payMerchant(childId: string, merchantId: string, method: PayMethod) {
    const c = this.childRow(childId);
    const m = MERCHANTS[c.grp].find(x => x.id === merchantId);
    if (!m) throw notFound('Магазин');
    return this.pay(childId, { title: m.title, amount: m.amount, category: m.category, method, partner: m.partner });
  }
  payErip(childId: string, serviceId: string, amount: number) {
    const svc = ERIP_SERVICES.find(x => x.id === serviceId);
    if (!svc) throw notFound('Услуга ЕРИП');
    return this.pay(childId, { title: `ЕРИП: ${svc.title}`, amount, category: 'erip', method: 'card' });
  }
  transfer(childId: string, phone: string, amount: number) {
    return this.pay(childId, { title: `Перевод ${phone.slice(-9)}`, amount, category: 'p2p', method: 'card' });
  }

  taskDone(childId: string, taskId: string) {
    const c = this.childRow(childId);
    const t = this.one<{ status: string }>('SELECT status FROM tasks WHERE id = ? AND child_id = ?', taskId, childId);
    if (!t) throw notFound('Задание');
    if (t.status !== 'open') throw bad('state', 'Задание уже отмечено');
    tx(this.db, () => {
      this.run("UPDATE tasks SET status = 'review' WHERE id = ?", taskId);
      this.addRequest(childId, 'task', { taskId }, null);
    });
    this.touch(c.family_id);
  }

  createGoal(childId: string, title: string, icon: string, target: number) {
    const c = this.childRow(childId);
    if (!this.settings(c).perms.goals) throw forbidden('Копилки выключены родителем');
    this.run('INSERT INTO goals VALUES (?,?,?,?,?,?,?)', newId('g'), childId, title.trim(), icon, target, 0, nowIso());
    this.touch(c.family_id);
  }

  depositGoal(childId: string, goalId: string, amount: number) {
    const c = this.childRow(childId);
    const g = this.one<{ title: string }>('SELECT title FROM goals WHERE id = ? AND child_id = ?', goalId, childId);
    if (!g) throw notFound('Копилка');
    if (c.balance < amount) throw bad('funds', 'Не хватает денег на счёте');
    const s = this.settings(c);
    let bonus = 0;
    tx(this.db, () => {
      this.run('UPDATE children SET balance = balance - ? WHERE user_id = ?', amount, childId);
      this.addTx(childId, `В копилку «${g.title}»`, -amount, 'Копилки', 'internal');
      if (s.parentBonus) {
        const parentId = this.parentOfFamily(c.family_id);
        bonus = Math.round(amount * PARENT_BONUS_RATE);
        const bal = this.one<{ balance: number }>('SELECT balance FROM parents WHERE user_id = ?', parentId)!.balance;
        if (bal >= bonus) {
          this.run('UPDATE parents SET balance = balance - ? WHERE user_id = ?', bonus, parentId);
          this.addTx(parentId, `Доплата к копилке: ${c.name}`, -bonus, 'Семья', 'internal');
        } else bonus = 0;
      }
      this.run('UPDATE goals SET saved = saved + ? WHERE id = ?', amount + bonus, goalId);
      this.addXp(c, 10);
    });
    this.touch(c.family_id);
    return { added: amount + bonus, bonus };
  }

  completeLesson(childId: string, lessonId: string, answers: number[]) {
    const c = this.childRow(childId);
    const lesson = LESSONS[c.grp].find(l => l.id === lessonId);
    if (!lesson) throw notFound('Урок');
    const correct = lesson.questions.filter((q, i) => answers[i] === q.answer).length;
    const done: string[] = JSON.parse(c.lessons);
    let level: number | null = null;
    const first = !done.includes(lessonId);
    if (first) {
      tx(this.db, () => {
        this.run('UPDATE children SET lessons = ? WHERE user_id = ?', JSON.stringify([...done, lessonId]), childId);
        level = this.addXp(c, LESSON_REWARD.xp, LESSON_REWARD.coins);
        this.addFeed(c.family_id, childId, `${c.name}: пройден урок «${lesson.title}», ${correct} из ${lesson.questions.length}`);
      });
      this.touch(c.family_id);
    }
    return { correct, total: lesson.questions.length, rewarded: first, level };
  }

  completeFraud(childId: string, answers: boolean[]) {
    const c = this.childRow(childId);
    const correct = FRAUD_CASES.filter((f, i) => answers[i] === f.fraud).length;
    const done: string[] = JSON.parse(c.lessons);
    const first = !done.includes('fraud');
    let level: number | null = null;
    if (first) {
      tx(this.db, () => {
        this.run('UPDATE children SET lessons = ? WHERE user_id = ?', JSON.stringify([...done, 'fraud']), childId);
        level = this.addXp(c, correct * FRAUD_REWARD_PER_ANSWER.xp, correct * FRAUD_REWARD_PER_ANSWER.coins);
        this.addFeed(c.family_id, childId, `${c.name}: «Распознай мошенника», ${correct} из ${FRAUD_CASES.length}`);
      });
      this.touch(c.family_id);
    }
    return { correct, total: FRAUD_CASES.length, rewarded: first, level };
  }

  setSubscription(childId: string, subId: string, active: boolean) {
    const c = this.childRow(childId);
    if (!this.settings(c).perms.subs) throw forbidden('Карта для подписок выключена родителем');
    const r = this.run('UPDATE subscriptions SET active = ? WHERE id = ? AND child_id = ?', active ? 1 : 0, subId, childId);
    if (!r.changes) throw notFound('Подписка');
    this.touch(c.family_id);
  }

  deposit(childId: string, action: 'open' | 'topup', amount: number) {
    const c = this.childRow(childId);
    if (!this.settings(c).perms.deposit) throw forbidden('Вклад недоступен');
    if (amount < 10 * BYN) throw bad('min', 'Минимальная сумма — 10 BYN');
    if (c.balance < amount) throw bad('funds', 'Не хватает денег');
    const dep = this.one('SELECT 1 FROM deposits WHERE child_id = ?', childId);
    if (action === 'open' && dep) throw bad('exists', 'Вклад уже открыт');
    if (action === 'topup' && !dep) throw bad('missing', 'Сначала откройте вклад');
    tx(this.db, () => {
      this.run('UPDATE children SET balance = balance - ? WHERE user_id = ?', amount, childId);
      if (dep) this.run('UPDATE deposits SET amount = amount + ? WHERE child_id = ?', amount, childId);
      else this.run('INSERT INTO deposits VALUES (?,?,?,?)', childId, amount, DEPOSIT_RATE, nowIso());
      this.addTx(childId, action === 'open' ? 'Открытие вклада «Мой старт»' : 'Пополнение вклада', -amount, 'Вклад', 'internal');
      if (action === 'open') this.addFeed(c.family_id, childId, `${c.name} открыл(а) вклад «Мой старт»`);
      this.addXp(c, 10);
    });
    this.touch(c.family_id);
  }

  incomeToGoal(childId: string, goalId: string, amount: number) {
    const c = this.childRow(childId);
    if (c.income < amount) throw bad('funds', 'Не хватает собственных средств');
    const r = this.run('UPDATE goals SET saved = saved + ? WHERE id = ? AND child_id = ?', amount, goalId, childId);
    if (!r.changes) throw notFound('Копилка');
    this.run('UPDATE children SET income = income - ? WHERE user_id = ?', amount, childId);
    this.addXp(c, 15);
    this.touch(c.family_id);
  }

  familyOfUser(userId: string): string {
    const c = this.one<{ family_id: string }>('SELECT family_id FROM children WHERE user_id = ?', userId);
    return c ? c.family_id : this.familyOfParent(userId);
  }
  presets(group: AgeGroup) { return PRESETS[group]; }
}
