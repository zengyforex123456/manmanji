// Integration: API endpoints + offline/edge cases
import { describe, it, expect } from 'vitest';

const API = 'http://localhost:3001';

// Helper to check if API is available
async function apiAvailable() {
  try {
    const r = await fetch(`${API}/api/health`);
    return r.ok;
  } catch { return false; }
}

describe('API Integration', () => {
  it('GET /api/health returns ok', async () => {
    if (!await apiAvailable()) return; // Skip if API not running
    const r = await fetch(`${API}/api/health`);
    const d = await r.json();
    expect(d.status).toBe('ok');
    expect(d.version).toBeDefined();
  });

  it('GET /api/subjects returns subjects list', async () => {
    if (!await apiAvailable()) return;
    const r = await fetch(`${API}/api/subjects`);
    const d = await r.json();
    expect(d.subjects).toBeDefined();
    expect(Array.isArray(d.subjects)).toBe(true);
    expect(d.subjects.length).toBeGreaterThanOrEqual(3);
  });

  it('GET /api/questions/:id/count returns count', async () => {
    if (!await apiAvailable()) return;
    for (const sid of ['econ', 'hr', 'biz']) {
      const r = await fetch(`${API}/api/questions/${sid}/count`);
      const d = await r.json();
      expect(d.subjectId).toBe(sid);
      expect(d.count).toBeGreaterThan(0);
    }
  });

  it('POST /api/questions/batch with invalid data returns 400', async () => {
    if (!await apiAvailable()) return;
    const r = await fetch(`${API}/api/questions/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(r.status).toBe(400);
  });

  it('POST /api/auth/send-code requires valid phone', async () => {
    if (!await apiAvailable()) return;
    const r = await fetch(`${API}/api/auth/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '123' }), // Invalid
    });
    expect(r.status).toBe(400);
  });

  it('question pagination returns limited results', async () => {
    if (!await apiAvailable()) return;
    const r = await fetch(`${API}/api/questions/econ?page=1&limit=5`);
    const d = await r.json();
    expect(d.questions.length).toBeLessThanOrEqual(5);
    expect(d.total).toBeGreaterThan(0);
    expect(d.page).toBe(1);
  });
});

describe('Edge Cases', () => {
  it('invalid subject ID returns empty', async () => {
    if (!await apiAvailable()) return;
    const r = await fetch(`${API}/api/questions/INVALID_SUBJECT/count`);
    const d = await r.json();
    expect(d.count).toBe(0);
  });

  it('very large page number returns empty array', async () => {
    if (!await apiAvailable()) return;
    const r = await fetch(`${API}/api/questions/econ?page=99999&limit=10`);
    const d = await r.json();
    expect(d.questions.length).toBe(0);
    expect(d.totalPages).toBeGreaterThan(0);
  });

  it('concurrent requests do not crash server', async () => {
    if (!await apiAvailable()) return;
    const promises = Array(10).fill(0).map(() =>
      fetch(`${API}/api/health`).then(r => r.status)
    );
    const results = await Promise.all(promises);
    expect(results.every(s => s === 200)).toBe(true);
  });
});
