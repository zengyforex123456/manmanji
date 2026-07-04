// 20门职称考试响应式导航（网格卡片+智能排序+分类筛选+搜索）
import { State } from '../core/state.js';

// ─── 极简智考·仅中级经济师 ───
const ALL_EXAMS = [
  { id:'econ', name:'中级经济师', icon:'📊', category:'经济金融', hot:98, examDate:'2026-11', active:true,
    children: [
      { id:'econ', name:'经济基础', icon:'📊', questions:19749 },
      { id:'hr', name:'人力资源管理', icon:'👥', questions:10545 },
      { id:'biz', name:'工商管理', icon:'🏭', questions:4740 },
    ]},
  { id:'hr', name:'中级经济师·人力资源', icon:'👥', category:'经济金融', hot:85, examDate:'2026-11', questions:10545 },
  { id:'biz', name:'中级经济师·工商管理', icon:'🏭', category:'经济金融', hot:80, examDate:'2026-11', questions:4740 },
];

const CATEGORIES = ['全部','建筑工程','经济金融','医药卫生','计算机','其他'];
const RECENT_KEY = 'mmj_recent_exams';

// ─── 渲染导航 ───
export function renderSubjectNav() {
  window.renderSubjectNav = renderSubjectNav; // 暴露到全局，供onclick使用
  const nav = document.getElementById('nav-subjects');
  if (!nav) return;

  const active = State.getActiveSubjectId();
  const recents = getRecents();

  // 排序：活跃科目+最近使用优先
  const sorted = [...ALL_EXAMS].sort((a,b) => {
    const aActive = a.active ? 1 : 0; const bActive = b.active ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
    const aRecent = recents.includes(a.id) ? recents.indexOf(a.id) : 99;
    const bRecent = recents.includes(b.id) ? recents.indexOf(b.id) : 99;
    if (aRecent !== bRecent) return aRecent - bRecent;
    return (b.hot||0) - (a.hot||0);
  });

  const activeExam = sorted.find(e => e.id === active);

  nav.innerHTML = `
    <div class="sn-trigger" id="sn-trigger" onclick="SN.open()">
      <span class="sn-icon">${activeExam?.icon || '📚'}</span>
      <span class="sn-name">${activeExam?.name || '选择考试'}</span>
      <span class="sn-arrow">▾</span>
    </div>
    <div class="sn-overlay" id="sn-overlay" onclick="SN.close()"></div>
    <div class="sn-panel" id="sn-panel">
      <div class="sn-header">
        <span class="sn-title">选择考试科目（${ALL_EXAMS.length}门）</span>
        <span class="sn-close" onclick="SN.close()">✕</span>
      </div>
      <div class="sn-search">
        <input id="sn-search-input" type="text" placeholder="搜索考试名称或拼音首字母..." oninput="SN.filter()">
      </div>
      <div class="sn-categories" id="sn-categories">
        ${CATEGORIES.map(c => `<span class="sn-cat ${c==='全部'?'active':''}" onclick="SN.filterCat('${c}')">${c}</span>`).join('')}
      </div>
      <div class="sn-recents" id="sn-recents">
        ${recents.length > 0 ? `<div class="sn-section-title">最近使用</div><div class="sn-card-grid" id="sn-recent-grid">${renderCards(sorted.filter(e => recents.includes(e.id)).slice(0,3), active)}</div>` : ''}
      </div>
      <div class="sn-section-title">全部科目</div>
      <div class="sn-card-grid" id="sn-all-grid">
        ${renderCards(sorted, active)}
      </div>
      <div class="sn-empty" id="sn-empty" style="display:none">未找到匹配的考试科目</div>
    </div>
  `;

  // 全局方法
  window.SN = {
    open() { document.getElementById('sn-panel')?.classList.add('open'); document.getElementById('sn-overlay')?.classList.add('open'); setTimeout(()=>document.getElementById('sn-search-input')?.focus(),200); },
    close() { document.getElementById('sn-panel')?.classList.remove('open'); document.getElementById('sn-overlay')?.classList.remove('open'); },
    filter() { filterExams(); },
    filterCat(cat) { document.querySelectorAll('.sn-cat').forEach(el=>el.classList.toggle('active',el.textContent===cat)); filterExams(cat); },
    select(id) { addRecent(id); window.switchSubject(id); },
    selectSub(id) { addRecent(id); window.switchSubject(id); },
    toggleChildren(e) {
      const children = e.currentTarget.nextElementSibling;
      if (children) children.classList.toggle('open');
      e.currentTarget.querySelector('.sn-card-arrow').classList.toggle('open');
    },
    sort(mode) { /* future */ },
  };
}

function renderCards(exams, active) {
  return exams.map(e => {
    if (e.children) {
      const anyChildActive = e.children.some(c => c.id === active);
      const childHtml = e.children.map(c => `
        <div class="sn-sub-card${c.id===active?' active':''}" onclick="event.stopPropagation();SN.selectSub('${c.id}')">
          <span class="sn-sub-icon">${c.icon}</span>
          <span class="sn-sub-name">${c.name}</span>
          <span class="sn-sub-count">${(c.questions/1000).toFixed(1)}k题</span>
        </div>
      `).join('');
      return `
        <div class="sn-card sn-card-parent${anyChildActive?' active':''}" style="grid-column:1/-1" onclick="SN.toggleChildren(event)">
          <div class="sn-card-icon">${e.icon}</div>
          <div class="sn-card-name">${e.name}</div>
          <div class="sn-card-meta">
            ${e.examDate ? `<span class="sn-card-date">📅 ${e.examDate}</span>` : ''}
            <span class="sn-card-count">${e.children.length}门科目</span>
          </div>
          ${anyChildActive ? '<div class="sn-card-badge">当前</div>' : ''}
          <div class="sn-card-arrow">▾</div>
        </div>
        <div class="sn-children" style="grid-column:1/-1">${childHtml}</div>
      `;
    }
    return `
      <div class="sn-card${e.id===active?' active':''}" onclick="SN.select('${e.id}')">
        <div class="sn-card-icon">${e.icon}</div>
        <div class="sn-card-name">${e.name}</div>
        <div class="sn-card-meta">
          ${e.examDate ? `<span class="sn-card-date">📅 ${e.examDate}</span>` : ''}
          ${e.questions ? `<span class="sn-card-count">📝 ${(e.questions/1000).toFixed(1)}k题</span>` : ''}
        </div>
        ${e.active ? '<div class="sn-card-badge">当前</div>' : ''}
      </div>
    `;
  }).join('');
}

function filterExams(cat) {
  const q = (document.getElementById('sn-search-input')?.value || '').toLowerCase();
  const allCards = document.querySelectorAll('#sn-all-grid .sn-card');
  const empty = document.getElementById('sn-empty');
  let visible = 0;
  allCards.forEach(card => {
    const name = card.querySelector('.sn-card-name')?.textContent || '';
    const catText = cat && cat !== '全部' ? card.closest('#sn-all-grid')?.dataset?.cat : true;
    const match = (!q || name.toLowerCase().includes(q) || matchPinyin(name, q)) &&
                  (!cat || cat === '全部' || card.dataset.cat === cat);
    card.style.display = match ? '' : 'none';
    if (match) visible++;
  });
  if (empty) empty.style.display = visible === 0 ? 'block' : 'none';
}

function matchPinyin(name, q) {
  // 简单拼音首字母匹配
  const pinyin = { '一':'y','建':'j','造':'z','师':'s','监':'j','理':'l','经':'j','济':'j','中':'z','级':'j','会':'k','计':'j','人':'r','力':'l','资':'z','源':'y','银':'y','行':'h','证':'z','券':'q','医':'y','药':'y','护':'h','士':'s','健':'j','康':'k','计':'j','算':'s','机':'j','软':'r','考':'k','教':'j','社':'s','工':'g','法':'f','律':'l','工':'g','商':'s','管':'g','注':'z','册':'c','税':'s','务':'w' };
  const initials = [...name].map(c => pinyin[c] || c).join('').toLowerCase();
  return initials.includes(q);
}

function getRecents() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function addRecent(id) {
  let list = getRecents().filter(i => i !== id);
  list.unshift(id);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5)));
}

export { ALL_EXAMS, CATEGORIES };
