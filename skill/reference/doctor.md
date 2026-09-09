# doctor

Report and repair drift between the project's ds-ops artifacts and what the
current version reads.

Status: **planned.**

## Checks

- `DESIGN-SYSTEM.md` frontmatter `schema:` version vs. what this ds-ops expects.
- Token files present and matching the `token_storage` / `token_layers` recorded
  in `DESIGN-SYSTEM.md`.
- Config file (`ds-ops.config.json`) valid against the current schema; unknown
  keys flagged, missing keys defaulted.
- `guard` hook installed and pointing at the current CLI path.
- The baseline (`.ds-ops/baseline.json`) freshness vs. the last token-file change.

## Output

A short report: what is current, what is stale, what `doctor --fix` would change.
`--fix` applies the safe repairs (re-point the hook, default missing config keys,
bump a tolerated schema) and lists what needs a human (a `schema:` jump that
changes a field's meaning).
