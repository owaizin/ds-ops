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
  },
  sweep: {
    min: 0.5,
    max: 12,
    step: 0.25,
  },
};
