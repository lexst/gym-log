import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, slug } from './catalog.js';

test('catalog ids are unique', () => {
  const ids = CATALOG.flatMap(([, list]) => list.map((n) => slug(n)));
  assert.equal(new Set(ids).size, ids.length);
});

test('slug handles umlauts', () => {
  assert.equal(slug('45° Beinpresse hohe Fußstellung'), '45-beinpresse-hohe-fussstellung');
  assert.equal(slug('Trizepsdrücken überkopf'), 'trizepsdruecken-ueberkopf');
});

test('Notion days refer to known exercises', async () => {
  const { NOTION_DAYS, NOTION_EXTRA_EXERCISES } = await import('./catalog.js');
  const ids = new Set([
    ...CATALOG.flatMap(([, list]) => list.map((n) => 'cat-' + slug(n))),
    ...NOTION_EXTRA_EXERCISES.map((e) => e.id),
    'ex-beinpresse',
    'ex-beinstrecker',
  ]);
  for (const [, items, w] of NOTION_DAYS) {
    for (const t of items) assert.ok(ids.has(t.exId), t.exId);
    assert.equal(w.entries.length, items.length);
  }
});

test('older Notion sessions have one result per planned exercise', async () => {
  const { NOTION_OLDER, NOTION_DAYS } = await import('./catalog.js');
  const ids = [...NOTION_OLDER, ...NOTION_DAYS.map(([, , w]) => w)].map((w) => w.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const w of NOTION_OLDER) for (const e of w.entries) assert.ok(e.weight > 0 && e.reps.length === e.sets, w.id);
});
