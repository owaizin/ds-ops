# extract

Pull a repeated pattern out of consumer code and into the system as a proper
5-file component, then migrate the call sites.

Status: **planned.** Overlaps impeccable's `extract`; ds-ops's version is
system-structure-first (it produces the 5 files and wires the registry), not
taste-first.

## Steps

1. **Discover the system.** Component organisation, naming conventions, token
   structure, import/export conventions. If no system exists, stop — run
   `discover` and `tokenize` first.
2. **Confirm the pattern earns extraction** — used 3+ times with the *same intent*.
   Two lookalikes with different purposes stay separate.
3. **`shape`** the component API from the real call sites. What varies across them
   is the variant/prop surface; what is constant is the default.
4. **`scaffold component`** — the 5 files.
5. **Migrate** every call site to the shared version. Test visual + functional parity.
6. **Delete** the old implementations. Update the registry `usedIn`.

## NEVER

- Extract a one-off without generalising it.
- Make a component so generic it is useless.
- Create a token for every value — tokens carry semantic meaning.
- Skip the migration and leave two implementations live.
