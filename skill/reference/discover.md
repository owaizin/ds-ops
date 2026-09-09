# discover

Produce `DESIGN-SYSTEM.md` — the durable context every other command branches on.
Interview the human for what only they know; scan the repo for everything else;
reconcile the two and record the conflicts.

## Output shape — non-negotiable

`DESIGN-SYSTEM.md` is YAML frontmatter followed by prose. Downstream commands read
the frontmatter and must never have to parse a paragraph. Every field below is
required (use `null` when genuinely unknown, never omit the key).

```yaml
---
schema: 1
stack:
  framework: react | vue | svelte | solid | angular | web-components | none
  language: ts | js
  meta_framework: next | remix | vite | astro | nuxt | none
css_strategy: tailwind | css-modules | vanilla-extract | styled-components | emotion | plain-css | sass
token_storage: css-custom-props | scss-maps | js-objects | style-dictionary | tokens-studio-json | none
token_layers: [palette, semantic, component, state]   # which layers actually exist today
theming:
  modes: [light, dark] | [light] | []
  mechanism: class | data-attribute | media-query | separate-stylesheet | none
  brand_count: 1
component_library:
  exists: true | false
  location: <path> | null
  count: <int> | null
  base_primitives: radix | ariakit | headless-ui | react-aria | mui | shadcn | none | custom
  story_tool: storybook | ladle | histoire | none
monorepo: true | false
package_manager: npm | pnpm | yarn | bun
build_tooling: [vite, tsc, biome, eslint, prettier, ...]
test_setup: [vitest, jest, node-test, playwright, chromatic, ...]
ci: github-actions | gitlab | circle | none
---
```

Prose sections underneath, for humans only:

- **Product & teams** — what the product is, how many teams consume the system, who owns it.
- **Adoption blockers** — the honest reasons the system is not used or not trusted.
- **Constraints** — anything that limits the solution: a legacy contract, a brand
  mandate, an accessibility floor, a platform that must stay supported.
- **Conflicts** — every place the interview and the scan disagreed, with which one won and why.

## Steps

1. **Scan first, quietly.** Detect framework, CSS strategy, token storage,
   component library location and size, story tool, monorepo layout, package
   manager, build/test/CI config. Fill as much frontmatter as the repo proves.
2. **Interview for the rest.** Ask only what the scan could not answer, as one
   numbered list: product & teams, who owns the system, adoption blockers,
   constraints, brand count, target theming modes. Do not ask what you already know.
3. **Reconcile.** Where the human's answer contradicts the scan (`"we use CSS
   Modules"` vs. 60% of new files are Tailwind), the scan wins for the frontmatter
   value; record the contradiction in the Conflicts prose.
4. **Version it.** `schema: 1`. When a later engagement needs a field this schema
   lacks, bump to `schema: 2` and make downstream commands tolerate both.
5. Write the file at repo root. Offer `census` and `audit` as the next steps.

## NEVER

- Omit a frontmatter key because the value is unknown — use `null`.
- Write prose a downstream command needs to parse — if a command branches on it,
  it is a frontmatter field.
- Trust the interview over the repo for a fact the repo can prove.
- Proceed to `scaffold` or `tokenize` before this file exists.
