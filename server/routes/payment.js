// Payment routes — create order, callback, query

const express = require('express');
const uuid = require('uuid');
const wechatPay = require('../payment/wechat');
const { config } = require('../config');
const router = express.Router();

// In-memory store (production: use DB)
const orders = new Map();

// Server-authoritative prices (client CANNOT set amount)
const PRICES = { single: 3990, all_access: 9900 }; // cents
const NAMES = { single: 'Single-subject annual', all_access: 'All-access annual pass' };

// POST /api/payment/create-order
router.post('/create-order', async (req, res) => {
  const { plan, openid } = req.body;
  if (!PRICES[plan]) return res.status(400).json({ error: 'Invalid plan' });

  const amount = PRICES[plan];
  const outTradeNo = `MMJ${Date.now()}${uuid.v4().substring(0, 8)}`;

  orders.set(outTradeNo, {
    outTradeNo, plan, amount, description: NAMES[plan],
    status: 'pending', createdAt: new Date().toISOString(), paidAt: null, openid
  });

  const result = await wechatPay.createOrder({ outTradeNo, description: NAMES[plan], amount, openid });
  if (!result.success) {
    orders.get(outTradeNo).status = 'create_failed';
    return res.status(500).json({ error: result.error });
  }

  const payParams = wechatPay.generatePayParams(result.prepay_id);
  res.json({ success: true, outTradeNo, prepay_id: result.prepay_id, payParams, amount: (amount / 100).toFixed(2) });
});

// POST /api/payment/callback — WeChat callback (verify signature + idempotent)
router.post('/callback', express.text({ type: 'application/json' }), async (req, res) => {
  try {
    const cb = JSON.parse(req.body);
    const ts = req.headers['wechatpay-timestamp'];
    const nonce = req.headers['wechatpay-nonce'];
    const sig = req.headers['wechatpay-signature'];

    if (!wechatPay.verifyCallbackSignature(ts, nonce, req.body, sig))
      return res.status(403).json({ code: 'FAIL', message: 'Signature verification failed' });

    const order = orders.get(cb.out_trade_no);
    if (!order) return res.status(404).json({ code: 'FAIL', message: 'Order not found' });
    if (order.status === 'fulfilled') return res.json({ code: 'SUCCESS' }); // Idempotent

    if (cb.trade_state === 'SUCCESS') {
      order.status = 'paid';
      order.paidAt = new Date().toISOString();
      order.transactionId = cb.transaction_id;
      console.log('[Payment] Fulfilled:', order.outTradeNo, order.plan);
      order.status = 'fulfilled';
    }
    res.json({ code: 'SUCCESS' });
  } catch (err) {
    console.error('[Payment] Callback error:', err);
    res.status(500).json({ code: 'FAIL' });
  }
});

// GET /api/payment/order/:outTradeNo
router.get('/order/:outTradeNo', (req, res) => {
  const order = orders.get(req.params.outTradeNo);
  if (!order) return res.status(404).json({ error: 'Not found' });
  res.json({ outTradeNo: order.outTradeNo, status: order.status, amount: (order.amount / 100).toFixed(2), plan: order.plan });
});

module.exports = router;
