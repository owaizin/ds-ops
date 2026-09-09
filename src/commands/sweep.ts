import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cssCustomPropsAdapter } from '../adapters/css-custom-props.ts';
import type { Adapter } from '../adapters/types.ts';
import { type ColorPoint, clusterByDeltaE } from '../color/cluster.ts';
import { DEFAULT_CONFIG } from '../config/defaults.ts';
import type { DsOpsConfig } from '../config/schema.ts';
import { hashConfig } from '../config/schema.ts';
import { loadFixture } from '../core/fixture.ts';

const ADAPTERS: Adapter[] = [cssCustomPropsAdapter];

export type SweepPoint = { deltaE: number; clusters: number };
export type Plateau = { from: number; to: number; clusters: number; width: number };
export type SweepResult = {
  manifest: {
    tool: 'ds-ops';
    command: 'sweep';
    fixtureLabel: string;
    fixtureSha: string;
    adapter: string;
    configHash: string;
    ranAt: string;
  };
  distinctLiterals: number;
  shippedPrimitiveCount: number | null;
  curve: SweepPoint[];
  /** the curve never rises: a necessary condition for ΔE to be a sane merge metric here */
  monotoneNonIncreasing: boolean;
  /** every ΔE band (wider than one step) over which the cluster count holds — the raw shape, not a pick */
  plateaus: Plateau[];
  /** the widest plateau whose count is within 15% of what humans shipped, when ground truth is known */
  intentPlateau: Plateau | null;
  /** largest ΔE at which the machine still resolves at least `shippedPrimitiveCount` clusters */
  shippedRecoverableUpTo: number | null;
  /** plain-language read of the curve */
  verdict: string;
};

/**
 * The ΔE sweep. Emits the FULL curve, not just a chosen cutoff — including where
 * it fails to stabilise, because that is what tells you whether the metric is
 * well-behaved on a given palette. This is calibration row one.
 */
export function sweep(fixtureDir: string, opts: { outDir?: string; config?: DsOpsConfig } = {}): SweepResult {
  const config = opts.config ?? DEFAULT_CONFIG;
  const { meta, source } = loadFixture(fixtureDir);
  const adapter = ADAPTERS.find((a) => a.detect(source));
  if (!adapter) throw new Error(`no adapter recognises ${source.root}`);

  const values = adapter.extract(source, config).filter((v) => v.provenance.classification === 'color');
  const points: ColorPoint[] = dedupeByRaw(values);

  const { min, max, step } = config.sweep;
  const curve: SweepPoint[] = [];
  for (let d = min; d <= max + 1e-9; d = round(d + step)) {
    curve.push({ deltaE: round(d), clusters: clusterByDeltaE(points, d).length });
  }

  const monotone = isMonotoneNonIncreasing(curve);
  const plateaus = allPlateaus(curve, step);
  const shipped = meta.shippedPrimitiveCount;
  const intentPlateau =
    shipped != null
      ? (plateaus
          .filter((p) => Math.abs(p.clusters - shipped) <= shipped * 0.15)
          .sort((a, b) => b.width - a.width)[0] ?? null)
      : null;
  const shippedRecoverableUpTo = shipped != null ? lastDeltaEWithAtLeast(curve, shipped) : null;

  const verdict = readCurve({ monotone, plateaus, intentPlateau, shipped, shippedRecoverableUpTo, min, max });

  const result: SweepResult = {
    manifest: {
      tool: 'ds-ops',
      command: 'sweep',
      fixtureLabel: meta.label,
      fixtureSha: meta.fixtureSha,
      adapter: `${adapter.id}@${adapter.version}`,
      configHash: hashConfig(config),
      ranAt: new Date().toISOString(),
    },
    distinctLiterals: points.length,
    shippedPrimitiveCount: shipped,
    curve,
    monotoneNonIncreasing: monotone,
    plateaus,
    intentPlateau,
    shippedRecoverableUpTo,
    verdict,
  };

  printReport(result);

  if (opts.outDir) {
    mkdirSync(opts.outDir, { recursive: true });
    const slug = meta.label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    writeFileSync(join(opts.outDir, `${slug}.sweep.json`), `${JSON.stringify(result, null, 2)}\n`);
    writeFileSync(join(opts.outDir, `${slug}.sweep.md`), markdown(result));
    console.log(`\n  wrote ${slug}.sweep.json + .md to ${opts.outDir}`);
  }

  return result;
}

function printReport(r: SweepResult): void {
  console.log(`\n  Color palette check — ${r.manifest.fixtureLabel}`);
  console.log(`  We blur the colors together, a little more each row, and count how many are left.\n`);
  console.log(`  ${r.distinctLiterals} different colors to start`);
  if (r.shippedPrimitiveCount != null) {
    console.log(`  the team says their palette has ${r.shippedPrimitiveCount} colors`);
  }
  console.log('');

  const maxC = Math.max(...r.curve.map((p) => p.clusters));
  const inIntent = (d: number) =>
    r.intentPlateau != null && d >= r.intentPlateau.from && d <= r.intentPlateau.to;
  console.log('  blur   colors left');
  for (const p of r.curve) {
    const bar = '█'.repeat(Math.round((p.clusters / maxC) * 40));
    const mark = inIntent(p.deltaE) ? '  <- holds steady here' : '';
    console.log(`  ${p.deltaE.toFixed(2).padStart(5)}  ${String(p.clusters).padStart(3)}  ${bar}${mark}`);
  }

  console.log('');
  console.log(
    r.monotoneNonIncreasing
      ? '  The count only ever goes down as we blur harder — good, the method works on this palette.'
      : '  The count jumps around instead of only going down — this test is not reliable on this palette.',
  );
  if (r.plateaus.length) {
    console.log(`  Stretches where the count holds steady: ${r.plateaus.length}`);
    for (const p of r.plateaus) {
      console.log(`    ${p.clusters} colors, from blur ${p.from} to ${p.to}`);
    }
  }
  console.log('');
  console.log(`  What this tells us: ${r.verdict}`);
  console.log('');
}

function markdown(r: SweepResult): string {
  const rows = r.curve.map((p) => `| ${p.deltaE} | ${p.clusters} |`).join('\n');
  const plats = r.plateaus.length
    ? r.plateaus
        .map((p) => `  - ${p.clusters} clusters across ΔE ${p.from}–${p.to} (width ${p.width})`)
        .join('\n')
    : '  - none';
  return [
    `# ds-ops sweep — ${r.manifest.fixtureLabel}`,
    '',
    `- fixture: \`${r.manifest.fixtureSha}\``,
    `- adapter: \`${r.manifest.adapter}\``,
    `- config: \`${r.manifest.configHash}\``,
    `- ran: ${r.manifest.ranAt}`,
    `- distinct color literals: ${r.distinctLiterals}`,
    `- shipped primitive count: ${r.shippedPrimitiveCount ?? 'unknown'}`,
    `- monotone non-increasing: ${r.monotoneNonIncreasing ? 'yes' : 'no'}`,
    `- shipped count recoverable up to: ΔE ${r.shippedRecoverableUpTo ?? 'n/a'}`,
    '',
    '## plateaus',
    plats,
    '',
    `## verdict`,
    '',
    r.verdict,
    '',
    '## curve',
    '',
    '| ΔE | clusters |',
    '| --: | --: |',
    rows,
    '',
  ].join('\n');
}

function allPlateaus(curve: SweepPoint[], step: number): Plateau[] {
  const out: Plateau[] = [];
  let i = 0;
  while (i < curve.length) {
    let j = i;
    while (j + 1 < curve.length && curve[j + 1]?.clusters === curve[i]?.clusters) j++;
    const from = curve[i]?.deltaE ?? 0;
    const to = curve[j]?.deltaE ?? 0;
    const width = to - from;
    if (width > step + 1e-9) out.push({ from, to, clusters: curve[i]?.clusters ?? 0, width: round(width) });
    i = j + 1;
  }
  return out;
}

function lastDeltaEWithAtLeast(curve: SweepPoint[], n: number): number | null {
  let last: number | null = null;
  for (const p of curve) if (p.clusters >= n) last = p.deltaE;
  return last;
}

function isMonotoneNonIncreasing(curve: SweepPoint[]): boolean {
  for (let i = 1; i < curve.length; i++) {
    if ((curve[i]?.clusters ?? 0) > (curve[i - 1]?.clusters ?? 0)) return false;
  }
  return true;
}

function readCurve(x: {
  monotone: boolean;
  plateaus: Plateau[];
  intentPlateau: Plateau | null;
  shipped: number | null;
  shippedRecoverableUpTo: number | null;
  min: number;
  max: number;
}): string {
  if (!x.monotone)
    return "the count jumps around as we blur, so this test can't say anything reliable about this palette. Likely the same color is being counted twice, or the colors don't sit on a clean scale.";
  if (x.shipped == null)
    return `the count drops smoothly from ${x.plateaus.length ? 'a few steady stretches' : 'no steady stretch'} down. We don't know how many colors the team meant to have, so there's nothing to check it against — just record it.`;
  if (x.intentPlateau) {
    return `the tool's count matches the ${x.shipped} colors the team says they have, and it stays matched across a range of blur (${x.intentPlateau.from} to ${x.intentPlateau.to}). That's the fingerprint of a palette someone picked by hand. Healthy.`;
  }
  if (x.shippedRecoverableUpTo != null && x.shippedRecoverableUpTo <= x.min + 1e-9) {
    return `the ${x.shipped}-color palette only holds at almost zero blur. Any blur at all and colors start merging. The colors sit closer together than the eye can follow — either a tool generated the scale, or some steps are too fine to see.`;
  }
  return `the count passes through ${x.shipped} (near blur ${x.shippedRecoverableUpTo}) but doesn't pause there. The palette has no natural resting point at the number the team says they have.`;
}

function dedupeByRaw(values: { raw: string; provenance: { tokenName: string | null } }[]): ColorPoint[] {
  const seen = new Set<string>();
  const out: ColorPoint[] = [];
  for (const v of values) {
    const k = v.raw.replace(/\s+/g, ' ').trim();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ id: v.provenance.tokenName ?? k, raw: v.raw });
  }
  return out;
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;
