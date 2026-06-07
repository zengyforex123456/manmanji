// src/services/analytics.js — AI 分析引擎
// R33: 错因诊断 + R34: 弱项识别 + R35: 自适应出题 + R36: 智能答疑

import { DB } from '../core/db.js';
import { State } from '../core/state.js';
import { getSubjectMeta } from '../data/subjects-meta.js';
import { Ebbinghaus } from './ebbinghaus.js';

// ─── R33: 错因诊断 ───
// 基于答题历史分析错误模式

const ERROR_PATTERNS = {
  concept_confusion: { label: '概念混淆', icon: '🔄', desc: '相似概念间判断错误' },
  memory_gap: { label: '记忆遗忘', icon: '🧠', desc: '长期未复习导致的遗忘' },
  calculation_error: { label: '计算失误', icon: '🔢', desc: '涉及计算的题目反复出错' },
  negation_miss: { label: '否定词遗漏', icon: '⚠️', desc: '未注意到"错误/不属于/不正确"等否定词' },
  multi_select_weak: { label: '多选薄弱', icon: '📋', desc: '多选题正确率明显低于单选题' },
};

async function diagnoseErrors(subjectId = null) {
  const sid = subjectId || State.getActiveSubjectId();
  const progress = await DB.getProgress(sid);
  if (!progress.length) return { patterns: [], summary: '暂无足够答题数据（需≥10次答题）' };

  const wrongQs = progress.filter(p => p.wrongCount > 0);
  if (wrongQs.length < 5) return { patterns: [], summary: '错题不足5道，继续刷题以获取诊断' };

  const patterns = [];

  // 概念混淆：同一章错题≥3道
  const byChapter = {};
  wrongQs.forEach(p => {
    const ch = p.chapter || 0;
    if (!byChapter[ch]) byChapter[ch] = 0;
    byChapter[ch]++;
  });
  Object.entries(byChapter).forEach(([ch, count]) => {
    if (count >= 3 && parseInt(ch) > 0) {
      patterns.push({
        type: 'concept_confusion',
        ...ERROR_PATTERNS.concept_confusion,
        chapter: parseInt(ch),
        detail: `第${ch}章有${count}道错题，可能存在概念混淆`,
        suggestion: `建议重点复习第${ch}章的核心概念对比表`,
      });
    }
  });

  // 记忆遗忘：最近7天未复习的错题
  const now = Date.now();
  const forgotten = wrongQs.filter(p => {
    const lastReview = new Date(p.lastReview || 0).getTime();
    return now - lastReview > 7 * 86400000;
  });
  if (forgotten.length >= 3) {
    patterns.push({
      type: 'memory_gap',
      ...ERROR_PATTERNS.memory_gap,
      detail: `${forgotten.length}道错题已超过7天未复习`,
      suggestion: '建议立即开始艾宾浩斯复习，优先复习这些遗忘题',
    });
  }

  // 否定词遗漏：含"错误/不属于/不正确"的题答错≥2道
  const negationWrong = wrongQs.filter(p => {
    const stem = p._stem || '';
    return /错误|不属于|不正确|不是|不包括|除了/.test(stem);
  });
  if (negationWrong.length >= 2) {
    patterns.push({
      type: 'negation_miss',
      ...ERROR_PATTERNS.negation_miss,
      detail: `${negationWrong.length}道否定词题目答错`,
      suggestion: '做题时注意圈出"错误/不属于"等否定词，先明确题目在问什么',
    });
  }

  // 多选薄弱
  const multiWrong = wrongQs.filter(p => p._type === 'multiple');
  const multiTotal = progress.filter(p => p._type === 'multiple').length;
  const singleWrong = wrongQs.filter(p => p._type === 'single');
  const singleTotal = progress.filter(p => p._type === 'single').length;

  const multiRate = multiTotal > 0 ? multiWrong.length / multiTotal : 0;
  const singleRate = singleTotal > 0 ? singleWrong.length / singleTotal : 0;

  if (multiRate > 0.3 && multiRate > singleRate * 1.5 && multiTotal >= 5) {
    patterns.push({
      type: 'multi_select_weak',
      ...ERROR_PATTERNS.multi_select_weak,
      detail: `多选错误率${Math.round(multiRate*100)}% vs 单选${Math.round(singleRate*100)}%`,
      suggestion: '多选题注意逐项分析每个选项，练习时严格"全对才计正确"',
    });
  }

  return {
    patterns,
    summary: patterns.length > 0
      ? `检测到${patterns.length}个错误模式，已给出针对性建议`
      : '未检测到明显错误模式，继续保持！',
  };
}

// ─── R34: 弱项识别 ───
// 按模块/章节计算掌握度，识别知识盲区

async function identifyWeakAreas(subjectId = null) {
  const sid = subjectId || State.getActiveSubjectId();
  const meta = getSubjectMeta(sid);
  const progress = await DB.getProgress(sid);

  if (!meta) return { modules: [], weakChapters: [], strongChapters: [] };

  const chapterStats = {};
  meta.chapters.forEach(ch => {
    chapterStats[ch.id] = { total: 0, correct: 0, wrong: 0, chapter: ch.id, name: ch.name, tier: ch.tier };
  });

  // R13 贝叶斯平滑参数
  const PRIOR_COUNT = 5;
  const PRIOR_RATE = 0.65;

  progress.forEach(p => {
    const ch = p.chapter || 0;
    if (!chapterStats[ch]) return;
    chapterStats[ch].total++;
    if (p.wrongCount > 0) {
      chapterStats[ch].wrong++;
    } else {
      chapterStats[ch].correct++;
    }
  });

  const results = Object.values(chapterStats)
    .filter(s => s.chapter > 0)
    .map(s => {
      // R13 贝叶斯平滑
      const effectiveTotal = s.total + PRIOR_COUNT;
      const effectiveCorrect = s.correct + PRIOR_COUNT * PRIOR_RATE;
      const mastery = s.total >= 50
        ? Math.round(effectiveCorrect / effectiveTotal * 100)
        : null; // 不足50题不显示

      return {
        chapter: s.chapter,
        name: s.name,
        tier: s.tier,
        totalQuestions: s.total,
        wrongCount: s.wrong,
        mastery,
        status: mastery === null ? 'insufficient' : mastery >= 70 ? 'strong' : mastery >= 40 ? 'moderate' : 'weak',
      };
    });

  const weakChapters = results.filter(r => r.status === 'weak').sort((a, b) => (a.mastery || 0) - (b.mastery || 0));
  const strongChapters = results.filter(r => r.status === 'strong').sort((a, b) => (b.mastery || 0) - (a.mastery || 0));

  return {
    modules: meta.modules.map(m => {
      const chs = results.filter(r => m.chapters.includes(r.chapter) && r.mastery !== null);
      const avg = chs.length > 0 ? Math.round(chs.reduce((s, c) => s + (c.mastery || 0), 0) / chs.length) : null;
      return { id: m.id, name: m.name, weight: m.weight, mastery: avg, chapterCount: chs.length };
    }),
    weakChapters: weakChapters.slice(0, 5),
    strongChapters: strongChapters.slice(0, 5),
    allChapters: results,
  };
}

// ─── R35: 自适应推荐 ───
// 基于弱项 + SM-2 状态 + 权重 生成个性化刷题计划

async function getAdaptivePlan(subjectId = null) {
  const { weakChapters } = await identifyWeakAreas(subjectId);
  const diagnostics = await diagnoseErrors(subjectId);

  const recommendations = [];

  // 弱项优先
  weakChapters.forEach(ch => {
    recommendations.push({
      type: 'weak_chapter',
      priority: 'high',
      chapter: ch.chapter,
      name: ch.name,
      action: `重点练习第${ch.chapter}章，当前掌握度${ch.mastery || '?'}%`,
      suggestedMode: 'beginner',
      suggestedCount: 10,
    });
  });

  // 错因驱动
  diagnostics.patterns.forEach(p => {
    recommendations.push({
      type: 'pattern_fix',
      priority: 'medium',
      pattern: p.type,
      action: p.suggestion,
      suggestedMode: 'mistake',
      suggestedCount: 20,
    });
  });

  // 每日复习提醒
  const due = await Ebbinghaus.getDueReviews(subjectId);
  if (due.length > 0) {
    recommendations.unshift({
      type: 'review_due',
      priority: 'urgent',
      action: `${due.length}道题等待复习，建议立即开始`,
      suggestedMode: 'mistake',
      suggestedCount: Math.min(due.length, 40),
    });
  }

  // 每日推荐量
  const totalNewRec = recommendations
    .filter(r => r.suggestedMode === 'beginner')
    .reduce((s, r) => s + (r.suggestedCount || 0), 0);

  return {
    recommendations: recommendations.slice(0, 6),
    dailyReviewCount: due.length,
    dailyNewCount: Math.min(20, totalNewRec || 10),
    summary: due.length > 0
      ? `今日建议：复习${Math.min(due.length, 40)}道旧题 + ${Math.min(20, totalNewRec || 10)}道新题`
      : `今日建议：学习${Math.min(20, totalNewRec || 10)}道新题`,
  };
}

// ─── R36: 智能答疑（基于知识库的简单问答） ───
function askQuestion(query, subjectId = null) {
  // MVP版本：基于关键词匹配给出学习建议
  // 平台化阶段接入RAG+LLM
  const responses = [
    { keywords: ['弹性','需求价格'], answer: '需求价格弹性=需求量变动%/价格变动%。>1=高弹性(奢侈品)→降价增收；<1=低弹性(必需品)→涨价增收。口诀：高弹降价，低弹涨价。' },
    { keywords: ['财政乘数','政府购买'], answer: '政府购买支出乘数=1/(1-MPC)，为正数；税收乘数=-MPC/(1-MPC)，为负数。支出乘数绝对值比税收乘数大1。' },
    { keywords: ['增值税','一般纳税人'], answer: '年应征销售额>500万元需登记为一般纳税人(可抵扣进项税)，≤500万为小规模纳税人(简易征收)。' },
    { keywords: ['GDP','国内生产'], answer: 'GDP=消费+投资+政府购买+净出口(C+I+G+NX)。支出法核算。注意区分名义GDP和实际GDP。' },
    { keywords: ['货币政策','存款准备金','再贴现'], answer: '三大货币政策工具：存款准备金率、再贴现率、公开市场业务。降准/降息=扩张性货币政策。' },
    { keywords: ['会计恒等式','会计要素'], answer: '资产=负债+所有者权益。静态三要素(资产负债表)：资产、负债、所有者权益。动态三要素(利润表)：收入、费用、利润。' },
    { keywords: ['劳动合同','试用期'], answer: '劳动合同期限3个月~1年：试用期≤1个月；1年~3年：≤2个月；3年以上：≤6个月。同一用人单位只能约定一次试用期。' },
    { keywords: ['SM-2','间隔重复','艾宾浩斯'], answer: '记忆间隔：1天→3天→7天→15天→30天。答对升盒延长间隔，答错降盒缩短间隔。系统自动推送，无需手动规划。' },
  ];

  const matched = responses.find(r =>
    r.keywords.some(kw => query.includes(kw))
  );

  if (matched) return { answer: matched.answer, source: '知识库检索' };

  return {
    answer: '抱歉，当前知识库暂未收录该问题的答案。您可以：\n1. 尝试用更具体的关键词提问\n2. 查看教材对应章节\n3. 在"问题反馈"中提交，我们会尽快补充',
    source: null,
  };
}

export const Analytics = {
  diagnoseErrors,
  identifyWeakAreas,
  getAdaptivePlan,
  askQuestion,
};
