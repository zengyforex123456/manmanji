// L3: 今日任务卡片
export function renderTaskCard(state) {
  var todayDone = parseInt(localStorage.getItem('mmj_today_answers') || '0');
  var dailyTarget = 40;
  var todayPct = Math.round(todayDone / dailyTarget * 100);
  var isSprint = Math.ceil((new Date(2026, 10, 7) - new Date()) / 86400000) <= 30;

  return (isSprint ? '<div class="sprint-banner">⚡ 考前冲刺 · 每日目标 ' + Math.ceil(dailyTarget * 1.5) + ' 题</div>' : '')
    + '<div class="task-card">'
    + '<div class="task-header"><span>📌 今日任务</span><span>' + todayDone + '/' + dailyTarget + ' 题</span></div>'
    + '<div class="task-progress"><div class="task-progress-bar" style="width:' + todayPct + '%"></div></div>'
    + '<button class="btn-primary" onclick="startMode(\'beginner\')">📝 开始刷题去完成 →</button>'
    + '<button class="btn-ghost" onclick="startMode(\'mock\')">📝 模拟考试' + (todayDone < dailyTarget ? ' · 先刷题解锁 →' : ' · 开始挑战 →') + '</button>'
    + '</div>';
}
