# Phase 3 — living Atlas intro

Phase 3 now has one automatic structural reveal followed by two explicit interactions.

```text
first visit / overview
    -> central Štěpán Chrast root only
    -> root orbit moves for a short beat
    -> Atlas hierarchies grow outward automatically
    -> complete real Atlas + Enter profile gateway
    -> explicit Enter profile interaction
    -> semantic folding toward first-level territories
    -> five first-level branches fold into the person/root
    -> root organically expands into photographic identity node
    -> explicit click on identity node
    -> identity node shrinks into the real SVG root
    -> Work / Knowledge / Experience / Education / About emerge
```

The source remains the actual portfolio graph rendered by `site-graph.js`. There is no video, canvas substitute or separate illustrative graph.

## Eligibility and session behaviour

The intro is eligible only when the initial route is `overview` and `sessionStorage.profileIntroSeen !== "true"`.

Deep links bypass the intro and mark it seen for the current session. If session storage is unavailable, the intro is bypassed rather than replayed indefinitely.

The session marker is written when condensation reaches the photographic identity node or when the intro is skipped.

## Automatic root -> Atlas reveal

After the real Atlas SVG is cloned, the clone is temporarily collapsed into the central root.

The first visible state contains:

- the real `Štěpán Chrast` graph node;
- its enlarged label;
- three irregular segmented orbit traces rotating around the node.

After a short root-only beat, the graph grows outward from the real hierarchy. Each node starts at the canonical Atlas position of one of its parents and interpolates to its own canonical Atlas position. Deeper ranks begin later than shallow ranks, with deterministic micro-staggering so the result is organic but stable across reloads.

Hierarchy edges are redrawn against the moving nodes during the reveal. Typed cross-links appear late so they do not turn the initial growth into a visual hairball.

Approximate non-reduced timing:

```text
root-only living state   ~0.85 s
outward graph growth     ~1.78 s
gateway arrival          ~0.52 s
```

Reduced motion uses a short direct reveal and disables continuous orbit rotation.

## Public state during autoplay

The internal Phase-3 route is already based on the Atlas clone, but the public state deliberately does not report the scene as interactively waiting until the automatic reveal has finished.

During automatic reveal:

```text
ProfileIntro.snapshot().stage === "unfolding"
ProfileIntro.snapshot().waiting === false
ProfileIntroUnfold.snapshot().stage === "root" | "unfolding"
```

After reveal:

```text
ProfileIntro.snapshot().stage === "atlas"
ProfileIntro.snapshot().waiting === true
ProfileIntroUnfold.snapshot().completed === true
```

The `Enter profile` control is not pointer- or keyboard-accessible until this point.

## Enter profile gateway

The gateway is a ring around the actual central Atlas root rather than a control painted over it.

After the graph has unfolded:

- the root node and `Štěpán Chrast` label remain visible inside;
- the action label sits above the ring, away from nearby branches;
- the outer segmented ring rotates slowly;
- hover/focus changes the gateway toward the brown accent;
- the ring expands slightly;
- the actual root dot and root label highlight together with the gateway.

Merely loading the page, moving the pointer over the Atlas, or clicking elsewhere does not start condensation. Condensation still requires `Enter profile`.

`Skip intro` and Escape remain available throughout.

## Semantic condensation

Each node is classified from real graph ancestry:

```text
depth 0     -> root
depth 1     -> section
depth 2     -> cluster
depth >= 3  -> deep
```

The existing interaction-gated sequence remains:

### `territories`
Deep nodes recede and move toward their first-level territory while the camera closes in.

### `branches`
Depth-2 and deeper nodes finish folding into their first-level section. The visible structure becomes root plus the five primary branches.

### `root`
The five primary branches physically converge on the real root coordinate. Non-root labels disappear before their dots arrive, preventing stacked text in the centre.

### `identity`
The remaining root dot expands into a brief halo while the photographic identity node grows out of it. This is a continuous root-to-portrait morph rather than an end-frame replacement.

Approximate non-reduced timing after `Enter profile`:

```text
territories     ~0.82 s
branches        ~0.80 s
root            ~0.90 s
identity morph  ~0.50 s
```

## Photographic identity -> real Overview

The photographic node contains the existing profile portrait, the name, three profile tags and an `Open profile map` interaction hint.

Clicking it calls `ProfileRootLanding.activate({ focusGraph: false })`, measures the live Overview root dot, and moves/scales the photographic identity to that exact screen-space target while the five primary branches unfold beneath it.

Final state:

```text
ProfileRootLanding.isActive() === false
body[data-graph-route="overview"]
#site-explorer visible
five first-level nodes visible
```

## Atlas geometry

The intro always clones the real current Atlas geometry. It therefore automatically inherits the asymmetric global fan, the downward Work territory and the deterministic terminal-node radial variance used by the live Atlas.

Work remains rank-like and regular because its global direction continues into the formal FCA lattice. Other territories, especially Knowledge, are allowed more terminal radial variation so their leaves do not end on an artificial common ring.

## Public APIs

```js
ProfileIntro.start()
ProfileIntro.skip()
ProfileIntro.openProfile()
ProfileIntro.snapshot()

ProfileIntroUnfold.snapshot()
```

The autoplay reveal is intentionally not exposed as a user-triggered action: it is an internal first-session scene transition.