#!/usr/bin/env node
/**
 * 智策 — 从服务器拉取数据到本地
 * 用法: node scripts/pull-from-server.cjs [--server https://你的域名]
 *
 * 服务器只需提供 /admin/data/:type 端点（admin.mjs 已实现）
 * 本地拉取后自动运行全量分析，然后 Claude Code 可做深度推理
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ====== 配置 ======
const SERVER_URL = process.argv.find(a => a.startsWith('--server='))?.split('=')[1]
  || process.env.KAOSHI_SERVER
  || 'http://localhost:3010';

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILES = ['metrics', 'feedback', 'users'];

// ====== 下载函数 ======
function downloadFile(type) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SERVER_URL}/admin/data/${type}`);
    const client = url.protocol === 'https:' ? https : http;

    client.get(url.toString(), (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${type}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // 验证JSON
        try { JSON.parse(data); } catch (e) {
          return reject(new Error(`Invalid JSON from ${type}: ${e.message}`));
        }
        const filePath = path.join(DATA_DIR, `${type}.json`);
        // 备份旧文件
        if (fs.existsSync(filePath)) {
          const bak = filePath.replace('.json', `_${Date.now()}.bak.json`);
          fs.copyFileSync(filePath, bak);
          // 只保留最近3个备份
          const baks = fs.readdirSync(DATA_DIR).filter(f => f.startsWith(type) && f.endsWith('.bak.json')).sort();
          baks.slice(0, -3).forEach(f => fs.unlinkSync(path.join(DATA_DIR, f)));
        }
        fs.writeFileSync(filePath, data, 'utf-8');
        const stats = JSON.parse(data);
        resolve({ type, count: Array.isArray(stats) ? stats.length : Object.keys(stats).length, sizeKB: (data.length / 1024).toFixed(1) });
      });
    }).on('error', reject);
  });
}

// ====== 主流程 ======
async function main() {
  console.log(`\n📡 从服务器拉取数据: ${SERVER_URL}`);
  console.log('──────────────────────────────────\n');

  const results = [];
  for (const type of FILES) {
    try {
      process.stdout.write(`  ⬇  ${type}.json ... `);
      const result = await downloadFile(type);
      console.log(`✅ ${result.count}条 (${result.sizeKB}KB)`);
      results.push(result);
    } catch (e) {
      console.log(`❌ ${e.message}`);
    }
  }

  console.log(`\n📊 数据拉取完成 (${results.length}/${FILES.length} 成功)\n`);

  // 自动运行本地分析
  if (results.length >= 1) {
    console.log('🔄 自动运行本地全量分析...\n');
    try {
      const output = execSync(`node "${path.join(__dirname, 'run-all-analysis.cjs')}"`, {
        encoding: 'utf-8', timeout: 60000,
        cwd: path.join(__dirname, '..')
      });
      console.log(output);
    } catch (e) {
      console.error('分析运行失败:', e.stderr || e.message);
    }
  }

  // 提示可以深度分析了
  console.log('──────────────────────────────────');
  console.log('💡 数据已就绪。现在可以在 Claude Code 中深度分析:');
  console.log('   分析用户     → 用户行为+产品优化建议');
  console.log('   营销推广     → 渠道选择+内容策略');
  console.log('   数据驱动     → ICE优先级+A/B测试');
  console.log('   改善功能     → 转化率/使用率专项优化');
  console.log('');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
