// PM2 部署配置 — 慢慢记 (manmanji)
// 使用: pm2 start deploy/ecosystem.config.cjs

module.exports = {
  apps: [{
    name: 'manmanji-api',
    script: 'server/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      API_PORT: 3011,
      MM_API_KEY: process.env.MM_API_KEY || '',
      XUNHU_APPID: process.env.XUNHU_APPID || '201906159735',
      XUNHU_APPSECRET: process.env.XUNHU_APPSECRET || 'a5893f016a5801b94efae432ea6ec979',
      XUNHU_NOTIFY_URL: process.env.XUNHU_NOTIFY_URL || 'https://neijuan.info/api/payments/xunhu/notify',
      ZHICE_API: process.env.ZHICE_API || 'http://127.0.0.1:3501',
    },
    error_file: '/var/log/manmanji/api-error.log',
    out_file: '/var/log/manmanji/api-out.log',
    max_memory_restart: '300M',
  }],
};
