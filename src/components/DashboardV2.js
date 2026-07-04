// 极简智考 Dashboard V3 — CSS设计体系
import { getGreeting, getFreeQuota } from './WelcomeBar.js';
import '../style-v2.css';

var THEMES = { navy:'深蓝·稳重', gray:'灰蓝·理性', warm:'暖橙·活力' };

export function renderDashboardV2(state) {
  var themeName = localStorage.getItem('mmj_theme') || 'navy';
  var greeting = getGreeting();
  var name = state.userId ? '考友' : '访客';
  var examDays = Math.ceil((new Date(2026, 10, 7) - new Date()) / 86400000);
  var totalAnswered = state.learnedPointsCount || 0;
  var todayDone = parseInt(localStorage.getItem('mmj_today_answers') || '0');
  var dailyTarget = 40;
  var streak = state.daysStudied || 1;
  var progressPct = Math.min(100, Math.round(totalAnswered / 500 * 100));
  var dailyNeed = Math.ceil((500 - totalAnswered) / Math.max(1, examDays));
  var freeLeft = getFreeQuota();
  var isSprint = examDays <= 30;
  var todayPct = Math.round(todayDone / dailyTarget * 100);

  var progress = [];
  try { progress = JSON.parse(localStorage.getItem('mmj_progress') || '[]'); } catch(e) {}
  var chapterStats = {};
  progress.forEach(function(p) { var ch = p.chapter || 0; if (!ch) return; if (!chapterStats[ch]) chapterStats[ch] = { total: 0, wrong: 0 }; chapterStats[ch].total++; if (p.wrongCount > 0) chapterStats[ch].wrong++; });
  var weakest = Object.entries(chapterStats).filter(function(e) { return e[1].total >= 3; }).map(function(e) { return { num: parseInt(e[0]), acc: Math.round((1 - e[1].wrong / e[1].total) * 100) }; }).sort(function(a, b) { return a.acc - b.acc; }).slice(0, 3);
  var totalChapters = Object.keys(chapterStats).length;

  return '<div data-theme="' + themeName + '">'

    // Theme pills
    + '<div class="theme-pills">'
    + Object.keys(THEMES).map(function(k) {
      return '<button class="theme-pill' + (k === themeName ? ' active' : '') + '" onclick="document.documentElement.setAttribute(\'data-theme\',\'' + k + '\');localStorage.setItem(\'mmj_theme\',\'' + k + '\')">' + THEMES[k] + '</button>';
    }).join('')
    + '</div>'

    // Top bar
    + '<div class="topbar">'
    + '<div class="topbar-greeting">👋 ' + greeting + '，' + name + ' · 连续 <b style="color:var(--c-accent)">' + streak + '</b> 天</div>'
    + '<div class="topbar-stats">'
    + '<span class="topbar-number">' + examDays + '</span><span class="topbar-label">天后考试</span>'
    + '<span class="topbar-sep">|</span>'
    + '<span class="topbar-stat">📊 <b>' + progressPct + '%</b></span>'
    + '<span class="topbar-stat">📝 <b>' + totalAnswered + '</b>题</span>'
    + '<span class="topbar-sep">|</span>'
    + '<span style="font-size:var(--text-sm);color:var(--c-primary);cursor:pointer;font-weight:600;text-decoration:underline" onclick="renderSubjectNav()">切换科目 ▸</span>'
    + '</div></div>'

    // Sprint banner
    + (isSprint ? '<div class="sprint-banner">⚡ 考前冲刺 · 距考试仅 <b>' + examDays + '</b> 天<br><span style="font-size:12px;opacity:.8;font-weight:400">每日目标 ' + Math.ceil(dailyTarget * 1.5) + ' 题 · 重点攻克薄弱章节</span></div>' : '')

    // BKT diagnosis
    + '<div class="bkt-card">'
    + '<div class="bkt-header"><span class="bkt-title">🧠 AI私教诊断</span><span class="bkt-status">' + (totalChapters > 0 ? '已诊断 ' + totalChapters + ' 章' : '刷题后激活') + '</span></div>'
    + (weakest.length > 0
      ? '<div class="bkt-chapters">' + weakest.map(function(w) {
        var color = w.acc < 40 ? 'var(--c-danger)' : w.acc < 60 ? 'var(--c-accent)' : 'var(--c-success)';
        return '<div class="bkt-chapter" onclick="startWeakPractice(' + w.num + ')"><div class="bkt-chapter-num">第' + w.num + '章</div><div class="bkt-chapter-pct" style="color:' + color + '">' + w.acc + '%</div><div class="bkt-chapter-label">掌握度</div></div>';
      }).join('') + '</div>'
      : '<div class="bkt-empty">📝 刷题后自动激活 · AI分析薄弱章节</div>')
    + '</div>'

    // Task card
    + '<div class="task-card">'
    + '<div class="task-header"><span>📌 今日任务</span><span>' + todayDone + '/' + dailyTarget + ' 题</span></div>'
    + '<div class="task-progress"><div class="task-progress-bar" style="width:' + todayPct + '%"></div></div>'
    + '<button class="btn-primary" onclick="startMode(\'beginner\')">📝 开始刷题去完成 →</button>'
    + '<button class="btn-ghost" onclick="startMode(\'mock\')">📝 模拟考试' + (todayDone < dailyTarget ? ' · 先刷题解锁 →' : ' · 开始挑战 →') + '</button>'
    + '</div>'

    // AI Section
    + '<details class="ai-section"><summary class="ai-summary"><span>🧠 AI智能出题<span class="ai-badge">VIP</span></span></summary>'
    + '<div class="ai-body">'
    + '<div class="ai-btns">'
    + '<button class="ai-btn" onclick="startAIQuick(\'10道单选题\')">📊 10道单选</button>'
    + '<button class="ai-btn" onclick="startAIQuick(\'5道计算题\')">📈 5道计算</button>'
    + '<button class="ai-btn" onclick="startAIExam()">📝 组模拟卷</button>'
    + '<button class="ai-btn warn" onclick="startAIWeak()">🎯 薄弱项</button>'
    + '</div>'
    + '<div class="ai-input-row">'
    + '<input class="ai-input" id="ai-prompt-input" placeholder="" onkeydown="if(event.key==\'Enter\')startAIFromPrompt()">'
    + '<button class="ai-btn-submit" onclick="startAIFromPrompt()">🎯 出题</button>'
    + '</div>'
    + '<div class="ai-hints">💬 试试说：<span class="ai-hint" onclick="quickAI(this)">出10道宏观经济单选题</span> · <span class="ai-hint" onclick="quickAI(this)">组一套模拟卷</span> · <span class="ai-hint" onclick="quickAI(this)">GDP核算的题来5道</span></div>'
    + '</div></details>'

    // VIP + More + Weakness
    + (state.membershipTier !== 'vip' ? '<div class="vip-row"><span>🔓 <b>¥68</b>/科 · 今日免费 <b>' + freeLeft + '</b> 题</span><button class="btn-vip" onclick="showPricingModal()">立即升级</button></div>' : '')
    + '<div class="bottom-row"><span>🎮 更多</span><button class="bottom-tag" onclick="startMode(\'advanced\')">🎲 随机</button><button class="bottom-tag" onclick="LC.showChapters()">📚 章节</button></div>'
    + '<div class="weakness-row"><span>🎯 薄弱项靶向练习</span><span class="weakness-hint">📝 刷题后解锁</span></div>'
    + '</div>'

    // Bottom nav
    + '<nav class="bottom-nav">'
    + '<button class="nav-item active" onclick="location.reload()"><span class="nav-icon">📖</span>刷题</button>'
    + '<button class="nav-item" onclick="LoginPage.renderProfile()"><span class="nav-icon">👤</span>我的</button>'
    + '</nav>'

    // AI placeholder rotation
    + '<script>!function(){var t=["出10道宏观经济单选题","组一套模拟卷","GDP核算的题来5道","货币政策单选题5道","财政政策计算题3道","薄弱项专项练习"],i=document.getElementById("ai-prompt-input");i&&(i.placeholder=t[Math.floor(Math.random()*t.length)],setInterval(function(){i.placeholder=t[Math.floor(Math.random()*t.length)]},5000));window.quickAI=function(e){var inp=document.getElementById("ai-prompt-input");inp.value=e.textContent;startAIFromPrompt()}}()</script>';
}
