---
name: ds-loop
description: Use when the user wants to audit, build, or guardrail a design SYSTEM (not a single screen) — token layers, component libraries, Storybook structure, contribution governance. Covers token audits, drift detection, component inventory and de-duplication, the primitive→semantic→component→state layer model, the two-file token source of truth (CSS + W3C JSON), Storybook taxonomy and the 5-file component contract, API-surface restraint caps, accessibility baselines, migration lanes, branch-scope governance, and CI guardrails that stop entropy after the design-system team leaves. Also use for standing up a design system from zero, or for a Phase-0 interrogation before adding a new component. NOT for per-screen visual polish, taste, motion, or anti-slop on an individual page — that is impeccable's domain; ds-loop is the system behind the screens.
metadata:
  version: 0.1.0
---

ds-loop treats a design system as **a decision framework that happens to ship
components**, not a component library. Its job is to remove decisions — every rule
here is a deterministic check, a scaffold, or a question the author answers, never
a reviewer's memory.

Scope line: **impeccable operates on screens; ds-loop operates on the system behind
them.** A shop runs impeccable to make a surface good and ds-loop to make sure a
system exists and does not rot. If the request is "make this page look better",
hand it to impeccable.

## Setup

1. Run `<skill-base-dir>/bin/ds-loop context` once per session (keep cwd at the
   user's project). It loads `DESIGN-SYSTEM.md`, the tuned config if one is
   present, and reports what is stale. Do not rerun it.
2. Load the request's playbook from the Commands table below. If no command is
   named, read `reference/routing.md` and present its menu — never auto-run.
3. Before editing anything under the design-system directories, obey
   `reference/scope.md` — the branch-scope policy. Audit findings never override
   scope.

## The layer model (the spine)

```
Palette   →   Semantic   →   Component   →   State
(raw)         (role)         (part)          (interaction)
```

Each layer references only the layer above it, via `var()`. A semantic token
holding a raw literal is a bug. A component reading a palette token directly is a
bug. Both are grep-checkable and both are ds-loop rules.

Two files, one source of truth: `tokens.css` (the runtime) and `tokens.json`
(W3C design-tokens format — what every other tool reads). A CI check diffs them
per namespace on every PR. They change together or neither changes.

## Commands

| Command | Category | Description | Reference |
|---|---|---|---|
| `discover` | Discover | Interview + repo scan → `DESIGN-SYSTEM.md` (YAML frontmatter every downstream command branches on, prose underneath) | [reference/discover.md](reference/discover.md) |
| `census [target]` | Discover | Component inventory: scan, cluster near-duplicates, rank by usage × blast radius | [reference/census.md](reference/census.md) |
| `audit [target]` | Audit | Run every deterministic rule that speaks to `<target>`. Severity-ranked findings + scorecard ratios. No LLM, no network | [reference/audit.md](reference/audit.md) |
| `sweep [target]` | Audit | CIEDE2000 ΔE cutoff sweep — the colour-domain calibration curve | [reference/sweep.md](reference/sweep.md) |
| `drift [target]` | Audit | `audit` against a committed baseline; report what regressed | [reference/drift.md](reference/drift.md) |
| `tokenize [target]` | Build | Turn a proposed scale into the two-file token SSOT + the parity check | [reference/tokenize.md](reference/tokenize.md) |
| `scaffold [target]` | Build | Generate the Storybook spine, foundations pages, the 5-file component contract, the validators | [reference/scaffold.md](reference/scaffold.md) |
| `extract [target]` | Build | Pull a repeated pattern into the system as a proper 5-file component | [reference/extract.md](reference/extract.md) |
| `shape <component>` | Review | Phase 0 design-intent interrogation before a new component | [reference/shape.md](reference/shape.md) |
| `review <component>` | Review | Full component audit — API caps, token hygiene, story structure, a11y, MDX | [reference/review.md](reference/review.md) |
| `guard [on\|off\|status]` | Guard | Install/manage CI + pre-commit enforcement. Deterministic checks block; judgment checks comment | [reference/guard.md](reference/guard.md) |
| `fix [target] [--write]` | Guard | Apply the mechanical fixes only — where the edit is provable from the code, no LLM. v0: inserts a `var()` fallback from the target token's literal. Dry run unless `--write`. | — |
| `scorecard` | Guard | Append the ratio timeseries to `.ds-scorecard/history.jsonl` (emitted from CI on main) | [reference/scorecard.md](reference/scorecard.md) |
| `doctor` | Meta | Drift between `DESIGN-SYSTEM.md`, the token files, config, and the guard hook | [reference/doctor.md](reference/doctor.md) |

Targets scope the work: `tokens`, `color`, `spacing`, `typography`, `elevation`,
`motion`, `components`, a category (`forms`), a `ComponentName`, or a path.

Routing:

- **No argument:** present the `reference/routing.md` menu. Never auto-run.
- **Explicit or clearly implied command:** load its reference and follow it.
- **Missing `DESIGN-SYSTEM.md`:** a system-level request routes through `discover`
  first. A narrow single-component request may proceed, offering `discover` after.

## What is deterministic vs what is judgment

- **Deterministic** (the CLI, `audit` / `sweep` / `drift`): token-layer violations,
  raw-value counts, literal duplicates, near-duplicate primitives, storage-form
  consistency, the ΔE plateau test, CSS/JSON parity, the 5-file contract. These
  run with no LLM and no API key. In `guard`, they **block**.
- **Judgment** (the skill playbooks: `shape`, `review`, `census`): API-surface
  restraint, "did the author name what they cut", whether a near-duplicate is a
  deliberate ramp step, whether a component is really needed. In `guard`, these
  **comment**, never block — a false positive that blocks a merge gets the whole
  check disabled.

## The restraint doctrine

Default stance: skeptical of additions. API-surface caps, per component's *added*
public API — soft cap = justify in writing, hard cap = fails review:

| Dimension | Soft | Hard |
|---|---|---|
| Props | > 12 | > 18 |
| `variant` | > 4 | > 6 |
| `size` | > 4 | > 5 |
| `tone` / `color` | > 6 | > 8 |
| Boolean flags | > 5 | > 8 |

Many booleans = a missing variant. A "just in case" prop with no usage site →
delete it. If the author cannot name one thing they cut, the design is not
finished.

## NEVER

- Migrate production components to tokens as part of a design-system branch — that
  is a separate engineering PR.
- Implement an audit's production recommendations on a scoped branch. Document, stop.
- Add `tags: ['autodocs']` to a story that has a guidelines MDX.
- Ship an interactive component without the accessibility contract from day one.
- Let a reuse or slop check block a merge. Comment only.
