# 慢慢记备考系统设计说明

## 1. 项目概述
**慢慢记（ManManJi）**是一款面向 28‑45 岁职场大龄考生的全渠道备考平台，提供 **PC、H5、微信小程序** 三端统一体验，涵盖 **中级经济师、会计师、教师资格证、社会工作者、二级建造师** 等 8 大考试品类。系统核心围绕 **艾宾浩斯记忆曲线** 实现智能复盘，辅以 **大龄关怀 UI**（护眼、字体缩放）以及 **实时教研内容同步**，形成闭环学习闭环。

## 2. 系统架构
```
+-------------------+      +-------------------+      +-------------------+
|   前端 (Three‑   |      |   后端服务 (Node |      |   数据存储 (DB)   |
|   channel) UI     |<---->|   + API)          |<---->|   + MongoDB       |
|   - React/Vue    |      |   - 业务逻辑层    |      |   - 用户、进度、   |
|   - 微信小程序  |      |   - 统一订单中心  |      |     会员、题库    |
|   - PC/H5 SPA    |      |   - 实时推送 (WS) |      |   - Redis 缓存   |
+-------------------+      +-------------------+      +-------------------+
        ^   ^                      ^   ^                     ^   ^
        |   |                      |   |                     |   |
        |   +--- 微服务（支付、
        |        同步、积分）   |
        +-----------------------+-------------------------+
```
- **前端**：使用 **Vanilla JS + HTML + CSS**（或 Vue3）实现组件化，统一 UI 设计系统（颜色、字体、微交互）。
- **后端**：Node.js + Express，模块化业务（用户、题库、会员、复盘引擎）。
- **实时同步**：WebSocket / Firebase Realtime Database，实现 PC ↔ H5 ↔ 小程序数据即时同步。
- **支付**：微信支付 API（Web） + 小程序 JSSDK（wx.pay），统一订单中心。
- **缓存**：Redis 用于积分、短期学习进度、限流。
- **部署**：Docker Compose，前端 Nginx 静态托管，后端 Node 在 PM2 进程管理下运行，MongoDB 持久化。

## 3. 关键业务模块
| 模块 | 功能描述 | 主要技术点 |
|------|----------|------------|
| **用户管理** | 注册、登录、头像、角色（普通/会员） | JWT、bcrypt、Redis Session |
| **学习看板** | 多科目并行进度、章节列表、任务卡片 | React/Vue 组件、路由懒加载 |
| **题库/模考** | 题目展示、答题、计时、错题本 | CBT 模拟机、Web Worker 计时 |
| **艾宾浩斯复盘** | 根据遗忘曲线生成复习计划、提醒 | 定时任务 (node‑cron)、本地 Notification |
| **会员体系** | 免费/单科/全站通卡、积分、权益中心 | 微信支付、订单状态回调、积分规则 |
| **教研同步** | PC 内容编辑即时推送至移动/小程序 | WebSocket / Firebase Realtime |
| **大龄关怀** | 字体大小、护眼暗模式、阅读计时 | CSS Custom Properties、prefers‑color‑scheme |
| **社群运营** | 积分、成就、排行榜、社群入口 | Redis 累计、定时推送、微信群机器人 |
| **导出功能** | PDF/EPUB 生成学习笔记、讲义 | pdfmake、epub‑gen |
| **案例口碑** | 成功案例提交、审核、星级评价 | 审核工作流、Masonry 卡片布局 |

## 4. 数据模型（简要）
```json
User {
  _id: ObjectId,
  username: String,
  passwordHash: String,
  avatarUrl: String,
  membershipTier: Enum('free','single','vip'),
  points: Number,
  createdAt: Date,
  updatedAt: Date,
  subjectsState: {
    [subjectId]: {
      pointsChecked: [String],
      quizDoneCount: Number,
      checkIn: Boolean,
      progress: Number
    }
  }
}

Subject {
  _id: ObjectId,
  id: String, // e.g. "econ"
  name: String,
  chapters: [Chapter]
}

Chapter {
  id: String,
  title: String,
  lessons: [Lesson]
}

Lesson {
  id: String,
  title: String,
  content: String,
  questions: [Question]
}

Question {
  id: String,
  type: Enum('single','multiple','truefalse'),
  stem: String,
  options: [{ key: String, text: String }],
  answer: [String],
  analysis: String
}
```

## 5. 接口设计（REST + WS）
- `POST /api/auth/login`
- `GET /api/subjects` → 返回所有科目元信息
- `GET /api/subject/:id/chapters`
- `POST /api/quiz/submit`（提交答案，返回错题、记忆曲线更新）
- `POST /api/payment/create`（生成微信统一下单）
- `GET /api/payment/status/:orderId`
- `WebSocket /ws/sync`（用户状态实时推送）

## 6. UI/UX 设计要点
1. **配色**：主色 HSL(210, 45%, 55%)，辅色 HSL(340, 35%, 60%)，深色模式使用暗灰基底。
2. **动效**：卡片悬停微动、进度条渐变、题目切换淡入淡出。
3. **响应式**：Flex/Grid Layout，PC 采用三列布局，移动端单列卡片。
4. **无障碍**：ARIA 标签、键盘导航、字号可调（`font-size: var(--base-size)`）
5. **护眼模式**：`prefers-color-scheme: dark` 自动切换，配合柔和的背景纹理。

## 7. 部署与运维
- **容器化**：`docker-compose.yml` 包含 `frontend`, `backend`, `mongo`, `redis` 四个服务。
- **CI/CD**：GitHub Actions → Docker Build → 推送至私有镜像仓库 → 自动部署至阿里云 ECS。
- **监控**：Prometheus + Grafana 监控 CPU、内存、请求时延；日志使用 Loki。
- **备份**：MongoDB 每日快照 + Redis RDB 持久化。

## 8. 里程碑计划（对应《实现概览与后续开发计划》）
| 阶段 | 关键交付 | 完成时间 |
|------|-----------|----------|
| 1️⃣ 核心商业化 | 微信支付、三端同步、会员 UI | 2026‑07‑15 |
| 2️⃣ 活跃运营 | 社群积分、冲刺专项、运营后台 | 2026‑08‑31 |
| 3️⃣ 内容导出 | PDF/EPUB 生成、下载 UI | 2026‑10‑15 |
| 4️⃣ 口碑系统 | 案例提交、审核、展示页 | 2026‑11‑30 |

---

> 本设计说明已保存至 `d:\project\kaoshi\design_specification.md`，供后续开发、评审与文档维护使用。
