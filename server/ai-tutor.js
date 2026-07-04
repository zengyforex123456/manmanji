// server/ai-tutor.js — AI答疑机器人 + 口诀生成器
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();
const LLM_KEY = function() { return process.env.ZHICE_LLM_API_KEY || process.env.DEEPSEEK_API_KEY || ''; };
const LLM_URL = 'https://api.deepseek.com/v1/chat/completions';

// ═══ 考试知识库 ═══
const EXAM_INFO = {
  format: '机考（CBT），全部选择题',
  subjects: '经济基础知识 + 专业知识与实务（10选1）',
  passScore: '84分/140分（60%）',
  examTime: '每年11月第一个周末',
  registerTime: '每年7-8月',
  validPeriod: '成绩2年有效',
};

// ═══ AI出题（独立通道·不走答疑兜底） ═══
async function generateQuestionsAI(prompt, count) {
  var key = LLM_KEY();
  if (!key) return null; // 无key→让前端用离线兜底

  var system = '你是中级经济师考试出题专家。只输出纯JSON数组，不要markdown标记。每题包含stem/options/answer/analysis/difficulty/chapter字段。';

  try {
    var res = await fetch(LLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ], max_tokens: 2000, temperature: 0.7 }),
    });
    if (!res.ok) return null;
    var data = await res.json();
    var text = (data.choices && data.choices[0] ? data.choices[0].message.content : '') || '';
    var jsonMatch = text.match(/\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch(e) { return null; }
}

// ── POST /api/ai/generate-questions ──
router.post('/generate-questions', async function(req, res) {
  try {
    var prompt = req.body.prompt || '';
    var count = req.body.count || 10;
    if (!prompt) return res.status(400).json({ error: 'prompt required' });

    var questions = await generateQuestionsAI(prompt, count);
    if (questions && questions.length > 0) {
      res.json({ questions: questions, source: 'ai', count: questions.length });
    } else {
      res.json({ questions: null, source: 'fallback', hint: '使用前端离线题库' });
    }
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══ AI答疑 ═══
async function askAI(question) {
  var key = LLM_KEY();
  if (!key) return fallbackAnswer(question);

  var prompt = '你是「极简智考」中级经济师备考平台的AI助教。帮28-45岁在职考生解答备考问题。回答简洁直接，不超过300字。考试信息: 机考CBT, 科目: 经济基础知识+专业知识与实务(10选1), 及格线84/140, 考试11月, 报名7-8月。';

  try {
    var res = await fetch(LLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'system', content: prompt }, { role: 'user', content: question }],
        max_tokens: 600, temperature: 0.7,
      }),
    });
    if (!res.ok) return fallbackAnswer(question);
    var data = await res.json();
    return { answer: data.choices && data.choices[0] ? data.choices[0].message.content : '', model: 'deepseek-chat', source: 'ai' };
  } catch(e) {
    return fallbackAnswer(question);
  }
}

// ═══ 离线兜底 ═══
function fallbackAnswer(question) {
  var q = question.toLowerCase();

  if (/报名|考试时间/.test(q)) {
    return { answer: '中级经济师每年11月第一个周末考试，报名7-8月。2026年预计7月中旬开始报名。科目: 经济基础知识+专业知识与实务(10选1)。及格线: 84分/140分。', source: 'knowledge_base' };
  }
  if (/及格|多少分/.test(q)) {
    return { answer: '中级经济师合格标准为84分（满分140分，60%）。建议目标定在100分以上，留足容错空间。经济基础是难点，建议先攻克。', source: 'knowledge_base' };
  }
  if (/科目|选哪个/.test(q)) {
    return { answer: '中级经济师10个专业方向推荐：工商管理(通用最强) > 人力资源管理(HR/行政) > 金融(银行/证券) > 财政税收(财税/审计)。选与工作相关的，通过率最高。', source: 'knowledge_base' };
  }
  if (/怎么学|方法|计划/.test(q)) {
    return { answer: '每天15-30分钟碎片刷题，周末1-2小时系统复习。三阶段：基础期(7-8月)通读+刷题，强化期(9-10月)错题+真题，冲刺期(11月)高频+口诀。用艾宾浩斯复习功能自动安排。', source: 'knowledge_base' };
  }
  if (/口诀|记忆|记不住/.test(q)) {
    return { answer: '极简智考已收录12074条记忆口诀（覆盖率62.1%），用口诀记忆效率提升3倍。刷题时遇到记不住的知识点，点击记口诀按钮即可。', source: 'mnemonics_db' };
  }
  if (/焦虑|紧张|放弃/.test(q)) {
    return { answer: '别担心！大龄考生反而有优势：工作经验帮你理解概念，自律性强碎片利用好，动机明确（晋升/加薪/积分）。每天坚持15分钟 > 周末突击3小时。通过率15-20%但你用对方法可以到70%+。', source: 'knowledge_base' };
  }
  return { answer: '关于"'+ question.slice(0, 30) +'..."：建议先在考点搜索中查找相关知识点，然后做对应章节题目。也可以问：考试报名时间、备考方法、科目选择、记忆口诀。', source: 'knowledge_base' };
}

// ═══ API ═══

// POST /api/ai/ask
router.post('/ask', async function(req, res) {
  try {
    var question = req.body.question;
    if (!question || question.trim().length < 2) return res.status(400).json({ error: '问题太短' });
    var result = await askAI(question);
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/ai/exam-info
router.get('/exam-info', function(req, res) {
  res.json(EXAM_INFO);
});

// POST /api/ai/generate-mnemonics
router.post('/generate-mnemonics', async function(req, res) {
  try {
    var questions = req.body.questions;
    if (!questions || !Array.isArray(questions)) return res.status(400).json({ error: 'questions array required' });

    var key = LLM_KEY();
    if (!key) return res.json({ generated: 0, reason: 'LLM API key not configured' });

    var prompt = '为以下中级经济师考题生成记忆口诀（10-20字，帮助记忆关键知识点）：\n';
    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      prompt += (i+1) + '. ' + (typeof q === 'string' ? q.slice(0, 100) : (q.stem || '').slice(0, 100)) + '\n';
    }
    prompt += '\n输出JSON数组: [{"questionIndex": 1, "mnemonic": "口诀", "keyPoint": "考点"}]';

    var resp = await fetch(LLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], max_tokens: 2000, temperature: 0.8 }),
    });
    if (!resp.ok) return res.json({ generated: 0, reason: 'API error' });

    var data = await resp.json();
    var text = (data.choices && data.choices[0] ? data.choices[0].message.content : '') || '';
    var jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      var mnemonics = JSON.parse(jsonMatch[0]);
      res.json({ generated: mnemonics.length, mnemonics: mnemonics });
    } else {
      res.json({ generated: 0, raw: text.slice(0, 500) });
    }
  } catch(e) { res.status(500).json({ error: e.message }); }
});

export default router;
