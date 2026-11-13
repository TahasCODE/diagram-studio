# Diagram Studio UI redesign

The React/TypeScript component structure, Java backend, account flows, persistence,
publication snapshots and diagram schema are retained. No dependencies were added.

## Design system

`src/styles/tokens.css` defines the green 50–900 brand scale, tinted neutrals,
semantic colors, light/dark surfaces, Inter 400/500/600, the 12–36px type scale,
11px section labels, spacing, radii and elevations. Layout and component styles
are separated into reusable stylesheets, imported by the existing `style.css`.

Primary text, muted text, subtle text, primary-button text and error text were
checked in both themes; sampled text combinations meet the 4.5:1 AA threshold.
Controls have visible focus rings and invalid-field states. Reduced-motion
preferences disable animation and transitions.

## Before and after

- **Shell:** inconsistent spacing and action weights → a 56px header, quiet save
  status, clear secondary/primary actions and consistent navigation.
- **Inspector:** dense forms and stacked mobile content → 40px fields, segmented
  tabs and a focus-managed, dismissible drawer below 1024px. Mobile navigation
  remains available as a bottom bar; modal drawers make the background inert.
- **Canvas:** straight diagonal arrows and a static zoom label → rounded orthogonal
  routes, obstacle-aware branch-label placement, working zoom/pan/fit and a minimap.
- **Nodes:** inconsistent states → shared dimensions, topology-derived type icons,
  selected handles and a current-step marker. Type icons are presentation only.
- **Counts:** ambiguous steps versus nodes → explicitly named active-path steps and
  whole-diagram node totals, derived from the current document.
- **Feedback:** static footer notices → dismissible, auto-dismissing toasts that
  pause on hover/focus and can repeat the same message.

Arrange Nodes now places connected levels left to right, adapting to narrow
viewports and preserving every scenario and step. Checked-in examples use this
layout; existing saved projects retain their authored positions until arranged.
Edges and branch labels reflect actual scenario routes, not inferred business
decisions. Narrow canvases prioritize readable nodes with pan/fit controls; branch
labels are suppressed when space is insufficient, with the active scenario still
identified in metadata and the inspector.

## Verification

Local browser checks exercise 1440px, 1024px and 390px viewports in both themes,
drawer focus/Escape handling, zoom/fit, editing, undo, Ctrl/Cmd+S, notifications,
playback, dragging, import/export and theme persistence. Screenshots are generated
under ignored `.runtime/` files by `tests/design.spec.ts`.

The full CI suite also verifies real account/password flows, project conflicts,
publishing, remixing, API contracts, PostgreSQL integration and Windows startup.
Use `npm run dev` to review changes immediately. The packaged application receives
the updated bundle on the next normal build/start.
