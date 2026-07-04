// components/AdultFeatures.js — L3: 大龄考生专属功能
// 断点续学·ROI计算·小成就仪式·报名倒计时·分享钩子

// ── 1. 断点续学 ──
export function saveSession(mode, questionIndex, questions) {
  if (!mode || questions.length === 0) return;
  var session = {
    mode: mode,
    index: questionIndex,
    total: questions.length,
    questionId: questions[questionIndex] ? questions[questionIndex].id : null,
    savedAt: Date.now(),
  };
  localStorage.setItem('mmj_last_session', JSON.stringify(session));
}

export function getSavedSession() {
  try {
    var s = JSON.parse(localStorage.getItem('mmj_last_session') || 'null');
    if (!s) return null;
    // 超过24小时不恢复
    if (Date.now() - s.savedAt > 86400000) { localStorage.removeItem('mmj_last_session'); return null; }
    return s;
  } catch(e) { return null; }
}

export function clearSession() { localStorage.removeItem('mmj_last_session'); }

export function showResumeBanner() {
  var session = getSavedSession();
  if (!session) return;
  var existing = document.getElementById('resume-banner');
  if (existing) return;

  var banner = document.createElement('div');
  banner.id = 'resume-banner';
  var minutes = Math.round((Date.now() - session.savedAt) / 60000);
  var timeAgo = minutes < 60 ? minutes + '分钟前' : Math.floor(minutes / 60) + '小时前';

  banner.style.cssText = 'background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:12px 16px;margin:12px 0;display:flex;align-items:center;gap:12px;font-size:13px;cursor:pointer';
  banner.innerHTML = '<span style=font-size:20px>📌</span>'
    + '<span style=flex:1><b>继续上次学习</b><br><span style=color:#92400e;font-size:11px>' + timeAgo + '中断·第' + (session.index+1) + '/' + session.total + '题</span></span>'
    + '<button onclick="resumeLastSession()" style="background:#f59e0b;color:#fff;border:none;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">继续</button>'
    + '<button onclick="document.getElementById(\'resume-banner\').remove();localStorage.removeItem(\'mmj_last_session\')" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:18px">×</button>';

  var main = document.querySelector('.main-content');
  if (main) main.insertBefore(banner, main.firstChild);
}

// ── 2. 考证ROI计算器 ──
export function showROICalculator() {
  if (document.getElementById('roi-modal')) return;
  var m = document.createElement('div');
  m.id = 'roi-modal';
  m.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;display:flex;align-items:center;justify-content:center';
  m.innerHTML = '<div onclick=this.parentElement.remove() style=position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5)></div>'
    + '<div style=position:relative;background:#fff;border-radius:16px;padding:24px;max-width:380px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.3)>'
    + '<h3 style=margin:0>💰 考证回报计算器</h3><p style=color:#64748b;font-size:13px;margin:4px 0 16px>投入 vs 产出·一目了然</p>'
    + '<div style="background:#f0fdf4;border-radius:8px;padding:12px;margin:8px 0">'
    + '<div style="display:flex;justify-content:space-between;font-size:13px;margin:4px 0"><span>投入时间</span><b>4个月·每天15分钟</b></div>'
    + '<div style="display:flex;justify-content:space-between;font-size:13px;margin:4px 0"><span>金钱投入</span><b>¥68（单科卡）</b></div>'
    + '<div style="display:flex;justify-content:space-between;font-size:13px;margin:4px 0;color:#16a34a"><span>预计月薪涨幅</span><b>¥1,000-3,000</b></div>'
    + '<div style="display:flex;justify-content:space-between;font-size:13px;margin:4px 0;color:#16a34a"><span>积分落户加分</span><b>20-60分</b></div>'
    + '<div style="display:flex;justify-content:space-between;font-size:13px;margin:4px 0;color:#16a34a"><span>个税抵扣</span><b>¥3600/年</b></div>'
    + '</div>'
    + '<div style="text-align:center;padding:12px;background:#fef3c7;border-radius:8px;margin:10px 0;font-size:14px;font-weight:700;color:#92400e">ROI = 投入¥68+60h → 年回报¥12,000+</div>'
    + '<button onclick="document.getElementById(\'roi-modal\').remove()" style="display:block;width:100%;padding:10px;background:#e2e8f0;border:none;border-radius:8px;cursor:pointer;font-size:13px">知道了</button>'
    + '</div>';
  document.body.appendChild(m);
}

// ── 3. 小成就仪式 ──
var achievementMessages = [
  { threshold: 10, icon: '🌟', msg: '完成10题！你比自己想象的更坚持' },
  { threshold: 30, icon: '🔥', msg: '30题！已经超过50%的人了' },
  { threshold: 50, icon: '💪', msg: '50题！今天的你比昨天更专业' },
  { threshold: 100, icon: '🏆', msg: '100题里程碑！大龄备考的榜样' },
  { threshold: 200, icon: '👑', msg: '200题！你不是在备考，你是在升级自己' },
  { threshold: 500, icon: '🚀', msg: '500题！拿下经济师只是时间问题' },
];

var lastAchievementShown = 0;
var todayCount = parseInt(localStorage.getItem('mmj_today_answers') || '0');

export function checkAchievement(newTotal) {
  // 找最近一个未触发的成就
  for (var i = 0; i < achievementMessages.length; i++) {
    var a = achievementMessages[i];
    if (newTotal >= a.threshold && lastAchievementShown < a.threshold) {
      lastAchievementShown = a.threshold;
      showAchievementToast(a);
      return;
    }
  }
}

function showAchievementToast(achievement) {
  var toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;background:#1a1a2e;color:#fff;padding:16px 24px;border-radius:12px;text-align:center;font-size:15px;box-shadow:0 8px 32px rgba(0,0,0,.3);animation:fadeIn .3s ease';
  toast.innerHTML = '<div style=font-size:32px>' + achievement.icon + '</div>'
    + '<div style=font-weight:700>' + achievement.msg + '</div>';
  document.body.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 3000);
}

// ── 4. 报名倒计时提醒 ──
export function showRegistrationBanner() {
  var now = new Date();
  // 报名期: 7月22日-8月12日
  var regStart = new Date(2026, 6, 22);
  var regEnd = new Date(2026, 7, 12);
  var examDate = new Date(2026, 10, 7);

  if (now < regStart) {
    var days = Math.ceil((regStart - now) / 86400000);
    return days <= 30 ? '<div style=background:#fef3c7;border-radius:8px;padding:10px 14px;margin:10px 0;font-size:13px>📅 距报名开始还有 <b>' + days + '天</b>（7月22日-8月12日）</div>' : '';
  }
  if (now >= regStart && now <= regEnd) {
    return '<div style=background:#fee2e2;border-radius:8px;padding:10px 14px;margin:10px 0;font-size:13px>🔴 <b>报名窗口已开启！</b>8月12日截止，请尽快完成报名</div>';
  }
  var examDays = Math.ceil((examDate - now) / 86400000);
  return examDays > 0 ? '<div style=background:#f0fdf4;border-radius:8px;padding:10px 14px;margin:10px 0;font-size:13px>✅ 距考试还有 <b>' + examDays + '天</b>（11月7日）· 每天15分钟刚好</div>' : '';
}

// ── 5. 刷完分享钩子 ──
export function showSharePrompt(stats) {
  var total = stats.total || 0;
  var accuracy = stats.accuracy || 0;
  var streak = stats.streak || 1;

  var prompt = document.createElement('div');
  prompt.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;background:#fff;border-radius:16px;padding:24px;max-width:360px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.3);text-align:center';
  prompt.innerHTML = '<div style=font-size:40px;margin-bottom:8px>🎉</div>'
    + '<div style=font-size:18px;font-weight:800;margin-bottom:4px>太棒了！</div>'
    + '<div style=color:#64748b;font-size:13px;line-height:1.6;margin-bottom:16px>你已完成' + total + '题·正确率' + accuracy + '%<br>连续学习' + streak + '天</div>'
    + '<button onclick="showSharePoster()" style=display:block;width:100%;padding:12px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin:4px 0>📸 生成打卡海报</button>'
    + '<button onclick="showROICalculator()" style=display:block;width:100%;padding:12px;background:#fef3c7;color:#92400e;border:none;border-radius:8px;font-size:13px;cursor:pointer;margin:4px 0>💰 查看考证回报</button>'
    + '<button onclick="this.parentElement.remove()" style=background:none;border:none;color:#94a3b8;cursor:pointer;font-size:12px;margin-top:4px">继续刷题</button>';
  document.body.appendChild(prompt);
}

// 全局挂载
window.showROICalculator = showROICalculator;
window.resumeLastSession = async function() {
  var session = getSavedSession();
  if (!session) return;
  var banner = document.getElementById('resume-banner');
  if (banner) banner.remove();
  try {
    var { QuizCard } = await import('./quiz-card.js');
    var { QuizService } = await import('../services/quiz-service.js');
    var questions = await QuizService.pickQuestions({ subjectId: 'econ', mode: session.mode, count: session.total });
    QuizCard.render(session.mode, questions, session.index);
  } catch(e) { window.goHome(); }
};
