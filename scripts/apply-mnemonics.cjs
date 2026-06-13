#!/usr/bin/env node
/**
 * 智策 — 口诀回填工具
 * 用法: node scripts/apply-mnemonics.cjs --file docs/mnemonic_batch_econ.jsonl [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const fileArg = args.find(a => a.startsWith('--file='))?.split('=')[1];
const dryRun = args.includes('--dry-run');

if (!fileArg) {
  console.error('用法: node scripts/apply-mnemonics.cjs --file=docs/mnemonic_result_econ.jsonl');
  process.exit(1);
}

// 读取口诀映射 (JSONL: {id, mnemonic})
const inputPath = path.resolve(fileArg);
if (!fs.existsSync(inputPath)) {
  console.error(`❌ 文件不存在: ${inputPath}`);
  process.exit(1);
}

const lines = fs.readFileSync(inputPath, 'utf-8').trim().split('\n').filter(Boolean);
const mnemonicMap = {};
lines.forEach(line => {
  try {
    const { id, mnemonic } = JSON.parse(line);
    if (id && mnemonic) mnemonicMap[id] = mnemonic;
  } catch(e) {}
});

console.log(`📋 加载口诀: ${Object.keys(mnemonicMap).length} 条\n`);

// 更新题库
const subjectId = path.basename(fileArg).match(/batch_(.+)\.jsonl/)?.[1] || 'econ';
const qaDir = path.join(__dirname, '..', 'dist', 'data', subjectId);
const qFile = path.join(qaDir, 'questions.json');

if (!fs.existsSync(qFile)) {
  // 尝试 server/public/data
  const altFile = path.join(__dirname, '..', 'public', 'data', subjectId, 'questions.json');
  if (fs.existsSync(altFile)) {
    applyTo(altFile);
  } else {
    console.error(`❌ 题库不存在: ${qFile}`);
    process.exit(1);
  }
} else {
  applyTo(qFile);
}

function applyTo(filePath) {
  const questions = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  let applied = 0;

  questions.forEach(q => {
    if (mnemonicMap[q.id] && (!q.mnemonic || q.mnemonic.length < 3)) {
      q.mnemonic = mnemonicMap[q.id];
      applied++;
    }
  });

  if (!dryRun) {
    fs.writeFileSync(filePath, JSON.stringify(questions, null, 2), 'utf-8');
    console.log(`✅ 已更新 ${applied} 题口诀 → ${filePath}`);
    console.log(`   题库总数: ${questions.length} | 有口诀: ${questions.filter(q=>q.mnemonic&&q.mnemonic.length>2).length} (${(questions.filter(q=>q.mnemonic&&q.mnemonic.length>2).length/questions.length*100).toFixed(1)}%)`);
  } else {
    console.log(`🔍 [DRY RUN] 将更新 ${applied} 题 → ${filePath}`);
  }
}
