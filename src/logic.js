// Pure training logic: no storage, no UI. Covered by logic.test.js.

export function todayIso(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fmtDate(iso, withYear = true) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return withYear ? `${d}.${m}.${y.slice(2)}` : `${d}.${m}`;
}

export function daysAgo(iso, now = new Date()) {
  const a = new Date(iso + 'T00:00:00');
  const b = new Date(todayIso(now) + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

export function parseNum(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.').trim());
  return Number.isFinite(n) ? n : null;
}

export function fmtNum(n) {
  if (n === null || n === undefined || n === '') return '';
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

// Warm-up set is about half the working weight, rounded down
// (65 -> 30, 120 -> 60). Light weights round down to whole kilos.
export function warmupWeight(w) {
  if (!w) return null;
  const half = w / 2;
  return half >= 20 ? Math.floor(half / 5) * 5 : Math.floor(half);
}

// Epley estimate of a one-rep max.
export function e1rm(weight, reps) {
  if (!weight || !reps) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

// One-arm/one-leg sets: the weaker side counts for progression.
export function combineSides(l, r) {
  if (l == null) return r ?? null;
  if (r == null) return l;
  return Math.min(l, r);
}

export function doneReps(entry) {
  return (entry.reps || []).filter((r) => r !== null && r !== undefined && r > 0);
}

export function hasData(entry) {
  return doneReps(entry).length > 0;
}

export function bestE1rm(entry) {
  return Math.max(0, ...doneReps(entry).map((r) => e1rm(entry.weight, r)));
}

// All finished sessions of one exercise, oldest first. With dayId, only
// sessions of that training day: reps depend on what came before the
// exercise, so Tag 1 is compared with Tag 1 only.
export function history(workouts, exId, dayId) {
  const out = [];
  for (const w of workouts) {
    if (!w.finished || (dayId && w.dayId !== dayId)) continue;
    for (const entry of w.entries || []) {
      if (entry.exId === exId && hasData(entry)) out.push({ date: w.date, workoutId: w.id, entry });
    }
  }
  return out.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
}

// Most recent session of an exercise before a given workout (by date).
export function previous(workouts, exId, current) {
  const h = history(workouts, exId, current?.dayId).filter(
    (x) => x.workoutId !== current?.id && (!current?.date || x.date <= current.date),
  );
  return h.length ? h[h.length - 1] : null;
}

// Every working set reached the top of the rep range.
export function topReached(entry) {
  const reps = doneReps(entry);
  const sets = entry.sets || entry.reps?.length || 0;
  return !!entry.repMax && reps.length > 0 && reps.length >= sets && reps.every((r) => r >= entry.repMax);
}

// Double progression: once every working set reached the top of the
// rep range, suggest adding one weight step.
export function suggest(target, last, step = 2.5) {
  if (!last) return null;
  if (topReached({ ...last, sets: target.sets || last.reps?.length, repMax: target.repMax })) {
    return { weight: last.weight + step, up: true };
  }
  return { weight: last.weight, up: false };
}

// Result vs. the previous session: 'up', 'same', 'down' or 'new'.
export function compare(entry, prev) {
  if (!hasData(entry)) return null;
  if (!prev) return 'new';
  if (entry.weight > prev.weight) return 'up';
  if (entry.weight < prev.weight) return 'down';
  const a = doneReps(entry).reduce((s, r) => s + r, 0);
  const b = doneReps(prev).reduce((s, r) => s + r, 0);
  return a > b ? 'up' : a < b ? 'down' : 'same';
}

// A personal record beats the best estimated 1RM of all earlier sessions.
export function isPr(workouts, entry, workout) {
  if (!hasData(entry)) return false;
  const earlier = history(workouts, entry.exId, workout.dayId).filter(
    (x) => x.workoutId !== workout.id && x.date <= workout.date,
  );
  if (!earlier.length) return false;
  const best = Math.max(...earlier.map((x) => bestE1rm(x.entry)));
  return bestE1rm(entry) > best + 1e-9;
}

// The day after the last finished one, in program order.
export function nextDayId(days, workouts) {
  if (!days.length) return null;
  const last = workouts
    .filter((w) => w.finished)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.startedAt || 0) - (a.startedAt || 0)))[0];
  if (!last) return days[0].id;
  const i = days.findIndex((d) => d.id === last.dayId);
  return days[(i + 1) % days.length].id;
}
