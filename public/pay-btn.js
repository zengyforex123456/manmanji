// 支付按钮 - 独立脚本，不依赖任何框架
(function() {
  // 注入样式
  var style = document.createElement('style');
  style.textContent = '.pay-modal{position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;display:flex;align-items:center;justify-content:center}.pay-overlay{position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5)}.pay-card{position:relative;background:#fff;border-radius:12px;padding:24px;max-width:360px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.3);text-align:center}.pay-test-btn{position:fixed;bottom:20px;right:20px;z-index:9998;background:#1a56db;color:#fff;padding:10px 20px;border-radius:24px;font-size:13px;cursor:pointer;box-shadow:0 4px 12px rgba(26,86,219,.4);border:none;font-weight:600}';
  document.head.appendChild(style);

  // 注入测试按钮
  var btn = document.createElement('button');
  btn.className = 'pay-test-btn';
  btn.textContent = '🧪 ¥1 测试支付';
  document.body.appendChild(btn);

  // 会员按钮自动绑定
  document.addEventListener('click', function(e) {
    var el = e.target;
    if (el.classList.contains('membership-cta') && el.textContent.includes('开通')) {
      e.preventDefault();
      var card = el.closest('.membership-card');
      var name = card ? (card.querySelector('.membership-name') || {}).textContent || '开通会员' : '开通会员';
      var priceEl = card ? card.querySelector('.membership-price') : null;
      var price = priceEl ? parseInt(priceEl.textContent.replace(/[^0-9]/g,'')) || 68 : 68;
      var ids = ['single_econ','single_hr','single_fin','single_tax','single_biz','vip_all','vip_year'];
      var cards = document.querySelectorAll('.membership-card');
      var idx = Array.from(cards).indexOf(card);
      showPay(ids[Math.max(0,idx)] || 'vip_all', name, price);
    }
  });

  // 支付弹窗
  window.showPay = function(productId, name, price) {
    if (document.getElementById('pay-modal')) return;
    var m = document.createElement('div');
    m.id = 'pay-modal';
    m.className = 'pay-modal';
    m.innerHTML = '<div class="pay-overlay" onclick="this.parentElement.remove()"></div>'
      + '<div class="pay-card">'
      + '<h3 style="margin:0 0 4px;font-size:18px">' + name + '</h3>'
      + '<p style="color:#1a56db;font-size:28px;font-weight:bold;margin:12px 0">¥' + price + '</p>'
      + '<div id="pay-qr" style="min-height:200px;display:flex;align-items:center;justify-content:center;color:#888;font-size:14px">⏳ 生成中...</div>'
      + '<button onclick="document.getElementById(\'pay-modal\').remove()" style="margin-top:12px;background:#f1f5f9;border:1px solid #e2e8f0;padding:8px 32px;border-radius:8px;cursor:pointer;font-size:14px">取消</button>'
      + '</div>';
    document.body.appendChild(m);

    fetch('/api/payments/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: productId, userId: 'test' })
    }).then(function(r) { return r.json(); }).then(function(d) {
      var qr = document.getElementById('pay-qr');
      if (d.error) { qr.innerHTML = '<span style="color:#dc2626">' + d.error + '</span>'; return; }
      localStorage.setItem('mmj_pending_order', d.orderId);
      var payUrl = d.payUrl || d.qrCode || '';
      var qrImg = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(payUrl);
      var fallback = ' onclick="window.open(\'' + payUrl + '\',\'_blank\')"';
      qr.innerHTML = '<img src="' + qrImg + '" style="max-width:220px;border-radius:4px" onerror="this.onerror=null;this.style.display=\'none\';this.nextElementSibling.style.display=\'inline-block\'">'
        + '<a href="' + payUrl + '" target="_blank" style="display:none;background:#1a56db;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:16px">📱 前往支付</a>'
        + '<p style="font-size:12px;color:#16a34a;margin-top:8px">扫码支付 ¥' + d.amount + ' · 支付后自动开通</p>';
    }).catch(function(e) {
      document.getElementById('pay-qr').innerHTML = '<span style="color:#dc2626">网络异常，请稍后重试</span>';
    });
  };

  // 支付按钮点击
  btn.onclick = function() { showPay('test', '测试支付', 1); };

  // 支付后自动激活轮询
  var pending = localStorage.getItem('mmj_pending_order');
  if (pending) {
    var poll = setInterval(function() {
      fetch('/api/payments/status/' + pending).then(function(r) { return r.json(); }).then(function(d) {
        if (d.status === 'paid') {
          clearInterval(poll);
          localStorage.removeItem('mmj_pending_order');
          try {
            var s = JSON.parse(localStorage.getItem('manmanji_user_state') || '{}');
            s.membershipTier = 'vip';
            localStorage.setItem('manmanji_user_state', JSON.stringify(s));
          } catch(_) {}
          alert('支付成功！会员已激活，刷新页面生效');
          location.reload();
        }
      }).catch(function() {});
    }, 3000);
  }
})();
