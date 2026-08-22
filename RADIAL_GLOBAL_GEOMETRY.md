# Radial global geometry contract

This document records the global/local geometry split introduced after Phase 6.

## Core rule

The profile uses three geometry levels:

```text
GLOBAL      Atlas + Overview       radial territories
LOCAL       focused branch         top -> bottom hierarchy
SEMANTIC    specialised scene      geometry owned by the content
```

The radial geometry is therefore not a replacement for all graph layouts.

## Global compass

`Štěpán Chrast` is the geometric centre of both Overview and Atlas.

The five first-level sections have stable directions:

```text
                     Knowledge
                         ↑

Work  ←──────────── Štěpán ────────────→  Experience

                 ↙               ↘
              About             Education
```

The exact vectors live in `radial-geometry.js` and are exported through `ProfileGeometry.compass`.

Overview uses only this first ring. Atlas preserves the same angular memory and continues every section as an outward-oriented rooted hierarchy.

## Atlas subtrees

Atlas is not implemented as concentric circles.

Each territory remains an ordinary hierarchical tree with a local outward axis:

- Work grows left;
- Knowledge grows up;
- Experience grows right;
- Education grows down-right;
- About grows down-left.

Structural depth becomes distance along that section's axis. Siblings are distributed along the perpendicular tangent. Dense ranks receive only a small radial stagger to reduce label collisions.

This means every section remains visually recognisable as a tree while the five trees together form the global radial map.

## Spatial memory

Overview and Atlas intentionally share the same compass.

A user who learns that Knowledge is above the root or Work is left of the root does not have to relearn those locations between the two global views.

When a first-level section is opened, the structural transition starts from its global position. The destination local view is then normalised into the standard top-to-bottom hierarchy.

The resulting grammar is:

```text
radial global location
        -> travel into territory
        -> top-to-bottom local exploration
```

## Local views

`focus` mode remains top-to-bottom.

The radial layer explicitly restores the normal local label geometry when the renderer leaves Overview/Atlas. It does not rewrite local node coordinates.

This preserves the existing behaviour of:

- focused Knowledge/About/Education branches;
- Experience timeline handling;
- Work FCA lattice;
- future rich scene layouts.

## Work exception

The Work scene remains a formal concept lattice with its established vertical order.

The radial geometry applies only to Work as a territory in Overview/Atlas. Entering Work switches to the semantic Work lattice coordinate system.

## Edge routing

In global radial views:

- hierarchy edges follow the outward axis of their territory;
- root-to-section edges are direct radial connections;
- typed cross-links are curved away from the centre rather than being routed through the root.

This reduces centre hairball pressure without changing edge semantics.

Phase 7 can later add relation LOD/filtering on top of this geometry.

## Intro integration

Phase 3 continues to use the real Atlas SVG.

Because the real Atlas is now radial, the intro automatically becomes:

```text
five outward trees
      -> territory condensation
      -> five section nodes
      -> central Štěpán root
      -> photographic identity node
```

The `Enter profile` gateway is therefore geometrically centred on the actual root rather than being an unrelated UI control.

No second intro-only coordinate system is used.

## Cross-link integration

Phase 6 no longer reduces Atlas geography to left/right.

`ProfileGeometry.vectorBetween(sourceId, targetId)` returns the normalised 2D vector between the two nodes' canonical Atlas positions. Cross-link travel uses that vector for:

- departure direction;
- viewport portal selection;
- old-scene recession;
- direction metadata (`up-left`, `down-right`, etc.).

The destination still opens in its normal local geometry.

## Renderer ownership

`site-graph.js` still owns node creation, routing state, Atlas camera and semantic modes.

`radial-geometry.js` is a geometry stabilisation layer over the real renderer. During global renders it pins the real SVG nodes/edges to the radial coordinates while the canonical renderer settles. It never creates a second graph.

This avoids touching the Work renderer or local layout engine while keeping a single interactive DOM graph.

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

1. central root + stable five-direction Overview compass;
2. outward growth of representative nodes in all five Atlas territories;
3. local branch normalisation back to top-to-bottom;
4. Phase 3 intro sourcing the same radial Atlas.

Phase 6 tests additionally verify that cross-link travel uses the resulting 2D vectors.
