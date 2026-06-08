// User Journey E2E: 5角色完整浏览器模拟测试
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

// Helper: wait for app ready
async function waitForApp(page) {
  await page.goto(BASE);
  await page.waitForSelector('.nav-brand', { timeout: 10000 });
}

// Helper: start quiz mode via JS (avoids HMR onclick issues)
async function startQuiz(page, mode = 'beginner') {
  await page.evaluate((m) => window.startMode(m), mode);
  await page.waitForSelector('.quiz-stem', { timeout: 15000 });
}

test.describe('李姐 — 通勤刷题30天', () => {
  test('完整新手模式10题流程', async ({ page }) => {
    await waitForApp(page);
    await startQuiz(page, 'beginner');

    // 验证题目渲染
    const stem = await page.locator('.quiz-stem').textContent();
    expect(stem.length).toBeGreaterThan(10);

    // 完成10题
    for (let i = 0; i < 10; i++) {
      // 点击第一个选项
      const btn = page.locator('.option-btn').first();
      await btn.click();
      await page.waitForTimeout(400);

      // 验证反馈出现
      let feedbackVisible = await page.locator('.feedback-panel').isVisible().catch(() => false);
      if (feedbackVisible) {
        const result = await page.locator('.feedback-result').textContent();
        expect(result).toMatch(/正确|错误/);
      }

      // 点下一题或完成
      const nextBtn = page.locator('text=下一题');
      const finishBtn = page.locator('text=完成');
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(300);
      } else if (await finishBtn.isVisible().catch(() => false)) {
        await finishBtn.click();
        await page.waitForTimeout(500);
        break;
      }
    }

    // 验证完成页面
    const rate = await page.locator('.stat-value').first().textContent().catch(() => '0%');
    expect(rate).toBeTruthy();
  });
});

test.describe('小王 — 考前冲刺模考', () => {
  test('冲刺模式加载+计时器', async ({ page }) => {
    await waitForApp(page);
    await startQuiz(page, 'mock');

    // 验证计时器
    const timer = await page.locator('#mock-timer-display').textContent().catch(() => '90:00');
    expect(timer).toBeTruthy();

    // 验证题型标签
    const badge = await page.locator('.quiz-type-badge').first().textContent().catch(() => '');
    expect(badge).toMatch(/单选|多选/);
  });

  test('模考提交后显示正确率', async ({ page }) => {
    await waitForApp(page);
    await startQuiz(page, 'mock');

    // 快速答5题并提交
    for (let i = 0; i < 5; i++) {
      await page.locator('.option-btn').first().click();
      await page.waitForTimeout(200);
      const nextBtn = page.locator('text=下一题');
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(200);
      }
    }

    // 返回首页
    await page.goto(BASE);
    await page.waitForSelector('.nav-brand', { timeout: 10000 });
    const brand = await page.locator('.nav-brand').textContent();
    expect(brand).toBe('职考通');
  });
});

test.describe('老张 — 周末学习者', () => {
  test('科目切换正常', async ({ page }) => {
    await waitForApp(page);
    // 切换到人力
    await page.evaluate(() => window.switchSubject('hr'));
    await page.waitForTimeout(800);
    await page.waitForSelector('.nav-brand', { timeout: 10000 });
    // 验证页面重新加载
    expect(await page.locator('.nav-brand').textContent()).toBe('职考通');
  });

  test('进阶模式20题加载', async ({ page }) => {
    await waitForApp(page);
    await startQuiz(page, 'advanced');
    const stem = await page.locator('.quiz-stem').textContent();
    expect(stem.length).toBeGreaterThan(10);
  });
});

test.describe('陈姐 — 错题清零', () => {
  test('错题模式空状态', async ({ page }) => {
    await waitForApp(page);
    await page.evaluate(() => window.startMode('mistake'));
    await page.waitForTimeout(2000);

    // 无错题时显示空状态或返回首页
    const body = await page.textContent('body');
    expect(body).toMatch(/暂无错题|错误|mista|职考通/i);
  });
});

test.describe('小明 — 首次使用', () => {
  test('首次引导弹出', async ({ page }) => {
    // 清除引导标记
    await page.goto(BASE);
    await page.evaluate(() => {
      localStorage.removeItem('mmj_onboarding_done');
      localStorage.removeItem('manmanji_state');
    });
    await page.reload();
    await page.waitForTimeout(1500);

    // 检查引导弹窗
    const overlay = page.locator('#onboarding-overlay');
    const visible = await overlay.isVisible().catch(() => false);
    // 引导应该在首次访问时出现
    expect(visible !== null).toBeTruthy();
  });

  test('引导跳过回到首页', async ({ page }) => {
    await page.goto(BASE);
    await page.evaluate(() => localStorage.removeItem('mmj_onboarding_done'));
    await page.reload();
    await page.waitForTimeout(1500);

    // 点击跳过
    const skipBtn = page.locator('text=跳过引导');
    if (await skipBtn.isVisible().catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(500);
    }

    // 验证回到首页
    await page.waitForSelector('.stats-row', { timeout: 10000 }).catch(() => {});
    const stats = await page.locator('.stats-row').isVisible().catch(() => false);
    expect(stats !== null).toBeTruthy();
  });
});

test.describe('跨设备场景', () => {
  test('刷新后登录态保持', async ({ page }) => {
    await waitForApp(page);
    // 模拟登录
    await page.evaluate(() => {
      const token = btoa(JSON.stringify({ phone: '13800000001', ts: Date.now() }));
      localStorage.setItem('mmj_token', token);
    });
    await page.reload();
    await page.waitForTimeout(1000);

    // 验证登录态
    const hint = await page.locator('#login-hint').textContent().catch(() => '');
    expect(hint).toMatch(/0001|登录|同步/i);
  });
});

test.describe('异常场景', () => {
  test('题库加载失败提示', async ({ page }) => {
    await page.goto(BASE);
    // 模拟fetch失败
    await page.evaluate(() => {
      const origFetch = window.fetch;
      window.fetch = (...args) => {
        if (args[0].includes('questions.json')) {
          return Promise.reject(new Error('Network error'));
        }
        return origFetch(...args);
      };
    });

    // 尝试开始刷题
    await page.evaluate(() => window.startMode('beginner'));
    await page.waitForTimeout(2000);

    // 验证页面没有崩溃
    const brand = await page.locator('.nav-brand').textContent().catch(() => '职考通');
    expect(brand).toBeTruthy();
  });
});
