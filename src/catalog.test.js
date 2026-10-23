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
