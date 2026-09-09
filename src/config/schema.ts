/**
 * The config object is the mechanism/policy seam.
 *
 * ds-ops (this repo) is policy-free mechanism. Every tuned number lives here as a
 * field with an UNCALIBRATED default. The calibrated values live in the private
 * `ds-ops-calibration` repo and are passed in at run time. Nothing in `src/`
 * outside this file may hardcode a threshold — if it does, the seam has leaked.
 *
 * The taxonomy hints below are the one place an opinion is baked into the open
 * engine on purpose (see README "The leaky seam"). They are still config, so a
 * consumer can override them, but the defaults carry a point of view.
 */

export type DsOpsConfig = {
  clustering: {
    /**
     * CIEDE2000 ΔE below which two colors are treated as the same design intent.
     * This single number decides whether a palette has 7 greys or 11.
     * UNCALIBRATED default — see ds-ops-calibration for tuned values per source.
     */
    deltaE: number;
  };
  taxonomy: {
    /** token-name substrings that force a color into `shadow-internal` */
    shadowTokenHints: string[];
    /** an rgba/hsla alpha at or below this is treated as shadow-internal, not a color */
    shadowAlphaCeiling: number;
    /** token-name substrings that mark a value as a sanctioned non-color (excluded, not ambiguous) */
    nonColorTokenHints: string[];
  };
  sweep: {
    min: number;
    max: number;
    step: number;
  };
};

export function hashConfig(config: DsOpsConfig): string {
  // stable, order-independent digest for the run manifest
  const json = JSON.stringify(config, Object.keys(config).sort());
  let h = 5381;
  for (let i = 0; i < json.length; i++) h = (h * 33) ^ json.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(8, '0');
}
