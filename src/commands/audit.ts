import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cssCustomPropsAdapter } from '../adapters/css-custom-props.ts';
import type { Adapter } from '../adapters/types.ts';
import { DEFAULT_CONFIG } from '../config/defaults.ts';
import type { DsOpsConfig } from '../config/schema.ts';
import { hashConfig } from '../config/schema.ts';
import { changedFiles, resolveSource } from '../core/source.ts';
import { rulesForTarget } from '../rules/registry.ts';
import { type Finding, type RuleTarget, SEVERITY_ORDER, type Severity } from '../rules/types.ts';

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
  targetPath: string,
  opts: {
    target?: RuleTarget | 'all';
    json?: boolean;
    outDir?: string;
    config?: DsOpsConfig;
    severityOverrides?: Record<string, Finding['severity']>;
    /** limit the scan to these files (hook mode) */
    files?: string[];
    /** limit the scan to files changed vs this git ref */
    since?: string;
    /** drop findings weaker than this */
    minSeverity?: Severity;
    /** print nothing when there are no findings at or above minSeverity */
    quiet?: boolean;
  } = {},
): AuditReport {
  const config = opts.config ?? DEFAULT_CONFIG;
  const overrides = opts.severityOverrides ?? {};
  const ruleTarget = opts.target ?? 'all';

  const only = [...(opts.files ?? []), ...(opts.since ? changedFiles(opts.since) : [])];
  const { meta, source, live } = resolveSource(targetPath, { only: only.length ? only : undefined });
  const adapter = ADAPTERS.find((a) => a.detect(source));
  if (!adapter) {
    // no recognisable token files in scope — a clean no-op, not an error (hook mode)
    return emptyReport(ruleTarget, meta);
  }

  const values = adapter.extract(source, config);
  const colors = values.filter((v) => v.provenance.classification === 'color');
  const ctx = { meta, source, config, values, colors };

  const rules = rulesForTarget(ruleTarget);
  const minRank = opts.minSeverity ? SEVERITY_ORDER[opts.minSeverity] : Number.POSITIVE_INFINITY;
  const findings = rules
    .flatMap((r) => r.run(ctx))
    .map((f) => (overrides[f.ruleId] ? { ...f, severity: overrides[f.ruleId]! } : f))
    .filter((f) => SEVERITY_ORDER[f.severity] <= minRank)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const distinctColors = new Set(colors.map((v) => v.raw.replace(/\s+/g, ' ').trim().toLowerCase())).size;
  const ratios = {
    'literal-colors-per-distinct': round(colors.length / Math.max(distinctColors, 1)),
    'ambiguous-share': round(
      values.filter((v) => v.provenance.classification === 'ambiguous').length / Math.max(values.length, 1),
    ),
    'findings-per-rule': round(findings.length / Math.max(rules.length, 1)),
  };

  const report: AuditReport = {
    manifest: {
      tool: 'ds-ops',
      command: 'audit',
      target: ruleTarget,
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

  const silent = opts.quiet && findings.length === 0;
  if (!silent) {
    if (opts.json) console.log(JSON.stringify(report, null, 2));
    else printReport(report, { live });
  }

  if (opts.outDir) {
    mkdirSync(opts.outDir, { recursive: true });
    const slug = meta.label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    writeFileSync(join(opts.outDir, `${slug}.audit.json`), `${JSON.stringify(report, null, 2)}\n`);
  }

  return report;
}

function emptyReport(target: string, meta: { label: string; fixtureSha: string }): AuditReport {
  return {
    manifest: {
      tool: 'ds-ops',
      command: 'audit',
      target,
      fixtureLabel: meta.label,
      fixtureSha: meta.fixtureSha,
      adapter: 'none',
      configHash: '00000000',
      ranAt: new Date().toISOString(),
    },
    rulesRun: [],
    findings: [],
    ratios: {},
    verdict: 'clean',
  };
}

function printReport(r: AuditReport, opts: { live: boolean } = { live: false }): void {
  const { manifest: m } = r;
  const scope = opts.live ? 'live scan' : 'fixture';
  console.log(`\n  ds-ops audit — ${m.fixtureLabel}  ·  target: ${m.target}  ·  ${scope}`);
  console.log(`  version ${m.fixtureSha}   adapter ${m.adapter}   config ${m.configHash}`);
  console.log(`  ${r.rulesRun.length} rules run\n`);

  if (r.findings.length === 0) {
    console.log('  ✓ clean — no deterministic findings\n');
  } else {
    for (const f of r.findings) {
      console.log(`  [${f.severity.toUpperCase()}] ${f.ruleId}`);
      console.log(`    ${f.summary}`);
      console.log(`    where: ${f.where}`);
      console.log(`    fix:   ${f.fix}\n`);
    }
    const bySev = r.findings.reduce<Record<string, number>>((acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1;
      return acc;
    }, {});
    console.log(
      `  ${r.findings.length} findings — ` +
        `${bySev.blocking ?? 0} blocking · ${bySev.high ?? 0} high · ${bySev.medium ?? 0} medium · ${bySev.low ?? 0} low`,
    );
  }

  console.log('\n  scorecard ratios');
  for (const [k, v] of Object.entries(r.ratios)) console.log(`    ${k.padEnd(28)} ${v}`);
  console.log('');
}

const round = (n: number) => Math.round(n * 1000) / 1000;
