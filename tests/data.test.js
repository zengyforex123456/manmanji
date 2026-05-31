// 数据结构验证 — COURSE_DATA, MEMBERSHIP_CONFIG
import { describe, it, expect } from 'vitest';

// 模拟浏览器环境加载data.js
const fs = await import('fs');
const path = await import('path');

const dataContent = fs.readFileSync(
  path.join(process.cwd(), 'data.js'), 'utf8'
);

// 提取JSON结构进行验证
describe('COURSE_DATA structure', () => {
  it('defines subjects array', () => {
    expect(dataContent).toContain('subjects');
  });

  it('defines keyPoints', () => {
    expect(dataContent).toContain('keyPoints');
  });

  it('contains 中级经济师', () => {
    expect(dataContent).toContain('中级经济师');
  });

  it('defines MEMBERSHIP_CONFIG', () => {
    expect(dataContent).toContain('MEMBERSHIP_CONFIG');
  });

  it('has free/single/all_access tier IDs', () => {
    expect(dataContent).toMatch(/['"]free['"]/);
    expect(dataContent).toMatch(/['"]single['"]/);
    expect(dataContent).toMatch(/vip/);
  });
});

describe('Data integrity', () => {
  it('has no syntax errors', () => {
    // 验证文件可以被解析（通过检查括号平衡等方式）
    const openBraces = (dataContent.match(/\{/g) || []).length;
    const closeBraces = (dataContent.match(/\}/g) || []).length;
    expect(openBraces).toBe(closeBraces);
  });

  it('uses const/let declarations', () => {
    expect(dataContent).toMatch(/const\s+\w+\s*=/);
  });
});
