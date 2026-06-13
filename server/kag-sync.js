// server/kag-sync.js — KAG Markdown ↔ SQLite 双向同步
import fs from 'fs';
import path from 'path';
import { initDB, getDB } from './db.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// zhice KAG 知识库路径
const KAG_DIR = path.join(__dirname, '..', '..', 'zhice', '.claude', 'knowledge', 'entities');
const RELATIONS_FILE = path.join(__dirname, '..', '..', 'zhice', '.claude', 'knowledge', 'relations.md');

/**
 * 解析 YAML frontmatter 和 Markdown body
 */
function parseEntity(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;

  const frontmatter = {};
  match[1].split('\n').forEach(line => {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (m) {
      const val = m[2].trim();
      // 解析列表 [a, b, c]
      if (val.startsWith('[') && val.endsWith(']')) {
        frontmatter[m[1]] = val.slice(1, -1).split(',').map(s => s.trim().replace(/"/g, ''));
      } else {
        frontmatter[m[1]] = val.replace(/"/g, '');
      }
    }
  });

  return {
    id: path.basename(filePath, '.md'),
    file_path: filePath,
    frontmatter,
    body: match[2].trim(),
    file_mtime: fs.statSync(filePath).mtime.toISOString(),
  };
}

/**
 * 初始化 KAG 表
 */
async function initKAGTables() {
  const db = await initDB();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS kag_entities (
      id TEXT PRIMARY KEY,
      type TEXT,
      maturity TEXT,
      severity TEXT,
      ema_score REAL,
      project TEXT,
      module TEXT,
      tags TEXT,
      keywords TEXT,
      aliases TEXT,
      frontmatter_json TEXT,
      body TEXT,
      file_path TEXT,
      file_mtime TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS kag_relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id TEXT,
      target_id TEXT,
      relation_type TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

/**
 * 文件 → SQLite 同步（增量）
 */
export async function syncFilesToDB() {
  await initKAGTables();
  const db = await initDB();

  if (!fs.existsSync(KAG_DIR)) {
    console.log('[KAG] 知识库目录不存在:', KAG_DIR);
    return { synced: 0, total: 0 };
  }

  const files = fs.readdirSync(KAG_DIR).filter(f => f.endsWith('.md'));
  let synced = 0;

  for (const file of files) {
    const entity = parseEntity(path.join(KAG_DIR, file));
    if (!entity) continue;

    const tags = JSON.stringify(entity.frontmatter.tags || []);
    const keywords = JSON.stringify(entity.frontmatter.keywords || []);
    const aliases = JSON.stringify(entity.frontmatter.aliases || []);

    await db.run(`
      INSERT OR REPLACE INTO kag_entities
        (id, type, maturity, severity, ema_score, project, module, tags, keywords, aliases, frontmatter_json, body, file_path, file_mtime, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [
      entity.id,
      entity.frontmatter.type || '',
      entity.frontmatter.maturity || '',
      entity.frontmatter.severity || '',
      parseFloat(entity.frontmatter.ema_score) || 0,
      entity.frontmatter.project || '',
      entity.frontmatter.module || '',
      tags,
      keywords,
      aliases,
      JSON.stringify(entity.frontmatter),
      entity.body,
      entity.file_path,
      entity.file_mtime,
    ]);
    synced++;
  }

  // 同步关系
  if (fs.existsSync(RELATIONS_FILE)) {
    const relContent = fs.readFileSync(RELATIONS_FILE, 'utf-8');
    const wikiLinks = relContent.match(/\[\[([^\]]+)\]\]/g) || [];
    for (const link of wikiLinks) {
      const target = link.replace(/\[\[|\]\]/g, '');
      // 简单规则：找到包含此链接的行，提取上下文
      const lines = relContent.split('\n').filter(l => l.includes(link));
      for (const line of lines) {
        const sourceMatch = line.match(/^\-\s*\[\[([^\]]+)\]\]/);
        if (sourceMatch) {
          await db.run(`
            INSERT OR IGNORE INTO kag_relations (source_id, target_id, relation_type)
            VALUES (?, ?, 'wiki_link')
          `, [sourceMatch[1], target]);
        }
      }
    }
  }

  return { synced, total: files.length };
}

/**
 * SQLite → 查询 API
 */
export async function queryKAG(params = {}) {
  const db = await initDB();
  let sql = 'SELECT * FROM kag_entities WHERE 1=1';
  const vals = [];

  if (params.type)     { sql += ' AND type = ?'; vals.push(params.type); }
  if (params.severity) { sql += ' AND severity = ?'; vals.push(params.severity); }
  if (params.maturity) { sql += ' AND maturity = ?'; vals.push(params.maturity); }
  if (params.project)  { sql += ' AND project = ?'; vals.push(params.project); }
  if (params.search) {
    sql += ' AND (body LIKE ? OR keywords LIKE ? OR aliases LIKE ?)';
    const s = `%${params.search}%`;
    vals.push(s, s, s);
  }

  sql += ' ORDER BY updated_at DESC';
  if (params.limit) { sql += ' LIMIT ?'; vals.push(parseInt(params.limit)); }

  return db.all(sql, vals);
}

/**
 * KAG 统计摘要
 */
export async function kagSummary() {
  const db = await initDB();
  const byType = await db.all('SELECT type, COUNT(*) as count FROM kag_entities GROUP BY type');
  const bySeverity = await db.all('SELECT severity, COUNT(*) as count FROM kag_entities WHERE severity != "" GROUP BY severity');
  const total = await db.get('SELECT COUNT(*) as count FROM kag_entities');
  const recentUpdated = await db.get("SELECT COUNT(*) as count FROM kag_entities WHERE updated_at > datetime('now', '-7 days')");

  return {
    total: total.count,
    recentUpdated: recentUpdated.count,
    byType,
    bySeverity,
  };
}
