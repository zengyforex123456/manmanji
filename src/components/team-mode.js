// src/components/team-mode.js — 组队刷题 + 邀请裂变
// 轻量实现：无需后端，基于URL参数+localStorage模拟组队
import { State } from '../core/state.js';

// ─── 生成邀请链接 ───
function generateInviteLink() {
  const userId = State.state.userId || 'user_' + Date.now().toString(36);
  const base = window.location.origin + window.location.pathname;
  return `${base}?team=${userId}&t=${Date.now()}`;
}

// ─── 显示组队面板 ───
export function showTeamPanel() {
  const overlay = document.createElement('div');
  overlay.id = 'team-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  const inviteLink = generateInviteLink();
  const teamId = new URLSearchParams(window.location.search).get('team');
  const isInTeam = !!teamId;

  overlay.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:24px;width:90%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
      <div style="font-weight:800;font-size:16px;margin-bottom:16px;">👥 组队刷题</div>

      ${isInTeam ? `
        <div style="background:#ecfdf5;padding:12px;border-radius:8px;margin-bottom:16px;text-align:center;">
          <div style="font-size:24px;">🤝</div>
          <div style="font-weight:700;font-size:13px;margin:4px 0;">已加入组队</div>
          <div style="font-size:11px;color:#64748b;">和队友一起刷题，完成目标解锁双倍积分</div>
        </div>
      ` : `
        <div style="background:#f0f9ff;padding:12px;border-radius:8px;margin-bottom:16px;">
          <div style="font-weight:700;font-size:13px;margin-bottom:8px;">🎯 组队规则</div>
          <div style="font-size:12px;color:#64748b;line-height:1.6;">
            1. 邀请考友组队（2-3人）<br>
            2. 全队今日都完成≥10题 → 解锁双倍积分<br>
            3. 连续组队3天 → 解锁专属"战友"勋章
          </div>
        </div>
      `}

      <div style="background:#f8fafc;padding:12px;border-radius:8px;margin-bottom:16px;">
        <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;">📎 邀请链接（点击复制）</div>
        <div id="team-invite-link" style="font-size:10px;word-break:break-all;color:#0f766e;cursor:pointer;background:#fff;padding:8px;border:1px dashed #cbd5e1;border-radius:6px;" onclick="TeamMode.copyLink()">${inviteLink}</div>
        <div id="team-copy-msg" style="font-size:10px;color:#10b981;margin-top:4px;display:none;">✅ 已复制！发送给考友即可组队</div>
      </div>

      <div style="display:flex;gap:8px;">
        ${isInTeam
          ? `<button onclick="document.getElementById('team-overlay').remove()" style="flex:1;padding:10px;background:#e2e8f0;border:none;border-radius:8px;cursor:pointer;">关闭</button>`
          : `<button onclick="document.getElementById('team-overlay').remove()" style="flex:1;padding:10px;background:#10b981;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;">我知道了</button>`
        }
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

// ─── 复制链接 ───
export function copyTeamLink() {
  const link = document.getElementById('team-invite-link');
  if (!link) return;
  const text = link.textContent || '';
  navigator.clipboard?.writeText(text).then(() => {
    const msg = document.getElementById('team-copy-msg');
    if (msg) msg.style.display = 'block';
  }).catch(() => {
    // 降级方案
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    const msg = document.getElementById('team-copy-msg');
    if (msg) msg.style.display = 'block';
  });
}

// ─── 检查URL参数，自动加入组队 ───
export function checkTeamJoin() {
  const teamId = new URLSearchParams(window.location.search).get('team');
  if (teamId) {
    localStorage.setItem('mmj_team_id', teamId);
    // 记录来源（用于裂变分析）
    const refs = JSON.parse(localStorage.getItem('mmj_referrals') || '[]');
    if (!refs.includes(teamId)) {
      refs.push(teamId);
      localStorage.setItem('mmj_referrals', JSON.stringify(refs));
    }
  }
}

// 全局挂载
window.TeamMode = { showTeamPanel, copyTeamLink, checkTeamJoin };
