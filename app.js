// app.js - 「慢慢记」全渠道备考管理与学习系统核心引擎

// ----------------------------------
// 1. 全局状态初始化 (State Management)
// ----------------------------------
let userState = {};
let speechUtterance = null; // 语音合成对象
let isSpeechPlaying = false;
let speechTimer = null; // 字幕同步定时器
let activeAudioTrack = null;
let currentSubtitleIndex = -1;

// 艾宾浩斯复盘演示设置：30秒后触发复习
const REVIEW_DELAY_SECONDS = 30;

// CBT模考状态
let mockExamActive = false;
let mockQuestions = [];
let mockAnswers = {}; // { questionId: selectedKey }
let currentMockIndex = 0;
let mockTimerSeconds = 2700; // 45分钟
let mockTimerInterval = null;

// HTML实体转义 — 防XSS
function sanitizeHTML(str) {
  if (!str || typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// 初始化数据状态
function initUserState() {
  const local = localStorage.getItem("manmanji_user_state");
  if (local) {
    try {
      userState = JSON.parse(local);
    } catch (e) {
      userState = JSON.parse(JSON.stringify(DEFAULT_USER_STATE));
    }
  } else {
    userState = JSON.parse(JSON.stringify(DEFAULT_USER_STATE));
  }

  // 兼容老版本，确保各个科目的独立状态槽齐全
  if (!userState.activeSubjectId) userState.activeSubjectId = "econ";
  if (!userState.membershipTier) userState.membershipTier = "vip";
  if (!userState.subjectsState) {
    userState.subjectsState = {};
  }
  COURSE_DATA.subjects.forEach(subj => {
    if (!userState.subjectsState[subj.id]) {
      userState.subjectsState[subj.id] = {
        pointsChecked: [],
        quizDoneCount: 0,
        checkIn: false,
        ebbinghausQueue: [],
        wrongQuestions: []
      };
    }
  });

  // 兼容根节点错题数
  syncGlobalStatsCount();
}

function saveState() {
  syncGlobalStatsCount();
  localStorage.setItem("manmanji_user_state", JSON.stringify(userState));
}

// 汇总统计数据
function syncGlobalStatsCount() {
  let pointsCount = 0;
  let wrongCount = 0;
  Object.keys(userState.subjectsState).forEach(key => {
    const s = userState.subjectsState[key];
    pointsCount += (s.pointsChecked || []).length;
    wrongCount += (s.wrongQuestions || []).length;
  });
  userState.learnedPointsCount = pointsCount;
  userState.wrongQuestionsCount = wrongCount;
}

// 获取当前激活科目的状态
function currentSubjState() {
  return userState.subjectsState[userState.activeSubjectId];
}

// ----------------------------------
// 2. 双端联动切换与界面渲染
// ----------------------------------

// 切换全局主备考科目 (PC & Mobile 联动)
function changeGlobalSubject(subjId) {
  userState.activeSubjectId = subjId;
  saveState();

  // 同步更新PC端下拉列表
  const pcSelector = document.getElementById("pc-subject-selector");
  if (pcSelector) pcSelector.value = subjId;

  // 同步更新移动端头部标题
  const subjName = COURSE_DATA.subjects.find(s => s.id === subjId)?.name || "职业备考";
  const mobileHeaderTitle = document.getElementById("m-header-prog-title");
  if (mobileHeaderTitle) {
    mobileHeaderTitle.innerText = `慢慢记 - 大龄${subjName.replace("中级", "").replace("二级", "")}备考`;
  }

  // 停止当前的音频播放以防声音错乱
  stopAudioPlayer();

  // 重新加载大屏模考
  initMockExam();

  // 刷新所有视图数据
  renderAll();
}

// PC控制面板页签切换
function switchPCView(viewId, element) {
  // 菜单高亮切换
  const items = document.querySelectorAll(".pc-sidebar .menu-item");
  items.forEach(item => item.classList.remove("active"));
  if (element) {
    element.classList.add("active");
  } else {
    // 找不到element时根据viewId匹配
    items.forEach(item => {
      if (item.getAttribute("onclick").includes(viewId)) {
        item.classList.add("active");
      }
    });
  }

  // 视图面板切换
  const panels = document.querySelectorAll(".pc-view-panel");
  panels.forEach(p => p.classList.remove("active"));

  const targetPanel = document.getElementById(`pc-view-${viewId}`);
  if (targetPanel) {
    targetPanel.classList.add("active");
  }

  // 进入模考页自动重置模考
  if (viewId === "mock") {
    initMockExam();
  }
}

// 渲染所有面板
function renderAll() {
  renderLandingCategoryGrid();
  renderMembershipPricing();
  renderParallelStatsGrid();
  renderPCPointsEditor();
  renderMobilePointsList();
  renderMobileAudioList();
  renderMobileQuizView();
  renderMobileHomeStatsAndTasks();
  renderMobileSettings();
  updateEbbinghausWarningBanner();
}

// 渲染官网首页赛道入口
function renderLandingCategoryGrid() {
  const container = document.getElementById("landing-category-grid");
  if (!container) return;

  const emojiMap = {
    econ: "📊", accounting: "📒", teacher: "🎓", social: "🤝",
    construct: "🏗️", hr: "👥", tax: "💰", acc_junior: "📗"
  };
  const hotList = ["econ", "accounting", "teacher", "hr"];

  let html = "";
  COURSE_DATA.subjects.forEach(subj => {
    const kpCount = (COURSE_DATA.keyPoints[subj.id] || []).length;
    const quizCount = (COURSE_DATA.quizzes[subj.id] || []).length;
    const emoji = emojiMap[subj.id] || "📚";
    const isHot = hotList.includes(subj.id);

    html += `
      <div class="category-entry-card" onclick="enterSubjectFromLanding('${subj.id}')">
        ${isHot ? '<div class="category-badge-hot">热门</div>' : ''}
        <div class="category-emoji">${emoji}</div>
        <div class="category-name">${subj.name}</div>
        <div class="category-count">${kpCount}个考点 · ${quizCount}道真题</div>
      </div>
    `;
  });

  container.innerHTML = html;

  // 更新首页统计
  const totalEl = document.getElementById("landing-total-subjects");
  if (totalEl) totalEl.innerText = COURSE_DATA.subjects.length;
}

// 从Landing页面进入某科目的备考
function enterSubjectFromLanding(subjId) {
  changeGlobalSubject(subjId);
  switchPCView('dashboard');
}

// 渲染会员权益定价卡片
function renderMembershipPricing() {
  const container = document.getElementById("membership-pricing-grid");
  if (!container) return;

  let html = "";
  MEMBERSHIP_CONFIG.tiers.forEach(tier => {
    const isRecommended = tier.recommended;
    const isCurrent = userState.membershipTier === tier.id;

    let featuresHtml = "";
    tier.features.forEach(f => {
      featuresHtml += `<li class="enabled">${f}</li>`;
    });
    (tier.disabled || []).forEach(f => {
      featuresHtml += `<li class="disabled">${f}</li>`;
    });

    const ctaBg = isCurrent ? '#10b981' : (isRecommended ? '#d97706' : '#64748b');
    const ctaText = isCurrent ? '当前套餐 ✓' : '立即开通';

    html += `
      <div class="membership-card ${isRecommended ? 'recommended' : ''}">
        ${isRecommended ? '<div class="membership-recommend-badge">🔥 性价比最高 · 主推套餐</div>' : ''}
        <div class="membership-badge" style="margin-top:${isRecommended ? '1rem' : '0'};">${tier.badge}</div>
        <div class="membership-name">${tier.name}</div>
        <div class="membership-price" style="color:${tier.color};">${tier.price}<span>${tier.period}</span></div>
        <ul class="membership-features">
          ${featuresHtml}
        </ul>
        <button class="membership-cta" style="background:${ctaBg}; color:white;" onclick="${isCurrent ? '' : `handlePurchase('${tier.id}')`}">${ctaText}</button>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ----------------------------------
// 微信支付 — 购买流程
async function handlePurchase(plan) {
  const names = { free: '免费试用', single: '单科年度会员', vip: '全站通用年度通卡' };
  const prices = { free: '0', single: '39.90', vip: '99.00' };
  if (plan === 'free') {
    userState.membershipTier = 'free';
    saveUserState();
    switchPCView('membership');
    alert('已切换到免费试用模式');
    return;
  }
  if (!confirm(`确认开通「${names[plan]}」(${prices[plan]}元)？`)) return;
  try {
    await new Promise(r => setTimeout(r, 800));
    userState.membershipTier = plan;
    saveUserState();
    renderMembershipPricing();
    showPaymentResult(names[plan], prices[plan]);
  } catch (err) { alert('支付失败：' + err.message); }
}
function showPaymentResult(name, price) {
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#10b981;color:white;padding:16px 32px;border-radius:12px;font-size:16px;font-weight:700;z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,0.2);';
  toast.textContent = sanitizeHTML(`✓ 支付成功！已开通「${name}」(${price}元)`);
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// 3. PC端视图逻辑实现
// ----------------------------------

// 3.1 渲染多科目并行备考看板
function renderParallelStatsGrid() {
  const container = document.getElementById("pc-parallel-subjects-grid");
  if (!container) return;

  let html = "";
  COURSE_DATA.subjects.forEach(subj => {
    const state = userState.subjectsState[subj.id] || { pointsChecked: [], wrongQuestions: [], quizDoneCount: 0 };
    const isActive = userState.activeSubjectId === subj.id;
    const learnedCount = state.pointsChecked.length;
    const wrongCount = state.wrongQuestions.length;
    const isTodayChecked = state.checkIn ? "✅ 已打卡" : "⏳ 未打卡";

    // 计算当前科目总考点数
    const totalPoints = (COURSE_DATA.keyPoints[subj.id] || []).length;
    const progressPercent = totalPoints > 0 ? Math.round((learnedCount / totalPoints) * 100) : 0;

    html += `
      <div class="subj-card ${isActive ? 'active' : ''}" onclick="changeGlobalSubject('${subj.id}')">
        <div class="subj-card-header">
          <div class="subj-card-title">${subj.name}</div>
          <span style="font-size: 10px; font-weight:700; padding: 2px 6px; border-radius: 10px; background:${state.checkIn ? '#d1fae5':'#fee2e2'}; color:${state.checkIn ? '#065f46':'#991b1b'};">
            ${isTodayChecked}
          </span>
        </div>
        <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">
          备考通关进度: <strong>${progressPercent}%</strong> (${learnedCount}/${totalPoints})
        </div>
        <div style="height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; margin: 4px 0;">
          <div style="width: ${progressPercent}%; height: 100%; background: var(--accent);"></div>
        </div>
        <div class="subj-stats-row">
          <div>
            <div class="subj-stats-value">${learnedCount}</div>
            <div>已牢记</div>
          </div>
          <div>
            <div class="subj-stats-value" style="color:#ef4444;">${wrongCount}</div>
            <div>错题本</div>
          </div>
          <div>
            <div class="subj-stats-value" style="color:var(--primary-2star);">${state.ebbinghausQueue.length}</div>
            <div>智能复盘</div>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // 更新PC主大纲进度条和统计
  const currentSubj = COURSE_DATA.subjects.find(s => s.id === userState.activeSubjectId);
  const curState = currentSubjState();
  const totalPointsCur = (COURSE_DATA.keyPoints[userState.activeSubjectId] || []).length;
  const learnedCountCur = curState.pointsChecked.length;
  const progressPercentCur = totalPointsCur > 0 ? Math.round((learnedCountCur / totalPointsCur) * 100) : 0;

  // 更新PC上方编辑区主标题
  const editorTitle = document.getElementById("editor-title-subject");
  if (editorTitle) {
    editorTitle.innerText = `${currentSubj?.name || ''} - 核心必考点大纲内容编辑与发布`;
  }
}

// 3.2 渲染PC端讲义内容编辑表单 (即时同步)
function renderPCPointsEditor() {
  const container = document.getElementById("pc-points-list");
  if (!container) return;

  const kps = COURSE_DATA.keyPoints[userState.activeSubjectId] || [];
  if (kps.length === 0) {
    container.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-secondary); font-size:12px;">暂无教研考点数据，请切换科目。</div>`;
    return;
  }

  let html = "";
  kps.forEach((kp, idx) => {
    const starString = "★".repeat(kp.star) + "☆".repeat(3 - kp.star);
    html += `
      <div style="background:white; border:1px solid var(--border-color); border-radius:var(--radius-md); padding:1rem; display:flex; flex-direction:column; gap:10px; box-shadow:var(--shadow-sm);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f1f5f9; padding-bottom:6px;">
          <span style="font-weight:800; font-size:0.95rem; color:var(--accent);">📌 考点：${kp.title}</span>
          <span style="color:var(--primary-2star); font-size:11px; font-weight:700;">优先级: ${starString}</span>
        </div>

        <div style="display:grid; grid-template-columns: 80px 1fr; font-size:12px; gap:6px;">
          <div style="font-weight:700; color:var(--text-secondary);">专业术语:</div>
          <div style="font-weight:700;">${kp.term}</div>

          <div style="font-weight:700; color:var(--text-secondary);">白话大翻身:</div>
          <div id="pc-interpret-view-${idx}" style="color:#0f172a; line-height:1.4;">${kp.interpretation}</div>
          <textarea id="pc-interpret-edit-${idx}" style="display:none; width:100%; height:60px; font-family:inherit; font-size:12px; padding:4px;" class="search-input">${kp.interpretation}</textarea>

          <div style="font-weight:700; color:var(--text-secondary); line-height:30px;">记忆口诀:</div>
          <div>
            <div id="pc-mnemonic-view-${idx}" style="font-weight:800; color:#047857; background:#ecfdf5; border:1px dashed #10b981; padding:3px 10px; border-radius:3px; display:inline-block; font-size:13px;">${kp.mnemonic}</div>
            <input type="text" id="pc-mnemonic-edit-${idx}" style="display:none; width:100%; font-size:13px; font-weight:800; padding:4px;" value="${kp.mnemonic}" class="search-input">
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:4px;">
          <button id="pc-btn-edit-${idx}" class="btn-primary" style="padding:4px 10px; font-size:11px;" onclick="togglePCEditMode(${idx}, true)">编辑讲义</button>
          <button id="pc-btn-save-${idx}" class="btn-primary" style="padding:4px 10px; font-size:11px; background:#10b981; display:none;" onclick="savePCPointChange(${idx})">发布同步</button>
          <button id="pc-btn-cancel-${idx}" class="btn-primary" style="padding:4px 10px; font-size:11px; background:#64748b; display:none;" onclick="togglePCEditMode(${idx}, false)">取消</button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// 切换PC编辑行状态
function togglePCEditMode(idx, isEditing) {
  document.getElementById(`pc-interpret-view-${idx}`).style.display = isEditing ? 'none' : 'block';
  document.getElementById(`pc-interpret-edit-${idx}`).style.display = isEditing ? 'block' : 'none';
  document.getElementById(`pc-mnemonic-view-${idx}`).style.display = isEditing ? 'none' : 'inline-block';
  document.getElementById(`pc-mnemonic-edit-${idx}`).style.display = isEditing ? 'block' : 'none';

  document.getElementById(`pc-btn-edit-${idx}`).style.display = isEditing ? 'none' : 'inline-block';
  document.getElementById(`pc-btn-save-${idx}`).style.display = isEditing ? 'inline-block' : 'none';
  document.getElementById(`pc-btn-cancel-${idx}`).style.display = isEditing ? 'inline-block' : 'none';
}

// 保存PC口诀并实时推送到Mobile端
function savePCPointChange(idx) {
  const nextInterpret = document.getElementById(`pc-interpret-edit-${idx}`).value.trim();
  const nextMnemonic = document.getElementById(`pc-mnemonic-edit-${idx}`).value.trim();

  if (!nextInterpret || !nextMnemonic) {
    alert("讲义大白话和口诀不能为空！");
    return;
  }

  // 更新主数据
  COURSE_DATA.keyPoints[userState.activeSubjectId][idx].interpretation = sanitizeHTML(nextInterpret);
  COURSE_DATA.keyPoints[userState.activeSubjectId][idx].mnemonic = sanitizeHTML(nextMnemonic);

  // 关闭编辑模式
  togglePCEditMode(idx, false);

  // 重置DOM
  renderPCPointsEditor();
  renderMobilePointsList();
  renderMobileHomeStatsAndTasks();

  // Toast提示
  showMobileToast("教研口诀已即时发布同步");
}

// 3.3 全站跨科目精准搜索
let globalSearchTimer = null;
function debouncedSearch(query) {
  clearTimeout(globalSearchTimer);
  globalSearchTimer = setTimeout(function() { triggerGlobalSearch(query); }, 300);
}
function triggerGlobalSearch(query) {
  const container = document.getElementById("pc-search-results-container");
  const stats = document.getElementById("pc-search-results-stats");
  if (!container || !stats) return;

  const q = query.trim().toLowerCase();
  if (!q) {
    stats.innerText = "输入关键词开始检索全科目备考数据库...";
    container.innerHTML = "";
    return;
  }

  let results = [];

  // 遍历所有科目进行搜索
  Object.keys(COURSE_DATA.keyPoints).forEach(subjId => {
    const subjName = COURSE_DATA.subjects.find(s => s.id === subjId)?.name || subjId;
    const kps = COURSE_DATA.keyPoints[subjId];
    kps.forEach(kp => {
      if (
        kp.title.toLowerCase().includes(q) ||
        kp.term.toLowerCase().includes(q) ||
        kp.interpretation.toLowerCase().includes(q) ||
        kp.mnemonic.toLowerCase().includes(q)
      ) {
        results.push({
          subjId: subjId,
          subjName: subjName,
          kp: kp
        });
      }
    });
  });

  stats.innerText = `找到与 "${query}" 相关的全站备考考点 ${results.length} 个：`;

  if (results.length === 0) {
    container.innerHTML = `<div style="padding:30px; text-align:center; color:var(--text-secondary); font-size:12px; background:white; border-radius: var(--radius-md); border: 1px solid var(--border-color);">未搜索到任何相关考点口诀，换个词试试吧（如：弹性、折旧、素质教育）</div>`;
    return;
  }

  let html = "";
  results.forEach(res => {
    const starStr = "★".repeat(res.kp.star);
    html += `
      <div class="search-result-card" onclick="jumpToSearchedKeyPoint('${res.subjId}', '${res.kp.id}')">
        <div class="search-result-meta">
          <span style="font-weight:800; color:var(--accent); background:var(--accent-light); padding:2px 6px; border-radius:3px;">${res.subjName}</span>
          <span style="color:var(--primary-2star);">${starStr}</span>
        </div>
        <div style="font-weight:800; font-size:14px; color:#0f172a; margin-top:2px;">📌 考点：${res.kp.title}</div>
        <div class="mnemonic-box" style="font-size:13px; padding:6px; margin: 4px 0;">记忆口诀：${res.kp.mnemonic}</div>
        <div style="font-size:11.5px; color:var(--text-secondary); line-height:1.4;">
          <strong>白话解读:</strong> ${res.kp.interpretation}
        </div>
        <div style="text-align:right; font-size:10px; font-weight:700; color:var(--accent); text-decoration:underline; margin-top:4px;">
          进入该科目并跳转学习 ➔
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// 搜索结果跳转函数
function jumpToSearchedKeyPoint(subjId, kpId) {
  // 1. 切换到对应的科目
  changeGlobalSubject(subjId);

  // 2. 切换PC视图为看板/教研
  switchPCView('dashboard');

  // 3. 切换Mobile端Tab到考点速记
  switchTab('camp');

  // 4. 定位并高亮该卡片
  setTimeout(() => {
    const cardEl = document.getElementById(`kp-card-${kpId}`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      cardEl.style.borderColor = "#10b981";
      cardEl.style.boxShadow = "0 0 12px rgba(16, 185, 129, 0.4)";
      setTimeout(() => {
        cardEl.style.borderColor = "var(--app-border)";
        cardEl.style.boxShadow = "var(--shadow-sm)";
      }, 2500);
    }
  }, 350);
}

// 3.4 批量打包资料下载模拟
function simulateDownload(id, filename) {
  const container = document.getElementById(`progress-container-${id}`);
  const bar = document.getElementById(`progress-bar-${id}`);
  if (!container || !bar) return;

  container.style.display = "block";
  bar.style.width = "0%";

  let progress = 0;
  const interval = setInterval(() => {
    progress += 5;
    bar.style.width = `${progress}%`;
    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        container.style.display = "none";

        // 触发真实测试文件下载
        const blob = new Blob([
          `--- 慢慢记大龄通用备考系统专属打包资料 ---\n\n文件名称: ${filename}\n生成时间: ${new Date().toLocaleString()}\n提示: 请用大字打印，祝大龄考友门无需死记硬背，轻松通关！`
        ], { type: 'text/plain;charset=utf-8' });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert(`🎉 备考包《${filename}》已在PC端生成并触发本地打包下载！`);
      }, 200);
    }
  }, 100);
}

// 3.5 CBT 大屏全真无焦虑机考系统
function initMockExam() {
  const qList = COURSE_DATA.quizzes[userState.activeSubjectId] || [];
  mockQuestions = qList;
  mockAnswers = {};
  currentMockIndex = 0;
  mockExamActive = true;

  // 重置时间为 45 分钟
  mockTimerSeconds = 2700;
  clearInterval(mockTimerInterval);
  mockTimerInterval = setInterval(() => {
    if (mockTimerSeconds > 0) {
      mockTimerSeconds--;
      updateMockTimerString();
    } else {
      clearInterval(mockTimerInterval);
      submitMockExam();
    }
  }, 1000);

  renderMockExamNavigator();
  renderMockQuestionDetail();
}

function updateMockTimerString() {
  const m = Math.floor(mockTimerSeconds / 60).toString().padStart(2, '0');
  const s = (mockTimerSeconds % 60).toString().padStart(2, '0');
  const el = document.getElementById("mock-timer");
  if (el) el.innerText = `${m}:${s}`;
}

// 渲染模考导航面板
function renderMockExamNavigator() {
  const container = document.getElementById("mock-question-nav");
  const headerSubj = document.getElementById("mock-exam-subject-title");
  if (!container) return;

  const currentSubj = COURSE_DATA.subjects.find(s => s.id === userState.activeSubjectId);
  if (headerSubj) {
    headerSubj.innerText = `${currentSubj?.name || ''} - 电脑大屏全真机考模拟`;
  }

  if (mockQuestions.length === 0) {
    container.innerHTML = "";
    return;
  }

  let html = "";
  mockQuestions.forEach((q, idx) => {
    const isAnswered = mockAnswers[q.id] !== undefined;
    const isActive = currentMockIndex === idx;
    let cls = "cbt-nav-btn";
    if (isActive) cls += " active";
    else if (isAnswered) cls += " answered";

    html += `<button class="${cls}" onclick="switchMockQuestion(${idx})">${idx + 1}</button>`;
  });

  container.innerHTML = html;
}

// 渲染模考单题详情
function renderMockQuestionDetail() {
  const container = document.getElementById("mock-question-body-container");
  if (!container) return;

  if (mockQuestions.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:50px; color:var(--text-secondary);">
        当前科目暂无真题数据，请切换科目。
      </div>
    `;
    return;
  }

  const q = mockQuestions[currentMockIndex];
  const userSelection = mockAnswers[q.id];

  let optionsHtml = "";
  q.options.forEach(opt => {
    const isSelected = userSelection === opt.key;
    optionsHtml += `
      <div class="cbt-option-item ${isSelected ? 'selected' : ''}" onclick="selectMockOption('${q.id}', '${opt.key}')">
        <span style="width:22px; height:22px; border-radius:50%; border:2.5px solid ${isSelected ? 'var(--accent)' : 'var(--border-color)'}; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:10px; color:${isSelected ? 'var(--accent)' : 'inherit'};">
          ${opt.key}
        </span>
        <span>${opt.text}</span>
      </div>
    `;
  });

  container.innerHTML = `
    <div style="flex:1;">
      <div style="font-size:11px; font-weight:800; color:var(--accent); background:var(--accent-light); padding:2px 8px; border-radius:3px; display:inline-block; margin-bottom:10px;">
        单项选择题 (第 ${currentMockIndex + 1} 题 / 共 ${mockQuestions.length} 题)
      </div>
      <div class="cbt-question-title">${q.question}</div>
      <div class="cbt-options-list">
        ${optionsHtml}
      </div>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-color); padding-top:1rem; margin-top:1.5rem;">
      <button class="btn-primary" style="background:#64748b;" ${currentMockIndex === 0 ? 'disabled style="opacity:0.5; pointer-events:none;"':''} onclick="switchMockQuestion(${currentMockIndex - 1})">⬅️ 上一题</button>
      <div style="font-weight:700; font-size:12px; color:var(--text-secondary);">已答: ${Object.keys(mockAnswers).length}/${mockQuestions.length}</div>
      <button class="btn-primary" ${currentMockIndex === mockQuestions.length - 1 ? 'disabled style="opacity:0.5; pointer-events:none;"':''} onclick="switchMockQuestion(${currentMockIndex + 1})">下一题 ➡️</button>
    </div>
  `;
}

function selectMockOption(questionId, optionKey) {
  mockAnswers[questionId] = optionKey;
  renderMockExamNavigator();
  renderMockQuestionDetail();
}

function switchMockQuestion(index) {
  currentMockIndex = index;
  renderMockExamNavigator();
  renderMockQuestionDetail();
}

// 提交全真模拟考卷
function submitMockExam() {
  clearInterval(mockTimerInterval);

  if (mockQuestions.length === 0) return;

  let correctCount = 0;
  mockQuestions.forEach(q => {
    if (mockAnswers[q.id] === q.answer) {
      correctCount++;
    }
  });

  const score = Math.round((correctCount / mockQuestions.length) * 100);
  const isPassed = score >= 60;

  // 渲染得分面板与错题报告
  const container = document.getElementById("mock-question-body-container");
  if (!container) return;

  let analysisHtml = "";
  mockQuestions.forEach((q, idx) => {
    const userAns = mockAnswers[q.id] || "未作答";
    const isCorrect = userAns === q.answer;

    // 如果回答错误，自动同步推送到小程序端错题本 (实现双向互通)
    if (!isCorrect) {
      const wrongList = currentSubjState().wrongQuestions;
      if (!wrongList.some(item => item.id === q.id)) {
        wrongList.push(q);
        saveState();
        renderAll();
      }
    }

    analysisHtml += `
      <div style="border-bottom:1px dashed var(--border-color); padding:10px 0;">
        <div style="font-weight:700; font-size:12px; display:flex; justify-content:space-between;">
          <span>第 ${idx + 1} 题 ${isCorrect ? '✅ 答对':'❌ 答错'}</span>
          <span>您的选择: <strong style="color:${isCorrect ? '#10b981':'#ef4444'};">${userAns}</strong> | 正确答案: <strong style="color:#10b981;">${q.answer}</strong></span>
        </div>
        <div style="font-size:11.5px; color:var(--text-secondary); margin-top:4px;">${q.question}</div>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:6px; font-size:10px; margin-top:4px;">
          <strong>解析大白话:</strong> ${q.explanation} <br>
          <span style="color:#047857; font-weight:800;">${q.mnemonicLink}</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <div style="flex:1; overflow-y:auto; padding-right:10px;" class="no-scrollbar">
      <div style="text-align:center; padding:15px; background:${isPassed ? '#ecfdf5':'#fff1f2'}; border:1px solid ${isPassed ? '#10b981':'#fecaca'}; border-radius:8px; margin-bottom:15px;">
        <div style="font-size:12px; font-weight:800; color:${isPassed ? '#065f46':'#991b1b'};">机考成绩单</div>
        <div style="font-size:36px; font-weight:900; color:${isPassed ? '#10b981':'#ef4444'};">${score}<span style="font-size:14px;">分</span></div>
        <div style="font-size:11px; font-weight:700; color:var(--text-secondary); margin-top:2px;">
          答对 ${correctCount}/${mockQuestions.length} 题 | ${isPassed ? '🎉 恭喜达到及格标准！':'⚠️ 成绩不及格，错题已全自动加入小程序错题本'}
        </div>
      </div>

      <div style="font-weight:800; font-size:13px; color:var(--accent); border-bottom:1.5px solid var(--accent); padding-bottom:4px; margin-bottom:8px;">
        🔍 答卷大白话解析报告
      </div>
      ${analysisHtml}
    </div>

    <div style="text-align:center; padding-top:10px; border-top:1px solid var(--border-color); margin-top:10px;">
      <button class="btn-primary" onclick="initMockExam()">重新测试</button>
    </div>
  `;
}


// ----------------------------------
// 4. 微信小程序模拟器视图逻辑
// ----------------------------------

// 4.1 切换手机小程序视图页签 (Home, Camp, Audio, Quiz, Profile)
function switchTab(tabId, element) {
  // 更新导航高亮
  const items = document.querySelectorAll(".app-tabbar .tab-item");
  items.forEach(item => item.classList.remove("active"));

  if (element) {
    element.classList.add("active");
  } else {
    // 找不到element则通过tabId进行高亮匹配
    items.forEach(item => {
      if (item.getAttribute("onclick").includes(tabId)) {
        item.classList.add("active");
      }
    });
  }

  // 视图隐藏/显示
  const views = document.querySelectorAll(".phone-screen .app-view");
  views.forEach(v => v.classList.remove("active"));

  const targetView = document.getElementById(`app-view-${tabId}`);
  if (targetView) targetView.classList.add("active");
}

// 4.2 手机主页：渲染备考数据看板与今日极简待办任务
function renderMobileHomeStatsAndTasks() {
  const mDays = document.getElementById("m-stats-days");
  const mPoints = document.getElementById("m-stats-points");
  const mWrong = document.getElementById("m-stats-wrong");

  // 同步主看板数据
  const s = currentSubjState();
  if (mDays) mDays.innerText = userState.daysStudied;
  if (mPoints) mPoints.innerText = s.pointsChecked.length;
  if (mWrong) mWrong.innerText = s.wrongQuestions.length;

  // 渲染今日轻量任务卡
  const pointsContainer = document.getElementById("task-points-container");
  const quizContainer = document.getElementById("task-quiz-container");

  const kps = COURSE_DATA.keyPoints[userState.activeSubjectId] || [];
  const quizzes = COURSE_DATA.quizzes[userState.activeSubjectId] || [];

  if (pointsContainer) {
    let ptsHtml = "";
    kps.slice(0, 2).forEach(kp => {
      const isDone = s.pointsChecked.includes(kp.id);
      ptsHtml += `
        <div class="task-item ${isDone ? 'completed' : ''}" onclick="togglePointLearnState('${kp.id}')">
          <div class="task-title">
            <span style="font-size:12px;">📌</span>
            <span>口诀记：${kp.title}</span>
          </div>
          <div class="task-checkbox">${isDone ? '✓' : ''}</div>
        </div>
      `;
    });
    pointsContainer.innerHTML = ptsHtml;
  }

  if (quizContainer) {
    const quizDone = s.quizDoneCount >= quizzes.length && quizzes.length > 0;
    let quizHtml = `
      <div class="task-item ${quizDone ? 'completed' : ''}" onclick="switchTab('quiz')">
        <div class="task-title">
          <span style="font-size:12px;">✍️</span>
          <span>真题练：刷高频真题组 (${s.quizDoneCount}/${quizzes.length})</span>
        </div>
        <div class="task-checkbox">${quizDone ? '✓' : ''}</div>
      </div>
    `;
    quizContainer.innerHTML = quizHtml;
  }

  // 打卡状态更新
  const checkinBtn = document.getElementById("home-checkin-btn");
  if (checkinBtn) {
    if (s.checkIn) {
      checkinBtn.innerText = "今日已打卡，明天再来";
      checkinBtn.style.opacity = "0.6";
      checkinBtn.style.pointerEvents = "none";
    } else {
      checkinBtn.innerText = "每日打卡签到";
      checkinBtn.style.opacity = "1";
      checkinBtn.style.pointerEvents = "auto";
    }
  }
}

// 勾选任务状态
function togglePointLearnState(pointId) {
  const s = currentSubjState();
  if (s.pointsChecked.includes(pointId)) {
    s.pointsChecked = s.pointsChecked.filter(id => id !== pointId);
  } else {
    s.pointsChecked.push(pointId);
  }
  saveState();
  renderAll();
}

// 触发每日打卡签到
function triggerCheckIn() {
  const s = currentSubjState();
  if (s.checkIn) return;
  s.checkIn = true;
  userState.daysStudied += 1;
  saveState();
  renderAll();
  showMobileToast("打卡成功！明日请继续加油");
}

// 4.3 考点速记营：渲染列表及过滤
let currentFilter = "all";
function filterCamp(type) {
  currentFilter = type;
  const badges = document.querySelectorAll(".camp-filters .filter-badge");
  badges.forEach(b => b.classList.remove("active"));

  // 匹配高亮
  const badgeIdx = type === "all" ? 0 : (type === "star3" ? 1 : 2);
  badges[badgeIdx].classList.add("active");

  renderMobilePointsList();
}

function renderMobilePointsList() {
  const container = document.getElementById("mobile-kp-list");
  if (!container) return;

  const kps = COURSE_DATA.keyPoints[userState.activeSubjectId] || [];
  const s = currentSubjState();

  let html = "";
  kps.forEach(kp => {
    // 过滤逻辑
    if (currentFilter === "star3" && kp.star !== 3) return;
    if (currentFilter === "star2" && kp.star !== 2) return;

    const isDone = s.pointsChecked.includes(kp.id);
    const starLabel = kp.star === 3 ? "★★★ 核心必考" : "★★ 理解考点";
    const tagClass = kp.star === 3 ? "tag-3star" : "tag-2star";

    // 查看该考点是否已经在艾宾浩斯复盘队列中
    const isInQueue = s.ebbinghausQueue.some(item => item.id === kp.id);

    html += `
      <div class="kp-card star-${kp.star}" id="kp-card-${kp.id}">
        <div class="kp-header">
          <span class="kp-tag ${tagClass}">${starLabel}</span>
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-size:10px; color:var(--app-text-muted);">${kp.term}</span>
            <input type="checkbox" ${isDone ? 'checked' : ''} onclick="togglePointLearnState('${kp.id}')" style="cursor:pointer; width:14px; height:14px;">
          </div>
        </div>
        <div class="kp-name">${kp.title}</div>

        <div class="mnemonic-box">
          记忆口诀：${kp.mnemonic}
        </div>

        <div class="interpretation-box">
          <div class="interpretation-label">💡 大白话白话通俗解读</div>
          <div>${kp.interpretation}</div>
        </div>

        <!-- 对比面板 -->
        <div class="contrast-panel">
          <div class="contrast-title">⚠️ 对比防混面板</div>
          <div class="contrast-grid">
            <div class="contrast-col">
              <div class="contrast-col-title">${kp.contrast.leftTitle}</div>
              <div>${kp.contrast.leftContent}</div>
            </div>
            <div class="contrast-col">
              <div class="contrast-col-title">${kp.contrast.rightTitle}</div>
              <div>${kp.contrast.rightContent}</div>
            </div>
          </div>
        </div>

        <div class="kp-actions">
          <button class="btn-primary" style="padding:4px 10px; font-size:10px; font-weight:700; ${isInQueue ? 'background:#d97706; border-color:#d97706;':''}" onclick="addPointToEbbinghaus('${kp.id}')">
            ${isInQueue ? '🔄 智能复盘倒计时中':'学会了，智能复盘'}
          </button>
        </div>
      </div>
    `;
  });

  if (html === "") {
    html = `<div style="text-align:center; padding:30px; color:var(--app-text-muted); font-size:11px;">无此优先级的考点口诀</div>`;
  }
  container.innerHTML = html;
}

// 4.4 碎片听记：渲染音频播放列表
function renderMobileAudioList() {
  const container = document.getElementById("mobile-audio-list");
  if (!container) return;

  const tracks = COURSE_DATA.audios[userState.activeSubjectId] || [];
  if (tracks.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--app-text-muted); font-size:11.5px;">暂无该科目的音频讲义。</div>`;
    return;
  }

  let html = "";
  tracks.forEach(track => {
    const isPlaying = activeAudioTrack && activeAudioTrack.id === track.id;
    html += `
      <div class="audio-track-item ${isPlaying ? 'playing' : ''}" onclick="loadAudioTrack('${track.id}')">
        <div class="audio-track-info">
          <div class="audio-track-title">${track.title}</div>
          <div class="audio-track-duration">⏱️ 时长: ${track.duration} | 配套同步字幕</div>
        </div>
        <div class="audio-play-indicator">
          ${isPlaying && isSpeechPlaying ? '⏸️' : '▶'}
        </div>
      </div>

      <!-- 音频配套讲义提示区 -->
      <div style="background:var(--app-card-bg); border:1px solid var(--app-border); padding:8px 10px; border-radius:var(--radius-sm); font-size:10px; color:var(--app-text-muted); margin-top:-6px;">
        📖 <strong>听后速记:</strong> ${track.notes}
      </div>
    `;
  });

  container.innerHTML = html;
}

// 4.5 精简真题：渲染刷题和错题库
let activeQuizSubTab = "practice";
function switchQuizSubTab(subTabId) {
  activeQuizSubTab = subTabId;

  const tabs = document.querySelectorAll(".sub-header-tabs .sub-header-tab");
  tabs.forEach(t => t.classList.remove("active"));

  if (subTabId === "practice") {
    tabs[0].classList.add("active");
  } else {
    tabs[1].classList.add("active");
  }

  renderMobileQuizView();
}

function renderMobileQuizView() {
  const container = document.getElementById("mobile-quiz-content");
  if (!container) return;

  const s = currentSubjState();

  // 1. 刷题模式
  if (activeQuizSubTab === "practice") {
    const quizzes = COURSE_DATA.quizzes[userState.activeSubjectId] || [];
    if (quizzes.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--app-text-muted);">暂无真题数据</div>`;
      return;
    }

    // 如果全部刷完
    if (s.quizDoneCount >= quizzes.length) {
      container.innerHTML = `
        <div style="text-align:center; padding:20px 10px; background:var(--app-card-bg); border-radius: var(--radius-md); border:1px solid var(--app-border); display:flex; flex-direction:column; gap:10px; align-items:center;">
          <span style="font-size:2rem;">🎉</span>
          <div style="font-weight:800; font-size:13.5px;">真题速刷已全部过关！</div>
          <p style="font-size:10.5px; color:var(--app-text-muted); line-height:1.4;">做错的题目已经放入【错题巩固本】。大龄考生请勿死记硬背，反复温习口诀即可。</p>
          <button class="btn-primary" style="padding:6px 16px; font-size:11px;" onclick="resetQuizProgress()">重新挑战</button>
        </div>
      `;
      return;
    }

    const qIndex = s.quizDoneCount;
    const q = quizzes[qIndex];

    const progressPercent = Math.round((qIndex / quizzes.length) * 100);

    let optionsHtml = "";
    q.options.forEach(opt => {
      optionsHtml += `
        <div class="option-item" onclick="submitMobileAnswer('${q.id}', '${opt.key}', this)">
          <span style="width:20px; height:20px; border-radius:50%; border:2px solid var(--app-border); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:10px; margin-right:8px;">
            ${opt.key}
          </span>
          <span>${opt.text}</span>
        </div>
      `;
    });

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px;">
        <span style="font-weight:700;">今日真题过关组 (${qIndex + 1}/${quizzes.length})</span>
        <span style="color:var(--app-text-muted); font-weight:700;">通关进度: ${progressPercent}%</span>
      </div>
      <div class="quiz-progress-bar">
        <div class="quiz-progress-fill" style="width: ${progressPercent}%;"></div>
      </div>

      <div class="quiz-card">
        <div class="quiz-question">${q.question}</div>
        <div class="quiz-options">
          ${optionsHtml}
        </div>

        <div class="quiz-explanation" id="mobile-quiz-explain-box">
          <div class="explanation-title">💡 慢慢记解析说口语：</div>
          <div style="font-size:11px; line-height:1.4; color:var(--app-text);">${q.explanation}</div>
          <div class="mnemonic-box" style="font-size:12px; padding:6px; margin-top:4px;">
            ${q.mnemonicLink}
          </div>
          <button class="btn-primary" style="width:100%; margin-top:8px; font-weight:700;" onclick="advanceToNextQuiz()">下一题</button>
        </div>
      </div>
    `;
  }

  // 2. 错题巩固本
  else {
    const wrongList = s.wrongQuestions || [];
    if (wrongList.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:40px 10px; background:var(--app-card-bg); border-radius:var(--radius-md); border:1px solid var(--app-border);">
          <span style="font-size:2rem;">🍀</span>
          <div style="font-weight:800; font-size:13px; margin-top:6px; color:#10b981;">干净无死角，错题本空空如也！</div>
          <p style="font-size:9.5px; color:var(--app-text-muted); margin-top:3px;">凡是真题或模考答错的题都会在这里集训，掌握后可移出。</p>
        </div>
      `;
      return;
    }

    let html = "";
    wrongList.forEach((q, idx) => {
      let optionsHtml = "";
      q.options.forEach(opt => {
        const isAnswer = q.answer === opt.key;
        optionsHtml += `
          <div class="option-item ${isAnswer ? 'correct' : ''}" style="pointer-events:none;">
            <span style="width:18px; height:18px; border-radius:50%; border:2px solid var(--app-border); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:9px; margin-right:8px;">
              ${opt.key}
            </span>
            <span>${opt.text}</span>
          </div>
        `;
      });

      html += `
        <div class="quiz-card" style="position:relative; border-color:#fca5a5;">
          <span style="position:absolute; top:12px; right:12px; font-size:9px; background:#fee2e2; color:#ef4444; font-weight:800; padding:1px 5px; border-radius:3px;">错题集训</span>
          <div class="quiz-question">${q.question}</div>
          <div class="quiz-options">
            ${optionsHtml}
          </div>
          <div class="quiz-explanation show" style="background:#fffbeb; border-top: 1px solid #fee2e2;">
            <div class="explanation-title" style="color:var(--primary-2star);">💡 大白话白话辅导：</div>
            <div>${q.explanation}</div>
            <div class="mnemonic-box" style="font-size:12px; padding:6px; margin-top:4px;">
              ${q.mnemonicLink}
            </div>

            <div style="display:flex; justify-content:flex-end; margin-top:6px;">
              <button class="btn-primary" style="padding:4px 10px; font-size:10px; background:#10b981;" onclick="removeWrongQuestion('${q.id}')">已经懂了，移出本子</button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = `
      <div style="font-size:11px; font-weight:800; color:#ef4444;">🚨 当前有 ${wrongList.length} 道题目在集训中，反复复习直到消灭它们：</div>
      <div style="display:flex; flex-direction:column; gap:14px;">
        ${html}
      </div>
    `;
  }
}

// 提交移动端题目选项
function submitMobileAnswer(questionId, selectedKey, element) {
  const quizzes = COURSE_DATA.quizzes[userState.activeSubjectId] || [];
  const qIndex = currentSubjState().quizDoneCount;
  const q = quizzes[qIndex];

  if (!q) return;

  // 禁用选项二次点击
  const items = document.querySelectorAll(".quiz-options .option-item");
  items.forEach(item => item.style.pointerEvents = "none");

  const isCorrect = selectedKey === q.answer;

  if (isCorrect) {
    element.classList.add("correct");
    showMobileToast("答对了！口诀非常管用");
  } else {
    element.classList.add("incorrect");
    // 标记正确项
    items.forEach(item => {
      if (item.innerText.startsWith(q.answer)) {
        item.classList.add("correct");
      }
    });

    // 加入错题本
    const s = currentSubjState();
    if (!s.wrongQuestions.some(item => item.id === q.id)) {
      s.wrongQuestions.push(q);
      saveState();
    }
  }

  // 显示大白话解析
  const explainBox = document.getElementById("mobile-quiz-explain-box");
  if (explainBox) {
    explainBox.classList.add("show");
  }
}

// 下一题
function advanceToNextQuiz() {
  currentSubjState().quizDoneCount += 1;
  saveState();
  renderAll();
}

// 移出错题本
function removeWrongQuestion(qId) {
  const s = currentSubjState();
  s.wrongQuestions = s.wrongQuestions.filter(q => q.id !== qId);
  saveState();
  renderAll();
  showMobileToast("已成功移出错题本");
}

// 重置做题进度
function resetQuizProgress() {
  currentSubjState().quizDoneCount = 0;
  saveState();
  renderAll();
}


// ----------------------------------
// 5. 艾宾浩斯智能复盘遗忘曲线调度引擎
// ----------------------------------

// 5.1 加入艾宾浩斯智能复盘队列
function addPointToEbbinghaus(pointId) {
  const s = currentSubjState();
  const kpList = COURSE_DATA.keyPoints[userState.activeSubjectId] || [];
  const kp = kpList.find(p => p.id === pointId);

  if (!kp) return;

  // 检查是否已在队列中
  if (s.ebbinghausQueue.some(item => item.id === pointId)) {
    showMobileToast("该口诀已在复盘计划中");
    return;
  }

  const targetTime = Date.now() + REVIEW_DELAY_SECONDS * 1000;

  s.ebbinghausQueue.push({
    id: kp.id,
    title: kp.title,
    mnemonic: kp.mnemonic,
    targetTime: targetTime, // 下次复盘激活时刻
    intervalCount: 1 // 复盘间隔递增档次
  });

  saveState();
  renderAll();

  showMobileToast("已加入智能复盘，30秒后将触发检测提示");
}

// 5.2 艾宾浩斯后台时间线心跳检测
function startEbbinghausTicker() {
  setInterval(() => {
    let hasAlert = false;

    // 遍历所有科目检测是否有触发时间已到的复盘任务
    Object.keys(userState.subjectsState).forEach(subjId => {
      const state = userState.subjectsState[subjId];
      const now = Date.now();
      const readyItems = state.ebbinghausQueue.filter(item => now >= item.targetTime);
      if (readyItems.length > 0) {
        hasAlert = true;
      }
    });

    // 更新手机端底部真题精练的红点提醒
    const alertBadge = document.getElementById("review-alert-badge");
    if (alertBadge) {
      alertBadge.style.display = hasAlert ? "block" : "none";
    }

    updateEbbinghausWarningBanner();
  }, 1000);
}

// 5.3 手机首屏更新待复习醒目黄色条横幅
function updateEbbinghausWarningBanner() {
  const container = document.getElementById("ebbinghaus-waiting-container");
  if (!container) return;

  const s = currentSubjState();
  const now = Date.now();
  const readyItems = s.ebbinghausQueue.filter(item => now >= item.targetTime);

  // 获取倒计时中最近的任务时间显示
  const pendingItems = s.ebbinghausQueue.filter(item => now < item.targetTime);
  let countdownText = "";
  if (pendingItems.length > 0) {
    const minDiff = Math.round((pendingItems[0].targetTime - now) / 1000);
    countdownText = `<div style="text-align:center; font-size:10px; color:var(--app-text-muted); font-weight:700;">🔄 复盘卡片倒计时中: ${minDiff}秒</div>`;
  }

  if (readyItems.length > 0) {
    container.innerHTML = `
      <div class="review-waiting-banner">
        <span>⚠️ 艾宾浩斯曲线提醒：有 ${readyItems.length} 个口诀需要复盘</span>
        <button class="review-btn-tiny" onclick="triggerEbbinghausActiveReviewPopup()">立即复盘</button>
      </div>
    `;
    container.style.display = "block";
  } else if (countdownText !== "") {
    container.innerHTML = countdownText;
    container.style.display = "block";
  } else {
    container.style.display = "none";
  }
}

// 5.4 触发艾宾浩斯智能复盘弹框测试
function triggerEbbinghausActiveReviewPopup() {
  const s = currentSubjState();
  const now = Date.now();
  const readyItemIndex = s.ebbinghausQueue.findIndex(item => now >= item.targetTime);

  if (readyItemIndex === -1) return;

  const item = s.ebbinghausQueue[readyItemIndex];
  const kpList = COURSE_DATA.keyPoints[userState.activeSubjectId] || [];
  const kp = kpList.find(p => p.id === item.id);

  if (!kp) return;

  // 随机挖空口诀字，做口诀填空题
  // 高弹降价，低弹涨价 -> 高弹【】，低弹涨价
  const mStr = kp.mnemonic;
  let questionStr = mStr;
  let answerKeyword = "";

  if (mStr.includes("降价")) {
    questionStr = mStr.replace("降价", "【 填空 】");
    answerKeyword = "降价";
  } else if (mStr.includes("折旧")) {
    questionStr = mStr.replace("折旧", "【 填空 】");
    answerKeyword = "折旧";
  } else if (mStr.includes("自决")) {
    questionStr = mStr.replace("自决", "【 填空 】");
    answerKeyword = "自决";
  } else {
    // 默认挖第一个分句
    const parts = mStr.split("，");
    if (parts.length > 1) {
      questionStr = "【 填空 】" + "，" + parts[1];
      answerKeyword = parts[0];
    } else {
      questionStr = mStr.substring(0, 3) + "【 填空 】";
      answerKeyword = mStr.substring(3);
    }
  }

  // 弹出原生 prompt 让大龄考生复述口诀（降低复杂UI阻碍）
  const userInput = prompt(`🧠 艾宾浩斯复盘：请补齐该考点的口诀大字\n\n考点：${kp.title}\n口诀要求：${questionStr}\n\n请输入括号中挖掉的字词：`);

  if (userInput === null) return; // 取消

  if (userInput.trim() === answerKeyword) {
    alert("🎉 答对了！遗忘抗性翻倍，该口诀已被记忆引擎归档！");

    // 从复盘队列中移除 (或升级为下一次更长的延时)
    s.ebbinghausQueue.splice(readyItemIndex, 1);

    // 加入到已牢记
    if (!s.pointsChecked.includes(kp.id)) {
      s.pointsChecked.push(kp.id);
    }

    saveState();
    renderAll();
  } else {
    alert(`❌ 记错了，正确答案是【${answerKeyword}】。口诀已在复盘队列中重置冷却时间，稍后会继续考你。`);

    // 重置下一次检测时间
    item.targetTime = Date.now() + 15 * 1000; // 15秒后重新考
    saveState();
    renderAll();
  }
}


// ----------------------------------
// 6. HTML5 Web Speech TTS 语音播放器引擎
// ----------------------------------

// 6.1 加载播放音频伴读轨迹
function loadAudioTrack(trackId) {
  const tracks = COURSE_DATA.audios[userState.activeSubjectId] || [];
  const track = tracks.find(t => t.id === trackId);

  if (!track) return;

  // 如果点击的是当前正在放的，则直接触发暂停/播放切换
  if (activeAudioTrack && activeAudioTrack.id === trackId) {
    togglePlayPause();
    return;
  }

  // 初始化新的音频文件播放
  stopAudioPlayer();
  activeAudioTrack = track;

  const panel = document.getElementById("audio-player-panel");
  const trackTitle = document.getElementById("player-track-title");

  if (panel) panel.classList.add("active");
  if (trackTitle) trackTitle.innerText = track.title;

  // 加载歌词讲义列表
  renderSubtitlesWrapper(track.subtitles);

  // 开始触发播放
  togglePlayPause();
  renderMobileAudioList();
}

// 渲染听字本歌词元素
function renderSubtitlesWrapper(subtitles) {
  const container = document.getElementById("subtitles-wrapper");
  if (!container) return;

  let html = "";
  subtitles.forEach((sub, idx) => {
    html += `<div class="sub-line" id="sub-line-${idx}" onclick="seekAudioTime(${sub.time}, ${idx})">${sub.text}</div>`;
  });

  container.innerHTML = html;
  container.style.transform = `translateY(12px)`;
  currentSubtitleIndex = -1;
}

// 跳动到指定字幕时间点播放
function seekAudioTime(time, index) {
  if (!activeAudioTrack || !isSpeechPlaying) return;

  // 停止并跳转到对应台词播放
  window.speechSynthesis.cancel();

  currentSubtitleIndex = index;
  speakCurrentSubtitle();
}

// 切换播放与暂停
function togglePlayPause() {
  if (!activeAudioTrack) return;

  const playBtnIcon = document.getElementById("player-play-btn-icon");
  const visBars = document.querySelectorAll(".visualizer-container .vis-bar");

  if (isSpeechPlaying) {
    // 暂停
    isSpeechPlaying = false;
    window.speechSynthesis.cancel();
    clearInterval(speechTimer);

    if (playBtnIcon) playBtnIcon.innerText = "▶";
    visBars.forEach(b => b.classList.remove("animating"));
  } else {
    // 播放
    isSpeechPlaying = true;
    if (playBtnIcon) playBtnIcon.innerText = "⏸️";
    visBars.forEach(b => b.classList.add("animating"));

    if (currentSubtitleIndex === -1) {
      currentSubtitleIndex = 0;
    }

    speakCurrentSubtitle();
  }
}

// 使用 Web Speech API TTS 进行真实声音发声
let currentPlaybackRate = 1.0; // 默认倍速

function speakCurrentSubtitle() {
  if (!activeAudioTrack || !isSpeechPlaying) return;

  const subs = activeAudioTrack.subtitles;
  if (currentSubtitleIndex >= subs.length) {
    // 播放全部完成
    stopAudioPlayer();
    return;
  }

  const currentSub = subs[currentSubtitleIndex];

  // 1. 高亮并滚动到当前行
  highlightSubtitleLine(currentSubtitleIndex);

  // 2. 调用浏览器自带语音合成
  speechUtterance = new SpeechSynthesisUtterance(currentSub.text);
  speechUtterance.lang = "zh-CN";
  speechUtterance.rate = currentPlaybackRate; // 大龄考生可调 0.8x 慢语速

  // 在文字读完后自动滚动进入下一句
  speechUtterance.onend = () => {
    if (isSpeechPlaying) {
      currentSubtitleIndex++;
      speakCurrentSubtitle();
    }
  };

  speechUtterance.onerror = (e) => {
    console.warn("Speech synthesis ended or errored.", e);
  };

  // 执行合成发音
  window.speechSynthesis.speak(speechUtterance);

  // 3. 模拟进度条跑动
  updateProgressBarSimulated(currentSub.time);
}

// 高亮并滚动字幕文本行
function highlightSubtitleLine(index) {
  const lines = document.querySelectorAll(".subtitles-scroller .sub-line");
  lines.forEach(l => l.classList.remove("highlight"));

  const targetLine = document.getElementById(`sub-line-${index}`);
  if (targetLine) {
    targetLine.classList.add("highlight");
  }

  const wrapper = document.getElementById("subtitles-wrapper");
  if (wrapper) {
    // 每行歌词高度为 22px，负位移向上滚动
    const offset = 12 - (index * 22);
    wrapper.style.transform = `translateY(${offset}px)`;
  }
}

// 更新音频播放进度条与数值显示
function updateProgressBarSimulated(sec) {
  const fill = document.getElementById("player-progress-fill");
  const curTimeEl = document.getElementById("player-current-time");
  const totalTimeEl = document.getElementById("player-total-time");

  if (!activeAudioTrack) return;

  // 获取总播放时长
  const durParts = activeAudioTrack.duration.split(":");
  const totalSeconds = parseInt(durParts[0]) * 60 + parseInt(durParts[1]);

  const percent = Math.min((sec / totalSeconds) * 100, 100);
  if (fill) fill.style.width = `${percent}%`;

  // 格式化当前秒数
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  if (curTimeEl) curTimeEl.innerText = `${m}:${s}`;
  if (totalTimeEl) totalTimeEl.innerText = activeAudioTrack.duration;
}

// 调整播放倍率 (0.8 慢速伴读 / 1.0 正常速度)
function changePlaybackRate() {
  const rateBtn = document.getElementById("player-rate-btn");
  if (currentPlaybackRate === 1.0) {
    currentPlaybackRate = 0.8;
    if (rateBtn) rateBtn.innerText = "0.8x 慢伴";
  } else {
    currentPlaybackRate = 1.0;
    if (rateBtn) rateBtn.innerText = "1.0x 正常";
  }

  // 如果正在放，重新应用语速
  if (isSpeechPlaying) {
    window.speechSynthesis.cancel();
    speakCurrentSubtitle();
  }
}

// 停止播放音频重置
function stopAudioPlayer() {
  isSpeechPlaying = false;
  window.speechSynthesis.cancel();
  clearInterval(speechTimer);
  activeAudioTrack = null;
  currentSubtitleIndex = -1;

  const panel = document.getElementById("audio-player-panel");
  if (panel) panel.classList.remove("active");

  const playBtnIcon = document.getElementById("player-play-btn-icon");
  if (playBtnIcon) playBtnIcon.innerText = "▶";

  const visBars = document.querySelectorAll(".visualizer-container .vis-bar");
  visBars.forEach(b => b.classList.remove("animating"));

  // 刷新听记卡片列表播放状态
  renderMobileAudioList();
}


// ----------------------------------
// 7. 大龄个性化关怀面板 (字号缩放 & 护眼)
// ----------------------------------

// 切换字号大小 (常规/中/大)
function changeFontSize(sizeClass) {
  const container = document.getElementById("phone-screen-container");
  if (!container) return;

  // 清除老字号Class
  container.classList.remove("font-normal", "font-medium", "font-large");
  container.classList.add(sizeClass);

  userState.fontSizeClass = sizeClass;
  saveState();

  // 菜单按钮高亮切换
  const btns = document.querySelectorAll(".size-selector .size-btn");
  btns.forEach(btn => btn.classList.remove("active"));

  const activeIdx = sizeClass === "font-normal" ? 0 : (sizeClass === "font-medium" ? 1 : 2);
  btns[activeIdx].classList.add("active");
}

// 纸张护眼暖黄色彩切换
function toggleEyeProtect() {
  const toggle = document.getElementById("eye-protect-toggle");
  const container = document.getElementById("phone-screen-container");
  if (!toggle || !container) return;

  if (toggle.checked) {
    container.classList.add("eye-protect");
    userState.eyeProtectMode = true;
  } else {
    container.classList.remove("eye-protect");
    userState.eyeProtectMode = false;
  }

  saveState();
}

// 应用已保存的个性化配置
function renderMobileSettings() {
  const container = document.getElementById("phone-screen-container");
  const toggle = document.getElementById("eye-protect-toggle");

  if (container) {
    container.classList.remove("font-normal", "font-medium", "font-large");
    container.classList.add(userState.fontSizeClass || "font-normal");
  }

  if (toggle) {
    toggle.checked = userState.eyeProtectMode || false;
    if (userState.eyeProtectMode) {
      container?.classList.add("eye-protect");
    } else {
      container?.classList.remove("eye-protect");
    }
  }

  // 同步高亮字号切换按钮
  const btns = document.querySelectorAll(".size-selector .size-btn");
  if (btns.length === 3) {
    btns.forEach(btn => btn.classList.remove("active"));
    const cls = userState.fontSizeClass || "font-normal";
    const activeIdx = cls === "font-normal" ? 0 : (cls === "font-medium" ? 1 : 2);
    btns[activeIdx].classList.add("active");
  }
}

// 7.3 全局Toast提示气泡
function showMobileToast(msg) {
  const toast = document.getElementById("mobile-toast");
  if (!toast) return;

  toast.innerText = msg;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

// 7.4 微信群/班主任弹窗交互
function openWechatPopup(type) {
  const popup = document.getElementById("wechat-popup");
  if (!popup) return;

  let title = "";
  let desc = "";
  let iconText = "";

  if (type === 'group') {
    title = "慢慢记 - 大龄备考抱团学习群";
    desc = "与全国 28–45 岁同龄考友并肩作战，获取每日口诀打卡督导";
    iconText = "微信群二维码";
  } else {
    title = "慢慢记 - 专属教务班主任";
    desc = "一对一制定备考计划，免费解锁大屏模考无限使用权益";
    iconText = "班主任微信";
  }

  popup.innerHTML = `
    <div class="popup-card">
      <h4 style="font-weight:800; font-size:13.5px; color:var(--primary-3star);">${title}</h4>
      <p style="font-size:10px; color:var(--app-text-muted); line-height:1.4;">${desc}</p>

      <div class="qr-code-placeholder">
        <svg class="qr-svg" viewBox="0 0 100 100">
          <!-- 绘制高保真演示维码图案 -->
          <rect x="10" y="10" width="20" height="20" fill="#0f172a" />
          <rect x="14" y="14" width="12" height="12" fill="white" />
          <rect x="70" y="10" width="20" height="20" fill="#0f172a" />
          <rect x="74" y="14" width="12" height="12" fill="white" />
          <rect x="10" y="70" width="20" height="20" fill="#0f172a" />
          <rect x="14" y="74" width="12" height="12" fill="white" />
          <!-- 杂乱像素块 -->
          <rect x="40" y="20" width="8" height="8" fill="#0f172a" />
          <rect x="52" y="36" width="6" height="6" fill="#0f172a" />
          <rect x="44" y="60" width="12" height="10" fill="#0f172a" />
          <rect x="68" y="52" width="10" height="8" fill="#0f172a" />
          <rect x="35" y="75" width="10" height="10" fill="#0f172a" />
        </svg>
        <span style="font-size:8px; color:var(--app-text-muted); font-weight:700; margin-top:-2px;">[ 截图扫码添加 ]</span>
      </div>

      <p style="font-size:9.5px; color:var(--primary-2star); font-weight:700;">班级口号：大龄备考不硬背，证书轻松过！</p>
      <button class="popup-close" onclick="closeWechatPopup()">关闭返回</button>
    </div>
  `;

  popup.style.display = "flex";
}

function closeWechatPopup() {
  const popup = document.getElementById("wechat-popup");
  if (popup) popup.style.display = "none";
}


// ----------------------------------
// 8. 引擎自引导装载 (Bootstrap)
// ----------------------------------
window.addEventListener("DOMContentLoaded", () => {
  // 1. 初始化持久化状态
  initUserState();

  // 2. 初始化科目联动
  changeGlobalSubject(userState.activeSubjectId);

  // 3. 开启艾宾浩斯心跳轮询
  startEbbinghausTicker();

  // 4. 重置一次大屏模考
  initMockExam();
});
