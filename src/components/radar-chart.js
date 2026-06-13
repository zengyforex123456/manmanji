// R13: Canvas雷达图 — 章节掌握度可视化 (增强版)
// 贝叶斯平滑: <50题="学习中"; ≥50: (答对数+5*0.65)/(总数+5)
// 章节按tier着色: 核心(红)/高频(黄)/基础(灰)

import { Analytics } from '../services/analytics.js';
import { State } from '../core/state.js';
import { DB } from '../core/db.js';

const TIER_COLORS = { 1: '#dc2626', 2: '#f59e0b', 3: '#64748b' };
const TIER_LABELS = { 1: '核心', 2: '高频', 3: '基础' };

export async function renderRadarChart() {
  const container = document.getElementById('radar-container');
  if (!container) return;

  // 获取章节进度（含tier信息）
  const sid = State.getActiveSubjectId();
  const progress = await DB.getProgress(sid);
  const questions = await DB.getQuestionsBySubject(sid);

  // 按章节聚合
  const chMap = {};
  progress.forEach(p => {
    const ch = p.chapter || 0;
    if (ch === 0) return;
    if (!chMap[ch]) chMap[ch] = { correct: 0, total: 0, tier: 3 };
    chMap[ch].total++;
    if (p.wrongCount === 0) chMap[ch].correct++;
  });

  // 获取tier信息
  try {
    const metaModule = await import('../data/subjects-meta.js');
    const meta = metaModule.getSubjectMeta(sid);
    if (meta?.chapters) {
      meta.chapters.forEach(c => {
        if (chMap[c.id]) chMap[c.id].tier = c.tier || 3;
      });
    }
  } catch (e) {}

  const totalQuestions = progress.length;
  const chapters = Object.entries(chMap)
    .map(([id, data]) => ({
      name: `第${id}章`,
      id: parseInt(id),
      ...data,
      mastery: totalQuestions >= 50
        ? Math.round((data.correct + 5 * 0.65) / (data.total + 5) * 100)
        : null,
    }))
    .sort((a, b) => a.id - b.id);

  if (chapters.length < 3) {
    container.innerHTML = `<div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">
      📊 需要≥3个章节数据<br><span style="font-size:11px;">当前仅有${chapters.length}章，继续刷题解锁雷达图</span>
    </div>`;
    return;
  }

  // Canvas
  const canvas = document.createElement('canvas');
  canvas.width = 340; canvas.height = 340;
  canvas.style.cssText = 'display:block;margin:0 auto;max-width:100%;';
  const ctx = canvas.getContext('2d');
  const cx = 170, cy = 170, radius = 120;
  const n = chapters.length;
  const angleStep = (Math.PI * 2) / n;

  // 背景网格
  [0.25, 0.5, 0.75, 1.0].forEach(scale => {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = i * angleStep - Math.PI / 2;
      const x = cx + radius * scale * Math.cos(a);
      const y = cy + radius * scale * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = scale === 1 ? '#cbd5e1' : '#e2e8f0';
    ctx.lineWidth = scale === 1 ? 1.5 : 0.5;
    ctx.stroke();
  });

  // 轴线
  chapters.forEach((_, i) => {
    const a = i * angleStep - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + radius * Math.cos(a), cy + radius * Math.sin(a));
    ctx.strokeStyle = '#e2e8f0';
    ctx.stroke();
  });

  // 数据多边形
  ctx.beginPath();
  chapters.forEach((ch, i) => {
    const v = ch.mastery !== null ? ch.mastery / 100 : 0.05;
    const r = radius * Math.max(0.05, v);
    const a = i * angleStep - Math.PI / 2;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = totalQuestions >= 50 ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.08)';
  ctx.fill();
  ctx.strokeStyle = totalQuestions >= 50 ? '#10b981' : '#94a3b8';
  ctx.lineWidth = 2;
  ctx.setLineDash(totalQuestions >= 50 ? [] : [4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // 标签
  chapters.forEach((ch, i) => {
    const a = i * angleStep - Math.PI / 2;
    const labelR = radius + 24;
    const x = cx + labelR * Math.cos(a);
    const y = cy + labelR * Math.sin(a) + 4;
    ctx.font = 'bold 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = TIER_COLORS[ch.tier] || '#64748b';
    const name = ch.name.length > 5 ? ch.name.substring(0, 4) + '..' : ch.name;
    ctx.fillText(name, x, y);
    // 小点标注tier
    ctx.beginPath();
    ctx.arc(x, y - 8, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = TIER_COLORS[ch.tier] || '#64748b';
    ctx.fill();
  });

  // 中心文字
  ctx.font = 'bold 20px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  if (totalQuestions >= 50) {
    const avgMastery = Math.round(chapters.reduce((s, c) => s + (c.mastery || 0), 0) / chapters.length);
    ctx.fillStyle = avgMastery >= 60 ? '#10b981' : avgMastery >= 40 ? '#f59e0b' : '#dc2626';
    ctx.fillText(avgMastery + '%', cx, cy - 4);
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('综合掌握度', cx, cy + 14);
  } else {
    ctx.fillText('📚', cx, cy - 6);
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`学习中(${totalQuestions}/50)`, cx, cy + 14);
  }

  container.innerHTML = '';
  container.appendChild(canvas);

  // 图例
  const legend = document.createElement('div');
  legend.style.cssText = 'display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:8px;font-size:11px;';
  legend.innerHTML = Object.entries(TIER_COLORS).map(([tier, color]) =>
    `<span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${color};"></span> ${TIER_LABELS[tier]}</span>`
  ).join('');
  container.appendChild(legend);

  // 章节明细表
  const table = document.createElement('div');
  table.style.cssText = 'margin-top:8px;font-size:11px;color:#64748b;text-align:center;';
  table.innerHTML = chapters.map(c =>
    `<span style="margin:0 6px;white-space:nowrap;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${TIER_COLORS[c.tier]};margin-right:2px;"></span>${c.name.substring(0,4)}: <b style="color:${c.mastery!==null?(c.mastery>=60?'#10b981':c.mastery>=40?'#f59e0b':'#dc2626'):'#94a3b8'}">${c.mastery !== null ? c.mastery+'%' : '学习中'}</b></span>`
  ).join('');
  container.appendChild(table);
}

// 全局挂载
window.renderRadarChart = renderRadarChart;
