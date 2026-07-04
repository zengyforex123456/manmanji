// server/payments-real.js — 虎皮椒支付 (xunhupay.com)
// 个人开发者可用·微信+支付宝双通道·统一API
// 注册: https://www.xunhupay.com → 获取 appid + appsecret
import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// ═══ 虎皮椒配置 ═══
const XUNHU = {
  appid:      process.env.XUNHU_APPID || '201906159735',
  appsecret:  process.env.XUNHU_APPSECRET || 'a5893f016a5801b94efae432ea6ec979',
  api:        'https://api.xunhupay.com/payment/do.html',
  notifyUrl:  process.env.XUNHU_NOTIFY_URL || 'https://neijuan.info/api/payments/xunhu/notify',
  returnUrl:  process.env.XUNHU_RETURN_URL || 'https://neijuan.info',
  store:      '内卷之家',
  wechatMch:  '1653151221',  // 微信支付商户号（已签约）
  fee:        0.02,          // 虎皮椒费率 2%
};

// ═══ 产品定价 ═══
const PRODUCTS = {
  test:         { name: '测试支付(¥1)',       price: 1,   subject: 'test' },
  single_econ:  { name: '极简智考·单科卡',  price: 68,  subject: 'econ' },
  single_fin:   { name: '极简智考·金融',          price: 68,  subject: 'finance' },
  single_tax:   { name: '极简智考·财政税收',      price: 68,  subject: 'tax' },
  single_biz:   { name: '极简智考·工商管理',      price: 68,  subject: 'business' },
  vip_all:      { name: '极简智考·全科通卡',   price: 198, subject: 'all' },
  vip_year:     { name: '极简智考·年卡（含PDF）',    price: 298, subject: 'all' },
};

// 订单记录
const ordersFile = path.join(__dirname, '..', 'data', 'orders.json');
function loadOrders() {
  try { return JSON.parse(fs.readFileSync(ordersFile, 'utf-8')); } catch(e) { return []; }
}
function saveOrders(data) { fs.writeFileSync(ordersFile, JSON.stringify(data, null, 2)); }

// ═══ MD5签名 ═══
function sign(params) {
  var keys = Object.keys(params)
    .filter(function(k) { return k !== 'hash' && params[k] !== '' && params[k] !== null && params[k] !== undefined; })
    .sort();
  var str = keys.map(function(k) { return k + '=' + params[k]; }).join('&') + XUNHU.appsecret;
  return crypto.createHash('md5').update(str).digest('hex');
}

// ═══ 订单号 ═══
function orderId() {
  return 'MMJ' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString('hex').toUpperCase();
}

// ═══ 验证回调签名 ═══
function verifySign(body) {
  var receivedHash = body.hash;
  var expected = sign(body);
  return receivedHash === expected;
}

// ═══════════════════════════════════════════
//  API
// ═══════════════════════════════════════════

// POST /api/payments/create — 创建支付订单
router.post('/create', async function(req, res) {
  try {
    var productId = req.body.productId;
    var userId = req.body.userId || 'guest';

    var product = PRODUCTS[productId];
    if (!product) {
      return res.status(400).json({
        error: '无效产品ID',
        products: Object.keys(PRODUCTS).map(function(k) {
          return { id: k, name: PRODUCTS[k].name, price: PRODUCTS[k].price };
        }),
      });
    }

    if (!XUNHU.appid) {
      return res.status(400).json({
        error: '虎皮椒未配置',
        setupGuide: '1. 注册 https://www.xunhupay.com\n2. 获取 appid + appsecret\n3. 设置环境变量 XUNHU_APPID + XUNHU_APPSECRET',
        registerUrl: 'https://www.xunhupay.com',
      });
    }

    var oid = orderId();

    // 构建请求参数
    var params = {
      version: '1.1',
      appid: XUNHU.appid,
      trade_order_id: oid,
      total_fee: product.price,
      title: product.name,
      time: Math.floor(Date.now() / 1000).toString(),
      notify_url: XUNHU.notifyUrl,
      nonce_str: crypto.randomBytes(8).toString('hex'),
    };
    if (XUNHU.returnUrl) params.return_url = XUNHU.returnUrl;

    params.hash = sign(params);

    // 调用虎皮椒
    var resp = await fetch(XUNHU.api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
    var result = await resp.json();

    if (result.errcode === 0) {
      // 保存订单
      var orders = loadOrders();
      orders.push({
        orderId: oid, userId: userId, productId: productId,
        product: product.name, amount: product.price, status: 'pending',
        transactionId: result.transaction_id || result.trade_order_id,
        createdAt: new Date().toISOString(),
      });
      saveOrders(orders);

      res.json({
        orderId: oid,
        amount: product.price,
        product: product.name,
        qrCode: result.url_qrcode,   // PC端展示二维码
        payUrl: result.url,           // 手机端跳转（自动判断微信/支付宝）
        expiresIn: 7200,
        mode: 'xunhupay',
      });
    } else {
      res.status(400).json({
        error: result.errmsg || result.message || '虎皮椒下单失败',
        errcode: result.errcode,
      });
    }
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/payments/xunhu/notify — 虎皮椒支付回调
router.post('/xunhu/notify', async function(req, res) {
  try {
    var body = req.body;
    console.log('[虎皮椒回调] 订单:', body.trade_order_id, '状态:', body.status, '金额:', body.total_fee);

    // 验证签名
    if (!verifySign(body)) {
      console.error('[虎皮椒回调] 签名验证失败');
      return res.send('fail');
    }

    if (body.status === 'OD') { // OD = 已支付
      var orders = loadOrders();
      var order = orders.find(function(o) { return o.orderId === body.trade_order_id; });
      if (order) {
        order.status = 'paid';
        order.paidAt = new Date().toISOString();
        order.transactionId = body.transaction_id || order.transactionId;
        order.payType = body.type || 'unknown'; // wx | alipay
        saveOrders(orders);

        console.log('[虎皮椒] 支付成功!', order.userId, order.product, '¥' + order.amount, order.payType);

        // 自动激活VIP
        try {
          var { activateVIP } = await import('./auth.js');
          var vipResult = activateVIP(order.userId, order.productId);
          console.log('[VIP] 自动激活:', order.userId, order.productId, vipResult.membership || 'failed');
        } catch(e) { console.warn('[VIP] 激活失败:', e.message); }
      }
    } else if (body.status === 'CD') { // CD = 已退款
      var allOrders = loadOrders();
      var refundOrder = allOrders.find(function(o) { return o.orderId === body.trade_order_id; });
      if (refundOrder) {
        refundOrder.status = 'refunded';
        saveOrders(allOrders);
      }
    }

    // 虎皮椒要求返回纯文本 success
    res.set('Content-Type', 'text/plain');
    res.send('success');

  } catch(e) {
    console.error('[虎皮椒回调] 异常:', e.message);
    res.send('fail');
  }
});

// GET /api/payments/xunhu/return — 支付完成跳转（用户支付后看到的页面）
router.get('/xunhu/return', function(req, res) {
  var orderId = req.query.trade_order_id || '';
  var status = req.query.status || '';
  var amount = req.query.total_fee || '';

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>支付完成</title>'
    + '<style>body{font-family:-apple-system,sans-serif;text-align:center;padding:40px;background:#f5f5f5}'
    + '.card{background:white;border-radius:12px;padding:30px;max-width:400px;margin:0 auto;box-shadow:0 2px 12px rgba(0,0,0,.08)}'
    + '.icon{font-size:64px;margin:20px 0}'
    + '.amount{font-size:30px;color:#1a56db;font-weight:bold;margin:15px 0}'
    + '.status{color:' + (status === 'OD' ? '#16a34a' : '#dc2626') + ';font-weight:bold}'
    + '.btn{display:inline-block;background:#1a56db;color:white;padding:12px 30px;border-radius:8px;text-decoration:none;margin-top:20px}'
    + '</style></head><body><div class="card">'
    + '<div class="icon">' + (status === 'OD' ? '✅' : '⏳') + '</div>'
    + '<p class="status">' + (status === 'OD' ? '支付成功' : '支付处理中') + '</p>'
    + '<div class="amount">¥' + amount + '</div>'
    + '<p style="color:#888;font-size:13px">订单号: ' + orderId + '</p>'
    + '<p style="color:#888;font-size:13px">会员权益已开通，返回首页开始刷题</p>'
    + '<a href="/" class="btn">返回首页</a>'
    + '</div></body></html>';

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ═══ 查询 ═══

// GET /api/payments/status/:orderId — 订单状态
router.get('/status/:orderId', function(req, res) {
  var orders = loadOrders();
  var order = orders.find(function(o) { return o.orderId === req.params.orderId; });
  if (!order) return res.status(404).json({ error: '订单不存在' });

  res.json({
    orderId: order.orderId,
    status: order.status,
    amount: order.amount,
    product: order.product,
    payType: order.payType,
    paidAt: order.paidAt,
  });
});

// GET /api/payments/products — 产品+接入状态
router.get('/products', function(req, res) {
  res.json({
    provider: '虎皮椒 (xunhupay.com)',
    store: XUNHU.store,
    wechatMch: XUNHU.wechatMch,
    wechatStatus: '签约成功 ✅',
    ready: true,
    fee: '2%',
    products: Object.entries(PRODUCTS).map(function(e) {
      return { id: e[0], name: e[1].name, price: e[1].price };
    }),
  });
});

// GET /api/payments/stats — 收入统计
router.get('/stats', function(req, res) {
  var orders = loadOrders();
  var paid = orders.filter(function(o) { return o.status === 'paid'; });
  var revenue = paid.reduce(function(sum, o) { return sum + o.amount; }, 0);
  var byProduct = {};
  paid.forEach(function(o) {
    byProduct[o.productId] = (byProduct[o.productId] || 0) + 1;
  });

  res.json({
    totalOrders: orders.length,
    paidOrders: paid.length,
    conversionRate: orders.length > 0 ? Math.round((paid.length / orders.length) * 100) : 0,
    totalRevenue: Math.round(revenue * 100) / 100,
    afterFee: Math.round(revenue * 0.9762 * 100) / 100,  // 扣除2.38%手续费
    byProduct: byProduct,
    recentOrders: orders.slice(-10).reverse(),
  });
});

export default router;
