# V3.1 Phase I — Atlas / Focus Unification

## Roadmap target

Phase I removes the experiential boundary between the global Atlas and local Focus states.

The V3.1 acceptance target is:

- shared-node transitions;
- direct Atlas entry;
- Focus → Atlas reconstruction;
- route continuity;
- camera continuity;
- Atlas and Focus should read as scale changes inside one environment, not separate screens linked by navigation.

The preferred reverse transition is a pull outward from local context into the larger Atlas topology. Direct Atlas navigation is allowed after `ATLAS_READY` once transition coordination is reliable.

## Ownership boundary

`ProfileAtlasFocus` owns only semantic transitions that cross the Atlas / Focus boundary:

- Atlas → a routable Focus node;
- Focus → Atlas.

It does **not** own:

- Overview ↔ Atlas;
- Overview / Focus local navigation;
- Work lattice navigation;
- canonical graph topology;
- canonical node coordinates;
- ordinary Atlas pan/zoom;
- Phase J graph-feel integration.

`site-graph.js`, `ProfileGeometry`, `ProfileAtlasLOD`, `ProfileCameraComposition`, and the scene transition coordinator remain the corresponding canonical owners.

## Why a screen-space bridge

Atlas and Focus use the same semantic nodes but not the same rendering coordinate frame:

- Atlas has its own large canonical geometry and camera transform;
- Focus has a compact local geometry and local camera/viewBox;
- the existing V9 local transition overlay assumes compatible graph-local coordinates.

Simply enabling the V9 overlay for Atlas would therefore introduce a visible coordinate/camera jump.

Phase I instead captures a **bounded semantic subset** in screen space using each live node's `getScreenCTM()` and temporarily renders only that material while the canonical graph changes state underneath it.

The bridge:

- contains at most 14 semantic nodes;
- always includes the anchor;
- prefers its primary ancestry, children and typed neighbours;
- never clones the full Atlas;
- never writes canonical `data-x` / `data-y`;
- disappears completely after handoff.

The real graph remains mounted and measurable during the bridge. It is visually hidden only while the bridge owns presentation.

## Atlas → Focus semantics

The first activation of an Atlas node retains the existing inspect behaviour.

A transition to Focus occurs when the visitor explicitly asks for local scale through any of these equivalent paths:

1. re-activate an already selected routable Atlas node;
2. use the Atlas inspector action;
3. use a route control from Atlas whose destination is a Focus route.

All three paths go through the same `ProfileAtlasFocus` owner.

The selected semantic node remains the material anchor while surrounding context contracts, moves, fades or emerges around it.

## Focus → Atlas reconstruction

The permanent Atlas action from Focus is intercepted by the same owner.

The local semantic subset is captured, the route changes to Atlas, the canonical Atlas is allowed to settle, and the Atlas camera is focused around the same anchor through the existing camera composition API. The bridge then interpolates into that reconstructed context.

This preserves the intended reading:

> local context contracts outward into the larger topology

rather than:

> leave page A and open page B.

## Route and browser-history continuity

Normal transitions use the existing hash routes. No parallel routing model is introduced.

Back/Forward transitions are detected at `popstate` while the previous semantic mode is still available, allowing the same Atlas / Focus bridge to be used for browser-history traversal.

Stable deep links remain unchanged.

## Transition coordination and interruption

Phase I uses `ProfileScene.transitions` as the single transition lock.

It registers `atlas-focus-unification` as a transition participant so an in-flight bridge can be interrupted by a newer semantic transition without leaving:

- a stale overlay;
- a hidden canonical graph;
- an orphaned transition token;
- stale body ownership markers.

It does not introduce a second global transition coordinator.

## Camera continuity

On Atlas reconstruction, camera positioning is delegated to `ProfileCameraComposition` when available, with `ProfileAtlasLOD.focusNode()` as a compatibility fallback.

On Focus entry, the existing desktop-local camera remains canonical. Phase I does not invent a separate Focus camera state.

## Reduced motion

Reduced motion preserves the same semantic transition:

- route changes normally;
- canonical geometry recomposes;
- the destination camera is stabilized;
- the same anchor and final state are retained;
- the long bridge flight is skipped.

This is a semantic equivalent, not a disabled/broken transition.

## Accessibility

- Enter / Space on a selected Atlas node uses the same semantic owner as pointer activation.
- Route controls retain normal semantic destinations.
- Temporary bridge material is `aria-hidden` and non-interactive.
- After a completed transition, focus returns to the live semantic anchor rather than a clone.

## Performance

There is no permanent Phase I frame loop.

Animation runs only during a boundary transition. The bridge is capped at 14 nodes and a bounded relation set, so transition cost is independent of total Atlas size beyond the initial semantic-subset lookup.

## Regression contracts

`tests/atlas-focus-unification.spec.js` covers:

- first-click inspect vs repeated-activation entry;
- Atlas inspector entry;
- direct Atlas route entry;
- Focus → Atlas reconstruction around the same anchor;
- absence of the old Atlas snapshot/V9 boundary during Phase I transitions;
- Back/Forward continuity;
- reduced-motion semantic equivalence.

The older Phase 7 repeated-click test is rebaselined from camera-only zoom to the Phase I semantic-scale contract.

## Non-goals

Phase I deliberately does not solve:

- final ordinary-navigation motion quality — Phase J;
- comprehensive mobile/accessibility/performance audit — Phase K;
- spatial origin/history memory — Phase S;
- deep URL-addressable scene state — Phase T.
