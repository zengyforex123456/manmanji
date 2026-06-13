// src/components/badges.js — 打卡勋章 + 成就系统
// 连续打卡+刷题里程碑+正确率勋章
import { State } from '../core/state.js';
import { DB } from '../core/db.js';

// ─── 勋章定义 ───
const BADGES = [
  { id: 'streak_3', name: '初露锋芒', icon: '🌱', desc: '连续学习3天', check: (s) => (s.daysStudied||0) >= 3 },
  { id: 'streak_7', name: '坚持不懈', icon: '🔥', desc: '连续学习7天', check: (s) => (s.daysStudied||0) >= 7 },
  { id: 'streak_30', name: '学习成瘾', icon: '⚡', desc: '连续学习30天', check: (s) => (s.daysStudied||0) >= 30 },
  { id: 'streak_100', name: '学习王者', icon: '👑', desc: '连续学习100天', check: (s) => (s.daysStudied||0) >= 100 },
  { id: 'quiz_100', name: '刷题新秀', icon: '📝', desc: '累计刷题100道', check: (s, p) => p.total >= 100 },
  { id: 'quiz_500', name: '刷题达人', icon: '📚', desc: '累计刷题500道', check: (s, p) => p.total >= 500 },
  { id: 'quiz_1000', name: '刷题狂魔', icon: '💪', desc: '累计刷题1000道', check: (s, p) => p.total >= 1000 },
  { id: 'quiz_5000', name: '题库终结者', icon: '🏆', desc: '累计刷题5000道', check: (s, p) => p.total >= 5000 },
  { id: 'accuracy_70', name: '渐入佳境', icon: '📈', desc: '正确率达到70%', check: (s, p) => p.total>=50 && p.mastery >= 70 },
  { id: 'accuracy_90', name: '学霸附体', icon: '🧠', desc: '正确率达到90%', check: (s, p) => p.total>=50 && p.mastery >= 90 },
  { id: 'perfect_10', name: '十全十美', icon: '🎯', desc: '连续10题全对', check: (s, p) => (p.consecutiveCorrect||0) >= 10 },
  { id: 'multi_subj', name: '博学多才', icon: '🎓', desc: '学习3个以上科目', check: (s, p) => (p.subjectsCount||0) >= 3 },
  { id: 'mock_master', name: '模考达人', icon: '📋', desc: '完成模考且80分+', check: (s, p) => (p.bestMockScore||0) >= 80 },
];

// 已解锁勋章（从localStorage读取）
let unlocked = [];
try { unlocked = JSON.parse(localStorage.getItem('mmj_badges') || '[]'); } catch(e) { unlocked = []; }

function saveUnlocked() {
  localStorage.setItem('mmj_badges', JSON.stringify(unlocked));
}

// ─── 检查并解锁 ───
export async function checkBadges() {
  const state = State.state;
  const sid = State.getActiveSubjectId();
  const progress = await DB.getProgress(sid);

  // 聚合进度
  let total = 0, wrong = 0, consecutiveCorrect = 0;
  progress.forEach(p => { total++; if (p.wrongCount > 0) wrong++; });
  // 计算连续正确数
  const sorted = progress.sort((a,b) => (b.lastReview||'') - (a.lastReview||''));
  for (const p of sorted) {
    if (p.wrongCount === 0) consecutiveCorrect++;
    else break;
  }

  const mastery = total >= 50 ? Math.round((total - wrong) / total * 100) : 0;
  const subjectsCount = Object.keys(state.subjectsState || {}).length;
  const bestMockScore = state.bestMockScore || 0;
  const stats = { total, mastery, consecutiveCorrect, subjectsCount, bestMockScore };

  const newlyUnlocked = [];
  BADGES.forEach(badge => {
    if (unlocked.includes(badge.id)) return;
    if (badge.check(state, stats)) {
      unlocked.push(badge.id);
      newlyUnlocked.push(badge);
    }
  });

  if (newlyUnlocked.length > 0) {
    saveUnlocked();
    newlyUnlocked.forEach(b => {
      showBadgeToast(b);
    });
  }
}

// ─── Toast 通知 ───
function showBadgeToast(badge) {
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:10000;background:#0f172a;color:#fbbf24;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:700;box-shadow:0 10px 40px rgba(0,0,0,0.3);animation:slideDown 0.3s ease-out;text-align:center;';
  toast.innerHTML = `🏆 新勋章解锁！${badge.icon} ${badge.name}<br><span style="font-size:11px;color:#94a3b8;">${badge.desc}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.5s'; }, 2500);
  setTimeout(() => toast.remove(), 3000);
}

// ─── 渲染勋章墙 ───
export function renderBadgeWall(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const unlockedCount = unlocked.length;
  const totalCount = BADGES.length;

  container.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">
      ${BADGES.map(b => {
        const isUnlocked = unlocked.includes(b.id);
        return `<div style="text-align:center;padding:8px;width:70px;opacity:${isUnlocked ? '1' : '0.3'};filter:${isUnlocked ? 'none' : 'grayscale(1)'};">
          <div style="font-size:28px;">${b.icon}</div>
          <div style="font-size:9px;font-weight:700;margin-top:2px;${isUnlocked ? 'color:#0f172a;' : 'color:#94a3b8;'}">${b.name}</div>
          <div style="font-size:8px;color:#94a3b8;">${b.desc}</div>
        </div>`;
      }).join('')}
    </div>
    <div style="text-align:center;margin-top:8px;font-size:11px;color:#64748b;">
      已解锁 ${unlockedCount}/${totalCount} 枚勋章
    </div>`;
}

// 全局挂载
window.Badges = { checkBadges, renderBadgeWall };
