# audit

Run the deterministic rule set against a target, verify every finding in context,
present a severity-ranked report. `audit` documents; it does not fix.

## Run it

```bash
<skill-base-dir>/bin/ds-loop audit <fixture-or-source> --target <target> --json
```

Targets: `all` (default), `tokens`, `color`, `spacing`, `typography`, `elevation`,
`motion`. The CLI exits `1` if there is any finding.

A **source** in v0 is a fixture directory (a `SOURCE.json` plus vendored token
files). Pointing the analyzer at a live repo path is planned; until then, snapshot
the token files into a fixture so the run is reproducible and a calibration row is
comparable.

## The rule set (v0)

| Rule id | Severity | What it means |
|---|---|---|
| `token/tier-leakage` | high | A token references across tiers the wrong way — component → primitive skips the semantic tier, or a reference points upward. Value is right, theme propagation is broken. |
| `token/semantic-name-describes-appearance` | medium / low | A semantic token named for a colour or size word (`color.action.blue`). Low when every hit is a category / chart-series token (sanctioned — record it in `DESIGN-SYSTEM.md`). |
| `color/semantic-holds-literal` | high | A non-primitive token holds a literal colour instead of `var(--primitive)`. Breaks the layer model. |
| `token/raw-dimension-in-semantic` | high | A semantic or component token holds a raw length (`16px`, `1rem`, a shorthand) instead of `var(--space-N)`. The other half of `semantic-holds-literal`. Skips primitives, font-weight / z-index / opacity scales, and shadow recipe parts. Bare unitless numbers are not treated as dimensions. |
| `color/literal-duplicate-tokens` | medium | Two+ tokens declare byte-identical values. Usually a semantic layer re-typing a palette value instead of aliasing it. |
| `color/near-duplicate-primitives` | low | Two palette primitives are within the configured ΔE — below a reliable just-noticeable difference. |
| `color/mixed-storage-forms` | medium | Colour values stored in more than one form (hex + hsl-channels + rgb). Pick one convention. |
| `color/no-intent-plateau` | low | No ΔE band holds a cluster count near the shipped primitive count. Hand-authored → ramp may be over-fine; generated scale → expected. |
| `token/var-missing-fallback` | low | A `var(--token)` with no `, fallback`. If the token is ever undefined (import order, an unloaded token file, a dropped theme value) the property silently resolves to nothing. SLDS requires a fallback on every reference. A var() after a comma — itself a fallback — is not flagged. |

Severities are overridable per project via `.ds-loop-config.yml` (`severity:`
block, Murphy Trueman `design-system-ops` format) — `tier_leakage: critical` maps
`token/tier-leakage` to `blocking`.

Each rule is `domain/kebab-slug`, stable, and scorecards key on it. `--target color`
also runs the deeper `no-intent-plateau` check; `--target tokens` runs the
structural rules only.

## Verify before you report

Deterministic findings are candidates, not verdicts. For each:

1. Open the cited `file:line`. Confirm the value and the token name.
2. Decide whether it is a real defect or a **sanctioned exception** — a documented
   compromise, a deliberate ramp step, a second-theme literal. Sanctioned
   exceptions get recorded in `DESIGN-SYSTEM.md` prose and suppressed via config,
   not argued each run.
3. Keep deterministic findings separate from any visual judgment you add.

## Report

- Lead with the verdict: **clean** or **N findings (b/h/m/l)**.
- One block per finding: severity, rule id, what, where, fix.
- Then the **scorecard ratios** — always ratios, never bare counts, so the number
  survives codebase growth: `literal-colors-per-distinct`, `ambiguous-share`,
  `findings-per-rule`.
- Map each finding to the command that fixes it (`tokenize`, `review`, a manual
  refactor). End with `drift` so the user can track the fix landing.

## NEVER

- Report a finding without opening the cited line.
- Fix anything in `audit` — route it.
- Treat a `low` finding on a generated scale as a defect.
- Present counts where a ratio belongs.
