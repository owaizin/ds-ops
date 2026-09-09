import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import type { SourceRef } from '../adapters/types.ts';

/**
 * A fixture is a vendored, frozen snapshot of one source's token files plus a
 * SOURCE.json recording exactly what was copied and from where. Snapshots (not
 * live checkouts) are what make a calibration row comparable across runs and a
 * writeup reproducible by a reader.
 */
export type FixtureMeta = {
  label: string;
  upstream: string;
  /** package@version or git SHA — whatever pins the snapshot */
  fixtureSha: string;
  retrievedAt: string;
  /** subpath within the fixture dir that holds the token files */
  path: string;
  /** ground truth, when known: how many primitive palette entries the humans actually shipped */
  shippedPrimitiveCount: number | null;
  notes?: string;
};

export function loadFixture(dir: string): { meta: FixtureMeta; source: SourceRef } {
  const root = isAbsolute(dir) ? dir : resolve(process.cwd(), dir);
  const metaPath = join(root, 'SOURCE.json');
  if (!existsSync(metaPath)) {
    throw new Error(`fixture ${root} has no SOURCE.json — every fixture must record its upstream + SHA`);
  }
  const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as FixtureMeta;
  return {
    meta,
    source: {
      root: join(root, meta.path),
      fixtureSha: meta.fixtureSha,
      label: meta.label,
    },
  };
}
