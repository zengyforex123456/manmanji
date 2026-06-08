// src/components/ai-panel.js — AI面板注入器
import { Analytics } from '../services/analytics.js';
import { renderRadarChart } from './radar-chart.js';

export function injectAIPanels() {
  const container = document.getElementById('recent-section');
  if (!container) return;

  // AI学习分析
  const insights = document.createElement('div');
  insights.className = 'recent-section';
  insights.style.marginTop = '16px';
  insights.innerHTML = `
    <div class="section-title">🤖 AI学习分析</div>
    <div id="ai-insights-content" style="font-size:13px;color:var(--text-secondary);line-height:1.6">完成一组刷题后查看分析</div>
  `;
  container.after(insights);

  // 雷达图
  const radar = document.createElement('div');
  radar.className = 'recent-section';
  radar.style.marginTop = '16px';
  radar.innerHTML = '<div class="section-title">📊 章节掌握度</div><div id="radar-container"></div>';
  insights.after(radar);
  setTimeout(() => renderRadarChart(), 200);

  // 智能问答
  const qa = document.createElement('div');
  qa.className = 'recent-section';
  qa.style.marginTop = '16px';
  qa.innerHTML = `
    <div class="section-title">💡 智能问答</div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <input id="ai-query-input" type="text" placeholder="输入知识点关键词" style="flex:1;padding:8px 12px;border:1px solid var(--border-color);border-radius:6px;font-size:14px;font-family:var(--font-sans)">
      <button id="ai-ask-btn" class="mode-btn" style="white-space:nowrap">提问</button>
    </div>
    <div id="ai-answer" style="font-size:13px;color:var(--text-primary);margin-top:8px;line-height:1.6;display:none"></div>
  `;
  insights.after(qa);

  // 绑定事件
  document.getElementById('ai-ask-btn')?.addEventListener('click', () => {
    const q = document.getElementById('ai-query-input')?.value?.trim();
    const answerEl = document.getElementById('ai-answer');
    if (!q || !answerEl) return;
    const result = Analytics.askQuestion(q);
    answerEl.style.display = 'block';
    answerEl.innerHTML = `<strong>${result.source ? '📚 ' + result.source : '🤖 AI助手'}</strong><br>${result.answer.replace(/\n/g, '<br>')}`;
  });

  // 加载AI分析
  loadAIAnalysis();
}

async function loadAIAnalysis() {
  const el = document.getElementById('ai-insights-content');
  if (!el) return;
  try {
    const plan = await Analytics.getAdaptivePlan();
    if (plan.recommendations.length === 0) {
      el.innerHTML = '✅ 暂无特别建议，继续保持学习节奏！';
      return;
    }
    el.innerHTML = plan.recommendations.map(r => {
      const color = r.priority === 'urgent' ? '#dc2626' : r.priority === 'high' ? '#f59e0b' : '#22c55e';
      return `<div style="margin-bottom:6px;padding:6px 8px;background:var(--bg-pc);border-radius:6px;border-left:3px solid ${color}">
        <span style="font-weight:700">${r.priority === 'urgent' ? '🔴' : r.priority === 'high' ? '🟡' : '🟢'} ${r.action}</span>
      </div>`;
    }).join('') + `<div style="margin-top:8px;font-weight:600;color:var(--accent)">${plan.summary}</div>`;
  } catch (e) {
    el.innerHTML = '完成一组刷题后查看AI分析';
  }
}

// 挂载到全局（每次刷题完成后可调用刷新）
window.loadAIAnalysis = loadAIAnalysis;
