// components/payment.js — L3: 支付组件
// 单一职责: 支付弹窗UI·二维码展示·回调轮询
// 接口通信: 通过api.js调用后端，不直接fetch

import API from '../api.js';

// ── 样式注入 ──
(function injectStyle() {
  if (document.getElementById('payment-css')) return;
  var s = document.createElement('style');
  s.id = 'payment-css';
  s.textContent = '.pay-modal{position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;display:flex;align-items:center;justify-content:center}'
    + '.pay-overlay{position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5)}'
    + '.pay-card{position:relative;background:#fff;border-radius:12px;padding:24px;max-width:360px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.3);text-align:center}'
    + '.pay-test-btn{position:fixed;bottom:20px;right:20px;z-index:9998;background:#1a56db;color:#fff;padding:10px 20px;border-radius:24px;font-size:13px;cursor:pointer;box-shadow:0 4px 12px rgba(26,86,219,.4);border:none;font-weight:600}';
  document.head.appendChild(s);
})();

// ── 支付弹窗 ──
export function showPayment(productId, name, price) {
  if (document.getElementById('pay-modal')) return;

  var m = document.createElement('div');
  m.id = 'pay-modal';
  m.className = 'pay-modal';
  m.innerHTML =
    '<div class="pay-overlay" onclick="this.parentElement.remove()"></div>'
    + '<div class="pay-card">'
    + '<h3 style="margin:0 0 4px;font-size:18px">' + name + '</h3>'
    + '<p style="color:#1a56db;font-size:28px;font-weight:bold;margin:12px 0">¥' + price + '</p>'
    + '<div id="pay-qr" style="min-height:180px;display:flex;align-items:center;justify-content:center;color:#888;font-size:14px">⏳ 生成支付订单...</div>'
    + '<button onclick="document.getElementById(\'pay-modal\').remove()" style="margin-top:12px;background:#f1f5f9;border:1px solid #e2e8f0;padding:8px 32px;border-radius:8px;cursor:pointer;font-size:14px">取消</button>'
    + '</div>';
  document.body.appendChild(m);

  API.payment.create(productId, 'guest').then(function(d) {
    var qr = document.getElementById('pay-qr');
    localStorage.setItem('mmj_pending_order', d.orderId);
    // 直接从虎皮椒打开支付
    var payUrl = d.payUrl || d.qrCode || '';
    qr.innerHTML =
      '<div style="padding:10px">'
      + '<p style="font-size:13px;color:#666;margin-bottom:12px">订单 ' + d.orderId + '</p>'
      + '<a href="' + payUrl + '" target="_blank" rel="noopener" '
      + 'style="display:inline-block;background:#07c160;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:17px;font-weight:600">'
      + '📱 微信扫码支付 ¥' + d.amount + '</a>'
      + '<p style="font-size:12px;color:#16a34a;margin-top:12px">支付后页面自动刷新开通</p>'
      + '</div>';
  }).catch(function(e) {
    document.getElementById('pay-qr').innerHTML =
      '<span style="color:#dc2626">' + (e.message || '网络异常，请稍后重试') + '</span>';
  });
}

// ── 测试按钮注入 ──
export function injectTestButton() {
  if (document.getElementById('test-pay-btn')) return;
  var btn = document.createElement('button');
  btn.id = 'test-pay-btn';
  btn.className = 'pay-test-btn';
  btn.textContent = '🧪 ¥1 测试支付';
  btn.onclick = function() { showPayment('test', '测试支付', 1); };
  document.body.appendChild(btn);
}

// ── 支付后自动激活轮询 ──
export function pollActivation() {
  var orderId = localStorage.getItem('mmj_pending_order');
  if (!orderId) return;
  var poll = setInterval(function() {
    API.payment.status(orderId).then(function(d) {
      if (d.status === 'paid') {
        clearInterval(poll);
        localStorage.removeItem('mmj_pending_order');
        try {
          var s = JSON.parse(localStorage.getItem('manmanji_user_state') || '{}');
          s.membershipTier = 'vip';
          localStorage.setItem('manmanji_user_state', JSON.stringify(s));
        } catch(_) {}
        alert('✅ 支付成功！会员已激活，刷新页面生效');
        location.reload();
      }
    }).catch(function() {});
  }, 3000);
}

// ── 会员按钮自动绑定 ──
export function bindMembershipButtons() {
  document.addEventListener('click', function(e) {
    var el = e.target;
    if (!el.classList.contains('membership-cta')) return;
    if (el.textContent.includes('当前套餐')) return;
    e.preventDefault();
    var card = el.closest('.membership-card');
    var nameEl = card ? card.querySelector('.membership-name') : null;
    var priceEl = card ? card.querySelector('.membership-price') : null;
    var name = nameEl ? nameEl.textContent : '开通会员';
    var price = priceEl ? parseInt(priceEl.textContent.replace(/[^0-9]/g, '')) || 68 : 68;
    var cards = document.querySelectorAll('.membership-card');
    var idx = Array.from(cards).indexOf(card);
    var ids = ['single_econ', 'single_hr', 'single_fin', 'single_tax', 'single_biz', 'vip_all', 'vip_year'];
    showPayment(ids[Math.max(0, idx)] || 'vip_all', name, price);
  });
}
