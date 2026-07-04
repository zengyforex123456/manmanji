// 极简智考 Dashboard V3 — 组件化·CSS设计体系
import { getFreeQuota } from './WelcomeBar.js';
import { renderTopBar } from './TopBar.js';
import { renderBKT } from './BKTDiagnosis.js';
import { renderTaskCard } from './TaskCard.js';
import { renderAIBrain } from './AIBrain.js';
import '../style-v2.css';

var THEMES = { navy:'深蓝·稳重', gray:'灰蓝·理性', warm:'暖橙·活力' };

export function renderDashboardV2(state) {
  var themeName = localStorage.getItem('mmj_theme') || 'navy';
  var freeLeft = getFreeQuota();

  return '<div data-theme="' + themeName + '">'

    // Theme pills
    + '<div class="theme-pills">'
    + Object.keys(THEMES).map(function(k) {
      return '<button class="theme-pill' + (k === themeName ? ' active' : '') + '" onclick="document.documentElement.setAttribute(\'data-theme\',\'' + k + '\');localStorage.setItem(\'mmj_theme\',\'' + k + '\')">' + THEMES[k] + '</button>';
    }).join('')
    + '</div>'

    // Top bar
    + renderTopBar(state)

    // BKT diagnosis
    + renderBKT(state)

    // Task card
    + renderTaskCard(state)

    // AI section (collapsed)
    + '<details class="ai-section"><summary class="ai-summary"><span>🧠 AI智能出题<span class="ai-badge">VIP</span></span></summary>'
    + '<div class="ai-body">'
    + '<div class="ai-btns">'
    + '<button class="ai-btn" onclick="startAIQuick(\'10道单选题\')">📊 10道单选</button>'
    + '<button class="ai-btn" onclick="startAIQuick(\'5道计算题\')">📈 5道计算</button>'
    + '<button class="ai-btn" onclick="startAIExam()">📝 组模拟卷</button>'
    + '<button class="ai-btn warn" onclick="startAIWeak()">🎯 薄弱项</button>'
    + '</div>'
    + '<div class="ai-input-row">'
    + '<input class="ai-input" id="ai-prompt-input" placeholder="" onkeydown="if(event.key==\'Enter\')startAIFromPrompt()">'
    + '<button class="ai-btn-submit" onclick="startAIFromPrompt()">🎯 出题</button>'
    + '</div>'
    + '<div class="ai-hints">💬 试试说：<span class="ai-hint" onclick="quickAI(this)">出10道宏观经济单选题</span> · <span class="ai-hint" onclick="quickAI(this)">组一套模拟卷</span> · <span class="ai-hint" onclick="quickAI(this)">GDP核算的题来5道</span></div>'
    + '</div></details>'

    // VIP + More + Weakness
    + (state.membershipTier !== 'vip' ? '<div class="vip-row"><span>🔓 <b>¥68</b>/科 · 今日免费 <b>' + freeLeft + '</b> 题</span><button class="btn-vip" onclick="showPricingModal()">立即升级</button></div>' : '')
    + '<div class="bottom-row"><span>🎮 更多</span><button class="bottom-tag" onclick="startMode(\'advanced\')">🎲 随机</button><button class="bottom-tag" onclick="LC.showChapters()">📚 章节</button></div>'
    + '<div class="weakness-row"><span>🎯 薄弱项靶向练习</span><span class="weakness-hint">📝 刷题后解锁</span></div>'
    + '</div>'

    // Bottom nav
    + '<nav class="bottom-nav">'
    + '<button class="nav-item active" onclick="location.reload()"><span class="nav-icon">📖</span>刷题</button>'
    + '<button class="nav-item" onclick="LoginPage.renderProfile()"><span class="nav-icon">👤</span>我的</button>'
    + '</nav>'

    // Inline helpers
    + '<script>'
    + '!function(){'
    + 'var t=["出10道宏观经济单选题","组一套模拟卷","GDP核算来5道","货币政策5道","财政政策计算题3道","薄弱项专项练习"],i=document.getElementById("ai-prompt-input");'
    + 'i&&(i.placeholder=t[Math.floor(Math.random()*t.length)],setInterval(function(){i.placeholder=t[Math.floor(Math.random()*t.length)]},5000));'
    + 'window.quickAI=function(e){i.value=e.textContent;startAIFromPrompt()};'
    + 'window.toggleSubjects=function(){'
    + 'var ov=document.getElementById("subj-overlay");if(ov){ov.remove();return}'
    + 'var d=document.createElement("div");d.id="subj-overlay";'
    + 'd.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center";'
    + 'd.onclick=function(e){if(e.target===d)d.remove()};'
    + 'd.innerHTML=\'<div style="background:#fff;border-radius:16px;padding:24px;max-width:340px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.3)"><h3 style="margin:0 0 16px">📊 切换科目</h3>'
    + \'<div onclick="window.switchSubject(\\\'econ\\\');document.getElementById(\\\'subj-overlay\\\').remove()" style="padding:12px;border-radius:8px;cursor:pointer;margin:6px 0;background:#eff6ff;font-weight:600">📊 经济基础 (19,749题)</div>\'
    + \'<div onclick="window.switchSubject(\\\'hr\\\');document.getElementById(\\\'subj-overlay\\\').remove()" style="padding:12px;border-radius:8px;cursor:pointer;margin:6px 0;background:#f0fdf4;font-weight:600">👥 人力资源管理 (10,545题)</div>\'
    + \'<div onclick="window.switchSubject(\\\'biz\\\');document.getElementById(\\\'subj-overlay\\\').remove()" style="padding:12px;border-radius:8px;cursor:pointer;margin:6px 0;background:#fef3c7;font-weight:600">🏭 工商管理 (4,740题)</div>\'
    + \'<button onclick="document.getElementById(\\\'subj-overlay\\\').remove()" style="display:block;width:100%;margin-top:12px;padding:10px;background:#f1f5f9;border:none;border-radius:8px;cursor:pointer;font-size:14px">取消</button></div>\';'
    + 'document.body.appendChild(d)};'
    + 'localStorage.removeItem("mmj_pending_order");'
    + '}()</script>';
}
