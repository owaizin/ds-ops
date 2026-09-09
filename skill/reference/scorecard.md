# scorecard

The entropy trend line. One line appended to `.ds-scorecard/history.jsonl` per CI
run on `main`.

```json
{"ranAt":"2026-09-09T…","commit":"a1b2c3d","ratios":{
  "raw-values-per-declared": 0.04,
  "semantic-literal-share": 0.0,
  "drift-per-component": 0.0,
  "orphan-stories-per-story": 0.11
}}
```

## Rules

- **Ratios, not counts.** Raw-value count rises as the codebase grows even when
  discipline is perfect. A trend line that punishes growth gets ignored within a
  month.
- **CI on `main` only.** A scorecard written from local runs is sparse and gameable.
- **Committed to the client repo.** They own it. The renewal conversation is
  `git log -p .ds-scorecard/history.jsonl` — six months of the line going the
  right way, or not.

## Status

`audit` already emits the ratio block. `scorecard` (the append-to-file + CI
wiring) is planned, and rides in with `guard`.
