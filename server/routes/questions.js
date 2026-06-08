// server/routes/questions.js
import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { getQuestions, invalidateSubjectCache, updateSubjectCount } from '../cache.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateSchema } from '../middleware/validateSchema.js';

const router = Router();

// ---------- JSON Schemas ----------
const batchSchema = {
  type: 'object',
  properties: {
    subjectId: { type: 'string' },
    questions: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          stem: { type: 'string' },
          type: { enum: ['single', 'multiple', 'case'] },
          options: { type: 'array', minItems: 2 },
          answer: { type: 'string' },
          difficulty: { type: 'integer', minimum: 1, maximum: 5 },
          // optional fields
          analysis: { type: 'string' },
          tags: { type: 'array' },
          module: { type: 'string' },
          chapter: { type: 'integer' },
          mnemonic: { type: 'string' },
          newContent: { type: 'boolean' },
          accuracy: { type: 'number' },
          source: { type: 'string' }
        },
        required: ['id', 'stem', 'type', 'options', 'answer'],
        additionalProperties: false
      }
    }
  },
  required: ['subjectId', 'questions'],
  additionalProperties: false
};

// ---------- Routes ----------
// 获取某科题目总数
router.get('/:subjectId/count', asyncHandler(async (req, res) => {
  const { subjectId } = req.params;
  const questions = getQuestions(DATA_DIR, subjectId);
  if (!questions) {
    return res.json({ subjectId, count: 0, message: '题库文件不存在' });
  }
  res.json({ subjectId, count: questions.length });
}));

// 分页查询题目
router.get('/:subjectId', asyncHandler(async (req, res) => {
  const { subjectId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
  const chapter = req.query.chapter ? parseInt(req.query.chapter) : null;
  const type = req.query.type || null;
  const difficulty = req.query.difficulty ? parseInt(req.query.difficulty) : null;

  const questions = getQuestions(DATA_DIR, subjectId);
  if (!questions) {
    return res.json({ subjectId, questions: [], total: 0, page, limit });
  }

  let filtered = questions;
  if (chapter) filtered = filtered.filter(q => q.chapter === chapter);
  if (type) filtered = filtered.filter(q => q.type === type);
  if (difficulty) filtered = filtered.filter(q => q.difficulty === difficulty);

  const total = filtered.length;
  const start = (page - 1) * limit;
  const paged = filtered.slice(start, start + limit);

  res.json({
    subjectId,
    questions: paged,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  });
}));

// 批量上传题目（使用 AJV 验证）
// 批量上传题目（使用 AJV 验证 & SQLite事务）
router.post('/batch', validateSchema(batchSchema), asyncHandler(async (req, res) => {
  const { subjectId, questions } = req.body;

  // 归一化并去重（基于内存集合）
  const existingIds = new Set();
  const existingStems = new Set();
  const validQuestions = [];
  let duplicated = 0;

  for (const q of questions) {
    if (existingIds.has(q.id) || existingStems.has(q.stem?.trim())) { duplicated++; continue; }
    const normalized = {
      id: q.id,
      subjectId,
      stem: q.stem,
      type: q.type,
      options: JSON.stringify(q.options),
      answer: q.answer,
      analysis: q.analysis || '',
      difficulty: q.difficulty || 3,
      tags: JSON.stringify(q.tags || []),
      module: q.module || '',
      chapter: q.chapter || 0,
      mnemonic: q.mnemonic || '',
      newContent: q.newContent ? 1 : 0,
      accuracy: q.accuracy || 0.6,
      source: q.source || ''
    };
    existingIds.add(q.id);
    existingStems.add(q.stem?.trim());
    validQuestions.push(normalized);
  }

  if (validQuestions.length === 0) {
    return res.json({ inserted: 0, duplicated, errors: [], beforeCount: 0, afterCount: 0 });
  }

  const db = await getDB();
  try {
    await db.exec('BEGIN TRANSACTION');
    const stmt = await db.prepare(`INSERT OR REPLACE INTO questions 
      (id, subjectId, stem, type, options, answer, analysis, difficulty, tags, module, chapter, mnemonic, newContent, accuracy, source) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const q of validQuestions) {
      await stmt.run(q.id, q.subjectId, q.stem, q.type, q.options, q.answer, q.analysis, q.difficulty, q.tags, q.module, q.chapter, q.mnemonic, q.newContent, q.accuracy, q.source);
    }
    await stmt.finalize();
    await db.exec('COMMIT');
  } catch (e) {
    await db.exec('ROLLBACK');
    return res.status(500).json({ error: '写入题库失败: ' + e.message });
  }

  // 更新缓存及科目计数
  invalidateSubjectCache(subjectId);
  // 重新统计题目数量
  const { count } = await db.get('SELECT COUNT(*) as count FROM questions WHERE subjectId = ?', subjectId);
  updateSubjectCount(subjectId, count);

  res.json({ inserted: validQuestions.length, duplicated, errors: [], beforeCount: 0, afterCount: count });
}));
  const { subjectId, questions } = req.body;

  const subjDir = path.join(DATA_DIR, subjectId);
  if (!fs.existsSync(subjDir)) {
    fs.mkdirSync(subjDir, { recursive: true });
  }

  const file = path.join(subjDir, 'questions.json');
  let existing = [];
  if (fs.existsSync(file)) {
    try { existing = JSON.parse(fs.readFileSync(file, 'utf-8')); }
    catch (e) { return res.status(500).json({ error: '读取已有题库失败: ' + e.message }); }
  }

  const existingIds = new Set(existing.map(q => q.id));
  const existingStems = new Set(existing.map(q => q.stem?.trim()));
  let inserted = 0, duplicated = 0;
  const errors = [];
  const validQuestions = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    // 去重检查
    if (existingIds.has(q.id) || existingStems.has(q.stem?.trim())) { duplicated++; continue; }
    // 规范化字段（保持原字段并补齐可选项）
    const normalized = {
      id: q.id,
      type: q.type,
      stem: q.stem,
      options: q.options,
      answer: q.answer,
      analysis: q.analysis || '',
      difficulty: q.difficulty || 3,
      tags: Array.isArray(q.tags) ? q.tags : [],
      module: q.module || '',
      chapter: q.chapter || 0,
      mnemonic: q.mnemonic || '',
      newContent: q.newContent || false,
      accuracy: q.accuracy || 0.6,
      source: q.source || ''
    };
    existingIds.add(q.id);
    existingStems.add(q.stem?.trim());
    validQuestions.push(normalized);
    inserted++;
  }

  // 合并写入
  const merged = [...existing, ...validQuestions];
  try {
    fs.writeFileSync(file, JSON.stringify(merged, null, 2), 'utf-8');
    invalidateSubjectCache(subjectId);
    updateSubjectCount(subjectId, merged.length);
  } catch (e) {
    return res.status(500).json({ error: '写入题库失败: ' + e.message });
  }

  res.json({ inserted, duplicated, errors: errors.length ? errors : undefined, beforeCount: existing.length, afterCount: merged.length });
}));

export default router;
