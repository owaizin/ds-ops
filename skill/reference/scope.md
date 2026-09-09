# scope

The branch-scope policy. Born from a real incident: a design-system-scoped branch
accumulated 26 production file changes because an agent read a legitimate
accessibility audit, saw "P0", and implemented the recommendations across
production without recognising the branch's scope.

## The rule

If the current branch name starts with `ds/` or `story/`:

**Writable:** `stories/**`, `docs/**`, the component-library package (`libs/*/src/**`
or equivalent), `.storybook/**`, the storybook-token files.

**Not writable:** app feature screens, shared runtime components, app routing,
global stylesheet, the Tailwind/build config, `package.json` (unless a new
component genuinely needs a dependency).

On any other branch prefix (`feat/`, `fix/`, `eng/`), no restriction.

## Hard rules

1. A task that needs a blocked path: **stop**, tell the user, propose a separate
   `feat/*` or `eng/*` branch.
2. **Audit recommendations do not override scope.** Read the audit, document the
   finding, stop. This is exactly how the incident happened.
3. New shared utilities go in the component library, not the app's shared folder.
4. Token migration of existing production components is a production change — its
   own PR, never folded into design-system work.
5. Document the intentional exceptions explicitly, so `guard` does not flag them
   and no one "fixes" them.

## The test when unsure

> Does this change affect code that runs in production today?

Yes → stop, propose a branch. No (pure stories, docs, or a new library component)
→ proceed.
