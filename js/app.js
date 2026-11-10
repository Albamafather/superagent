import { createTimer, tick, start, pause, skip, reset, currentSession, formatTime, CYCLE } from './timer.js';
import {
  createTodoStore, addTodo, toggleTodo, deleteTodo, renameTodo, addPomodoro,
  setActiveTodo, activeTodo, setFilter, visibleTodos, counts, clearDone,
} from './todos.js';

const els = {
  app: document.getElementById('app'),
  time: document.getElementById('time'),
  sessionLabel: document.getElementById('session-label'),
  stats: document.getElementById('stats'),
  startPause: document.getElementById('start-pause'),
  reset: document.getElementById('reset'),
  skip: document.getElementById('skip'),
  modes: document.getElementById('modes'),
  todoForm: document.getElementById('todo-form'),
  todoInput: document.getElementById('todo-input'),
  todoList: document.getElementById('todo-list'),
  todoFilters: document.getElementById('todo-filters'),
  todoCount: document.getElementById('todo-count'),
  clearDone: document.getElementById('clear-done'),
  activeTodo: document.getElementById('active-todo'),
  activeTodoName: document.getElementById('active-todo-name'),
  clearActive: document.getElementById('clear-active'),
};

const timer = createTimer();
const todoStore = createTodoStore({
  get: () => localStorage.getItem('todos'),
  set: (v) => localStorage.setItem('todos', v),
});

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
    if (events.some((e) => e.type === 'sessionCompleted')) {
      beep();
      const finishedWork = events.some((e) => e.type === 'sessionCompleted' && e.session === 'work');
      const current = activeTodo(todoStore);
      if (finishedWork && current) addPomodoro(todoStore, current.id);
    }
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

// ---- 待办清单 ----

function renderTodos() {
  const list = visibleTodos(todoStore);
  const { total, active } = counts(todoStore);
  els.todoCount.textContent = `${active} 项待办 / 共 ${total} 项`;

  const current = activeTodo(todoStore);
  els.activeTodo.hidden = !current;
  if (current) els.activeTodoName.textContent = current.text;

  els.todoList.textContent = '';
  if (list.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'todo-empty';
    empty.textContent = '暂无待办，添加一个开始专注吧';
    els.todoList.append(empty);
    return;
  }

  for (const todo of list) {
    const li = document.createElement('li');
    li.className = `todo-item${todo.done ? ' done' : ''}${current?.id === todo.id ? ' active' : ''}`;
    li.dataset.id = todo.id;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.done;
    checkbox.setAttribute('aria-label', `完成 ${todo.text}`);
    checkbox.addEventListener('change', () => {
      toggleTodo(todoStore, todo.id);
      if (todo.done && current?.id === todo.id) setActiveTodo(todoStore, null);
      renderTodos();
    });

    const label = document.createElement('span');
    label.className = 'todo-text';
    label.textContent = todo.text;
    label.title = '点击编辑';
    label.addEventListener('click', () => beginEdit(li, todo));

    const meta = document.createElement('span');
    meta.className = 'todo-meta';
    meta.textContent = todo.pomodoros ? '🍅'.repeat(Math.min(todo.pomodoros, 8)) : '';
    meta.title = `已完成 ${todo.pomodoros} 个番茄`;

    const focusBtn = document.createElement('button');
    focusBtn.className = 'icon-btn';
    focusBtn.type = 'button';
    focusBtn.textContent = current?.id === todo.id ? '⏸' : '🎯';
    focusBtn.title = current?.id === todo.id ? '取消关联专注' : '专注此任务';
    focusBtn.addEventListener('click', () => {
      setActiveTodo(todoStore, current?.id === todo.id ? null : todo.id);
      renderTodos();
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.type = 'button';
    delBtn.textContent = '✕';
    delBtn.setAttribute('aria-label', `删除 ${todo.text}`);
    delBtn.addEventListener('click', () => {
      deleteTodo(todoStore, todo.id);
      renderTodos();
    });

    li.append(checkbox, label, meta, focusBtn, delBtn);
    els.todoList.append(li);
  }
}

function beginEdit(li, todo) {
  const input = document.createElement('input');
  input.className = 'todo-edit';
  input.type = 'text';
  input.value = todo.text;
  input.maxLength = 100;
  input.setAttribute('aria-label', '编辑待办');
  li.replaceChild(input, li.querySelector('.todo-text'));
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
  const commit = () => {
    renameTodo(todoStore, todo.id, input.value);
    renderTodos();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') renderTodos();
  });
  input.addEventListener('blur', commit);
}

els.todoForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = els.todoInput.value;
  if (!text.trim()) return;
  addTodo(todoStore, text);
  els.todoInput.value = '';
  els.todoInput.focus();
  renderTodos();
});

els.todoFilters.addEventListener('click', (event) => {
  const btn = event.target.closest('.filter-btn');
  if (!btn) return;
  setFilter(todoStore, btn.dataset.filter);
  els.todoFilters.querySelectorAll('.filter-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.filter === todoStore.filter);
  });
  renderTodos();
});

els.clearDone.addEventListener('click', () => {
  clearDone(todoStore);
  renderTodos();
});

els.clearActive.addEventListener('click', () => {
  setActiveTodo(todoStore, null);
  renderTodos();
});

renderTodos();

// Deep-link a session via URL hash, e.g. index.html#shortBreak
const hashMode = location.hash.slice(1);
if (CYCLE.includes(hashMode)) jumpTo(hashMode);
else render();
rafId = requestAnimationFrame(loop);
