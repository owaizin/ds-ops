# drift

`audit` against a committed baseline. Same rule set, diff mode: report only what
regressed since the baseline was captured.

Status: **planned.** Needs a baseline format (`.ds-ops/baseline.json`) and a diff
of finding sets keyed on `ruleId` + `where`.

## Intended shape

```bash
<skill-base-dir>/bin/ds-ops drift <source> --baseline .ds-ops/baseline.json
```

- New finding not in the baseline → **regression**, reported.
- Baseline finding now absent → **fixed**, noted.
- Unchanged finding → suppressed (it is already tracked).

`drift` is the watch-mode framing of the analyzer: the same detector that runs
once at t=0 for the audit runs continuously here against what was true before.
Wire it via `guard`.
