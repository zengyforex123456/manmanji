# 部署后运维指南 — 慢慢记(ManManJi)

> 部署上线 ≠ 完事。以下是让数据真正驱动增长的 4 件事。

---

## 1️⃣ 定时分析（Cron — 让数据自己说话）

部署到服务器后，加一条 crontab，每天自动跑分析：

```bash
# 服务器上执行: crontab -e
# 每天早上6点自动分析昨天的数据

0 6 * * * cd /path/to/kaoshi && node scripts/run-all-analysis.cjs >> /var/log/zhice-analysis.log 2>&1
```

**每天自动产出**：
- `docs/analysis/user_insight_{日期}.md` — 用户行为报告 + ICE 优化建议
- `docs/marketing/marketing_insight_{日期}.md` — 渠道效果 + 内容建议
- `docs/analysis/ab_test_result_{日期}.md` — A/B测试显著性判断（有数据时）

**不需要大模型**，纯 Node.js 计算，秒级完成。

---

## 2️⃣ 数据管道检查（确保埋点数据完整）

服务器上跑之前确认这几点：

### 2.1 埋点是否在生产环境写入
```bash
# 确认生产环境 metrics.json 在增长
watch -n 5 "wc -l /path/to/kaoshi/data/metrics.json"
```

### 2.2 数据编码检查
你当前的 `metrics.json` 有 UTF-8 乱码问题（中文显示为 `��`）。修复方式：

```js
// 在服务器端写入 metrics.json 时，强制 UTF-8
fs.writeFileSync(metricsPath, JSON.stringify(events), 'utf-8');
```

### 2.3 必填字段完整性
确保每个埋点事件包含关键字段：
- `question_answered`: questionId, subjectId, mode, correct
- `session_start`: userAgent, timestamp
- `mode_completed`: mode, score, totalTime

### 2.4 数据量门槛
分析脚本在数据量不足时会自动标注"数据不足"。建议：
- ≥ 100 条答题 → 可生成初步报告
- ≥ 1000 条答题 → 统计有显著性
- ≥ 10000 条答题 → 可做 ML 模型

---

## 3️⃣ 监控告警（不能只看不管）

### 3.1 关键指标监控

用 PM2 或直接加一个健康检查端点：

```js
// server/metrics.js — 在 Express 中加一个 /health 端点
app.get('/health', (req, res) => {
  const metrics = JSON.parse(fs.readFileSync('data/metrics.json', 'utf-8'));
  const answers = metrics.filter(e => e.event === 'question_answered');
  res.json({
    status: 'ok',
    totalEvents: metrics.length,
    answers24h: answers.filter(a => {
      return Date.now() - new Date(a.serverTime).getTime() < 86400000;
    }).length,
    uptime: process.uptime()
  });
});
```

### 3.2 设置告警规则

| 条件 | 含义 | 动作 |
|------|------|------|
| 24h 0条新事件 | 埋点断了 | 检查前端 sendBeacon |
| 整体正确率 < 20% 连续3天 | 题目太难或用户瞎点 | 检查题目质量 |
| 开始→完成率 < 10% | 用户体验差 | 检查产品流程 |
| 单日新增用户 = 0 | 增长停滞 | 启动营销推广 |

### 3.3 PM2 进程监控

```bash
# pm2 ecosystem.config.cjs 中加入健康检查
module.exports = {
  apps: [{
    name: 'kaoshi-api',
    script: 'server/index.js',
    max_memory_restart: '500M',
    error_file: '/var/log/kaoshi-error.log',
    out_file: '/var/log/kaoshi-out.log',
  }]
};
```

---

## 4️⃣ 分析→执行闭环（最重要的）

分析报告生成后，**不是存着看的，是要执行的**：

### 每周一：看分析报告，定本周优化方向

```bash
# 在服务器上查看最新分析报告
cat docs/analysis/user_insight_*.md | tail -100
```

关注报告中的 **ICE 优先级表**，挑 ICE 分最高的 1-2 项本周执行。

### 执行模板（每一项优化都按这个来）

```
第1步：选一个优化项（从ICE表）
  ↓
第2步：实现优化（改代码）
  ↓
第3步：加 ab_group 埋点（如果适合A/B测试）
  ↓
第4步：上线，等3-7天
  ↓
第5步：运行 npm run analyze，看效果
  ↓
第6步：有效→固化；无效→回滚+记录原因
```

### 你的当前数据已经发现了什么

基于刚才的分析（22条事件/11道答题）：

| 发现 | ICE分 | 建议动作 |
|------|:----:|------|
| 🔴 开始→完成率仅25%（10题→只完成1次） | 720 | **立即执行**：新手模式改为5题 |
| 🔴 整体正确率18.2%（11题对2题） | - | 检查题目难度/econ题目是否正确入库 |
| 🟡 用户反馈含"夜间模式"需求 | 420 | 排入下一迭代 |
| ℹ️ 活跃高峰20:00（占83%会话） | - | 推送通知安排在19:30 |

---

## 5️⃣ 部署检查清单

上线前逐条确认：

```
□ 埋点在生产环境正常写入 data/metrics.json
□ UTF-8 编码问题已修复（无乱码）
□ crontab 已添加每日分析任务
□ /health 端点可访问
□ PM2 进程监控已配置
□ 日志目录有写入权限 (/var/log/)
□ MongoDB 连接正常
□ Redis 缓存正常
□ 微信支付配置正确（如已接入）
□ SSL 证书有效
□ 防火墙规则正确（仅开放 80/443）
```

---

## 6️⃣ 两种使用模式总结

| 场景 | 用什么 | 需要什么 |
|------|--------|---------|
| **在 Claude Code 里深度分析** | 触发词：`分析用户` `营销推广` `数据驱动` | Claude Code + MCP |
| **服务器定时自动分析** | `npm run analyze` | 仅 Node.js（零 LLM 依赖） |
| **看报告做决策** | 打开 `docs/analysis/*.md` | 任何文本编辑器 |
| **A/B测试验证** | `npm run analyze:ab` | 仅 Node.js |

**核心原则**：
- 有 Claude 时 → 用规则引擎做深度推理（内容策略、竞品分析、复杂归因）
- 没 Claude 时 → 用 Node.js 脚本做统计计算（正确率、漏斗、ICE、卡方检验）
- 两种模式输出同一套文件格式，互相兼容
