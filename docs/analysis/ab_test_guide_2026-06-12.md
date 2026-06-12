# A/B测试状态 — 2026-06-12

> 自动生成 | 状态: ⚠️  尚未检测到A/B测试数据

---

## 当前状态

metrics.json 中未检测到带 `ab_group` / `variant` 字段的事件。

## 如何接入A/B测试

在埋点代码中添加 `ab_group` 字段:

```js
// 示例: 新手模式题数测试
const abGroup = Math.random() < 0.5 ? 'A_10题' : 'B_5题';
sendBeacon({
  event: 'question_answered',
  data: {
    questionId: 'econ-q00001',
    correct: true,
    ab_group: abGroup,        // ← 加这一行
    ab_test: 'beginner_quiz_count'
  }
});
```

## 如何解读结果

此脚本自动执行:
1. 按 ab_group 分组统计关键指标
2. 卡方检验计算 p 值
3. p < 0.05 → 差异显著 → 建议全量上线优胜组
4. p ≥ 0.05 → 差异不显著 → 继续收集数据或调整变量

---

*由 ab-test-validator.js 自动生成*
