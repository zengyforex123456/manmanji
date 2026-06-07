// src/main.js — 慢慢记 V1.5 主入口
import { State } from './core/state.js';
import { DB } from './core/db.js';
import { QuizService } from './services/quiz-service.js';
import { QuizCard } from './components/quiz-card.js';
import { LoginPage } from './components/login.js';
import { Analytics } from './services/analytics.js';
import { injectAIPanels } from './components/ai-panel.js';
import './style.css';

// ─── 应用初始化 ───
async function bootstrap() {
  console.log('[App] 慢慢记 V1.5 启动中...');

  // 1. 初始化状态（含崩溃恢复）
  await State.init();
  console.log('[App] 状态初始化完成');

  // 2. 检查 IndexedDB 状态
  if (!DB.isAvailable()) {
    console.warn('[App] IndexedDB 不可用，使用 localStorage 降级模式');
  }

  // 3. 检测离线状态
  setupOfflineDetection();

  // 4. 渲染首页看板
  renderDashboard();
  setTimeout(() => injectAIPanels(), 100); // DOM渲染后注入AI面板

  // 5. 检查崩溃恢复
  checkCrashRecovery();

  // 6. 埋点：会话开始
  State.trackEvent('session_start', {
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    dbAvailable: DB.isAvailable(),
  });

  console.log('[App] 启动完成');
}

// ─── 离线检测 ───
function setupOfflineDetection() {
  const updateOfflineBar = () => {
    const bar = document.getElementById('offline-bar');
    if (!bar) return;
    if (!navigator.onLine) {
      bar.style.display = 'flex';
      bar.textContent = '📡 离线模式';
      bar.style.background = '#6b7280';
    } else {
      bar.textContent = '📡 网络已恢复';
      bar.style.background = '#22c55e';
      setTimeout(() => { bar.style.display = 'none'; }, 3000);
    }
  };
  window.addEventListener('online', updateOfflineBar);
  window.addEventListener('offline', updateOfflineBar);
  updateOfflineBar();
}

// ─── 崩溃恢复检查 ───
function checkCrashRecovery() {
  const lastSession = State.getLastSession();
  if (lastSession && lastSession.questionId) {
    const snackbar = document.getElementById('crash-recovery-snackbar');
    if (snackbar) {
      snackbar.style.display = 'block';
      snackbar.innerHTML = `
        <span>检测到上次学习中断，已恢复到${lastSession.mode || '刷题'}模式</span>
        <button onclick="this.parentElement.style.display='none'" style="margin-left:12px;padding:4px 12px;">✕</button>
      `;
    }
  }
}

// ─── 首页看板渲染 ───
function renderDashboard() {
  const app = document.getElementById('app');
  if (!app) return;

  const state = State.state;
  const subjState = State.currentSubject();
  const dueCount = (subjState?.ebbinghausQueue || [])
    .filter(item => !item.nextReview || item.nextReview <= Date.now()).length;
  const totalAnswered = state._totalQuizzes || 0;
  const totalWrong = state.wrongQuestionsCount || 0;
  const mastery = totalAnswered > 0
    ? Math.round((1 - totalWrong / Math.max(totalAnswered, 1)) * 100)
    : 0;

  app.innerHTML = `
    <!-- 离线指示器 -->
    <div id="offline-bar" style="display:none;position:fixed;top:0;left:0;right:0;height:32px;line-height:32px;text-align:center;color:#fff;font-size:13px;z-index:9999;"></div>

    <!-- 崩溃恢复提示 -->
    <div id="crash-recovery-snackbar" style="display:none;position:fixed;top:40px;left:50%;transform:translateX(-50%);padding:10px 18px;border-radius:6px;font-size:13px;font-weight:500;z-index:9998;white-space:nowrap;"></div>

    <!-- 顶部导航 -->
    <nav class="top-nav">
      <div class="nav-brand" onclick="location.reload()">慢慢记</div>
      <div class="nav-subjects" id="nav-subjects"></div>
      <div class="nav-user" id="nav-user">
        ${state.userId
          ? `<span id="login-hint" style="background:var(--accent-light);border-color:var(--accent)">👤 ${state.userId.slice(-4)}</span>`
          : `<span id="login-hint" onclick="LoginPage.render(()=>location.reload())">🔒 登录后可跨设备同步</span>`
        }
      </div>
    </nav>

    <!-- 主内容区 -->
    <main class="main-content">
      <div class="welcome-row">
        <span>👋 ${getGreeting()}，${state.userId ? '考友' : '访客'} · 🔥 ${state.daysStudied || 1}天</span>
        <span class="exam-countdown">${state.userId ? '已登录' : '距考试 45 天'}</span>
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-label">📋 待复习</div>
          <div class="stat-value">${dueCount} 题</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">📊 掌握度</div>
          <div class="stat-value">${mastery}%</div>
        </div>
      </div>

      <button class="cta-primary" onclick="startLearning()">
        📝 开始刷题 · 经济基础·第2章
      </button>

      <div class="mode-grid">
        <button class="mode-btn" onclick="startMode('beginner')">🎯 新手 10题</button>
        <button class="mode-btn" onclick="startMode('advanced')">🔥 进阶 20题</button>
        <button class="mode-btn" onclick="startMode('mock')">⏱️ 模考 105题</button>
        <button class="mode-btn" onclick="startMode('mistake')">📖 错题重做</button>
      </div>

      <div class="recent-section" id="recent-section">
        <div class="section-title">最近学习</div>
        <div id="recent-list" style="color:var(--text-secondary);font-size:13px;">暂无学习记录</div>
      </div>

      <div class="bottom-actions">
        <button class="text-btn" onclick="showFeedback()">💬 问题反馈</button>
        <span style="color:var(--border-color);">|</span>
        <button class="text-btn" onclick="togglePhonePreview()">📱 小程序预览</button>
      </div>
    </main>

    <!-- 手机仿真器 -->
    <div class="phone-preview-panel" id="phone-preview" style="display:none;">
      <div class="phone-preview-header">
        <span>📱 小程序预览</span>
        <button class="text-btn" onclick="togglePhonePreview()">✕</button>
      </div>
      <div class="phone-preview-body" id="phone-preview-body"><div style="text-align:center;padding:40px 20px"><div style="font-size:40px;margin-bottom:12px">📱</div><div style="font-weight:800;font-size:16px;margin-bottom:4px">小程序端</div><div style="font-size:12px;color:var(--text-secondary)">刷题·听学·复盘·打卡</div></div></div>
    </div>
  `;

  renderSubjectNav();
}

function renderSubjectNav() {
  const nav = document.getElementById('nav-subjects');
  if (!nav) return;
  const subjects = [
    { id: 'econ', name: '经济基础' },
    { id: 'hr', name: '人力' },
    { id: 'biz', name: '工商' },
  ];
  const active = State.getActiveSubjectId();
  nav.innerHTML = subjects.map(s =>
    `<span class="nav-subject-item ${s.id === active ? 'active' : ''}"
           onclick="switchSubject('${s.id}')">${s.name}</span>`
  ).join('');
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return '早上好';
  if (h < 18) return '下午好';
  return '晚上好';
}

// ─── 按钮回调（挂载到全局） ───
window.startLearning = function() {
  const lastSession = State.getLastSession();
  if (lastSession.mode) {
    startMode(lastSession.mode);
  } else {
    startMode('beginner');
  }
};

window.startMode = async function(mode) {
  State.trackEvent('mode_started', { mode, subjectId: State.getActiveSubjectId() });
  const countMap = { beginner: 10, advanced: 20, mock: 105, mistake: 999 };
  const count = countMap[mode] || 10;
  try {
    const questions = await QuizService.pickQuestions({
      subjectId: State.getActiveSubjectId(),
      mode,
      count,
    });
    QuizCard.render(mode, questions);
  } catch (e) {
    console.error('[App] startMode failed:', e);
    alert('题库加载失败，请刷新页面后重试');
  }
};

window.switchSubject = function(subjectId) {
  State.setActiveSubject(subjectId);
  State.trackEvent('subject_switched', { subjectId });
  location.reload();
};

window.showFeedback = function() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = `
    <nav class="top-nav">
      <div class="nav-brand" onclick="location.reload()">慢慢记</div>
      <span style="font-weight:600">问题反馈</span>
    </nav>
    <main class="main-content">
      <div class="stat-card" style="margin:24px 0;text-align:left;padding:20px">
        <div class="section-title">💬 问题反馈</div>
        <textarea id="feedback-text" rows="4" style="width:100%;padding:12px;border:1px solid var(--border-color);border-radius:var(--radius-sm);font-family:var(--font-sans);font-size:15px;margin:12px 0;resize:vertical" placeholder="请描述您遇到的问题或建议..."></textarea>
        <div style="display:flex;gap:12px">
          <button class="cta-primary" style="flex:1" onclick="submitFeedback()">提交反馈</button>
          <button class="mode-btn" onclick="location.reload()">取消</button>
        </div>
      </div>
    </main>
  `;
};

window.submitFeedback = function() {
  const text = document.getElementById('feedback-text')?.value?.trim();
  if (text) {
    State.trackEvent('feedback_submitted', { text });
    alert('感谢反馈！我们会尽快处理。');
  }
  location.reload();
};

window.togglePhonePreview = function() {
  const panel = document.getElementById('phone-preview');
  if (panel) {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  }
};

// ─── AI 引擎回调 ───
window.askAI = function() {
  const q = document.getElementById('ai-query-input')?.value?.trim();
  const answerEl = document.getElementById('ai-answer');
  if (!q || !answerEl) return;
  const result = Analytics.askQuestion(q);
  answerEl.style.display = 'block';
  answerEl.innerHTML = `<strong>${result.source ? '📚 ' + result.source : '🤖 AI助手'}</strong><br>${result.answer.replace(/\n/g, '<br>')}`;
};

window.loadAIAnalysis = async function() {
  const el = document.getElementById('ai-insights-content');
  if (!el) return;
  try {
    const plan = await Analytics.getAdaptivePlan();
    if (plan.recommendations.length === 0) {
      el.innerHTML = '✅ 暂无特别建议，继续保持学习节奏！';
      return;
    }
    el.innerHTML = plan.recommendations.map(r =>
      `<div style="margin-bottom:6px;padding:6px 8px;background:var(--bg-pc);border-radius:6px;border-left:3px solid ${r.priority==='urgent'?'#dc2626':r.priority==='high'?'#f59e0b':'#22c55e'}">
        <span style="font-weight:700">${r.priority==='urgent'?'🔴':r.priority==='high'?'🟡':'🟢'} ${r.action}</span>
      </div>`
    ).join('') + `<div style="margin-top:8px;font-weight:600;color:var(--accent)">${plan.summary}</div>`;
  } catch(e) {
    el.innerHTML = '完成一组刷题后查看AI分析';
  }
};

// ─── 启动 ───
document.addEventListener('DOMContentLoaded', bootstrap);
