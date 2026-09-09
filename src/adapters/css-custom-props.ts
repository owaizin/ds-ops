import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { alphaOf, looksLikeColor } from '../color/convert.ts';
import type { DsOpsConfig } from '../config/schema.ts';
import type { RawValue, ValueClassification } from '../core/provenance.ts';
import type { Adapter, SourceRef } from './types.ts';

const ID = 'css-custom-props';
const VERSION = '0.1.0';

/**
 * Extracts `--token: value;` declarations from `.css` files.
 *
 * Handles the two conventions design systems actually use:
 *   --slate-9: #0f172a;                 (full color values — Radix, Primer)
 *   --brand-default: 222.2 47.4% 11.2%; (bare HSL channels — Tailwind convention, Cone)
 *
 * Values that are `var(...)` references are skipped: those are the semantic layer
 * pointing at primitives, not literals the analyzer can cluster.
 */
export const cssCustomPropsAdapter: Adapter = {
  id: ID,
  version: VERSION,

  detect(source: SourceRef): boolean {
    return listCssFiles(source.root).some((f) => /--[\w-]+\s*:/.test(readFileSync(f, 'utf8')));
  },

  extract(source: SourceRef, config: DsOpsConfig): RawValue[] {
    return extractWith(source, config.taxonomy);
  },
};

type Taxonomy = DsOpsConfig['taxonomy'];

const DECL = /(--[\w-]+)\s*:\s*([^;]+);/g;

export function extractWith(source: SourceRef, taxonomy: Taxonomy): RawValue[] {
  const out: RawValue[] = [];
  const files = source.only
    ? source.only.filter((f) => f.endsWith('.css') && existsSync(f))
    : listCssFiles(source.root);
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const rel = relative(source.root, file);
    const lines = text.split('\n');

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      DECL.lastIndex = 0;
      let m: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec loop
      while ((m = DECL.exec(line)) !== null) {
        const tokenName = m[1];
        const value = m[2].trim();
        const selector = findSelector(lines, li);

        const refs = [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map((r) => r[1]!);
        const base = {
          file: rel,
          line: li + 1,
          selector,
          property: tokenName,
          tokenName,
          fixtureSha: source.fixtureSha,
          adapterId: ID,
          adapterVersion: VERSION,
        };

        if (refs.length > 0) {
          // a reference declaration — the raw value is one or more var() calls.
          // kept (not skipped) so the tier rules can check reference direction.
          out.push({
            raw: value,
            refs,
            provenance: {
              ...base,
              classification: 'reference',
              reason: `references ${refs.length} token(s): ${refs.join(', ')}`,
            },
          });
          continue;
        }

        const { classification, reason } = classify(tokenName, value, taxonomy);
        if (classification === 'excluded' && reason === 'not a color value') continue;

        out.push({
          raw: value,
          provenance: { ...base, classification, reason },
        });
      }
    }
  }
  return out;
}

function classify(
  tokenName: string,
  value: string,
  taxonomy: Taxonomy,
): { classification: ValueClassification; reason: string } {
  const name = tokenName.toLowerCase();

  if (taxonomy.nonColorTokenHints.some((h) => name.includes(h))) {
    return { classification: 'excluded', reason: `token name matches non-color hint` };
  }

  const isColor = looksLikeColor(value);
  const shadowByName = taxonomy.shadowTokenHints.some((h) => name.includes(h));

  if (!isColor) {
    // a bare number triple with % is an HSL channel color; anything else is not
    return { classification: 'excluded', reason: 'not a color value' };
  }

  if (shadowByName) {
    return {
      classification: 'shadow-internal',
      reason: `token name matches shadow hint — color is part of an elevation recipe, not a palette entry`,
    };
  }

  const a = alphaOf(value);
  if (a <= taxonomy.shadowAlphaCeiling) {
    return {
      classification: 'ambiguous',
      reason: `alpha ${a} <= ceiling ${taxonomy.shadowAlphaCeiling}: likely a shadow/overlay tint, but token name does not confirm it`,
    };
  }

  return { classification: 'color', reason: 'opaque color value on a non-shadow token' };
}

function findSelector(lines: string[], lineIdx: number): string | null {
  const before = lines.slice(0, lineIdx + 1).join('\n');
  const lastOpen = before.lastIndexOf('{');
  if (lastOpen === -1) return null;
  const head = before.slice(0, lastOpen);
  const m = head.match(/([.#:\[\]\w-]+(?:\s*,\s*[.#:\[\]\w-]+)*)\s*$/);
  return m ? m[1].trim() : null;
}

function listCssFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      const full = join(dir, entry);
      const s = statSync(full);
      if (s.isDirectory()) walk(full);
      else if (entry.endsWith('.css')) out.push(full);
    }
  };
  try {
    if (statSync(root).isDirectory()) walk(root);
    else if (root.endsWith('.css')) out.push(root);
  } catch {
    /* missing path — return empty */
  }
  return out.sort();
}
