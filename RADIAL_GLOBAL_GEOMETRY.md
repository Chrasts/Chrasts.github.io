# Radial global geometry contract

This document records the global/local geometry split introduced after Phase 6 and the current asymmetric fan layout.

## Core rule

```text
GLOBAL      Atlas + Overview       radial / fan territories
LOCAL       focused branch         top -> bottom hierarchy
SEMANTIC    specialised scene      geometry owned by the content
```

The global geometry is not a universal replacement for every graph layout.

## Global compass

`Štěpán Chrast` is the geometric centre of Overview and Atlas. The five first-level sections keep the same territory directions in both views.

```text
          Experience             Education
                ↖                ↗

 About  ←──────────── Štěpán ─────────────→  Knowledge
                         |
                         |
                         ↓
                        Work
```

The composition is deliberately asymmetric.

- **Work** points exactly down.
- **Knowledge** is the long primary right wing.
- **Experience** occupies the upper-left territory.
- **Education** occupies the upper-right territory at a different angle and distance from Experience.
- **About** occupies the left / slightly downward territory.

A regular pentagon is explicitly not a goal. The layout optimises semantic continuity, usable whitespace, label clearance and visual hierarchy.

The public geometry API remains `ProfileGeometry`. `radial-geometry.js` supplies the base radial tree coordinates; the current fan transform is installed by `motion-polish.js` and is exposed through the same API (`compassVersion: fan-v2`). Cross-link travel therefore continues to consume the canonical public geometry rather than a separate visual-only layout.

## Desktop spacing

Desktop Overview deliberately pushes the five first-level sections farther from the root than the earlier radial version.

Knowledge is farthest from the centre, followed by Education / Experience, while Work and About remain slightly more compact. Atlas applies a corresponding section-specific radial and tangential scale to each existing subtree.

The important invariant is that an entire territory is transformed as one hierarchy. Internal parent/child structure is not rebuilt merely to change its global direction.

Mobile keeps the same compass but uses substantially smaller radii and no extra desktop expansion.

## Atlas subtrees

Atlas is not a set of concentric rings. Each territory is an ordinary rooted hierarchy with its own outward axis:

- Work grows down;
- Knowledge grows right;
- Experience grows up-left;
- Education grows up-right;
- About grows left / slightly down.

Structural depth becomes distance along that axis. Siblings continue to spread along the corresponding perpendicular tangent.

Work projects remain owned by Work even though project nodes also have FCA theme parents.

## Overview and spatial memory

Overview is the first ring / fan of the same global map. It preserves the territory positions learned in Atlas and during the intro rather than introducing another unrelated layout.

When a section is opened, departure begins from its global position. Normal focused branches then settle into the standard top-to-bottom local coordinate system:

```text
fan global location
        -> travel into territory
        -> top-to-bottom local exploration
```

## Work continuity

Work remains the deliberate exception to rotational normalisation because its global direction already agrees with the formal Work scene:

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

The global fan layer does not own local node coordinates. Focused branches remain top-to-bottom, while semantic scenes may use their own geometry, including:

- Work FCA lattice;
- Experience timeline;
- future Education document geometry;
- future Research Interests constellation;
- future project/media scenes.

## Edge routing

In global fan views:

- root-to-section edges are direct radial connections;
- hierarchy edges follow the outward axis of their territory;
- typed cross-links curve away from the centre to reduce hairball pressure.

Phase 7 can add semantic LOD and relation filtering on top of this geometry.

## Intro integration

Phase 3 still clones the real Atlas SVG. The first-session sequence therefore uses exactly the same fan geometry as the actual Atlas.

The `Enter profile` control is only an interaction ring around the real central root. It has no opaque fill and does not replace or hide the `Štěpán Chrast` node.

The passive state is teal. Hover / explicit keyboard focus emphasises both the ring and the real root node together. Programmatic intro focus is not allowed to leave the gateway in a false hover-like state on first load.

The sequence remains:

```text
five outward trees around visible Štěpán
        -> territory condensation
        -> five section nodes
        -> central root
        -> root expands / morphs
        -> photographic identity node
```

Clicking the photographic identity later unfolds the same five-direction Overview fan.

## Cross-link integration

Phase 6 uses the exact public Atlas positions, not a left/right approximation.

`ProfileGeometry.vectorBetween(sourceId, targetId)` returns the normalised 2D vector between two current fan-Atlas positions. `cross-link-travel-v2.js` uses it for departure, portal selection, outgoing-scene recession and direction metadata.

Because sibling placement has a tangential component, an individual project-to-topic relation can differ slightly from the coarse territory direction. Tests should compare travel against `ProfileGeometry.vectorBetween(...)` rather than hard-code a section direction where unnecessary.

The destination still settles into its normal local/semantic geometry.

## Mobile

Mobile preserves territory ownership and fan topology but uses compact radii. Local mobile scenes continue to use their established portrait projection.

## Renderer ownership

`site-graph.js` remains the canonical renderer for node creation, route state, graph modes, Work lattice and Atlas camera.

`radial-geometry.js` supplies the base stable radial hierarchy. `motion-polish.js` applies the current fan transform over those real node coordinates and re-exports the resulting public `ProfileGeometry`. No second graph DOM is created.

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

`ProfileGeometry.snapshot().compassVersion === "fan-v2"` identifies the current global fan.

## Regression expectations

`tests/radial-geometry.spec.js` verifies:

1. Work exactly below the root;
2. Knowledge as the long right wing;
3. Experience and Education above on distinct asymmetric vectors;
4. About on the left / slightly downward side;
5. outward growth of representative nodes in all five Atlas territories;
6. local Knowledge normalisation to top-to-bottom;
7. downward continuity from global Work into the FCA lattice;
8. Phase 3 sourcing the same fan Atlas.

`tests/motion-polish.spec.js` additionally verifies the visible-root gateway, passive initial state and joint gateway/root hover response.
