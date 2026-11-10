// Pure todo list state — no DOM dependencies, fully unit-testable.
// Todos are persisted by the caller (app.js) via a pluggable storage object.

export const FILTERS = { all: 'all', active: 'active', done: 'done' };

let nextId = 1;
export function createTodo(text, { id = `t${Date.now()}_${nextId++}`, pomodoros = 0 } = {}) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) throw new Error('Todo text must not be empty');
  return { id, text: trimmed, done: false, pomodoros, createdAt: Date.now() };
}

export function createTodoStore(storage = memoryStorage()) {
  return {
    todos: load(storage),
    filter: FILTERS.all,
    storage,
  };
}

export function save(store) {
  store.storage.set(JSON.stringify(store.todos));
}

function load(storage) {
  try {
    const raw = storage.get();
    if (!raw) return [];
    const todos = JSON.parse(raw);
    if (!Array.isArray(todos)) return [];
    return todos.filter((t) => t && typeof t.text === 'string');
  } catch {
    return [];
  }
}

/** Add a new todo at the top of the list. Returns the created todo. */
export function addTodo(store, text) {
  const todo = createTodo(text);
  store.todos.unshift(todo);
  save(store);
  return todo;
}

/** Toggle done state of the todo with `id`. Returns the updated todo or null. */
export function toggleTodo(store, id) {
  const todo = store.todos.find((t) => t.id === id);
  if (todo) {
    todo.done = !todo.done;
    save(store);
  }
  return todo ?? null;
}

/** Remove the todo with `id`. Returns true when a todo was removed. */
export function deleteTodo(store, id) {
  const before = store.todos.length;
  store.todos = store.todos.filter((t) => t.id !== id);
  const removed = store.todos.length < before;
  if (removed) save(store);
  return removed;
}

/** Rename the todo with `id`. Returns the updated todo or null. */
export function renameTodo(store, id, text) {
  const todo = store.todos.find((t) => t.id === id);
  if (todo) {
    const trimmed = String(text ?? '').trim();
    if (!trimmed) return null;
    todo.text = trimmed;
    save(store);
  }
  return todo ?? null;
}

/** Increment the pomodoro counter of the todo with `id`. Returns the todo or null. */
export function addPomodoro(store, id) {
  const todo = store.todos.find((t) => t.id === id);
  if (todo) {
    todo.pomodoros += 1;
    save(store);
  }
  return todo ?? null;
}

/** Set the id of the todo currently being focused; null clears it. */
export function setActiveTodo(store, id) {
  if (id !== null && !store.todos.some((t) => t.id === id)) return null;
  store.activeTodoId = id;
  return id;
}

export function activeTodo(store) {
  return store.todos.find((t) => t.id === store.activeTodoId) ?? null;
}

export function setFilter(store, filter) {
  if (!Object.values(FILTERS).includes(filter)) return store.filter;
  store.filter = filter;
  return filter;
}

/** Todos visible under the store's current filter. */
export function visibleTodos(store) {
  switch (store.filter) {
    case FILTERS.active: return store.todos.filter((t) => !t.done);
    case FILTERS.done: return store.todos.filter((t) => t.done);
    default: return store.todos;
  }
}

export function counts(store) {
  return {
    total: store.todos.length,
    active: store.todos.filter((t) => !t.done).length,
    done: store.todos.filter((t) => t.done).length,
  };
}

/** Remove completed todos. Returns the number removed. */
export function clearDone(store) {
  const before = store.todos.length;
  store.todos = store.todos.filter((t) => !t.done);
  const removed = before - store.todos.length;
  if (removed) save(store);
  return removed;
}

export function memoryStorage() {
  let value = null;
  return {
    get: () => value,
    set: (v) => { value = v; },
  };
}
