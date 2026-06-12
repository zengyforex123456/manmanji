#!/usr/bin/env node
/**
 * 智策 — 转化率/使用率优化分析（服务器版，无LLM依赖）
 * 用法: node scripts/optimize-conversion.cjs
 * 输出: docs/analysis/conversion_optimization_{date}.md
 *
 * 聚焦三个指标: 点击率(CTR) · 转化率(CVR) · 使用率(Engagement)
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'analysis');

// ====== 1. 加载 ======
let metrics = [];
try { metrics = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'metrics.json'), 'utf-8')); }
catch (e) { console.error('❌ 无法加载 metrics.json'); process.exit(1); }

const feedback = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'feedback.json'), 'utf-8')); }
  catch (e) { return []; }
})();

// ====== 2. 分析维度 ======

// 2.1 漏斗各环节
const sessions = metrics.filter(e => e.event === 'session_start');
const modeStarts = metrics.filter(e => e.event === 'mode_started');
const answers = metrics.filter(e => e.event === 'question_answered');
const completes = metrics.filter(e => e.event === 'mode_completed');

// 定义漏斗（对应中级经济师刷题产品）
// 进入首页 → 选择科目 → 开始做题 → 完成一轮 → 再次打开(次日留存代理)
const funnel = {
  step1_sessions: sessions.length,
  step2_modeStart: modeStarts.length,
  step3_answered: answers.length,
  step4_completed: completes.length,
  // 留存代理：有≥2次session的用户
  step5_returned: 0,
};

// 留存计算
const sessionTimestamps = sessions.map(s => s.data.timestamp || s.timestamp).filter(Boolean);
if (sessionTimestamps.length >= 2) {
  const uniqueDays = new Set(sessionTimestamps.map(ts => {
    try { return new Date(ts).toISOString().split('T')[0]; } catch(e) { return ''; }
  }));
  funnel.step5_returned = uniqueDays.size;
}

// 2.2 各环节转化率
const rates = {
  // 启动→开始做题（相当于"点击率" = 从看到到行动）
  startup_to_action: sessions.length > 0 ? (modeStarts.length / sessions.length * 100).toFixed(1) : 'N/A',
  // 开始→完成一轮（相当于"转化率" = 从尝试到完整体验）
  start_to_complete: modeStarts.length > 0 ? (completes.length / modeStarts.length * 100).toFixed(1) : 'N/A',
  // 完成→再次使用（相当于"留存率" = 持续使用）
  complete_to_return: completes.length > 0 ? (funnel.step5_returned / completes.length * 100).toFixed(1) : 'N/A',
};

// 2.3 用户需求信号提取
const userNeeds = { featureRequests: [], painPoints: [], praises: [] };
answers.forEach(a => {
  // 从错题识别痛点：高频错题 = 用户需求（内容太难/解析不好）
  if (!a.data.correct) {
    const qid = a.data.questionId || 'unknown';
    const subject = a.data.subjectId || 'unknown';
    if (!userNeeds.painPoints.find(p => p.id === qid)) {
      userNeeds.painPoints.push({ id: qid, subject, count: 1 });
    } else {
      userNeeds.painPoints.find(p => p.id === qid).count++;
    }
  }
});
userNeeds.painPoints.sort((a, b) => b.count - a.count);

// 从反馈提取需求
feedback.forEach(f => {
  if (f.type === '建议' || f.type === '需求' || (f.text && f.text.includes('希望'))) {
    userNeeds.featureRequests.push(f.text);
  }
});

// 2.4 使用率分析
const usagePatterns = {
  // 每小时会话分布
  hourlyDistribution: {},
  // 每个session平均答题数
  avgAnswersPerSession: sessions.length > 0 ? (answers.length / sessions.length).toFixed(1) : 'N/A',
  // 总活跃分钟数（粗略：每题30秒）
  estimatedActiveMinutes: answers.length > 0 ? (answers.length * 0.5).toFixed(0) : '0',
};

sessions.forEach(s => {
  const ts = s.data.timestamp || s.timestamp || 0;
  let hour;
  try { hour = new Date(ts).getHours(); } catch(e) { hour = '?'; }
  usagePatterns.hourlyDistribution[hour] = (usagePatterns.hourlyDistribution[hour] || 0) + 1;
});

// ====== 3. 优化建议引擎 ======
const suggestions = [];

// CTR优化: 启动→开始做题
if (rates.startup_to_action !== 'N/A' && parseFloat(rates.startup_to_action) < 70) {
  suggestions.push({
    target: '点击率(CTR)',
    current: rates.startup_to_action + '%',
    benchmark: '70%+',
    problem: '用户打开后没有开始做题 — 首页引导不足',
    fixes: [
      '首页首屏只放一个大按钮"开始刷题"，去掉所有干扰元素',
      '记住用户上次科目和模式，一键继续',
      '显示"3分钟刷10题"降低心理门槛',
    ],
    expected: `预计启动→开始率从${rates.startup_to_action}%提升到70%+`,
    test: 'A/B: A组原首页 vs B组简化首页，7天后看 mode_started/session_start 比值'
  });
}

// CVR优化: 开始→完成
if (rates.start_to_complete !== 'N/A' && parseFloat(rates.start_to_complete) < 50) {
  suggestions.push({
    target: '转化率(CVR)',
    current: rates.start_to_complete + '%',
    benchmark: '50%+',
    problem: '用户开始做题但没有完成一轮 — 题目太多或体验太差',
    fixes: [
      '新手模式从10题减为5题（ICE=720，已在分析报告中）',
      '每做对1题给即时正反馈（动画+鼓励语）',
      '显示进度条"第3/5题"，给完成预期',
      '做完后弹窗显示"正确率XX%，再来一组"',
    ],
    expected: `预计完成率从${rates.start_to_complete}%提升到50%+`,
    test: 'A/B: A组10题 vs B组5题新手模式，看 mode_completed/mode_started'
  });
}

// 使用率优化: 留存+频次
if (usagePatterns.avgAnswersPerSession !== 'N/A' && parseFloat(usagePatterns.avgAnswersPerSession) < 10) {
  suggestions.push({
    target: '使用率(Engagement)',
    current: `平均每session ${usagePatterns.avgAnswersPerSession} 题`,
    benchmark: '10题+/session',
    problem: '每次使用时间太短 — 缺少持续激励',
    fixes: [
      '连续打卡奖励（连续3天解锁"冲刺模式"）',
      '弱网/离线可用，利用碎片时间（PRD R20-R23已有）',
      `推送时机：${Object.keys(usagePatterns.hourlyDistribution).length > 0 ? '活跃高峰' + Object.entries(usagePatterns.hourlyDistribution).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([h])=>h+':00').join('、') : '根据目标用户习惯设为20:00'}`,
      '完成一轮后自动推荐"换科目刷题"',
    ],
    expected: `预计平均session从${usagePatterns.avgAnswersPerSession}题提升到10题+`,
    test: '观察：上线后7天 avg answers/session 变化'
  });
}

// 用户需求驱动的功能优化
if (userNeeds.painPoints.length > 0) {
  const topPain = userNeeds.painPoints[0];
  suggestions.push({
    target: '用户需求(功能优化)',
    current: `最高频错题: ${topPain.id} (错${topPain.count}次)`,
    benchmark: '该题正确率>60%',
    problem: `题目${topPain.id}反复错 — 可能题目太难/解析不清`,
    fixes: [
      `检查${topPain.id}的解析是否包含"口诀"和"易错提醒"（PRD R12要求）`,
      '如果已包含→考虑调整题目难度分级',
      '如果未包含→补充解析内容',
    ],
    expected: '该题正确率提升到60%+',
    test: '修改解析后7天对比该题正确率'
  });
}

// 反馈驱动
if (userNeeds.featureRequests.length > 0) {
  suggestions.push({
    target: '用户需求(新功能)',
    current: `${userNeeds.featureRequests.length}条功能请求: ${userNeeds.featureRequests.join('; ')}`,
    benchmark: '排入迭代计划',
    problem: '用户有明确需求但未满足',
    fixes: userNeeds.featureRequests.map(r => `评估"${r}"的ICE分→排优先级→入迭代`),
    expected: '满足需求后NPS预计+5~15',
    test: '上线后用户反馈/NPS变化'
  });
}

// ====== 4. 生成报告 ======
const now = new Date();
const dateStr = now.toISOString().split('T')[0];
const reportPath = path.join(OUTPUT_DIR, `conversion_optimization_${dateStr}.md`);

let report = `# CTR/转化率/使用率 优化报告 — ${dateStr}

> 自动生成 | 数据: ${metrics.length}条事件 | 目标: 28-45岁在职考生

---

## 一、核心漏斗

| 步骤 | 事件 | 数量 | 转化率 |
|------|------|:---:|:-----:|
| ① 启动 | session_start | ${funnel.step1_sessions} | - |
| ② 开始做题 | mode_started | ${funnel.step2_modeStart} | ${rates.startup_to_action}% |
| ③ 答题 | question_answered | ${funnel.step3_answered} | - |
| ④ 完成一轮 | mode_completed | ${funnel.step4_completed} | ${rates.start_to_complete}% |
| ⑤ 多日使用 | ≥2天活跃 | ${funnel.step5_returned} | ${rates.complete_to_return}% |

## 二、关键指标诊断

| 指标 | 当前值 | 基准 | 诊断 |
|------|:-----:|:---:|:---:|
| 点击率(启动→开始) | ${rates.startup_to_action}% | >70% | ${parseFloat(rates.startup_to_action) >= 70 ? '🟢' : '🔴'} |
| 转化率(开始→完成) | ${rates.start_to_complete}% | >50% | ${parseFloat(rates.start_to_complete) >= 50 ? '🟢' : '🔴'} |
| 使用率(平均session) | ${usagePatterns.avgAnswersPerSession}题 | >10题 | ${parseFloat(usagePatterns.avgAnswersPerSession) >= 10 ? '🟢' : '🔴'} |
| 使用时长 | ${usagePatterns.estimatedActiveMinutes}分钟 | >30分钟 | ${parseFloat(usagePatterns.estimatedActiveMinutes) >= 30 ? '🟢' : '🟡'} |

## 三、优化方案（按目标分类）

`;

suggestions.forEach((s, i) => {
  report += `### ${i + 1}. ${s.target}: ${s.current}（基准: ${s.benchmark}）

**问题**: ${s.problem}

**优化动作**:
${s.fixes.map(f => `- ${f}`).join('\n')}

**预期效果**: ${s.expected}

**验证方式**: ${s.test}

---
`;
});

if (suggestions.length === 0) {
  report += `\n✅ 当前所有指标达标。数据量(${metrics.length}条)${metrics.length < 100 ? '不足，建议≥100条后重跑' : '充足'}。\n`;
}

report += `
## 四、用户需求信号

### 功能请求 (${userNeeds.featureRequests.length}条)
${userNeeds.featureRequests.length > 0 ? userNeeds.featureRequests.map(r => `- ${r}`).join('\n') : '暂无明确功能请求'}

### 高频错题TOP5（暗示内容/体验痛点）
| 题目ID | 错误次数 | 可能原因 |
|--------|:------:|------|
${userNeeds.painPoints.slice(0, 5).map(p => `| ${p.id} | ${p.count} | 题目太难 / 解析不清 / 口诀无效 |`).join('\n')}
${userNeeds.painPoints.length === 0 ? '| - | - | 数据不足 |' : ''}

---

*由 optimize-conversion.cjs 自动生成 | ${now.toISOString()}*
`;

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(reportPath, report, 'utf-8');
console.log(`✅ 转化优化报告: ${reportPath}`);
console.log(`   漏斗: ${rates.startup_to_action}% → ${rates.start_to_complete}% | 建议: ${suggestions.length}条`);
