# census

Component inventory. Scan the component library and its consumers, cluster
near-duplicate components, rank by usage × blast radius.

Status: **planned.** The clusterer engine is not built yet — see
[../../docs/METHODOLOGY.md](../../docs/METHODOLOGY.md) §"the three engines".

## Intended shape

1. Enumerate every component in the library and every hand-rolled primitive in
   consumer code (`<button class=…>`, bespoke `<input type=checkbox>` wrappers).
2. Cluster by structural + prop-shape similarity: "these four are all a button".
3. For each cluster, rank members by import count (usage) and by how many screens
   break if it changes (blast radius).
4. Output an inventory table + a de-duplication map: which implementation becomes
   canonical, which get migrated, which stay separate because their intent differs.

## Rule that carries over

Only consolidate things used 3+ times with the **same intent**. Two buttons that
look alike but serve different purposes stay separate. Premature abstraction is
worse than duplication.
