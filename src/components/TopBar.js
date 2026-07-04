// L3: 顶部栏 — 问候·倒计时·统计
import { getGreeting, getExamMonths } from './WelcomeBar.js';

export function renderTopBar(state) {
  var examDays = Math.ceil((new Date(2026, 10, 7) - new Date()) / 86400000);
  var totalAnswered = state.learnedPointsCount || 0;
  var progressPct = Math.min(100, Math.round(totalAnswered / 500 * 100));
  var streak = state.daysStudied || 1;
  var name = state.userId ? '考友' : '访客';

  return '<div class="topbar">'
    + '<div class="topbar-greeting">👋 ' + getGreeting() + '，' + name + ' · 连续 <b style="color:var(--c-accent)">' + streak + '</b> 天</div>'
    + '<div class="topbar-stats">'
    + '<span class="topbar-number">' + examDays + '</span><span class="topbar-label">天后考试</span>'
    + '<span class="topbar-sep">|</span>'
    + '<span class="topbar-stat">📊 <b>' + progressPct + '%</b></span>'
    + '<span class="topbar-stat">📝 <b>' + totalAnswered + '</b>题</span>'
    + '<span class="topbar-sep">|</span>'
    + '<span class="topbar-link" onclick="toggleSubjects()">切换科目 ▸</span>'
    + '</div></div>';
}
