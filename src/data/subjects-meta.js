// src/data/subjects-meta.js — 科目章节元数据（轻量常驻）
// 经济基础知识 37章 + 人力资源管理 19章 + 工商管理 11章

export const SUBJECTS_META = [
  {
    id: 'econ',
    name: '中级经济师·经济基础',
    icon: '📊',
    totalChapters: 37,
    examConfig: { totalQuestions: 105, timeLimit: 90, singleCount: 70, multiCount: 35, caseCount: 0 },
    modules: [
      { id: 'economics', name: '经济学基础', weight: 0.30, chapters: [1,2,3,4,5,6,7,8,9,10] },
      { id: 'public_finance', name: '财政', weight: 0.25, chapters: [11,12,13,14,15,16,17] },
      { id: 'finance', name: '货币与金融', weight: 0.25, chapters: [18,19,20,21,22] },
      { id: 'statistics', name: '统计', weight: 0.08, chapters: [23,24,25,26,27] },
      { id: 'accounting', name: '会计', weight: 0.07, chapters: [28,29,30,31,32] },
      { id: 'law', name: '法律', weight: 0.05, chapters: [33,34,35,36,37] },
    ],
    chapters: generateChapters(37, [
      '社会主义基本经济制度','市场需求、供给与均衡价格','生产和成本理论',
      '市场结构理论','生产要素市场理论','市场失灵和政府的干预',
      '国民收入核算和简单的宏观经济模型','经济增长和经济发展理论',
      '价格总水平和就业、失业','国际贸易理论和政策',
      '公共物品与财政职能','财政支出','财政收入','税收制度',
      '政府预算','财政管理体制','财政政策',
      '货币供求与货币均衡','中央银行与货币政策','商业银行与金融市场',
      '金融风险与金融监管','对外金融关系与政策',
      '统计与统计数据','描述统计','抽样调查','回归分析','时间序列分析',
      '会计概论','会计循环','会计报表','会计报表分析','政府会计',
      '法律对经济关系的调整','物权法律制度','合同法律制度',
      '公司法律制度','其他法律制度',
    ]),
  },
  {
    id: 'hr',
    name: '中级经济师·人力资源管理',
    icon: '👥',
    totalChapters: 19,
    examConfig: { totalQuestions: 100, timeLimit: 90, singleCount: 60, multiCount: 20, caseCount: 20 },
    modules: [
      { id: 'org_behavior', name: '组织行为学', weight: 0.25, chapters: [1,2,3] },
      { id: 'hr_management', name: '人力资源管理', weight: 0.40, chapters: [4,5,6,7,8,9] },
      { id: 'labor_econ', name: '劳动力市场', weight: 0.20, chapters: [10,11,12,13] },
      { id: 'labor_law', name: '劳动法律与社会保险', weight: 0.15, chapters: [14,15,16,17,18,19] },
    ],
    chapters: generateChapters(19, [
      '组织激励','领导行为','组织设计与组织文化',
      '战略性人力资源管理','人力资源规划','人员甄选',
      '绩效管理','薪酬管理','培训与开发','劳动关系',
      '劳动力市场理论','工资与就业理论','人力资本投资理论',
      '劳动合同管理与特殊用工','社会保险法律','社会保险体系',
      '劳动争议调解仲裁','法律责任与行政执法','人力资源开发政策',
    ]),
  },
  {
    id: 'biz',
    name: '中级经济师·工商管理',
    icon: '🏭',
    totalChapters: 11,
    examConfig: { totalQuestions: 100, timeLimit: 90, singleCount: 60, multiCount: 20, caseCount: 20 },
    modules: [
      { id: 'strategy', name: '企业战略与经营决策', weight: 0.15, chapters: [1] },
      { id: 'governance', name: '公司治理', weight: 0.08, chapters: [2] },
      { id: 'marketing', name: '市场营销与分销', weight: 0.15, chapters: [3,4] },
      { id: 'operations', name: '生产与物流', weight: 0.20, chapters: [5,6] },
      { id: 'innovation', name: '技术创新管理', weight: 0.10, chapters: [7] },
      { id: 'hr_finance', name: '人力资源与投融资', weight: 0.17, chapters: [8,9] },
      { id: 'ecommerce', name: '电子商务与国际商务', weight: 0.15, chapters: [10,11] },
    ],
    chapters: generateChapters(11, [
      '企业战略与经营决策','公司法人治理结构','市场营销与品牌管理',
      '分销渠道管理','生产管理','物流管理','技术创新管理',
      '人力资源规划与薪酬管理','企业投融资决策及并购重组',
      '电子商务','国际商务运营',
    ]),
  },
];

function generateChapters(count, names) {
  return names.slice(0, count).map((name, i) => ({
    id: i + 1,
    name: `第${i + 1}章 ${name}`,
    tier: getTier(i + 1),
  }));
}

// 按章节权重分梯队
function getTier(chapter) {
  const tier1 = [2, 14, 18, 19, 20, 21, 22, 23, 28, 34]; // 第一梯队
  const tier2 = [1, 13, 24, 30]; // 第二梯队
  if (tier1.includes(chapter)) return 1;
  if (tier2.includes(chapter)) return 2;
  return 3;
}

// ─── 工具函数 ───
export function getSubjectMeta(subjectId) {
  return SUBJECTS_META.find(s => s.id === subjectId);
}

export function getChapterName(subjectId, chapterNum) {
  const meta = getSubjectMeta(subjectId);
  if (!meta) return '';
  const ch = meta.chapters.find(c => c.id === chapterNum);
  return ch ? ch.name : '';
}

export function getAllSubjectIds() {
  return SUBJECTS_META.map(s => s.id);
}
