// server/index.js — 慢慢记题库管理API
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
const PORT = process.env.API_PORT || 3001;
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

// 内存存储（MVP阶段，后续迁MongoDB）
const users = new Map(); // phone -> { phone, wechatOpenId, nickName, createdAt, membershipTier }
const codes = new Map(); // phone -> { code, expires }

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
    users.set(phone, user);
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
    users.set(phone, user);
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

// ─── 启动 ───
app.listen(PORT, () => {
  console.log(`\n📚 慢慢记题库API 已启动`);
  console.log(`   地址: http://localhost:${PORT}`);
  console.log(`   鉴权: ${AUTH_ENABLED ? '已启用 (x-api-key)' : '已关闭（开发模式，免鉴权）'}`);
  console.log(`   健康检查: http://localhost:${PORT}/api/health\n`);
});
