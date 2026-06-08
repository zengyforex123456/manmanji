// 极简学习内容选择中心 — 大龄考生优化版
// 原则：渐进呈现 / 即时渲染 / 智能推荐优先 / 每步有说明
import { State } from '../core/state.js';
import { DB } from '../core/db.js';
import { Ebbinghaus } from '../services/ebbinghaus.js';
import { getSubjectMeta } from '../data/subjects-meta.js';

export function renderLearningCenter() {
  const lcEl = document.getElementById('learning-center');
  if (!lcEl) return;
  // 即时渲染骨架（0ms）
  lcEl.innerHTML = renderShell();
  // 异步填充数据
  loadData();
}

// ─── 即时骨架（0ms，无数据依赖） ───
function renderShell() {
  return `
    <div class="lc-section">
      <div class="lc-section-title">📌 推荐学习</div>
      <div class="lc-section-hint">根据你的学习进度智能推荐，直接点击开始</div>
      <div id="lc-recommend" class="lc-recommend-shell">
        <div class="lc-card lc-card-main" onclick="LC.startRecommended()">
          <div class="lc-card-icon">📝</div>
          <div class="lc-card-title">继续学习</div>
          <div class="lc-card-desc">加载中…</div>
        </div>
      </div>
    </div>

    <div class="lc-section">
      <div class="lc-section-title">🎯 专项练习</div>
      <div class="lc-section-hint">选择需要重点突破的内容</div>
      <div class="lc-quick-grid">
        <div class="lc-card" onclick="LC.startWeak()">
          <div class="lc-card-icon">🔍</div>
          <div class="lc-card-title">弱项攻克</div>
          <div class="lc-card-desc">加载中…</div>
        </div>
        <div class="lc-card" onclick="LC.startMistake()">
          <div class="lc-card-icon">📖</div>
          <div class="lc-card-title">错题本</div>
          <div class="lc-card-desc">加载中…</div>
        </div>
        <div class="lc-card" onclick="LC.startMock()">
          <div class="lc-card-icon">⏱️</div>
          <div class="lc-card-title">模拟考试</div>
          <div class="lc-card-desc">105题·90分钟·全真环境</div>
        </div>
        <div class="lc-card" onclick="LC.showChapters()">
          <div class="lc-card-icon">📚</div>
          <div class="lc-card-title">章节练习</div>
          <div class="lc-card-desc">按章节逐一学习</div>
        </div>
      </div>
    </div>

    <div class="lc-section" id="lc-chapters-section" style="display:none"></div>

    <div class="lc-empty-hint">
      💡 <b>使用说明</b>：点击上方卡片即可开始学习。<br>
      系统会自动记录你的答题情况，在「继续学习」中推荐最需要复习的内容。
    </div>
  `;
}

// ─── 异步填充数据 ───
async function loadData() {
  const sid = State.getActiveSubjectId();
  try {
    const progress = await DB.getProgress(sid);
    const stats = {
      dueCount: 0, totalAnswered: progress.length, wrongCount: 0,
      weakChapter: null, weakMastery: null,
    };

    const now = Date.now();
    const chWrong = {};
    progress.forEach(p => {
      if (p.nextReview && p.nextReview <= now) stats.dueCount++;
      if (p.wrongCount > 0) {
        stats.wrongCount++;
        const ch = p.chapter || 0;
        chWrong[ch] = (chWrong[ch] || 0) + 1;
      }
    });

    // 找最弱章节
    let maxWrong = 0;
    Object.entries(chWrong).forEach(([ch, count]) => {
      if (count > maxWrong) { maxWrong = count; stats.weakChapter = parseInt(ch); }
    });
    stats.weakMastery = stats.totalAnswered > 0
      ? Math.round((1 - stats.wrongCount / stats.totalAnswered) * 100) : 0;

    // 更新推荐卡片
    updateRecommendCard(stats);
    updateWeakCard(stats);
    updateMistakeCard(stats);

    // 存储数据供后续使用
    window._lcStats = stats;
  } catch(e) { console.warn('LC data load:', e); }
}

function updateRecommendCard(stats) {
  const el = document.querySelector('#lc-recommend .lc-card-desc');
  if (!el) return;
  if (stats.dueCount > 0) {
    el.textContent = `${stats.dueCount} 道题等待复习 · 建议优先完成`;
    document.querySelector('#lc-recommend .lc-card-icon').textContent = '🔄';
    document.querySelector('#lc-recommend .lc-card-title').textContent = '待复习';
  } else if (stats.totalAnswered > 0) {
    el.textContent = `已答 ${stats.totalAnswered} 题 · 掌握度 ${stats.weakMastery}%`;
    document.querySelector('#lc-recommend .lc-card-title').textContent = '学新内容';
  } else {
    el.textContent = '从第2章「需求与弹性」开始学习';
    document.querySelector('#lc-recommend .lc-card-title').textContent = '开始学习';
  }
}

function updateWeakCard(stats) {
  const el = document.querySelectorAll('#lc-recommend + .lc-section .lc-card')[0];
  const descEl = el?.querySelector('.lc-card-desc');
  if (descEl && stats.weakChapter) {
    descEl.textContent = `第${stats.weakChapter}章需加强`;
  } else if (descEl) {
    descEl.textContent = '完成答题后自动识别弱项';
  }
}

function updateMistakeCard(stats) {
  const cards = document.querySelectorAll('.lc-card');
  cards.forEach(card => {
    if (card.querySelector('.lc-card-title')?.textContent === '错题本') {
      const desc = card.querySelector('.lc-card-desc');
      if (desc) desc.textContent = stats.wrongCount > 0 ? `${stats.wrongCount} 道错题待重做` : '暂无错题，继续保持';
    }
  });
}

// ─── 章节选择（按需展开，不预渲染37章） ───
window.LC = window.LC || {};
window.LC.showChapters = async function() {
  const section = document.getElementById('lc-chapters-section');
  if (!section) return;
  if (section.style.display === 'block') { section.style.display = 'none'; return; }

  const meta = getSubjectMeta(State.getActiveSubjectId());
  if (!meta) return;

  // 快速渲染模块列表
  const stats = window._lcStats || { chapterDone: {}, chapterTotal: {} };
  section.innerHTML = `
    <div class="lc-section-title">📚 章节练习</div>
    <div class="lc-section-hint">点击章节开始刷题 · <span style="color:#dc2626">红</span>=核心 <span style="color:#f59e0b">黄</span>=高频 <span style="color:#94a3b8">灰</span>=基础</div>
    ${(meta.modules || []).map(m => `
      <div class="lc-module-name" style="font-size:13px;font-weight:700;color:#334155;margin:12px 0 4px">${m.name} <span style="font-weight:400;font-size:11px;color:#94a3b8">占分${Math.round(m.weight*100)}%</span></div>
      <div class="lc-chapter-row">
        ${(m.chapters || []).map(chNum => {
          const ch = meta.chapters.find(c => c.id === chNum);
          if (!ch) return '';
          const colors = {1:'#dc2626',2:'#f59e0b',3:'#94a3b8'};
          return `<span class="lc-chapter-chip" style="border-left:3px solid ${colors[ch.tier]||colors[3]}" onclick="LC.startChapter(${chNum})" title="${ch.name}">
            <span class="chip-num">${chNum}</span>
            <span class="chip-name">${ch.name.replace(/第.+章\s*/,'').substring(0,6)}</span>
          </span>`;
        }).join('')}
      </div>
    `).join('')}
  `;
  section.style.display = 'block';
};

window.LC.startRecommended = function() {
  const stats = window._lcStats || {};
  if (stats.dueCount > 0) window.startMode('mistake');
  else window.startMode('beginner');
};
window.LC.startWeak = function() { window.startMode('mistake'); };
window.LC.startMistake = function() { window.startMode('mistake'); };
window.LC.startMock = function() { window.startMode('mock'); };
window.LC.startChapter = async function(chNum) {
  const sid = State.getActiveSubjectId();
  try {
    const { QuizService } = await import('../services/quiz-service.js');
    const { QuizCard } = await import('./quiz-card.js');
    const qs = await QuizService.pickQuestions({ subjectId: sid, mode: 'beginner', chapter: chNum, count: 10 });
    QuizCard.render('beginner', qs);
  } catch(e) { window.startMode('beginner'); }
};
