import {
  colorKneeRule,
  literalDuplicateRule,
  mixedColorFormRule,
  nearDuplicatePaletteRule,
  semanticLiteralRule,
} from './color.ts';
import { semanticAppearanceNameRule, tierLeakageRule, varMissingFallbackRule } from './tier.ts';
import type { Rule, RuleTarget } from './types.ts';

/**
 * The deterministic rule set. No LLM, no network, no API key. A rule returns
 * zero findings when that slice of the system is clean.
 *
 * Adding a rule: implement it in a domain file, export it, list it here. Every
 * rule id is `domain/kebab-slug` and is stable — scorecards key on it.
 */
export const RULES: Rule[] = [
  tierLeakageRule,
  semanticLiteralRule,
  literalDuplicateRule,
  semanticAppearanceNameRule,
  varMissingFallbackRule,
  nearDuplicatePaletteRule,
  mixedColorFormRule,
  colorKneeRule,
];

export function rulesForTarget(target: RuleTarget | 'all'): Rule[] {
  if (target === 'all') return RULES;
  return RULES.filter((r) => r.targets.includes(target));
}

export const KNOWN_TARGETS: (RuleTarget | 'all')[] = [
  'all',
  'tokens',
  'color',
  'spacing',
  'typography',
  'elevation',
  'motion',
];
