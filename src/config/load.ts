import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Severity } from '../rules/types.ts';
import { DEFAULT_CONFIG } from './defaults.ts';
import type { DsOpsConfig } from './schema.ts';
import { parseYamlLite } from './yaml-lite.ts';

/**
 * ds-ops reads its own JSON config, and — for interop — a
 * `.ds-ops-config.yml` in the Murphy Trueman `design-system-ops` format. A team
 * already running that skill pack points ds-ops at the same file: the `system:`
 * block seeds context, the `severity:` block maps onto ds-ops rule severities.
 */

const MURPHY_SEVERITY_TO_RULES: Record<string, string[]> = {
  hardcoded_color: ['color/semantic-holds-literal', 'color/mixed-storage-forms'],
  wrong_tier_reference: ['token/tier-leakage'],
  tier_leakage: ['token/tier-leakage'],
  naming_violation: ['token/semantic-name-describes-appearance'],
};

const LEVEL_MAP: Record<string, Severity> = {
  critical: 'blocking',
  high: 'high',
  medium: 'medium',
  low: 'low',
};

export type LoadedConfig = {
  config: DsOpsConfig;
  severityOverrides: Record<string, Severity>;
  system: Record<string, unknown> | null;
  source: string;
};

export function loadConfig(explicitPath: string | undefined, cwd = process.cwd()): LoadedConfig {
  if (explicitPath) {
    const raw = JSON.parse(readFileSync(explicitPath, 'utf8'));
    return {
      config: mergeConfig(raw),
      severityOverrides: raw.severityOverrides ?? {},
      system: raw.system ?? null,
      source: explicitPath,
    };
  }

  for (const name of ['.ds-ops-config.yml', '.ds-ops-config.yaml', 'ds-ops.config.json']) {
    const p = join(cwd, name);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, 'utf8');
    const parsed = (name.endsWith('.json') ? JSON.parse(text) : parseYamlLite(text)) as Record<
      string,
      unknown
    >;
    return {
      config: mergeConfig(parsed),
      severityOverrides: severityOverridesFrom(parsed),
      system: (parsed.system as Record<string, unknown>) ?? null,
      source: p,
    };
  }

  return { config: DEFAULT_CONFIG, severityOverrides: {}, system: null, source: 'defaults' };
}

function mergeConfig(user: Record<string, unknown>): DsOpsConfig {
  const u = user as Partial<DsOpsConfig>;
  return {
    clustering: { ...DEFAULT_CONFIG.clustering, ...u.clustering },
    taxonomy: { ...DEFAULT_CONFIG.taxonomy, ...u.taxonomy },
    sweep: { ...DEFAULT_CONFIG.sweep, ...u.sweep },
  };
}

function severityOverridesFrom(parsed: Record<string, unknown>): Record<string, Severity> {
  const out: Record<string, Severity> = { ...(parsed.severityOverrides as Record<string, Severity>) };
  const sev = parsed.severity as Record<string, string> | undefined;
  if (sev) {
    for (const [murphyKey, level] of Object.entries(sev)) {
      const mapped = LEVEL_MAP[level];
      const ruleIds = MURPHY_SEVERITY_TO_RULES[murphyKey];
      if (mapped && ruleIds) for (const id of ruleIds) out[id] = mapped;
    }
  }
  return out;
}
