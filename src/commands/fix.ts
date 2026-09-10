import { readFileSync, writeFileSync } from 'node:fs';
import { cssCustomPropsAdapter } from '../adapters/css-custom-props.ts';
import { DEFAULT_CONFIG } from '../config/defaults.ts';
import type { DsOpsConfig } from '../config/schema.ts';
import { resolveSource } from '../core/source.ts';

/**
 * The "Execute" step of the loop (MAPE-K). Applies only the mechanical fixes
 * where the correct edit is provable from the code alone — no judgement, no LLM.
 *
 * v0: one fixer — `token/var-missing-fallback`. `var(--x)` becomes
 * `var(--x, <literal value of --x>)`. Behaviour is identical when `--x` is
 * defined and strictly safer when it is not. Any `var()` whose target resolves
 * to another reference, or is not defined in scope, is left alone.
 *
 * Dry-run by default. `--write` applies.
 */

type Edit = { file: string; line: number; from: string; to: string; token: string };

export function fix(targetPath: string, opts: { write?: boolean; config?: DsOpsConfig } = {}): Edit[] {
  const config = opts.config ?? DEFAULT_CONFIG;
  const { source } = resolveSource(targetPath);
  const values = cssCustomPropsAdapter.extract(source, config);

  // literal value of every token that holds one (not a reference, not a recipe part)
  const literal = new Map<string, string>();
  for (const v of values) {
    if (
      (v.provenance.classification === 'color' || v.provenance.classification === 'dimension') &&
      v.provenance.tokenName
    ) {
      literal.set(v.provenance.tokenName, v.raw.trim());
    }
  }

  const edits: Edit[] = [];
  for (const v of values) {
    if (v.provenance.classification !== 'reference') continue;
    for (const m of v.raw.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)) {
      const ref = m[1]!;
      const before = v.raw.slice(0, m.index).trimEnd();
      if (before.endsWith(',')) continue; // already a fallback slot
      const fallback = literal.get(ref);
      if (!fallback) continue; // target not a resolvable literal — skip
      edits.push({
        file: v.provenance.file,
        line: v.provenance.line,
        token: v.provenance.tokenName ?? '(inline)',
        from: m[0],
        to: `var(${ref}, ${fallback})`,
      });
    }
  }

  if (edits.length === 0) {
    console.log('\n  ds-loop fix — nothing mechanically fixable.\n');
    return edits;
  }

  console.log(
    `\n  ds-loop fix — ${edits.length} edit(s) ${opts.write ? '(writing)' : '(dry run — pass --write to apply)'}\n`,
  );
  const byFile = new Map<string, Edit[]>();
  for (const e of edits) {
    const abs = absOf(source.root, e.file);
    let arr = byFile.get(abs);
    if (!arr) {
      arr = [];
      byFile.set(abs, arr);
    }
    arr.push(e);
    console.log(`  ${e.file}:${e.line}  ${e.token}`);
    console.log(`    - ${e.from}`);
    console.log(`    + ${e.to}`);
  }

  if (opts.write) {
    for (const [abs, fileEdits] of byFile) {
      let text = readFileSync(abs, 'utf8');
      for (const e of fileEdits) {
        // first fallback-less occurrence of exactly this var() call
        text = text.replace(e.from, e.to);
      }
      writeFileSync(abs, text);
    }
    console.log(`\n  wrote ${byFile.size} file(s). Re-run \`ds-loop audit\` to confirm.\n`);
  }

  return edits;
}

function absOf(root: string, rel: string): string {
  return rel.startsWith('/') ? rel : `${root}/${rel}`;
}
