# 慢慢记 (ManManJi) 备考系统 — CLAUDE.md

## 项目定位
面向 28-45 岁职场大龄考生的全渠道备考平台。PC + H5 + 微信小程序三端统一。
8 大考试品类：中级经济师、会计师、教师资格证、社会工作者、二级建造师、人力资源管理师、税务师、初级会计师。

## 技术栈
- 前端：Vanilla JS + HTML + CSS（组件化架构），三端统一 UI 设计系统
- 后端：Node.js + Express，模块化业务
- 数据库：MongoDB + Redis 缓存
- 实时同步：WebSocket / Firebase Realtime Database
- 支付：微信支付 API（Web）+ 小程序 JSSDK
- 部署：Docker Compose，Nginx 静态托管 + PM2 + MongoDB

## 目录结构
```
d:\project\kaoshi/
  app.js          — 前端主逻辑（SPA 路由 + 组件渲染）
  app.css         — 全局样式系统
  data.js         — 题库数据 / 考试品类数据
  index.html      — 入口页面
  CLAUDE.md       — 本文件
  .claude/        — Claude Code 项目配置
  docs/           — 长期文档（设计说明、实现总结）
  scratch/        — 临时脚本（已加入 .gitignore）
```

## Artifact 与 Scratch 分离约定
- `docs/artifacts/` — 需长期保存的文档（设计说明、实现总结、路线图）
- `scratch/` — 一次性脚本、临时数据，不提交到 Git

## UI 设计约束（Rich Design Aesthetic）
- 护眼模式 + 大龄关怀：字体缩放、高对比度、大触控区域（≥44px）
- 配色方案从 96 方案中选择，禁止随意配色
- 字体：标题 Outfit / 正文 Inter（Google Fonts）
- 布局：Flexbox / Grid，禁止 float / table 布局
- 响应式：移动优先，测试 375px / 768px / 1440px
- 图标：Lucide / Heroicons SVG，禁止 emoji
- 动画：transition 150-300ms，支持 prefers-reduced-motion

## 工作模式
- 复杂功能先进入 Plan Mode（用户确认后编码）
- 每个功能模块写完立即验证（构建 + 测试）
- 修改文件后自动生成 diff 摘要供审阅

## 约束
- 所有文件路径必须在 d:\project\kaoshi 内
- 覆盖已有文件前需显式确认
- 禁止引入 jQuery / Bootstrap 3-4
- 支付相关代码需额外安全审查
