import { createTimer, tick, start, pause, skip, reset, currentSession, formatTime, CYCLE } from './timer.js';

const els = {
  app: document.getElementById('app'),
  time: document.getElementById('time'),
  sessionLabel: document.getElementById('session-label'),
  stats: document.getElementById('stats'),
  startPause: document.getElementById('start-pause'),
  reset: document.getElementById('reset'),
  skip: document.getElementById('skip'),
  modes: document.getElementById('modes'),
};

const timer = createTimer();

// 1s display tick — the state machine itself is driven by wall-clock seconds so
// background tab throttling cannot lose time.
let lastSecond = null;
let rafId = null;

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
    osc.onended = () => ctx.close();
  } catch {
    // Audio is best-effort only.
  }
}

function render() {
  const session = currentSession(timer);
  const isBreak = session.type !== 'work';
  els.time.textContent = formatTime(timer.remaining);
  els.sessionLabel.textContent = session.label;
  els.startPause.textContent = timer.running ? '暂停' : '开始';
  els.stats.textContent = `已完成专注 ${timer.completedWorkSessions} 次 · 完整循环 ${timer.cyclesCompleted} 个`;
  document.title = `${formatTime(timer.remaining)} ${session.label} · 番茄钟`;
  document.body.classList.toggle('break', isBreak);
  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === session.type);
  });
}

function loop() {
  const now = Date.now();
  if (lastSecond === null) lastSecond = now;
  const elapsed = Math.floor((now - lastSecond) / 1000);
  if (elapsed >= 1) {
    const events = tick(timer, elapsed);
    lastSecond = now;
    if (events.some((e) => e.type === 'sessionCompleted')) beep();
    render();
  }
  rafId = requestAnimationFrame(loop);
}

function jumpTo(mode) {
  pause(timer);
  const index = CYCLE.indexOf(mode);
  if (index !== -1) timer.sessionIndex = index;
  timer.remaining = currentSession(timer).duration;
  lastSecond = null;
  render();
}

els.startPause.addEventListener('click', () => {
  if (timer.running) pause(timer);
  else start(timer);
  lastSecond = null;
  render();
});

els.reset.addEventListener('click', () => {
  reset(timer);
  lastSecond = null;
  render();
});

els.skip.addEventListener('click', () => {
  skip(timer);
  lastSecond = null;
  render();
});

els.modes.addEventListener('click', (event) => {
  const btn = event.target.closest('.mode-btn');
  if (btn) jumpTo(btn.dataset.mode);
});

// Deep-link a session via URL hash, e.g. index.html#shortBreak
const hashMode = location.hash.slice(1);
if (CYCLE.includes(hashMode)) jumpTo(hashMode);
else render();
rafId = requestAnimationFrame(loop);
