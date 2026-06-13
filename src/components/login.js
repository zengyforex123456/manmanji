// 极简登录模块
import { State } from '../core/state.js';
const API = 'http://localhost:3010';

let _tab = 'phone';

function render(cb) {
  document.getElementById('app').innerHTML = `

    <nav class="top-nav"><span id="btn-back" style="cursor:pointer;font-size:14px;color:var(--text-secondary)">←</span><div class="nav-brand">职考通</div><span></span></nav>
    <main style="max-width:360px;margin:32px auto;padding:0 16px">
      <div style="text-align:center;margin-bottom:20px"><div style="font-size:36px">📚</div><div style="font-size:18px;font-weight:800">登录职考通</div></div>
      <div class="auth-tabs">
        <div class="auth-tab ${_tab=='phone'?'active':''}" id="tab-phone">手机</div>
        <div class="auth-tab ${_tab=='pwd'?'active':''}" id="tab-pwd">密码</div>
      </div>
      <div id="p-phone" style="display:${_tab=='phone'?'block':'none'}">
        <div class="input-row"><span style="padding:12px;color:#64748b;font-weight:600">+86</span><input id="ph" type="tel" autocomplete="off" name="phone-x" onfocus="this.value=this.value==='root'?'':this.value" maxlength="11" placeholder="手机号" class="login-input"></div>
        <div class="input-row"><input id="cd" type="text" autocomplete="off" maxlength="6" placeholder="验证码" class="login-input" style="flex:1"><button id="btn-send" class="auth-code-btn">获取</button></div>
        <button class="cta-primary" id="btn-phone-login">登录</button><div id="m1" class="auth-msg"></div>
      </div>
      <div id="p-pwd" style="display:${_tab=='pwd'?'block':'none'}">
        <div class="input-row"><input id="un" type="text" autocomplete="off" name="user-x" placeholder="用户名" class="login-input"></div>
        <div class="input-row"><input id="pw" type="password" autocomplete="new-password" name="pwd-x" placeholder="密码（≥6位）" class="login-input"></div>
        <div style="display:flex;gap:8px"><button class="cta-primary" style="flex:1" id="btn-pwd-login">登录</button><button class="auth-register-btn" id="btn-reg" onclick="LP.reg()">注册</button></div><div id="m2" class="auth-msg"></div>
      </div>
      <div style="text-align:center;margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0">
        <button class="auth-wechat-btn" id="btn-wx">💬 微信登录</button>
      </div>
      <div style="text-align:center;margin-top:8px"><button class="text-btn" id="btn-skip">跳过</button></div>
    </main>`;
  window.LP = { tab, sendCode, loginPhone, login, reg, wx }; setTimeout(() => { delegateClicks(); const ph = document.getElementById('ph'); if (ph && (ph.value === 'root' || ph.value === 'administrator')) ph.value = ''; }, 100);
  window._onLoginOk = cb;
}

function bind(sel, ev, fn) { const el = document.querySelector(sel); if (el) el.addEventListener(ev, fn); }
function delegateClicks() {
  const map = {
    'btn-back': ()=>window.goHome(), 'btn-skip': ()=>window.goHome(),
    'tab-phone': ()=>tab('phone'), 'tab-pwd': ()=>tab('pwd'),
    'btn-send': sendCode, 'btn-phone-login': loginPhone,
    'btn-pwd-login': login, 'btn-reg': reg, 'btn-wx': wx,
  };
  Object.entries(map).forEach(([id, fn]) => bind('#'+id, 'click', fn));
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
  const un = $('un'), pw = $('pw');
  if (!un || un.length < 3) { alert('用户名至少3个字符'); return; }
  if (!pw || pw.length < 6) { alert('密码至少6个字符'); return; }
  try {
    const r = await fetch(`${API}/api/auth/register`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:un,password:pw})});
    const d = await r.json();
    if (d.success) { alert('注册成功！'); ok(d.user, 'password'); }
    else { alert(d.error); }
  } catch(e) { alert('注册失败，请检查网络'); }
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
  State.trackEvent('user_registered', { loginType: type, username: user.username });
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

    <nav class="top-nav"><span id="btn-back" style="cursor:pointer;font-size:14px;color:var(--text-secondary)">←</span><div class="nav-brand">个人中心</div><span></span></nav>
    <main style="max-width:360px;margin:24px auto;padding:0 16px">
      ${u ? `<div style="background:linear-gradient(135deg,#0f766e,#14b8a6);border-radius:16px;padding:24px;text-align:center;color:#fff;margin-bottom:16px">
        <div style="font-size:40px;margin-bottom:8px">${u.loginType=='wechat'?'💬':'👤'}</div>
        <div style="font-size:18px;font-weight:800">${u.nickName||u.username||'考友'}</div>
        <div style="font-size:12px;opacity:.8">${u.phone||u.email||u.username}</div>
      </div>
      <div class="login-box" style="margin-bottom:12px"><div class="auth-menu-item" style="color:#dc2626;font-weight:700" onclick="LoginPage.logout()">🚪 退出登录</div></div>
      <div style="text-align:center;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        <button class="text-btn" onclick="LoginPage.exportData()">📥 导出数据</button>
        <button class="text-btn" onclick="LoginPage.importData()">📤 导入数据</button>
      </div>
      <input type="file" id="import-file-input" accept=".json" style="display:none" onchange="LoginPage.handleImport(event)">`
      : `<div style="text-align:center;padding:40px"><div style="font-size:48px">👤</div><div style="font-size:16px;font-weight:700;margin:12px 0">未登录</div><button class="cta-primary" onclick="LoginPage.render(()=>goHome())">登录</button></div>`}
    </main>`;
}

async function exportData() {
  try { const {DB}=await import('../core/db.js'); const p=[]; for(const s of['econ','hr','biz']) p.push(...await DB.getProgress(s)); const b=new Blob([JSON.stringify({user:getUser(),progress:p,date:new Date().toISOString()})]); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='data.json'; a.click(); } catch(e) { alert('导出失败'); }
}

function importData() { document.getElementById('import-file-input')?.click(); }

async function handleImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.progress || !Array.isArray(data.progress)) throw new Error('Invalid format');
    const { DB } = await import('../core/db.js');
    for (const p of data.progress) {
      await DB.saveProgress(p);
    }
    alert(`✅ 导入成功！${data.progress.length}条学习记录已恢复。\n导出日期: ${data.date || '未知'}`);
    window.goHome();
  } catch(e) { alert('导入失败: ' + (e.message || '文件格式错误')); }
}

export const LoginPage = { render, logout, getCurrentUser:getUser, renderProfile, exportData, importData, handleImport };
window.LoginPage = LoginPage;
