// tests/smoke-test.js — 自动化冒烟测试
// 用法: node tests/smoke-test.js
// 测: 页面可访问·API健康·AI出题·登录·支付产品

var BASE = 'http://46.38.245.170:3010';
var passed = 0, failed = 0;

async function test(name, fn) {
  try { await fn(); passed++; console.log('✅ ' + name); }
  catch(e) { failed++; console.log('❌ ' + name + ' — ' + e.message); }
}

async function run() {
  console.log('🧪 极简智考 冒烟测试\n');

  await test('页面返回200', async function() {
    var r = await fetch(BASE + '/');
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
  });

  await test('Landing页返回200', async function() {
    var r = await fetch(BASE + '/landing.html');
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
  });

  await test('API健康检查', async function() {
    var r = await fetch(BASE + '/api/health');
    var d = await r.json();
    if (d.status !== 'ok') throw new Error('status=' + d.status);
    if (!d.subjects || !d.subjects.length) throw new Error('无科目数据');
  });

  await test('题库数据正常', async function() {
    var r = await fetch(BASE + '/api/questions/econ/count');
    var d = await r.json();
    if (d.count < 1000) throw new Error('题库仅' + d.count + '题');
  });

  await test('支付产品列表', async function() {
    var r = await fetch(BASE + '/api/payments/products');
    var d = await r.json();
    if (!d.products || d.products.length < 2) throw new Error('产品不足');
  });

  await test('AI出题接口(离线兜底)', async function() {
    var r = await fetch(BASE + '/api/ai/generate-questions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: '2道GDP题', count: 2 }),
    });
    var d = await r.json();
    // 离线兜底返回null是正常的（无API key时）
    if (!d.hasOwnProperty('questions')) throw new Error('响应格式错误');
  });

  await test('AI答疑(离线兜底)', async function() {
    var r = await fetch(BASE + '/api/ai/ask', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: '怎么备考' }),
    });
    var d = await r.json();
    if (!d.answer || !d.source) throw new Error('无回答');
  });

  await test('注册接口', async function() {
    var r = await fetch(BASE + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test' + Date.now(), password: '123456' }),
    });
    var d = await r.json();
    if (d.error && d.error.includes('已存在')) return; // 正常
    if (!d.token && !d.id) throw new Error('注册失败: ' + d.error);
  });

  await test('隐私政策页', async function() {
    var r = await fetch(BASE + '/privacy');
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
  });

  await test('用户协议页', async function() {
    var r = await fetch(BASE + '/terms');
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
  });

  console.log('\n═══════════════════');
  console.log('通过: ' + passed + ' | 失败: ' + failed + ' | 总计: ' + (passed + failed));
  if (failed > 0) { console.log('🔴 有问题需要修复'); process.exit(1); }
  else console.log('🟢 全部通过');
}

run();
