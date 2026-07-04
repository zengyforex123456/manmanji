/**
 * 智策管理后台 — 浏览器查看分析报告 + 下载数据
 * 在 server/index.js 中: import { adminRouter } from './admin.mjs'; app.use('/admin', adminRouter);
 * 访问: http://你的域名/admin
 */

import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.join(__dirname, '..', 'docs');
const DATA_DIR = path.join(__dirname, '..', 'data');
const SCRIPTS_DIR = path.join(__dirname, '..', 'scripts');

export const adminRouter = Router();

// ====== 1. 管理后台首页 ======
adminRouter.get('/', (req, res) => {
  const analysisDir = path.join(DOCS_DIR, 'analysis');
  const marketingDir = path.join(DOCS_DIR, 'marketing');

  const listFiles = (dir) => {
    try {
      return fs.readdirSync(dir).filter(f => f.endsWith('.md') && !f.startsWith('_')).sort().reverse();
    } catch (e) { return []; }
  };

  const analysisFiles = listFiles(analysisDir);
  const marketingFiles = listFiles(marketingDir);

  let dataSummary = {};
  try {
    const metrics = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'metrics.json'), 'utf-8'));
    const answers = metrics.filter(e => e.event === 'question_answered');
    const sessions = metrics.filter(e => e.event === 'session_start');
    const today = new Date();
    const todayAnswers = answers.filter(a => today - new Date(a.serverTime) < 86400000);

    dataSummary = {
      totalEvents: metrics.length,
      totalAnswers: answers.length,
      totalSessions: sessions.length,
      answersToday: todayAnswers.length,
      lastEvent: metrics.length > 0 ? metrics[metrics.length - 1].serverTime : '无数据',
      dataFreshness: metrics.length > 0
        ? Math.round((today - new Date(metrics[metrics.length - 1].serverTime)) / 3600000) + '小时前'
        : 'N/A',
    };
  } catch (e) {
    dataSummary = { error: e.message };
  }

  res.send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>极简智考 — 智策分析后台</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Inter, system-ui, sans-serif; background:#0f172a; color:#e2e8f0; min-height:100vh; }
  .container { max-width:900px; margin:0 auto; padding:24px; }
  h1 { font-size:24px; margin-bottom:8px; }
  h2 { font-size:18px; margin:24px 0 12px; padding-bottom:8px; border-bottom:1px solid #334155; }
  .subtitle { color:#94a3b8; font-size:14px; margin-bottom:24px; }
  .cards { display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-bottom:24px; }
  .card { background:#1e293b; border-radius:8px; padding:16px; }
  .card .value { font-size:28px; font-weight:700; color:#38bdf8; }
  .card .label { font-size:12px; color:#94a3b8; margin-top:4px; }
  .file-list { list-style:none; }
  .file-list li { padding:10px 0; border-bottom:1px solid #1e293b; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; }
  .file-list a { color:#38bdf8; text-decoration:none; font-size:14px; }
  .file-list a:hover { text-decoration:underline; }
  .file-list .date { color:#64748b; font-size:12px; }
  .action-bar { margin:16px 0; display:flex; flex-wrap:wrap; gap:8px; }
  .btn { display:inline-block; padding:8px 16px; border-radius:6px; font-size:13px; text-decoration:none; border:none; cursor:pointer; }
  .btn-primary { background:#1d4ed8; color:#fff; }
  .btn-secondary { background:#334155; color:#e2e8f0; }
  .btn-danger { background:#991b1b; color:#fff; }
  .btn-success { background:#166534; color:#4ade80; }
  .alert { padding:12px 16px; border-radius:6px; margin-bottom:16px; font-size:14px; }
  .alert-warn { background:#422006; color:#fbbf24; border-left:3px solid #f59e0b; }
  .alert-ok { background:#052e16; color:#4ade80; border-left:3px solid #22c55e; }
  .empty { color:#64748b; font-style:italic; padding:20px 0; }
  .footer { margin-top:40px; padding-top:16px; border-top:1px solid #1e293b; color:#475569; font-size:12px; }
</style>
</head>
<body>
<div class="container">
  <h1>📊 极简智考 · 智策分析后台</h1>
  <p class="subtitle">${new Date().toLocaleString('zh-CN', {timeZone:'Asia/Shanghai'})} · 数据驱动产品增长</p>

  <div class="cards">
    <div class="card"><div class="value">${dataSummary.totalEvents || 0}</div><div class="label">总事件数</div></div>
    <div class="card"><div class="value">${dataSummary.totalAnswers || 0}</div><div class="label">总答题数</div></div>
    <div class="card"><div class="value">${dataSummary.answersToday || 0}</div><div class="label">今日答题</div></div>
    <div class="card"><div class="value">${dataSummary.dataFreshness || 'N/A'}</div><div class="label">数据新鲜度</div></div>
  </div>

  ${dataSummary.answersToday === 0
    ? '<div class="alert alert-warn">⚠️  过去24小时无新答题事件 — 检查前端埋点</div>'
    : '<div class="alert alert-ok">✅ 数据管道正常，今日有答题</div>'}

  <div class="action-bar">
    <a href="/admin/reports/analysis" class="btn btn-primary">📈 用户分析</a>
    <a href="/admin/reports/marketing" class="btn btn-secondary">📢 营销分析</a>
    <a href="/admin/data/metrics" class="btn btn-secondary">⬇ metrics.json</a>
    <a href="/admin/data/feedback" class="btn btn-secondary">⬇ feedback.json</a>
    <a href="/admin/api/trigger-analysis" class="btn btn-success">🔄 立即分析</a>
    <a href="/health" class="btn btn-secondary">❤️ 健康检查</a>
  </div>

  <h2>📈 用户分析报告 (${analysisFiles.length}份)</h2>
  ${analysisFiles.length === 0 ? '<p class="empty">暂无 — 运行一次分析或等 cron 自动触发</p>'
    : '<ul class="file-list">' + analysisFiles.slice(0, 15).map(f => {
      const dateMatch = f.match(/(\d{4}-\d{2}-\d{2})/);
      const date = dateMatch ? dateMatch[1] : '';
      const filePath = path.join(analysisDir, f);
      const stat = fs.statSync(filePath);
      return `<li><a href="/admin/view/analysis/${f}">📄 ${f}</a><span class="date">${date} · ${(stat.size/1024).toFixed(1)}KB</span></li>`;
    }).join('') + '</ul>'}

  <h2>📢 营销分析报告 (${marketingFiles.length}份)</h2>
  ${marketingFiles.length === 0 ? '<p class="empty">暂无</p>'
    : '<ul class="file-list">' + marketingFiles.slice(0, 15).map(f => {
      return `<li><a href="/admin/view/marketing/${f}">📄 ${f}</a></li>`;
    }).join('') + '</ul>'}

  <div class="footer">智策(Zhice) v1.0 · ${new Date().toISOString()}</div>
</div>
</body>
</html>`);
});

// ====== 2. 查看报告内容（Markdown渲染） ======
adminRouter.get('/view/:category/:filename', (req, res) => {
  const { category, filename } = req.params;
  // 安全检查
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(403).send('Forbidden');
  }
  const filePath = path.join(DOCS_DIR, category, filename);
  if (!filePath.startsWith(DOCS_DIR)) return res.status(403).send('Forbidden');

  try {
    const md = fs.readFileSync(filePath, 'utf-8');

    // Markdown → HTML
    const html = md
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    // 简单表格处理：连续的行以 | 开头
    const lines = html.split('\n');
    let inTable = false;
    const result = [];
    for (const line of lines) {
      if (line.startsWith('|')) {
        if (!inTable) { result.push('<table>'); inTable = true; }
        const cells = line.split('|').filter(c => c.trim());
        if (cells.length === 0) continue;
        const tag = line.includes('---') ? 'th' : 'td';
        result.push('<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>');
      } else {
        if (inTable) { result.push('</table>'); inTable = false; }
        result.push(line);
      }
    }
    if (inTable) result.push('</table>');

    const styledHtml = result.join('\n');

    res.send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${filename}</title>
<style>
  body { font-family:Inter,system-ui,sans-serif; background:#0f172a; color:#e2e8f0; max-width:900px; margin:0 auto; padding:24px; line-height:1.7; }
  h1 { color:#38bdf8; font-size:22px; } h2 { color:#e2e8f0; font-size:18px; margin-top:32px; border-bottom:1px solid #334155; padding-bottom:8px; }
  h3 { color:#94a3b8; font-size:15px; margin-top:20px; }
  table { border-collapse:collapse; width:100%; margin:12px 0; font-size:13px; }
  th { background:#1e293b; color:#38bdf8; text-align:left; padding:8px; } td { padding:8px; border-bottom:1px solid #1e293b; }
  pre { background:#1e293b; padding:12px; border-radius:6px; overflow-x:auto; } code { background:#1e293b; padding:2px 6px; border-radius:3px; color:#4ade80; }
  ul { padding-left:20px; } li { margin:4px 0; }
  a { color:#38bdf8; } .back { display:inline-block; margin-bottom:24px; color:#94a3b8; }
</style></head>
<body><a href="/admin" class="back">← 返回后台</a><p>${styledHtml}</p></body></html>`);
  } catch (e) {
    res.status(404).send(`<h1>报告不存在</h1><p>${e.message}</p><a href="/admin">返回后台</a>`);
  }
});

// ====== 3. 报告列表 ======
adminRouter.get('/reports/:category', (req, res) => {
  const { category } = req.params;
  const dir = path.join(DOCS_DIR, category);
  try {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && !f.startsWith('_')).sort().reverse();
    res.send(`<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><title>${category}</title>
<style>body{font-family:Inter,system-ui;background:#0f172a;color:#e2e8f0;max-width:700px;margin:0 auto;padding:24px}a{color:#38bdf8}li{padding:8px 0;border-bottom:1px solid #1e293b}</style></head>
<body><h1>${category==='analysis'?'📈 用户分析':'📢 营销分析'} (${files.length}份)</h1>
<ul>${files.map(f=>'<li><a href="/admin/view/'+category+'/'+f+'">'+f+'</a></li>').join('')}</ul>
<p><a href="/admin">← 返回</a></p></body></html>`);
  } catch (e) { res.status(500).send('Error: ' + e.message); }
});

// ====== 4. 数据下载 ======
adminRouter.get('/data/:type', (req, res) => {
  const { type } = req.params;
  const files = { metrics: 'metrics.json', feedback: 'feedback.json', users: 'users.json' };
  const name = files[type];
  if (!name) return res.status(400).send('Unknown type');
  try {
    const data = fs.readFileSync(path.join(DATA_DIR, name), 'utf-8');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.send(data);
  } catch (e) { res.status(404).send('Not found'); }
});

// ====== 5. 手动触发分析 ======
adminRouter.get('/api/trigger-analysis', (req, res) => {
  try {
    const output = execSync(`node "${path.join(SCRIPTS_DIR, 'run-all-analysis.cjs')}"`, {
      encoding: 'utf-8', timeout: 30000, cwd: path.join(__dirname, '..')
    });
    res.json({ status: 'ok', output: output.trim(), time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'error', output: e.stderr || e.message });
  }
});
