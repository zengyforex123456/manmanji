#!/usr/bin/env node
/**
 * 智策 — 全量分析运行器（cron用）
 * 用法: node scripts/run-all-analysis.js
 *
 * 依次执行所有分析脚本，输出汇总日志。
 * 可加入 crontab: 0 6 * * * node /path/to/scripts/run-all-analysis.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const SCRIPTS_DIR = __dirname;
const scripts = [
  { name: '用户行为分析', file: 'analyze-users.js' },
  { name: '营销数据分析', file: 'analyze-marketing.js' },
  { name: 'A/B测试验证',   file: 'ab-test-validator.js' },
];

const now = new Date();
const logFile = path.join(__dirname, '..', 'docs', 'analysis', `_run_log_${now.toISOString().split('T')[0]}.txt`);
const results = [];

console.log('╔══════════════════════════════════╗');
console.log('║   智策分析 — 全量运行          ║');
console.log('║   ' + now.toISOString() + '   ║');
console.log('╚══════════════════════════════════╝');
console.log('');

let passed = 0;
let failed = 0;

scripts.forEach(({ name, file }) => {
  const scriptPath = path.join(SCRIPTS_DIR, file);
  console.log(`[${name}] 运行: ${file}`);

  try {
    const output = execSync(`node "${scriptPath}"`, {
      encoding: 'utf-8',
      timeout: 30000,
      cwd: path.join(__dirname, '..')
    });
    console.log(output.trim());
    results.push({ name, status: '✅', output: output.trim() });
    passed++;
  } catch (err) {
    const errMsg = err.stderr || err.message || 'Unknown error';
    console.error(`❌ ${name} 失败: ${errMsg}`);
    results.push({ name, status: '❌', output: errMsg });
    failed++;
  }
  console.log('');
});

// 写入汇总
const summary = [
  `智策分析运行日志 — ${now.toISOString()}`,
  `通过: ${passed} | 失败: ${failed}`,
  '',
  ...results.map(r => `[${r.status}] ${r.name}\n${r.output}`),
].join('\n');

fs.writeFileSync(logFile, summary, 'utf-8');
console.log(`📋 运行日志: ${logFile}`);
console.log(`   通过: ${passed} | 失败: ${failed}`);
