/**
 * 健康检查端点 — 部署后监控用
 * 在 server/index.js 中: app.use('/health', require('./health'))
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

module.exports = (req, res) => {
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };

  // 数据管道检查
  try {
    const metricsPath = path.join(DATA_DIR, 'metrics.json');
    const stat = fs.statSync(metricsPath);
    const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));
    const answers = metrics.filter(e => e.event === 'question_answered');

    status.data = {
      totalEvents: metrics.length,
      answersTotal: answers.length,
      answers24h: answers.filter(a => {
        return Date.now() - new Date(a.serverTime).getTime() < 86400000;
      }).length,
      lastEvent: metrics.length > 0 ? metrics[metrics.length - 1].serverTime : null,
      metricsFileSizeKB: (stat.size / 1024).toFixed(1),
    };

    // 告警判断
    status.alerts = [];
    if (status.data.answers24h === 0) {
      status.alerts.push({ level: 'warning', msg: '过去24h无新答题事件，检查前端埋点' });
    }
    if (status.data.totalEvents > 10000) {
      status.alerts.push({ level: 'info', msg: 'metrics.json 超过10000条，建议归档旧数据' });
    }

    // 整体正确率（最近100题）
    const recent = answers.slice(-100);
    if (recent.length >= 10) {
      const correctRate = (recent.filter(a => a.data.correct).length / recent.length * 100).toFixed(1);
      status.data.recentCorrectRate = correctRate + '%';
      if (parseFloat(correctRate) < 20) {
        status.alerts.push({ level: 'warning', msg: `近期正确率仅${correctRate}%，检查题目质量` });
      }
    }
  } catch (e) {
    status.data = { error: e.message };
  }

  res.json(status);
};
