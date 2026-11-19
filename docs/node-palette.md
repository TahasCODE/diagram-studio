# Visual component palette

Open **Editor → Component Palette**. Click Client, API, Service, Database,
Cache, Queue or Decision to add a component. On desktop, drag a palette button
onto the canvas to choose its position. Drops account for zoom and pan, and keep
the node inside the canvas. Touch and keyboard users can use the same buttons.

New components get distinct icons and a unique default label. Select a node and
use **Selected Node Type** to change its kind. **Automatic (from flow)** retains
the original start/process/decision/end inference from scenario connections.
The palette can be collapsed; the existing Add Node action is still available.

Adding a node does not add it to a scenario automatically. Use Append Node or the
existing step tools to choose where it appears in a path. Undo/redo and the
500-node limit apply to click and drag additions. Read-only viewers cannot add
or retype nodes.

## Compatibility and evidence

An optional `type` field is stored in the existing JSON document. Older diagrams,
imports and snapshots remain valid with no type. Unknown explicit types are
rejected by both parsers; the Java API validates the same seven values. No schema
migration or dependency is required. Save, restore, remix, JSON import/export and
publications preserve the field. Three-way conflict review treats it as a separate
editable field; revision comparison reports type changes. SVG and PNG exports
include the explicit component glyph.

Evidence: `src/lib/nodeTypes.test.ts` checks serialization, legacy compatibility,
merge preservation, revision detection and defaults. `DiagramDocumentTest` checks
server validation; `BackendWorkflowIT` persists an explicitly typed node through
the real PostgreSQL workflow. `tests/palette.spec.ts` checks click and zoomed drop,
undo/redo, saves, reload, publication snapshots and mobile/light/dark layouts.

Scenario comparison is a separate follow-up and is not included in this change.
