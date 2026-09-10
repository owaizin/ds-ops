import { cssCustomPropsAdapter } from '../adapters/css-custom-props.ts';
import type { Adapter } from '../adapters/types.ts';
import { type ColorPoint, clusterByDeltaE } from '../color/cluster.ts';
import { DEFAULT_CONFIG } from '../config/defaults.ts';
import type { DsOpsConfig } from '../config/schema.ts';
import { hashConfig } from '../config/schema.ts';
import type { RawValue } from '../core/provenance.ts';
import { resolveSource } from '../core/source.ts';

const ADAPTERS: Adapter[] = [cssCustomPropsAdapter];

/**
 * One-shot audit at t=0. Reports the *shape* of the data, not the answer —
 * the answer to "how many colors" comes from `sweep`, not from the uncalibrated
 * default ΔE this uses.
 */
export function scan(fixtureDir: string, config: DsOpsConfig = DEFAULT_CONFIG): void {
  const { meta, source } = resolveSource(fixtureDir);
  const adapter = ADAPTERS.find((a) => a.detect(source));
  if (!adapter) throw new Error(`no adapter recognises ${source.root}`);

  const values = adapter.extract(source, config);

  const byClass = groupBy(values, (v) => v.provenance.classification);
  const colors = byClass.color ?? [];
  const ambiguous = byClass.ambiguous ?? [];
  const shadowInternal = byClass['shadow-internal'] ?? [];
  const excluded = byClass.excluded ?? [];

  const points: ColorPoint[] = dedupeByRaw(colors).map((v) => ({
    id: v.provenance.tokenName ?? v.raw,
    raw: v.raw,
  }));
  const clusters = clusterByDeltaE(points, config.clustering.deltaE);

  console.log(`\n  ds-loop scan — ${meta.label}`);
  console.log(
    `  fixture ${meta.fixtureSha}   adapter ${adapter.id}@${adapter.version}   config ${hashConfig(config)}\n`,
  );

  console.log('  Taxonomy');
  console.log(`    color            ${colors.length}`);
  console.log(`    shadow-internal  ${shadowInternal.length}  (excluded from palette)`);
  console.log(`    ambiguous        ${ambiguous.length}  (needs a human)`);
  console.log(`    excluded         ${excluded.length}`);

  if (ambiguous.length) {
    console.log('\n  Ambiguous — classify these before trusting the count:');
    for (const v of ambiguous) {
      console.log(`    ${v.provenance.tokenName ?? '(inline)'}  =  ${v.raw}`);
      console.log(`      ${v.provenance.file}:${v.provenance.line} — ${v.provenance.reason}`);
    }
  }

  console.log(`\n  Palette at ΔE ${config.clustering.deltaE} (UNCALIBRATED default)`);
  console.log(`    ${points.length} distinct literals  ->  ${clusters.length} clusters`);
  if (meta.shippedPrimitiveCount != null) {
    const delta = clusters.length - meta.shippedPrimitiveCount;
    console.log(
      `    humans shipped ${meta.shippedPrimitiveCount} primitives  (machine ${delta >= 0 ? '+' : ''}${delta})`,
    );
  }
  console.log('    run `ds-loop sweep` to find the ΔE where the cluster count matches intent.\n');
}

function groupBy<T>(xs: T[], key: (x: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const x of xs) {
    const k = key(x);
    const bucket = out[k] ?? [];
    bucket.push(x);
    out[k] = bucket;
  }
  return out;
}

function dedupeByRaw(values: RawValue[]): RawValue[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    const k = v.raw.replace(/\s+/g, ' ').trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
