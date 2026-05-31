// Server config — all secrets from env vars, never hardcode

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  wechatPay: {
    appid: process.env.WECHAT_PAY_APPID,
    mchid: process.env.WECHAT_PAY_MCHID,
    serialNo: process.env.WECHAT_PAY_SERIAL_NO,
    apiV3Key: process.env.WECHAT_PAY_API_V3_KEY,
    privateKeyPath: process.env.WECHAT_PAY_PRIVATE_KEY_PATH || './certs/apiclient_key.pem',
    notifyUrl: process.env.WECHAT_PAY_NOTIFY_URL || 'https://your-domain.com/api/payment/callback',
  }
};

function validateConfig() {
  const missing = [];
  if (!config.wechatPay.apiV3Key) missing.push('WECHAT_PAY_API_V3_KEY');
  if (missing.length) console.warn('[Config] Missing:', missing.join(', '), '— payment disabled');
}

module.exports = { config, validateConfig };
