// miniapp/services/storage.ts — 小程序存储适配层
// 与 web 端 src/core/state.js 接口兼容
import Taro from '@tarojs/taro';

const STORAGE_KEY = 'mmj_state';

export function loadState() {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY);
    return raw ? JSON.parse(raw) : getDefaultState();
  } catch (e) {
    return getDefaultState();
  }
}

export function saveState(state: any) {
  try {
    Taro.setStorageSync(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('SaveState failed:', e);
  }
}

function getDefaultState() {
  return {
    activeSubjectId: 'econ',
    membershipTier: 'vip',
    fontSizeClass: 'normal',
    eyeProtectMode: false,
    daysStudied: 0,
    userId: null,
    loginType: null,
    subjectsState: {},
    analyticsEvents: [],
  };
}

// 缓存题库到本地
export function cacheQuestions(subjectId: string, questions: any[]) {
  try {
    Taro.setStorageSync(`mmj_questions_${subjectId}`, JSON.stringify(questions));
  } catch (e) {
    console.error('CacheQuestions failed:', e);
  }
}

export function getCachedQuestions(subjectId: string): any[] {
  try {
    const raw = Taro.getStorageSync(`mmj_questions_${subjectId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
