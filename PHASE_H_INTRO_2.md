# Phase H — Intro Animation 2.0

Phase H replaces the old Phase 3 interaction-gated cinematic with the roadmap model: the real Atlas folds into the person.

## Implemented first slice

The first Phase H implementation changes the architecture rather than reskinning the old intro.

```text
first session /
    -> real live Atlas
    -> short relation wake-up
    -> overlapping semantic condensation
    -> root + five readable primary branches
    -> five branches absorb into the persistent root
    -> shared root dot/label handoff
    -> stable root landing
```

There is no `Enter profile` gateway and no photographic intermediary node.

The intro operates on the real `#site-graph` SVG. Nodes keep their canonical outer graph coordinates. Temporary inner SVG motion groups carry the cinematic displacement so the normal geometry owner remains authoritative for the underlying graph. The same root node therefore remains visually present from the Atlas through the final graph state.

## Timeline

The desktop target follows the roadmap timing envelope.

```text
0.00–0.25 s   Atlas establishes itself
0.25–0.65 s   selected relation wake-up traces
0.45–1.25 s   deep semantic condensation
0.82–1.42 s   cluster -> territory overlap
1.25–1.90 s   root + five primary branches readable
1.90–2.20 s   five branches absorb into root
2.20–2.65 s   root label/dot -> root landing handoff
```

The animation deliberately uses overlapping node schedules rather than discrete slideshow stages.

## Semantic condensation

Depth is derived from real graph ancestry.

```text
depth 0      persistent root
depth 1      five primary branches
depth 2      clusters / intermediate domains
depth >= 3   deep evidence/detail
```

Every non-root node chooses a real graph parent. During condensation its visual position converges on the parent's current visual position, so children follow parents that are themselves already moving inward. Edges retract with those moving endpoints. Nodes shrink and fade only near absorption rather than disappearing in place.

Parents receive a small temporary dot scale/stroke response as children arrive. The effect is intentionally restrained: no bounce, particles or glow burst.

## Camera

The live Atlas begins from the normal Atlas fit. During condensation the existing Camera Composition system focuses and pushes toward the real root. If the intro is interrupted, Phase G camera interruption stops the in-flight camera state at its current interpolated position.

## Wake-up traces

A small ranked set of real graph relations is briefly traced before condensation. Cross-links are then reduced before the graph folds so the intro communicates semantic connectivity without turning into a hairball.

## Root landing handoff

At the end of branch absorption, the live root dot and graph label are measured in screen space. A short shared-element handoff carries those two visual elements into the existing root landing while the normal graph route changes back to Overview.

The portrait and identity copy enter only during this final handoff. Dense Atlas and portrait are therefore never competing simultaneously.

## Latent topology and first root action

The stable root landing now receives five faint direction stubs derived from the canonical fan-v3 section vectors.

- idle: short, low-opacity branch hints;
- root hover/focus: stubs extend and desktop labels preview;
- root activation: the ordinary five Overview branches expand from the root while the root-to-section edges draw outward.

This makes the first primary action a partial geometric reverse of the final intro absorption.

## Interruption

The intro registers as a Phase G transition participant while the condensation timeline is active.

- Escape: short handoff to stable root landing;
- Enter / Space: complete to root landing;
- first Tab: complete to root landing before normal keyboard navigation;
- click/tap on empty Atlas space: complete to root landing;
- click on a visible routed graph node: cancel the cinematic and retarget directly to that route;
- stale animation frames are invalidated by generation tokens.

## Session and deep-link policy

- first visit to `/` in a session: full Phase H intro;
- refresh in the same session: no cinematic replay;
- direct deep link: bypass intro and open immediately;
- return to Overview later: normal site transition;
- replay remains available programmatically through `ProfileIntro.replay()`.

The session marker is written when the intro begins so an interrupted reload does not trap the user in repeated autoplay.

## Reduced motion

Reduced motion uses a short semantic Atlas-to-root reduction and the same stable landing. It does not run the full condensation choreography.

## Mobile first pass

Mobile uses the same semantic graph but intentionally lower moving-text density:

- primary territories remain readable;
- cluster and deep labels are suppressed during the cinematic;
- deep structure remains as marks;
- root landing keeps a compact five-stub topology without latent labels.

Further per-device composition tuning can continue inside Phase H without changing the engine contract.

## Public API

```js
ProfileIntro.snapshot()
ProfileIntro.skip()
ProfileIntro.replay()
```

`ProfileIntro.snapshot()` reports `realGraph: true`, `persistentRoot: true`, the current Phase H stage, interruption state and final result.

## Legacy compatibility

The historical Phase 3 files remain in the repository for now because Phase T is the designated consolidation stage. The old gateway/portrait orchestration is no longer the intended runtime contract. Tests in `phase3-intro.spec.js` and `intro-unfold.spec.js` now validate Phase H behaviour.

## Remaining Phase H work after this slice

This first implementation establishes the new architecture. Remaining perceptual tuning should be driven by the browser regression run and visual inspection, especially:

- exact condensation easing and parent-mass strength;
- camera timing against branch readability;
- mobile portrait composition on several viewport sizes;
- direct node retargeting from a more exact captured interpolated geometry rather than the current immediate route handoff;
- optional public replay control;
- final visual regression snapshots.
