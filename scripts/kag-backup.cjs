#!/usr/bin/env node
/**
 * KAG 知识库 — 三重备份守护
 * 用法: node scripts/kag-backup.cjs
 *
 * 1. SQLite WAL 模式（断电不丢数据）
 * 2. 每日自动备份（保留最近7天）
 * 3. Git auto commit + push（异地容灾）
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const KAG_DIR = path.join(__dirname, '..', '..', 'zhice', '.claude', 'knowledge');
const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups', 'kag');
const DB_PATH = path.join(__dirname, '..', 'data', 'kaoshi.db');

const now = new Date();
const dateStr = now.toISOString().split('T')[0];

// ====== 1. SQLite WAL 模式（崩溃安全） ======
try {
  const db = require('better-sqlite3') ? null : null;
} catch(e) {}

try {
  // 使用 sqlite3 CLI 开启 WAL 模式
  execSync(`sqlite3 "${DB_PATH}" "PRAGMA journal_mode=WAL;"`, { encoding: 'utf-8', timeout: 5000 });
  console.log('✅ SQLite WAL 模式已开启（断电安全）');
} catch(e) {
  // sqlite3 CLI 不可用时跳过
  console.log('⚠️  无法设置 WAL 模式（sqlite3 CLI 不可用）');
}

// ====== 2. 备份 KAG 文件到 backup 目录 ======
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

const backupFile = path.join(BACKUP_DIR, `kag_backup_${dateStr}.json`);

// 收集所有实体
const entityDir = path.join(KAG_DIR, 'entities');
const entities = [];
if (fs.existsSync(entityDir)) {
  fs.readdirSync(entityDir).filter(f => f.endsWith('.md')).forEach(f => {
    const content = fs.readFileSync(path.join(entityDir, f), 'utf-8');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    entities.push({ id: f.replace('.md', ''), frontmatter: match ? match[1] : '', content, backed_up: now.toISOString() });
  });
}

// 收集关系索引
let relations = '';
const relFile = path.join(KAG_DIR, 'relations.md');
if (fs.existsSync(relFile)) relations = fs.readFileSync(relFile, 'utf-8');

const backup = {
  backup_time: now.toISOString(),
  entity_count: entities.length,
  entities,
  relations,
  db_backup: fs.existsSync(DB_PATH) ? 'kaoshi.db (需单独备份)' : 'N/A',
};

fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), 'utf-8');
console.log(`✅ 知识库备份: ${backupFile} (${entities.length}实体)`);

// ====== 3. 清理旧备份（保留最近7天） ======
const backups = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('kag_backup_')).sort();
if (backups.length > 7) {
  backups.slice(0, backups.length - 7).forEach(f => {
    fs.unlinkSync(path.join(BACKUP_DIR, f));
  });
  console.log(`🗑️  清理旧备份: ${backups.length - 7}个`);
}

// ====== 4. Git auto commit ======
try {
  const zhiceDir = path.join(__dirname, '..', '..', 'zhice');
  execSync('git add -A', { cwd: zhiceDir, encoding: 'utf-8', timeout: 10000 });

  const status = execSync('git status --porcelain', { cwd: zhiceDir, encoding: 'utf-8' });
  if (status.trim()) {
    execSync(`git commit -m "kag: 自动备份 ${dateStr} — ${entities.length}实体"`, { cwd: zhiceDir, encoding: 'utf-8', timeout: 10000 });
    console.log('✅ Git commit 完成');

    // 尝试 push（如果配置了远程仓库）
    try {
      execSync('git push', { cwd: zhiceDir, encoding: 'utf-8', timeout: 15000 });
      console.log('✅ Git push 完成（异地容灾）');
    } catch(e) {
      console.log('⚠️  Git push 跳过（未配置远程仓库或网络不可用）');
    }
  } else {
    console.log('ℹ️  无变更，跳过 Git commit');
  }
} catch(e) {
  console.log('⚠️  Git 操作跳过:', e.message?.substring(0, 50));
}

// ====== 5. 数据库备份 ======
try {
  execSync(`sqlite3 "${DB_PATH}" ".backup '${path.join(BACKUP_DIR, `kaoshi_${dateStr}.db`)}'"`, { encoding: 'utf-8', timeout: 30000 });
  console.log(`✅ 数据库备份: kaoshi_${dateStr}.db`);
} catch(e) {
  console.log('⚠️  数据库备份跳过（sqlite3 CLI 不可用）');
}

console.log(`\n📊 备份完成: ${now.toISOString()}`);
console.log(`   实体: ${entities.length} | 备份保留: 7天 | 异地: Git push`);
