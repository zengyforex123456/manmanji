// tools/component-validator.js — 组件契约验证器
// 用法: node tools/component-validator.js
// 验证所有组件: 1)暴露了约定的data-testid 2)导出了render和update函数

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var ROOT = path.join(__dirname, '..');
var SRC = path.join(ROOT, 'src', 'components');

// ─── 组件契约注册表 ───
var CONTRACTS = {
  'WelcomeBar.js': {
    exports: ['renderWelcomeBar', 'updateCountdown'],
    dataTestIds: ['exam-countdown', 'greeting'], // data-testid 属性
    htmlContains: ['welcome-row', 'data-countdown'],
  },
  'AIBrain.js': {
    exports: ['renderAIBrain'],
    dataTestIds: ['ai-prompt-input', 'ai-brain-panel'],
    htmlContains: ['startAIFromPrompt', 'startAIExam', 'ai-prompt-input'],
  },
  'payment.js': {
    exports: ['showPayment', 'injectTestButton', 'pollActivation', 'bindMembershipButtons'],
    dataTestIds: [],
    htmlContains: ['pay-modal'],
  },
  'AdultFeatures.js': {
    exports: ['saveSession', 'getSavedSession', 'showResumeBanner', 'showROICalculator', 'checkAchievement', 'showSharePrompt'],
    dataTestIds: [],
    htmlContains: [],
  },
  'AIBrain.js': {
    exports: ['renderAIBrain'],
    dataTestIds: ['ai-brain-panel'],
    htmlContains: ['ai-prompt-input', 'startAIQuick', 'startAIExam'],
  },
};

var results = { passed: 0, failed: 0, warnings: 0, details: [] };

console.log('🔍 组件契约验证\n');

for (var file of Object.keys(CONTRACTS)) {
  var contract = CONTRACTS[file];
  var fullPath = path.join(SRC, file);
  var name = file.replace('.js', '');

  if (!fs.existsSync(fullPath)) {
    console.log('⚠️  ' + name + ' — 文件不存在');
    results.warnings++;
    results.details.push({ component: name, status: 'missing' });
    continue;
  }

  var content = fs.readFileSync(fullPath, 'utf-8');
  var issues = [];

  // 1. 验证导出
  for (var exp of contract.exports) {
    if (!content.includes('export function ' + exp) && !content.includes('export async function ' + exp)) {
      issues.push('缺少导出: ' + exp);
    }
  }

  // 2. 验证HTML包含关键元素
  for (var html of contract.htmlContains) {
    if (!content.includes(html)) {
      issues.push('HTML缺少: ' + html);
    }
  }

  // 3. 验证data-testid
  for (var tid of contract.dataTestIds) {
    if (!content.includes('data-testid="' + tid + '"') && !content.includes("data-testid='" + tid + "'")) {
      issues.push('缺少data-testid: ' + tid);
    }
  }

  if (issues.length === 0) {
    console.log('✅ ' + name + ' — 契约完整 (' + contract.exports.length + '个导出 ' + contract.htmlContains.length + '个元素)');
    results.passed++;
    results.details.push({ component: name, status: 'pass' });
  } else {
    console.log('❌ ' + name + ' — ' + issues.length + '个问题:');
    issues.forEach(function(i) { console.log('   - ' + i); });
    results.failed++;
    results.details.push({ component: name, status: 'fail', issues: issues });
  }
}

console.log('\n═══════════════════');
console.log('通过: ' + results.passed + ' | 失败: ' + results.failed + ' | 警告: ' + results.warnings);

if (results.failed > 0) {
  console.log('🔴 存在契约违规，阻塞构建');
  process.exit(1);
} else {
  console.log('🟢 所有组件契约验证通过');
}
