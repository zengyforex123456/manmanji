// 全屏沉浸式模拟考试界面
import { Ebbinghaus } from '../services/ebbinghaus.js';
import { QuizService } from '../services/quiz-service.js';
import { State } from '../core/state.js';
import { Timer } from './timer.js';

let _questions = [];
let _answers = {};       // { questionId: selectedKey }
let _marks = {};         // { questionId: true }
let _timePerQ = {};      // { questionId: seconds }
let _qEnterTime = 0;     // 进入当前题的时间戳
let _currentIdx = 0;
let _totalTime = 0;
let _autoSaveTimer = null;

// ─── 入口 ───
export async function renderMockExam(mode, questions) {
  _questions = questions;
  _answers = {};
  _marks = {};
  _timePerQ = {};
  _qEnterTime = Date.now();
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

  window.MockExam = { jumpTo, selectAnswer, nextQ, prevQ, toggleMark, submitExam, _doSubmit };
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

function recordCurrentTime() {
  if (_qEnterTime > 0 && _questions[_currentIdx]) {
    const spent = Math.round((Date.now() - _qEnterTime) / 1000);
    const qid = _questions[_currentIdx].id;
    _timePerQ[qid] = (_timePerQ[qid] || 0) + spent;
  }
  _qEnterTime = Date.now();
}

function jumpTo(idx) {
  recordCurrentTime();
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

// ─── 交卷（增强确认弹窗） ───
function submitExam() {
  const total = _questions.length;
  const answered = Object.keys(_answers).length;
  const unmarked = total - answered;
  const marked = Object.keys(_marks).length;

  // 构建未答题列表
  const unansweredList = _questions
    .map((q, i) => (!_answers[q.id] ? i + 1 : null))
    .filter(Boolean).slice(0, 8);

  const overlay = document.createElement('div');
  overlay.id = 'submit-confirm-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:24px;width:90%;max-width:400px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
      <div style="font-size:32px;margin-bottom:8px;">${unmarked > 0 ? '⚠️' : '📝'}</div>
      <div style="font-weight:800;font-size:16px;margin-bottom:12px;">${unmarked > 0 ? `还有 ${unmarked} 题未作答` : '确认交卷'}</div>
      <div style="font-size:13px;color:#64748b;margin-bottom:8px;">
        ✅ 已答: ${answered}题 &nbsp; ⬜ 未答: ${unmarked}题 &nbsp; ⭐ 标记: ${marked}题
      </div>
      ${unansweredList.length > 0 ? `<div style="font-size:11px;color:#94a3b8;margin-bottom:12px;">未答题号: ${unansweredList.join(', ')}${unmarked > 8 ? '...' : ''}</div>` : ''}
      <div style="font-size:12px;color:#dc2626;margin-bottom:16px;">交卷后不可修改答案</div>
      <div style="display:flex;gap:8px;">
        <button onclick="document.getElementById('submit-confirm-overlay').remove()" style="flex:1;padding:10px;background:#e2e8f0;border:none;border-radius:8px;font-size:14px;cursor:pointer;">继续答题</button>
        <button onclick="document.getElementById('submit-confirm-overlay').remove();MockExam._doSubmit()" style="flex:1;padding:10px;background:#dc2626;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">确认交卷</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function _doSubmit() { finalSubmit(); }

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
    try { await Ebbinghaus.recordReview(q.id, isCorrect ? 4 : 2, null, { chapter: q.chapter || 0, stem: q.stem, type: q.type }); } catch (e) {}
  }
  State.saveNow();

  const total = _questions.length;
  const rate = Math.round(correct / total * 100);
  const elapsed = _totalTime - Timer.getElapsed();

  // 时间分布
  const timeVals = Object.values(_timePerQ);
  const avgTime = timeVals.length > 0 ? Math.round(timeVals.reduce((a,b)=>a+b,0) / timeVals.length) : 0;
  const maxTime = Math.max(...timeVals, 1);
  const timeBars = _questions.map((q, i) => {
    const sec = _timePerQ[q.id] || 0;
    const pct = Math.round(sec / maxTime * 100);
    const bar = '█'.repeat(Math.round(pct / 5));
    return { i: i+1, sec, bar, pct };
  }).sort((a, b) => b.sec - a.sec);

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="mock-container" style="background:#f8fafc;min-height:100vh;">
      <main style="max-width:700px;margin:0 auto;padding:24px;">
        <div style="text-align:center;font-size:48px;margin-bottom:4px">${rate >= 60 ? '🎉' : '💪'}</div>
        <h2 style="text-align:center;margin-bottom:24px">模拟考试完成</h2>
        <div class="mock-result-card" style="text-align:center;background:#fff;border-radius:12px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:16px;">
          <div style="font-size:48px;font-weight:900;color:${rate>=60?'#10b981':'#f59e0b'};">${rate}<span style="font-size:16px;">分</span></div>
          <div style="color:#64748b;margin:8px 0;">${correct} / ${total} 题正确 · 用时 ${Math.floor(elapsed/60)}分${elapsed%60}秒</div>
          <div style="display:flex;justify-content:center;gap:24px;margin-top:8px;font-size:13px;">
            <span>✅ 正确 ${correct}</span><span>❌ 错误 ${total-correct}</span><span>⏱ 均时 ${avgTime}秒/题</span>
          </div>
        </div>

        ${wrongList.length > 0 ? `
        <div style="background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:16px;">
          <div style="font-weight:800;font-size:14px;margin-bottom:12px;">❌ 错题分析（点击查看解析）</div>
          ${wrongList.slice(0, 15).map((q, i) => `
            <div class="wrong-item" style="padding:10px 0;border-bottom:1px solid #f1f5f9;cursor:pointer;" onclick="MockExam._showAnalysis('${q.id}', '${q.userAnswer}', '${q.answer}')">
              <span style="font-weight:700;color:#dc2626;">${i+1}. [${q.type==='multiple'?'多选':'单选'}]</span>
              <span style="color:#dc2626;font-size:12px;">你选: ${q.userAnswer} → 正确: ${q.answer}</span>
              <div style="font-size:13px;margin-top:4px;">${q.stem.substring(0, 80)}...</div>
            </div>
          `).join('')}
          ${wrongList.length > 15 ? `<div style="color:#94a3b8;text-align:center;padding:8px;">...还有 ${wrongList.length - 15} 道错题</div>` : ''}
        </div>` : ''}

        <div style="background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:16px;">
          <div style="font-weight:800;font-size:14px;margin-bottom:12px;">⏱ 时间分布（每题耗时）</div>
          <div style="font-size:11px;color:#94a3b8;margin-bottom:8px;">显示用时最多的前10题</div>
          ${timeBars.slice(0, 10).map(({i, sec, bar}) => `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:12px;">
              <span style="width:32px;text-align:right;color:#64748b;">#${i}</span>
              <span style="color:#38bdf8;font-family:monospace;font-size:10px;">${bar}</span>
              <span style="color:#94a3b8;">${sec}秒</span>
            </div>
          `).join('')}
          ${timeBars.length === 0 ? '<div style="color:#94a3b8;">暂无时间数据</div>' : ''}
        </div>

        <div style="display:flex;gap:12px;justify-content:center;">
          <button class="mode-btn" style="flex:1;max-width:200px;" onclick="window.goHome()">🏠 返回首页</button>
          <button class="cta-primary" style="flex:1;max-width:200px;" onclick="startMode('mock')">🔄 再来一套</button>
        </div>
      </main>
    </div>
  `;

  window.MockExam._showAnalysis = (qid, userAns, correctAns) => {
    const q = _questions.find(q => q.id === qid);
    if (!q) return;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:10001;display:flex;align-items:center;justify-content:center;';
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:24px;width:90%;max-width:500px;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <div style="font-weight:800;font-size:14px;margin-bottom:12px;">📖 题目解析</div>
        <div style="font-size:13px;margin-bottom:12px;">${q.stem}</div>
        ${q.options ? q.options.map((o, i) => {
          const letter = String.fromCharCode(65 + i);
          const isUser = userAns.includes(letter);
          const isCorrect = correctAns.includes(letter);
          let bg = '#fff';
          if (isUser && !isCorrect) bg = '#fef2f2';
          if (isCorrect) bg = '#ecfdf5';
          return `<div style="padding:6px 10px;margin:4px 0;background:${bg};border-radius:6px;font-size:13px;">
            <span style="font-weight:700;">${letter}.</span> ${o}
            ${isUser ? '<span style="color:#dc2626;font-size:11px;"> ← 你的选择</span>' : ''}
            ${isCorrect ? '<span style="color:#10b981;font-size:11px;"> ✅ 正确答案</span>' : ''}
          </div>`;
        }).join('') : ''}
        <div style="margin-top:12px;padding:10px;background:#f0f9ff;border-radius:8px;font-size:12px;color:#0369a1;">
          <strong>解析:</strong> ${q.analysis || '暂无解析'}
        </div>
        ${q.mnemonic ? `<div style="margin-top:8px;padding:8px;background:#ecfdf5;border-radius:8px;font-size:13px;color:#065f46;">
          <strong>🧠 口诀:</strong> ${q.mnemonic}
        </div>` : ''}
        <button onclick="this.parentElement.parentElement.remove()" style="margin-top:12px;width:100%;padding:10px;background:#0f172a;color:#fff;border:none;border-radius:8px;cursor:pointer;">关闭</button>
      </div>`;
    document.body.appendChild(overlay);
  };
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
