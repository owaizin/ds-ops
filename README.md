# ds-loop

**Design-system linter for the AI era.** `ds` = design system; `loop` = the
edit → check → fix → re-check cycle. Reads a design system's code and points at
what drifted — deterministically, no LLM.

An agency walks into a product with no design system, or a failing one. They do a
token audit, take a component census, stand up a Storybook, migrate one surface to
prove it, then install the guardrails that keep entropy from winning after they
leave. `ds-loop` is that engagement as tooling: a small set of engines with a
one-shot mode (the audit) and a watch mode (the guard), plus the skills that carry
the judgment.

This repo is the **open engine**. It is policy-free mechanism. Every tuned number
lives in a config object with an uncalibrated default; the calibrated values and
the corpus behind them live in a separate private repo and are passed in at run
time. See [_The leaky seam_](#the-leaky-seam).

Scope line: **impeccable operates on screens; ds-loop operates on the system behind
them.** Hand a page that needs taste to impeccable; ds-loop is the token layer, the
component contract, the governance.

Status: **v0** — the deterministic colour-domain audit, the ΔE sweep, live-tree
scanning, and the edit-time guard hook work end to end. The `/ds-loop` skill
(14 commands, 5 categories) is specced; most engines are scaffolding.

---

## What's here in v0

```
ds-loop audit <path> [--target color|tokens|…] [--json] [--files a,b] [--since <ref>] [--min-severity high] [--quiet]
    Deterministic rule set, severity-ranked, exit 1 on any surviving finding.
    <path> is a fixture dir (SOURCE.json) OR any dir / .css file — a live scan
    of the working tree. --files / --since narrow to changed files.

ds-loop sweep <path> [--out <dir>]     the ΔE cutoff sweep — full curve
ds-loop scan  <path>                   quick look: taxonomy breakdown + clusters
ds-loop guard <on|off|status>          install/remove the edit-time hook (below)
```

Runs on Node ≥ 22.6 with no build step (`--experimental-strip-types`). The
`/ds-loop` skill and its playbooks live in [`skill/`](skill/SKILL.md); the launcher
at `skill/bin/ds-loop` wraps the CLI.

```bash
npm install
node --experimental-strip-types src/cli.ts audit fixtures/radix-colors   # a frozen fixture
node --experimental-strip-types src/cli.ts audit ../some-app/src         # a live repo
```

### `guard` — nag on edit, like impeccable's hook

`ds-loop guard on` writes a `PostToolUse` hook into `./.claude/settings.json`.
After any `Edit`/`Write` to a `.css` file, ds-loop audits that one file and, if
there are `high`+ findings, prints them to stderr (exit 2) so the coding agent
sees them. Silent on a clean save, silent on non-style files. **Never blocks** —
a PostToolUse hook fires after the write. `guard off` removes only the ds-loop
entry; every other hook, permission, and setting is left alone.

### The v0 rule set

| rule | severity | catches |
| --- | --- | --- |
| `token/tier-leakage` | high | a token referencing the wrong tier — component → primitive skips, upward references. Breaks theme propagation. |
| `token/semantic-name-describes-appearance` | medium / low | a semantic token named for a colour or size (`color.action.blue`) — a primitive with extra steps. Low when only category/chart tokens. |
| `color/semantic-holds-literal` | high | a semantic token holding a literal colour instead of `var(--primitive)` |
| `token/raw-dimension-in-semantic` | high | a semantic or component token holds a raw `16px` / `1rem` instead of a spacing / type primitive (Fluent rule 1) |
| `color/literal-duplicate-tokens` | medium | N tokens declaring byte-identical values (semantic layer re-typing the palette) |
| `color/near-duplicate-primitives` | low | two primitives within one just-noticeable ΔE |
| `color/mixed-storage-forms` | medium | hex + hsl-channels + rgb in one source |
| `color/no-intent-plateau` | low | palette has no ΔE knee at the shipped count |
| `token/var-missing-fallback` | low | a `var(--token)` reference with no fallback — resolves to nothing if the token is ever undefined (SLDS requires one) |

Every rule is deterministic — no LLM, no network, no API key. Config is the
mechanism/policy seam: `primitivePattern`, `componentPattern`, `reservedSemanticTerms`,
`shadowAlphaCeiling`, the ΔE cutoff all have uncalibrated defaults here.

### Interop with `design-system-ops`

[Murphy Trueman's `design-system-ops`](https://github.com/murphytrueman/design-system-ops)
is a Claude Code skill pack — the practitioner brain: 40 LLM skills for governance,
documentation, and communication around a live system. ds-loop is the deterministic
instrument that pack lacks. They compose.

ds-loop reads his `.ds-ops-config.yml` verbatim (that filename is his, kept as-is
for interop): the `system:` block seeds context, the `severity:` block maps onto
ds-loop rule severities (`tier_leakage: critical` → `token/tier-leakage` at
`blocking`). A team already running his skill pack points ds-loop at the same
file. ds-loop's own config is `.ds-loop-config.yml` / `ds-loop.config.json`.

Example output (the healthy control fixture):

```
  72 distinct color literals
  humans shipped 72 primitives

  ΔE   0.50   72  ████████████████████████████████████████
  ΔE   1.00   70  ███████████████████████████████████████
  ...
  ΔE   6.00   26  ██████████████
  ...
  monotone non-increasing: yes
  verdict: no plateau sits at the 72 humans shipped. The count passes through 72
  near ΔE 0.75 without holding — the palette has no natural knee there.
```

That verdict is the point. Radix's light scales are built tighter than one
just-noticeable-difference apart, so a single ΔE cutoff **cannot** recover the
human's palette size. The sweep tells you when the metric works and when it
doesn't, per source, rather than pretending one cutoff is universal.

---

## The three engines (roadmap)

The eight phases of a design-system engagement collapse to three engines, each
with a one-shot and a watch mode:

| Engine | One-shot (t=0 audit) | Watch (continuous guard) |
| --- | --- | --- |
| **analyzer** | `scan` / `sweep` — extract every style value with provenance, classify, cluster | drift detection against a committed baseline |
| **clusterer** | component census — group near-duplicate components across the repo | "does this component already exist?" on a single candidate |
| **generator** | scaffold a Storybook, the token files, the 5-file component contract | codemods, CI wiring |

Phases become invocation modes over three engines, not eight separately
maintained tools. v0 ships the analyzer's `scan` and `sweep`.

---

## Adapters

An **adapter** turns one storage format into a flat list of `RawValue`s with full
provenance. Adapters are the asset that accumulates across engagements — every new
client storage shape is one new adapter, and [the interface](src/adapters/types.ts)
never moves.

| Adapter | Recognises | Status |
| --- | --- | --- |
| `css-custom-props` | `--token: value;` in `.css` — full colors *and* bare HSL channel triples | v0 |
| `scss-maps` | `$name: (...)` Sass maps | planned |
| `js-scale-objects` | exported `{ 1: '#...', 2: '#...' }` (Radix-style) | planned |
| `tokens-studio-json` | W3C design-tokens JSON | planned |

Adapters extract and classify one value at a time. They never cluster, dedupe, or
judge intent — everything downstream is format-agnostic.

---

## Provenance

Every value carries where it came from and why it was classified the way it was:
`file · line · selector · property · tokenName · classification · reason ·
fixtureSha · adapterId · adapterVersion`.

A calibration row is only comparable across runs if a delta can be attributed to
one of three causes: the **source** changed (`fixtureSha`), the **adapter** changed
(`adapterVersion`), or the **threshold** changed (recorded in the run manifest).
Reconstructing this after the fact is impossible; it is cheap now.

---

## Fixtures

A fixture is a **frozen snapshot** of one source's token files plus a `SOURCE.json`
recording exactly what was copied and from where — never a live checkout. Snapshots
are what make a calibration row comparable across runs and a writeup reproducible
by a reader.

```
fixtures/radix-colors/
  SOURCE.json          label, upstream, fixtureSha, shippedPrimitiveCount, notes
  css/                  the vendored files
```

Public fixtures in this repo are open-source design systems (verifiable by anyone).
Client and proprietary fixtures live in the private calibration repo.

---

## The leaky seam

The mechanism/policy split is real but not clean. Feature extraction is itself a
judgment call: whether `rgba(0,0,0,.06)` inside a shadow is a color or part of a
shadow recipe, whether a low-alpha value is an overlay tint or a palette entry.
That taxonomy is an opinion, and it lives in the open engine on purpose — an
opinionated engine is better distribution than a neutral one. Two mitigations:

1. Every taxonomy decision is **logged in the output** with its reason, and the
   ambiguous set is surfaced for a human. The opinion is inspectable.
2. The taxonomy hints are still config (`taxonomy.shadowTokenHints`,
   `taxonomy.shadowAlphaCeiling`, …) — a consumer can override them.

What is *not* in this repo: the tuned ΔE cutoffs per source, the API-surface caps,
the restraint doctrine's calibrated numbers, and the corpus of before/after
engagement runs that tunes them.

---

## Development

```bash
npm run check        # biome (lint + format)
npm run type-check   # tsc --noEmit
npm test             # node:test, CIEDE2000 verified against Sharma et al. test data
```

CI runs those, then runs `sweep` against every public fixture.

## License

MIT
