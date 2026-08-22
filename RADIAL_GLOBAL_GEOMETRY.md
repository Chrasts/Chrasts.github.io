# Radial global geometry contract

This document records the global/local geometry split introduced after Phase 6.

## Core rule

```text
GLOBAL      Atlas + Overview       radial territories
LOCAL       focused branch         top -> bottom hierarchy
SEMANTIC    specialised scene      geometry owned by the content
```

The radial geometry is intentionally not a universal replacement for every graph layout.

## Global compass

`Štěpán Chrast` is the geometric centre of both Overview and Atlas. The five first-level sections keep stable directions between those views.

```text
                 Knowledge
                    ↖

        About  ←   Štěpán   →  Experience
                    |
                    |       ↘ Education
                    ↓
                   Work
```

The canonical vectors live in `radial-geometry.js` and are exposed through `ProfileGeometry.compass`.

The important semantic choice is that **Work points exactly downward**. This preserves the same order direction when Work opens into its vertical FCA concept lattice.

Current compass semantics:

- Work: down;
- Knowledge: up / slightly left;
- Experience: up-right;
- Education: down-right;
- About: left / slightly down.

The exact angular spacing is allowed to be visually asymmetric. Semantic continuity and usable territory width take priority over a mathematically regular pentagon.

## Overview

Overview uses only the root and the five first-level section nodes.

The first ring is therefore a compact version of the Atlas geography rather than a separate layout. A visitor can learn where each territory is once and retain that spatial memory.

## Atlas subtrees

Atlas is not a concentric-circle tree.

Each first-level section owns an ordinary rooted hierarchy with its own outward axis. Structural depth becomes distance along that axis and siblings spread along the perpendicular tangent.

In particular:

- Work grows downward;
- Knowledge grows outward up-left;
- Experience grows outward up-right;
- Education grows outward down-right;
- About grows outward left/down-left.

Dense ranks may use a shallow radial stagger to avoid label collisions, but they remain recognisable as levels of one outward tree.

Work projects stay owned by the Work territory even though project nodes also have FCA theme parents.

## Entering a territory

The global direction is preserved during departure from Overview/Atlas. Once the user enters a normal local branch, the graph normalises to the shared top-to-bottom local coordinate system.

```text
radial global location
        -> spatial travel into territory
        -> top-to-bottom local exploration
```

This allows the global map to have strong geography without forcing rotated text, rotated detail panels or sideways deep hierarchies.

### Work exception

Work does not need a rotational normalisation because its global direction is already downward.

```text
Štěpán
   |
   ↓
 Work
   |
   ↓
FCA lattice ranks
```

The scene still changes coordinate system and scale, but the order direction remains continuous.

## Local and semantic scenes

The radial layer does not own local node coordinates.

Normal focused branches remain top-to-bottom. Special semantic scenes continue to use their own geometry, including:

- Work FCA lattice;
- Experience timeline;
- future Education document geometry;
- future Research Interests constellation;
- future rich project/media scenes.

This keeps the site architecture extensible rather than forcing every content type into a radial graph.

## Edge routing

In global views:

- root-to-section edges are direct radial connections;
- hierarchy edges follow the outward territory direction;
- typed cross-links curve away from the centre to reduce centre hairball pressure.

Phase 7 can add semantic LOD and relation filtering without changing this geometric contract.

## Intro integration

Phase 3 still clones the **real Atlas SVG**.

The first-session animation therefore uses exactly the same radial geometry:

```text
five outward trees around central Štěpán
        -> territories condense inward
        -> five section nodes
        -> central root
        -> photographic identity node
```

The `Enter profile` gateway sits on the actual central root. There is no intro-only fake coordinate system.

After the photographic identity is clicked, the five first-level nodes unfold back into the same Overview compass.

## Cross-link integration

Phase 6 uses the actual 2D Atlas geography rather than reducing movement to left/right.

`ProfileGeometry.vectorBetween(sourceId, targetId)` returns the normalised vector between the canonical Atlas positions of two connected nodes. Cross-link travel uses it for:

- departure direction;
- viewport portal selection;
- recession of the old scene;
- direction metadata such as `up-left`, `down-right`, `down`;
- arrival into the destination local context.

The target still opens in its normal local/semantic geometry.

## Mobile

Mobile keeps the same topology and section ownership. The existing mobile projection may compress or stretch the coordinate plane for a portrait viewport, but it does not redefine which territory is above, below, left or right of the root.

Local mobile scenes continue to use their established portrait projection.

## Renderer ownership

`site-graph.js` remains the canonical renderer for:

- node creation;
- route state;
- graph modes;
- Work lattice;
- Atlas camera;
- interaction semantics.

`radial-geometry.js` is a stabilisation layer over the real renderer. In Overview and Atlas it pins the real SVG nodes and edges to the global radial coordinates while the base renderer settles. It does not create a second graph.

`graph-transitions-v6.js` remains responsible for structural route transitions.

`cross-link-travel-v2.js` remains responsible for typed lateral/cross-territory travel.

## Public API

```js
ProfileGeometry.compass
ProfileGeometry.sectionFor(nodeId)
ProfileGeometry.atlasPoint(nodeId)
ProfileGeometry.overviewPoint(nodeId)
ProfileGeometry.vectorBetween(sourceId, targetId)
ProfileGeometry.directionBetween(sourceId, targetId)
ProfileGeometry.apply()
ProfileGeometry.stabilize()
ProfileGeometry.snapshot()
```

## Regression expectations

`tests/radial-geometry.spec.js` verifies:

1. central root and stable five-direction Overview compass;
2. Work exactly below the root;
3. outward growth of representative nodes in all five Atlas territories;
4. local Knowledge normalisation back to top-to-bottom;
5. downward continuity from global Work into the FCA lattice;
6. Phase 3 intro sourcing the same radial Atlas.

Phase 6 tests additionally verify that cross-link travel uses the resulting 2D vectors.
