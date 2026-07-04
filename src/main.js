// src/main.js — 极简智考 V1.5 主入口
import { State } from './core/state.js';
import { DB } from './core/db.js';
import { QuizService } from './services/quiz-service.js';
import { QuizCard } from './components/quiz-card.js';
import { renderMockExam } from './components/mock-exam.js';
import { LoginPage } from './components/login.js';
import { Analytics } from './services/analytics.js';
import { Ebbinghaus } from './services/ebbinghaus.js';
import { renderSubjectNav } from './components/subject-nav.js';
import { generateQuestions, generateWeakPointQuestions, analyzeWeakPoints } from './services/ai-question-generator.js';
import { renderWelcomeBar, updateCountdown } from './components/WelcomeBar.js';
import { renderAIBrain } from './components/AIBrain.js';
import './style.css';

// LC chapter functions (lightweight)
import { getSubjectMeta } from './data/subjects-meta.js';
window.LC = window.LC || {};
window.LC.startMistake = () => window.startMode('mistake');
window.LC.startChapter = async (chNum) => {
  const { QuizService } = await import('./services/quiz-service.js');
  const { QuizCard } = await import('./components/quiz-card.js');
  const qs = await QuizService.pickQuestions({ subjectId: State.getActiveSubjectId(), mode: 'beginner', chapter: chNum, count: 10 });
  QuizCard.render('beginner', qs);
};
window.LC.showChapters = () => {
  const section = document.getElementById('lc-chapters-section');
  if (!section) return;
  if (section.style.display === 'block') { section.style.display = 'none'; return; }
  const meta = getSubjectMeta(State.getActiveSubjectId());
  if (!meta) return;
  section.innerHTML = `<div style="margin-bottom:8px;font-size:11px;display:flex;gap:12px;align-items:center"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#dc2626"></span> 核心必考 <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#f59e0b;margin-left:4px"></span> 高频考点 <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#94a3b8;margin-left:4px"></span> 基础了解 <span style="color:#64748b;margin-left:8px;font-size:10px">点击编号刷题</span></div>` + (meta.modules || []).map(m => `
    <div style="font-size:13px;font-weight:700;color:#334155;margin:12px 0 4px">${m.name} <span style="font-weight:400;font-size:11px;color:#94a3b8">占${Math.round(m.weight*100)}%</span></div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      ${(m.chapters || []).map(chNum => {
        const ch = meta.chapters.find(c => c.id === chNum);
        if (!ch) return '';
        const colors = {1:'#dc2626',2:'#f59e0b',3:'#94a3b8'};
        return `<span style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;background:#fff;border:1px solid #e2e8f0;border-left:3px solid ${colors[ch.tier]||colors[3]};border-radius:8px;cursor:pointer;font-size:12px;min-height:38px" onclick="LC.startChapter(${chNum})" title="${ch.name}">
          <b style="color:#0f766e">${chNum}</b> ${ch.name.replace(/第.+章\s*/,'').substring(0,6)}
        </span>`;
      }).join('')}
    </div>
  `).join('');
  section.style.display = 'block';
};

// ─── 应用初始化 ───
async function bootstrap() {
  console.log('[App] 极简智考 V1.5 启动中...');

  // 1. 初始化状态（含崩溃恢复）
  await State.init();
  console.log('[App] 状态初始化完成');

  // 2. 检查 IndexedDB 状态
  if (!DB.isAvailable()) {
    console.warn('[App] IndexedDB 不可用，使用 localStorage 降级模式');
  }

  // 3. 检测离线状态
  setupOfflineDetection();

  // 4. 渲染首页看板（壳立即显示，数据异步填充）
  renderDashboardShell();
  populateDashboardData();

  // 5. 检查崩溃恢复
  checkCrashRecovery();

  // 5.5 检查组队邀请
  const { checkTeamJoin } = await import('./components/team-mode.js');
  checkTeamJoin();

  // 5.6 复习提醒
  try {
    const stats = await Ebbinghaus.getDailyStats();
    if (stats.dueToday > 0 && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    // 更新页面标题显示待复习数
    if (stats.dueToday > 0) {
      document.title = `(${stats.dueToday}) 极简智考 · 慢慢记`;
    }
  } catch(e) {}

  // 6. 埋点：会话开始
  State.trackEvent('session_start', {
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    dbAvailable: DB.isAvailable(),
  });

  console.log('[App] 启动完成');

  // 确保AI面板始终更新（兜底：页面加载完成后2秒强制执行）
  setTimeout(() => {
    if (!window.__dashboard_data) {
      window.__dashboard_data = { total: 0, mastery: 0, wrong: 0, streak: 1, dueToday: 0 };
    }
    window.loadAIAnalysis();
  }, 2000);
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

// ─── 首页看板渲染（即显骨架 + 异步填数据） ───
async function renderDashboard() { renderDashboardShell(); await populateDashboardData(); }
function renderDashboardShell() {
  const app = document.getElementById('app');
  if (!app) return;
  const state = State.state;

  app.innerHTML = `
    <!-- 离线指示器 -->
    <div id="offline-bar" style="display:none;position:fixed;top:0;left:0;right:0;height:32px;line-height:32px;text-align:center;color:#fff;font-size:13px;z-index:9999;"></div>

    <!-- 崩溃恢复提示 -->
    <div id="crash-recovery-snackbar" style="display:none;position:fixed;top:40px;left:50%;transform:translateX(-50%);padding:10px 18px;border-radius:6px;font-size:13px;font-weight:500;z-index:9998;white-space:nowrap;"></div>

    <!-- 顶部导航 -->
    <nav class="top-nav">
      <div class="nav-brand" onclick="location.reload()">极简智考<span style="font-size:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:2px 6px;border-radius:4px;margin-left:6px;font-weight:500;vertical-align:middle">🧠 AI驱动</span></div>
      <div class="nav-subjects" id="nav-subjects"></div>
      <div class="nav-user" id="nav-user">
        ${state.userId
          ? `<span id="login-hint" style="background:var(--accent-light);border-color:var(--accent);cursor:pointer" onclick="LoginPage.renderProfile()">👤 ${state.userId.slice(-4)}</span>`
          : `<span id="login-hint" onclick="LoginPage.render(()=>window.goHome())">🔒 登录后可跨设备同步</span>`
        }
      </div>
    </nav>

    <!-- 主内容区 -->
    <main class="main-content">
      ${renderWelcomeBar(state)}
      <div class="stats-row">
        <div class="stat-card"><div class="stat-label">📋 待复习</div><div class="stat-value" id="stat-due">-</div></div>
        <div class="stat-card"><div class="stat-label">📊 掌握度</div><div class="stat-value" id="stat-mastery">-</div></div>
        <div class="stat-card"><div class="stat-label">🔥 连续</div><div class="stat-value" id="stat-streak">${state.daysStudied || 1}天</div></div>
      </div>
      <div class="flow-guide" style="margin-top:12px">
        <div class="flow-title">🎯 章节掌握度</div>
        <div id="radar-container" style="padding:12px 0;"></div>
      </div>
      <div class="flow-guide" style="background:linear-gradient(135deg,#eff6ff,#faf5ff);border:1px solid #c7d2fe;border-radius:12px;padding:14px">
        <div class="flow-title" style="color:#4f46e5">🧠 AI学习诊断 <span style="font-size:10px;background:#6366f1;color:#fff;padding:2px 6px;border-radius:4px;margin-left:4px">⭐ 推荐</span></div>
	    <div style="display:flex;gap:6px;margin:4px 0;align-items:center">
          <button onclick="showPricingModal()" style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600">🔓 开通VIP</button>
          <span style="font-size:11px;color:#92400e">¥68/科 · 有效至考试 · 今日免费' + getFreeQuota() + '题</span>
        </div>
        <div style="display:flex;gap:8px;margin:8px 0">
          <input id="ai-prompt-input" type="text" placeholder="输入出题需求：如"宏观经济10道中等难度"" style="flex:1;padding:8px 12px;border:1px solid #c7d2fe;border-radius:8px;font-size:13px;outline:none" onkeydown="if(event.key==='Enter')startAIFromPrompt()">
          <button onclick="startAIFromPrompt()" style="background:#6366f1;color:#fff;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:12px;white-space:nowrap">🎯 出题</button>
          <button onclick="startAIExam()" style="background:#0f766e;color:#fff;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:12px;white-space:nowrap">📝 AI组卷</button>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
          <button onclick="startAIQuick('10道单选题')" style="background:#f1f5f9;border:1px solid #e2e8f0;padding:4px 8px;border-radius:4px;font-size:11px;cursor:pointer;color:#64748b">📊 10道单选</button>
          <button onclick="startAIQuick('5道计算分析题')" style="background:#f1f5f9;border:1px solid #e2e8f0;padding:4px 8px;border-radius:4px;font-size:11px;cursor:pointer;color:#64748b">📈 5道计算</button>
          <button onclick="startAIExam()" style="background:#f1f5f9;border:1px solid #e2e8f0;padding:4px 8px;border-radius:4px;font-size:11px;cursor:pointer;color:#64748b">📝 组模拟卷</button>
          <button onclick="startAIWeak()" style="background:#fef3c7;border:1px solid #fcd34d;padding:4px 8px;border-radius:4px;font-size:11px;cursor:pointer;color:#92400e">🎯 薄弱项专项</button>
          <button onclick="startAIQuick('每日10题综合练习')" style="background:#f1f5f9;border:1px solid #e2e8f0;padding:4px 8px;border-radius:4px;font-size:11px;cursor:pointer;color:#64748b">⏰ 每日10题</button>
        </div>
        <div id="ai-insights-content" style="padding:8px 0;font-size:13px;color:#64748b;">完成一组刷题后查看AI分析</div>
      </div>
      <div class="flow-guide">
        <div class="flow-title">📖 学习流程</div>
        <div class="flow-steps">
          <div class="flow-step" onclick="startMode('beginner')"><div class="flow-num">1</div><div class="flow-content"><div class="flow-name">开始刷题</div><div class="flow-desc">系统自动挑选适合你的题目</div></div><div class="flow-arrow">→</div></div>
          <div class="flow-step" onclick="LC.startMistake()"><div class="flow-num">2</div><div class="flow-content"><div class="flow-name">错题重做</div><div class="flow-desc" id="flow-mistake-count">错题会自动收集到这里</div></div><div class="flow-arrow">→</div></div>
          <div class="flow-step" onclick="startMode('mock')"><div class="flow-num">3</div><div class="flow-content"><div class="flow-name">模拟考试</div><div class="flow-desc">105题·90分钟·全真环境</div></div></div>
        </div>
      </div>
      <div class="flow-guide" style="margin-top:12px"><div class="flow-title" id="show-chapters-btn" style="cursor:pointer">📚 按章节学习 ▸</div><div id="lc-chapters-section" style="display:none"></div></div>
      <div class="flow-guide" style="margin-top:12px">
        <div class="flow-title">🎮 自由探索</div>
        <div class="flow-section-hint" style="font-size:11px;color:#94a3b8;margin-bottom:10px">选择你自己的学习方式，每种方式都针对不同备考需求</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <div class="explore-row" onclick="startAIQuestions()" style="border:1px solid #c7d2fe;background:#faf5ff">
            <span class="explore-icon">🤖</span>
            <span class="explore-name">AI智能出题</span>
            <span style="font-size:9px;background:#8b5cf6;color:#fff;padding:1px 5px;border-radius:3px;margin-left:4px">⭐推荐</span>
            <span class="explore-desc">AI生成针对性练习</span>
            <span class="explore-why">适合：薄弱项靶向攻克</span>
          </div>
          <div class="explore-row" onclick="startMode('advanced')">
            <span class="explore-icon">🎲</span>
            <span class="explore-name">随机挑战</span>
            <span class="explore-desc">全题库随机20题</span>
            <span class="explore-why">适合：检验综合水平</span>
          </div>
          <div class="explore-row" onclick="document.getElementById('custom-panel').style.display='block'">
            <span class="explore-icon">⚙️</span>
            <span class="explore-name">自由组卷 ▸</span>
            <span class="explore-desc">自选数量·模式·范围</span>
            <span class="explore-why">适合：针对性练习</span>
          </div>
        </div>
        <div id="custom-panel" style="display:none;margin-top:10px;padding:12px;background:#f8fafc;border-radius:10px">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <select id="custom-count" style="padding:8px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;min-width:70px">
              <option value="10">10题</option><option value="20" selected>20题</option><option value="50">50题</option><option value="105">105题</option>
            </select>
            <select id="custom-mode" style="padding:8px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;flex:1;min-width:150px">
              <option value="beginner">新手（每题看解析）</option>
              <option value="advanced" selected>进阶（做完看结果）</option>
              <option value="mock">模考（限时90分钟）</option>
            </select>
            <button class="mode-btn" onclick="startCustomExam()" style="padding:8px 20px">开始</button>
          </div>
        </div>
      </div>
      <div class="flow-guide" style="margin-top:12px">
        <div class="flow-title">🏆 成就勋章</div>
        <div id="badge-wall" style="padding:8px 0;"></div>
      </div>
    </main>

    <!-- 底部固定栏 -->
    <div class="bottom-bar" style="position:fixed;bottom:0;left:0;right:0;height:56px;background:#fff;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-around;z-index:999;box-shadow:0 -2px 8px rgba(0,0,0,.05);padding-bottom:env(safe-area-inset-bottom)">
      <button onclick="TeamMode.showTeamPanel()" style="background:none;border:none;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;font-size:11px;color:#64748b;padding:4px 12px">
        <span style="font-size:20px">👥</span>组队刷题
      </button>
      <button onclick="showSharePoster()" style="background:none;border:none;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;font-size:11px;color:#64748b;padding:4px 12px">
        <span style="font-size:20px">📸</span>打卡分享
      </button>
      <button onclick="showFeedback()" style="background:none;border:none;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;font-size:11px;color:#64748b;padding:4px 12px">
        <span style="font-size:20px">💬</span>问题反馈
      </button>
    </div>
    <!-- 底部栏占位 --><div style="height:70px"></div>

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

  // 注入支付按钮 + UI增强（等dashboard DOM就绪）
  setTimeout(function() {
    if (window.__injectPayment) window.__injectPayment();
    import('./components/enhance-ui.js').then(function(m) { m.enhanceDashboard(); });
  }, 300);

  // 绑定章节学习点击事件（避免onclick在HMR下失效）
  setTimeout(() => {
    const chapBtn = document.querySelector('#show-chapters-btn');
    if (chapBtn) chapBtn.addEventListener('click', () => window.LC?.showChapters());
  }, 100);
}

async function populateDashboardData() {
  try {
    const stats = await Ebbinghaus.getDailyStats();
    const progress = await DB.getProgress(State.getActiveSubjectId());
    let wrong = 0;
    const chWrong = {}, chTotal = {};
    progress.forEach(p => {
      if (p.wrongCount > 0) wrong++;
      const ch = p.chapter || 0;
      if (ch > 0) { chWrong[ch] = (chWrong[ch]||0) + (p.wrongCount>0?1:0); chTotal[ch] = (chTotal[ch]||0) + 1; }
    });
    const total = stats.totalInQueue || 0;
    const mastery = total >= 50 ? Math.round((total - wrong) / total * 100) : total > 0 ? Math.round((1 - wrong/total)*100) : 0;

    // 🧠 用户画像：千人千面核心
    const profile = buildProfile(total, wrong, mastery, stats, chWrong, chTotal, progress);

    // 更新统计数字
    const dueEl = document.getElementById('stat-due');
    const masteryEl = document.getElementById('stat-mastery');
    if (dueEl) dueEl.textContent = stats.dueToday + ' 题';
    if (masteryEl) masteryEl.textContent = mastery + '%';

    // 更新错题数
    const mistakeEl = document.getElementById('flow-mistake-count');
    if (mistakeEl) mistakeEl.textContent = wrong > 0 ? `${wrong} 道错题待重做` : '暂无错题，继续加油';

    // 🧠 千人千面
    applyProfile(profile);

    // 💾 保存数据供AI面板直接读取
    window.__dashboard_data = { total, mastery, wrong, streak: state.daysStudied || 1, dueToday: stats.dueToday || 0 };
    // 🔍 立即触发AI诊断（同步，不依赖异步IndexedDB）
    window.loadAIAnalysis();

    // 更新欢迎行 + 连续打卡
    const state = State.state;
    const welcomeSpan = document.querySelector('.welcome-text');
    const streakEl = document.getElementById('stat-streak');
    if (welcomeSpan) {
      const name = state.userId ? (state.userId.length > 8 ? '考友' : state.userId.slice(-4)) : '访客';
      welcomeSpan.innerHTML = `👋 ${getGreeting()}，${name}`;
    }
    const today = new Date().toDateString();
    const lastStudy = localStorage.getItem('mmj_last_study_date');
    const newStreak = lastStudy !== today ? (state.daysStudied || 0) + 1 : (state.daysStudied || 1);
    if (lastStudy !== today) {
      state.daysStudied = newStreak;
      localStorage.setItem('mmj_last_study_date', today);
      State.saveNow();
    }
    if (streakEl) streakEl.textContent = newStreak + '天';
    updateCountdown(state);
    // 雷达图
    try { const { renderRadarChart } = await import('./components/radar-chart.js'); await renderRadarChart(); } catch(e) {}
    // 勋章检查
    try { const { checkBadges, renderBadgeWall } = await import('./components/badges.js'); await checkBadges(); setTimeout(() => renderBadgeWall('badge-wall'), 500); } catch(e) {}
  } catch(e) { console.warn('[Dashboard] data fill failed:', e); }
}

// 🧠 用户画像构建
function buildProfile(total, wrong, mastery, stats, chWrong, chTotal, progress) {
  let level, icon, style;
  if (total === 0) { level = '新手'; icon = '🌱'; style = 'color:#0f766e'; }
  else if (total < 50) { level = '入门'; icon = '🌿'; style = 'color:#0f766e'; }
  else if (total < 200) { level = '进阶'; icon = '🌳'; style = 'color:#b45309'; }
  else if (total < 500) { level = '熟练'; icon = '🎯'; style = 'color:#0f766e'; }
  else { level = '冲刺'; icon = '🚀'; style = 'color:#dc2626'; }

  // 弱项Top3
  const weakList = Object.entries(chWrong)
    .filter(([ch, w]) => (chTotal[ch]||0) >= 3)
    .sort((a,b) => b[1] - a[1]).slice(0,3).map(([ch]) => parseInt(ch));

  // SM-2盒子分布
  const boxes = [0,0,0,0,0];
  let dueCount = 0;
  progress.forEach(p => {
    const b = (p.box || 1) - 1;
    if (b >= 0 && b < 5) boxes[b]++;
    if (p.nextReview && p.nextReview <= Date.now()) dueCount++;
  });

  // 学习风格推断
  let style2 = '';
  if (total > 50) {
    const multiRatio = progress.filter(p => p._type === 'multiple').length / total;
    if (mastery > 70 && total > 200) style2 = '稳健型';
    else if (multiRatio > 0.3 && mastery < 60) style2 = '多选薄弱型';
    else if (dueCount > total * 0.3) style2 = '需加强复习';
    else style2 = '均衡发展';
  }

  return { level, icon, levelStyle: style, total, wrong, mastery, weakList, boxes, dueCount, style2 };
}

// 🧠 千人千面：驱动UI
function applyProfile(p) {
  // 欢迎行增加等级
  const welcomeEl = document.querySelector('.welcome-text');
  if (welcomeEl && p.level) {
    const cur = welcomeEl.innerHTML;
    if (!cur.includes('·')) welcomeEl.innerHTML = cur + ` · <span style="${p.levelStyle}">${p.icon} ${p.level}</span>`;
  }

  // 学习流程个性化
  const stepDescs = document.querySelectorAll('.flow-step .flow-desc');
  const stepNames = document.querySelectorAll('.flow-step .flow-name');
  const stepNums = document.querySelectorAll('.flow-step .flow-num');

  if (stepDescs.length >= 3) {
    // Step 1: 根据等级推荐
    const step1Map = {
      '新手': ['从高频考点开始', '#0f766e'],
      '入门': ['巩固基础章节', '#0f766e'],
      '进阶': p.weakList.length>0 ? [`第${p.weakList[0]}章需加强`,'#f59e0b'] : ['混合练习提升', '#0f766e'],
      '熟练': p.dueCount>0 ? [`${p.dueCount}题待复习，优先`,'#dc2626'] : ['模拟考试检验水平','#0f766e'],
      '冲刺': ['全真模考冲刺','#dc2626'],
    };
    const [t1, c1] = step1Map[p.level] || ['开始学习','#64748b'];
    stepDescs[0].textContent = t1; stepDescs[0].style.color = c1;
    if (stepNums[0]) {
      stepNums[0].style.background = c1;
      stepNames[0].textContent = p.level === '冲刺' ? '冲刺模考' : p.level === '熟练' ? '复习巩固' : '开始刷题';
    }

    // Step 2: 错题
    const [t2, c2] = p.wrong > 10 ? [`${p.wrong}道错题，建议优先攻克`,'#dc2626'] : p.wrong > 0 ? [`${p.wrong}道错题可重做`,'#f59e0b'] : ['暂无错题','#64748b'];
    stepDescs[1].textContent = t2; stepDescs[1].style.color = c2;

    // Step 3: 模考 — 根据等级
    const step3Map = {
      '新手': ['建议先刷够50题再来','#94a3b8'],
      '入门': ['再刷'+(50-p.total)+'题可解锁','#94a3b8'],
      '进阶': p.total>=100?['可以尝试模考检验','#0f766e']:['再刷'+(100-p.total)+'题解锁模考','#94a3b8'],
      '熟练': ['105题·90分钟·全真环境','#0f766e'],
      '冲刺': ['严格计时·查漏补缺','#dc2626'],
    };
    const [t3, c3] = step3Map[p.level] || ['105题·90分钟·全真环境','#64748b'];
    stepDescs[2].textContent = t3; stepDescs[2].style.color = c3;
    // 低等级把模考按钮置灰提示
    const step3El = document.querySelectorAll('.flow-step')[2];
    if (step3El && (p.level === '新手' || p.level === '入门')) {
      step3El.style.opacity = '0.5';
      step3El.style.pointerEvents = 'none';
    }
  }

  // 章节弱项高亮
  if (p.weakList.length > 0) {
    const chips = document.querySelectorAll('#lc-chapters-section span[onclick]');
    chips.forEach(chip => {
      const onclick = chip.getAttribute('onclick') || '';
      const m = onclick.match(/LC\.startChapter\((\d+)\)/);
      if (m && p.weakList.includes(parseInt(m[1]))) {
        chip.style.boxShadow = '0 0 0 2px #f59e0b';
        chip.style.fontWeight = '700';
      }
    });
  }
}

// renderSubjectNav() now in src/components/subject-nav.js

// ── 免费配额 ──
var FREE_DAILY_LIMIT = 20;
function getFreeQuota() {
  var today = new Date().toDateString();
  var key = 'mmj_daily_' + today;
  var used = parseInt(localStorage.getItem(key) || '0');
  return Math.max(0, FREE_DAILY_LIMIT - used);
}
function useFreeQuota(n) {
  var today = new Date().toDateString();
  var key = 'mmj_daily_' + today;
  var used = parseInt(localStorage.getItem(key) || '0');
  localStorage.setItem(key, used + (n || 1));
  return FREE_DAILY_LIMIT - (used + (n || 1));
}
function checkPaywall() {
  var remaining = getFreeQuota();
  var state = JSON.parse(localStorage.getItem('manmanji_user_state') || '{}');
  if (state.membershipTier === 'vip') return true; // VIP无限
  if (remaining <= 0) {
    showPricingModal();
    return false;
  }
  return true;
}
function showPricingModal() {
  if (document.getElementById('pricing-modal')) return;
  var m = document.createElement('div');
  m.id = 'pricing-modal';
  m.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;display:flex;align-items:center;justify-content:center';
  m.innerHTML = '<div onclick=this.parentElement.remove() style=position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5)></div>'
    + '<div style=position:relative;background:#fff;border-radius:16px;padding:28px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.3);text-align:center>'
    + '<h3 style=margin:0>🔓 开通极简智考VIP</h3><p style=color:#64748b;margin:4px 0 12px>今日免费' + FREE_DAILY_LIMIT + '题已用完·有效至2026年11月考试</p>'
    + '<div style=display:flex;gap:12px;margin:12px 0>'
    + '<div style=flex:1;background:#fff;border:2px solid #e2e8f0;border-radius:12px;padding:14px;text-align:center>'
    + '<div style=font-size:13px;font-weight:700;color:#1a1a2e>单科卡</div>'
    + '<div style=font-size:24px;font-weight:900;color:#1a56db;margin:8px 0>¥68</div>'
    + '<div style=font-size:11px;color:#64748b;line-height:1.6;text-align:left>✅ 19,749题<br>✅ AI出题10次/天<br>✅ 薄弱项分析<br>✅ 口诀解锁</div>'
    + '<button onclick="showPayment(\'single_econ\',\'极简智考·单科卡\',68)" style=display:block;width:100%;padding:8px;margin-top:10px;background:#1a56db;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px>¥68 购买</button>'
    + '</div>'
    + '<div style=flex:1;background:#fef3c7;border:2px solid #f59e0b;border-radius:12px;padding:14px;text-align:center;position:relative>'
    + '<div style=position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:#f59e0b;color:#fff;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700>推荐</div>'
    + '<div style=font-size:13px;font-weight:700;color:#1a1a2e>全科通卡</div>'
    + '<div style=font-size:24px;font-weight:900;color:#d97706;margin:8px 0>¥198</div>'
    + '<div style=font-size:11px;color:#64748b;line-height:1.6;text-align:left>✅ 3科全开<br>✅ AI出题不限次<br>✅ 薄弱项靶向<br>✅ 模拟考试无限次</div>'
    + '<button onclick="showPayment(\'vip_all\',\'极简智考·全科通卡\',198)" style=display:block;width:100%;padding:8px;margin-top:10px;background:#f59e0b;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700>¥198 购买</button>'
    + '</div>'
    + '</div>'
    + '<button onclick="this.parentElement.parentElement.remove()" style=background:none;border:none;color:#94a3b8;cursor:pointer;font-size:12px;margin-top:8px">继续免费刷题（今日剩余' + getFreeQuota() + '题）</button>'
    + '</div>';
  document.body.appendChild(m);
}
window.showPricingModal = showPricingModal;

function getExamMonths() {
  // 中级经济师: 每年11月第一个周末
  var now = new Date();
  var year = now.getFullYear();
  // 找11月第一个周六
  var nov1 = new Date(year, 10, 1); // 11月=10
  var dayOfWeek = nov1.getDay(); // 0=周日
  var firstSat = 1 + (6 - dayOfWeek + 7) % 7;
  var examDate = new Date(year, 10, firstSat);
  var months = (examDate.getFullYear() - now.getFullYear()) * 12 + (examDate.getMonth() - now.getMonth());
  if (months <= 0 && now > examDate) {
    // 今年的已过，看明年
    examDate = new Date(year + 1, 10, firstSat);
    months = 12 + (examDate.getMonth() - now.getMonth());
  }
  if (!localStorage.getItem('mmj_exam_date')) {
    localStorage.setItem('mmj_exam_date', examDate.toISOString().slice(0, 10));
  }
  return months;
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
  if (!checkPaywall()) return;
  useFreeQuota(mode === 'mock' ? 20 : (mode === 'beginner' ? 5 : 10));
  State.trackEvent('mode_started', { mode, subjectId: State.getActiveSubjectId() });
  // 立即显示加载状态
  const app = document.getElementById('app');
  if (app) app.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh"><div style="text-align:center"><div style="font-size:48px;margin-bottom:16px">📚</div><div style="font-size:16px;font-weight:700">题目加载中…</div></div></div>';
  const countMap = { beginner: 5, advanced: 20, mock: 105, mistake: 999 };
  const count = countMap[mode] || 10;
  try {
    const questions = await QuizService.pickQuestions({
      subjectId: State.getActiveSubjectId(),
      mode,
      count,
    });
    if (mode === 'mock') {
      renderMockExam(mode, questions);
    } else {
      QuizCard.render(mode, questions);
    }
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
      <div class="nav-brand" onclick="location.reload()">极简智考<span style="font-size:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:2px 6px;border-radius:4px;margin-left:6px;font-weight:500;vertical-align:middle">🧠 AI驱动</span></div>
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

window.showSharePoster = async function() {
  const state = State.state;
  const stats = await Ebbinghaus.getDailyStats();
  const progress = await DB.getProgress(State.getActiveSubjectId());
  let wrong = 0; progress.forEach(p => { if (p.wrongCount > 0) wrong++; });
  const total = stats.totalInQueue || progress.length;
  const mastery = total >= 50 ? Math.round((total - wrong) / total * 100) : (total > 0 ? Math.round((1 - wrong/total)*100) : 0);
  const streak = state.daysStudied || 1;

  // Canvas 海报
  const canvas = document.createElement('canvas');
  canvas.width = 540; canvas.height = 960;
  const ctx = canvas.getContext('2d');

  // 背景渐变
  const bg = ctx.createLinearGradient(0, 0, 0, 960);
  bg.addColorStop(0, '#0f172a'); bg.addColorStop(1, '#1e3a5f');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 540, 960);

  // 顶部装饰圆
  ctx.fillStyle = 'rgba(56,189,248,0.1)'; ctx.beginPath(); ctx.arc(480, 80, 150, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(16,185,129,0.08)'; ctx.beginPath(); ctx.arc(60, 900, 120, 0, Math.PI*2); ctx.fill();

  // 标题
  ctx.fillStyle = '#fff'; ctx.font = 'bold 32px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.fillText('📚 我的学习打卡', 270, 100);

  // 日期
  ctx.fillStyle = '#94a3b8'; ctx.font = '16px Inter, system-ui, sans-serif';
  ctx.fillText(new Date().toLocaleDateString('zh-CN', {year:'numeric',month:'long',day:'numeric'}), 270, 140);

  // 统计卡片
  const cards = [
    { label: '📋 已刷题数', value: total + '题', x: 80, y: 220 },
    { label: '📊 掌握度', value: mastery + '%', x: 270, y: 220 },
    { label: '🔥 连续打卡', value: streak + '天', x: 460, y: 220 },
    { label: '📖 错题攻克', value: wrong + '题', x: 80, y: 340 },
    { label: '⏰ 今日待复习', value: (stats.dueToday || 0) + '题', x: 270, y: 340 },
    { label: '🎯 考试科目', value: (getSubjectMeta(State.getActiveSubjectId())?.name || '中级经济师').substring(0,6), x: 460, y: 340 },
  ];

  cards.forEach(({label, value, x, y}) => {
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath();
    ctx.roundRect(x-65, y-30, 130, 70, 12); ctx.fill();
    ctx.fillStyle = '#94a3b8'; ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.fillText(label, x, y-5);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 28px Inter, system-ui, sans-serif';
    ctx.fillText(value, x, y+30);
  });

  // 名言
  ctx.fillStyle = '#38bdf8'; ctx.font = 'italic 18px Inter, system-ui, sans-serif';
  ctx.fillText('"大龄备考不硬背，职场证书轻松过"', 270, 460);

  // 二维码占位
  ctx.fillStyle = '#fff'; ctx.fillRect(195, 520, 150, 150);
  ctx.fillStyle = '#0f172a'; ctx.font = 'bold 13px Inter, system-ui, sans-serif';
  ctx.fillText('扫码开始刷题', 270, 610);

  // 底部CTA
  ctx.fillStyle = '#10b981'; ctx.font = 'bold 22px Inter, system-ui, sans-serif';
  ctx.fillText('极简智考 · 慢慢记', 270, 730);
  ctx.fillStyle = '#64748b'; ctx.font = '14px Inter, system-ui, sans-serif';
  ctx.fillText('碎片时间 · 零基础也能过', 270, 765);
  ctx.fillText('扫描二维码开始免费刷题', 270, 795);

  // 弹出层
  const overlay = document.createElement('div');
  overlay.id = 'poster-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:10001;display:flex;align-items:center;justify-content:center;flex-direction:column;';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = `
    <img src="${canvas.toDataURL('image/png')}" style="max-width:90vw;max-height:80vh;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.5);" />
    <div style="display:flex;gap:12px;margin-top:16px;">
      <button class="cta-primary" onclick="downloadPoster()" style="padding:10px 24px;font-size:14px;">💾 保存图片</button>
      <button class="mode-btn" onclick="document.getElementById('poster-overlay').remove()" style="padding:10px 24px;">关闭</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay._canvas = canvas;
};

window.downloadPoster = function() {
  const overlay = document.getElementById('poster-overlay');
  if (!overlay?._canvas) return;
  const link = document.createElement('a');
  link.download = '学习打卡_' + new Date().toISOString().split('T')[0] + '.png';
  link.href = overlay._canvas.toDataURL('image/png');
  link.click();
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

window.loadAIAnalysis = function() {
  const el = document.getElementById('ai-insights-content');
  if (!el) return;

  const data = window.__dashboard_data;
  if (!data) { el.innerHTML = '⏳ 数据加载中...'; return; }

  const { total, mastery, streak, wrong, dueToday } = data;
  const items = [];

  // 规则1: 总题量不足
  if (total < 20) {
    items.push({ icon: '📝', msg: `已刷${total}题，再刷${20-total}题解锁AI诊断`, color: '#94a3b8' });
  } else {
    // 规则2: 正确率低 → 建议看解析
    if (mastery < 50) {
      items.push({ icon: '🎯', msg: `正确率${mastery}%，建议每题都看完解析再下一题`, color: '#dc2626' });
    }
    // 规则3: 待复习多 → 优先复习
    if (dueToday > 0) {
      items.push({ icon: '🔄', msg: `${dueToday}题等待复习，艾宾浩斯遗忘临界点`, color: '#f59e0b' });
    }
    // 规则4: 连续打卡
    if (streak >= 3) {
      items.push({ icon: '🔥', msg: `连续学习${streak}天！保持节奏，记忆更牢固`, color: '#10b981' });
    } else if (streak >= 1) {
      items.push({ icon: '💪', msg: `已学习${streak}天，连续3天解锁"初露锋芒"勋章`, color: '#0f766e' });
    }
    // 规则5: 错题多 → 错题模式
    if (wrong > 5) {
      items.push({ icon: '📖', msg: `${wrong}道错题待重做，点击下方"错题重做"集中攻克`, color: '#dc2626' });
    }
    // 规则6: 学得好
    if (mastery >= 70 && total >= 20) {
      items.push({ icon: '🚀', msg: `掌握度${mastery}%！可以挑战模拟考试了`, color: '#10b981' });
    }
  }

  // 如果是数据不足状态
  if (total < 5) {
    el.innerHTML = `<div style="text-align:center;padding:8px 0;">${items.map(i => `<div style="font-size:12px;color:${i.color};margin:4px 0;">${i.icon} ${i.msg}</div>`).join('')}</div>`;
    return;
  }

  // 有足够数据
  el.innerHTML = `
    <button class="cta-primary" style="width:100%;margin-bottom:8px;padding:10px;font-size:14px;" onclick="startTargetedPractice()">🎯 针对性练习</button>
    ${items.map(i => `<div style="margin:4px 0;font-size:12px;color:${i.color};">${i.icon} ${i.msg}</div>`).join('')}
  `;
};

window.startTargetedPractice = async function() {
  // 直接使用已有的弱项章节数据，如果没有就随机选题
  const app = document.getElementById('app');
  if (app) app.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh"><div style="text-align:center"><div style="font-size:48px">🎯</div><div style="font-size:16px;font-weight:700">AI正在挑选针对性题目…</div></div></div>';
  try {
    const { default: QuizService } = await import('./services/quiz-service.js');
    const { default: QuizCard } = await import('./components/quiz-card.js');
    const questions = await QuizService.pickQuestions({
      subjectId: State.getActiveSubjectId(),
      mode: 'beginner',
      count: 10,
    });
    if (!questions.length) { window.goHome(); return; }
    State.trackEvent('mode_started', { mode: 'targeted', subjectId: State.getActiveSubjectId() });
    QuizCard.render('beginner', questions);
  } catch(e) { console.error(e); window.goHome(); }
};

// ─── 全局函数 (不在模板内·可执行) ───
window.startAIQuick = async function(prompt) {
  if (!checkPaywall()) return;
  useFreeQuota(5);
  var a = document.getElementById('app');
  a.innerHTML = '<div style=display:flex;align-items:center;justify-content:center;min-height:100vh><div style=text-align:center><div style=font-size:48px>🤖</div><div style=font-size:16px;font-weight:700>AI正在出题...</div></div></div>';
  try {
    console.log('[AI] 调用出题API, prompt:', prompt);
    var r = await generateQuestions({ prompt: prompt, count: prompt.includes('5') ? 5 : 10 });
    console.log('[AI] API返回:', r ? (r.questions ? r.questions.length + '道题' : 'no questions') : 'null');
    if (!r || !r.questions || !r.questions.length) {
      alert('AI出题返回空，请稍后重试（已用离线题库代替）');
      // 直接用离线题目
      r = { questions: [{ id: 'fb-1', stem: '当经济处于衰退期时，政府应采取的财政政策是？', type: 'single', options: ['A. 增加税收','B. 减少政府支出','C. 增加政府支出','D. 提高利率'], answer: 'C', analysis: '扩张性财政政策：增加政府支出刺激总需求。', difficulty: 2, chapter: 8 }] };
    }
    QuizCard.render('advanced', r.questions);
  } catch(e) { console.error('[AI] 异常:', e); alert('出题异常: ' + e.message); window.goHome(); }
};
window.startAIWeak = async function() {
  var a = document.getElementById('app');
  a.innerHTML = '<div style=display:flex;align-items:center;justify-content:center;min-height:100vh><div style=text-align:center><div style=font-size:48px>🎯</div><div style=font-size:16px;font-weight:700>AI分析薄弱项中...</div></div></div>';
  try {
    var progress = JSON.parse(localStorage.getItem('mmj_progress') || '[]');
    var weak = analyzeWeakPoints(progress);
    var chapters = weak.weakest.map(function(w) { return w.num; });
    if (!chapters.length) { alert('请先刷一些题，AI才能分析薄弱项'); window.goHome(); return; }
    var r = await generateWeakPointQuestions(chapters, progress, 10);
    if (!r.questions || !r.questions.length) { alert('出题失败'); window.goHome(); return; }
    QuizCard.render('advanced', r.questions);
  } catch(e) { alert('出题失败: ' + e.message); window.goHome(); }
};
window.startAIFromPrompt = async function() {
  var p = document.getElementById('ai-prompt-input');
  if (!p || !p.value.trim()) { alert('请输入出题要求，如：宏观经济10道中等难度'); return; }
  window.startAIQuick(p.value.trim());
};
window.startAIExam = async function() {
  var a = document.getElementById('app');
  a.innerHTML = '<div style=display:flex;align-items:center;justify-content:center;min-height:100vh><div style=text-align:center><div style=font-size:48px>📝</div><div style=font-size:16px;font-weight:700>AI正在组卷...</div></div></div>';
  try {
    var r = await generateQuestions({ prompt: '模拟考试组卷', count: 20, mode: 'exam', difficulty: 'medium' });
    if (!r.questions || !r.questions.length) { alert('AI组卷失败'); window.goHome(); return; }
    QuizCard.render('mock', r.questions);
  } catch(e) { alert('组卷失败: ' + e.message); window.goHome(); }
};

// ─── 前端错误自动捕获 → 积累知识库 ───
window.addEventListener('error', function(e) {
  var msg = e.message || e.error?.message || 'unknown';
  if (msg === 'unknown' || msg.includes('ResizeObserver')) return; // 忽略无关错误
  var fp = msg.toLowerCase().replace(/[0-9a-f]{8,}/g,'<ID>').slice(0,100);
  var key = 'fe_err_' + fp.replace(/[^a-z]/g,'').slice(0,30);
  var count = parseInt(localStorage.getItem(key) || '0') + 1;
  localStorage.setItem(key, count);
  // 同错误≥3次→上报服务端
  if (count >= 3) {
    fetch('/api/kag/sync', { method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({type:'frontend_error',signature:key,message:msg,count:count,url:location.href}) })
    .catch(function(){});
  }
});
window.addEventListener('unhandledrejection', function(e) {
  var msg = (e.reason?.message || String(e.reason)).slice(0,200);
  var key = 'fe_rej_' + msg.replace(/[^a-z]/g,'').slice(0,30);
  var count = parseInt(localStorage.getItem(key) || '0') + 1;
  localStorage.setItem(key, count);
  if (count >= 3) {
    fetch('/api/kag/sync', { method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({type:'unhandled_rejection',signature:key,message:msg,count:count}) })
    .catch(function(){});
  }
});

// ─── 启动 ───

// R24 SW + R37 Onboarding
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); });
}
import("./components/onboarding.js").then(m => { setTimeout(() => m.maybeShowOnboarding(), 800); });


// ─── SPA导航（无刷新返回首页，即时渲染） ───
window.startCustomExam = function() {
  const count = parseInt(document.getElementById('custom-count')?.value || 20);
  const mode = document.getElementById('custom-mode')?.value || 'advanced';
  startMode(mode === 'mock' ? 'mock' : mode, count);
};
window.goHome = function() {
  const app = document.getElementById("app");
  if (!app) return;
  app.innerHTML = '';
  renderDashboardShell();
  populateDashboardData();
  setTimeout(function() { try { if (typeof injectAIPanels === 'function') injectAIPanels(); if (typeof renderLearningCenter === 'function') renderLearningCenter(); } catch(e) {} }, 50);
};

// ─── 支付模块 (L3组件·单一职责) ───
import('./components/payment.js').then(function(m) {
  m.pollActivation();
  // 挂载到window，等dashboard渲染完再注入
  window.__injectPayment = function() { m.injectTestButton(); m.bindMembershipButtons(); };
});

document.addEventListener('DOMContentLoaded', bootstrap);
