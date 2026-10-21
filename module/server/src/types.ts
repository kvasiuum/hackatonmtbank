// Общие типы API. Используются и сервером, и веб-клиентом (type-only импорт).
// Все суммы — в копейках (целые числа), чтобы не терять точность.

export type Role = 'parent' | 'child';
export type AgeGroup = 'kid' | 'teen'; // 7–13 и 14–17
export type CardType = 'plastic' | 'sticker' | 'bracelet' | 'virtual';
export type CardStatus = 'active' | 'delivery' | 'blocked' | 'closed';
export type PayMethod = 'card' | 'qr';
export type Category =
  | 'food' | 'shop' | 'fun' | 'fastfood' | 'online' | 'games' | 'cash'
  | 'erip' | 'p2p' | 'subs' | 'gambling' | 'adult';

export type CatKey = 'online' | 'games' | 'cash' | 'fastfood';
export type PermKey = 'qr' | 'goals' | 'erip' | 'p2p' | 'deposit' | 'subs' | 'newCards';
export type SettingPath = `cats.${CatKey}` | `perms.${PermKey}`;

export interface ChildSettings {
  limits: { day: number; month: number };
  confirmAbove: number;
  cats: Record<CatKey, boolean>;
  perms: Record<PermKey, boolean>;
  allowance: { on: boolean; amount: number };
  parentBonus: boolean;
  roundup: boolean;
  mobyAccess: boolean;
}

export interface Card { id: string; type: CardType; last4: string; color: string; status: CardStatus }
export interface Tx { id: string; title: string; amount: number; category: string; method: string | null; createdAt: string }
export interface Task { id: string; title: string; reward: number; status: 'open' | 'review' | 'paid' }
export interface Goal { id: string; title: string; icon: string; target: number; saved: number }
export interface Subscription { id: string; title: string; price: number; active: boolean; icon: string }

export type RequestType = 'money' | 'perm' | 'card' | 'purchase' | 'limit' | 'level' | 'task' | 'goal' | 'proposal';
export interface ChildRequest {
  id: string;
  childId: string;
  type: RequestType;
  payload: Record<string, any>;
  reason: string | null;
  status: 'pending' | 'approved' | 'declined';
  createdAt: string;
  /** Человекочитаемое описание предмета запроса, формирует сервер */
  summary: string;
  /** Сумма, о которой идёт речь (деньги, покупка, награда, лимит), в копейках */
  amount: number | null;
}

export interface ChildSummary {
  id: string; name: string; age: number; group: AgeGroup; color: string;
  balance: number; spentToday: number; xp: number; level: number; coins: number;
  cards: Card[]; joined: boolean; inviteCode: string | null;
}

export interface ChildDetail extends ChildSummary {
  settings: ChildSettings;
  spentMonth: number;
  income: number;
  lessons: string[];
  goals: Goal[];
  tasks: Task[];
  ops: Tx[];
  subscriptions: Subscription[];
  deposit: { amount: number; rate: number } | null;
  /** Кешбэк недели у партнёров: потрачено, ставка, сколько вернётся в понедельник */
  cashbackWeek: { spent: number; rate: number; expected: number };
  phone: string | null;
}

export interface FeedItem { id: string; childId: string | null; text: string; amount: number | null; createdAt: string }
export interface FamilyGoal { title: string; icon: string; target: number; saved: number }

export type Tariff = 'start' | 'plus';
export interface FamilyPlan { tariff: Tariff; since: string; spendMonth: number; feeWaived: boolean }
export interface JoinRequest { id: string; name: string; age: number; phone: string; createdAt: string }

export interface ParentOverview {
  parent: { id: string; name: string; balance: number; cardMask: string; ops: Tx[]; phone: string | null };
  introSeen: boolean;
  plan: FamilyPlan;
  joinRequests: JoinRequest[];
  children: ChildSummary[];
  requests: ChildRequest[];
  feed: FeedItem[];
  familyGoal: FamilyGoal;
}

export interface ChildOverview {
  me: ChildDetail;
  requests: ChildRequest[];
  familyGoal: FamilyGoal;
}

export type PayDecision =
  | { status: 'approved'; text: string }
  | { status: 'pending'; text: string }
  | { status: 'declined'; reason: string; title: string; text: string; ask?: { type: 'perm'; key: SettingPath } | { type: 'money'; amount: number } | { type: 'limit'; day: number } };

export interface Device { userId: string; name: string; role: Role; group: AgeGroup | null; joined: boolean; inviteCode: string | null }
