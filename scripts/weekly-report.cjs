#!/usr/bin/env node
/**
 * 智策 — 学习周报生成器
 * 用法: node scripts/weekly-report.cjs
 * 输出: docs/analysis/weekly_report_{date}.md
 *
 * 分析本周学习数据，生成个性化学习报告，可推送/分享
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'analysis');

// 加载
const metrics = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'metrics.json'), 'utf-8'));
const feedback = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'feedback.json'), 'utf-8'));

// 本周数据
const now = new Date();
const weekAgo = Date.now() - 7 * 86400000;
const weekEvents = metrics.filter(e => {
  const ts = new Date(e.serverTime || e.timestamp).getTime();
  return ts > weekAgo;
});

const answers = weekEvents.filter(e => e.event === 'question_answered');
const sessions = weekEvents.filter(e => e.event === 'session_start');
const completes = weekEvents.filter(e => e.event === 'mode_completed');
const correct = answers.filter(a => a.data?.correct);
const mistakes = answers.filter(a => !a.data?.correct);

// 统计
const totalAnswers = answers.length;
const correctRate = totalAnswers > 0 ? (correct.length / totalAnswers * 100).toFixed(1) : 'N/A';
const sessionsCount = sessions.length;
const completesCount = completes.length;
const avgPerSession = sessionsCount > 0 ? (totalAnswers / sessionsCount).toFixed(1) : 'N/A';

// 活跃天数
const activeDays = new Set();
sessions.forEach(s => {
  const d = new Date(s.serverTime || s.timestamp).toISOString().split('T')[0];
  activeDays.add(d);
});

// 错题top
const mistakeMap = {};
mistakes.forEach(a => {
  const qid = a.data?.questionId || '?';
  mistakeMap[qid] = (mistakeMap[qid] || 0) + 1;
});
const topMistakes = Object.entries(mistakeMap).sort((a,b) => b[1]-a[1]).slice(0,5);

// 生成诊断
let diagnosis = [];
if (totalAnswers === 0) {
  diagnosis.push({ level: 'info', msg: '本周暂无学习记录。每天15分钟，碎片时间也能备考！' });
} else {
  if (parseFloat(correctRate) < 50) {
    diagnosis.push({ level: 'warn', msg: `正确率${correctRate}%，建议集中攻克错题，优先看解析理解概念` });
  } else if (parseFloat(correctRate) >= 80) {
    diagnosis.push({ level: 'good', msg: `正确率${correctRate}%！已达学霸水平，可以挑战模考了` });
  }
  if (activeDays.size < 3) {
    diagnosis.push({ level: 'warn', msg: `本周仅学习${activeDays.size}天。建议每周至少学习5天，保持节奏` });
  }
  if (parseFloat(avgPerSession) < 5 && sessionsCount > 0) {
    diagnosis.push({ level: 'info', msg: `平均每次仅${avgPerSession}题。试试冲刺模式，一口气做更多题` });
  }
  if (completesCount === 0 && sessionsCount > 0) {
    diagnosis.push({ level: 'warn', msg: '开始做题但未完成一轮。新手模式从5题开始，轻松完成不费力' });
  }
}

// 生成报告
const dateStr = now.toISOString().split('T')[0];
const reportPath = path.join(OUTPUT_DIR, `weekly_report_${dateStr}.md`);
const weekLabel = `${new Date(weekAgo).toISOString().split('T')[0]} ~ ${dateStr}`;

let report = `# 📊 学习周报 — ${weekLabel}

> 自动生成 | 数据来源: 学习记录

---

## 📈 本周概览

| 指标 | 本周 | 评价 |
|------|:---:|:---:|
| 学习天数 | ${activeDays.size}/7天 | ${activeDays.size >= 5 ? '🟢' : '🟡'} |
| 答题总数 | ${totalAnswers}题 | ${totalAnswers >= 50 ? '🟢' : totalAnswers >= 20 ? '🟡' : '🔴'} |
| 正确率 | ${correctRate}% | ${parseFloat(correctRate) >= 60 ? '🟢' : '🟡'} |
| 平均每session | ${avgPerSession}题 | - |
| 完成轮次 | ${completesCount}次 | - |

## 🧠 AI诊断

${diagnosis.map(d => `- ${d.level === 'good' ? '✅' : d.level === 'warn' ? '⚠️' : '💡'} ${d.msg}`).join('\n')}
${diagnosis.length === 0 ? '暂无足够数据生成诊断，继续刷题解锁AI分析' : ''}

## ❌ 高频错题TOP5

| # | 题目ID | 错误次数 | 建议 |
|:-:|--------|:------:|------|
${topMistakes.map(([qid, count], i) => `| ${i+1} | ${qid} | ${count} | 重点复习，多看解析和口诀 |`).join('\n')}
${topMistakes.length === 0 ? '| - | 本周无错题！继续保持 🎉 | - |' : ''}

## 📝 用户反馈
本周收到 ${feedback.length} 条反馈${feedback.length > 0 ? '：' + feedback.slice(-3).map(f => f.text).join('；') : ''}

## 🎯 下周建议

1. 保持每天打卡，目标连续${activeDays.size + 1}天
2. ${parseFloat(correctRate) < 60 ? '重点复习错题，每题看完解析再下一题' : '挑战更高难度模式'}
3. ${activeDays.size < 5 ? '每天固定时段学习（如通勤/午休）形成习惯' : '考虑增加学习时长或挑战模考'}

---

*由 weekly-report.cjs 自动生成 | ${now.toISOString()}*
`;

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(reportPath, report, 'utf-8');
console.log(`✅ 学习周报: ${reportPath}`);
console.log(`   本周: ${totalAnswers}题 | 正确率${correctRate}% | ${activeDays.size}天`);
