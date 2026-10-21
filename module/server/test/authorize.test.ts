import { describe, expect, it } from 'vitest';
import { authorize, payingCard, type AuthState } from '../src/domain/authorize';
import { defaultSettings } from '../src/content';
import type { Card } from '../src/types';

const sticker: Card = { id: 'c1', type: 'sticker', last4: '4417', color: '#E4252F', status: 'active', label: null, favorite: false };
const virtual: Card = { id: 'c2', type: 'virtual', last4: '9921', color: '#1F5FD6', status: 'active', label: null, favorite: false };
const kid = (over: Partial<AuthState> = {}): AuthState => ({ settings: defaultSettings('kid'), balance: 5000, spentToday: 0, spentMonth: 0, cards: [sticker, virtual], ...over });
const buy = (amount: number, category: any = 'shop', method: any = 'card') => ({ title: 'Покупка', amount, category, method });

describe('authorize', () => {
  it('одобряет обычную покупку в пределах лимитов', () => {
    expect(authorize(kid(), buy(350, 'food')).status).toBe('approved');
  });

  it('всегда блокирует азартные игры и 18+, даже если родитель одобрил', () => {
    for (const cat of ['gambling', 'adult']) {
      const d = authorize(kid(), buy(100, cat), { parentApproved: true });
      expect(d).toMatchObject({ status: 'declined', reason: 'bank_block' });
    }
  });

  it('закрытая категория предлагает запросить доступ', () => {
    const d = authorize(kid(), buy(500, 'games'));
    expect(d).toMatchObject({ status: 'declined', reason: 'category', ask: { type: 'perm', key: 'cats.games' } });
  });

  it('дорогая покупка уходит на подтверждение родителю', () => {
    expect(authorize(kid(), buy(1490)).status).toBe('pending');
  });

  it('дневной лимит учитывает уже потраченное', () => {
    const d = authorize(kid({ spentToday: 1200 }), buy(500));
    expect(d).toMatchObject({ status: 'declined', reason: 'day_limit', ask: { type: 'limit', day: 1700 } });
  });

  it('не даёт уйти в минус и предлагает попросить недостающее', () => {
    const d = authorize(kid({ balance: 300 }), buy(500, 'food'));
    expect(d).toMatchObject({ status: 'declined', reason: 'funds', ask: { type: 'money', amount: 200 } });
  });

  it('без активных карт оплата картой невозможна, а по QR КРОК — возможна', () => {
    const s = kid({ cards: [{ ...sticker, status: 'blocked' }, { ...virtual, status: 'blocked' }] });
    s.settings.perms.qr = true;
    expect(authorize(s, buy(350, 'food')).status).toBe('declined');
    expect(authorize(s, buy(350, 'food', 'qr')).status).toBe('approved');
  });

  it('QR КРОК требует разрешения и не выдаёт наличные', () => {
    expect(authorize(kid(), buy(350, 'food', 'qr'))).toMatchObject({ reason: 'qr_disabled' });
    const s = kid(); s.settings.perms.qr = true; s.settings.cats.cash = true;
    expect(authorize(s, buy(2000, 'cash', 'qr'))).toMatchObject({ reason: 'qr_cash' });
  });

  it('оплачивает физической картой, а если она заблокирована — виртуальной', () => {
    expect(payingCard([sticker, virtual])?.id).toBe('c1');
    expect(payingCard([{ ...sticker, status: 'blocked' }, virtual])?.id).toBe('c2');
    expect(payingCard([{ ...sticker, status: 'delivery' }])).toBeNull();
  });

  it('отклоняет нулевые и дробные суммы', () => {
    expect(authorize(kid(), buy(0)).status).toBe('declined');
    expect(authorize(kid(), buy(1.5)).status).toBe('declined');
  });
});
