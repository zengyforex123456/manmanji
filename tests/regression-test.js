// tests/regression-test.js — 回归测试: 重构后必跑
// 捕获组件提取引入的DOM引用断裂
import { JSDOM } from 'jsdom';
import { expect } from 'vitest';

// 模拟浏览器环境
var dom = new JSDOM('<!DOCTYPE html><body><div id="app"></div></body>', { url: 'http://localhost' });
global.document = dom.window.document;
global.localStorage = { _data: {}, getItem(k) { return this._data[k] || null; }, setItem(k, v) { this._data[k] = v; }, removeItem(k) { delete this._data[k]; } };

describe('组件契约 - 重构后引用不断裂', function() {

  test('WelcomeBar: render + updateCountdown 配套导出', async function() {
    var m = await import('../src/components/WelcomeBar.js');
    expect(typeof m.renderWelcomeBar).toBe('function');
    expect(typeof m.updateCountdown).toBe('function');

    // render产生含data-countdown的元素
    var html = m.renderWelcomeBar({ userId: null, membershipTier: 'free' });
    expect(html).toContain('data-countdown');
    document.getElementById('app').innerHTML = html;

    // update不抛异常
    expect(function() { m.updateCountdown({ userId: 'test', membershipTier: 'vip' }); }).not.toThrow();
    var el = document.querySelector('[data-countdown]');
    expect(el).not.toBeNull();
    expect(el.textContent).toContain('VIP');
  });

  test('AIBrain: 渲染包括关键按钮', async function() {
    var m = await import('../src/components/AIBrain.js');
    var html = m.renderAIBrain();
    expect(html).toContain('ai-prompt-input');
    expect(html).toContain('startAIFromPrompt');
    expect(html).toContain('startAIExam');
  });

  test('api.js: generateQuestions端点存在', async function() {
    var m = await import('../src/api.js');
    expect(m.default.ai).toBeDefined();
    expect(typeof m.default.ai.generateQuestions).toBe('function');
    expect(typeof m.default.ai.ask).toBe('function');
  });

  test('ai-question-generator: 所有导出可用', async function() {
    var m = await import('../src/services/ai-question-generator.js');
    expect(typeof m.generateQuestions).toBe('function');
    expect(typeof m.analyzeWeakPoints).toBe('function');
    expect(typeof m.generateDailyPlan).toBe('function');
  });

  test('main.js: 全局函数定义在window上', async function() {
    // 模拟window
    global.window = global;
    await import('../src/main.js');
    expect(typeof window.startAIQuick).toBe('function');
    expect(typeof window.startAIFromPrompt).toBe('function');
    expect(typeof window.startAIExam).toBe('function');
    expect(typeof window.startAIWeak).toBe('function');
  });

});
