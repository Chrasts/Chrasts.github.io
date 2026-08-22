# Phase 0 — stability contract

This document records the assumptions of the current renderer before the scene architecture is formalised.

It is intentionally not a cleanup plan. Historical CSS/JS layers remain in place until the transition behaviour is stable enough to migrate deliberately.

## Runtime ownership

### `site-data.js`

Owns the profile graph and Work data consumed by the shared renderer.

### `site-graph.js`

Owns the canonical graph state, route rendering, visible-node selection, deterministic layouts, Atlas camera, Work FCA graph, node/edge DOM and detail-panel state.

Current graph modes are:

- `overview`
- `focus`
- `work`
- `atlas`

`document.body.dataset.graphMode` and `document.body.dataset.graphRoute` are the public runtime indicators used by the later layers.

### `graph-transition-prelude.js`

Compatibility/patch layer loaded before the shared renderer. It currently patches selected data labels, loads graph CSS layers, boots the mobile layer at `<= 900px`, and contains Work/Atlas interaction compatibility behaviour.

Do not move renderer ownership into this file during Phase 0.

### `graph-transitions-v6.js`

Owns Focus/Overview/Work route-transition choreography. It assumes one route transition at a time and uses `.v9-transition-overlay` as a temporary visual layer.

The live graph renderer remains the canonical final DOM. The overlay must be removed after every transition.

### `mobile-app.js`

Loaded only after entering the `<= 900px` breakpoint. It projects canonical desktop graph coordinates into a portrait-friendly plane, adds local pan/zoom, adapts Work/Atlas controls into a mobile sheet, and contains defensive layout repair.

The canonical data/layout coordinates continue to come from the desktop renderer. Mobile should transform/present them, not redefine desktop layout semantics.

### CSS layers

`styles.css`, `graph-v5.css`, `graph-v8.css`, `graph-v9.css`, `mobile.css`, and `mobile-v2.css` currently form an ordered compatibility stack.

Do not merge these files in Phase 0. CSS consolidation belongs to the later cleanup phase after scene/transition ownership has been formalised.

## Phase 0 invariants

1. The live renderer is the source of truth after a transition finishes.
2. `.v9-transition-overlay` never survives a completed transition.
3. A user activation cannot start a second graph route transition while one is already running.
4. Nodes in the live graph have unique `data-node-id` values.
5. Every live edge references two currently rendered live nodes.
6. Work remains an FCA-derived concept graph; filters do not mutate the underlying profile ontology.
7. Atlas retains its own camera/pan/zoom semantics and is not passed through the local mobile projection.
8. Mobile projection does not permanently modify desktop behaviour.
9. Crossing from a booted mobile runtime back to desktop currently performs a clean reload. This is a temporary Phase 0 guard, to be replaced by explicit mount/unmount lifecycle in Phase 1.
10. Reduced-motion users receive state changes without dependence on the animated overlay.

## Manual smoke-test matrix

Run these after changes to renderer, transitions, layout, routing, or mobile code.

### Desktop

- Fresh load at `#overview`.
- Overview -> each first-level branch -> Overview.
- Deep Focus navigation down at least three levels, then back up.
- Rapid repeated clicks during a transition: only the first route activation should take effect until the transition completes.
- Enter Work, change Context, select one Theme, select several Themes with Any/All, reset filters.
- Open a Work concept and a project detail; close with the close button and Escape.
- Enter Atlas, pan, zoom by wheel/buttons, Fit all, Reset view.
- Toggle Hierarchy, Cross-links, Secondary relations, Structure only, All relations.
- Pin/unpin the root and another Atlas node.
- Leave Atlas for a Focus route and return.
- Browser refresh on representative deep routes.

### Mobile portrait

Test at a real narrow viewport rather than only CSS device emulation when possible.

- Fresh load in portrait.
- Overview graph is readable and does not collapse onto one point.
- Navigate repeatedly among Overview, Focus, Work, and Atlas.
- Local one-finger pan works without accidental node activation.
- Local pinch zoom works and keeps the graph recoverable via Center.
- Work controls open in the mobile sheet and all filter controls remain usable.
- Atlas one-finger pan remains owned by the Atlas renderer.
- Atlas pinch zoom works through the Atlas zoom controls.
- Orientation change does not collapse the layout.
- No page scrolling becomes necessary for normal graph navigation.

### Breakpoint crossing

- Start desktop, narrow below 900px: mobile runtime should boot.
- Start mobile or after mobile has booted, widen above 900px: page should reload once into a clean desktop runtime.
- After the reload, desktop graph pan/click behaviour must not be affected by mobile gesture handlers.

### Transition visual checks

For down, up, and lateral navigation:

- obsolete old edges disappear at transition start;
- no future edge flashes before entering nodes become visible;
- persistent path nodes move continuously rather than teleporting;
- final live edges agree with final live node geometry;
- there is no visible handoff jump when the overlay is removed;
- controls remain clickable after completion;
- no `.v9-transition-overlay` remains in the DOM.

## Diagnostic helper

`phase0-stability.js` exposes:

```js
ProfilePhase0.checkGraphInvariants()
```

Run it in DevTools after representative navigation. Expected healthy values:

- `duplicateNodeIds: []`
- `orphanEdgeCount: 0`
- `transitioning: false` after the animation settles
- `mobileRuntimeBooted: false` on a clean desktop load

## Deferred deliberately

The following are **not** Phase 0 work:

- merging historical graph CSS files;
- replacing the current renderer with SceneManager;
- extracting a general Camera class;
- rewriting transitions around a new coordinator;
- removing all legacy compatibility code;
- building bespoke rich project scenes;
- semantic Atlas LOD.

Those changes should happen only after this base passes the smoke-test matrix reliably.
