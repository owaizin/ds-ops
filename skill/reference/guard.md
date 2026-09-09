# guard

Install and manage the continuous enforcement layer. `guard` is `audit` and the
structural validators wired into CI and pre-commit, plus the scorecard timeseries.

```bash
<skill-base-dir>/bin/ds-ops guard on      # install hooks + CI workflow
<skill-base-dir>/bin/ds-ops guard status  # what is installed, what is stale
<skill-base-dir>/bin/ds-ops guard off     # remove, preserving unrelated hook entries
```

## The one rule: deterministic blocks, judgment comments

| Check | Kind | In CI |
|---|---|---|
| token CSS/JSON parity | deterministic | **block** |
| `audit` findings at `high`+ | deterministic | **block** |
| the 5-file component contract validator | deterministic | **block** |
| MDX-v3 syntax validator | deterministic | **block** |
| component reuse ("raw `<input type=checkbox>` where a component exists") | judgment | **comment** |
| slop scan (near-duplicate components, "just in case" props, dead stories) | judgment | **comment** |
| `audit` findings at `medium`/`low` | deterministic but noisy | **comment** |

A judgment check that blocks a merge on a false positive gets the whole check
disabled by the first engineer it inconveniences. Comment only.

## Branch scope

`guard` also installs the branch-scope policy from `reference/scope.md`: on a
`ds/*` or `story/*` branch, edits outside the design-system directories are
rejected pre-commit with a message pointing at a `feat/*` branch instead.

## Scorecard

Every CI run on `main` appends one line to `.ds-scorecard/history.jsonl`:

```json
{"ranAt":"…","commit":"…","ratios":{"raw-values-per-declared":0.04,"drift-per-component":0.0,"orphan-stories-per-story":0.11}}
```

Ratios, not counts — raw-value count rises with the codebase even when discipline
is perfect, and a trend line that punishes growth gets ignored. The file is
committed and the client owns it; the renewal conversation is `git log` on it.

## NEVER

- Wire a judgment check as a blocking check.
- Emit a bare count into the scorecard.
- Write the scorecard from a local run — CI on `main` only, or it is sparse and gameable.
- Overwrite an unrelated pre-commit hook entry.
