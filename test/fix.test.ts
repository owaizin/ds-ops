import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fix } from '../src/commands/fix.ts';

function fixture(css: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'ds-loop-fix-'));
  mkdirSync(join(dir, 'css'));
  writeFileSync(join(dir, 'css', 't.css'), css);
  writeFileSync(
    join(dir, 'SOURCE.json'),
    JSON.stringify({
      label: 'f',
      upstream: 'x',
      fixtureSha: 'x',
      retrievedAt: 'x',
      path: 'css',
      shippedPrimitiveCount: null,
    }),
  );
  return dir;
}

test('fix: inserts fallback from the resolved literal, skips already-safe and unresolvable', () => {
  const dir = fixture(
    ':root{\n' +
      '  --p-blue: #2563eb;\n' +
      '  --ok: var(--p-blue);\n' + // fixable
      '  --safe: var(--p-blue, #2563eb);\n' + // already has a fallback
      '  --chain: var(--other);\n' + // --other undefined -> unresolvable
      '}\n',
  );
  try {
    const edits = fix(dir);
    assert.equal(edits.length, 1);
    assert.equal(edits[0]?.from, 'var(--p-blue)');
    assert.equal(edits[0]?.to, 'var(--p-blue, #2563eb)');

    fix(dir, { write: true });
    const after = readFileSync(join(dir, 'css', 't.css'), 'utf8');
    assert.ok(after.includes('--ok: var(--p-blue, #2563eb)'));
    assert.ok(after.includes('--safe: var(--p-blue, #2563eb)')); // untouched
    assert.ok(after.includes('--chain: var(--other)')); // untouched
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
