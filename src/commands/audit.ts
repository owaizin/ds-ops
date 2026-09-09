import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cssCustomPropsAdapter } from '../adapters/css-custom-props.ts';
import type { Adapter } from '../adapters/types.ts';
import { DEFAULT_CONFIG } from '../config/defaults.ts';
import type { DsOpsConfig } from '../config/schema.ts';
import { hashConfig } from '../config/schema.ts';
import { loadFixture } from '../core/fixture.ts';
import { rulesForTarget } from '../rules/registry.ts';
import { type Finding, type RuleTarget, SEVERITY_ORDER } from '../rules/types.ts';

const ADAPTERS: Adapter[] = [cssCustomPropsAdapter];

export type AuditReport = {
  manifest: {
    tool: 'ds-ops';
    command: 'audit';
    target: string;
    fixtureLabel: string;
    fixtureSha: string;
    adapter: string;
    configHash: string;
    ranAt: string;
  };
  rulesRun: string[];
  findings: Finding[];
  /** ratios, not counts — a scorecard row that survives codebase growth */
  ratios: Record<string, number>;
  verdict: 'clean' | 'issues';
};

/**
 * One-shot deterministic audit. Runs every rule that speaks to `target`,
 * returns severity-ranked findings + scorecard ratios. No LLM, no network.
 */
export function audit(
  fixtureDir: string,
  opts: {
    target?: RuleTarget | 'all';
    json?: boolean;
    outDir?: string;
    config?: DsOpsConfig;
    severityOverrides?: Record<string, Finding['severity']>;
  } = {},
): AuditReport {
  const config = opts.config ?? DEFAULT_CONFIG;
  const overrides = opts.severityOverrides ?? {};
  const target = opts.target ?? 'all';
  const { meta, source } = loadFixture(fixtureDir);
  const adapter = ADAPTERS.find((a) => a.detect(source));
  if (!adapter) throw new Error(`no adapter recognises ${source.root}`);

  const values = adapter.extract(source, config);
  const colors = values.filter((v) => v.provenance.classification === 'color');
  const ctx = { meta, source, config, values, colors };

  const rules = rulesForTarget(target);
  const findings = rules
    .flatMap((r) => r.run(ctx))
    .map((f) => (overrides[f.ruleId] ? { ...f, severity: overrides[f.ruleId]! } : f))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const distinctColors = new Set(colors.map((v) => v.raw.replace(/\s+/g, ' ').trim().toLowerCase())).size;
  const ratios = {
    // 1.0 = every color written once. higher = more copy-pasted colors.
    'color-copies-ratio': round(colors.length / Math.max(distinctColors, 1)),
    // share of values the tool could not confidently sort out
    'unclear-values-share': round(
      values.filter((v) => v.provenance.classification === 'ambiguous').length / Math.max(values.length, 1),
    ),
    // problems found per check run
    'problems-per-check': round(findings.length / Math.max(rules.length, 1)),
  };

  const report: AuditReport = {
    manifest: {
      tool: 'ds-ops',
      command: 'audit',
      target,
      fixtureLabel: meta.label,
      fixtureSha: meta.fixtureSha,
      adapter: `${adapter.id}@${adapter.version}`,
      configHash: hashConfig(config),
      ranAt: new Date().toISOString(),
    },
    rulesRun: rules.map((r) => r.id),
    findings,
    ratios,
    verdict: findings.length === 0 ? 'clean' : 'issues',
  };

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }

  if (opts.outDir) {
    mkdirSync(opts.outDir, { recursive: true });
    const slug = meta.label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    writeFileSync(join(opts.outDir, `${slug}.audit.json`), `${JSON.stringify(report, null, 2)}\n`);
  }

  return report;
}

function printReport(r: AuditReport): void {
  const { manifest: m } = r;
  console.log(`\n  Design system check — ${m.fixtureLabel}  (looking at: ${m.target})`);
  console.log(`  ${r.rulesRun.length} checks run, using math only — no AI, no guessing`);
  console.log(`  version ${m.fixtureSha}\n`);

  if (r.findings.length === 0) {
    console.log('  No problems found.\n');
  } else {
    for (const f of r.findings) {
      const label = SEVERITY_LABEL[f.severity];
      console.log(`  [${label}]  ${f.summary}`);
      console.log(`    Where:  ${f.where}`);
      console.log(`    Fix:    ${f.fix}`);
      console.log(`    (check: ${f.ruleId})\n`);
    }
    const bySev = r.findings.reduce<Record<string, number>>((acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1;
      return acc;
    }, {});
    const parts = (['blocking', 'high', 'medium', 'low'] as const)
      .filter((s) => bySev[s])
      .map((s) => `${bySev[s]} ${SEVERITY_LABEL[s].toLowerCase()}`);
    console.log(`  ${r.findings.length} problem(s) — ${parts.join(', ')}`);
  }

  console.log('\n  Numbers to track over time (lower is better, except where noted):');
  console.log(
    `    ${String(r.ratios['color-copies-ratio']).padEnd(6)} colors written per unique color  (1.0 = none copy-pasted)`,
  );
  console.log(
    `    ${String(r.ratios['unclear-values-share']).padEnd(6)} share of values the tool couldn't sort out`,
  );
  console.log(`    ${String(r.ratios['problems-per-check']).padEnd(6)} problems found per check`);
  console.log('');
}

const SEVERITY_LABEL: Record<string, string> = {
  blocking: 'STOP',
  high: 'IMPORTANT',
  medium: 'SHOULD FIX',
  low: 'MINOR',
};

const round = (n: number) => Math.round(n * 1000) / 1000;
