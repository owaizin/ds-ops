# The methodology ds-ops automates

> This is the seed spec. Every engine and skill in `ds-ops` exists to execute one
> step of the engagement below with less human time and no drift. Distilled from
> **CUE** (Cone Universal Experience), a code-first design system for a dense
> multi-product SaaS, cross-checked against Polaris, Primer, Spectrum, Carbon, ADS.
>
> Read the principle, then the mechanism. The mechanism is what the tool ships.

The one-sentence thesis:

> A design system is not a box of parts. It is a set of rules that produces the
> parts. Fix the rules first: the shared values before the components, the
> low-level values before the patterns, the system before any single screen.
> Every change — human-written or AI-generated — goes through the same checks.

## Relationship to `design-system-ops` (Murphy Trueman)

[`design-system-ops`](https://github.com/murphytrueman/design-system-ops) is a
mature Claude Code skill pack covering the practitioner side of running a system —
40 LLM-driven skills for auditing, governance, documentation, and stakeholder
communication, plus 12 knowledge notes. This document does **not** re-derive that.
For contribution workflows, deprecation process, decision records, adoption
reporting, onboarding, and the maturity model, use that pack.

ds-ops is the **deterministic layer** it does not have: math, not prompts —
CIEDE2000 sweeps, tier-reference checks, provenance records, a calibration corpus.
The token model, severity vocabulary, and `.ds-ops-config.yml` format here are
kept compatible with that pack on purpose.

---

## The engagement, and which engine owns each phase

| Phase | Human work | ds-ops engine / mode |
| --- | --- | --- |
| 1. Discovery | interview + repo scan → `DS-CONTEXT` (YAML frontmatter every downstream skill branches on, prose underneath) | analyzer `scan` (repo facts) |
| 2. Token audit | every hardcoded color/space/type/shadow → proposed primitive+semantic scale + drift report | **analyzer `sweep` / `scan`** ← v0 |
| 3. Component inventory | census, cluster duplicates, rank by usage × blast radius | clusterer one-shot |
| 4. Scaffold | Storybook + sidebar spine + foundations pages + 5-file contract + validators | generator |
| 5. Pilot | migrate one surface end-to-end, before/after scorecard | human, tool-assisted |
| 6. Guardrails | token-parity (block), structure validator (block), reuse (comment), slop (comment) | analyzer + clusterer watch mode |
| 7. Exit | engineer takes ownership: green CI, populated Storybook, skills installed in their repo, scorecard baseline committed | generator |
| ongoing | `new-component` (Phase 0 interrogation), `component-review`, `token-review`, `slop-check` | skills |

---

## 1. Token architecture — four layers, in dependency order

```
Palette   →   Semantic   →   Component   →   State
(raw)         (role)         (part)          (interaction)
```

Each layer references only the layer above it via `var()`, **strictly downward**:
component → semantic → primitive. A semantic token holding a raw hex is a bug
(`color/semantic-holds-literal`). A component token referencing a primitive
directly — skipping the semantic tier — is **tier leakage** (`token/tier-leakage`):
the value is right but theme propagation and rebrand are broken. A semantic token
named for its appearance (`color.action.blue`) is "a primitive with extra steps"
(`token/semantic-name-describes-appearance`) — the exception is category /
chart-series tokens, where the colour name is the identity.

**Primitive** naming says *what it is* (`color.blue.500`); **semantic** says
*what it is for* (`color.action.primary`); **component** scopes intent to a widget
(`button.background.default`). Reserved from semantic names: colour names, size
words (`small`/`large`), generic qualifiers (`main`/`base`).

**One source of truth, two files, kept in lockstep.** Tokens live in a `.css`
(the runtime) and a **DTCG 2025.10** `.json` (`$value`, `$type` from the 13 formal
types, `$extensions.css` — what every other tool reads: Figma sync, Style
Dictionary, doc generators; composite tokens need sub-value compliance, a resolver
mode missing a value is a coverage gap). A CI check diffs the two per namespace on
every PR. They change together or neither changes.

**Naming grammar.** Colors: `--{ns}-color-{relationship}-{role}-{state}` where
relationship ∈ `bg · text · border · icon`. Typography:
`--{ns}-type-{role}-{size}-{property}`, roles ∈
`display · heading · body · label · overline · metric · code`, `display` is
single-purpose. Frozen scales (spacing 1–11, a fixed elevation ladder) need
sign-off, not a PR comment.

**The token-review gate** (before any token PR): scope compliance (no component
files touched), no dangling references, CSS/JSON parity, no raw values in
semantic/composite tokens, primitives never renamed without a paired migration.
Duplicate semantic roles are *flagged for design review, not auto-rejected* — two
roles resolving identically can be a documented compromise, but the doc must say so.

---

## 2. The component contract — one component, five files, always

1. `lib/<name>.tsx` — the component
2. `lib/index.ts` — public surface: component + props type + every public union type
3. `stories/<Name>.stories.tsx` — `Default`, `Playground`, `UsageMap`
4. `stories/<Name>.features.stories.tsx` — exhaustive matrices, `tags: ['!autodocs']`
5. `stories/components/<category>/<Name>-guidelines.mdx` — the docs page

A validator fails the build if any of the five is missing. No component ships
half-documented, because "document it later" never happens.

**Library isolation is absolute.** The lib is headless and standalone — zero
imports from the app. Enforced by grep. If a new component needs something only in
the app, move that thing into the lib; never add an adapter that reaches back.

**Token-only styling.** No raw hex / px / rem / ms / cubic-bezier in a component
file — grep-enforced. Everything is a token.

---

## 3. The restraint doctrine

> Less, but better. Default review stance: skeptical of additions. Configurability
> is a liability — every prop has a documentation, test, and misuse cost.

API-surface caps, calibrated against the library's own worst offenders once it has
~50 components (CUE's numbers, per component's *added* public API):

| Dimension | Soft cap (justify in writing) | Hard cap (fails review) |
| --- | --- | --- |
| Props | > 12 | > 18 |
| `variant` | > 4 | > 6 |
| `size` | > 4 | > 5 |
| `tone` / `color` | > 6 | > 8 |
| Boolean flags | > 5 | > 8 |

Heuristics: many booleans = a missing variant. A "just in case" prop with no usage
site → delete it. `<X primary />` sugar for `variant="primary"` → delete it. An
optional prop passed in 100% of call sites → make it required. If the author
cannot name one thing they cut during design, the design isn't finished — run the
caps strictly.

---

## 4. Accessibility baseline — non-negotiable, from the first commit

"We'll add a11y later" is a stop-the-line. The eight checks: focus ring token on
every interactive element; keyboard contract (Enter/Space, Escape); non-color
state signal; ARIA completeness; form-control association (`htmlFor`+`id`,
`aria-describedby`, `aria-invalid`, `aria-required`); contrast (4.5 / 3:1) —
a failing token *pair* is a token bug, not a usage bug; 44×44 touch target;
motion respects `prefers-reduced-motion` via the motion tokens themselves.

---

## 5. Storybook organization

Sidebar spine, pinned explicitly in `storySort`: Overview → Foundations →
Content Guidelines → Primitives → Components (by category) → Patterns → Pages.

**Migration lanes, not big-bang.** Run the canonical lane, a `Preview` migration
lane (amber banner), and a legacy lane (red banner) simultaneously via a global
decorator. Move screens across one at a time.

**Story types**: `Default` + `Playground` always; `VariantMatrix` showing *every*
permutation (group only if > 24, with a commented rationale); `States`
(default/hover/focus/disabled + loading/error); `Interaction` with `play()` for
any keyboard contract; `UsageMap` for compound components.

- The MDX guidelines file *is* the docs page — never `tags: ['autodocs']` beside it.
- Storybook is product QA, not demo art. Real copy, realistic widths. An "awkward"
  story is a real signal — wrong contract or wrong layout mode; fix at source.

**MDX v3 is a minefield** — ~10 patterns fail silently ("Unable to index"): bare
`*` in `<code>`, backticks in headings, HTML `<table>` in JSX, `<Meta title>` vs
`<Meta of>`, bare `<`/`>` in prose, wrong import-path depth. Codify them in an
`AGENTS.md` next to the files *and* a regex validator.

---

## 6. Governance & scope — from a real incident

> A design-system-scoped branch accumulated 26 production file changes because an
> agent read a legitimate accessibility audit, saw "P0", and implemented the
> recommendations across production without recognising the branch's scope.

**The fix**: directory-scoped, branch-aware `AGENTS.md` / `CLAUDE.md`. If the
branch is `story/*` or `ds/*`, only `stories/**`, `docs/**`, `<lib>/**`,
`.storybook/**` are writable. Audit recommendations **do not override scope** —
document the finding, stop, propose a separate branch. Document the intentional
exceptions explicitly.

**Reuse enforcement**: a build-failing check greps for raw `<input type="checkbox">`
etc. where a system component exists. **Deterministic checks block; judgment checks
comment** — a reuse false-positive that blocks a merge gets the whole check
disabled.

---

## 7. Skills — executable playbooks

Three skills sharing one rulebook: `new-component` (Phase 0 interrogation →
scaffold), `component-review` (severity-ranked audit, scopes: quick / pr / full),
`token-review`. "This one creates, that one audits" — same thresholds, same check
IDs.

**Phase 0 interrogation** (before any file): need & gap, usage context (name 2–3
real screens), API (what did you *cut*?), composition, edge cases, accessibility,
governance. Weak answers are a signal to challenge, not to accept and build.

---

## 8. The measurement spine

The analyzer in watch mode emits a number per run — but always a **ratio**:
raw-values / total-declared-style-values, drift / component-count, orphan-stories
/ total-stories. Written to a **committed file in the client repo**
(`.ds-scorecard/history.jsonl`), emitted from CI on `main` (sparse and gameable
otherwise). The renewal conversation is `git log` on that file.

---

## Appendix — build order from zero

1. Repo shape: monorepo, headless `lib/` isolated by its own tsconfig, one
   formatter, CI running lint + type-check.
2. Primitive tokens (channels, `:root` only).
3. Semantic layer (every entry references a primitive).
4. The JSON mirror + the parity check — *before* the token count explodes.
5. Utility layer generated from the tokens (not a hand-kept parallel scale).
6. Storybook: spine pinned, theme toggle, Foundations pages generated from tokens.
7. Layout primitives first (Box, Stack, Inline, Grid, Icon, VisuallyHidden).
8. The 5-file contract + its validator — before component #2.
9. The MDX guidelines template + the MDX validator.
10. The three skills.
11. First 5–10 components via the scaffold — each hardens the skill.
12. Governance files, the reuse check, the lane banners.
13. The registry + dependency graph.
14. The content system (North Star, Canonical Vocabulary, Formatting Standards).
