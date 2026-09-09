import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_CONFIG } from '../src/config/defaults.ts';
import { parseYamlLite } from '../src/config/yaml-lite.ts';
import type { RawValue } from '../src/core/provenance.ts';
import { classifyTier, tierLeakageRule } from '../src/rules/tier.ts';
import type { RuleContext } from '../src/rules/types.ts';

test('classifyTier: semantic namespace beats widget word', () => {
  const c = DEFAULT_CONFIG;
  assert.equal(classifyTier('--cue-palette-raw-slate-900', c), 'primitive');
  assert.equal(classifyTier('--slate-500', c), 'primitive');
  assert.equal(classifyTier('--cue-color-bg-surface-default', c), 'semantic');
  assert.equal(classifyTier('--cue-color-bg-skeleton', c), 'semantic'); // widget word, semantic ns
  assert.equal(classifyTier('--cue-button-padding', c), 'component');
  assert.equal(classifyTier('--totally-random-thing', c), 'unknown');
});

function ref(tokenName: string, refs: string[]): RawValue {
  return {
    raw: refs.map((r) => `var(${r})`).join(' '),
    refs,
    provenance: {
      file: 't.css',
      line: 1,
      selector: ':root',
      property: tokenName,
      tokenName,
      classification: 'reference',
      reason: 'test',
      fixtureSha: 't',
      adapterId: 't',
      adapterVersion: '0',
    },
  };
}

function ctx(values: RawValue[]): RuleContext {
  return {
    meta: {
      label: 't',
      upstream: '',
      fixtureSha: 't',
      retrievedAt: '',
      path: '.',
      shippedPrimitiveCount: null,
    },
    source: { root: '.', fixtureSha: 't', label: 't' },
    config: DEFAULT_CONFIG,
    values,
    colors: [],
  };
}

test('tierLeakageRule: flags component→primitive skip, allows downward + aliasing', () => {
  const values = [
    ref('--cue-button-bg', ['--cue-color-bg-action-primary-default']), // component→semantic OK
    ref('--cue-color-bg-surface-default', ['--cue-palette-white']), // semantic→primitive OK
    ref('--cue-palette-white', ['--cue-palette-raw-white']), // primitive→primitive alias OK
    ref('--cue-button-padding', ['--cue-size-space-3']), // component→primitive SKIP
  ];
  const findings = tierLeakageRule.run(ctx(values));
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.data?.count, 1);
  assert.equal(findings[0]?.data?.tierSkips, 1);
});

test('parseYamlLite: nested maps, scalars, comments, inline list', () => {
  const y = parseYamlLite(`
# a comment
system:
  name: "Cone"
  component_count: null
  theming: true
severity:
  tier_leakage: critical  # trailing comment
npm:
  scoped_packages: []
`) as Record<string, Record<string, unknown>>;
  assert.equal(y.system!.name, 'Cone');
  assert.equal(y.system!.component_count, null);
  assert.equal(y.system!.theming, true);
  assert.equal(y.severity!.tier_leakage, 'critical');
  assert.deepEqual(y.npm!.scoped_packages, []);
});
