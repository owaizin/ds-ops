import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cssCustomPropsAdapter } from '../adapters/css-custom-props.ts';
import type { Adapter } from '../adapters/types.ts';
import { type ColorPoint, clusterByDeltaE } from '../color/cluster.ts';
import { DEFAULT_CONFIG } from '../config/defaults.ts';
import type { DsOpsConfig } from '../config/schema.ts';
import { hashConfig } from '../config/schema.ts';
import { resolveSource } from '../core/source.ts';

const ADAPTERS: Adapter[] = [cssCustomPropsAdapter];

export type SweepPoint = { deltaE: number; clusters: number };
export type Plateau = { from: number; to: number; clusters: number; width: number };
export type SweepResult = {
  manifest: {
    tool: 'ds-loop';
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
  const { meta, source } = resolveSource(fixtureDir);
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
      tool: 'ds-loop',
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
  console.log(`\n  ds-loop sweep — ${r.manifest.fixtureLabel}`);
  console.log(
    `  fixture ${r.manifest.fixtureSha}   adapter ${r.manifest.adapter}   config ${r.manifest.configHash}\n`,
  );
  console.log(`  ${r.distinctLiterals} distinct color literals`);
  if (r.shippedPrimitiveCount != null) console.log(`  humans shipped ${r.shippedPrimitiveCount} primitives`);
  console.log('');

  const maxC = Math.max(...r.curve.map((p) => p.clusters));
  const inIntent = (d: number) =>
    r.intentPlateau != null && d >= r.intentPlateau.from && d <= r.intentPlateau.to;
  for (const p of r.curve) {
    const bar = '█'.repeat(Math.round((p.clusters / maxC) * 40));
    const mark = inIntent(p.deltaE) ? '  <- intent plateau' : '';
    console.log(`  ΔE ${p.deltaE.toFixed(2).padStart(6)}  ${String(p.clusters).padStart(3)}  ${bar}${mark}`);
  }

  console.log('');
  console.log(
    `  monotone non-increasing: ${r.monotoneNonIncreasing ? 'yes' : 'NO — ΔE is not a sane merge metric here'}`,
  );
  console.log(`  plateaus (width > 1 step): ${r.plateaus.length}`);
  for (const p of r.plateaus)
    console.log(
      `    ${String(p.clusters).padStart(3)} clusters  ΔE ${p.from}–${p.to}  (width ${p.width.toFixed(2)})`,
    );
  if (r.shippedRecoverableUpTo != null) {
    console.log(
      `  shipped count of ${r.shippedPrimitiveCount} still resolves up to ΔE ${r.shippedRecoverableUpTo}`,
    );
  }
  console.log('');
  console.log(`  verdict: ${r.verdict}`);
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
    `# ds-loop sweep — ${r.manifest.fixtureLabel}`,
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
    return 'curve is not monotone — clustering is unstable on this palette; ΔE is the wrong metric here or the extractor is double-counting.';
  if (x.shipped == null)
    return `monotone collapse from the literal count down. ${x.plateaus.length} plateau(s). No ground truth to locate a cutoff — record and move on.`;
  if (x.intentPlateau) {
    return `the machine's palette agrees with the ${x.shipped} humans shipped across ΔE ${x.intentPlateau.from}–${x.intentPlateau.to}: that band is the defensible cutoff for this source.`;
  }
  if (x.shippedRecoverableUpTo != null && x.shippedRecoverableUpTo <= x.min + 1e-9) {
    return `no knee at the human count. The ${x.shipped}-entry palette only survives at ΔE ${x.min} (the sweep floor) — every step above that merges neighbours. This palette is built perceptually tighter than one JND; the human number is a design choice the metric cannot recover.`;
  }
  return `no plateau sits at the ${x.shipped} humans shipped. The count passes through ${x.shipped} near ΔE ${x.shippedRecoverableUpTo} without holding — the palette has no natural knee there.`;
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
