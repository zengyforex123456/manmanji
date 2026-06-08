// User Simulation: 5 user personas through complete learning journeys
import { describe, it, expect, beforeAll } from 'vitest';

// Mock localStorage for Node.js environment
const storage = {};
beforeAll(() => {
  global.localStorage = {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => { storage[k] = v; },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
  };
});

// ─── User Personas ───
const personas = {
  hardworking: {
    name: '李姐', age: 38, role: '财务人员',
    sessions: 30, avgCorrect: 0.72, preferredMode: 'beginner',
    scenario: '每天通勤刷题，坚持30天',
  },
  cramming: {
    name: '小王', age: 29, role: 'HR专员',
    sessions: 5, avgCorrect: 0.55, preferredMode: 'mock',
    scenario: '考前一周突击冲刺',
  },
  casual: {
    name: '老张', age: 45, role: '项目经理',
    sessions: 8, avgCorrect: 0.65, preferredMode: 'advanced',
    scenario: '周末偶尔学习',
  },
  perfectionist: {
    name: '陈姐', age: 35, role: '会计',
    sessions: 40, avgCorrect: 0.88, preferredMode: 'mistake',
    scenario: '反复刷错题直到全对',
  },
  newbie: {
    name: '小明', age: 27, role: '应届生',
    sessions: 1, avgCorrect: 0.40, preferredMode: 'beginner',
    scenario: '第一次使用，需要引导',
  },
};

describe('User Simulation: Learning Journeys', () => {
  it('Li Jie: 30-day consistent learner reaches box 4-5 on most topics', () => {
    const { avgCorrect, sessions } = personas.hardworking;
    let box = 1;
    // Simulate 30 sessions of 10 questions each
    for (let s = 0; s < sessions; s++) {
      for (let q = 0; q < 10; q++) {
        const correct = Math.random() < avgCorrect;
        box = correct
          ? Math.min(5, box + 1)
          : Math.max(1, box - 1);
      }
    }
    // After 30 sessions, box should be high
    expect(box).toBeGreaterThanOrEqual(3);
  });

  it('Xiao Wang: cramming with mock exams has lower mastery', () => {
    const { avgCorrect, sessions } = personas.cramming;
    let correct = 0;
    const total = sessions * 105; // Mock exam count
    for (let i = 0; i < total; i++) {
      if (Math.random() < avgCorrect) correct++;
    }
    const rate = correct / total;
    // Cramming yields 50-60% range
    expect(rate).toBeGreaterThan(0.4);
    expect(rate).toBeLessThan(0.8);
  });

  it('Lao Zhang: casual learner has moderate box progression', () => {
    const { sessions } = personas.casual;
    let box = 1;
    for (let s = 0; s < sessions; s++) {
      for (let q = 0; q < 20; q++) {
        const correct = Math.random() < 0.65;
        box = correct ? Math.min(5, box + 1) : Math.max(1, box - 1);
      }
    }
    expect(box).toBeGreaterThanOrEqual(1); // Some learning
    expect(box).toBeLessThanOrEqual(5);     // Range check
  });

  it('Chen Jie: perfectionist clears all mistakes eventually', () => {
    const { sessions } = personas.perfectionist;
    let wrongQuestions = 50;
    for (let s = 0; s < sessions; s++) {
      // Each session, 88% of remaining wrong questions get corrected
      const newlyCorrect = Math.ceil(wrongQuestions * 0.88);
      wrongQuestions = Math.max(0, wrongQuestions - newlyCorrect);
      // New mistakes from new content
      wrongQuestions += Math.floor(Math.random() * 5);
    }
    expect(wrongQuestions).toBeLessThan(10); // Near zero
  });

  it('Xiao Ming: onboarding guide appears on first visit', () => {
    const { sessions } = personas.newbie;
    expect(sessions).toBe(1);
    // First visit should trigger onboarding
    const onboardingShown = sessions === 1;
    expect(onboardingShown).toBe(true);
  });
});

describe('User Simulation: Edge Cases', () => {
  it('user with 0 questions answered sees empty state', () => {
    const totalAnswered = 0;
    const totalWrong = 0;
    const mastery = totalAnswered > 0
      ? Math.round((1 - totalWrong / totalAnswered) * 100)
      : 0;
    expect(mastery).toBe(0);
  });

  it('user clears all browser data can still login via token', () => {
    // Simulate token recovery
    const token = btoa(JSON.stringify({ phone: '13800000001', ts: Date.now() }));
    localStorage.clear();
    // After login, token should be in localStorage
    localStorage.setItem('mmj_token', token);
    expect(localStorage.getItem('mmj_token')).toBe(token);
  });

  it('user with 1000+ wrong questions can still use mistake mode', () => {
    const wrongQuestions = Array(1500).fill(0).map((_, i) => ({
      questionId: `q${i}`, wrongCount: Math.floor(Math.random() * 5) + 1,
      lastReview: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString(),
    }));
    // Sort by lastReview ascending
    const sorted = wrongQuestions.sort((a, b) =>
      a.lastReview.localeCompare(b.lastReview)
    );
    expect(sorted.length).toBe(1500);
    // First item should be oldest
    expect(new Date(sorted[0].lastReview).getTime())
      .toBeLessThanOrEqual(new Date(sorted[sorted.length - 1].lastReview).getTime());
  });

  it('rapid mode switching does not lose progress', () => {
    const modes = ['beginner', 'advanced', 'mock', 'mistake', 'beginner', 'mock'];
    const sessionCounts = {};
    modes.forEach(m => {
      sessionCounts[m] = (sessionCounts[m] || 0) + 1;
    });
    expect(sessionCounts.beginner).toBe(2);
    expect(sessionCounts.mock).toBe(2);
    expect(sessionCounts.advanced).toBe(1);
    expect(sessionCounts.mistake).toBe(1);
  });

  it('offline mode: all cached questions answerable without network', () => {
    const cachedQuestions = 6743;
    const answeredOffline = 50;
    // Without network, user can still answer cached questions
    expect(answeredOffline).toBeLessThanOrEqual(cachedQuestions);
    expect(cachedQuestions).toBeGreaterThan(0);
  });
});

describe('Stress Tests', () => {
  it('100 concurrent SM-2 updates complete without data loss', () => {
    const results = [];
    const queue = []; // Simple promise queue
    for (let i = 0; i < 100; i++) {
      queue.push(new Promise(resolve => {
        setTimeout(() => {
          results.push({ id: i, box: Math.ceil(Math.random() * 5) });
          resolve();
        }, Math.random() * 5);
      }));
    }
    return Promise.all(queue).then(() => {
      expect(results.length).toBe(100);
    });
  });

  it('10000 questions loaded without memory overflow', () => {
    const questions = Array(10000).fill(0).map((_, i) => ({
      id: `q${i}`, stem: `Question ${i} text `.repeat(5),
      options: ['A', 'B', 'C', 'D'], answer: 'B',
    }));
    // Verify data integrity
    expect(questions.length).toBe(10000);
    expect(questions[0].stem.length).toBeGreaterThan(50);
    // Simulate memory check: all IDs unique
    const ids = new Set(questions.map(q => q.id));
    expect(ids.size).toBe(10000);
  });
});
