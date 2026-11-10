// Pure Pomodoro timer state machine — no DOM dependencies, fully unit-testable.

export const SESSIONS = {
  work: { label: '专注', duration: 25 * 60 },
  shortBreak: { label: '短休息', duration: 5 * 60 },
  longBreak: { label: '长休息', duration: 15 * 60 },
};

export const CYCLE = ['work', 'shortBreak', 'work', 'shortBreak', 'work', 'shortBreak', 'work', 'longBreak'];

export function createTimer() {
  return {
    sessionIndex: 0,          // index into CYCLE
    remaining: CYCLE[0] ? SESSIONS[CYCLE[0]].duration : 0,
    running: false,
    completedWorkSessions: 0, // finished work sessions ever
    cyclesCompleted: 0,       // full 4-work cycles completed
  };
}

export function currentSession(timer) {
  const type = CYCLE[timer.sessionIndex % CYCLE.length];
  return { type, ...SESSIONS[type] };
}

/** Advance the state machine by `seconds` elapsed seconds. Returns events fired. */
export function tick(timer, seconds) {
  const events = [];
  let left = seconds;
  while (left > 0 && timer.running) {
    const step = Math.min(left, timer.remaining);
    timer.remaining -= step;
    left -= step;
    if (timer.remaining === 0) {
      const finished = currentSession(timer).type;
      if (finished === 'work') {
        timer.completedWorkSessions += 1;
        if (CYCLE[(timer.sessionIndex + 1) % CYCLE.length] === 'longBreak') {
          timer.cyclesCompleted += 1;
          events.push({ type: 'cycleCompleted' });
        }
      }
      events.push({ type: 'sessionCompleted', session: finished });
      timer.sessionIndex = (timer.sessionIndex + 1) % CYCLE.length;
      timer.remaining = SESSIONS[CYCLE[timer.sessionIndex]].duration;
      events.push({ type: 'sessionStarted', session: CYCLE[timer.sessionIndex] });
    }
  }
  return events;
}

export function start(timer) {
  timer.running = true;
}

export function pause(timer) {
  timer.running = false;
}

export function toggle(timer) {
  timer.running = !timer.running;
}

export function reset(timer) {
  const fresh = createTimer();
  Object.assign(timer, fresh);
}

/** Skip to the next session without counting the current one as completed. */
export function skip(timer) {
  timer.sessionIndex = (timer.sessionIndex + 1) % CYCLE.length;
  timer.remaining = SESSIONS[CYCLE[timer.sessionIndex]].duration;
}

export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
