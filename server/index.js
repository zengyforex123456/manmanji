// server/index.js — 职考通题库管理API
// 启动: node server/index.js
// 端口: 3001 (开发) / process.env.PORT (生产)
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'public', 'data');
const PORT = process.env.API_PORT || 3010;
const AUTH_ENABLED = process.env.MM_API_KEY ? true : false;
const API_KEY = process.env.MM_API_KEY || '';

const app = express();

// ─── 中间件 ───
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ─── 鉴权中间件（生产环境启用） ───
function auth(req, res, next) {
  if (!AUTH_ENABLED) return next(); // 开发模式：免鉴权
  const key = req.headers['x-api-key'];
  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: '未授权：缺少有效的 x-api-key' });
  }
  next();
}

// ─── 日志 ───
function log(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[API] ${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`);
  });
  next();
}

app.use(log);

// ─── 题库查询 ───

// 获取某科题目总数
app.get('/api/questions/:subjectId/count', (req, res) => {
  const { subjectId } = req.params;
  const file = path.join(DATA_DIR, subjectId, 'questions.json');
  if (!fs.existsSync(file)) {
    return res.json({ subjectId, count: 0, message: '题库文件不存在' });
  }
  try {
    const questions = JSON.parse(fs.readFileSync(file, 'utf-8'));
    res.json({ subjectId, count: questions.length });
  } catch (e) {
    res.status(500).json({ error: '读取题库失败: ' + e.message });
  }
});

// 分页查询题目
app.get('/api/questions/:subjectId', (req, res) => {
  const { subjectId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
  const chapter = req.query.chapter ? parseInt(req.query.chapter) : null;
  const type = req.query.type || null;
  const difficulty = req.query.difficulty ? parseInt(req.query.difficulty) : null;

  const file = path.join(DATA_DIR, subjectId, 'questions.json');
  if (!fs.existsSync(file)) {
    return res.json({ subjectId, questions: [], total: 0, page, limit });
  }

  try {
    let questions = JSON.parse(fs.readFileSync(file, 'utf-8'));

    // 过滤
    if (chapter) questions = questions.filter(q => q.chapter === chapter);
    if (type) questions = questions.filter(q => q.type === type);
    if (difficulty) questions = questions.filter(q => q.difficulty === difficulty);

    const total = questions.length;
    const start = (page - 1) * limit;
    const paged = questions.slice(start, start + limit);

    res.json({
      subjectId,
      questions: paged,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e) {
    res.status(500).json({ error: '读取题库失败: ' + e.message });
  }
});

// 获取所有科目元数据
app.get('/api/subjects', (req, res) => {
  const file = path.join(DATA_DIR, 'subjects.json');
  if (!fs.existsSync(file)) {
    return res.json({ subjects: [] });
  }
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    // 统计各科实际题量
    const subjects = data.subjects.map(s => {
      const qFile = path.join(DATA_DIR, s.id, 'questions.json');
      let count = s.questionCount || 0;
      if (fs.existsSync(qFile)) {
        try {
          count = JSON.parse(fs.readFileSync(qFile, 'utf-8')).length;
        } catch (e) { /* keep default */ }
      }
      return { ...s, questionCount: count };
    });
    res.json({ version: data.version, subjects });
  } catch (e) {
    res.status(500).json({ error: '读取科目元数据失败: ' + e.message });
  }
});

// ─── 题库上传（需鉴权） ───

// 批量上传题目
app.post('/api/questions/batch', auth, (req, res) => {
  const { subjectId, questions } = req.body;

  // 参数验证
  if (!subjectId) {
    return res.status(400).json({ error: '缺少 subjectId 参数' });
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'questions 必须是非空数组' });
  }

  const subjDir = path.join(DATA_DIR, subjectId);

  // 确保目录存在
  if (!fs.existsSync(subjDir)) {
    fs.mkdirSync(subjDir, { recursive: true });
  }

  const file = path.join(subjDir, 'questions.json');
  let existing = [];

  // 读取已有题目
  if (fs.existsSync(file)) {
    try {
      existing = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (e) {
      return res.status(500).json({ error: '读取已有题库失败: ' + e.message });
    }
  }

  const existingIds = new Set(existing.map(q => q.id));
  const existingStems = new Set(existing.map(q => q.stem?.trim()));

  let inserted = 0;
  let duplicated = 0;
  const errors = [];

  // 验证并插入
  const validQuestions = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];

    // 字段验证
    const missingFields = [];
    if (!q.id) missingFields.push('id');
    if (!q.stem) missingFields.push('stem');
    if (!Array.isArray(q.options) || q.options.length < 2) missingFields.push('options');
    if (!q.answer) missingFields.push('answer');
    if (!q.type) missingFields.push('type');

    if (missingFields.length > 0) {
      errors.push({ index: i, id: q.id || '(无)', error: `缺少字段: ${missingFields.join(', ')}` });
      continue;
    }

    // 类型校验
    if (!['single', 'multiple', 'case'].includes(q.type)) {
      errors.push({ index: i, id: q.id, error: `无效题型: ${q.type}，应为 single/multiple/case` });
      continue;
    }

    // 去重检查（ID + 题干相似度）
    if (existingIds.has(q.id)) {
      duplicated++;
      continue;
    }

    // 题干去重（完全相同）
    if (existingStems.has(q.stem.trim())) {
      duplicated++;
      continue;
    }

    // 标准化字段
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
      source: q.source || '',
    };

    existingIds.add(q.id);
    existingStems.add(q.stem.trim());
    validQuestions.push(normalized);
    inserted++;
  }

  // 合并并写入
  const merged = [...existing, ...validQuestions];
  fs.writeFileSync(file, JSON.stringify(merged, null, 2), 'utf-8');

  // 更新 subjects.json 题量
  updateSubjectCount(subjectId, merged.length);

  res.json({
    success: true,
    subjectId,
    inserted,
    duplicated,
    errors: errors.length > 0 ? errors : undefined,
    beforeCount: existing.length,
    afterCount: merged.length,
  });
});

// 单题更新（PATCH）
app.patch('/api/questions/:questionId', auth, (req, res) => {
  const { questionId } = req.params;
  const { subjectId, ...updates } = req.body;

  if (!subjectId) {
    return res.status(400).json({ error: '缺少 subjectId' });
  }

  const file = path.join(DATA_DIR, subjectId, 'questions.json');
  if (!fs.existsSync(file)) {
    return res.status(404).json({ error: '题库文件不存在' });
  }

  try {
    const questions = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const idx = questions.findIndex(q => q.id === questionId);
    if (idx === -1) {
      return res.status(404).json({ error: '题目不存在' });
    }

    questions[idx] = { ...questions[idx], ...updates };
    fs.writeFileSync(file, JSON.stringify(questions, null, 2), 'utf-8');
    res.json({ success: true, question: questions[idx] });
  } catch (e) {
    res.status(500).json({ error: '更新失败: ' + e.message });
  }
});

// ─── 辅助函数 ───
function updateSubjectCount(subjectId, count) {
  const file = path.join(DATA_DIR, 'subjects.json');
  if (!fs.existsSync(file)) return;
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const subj = data.subjects.find(s => s.id === subjectId);
    if (subj) {
      subj.questionCount = count;
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    }
  } catch (e) {
    console.error('[API] 更新题量失败:', e.message);
  }
}

// ─── 账号体系（R44-R46） ───

// JSON文件持久化存储
const DATA_FILE = path.join(__dirname, '..', 'data', 'users.json');
const PROGRESS_FILE = path.join(__dirname, '..', 'data', 'progress.json');

function loadJSON(file, fallback = {}) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch(e) { console.error(`Load ${file} failed:`, e.message); }
  return fallback;
}
function saveJSON(file, data) {
  try {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  } catch(e) { console.error(`Save ${file} failed:`, e.message); }
}

const users = new Map(Object.entries(loadJSON(DATA_FILE, {})));
const codes = new Map();
const progressData = loadJSON(PROGRESS_FILE, {});
function persistUsers() { saveJSON(DATA_FILE, Object.fromEntries(users)); }
function persistProgress() {
  if (typeof progressStore !== 'undefined') saveJSON(PROGRESS_FILE, Object.fromEntries(progressStore));
}

// 发送验证码（开发模式：打印到控制台）
app.post('/api/auth/send-code', (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^1\d{10}$/.test(phone)) {
    return res.status(400).json({ error: '手机号格式不正确' });
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  codes.set(phone, { code, expires: Date.now() + 300000 }); // 5分钟有效
  console.log(`\n📱 [验证码] ${phone} → ${code}\n`);
  res.json({ success: true, message: '验证码已发送（开发模式：查看控制台）' });
});

// 手机号登录
app.post('/api/auth/login-phone', (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) {
    return res.status(400).json({ error: '缺少手机号或验证码' });
  }
  const record = codes.get(phone);
  if (!record || record.code !== code || record.expires < Date.now()) {
    return res.status(401).json({ error: '验证码错误或已过期' });
  }
  codes.delete(phone);

  let user = users.get(phone);
  if (!user) {
    user = {
      phone,
      nickName: '考友' + phone.slice(-4),
      createdAt: new Date().toISOString(),
      membershipTier: 'vip', // MVP演示通卡
    };
    users.set(phone, user); persistUsers();
  }
  const token = Buffer.from(JSON.stringify({ phone, ts: Date.now() })).toString('base64');
  user.token = token;
  res.json({ success: true, user: { phone: user.phone, nickName: user.nickName, membershipTier: user.membershipTier }, token });
});

// 微信登录（模拟）
app.post('/api/auth/login-wechat', (req, res) => {
  const { code } = req.body; // 微信OAuth code
  // MVP阶段：模拟微信登录
  const mockOpenId = 'wechat_' + (code || 'mock_' + Date.now());
  const phone = 'wx_' + mockOpenId.slice(-8);

  let user = Array.from(users.values()).find(u => u.wechatOpenId === mockOpenId);
  if (!user) {
    user = {
      phone,
      wechatOpenId: mockOpenId,
      nickName: '微信用户',
      createdAt: new Date().toISOString(),
      membershipTier: 'vip',
    };
    users.set(phone, user); persistUsers();
  }
  const token = Buffer.from(JSON.stringify({ phone, ts: Date.now() })).toString('base64');
  user.token = token;
  res.json({ success: true, user: { phone: user.phone, nickName: user.nickName, membershipTier: user.membershipTier }, token });
});

// 获取用户信息
app.get('/api/auth/profile', (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未登录' });
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    const user = users.get(decoded.phone);
    if (!user) return res.status(401).json({ error: '用户不存在' });
    res.json({ phone: user.phone, nickName: user.nickName, membershipTier: user.membershipTier });
  } catch (e) {
    res.status(401).json({ error: 'token无效' });
  }
});

// ─── 邮箱验证码 ───
app.post('/api/auth/send-email-code', (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: '邮箱格式不正确' });
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  codes.set('email:' + email, { code, expires: Date.now() + 300000 });
  console.log(`\n📧 [邮箱验证码] ${email} → ${code}\n`);
  res.json({ success: true, message: '验证码已发送到邮箱（开发模式：查看控制台）' });
});

app.post('/api/auth/login-email', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: '缺少邮箱或验证码' });
  const record = codes.get('email:' + email);
  if (!record || record.code !== code || record.expires < Date.now()) {
    return res.status(401).json({ error: '验证码错误或已过期' });
  }
  codes.delete('email:' + email);
  const key = 'email:' + email;
  let user = users.get(key);
  if (!user) {
    user = { email, phone: key, nickName: email.split('@')[0], createdAt: new Date().toISOString(), membershipTier: 'vip' };
    users.set(key, user);
    persistUsers();
  }
  const token = Buffer.from(JSON.stringify({ phone: key, ts: Date.now() })).toString('base64');
  user.token = token;
  res.json({ success: true, user: { email: user.email, nickName: user.nickName, membershipTier: user.membershipTier }, token });
});

// ─── 账号密码注册 ───
function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd + 'zhikaotong-salt').digest('hex');
}

app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || username.length < 3) return res.status(400).json({ error: '用户名至少3个字符' });
  if (!password || password.length < 6) return res.status(400).json({ error: '密码至少6个字符' });
  const key = 'user:' + username;
  if (users.has(key)) return res.status(409).json({ error: '用户名已存在' });
  const user = {
    username, phone: key, passwordHash: hashPassword(password),
    nickName: username, createdAt: new Date().toISOString(), membershipTier: 'vip',
  };
  users.set(key, user);
  persistUsers();
  const token = Buffer.from(JSON.stringify({ phone: key, ts: Date.now() })).toString('base64');
  user.token = token;
  res.json({ success: true, user: { username: user.username, nickName: user.nickName, membershipTier: user.membershipTier }, token });
});

app.post('/api/auth/login-password', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '请输入用户名和密码' });
  const key = 'user:' + username;
  const user = users.get(key);
  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const token = Buffer.from(JSON.stringify({ phone: key, ts: Date.now() })).toString('base64');
  user.token = token;
  res.json({ success: true, user: { username: user.username, nickName: user.nickName, membershipTier: user.membershipTier }, token });
});

// ─── R46: 进度云端同步 ───
const progressStore = new Map(Object.entries(loadJSON(PROGRESS_FILE, {})));

app.put('/api/progress/:subjectId', (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未登录' });
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    const { subjectId } = req.params;
    const { progress } = req.body;
    if (!Array.isArray(progress)) return res.status(400).json({ error: 'progress必须为数组' });
    const key = decoded.phone + '_' + subjectId;
    const existing = progressStore.get(key) || [];
    const merged = new Map();
    [...existing, ...progress].forEach(p => {
      const old = merged.get(p.questionId);
      if (!old || new Date(p.lastReview) > new Date(old.lastReview)) merged.set(p.questionId, p);
    });
    const result = Array.from(merged.values());
    progressStore.set(key, result); persistProgress();
    console.log(`[Sync] ${subjectId}: ${result.length} records`);
    res.json({ success: true, count: result.length });
  } catch (e) { res.status(401).json({ error: 'token无效' }); }
});

app.get('/api/progress/:subjectId', (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未登录' });
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    const key = decoded.phone + '_' + req.params.subjectId;
    const progress = progressStore.get(key) || [];
    res.json({ subjectId: req.params.subjectId, progress, count: progress.length });
  } catch (e) { res.status(401).json({ error: 'token无效' }); }
});

// ─── 埋点数据收集（持久化） ───
const METRICS_FILE = path.join(__dirname, '..', 'data', 'metrics.json');
const metricsStore = loadJSON(METRICS_FILE, []);
function persistMetrics() { saveJSON(METRICS_FILE, metricsStore); }

app.post('/api/metrics', (req, res) => {
  const { events } = req.body;
  if (!Array.isArray(events)) return res.status(400).json({ error: 'events必须为数组' });
  events.forEach(e => {
    e.serverTime = new Date().toISOString();
    metricsStore.push(e);
  });
  if (metricsStore.length > 10000) metricsStore.splice(0, metricsStore.length - 10000);
  persistMetrics();
  res.json({ received: events.length });
});

// ─── 用户反馈收集 ───
const FEEDBACK_FILE = path.join(__dirname, '..', 'data', 'feedback.json');
const feedbackStore = loadJSON(FEEDBACK_FILE, []);
app.post('/api/feedback', (req, res) => {
  const { text, type, user } = req.body;
  if (!text) return res.status(400).json({ error: '反馈内容不能为空' });
  feedbackStore.push({ text, type: type || '建议', user: user || '匿名', time: new Date().toISOString() });
  saveJSON(FEEDBACK_FILE, feedbackStore);
  res.json({ success: true, count: feedbackStore.length });
});

app.get('/api/metrics/summary', (req, res) => {
  const now = Date.now();
  const today = new Date().toDateString();
  const sessions = metricsStore.filter(e => e.event === 'session_start');
  const todaySessions = sessions.filter(e => new Date(e.serverTime).toDateString() === today);
  const registrations = metricsStore.filter(e => e.event === 'user_registered');
  const answers = metricsStore.filter(e => e.event === 'question_answered');
  const completions = metricsStore.filter(e => e.event === 'mode_completed');

  // 做题时长
  const totalTime = completions.reduce((s, e) => s + (e.data?.totalTime || 0), 0);
  const avgTime = completions.length > 0 ? Math.round(totalTime / completions.length / 60) : 0;

  // 错题Top10知识点
  const wrongTags = {};
  answers.filter(e => e.data?.correct === false).forEach(e => {
    const tags = e.data?.tags || [];
    tags.forEach(t => { wrongTags[t] = (wrongTags[t] || 0) + 1; });
  });
  const top10Wrong = Object.entries(wrongTags).sort((a,b) => b[1]-a[1]).slice(0,10).map(([tag,count]) => ({tag, count}));

  res.json({
    dau: todaySessions.length,
    totalSessions: sessions.length,
    registrations: registrations.length,
    answersRecorded: answers.length,
    avgQuizTimeMin: avgTime,
    completions: completions.length,
    top10Wrong,
  });
});

// ─── 健康检查 ───
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.5.0',
    subjects: getSubjectsSummary(),
  });
});

function getSubjectsSummary() {
  const file = path.join(DATA_DIR, 'subjects.json');
  if (!fs.existsSync(file)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return data.subjects.map(s => {
      const qFile = path.join(DATA_DIR, s.id, 'questions.json');
      let count = 0;
      if (fs.existsSync(qFile)) {
        count = JSON.parse(fs.readFileSync(qFile, 'utf-8')).length;
      }
      return { id: s.id, name: s.name, questionCount: count };
    });
  } catch (e) {
    return [];
  }
}

// ─── 管理后台 + 健康检查 ───
import { adminRouter } from './admin.mjs';
app.use('/admin', adminRouter);

import { healthRouter } from './health.mjs';
app.use('/health', healthRouter);

// ─── KAG 知识库 API ───
import { syncFilesToDB, queryKAG, kagSummary } from './kag-sync.js';
app.get('/api/kag/sync', async (req, res) => {
  try { const r = await syncFilesToDB(); res.json(r); } catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/kag/query', async (req, res) => {
  try { const r = await queryKAG(req.query); res.json(r); } catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/kag/summary', async (req, res) => {
  try { const r = await kagSummary(); res.json(r); } catch(e) { res.status(500).json({ error: e.message }); }
});
// 启动时自动同步
syncFilesToDB().then(r => console.log(`[KAG] 同步完成: ${r.synced}/${r.total} 实体入库`)).catch(e => console.warn('[KAG] 同步失败:', e.message));

// ─── 启动 ───
app.listen(PORT, () => {
  console.log(`\n📚 职考通题库API 已启动`);
  console.log(`   地址: http://localhost:${PORT}`);
  console.log(`   鉴权: ${AUTH_ENABLED ? '已启用 (x-api-key)' : '已关闭（开发模式，免鉴权）'}`);
  console.log(`   健康检查: http://localhost:${PORT}/api/health\n`);
});
