# Radial global geometry contract

This document records the global/local geometry split introduced after Phase 6.

## Core rule

```text
GLOBAL      Atlas + Overview       radial territories
LOCAL       focused branch         top -> bottom hierarchy
SEMANTIC    specialised scene      geometry owned by the content
```

The radial geometry is not a universal replacement for every graph layout.

## Global compass

`Štěpán Chrast` is the geometric centre of Overview and Atlas. The five first-level sections keep the same directions in both views.

```text
                   Knowledge
                      ↖

        About  ←    Štěpán    →  Experience
                       |          ↘
                       |        Education
                       ↓
                      Work
```

The exact vectors live in `radial-geometry.js` and are exposed through `ProfileGeometry.compass`.

The important semantic choice is that **Work points exactly downward**. The other territories are distributed around it asymmetrically to leave useful angular space for their trees, labels and typed relations. A regular pentagon is not a requirement.

## Atlas subtrees

Atlas is not a set of concentric rings. Each territory is an ordinary rooted hierarchy with its own outward axis:

- Work grows down;
- Knowledge grows up-left;
- Experience grows up-right;
- Education grows down-right;
- About grows left / slightly down.

Structural depth becomes distance along that axis. Siblings spread along the perpendicular tangent, with a small stagger on dense levels.

Work projects remain owned by Work even though project nodes also have FCA theme parents.

## Overview and spatial memory

Overview is the first ring of the same compass. It therefore preserves the positions learned in Atlas and in the intro rather than introducing a third global layout.

When a section is opened, departure begins from its global position. Normal focused branches then settle into the standard top-to-bottom local coordinate system:

```text
radial global location
        -> travel into territory
        -> top-to-bottom local exploration
```

## Work continuity

Work is the deliberate exception to the need for rotational normalisation. Its global direction already agrees with the formal Work scene:

```text
Štěpán
   |
   ↓
 Work
   |
   ↓
FCA lattice ranks
```

Entering Work changes scale and semantic scene geometry, but not the direction of order. The Work concept lattice itself remains untouched and vertically ordered.

## Local and semantic scenes

The radial layer does not own local node coordinates. Focused branches remain top-to-bottom, while semantic scenes may use their own geometry, including:

- Work FCA lattice;
- Experience timeline;
- future Education document geometry;
- future Research Interests constellation;
- future project/media scenes.

## Edge routing

In global radial views:

- root-to-section edges are direct radial connections;
- hierarchy edges follow the outward axis of their territory;
- typed cross-links curve away from the centre to reduce hairball pressure.

Phase 7 can add semantic LOD and relation filtering on top of this geometry.

## Intro integration

Phase 3 still clones the real Atlas SVG. The first-session sequence therefore automatically uses the same central radial map:

```text
five outward trees around Štěpán
        -> territory condensation
        -> five section nodes
        -> central root
        -> photographic identity node
```

The `Enter profile` gateway is centred on the actual Atlas root. Clicking the photographic identity later unfolds the same five-direction Overview compass.

## Cross-link integration

Phase 6 uses the exact canonical Atlas positions, not a left/right approximation.

`ProfileGeometry.vectorBetween(sourceId, targetId)` returns the normalised 2D vector between the two actual Atlas node positions. `cross-link-travel-v2.js` uses it for departure, portal selection, outgoing-scene recession and direction metadata.

Because sibling placement has a tangential component, an individual project-to-topic relation can differ slightly from the coarse section-to-section direction. Tests should therefore compare travel against `ProfileGeometry.vectorBetween(...)` rather than hard-code a section direction where unnecessary.

The destination still settles into its normal local/semantic geometry.

## Mobile

Mobile preserves territory ownership and radial topology. Its existing portrait projection may compress the geometry, but it does not redefine the compass. Local mobile scenes continue to use their established projection.

## Renderer ownership

`site-graph.js` remains the canonical renderer for node creation, route state, graph modes, Work lattice and Atlas camera.

`radial-geometry.js` is a stabilisation layer over that real renderer. In Overview and Atlas it pins the real SVG nodes and edges to radial coordinates while the base renderer settles; it does not create a second graph.

`graph-transitions-v6.js` retains structural route transitions. `cross-link-travel-v2.js` retains typed non-hierarchical travel.

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

1. central root and the five-direction Overview compass;
2. Work exactly below the root;
3. outward growth of representative nodes in all five Atlas territories;
4. local Knowledge normalisation to top-to-bottom;
5. downward continuity from global Work into the FCA lattice;
6. Phase 3 sourcing the same radial Atlas.

Phase 6 tests verify that typed travel uses the resulting exact 2D vectors.
