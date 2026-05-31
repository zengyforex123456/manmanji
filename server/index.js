// ManManJi backend — Express + WeChat Pay + future sync APIs

const express = require('express');
const { config, validateConfig } = require('./config');
const paymentRoutes = require('./routes/payment');

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.use('/api/payment', paymentRoutes);

validateConfig();
app.listen(config.port, () => {
  console.log(`[ManManJi] :${config.port} | Payment: ${config.wechatPay.apiV3Key ? 'configured' : 'NOT configured'}`);
});
