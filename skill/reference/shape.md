# shape

Phase 0 design-intent interrogation, before a single file of a new component is
written. Weak answers are a signal to challenge — not to accept and build.

Ask all questions at once, as one numbered list. Do not proceed until they are
answered.

## Questions

1. **Need & gap** — what problem does this solve that no existing component
   handles? Which existing components did you evaluate and rule out? Why are they
   insufficient?
2. **Usage context** — name 2–3 specific screens or features where this appears.
   Is the consumer a product engineer, or design-system internals only?
3. **API** — variants / sizes / tones on day one vs. deferred to v2. The minimal
   prop surface. **What did you cut during design?** Name at least one prop,
   variant, or size that almost made it in. Are you within the caps (props ≤ 12,
   variants ≤ 4, sizes ≤ 4, tones ≤ 6, booleans ≤ 5)?
4. **Composition** — what wraps this (Card, Table row, Drawer)? What does it wrap?
   Behaviour on a dark surface, inside a compact density?
5. **Edge cases** — empty / null content, long text (truncate, wrap, overflow?),
   loading, error, RTL. Who owns each?
6. **Accessibility** — which HTML element or ARIA role does it map to? Interactive?
   Then: keyboard contract (Tab, Enter/Space, Escape). Does colour convey state —
   if so, the non-colour signal? Form control — label association, `aria-describedby`,
   `aria-invalid` from day one? Touch target ≥ 44×44? Contrast for every token pair?
7. **Governance** — what can a product team override without design review
   (className? a token?). What needs a design-system PR + sign-off?

## Evaluating answers

| Signal | Action |
|---|---|
| "Nothing does X" but an existing component does X | Stop. Show it. Challenge the need. |
| Variant/size/tone list over the soft cap on day one | Push back. Cut to the cap; extra ships later with a real use case. |
| Author cannot name anything cut | Push back. No cuts = no restraint applied = design not finished. |
| No specific screens named | Challenge. Components built without a usage context get over-engineered. |
| "It'll be used everywhere" | Red flag. Ask for one concrete example. |
| "We'll add a11y later" | Block. Not optional. |
| Touch target < 44×44 with no hit-area plan | Block. Pad, or document a density exception in the guidelines. |
| Polymorphic (`as` prop) with no semantic reason | Default to a fixed element. |

Only after satisfactory answers → hand off to `scaffold <component>` (or the
project's own new-component flow).

## NEVER

- Skip a question because the component "looks simple".
- Accept a vague answer silently.
- Start file creation before question 6 is answered.
