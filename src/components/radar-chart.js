// R13: Canvas雷达图 — 章节掌握度可视化
// 贝叶斯平滑: <50题="学习中"; ≥50: (答对数+5*0.65)/(总数+5)

import { Analytics } from '../services/analytics.js';
import { State } from '../core/state.js';

export async function renderRadarChart() {
  const { modules } = await Analytics.identifyWeakAreas();

  const container = document.getElementById('radar-container');
  if (!container) return;

  if (modules.length === 0 || modules.every(m => m.mastery === null)) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-secondary);font-size:13px">答题量不足（每模块需≥50题）<br>继续刷题后查看雷达图</div>';
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 280;
  canvas.height = 280;
  canvas.style.display = 'block';
  canvas.style.margin = '0 auto';
  container.innerHTML = '';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cx = 140, cy = 140, radius = 110;
  const count = modules.length;
  const angleStep = (Math.PI * 2) / count;

  // 背景网格
  for (let r = 1; r <= 4; r++) {
    ctx.beginPath();
    for (let i = 0; i <= count; i++) {
      const a = i * angleStep - Math.PI / 2;
      const x = cx + radius * (r / 4) * Math.cos(a);
      const y = cy + radius * (r / 4) * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = '#e2e8f0';
    ctx.stroke();
  }

  // 轴线
  for (let i = 0; i < count; i++) {
    const a = i * angleStep - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + radius * Math.cos(a), cy + radius * Math.sin(a));
    ctx.strokeStyle = '#e2e8f0';
    ctx.stroke();
  }

  // 数据多边形
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const m = modules[i];
    const v = m.mastery !== null ? m.mastery / 100 : 0;
    const r = radius * Math.max(0.1, v);
    const a = i * angleStep - Math.PI / 2;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(15, 118, 110, 0.15)';
  ctx.fill();
  ctx.strokeStyle = '#0f766e';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 标签
  ctx.font = '11px Inter, Microsoft YaHei, sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < count; i++) {
    const m = modules[i];
    const a = i * angleStep - Math.PI / 2;
    const labelR = radius + 28;
    const x = cx + labelR * Math.cos(a);
    const y = cy + labelR * Math.sin(a) + 4;
    ctx.fillStyle = '#475569';
    ctx.fillText(m.name, x, y);

    // 数值
    const numR = radius + 12;
    const nx = cx + numR * Math.cos(a);
    const ny = cy + numR * Math.sin(a) - 6;
    ctx.font = 'bold 10px Inter, Microsoft YaHei, sans-serif';
    ctx.fillStyle = '#0f766e';
    ctx.fillText(m.mastery !== null ? m.mastery + '%' : '学习中', nx, ny);
  }

  // 图例
  const legend = document.createElement('div');
  legend.style.textAlign = 'center';
  legend.style.marginTop = '8px';
  legend.style.fontSize = '12px';
  legend.style.color = 'var(--text-secondary)';
  legend.innerHTML = modules.map(m =>
    `<span style="margin:0 6px">${m.name}: <b style="color:var(--accent)">${m.mastery !== null ? m.mastery + '%' : '学习中'}</b></span>`
  ).join('');
  container.appendChild(legend);
}
