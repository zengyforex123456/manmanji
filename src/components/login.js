// src/components/login.js — 登录页面
// R44: 手机号验证码登录 + R45: 微信扫码登录

import { State } from '../core/state.js';

const API = 'http://localhost:3001';

// ─── 渲染登录页 ───
function render(onSuccess) {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <nav class="top-nav">
      <div class="nav-brand" onclick="location.reload()">职考通</div>
    </nav>
    <main class="main-content" style="max-width:420px;text-align:center">
      <div style="font-size:32px;margin:32px 0 8px">🔐</div>
      <div style="font-size:20px;font-weight:800;margin-bottom:24px">登录职考通</div>
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:24px">登录后可跨设备同步学习进度</div>

      <!-- 手机号登录 -->
      <div class="stat-card" style="text-align:left;padding:20px;margin-bottom:16px">
        <div class="section-title">📱 手机号登录</div>
        <input id="phone-input" type="tel" maxlength="11" placeholder="请输入手机号" style="width:100%;padding:12px;border:1px solid var(--border-color);border-radius:var(--radius-sm);font-size:16px;margin:12px 0;font-family:inherit">
        <div style="display:flex;gap:8px">
          <input id="code-input" type="text" maxlength="6" placeholder="验证码" style="flex:1;padding:12px;border:1px solid var(--border-color);border-radius:var(--radius-sm);font-size:16px;font-family:inherit">
          <button id="send-code-btn" class="mode-btn" style="white-space:nowrap" onclick="LoginPage.sendCode()">获取验证码</button>
        </div>
        <button class="cta-primary" style="margin-top:12px" onclick="LoginPage.loginPhone()">登录</button>
        <div id="login-msg" style="font-size:12px;color:var(--text-secondary);margin-top:8px;text-align:center"></div>
      </div>

      <!-- 微信登录 -->
      <div class="stat-card" style="text-align:center;padding:20px;margin-bottom:16px">
        <div class="section-title">💬 微信登录</div>
        <div style="font-size:48px;margin:12px 0" id="wechat-qr-placeholder">📱</div>
        <div style="font-size:13px;color:var(--text-secondary)">请用微信扫描二维码</div>
        <button class="cta-primary" style="margin-top:12px;background:#07c160" onclick="LoginPage.loginWechat()">微信一键登录（模拟）</button>
      </div>

      <button class="text-btn" onclick="location.reload()">跳过，离线使用</button>
    </main>
  `;

  window.LoginPage = { sendCode, loginPhone, loginWechat };
  window._onLoginSuccess = onSuccess;
}

// ─── 发送验证码 ───
async function sendCode() {
  const phone = document.getElementById('phone-input')?.value?.trim();
  const msgEl = document.getElementById('login-msg');
  if (!phone || !/^1\d{10}$/.test(phone)) {
    if (msgEl) msgEl.textContent = '请输入正确的手机号';
    return;
  }
  if (msgEl) msgEl.textContent = '正在发送...';
  try {
    const r = await fetch(`${API}/api/auth/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const d = await r.json();
    if (msgEl) msgEl.textContent = d.message || '验证码已发送（查看服务端控制台）';
    // 倒计时
    const btn = document.getElementById('send-code-btn');
    if (btn) {
      btn.disabled = true;
      let sec = 60;
      const timer = setInterval(() => {
        sec--;
        btn.textContent = `${sec}s后重发`;
        if (sec <= 0) { clearInterval(timer); btn.disabled = false; btn.textContent = '获取验证码'; }
      }, 1000);
    }
  } catch (e) {
    if (msgEl) msgEl.textContent = '发送失败：' + e.message;
  }
}

// ─── 手机号登录 ───
async function loginPhone() {
  const phone = document.getElementById('phone-input')?.value?.trim();
  const code = document.getElementById('code-input')?.value?.trim();
  const msgEl = document.getElementById('login-msg');
  if (!phone || !code) { if (msgEl) msgEl.textContent = '请输入手机号和验证码'; return; }
  if (msgEl) msgEl.textContent = '正在登录...';
  try {
    const r = await fetch(`${API}/api/auth/login-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    });
    const d = await r.json();
    if (d.success) {
      localStorage.setItem('mmj_token', d.token);
      State.setUserId(d.user.phone, 'phone');
      if (window._onLoginSuccess) window._onLoginSuccess(d.user);
    } else {
      if (msgEl) msgEl.textContent = d.error || '登录失败';
    }
  } catch (e) {
    if (msgEl) msgEl.textContent = '登录失败：' + e.message;
  }
}

// ─── 微信登录（模拟） ───
async function loginWechat() {
  try {
    const r = await fetch(`${API}/api/auth/login-wechat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'mock_' + Date.now() }),
    });
    const d = await r.json();
    if (d.success) {
      localStorage.setItem('mmj_token', d.token);
      State.setUserId(d.user.phone, 'wechat');
      if (window._onLoginSuccess) window._onLoginSuccess(d.user);
    }
  } catch (e) {
    console.error('Wechat login failed:', e);
  }
}

export const LoginPage = { render, sendCode, loginPhone, loginWechat };

// 挂载全局供 onclick 使用
window.LoginPage = LoginPage;
