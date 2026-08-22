# Radial global geometry contract

This document records the current global/local geometry and transition contract.

## Core rule

```text
GLOBAL      Atlas + Overview       one canonical asymmetric fan
LOCAL       focused branch         top -> bottom hierarchy
SEMANTIC    specialised scene      geometry owned by the content
```

## Canonical global compass — fan-v3

`Štěpán Chrast` is the geometric centre of Atlas and expanded Overview.

```text
          About                 Education
             ↖                 ↗

 Experience  ←────── Štěpán ─────────────→  Knowledge
                         |
                         ↓
                        Work
```

The current directions are intentional:

- **Work** exactly down;
- **Knowledge** the long right wing;
- **Education** upper-right;
- **About** upper-left;
- **Experience** left and slightly down.

`radial-geometry.js` now owns this layout directly. There is no intermediate runtime compass. `motion-polish.js` no longer rewrites global coordinates.

The public contract is:

```js
ProfileGeometry.snapshot().compassVersion === "fan-v3"
ProfileGeometry.compass
ProfileGeometry.sectionFor(nodeId)
ProfileGeometry.atlasPoint(nodeId)
ProfileGeometry.overviewPoint(nodeId)
ProfileGeometry.vectorBetween(sourceId, targetId)
ProfileGeometry.directionBetween(sourceId, targetId)
```

## Atlas geometry

Each territory is an outward rooted hierarchy rather than a concentric ring. Structural depth supplies the main radial direction and stable node IDs supply deterministic tangential/terminal variation.

Knowledge retains the largest terminal variance. Work remains deliberately regular because its global downward direction continues into the FCA scene.

The final Atlas coordinates receive a viewport-safe projection before they are exposed. Horizontal extent is preserved when possible while vertical extent is slightly compressed. This keeps the upper About/Education branches inside the SVG safe area and produces a wider global silhouette.

## Work exception

```text
Štěpán
   |
   ↓
 Work
   |
   ↓
FCA lattice ranks
```

The Work concept lattice remains vertically ordered and is not radialised.

## Overview and root semantics

Expanded Overview uses the first layer of the same fan. The five section directions therefore match the Atlas and the intro.

The central root is an identity interaction rather than hierarchy navigation. Clicking `Štěpán Chrast` opens the profile summary without changing route or graph geometry.

While Overview is the active root segment, the root has a subtle two-ring rotating orbit. The orbit fades out when navigation leaves Overview and is removed from the live root once it becomes an ancestor in a focused branch.

## Local focus labels

Focused branches keep their ordinary top-to-bottom structural geometry.

For the linear primary path above the active node, labels are placed to the **right** of their nodes:

```text
○  Štěpán Chrast
|
○  Knowledge
|
○  Mathematics & Logic
|
○  Mathematical Logic
|
○  Computational Logic
```

This avoids the old collision where labels below an ancestor overlapped the next node in the chain.

The final label pose is pinned while structural transitions settle. `motion-polish.js` interpolates transition-overlay labels toward that same pose, so the visible animation and the post-animation renderer agree instead of producing a one-frame label jump.

## Atlas boundary handoff

Atlas ↔ segmented navigation does not use the ordinary V9 parent/child transition.

The boundary now has a dedicated handoff:

```text
current rendered SVG snapshot
        -> route changes underneath
        -> target geometry fully settles
        -> snapshot fades/recedes
        -> settled live scene is revealed
```

This prevents the renderer from exposing intermediate Atlas, old global, and local layouts during the same transition.

Ordinary parent/child navigation inside segmented exploration remains owned by `graph-transitions-v6.js`.

## Intro integration

First-session flow:

```text
central Štěpán root only
        -> root orbit
        -> canonical fan-v3 Atlas grows outward
        -> Enter profile gateway appears
        -> explicit Enter profile
        -> territories condense
        -> root morphs into portrait identity
        -> portrait hands off to fan-v3 Overview
```

Non-root clone content is hidden before autoplay takes ownership, preventing the completed Atlas from flashing on the first paint.

The Enter gateway uses two real orbit elements rather than pseudo-element transform composition. Their rotation is independent from hover/focus scaling, so the ring keeps rotating in idle, hover and keyboard-focus states. The gateway disappears immediately after activation.

## Cross-link integration

Phase 6 consumes only the canonical `ProfileGeometry` positions. Cross-link travel therefore uses the same fan-v3 Atlas as the visible graph.

## Mobile

Mobile preserves territory ownership and compass directions with smaller Overview radii. The Atlas coordinates remain deterministic; the existing mobile/camera layer controls how they are framed on portrait screens.

## Renderer ownership

- `site-graph.js`: canonical graph DOM, route state, modes, Work lattice and Atlas camera.
- `radial-geometry.js`: the single canonical fan-v3 Atlas/Overview coordinate system.
- `motion-polish.js`: intro morph and structural label interpolation only; no global geometry wrapper.
- `intro-fixes-v3.js`: root inspector, right-side local path-label contract, root/gateway orbits and Atlas boundary handoff.
- `intro-animation.js`: condensation and portrait handoff.
- `intro-unfold.js`: automatic root-to-Atlas reveal.
- `graph-transitions-v6.js`: ordinary structural route transitions.
- `cross-link-travel-v2.js`: typed lateral relation travel.

## Regression expectations

Browser coverage checks:

1. Knowledge right, Education/About up and Work down;
2. Atlas nodes remain within a safe global envelope;
3. representative subtrees grow outward in fan-v3;
4. Work preserves vertical FCA order;
5. no completed-Atlas flash before autoplay;
6. Enter gateway rotates idle and hovered/focused, then disappears immediately;
7. portrait handoff remains in stable fan-v3 Overview positions;
8. deep primary-path labels stay on the right and remain stable after transitions;
9. root orbit exists only in expanded Overview;
10. Atlas boundary navigation uses the dedicated handoff rather than V9;
11. clicking the Overview root opens profile information without graph reorganisation.
