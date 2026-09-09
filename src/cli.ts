#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan } from './commands/scan.ts';
import { sweep } from './commands/sweep.ts';
import { DEFAULT_CONFIG } from './config/defaults.ts';
import type { DsOpsConfig } from './config/schema.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(HERE, '..', 'package.json'), 'utf8'));

const USAGE = `
ds-ops ${pkg.version} — audit, scaffold, and guardrail a design system from its code

  ds-ops scan  <fixture-dir> [--config <file>]
      One-shot audit. Taxonomy breakdown + palette clusters at the default ΔE.

  ds-ops sweep <fixture-dir> [--config <file>] [--out <dir>]
      Sweep the ΔE cutoff across the configured range. Emits the full curve.
      With --out, writes <label>.sweep.json + .md (a calibration row).

  ds-ops watch
      Not implemented in v0. The drift guard is the sweep/scan detector run
      continuously against a committed baseline.

A fixture-dir is a folder with a SOURCE.json and vendored token files.
`;

function loadConfig(path: string | undefined): DsOpsConfig {
  if (!path) return DEFAULT_CONFIG;
  const user = JSON.parse(readFileSync(path, 'utf8'));
  return {
    clustering: { ...DEFAULT_CONFIG.clustering, ...user.clustering },
    taxonomy: { ...DEFAULT_CONFIG.taxonomy, ...user.taxonomy },
    sweep: { ...DEFAULT_CONFIG.sweep, ...user.sweep },
  };
}

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

function main(argv: string[]): void {
  const [cmd, ...rest] = argv;
  const config = loadConfig(flag(rest, 'config'));
  const positional = rest.filter((a, i) => !a.startsWith('--') && !rest[i - 1]?.startsWith('--'));

  switch (cmd) {
    case 'scan': {
      if (!positional[0]) throw new Error('scan needs a fixture-dir');
      scan(positional[0], config);
      break;
    }
    case 'sweep': {
      if (!positional[0]) throw new Error('sweep needs a fixture-dir');
      sweep(positional[0], { outDir: flag(rest, 'out'), config });
      break;
    }
    case 'watch':
      console.log('watch: not implemented in v0. See `ds-ops sweep`.');
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
