#!/usr/bin/env node
/**
 * 智策 — A/B测试验证脚本（服务器版，无LLM依赖）
 * 用法: node scripts/ab-test-validator.js
 *
 * 读取 metrics.json 中带 ab_test_group 字段的事件，
 * 计算对照组(A) vs 实验组(B) 的关键指标差异，
 * 用卡方检验判断统计显著性。
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'analysis');

// ====== 1. 数据加载 ======
let metrics;
try {
  metrics = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'metrics.json'), 'utf-8'));
} catch (e) {
  console.error('❌ 无法加载 metrics.json');
  process.exit(1);
}

// ====== 2. 提取A/B测试数据 ======
// 查找带 ab_test 字段的事件（如果还没有，报告当前状态）
const abEvents = metrics.filter(e =>
  e.data && (e.data.ab_group || e.data.ab_test_group || e.data.variant)
);

if (abEvents.length === 0) {
  // 没有A/B测试数据，输出指南
  const now = new Date();
  const reportPath = path.join(OUTPUT_DIR, `ab_test_guide_${now.toISOString().split('T')[0]}.md`);

  const guide = `# A/B测试状态 — ${now.toISOString().split('T')[0]}

> 自动生成 | 状态: ⚠️  尚未检测到A/B测试数据

---

## 当前状态

metrics.json 中未检测到带 \`ab_group\` / \`variant\` 字段的事件。

## 如何接入A/B测试

在埋点代码中添加 \`ab_group\` 字段:

\`\`\`js
// 示例: 新手模式题数测试
const abGroup = Math.random() < 0.5 ? 'A_10题' : 'B_5题';
sendBeacon({
  event: 'question_answered',
  data: {
    questionId: 'econ-q00001',
    correct: true,
    ab_group: abGroup,        // ← 加这一行
    ab_test: 'beginner_quiz_count'
  }
});
\`\`\`

## 如何解读结果

此脚本自动执行:
1. 按 ab_group 分组统计关键指标
2. 卡方检验计算 p 值
3. p < 0.05 → 差异显著 → 建议全量上线优胜组
4. p ≥ 0.05 → 差异不显著 → 继续收集数据或调整变量

---

*由 ab-test-validator.js 自动生成*
`;
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(reportPath, guide, 'utf-8');
  console.log(`ℹ️  暂无A/B测试数据，已生成接入指南: ${reportPath}`);
  process.exit(0);
}

// ====== 3. 分组分析 ======
const groups = {};
abEvents.forEach(e => {
  const group = e.data.ab_group || e.data.ab_test_group || e.data.variant;
  if (!groups[group]) groups[group] = { total: 0, correct: 0, completed: 0, answers: [] };
  groups[group].total++;
  if (e.data.correct) groups[group].correct++;
  if (e.event === 'mode_completed') groups[group].completed++;
  groups[group].answers.push(e);
});

const groupNames = Object.keys(groups);
if (groupNames.length < 2) {
  console.log('⚠️  只有一个分组的数据，无法对比。需要至少2个分组。');
  process.exit(0);
}

// ====== 4. 卡方检验 ======
// 简化版卡方检验（2x2列联表: 组别 × 正确/错误）
function chiSquare(a_correct, a_total, b_correct, b_total) {
  const a_wrong = a_total - a_correct;
  const b_wrong = b_total - b_correct;
  const total = a_total + b_total;
  const totalCorrect = a_correct + b_correct;
  const totalWrong = a_wrong + b_wrong;

  const e_a_correct = a_total * totalCorrect / total;
  const e_a_wrong = a_total * totalWrong / total;
  const e_b_correct = b_total * totalCorrect / total;
  const e_b_wrong = b_total * totalWrong / total;

  const chi2 =
    (Math.pow(a_correct - e_a_correct, 2) / Math.max(e_a_correct, 0.001)) +
    (Math.pow(a_wrong - e_a_wrong, 2) / Math.max(e_a_wrong, 0.001)) +
    (Math.pow(b_correct - e_b_correct, 2) / Math.max(e_b_correct, 0.001)) +
    (Math.pow(b_wrong - e_b_wrong, 2) / Math.max(e_b_wrong, 0.001));

  // 简化p值估算（df=1，chi2临界值: 3.84 → p=0.05, 6.63 → p=0.01）
  const pValue = chi2 > 6.63 ? '< 0.01' : chi2 > 3.84 ? '< 0.05' : `> 0.05 (χ²=${chi2.toFixed(2)})`;

  return { chi2, pValue, significant: chi2 > 3.84 };
}

// ====== 5. 生成报告 ======
const now = new Date();
const dateStr = now.toISOString().split('T')[0];
const reportPath = path.join(OUTPUT_DIR, `ab_test_result_${dateStr}.md`);

let report = `# A/B测试结果 — ${dateStr}

> 自动生成 | 数据: ${abEvents.length}条A/B测试事件 | ${groupNames.length}个分组

---

## 核心结果

| 分组 | 样本量 | 正确数 | 正确率 | 完成数 |
|------|:-----:|:-----:|:-----:|:-----:|
`;

groupNames.forEach(g => {
  const rate = groups[g].total > 0 ? (groups[g].correct / groups[g].total * 100).toFixed(1) : '0';
  report += `| ${g} | ${groups[g].total} | ${groups[g].correct} | ${rate}% | ${groups[g].completed} |\n`;
});

// 两两比较
report += `\n## 统计检验（卡方）\n\n`;
const sorted = groupNames.sort((a, b) => {
  const rateA = groups[a].total > 0 ? groups[a].correct / groups[a].total : 0;
  const rateB = groups[b].total > 0 ? groups[b].correct / groups[b].total : 0;
  return rateB - rateA;
});

// 比较最佳组 vs 对照组
const best = sorted[0];
const control = groupNames.find(g => g.includes('A') || g.includes('control')) || sorted[sorted.length - 1];

if (best !== control) {
  const result = chiSquare(
    groups[best].correct, groups[best].total,
    groups[control].correct, groups[control].total
  );

  report += `| 对比 | χ² | p值 | 显著？ | 结论 |
|------|:---:|:---:|:-----:|------|
| ${best} vs ${control} | ${result.chi2.toFixed(2)} | ${result.pValue} | ${result.significant ? '✅' : '❌'} | ${result.significant ? '建议全量上线 ' + best : '继续收集数据'} |
`;
}

report += `
## 建议

`;
if (groupNames.length >= 2) {
  const bestRate = groups[best].total > 0 ? (groups[best].correct / groups[best].total * 100).toFixed(1) : 0;
  report += `- **优胜组**: ${best} (正确率 ${bestRate}%)\n`;
  report += `- **样本量检查**: ${groups[best].total >= 100 ? '✅ 样本充足(≥100)' : '⚠️  样本不足，建议继续收集（当前' + groups[best].total + '）'}\n`;
}

report += `
---

*由 ab-test-validator.js 自动生成 | ${now.toISOString()}*
`;

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(reportPath, report, 'utf-8');
console.log(`✅ A/B测试报告已生成: ${reportPath}`);
console.log(`   分组: ${groupNames.join(', ')} | 优胜: ${best}`);
