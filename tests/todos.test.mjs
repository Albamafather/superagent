import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createTodoStore, addTodo, toggleTodo, deleteTodo, renameTodo,
  addPomodoro, setActiveTodo, activeTodo, setFilter, visibleTodos,
  counts, clearDone, FILTERS,
} from '../js/todos.js';

test('addTodo trims text and prepends', () => {
  const s = createTodoStore();
  const a = addTodo(s, '写周报');
  const b = addTodo(s, '  复习算法  ');
  assert.equal(b.text, '复习算法');
  assert.deepEqual(s.todos.map((t) => t.id), [b.id, a.id]);
  assert.equal(a.done, false);
  assert.equal(a.pomodoros, 0);
});

test('addTodo rejects empty text', () => {
  const s = createTodoStore();
  assert.throws(() => addTodo(s, '   '));
});

test('toggle and persistence round-trip', () => {
  const s = createTodoStore();
  const t = addTodo(s, '任务');
  toggleTodo(s, t.id);
  assert.equal(t.done, true);
  const raw = JSON.parse(s.storage.get());
  assert.equal(raw[0].done, true);
});

test('toggleTodo on unknown id returns null', () => {
  const s = createTodoStore();
  assert.equal(toggleTodo(s, 'nope'), null);
});

test('deleteTodo removes and persists', () => {
  const s = createTodoStore();
  const t = addTodo(s, '任务');
  assert.equal(deleteTodo(s, t.id), true);
  assert.deepEqual(s.todos, []);
  assert.equal(deleteTodo(s, t.id), false);
});

test('renameTodo updates text, rejects empty', () => {
  const s = createTodoStore();
  const t = addTodo(s, '旧');
  assert.equal(renameTodo(s, t.id, '新').text, '新');
  assert.equal(renameTodo(s, t.id, '  '), null);
});

test('pomodoro counter and active todo', () => {
  const s = createTodoStore();
  const t = addTodo(s, '任务');
  assert.equal(addPomodoro(s, t.id).pomodoros, 1);
  assert.equal(setActiveTodo(s, t.id), t.id);
  assert.equal(activeTodo(s).id, t.id);
  assert.equal(setActiveTodo(s, 'missing'), null);
  assert.equal(activeTodo(s).id, t.id);
  assert.equal(setActiveTodo(s, null), null);
  assert.equal(activeTodo(s), null);
});

test('filters and counts', () => {
  const s = createTodoStore();
  const a = addTodo(s, 'a');
  addTodo(s, 'b');
  toggleTodo(s, a.id);
  assert.deepEqual(counts(s), { total: 2, active: 1, done: 1 });
  setFilter(s, FILTERS.active);
  assert.deepEqual(visibleTodos(s).map((t) => t.text), ['b']);
  setFilter(s, FILTERS.done);
  assert.deepEqual(visibleTodos(s).map((t) => t.text), ['a']);
  setFilter(s, 'bogus');
  assert.equal(s.filter, FILTERS.done);
  assert.equal(visibleTodos(s).length, 1);
  setFilter(s, FILTERS.all);
  assert.equal(visibleTodos(s).length, 2);
});

test('clearDone removes only completed', () => {
  const s = createTodoStore();
  const a = addTodo(s, 'a');
  const b = addTodo(s, 'b');
  toggleTodo(s, a.id);
  assert.equal(clearDone(s), 1);
  assert.deepEqual(s.todos.map((t) => t.id), [b.id]);
});
