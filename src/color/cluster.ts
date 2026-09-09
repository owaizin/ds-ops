import { toLab } from './convert.ts';
import { ciede2000 } from './delta-e.ts';

export type ColorPoint = {
  /** stable identity — usually the token name */
  id: string;
  /** value as authored */
  raw: string;
};

export type Cluster = {
  members: ColorPoint[];
  /** the member closest to the cluster centroid in Lab, used as the representative */
  representative: ColorPoint;
};

/**
 * Single-linkage agglomerative clustering == connected components of the graph
 * where an edge exists between two colors with ΔE < threshold.
 *
 * Single-linkage is the right choice here: two swatches a designer considers
 * "the same" should merge even if the chain between them is long (a subtle ramp
 * step). The cost is chaining across a gradient; the `sweep` curve is exactly how
 * we detect when that starts happening.
 */
export function clusterByDeltaE(points: ColorPoint[], threshold: number): Cluster[] {
  const labs = points.map((p) => toLab(p.raw));
  const parent = points.map((_, i) => i);

  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (i: number, j: number) => {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) parent[ri] = rj;
  };

  for (let i = 0; i < points.length; i++) {
    const li = labs[i];
    if (!li) continue;
    for (let j = i + 1; j < points.length; j++) {
      const lj = labs[j];
      if (!lj) continue;
      if (ciede2000(li, lj) < threshold) union(i, j);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < points.length; i++) {
    const r = find(i);
    const g = groups.get(r) ?? [];
    g.push(i);
    groups.set(r, g);
  }

  return [...groups.values()].map((idxs) => {
    const members = idxs.map((i) => points[i]);
    const memberLabs = idxs.map((i) => labs[i]).filter((l): l is NonNullable<typeof l> => l != null);
    const centroid = {
      L: mean(memberLabs.map((l) => l.L)),
      a: mean(memberLabs.map((l) => l.a)),
      b: mean(memberLabs.map((l) => l.b)),
    };
    let rep = members[0];
    let best = Number.POSITIVE_INFINITY;
    for (const i of idxs) {
      const l = labs[i];
      if (!l) continue;
      const d = ciede2000(l, centroid);
      if (d < best) {
        best = d;
        rep = points[i];
      }
    }
    return { members, representative: rep };
  });
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
