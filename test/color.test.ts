import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clusterByDeltaE } from '../src/color/cluster.ts';
import { parseColor, toLab } from '../src/color/convert.ts';
import { ciede2000 } from '../src/color/delta-e.ts';

test('CIEDE2000 matches Sharma et al. supplementary test data', () => {
  const cases: [number[], number[], number][] = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425], // pair 1 — hue rotation term
    [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0], // pair 4
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644], // pair 34 — greys
    [[50, 2.5, 0], [73, 25, -18], 27.1492], // pair 25 — large difference
  ];
  for (const [a, b, expected] of cases) {
    const got = ciede2000({ L: a[0], a: a[1], b: a[2] }, { L: b[0], a: b[1], b: b[2] });
    assert.ok(Math.abs(got - expected) < 1e-3, `expected ${expected}, got ${got.toFixed(4)}`);
  }
});

test('identical colors are ΔE 0', () => {
  const l = toLab('#3b82f6');
  assert.ok(l);
  assert.equal(ciede2000(l, l), 0);
});

test('parses every storage form a design system uses', () => {
  assert.deepEqual(parseColor('#0f172a'), { r: 15, g: 23, b: 42, a: 1 });
  assert.deepEqual(parseColor('222.2 47.4% 11.2%')?.a, 1);
  assert.equal(parseColor('rgb(15 23 42)')?.g, 23);
  assert.equal(parseColor('hsla(222 47% 11% / 0.5)')?.a, 0.5);
  assert.equal(parseColor('not-a-color'), null);
});

test('clustering merges near-identical, splits distinct', () => {
  const points = [
    { id: 'a', raw: '#000000' },
    { id: 'b', raw: '#010101' }, // ~ΔE < 1 from a
    { id: 'c', raw: '#ffffff' },
  ];
  assert.equal(clusterByDeltaE(points, 2).length, 2);
  assert.equal(clusterByDeltaE(points, 0.1).length, 3);
});
