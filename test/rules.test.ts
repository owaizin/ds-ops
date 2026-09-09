import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_CONFIG } from '../src/config/defaults.ts';
import type { RawValue } from '../src/core/provenance.ts';
import { literalDuplicateRule, semanticLiteralRule } from '../src/rules/color.ts';
import type { RuleContext } from '../src/rules/types.ts';

function value(tokenName: string, raw: string): RawValue {
  return {
    raw,
    provenance: {
      file: 't.css',
      line: 1,
      selector: ':root',
      property: tokenName,
      tokenName,
      classification: 'color',
      reason: 'test',
      fixtureSha: 'test',
      adapterId: 'test',
      adapterVersion: '0',
    },
  };
}

function ctx(colors: RawValue[]): RuleContext {
  return {
    meta: {
      label: 'test',
      upstream: '',
      fixtureSha: 'test',
      retrievedAt: '',
      path: '.',
      shippedPrimitiveCount: null,
    },
    source: { root: '.', fixtureSha: 'test', label: 'test' },
    config: DEFAULT_CONFIG,
    values: colors,
    colors,
  };
}

test('semantic-holds-literal flags non-primitive names, ignores scale steps', () => {
  const colors = [
    value('--slate-500', '#64748b'), // primitive by trailing number
    value('--palette-raw-blue-9', '#0f172a'), // primitive by hint
    value('--color-text-primary', '#020817'), // semantic literal — offender
    value('--brand-default', '#0f172a'), // semantic literal — offender
  ];
  const findings = semanticLiteralRule.run(ctx(colors));
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.data?.count, 2);
});

test('literal-duplicate-tokens groups tokens that share a value', () => {
  const colors = [
    value('--palette-white', '#ffffff'),
    value('--brand-on', '#ffffff'),
    value('--accent-on', '#ffffff'),
    value('--palette-black', '#000000'),
  ];
  const findings = literalDuplicateRule.run(ctx(colors));
  assert.equal(findings.length, 1);
  assert.match(findings[0]?.summary ?? '', /1 colour value\(s\) are declared by 3/);
});
