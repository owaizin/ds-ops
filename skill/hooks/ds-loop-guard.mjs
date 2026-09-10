#!/usr/bin/env node
/**
 * ds-loop guard hook (PostToolUse).
 *
 * Reads the Claude Code hook payload from stdin, and if the edited file is a
 * style file, runs `ds-loop audit` scoped to that one file. High-severity
 * findings are printed to stderr with exit code 2 so the agent sees them as
 * feedback. Anything below `high`, or a clean result, exits 0 silently — the
 * hook must be quiet on every ordinary save.
 *
 * It never blocks: a PostToolUse hook fires after the edit already landed.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/cli.ts');
const STYLE = /\.(css|scss|sass)$/i;

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

const payload = readStdin();
const filePath =
  payload?.tool_input?.file_path ?? payload?.tool_input?.path ?? payload?.tool_response?.filePath ?? '';
const cwd = payload?.cwd ?? process.cwd();

if (!filePath || !STYLE.test(filePath)) process.exit(0);

const res = spawnSync(
  process.execPath,
  [
    '--experimental-strip-types',
    '--no-warnings',
    CLI,
    'audit',
    cwd,
    '--files',
    filePath,
    '--min-severity',
    'high',
    '--quiet',
    '--json',
  ],
  { encoding: 'utf8', cwd, timeout: 15_000 },
);

const out = (res.stdout || '').trim();
if (!out) process.exit(0);

let report;
try {
  report = JSON.parse(out);
} catch {
  process.exit(0);
}

const findings = report.findings ?? [];
if (findings.length === 0) process.exit(0);

const lines = findings.map(
  (f) => `  • [${String(f.severity).toUpperCase()}] ${f.summary}\n    ${f.where}\n    fix: ${f.fix}`,
);
process.stderr.write(
  `ds-loop guard — the edit to ${filePath.split('/').pop()} introduced ${findings.length} design-system issue(s):\n\n${lines.join('\n\n')}\n`,
);
process.exit(2);
