// R37: 首次引导流程
// 新用户 → 选科目 → 选章节 → 立刻3道题

import { State } from '../core/state.js';
import { QuizService } from '../services/quiz-service.js';
import { QuizCard } from './quiz-card.js';

const ONBOARDING_KEY = 'mmj_onboarding_done';

export function maybeShowOnboarding() {
  if (localStorage.getItem(ONBOARDING_KEY)) return false;

  const app = document.getElementById('app');
  const overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  overlay.innerHTML = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:999;display:flex;align-items:center;justify-content:center">
      <div style="background:var(--panel-pc,white);border-radius:20px;padding:32px;max-width:400px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3)">
        <div style="font-size:40px;margin-bottom:12px">🎯</div>
        <div id="onboarding-step" style="font-size:18px;font-weight:800;margin-bottom:8px">选择备考科目</div>
        <div id="onboarding-content" style="font-size:14px;color:var(--text-secondary,#475569);margin-bottom:20px;line-height:1.6">
          职考通支持8大职业考试品类。<br>先从「中级经济师」开始吧！
        </div>
        <div id="onboarding-actions">
          <button onclick="Onboarding.next('econ')" style="padding:12px 32px;background:#0f766e;color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;margin:4px;width:100%">中级经济师</button>
          <button onclick="Onboarding.skip()" style="padding:8px;background:none;border:none;color:#64748b;font-size:13px;cursor:pointer;margin-top:8px">跳过引导，直接开始</button>
        </div>
      </div>
    </div>`;

  app.appendChild(overlay);
  window.Onboarding = { next, skip };
  return true;
}

let _step = 1;
let _subjectId = 'econ';
let _chapter = 0;

async function next(value) {
  _step++;
  const title = document.getElementById('onboarding-step');
  const content = document.getElementById('onboarding-content');
  const actions = document.getElementById('onboarding-actions');

  if (_step === 2) {
    _subjectId = value || 'econ';
    title.textContent = '选择要学习的章节';
    content.textContent = '建议从第2章「需求与弹性」开始，这是每年必考的高频章节。';
    actions.innerHTML = `
      <button onclick="Onboarding.next(2)" style="padding:12px 32px;background:#0f766e;color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;margin:4px;width:100%">第2章 需求与弹性</button>
      <button onclick="Onboarding.next(1)" style="padding:8px 16px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;cursor:pointer;margin:4px;width:100%">第1章 基本经济制度</button>
      <button onclick="Onboarding.skip()" style="padding:8px;background:none;border:none;color:#64748b;font-size:13px;cursor:pointer;margin-top:4px">跳过</button>`;
  } else if (_step === 3) {
    _chapter = value || 2;
    title.textContent = '了解刷题模式';
    content.innerHTML = '<span style="color:#0f766e;font-weight:700">新手模式</span>：每题做完即看解析和口诀，适合刚开始复习。<br><br><span style="color:#b45309;font-weight:700">进阶模式</span>：做完一组再看答案，适合检验水平。';
    actions.innerHTML = `
      <button onclick="Onboarding.finish()" style="padding:14px 32px;background:#0f766e;color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;width:100%">开始刷3道免费题 🚀</button>`;
  }
}

async function finish() {
  remove();
  localStorage.setItem(ONBOARDING_KEY, '1');
  // 立刻出3道题
  try {
    const questions = await QuizService.pickQuestions({ subjectId: _subjectId, mode: 'beginner', chapter: _chapter, count: 3 });
    QuizCard.render('beginner', questions);
  } catch (e) {
    location.reload();
  }
}

function skip() {
  remove();
  localStorage.setItem(ONBOARDING_KEY, '1');
}

function remove() {
  const el = document.getElementById('onboarding-overlay');
  if (el) el.remove();
  delete window.Onboarding;
}
