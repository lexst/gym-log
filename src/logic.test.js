import test from 'node:test';
import assert from 'node:assert/strict';
import { warmupWeight, suggest, compare, isPr, nextDayId, parseNum, previous, combineSides } from './logic.js';

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
