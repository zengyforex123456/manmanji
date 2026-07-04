// config/dashboard.config.js — 首页布局配置
// 改布局只需改这里，不改组件代码
// 支持A/B测试：复制一份改配置即可

export const DASHBOARD_LAYOUT = {
  version: '1.0',
  fallback: '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh"><div style="text-align:center"><div style="font-size:48px">📚</div><div style="font-size:16px;font-weight:700;margin-top:12px">加载中...</div><div style="font-size:13px;color:#94a3b8;margin-top:4px">如果长时间未响应，请<a href="javascript:location.reload()" style="color:#6366f1">刷新页面</a></div></div></div>',

  sections: [
    {
      id: 'welcome',
      component: 'WelcomeBar',
      position: 'top',
      props: {},
      priority: 0,
    },
    {
      id: 'stats',
      component: 'StatsRow',
      position: 'top',
      props: { labels: ['📋 待复习', '📊 掌握度', '🔥 连续'], keys: ['dueToday', 'mastery', 'streak'] },
      priority: 1,
    },
    {
      id: 'progress',
      component: 'ProgressBar',
      position: 'top',
      props: { target: 500, levels: [{ label: '新手', max: 50, icon: '🔰' }, { label: '入门', max: 100, icon: '🌿' }, { label: '进阶', max: 200, icon: '📊' }, { label: '冲刺', max: 500, icon: '🚀' }] },
      priority: 2,
    },
    {
      id: 'weakpoint',
      component: 'WeakPoint',
      position: 'top',
      props: { threshold: 0.6 },
      priority: 3,
    },
    {
      id: 'radar',
      component: 'RadarChart',
      position: 'top',
      props: {},
      priority: 4,
    },
    {
      id: 'aibrain',
      component: 'AIBrain',
      position: 'top',
      props: { minQuestions: 5 },
      priority: 5,
    },
    {
      id: 'learningFlow',
      component: 'LearningFlow',
      position: 'middle',
      props: { steps: [{ id: 'beginner', num: 1, name: '开始刷题', desc: '从高频考点开始' }, { id: 'mistake', num: 2, name: '错题重做', desc: '暂无错题' }, { id: 'mock', num: 3, name: '模拟考试', desc: '建议先刷够50题再来' }] },
      priority: 6,
    },
    {
      id: 'chapters',
      component: 'ChapterList',
      position: 'middle',
      props: {},
      priority: 7,
    },
    {
      id: 'explore',
      component: 'ExploreGrid',
      position: 'middle',
      props: {
        items: [
          { id: 'ai', icon: '🤖', name: 'AI智能出题', desc: 'AI生成针对性练习', why: '适合：薄弱项靶向攻克', badge: '⭐推荐', badgeColor: '#8b5cf6', action: 'startAIQuestions', highlight: true },
          { id: 'random', icon: '🎲', name: '随机挑战', desc: '全题库随机20题', why: '适合：检验综合水平', action: 'startMode:advanced' },
          { id: 'custom', icon: '⚙️', name: '自由组卷', desc: '自选数量·模式·范围', why: '适合：针对性练习', action: 'toggle:custom-panel' },
        ],
      },
      priority: 8,
    },
    {
      id: 'badges',
      component: 'BadgeWall',
      position: 'bottom',
      props: {},
      priority: 9,
    },
  ],
};

// A/B测试变体（备选布局：AI诊断提到最上面）
export const DASHBOARD_LAYOUT_B = {
  ...DASHBOARD_LAYOUT,
  version: '1.0-b',
  sections: DASHBOARD_LAYOUT.sections.map(function(s) {
    if (s.id === 'aibrain') return Object.assign({}, s, { priority: -1, position: 'hero' });
    return s;
  }),
};
