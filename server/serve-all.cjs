// 极简一体化服务器 — API + 静态文件
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DIST = path.join(__dirname, '..', 'dist');
const DATA = path.join(__dirname, '..', 'data');

// MIME types
const MIME = { '.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2' };

// 数据存储（内存）
let metrics = loadJSON(path.join(DATA, 'metrics.json'), []);
let feedbacks = loadJSON(path.join(DATA, 'feedback.json'), []);
let users = loadJSON(path.join(DATA, 'users.json'), {});
let codes = {}; // 验证码 { phone: { code, expires } }

function loadJSON(p, def) { try { return JSON.parse(fs.readFileSync(p,'utf-8')); } catch(e) { return def; } }
function saveJSON(p, d) { fs.writeFileSync(p, JSON.stringify(d), 'utf-8'); }
function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  res.setHeader('Content-Type', MIME[ext] || 'text/plain');
  try { res.end(fs.readFileSync(filePath)); } catch(e) { res.statusCode = 404; res.end('Not found'); }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  // API路由
  if (p === '/api/metrics' && req.method === 'POST') {
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      try { const { events } = JSON.parse(body); events.forEach(e => { e.serverTime = new Date().toISOString(); metrics.push(e); }); if (metrics.length > 10000) metrics.splice(0, metrics.length - 10000); saveJSON(path.join(DATA, 'metrics.json'), metrics); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ success: true })); } catch(e) { res.statusCode = 400; res.end(JSON.stringify({ error: e.message })); }
    }); return;
  }

  if (p === '/api/feedback' && req.method === 'POST') {
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      try { const fb = JSON.parse(body); fb.time = new Date().toISOString(); feedbacks.push(fb); saveJSON(path.join(DATA, 'feedback.json'), feedbacks); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ success: true })); } catch(e) { res.statusCode = 400; res.end(JSON.stringify({ error: e.message })); }
    }); return;
  }

  if (p === '/api/auth/send-code' && req.method === 'POST') {
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      try { const { phone } = JSON.parse(body); const code = String(Math.floor(100000 + Math.random() * 900000)); codes[phone] = { code, expires: Date.now() + 300000 }; console.log(`[验证码] ${phone} → ${code}`); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ success: true })); } catch(e) { res.statusCode = 400; res.end(JSON.stringify({ error: e.message })); }
    }); return;
  }

  if (p === '/api/auth/login-phone' && req.method === 'POST') {
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      try { const { phone, code } = JSON.parse(body); const c = codes[phone]; if (!c || c.code !== code || Date.now() > c.expires) { res.statusCode = 401; res.end(JSON.stringify({ error: '验证码错误或已过期' })); return; } delete codes[phone]; const user = users[phone] || (users[phone] = { phone, nickName: phone.slice(-4), membershipTier: 'vip', createdAt: new Date().toISOString() }); const token = Buffer.from(JSON.stringify({ phone, ts: Date.now() })).toString('base64'); user.token = token; saveJSON(path.join(DATA, 'users.json'), users); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ success: true, user: { phone: user.phone, nickName: user.nickName, membershipTier: user.membershipTier }, token })); } catch(e) { res.statusCode = 400; res.end(JSON.stringify({ error: e.message })); }
    }); return;
  }

  if (p === '/api/health') {
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({ status:'ok', totalEvents: metrics.length, uptime: process.uptime() }));
    return;
  }

  if (p === '/admin') {
    res.setHeader('Content-Type','text/html;charset=utf-8');
    res.end(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>慢慢记·管理后台</title><style>body{font-family:system-ui;background:#0f172a;color:#e2e8f0;max-width:900px;margin:0 auto;padding:24px}h1{color:#38bdf8}a{color:#38bdf8}</style></head><body><h1>📊 管理后台</h1><p>总事件: ${metrics.length} | 反馈: ${feedbacks.length} | 用户: ${Object.keys(users).length}</p><p><a href="/">← 返回首页</a></p></body></html>`);
    return;
  }

  // 静态文件（从 dist/ 目录）
  let filePath = path.join(DIST, p === '/' ? 'index.html' : p);
  if (!fs.existsSync(filePath)) filePath = path.join(DIST, 'index.html'); // SPA fallback
  serveFile(res, filePath);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 慢慢记 已启动: http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api/health`);
  console.log(`   管理: http://localhost:${PORT}/admin\n`);
});
