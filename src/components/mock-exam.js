// 全屏沉浸式模拟考试界面
import { Ebbinghaus } from '../services/ebbinghaus.js';
import { QuizService } from '../services/quiz-service.js';
import { State } from '../core/state.js';
import { Timer } from './timer.js';

let _questions = [];
let _answers = {};       // { questionId: selectedKey }
let _marks = {};         // { questionId: true }
let _currentIdx = 0;
let _totalTime = 0;
let _autoSaveTimer = null;

// ─── 入口 ───
export async function renderMockExam(mode, questions) {
  _questions = questions;
  _answers = {};
  _marks = {};
  _currentIdx = 0;
  _totalTime = questions.length > 50 ? 90 * 60 : 90 * 60;

  // 强制全屏
  try { await document.documentElement.requestFullscreen(); } catch (e) {}

  renderFrame();
  Timer.start(_totalTime, () => autoSubmit());
  startAutoSave();
}

// ─── 三栏框架 ───
function renderFrame() {
  const app = document.getElementById('app');
  const q = _questions[_currentIdx];
  const total = _questions.length;
  const answered = Object.keys(_answers).length;
  const progress = Math.round(answered / total * 100);

  app.innerHTML = `
    <div class="mock-container" id="mock-container">
      <!-- 左侧：题号导航 -->
      <aside class="mock-nav" id="mock-nav">
        <div class="mock-nav-title">题号导航</div>
        <div class="mock-nav-grid" id="mock-nav-grid">
          ${_questions.map((q, i) => {
            let cls = 'nav-num';
            if (_answers[q.id]) cls += ' answered';
            if (_marks[q.id]) cls += ' marked';
            if (i === _currentIdx) cls += ' current';
            return `<div class="${cls}" onclick="MockExam.jumpTo(${i})" title="第${i+1}题${_marks[q.id] ? ' (已标记)' : ''}">${i + 1}</div>`;
          }).join('')}
        </div>
        <div class="mock-nav-legend">
          <span class="legend-dot answered"></span>已答
          <span class="legend-dot"></span>未答
          <span class="legend-dot marked"></span>标记
          <span class="legend-dot current"></span>当前
        </div>
      </aside>

      <!-- 中央：答题区 -->
      <main class="mock-main">
        <div class="mock-question-header">
          <span class="mock-q-num">第 ${_currentIdx + 1} 题</span>
          <span class="mock-q-type">${q.type === 'multiple' ? '多选题' : q.type === 'case' ? '案例分析' : '单选题'}</span>
          <span class="mock-q-chapter">${q.chapter ? '第' + q.chapter + '章' : ''}</span>
          <span class="mock-mark-btn" id="mock-mark-btn" onclick="MockExam.toggleMark()">
            ${_marks[q.id] ? '⭐ 已标记' : '☆ 标记'}
          </span>
        </div>

        <div class="mock-stem">${q.stem}</div>

        <div class="mock-options" id="mock-options">
          ${(q.options || []).map((opt, i) => {
            const letter = String.fromCharCode(65 + i);
            const selected = _answers[q.id]?.includes(letter);
            return `<div class="mock-option${selected ? ' selected' : ''}" data-letter="${letter}" onclick="MockExam.selectAnswer('${letter}')">
              <span class="mock-option-key">${letter}</span>
              <span>${opt}</span>
            </div>`;
          }).join('')}
        </div>

        <div class="mock-nav-btns">
          <button class="mock-btn" onclick="MockExam.prevQ()" ${_currentIdx === 0 ? 'disabled' : ''}>← 上一题</button>
          <span class="mock-q-progress">${_currentIdx + 1} / ${total}</span>
          <button class="mock-btn" onclick="MockExam.nextQ()" ${_currentIdx === total - 1 ? 'disabled' : ''}>下一题 →</button>
        </div>
      </main>

      <!-- 右侧：信息栏 -->
      <aside class="mock-info">
        <div class="mock-info-card">
          <div class="mock-timer-label">剩余时间</div>
          <div class="mock-timer" id="mock-timer-display">90:00</div>
        </div>
        <div class="mock-info-card">
          <div class="mock-progress-label">答题进度</div>
          <div class="mock-progress-bar"><div class="mock-progress-fill" style="width:${progress}%"></div></div>
          <div class="mock-progress-text">${answered} / ${total} 题（${progress}%）</div>
        </div>
        <div class="mock-info-card">
          <div class="mock-stat-row"><span>✅ 已答</span><span>${answered}</span></div>
          <div class="mock-stat-row"><span>⬜ 未答</span><span>${total - answered}</span></div>
          <div class="mock-stat-row"><span>⭐ 标记</span><span>${Object.keys(_marks).length}</span></div>
        </div>
        <div class="mock-info-card" id="mock-answer-card" style="max-height:30vh;overflow-y:auto">
          ${renderAnswerCard()}
        </div>
        <button class="mock-submit-btn" onclick="MockExam.submitExam()">📝 交卷</button>
      </aside>
    </div>
  `;

  window.MockExam = { jumpTo, selectAnswer, nextQ, prevQ, toggleMark, submitExam };
  document.addEventListener('fullscreenchange', onFullscreenChange);
}

// ─── 答题卡 ───
function renderAnswerCard() {
  const total = _questions.length;
  const answered = Object.keys(_answers).length;
  if (answered === 0) return '<div style="text-align:center;color:var(--text-secondary);padding:16px">暂无作答</div>';
  return `
    <div style="font-weight:700;font-size:13px;margin-bottom:8px">📋 答题卡</div>
    <div class="mock-answer-mini-grid">
      ${_questions.map((q, i) => {
        let cls = 'mini-item';
        if (_answers[q.id]) cls += ' answered';
        if (_marks[q.id]) cls += ' marked';
        if (i === _currentIdx) cls += ' current';
        return `<span class="${cls}" onclick="MockExam.jumpTo(${i})">${i + 1}</span>`;
      }).join('')}
    </div>`;
}

// ─── 操作 ───
function selectAnswer(letter) {
  const q = _questions[_currentIdx];
  if (q.type === 'single') {
    _answers[q.id] = letter;
  } else {
    // 多选：toggle
    const current = _answers[q.id] || '';
    _answers[q.id] = current.includes(letter)
      ? current.replace(letter, '')
      : (current + letter).split('').sort().join('');
  }
  saveProgress();
  refreshCurrentQuestion();
}

function jumpTo(idx) {
  _currentIdx = Math.max(0, Math.min(_questions.length - 1, idx));
  refreshCurrentQuestion();
}

function nextQ() {
  if (_currentIdx < _questions.length - 1) {
    _currentIdx++;
    refreshCurrentQuestion();
  }
}

function prevQ() {
  if (_currentIdx > 0) {
    _currentIdx--;
    refreshCurrentQuestion();
  }
}

function toggleMark() {
  const q = _questions[_currentIdx];
  _marks[q.id] = !_marks[q.id];
  refreshCurrentQuestion();
}

// ─── 局部刷新当前题 ───
function refreshCurrentQuestion() {
  const q = _questions[_currentIdx];
  // 刷新题号导航样式
  document.querySelectorAll('.nav-num').forEach((el, i) => {
    el.classList.toggle('current', i === _currentIdx);
    el.classList.toggle('answered', !!_answers[_questions[i].id]);
    el.classList.toggle('marked', !!_marks[_questions[i].id]);
  });
  // 刷新题干
  const stemEl = document.querySelector('.mock-stem');
  const typeEl = document.querySelector('.mock-q-type');
  const numEl = document.querySelector('.mock-q-num');
  const chEl = document.querySelector('.mock-q-chapter');
  const markBtn = document.getElementById('mock-mark-btn');
  const optionsEl = document.getElementById('mock-options');
  const progressEl = document.querySelector('.mock-q-progress');
  const navBtns = document.querySelector('.mock-nav-btns');
  const total = _questions.length;

  if (stemEl) stemEl.textContent = q.stem;
  if (typeEl) typeEl.textContent = q.type === 'multiple' ? '多选题' : q.type === 'case' ? '案例分析' : '单选题';
  if (numEl) numEl.textContent = `第 ${_currentIdx + 1} 题`;
  if (chEl) chEl.textContent = q.chapter ? '第' + q.chapter + '章' : '';
  if (markBtn) markBtn.innerHTML = _marks[q.id] ? '⭐ 已标记' : '☆ 标记';
  if (progressEl) progressEl.textContent = `${_currentIdx + 1} / ${total}`;

  if (optionsEl) {
    optionsEl.innerHTML = (q.options || []).map((opt, i) => {
      const letter = String.fromCharCode(65 + i);
      const selected = (_answers[q.id] || '').includes(letter);
      return `<div class="mock-option${selected ? ' selected' : ''}" data-letter="${letter}" onclick="MockExam.selectAnswer('${letter}')">
        <span class="mock-option-key">${letter}</span>
        <span>${opt}</span>
      </div>`;
    }).join('');
  }

  if (navBtns) {
    navBtns.innerHTML = `
      <button class="mock-btn" onclick="MockExam.prevQ()" ${_currentIdx === 0 ? 'disabled' : ''}>← 上一题</button>
      <span class="mock-q-progress">${_currentIdx + 1} / ${total}</span>
      <button class="mock-btn" onclick="MockExam.nextQ()" ${_currentIdx === total - 1 ? 'disabled' : ''}>下一题 →</button>
    `;
  }

  // 刷新右侧统计
  updateStats();
}

function updateStats() {
  const total = _questions.length;
  const answered = Object.keys(_answers).length;
  const marked = Object.keys(_marks).length;
  const progress = Math.round(answered / total * 100);

  const fill = document.querySelector('.mock-progress-fill');
  const text = document.querySelector('.mock-progress-text');
  const stats = document.querySelectorAll('.mock-stat-row span:last-child');
  if (fill) fill.style.width = progress + '%';
  if (text) text.textContent = `${answered} / ${total} 题（${progress}%）`;
  if (stats.length >= 3) {
    stats[0].textContent = answered;
    stats[1].textContent = total - answered;
    stats[2].textContent = marked;
  }
  // 刷新答题卡
  const card = document.getElementById('mock-answer-card');
  if (card) card.innerHTML = `<div style="font-weight:700;font-size:13px;margin-bottom:8px">📋 答题卡</div>` + renderAnswerCard().replace('暂无作答', '');
}

// ─── 自动保存 ───
function saveProgress() {
  State.saveNow();
}

function startAutoSave() {
  _autoSaveTimer = setInterval(() => {
    saveProgress();
  }, 30000); // 每30秒自动保存
}

// ─── 交卷 ───
function submitExam() {
  const total = _questions.length;
  const answered = Object.keys(_answers).length;
  const unmarked = total - answered;

  if (unmarked > 0) {
    const msg = `还有 ${unmarked} 题未作答，确定交卷吗？`;
    if (!confirm(msg)) return;
  } else {
    if (!confirm('确定提交答卷吗？提交后不可修改。')) return;
  }

  // 二次确认
  if (!confirm('再次确认：提交答卷？')) return;

  finalSubmit();
}

function autoSubmit() {
  Timer.stop();
  clearInterval(_autoSaveTimer);
  finalSubmit();
}

async function finalSubmit() {
  Timer.stop();
  clearInterval(_autoSaveTimer);
  try { await document.exitFullscreen(); } catch (e) {}

  // 评分
  let correct = 0;
  const wrongList = [];
  _questions.forEach(q => {
    const userAns = _answers[q.id] || '';
    const isCorrect = q.type === 'multiple'
      ? userAns === q.answer  // 多选全对才正确
      : userAns === q.answer;
    if (isCorrect) correct++;
    else if (userAns) wrongList.push({ ...q, userAnswer: userAns });
  });

  // R21: 保存进度
  for (const q of _questions) {
    const userAns = _answers[q.id] || '';
    const isCorrect = q.type === 'multiple' ? userAns === q.answer : userAns === q.answer;
    try { await Ebbinghaus.recordReview(q.id, isCorrect ? 4 : 2); } catch (e) {}
  }
  State.saveNow();

  const total = _questions.length;
  const rate = Math.round(correct / total * 100);
  const elapsed = _totalTime - Timer.getElapsed();

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="mock-container">
      <main class="mock-main" style="max-width:600px;margin:40px auto">
        <div style="text-align:center;font-size:48px;margin-bottom:16px">${rate >= 60 ? '🎉' : '💪'}</div>
        <h2 style="text-align:center;margin-bottom:24px">模拟考试完成</h2>
        <div class="mock-result-card">
          <div class="mock-score">${rate}分</div>
          <div class="mock-score-detail">${correct} / ${total} 题正确</div>
          <div class="mock-score-detail">用时 ${Math.floor(elapsed/60)}分${elapsed%60}秒</div>
        </div>
        ${wrongList.length > 0 ? `
        <div class="recent-section" style="margin-top:20px">
          <div class="section-title">❌ 错题列表（${wrongList.length}题）</div>
          ${wrongList.slice(0, 10).map((q, i) => `
            <div class="wrong-item" style="padding:8px 12px;border-bottom:1px solid var(--border-color);font-size:13px;line-height:1.5">
              <span style="color:var(--accent);font-weight:700">${i+1}.</span>
              <span style="color:#dc2626">答${q.userAnswer}</span>
              ${q.stem.substring(0, 60)}...
            </div>
          `).join('')}
          ${wrongList.length > 10 ? `<div style="text-align:center;padding:8px;color:var(--text-secondary)">...还有 ${wrongList.length - 10} 道错题</div>` : ''}
        </div>` : ''}
        <div class="mode-grid" style="margin-top:20px">
          <button class="mode-btn" onclick="window.goHome()">🏠 返回首页</button>
          <button class="mode-btn" onclick="window.goHome()">🔄 再来一套</button>
        </div>
      </main>
    </div>
  `;
}

// ─── 全屏变化处理 ───
function onFullscreenChange() {
  if (!document.fullscreenElement) {
    // 退出全屏时提醒
    const container = document.getElementById('mock-container');
    if (container && !document.querySelector('.mock-fullscreen-warn')) {
      const warn = document.createElement('div');
      warn.className = 'mock-fullscreen-warn';
      warn.innerHTML = `<span>⚠️ 已退出全屏模式</span><button onclick="document.documentElement.requestFullscreen()">恢复全屏</button>`;
      container.prepend(warn);
      setTimeout(() => warn.remove(), 5000);
    }
  }
}

// 暂停计时器时退出全屏（暂存退出 R39）
export async function pauseAndExit() {
  Timer.stop();
  clearInterval(_autoSaveTimer);
  saveProgress();
  try { await document.exitFullscreen(); } catch (e) {}
}
