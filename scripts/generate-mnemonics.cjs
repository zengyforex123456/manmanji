#!/usr/bin/env node
/**
 * 智策 — 口诀批量生成工具
 * 用法: node scripts/generate-mnemonics.cjs [--subject econ] [--limit 50]
 *
 * 扫描题库中缺失口诀的题目，优先处理高频错题和核心章节题目。
 * 生成的口诀写入 questions.json 的 mnemonic 字段。
 */

const fs = require('fs');
const path = require('path');

// ====== 配置 ======
const args = process.argv.slice(2);
const subjectId = args.find(a => a.startsWith('--subject='))?.split('=')[1] || 'econ';
const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '50');
const QA_DIR = path.join(__dirname, '..', 'dist', 'data', subjectId);

// ====== 1. 加载题库 ======
const qFile = path.join(QA_DIR, 'questions.json');
if (!fs.existsSync(qFile)) {
  console.error(`❌ 题库不存在: ${qFile}`);
  process.exit(1);
}

const questions = JSON.parse(fs.readFileSync(qFile, 'utf-8'));

// ====== 2. 识别缺失口诀的题目 ======
const missing = questions.filter(q => !q.mnemonic || q.mnemonic.length < 3);

// 按优先级排序: 核心章节(tier 1) + 高频错题 > tier 2 > tier 3
const metaFile = path.join(__dirname, '..', 'dist', 'data', 'subjects.json');
let chapters = {};
try {
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
  chapters = {};
  meta.forEach(s => { if (s.id === subjectId) s.chapters?.forEach(c => { chapters[c.id] = c; }); });
} catch(e) {}

// 按章节优先级排序
missing.sort((a, b) => {
  const tierA = chapters[a.chapter]?.tier || 3;
  const tierB = chapters[b.chapter]?.tier || 3;
  return tierA - tierB || (a.chapter || 0) - (b.chapter || 0);
});

const batch = missing.slice(0, limit);

// ====== 3. 输出分析（供 Claude 批量生成） ======
console.log(`\n📋 题库: ${subjectId}`);
console.log(`   总题数: ${questions.length}`);
console.log(`   缺口诀: ${missing.length} (${(missing.length/questions.length*100).toFixed(0)}%)`);
console.log(`   本次处理: ${batch.length}题\n`);

// 输出为 JSONL 格式，每行一道题，方便 Claude 读取
const outputFile = path.join(__dirname, '..', 'docs', `mnemonic_batch_${subjectId}.jsonl`);
const output = batch.map(q => JSON.stringify({
  id: q.id,
  stem: q.stem,
  answer: q.answer,
  chapter: q.chapter,
  difficulty: q.difficulty,
  key_concept: q.stem.substring(0, 30) + '...'
})).join('\n');

fs.writeFileSync(outputFile, output, 'utf-8');

console.log(`📝 待处理题目已导出: ${outputFile}`);
console.log(`   在 Claude Code 中说: "为这些题目批量生成4-8字口诀"`);
console.log(`   然后运行: node scripts/apply-mnemonics.cjs --file docs/mnemonic_result_${subjectId}.jsonl\n`);

// 输出样例
console.log('--- 前5题样例 ---');
batch.slice(0, 5).forEach(q => {
  console.log(`\n[${q.id}] ch${q.chapter} diff=${q.difficulty}`);
  console.log(`  Q: ${q.stem.substring(0, 60)}...`);
  console.log(`  A: ${q.answer}`);
});
