// L3: BKT诊断卡片
export function renderBKT(state) {
  var progress = [];
  try { progress = JSON.parse(localStorage.getItem('mmj_progress') || '[]'); } catch(e) {}
  var chapterStats = {};
  progress.forEach(function(p) { var ch = p.chapter || 0; if (!ch) return; if (!chapterStats[ch]) chapterStats[ch] = { total: 0, wrong: 0 }; chapterStats[ch].total++; if (p.wrongCount > 0) chapterStats[ch].wrong++; });
  var weakest = Object.entries(chapterStats).filter(function(e) { return e[1].total >= 3; }).map(function(e) { return { num: parseInt(e[0]), acc: Math.round((1 - e[1].wrong / e[1].total) * 100) }; }).sort(function(a, b) { return a.acc - b.acc; }).slice(0, 3);
  var totalChapters = Object.keys(chapterStats).length;

  var html = '<div class="bkt-card"><div class="bkt-header"><span class="bkt-title">🧠 AI私教诊断</span><span class="bkt-status">' + (totalChapters > 0 ? '已诊断 ' + totalChapters + ' 章' : '刷题后激活') + '</span></div>';

  if (weakest.length > 0) {
    html += '<div class="bkt-chapters">';
    weakest.forEach(function(w) {
      var color = w.acc < 40 ? 'var(--c-danger)' : w.acc < 60 ? 'var(--c-accent)' : 'var(--c-success)';
      html += '<div class="bkt-chapter" onclick="startWeakPractice(' + w.num + ')"><div class="bkt-chapter-num">第' + w.num + '章</div><div class="bkt-chapter-pct" style="color:' + color + '">' + w.acc + '%</div><div class="bkt-chapter-label">掌握度</div></div>';
    });
    html += '</div>';
  } else {
    html += '<div class="bkt-empty">📝 刷题后自动激活 · AI分析薄弱章节</div>';
  }

  return html + '</div>';
}
