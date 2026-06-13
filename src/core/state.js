// src/core/state.js — 全局状态管理 + localStorage 热备份 + 崩溃恢复
import { DB } from './db.js';

const STORAGE_KEY = 'manmanji_state';
const VERSION_KEY = 'manmanji_version';
const STATE_VERSION = 1;

let _state = {};
let _listeners = [];
let _saveTimer = null;
let _lastQuestionId = null;
let _lastMode = null;
let _lastSubjectId = null;

// ─── 默认状态 ───
const DEFAULT_STATE = {
  activeSubjectId: 'econ',
  membershipTier: 'vip', // MVP演示用通卡
  fontSizeClass: 'font-normal',
  eyeProtectMode: false,
  daysStudied: 0,
  userId: null,           // 登录后设置
  loginType: null,        // 'phone' | 'wechat' | null
  subjectsState: {},
  analyticsEvents: [],
};

// ─── token恢复 ───
function restoreLoginState() {
  try {
    const token = localStorage.getItem('mmj_token');
    if (token) {
      const decoded = JSON.parse(atob(token));
      if (decoded.phone && decoded.ts) {
        // token 7天有效
        if (Date.now() - decoded.ts < 7 * 86400000) {
          _state.userId = decoded.phone;
          _state.loginType = 'token';
        } else {
          localStorage.removeItem('mmj_token');
        }
      }
    }
  } catch (e) {
    // token无效，清除
    localStorage.removeItem('mmj_token');
  }
}

// ─── 初始化 + 崩溃恢复 ───
async function init() {
  _state = loadState();

  // 从token恢复登录态
  restoreLoginState();

  // 版本号比对（R16 双写冲突解决）
  const localVersion = parseInt(localStorage.getItem(VERSION_KEY) || '0', 10);
  const idbReady = await DB.init();

  if (idbReady) {
    // IndexedDB 可用 → 以 IndexedDB 为准
    const idbVersion = await getIDBVersion();
    if (idbVersion >= localVersion) {
      // IDB版本较新，从IDB恢复
      const lastSession = await getLastSessionFromIDB();
      if (lastSession && !_state._sessionStartLogged) {
        _state._lastCrash = lastSession;
      }
    } else {
      // localStorage更新，重建IDB
      localStorage.setItem(VERSION_KEY, String(STATE_VERSION));
    }
  } else {
    // IDB不可用 → 纯localStorage
    console.warn('[State] IndexedDB unavailable, localStorage only');
  }

  // 初始化科目状态槽
  initSubjectSlots();
  saveState();
  return _state;
}

// ─── 读取状态 ───
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.subjectsState) return parsed;
    }
  } catch (e) {
    console.error('[State] Load failed, using default');
  }
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

// ─── 保存状态（debounce 100ms） ───
function saveState() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try {
      syncGlobalStats();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
      localStorage.setItem(VERSION_KEY, String(STATE_VERSION));
    } catch (e) {
      console.error('[State] Save failed:', e.message);
    }
  }, 100);
}

// ─── 立即强制保存（用于答题后 → R21 答即存） ───
function saveNow() {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
  try {
    syncGlobalStats();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
  } catch (e) {
    console.error('[State] SaveNow failed:', e.message);
  }
}

// ─── 获取版本号 ───
async function getIDBVersion() {
  try {
    const meta = await DB.getMeta('_state');
    return meta ? (meta.version || 0) : 0;
  } catch (e) {
    return 0;
  }
}

// ─── 获取上次会话记录（崩溃恢复） ───
async function getLastSessionFromIDB() {
  try {
    const allProgress = await DB.getProgress(_state.activeSubjectId);
    if (allProgress.length === 0) return null;
    const latest = allProgress.reduce((a, b) =>
      new Date(a.lastReview) > new Date(b.lastReview) ? a : b
    );
    return {
      subjectId: latest.subjectId,
      questionId: latest.questionId,
      lastReview: latest.lastReview,
    };
  } catch (e) {
    return null;
  }
}

// ─── 初始化科目状态槽 ───
function initSubjectSlots() {
  const SUBJECT_IDS = ['econ', 'hr', 'biz', 'accounting', 'teacher', 'social', 'construct', 'tax', 'acc_junior'];
  if (!_state.subjectsState) _state.subjectsState = {};
  SUBJECT_IDS.forEach(id => {
    if (!_state.subjectsState[id]) {
      _state.subjectsState[id] = {
        pointsChecked: [],
        quizDoneCount: 0,
        checkIn: false,
        ebbinghausQueue: [],
        wrongQuestions: [],
        firstAttempts: {},
      };
    }
  });
}

// ─── 全局统计 ───
function syncGlobalStats() {
  let points = 0, wrong = 0, quizzes = 0;
  Object.keys(_state.subjectsState).forEach(key => {
    const s = _state.subjectsState[key];
    points += (s.pointsChecked || []).length;
    wrong += (s.wrongQuestions || []).length;
    quizzes += (s.quizDoneCount || 0);
  });
  _state.learnedPointsCount = points;
  _state.wrongQuestionsCount = wrong;
  _state._totalQuizzes = quizzes;
}

// ─── 当前科目状态 ───
function currentSubject() {
  return _state.subjectsState[_state.activeSubjectId];
}

function getActiveSubjectId() {
  return _state.activeSubjectId;
}

// ─── 状态变更 + 通知 ───
function setActiveSubject(subjectId) {
  _state.activeSubjectId = subjectId;
  _lastSubjectId = subjectId;
  saveNow(); // 立即持久化（避免reload前丢失）
  notify('subjectChanged', { subjectId });
}

function setUserId(userId, loginType) {
  _state.userId = userId;
  _state.loginType = loginType;
  saveState();
  notify('loginChanged', { userId, loginType });
}

function setLastSession(questionId, mode, subjectId) {
  _lastQuestionId = questionId;
  _lastMode = mode;
  _lastSubjectId = subjectId;
}

function getLastSession() {
  return {
    questionId: _lastQuestionId,
    mode: _lastMode,
    subjectId: _lastSubjectId || _state.activeSubjectId,
  };
}

// ─── 埋点事件（R18） ───
function trackEvent(event, data) {
  if (!_state.analyticsEvents) _state.analyticsEvents = [];
  _state.analyticsEvents.push({
    event,
    data,
    timestamp: Date.now(),
  });
  // 每10条 sendBeacon
  if (_state.analyticsEvents.length >= 10) {
    flushAnalytics();
  }
}

const METRICS_API = '/api/metrics';
function flushAnalytics() {
  if (!_state.analyticsEvents || _state.analyticsEvents.length === 0) return;
  const events = _state.analyticsEvents.splice(0);
  try {
    fetch(METRICS_API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
    }).catch(() => {});
  } catch (e) { /* silent */ }
}

// ─── 订阅/通知（事件总线） ───
function subscribe(fn) {
  _listeners.push(fn);
  return () => {
    _listeners = _listeners.filter(l => l !== fn);
  };
}

function notify(event, data) {
  _listeners.forEach(fn => {
    try { fn(event, data); } catch (e) { /* swallow */ }
  });
}

// ─── 导出 ───
export const State = {
  init,
  saveState,
  saveNow,
  currentSubject,
  getActiveSubjectId,
  setActiveSubject,
  setUserId,
  setLastSession,
  getLastSession,
  trackEvent,
  flushAnalytics,
  subscribe,
  get state() { return _state; },
};
