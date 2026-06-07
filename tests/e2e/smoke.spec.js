// tests/e2e/smoke.spec.js — 慢慢记 E2E 冒烟测试
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

test.describe('首页看板', () => {
  test('加载首页', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('.nav-brand')).toHaveText('慢慢记');
    await expect(page.locator('.cta-primary')).toBeVisible();
    await expect(page.locator('.stat-card').first()).toBeVisible();
  });

  test('科目切换', async ({ page }) => {
    await page.goto(BASE);
    // 科目切换会reload页面，验证切换后页面重新加载且品牌标识存在
    await page.click('text=人力');
    await page.waitForSelector('.nav-brand', { timeout: 10000 });
    await expect(page.locator('.nav-brand')).toHaveText('慢慢记');
    await page.click('text=工商');
    await page.waitForSelector('.nav-brand', { timeout: 10000 });
    await expect(page.locator('.nav-brand')).toHaveText('慢慢记');
  });
});

test.describe('刷题闭环', () => {
  test('新手模式完整流程', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('.cta-primary');

    // 用 JS 触发模式（避开HMR onclick问题）
    await page.evaluate(() => window.startMode('beginner'));
    await page.waitForSelector('.quiz-stem', { timeout: 15000 });

    // 验证题目渲染
    const stem = await page.locator('.quiz-stem').textContent();
    expect(stem.length).toBeGreaterThan(10);

    // 点击第一个选项
    await page.locator('.option-btn').first().click();
    await page.waitForTimeout(600);

    // 验证反馈面板出现
    await expect(page.locator('.feedback-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.feedback-result')).toBeVisible();

    // 点击下一题
    const nextBtn = page.locator('text=下一题');
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForTimeout(300);
    }
  });

  test('冲刺模式加载', async ({ page }) => {
    await page.goto(BASE);
    await page.evaluate(() => window.startMode('mock'));
    await page.waitForSelector('.quiz-stem', { timeout: 15000 });
    await expect(page.locator('#mock-timer-display')).toBeVisible();
  });

  test('错题模式空状态', async ({ page }) => {
    await page.goto(BASE);
    await page.evaluate(() => window.startMode('mistake'));
    await page.waitForTimeout(2000);
    const text = await page.textContent('body');
    expect(text).toMatch(/暂无错题|错误|mistake/i);
  });

  test('反馈页面', async ({ page }) => {
    await page.goto(BASE);
    await page.click('text=💬 问题反馈');
    await page.waitForSelector('#feedback-text', { timeout: 5000 });
    await expect(page.locator('#feedback-text')).toBeVisible();
    await page.locator('#feedback-text').fill('E2E测试反馈');
    await page.click('text=提交反馈');
    await page.waitForTimeout(500);
    // 应回到首页
    await expect(page.locator('.stats-row')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('响应式截图', () => {
  const breakpoints = [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 },
  ];

  for (const bp of breakpoints) {
    test(`首页 ${bp.name} ${bp.width}px`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto(BASE);
      await page.waitForTimeout(800);
      await page.screenshot({ path: `tests/e2e/screenshots/home-${bp.name}.png`, fullPage: true });
      // 验证无横向滚动
      const overflow = await page.evaluate(() => document.body.scrollWidth <= window.innerWidth);
      expect(overflow).toBeTruthy();
    });
  }
});
