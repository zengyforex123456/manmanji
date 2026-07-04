// components/enhance-ui.js — L3: UI增强组件
// 单一职责: 登录按钮·VIP入口·进度可视化·薄弱项面板
// 在dashboard渲染后调用enhanceDashboard()

import { analyzeWeakPoints } from '../services/ai-question-generator.js';

// ── 增强导航栏: 登录+Vip按钮 ──
export function enhanceNavbar() {
  var hint = document.getElementById('login-hint');
  if (!hint || hint.dataset.enhanced) return;

  var navUser = document.getElementById('nav-user');
  if (!navUser) return;

  var state = JSON.parse(localStorage.getItem('manmanji_user_state') || '{}');
  if (state.userId) {
    navUser.innerHTML = '<span style="background:#dbeafe;color:#1e40af;padding:6px 14px;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer" onclick="LoginPage.renderProfile()">👤 ' + state.userId.slice(-4) + '</span>';
  } else {
    navUser.innerHTML = '<button onclick="LoginPage.render(function(){window.goHome()})" style="background:#0f766e;color:#fff;border:none;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;margin-right:6px">登录</button><button onclick="showPayment(\'single_econ\',\'极简智考·单科卡\',68)" style="background:#f59e0b;color:#fff;border:none;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">开通VIP</button>';
  }
  hint.dataset.enhanced = '1';
}

// ── 添加薄弱项面板 ──
export function addWeakPointPanel() {
  if (document.getElementById('weak-point-panel')) return;

  var main = document.querySelector('.main-content');
  if (!main) return;

  // 收集学习数据
  var state = JSON.parse(localStorage.getItem('manmanji_user_state') || '{}');
  var progress = [];
  try {
    var stored = JSON.parse(localStorage.getItem('mmj_progress') || '[]');
    progress = stored;
  } catch(e) {}

  var weakAnalysis = analyzeWeakPoints(progress);

  // 先创建panel
  var panel = document.createElement('div');
  panel.id = 'weak-point-panel';
  panel.style.cssText = 'margin-top:12px;padding:16px;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.05)';

  // 三态展示
  var totalQuestions = progress.reduce(function(s,p){return s+(p.total||0)},0);
  if (totalQuestions === 0) {
    panel.innerHTML = '<div class="flow-title" style="margin-bottom:12px">🎯 薄弱项靶向练习</div>'
      + '<div style="text-align:center;padding:16px;color:#64748b;font-size:13px">📝 开始刷题后，AI将为你分析薄弱项' + '</div>';
    var fg = main.querySelector('.flow-guide');
    if (fg) fg.parentNode.insertBefore(panel, fg); else main.appendChild(panel);
    return;
  }
  if (weakAnalysis.weakest.length === 0 && weakAnalysis.overallAccuracy > 70) {
    panel.innerHTML = '<div class="flow-title" style="margin-bottom:12px">🎯 薄弱项靶向练习</div>'
      + '<div style="text-align:center;padding:16px;color:#16a34a;font-size:13px">' + '所有章节掌握良好！继续保持' + '</div>';
    var fg2 = main.querySelector('.flow-guide');
    if (fg2) fg2.parentNode.insertBefore(panel, fg2); else main.appendChild(panel);
    return;
  }

  var weakHtml = '';
  weakAnalysis.weakest.forEach(function(w, i) {
    var color = w.accuracy < 40 ? '#dc2626' : w.accuracy < 60 ? '#f59e0b' : '#0f766e';
    weakHtml += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px">'
      + '<span style="color:' + color + ';font-weight:700;min-width:24px">' + (i+1) + '</span>'
      + '<span style="flex:1">第' + w.num + '章 ' + (w.name || '') + '</span>'
      + '<span style="color:' + color + ';font-weight:600">' + w.accuracy + '%</span>'
      + '<button onclick="startWeakPractice(' + w.num + ')" style="background:#1a56db;color:#fff;border:none;padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer">专项练习</button>'
      + '</div>';
  });

  var panel = document.createElement('div');
  panel.id = 'weak-point-panel';
  panel.style.cssText = 'margin-top:12px;padding:16px;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.05)';
  panel.innerHTML = '<div class="flow-title" style="margin-bottom:12px">🎯 薄弱项靶向练习'
    + (weakAnalysis.weakest.length > 0 ? '<span style="font-size:12px;color:#f59e0b;margin-left:8px;font-weight:400">' + weakAnalysis.weakest.length + '个章节需加强</span>' : '')
    + '</div>'
    + (weakAnalysis.weakest.length > 0 ? weakHtml : '<div style="text-align:center;padding:16px;color:#64748b;font-size:13px">🎉 掌握良好！继续保持</div>')
    + '</div>';

  // 插入在flow-guide区域最前面
  var firstGuide = main.querySelector('.flow-guide');
  if (firstGuide) {
    firstGuide.parentNode.insertBefore(panel, firstGuide);
  } else {
    main.appendChild(panel);
  }
}

// ── 添加学习进度条 ──
export function addProgressBar() {
  if (document.getElementById('study-progress')) return;

  var main = document.querySelector('.main-content');
  if (!main) return;

  var state = JSON.parse(localStorage.getItem('manmanji_user_state') || '{}');
  var total = state.learnedPointsCount || 0;
  var target = 500;
  var pct = Math.min(100, Math.round(total / target * 100));

  var bar = document.createElement('div');
  bar.id = 'study-progress';
  bar.style.cssText = 'margin:12px 0;padding:12px 16px;background:linear-gradient(135deg,#eff6ff,#f0fdf4);border-radius:10px;font-size:13px';
  bar.innerHTML = '<div style="display:flex;justify-content:space-between;margin-bottom:6px">'
    + '<span style="font-weight:600">📖 学习进度</span>'
    + '<span style="color:#64748b">' + total + '/' + target + '题 (' + pct + '%)</span>'
    + '</div>'
    + '<div style="background:#e2e8f0;border-radius:6px;height:8px;overflow:hidden">'
    + '<div style="background:linear-gradient(90deg,#0f766e,#10b981);height:100%;width:' + pct + '%;border-radius:6px;transition:width .5s"></div>'
    + '</div>'
    + '<div style="display:flex;gap:8px;margin-top:8px;font-size:11px;color:#94a3b8">'
    + '<span>🔰 新手(' + Math.min(total, 50) + '/50)</span><span>→</span>'
    + '<span>🌿 入门(50/100)</span><span>→</span>'
    + '<span>📊 进阶(100/200)</span><span>→</span>'
    + '<span>🚀 冲刺(200/500)</span>'
    + '</div>';

  var flowGuide = main.querySelector('.flow-guide');
  if (flowGuide) {
    flowGuide.parentNode.insertBefore(bar, flowGuide);
  } else {
    main.insertBefore(bar, main.firstChild);
  }
}

// ── 增强AI诊断面板 ──
export async function enhanceAIPanel() {
  var el = document.getElementById('ai-insights-content');
  if (!el || el.dataset.enhanced) return;
  el.dataset.enhanced = '1';

  var data = window.__dashboard_data;
  if (!data || data.total < 5) return;

  // 添加薄弱项专项练习按钮
  var state = JSON.parse(localStorage.getItem('manmanji_user_state') || '{}');
  var progress = [];
  try { progress = JSON.parse(localStorage.getItem('mmj_progress') || '[]'); } catch(e) {}

  var weak = [];
  var chapterStats = {};
  progress.forEach(function(p) {
    var ch = p.chapter || 0;
    if (!ch) return;
    if (!chapterStats[ch]) chapterStats[ch] = { total: 0, wrong: 0 };
    chapterStats[ch].total++;
    if (p.wrongCount > 0) chapterStats[ch].wrong++;
  });
  weak = Object.entries(chapterStats)
    .filter(function(e) { return e[1].total >= 3 && e[1].wrong / e[1].total > 0.3; })
    .map(function(e) { return parseInt(e[0]); })
    .slice(0, 3);

  var btnHtml = '<button onclick="startAIQuestions()" style="display:block;width:100%;padding:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:8px">🤖 AI出题 — 生成10道针对性练习</button>';
  if (weak.length > 0) {
    btnHtml += '<button onclick="startWeakPractice(' + weak[0] + ')" style="display:block;width:100%;padding:10px;background:#f59e0b;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:8px">🎯 薄弱项专项 — 第' + weak.join('、') + '章</button>';
  }

  // BKT补洞路径
  try {
    var { getBKT } = await import('../services/ai-question-generator.js');
    var bkt = getBKT();
    var progress2 = [];
    try { progress2 = JSON.parse(localStorage.getItem('mmj_progress') || '[]'); } catch(e) {}
    bkt.load(progress2);
    var gapPath = bkt.generateGapPath();

    if (gapPath.totalGaps > 0) {
      var gapHtml = '<div style="margin-top:6px;padding:8px;background:#fef3c7;border-radius:6px;font-size:12px">'
        + '<b>' + gapPath.summary + '</b>'
        + '<div style="margin-top:4px;color:#92400e">📋 补洞路径: ';
      gapPath.path.slice(0, 5).forEach(function(g, i) {
        gapHtml += (i > 0 ? ' → ' : '') + '第' + g.chapter + '章(' + g.priority + ')';
      });
      gapHtml += '</div></div>';
      btnHtml = gapHtml + btnHtml;
    }
  } catch(e) {}

  el.innerHTML = btnHtml + el.innerHTML;
}

// ── 全局: dashboard渲染后调用 ──
export function enhanceDashboard() {
  setTimeout(function() {
    enhanceNavbar();
    addProgressBar();
    addWeakPointPanel();
    enhanceAIPanel();
  }, 300);
}

// ── 全局按钮回调 ──
window.startWeakPractice = async function(chapterNum) {
  var app = document.getElementById('app');
  if (app) app.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh"><div style="text-align:center"><div style="font-size:48px">🎯</div><div style="font-size:16px;font-weight:700">AI生成第' + chapterNum + '章专项练习...</div></div></div>';
  try {
    var { generateQuestions } = await import('../services/ai-question-generator.js');
    var questions = await generateQuestions({ subjectId: 'econ', chapter: chapterNum, count: 10, difficulty: 'medium' });
    if (!questions.length) { alert('AI出题暂不可用，请稍后重试'); window.goHome(); return; }
    var { QuizCard } = await import('./quiz-card.js');
    QuizCard.render('advanced', questions);
  } catch(e) { alert('出错了: ' + e.message); window.goHome(); }
};

window.startAIQuestions = async function() {
  var app = document.getElementById('app');
  if (app) app.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh"><div style="text-align:center"><div style="font-size:48px">🤖</div><div style="font-size:16px;font-weight:700">AI正在生成题目...</div></div></div>';
  try {
    var { generateQuestions } = await import('../services/ai-question-generator.js');
    var questions = await generateQuestions({ subjectId: 'econ', count: 10, difficulty: 'medium' });
    if (!questions.length) { alert('AI出题暂不可用，请稍后重试'); window.goHome(); return; }
    var { QuizCard } = await import('./quiz-card.js');
    QuizCard.render('advanced', questions);
  } catch(e) { alert('出错了: ' + e.message); window.goHome(); }
};
