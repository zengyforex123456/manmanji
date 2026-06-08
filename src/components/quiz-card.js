// src/components/quiz-card.js — 刷题卡片组件 Phase 3
// R10: 冲刺模式 + R11: 错题模式 + R12: 即时反馈 + R37: 引导 + R38: 再来一组

import { Ebbinghaus } from '../services/ebbinghaus.js';
import { QuizService } from '../services/quiz-service.js';
import { State } from '../core/state.js';
import { Timer } from './timer.js';

let _currentQuestion = null;
let _currentMode = null;
let _questions = [];
let _currentIndex = 0;
let _correctCount = 0;
let _answered = false; // R8: 必须先选择再看答案

// ─── 渲染刷题界面 ───
function render(mode, questions) {
  _currentMode = mode;
  _questions = questions;
  _currentIndex = 0;
  _correctCount = 0;
  _answered = false;

  if (!questions.length) {
    showEmpty(mode);
    return;
  }

  // R10: 冲刺模式启动倒计时
  if (mode === 'mock') {
    Timer.start(90 * 60, () => submitMock());
  }

  renderQuestion(questions[0]);
}

// R10: 冲刺自动提交
function submitMock() {
  Timer.stop();
  finish();
}

// R39: 暂存退出
function saveAndExit() {
  Timer.stop();
  State.setLastSession(_questions[_currentIndex]?.id, _currentMode, State.getActiveSubjectId());
  State.saveNow();
  window.window.goHome();
}

// ─── 渲染单题 ───
function renderQuestion(q, showFeedback = false) {
  _currentQuestion = q;
  _answered = showFeedback;
  const app = document.getElementById('app');
  if (!app) return;

  const total = _questions.length;
  const idx = _currentIndex + 1;

  const optionsHtml = (q.options || []).map((opt, i) => {
    const letter = String.fromCharCode(65 + i);
    let cls = 'option-btn';
    if (showFeedback) {
      const ansLetters = (q.answer || '').toUpperCase().split('');
      const isCorrect = ansLetters.includes(letter);
      if (isCorrect) cls += ' option-correct';
      else cls += ' option-wrong';
      cls += ' option-disabled';
    }
    return `<button class="${cls}" data-letter="${letter}" ${showFeedback ? 'disabled' : ''}>${opt}</button>`;
  }).join('');

  const feedbackHtml = showFeedback ? `
    <div class="feedback-panel">
      <div class="feedback-result">
        ${q._userCorrect ? '✅ 回答正确！' : `❌ 回答错误！正确答案：${q.answer}`}
      </div>
      ${q.analysis ? `<div class="feedback-analysis">📖 ${q.analysis}</div>` : ''}
      ${q.mnemonic ? `<div class="feedback-mnemonic">🔗 口诀：${q.mnemonic}</div>` : ''}
      ${q.source ? `<div class="feedback-source">📚 ${q.source}</div>` : ''}
      <div class="feedback-actions">
        ${idx < total ? `<button class="cta-primary" onclick="QuizCard.next()">下一题 →</button>` : ''}
        ${idx >= total ? `<button class="cta-primary" onclick="QuizCard.finish()">完成，查看结果</button>` : ''}
      </div>
    </div>
  ` : '';

  const modeLabel = {beginner:'新手模式',advanced:'进阶模式',mock:'全真模考',mistake:'错题重做'}[_currentMode] || '';
  const remainingSec = Timer.getElapsed();
  const timerHtml = _currentMode === 'mock'
    ? `<span id="mock-timer-display" class="timer-display">90:00</span>`
    : '';

  app.innerHTML = `
    <nav class="top-nav">
      <span onclick="window.goHome()" style="cursor:pointer;font-size:14px;color:var(--text-secondary);margin-right:8px">← 返回</span>
      <div class="nav-brand" onclick="QuizCard.saveAndExit()">职考通</div>
      <span style="font-weight:600;font-size:14px">${modeLabel}</span>
      ${timerHtml}
      <span style="color:var(--text-secondary);font-size:13px">${idx}/${total}</span>
    </nav>
    <main class="main-content">
      <div class="quiz-header">
        <span class="quiz-type-badge">${q.type === 'multiple' ? '多选题' : '单选题'}</span>
        ${q.chapter ? `<span class="quiz-chapter">第${q.chapter}章</span>` : ''}
      </div>
      <div class="quiz-stem">${q.stem}</div>
      <div class="quiz-options" id="quiz-options">
        ${optionsHtml}
      </div>
      <div class="quiz-feedback" id="quiz-feedback">
        ${feedbackHtml}
      </div>
      <div class="quiz-progress">
        <div class="progress-bar" style="width:${(idx/total*100)}%"></div>
      </div>
    </main>
  `;

  if (!showFeedback) {
    // 绑定选项点击
    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', () => handleOptionClick(q, btn.dataset.letter));
    });
  }
}

// ─── 选项点击 ───
async function handleOptionClick(q, selectedLetter) {
  if (_answered) return;
  _answered = true;

  const ansLetters = (q.answer || '').toUpperCase().split('');
  const isCorrect = ansLetters.includes(selectedLetter);
  q._userCorrect = isCorrect;
  q._userAnswer = selectedLetter; // R10: 保存用户答案用于错题列表

  if (isCorrect) _correctCount++;

  const quality = isCorrect ? 4 : 2;
  // R21: 答即存
  try { await Ebbinghaus.recordReview(q.id, quality); } catch (e) { /* 降级 */ }

  // R18: 埋点
  State.trackEvent('question_answered', {
    questionId: q.id,
    mode: _currentMode,
    correct: isCorrect,
    quality,
  });

  // 立即保存
  State.saveNow();

  // 重新渲染带反馈
  renderQuestion(q, true);
}

// ─── 下一题 ───
function next() {
  const nextIdx = _questions.findIndex((q, i) =>
    i > _currentIndex && !q._userCorrect // 优先推未做对的
  );
  const idx = nextIdx > 0 ? nextIdx : _currentIndex + 1;

  if (idx >= _questions.length) {
    finish();
    return;
  }
  _currentIndex = idx;
  _answered = false;
  renderQuestion(_questions[idx]);
}

// ─── 完成 ───
function finish() {
  const total = _questions.length;
  const wrongQs = _questions.filter(q => q._userCorrect === false);

  State.trackEvent('mode_completed', {
    mode: _currentMode,
    score: _correctCount,
    totalTime: _currentMode === 'mock' ? Timer.getElapsed() : 0,
  });
  State.saveNow();

  const app = document.getElementById('app');
  if (!app) return;

  // R10: 冲刺模式显示错题列表
  const wrongListHtml = _currentMode === 'mock' && wrongQs.length > 0 ? `
    <div class="recent-section" style="margin-top:20px;text-align:left">
      <div class="section-title">❌ 错题列表（${wrongQs.length}题）</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
        ${wrongQs.map((q, i) => `
          <div class="wrong-item" onclick="QuizCard.reviewQuestion('${q.id}')" style="padding:8px 12px;border:1px solid var(--border-color);border-radius:var(--radius-sm);cursor:pointer;font-size:14px;background:var(--panel-pc);line-height:1.5">
            <span style="color:var(--accent);font-weight:700">${i+1}.</span>
            <span style="color:#dc2626;font-weight:600;margin-left:4px">答：${q._userAnswer || '?'}</span>
            ${q.stem.substring(0, 60)}...
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  // R40: 打卡
  const streakHtml = _currentMode !== 'mock' ? `
    <div style="margin-top:16px;font-size:14px;color:var(--accent);font-weight:600">
      🔥 已坚持学习 ${State.state.daysStudied || 1} 天
    </div>
  ` : '';

  app.innerHTML = `
    <nav class="top-nav">
      <span onclick="window.goHome()" style="cursor:pointer;font-size:14px;color:var(--text-secondary);margin-right:8px">← 返回</span>
      <div class="nav-brand" onclick="window.goHome()">职考通</div>
      <span style="font-weight:600">${_currentMode === 'mock' ? '模考成绩' : '刷题完成'}</span>
    </nav>
    <main class="main-content" style="text-align:center">
      <div class="stat-card" style="margin:24px 0">
        <div class="stat-label">正确率</div>
        <div class="stat-value">${total > 0 ? Math.round(_correctCount/total*100) : 0}%</div>
        <div style="font-size:14px;color:var(--text-secondary);margin-top:8px">${_correctCount}/${total} 题正确</div>
        ${_currentMode === 'mock' ? `<div style="font-size:13px;color:var(--text-secondary);margin-top:4px">用时：${formatTime(90*60 - Timer.getElapsed())}</div>` : ''}
      </div>
      ${wrongListHtml}
      ${streakHtml}
      <div class="mode-grid" style="margin-top:20px">
        <button class="mode-btn" onclick="QuizCard.retry()">🔄 再来一组</button>
        <button class="mode-btn" onclick="window.goHome()">🏠 返回首页</button>
      </div>
    </main>
  `;

  // 更新连续打卡
  if (_currentMode !== 'mock') {
    const state = State.state;
    state.daysStudied = (state.daysStudied || 0) + (isNewDay() ? 1 : 0);
    State.saveNow();
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}分${s}秒`;
}

function isNewDay() {
  const last = localStorage.getItem('mmj_last_study_date');
  const today = new Date().toDateString();
  if (last !== today) {
    localStorage.setItem('mmj_last_study_date', today);
    return true;
  }
  return false;
}

// R10: 错题点击跳解析
function reviewQuestion(qid) {
  const q = _questions.find(q => q.id === qid);
  if (q) {
    _currentIndex = _questions.indexOf(q);
    _answered = true;
    q._userCorrect = false; // force show answer
    renderQuestion(q, true);
  }
}

function retry() {
  State.trackEvent('mode_started', { mode: _currentMode });
  QuizService.pickQuestions({ mode: _currentMode, count: _questions.length })
    .then(qs => render(_currentMode, qs));
}

function showEmpty(mode) {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = `
    <main class="main-content" style="text-align:center;padding-top:100px">
      <div style="font-size:48px;margin-bottom:16px">🎉</div>
      <div style="font-size:18px;font-weight:700;margin-bottom:8px">
        ${mode === 'mistake' ? '暂无错题，继续保持！' : '暂无可用题目'}
      </div>
      <button class="cta-primary" style="margin-top:20px" onclick="window.goHome()">返回首页</button>
    </main>
  `;
}

// 挂载全局
window.QuizCard = { next, finish, retry, reviewQuestion, saveAndExit };
window.QuizCard.saveAndExit = saveAndExit;
window.QuizCard.reviewQuestion = reviewQuestion;

export const QuizCard = { render, next, finish, retry, reviewQuestion, saveAndExit };
