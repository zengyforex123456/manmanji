// src/services/ai-question-generator.js — L2: AI出题引擎 v2
// 多Agent协同: Analyzer → Retriever → Generator → Validator
// 支持: 一句话出题·资料出题·章节出题·弱点靶向·错题变式·个性化推题
import API from '../api.js';

// ═══ 学科知识图谱 ═══
const KNOWLEDGE_GRAPH = {
  econ: {
    name: '经济基础知识',
    totalChapters: 37,
    modules: {
      宏观: { chapters: [7,8,9,10], weight: 0.25, keyWords: ['GDP','失业','通胀','财政','货币'] },
      微观: { chapters: [2,3,4,5,6], weight: 0.25, keyWords: ['供需','弹性','成本','市场','均衡'] },
      财政: { chapters: [11,12,13,14,15,16,17], weight: 0.20, keyWords: ['税收','预算','支出','公债'] },
      金融: { chapters: [18,19,20,21,22], weight: 0.15, keyWords: ['货币','银行','利率','汇率'] },
      统计: { chapters: [23,24,25,26,27], weight: 0.08, keyWords: ['抽样','回归','指数','方差'] },
      会计: { chapters: [28,29,30,31,32], weight: 0.04, keyWords: ['报表','折旧','成本','核算'] },
      法律: { chapters: [33,34,35,36,37], weight: 0.03, keyWords: ['合同','物权','公司法'] },
    },
    topoOrder: ['微观','宏观','财政','金融','统计','会计','法律'],
  },
  hr: {
    name: '人力资源管理',
    totalChapters: 19,
    modules: {
      组织行为: { chapters: [1,2,3], weight: 0.20, keyWords: ['动机','激励','领导','沟通','群体'] },
      人力资源规划: { chapters: [4,5,6], weight: 0.15, keyWords: ['规划','预测','平衡','工作分析'] },
      招聘甄选: { chapters: [7,8], weight: 0.12, keyWords: ['招聘','面试','测评','录用'] },
      培训开发: { chapters: [9,10], weight: 0.10, keyWords: ['培训','开发','评估','职业规划'] },
      绩效管理: { chapters: [11,12], weight: 0.15, keyWords: ['绩效','KPI','BSC','考核','反馈'] },
      薪酬福利: { chapters: [13,14,15], weight: 0.15, keyWords: ['薪酬','福利','工资','奖金','社保'] },
      劳动关系: { chapters: [16,17,18,19], weight: 0.13, keyWords: ['合同','争议','仲裁','工会','法规'] },
    },
    topoOrder: ['组织行为','人力资源规划','招聘甄选','培训开发','绩效管理','薪酬福利','劳动关系'],
  },
  biz: {
    name: '工商管理',
    totalChapters: 11,
    modules: {
      企业战略: { chapters: [1,2], weight: 0.22, keyWords: ['战略','PEST','SWOT','波特','竞争'] },
      市场营销: { chapters: [3,4], weight: 0.18, keyWords: ['营销','4P','品牌','STP','渠道'] },
      生产运营: { chapters: [5,6], weight: 0.15, keyWords: ['生产','质量','库存','供应链','JIT'] },
      物流管理: { chapters: [7], weight: 0.08, keyWords: ['物流','配送','仓储','运输'] },
      技术创新: { chapters: [8,9], weight: 0.15, keyWords: ['创新','研发','技术','专利'] },
      人力资源: { chapters: [10], weight: 0.07, keyWords: ['招聘','绩效','薪酬','培训'] },
      财务管理: { chapters: [11], weight: 0.15, keyWords: ['投资','融资','利润','成本','资本'] },
    },
    topoOrder: ['企业战略','市场营销','生产运营','物流管理','技术创新','人力资源','财务管理'],
  },
};

// 题目难度系数
const DIFFICULTY = { easy: { level: 1, label: '基础', ratio: 0.3 }, medium: { level: 2, label: '中等', ratio: 0.4 }, hard: { level: 3, label: '拔高', ratio: 0.3 } };

// ═══ Agent 1: Analyzer — 分析意图 ═══
class Analyzer {
  static analyze(userInput) {
    var intent = { subject: 'econ', mode: 'chapter', count: 10, difficulty: 'medium', chapters: [], topics: [], keywords: [] };
    if (!userInput) return intent;

    var q = userInput.toLowerCase();

    // 数量
    var countMatch = q.match(/(\d+)\s*[道题个]/);
    if (countMatch) intent.count = parseInt(countMatch[1]);

    // 难度
    if (/简单|基础|入门|easy/.test(q)) intent.difficulty = 'easy';
    if (/困难|难|拔高|hard/.test(q)) intent.difficulty = 'hard';

    // 模式
    if (/模拟|考试|组卷|试卷/.test(q)) intent.mode = 'exam';
    if (/薄弱|弱点|加强|专项|靶向/.test(q)) intent.mode = 'weakness';
    if (/错题|变式|同类/.test(q)) intent.mode = 'variant';

    // 学科知识图谱匹配
    var graph = KNOWLEDGE_GRAPH[intent.subject];
    if (graph) {
      Object.entries(graph.modules).forEach(function(entry) {
        var module = entry[0];
        var meta = entry[1];
        meta.keyWords.forEach(function(kw) {
          if (q.includes(kw)) {
            if (intent.topics.indexOf(module) === -1) intent.topics.push(module);
            intent.chapters = intent.chapters.concat(meta.chapters);
          }
        });
      });
      // 去重
      intent.chapters = intent.chapters.filter(function(v, i, a) { return a.indexOf(v) === i; });
    }

    // 关键字提取
    intent.keywords = q.replace(/[，。！？、；：""''（）\(\)\d+道题个]/g, ' ').split(' ').filter(function(w) { return w.length >= 2; }).slice(0, 5);

    return intent;
  }
}

// ═══ Agent 2: Retriever — 检索知识 ═══
class Retriever {
  static retrieve(intent, progressData) {
    var context = { chapters: [], examples: [], weakPoints: [], difficultyMix: [] };

    // 章节上下文
    var graph = KNOWLEDGE_GRAPH[intent.subject];
    if (graph && intent.chapters.length > 0) {
      context.chapters = intent.chapters.slice(0, 3).map(function(ch) {
        return '第' + ch + '章';
      });
    }

    // 薄弱点数据
    if (progressData && progressData.length > 0) {
      var chapterStats = {};
      progressData.forEach(function(p) {
        var ch = p.chapter || 0;
        if (!ch) return;
        if (!chapterStats[ch]) chapterStats[ch] = { total: 0, wrong: 0 };
        chapterStats[ch].total++;
        if (p.wrongCount > 0) chapterStats[ch].wrong++;
      });
      context.weakPoints = Object.entries(chapterStats)
        .filter(function(e) { return e[1].total >= 3 && e[1].wrong / e[1].total > 0.3; })
        .map(function(e) { return parseInt(e[0]); })
        .slice(0, 5);
    }

    // 难度分布
    var diff = DIFFICULTY[intent.difficulty] || DIFFICULTY.medium;
    context.difficultyMix = [
      { label: 'easy', count: Math.floor(intent.count * 0.3) },
      { label: 'medium', count: Math.floor(intent.count * 0.5) },
      { label: 'hard', count: Math.ceil(intent.count * 0.2) },
    ];

    // 示例题目（prompt用）
    context.examples = [
      { stem: '当经济处于衰退期时，政府应采取的财政政策是？', type: 'single', options: ['A. 增加税收','B. 减少政府支出','C. 增加政府支出','D. 提高利率'], answer: 'C', analysis: '扩张性财政政策：增加政府支出刺激总需求。', difficulty: 2 },
      { stem: 'GDP平减指数与CPI的主要区别在于？', type: 'single', options: ['A. 计算方式不同','B. 覆盖范围不同','C. 基期不同','D. 以上都对'], answer: 'D', analysis: 'GDP平减指数覆盖全部最终产品，CPI仅覆盖消费品。', difficulty: 3 },
    ];

    return context;
  }
}

// ═══ Agent 3: Generator — 生成题目 ═══
class Generator {
  static async generate(intent, context) {
    // 构建prompt
    var prompt = '请生成' + intent.count + '道中级经济师考试单选题。难度' + (intent.difficulty || '中等') + '。';
    if (intent.mode === 'exam') prompt += '模拟考试组卷。';
    if (context.chapters.length > 0) prompt += '重点章节: ' + context.chapters.join(',') + '。';
    if (context.weakPoints.length > 0) prompt += '薄弱章节: ' + context.weakPoints.join(',') + '。';
    prompt += '输出纯JSON数组，每题有stem/options/answer/analysis/difficulty/chapter字段。';

    // 调用专用出题API（不走答疑兜底）
    try {
      var resp = await API.ai.generateQuestions(prompt, intent.count);
      if (resp && resp.questions && resp.questions.length > 0) {
        resp.questions.forEach(function(q, i) {
          if (!q.id) q.id = 'ai-' + Date.now() + '-' + i;
          if (!q.type) q.type = 'single';
          q.source = 'ai';
        });
        return resp.questions;
      }
    } catch(e) { console.warn('[Generator] AI出题API不可用'); }

    // 离线兜底
    return generateFallback(intent, context);
  }
}

function generateFallback(intent, context) {
  var questions = [];
  var fallbackPool = [
    { stem: '当经济处于衰退期时，政府应采取的财政政策是？', options: ['A. 增加税收','B. 减少政府支出','C. 增加政府支出','D. 提高利率'], answer: 'C', analysis: '扩张性财政政策：增加政府支出刺激总需求。这是宏观经济政策的核心考点，常与货币政策对比考查。', difficulty: 2, chapter: 8 },
    { stem: '以下哪项不属于货币政策工具？', options: ['A. 法定存款准备金率','B. 再贴现率','C. 公开市场操作','D. 政府转移支付'], answer: 'D', analysis: '政府转移支付属于财政政策工具，其余三项是货币政策三大工具。', difficulty: 1, chapter: 19 },
    { stem: '需求价格弹性的计算公式是？', options: ['A. 需求量变动/收入变动','B. 需求量变动百分比/价格变动百分比','C. 价格变动/需求量变动','D. 边际效用/总效用'], answer: 'B', analysis: '需求价格弹性=需求量变动百分比÷价格变动百分比，反映需求量对价格的敏感程度。', difficulty: 1, chapter: 2 },
    { stem: '关于GDP的核算方法，下列说法正确的是？', options: ['A. GDP只核算最终产品','B. GDP包括中间产品','C. GDP使用生产法、收入法和支出法核算','D. A和C都对'], answer: 'D', analysis: 'GDP只核算最终产品避免重复计算，三种核算方法结果应一致。', difficulty: 2, chapter: 7 },
    { stem: '财政政策的"自动稳定器"功能主要体现在？', options: ['A. 政府主动调整支出','B. 税收的累进性和转移支付','C. 央行的公开市场操作','D. 汇率自动调节'], answer: 'B', analysis: '累进税制和失业保险等转移支付制度可以在经济波动时自动调节，无需政府额外决策。', difficulty: 3, chapter: 17 },
    { stem: '以下哪项属于公共物品的特征？', options: ['A. 竞争性和排他性','B. 非竞争性和非排他性','C. 竞争性和非排他性','D. 非竞争性和排他性'], answer: 'B', analysis: '公共物品的两大特征：非竞争性（一人消费不影响他人）和非排他性（无法排除他人消费）。', difficulty: 1, chapter: 11 },
    { stem: '边际效用递减规律说明？', options: ['A. 总效用总是递增','B. 边际效用最终会变为负值','C. 消费者应减少消费','D. 需求曲线向下倾斜'], answer: 'D', analysis: '边际效用递减→消费者愿意支付的价格递减→需求曲线向右下方倾斜。', difficulty: 2, chapter: 3 },
    { stem: '通货膨胀对经济的影响不包括？', options: ['A. 财富再分配','B. 菜单成本','C. 提高实际利率','D. 不确定性增加'], answer: 'C', analysis: '通货膨胀通常降低实际利率（名义利率-通胀率），而非提高。', difficulty: 2, chapter: 9 },
    { stem: '以下哪项属于商业银行的表外业务？', options: ['A. 存款业务','B. 贷款业务','C. 信用证业务','D. 同业拆借'], answer: 'C', analysis: '表外业务指不列入资产负债表的业务，如信用证、担保、承诺等。', difficulty: 3, chapter: 20 },
    { stem: 'IS-LM模型中，IS曲线表示？', options: ['A. 货币市场均衡','B. 产品市场均衡','C. 劳动市场均衡','D. 外汇市场均衡'], answer: 'B', analysis: 'IS曲线代表投资(I)=储蓄(S)时的产品市场均衡状态。LM曲线代表货币市场均衡。', difficulty: 2, chapter: 8 },
  ];

  for (var i = 0; i < Math.min(intent.count, fallbackPool.length); i++) {
    var q = Object.assign({}, fallbackPool[i]);
    q.id = 'fb-' + Date.now() + '-' + i;
    q.source = 'fallback';
    q.generatedAt = new Date().toISOString();
    questions.push(q);
  }
  return questions;
}

// ═══ Agent 4: Validator — 质量校验 ═══
class Validator {
  static validate(questions) {
    var report = { total: questions.length, valid: 0, issues: [] };

    questions.forEach(function(q, i) {
      var qi = [];

      // 必填字段检查
      if (!q.stem || q.stem.length < 5) qi.push('题干过短');
      if (!q.options || q.options.length < 2) qi.push('选项不足');
      if (!q.answer || !/^[A-D]$/.test(q.answer)) qi.push('答案格式错误');
      if (!q.analysis || q.analysis.length < 5) qi.push('解析过短');

      // 答案必须在选项中
      if (q.options && q.answer) {
        var hasAnswer = q.options.some(function(o) { return o && o.startsWith(q.answer + '.'); });
        if (!hasAnswer) qi.push('答案' + q.answer + '不在选项中');
      }

      // 选项去重
      if (q.options && q.options.length >= 2) {
        var texts = q.options.map(function(o) { return (o || '').replace(/^[A-D]\.\s*/, ''); });
        var unique = texts.filter(function(v, i, a) { return a.indexOf(v) === i; });
        if (unique.length < texts.length) qi.push('有重复选项');
      }

      if (qi.length === 0) {
        report.valid++;
      } else {
        report.issues.push({ index: i, issues: qi, question: q.stem ? q.stem.slice(0, 50) : '' });
      }
    });

    report.quality = Math.round((report.valid / report.total) * 100);
    return report;
  }
}

// ═══ Agent 5: 贝叶斯知识追踪 (BKT) ═══
// 基于标准BKT模型: P(L) = P(L|correct) or P(L|wrong)
// 参数: P(L0)=初始掌握概率, P(T)=学习迁移概率, P(G)=猜测概率, P(S)=失误概率
class BayesianKnowledgeTracer {
  constructor() {
    // BKT 标准参数（可调优）
    this.pInit = 0.3;   // P(L0) — 初始掌握概率
    this.pTransit = 0.1; // P(T) — 每次答题后从不掌握→掌握的概率
    this.pGuess = 0.15;  // P(G) — 猜对概率（不掌握但答对）
    this.pSlip = 0.1;    // P(S) — 失误概率（掌握但答错）
    this.skills = {};     // { chapterNum: { pKnow, nCorrect, nTotal, history, lastUpdate } }
  }

  // 加载历史数据
  load(progressData) {
    var self = this;
    (progressData || []).forEach(function(p) {
      var ch = p.chapter || 0;
      if (!ch) return;
      if (!self.skills[ch]) {
        self.skills[ch] = { pKnow: self.pInit, nCorrect: 0, nTotal: 0, history: [], lastUpdate: null };
      }
      self.skills[ch].nTotal++;
      if (!p.wrongCount || p.wrongCount === 0) {
        self.skills[ch].nCorrect++;
      }
      self.skills[ch].history.push({ correct: !p.wrongCount, timestamp: Date.now() });
      self.skills[ch].lastUpdate = Date.now();
    });
    // 用历史数据跑一遍BKT更新
    Object.keys(self.skills).forEach(function(ch) {
      self.skills[ch].pKnow = self.pInit;
      self.skills[ch].history.forEach(function(h) {
        self.update(parseInt(ch), h.correct);
      });
    });
  }

  // BKT 核心公式: 根据答题结果更新 P(Know)
  update(chapter, correct) {
    var skill = this.skills[chapter];
    if (!skill) {
      skill = { pKnow: this.pInit, nCorrect: 0, nTotal: 0, history: [], lastUpdate: null };
      this.skills[chapter] = skill;
    }

    var pKnow = skill.pKnow;
    var pLearn, pEvidence;

    if (correct) {
      // P(L|correct) = P(L)*(1-P(S)) / [P(L)*(1-P(S)) + (1-P(L))*P(G)]
      var pCorrectGivenKnow = 1 - this.pSlip;
      var pCorrectGivenNotKnow = this.pGuess;
      pEvidence = pKnow * pCorrectGivenKnow + (1 - pKnow) * pCorrectGivenNotKnow;
      pLearn = (pKnow * pCorrectGivenKnow) / pEvidence;
    } else {
      // P(L|wrong) = P(L)*P(S) / [P(L)*P(S) + (1-P(L))*(1-P(G))]
      var pWrongGivenKnow = this.pSlip;
      var pWrongGivenNotKnow = 1 - this.pGuess;
      pEvidence = pKnow * pWrongGivenKnow + (1 - pKnow) * pWrongGivenNotKnow;
      pLearn = (pKnow * pWrongGivenKnow) / pEvidence;
    }

    // 学习迁移: 不掌握→掌握的概率
    pLearn = pLearn + (1 - pLearn) * this.pTransit;

    skill.pKnow = Math.min(1, Math.max(0, pLearn));
    skill.nTotal++;
    if (correct) skill.nCorrect++;
    skill.lastUpdate = Date.now();
    return skill.pKnow;
  }

  // 获取所有技能掌握度
  getMastery() {
    var self = this;
    var result = {};
    Object.keys(self.skills).forEach(function(ch) {
      var s = self.skills[ch];
      result[ch] = {
        chapter: parseInt(ch),
        pKnow: Math.round(s.pKnow * 100),
        pKnowRaw: s.pKnow,
        nTotal: s.nTotal,
        nCorrect: s.nCorrect,
        accuracy: s.nTotal > 0 ? Math.round((s.nCorrect / s.nTotal) * 100) : 0,
        level: s.pKnow >= 0.85 ? 'mastered' : s.pKnow >= 0.6 ? 'learning' : s.pKnow >= 0.3 ? 'weak' : 'new',
        recommendation: s.pKnow >= 0.85 ? '已掌握，定期复习即可' : s.pKnow >= 0.6 ? '需巩固，建议5题/天' : s.pKnow >= 0.3 ? '薄弱项，建议10题/天' : '新章节，建议从基础题开始',
      };
    });
    return result;
  }

  // 获取最薄弱的N个章节
  getWeakest(n) {
    var mastery = this.getMastery();
    return Object.values(mastery)
      .sort(function(a, b) { return a.pKnowRaw - b.pKnowRaw; })
      .slice(0, n || 5);
  }

  // 获取个性化推题计划
  getDailyPlan(targetQuestions) {
    targetQuestions = targetQuestions || 15;
    var weakest = this.getWeakest(5);
    var plan = [];
    var remaining = targetQuestions;

    weakest.forEach(function(w) {
      if (remaining <= 0) return;
      var count = w.level === 'new' ? 3 : w.level === 'weak' ? Math.ceil(remaining * 0.4) : Math.ceil(remaining * 0.2);
      count = Math.max(2, Math.min(count, remaining));
      plan.push({ chapter: w.chapter, count: count, pKnow: w.pKnow, level: w.level, reason: w.recommendation });
      remaining -= count;
    });

    return plan;
  }

  // ── 功能1: 分级测验冷启动 ──
  // 新用户无数据时，从各模块抽2题做摸底测验
  generatePlacementTest(subjectId) {
    subjectId = subjectId || 'econ';
    var graph = KNOWLEDGE_GRAPH[subjectId];
    if (!graph) return [];

    var test = [];
    var chaptersPerModule = 2; // 每模块2题

    graph.topoOrder.forEach(function(modName) {
      var mod = graph.modules[modName];
      if (!mod) return;
      // 从模块中取前2个章节
      mod.chapters.slice(0, chaptersPerModule).forEach(function(ch) {
        test.push({
          chapter: ch,
          module: modName,
          difficulty: 1, // 冷启动用基础难度
          purpose: '摸底测验 — ' + modName,
        });
      });
    });

    return test.slice(0, 14); // 7模块×2题=14题摸底
  }

  // ── 功能2: 补洞路径 ──
  // 三级分类 + 生成从薄弱到掌握的完整路径
  generateGapPath() {
    var mastery = this.getMastery();
    var weakest = this.getWeakest(99);

    var gaps = {
      critical: [],  // P(Know) < 30% — 一票否决·立即补
      weak: [],      // 30-60% — 优先攻克
      review: [],    // 60-85% — 巩固复习
    };

    weakest.forEach(function(w) {
      if (w.pKnowRaw < 0.3) {
        gaps.critical.push({ chapter: w.chapter, pKnow: w.pKnow, action: '立即补洞 — 建议连续3天·每天10题', estimatedDays: 3 });
      } else if (w.pKnowRaw < 0.6) {
        gaps.weak.push({ chapter: w.chapter, pKnow: w.pKnow, action: '优先攻克 — 建议连续2天·每天5题', estimatedDays: 2 });
      } else if (w.pKnowRaw < 0.85) {
        gaps.review.push({ chapter: w.chapter, pKnow: w.pKnow, action: '巩固复习 — 建议3题/天', estimatedDays: 1 });
      }
    });

    // 补洞顺序: critical → weak → review
    var path = [];
    gaps.critical.forEach(function(g) { path.push(Object.assign({}, g, { priority: 'P0' })); });
    gaps.weak.forEach(function(g) { path.push(Object.assign({}, g, { priority: 'P1' })); });
    gaps.review.forEach(function(g) { path.push(Object.assign({}, g, { priority: 'P2' })); });

    return {
      totalGaps: path.length,
      criticalCount: gaps.critical.length,
      weakCount: gaps.weak.length,
      reviewCount: gaps.review.length,
      estimatedTotalDays: path.reduce(function(s, g) { return s + (g.estimatedDays || 0); }, 0),
      path: path,
      summary: path.length === 0
        ? '🎉 所有章节已掌握！保持每天15题复习即可'
        : gaps.critical.length > 0
          ? '🔴 ' + gaps.critical.length + '个章节需立即补洞（预计' + gaps.critical.reduce(function(s, g) { return s + g.estimatedDays; }, 0) + '天）'
          : gaps.weak.length > 0
            ? '🟡 ' + gaps.weak.length + '个章节需优先攻克'
            : '🟢 ' + gaps.review.length + '个章节巩固复习即可',
    };
  }

  // ── 功能3: 重练直到掌握 ──
  // 为单个薄弱章节生成渐进式练习序列
  buildMasteryPath(chapterNum, targetMastery) {
    targetMastery = targetMastery || 0.85;
    var skill = this.skills[chapterNum];
    var currentMastery = skill ? skill.pKnow : 0;

    if (currentMastery >= targetMastery) {
      return { chapter: chapterNum, status: 'mastered', currentPKnow: Math.round(currentMastery * 100), rounds: 0, message: '已掌握，无需重练' };
    }

    var gap = targetMastery - currentMastery;
    var rounds = Math.ceil(gap / 0.15); // 每轮预计提升约15%

    var masteryPath = [];
    for (var i = 0; i < rounds; i++) {
      var roundDifficulty = i === 0 ? 1 : (i === 1 ? 2 : 3);
      masteryPath.push({
        round: i + 1,
        questions: Math.min(3 + i * 3, 10),
        difficulty: roundDifficulty,
        targetPKnow: Math.round(Math.min(currentMastery + (i + 1) * 0.15, targetMastery) * 100),
        description: i === 0 ? '基础摸底' : i === rounds - 1 ? '冲刺达标' : '巩固提升',
      });
    }

    return {
      chapter: chapterNum,
      currentPKnow: Math.round(currentMastery * 100),
      targetPKnow: Math.round(targetMastery * 100),
      rounds: rounds,
      path: masteryPath,
      message: '需要' + rounds + '轮练习达到' + Math.round(targetMastery * 100) + '%掌握度',
    };
  }
}

// 全局BKT实例
var bktInstance = null;
export function getBKT() {
  if (!bktInstance) bktInstance = new BayesianKnowledgeTracer();
  return bktInstance;
}

// ═══ 个性化每日推题 ═══
export function generateDailyPlan(progressData) {
  var plan = { date: new Date().toISOString().slice(0, 10), total: 15, schedule: [], tip: '' };

  // 知识图谱拓扑排序
  var graph = KNOWLEDGE_GRAPH.econ;
  if (!graph) return plan;

  var chapterStats = {};
  (progressData || []).forEach(function(p) {
    var ch = p.chapter || 0;
    if (!ch) return;
    if (!chapterStats[ch]) chapterStats[ch] = { total: 0, wrong: 0, correct: 0 };
    chapterStats[ch].total++;
    if (p.wrongCount > 0) chapterStats[ch].wrong++;
    else chapterStats[ch].correct++;
  });

  // 按模块优先级 + 掌握度排序
  var modulePlan = [];
  graph.topoOrder.forEach(function(modName) {
    var mod = graph.modules[modName];
    if (!mod) return;
    var total = 0, wrong = 0;
    mod.chapters.forEach(function(ch) {
      var s = chapterStats[ch];
      if (s) { total += s.total; wrong += s.wrong; }
    });
    var mastery = total > 0 ? Math.round((1 - wrong / total) * 100) : 0;
    modulePlan.push({ module: modName, chapters: mod.chapters, mastery: mastery, total: total });
  });

  // 优先未开始的模块，再薄弱模块
  modulePlan.sort(function(a, b) {
    if (a.total === 0 && b.total > 0) return -1;
    if (b.total === 0 && a.total > 0) return 1;
    return a.mastery - b.mastery;
  });

  var priorityModules = modulePlan.filter(function(m) { return m.mastery < 60 || m.total === 0; }).slice(0, 3);

  plan.schedule = priorityModules.map(function(m) {
    return { module: m.module, chapters: m.chapters.slice(0, 3), questionCount: 5, currentMastery: m.mastery, reason: m.total === 0 ? '新模块，建议开始学习' : '掌握度' + m.mastery + '%，需加强' };
  });

  if (plan.schedule.length === 0) {
    plan.schedule = [{ module: '综合复习', chapters: [1, 7, 11, 18, 23], questionCount: 15, reason: '全面复习，查漏补缺' }];
  }

  plan.tip = plan.schedule.length > 0
    ? '今日重点: ' + plan.schedule[0].module + ' (' + plan.schedule[0].currentMastery + '%掌握)'
    : '保持节奏，每天15题';

  return plan;
}

// ═══ 公共API ═══
export async function generateQuestions(opts) {
  var intent = Analyzer.analyze(opts.keyword || opts.prompt || '');
  if (opts.subjectId) intent.subject = opts.subjectId;
  if (opts.count) intent.count = opts.count;
  if (opts.difficulty) intent.difficulty = opts.difficulty;
  if (opts.chapter) { intent.chapters = [opts.chapter]; intent.mode = 'chapter'; }

  var progress = [];
  try { progress = JSON.parse(localStorage.getItem('mmj_progress') || '[]'); } catch(e) {}

  var context = Retriever.retrieve(intent, progress);
  var questions = await Generator.generate(intent, context);
  var validation = Validator.validate(questions);

  return {
    questions: questions,
    intent: intent,
    context: { chapters: context.chapters, weakPoints: context.weakPoints },
    validation: validation,
    meta: { total: questions.length, valid: validation.valid, quality: validation.quality, byDifficulty: countByDifficulty(questions) },
  };
}

export async function generateWeakPointQuestions(weakChapters, progress, count) {
  return generateQuestions({
    subjectId: 'econ',
    chapters: weakChapters || [],
    count: count || 10,
    difficulty: 'medium',
    mode: 'weakness',
    prompt: '针对薄弱章节的专项练习',
  });
}

export function generateVariants(wrongQuestion, count) {
  count = count || 3;
  var variants = [];
  for (var i = 0; i < count; i++) {
    var templates = [
      '关于' + extractTopic(wrongQuestion.stem || '') + '，以下说法正确的是？',
      '根据相关理论，下列哪项描述最准确？',
      '换个角度考查同一知识点：以下哪个选项是正确的？',
    ];
    variants.push({
      id: 'var-' + Date.now() + '-' + i,
      stem: templates[i % templates.length],
      type: wrongQuestion.type || 'single',
      options: shuffleOptions(wrongQuestion.options || [], wrongQuestion.answer, i),
      answer: wrongQuestion.answer,
      analysis: wrongQuestion.analysis || '',
      difficulty: wrongQuestion.difficulty || 2,
      variantOf: wrongQuestion.id,
      variantIndex: i + 1,
      source: 'variant',
    });
  }
  return variants;
}

export function analyzeWeakPoints(progressData) {
  var graph = KNOWLEDGE_GRAPH.econ;
  var chapterStats = {};
  (progressData || []).forEach(function(p) {
    var ch = p.chapter || 0;
    if (!ch) return;
    if (!chapterStats[ch]) chapterStats[ch] = { num: ch, total: 0, wrong: 0, module: '' };
    chapterStats[ch].total++;
    if (p.wrongCount > 0 || p._lastCorrect === false) chapterStats[ch].wrong++;
  });

  // 关联模块名
  if (graph) {
    Object.entries(graph.modules).forEach(function(entry) {
      var modName = entry[0];
      var mod = entry[1];
      mod.chapters.forEach(function(ch) {
        if (chapterStats[ch]) chapterStats[ch].module = modName;
      });
    });
  }

  var weakList = Object.values(chapterStats)
    .filter(function(s) { return s.total >= 3; })
    .map(function(s) { s.accuracy = Math.round((1 - s.wrong / Math.max(1, s.total)) * 100); return s; })
    .sort(function(a, b) { return a.accuracy - b.accuracy; });

  return {
    totalChapters: Object.keys(chapterStats).length,
    weakest: weakList.slice(0, 3),
    needReview: weakList.filter(function(s) { return s.accuracy < 50; }),
    byModule: groupByModule(weakList),
    overallAccuracy: weakList.length > 0
      ? Math.round(weakList.reduce(function(s, c) { return s + c.accuracy; }, 0) / weakList.length)
      : 0,
  };
}

// ═══ 辅助函数 ═══
function extractTopic(stem) {
  return (stem || '').replace(/[？?，。！、；：""''（）]/g, ' ').split(' ').filter(function(w) { return w.length >= 2; }).slice(0, 2).join('');
}

function shuffleOptions(options, answer, seed) {
  if (!options || options.length < 2) return options;
  var arr = options.slice();
  for (var i = arr.length - 1; i > 0; i--) {
    var j = (seed * 7 + i * 3) % (i + 1);
    if (arr[i] && arr[j] && arr[i].charAt(0) !== answer && arr[j].charAt(0) !== answer) {
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
  }
  return arr;
}

function countByDifficulty(questions) {
  var counts = { easy: 0, medium: 0, hard: 0 };
  questions.forEach(function(q) {
    if (q.difficulty <= 1) counts.easy++;
    else if (q.difficulty >= 3) counts.hard++;
    else counts.medium++;
  });
  return counts;
}

function groupByModule(weakList) {
  var groups = {};
  weakList.forEach(function(w) {
    var mod = w.module || '其他';
    if (!groups[mod]) groups[mod] = { chapters: [], avgAccuracy: 0 };
    groups[mod].chapters.push(w.num);
    groups[mod].avgAccuracy = Math.round((groups[mod].avgAccuracy * (groups[mod].chapters.length - 1) + w.accuracy) / groups[mod].chapters.length);
  });
  return groups;
}

export { DIFFICULTY, KNOWLEDGE_GRAPH };
