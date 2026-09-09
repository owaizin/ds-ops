import type { DsOpsConfig } from './schema.ts';

/**
 * UNCALIBRATED defaults.
 *
 * These are deliberately neutral starting points, not recommendations. The whole
 * premise of ds-ops is that the right ΔE cutoff is discovered per-source by the
 * `sweep` command, then recorded in ds-ops-calibration. Running `scan` with these
 * defaults tells you the shape of the data, not the answer.
 *
 * ΔE 2.3 is the classic "just noticeable difference" figure. It is here because
 * it is a defensible neutral, not because it is correct for any given palette.
 */
export const DEFAULT_CONFIG: DsOpsConfig = {
  clustering: {
    deltaE: 2.3,
  },
  taxonomy: {
    shadowTokenHints: ['shadow', 'elevation', 'glow', 'ring-offset'],
    shadowAlphaCeiling: 0.25,
    nonColorTokenHints: ['gradient', 'backdrop', 'scrim-opacity'],
    // `raw`/`palette`/`scale`/`ref` anywhere, OR a trailing numeric scale step
    // (--slate-500, --amber-9). Covers Tailwind, Radix, and Cone conventions.
    primitivePattern: '(^|-)(raw|palette|scale|ref)(-|$)|-\\d{1,4}$',
    // a token named for a widget right after the --ns- prefix (--cue-button-bg).
    // checked AFTER the semantic-namespace test, so --cue-color-bg-skeleton stays semantic.
    componentPattern:
      '^--[a-z0-9]+-(button|btn|card|input|field|badge|chip|tag|tab|modal|dialog|drawer|sheet|popover|tooltip|toast|banner|alert|avatar|checkbox|radio|switch|slider|select|menu|table|accordion|breadcrumb|pagination|progress|spinner|skeleton|divider)(-|$)',
    semanticNamespaces: [
      'color',
      'type',
      'text',
      'font',
      'space',
      'spacing',
      'size',
      'elevation',
      'shadow',
      'motion',
      'transition',
      'radius',
      'border',
      'opacity',
      'z',
    ],
    reservedSemanticTerms: [
      'blue',
      'green',
      'red',
      'orange',
      'yellow',
      'purple',
      'violet',
      'pink',
      'teal',
      'cyan',
      'sky',
      'indigo',
      'fuchsia',
      'rose',
      'lime',
      'emerald',
      'amber',
      'slate',
      'gray',
      'grey',
      'zinc',
      'stone',
      'neutral',
    ],
  },
  sweep: {
    min: 0.5,
    max: 12,
    step: 0.25,
  },
};
