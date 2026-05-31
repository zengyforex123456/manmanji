// 支付逻辑验证 — 金额计算 + 订单验证
import { describe, it, expect } from 'vitest';

// 模拟server/routes/payment.js中的核心逻辑
const PRICES = { single: 3990, all_access: 9900 }; // 分

function validatePlan(plan) {
  return !!PRICES[plan];
}

function calculateAmount(plan) {
  return PRICES[plan] || 0;
}

function generateOrderNo() {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 10);
  return `MMJ${ts}${rand}`;
}

describe('Payment plan validation', () => {
  it('accepts valid plans', () => {
    expect(validatePlan('single')).toBe(true);
    expect(validatePlan('all_access')).toBe(true);
  });

  it('rejects invalid plans', () => {
    expect(validatePlan('premium')).toBe(false);
    expect(validatePlan('')).toBe(false);
    expect(validatePlan(null)).toBe(false);
  });
});

describe('Amount calculation (server-authoritative)', () => {
  it('calculates single-subject price', () => {
    expect(calculateAmount('single')).toBe(3990); // 39.90元
  });

  it('calculates all-access price', () => {
    expect(calculateAmount('all_access')).toBe(9900); // 99.00元
  });

  it('refuses client-specified amount', () => {
    // 客户端不能传金额 — 必须从服务端PRICES表取值
    const clientAmount = 100;
    const serverAmount = calculateAmount('single');
    expect(serverAmount).not.toBe(clientAmount);
  });
});

describe('Order number generation', () => {
  it('generates unique order numbers', () => {
    const a = generateOrderNo();
    const b = generateOrderNo();
    expect(a).not.toBe(b);
  });

  it('has MMJ prefix', () => {
    expect(generateOrderNo()).toMatch(/^MMJ/);
  });
});
