// server/payments.js – Mock integration for WeChat Pay & Alipay (sandbox)
import express from 'express';
import crypto from 'crypto';

const router = express.Router();

// Helper to generate mock order id
function generateOrderId() {
  return 'ORD_' + crypto.randomBytes(8).toString('hex').toUpperCase();
}

/**
 * 微信支付（sandbox）
 * 请求体: { amount: number, currency?: string }
 * 响应: { orderId, paymentUrl }
 */
router.post('/wechat', (req, res) => {
  const { amount } = req.body;
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  const orderId = generateOrderId();
  // Sandbox URL – in real project replace with official API
  const paymentUrl = `https://api.mch.weixin.qq.com/sandboxnew/pay/unifiedorder?order_id=${orderId}&amount=${amount}`;
  res.json({ orderId, paymentUrl, provider: 'wechat' });
});

/**
 * 支付宝支付（sandbox）
 * 请求体: { amount: number, currency?: string }
 * 响应: { orderId, paymentUrl }
 */
router.post('/alipay', (req, res) => {
  const { amount } = req.body;
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  const orderId = generateOrderId();
  const paymentUrl = `https://openapi.alipaydev.com/gateway.do?order_id=${orderId}&amount=${amount}`;
  res.json({ orderId, paymentUrl, provider: 'alipay' });
});

export default router;
