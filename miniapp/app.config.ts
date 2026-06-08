export default {
  pages: [
    'pages/index/index',
    'pages/quiz/quiz',
    'pages/profile/profile',
  ],
  window: {
    navigationBarTitleText: '职考通',
    navigationBarBackgroundColor: '#0f766e',
    navigationBarTextStyle: 'white',
    backgroundColor: '#f1f5f9',
  },
  tabBar: {
    color: '#64748b',
    selectedColor: '#0f766e',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/index/index', text: '首页速学', iconPath: '', selectedIconPath: '' },
      { pagePath: 'pages/quiz/quiz', text: '真题精练', iconPath: '', selectedIconPath: '' },
      { pagePath: 'pages/profile/profile', text: '个人中心', iconPath: '', selectedIconPath: '' },
    ],
  },
};
