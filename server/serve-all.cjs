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
    // 读取最新分析报告
    const analysisDir = path.join(__dirname, '..', 'docs', 'analysis');
    const marketingDir = path.join(__dirname, '..', 'docs', 'marketing');
    const readLatest = (dir) => { try { const files = fs.readdirSync(dir).filter(f=>f.endsWith('.md')).sort().reverse(); return files.length>0?fs.readFileSync(path.join(dir,files[0]),'utf-8').substring(0,3000):''; } catch(e) { return ''; } };
    const userReport = readLatest(analysisDir);
    const mktReport = readLatest(marketingDir);
    const totalEvents = metrics.length;
    const answers = metrics.filter(e=>e.event==='question_answered');
    const correctRate = answers.length>0 ? (answers.filter(a=>a.data?.correct).length/answers.length*100).toFixed(1) : 'N/A';

    res.setHeader('Content-Type','text/html;charset=utf-8');
    res.end(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>极简智考·智策分析后台</title>
<style>:root{--bg:#0b1120;--card:#111827;--border:#1e293b;--text:#e2e8f0;--muted:#64748b;--primary:#38bdf8;--success:#10b981;--warn:#f59e0b}
*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui;background:var(--bg);color:var(--text);max-width:1100px;margin:0 auto;padding:24px}
h1{color:var(--primary);font-size:22px;margin-bottom:4px}h2{font-size:16px;margin:20px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--border)}
.subtitle{color:var(--muted);font-size:13px;margin-bottom:20px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px}
.stat{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px;text-align:center}
.stat-val{font-size:26px;font-weight:800;color:var(--primary)}.stat-label{font-size:11px;color:var(--muted);margin-top:4px}
.report{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:16px;max-height:400px;overflow:auto;font-size:13px;line-height:1.6;white-space:pre-wrap}
a{color:var(--primary)}.btn{display:inline-block;padding:8px 16px;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none;margin:4px;background:var(--card);border:1px solid var(--border);color:var(--text)}.btn-primary{background:#1d4ed8;border-color:#1d4ed8;color:#fff}
</style></head><body>
<h1>📊 极简智考 · 智策分析后台</h1><p class="subtitle">实时数据 + AI分析报告 | ${new Date().toLocaleString('zh-CN')}</p>
<div class="stats">
  <div class="stat"><div class="stat-val">${totalEvents}</div><div class="stat-label">总事件</div></div>
  <div class="stat"><div class="stat-val">${answers.length}</div><div class="stat-label">总答题</div></div>
  <div class="stat"><div class="stat-val">${correctRate}%</div><div class="stat-label">正确率</div></div>
  <div class="stat"><div class="stat-val">${feedbacks.length}</div><div class="stat-label">用户反馈</div></div>
  <div class="stat"><div class="stat-val">${Object.keys(users).filter(k=>k!=='test').length}</div><div class="stat-label">用户数</div></div>
</div>
<div style="margin-bottom:16px">
  <a href="/" class="btn">← 返回首页</a>
  <a href="/admin?refresh=1" class="btn btn-primary">🔄 刷新分析</a>
</div>
<h2>📈 用户分析报告</h2>
<div class="report">${userReport||'暂无报告 — 运行 npm run analyze 生成'}</div>
<h2>📢 营销分析报告</h2>
<div class="report">${mktReport||'暂无报告'}</div>
</body></html>`);
    return;
  }

  // 静态文件（从 dist/ 目录）
  let filePath = path.join(DIST, p === '/' ? 'index.html' : p);
  if (!fs.existsSync(filePath)) filePath = path.join(DIST, 'index.html'); // SPA fallback
  serveFile(res, filePath);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 极简智考 已启动: http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api/health`);
  console.log(`   管理: http://localhost:${PORT}/admin\n`);
});
