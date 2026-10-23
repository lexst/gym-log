import test from 'node:test';
import assert from 'node:assert/strict';
import { warmupWeight, suggest, compare, isPr, nextDayId, parseNum, previous, combineSides, topReached, fmtClock, parsePattern, phaseAt } from './logic.js';

test('warm-up is half the weight, rounded down', () => {
  assert.equal(warmupWeight(65), 30);
  assert.equal(warmupWeight(120), 60);
  assert.equal(warmupWeight(55), 25);
  assert.equal(warmupWeight(12), 6);
});

test('suggests a step up only when all sets hit the top of the range', () => {
  const t = { sets: 2, repMin: 8, repMax: 10 };
  assert.deepEqual(suggest(t, { weight: 50, reps: [10, 10] }), { weight: 52.5, up: true });
  assert.deepEqual(suggest(t, { weight: 50, reps: [10, 9] }), { weight: 50, up: false });
  assert.deepEqual(suggest(t, { weight: 50, reps: [10] }), { weight: 50, up: false });
  assert.equal(suggest(t, null), null);
});

test('compares with the previous session', () => {
  assert.equal(compare({ weight: 120, reps: [8, 9] }, { weight: 120, reps: [8, 8] }), 'up');
  assert.equal(compare({ weight: 120, reps: [8, 8] }, { weight: 120, reps: [8, 8] }), 'same');
  assert.equal(compare({ weight: 115, reps: [10, 10] }, { weight: 120, reps: [8, 8] }), 'down');
  assert.equal(compare({ weight: 120, reps: [8, 8] }, null), 'new');
  assert.equal(compare({ weight: 120, reps: [null, null] }, null), null);
});

test('detects personal records and the previous session', () => {
  const ws = [
    { id: 'a', date: '2026-10-07', finished: true, entries: [{ exId: 'x', weight: 115, reps: [8, 8] }] },
    { id: 'b', date: '2026-10-22', finished: true, entries: [{ exId: 'x', weight: 120, reps: [8, 9] }] },
  ];
  assert.equal(isPr(ws, ws[1].entries[0], ws[1]), true);
  assert.equal(isPr(ws, ws[0].entries[0], ws[0]), false);
  assert.equal(previous(ws, 'x', { id: 'c', date: '2026-10-25' }).workoutId, 'b');
  assert.equal(previous(ws, 'x', ws[1]).workoutId, 'a');
});

test('next day follows the last finished one', () => {
  const days = [{ id: 'd1' }, { id: 'd2' }, { id: 'd3' }];
  assert.equal(nextDayId(days, []), 'd1');
  assert.equal(nextDayId(days, [{ dayId: 'd3', date: '2026-10-22', finished: true }]), 'd1');
  assert.equal(nextDayId(days, [{ dayId: 'd1', date: '2026-10-22', finished: true }]), 'd2');
});

test('parses comma decimals', () => {
  assert.equal(parseNum('32,5'), 32.5);
  assert.equal(parseNum(''), null);
});

test('one-sided sets count the weaker side', () => {
  assert.equal(combineSides(8, 7), 7);
  assert.equal(combineSides(null, 9), 9);
  assert.equal(combineSides(10, null), 10);
  assert.equal(combineSides(null, null), null);
});

test('top of the range is reached only when every set hits it', () => {
  assert.equal(topReached({ sets: 2, repMax: 10, reps: [10, 11] }), true);
  assert.equal(topReached({ sets: 2, repMax: 10, reps: [10, 9] }), false);
  assert.equal(topReached({ sets: 2, repMax: 10, reps: [10, null] }), false);
  assert.equal(topReached({ sets: 2, repMax: null, reps: [10, 10] }), false);
});

test('an exercise is compared with the same training day only', () => {
  const ws = [
    { id: 'a', dayId: 'd1', date: '2026-10-01', finished: true, entries: [{ exId: 'x', weight: 50, reps: [10, 10] }] },
    { id: 'b', dayId: 'd2', date: '2026-10-03', finished: true, entries: [{ exId: 'x', weight: 45, reps: [8, 8] }] },
    { id: 'c', dayId: 'd1', date: '2026-10-05', finished: true, entries: [{ exId: 'x', weight: 50, reps: [10, 9] }] },
  ];
  assert.equal(previous(ws, 'x', ws[2]).workoutId, 'a');
  assert.equal(previous(ws, 'x', ws[1]), null);
  assert.equal(previous(ws, 'x', { id: 'n', date: '2026-10-07', dayId: 'd2' }).workoutId, 'b');
  assert.equal(isPr(ws, ws[1].entries[0], ws[1]), false);
  assert.equal(previous(ws, 'x', { date: '2026-10-07' }).workoutId, 'c');
});

test('rest timer clock', () => {
  assert.equal(fmtClock(0), '0:00');
  assert.equal(fmtClock(95000), '1:35');
  assert.equal(fmtClock(180999), '3:00');
  assert.equal(fmtClock(-5), '0:00');
});

test('stretch intervals', () => {
  assert.deepEqual(parsePattern('30-10-30-10-30'), [30, 10, 30, 10, 30]);
  assert.deepEqual(parsePattern(' 45 / 15 '), [45, 15]);
  assert.equal(parsePattern('abc'), null);
  const p = [30, 10, 30];
  assert.deepEqual(phaseAt(p, 0), { i: 0, left: 30000, done: false });
  assert.deepEqual(phaseAt(p, 35000), { i: 1, left: 5000, done: false });
  assert.deepEqual(phaseAt(p, 40000), { i: 2, left: 30000, done: false });
  assert.equal(phaseAt(p, 70000).done, true);
});
