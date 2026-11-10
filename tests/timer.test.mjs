import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createTimer, tick, start, pause, toggle, reset, skip,
  currentSession, formatTime, SESSIONS, CYCLE,
} from '../js/timer.js';

test('new timer starts in work with full duration', () => {
  const t = createTimer();
  assert.equal(currentSession(t).type, 'work');
  assert.equal(t.remaining, SESSIONS.work.duration);
  assert.equal(t.running, false);
});

test('formatTime pads minutes and seconds', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(65), '01:05');
  assert.equal(formatTime(25 * 60), '25:00');
  assert.equal(formatTime(-5), '00:00');
});

test('tick does nothing while paused', () => {
  const t = createTimer();
  tick(t, 10);
  assert.equal(t.remaining, SESSIONS.work.duration);
});

test('tick decrements while running', () => {
  const t = createTimer();
  start(t);
  tick(t, 30);
  assert.equal(t.remaining, SESSIONS.work.duration - 30);
});

test('toggle flips running state', () => {
  const t = createTimer();
  toggle(t);
  assert.equal(t.running, true);
  toggle(t);
  assert.equal(t.running, false);
});

test('completing a work session emits events and moves to short break', () => {
  const t = createTimer();
  start(t);
  const events = tick(t, SESSIONS.work.duration + 5);
  assert.equal(currentSession(t).type, 'shortBreak');
  assert.equal(t.completedWorkSessions, 1);
  assert.equal(events.some((e) => e.type === 'sessionCompleted' && e.session === 'work'), true);
  assert.equal(events.some((e) => e.type === 'sessionStarted' && e.session === 'shortBreak'), true);
  assert.equal(t.remaining, SESSIONS.shortBreak.duration - 5);
});

test('long break only after 4 work sessions', () => {
  const t = createTimer();
  start(t);
  for (let i = 0; i < 3; i++) {
    tick(t, SESSIONS[CYCLE[t.sessionIndex]].duration);
    tick(t, SESSIONS[CYCLE[t.sessionIndex]].duration);
  }
  assert.equal(currentSession(t).type, 'work');
  tick(t, SESSIONS.work.duration);
  assert.equal(currentSession(t).type, 'longBreak');
  assert.equal(t.cyclesCompleted, 1);
  assert.equal(t.completedWorkSessions, 4);
});

test('reset restores initial state', () => {
  const t = createTimer();
  start(t);
  tick(t, 100);
  reset(t);
  assert.deepEqual(t, createTimer());
});

test('skip advances without counting completion', () => {
  const t = createTimer();
  skip(t);
  assert.equal(currentSession(t).type, 'shortBreak');
  assert.equal(t.completedWorkSessions, 0);
  assert.equal(t.remaining, SESSIONS.shortBreak.duration);
});
