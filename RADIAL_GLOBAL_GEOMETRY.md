# Radial global geometry contract

This document records the current global/local geometry split after the intro and Overview stabilisation pass.

## Core rule

```text
GLOBAL      Atlas + Overview       asymmetric fan territories
LOCAL       focused branch         top -> bottom hierarchy
SEMANTIC    specialised scene      geometry owned by the content
```

The global fan is not a universal replacement for local graph geometry.

## Final global compass — fan-v3

`Štěpán Chrast` is the geometric centre of both Atlas and Overview.

```text
          About                 Education
             ↖                 ↗

 Experience  ←────── Štěpán ─────────────→  Knowledge
                         |
                         ↓
                        Work
```

The composition is intentionally asymmetric:

- **Work** points exactly down;
- **Knowledge** is the long primary right wing;
- **Education** is an upper-right territory;
- **About** is an upper-left territory;
- **Experience** occupies the remaining left / slightly downward territory.

`intro-fixes-v3.js` wraps the previous public geometry layer and exposes the final layout through the existing `ProfileGeometry` API. `ProfileGeometry.snapshot().compassVersion === "fan-v3"` identifies this contract.

## Atlas subtrees

Each territory remains an ordinary rooted hierarchy growing outward along its section vector. The final layer rotates the already computed subtrees as wholes, preserving their existing radial/tangential structure and terminal variance.

Non-Work terminal nodes may end at meaningfully different radial distances. Knowledge keeps the largest organic terminal spread.

### Work exception

Work remains rank-like and vertically ordered:

```text
Štěpán
   |
   ↓
 Work
   |
   ↓
FCA lattice ranks
```

Work is not scattered or rotated away from the downward order. The FCA lattice remains a specialised semantic geometry.

## Overview and spatial memory

Overview uses exactly the same five territory directions as Atlas. The portrait-to-Overview handoff is pinned to `fan-v3` during and after the transition so an older geometry layer cannot briefly reassert itself and cause a visible second reorganisation.

Opening an ordinary section still means:

```text
fan global location
        -> structural travel
        -> top-to-bottom local exploration
```

Work already agrees with the local vertical order.

## Intro integration

First-session flow:

```text
central Štěpán root only
        -> irregular rotating root orbit
        -> real Atlas grows outward from parent positions
        -> complete fan-v3 Atlas
        -> rotating Enter profile gateway appears
        -> explicit Enter profile
        -> territories condense
        -> branches fold into root
        -> root morphs into portrait identity
        -> portrait shrinks into the stable fan-v3 Overview root
```

Before autoplay owns the clone, all non-root Atlas nodes and edges are CSS-hidden. This prevents a one-frame flash of the completed Atlas.

The Enter gateway is transient. It disappears immediately when clicked. Its rotation uses the independent CSS `rotate` property, while hover uses `transform: scale(...)`; therefore hover can enlarge the ring without freezing the orbit.

## Root semantics in Overview

The central `Štěpán Chrast` node in Overview is **not** a hierarchy-navigation action. Clicking or keyboard-activating it keeps the route and fan geometry unchanged and opens a profile identity summary containing:

- portrait;
- name;
- profile label;
- short introduction;
- Email, GitHub and LinkedIn links.

This prevents the meaningless temporary normalisation of the root into a downward local fragment.

## Cross-link integration

Phase 6 continues to consume the public geometry only:

```js
ProfileGeometry.vectorBetween(sourceId, targetId)
ProfileGeometry.directionBetween(sourceId, targetId)
```

Because `fan-v3` is the final public wrapper, typed cross-link travel automatically follows the same Atlas coordinates.

## Mobile

Mobile preserves the same territory ownership and directions with smaller radii. Local mobile projection remains owned by the existing mobile layer.

## Renderer ownership

- `site-graph.js` remains canonical for graph creation, routes, modes, Work lattice and Atlas camera.
- `radial-geometry.js` supplies base radial tree coordinates.
- `motion-polish.js` retains structural transition polish and the earlier fan transform.
- `intro-fixes-v3.js` is the final public fan/root contract and stabilisation layer.
- `intro-animation.js` owns Atlas condensation and portrait handoff.
- `intro-unfold.js` owns the automatic root-to-Atlas reveal.
- `graph-transitions-v6.js` owns structural route transitions.
- `cross-link-travel-v2.js` owns typed lateral travel.

## Regression expectations

Browser coverage checks:

1. Knowledge right, Education/About up, Work down;
2. representative Atlas subtrees grow outward along `fan-v3`;
3. Work preserves vertical FCA order;
4. no completed-Atlas flash before autoplay;
5. Enter orbit continues during hover;
6. Enter disappears immediately on activation;
7. portrait handoff remains in the same Overview positions after settling;
8. clicking the Overview root opens identity information without changing route or graph coordinates.
