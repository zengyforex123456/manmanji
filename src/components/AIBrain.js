// L3: AI诊断+出题面板 — loading·正常·error三态
export function renderAIBrain() {
  return '<div class="flow-guide" style="background:linear-gradient(135deg,#eff6ff,#faf5ff);border:1px solid #c7d2fe;border-radius:12px;padding:14px" id="ai-brain-panel">'
    + '<div class="flow-title" data-testid="ai-brain-panel" style="color:#4f46e5;margin-bottom:10px">🧠 AI私教出题 <span style="font-size:10px;background:#6366f1;color:#fff;padding:2px 6px;border-radius:4px;margin-left:4px">BKT诊断 + DeepSeek实时生成</span></div>'
    + '<div id="bkt-mastery-bar" style="display:flex;gap:12px;margin-bottom:10px;font-size:12px;padding:8px 12px;background:rgba(99,102,241,.08);border-radius:8px">'
    + '<span>📊 37章掌握度分析中... 刷20题解锁</span>'
    + '</div>'
    + '<div style="display:flex;gap:8px">'
    + '<input id="ai-prompt-input" type="text" placeholder="告诉AI你想练什么：如"宏观经济10道单选题"" style="flex:1;padding:10px 14px;border:1px solid #c7d2fe;border-radius:8px;font-size:14px;outline:none;background:#fff" onkeydown="if(event.key===\'Enter\')window.startAIFromPrompt()">'
    + '<button onclick="window.startAIFromPrompt()" style="background:#6366f1;color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;white-space:nowrap">🎯 出题</button>'
    + '</div>'
    + '<div style="display:flex;gap:6px;margin-top:8px;align-items:center">'
    + '<span style="font-size:11px;color:#94a3b8">快捷：</span>'
    + '<button onclick="window.startAIQuick(\'10道经济基础单选题\')" style="background:#fff;border:1px solid #e2e8f0;padding:5px 10px;border-radius:6px;font-size:11px;cursor:pointer;color:#6366f1">10道练习</button>'
    + '<button onclick="window.startAIExam()" style="background:#fff;border:1px solid #e2e8f0;padding:5px 10px;border-radius:6px;font-size:11px;cursor:pointer;color:#0f766e">模拟组卷</button>'
    + '<button onclick="window.startAIWeak()" style="background:#fef3c7;border:1px solid #fcd34d;padding:5px 10px;border-radius:6px;font-size:11px;cursor:pointer;color:#92400e">薄弱项专项</button>'
    + '</div>'
    + '<div id="ai-insights-content" style="padding:6px 0 0;font-size:12px;color:#94a3b8">AI基于大题库+考纲实时出题 · 题目含解析 · 可反复生成</div>'
    + '</div>';
}
