// Правила авторизации детской операции. Чистая функция без побочных эффектов:
// порядок проверок — способ оплаты, защита банка, разрешения родителя,
// баланс, подтверждение родителем, дневной и месячный лимиты.
import { BANK_BLOCKED, CARD_TYPES, CATEGORY_SETTING, SETTING_LABELS } from '../content';
import type { Card, Category, ChildSettings, PayDecision, PayMethod } from '../types';
import { fmt } from './money';

export interface AuthState {
  settings: ChildSettings;
  balance: number;
  spentToday: number;
  spentMonth: number;
  cards: Card[];
}
export interface PayInput { title: string; amount: number; category: Category; method: PayMethod; partner?: boolean }
export interface AuthOptions {
  /** Родитель уже одобрил эту операцию: пропускаем подтверждение и лимиты */
  parentApproved?: boolean;
}

const usable = (c: Card) => c.status === 'active';

/** Карта, которой пройдёт оплата: сначала физическая, потом виртуальная */
export function payingCard(cards: Card[]): Card | null {
  return cards.find(c => usable(c) && CARD_TYPES[c.type].physical) ?? cards.find(usable) ?? null;
}

export function authorize(s: AuthState, p: PayInput, opts: AuthOptions = {}): PayDecision {
  if (!Number.isInteger(p.amount) || p.amount <= 0) {
    return { status: 'declined', reason: 'amount', title: 'Неверная сумма', text: 'Сумма должна быть больше нуля.' };
  }
  const qr = p.method === 'qr';
  const needsCard = !qr && (p.category !== 'erip' && p.category !== 'p2p');

  if (qr && !s.settings.perms.qr) {
    return { status: 'declined', reason: 'qr_disabled', title: 'QR-оплата закрыта родителем', text: 'Оплата по QR КРОК пока недоступна. Можно попросить родителя её включить.', ask: { type: 'perm', key: 'perms.qr' } };
  }
  if (qr && p.category === 'cash') {
    return { status: 'declined', reason: 'qr_cash', title: 'По QR наличные не выдаются', text: 'КРОК — это оплата покупок по QR. Для банкомата нужна карта.' };
  }
  if (needsCard && !payingCard(s.cards)) {
    return { status: 'declined', reason: 'no_card', title: 'Нет активных карт', text: 'Все карты заблокированы или ещё в доставке. Разблокировать карту может родитель.' };
  }
  if (BANK_BLOCKED.includes(p.category)) {
    return {
      status: 'declined', reason: 'bank_block', title: 'Операция запрещена банком',
      text: p.category === 'gambling'
        ? 'Азартные игры, ставки и лотереи недоступны до 18 лет. Эту защиту не может отключить даже родитель.'
        : 'Табак, алкоголь и вейпы недоступны по детским картам. Защиту нельзя отключить.',
    };
  }
  const setting = CATEGORY_SETTING[p.category];
  if (setting && !opts.parentApproved) {
    const [group, key] = setting.split('.') as ['cats' | 'perms', string];
    if (!(s.settings[group] as Record<string, boolean>)[key]) {
      return { status: 'declined', reason: 'category', title: 'Закрыто родителем', text: `«${SETTING_LABELS[setting].title}» пока недоступно. Можно попросить родителя открыть доступ.`, ask: { type: 'perm', key: setting } };
    }
  }
  if (p.amount > s.balance) {
    const missing = p.amount - s.balance;
    return { status: 'declined', reason: 'funds', title: 'Недостаточно средств', text: `На счёте ${fmt(s.balance)}, нужно ещё ${fmt(missing)}.`, ask: { type: 'money', amount: Math.ceil(missing / 100) * 100 } };
  }
  if (opts.parentApproved) return { status: 'approved', text: '' };
  if (p.amount > s.settings.confirmAbove) {
    return { status: 'pending', text: `Покупки дороже ${fmt(s.settings.confirmAbove)} подтверждает родитель. Запрос отправлен: как только он одобрит, оплата пройдёт.` };
  }
  if (s.spentToday + p.amount > s.settings.limits.day) {
    const need = Math.ceil((s.spentToday + p.amount) / 100) * 100;
    return { status: 'declined', reason: 'day_limit', title: 'Дневной лимит исчерпан', text: `Лимит ${fmt(s.settings.limits.day)} в день, сегодня потрачено ${fmt(s.spentToday)}.`, ask: { type: 'limit', day: need } };
  }
  if (s.spentMonth + p.amount > s.settings.limits.month) {
    return { status: 'declined', reason: 'month_limit', title: 'Месячный лимит исчерпан', text: `Лимит ${fmt(s.settings.limits.month)} в месяц, потрачено ${fmt(s.spentMonth)}.` };
  }
  return { status: 'approved', text: '' };
}
