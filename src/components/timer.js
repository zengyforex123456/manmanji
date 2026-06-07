// src/components/timer.js — 冲刺模式倒计时组件
// R10: 90分钟倒计时 + 最后5分钟红闪 + 自动提交

let _seconds = 0;
let _interval = null;
let _onTimeUp = null;
let _displayEl = null;

function start(totalSeconds, onTimeUp) {
  _seconds = totalSeconds;
  _onTimeUp = onTimeUp;
  _displayEl = document.getElementById('mock-timer-display');
  updateDisplay();
  _interval = setInterval(tick, 1000);
}

function tick() {
  _seconds--;
  updateDisplay();
  if (_seconds <= 300) {
    // 最后5分钟红色闪烁
    if (_displayEl) _displayEl.classList.toggle('timer-warning', _seconds % 2 === 0);
  }
  if (_seconds <= 0) {
    stop();
    if (_onTimeUp) _onTimeUp();
  }
}

function updateDisplay() {
  if (!_displayEl) return;
  const m = Math.floor(_seconds / 60);
  const s = _seconds % 60;
  _displayEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function pause() {
  if (_interval) { clearInterval(_interval); _interval = null; }
}

function resume() {
  if (!_interval) _interval = setInterval(tick, 1000);
}

function stop() {
  if (_interval) { clearInterval(_interval); _interval = null; }
  if (_displayEl) _displayEl.classList.remove('timer-warning');
}

function getElapsed() {
  const total = _seconds > 0 ? _seconds : 0;
  return total;
}

export const Timer = { start, pause, resume, stop, getElapsed };

// Timer styles injected inline
const style = document.createElement('style');
style.textContent = `
.timer-display { font-size: 20px; font-weight: 800; color: var(--text-primary); }
.timer-warning { color: #dc2626 !important; animation: pulse 0.5s infinite; }
@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
`;
document.head.appendChild(style);
