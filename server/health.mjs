/**
 * 健康检查端点
 * 在 server/index.js 中: import { healthRouter } from './health.mjs'; app.use('/health', healthRouter);
 */
import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };

  try {
    const metricsPath = path.join(DATA_DIR, 'metrics.json');
    const stat = fs.statSync(metricsPath);
    const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));
    const answers = metrics.filter(e => e.event === 'question_answered');
    const recent = answers.slice(-100);

    status.data = {
      totalEvents: metrics.length,
      answersTotal: answers.length,
      answers24h: answers.filter(a => Date.now() - new Date(a.serverTime).getTime() < 86400000).length,
      lastEvent: metrics.length > 0 ? metrics[metrics.length - 1].serverTime : null,
      fileSizeKB: (stat.size / 1024).toFixed(1),
    };

    status.alerts = [];
    if (status.data.answers24h === 0) {
      status.alerts.push({ level: 'warning', msg: '24h无新答题' });
    }
    if (recent.length >= 10) {
      const rate = (recent.filter(a => a.data.correct).length / recent.length * 100).toFixed(1);
      status.data.recentCorrectRate = rate + '%';
    }
  } catch (e) {
    status.data = { error: e.message };
  }

  res.json(status);
});
