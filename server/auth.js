// server/auth.js — 账号体系 (JWT + SQLite)
// 注册·登录·token验证·VIP状态
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_EXPIRY = 7 * 24 * 3600 * 1000; // 7天

// ═══ 用户存储 (生产环境应换数据库) ═══
function loadUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8')); }
  catch(e) { return { users: [], tokens: {} }; }
}
function saveUsers(data) { fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2)); }

// ═══ JWT (简化版·生产应换jsonwebtoken库) ═══
function base64url(str) { return Buffer.from(str).toString('base64url'); }
function decode64url(str) { return Buffer.from(str, 'base64url').toString(); }

function sign(payload) {
  var header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  var body = base64url(JSON.stringify(Object.assign({}, payload, { iat: Date.now(), exp: Date.now() + TOKEN_EXPIRY })));
  var signature = crypto.createHmac('sha256', JWT_SECRET).update(header + '.' + body).digest('base64url');
  return header + '.' + body + '.' + signature;
}

function verify(token) {
  try {
    var parts = token.split('.');
    if (parts.length !== 3) return null;
    var expected = crypto.createHmac('sha256', JWT_SECRET).update(parts[0] + '.' + parts[1]).digest('base64url');
    if (expected !== parts[2]) return null;
    var payload = JSON.parse(decode64url(parts[1]));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch(e) { return null; }
}

// ═══ 密码哈希 ═══
function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  var hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { salt: salt, hash: hash };
}

function verifyPassword(password, salt, hash) {
  return hashPassword(password, salt).hash === hash;
}

// ═══ 注册 ═══
export function register(username, password) {
  if (!username || username.length < 2) return { error: '用户名至少2个字符' };
  if (!password || password.length < 6) return { error: '密码至少6个字符' };

  var data = loadUsers();
  if (data.users.find(function(u) { return u.username === username; })) {
    return { error: '用户名已存在' };
  }

  var id = 'u-' + crypto.randomBytes(4).toString('hex');
  var pwd = hashPassword(password);
  var user = {
    id: id, username: username, passwordHash: pwd.hash, passwordSalt: pwd.salt,
    membership: 'free', membershipExpiry: null, createdAt: new Date().toISOString(),
  };
  data.users.push(user);

  var token = sign({ userId: id, username: username, membership: 'free' });
  data.tokens = data.tokens || {};
  data.tokens[token] = { userId: id, createdAt: Date.now() };
  saveUsers(data);

  return { id: id, username: username, token: token, membership: 'free' };
}

// ═══ 登录 ═══
export function login(username, password) {
  var data = loadUsers();
  var user = data.users.find(function(u) { return u.username === username; });
  if (!user) return { error: '用户名或密码错误' };

  if (!verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    return { error: '用户名或密码错误' };
  }

  var token = sign({ userId: user.id, username: username, membership: user.membership || 'free' });
  data.tokens = data.tokens || {};
  data.tokens[token] = { userId: user.id, createdAt: Date.now() };
  saveUsers(data);

  return {
    id: user.id, username: user.username, token: token,
    membership: user.membership || 'free', membershipExpiry: user.membershipExpiry,
  };
}

// ═══ 验证token ═══
export function authenticate(token) {
  if (!token) return null;
  var payload = verify(token);
  if (!payload) return null;

  var data = loadUsers();
  var user = data.users.find(function(u) { return u.id === payload.userId; });
  if (!user) return null;

  return {
    userId: user.id, username: user.username,
    membership: user.membership || 'free', membershipExpiry: user.membershipExpiry,
  };
}

// ═══ 鉴权中间件 ═══
export function authMiddleware(req, res, next) {
  var token = req.headers.authorization || req.headers['x-auth-token'] || '';
  if (token.startsWith('Bearer ')) token = token.slice(7);

  var user = authenticate(token);
  if (!user) {
    req.user = null; // 未登录，允许继续
  } else {
    req.user = user;
  }
  next();
}

// ═══ 必须登录 ═══
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '请先登录' });
  next();
}

// ═══ 激活VIP ═══
export function activateVIP(userId, productId) {
  var data = loadUsers();
  var user = data.users.find(function(u) { return u.id === userId; });
  if (!user) return { error: '用户不存在' };

  user.membership = 'vip';
  // 有效期到考试日(11月第一个周六)
  var now = new Date();
  var nov = new Date(now.getFullYear(), 10, 1);
  var firstSat = 1 + (6 - nov.getDay() + 7) % 7;
  user.membershipExpiry = new Date(now.getFullYear(), 10, firstSat).toISOString();
  saveUsers(data);

  // 刷新所有token
  var token = sign({ userId: user.id, username: user.username, membership: 'vip' });
  data.tokens = data.tokens || {};
  data.tokens[token] = { userId: user.id, createdAt: Date.now() };
  saveUsers(data);

  return { id: user.id, membership: 'vip', expiry: user.membershipExpiry, token: token };
}

// ═══ 获取用户信息 ═══
export function getUser(userId) {
  var data = loadUsers();
  var user = data.users.find(function(u) { return u.id === userId; });
  if (!user) return null;
  return {
    id: user.id, username: user.username,
    membership: user.membership || 'free', membershipExpiry: user.membershipExpiry,
    createdAt: user.createdAt,
  };
}
