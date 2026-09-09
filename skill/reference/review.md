# review

Full component audit against the library's own bar. Returns severity-ranked
findings (BLOCKING / HIGH / MEDIUM / LOW), each self-contained: location, problem,
fix. Verdict is binary — READY TO MERGE or CHANGES REQUIRED, never qualified.

Scopes — pick one before starting:

- `quick` — automated checks only (small PR: a prop default, a copy tweak).
- `pr` (default) — all mechanical groups below, no Phase 0.
- `full` — Phase 0 (`shape`) first, then all groups. New components / major API changes only.

## Mechanical groups

### A — Component API

- **A1 forwardRef** — typed `forwardRef<El, Props>` for non-generic (default);
  `forwardRef<any, any>` + cast only for polymorphic. `displayName` always set.
- **A2 prop naming** — booleans `is<Condition>` or clear adjectives; `onClick` not
  `onPress`; `@deprecated` JSDoc on deprecated props; discriminated unions for
  mutually exclusive prop sets.
- **A3 token-only styling** — no raw hex / px / rem / ms / cubic-bezier. Colours
  `hsl(var(--…))`, shadows `var(--…)`, motion `--…-duration-*`.
- **A5 import isolation** — no imports from app code. The library is standalone.
- **A6 export completeness** — component, props type, every public union type
  exported from the barrel.
- **A7 restraint** — count the *added* public API. Soft cap = WARN + written
  justification; hard cap = FAIL. props 12/18, variant 4/6, size 4/5, tone 6/8,
  boolean 5/8. Name the cut concretely: "remove `isCompact`, fold into `size='sm'`".
  "Just in case" prop with zero usages → FAIL next review. `<X primary />` sugar
  for `variant="primary"` → FAIL. Optional prop passed in 100% of call sites →
  make it required.

### B / C — Stories

- Main story: `Default` + `Playground` always; `UsageMap` for compound/form
  components; JSDoc on `meta` with description, Import line, When to use / not / Composition.
  **No `tags: ['autodocs']`** if a guidelines MDX exists.
- Features story: title ends `/Features`, `tags: ['!autodocs']`. `VariantMatrix`
  shows every permutation (group only if > 24, comment the rationale). `States`
  covers default / hover / focus / disabled (+ loading / error when they exist).
  `play()` story for any keyboard contract.

### D — Guidelines MDX

- `<Meta of={Stories} />` only. Import path is the fixed depth for the repo.
- MDX-v3 parse safety: no bare `*` in `<code>`, no backticks in headings, no HTML
  `<table>` in JSX, no bare `<` / `>` in prose.
- Sections tiered: primitive = Overview / When / When not / A11y / Token alignment
  / canvases. Compound = the full set incl. Anatomy, Behavior, Governance.

### E — Accessibility contract

Focus ring token; keyboard contract; colour is not the sole state signal; ARIA
completeness; form-control association; contrast (4.5 / 3:1 — a failing token
*pair* is a token bug, flag and defer); touch target ≥ 44×44; motion respects
`prefers-reduced-motion`; overlays trap and return focus.

### F — Design engineering

No animation on interactions used 10+×/day; entering `ease-out`, exiting `ease-in`,
no `transition: all`; duration ≤ 300ms via tokens; scale from `0.95` not `0`;
press feedback (`active:scale-[0.97]`) on tactile components only, never form controls.

## Output

```
━━━ <Component> — Design System Review ━━━
  VERDICT   CHANGES REQUIRED
  Blocking 2 · High 3 · Medium 1 · Low 1
━━━ BLOCKING ━━━
  ✗ [A5] cue-x.tsx:19 imports from app/common — move the shared type into the library.
  ...
━━━ PASSING ━━━
  ✓ 22/27 checks passed
  ⊘ N/A: F1 (display-only) · C6 (no keyboard contract)
```

## NEVER

- Qualify the verdict.
- Report a finding without a concrete fix.
- Run `full` scope on an existing component — Phase 0 is wasted there.
- Flag typed `forwardRef` on a non-generic component as a violation.
