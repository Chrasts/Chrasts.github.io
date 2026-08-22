# Radial global geometry contract

This document records the global/local geometry split and the current asymmetric fan layout.

## Core rule

```text
GLOBAL      Atlas + Overview       radial / fan territories
LOCAL       focused branch         top -> bottom hierarchy
SEMANTIC    specialised scene      geometry owned by the content
```

The global geometry is not a universal replacement for every graph layout.

## Global compass

`Štěpán Chrast` is the geometric centre of Overview and Atlas.

```text
          Experience             Education
                ↖                ↗

 About  ←──────────── Štěpán ─────────────→  Knowledge
                         |
                         ↓
                        Work
```

The composition is deliberately asymmetric:

- **Work** points exactly down;
- **Knowledge** is the long primary right wing;
- **Experience** occupies the upper-left territory;
- **Education** occupies the upper-right territory at a different angle and distance;
- **About** occupies the left / slightly downward territory.

A regular pentagon is explicitly not a goal. The layout optimises semantic continuity, whitespace, label clearance and visual hierarchy.

`radial-geometry.js` supplies stable base tree coordinates. `motion-polish.js` applies the current asymmetric fan transform and re-exports the resulting public `ProfileGeometry` (`compassVersion: fan-v2`).

## Desktop spacing

Desktop uses substantially more space around the root than mobile. Knowledge is farthest from the centre, followed by Education / Experience. Work and About remain slightly more compact.

The first-level section radius in the Atlas base geometry is also larger than the original radial prototype, leaving enough central negative space for the root identity and Enter gateway.

## Atlas subtrees

Atlas is not a set of concentric rings. Each territory is an ordinary rooted hierarchy with its own outward axis.

Structural depth controls the main outward direction, but non-Work leaf nodes are **not forced onto a common final ring**.

Terminal spacing is deterministic:

- internal nodes receive only small radial/tangential variation;
- terminal nodes receive larger outward variation;
- Knowledge receives the largest terminal radial range;
- other non-Work territories receive a smaller but still visible terminal range;
- positions are derived from stable node IDs, so reloads do not reshuffle the map.

This produces a more organic outer silhouette while preserving the underlying hierarchy.

### Work exception

Work deliberately does **not** receive terminal radial scattering.

Its themes/projects remain arranged as a regular rank-like rooted system beneath Work. This is important because the global direction continues naturally into the formal FCA lattice:

```text
Štěpán
   |
   ↓
 Work
   |
   ↓
FCA lattice ranks
```

Entering Work changes scale and semantic scene geometry, but not the direction of order.

## Overview and spatial memory

Overview is the first layer of the same fan. It preserves the territory directions learned in Atlas and during the intro.

When a non-Work section is opened:

```text
fan global location
        -> travel into territory
        -> top-to-bottom local exploration
```

Work already points downward, so it does not need rotational normalisation.

## Local and semantic scenes

The fan layer does not own local node coordinates. Focused branches remain top-to-bottom, while specialised scenes may use their own geometry, including:

- Work FCA lattice;
- Experience timeline;
- future Education document geometry;
- future Research Interests constellation;
- future project/media scenes.

## Edge routing

In global fan views:

- root-to-section edges are direct radial connections;
- hierarchy edges follow the outward axis of their territory;
- typed cross-links curve away from the centre.

Phase 7 can add semantic LOD and relation filtering on top of this geometry.

## Intro integration

Phase 3 clones the real Atlas SVG, so the first-session intro always uses the same current fan geometry and terminal spacing.

The sequence is now:

```text
central Štěpán root only
        -> irregular root orbit
        -> real Atlas grows outward from parent positions
        -> complete fan Atlas
        -> rotating Enter profile gateway appears around root
        -> explicit Enter profile
        -> territory condensation
        -> branches fold into root
        -> root morphs into photographic identity
```

The `Enter profile` ring has no opaque fill and does not replace the central node. The actual root and its enlarged `Štěpán Chrast` label remain visible inside it.

## Cross-link integration

Phase 6 consumes exact public Atlas positions.

`ProfileGeometry.vectorBetween(sourceId, targetId)` returns the normalised 2D vector between current fan positions. `cross-link-travel-v2.js` uses it for travel direction rather than assuming left/right movement.

Because terminal nodes now have intentional radial/tangential variance, cross-link tests should compare against `ProfileGeometry.vectorBetween(...)`, not hard-code coarse section vectors.

## Mobile

Mobile preserves territory ownership and fan topology but uses compact radii. The large desktop terminal expansion is not applied at the same magnitude on portrait screens.

## Renderer ownership

`site-graph.js` remains the canonical renderer for nodes, route state, graph modes, Work lattice and Atlas camera.

`radial-geometry.js` owns base global coordinates. `motion-polish.js` owns the asymmetric fan transform. `intro-unfold.js` animates the first-session clone only; it does not create a second semantic graph or alter live route structure.

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

The browser suite covers:

1. Work exactly below the root;
2. Knowledge as the long right wing;
3. asymmetric upper Experience/Education territories;
4. outward growth of representative nodes;
5. terminal Knowledge radial variance;
6. regular Work project ranks;
7. local top-to-bottom normalisation;
8. root-only automatic intro state;
9. outward automatic Atlas reveal;
10. delayed Enter gateway availability;
11. later condensation using the same Atlas clone.