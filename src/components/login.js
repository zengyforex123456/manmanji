// 极简登录模块
import { State } from '../core/state.js';
const API = 'http://localhost:3007';

let _tab = 'phone';

function render(cb) {
  document.getElementById('app').innerHTML = `
    <nav class="top-nav"><span onclick="window.goHome()" style="cursor:pointer;font-size:14px;color:var(--text-secondary)">←</span><div class="nav-brand">职考通</div><span></span></nav>
    <main style="max-width:360px;margin:32px auto;padding:0 16px">
      <div style="text-align:center;margin-bottom:20px"><div style="font-size:36px">📚</div><div style="font-size:18px;font-weight:800">登录职考通</div></div>
      <div class="auth-tabs">
        <div class="auth-tab ${_tab=='phone'?'active':''}" onclick="LP.tab(&quot;phone&quot;)">手机</div>
        <div class="auth-tab ${_tab=='pwd'?'active':''}" onclick="LP.tab(&quot;pwd&quot;)">密码</div>
      </div>
      <div id="p-phone" style="display:${_tab=='phone'?'block':'none'}">
        <div class="input-row"><span style="padding:12px;color:#64748b;font-weight:600">+86</span><input id="ph" type="tel" maxlength="11" placeholder="手机号" class="login-input"></div>
        <div class="input-row"><input id="cd" type="text" maxlength="6" placeholder="验证码" class="login-input" style="flex:1"><button id="sc" class="auth-code-btn" onclick="LP.sendCode()">获取</button></div>
        <button class="cta-primary" onclick="LP.loginPhone()">登录</button><div id="m1" class="auth-msg"></div>
      </div>
      <div id="p-pwd" style="display:${_tab=='pwd'?'block':'none'}">
        <div class="input-row"><input id="un" type="text" placeholder="用户名" class="login-input"></div>
        <div class="input-row"><input id="pw" type="password" placeholder="密码（≥6位）" class="login-input"></div>
        <div style="display:flex;gap:8px"><button class="cta-primary" style="flex:1" onclick="LP.login()">登录</button><button class="auth-register-btn" onclick="LP.reg()">注册</button></div><div id="m2" class="auth-msg"></div>
      </div>
      <div style="text-align:center;margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0">
        <button class="auth-wechat-btn" onclick="LP.wx()">💬 微信登录</button>
      </div>
      <div style="text-align:center;margin-top:8px"><button class="text-btn" onclick="window.goHome()">跳过</button></div>
    </main>`;
  window.LP = { tab, sendCode, loginPhone, login, reg, wx };
  window._onLoginOk = cb;
}

function tab(t) { _tab = t; render(window._onLoginOk); }

async function sendCode() {
  const ph = $('ph'), m = $('#m1'), b = $('#sc');
  if (!/^1\d{10}$/.test(ph)) { mT(m, '手机号不正确', 1); return; }
  b.disabled = true; b.textContent = '...';
  try {
    await fetch(`${API}/api/auth/send-code`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:ph})});
    mT(m, '验证码已发送', 0); let s = 60;
    const t = setInterval(() => { s--; b.textContent = s+'s'; if (s <= 0) { clearInterval(t); b.disabled = false; b.textContent = '获取'; } }, 1000);
  } catch(e) { mT(m, '发送失败', 1); b.disabled = false; b.textContent = '获取'; }
}

async function loginPhone() {
  const ph = $('ph'), cd = $('cd'), m = $('#m1');
  if (!ph || !cd) { mT(m, '请输入手机号和验证码', 1); return; }
  try {
    const r = await fetch(`${API}/api/auth/login-phone`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:ph,code:cd})});
    const d = await r.json();
    if (d.success) ok(d.user, 'phone'); else mT(m, d.error, 1);
  } catch(e) { mT(m, '登录失败', 1); }
}

async function login() {
  const un = $('un'), pw = $('pw'), m = $('#m2');
  if (!un || !pw) { mT(m, '请输入用户名和密码', 1); return; }
  try {
    const r = await fetch(`${API}/api/auth/login-password`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:un,password:pw})});
    const d = await r.json();
    if (d.success) ok(d.user, 'password'); else mT(m, d.error, 1);
  } catch(e) { mT(m, '登录失败', 1); }
}

async function reg() {
  const un = $('un'), pw = $('pw'), m = $('#m2');
  if (!un || un.length < 3) { mT(m, '用户名≥3个字符', 1); return; }
  if (!pw || pw.length < 6) { mT(m, '密码≥6个字符', 1); return; }
  try {
    const r = await fetch(`${API}/api/auth/register`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:un,password:pw})});
    const d = await r.json();
    if (d.success) { mT(m, '注册成功', 0); setTimeout(() => ok(d.user, 'password'), 600); }
    else mT(m, d.error, 1);
  } catch(e) { mT(m, '注册失败', 1); }
}

async function wx() {
  try {
    const r = await fetch(`${API}/api/auth/login-wechat`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:'m'+Date.now()})});
    const d = await r.json();
    if (d.success) ok(d.user, 'wechat');
  } catch(e) {}
}

function ok(user, type) {
  localStorage.setItem('mmj_token', btoa(JSON.stringify({phone:'u:'+(user.username||user.phone||'wx'),ts:Date.now()})));
  localStorage.setItem('mmj_user', JSON.stringify({...user, loginType:type}));
  State.setUserId(user.username||user.phone, type);
  import('../services/ebbinghaus.js').then(m => m.Ebbinghaus.pullFromCloud());
  if (window._onLoginOk) window._onLoginOk(user); else window.goHome();
}

function $(id) { return document.getElementById(id)?.value?.trim() || ''; }
function mT(el, t, err) { if (el) { el.textContent = t; el.style.color = err ? '#dc2626' : '#0f766e'; } }

function logout() { localStorage.removeItem('mmj_token'); localStorage.removeItem('mmj_user'); State.setUserId(null,null); window.goHome(); }
function getUser() { try { return JSON.parse(localStorage.getItem('mmj_user')); } catch { return null; } }

function renderProfile() {
  const u = getUser();
  document.getElementById('app').innerHTML = `
    <nav class="top-nav"><span onclick="window.goHome()" style="cursor:pointer;font-size:14px;color:var(--text-secondary)">←</span><div class="nav-brand">个人中心</div><span></span></nav>
    <main style="max-width:360px;margin:24px auto;padding:0 16px">
      ${u ? `<div style="background:linear-gradient(135deg,#0f766e,#14b8a6);border-radius:16px;padding:24px;text-align:center;color:#fff;margin-bottom:16px">
        <div style="font-size:40px;margin-bottom:8px">${u.loginType=='wechat'?'💬':'👤'}</div>
        <div style="font-size:18px;font-weight:800">${u.nickName||u.username||'考友'}</div>
        <div style="font-size:12px;opacity:.8">${u.phone||u.email||u.username}</div>
      </div>
      <div class="login-box" style="margin-bottom:12px"><div class="auth-menu-item" style="color:#dc2626;font-weight:700" onclick="LoginPage.logout()">🚪 退出登录</div></div>
      <div style="text-align:center"><button class="text-btn" onclick="LoginPage.exportData()">📥 导出数据</button></div>`
      : `<div style="text-align:center;padding:40px"><div style="font-size:48px">👤</div><div style="font-size:16px;font-weight:700;margin:12px 0">未登录</div><button class="cta-primary" onclick="LoginPage.render(()=>goHome())">登录</button></div>`}
    </main>`;
}

async function exportData() {
  try { const {DB}=await import('../core/db.js'); const p=[]; for(const s of['econ','hr','biz']) p.push(...await DB.getProgress(s)); const b=new Blob([JSON.stringify({user:getUser(),progress:p,date:new Date().toISOString()})]); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='data.json'; a.click(); } catch(e) { alert('失败'); }
}

export const LoginPage = { render, logout, getCurrentUser:getUser, renderProfile, exportData };
window.LoginPage = LoginPage;
