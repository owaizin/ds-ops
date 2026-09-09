---
name: ds-ops
description: Use when the user wants to audit, build, or guardrail a design SYSTEM (not a single screen) — token layers, component libraries, Storybook structure, contribution governance. Covers token audits, drift detection, component inventory and de-duplication, the primitive→semantic→component→state layer model, the two-file token source of truth (CSS + W3C JSON), Storybook taxonomy and the 5-file component contract, API-surface restraint caps, accessibility baselines, migration lanes, branch-scope governance, and CI guardrails that stop entropy after the design-system team leaves. Also use for standing up a design system from zero, or for a Phase-0 interrogation before adding a new component. NOT for per-screen visual polish, taste, motion, or anti-slop on an individual page — that is impeccable's domain; ds-ops is the system behind the screens.
metadata:
  version: 0.1.0
---

**In plain terms:** a design system is a shared box of colors, spacing, and parts
that a whole app is built from. Over time people stop using the shared box and
paste in their own — four kinds of blue, nothing lines up. ds-ops finds that mess
with math (deterministic checks, no guessing), and helps rebuild the box.

ds-ops treats a design system as **a set of rules that happens to ship
components**, not a component library. Its job is to remove decisions — every rule
here is a check a computer can run, a file it can generate, or a question the
author answers, never a reviewer's memory.

Scope line: **impeccable makes one screen look good; ds-ops checks the shared
system behind all the screens.** If the request is "make this page look better",
hand it to impeccable.

## Setup

1. Run `<skill-base-dir>/bin/ds-ops context` once per session (keep cwd at the
   user's project). It loads `DESIGN-SYSTEM.md`, the tuned config if one is
   present, and reports what is stale. Do not rerun it.
2. Load the request's playbook from the Commands table below. If no command is
   named, read `reference/routing.md` and present its menu — never auto-run.
3. Before editing anything under the design-system directories, obey
   `reference/scope.md` — the branch-scope policy. Audit findings never override
   scope.

## The three levels (the spine)

Design values stack in three levels. Think paint:

```
Palette (raw)  →  Semantic (named job)  →  Component (part rule)
"blue 600"        "primary action color"     "button background"
the paint cans    labels on the cans         "this part uses that label"
```

The rule: each level points **one level down, never up, never skipping**. A named
job points at a paint can. A part rule points at a named job — not straight at a
paint can. When a part rule grabs a paint can directly, the color is right today
but a rebrand won't reach it, because rebrands flow through the labels.

Two files hold the truth: `tokens.css` (what the app runs) and `tokens.json`
(DTCG 2025.10 format — what design tools and exporters read). CI checks they match
on every change. They move together or not at all.

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
| `scorecard` | Guard | Append the ratio timeseries to `.ds-scorecard/history.jsonl` (emitted from CI on main) | [reference/scorecard.md](reference/scorecard.md) |
| `doctor` | Meta | Drift between `DESIGN-SYSTEM.md`, the token files, config, and the guard hook | [reference/doctor.md](reference/doctor.md) |

Targets scope the work: `tokens`, `color`, `spacing`, `typography`, `elevation`,
`motion`, `components`, a category (`forms`), a `ComponentName`, or a path.

Routing:

- **No argument:** present the `reference/routing.md` menu. Never auto-run.
- **Explicit or clearly implied command:** load its reference and follow it.
- **Missing `DESIGN-SYSTEM.md`:** a system-level request routes through `discover`
  first. A narrow single-component request may proceed, offering `discover` after.

## Two kinds of check

- **Math checks** (the CLI: `audit` / `sweep` / `drift`): wrong-level references,
  hand-typed colors, exact duplicates, colors too close to tell apart, mixed
  formats, the palette test, the two files matching, the standard component files
  existing. Same answer every time, no AI. In `guard` these **block the merge**.
- **Judgment checks** (the playbooks: `shape`, `review`, `census`): is this
  component's option list too long, did the author cut anything, is a near-
  duplicate deliberate, is the component even needed. In `guard` these **leave a
  comment**, never block — one wrong block and someone turns the whole check off.

## Keep component option-lists short

Start skeptical of every new option. Per component, counting only options it adds:

| kind of option | "explain yourself" past | "no" past |
|---|---|---|
| props | 12 | 18 |
| style variants | 4 | 6 |
| sizes | 4 | 5 |
| color/tone choices | 6 | 8 |
| true/false flags | 5 | 8 |

Lots of true/false flags usually means a missing variant. An option with no real
use anywhere → delete it. If the author can't name one thing they left out, the
design isn't done.

## NEVER

- Migrate production components to tokens as part of a design-system branch — that
  is a separate engineering PR.
- Implement an audit's production recommendations on a scoped branch. Document, stop.
- Add `tags: ['autodocs']` to a story that has a guidelines MDX.
- Ship an interactive component without the accessibility contract from day one.
- Let a reuse or slop check block a merge. Comment only.
