// kaoshi → zhice-os 数据管道
// 用户行为 → 感知层 → 决策层 → 执行层 → 反馈层 → KAG
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ZHICE_API = process.env.ZHICE_API || 'http://localhost:3501';
const METRICS_FILE = path.join(__dirname, '..', 'data', 'metrics.json');
const FEEDBACK_FILE = path.join(__dirname, '..', 'data', 'feedback.json');

// ═══ 数据采集 ═══
export function collectMetrics() {
  try {
    const raw = fs.readFileSync(METRICS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return { events: [], summary: {} };
  }
}

export function collectFeedback() {
  try {
    const raw = fs.readFileSync(FEEDBACK_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

// ═══ 推送到 zhice-os 感知层 ═══
export async function pushToZhice(data) {
  try {
    const res = await fetch(ZHICE_API + '/api/perceive/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'kaoshi',
        type: 'user_behavior',
        project: 'kaoshi-manmanji',
        data: data,
        timestamp: new Date().toISOString(),
      }),
    });
    return await res.json();
  } catch (e) {
    console.log('[Pipeline] zhice-os 不可达，数据暂存本地');
    // 本地缓存，等 zhice-os 恢复后批量推送
    const cacheFile = path.join(__dirname, '..', 'data', 'pipeline-cache.json');
    let cache = [];
    try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')); } catch (_) {}
    cache.push({ data, timestamp: new Date().toISOString() });
    fs.writeFileSync(cacheFile, JSON.stringify(cache.slice(-1000))); // 最多缓存1000条
    return { cached: true, pending: cache.length };
  }
}

// ═══ 分析报告生成 ═══
export function generateInsightReport(metrics) {
  const events = metrics.events || [];
  if (events.length === 0) return { score: 0, summary: '暂无数据' };

  // 核心指标
  const answered = events.filter(e => e.type === 'question_answered');
  const completed = events.filter(e => e.type === 'mode_completed');
  const started = events.filter(e => e.type === 'mode_started');
  const sessions = events.filter(e => e.type === 'session_start');

  const totalAnswers = answered.length;
  const correctAnswers = answered.filter(e => e.correct).length;
  const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;
  const startToComplete = started.length > 0 ? Math.round((completed.length / started.length) * 100) : 0;

  // 错题TOP5
  const wrongCounts = {};
  answered.filter(e => !e.correct).forEach(e => {
    wrongCounts[e.questionId] = (wrongCounts[e.questionId] || 0) + 1;
  });
  const topWrong = Object.entries(wrongCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ questionId: id, wrongCount: count }));

  // 活跃时段
  const hourCounts = {};
  sessions.forEach(e => {
    const hour = new Date(e.timestamp).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });

  return {
    score: Math.round((accuracy * 0.5 + startToComplete * 0.5)),
    accuracy,
    startToCompleteRate: startToComplete,
    totalSessions: sessions.length,
    totalAnswers,
    topWrongQuestions: topWrong,
    peakHours: Object.entries(hourCounts).sort((a, b) => b[1] - a[1]).slice(0, 3),
    generatedAt: new Date().toISOString(),
  };
}

// ═══ 自动决策建议 ═══
export function generateActions(report) {
  const actions = [];

  if (report.accuracy < 50) {
    actions.push({
      priority: 'P0',
      action: 'improve_questions',
      reason: `整体正确率${report.accuracy}%偏低，建议检查题目质量或增加口诀覆盖`,
      ice: { impact: 9, confidence: 8, ease: 7 },
    });
  }
  if (report.startToCompleteRate < 30) {
    actions.push({
      priority: 'P0',
      action: 'reduce_batch_size',
      reason: `开始→完成率${report.startToCompleteRate}%偏低，建议新手模式减少题数`,
      ice: { impact: 8, confidence: 9, ease: 10 },
    });
  }
  if (report.topWrongQuestions && report.topWrongQuestions.length > 0) {
    actions.push({
      priority: 'P1',
      action: 'add_mnemonics',
      reason: `高频错题TOP${report.topWrongQuestions.length}需要补充口诀`,
      questionIds: report.topWrongQuestions.map(q => q.questionId),
      ice: { impact: 7, confidence: 7, ease: 6 },
    });
  }

  return actions;
}

// ═══ 定时任务: 采集→分析→推送→决策 ═══
export async function runPipeline() {
  console.log('[Pipeline] 开始数据管道...');

  // 1. 采集
  const metrics = collectMetrics();
  const feedback = collectFeedback();
  console.log(`[Pipeline] 采集: ${(metrics.events||[]).length} 事件, ${feedback.length} 反馈`);

  // 2. 分析
  const report = generateInsightReport(metrics);
  console.log(`[Pipeline] 分析: 正确率${report.accuracy}% 开始→完成${report.startToCompleteRate}%`);

  // 3. 决策
  const actions = generateActions(report);
  console.log(`[Pipeline] 决策: ${actions.length} 条建议`);

  // 4. 推送到 zhice-os
  const result = await pushToZhice({
    type: 'pipeline_report',
    metrics: report,
    feedback: feedback.slice(0, 10),
    actions: actions,
  });

  return { report, actions, pushed: !result.cached };
}

// ═══ 错误自动积累 ═══
var errorFingerprints = {};

export async function captureError(error, context) {
  var fp = fingerprintError(error.message || String(error), error.type || 'unknown');
  var key = fp.signature;

  if (errorFingerprints[key]) {
    errorFingerprints[key].count++;
    errorFingerprints[key].lastSeen = new Date().toISOString();
  } else {
    errorFingerprints[key] = {
      signature: key, category: fp.category, message: fp.normalized_msg,
      count: 1, firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString(),
      context: context || {},
    };
  }

  var entry = errorFingerprints[key];

  // 同错误≥3次 → 推送到zhice-os KAG
  if (entry.count >= 3 && !entry.pushed) {
    entry.pushed = true;
    try {
      await pushToZhice({
        type: 'error_pattern',
        source: 'kaoshi-auto',
        error: { signature: key, category: fp.category, message: fp.normalized_msg, count: entry.count, firstSeen: entry.firstSeen, context: context },
      });
      console.log('[KAG] 错误模式自动推送:', key, 'count:', entry.count);
    } catch(e) { console.warn('[KAG] 推送失败:', e.message); }
  }

  // 同错误≥5次 → 本地持久化
  if (entry.count >= 5 && !entry.synced) {
    entry.synced = true;
    try {
      await syncToKAG({
        type: 'error_pattern',
        signature: key, category: fp.category, message: fp.normalized_msg,
        count: entry.count, firstSeen: entry.firstSeen, lastSeen: entry.lastSeen,
      });
    } catch(e) {}
  }

  return entry;
}

function fingerprintError(message, category) {
  // 标准化错误消息，生成指纹
  var normalized = (message || '').toLowerCase()
    .replace(/[0-9a-f]{8,}/g, '<ID>')   // 去UUID
    .replace(/\d{10,13}/g, '<TS>')       // 去时间戳
    .replace(/\/[^\s]+\/[^\s]+\.js/g, '<PATH>') // 去路径
    .replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, '<IP>') // 去IP
    .slice(0, 200);

  var signature = normalized.replace(/[^a-z0-9]/g, '').slice(0, 40);
  var category = category || 'unknown';
  if (/timeout|network|fetch|ECONN|ENOTFOUND/i.test(normalized)) category = 'network';
  if (/syntax|parse|unexpected|token/i.test(normalized)) category = 'syntax';
  if (/undefined|null|typeerror|reference/i.test(normalized)) category = 'runtime';
  if (/not found|cannot find|module/i.test(normalized)) category = 'import';

  return { signature, category, normalized_msg: normalized };
}

// ═══ 定时调度 ═══
let pipelineInterval = null;

export function startPipeline(intervalMs = 3600000) {
  console.log(`[Pipeline] 启动定时管道 (每${Math.round(intervalMs/60000)}分钟)`);
  runPipeline(); // 立即执行一次
  pipelineInterval = setInterval(runPipeline, intervalMs);
}

export function stopPipeline() {
  if (pipelineInterval) clearInterval(pipelineInterval);
}

// ═══ KAG 同步 ═══
export async function syncToKAG(data) {
  try {
    const res = await fetch(ZHICE_API + '/api/kag/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'kaoshi',
        project: 'kaoshi-manmanji',
        entities: [{
          type: '用户洞察',
          title: `[kaoshi] 数据管道报告 ${new Date().toISOString().slice(0, 10)}`,
          content: JSON.stringify(data),
          tags: ['kaoshi', '用户行为', '自动采集'],
          maturity: '种子',
        }],
      }),
    });
    return await res.json();
  } catch (e) {
    console.log('[Pipeline] KAG同步失败，zhice-os 不可达');
    return null;
  }
}
