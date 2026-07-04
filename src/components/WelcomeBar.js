// L3: 欢迎栏组件 — loading·正常·error三态
export function renderWelcomeBar(state) {
  var greeting = getGreeting();
  var vipTag = (state.userId && state.membershipTier === 'vip')
    ? '<span style=background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;font-size:11px>💎 VIP</span>' : '';
  var examMonths = getExamMonths();
  var freeQuota = (state.membershipTier === 'vip') ? ' · VIP无限刷题' : (' · 今日免费' + getFreeQuota() + '题');

  return '<div class="welcome-row">'
    + '<span class="welcome-text" data-testid="greeting">👋 ' + greeting + '，' + (state.userId ? '考友' : '访客') + ' ' + vipTag + '</span>'
    + '<span class="exam-countdown" data-testid="exam-countdown" data-countdown="true">' + (state.userId ? '已登录' : '距考试约 ' + examMonths + ' 个月') + freeQuota + '</span>'
    + '</div>';
}

// 导出更新函数（组件契约：调用方用这个更新DOM，不直接操作）
export function updateCountdown(state) {
  var el = document.querySelector('[data-countdown]');
  if (!el) return;
  var months = getExamMonths();
  var freeQuota = (state.membershipTier === 'vip') ? ' · VIP无限刷题' : (' · 今日免费' + getFreeQuota() + '题');
  el.textContent = (state.userId ? '已登录' : '距考试约 ' + months + ' 个月') + freeQuota;
}

function getGreeting() { var h = new Date().getHours(); if (h < 12) return '早上好'; if (h < 18) return '下午好'; return '晚上好'; }

function getExamMonths() {
  var now = new Date(), year = now.getFullYear();
  var nov1 = new Date(year, 10, 1), dayOfWeek = nov1.getDay();
  var firstSat = 1 + (6 - dayOfWeek + 7) % 7;
  var examDate = new Date(year, 10, firstSat);
  if (now > examDate) examDate = new Date(year + 1, 10, firstSat);
  var months = (examDate.getFullYear() - now.getFullYear()) * 12 + (examDate.getMonth() - now.getMonth());
  if (!localStorage.getItem('mmj_exam_date')) localStorage.setItem('mmj_exam_date', examDate.toISOString().slice(0, 10));
  return months;
}

var FREE_DAILY_LIMIT = 20;
function getFreeQuota() {
  var today = new Date().toDateString(), key = 'mmj_daily_' + today;
  var used = parseInt(localStorage.getItem(key) || '0');
  return Math.max(0, FREE_DAILY_LIMIT - used);
}
export { getFreeQuota, FREE_DAILY_LIMIT, getExamMonths, getGreeting };
