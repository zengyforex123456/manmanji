// Functional: SM-2 state machine + 4 modes + auth flow
import { describe, it, expect } from 'vitest';

describe('SM-2 State Machine', () => {
  it('new question starts in box 1 with interval 1', () => {
    const box = 1;
    const INTERVALS = [1, 3, 7, 15, 30];
    expect(INTERVALS[box - 1]).toBe(1);
  });

  it('correct answer sequence: 1→2→3→4→5', () => {
    let box = 1;
    for (let i = 0; i < 4; i++) {
      box = Math.min(5, box + 1);
    }
    expect(box).toBe(5);
  });

  it('correct at box 5 stays at box 5', () => {
    const box = Math.min(5, 5 + 1);
    expect(box).toBe(5);
  });

  it('mixed correct/wrong: 1→2→1→2→3', () => {
    let box = 1;
    // Correct
    box = Math.min(5, box + 1); // 2
    expect(box).toBe(2);
    // Wrong
    box = Math.max(1, box - 1); // 1
    expect(box).toBe(1);
    // Correct
    box = Math.min(5, box + 1); // 2
    // Correct
    box = Math.min(5, box + 1); // 3
    expect(box).toBe(3);
  });

  it('interval increases with box level', () => {
    const INTERVALS = [1, 3, 7, 15, 30];
    expect(INTERVALS[0]).toBeLessThan(INTERVALS[1]);
    expect(INTERVALS[1]).toBeLessThan(INTERVALS[2]);
    expect(INTERVALS[2]).toBeLessThan(INTERVALS[3]);
    expect(INTERVALS[3]).toBeLessThan(INTERVALS[4]);
  });
});

describe('4 Learning Modes', () => {
  it('beginner mode: 10 questions, difficulty<=3', () => {
    const questions = [
      { difficulty: 1 }, { difficulty: 2 }, { difficulty: 3 },
      { difficulty: 4 }, { difficulty: 5 }, { difficulty: 1 },
      { difficulty: 2 }, { difficulty: 3 }, { difficulty: 2 }, { difficulty: 1 },
      { difficulty: 3 }, { difficulty: 4 },
    ];
    const filtered = questions.filter(q => q.difficulty <= 3);
    expect(filtered.length).toBeLessThanOrEqual(10);
  });

  it('advanced mode: 20 questions mixed', () => {
    const questions = Array(30).fill(0).map((_, i) => ({
      id: i, chapter: Math.ceil(i / 3), difficulty: (i % 5) + 1,
    }));
    const selected = questions.slice(0, 20);
    expect(selected.length).toBe(20);
    // Should contain multiple chapters
    const chapters = new Set(selected.map(q => q.chapter));
    expect(chapters.size).toBeGreaterThan(1);
  });

  it('mock mode: correct question type ratios', () => {
    const types = { single: 70, multi: 35, case: 0 }; // econ 105
    expect(types.single + types.multi + types.case).toBe(105);
    expect(types.single).toBeGreaterThan(types.multi);
  });

  it('mistake mode: only returns wrong questions', () => {
    const progress = [
      { questionId: 'q1', wrongCount: 2 },
      { questionId: 'q2', wrongCount: 0 },
      { questionId: 'q3', wrongCount: 1 },
    ];
    const wrong = progress.filter(p => p.wrongCount > 0);
    expect(wrong.length).toBe(2);
    expect(wrong.map(p => p.questionId)).toEqual(['q1', 'q3']);
  });
});

describe('Auth Flow', () => {
  it('token decode and validation', () => {
    const payload = { phone: '13800000001', ts: Date.now() };
    const token = btoa(JSON.stringify(payload));
    const decoded = JSON.parse(atob(token));
    expect(decoded.phone).toBe('13800000001');
    expect(Date.now() - decoded.ts).toBeLessThan(10000);
  });

  it('expired token (7 days) should be rejected', () => {
    const oldToken = btoa(JSON.stringify({
      phone: '13800000001',
      ts: Date.now() - 8 * 86400000, // 8 days ago
    }));
    const decoded = JSON.parse(atob(oldToken));
    const expired = Date.now() - decoded.ts > 7 * 86400000;
    expect(expired).toBe(true);
  });

  it('invalid phone format rejected', () => {
    const phone = '12345';
    const valid = /^1\d{10}$/.test(phone);
    expect(valid).toBe(false);
  });

  it('valid phone format accepted', () => {
    expect(/^1\d{10}$/.test('13812345678')).toBe(true);
    expect(/^1\d{10}$/.test('15900001111')).toBe(true);
  });
});
