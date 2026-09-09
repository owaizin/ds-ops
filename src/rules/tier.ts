import type { DsOpsConfig } from '../config/schema.ts';
import type { Finding, Rule, RuleContext } from './types.ts';

export type Tier = 'primitive' | 'semantic' | 'component' | 'unknown';

/**
 * The three-tier model (primitive → semantic → component). Reference direction
 * is strictly downward: component tokens reference semantic tokens, semantic
 * tokens reference primitives. Anything else is tier leakage.
 *
 * Tier detection is by name convention and therefore a judgment call about the
 * target — every pattern is config (`taxonomy.*Pattern`, `semanticNamespaces`).
 */
export function classifyTier(tokenName: string | null, cfg: DsOpsConfig): Tier {
  if (!tokenName) return 'unknown';
  const name = tokenName.toLowerCase();
  const t = cfg.taxonomy;
  // order matters: a token in a semantic namespace (--ns-color-bg-skeleton) is
  // semantic even though "skeleton" is a widget word. Component tokens name the
  // widget right after the --ns- prefix (--ns-button-padding).
  if (new RegExp(t.primitivePattern, 'i').test(name)) return 'primitive';
  const stripped = name.replace(/^--[a-z0-9]+-/i, ''); // drop the --ns- prefix
  if (t.semanticNamespaces.some((ns) => stripped.startsWith(`${ns}-`) || stripped === ns)) {
    return 'semantic';
  }
  if (new RegExp(t.componentPattern, 'i').test(name)) return 'component';
  return 'unknown';
}

const RANK: Record<Tier, number> = { primitive: 0, semantic: 1, component: 2, unknown: -1 };

/** allowed: strictly one tier down, or same-tier aliasing */
function isAllowedReference(from: Tier, to: Tier): boolean {
  if (from === 'unknown' || to === 'unknown') return true; // can't judge
  if (from === to) return true; // aliasing within a tier is fine
  return RANK[from] - RANK[to] === 1; // exactly one step down
}

/**
 * Design values are stacked in three levels: raw values (the paint cans) →
 * named jobs (the labels) → part rules (this button). Each level should only
 * reach one level down. When a part rule reaches past its label straight to a
 * paint can, the color is right but a re-theme or rebrand will not reach it.
 */
export const tierLeakageRule: Rule = {
  id: 'token/tier-leakage',
  title: 'A part rule skips its label and grabs a raw value directly',
  targets: ['tokens', 'color', 'spacing', 'typography', 'elevation', 'motion'],
  run(ctx: RuleContext): Finding[] {
    const refs = ctx.values.filter((v) => v.provenance.classification === 'reference' && v.refs);
    const leaks: { token: string; tier: Tier; target: string; targetTier: Tier; where: string }[] = [];
    for (const v of refs) {
      const from = classifyTier(v.provenance.tokenName, ctx.config);
      for (const target of v.refs ?? []) {
        const to = classifyTier(target, ctx.config);
        if (!isAllowedReference(from, to)) {
          leaks.push({
            token: v.provenance.tokenName ?? '(inline)',
            tier: from,
            target,
            targetTier: to,
            where: `${v.provenance.file}:${v.provenance.line}`,
          });
        }
      }
    }
    if (leaks.length === 0) return [];
    const skips = leaks.filter((l) => l.tier === 'component' && l.targetTier === 'primitive');
    return [
      {
        ruleId: this.id,
        severity: 'high',
        summary: `${leaks.length} place(s) where a value reaches to the wrong level${skips.length ? ` (${skips.length} part rules grab a raw value directly, skipping the label)` : ''}`,
        where: leaks
          .slice(0, 8)
          .map((l) => `${l.token} (${l.tier}) → ${l.target} (${l.targetTier}) at ${l.where}`)
          .join('; '),
        fix: 'Make each part rule point at a named job, and each named job point at a raw value. If no named job fits, add one. Why it matters: when the client rebrands, the new colors flow through the named jobs. Anything wired straight to a raw value gets left on the old brand.',
        data: { count: leaks.length, tierSkips: skips.length, leaks: leaks.slice(0, 40) },
      },
    ];
  },
};

/**
 * A "named job" color is named for how it looks (`action-blue`) instead of what
 * it is for (`action-primary`). Then the day the button turns green, the name
 * is a lie. The colored-name is only right on category / chart tokens, where the
 * color IS the meaning.
 */
export const semanticAppearanceNameRule: Rule = {
  id: 'token/semantic-name-describes-appearance',
  title: 'A named color is named for how it looks, not what it is for',
  targets: ['tokens', 'color'],
  run(ctx: RuleContext): Finding[] {
    const reserved = ctx.config.taxonomy.reservedSemanticTerms.map((t) => t.toLowerCase());
    const hits: { token: string; term: string; category: boolean }[] = [];
    const seen = new Set<string>();
    for (const v of ctx.values) {
      const name = v.provenance.tokenName;
      if (!name || seen.has(name)) continue;
      if (classifyTier(name, ctx.config) !== 'semantic') continue;
      const lower = name.toLowerCase();
      const term = reserved.find((t) => new RegExp(`(^|-)${t}(-|$)`).test(lower));
      if (term) {
        seen.add(name);
        hits.push({ token: name, term, category: /(^|-)category(-|$)/.test(lower) });
      }
    }
    if (hits.length === 0) return [];
    const categoryOnly = hits.every((h) => h.category);
    return [
      {
        ruleId: this.id,
        severity: categoryOnly ? 'low' : 'medium',
        summary: `${hits.length} named color(s) have a color word baked into the name`,
        where: hits
          .slice(0, 8)
          .map((h) => `${h.token} (has "${h.term}")${h.category ? ' — chart/category color, OK' : ''}`)
          .join('; '),
        fix: categoryOnly
          ? 'These are all chart/category colors, where the color IS the point — this is fine. Write it down in DESIGN-SYSTEM.md so the tool stops flagging it.'
          : 'Rename to say what the color is for, not what it looks like: `color-action-primary`, not `color-action-blue`. Why it matters: the day design changes that button to green, the name still says blue and every reader is misled.',
        data: { hits },
      },
    ];
  },
};
