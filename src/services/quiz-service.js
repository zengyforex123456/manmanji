// src/services/quiz-service.js — 题库加载 + 权重抽题 + 组卷
// R6: 综合权重+衰减因子 + R7: 交错练习 + R8-R11: 4模式

import { DB } from '../core/db.js';
import { State } from '../core/state.js';
import { SUBJECTS_META, getSubjectMeta } from '../data/subjects-meta.js';

// ─── 权重配置 ───
function getBaseWeight(subjectId, chapter) {
  const meta = getSubjectMeta(subjectId);
  if (!meta) return 0.5;
  const ch = meta.chapters.find(c => c.id === chapter);
  if (!ch) return 0.5;
  if (ch.tier === 1) return 0.9;
  if (ch.tier === 2) return 0.7;
  return 0.4;
}

// ─── 综合权重计算 ───
// R6: baseWeight × mistakeMultiplier × decayFactor
const _recentPicks = []; // 最近抽中题目ID列表（用于衰减）

function calculateWeight(question, progress) {
  let weight = getBaseWeight(question.subjectId || State.getActiveSubjectId(), question.chapter);

  // 错题加权
  if (progress && progress.wrongCount > 0) {
    weight *= Math.min(1.5, 1 + progress.wrongCount * 0.15);
  }

  // R6 衰减因子: 0.8^(24h内被抽次数)
  const recentCount = _recentPicks.filter(id => id === question.id).length;
  weight *= Math.pow(0.8, recentCount);
  weight = Math.max(0.15, Math.min(1.0, weight));

  // 新题加权（没有progress记录的题给中等权重）
  if (!progress) weight = Math.max(weight, 0.5);

  return weight;
}

// ─── 加载题库（API按需 + IndexedDB缓存 + 后台全量同步） ───
const API = '';
let _fullLoadStarted = {};

async function loadSubject(subjectId) {
  // 1. IndexedDB 缓存 → 秒开
  const cached = await DB.getQuestionsBySubject(subjectId);
  if (cached && cached.length > 0) return cached;

  // 2. 首次：API 取小批量 → 立即返回 → 后台同步全量
  try {
    const resp = await fetch(`${API}/api/questions/${subjectId}?limit=2000`);
    if (resp.ok) {
      const data = await resp.json();
      const questions = data.questions || [];
      // 后台异步加载全量到IndexedDB（不阻塞返回）
      if (!_fullLoadStarted[subjectId]) {
        _fullLoadStarted[subjectId] = true;
        setTimeout(async () => {
          try {
            const fullResp = await fetch(`${API}/api/questions/${subjectId}?limit=100000`);
            if (fullResp.ok) {
              const full = await fullResp.json();
              await DB.putQuestions(subjectId, full.questions || []);
              console.log(`[Quiz] ${subjectId}: cached ${full.questions?.length || 0} questions`);
            }
          } catch(e) { console.warn('[Quiz] bg sync failed:', e); }
        }, 100);
      }
      return questions;
    }
  } catch (e) { console.warn('[Quiz] API load failed, trying static:', e); }

  // 3. 兜底：快速文件
  try {
    const r = await fetch(`/data/${subjectId}/questions-quick.json`);
    if (r.ok) return await r.json();
  } catch(e) {}

  return [];
}

// ─── 组卷 ───
async function pickQuestions({ subjectId, mode, chapter = null, count = 10 }) {
  const sid = subjectId || State.getActiveSubjectId();
  const questions = await loadSubject(sid);
  if (!questions.length) return [];

  const progressMap = {};
  const progress = await DB.getProgress(sid);
  progress.forEach(p => { progressMap[p.questionId] = p; });

  let pool = questions;

  // 按模式筛选
  if (mode === 'beginner') {
    // R8: 新手模式 — 优先简单题+有口诀+高accuracy
    pool = questions.filter(q => {
      if (chapter && q.chapter !== chapter) return false;
      const acc = q.accuracy || 0.6;
      const diff = q.difficulty || 3;
      const hasMnemonic = q.mnemonic && q.mnemonic.length > 2;
      // 简单题(≤2)或有口诀的优先保留
      if (diff <= 2) return true;
      if (hasMnemonic && acc > 0.4) return true;
      return acc > 0.6 || !progressMap[q.id];
    });
    // 简单题优先排列
    pool.sort((a, b) => (a.difficulty || 3) - (b.difficulty || 3));
  } else if (mode === 'advanced') {
    // R9: 2-3章混合
    if (chapter) {
      pool = questions.filter(q => {
        const diff = Math.abs((q.chapter || 0) - chapter);
        return diff <= 2 && q.chapter > 0;
      });
    }
  } else if (mode === 'mock') {
    // R10: 全科目随机
    const meta = getSubjectMeta(sid);
    if (meta) {
      const examCfg = meta.examConfig;
      const singles = questions.filter(q => q.type === 'single');
      const multis = questions.filter(q => q.type === 'multiple');
      const cases = questions.filter(q => q.type === 'case');

      const picked = [];
      picked.push(...shuffleAndWeight(singles, examCfg.singleCount, progressMap));
      picked.push(...shuffleAndWeight(multis, examCfg.multiCount, progressMap));
      picked.push(...shuffleAndWeight(cases, examCfg.caseCount || 0, progressMap));
      return shuffleArr(picked);
    }
  } else if (mode === 'mistake') {
    // R11: 错题模式
    pool = questions.filter(q => {
      const p = progressMap[q.id];
      return p && p.wrongCount > 0;
    });
    pool.sort((a, b) => {
      const pa = progressMap[a.id];
      const pb = progressMap[b.id];
      return (pa?.lastReview || '').localeCompare(pb?.lastReview || ''); // lastReview升序
    });
  }

  // 权重排序
  const weighted = pool.map(q => ({
    q,
    weight: calculateWeight({ ...q, subjectId: sid }, progressMap[q.id]),
  }));
  weighted.sort((a, b) => b.weight - a.weight);

  // 取前count
  let selected = weighted.slice(0, count).map(w => w.q);

  // R7: 交错排列
  if (mode === 'advanced' || mode === 'beginner') {
    selected = interleaveBatch(selected);
  } else {
    selected = shuffleArr(selected);
  }

  // 记录本次抽中（用于衰减）
  selected.forEach(q => _recentPicks.push(q.id));
  if (_recentPicks.length > 200) _recentPicks.splice(0, 100);

  return selected;
}

// ─── 交错排列（R7: 最近5题同章≤2题） ───
function interleaveBatch(questions) {
  if (questions.length <= 2) return questions;
  const result = [];
  const pool = [...questions];
  const chapterCount = {}; // 滑动窗口

  while (pool.length > 0) {
    // 找到可用的题（同章在最近5题中出现<2次）
    let picked = null;
    for (let i = 0; i < pool.length; i++) {
      const ch = pool[i].chapter || 0;
      if ((chapterCount[ch] || 0) < 2) {
        picked = pool.splice(i, 1)[0];
        break;
      }
    }
    if (!picked) picked = pool.shift(); // fallback

    result.push(picked);
    const ch = picked.chapter || 0;
    chapterCount[ch] = (chapterCount[ch] || 0) + 1;

    // 保持窗口大小=5
    if (result.length > 5) {
      const oldCh = result[result.length - 6].chapter || 0;
      chapterCount[oldCh] = Math.max(0, (chapterCount[oldCh] || 1) - 1);
    }
  }
  return result;
}

// ─── 工具 ───
function shuffleAndWeight(arr, count, progressMap) {
  if (!arr.length || count <= 0) return [];
  const weighted = arr.map(q => ({
    q,
    weight: calculateWeight(q, progressMap[q.id]),
  }));
  weighted.sort((a, b) => b.weight - a.weight);
  return weighted.slice(0, count).map(w => w.q);
}

function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── 搜索 ───
function searchQuestions(keyword, subjectId = null) {
  // 简单内存搜索(后续可升级Web Worker)
  return []; // Phase 2暂不实现搜索UI
}

export const QuizService = {
  loadSubject,
  pickQuestions,
  calculateWeight,
  interleaveBatch,
  searchQuestions,
};
