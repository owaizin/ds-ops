# routing

Shown when `/ds-ops` is invoked with no command. Present the menu; never auto-run.

## Menu

**Starting from nothing / new to this system**
- `discover` — map what exists (or doesn't) into `DESIGN-SYSTEM.md`. Do this first.
- `census` — inventory the components, find the duplicates.
- `audit` — measure the token layer against the deterministic rules.

**Building**
- `tokenize` — stand up the two-file token source of truth.
- `scaffold` — Storybook spine, foundations pages, the 5-file component contract.
- `extract` — pull a repeated pattern into the system properly.
- `shape` → `review` — interrogate a new component's design, then audit its build.

**Keeping it from rotting**
- `guard on` — wire the checks into CI and pre-commit.
- `drift` — what regressed since the baseline.
- `scorecard` — the entropy trend line.

**Something feels stale**
- `doctor` — reconcile `DESIGN-SYSTEM.md`, the token files, config, the hook.

## Picking for the user

- Request mentions a single component → `shape` (new) or `review` (existing).
- Request is "audit our tokens" / "is our colour system a mess" → `audit`.
- Request is "we have no design system" → `discover`, then `census`, then a plan.
- Request is "stop people breaking the tokens" → `guard on`.
- Request is per-screen visual quality → not ds-ops. Hand to impeccable.
