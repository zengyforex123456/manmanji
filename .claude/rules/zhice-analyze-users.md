# 智策分析 01 — 用户数据分析 + 产品优化

## Trigger
"分析用户" "用户数据" "优化建议" "产品诊断" "数据洞察"

## Input
- `data/metrics.json` — 用户行为事件（session_start/question_answered/mode_started/mode_completed）
- `data/feedback.json` — 用户反馈
- `data/users.json` — 用户数据
- PRD R1-R24 — 产品需求（用于对比实际vs预期）

---

## Action

### Step 1: 用户行为数据分析

从 `data/metrics.json` 提取并分析：

#### 1.1 答题正确率分析
```
计算公式: 正确数 / 总答题数
分组: 按 subjectId(科目) + mode(模式) 分组

输出:
| 科目 | 模式 | 总答题 | 正确数 | 正确率 | 诊断 |
|------|------|:-----:|:-----:|:-----:|------|
| econ | beginner | XX | XX | XX% | 🟢/🟡/🔴 |
| hr | mistake | XX | XX | XX% | 🟢/🟡/🔴 |
```

#### 1.2 用户行为漏斗
```
session_start → mode_started → question_answered → mode_completed

计算每步转化率:
- 启动→开始做题率 = mode_started / session_start
- 开始→完成率 = mode_completed / mode_started
- 平均每题耗时 = (题间timestamp差) 的中位数
```

#### 1.3 高频错题识别
```
按 questionId 聚合错题，降序排列TOP10:
| 排名 | 题目ID | 错误次数 | 错误率 | 关联章节 |
|:---:|--------|:------:|:-----:|---------|
```

#### 1.4 用户会话模式
```
- 日均会话数
- 平均会话时长
- 活跃时段分布（按hour分组）
- 设备分布（Windows/iOS/Android）
```

### Step 2: 产品优化建议生成

基于数据分析结果，自动生成分级建议：

#### 🔴 高优（直接影响留存/转化）
- 如果 启动→开始做题率 < 50% → **入口体验问题**: 减少首页步骤，一键进入做题
- 如果 开始→完成率 < 30% → **题目难度/数量问题**: 新手模式改为5题，降低挫败感
- 如果某章节正确率 < 30% → **题目质量问题**: 检查解析是否清晰、口诀是否有效

#### 🟡 中优（影响长期留存/口碑）
- 如果 错题重做率 < 20% → **错题功能曝光不足**: 完成后弹窗引导"做错题"
- 如果 多科目用户占比 < 10% → **跨品类引导不足**: 首页增加"换科目"入口
- 如果 反馈中含功能请求 → **用户需求信号**: 排入需求池（当前feedback含"夜间模式"）

#### 🟢 观测（需要更多数据）
- 用户画像特征（设备/时段）→ 指导营销渠道选择
- 留存曲线（需≥7天数据）

### Step 3: 用户画像提取

```
从users.json + metrics.json 联合分析:
- 会员类型分布（免费/vip）
- 活跃科目偏好
- 学习时段偏好
- 设备偏好（Windows→PC端优先，iOS→H5优先）
```

---

## Output
写入 `docs/analysis/user_insight_{date}.md`:
```markdown
# 用户数据分析报告 — {date}

## 一、核心指标
| 指标 | 当前值 | 基准 | 诊断 |
|------|:-----:|:---:|:---:|
| 整体正确率 | XX% | >60% | 🟢/🟡/🔴 |
| 启动→做题率 | XX% | >70% | 🟢/🟡/🔴 |
| 做题→完成率 | XX% | >50% | 🟢/🟡/🔴 |
| 平均会话时长 | XXmin | >10min | 🟢/🟡/🔴 |

## 二、高频错题TOP10
（表格）

## 三、产品优化建议（按优先级）
1. 🔴 {建议} — 依据: {数据} — 预期效果: {描述}
2. 🟡 {建议} — 依据: {数据} — 预期效果: {描述}

## 四、用户画像
- 设备: Windows XX%, iOS XX%, Android XX%
- 活跃时段: XX:00-XX:00
- 偏好科目: {排名}
```

## Verification
```bash
wc -l docs/analysis/user_insight_*.md  # ≥50行
grep -c '优化建议' docs/analysis/user_insight_*.md  # ≥3
```
