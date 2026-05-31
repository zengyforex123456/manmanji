// WeChat Pay V3 API — order creation, signature, callback verification
// https://pay.weixin.qq.com/doc/v3/

const crypto = require('crypto');
const fs = require('fs');
const axios = require('axios');
const uuid = require('uuid');
const { config } = require('../config');

const BASE = 'https://api.mch.weixin.qq.com';

function sign(method, path, timestamp, nonce, body) {
  const pk = fs.readFileSync(config.wechatPay.privateKeyPath, 'utf8');
  const str = [method, path, timestamp, nonce, body || ''].join('\n');
  return crypto.createSign('RSA-SHA256').update(str).sign(pk, 'base64');
}

function authHeader(method, path, body) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = uuid.v4().replace(/-/g, '');
  const sig = sign(method, path, ts, nonce, body);
  return {
    Authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${config.wechatPay.mchid}",nonce_str="${nonce}",signature="${sig}",timestamp="${ts}",serial_no="${config.wechatPay.serialNo}"`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'ManManJi/1.0'
  };
}

async function createOrder({ outTradeNo, description, amount, openid }) {
  const path = '/v3/pay/transactions/jsapi';
  const body = JSON.stringify({
    appid: config.wechatPay.appid, mchid: config.wechatPay.mchid,
    description, out_trade_no: outTradeNo,
    notify_url: config.wechatPay.notifyUrl,
    amount: { total: amount, currency: 'CNY' },
    payer: { openid }
  });

  try {
    const res = await axios.post(`${BASE}${path}`, body, { headers: authHeader('POST', path, body) });
    return { success: true, prepay_id: res.data.prepay_id };
  } catch (err) {
    console.error('[WeChat] Create order failed:', err.response?.data || err.message);
    return { success: false, error: err.response?.data?.message || 'Order creation failed' };
  }
}

function generatePayParams(prepayId) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = uuid.v4().replace(/-/g, '');
  const pkg = `prepay_id=${prepayId}`;
  const pk = fs.readFileSync(config.wechatPay.privateKeyPath, 'utf8');
  const signStr = [config.wechatPay.appid, ts, nonce, pkg].join('\n');
  const paySign = crypto.createSign('RSA-SHA256').update(signStr).sign(pk, 'base64');
  return { appId: config.wechatPay.appid, timeStamp: ts, nonceStr: nonce, package: pkg, signType: 'RSA', paySign };
}

function verifyCallbackSignature(timestamp, nonce, body, signature) {
  const pk = fs.readFileSync(config.wechatPay.privateKeyPath.replace('apiclient_key.pem', 'apiclient_cert.pem'), 'utf8');
  return crypto.createVerify('RSA-SHA256').update([timestamp, nonce, body || ''].join('\n')).verify(pk, signature, 'base64');
}

async function queryOrder(outTradeNo) {
  const path = `/v3/pay/transactions/out-trade-no/${outTradeNo}`;
  try {
    const res = await axios.get(`${BASE}${path}`, { headers: authHeader('GET', path, '') });
    return { success: true, trade_state: res.data.trade_state, data: res.data };
  } catch (err) {
    return { success: false, error: 'Query failed' };
  }
}

module.exports = { createOrder, generatePayParams, queryOrder, verifyCallbackSignature };
