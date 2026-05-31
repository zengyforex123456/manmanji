// Server payment logic unit tests
// Tests core payment functions without requiring Express server

import { describe, it, expect, beforeEach } from 'vitest';

// ─── Replicated from server/routes/payment.js ───
const PRICES = { single: 3990, all_access: 9900 };

function validatePlan(plan) { return !!PRICES[plan]; }
function calculateAmount(plan) { return PRICES[plan] || 0; }

class OrderStore {
  constructor() { this.orders = new Map(); }

  createOrder(plan, openid) {
    const outTradeNo = `MMJ${Date.now()}${Math.random().toString(36).substring(2, 10)}`;
    const order = {
      outTradeNo, plan, amount: PRICES[plan], description: plan,
      status: 'pending', createdAt: new Date().toISOString(), paidAt: null, openid
    };
    this.orders.set(outTradeNo, order);
    return order;
  }

  fulfillOrder(outTradeNo, tradeState) {
    const order = this.orders.get(outTradeNo);
    if (!order) return { error: 'Order not found' };
    if (order.status === 'fulfilled') return { already_fulfilled: true };

    if (tradeState === 'SUCCESS') {
      order.status = 'paid';
      order.paidAt = new Date().toISOString();
      order.status = 'fulfilled';
      return { success: true };
    }
    return { error: 'Payment not successful' };
  }

  getOrder(outTradeNo) {
    return this.orders.get(outTradeNo) || null;
  }
}

// ─── Tests ───

describe('Payment plan validation', () => {
  it('accepts single plan', () => expect(validatePlan('single')).toBe(true));
  it('accepts all_access plan', () => expect(validatePlan('all_access')).toBe(true));
  it('rejects invalid plan', () => expect(validatePlan('premium')).toBe(false));
  it('rejects empty string', () => expect(validatePlan('')).toBe(false));
});

describe('Amount calculation', () => {
  it('single = 39.90 yuan', () => expect(calculateAmount('single')).toBe(3990));
  it('all_access = 99.00 yuan', () => expect(calculateAmount('all_access')).toBe(9900));
  it('invalid plan returns 0', () => expect(calculateAmount('invalid')).toBe(0));
});

describe('OrderStore', () => {
  let store;

  beforeEach(() => { store = new OrderStore(); });

  it('creates order with correct amount', () => {
    const order = store.createOrder('single', 'user123');
    expect(order.amount).toBe(3990);
    expect(order.status).toBe('pending');
    expect(order.outTradeNo).toMatch(/^MMJ/);
  });

  it('generates unique order numbers', () => {
    const a = store.createOrder('single', 'u1');
    const b = store.createOrder('all_access', 'u2');
    expect(a.outTradeNo).not.toBe(b.outTradeNo);
  });

  it('fulfills order correctly', () => {
    const order = store.createOrder('single', 'u1');
    const result = store.fulfillOrder(order.outTradeNo, 'SUCCESS');
    expect(result.success).toBe(true);
    expect(store.getOrder(order.outTradeNo).status).toBe('fulfilled');
  });

  it('idempotent: duplicate fulfillment safe', () => {
    const order = store.createOrder('single', 'u1');
    store.fulfillOrder(order.outTradeNo, 'SUCCESS');
    const result2 = store.fulfillOrder(order.outTradeNo, 'SUCCESS');
    expect(result2.already_fulfilled).toBe(true);
  });

  it('rejects fulfillment for non-SUCCESS trade state', () => {
    const order = store.createOrder('single', 'u1');
    const result = store.fulfillOrder(order.outTradeNo, 'FAIL');
    expect(result.error).toBeTruthy();
  });

  it('returns null for unknown order', () => {
    expect(store.getOrder('nonexistent')).toBeNull();
  });
});
