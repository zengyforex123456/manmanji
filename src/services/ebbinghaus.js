// src/services/ebbinghaus.js — SM-2 间隔重复引擎
// R5: 5Box(1/3/7/15/30天) + ease[1.3,2.5] + 异常interval=1天兜底
// R43: Promise队列 + 防抖300ms

import { DB } from '../core/db.js';
import { State } from '../core/state.js';

const INTERVALS = [1, 3, 7, 15, 30]; // 天
const EASE_INITIAL = 2.5;
const EASE_MIN = 1.3;
const BOX_MAX = 5;
const QUALITY_THRESHOLD = 3; // quality>=3 视为有效回忆

// R43: 并发保护
const _writeQueue = new Map(); // questionId -> Promise

// ─── 获取到期复习列表 ───
async function getDueReviews(subjectId = null) {
  const sid = subjectId || State.getActiveSubjectId();
  const progress = await DB.getProgress(sid);
  const now = Date.now();
  return progress
    .filter(p => !p.nextReview || p.nextReview <= now)
    .sort((a, b) => (a.nextReview || 0) - (b.nextReview || 0));
}

// ─── 记录答题（SM-2核心） ───
async function recordReview(questionId, quality, subjectId = null) {
  // R43: Promise队列防并发
  if (_writeQueue.has(questionId)) {
    await _writeQueue.get(questionId);
  }
  const promise = _recordReviewImpl(questionId, quality, subjectId);
  _writeQueue.set(questionId, promise);
  promise.finally(() => _writeQueue.delete(questionId));
  return promise;
}

async function _recordReviewImpl(questionId, quality, subjectId) {
  const sid = subjectId || State.getActiveSubjectId();
  let record;

  try {
    record = await DB.getProgressByQuestion(questionId);
  } catch (e) {
    // R5: SM-2异常 → interval=1天兜底
    record = null;
  }

  if (!record) {
    record = {
      questionId,
      subjectId: sid,
      box: 1,
      ease: EASE_INITIAL,
      interval: INTERVALS[0],
      lastReview: new Date().toISOString(),
      nextReview: null,
      wrongCount: quality < QUALITY_THRESHOLD ? 1 : 0,
      quality,
      history: [],
    };
  }

  // 更新答题历史
  if (!record.history) record.history = [];
  record.history.push({
    date: new Date().toISOString().split('T')[0],
    quality,
  });
  if (record.history.length > 5) record.history.shift();

  // SM-2 盒子和ease调整
  if (quality >= QUALITY_THRESHOLD) {
    record.box = Math.min(BOX_MAX, (record.box || 1) + 1);
    record.ease = Math.min(EASE_INITIAL, (record.ease || EASE_INITIAL) + 0.1);
  } else {
    record.box = Math.max(1, (record.box || 1) - 1);
    record.ease = Math.max(EASE_MIN, (record.ease || EASE_INITIAL) - 0.2);
    record.wrongCount = (record.wrongCount || 0) + 1;
  }

  record.quality = quality;
  record.lastReview = new Date().toISOString();
  record.interval = Math.round(INTERVALS[(record.box - 1) || 0] * record.ease);
  record.nextReview = Date.now() + record.interval * 86400000;
  record.subjectId = sid;

  try {
    await DB.putProgress(record);
  } catch (e) {
    console.error('[SM-2] Write failed, using fallback:', e);
    record.interval = 1;
    record.nextReview = Date.now() + 86400000;
    await DB.putProgress(record);
  }

  State.saveNow(); // R21: 答即存
  // R46: 登录后云端同步
  syncToCloud(record);
  return record;
}

// ─── 每日统计 ───
async function getDailyStats(subjectId = null) {
  const sid = subjectId || State.getActiveSubjectId();
  const progress = await DB.getProgress(sid);
  const now = Date.now();

  const boxDist = [0, 0, 0, 0, 0];
  let dueToday = 0;
  let sumEase = 0;
  let count = 0;

  progress.forEach(p => {
    const box = (p.box || 1) - 1;
    if (box >= 0 && box < 5) boxDist[box]++;
    if (p.nextReview && p.nextReview <= now) dueToday++;
    sumEase += p.ease || EASE_INITIAL;
    count++;
  });

  return {
    totalInQueue: progress.length,
    boxDistribution: boxDist,
    dueToday,
    avgEase: count > 0 ? +(sumEase / count).toFixed(2) : EASE_INITIAL,
  };
}

// ─── 初始化新题进度 ───
async function initQuestion(questionId, subjectId = null) {
  return recordReview(questionId, 0, subjectId); // quality=0 → 放入Box1
}

// ─── R46: 云端同步 ───
const SYNC_API = window.location.hostname === 'localhost' ? 'http://localhost:3009' : '/api';
let _syncQueue = [];
let _syncTimer = null;

function syncToCloud(record) {
  const token = localStorage.getItem('mmj_token');
  if (!token) return;
  _syncQueue.push(record);
  if (!_syncTimer) {
    _syncTimer = setTimeout(flushSync, 3000); // 3秒批量上传
  }
}

async function flushSync() {
  const token = localStorage.getItem('mmj_token');
  if (!token || _syncQueue.length === 0) { _syncTimer = null; return; }
  const batch = _syncQueue.splice(0);
  try {
    await fetch(`${SYNC_API}/api/progress/${batch[0].subjectId || 'econ'}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ progress: batch }),
    });
  } catch (e) { /* 静默失败，下次重试 */ }
  _syncTimer = null;
  // 如果还有积压，继续上传
  if (_syncQueue.length > 0) _syncTimer = setTimeout(flushSync, 3000);
}

// 登录后拉取云端进度并合并
async function pullFromCloud() {
  const token = localStorage.getItem('mmj_token');
  if (!token) return 0;
  let total = 0;
  for (const sid of ['econ','hr','biz']) {
    try {
      const r = await fetch(`${SYNC_API}/api/progress/${sid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const data = await r.json();
        if (data.progress && data.progress.length > 0) {
          for (const p of data.progress) {
            await DB.putProgress(p);
            total++;
          }
        }
      }
    } catch (e) { /* skip failed subject */ }
  }
  return total;
}

export const Ebbinghaus = {
  getDueReviews, recordReview, getDailyStats, initQuestion,
  pullFromCloud, INTERVALS,
};
