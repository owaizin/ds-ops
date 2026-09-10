import { classifyTier } from './tier.ts';
import type { Finding, Rule, RuleContext } from './types.ts';

/**
 * A non-primitive token (semantic or component tier) holds a raw length /
 * number — `16px`, `1rem`, `600` — instead of referencing a spacing or type
 * primitive. Fluent UI's rule #1: "no hardcoded colors, spacing OR typography,
 * always `tokens`". Same class of bug as `color/semantic-holds-literal`, just
 * the other half of the token system.
 * https://raw.githubusercontent.com/microsoft/fluentui/master/AGENTS.md
 */
export const rawDimensionRule: Rule = {
  id: 'token/raw-dimension-in-semantic',
  title: 'Semantic or component token holds a raw length instead of a primitive',
  targets: ['tokens', 'spacing', 'typography', 'elevation'],
  run(ctx: RuleContext): Finding[] {
    const offenders = ctx.values.filter((v) => {
      if (v.provenance.classification !== 'dimension') return false;
      const name = (v.provenance.tokenName ?? '').toLowerCase();
      // font-weight and z-index scales are unitless primitives even when named
      // (--font-weight-bold: 700); a raw number there is not a violation.
      if (/(weight|z-index|zindex|opacity|line-height|leading)/.test(name)) return false;
      const tier = classifyTier(v.provenance.tokenName, ctx.config);
      // only semantic / component tokens should reference a primitive. An
      // `unknown`-tier token holding a bare number is almost always a config
      // constant (a threshold, a z-index), not a design token — skip it.
      return tier === 'semantic' || tier === 'component';
    });
    if (offenders.length === 0) return [];
    return [
      {
        ruleId: this.id,
        severity: 'high',
        summary: `${offenders.length} token(s) hold a raw length / number instead of referencing a primitive`,
        where: offenders
          .slice(0, 8)
          .map((v) => `${v.provenance.tokenName} = ${v.raw} (${v.provenance.file}:${v.provenance.line})`)
          .join('; '),
        fix: 'Point each at a spacing / size / type primitive: --token: var(--<ns>-space-4). If no primitive matches the value, add one to the scale first.',
        data: {
          count: offenders.length,
          tokens: offenders.map((v) => ({ name: v.provenance.tokenName, value: v.raw })),
        },
      },
    ];
  },
};
