import { type ColorPoint, clusterByDeltaE } from '../color/cluster.ts';
import { toLab } from '../color/convert.ts';
import { ciede2000 } from '../color/delta-e.ts';
import type { Finding, Rule, RuleContext } from './types.ts';

function isPrimitive(tokenName: string | null, pattern: string): boolean {
  return tokenName != null && new RegExp(pattern, 'i').test(tokenName);
}

function normRaw(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * A named color has its value typed in directly instead of pointing at one of
 * the shared base colors. Now the same color lives in two places. Change one and
 * the other silently stays wrong.
 */
export const semanticLiteralRule: Rule = {
  id: 'color/semantic-holds-literal',
  title: 'A color is typed in by hand instead of pointing at a shared base color',
  targets: ['tokens', 'color'],
  run(ctx: RuleContext): Finding[] {
    const pattern = ctx.config.taxonomy.primitivePattern;
    const offenders = ctx.colors.filter((v) => !isPrimitive(v.provenance.tokenName, pattern));
    if (offenders.length === 0) return [];
    return [
      {
        ruleId: this.id,
        severity: 'high',
        summary: `${offenders.length} named color(s) have their value typed in directly instead of pointing at a shared base color`,
        where: offenders
          .slice(0, 8)
          .map((v) => `${v.provenance.tokenName} = ${v.raw} (${v.provenance.file}:${v.provenance.line})`)
          .join('; '),
        fix: 'Point each one at a base color instead — like `--button-bg: var(--palette-blue-600)`. If no base color matches, add one first. Why it matters: right now this color exists in two spots. Someone updates the base color, this one silently stays the old value.',
        data: {
          count: offenders.length,
          tokens: offenders.map((v) => v.provenance.tokenName),
        },
      },
    ];
  },
};

/**
 * The same exact color value is written out under two or more different names.
 * Nobody knows which name is the "real" one, and copies drift apart over time.
 */
export const literalDuplicateRule: Rule = {
  id: 'color/literal-duplicate-tokens',
  title: 'The same exact color is written out in several places',
  targets: ['tokens', 'color'],
  run(ctx: RuleContext): Finding[] {
    const byValue = new Map<string, string[]>();
    for (const v of ctx.colors) {
      const k = normRaw(v.raw);
      const names = byValue.get(k) ?? [];
      names.push(v.provenance.tokenName ?? '(inline)');
      byValue.set(k, names);
    }
    const dupes = [...byValue.entries()].filter(([, names]) => new Set(names).size > 1);
    if (dupes.length === 0) return [];
    const total = dupes.reduce((s, [, names]) => s + names.length, 0);
    return [
      {
        ruleId: this.id,
        severity: 'medium',
        summary: `${dupes.length} color value(s) are written out under ${total} different names`,
        where: dupes
          .slice(0, 6)
          .map(([val, names]) => `${val} <- ${[...new Set(names)].join(', ')}`)
          .join('; '),
        fix: 'Pick one name as the real one. Make the others point at it instead of repeating the value. Why it matters: these are copies. When the color needs to change, someone will update some of them and miss the rest.',
        data: { groups: dupes.map(([val, names]) => ({ value: val, tokens: [...new Set(names)] })) },
      },
    ];
  },
};

/**
 * Two base colors sit close enough that the eye cannot tell them apart. Either
 * an accidental duplicate, or a gradient step too fine to see.
 */
export const nearDuplicatePaletteRule: Rule = {
  id: 'color/near-duplicate-primitives',
  title: 'Two base colors are so close the eye cannot tell them apart',
  targets: ['tokens', 'color'],
  run(ctx: RuleContext): Finding[] {
    const pattern = ctx.config.taxonomy.primitivePattern;
    const prims = dedupe(
      ctx.colors
        .filter((v) => isPrimitive(v.provenance.tokenName, pattern))
        .map((v) => ({ id: v.provenance.tokenName ?? v.raw, raw: v.raw })),
    );
    const threshold = ctx.config.clustering.deltaE;
    const pairs: { a: string; b: string; deltaE: number }[] = [];
    const labs = prims.map((p) => toLab(p.raw));
    for (let i = 0; i < prims.length; i++) {
      for (let j = i + 1; j < prims.length; j++) {
        const li = labs[i];
        const lj = labs[j];
        if (!li || !lj) continue;
        const d = ciede2000(li, lj);
        if (d < threshold) pairs.push({ a: prims[i]!.id, b: prims[j]!.id, deltaE: round(d) });
      }
    }
    if (pairs.length === 0) return [];
    return [
      {
        ruleId: this.id,
        severity: 'low',
        summary: `${pairs.length} pair(s) of base colors are close enough that a person can't see the difference (color-distance under ${threshold})`,
        where: pairs
          .slice(0, 8)
          .map((p) => `${p.a} ≈ ${p.b} (distance ${p.deltaE.toFixed(1)})`)
          .join('; '),
        fix: 'Look at each pair. If they are two steps of the same gradient, leave them. If not, delete one and use the other everywhere. Why it matters: two colors nobody can tell apart are not two colors — they are one color plus a mistake waiting to happen.',
        data: { pairs },
      },
    ];
  },
};

/**
 * Colors in one file are written several different ways (#hex, rgb(), hsl()
 * channels). Every developer then has to remember which format each color uses.
 */
export const mixedColorFormRule: Rule = {
  id: 'color/mixed-storage-forms',
  title: 'Colors are written in several different formats',
  targets: ['tokens', 'color'],
  run(ctx: RuleContext): Finding[] {
    const forms = new Map<string, number>();
    for (const v of ctx.colors) {
      const f = classifyForm(v.raw);
      forms.set(f, (forms.get(f) ?? 0) + 1);
    }
    if (forms.size <= 1) return [];
    return [
      {
        ruleId: this.id,
        severity: 'medium',
        summary: `colors are written ${forms.size} different ways in the same file`,
        where: [...forms.entries()].map(([f, n]) => `${f}: ${n}`).join(', '),
        fix: 'Pick one format for every color and convert the rest. Why it matters: mixed formats mean every person editing a color has to first figure out which format that one uses. A paper cut on every line.',
        data: { forms: Object.fromEntries(forms) },
      },
    ];
  },
};

/**
 * Blur the colors together step by step. A palette a person chose by hand has a
 * clear stretch where the count holds steady. A machine-generated scale, or a
 * palette with steps too fine to see, does not.
 */
export const colorKneeRule: Rule = {
  id: 'color/no-intent-plateau',
  title: "The color palette doesn't look hand-picked",
  targets: ['color'],
  run(ctx: RuleContext): Finding[] {
    const shipped = ctx.meta.shippedPrimitiveCount;
    if (shipped == null) return [];
    const points = dedupe(ctx.colors.map((v) => ({ id: v.provenance.tokenName ?? v.raw, raw: v.raw })));
    const { min, max, step } = ctx.config.sweep;
    let plateauFrom: number | null = null;
    let plateauTo: number | null = null;
    let prev: number | null = null;
    let runStart = min;
    for (let d = min; d <= max + 1e-9; d = round(d + step)) {
      const c = clusterByDeltaE(points, d).length;
      if (prev != null && c === prev) {
        if (Math.abs(c - shipped) <= shipped * 0.15 && d - runStart >= step * 2) {
          plateauFrom = runStart;
          plateauTo = d;
        }
      } else {
        runStart = d;
      }
      prev = c;
    }
    if (plateauFrom != null) return []; // healthy — plateau found, no finding
    return [
      {
        ruleId: this.id,
        severity: 'low',
        summary: `as we blur the colors together, the count never settles near the ${shipped} colors you shipped`,
        where: `checked across the full range of blur amounts`,
        fix: 'If a person picked this palette by hand, the missing steady stretch means some colors sit closer than the eye can follow — check the light end of each color ramp for steps nobody can see. If a tool generated the scale, this is expected. Run `ds-ops sweep` to see the full picture.',
        data: { shipped, plateauFrom, plateauTo },
      },
    ];
  },
};

function classifyForm(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (s.startsWith('#')) return 'hex';
  if (/^-?\d*\.?\d+\s+-?\d*\.?\d+%\s+-?\d*\.?\d+%$/.test(s)) return 'hsl-channels';
  if (s.startsWith('rgb')) return 'rgb()';
  if (s.startsWith('hsl')) return 'hsl()';
  if (s.startsWith('oklch') || s.startsWith('lab') || s.startsWith('color(')) return 'modern';
  return 'other';
}

function dedupe(points: ColorPoint[]): ColorPoint[] {
  const seen = new Set<string>();
  const out: ColorPoint[] = [];
  for (const p of points) {
    const k = normRaw(p.raw);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;
