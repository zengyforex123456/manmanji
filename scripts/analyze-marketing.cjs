#!/usr/bin/env node
/**
 * 智策 — 营销数据分析脚本（服务器版，无LLM依赖）
 * 用法: node scripts/analyze-marketing.js
 * 输出: docs/marketing/marketing_insight_{date}.md
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'marketing');

// ====== 1. 数据加载 ======
function loadJSON(filename) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), 'utf-8')); }
  catch (e) { return null; }
}

const metrics = loadJSON('metrics.json') || [];
const users = loadJSON('users.json') || {};

// ====== 2. 渠道模板（数据驱动） ======
// 这些是预定义的渠道评分，基于中级经济师考生画像
// 在服务器上运行时，可以根据实际转化数据动态调整
const channels = [
  { name: '小红书', coverage: 8, precision: 9, cost: 5, conversion: 9, match: 10 },
  { name: '知乎', coverage: 6, precision: 8, cost: 7, conversion: 8, match: 9 },
  { name: '考证QQ/微信群', coverage: 4, precision: 10, cost: 9, conversion: 9, match: 10 },
  { name: '微信搜一搜+公众号', coverage: 7, precision: 8, cost: 7, conversion: 7, match: 9 },
  { name: '抖音/快手', coverage: 10, precision: 6, cost: 4, conversion: 5, match: 5 },
  { name: '百度SEO', coverage: 8, precision: 7, cost: 6, conversion: 6, match: 7 },
  { name: '应用商店ASO', coverage: 5, precision: 7, cost: 5, conversion: 5, match: 6 },
];

// 计算综合分 = 覆盖度*0.15 + 精准度*0.25 + 成本*0.15 + 转化*0.25 + 匹配*0.20
channels.forEach(c => {
  c.score = (c.coverage * 0.15 + c.precision * 0.25 + c.cost * 0.15 + c.conversion * 0.25 + c.match * 0.20).toFixed(1);
  c.tier = c.score >= 7.5 ? '🟢 主力' : c.score >= 6 ? '🟡 辅助' : '⚪ 暂缓';
});

channels.sort((a, b) => b.score - a.score);

// ====== 3. 数据分析 ======
const answers = metrics.filter(e => e.event === 'question_answered');
const sessions = metrics.filter(e => e.event === 'session_start');
const modeStarts = metrics.filter(e => e.event === 'mode_started');

// 提取可用于营销的数据
const totalAnswers = answers.length;
const correctAnswers = answers.filter(a => a.data.correct).length;
const overallRate = totalAnswers > 0 ? (correctAnswers / totalAnswers * 100).toFixed(1) : 'N/A';

// 用户活跃时段（用于指导投放时间）
const hourDist = {};
sessions.forEach(s => {
  const ts = s.data.timestamp || s.timestamp || 0;
  const hour = new Date(ts).getHours();
  hourDist[hour] = (hourDist[hour] || 0) + 1;
});
const peakHours = Object.entries(hourDist).sort((a, b) => b[1] - a[1]).slice(0, 3);

// 用户设备分布
const devices = { Windows: 0, Mac: 0, iPhone: 0, Android: 0, Other: 0 };
sessions.forEach(s => {
  const ua = (s.data.userAgent || '').toLowerCase();
  if (ua.includes('windows')) devices.Windows++;
  else if (ua.includes('mac')) devices.Mac++;
  else if (ua.includes('iphone')) devices.iPhone++;
  else if (ua.includes('android')) devices.Android++;
  else devices.Other++;
});

// ====== 4. 数据驱动的营销素材 ======
const marketingFacts = [];
if (totalAnswers >= 10) {
  marketingFacts.push(`用户平均每次会话刷题 ${(totalAnswers / Math.max(sessions.length, 1)).toFixed(1)} 道`);
}
if (overallRate !== 'N/A') {
  marketingFacts.push(`整体正确率 ${overallRate}%`);
}
if (peakHours.length > 0) {
  marketingFacts.push(`用户最活跃时段: ${peakHours.map(([h]) => `${h}:00`).join(', ')}`);
}

// ====== 5. 生成报告 ======
const now = new Date();
const dateStr = now.toISOString().split('T')[0];
const reportPath = path.join(OUTPUT_DIR, `marketing_insight_${dateStr}.md`);

let report = `# 营销数据分析报告 — ${dateStr}

> 自动生成 | 数据来源: data/metrics.json | 目标用户: 28-45岁在职考生

---

## 一、当前数据概况

| 指标 | 数值 | 营销含义 |
|------|:---:|------|
| 总答题数 | ${totalAnswers} | ${totalAnswers >= 100 ? '✅ 数据充足，可用于营销素材' : '⚠️  数据量不足，建议积累≥100题后用于营销'} |
| 整体正确率 | ${overallRate}% | 可用于"${parseFloat(overallRate) > 50 ? '刷题有效果' : '备考有挑战'}"的内容角度 |
| 活跃设备 | Windows ${devices.Windows} / iPhone ${devices.iPhone} / Android ${devices.Android} | ${devices.iPhone + devices.Android > devices.Windows ? '移动端优先' : 'PC端优先'}投放 |

## 二、渠道优先级（五维评分）

| 渠道 | 覆盖 | 精准 | 成本 | 转化 | 匹配 | **综合** | 定位 |
|------|:--:|:--:|:--:|:--:|:--:|:------:|:----:|
`;

channels.forEach(c => {
  report += `| ${c.name} | ${c.coverage} | ${c.precision} | ${c.cost} | ${c.conversion} | ${c.match} | **${c.score}** | ${c.tier} |\n`;
});

report += `
## 三、可用于营销的真实数据

`;
marketingFacts.forEach(f => { report += `- ${f}\n`; });
if (marketingFacts.length === 0) {
  report += `⚠️  数据量不足，建议积累≥100条答题数据后重跑以提取营销素材。\n`;
}

report += `
## 四、内容选题建议（基于数据+考试时间线）

> 当前月份: ${now.getMonth() + 1}月 | 中级经济师报名: 7-8月 | 考试: 11月

| 时间段 | 内容方向 | 具体选题示例 |
|--------|---------|------------|
| ${now.getMonth() >= 5 && now.getMonth() <= 7 ? '👉 现在' : '5-7月'} | 备考规划 | "还剩X个月，中级经济师这样规划最高效" |
| ${now.getMonth() >= 7 && now.getMonth() <= 8 ? '👉 现在' : '7-8月'} | 报名攻略 | "2026中级经济师报名流程（附避坑指南）" |
| ${now.getMonth() >= 9 && now.getMonth() <= 10 ? '👉 现在' : '9-10月'} | 冲刺刷题 | "考前30天，刷完这500题就够了" |
| ${now.getMonth() >= 10 && now.getMonth() <= 11 ? '👉 现在' : '10-11月'} | 考前押题 | "今年最可能考的50个考点（基于历年真题）" |

## 五、投放时段建议

| 时段 | 推荐度 | 原因 |
|------|:----:|------|
`;

const allHours = [['7:00-9:00', '通勤'], ['12:00-14:00', '午休'], ['19:00-22:00', '晚间'], ['22:00-24:00', '深夜']];
allHours.forEach(([range, label]) => {
  const hasData = peakHours.some(([h]) => {
    const hr = parseInt(h);
    if (range === '7:00-9:00') return hr >= 7 && hr <= 9;
    if (range === '12:00-14:00') return hr >= 12 && hr <= 14;
    if (range === '19:00-22:00') return hr >= 19 && hr <= 22;
    if (range === '22:00-24:00') return hr >= 22 && hr <= 24;
    return false;
  });
  report += `| ${range} (${label}) | ${hasData ? '⭐⭐⭐' : '⭐⭐'} | ${hasData ? '数据验证的高峰' : '考生典型时段'} |\n`;
});

report += `
## 六、转化漏斗基准

\`\`\`
曝光 1000 → 点击 100 (CTR 10%)
  → 注册试用 30 (CVR 30%)
    → 10题体验 25 (83%)
      → 付费 5 (20%)
        → 年卡续费 3 (60%)

预估CPA: 年卡¥100 / 5付费 = ¥20/付费用户
预估ROI: LTV ¥100 / CAC ¥20 = 5.0
\`\`\`

---

*报告由 analyze-marketing.js 自动生成 | ${now.toISOString()}*
`;

// ====== 6. 写入 ======
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(reportPath, report, 'utf-8');
console.log(`✅ 营销报告已生成: ${reportPath}`);
console.log(`   主力渠道: ${channels.filter(c => c.tier.includes('主力')).map(c => c.name).join(', ')}`);
console.log(`   活跃高峰: ${peakHours.length > 0 ? peakHours.map(([h]) => `${h}:00`).join(', ') : '数据不足'}`);
