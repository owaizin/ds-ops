# scaffold

Generate the structural skeleton: the Storybook spine, the foundations pages, the
5-file component contract, the validators.

Status: **planned** (generator engine). The spec it builds to is
[../../docs/METHODOLOGY.md](../../docs/METHODOLOGY.md) §5.

## `scaffold storybook`

- The sidebar spine, pinned in `storySort`: Overview → Foundations → Content
  Guidelines → Primitives → Components (by category) → Patterns → Pages.
- Foundations pages generated *from the tokens*, not hand-maintained tables.
- The three migration lanes with their coloured banners (canonical / preview / legacy).
- Theme toggle in the toolbar; `.dark` class + `data-theme` hoisted to `<html>`.

## `scaffold component <Name> <category>`

The 5 files, in order, with the accessibility baseline and token-only styling
already wired:

1. `lib/<name>.tsx` — typed `forwardRef`, `displayName`, tokens only.
2. `lib/index.ts` — export component + props type + every public union type.
3. `stories/<Name>.stories.tsx` — `Default`, `Playground`, `UsageMap`; JSDoc on meta; no `autodocs`.
4. `stories/<Name>.features.stories.tsx` — `VariantMatrix`, `States`, `play()`; `tags: ['!autodocs']`.
5. `stories/components/<category>/<Name>-guidelines.mdx` — the tiered section set.

Run `shape <Name>` first. Then `review <Name>` before the PR.

## `scaffold validators`

The build-failing checks: 5-file contract, MDX-v3 syntax, MDX story-ref integrity,
token parity, reuse (comment-only). One `validate` script runs them all.
