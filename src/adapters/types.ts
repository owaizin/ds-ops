import type { DsOpsConfig } from '../config/schema.ts';
import type { RawValue } from '../core/provenance.ts';

export type SourceRef = {
  /** absolute path to the fixture root or the live directory being scanned */
  root: string;
  /** upstream commit SHA of the fixture, or `git:<sha>` / `live` for a working tree */
  fixtureSha: string;
  /** human label for reports and calibration rows */
  label: string;
  /** when set, the adapter reads only these absolute file paths (hook / --files mode) */
  only?: string[];
};

/**
 * An adapter turns one storage format into a flat list of RawValues with
 * provenance. Adapters are the asset that accumulates across engagements: every
 * new client storage shape is one new adapter, and the interface never moves.
 *
 * Adapters MUST NOT cluster, dedupe, or judge intent. They extract and classify
 * one value at a time, using the taxonomy from config. Everything downstream is
 * format-agnostic.
 */
export type Adapter = {
  id: string;
  version: string;
  /** cheap check: does this adapter recognise the source? */
  detect(source: SourceRef): boolean;
  extract(source: SourceRef, config: DsOpsConfig): RawValue[];
};
