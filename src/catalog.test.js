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

test('Tag 2 refers to catalog exercises', async () => {
  const { TAG2_ITEMS, TAG2_EXTRA_EXERCISES } = await import('./catalog.js');
  const ids = new Set([
    ...CATALOG.flatMap(([, list]) => list.map((n) => 'cat-' + slug(n))),
    ...TAG2_EXTRA_EXERCISES.map((e) => e.id),
    'ex-beinpresse',
  ]);
  for (const it of TAG2_ITEMS) assert.ok(ids.has(it.exId), it.exId);
});
