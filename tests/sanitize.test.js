// XSS防护 — sanitizeHTML 单元测试
import { describe, it, expect } from 'vitest';

// 从app.js提取的sanitizeHTML函数（独立测试，不依赖DOM）
function sanitizeHTML(str) {
  if (!str || typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

describe('sanitizeHTML', () => {
  it('escapes < and >', () => {
    expect(sanitizeHTML('<script>alert(1)</script>'))
      .toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes &', () => {
    expect(sanitizeHTML('a & b')).toBe('a &amp; b');
  });

  it('escapes quotes', () => {
    expect(sanitizeHTML('"hello"')).toBe('&quot;hello&quot;');
  });

  it('returns empty string for null/undefined', () => {
    expect(sanitizeHTML(null)).toBe('');
    expect(sanitizeHTML(undefined)).toBe('');
    expect(sanitizeHTML('')).toBe('');
  });

  it('passes through safe text unchanged', () => {
    expect(sanitizeHTML('正常的考点口诀')).toBe('正常的考点口诀');
  });

  it('handles numbers', () => {
    expect(sanitizeHTML(123)).toBe('');
  });

  it('escapes img onerror XSS', () => {
    const input = '<img src=x onerror="alert(1)">';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('<img');
    expect(result).not.toContain('onerror');
  });
});
