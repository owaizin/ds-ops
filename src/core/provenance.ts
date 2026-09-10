/**
 * Provenance is the spine of ds-loop. Every value the analyzer touches carries a
 * full record of where it came from and why it was classified the way it was.
 *
 * Calibration rows are only comparable across runs if a delta can be attributed
 * to one of three causes:
 *   1. the source changed        -> `fixtureSha` differs
 *   2. the adapter changed       -> `adapterId` / `adapterVersion` differs
 *   3. the threshold/config      -> recorded separately in the run manifest
 *
 * Reconstructing this after the fact is impossible. It is cheap now.
 */

export type ValueClassification =
  | 'color' // a real color the design system reasons about
  | 'shadow-internal' // a color that only exists as part of a shadow/elevation recipe
  | 'reference' // the value is one or more var() calls — kept so tier rules can check direction
  | 'ambiguous' // could be a color, could not be — surfaced for a human
  | 'excluded'; // deliberately not a color (kept for auditability)

export type Provenance = {
  /** path relative to the fixture root */
  file: string;
  /** 1-indexed line of the declaration */
  line: number;
  /** enclosing CSS selector, or null when not applicable */
  selector: string | null;
  /** the property or custom-property name the value was assigned to */
  property: string;
  /** the design-token name, when the property is a custom property */
  tokenName: string | null;
  classification: ValueClassification;
  /** human-readable justification for the classification — this is opinion, made inspectable */
  reason: string;
  /** upstream commit SHA of the vendored fixture */
  fixtureSha: string;
  adapterId: string;
  adapterVersion: string;
};

export type RawValue = {
  /** the value exactly as it appeared in source */
  raw: string;
  /** when classification is `reference`: the token names this value points at, in order */
  refs?: string[];
  provenance: Provenance;
};

export type RunManifest = {
  tool: 'ds-loop';
  toolVersion: string;
  command: string;
  fixtureLabel: string;
  fixtureSha: string;
  adapters: { id: string; version: string }[];
  configHash: string;
  startedAt: string;
};
