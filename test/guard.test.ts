import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { guard } from '../src/commands/guard.ts';

function inDir<T>(fn: () => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'ds-ops-guard-'));
  const prev = process.cwd();
  process.chdir(dir);
  try {
    return fn();
  } finally {
    process.chdir(prev);
    rmSync(dir, { recursive: true, force: true });
  }
}

test('guard on/off preserves other hooks and settings', () => {
  inDir(() => {
    mkdirSync('.claude', { recursive: true });
    writeFileSync(
      '.claude/settings.json',
      JSON.stringify({
        hooks: { PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo keep' }] }] },
        permissions: { allow: ['Read'] },
      }),
    );

    guard('on');
    let s = JSON.parse(readFileSync('.claude/settings.json', 'utf8'));
    assert.equal(s.hooks.PostToolUse.length, 2);
    assert.ok(
      s.hooks.PostToolUse.some((m: { hooks: { command: string }[] }) =>
        m.hooks.some((h) => h.command.includes('ds-ops-guard.mjs')),
      ),
    );
    assert.deepEqual(s.permissions.allow, ['Read']);

    guard('off');
    s = JSON.parse(readFileSync('.claude/settings.json', 'utf8'));
    assert.equal(s.hooks.PostToolUse.length, 1);
    assert.equal(s.hooks.PostToolUse[0].matcher, 'Bash');
    assert.deepEqual(s.permissions.allow, ['Read']);
  });
});

test('guard on is idempotent', () => {
  inDir(() => {
    guard('on');
    guard('on');
    const s = JSON.parse(readFileSync('.claude/settings.json', 'utf8'));
    const ours = s.hooks.PostToolUse.filter((m: { hooks: { command: string }[] }) =>
      m.hooks.some((h) => h.command.includes('ds-ops-guard.mjs')),
    );
    assert.equal(ours.length, 1);
  });
});
