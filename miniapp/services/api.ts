// 小程序 API 服务 — 对接职考通后端
import Taro from '@tarojs/taro';

const API_BASE = 'https://你的域名.com';  // 部署后改为实际域名
// 开发阶段使用: const API_BASE = 'http://localhost:3010';

export interface Question {
  id: string; type: string; stem: string; options: string[];
  answer: string; analysis: string; mnemonic: string;
  chapter: number; difficulty: number; tags: string[];
}

// 获取题库
export async function fetchQuestions(subjectId: string, limit = 200): Promise<Question[]> {
  try {
    const res = await Taro.request({
      url: `${API_BASE}/api/questions/${subjectId}?limit=${limit}`,
      method: 'GET',
      timeout: 10000,
    });
    if (res.statusCode === 200 && res.data) {
      return (res.data as any).questions || [];
    }
  } catch (e) {
    console.warn('[API] fetchQuestions failed, using cache:', e);
  }
  // 降级：本地缓存
  try {
    const cached = Taro.getStorageSync('mmj_questions');
    return cached ? JSON.parse(cached) : [];
  } catch { return []; }
}

// 获取科目列表
export async function fetchSubjects() {
  try {
    const res = await Taro.request({
      url: `${API_BASE}/api/subjects`,
      method: 'GET',
      timeout: 5000,
    });
    if (res.statusCode === 200) return (res.data as any).subjects || [];
  } catch (e) { console.warn('[API] fetchSubjects failed:', e); }
  return [];
}

// 提交答题记录
export async function submitAnswer(data: {
  questionId: string; mode: string; correct: boolean;
  subjectId: string; timeSpent?: number;
}) {
  try {
    await Taro.request({
      url: `${API_BASE}/api/metrics`,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { events: [{ event: 'question_answered', data, timestamp: Date.now() }] },
      timeout: 3000,
    });
  } catch (e) { /* 静默失败，本地优先 */ }
}

// 发送反馈
export async function submitFeedback(text: string, type = '建议') {
  try {
    await Taro.request({
      url: `${API_BASE}/api/feedback`,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { text, type, user: 'wechat_miniapp' },
      timeout: 3000,
    });
  } catch (e) { /* 静默失败 */ }
}

// 登录
export async function loginWithWechat() {
  try {
    const { code } = await Taro.login();
    const res = await Taro.request({
      url: `${API_BASE}/api/auth/login-wechat`,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { code },
      timeout: 10000,
    });
    if (res.statusCode === 200 && (res.data as any).success) {
      const { token, user } = res.data as any;
      Taro.setStorageSync('mmj_token', token);
      Taro.setStorageSync('mmj_user', user);
      return { token, user };
    }
  } catch (e) { console.warn('[API] login failed:', e); }
  return null;
}

// 获取用户信息（已登录）
export function getUser() {
  try { return Taro.getStorageSync('mmj_user') || null; } catch { return null; }
}

export function getToken() {
  try { return Taro.getStorageSync('mmj_token') || ''; } catch { return ''; }
}
