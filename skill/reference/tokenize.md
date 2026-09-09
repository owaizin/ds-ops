# tokenize

Turn a proposed scale (from `audit` / `sweep`, or from a design hand-off) into the
two-file token source of truth plus the parity check that keeps them honest.

Status: **planned** (generator engine).

## What it produces

1. **`tokens.css`** — the runtime. Primitives in `:root` as channels
   (`--ns-palette-slate-600: 215 19% 34%`), semantic tokens referencing them via
   `var()`, second-theme overrides guarded correctly.
2. **`tokens.json`** — W3C design-tokens format: `$value`, `$type`,
   `$extensions.css` pointing back at the CSS variable name. This is what Figma
   sync, Style Dictionary, and doc generators read.
3. **The parity check** — a script that extracts both files' tokens per namespace
   and diffs them. Wired into `guard` as a blocking check. They change together or
   neither changes.
4. **The dangling-reference check** — every `{token-ref}` in the JSON must resolve.

## Naming grammar it enforces

- Colours: `--ns-color-{bg|text|border|icon}-{role}-{state}`.
- Type: `--ns-type-{role}-{size}-{property}`, roles
  `display · heading · body · label · overline · metric · code`, `display` single-purpose.
- Frozen scales (spacing 1–11, a fixed elevation ladder) need sign-off to extend.

## NEVER

- Put a raw literal in a semantic or composite token.
- Rename a primitive without a paired migration.
- Ship the CSS without the JSON, or vice versa.
