#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { audit } from './commands/audit.ts';
import { scan } from './commands/scan.ts';
import { sweep } from './commands/sweep.ts';
import { loadConfig } from './config/load.ts';
import { KNOWN_TARGETS } from './rules/registry.ts';
import type { RuleTarget } from './rules/types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(HERE, '..', 'package.json'), 'utf8'));

const USAGE = `
ds-ops ${pkg.version} — audit, scaffold, and guardrail a design system from its code

  ds-ops audit <fixture-dir> [--target ${KNOWN_TARGETS.join('|')}] [--json] [--out <dir>] [--config <file>]
      Run every deterministic rule that speaks to <target>. Severity-ranked
      findings + scorecard ratios. No LLM, no network. Exit 1 on any finding.

  ds-ops sweep <fixture-dir> [--config <file>] [--out <dir>]
      Sweep the CIEDE2000 ΔE cutoff across the configured range. Emits the full
      curve. With --out, writes <label>.sweep.json + .md (a calibration row).

  ds-ops scan  <fixture-dir> [--config <file>]
      Quick look: taxonomy breakdown + palette clusters at the default ΔE.

  ds-ops watch
      Not implemented in v0. The drift guard is \`audit\` run continuously
      against a committed baseline.

A fixture-dir is a folder with a SOURCE.json and vendored token files.
`;

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

function has(argv: string[], name: string): boolean {
  return argv.includes(`--${name}`);
}

function main(argv: string[]): void {
  const [cmd, ...rest] = argv;
  const loaded = loadConfig(flag(rest, 'config'));
  const { config } = loaded;
  const positional = rest.filter((a, i) => !a.startsWith('--') && !rest[i - 1]?.startsWith('--'));

  switch (cmd) {
    case 'audit': {
      if (!positional[0]) throw new Error('audit needs a fixture-dir');
      const target = (flag(rest, 'target') ?? 'all') as RuleTarget | 'all';
      if (!KNOWN_TARGETS.includes(target)) {
        throw new Error(`unknown target '${target}'. one of: ${KNOWN_TARGETS.join(', ')}`);
      }
      if (loaded.source !== 'defaults') console.log(`  config: ${loaded.source}`);
      const report = audit(positional[0], {
        target,
        json: has(rest, 'json'),
        outDir: flag(rest, 'out'),
        config,
        severityOverrides: loaded.severityOverrides,
      });
      if (report.findings.length > 0) process.exitCode = 1;
      break;
    }
    case 'sweep': {
      if (!positional[0]) throw new Error('sweep needs a fixture-dir');
      sweep(positional[0], { outDir: flag(rest, 'out'), config });
      break;
    }
    case 'scan': {
      if (!positional[0]) throw new Error('scan needs a fixture-dir');
      scan(positional[0], config);
      break;
    }
    case 'watch':
      console.log('watch: not implemented in v0. See `ds-ops audit`.');
      break;
    case undefined:
    case '-h':
    case '--help':
      console.log(USAGE);
      break;
    default:
      console.error(`unknown command: ${cmd}`);
      console.log(USAGE);
      process.exitCode = 1;
  }
}

try {
  main(process.argv.slice(2));
} catch (err) {
  console.error(`\n  error: ${(err as Error).message}\n`);
  process.exitCode = 1;
}
