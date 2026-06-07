// src/core/db.js — IndexedDB 存储封装（Dexie）+ 降级逻辑
import Dexie from 'dexie';

const DB_NAME = 'ManManJi';
const DB_VERSION = 1;
let db = null;
let dbAvailable = true;

// ─── 初始化 ───
function init() {
  try {
    db = new Dexie(DB_NAME);
    db.version(DB_VERSION).stores({
      questions: 'id, subjectId, chapter, module, difficulty, *tags',
      progress: 'questionId, subjectId, box, nextReview, wrongCount',
      meta: 'subjectId',
    });
    dbAvailable = true;
    return db.open().then(() => {
      console.log('[DB] IndexedDB ready');
      return true;
    }).catch((err) => {
      console.warn('[DB] IndexedDB open failed, using fallback:', err.message);
      dbAvailable = false;
      db = null;
      return false;
    });
  } catch (err) {
    console.warn('[DB] Dexie init failed:', err.message);
    dbAvailable = false;
    db = null;
    return Promise.resolve(false);
  }
}

// ─── 状态检查 ───
function isAvailable() {
  return dbAvailable && db !== null;
}

// ─── Questions 表操作 ───
async function putQuestions(subjectId, questions) {
  if (!isAvailable()) return fallbackSetQuestions(subjectId, questions);
  try {
    await db.transaction('rw', db.questions, async () => {
      await db.questions.where('subjectId').equals(subjectId).delete();
      await db.questions.bulkPut(questions);
    });
    await db.meta.put({ subjectId, questionCount: questions.length, loadedAt: Date.now() });
  } catch (err) {
    console.error('[DB] putQuestions failed:', err);
    fallbackSetQuestions(subjectId, questions);
  }
}

async function getQuestionsBySubject(subjectId) {
  if (!isAvailable()) return fallbackGetQuestions(subjectId);
  try {
    return await db.questions.where('subjectId').equals(subjectId).toArray();
  } catch (err) {
    console.error('[DB] getQuestions failed:', err);
    return fallbackGetQuestions(subjectId);
  }
}

async function getQuestionsByChapter(subjectId, chapter) {
  if (!isAvailable()) {
    const all = fallbackGetQuestions(subjectId);
    return all.filter(q => q.chapter === chapter);
  }
  try {
    return await db.questions
      .where('subjectId').equals(subjectId)
      .and(q => q.chapter === chapter)
      .toArray();
  } catch (err) {
    return [];
  }
}

// ─── Progress 表操作 ───
async function putProgress(record) {
  if (!isAvailable()) return fallbackSetProgress(record);
  try {
    await retryWrite(() => db.progress.put(record), 3);
  } catch (err) {
    console.error('[DB] putProgress failed after retries:', err);
    fallbackSetProgress(record);
  }
}

async function getProgress(subjectId) {
  if (!isAvailable()) return fallbackGetProgress(subjectId);
  try {
    return await db.progress.where('subjectId').equals(subjectId).toArray();
  } catch (err) {
    console.error('[DB] getProgress failed:', err);
    return fallbackGetProgress(subjectId);
  }
}

async function getProgressByQuestion(questionId) {
  if (!isAvailable()) {
    const all = fallbackGetAllProgress();
    return all.find(p => p.questionId === questionId) || null;
  }
  try {
    return await db.progress.get(questionId);
  } catch (err) {
    return null;
  }
}

// ─── Meta 表操作 ───
async function getMeta(subjectId) {
  if (!isAvailable()) return null;
  try {
    return await db.meta.get(subjectId);
  } catch (err) {
    return null;
  }
}

// ─── 写入重试（R17 降级矩阵） ───
async function retryWrite(fn, maxRetries) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await new Promise(r => setTimeout(r, 100 * (i + 1)));
    }
  }
}

// ─── 降级存储（localStorage 缓存） ───
const LS_PREFIX = 'mmj_fallback_';

function fallbackSetQuestions(subjectId, questions) {
  try {
    localStorage.setItem(LS_PREFIX + 'questions_' + subjectId, JSON.stringify(questions));
  } catch (e) {
    // localStorage 满，清理旧数据后重试
    cleanupOldestFallback();
    try {
      localStorage.setItem(LS_PREFIX + 'questions_' + subjectId, JSON.stringify(questions.slice(0, 500)));
    } catch (e2) {
      console.error('[DB] fallback storage full, truncated');
    }
  }
}

function fallbackGetQuestions(subjectId) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + 'questions_' + subjectId);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function fallbackSetProgress(record) {
  try {
    const all = fallbackGetAllProgress();
    const idx = all.findIndex(p => p.questionId === record.questionId);
    if (idx >= 0) all[idx] = record;
    else all.push(record);
    localStorage.setItem(LS_PREFIX + 'progress', JSON.stringify(all));
  } catch (e) {
    cleanupOldProgress();
  }
}

function fallbackGetProgress(subjectId) {
  return fallbackGetAllProgress().filter(p => p.subjectId === subjectId);
}

function fallbackGetAllProgress() {
  try {
    const raw = localStorage.getItem(LS_PREFIX + 'progress');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function cleanupOldestFallback() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(LS_PREFIX + 'questions_'));
  if (keys.length > 0) {
    localStorage.removeItem(keys[0]);
    console.warn('[DB] Cleaned oldest fallback:', keys[0]);
  }
}

function cleanupOldProgress() {
  const all = fallbackGetAllProgress();
  if (all.length > 5) {
    localStorage.setItem(LS_PREFIX + 'progress', JSON.stringify(all.slice(-all.length + 5)));
    console.warn('[DB] Cleaned old progress records, kept latest 5');
  }
}

// ─── 导出 ───
export const DB = {
  init,
  isAvailable,
  putQuestions,
  getQuestionsBySubject,
  getQuestionsByChapter,
  putProgress,
  getProgress,
  getProgressByQuestion,
  getMeta,
};
