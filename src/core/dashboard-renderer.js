// core/dashboard-renderer.js — L2: 配置驱动渲染器
// 读DASHBOARD_LAYOUT → 渲染组件 → 三态兜底
import { DASHBOARD_LAYOUT } from '../config/dashboard.config.js';
import { renderWelcomeBar } from '../components/WelcomeBar.js';
import { renderAIBrain } from '../components/AIBrain.js';

// 组件注册表
var COMPONENTS = {
  WelcomeBar: function(props, state) { return renderWelcomeBar(state); },
  AIBrain: function(props, state) { return renderAIBrain(); },
  // 其他组件先保留在模板中
  StatsRow: function() { return ''; },
  ProgressBar: function() { return ''; },
  WeakPoint: function() { return ''; },
  RadarChart: function() { return ''; },
  LearningFlow: function() { return ''; },
  ChapterList: function() { return ''; },
  ExploreGrid: function() { return ''; },
  BadgeWall: function() { return ''; },
};

export function getLayout() {
  return DASHBOARD_LAYOUT;
}

export function renderSection(sectionId, state) {
  var config = DASHBOARD_LAYOUT;
  var section = config.sections.find(function(s) { return s.id === sectionId; });
  if (!section) return '';
  var renderFn = COMPONENTS[section.component];
  if (!renderFn) return '<!-- component not found: ' + section.component + ' -->';
  try {
    var html = renderFn(section.props, state);
    return html || '';
  } catch(e) {
    console.error('[Dashboard] render failed:', sectionId, e.message);
    return '<!-- render error: ' + sectionId + ' -->';
  }
}

// 一键渲染所有已注册组件
export function renderRegisteredComponents(state) {
  var config = DASHBOARD_LAYOUT;
  var html = '';
  var sorted = config.sections.slice().sort(function(a, b) { return a.priority - b.priority; });
  sorted.forEach(function(section) {
    var result = renderSection(section.id, state);
    if (result) html += result;
  });
  return html;
}

// 注册新组件
export function registerComponent(name, renderFn) {
  COMPONENTS[name] = renderFn;
}
