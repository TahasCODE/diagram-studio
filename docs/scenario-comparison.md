# Scenario comparison

Open **Playback → Compare Scenarios** in an editable workspace or shared snapshot.
Choose distinct paths A and B. The view shows their matching opening steps,
unique shared nodes, and nodes visited only by one path. Shared badges describe
membership; they do not imply that a node occurs at the same position.

Use **Next Pair**, **Previous Pair**, or click a numbered step to inspect both
paths at that position. **Jump to Difference** selects the first unequal position,
including a position where the shorter path has ended. **Restart Comparison**
returns to position one. This is a comparison of step order, not timing or a
simulation of concurrent requests. Repeated visits count as steps, but node counts
count distinct IDs. Identical and empty paths have explicit states.

**Open Path A/B in Playback** closes comparison and opens that path at the selected
position, clamped to its final step. Closing comparison otherwise preserves the
existing player position. Escape restores focus to the comparison button.
On narrow screens the two paths stack in the scrollable dialog.

Comparison reads the existing diagram model without changing its nodes, scenario
steps, draft version or published snapshot. It needs no API, database migration
or dependency. Guided walkthroughs keep their existing choice flow and do not
offer comparison.

Validation lives in `src/lib/scenarioComparison.test.ts` and
`tests/scenario-comparison.spec.ts`: repeated/reordered nodes, equal and empty
paths, unequal lengths, guest shared snapshots, position handoff, focus restoration,
both themes and responsive layouts at 1440px, 1024px and 390px.
