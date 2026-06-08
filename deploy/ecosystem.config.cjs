// PM2 部署配置 — 职考通
// 使用: pm2 start deploy/ecosystem.config.cjs

module.exports = {
  apps: [{
    name: 'zhikaotong-api',
    script: 'server/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      API_PORT: 3001,
      MM_API_KEY: process.env.MM_API_KEY || '',
    },
    error_file: '/var/log/zhikaotong/api-error.log',
    out_file: '/var/log/zhikaotong/api-out.log',
    max_memory_restart: '300M',
  }],
};
