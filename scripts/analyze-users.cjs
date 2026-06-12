#!/usr/bin/env node
/**
 * 智策 — 用户数据分析脚本（服务器版，无LLM依赖）
 * 用法: node scripts/analyze-users.js
 * 输出: docs/analysis/user_insight_{date}.md
 */

const fs = require('fs');
const path = require('path');

// ====== 1. 加载数据 ======
const DATA_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'analysis');

function loadJSON(filename) {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, filename), 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.error(`⚠️  无法加载 ${filename}: ${e.message}`);
    return null;
  }
}

const metrics = loadJSON('metrics.json') || [];
const feedback = loadJSON('feedback.json') || [];
const users = loadJSON('users.json') || {};

// ====== 2. 数据分析 ======

// 2.1 提取答题事件
const answers = metrics.filter(e => e.event === 'question_answered');
const sessions = metrics.filter(e => e.event === 'session_start');
const modeStarts = metrics.filter(e => e.event === 'mode_started');
const modeCompletes = metrics.filter(e => e.event === 'mode_completed');

// 2.2 按科目+模式分组统计正确率
const subjectStats = {};
answers.forEach(a => {
  const key = `${a.data.subjectId || 'unknown'}|${a.data.mode || 'unknown'}`;
  if (!subjectStats[key]) subjectStats[key] = { total: 0, correct: 0, questions: {} };
  subjectStats[key].total++;
  if (a.data.correct) subjectStats[key].correct++;
  const qid = a.data.questionId || 'unknown';
  if (!subjectStats[key].questions[qid]) subjectStats[key].questions[qid] = { total: 0, correct: 0 };
  subjectStats[key].questions[qid].total++;
  if (a.data.correct) subjectStats[key].questions[qid].correct++;
});

// 2.3 用户行为漏斗
const funnel = {
  sessions: sessions.length,
  modeStarts: modeStarts.length,
  answers: answers.length,
  modeCompletes: modeCompletes.length,
  startRate: sessions.length > 0 ? (modeStarts.length / sessions.length * 100).toFixed(1) : 'N/A',
  completeRate: modeStarts.length > 0 ? (modeCompletes.length / modeStarts.length * 100).toFixed(1) : 'N/A',
  avgAnswersPerSession: sessions.length > 0 ? (answers.length / sessions.length).toFixed(1) : 'N/A',
};

// 2.4 高频错题 TOP10
const mistakeCount = {};
answers.filter(a => !a.data.correct).forEach(a => {
  const qid = a.data.questionId || 'unknown';
  mistakeCount[qid] = (mistakeCount[qid] || 0) + 1;
});
const topMistakes = Object.entries(mistakeCount)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

// 2.5 活跃时段分布
const hourDist = {};
sessions.forEach(s => {
  const ts = s.data.timestamp || s.timestamp || 0;
  const hour = new Date(ts).getHours();
  hourDist[hour] = (hourDist[hour] || 0) + 1;
});

// 2.6 设备/UA分布
const uaDist = {};
sessions.forEach(s => {
  const ua = (s.data.userAgent || 'unknown').substring(0, 60);
  uaDist[ua] = (uaDist[ua] || 0) + 1;
});

// ====== 3. 生成优化建议 ======
const suggestions = [];

// 高优: 开始→做题率
if (funnel.startRate !== 'N/A' && parseFloat(funnel.startRate) < 50) {
  suggestions.push({
    level: '🔴 高优',
    title: '入口体验优化：减少首页摩擦',
    data: `启动→开始做题率仅 ${funnel.startRate}%`,
    suggestion: '首页突出"开始刷题"按钮，支持一键进入上次科目和模式',
    expected: '预期提升启动→做题率达到70%+',
    ice: { impact: 9, confidence: 8, ease: 9, score: 648 }
  });
}

// 高优: 开始→完成率
if (funnel.completeRate !== 'N/A' && parseFloat(funnel.completeRate) < 30) {
  suggestions.push({
    level: '🔴 高优',
    title: '新手模式题数优化',
    data: `开始→完成率仅 ${funnel.completeRate}%`,
    suggestion: '新手模式从10题减为5题，降低单次完成门槛，完成后再引导"再来一组"',
    expected: '预期提升完成率至50%+',
    ice: { impact: 8, confidence: 9, ease: 10, score: 720 }
  });
}

// 中优: 低正确率章节
Object.entries(subjectStats).forEach(([key, stat]) => {
  const rate = stat.total > 0 ? (stat.correct / stat.total * 100).toFixed(1) : 0;
  if (parseFloat(rate) < 40 && stat.total >= 5) {
    suggestions.push({
      level: '🟡 中优',
      title: `检查${key}题目质量/难度`,
      data: `${key}: 正确率${rate}% (${stat.total}题)`,
      suggestion: '检查低分题目解析是否清晰、口诀是否有效，或调整题目难度分级',
      expected: '预期正确率提升至60%+',
      ice: { impact: 7, confidence: 7, ease: 6, score: 294 }
    });
  }
});

// 中优: 夜间模式需求（来自feedback）
if (feedback.length > 0) {
  suggestions.push({
    level: '🟡 中优',
    title: '增加夜间模式',
    data: `用户反馈含功能请求: ${feedback.map(f => f.text).join(', ')}`,
    suggestion: '实现深色主题切换，满足夜间学习场景',
    expected: '提升晚间时段留存率10-15%',
    ice: { impact: 6, confidence: 10, ease: 7, score: 420 }
  });
}

// 观测: 跨科目使用
const subjectsUsed = new Set(modeStarts.map(m => m.data.subjectId));
if (subjectsUsed.size <= 1) {
  suggestions.push({
    level: '🟢 观测',
    title: '引导跨科目使用',
    data: `当前仅使用 ${[...subjectsUsed].join(', ')} 科目`,
    suggestion: '首页/完成页增加"换科目"入口，引导用户体验其他考试品类',
    expected: '提升多科目用户占比',
    ice: { impact: 5, confidence: 5, ease: 8, score: 200 }
  });
}

// 按ICE排序
suggestions.sort((a, b) => b.ice.score - a.ice.score);

// ====== 4. 生成报告 ======
const now = new Date();
const dateStr = now.toISOString().split('T')[0];
const reportPath = path.join(OUTPUT_DIR, `user_insight_${dateStr}.md`);

let report = `# 用户数据分析报告 — ${dateStr}

> 自动生成 | 数据来源: data/metrics.json (${metrics.length}条事件) + data/feedback.json (${feedback.length}条反馈)

---

## 一、核心指标

| 指标 | 当前值 | 基准 | 诊断 |
|------|:-----:|:---:|:---:|
| 总答题数 | ${answers.length} | - | - |
| 整体正确率 | ${answers.length > 0 ? (answers.filter(a=>a.data.correct).length / answers.length * 100).toFixed(1) : 'N/A'}% | >60% | ${answers.length > 0 && answers.filter(a=>a.data.correct).length/answers.length < 0.6 ? '🔴' : '🟢'} |
| 启动→做题率 | ${funnel.startRate}% | >70% | ${funnel.startRate !== 'N/A' && parseFloat(funnel.startRate) < 70 ? '🔴' : '🟢'} |
| 做题→完成率 | ${funnel.completeRate}% | >50% | ${funnel.completeRate !== 'N/A' && parseFloat(funnel.completeRate) < 50 ? '🔴' : '🟢'} |
| 会话数 | ${sessions.length} | - | - |
| 完成模式数 | ${modeCompletes.length} | - | - |

## 二、各科正确率

| 科目/模式 | 总答题 | 正确数 | 正确率 | 诊断 |
|-----------|:-----:|:-----:|:-----:|:---:|
`;

Object.entries(subjectStats).forEach(([key, stat]) => {
  const rate = stat.total > 0 ? (stat.correct / stat.total * 100).toFixed(1) : '0';
  const emoji = parseFloat(rate) >= 70 ? '🟢' : parseFloat(rate) >= 40 ? '🟡' : '🔴';
  report += `| ${key} | ${stat.total} | ${stat.correct} | ${rate}% | ${emoji} |\n`;
});

report += `
## 三、高频错题 TOP${topMistakes.length}

| 排名 | 题目ID | 错误次数 |
|:---:|--------|:------:|
`;
topMistakes.forEach(([qid, count], i) => {
  report += `| ${i + 1} | ${qid} | ${count} |\n`;
});

if (topMistakes.length === 0) {
  report += `| - | 暂无足够数据 | - |\n`;
}

report += `
## 四、活跃时段分布

| 时段 | 会话数 | 占比 |
|------|:-----:|:---:|
`;
const maxHour = Math.max(...Object.values(hourDist), 1);
Object.entries(hourDist).sort((a,b) => parseInt(a[0]) - parseInt(b[0])).forEach(([hour, count]) => {
  const bar = '█'.repeat(Math.round(count / maxHour * 20));
  report += `| ${hour}:00 | ${count} | ${bar} |\n`;
});

if (Object.keys(hourDist).length === 0) {
  report += `| - | 暂无数据 | - |\n`;
}

report += `
## 五、产品优化建议（按ICE优先级排列）

| # | 优先级 | 建议 | 数据依据 | ICE分 |
|:-:|:-----:|------|---------|:----:|
`;
suggestions.forEach((s, i) => {
  report += `| ${i + 1} | ${s.level} | ${s.title} | ${s.data} | ${s.ice.score} |\n`;
});

if (suggestions.length === 0) {
  report += `| - | - | 数据量不足，建议积累≥100条答题数据后重跑 | - | - |\n`;
}

report += `
## 六、数据质量

| 检查项 | 结果 |
|--------|:--:|
| 总事件数 | ${metrics.length} |
| 事件类型 | ${[...new Set(metrics.map(e => e.event))].join(', ')} |
| 时间范围 | ${metrics.length > 0 ? new Date(metrics[0].serverTime).toISOString() : 'N/A'} ~ ${metrics.length > 0 ? new Date(metrics[metrics.length-1].serverTime).toISOString() : 'N/A'} |
| 编码问题 | ${JSON.stringify(metrics).includes('�') ? '⚠️  存在乱码字符（UTF-8编码问题）' : '✅ 正常'} |

---

*报告由 analyze-users.js 自动生成 | ${now.toISOString()}*
`;

// ====== 5. 写入文件 ======
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(reportPath, report, 'utf-8');
console.log(`✅ 报告已生成: ${reportPath}`);
console.log(`   事件总数: ${metrics.length} | 答题数: ${answers.length} | 建议数: ${suggestions.length}`);
