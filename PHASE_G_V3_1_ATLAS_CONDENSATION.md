# V3.1 Phase G — Semantic Atlas Condensation

Status: implementation candidate

Primary specification: `Interactive Graph Portfolio - Agent-Executable Master Roadmap V3.1.md`, especially Atlas Condensation, Condensation Waves, Parent Mass Response, Profile Entry End State and Phase G acceptance. V3.1 remains authoritative; the supplement supplies reduced-motion and motion-language detail.

## Product target

`Enter profile` no longer performs a route jump or bulk fade. It performs the structural motion primitive `CONDENSE`:

```text
many detailed semantic objects
↓
relationship-preserving absorption
↓
broader parent concepts
↓
five main territories
↓
persistent personal root
↓
practical five-branch Overview
```

The visitor should be able to read the causal statement visually: detail is being compressed into broader context and, ultimately, into the person.

## Ownership

### Canonical graph geometry remains authoritative

`ProfileGeometry` and the normal graph renderer continue to own:

- canonical `data-x` / `data-y`;
- outer `.site-graph-node` transforms;
- route topology;
- Atlas and Overview canonical positions;
- the Work FCA semantics.

Phase G deliberately does **not** suspend or rewrite canonical geometry.

Instead, each non-root live node temporarily receives an inner `.atlas-condense-motion` SVG group. The node's material children move inside that group while the outer semantic node remains at its canonical Atlas coordinate.

This is the key abstraction boundary: structural animation is real and spatial, but canonical graph state stays deterministic throughout.

### Root Entry Portal owns identity material

Phase F remains the owner of the root portrait/material. Phase G claims the cancelable `profile:enter-profile-request` event and keeps the Phase F portal in its `entering` state for the duration of condensation.

The root is never cloned, wrapped into a replacement node or destroyed.

### Transition coordinator owns structural exclusivity

Phase G runs through `ProfileScene.transitions` with operation `CONDENSE` and registers `atlas-condensation-v31` as a participant.

That means:

- ordinary ephemeral node dynamics are suspended by the existing transition contract;
- camera materiality neutralises through the existing transition-begin contract;
- new navigation can interrupt the structural operation through the shared coordinator;
- Escape can cancel to a stable Atlas state;
- stale generations cannot commit after cancellation.

## Primary semantic parent

A node may have multiple relations or multiple parents. Condensation needs one visual absorption path, not simultaneous teleportation to several targets.

Phase G therefore uses the node's first canonical `parentIds[0]` as its **primary condensation parent**.

This is consistent with the existing primary-path convention used elsewhere in the graph. Non-primary relations remain context and fade/retract without redefining topology.

For dynamically created Work project nodes, `work` remains the first parent; Work-theme parents are appended later. Thus project material condenses first into the Work territory rather than pretending the FCA has become a tree.

## Node material motion

For every non-root live node:

1. relationship remains legible;
2. node material begins moving toward its actual parent coordinate;
3. scale stays readable through the early travel phase;
4. scale falls later in the motion;
5. opacity falls only near absorption;
6. source halos contract and fade;
7. parent receives restrained mass response;
8. node marks an absorbed semantic state near the endpoint.

The outer semantic `<g>` remains fixed. Only its temporary material wrapper moves.

This means `data-x`, `data-y` and outer transforms stay canonical even while the visitor sees genuine child-to-parent travel.

## Edge retraction

Primary hierarchy edges use normalized SVG `pathLength="1"` and a frame-controlled dash segment.

For the normal parent → child path orientation, the visible segment starts at the parent and becomes progressively shorter from the child end. The result is an actual visual retraction toward the parent rather than an opacity-only disappearance.

If an unusual structural edge is encoded in reverse orientation, Phase G does not fake the wrong endpoint. It preserves the relation and fades it late instead.

Non-primary hierarchy relations remain longer than lateral/cross-link context. Cross-links recede more aggressively so the absorption hierarchy remains readable.

## Semantic waves

The roadmap's recommended order is implemented with overlapping timing rather than rigid sequential levels:

```text
deep
↓
intermediate
↓
territories
↓
branches
↓
root commit
```

Depth mapping:

- depth >= 4 → `deep`
- depth 3 → `intermediate`
- depth 2 → `territories`
- depth 1 → `branches`

A stable hash adds small deterministic intra-wave staggering. The next wave begins before the previous wave has completely finished.

Normal approximate starts:

| Wave | Start |
| --- | ---: |
| deep | 90 ms |
| intermediate | 285 ms |
| territories | 470 ms |
| branches | 675 ms |

Total condensation before root commit is approximately 1.36 s.

## Parent mass response

Parent nodes receive a bounded aggregate response while children are approaching absorption.

The response may affect only restrained material cues:

- very small dot scale increase;
- slight luminance increase;
- stronger primary halo;
- slightly stronger secondary halo.

No bounce, particles, explosion, large pulse or game-like reward animation is used.

The mass response is transient; it is removed during cleanup or route commit.

## Camera convergence

Before the waves start, Atlas LOD is brought to a readable near state and the Atlas camera begins a small convergence toward scale `0.94`.

This is intentionally not a dramatic zoom-to-root. The network is still the subject during absorption. The final Atlas → Overview recompose remains owned by the canonical graph renderer.

Thus camera causality is:

1. active root already acknowledged by Phase F;
2. network begins semantic absorption;
3. camera slightly converges while structure is still readable;
4. root wave commits the semantic route;
5. canonical renderer recomposes the persistent root and five branches into Overview.

## Root commit and five-branch end state

At the root wave:

1. Phase G emits/records the `root` wave;
2. transition coordinator enters commit;
3. `ProfileRootLanding.commitExpanded()` marks the practical root state as already expanded;
4. route changes to `#overview`;
5. canonical graph renderer recomposes the graph to Overview geometry;
6. Phase G keeps absorbed material hidden until that recompose settles;
7. temporary wrappers/edge styles are removed;
8. the same root semantic element remains;
9. Work, Knowledge, Experience, Education and About are immediately present;
10. transition finishes and keyboard focus returns to root.

Phase H will polish this end state into the final recruiter-facing Profile Root composition. Phase G only guarantees the correct semantic landing and structural transition.

## Cancellation and interruption

Escape during condensation cancels through the transition coordinator.

Cancellation restores:

- Atlas route/mode;
- exact canonical node geometry;
- temporary node wrappers;
- transient edge dash/opacity state;
- parent mass state;
- the pre-condensation Atlas camera;
- the Phase F personal root portal in an open, readable state.

No obsolete completion callback is allowed to route to Overview after cancellation.

General route retargeting is handled through the shared transition coordinator. A later Atlas/Focus unification phase can further improve mid-flight geometric retargeting; Phase G already avoids hard-locking the visitor into a non-interruptible cinematic.

## Reduced motion

Reduced motion preserves the semantic operation and wave ordering but compresses it substantially:

- total pre-commit sequence about 265 ms;
- physical child travel is reduced to about 7.5% of the full path;
- scale change is restrained;
- opacity/semantic absorption remains legible;
- final practical state is identical.

Reduced motion is therefore not “no meaning”; it is a short semantic recompose.

## Accessibility

During active structural condensation:

- the graph is `aria-busy="true"`;
- transient graph pointer interaction is disabled;
- status text announces compression into the profile overview;
- Escape remains available;
- reduced motion preserves equivalent state semantics;
- final keyboard focus returns to the persistent root.

No information required to use the site exists only in the animation.

## Performance

Phase G uses one requestAnimationFrame loop only while active.

Per active frame it updates:

- visible node material wrappers;
- primary edge dash state;
- context edge opacity;
- bounded parent mass variables.

There is no permanent physics simulation and no layout measurement in the frame loop. Coordinates come from canonical `ProfileGeometry` data.

## Regression coverage

`tests/atlas-condensation.spec.js` verifies:

1. a deep node physically travels toward its real primary parent;
2. canonical outer node coordinates remain unchanged during that travel;
3. its structural edge visibly retracts;
4. parent mass response occurs;
5. Phase F root portrait remains present during condensation;
6. semantic waves occur in deep → intermediate → territories → branches order;
7. primary structure visibly retracts rather than merely fading;
8. completion preserves the same root semantic object;
9. completion reaches Overview with all five main branches immediately present;
10. temporary wrappers and structural state are cleaned;
11. Escape restores exact Atlas geometry and keeps the root portal available;
12. reduced motion preserves semantic result with bounded travel/time;
13. mobile/coarse-pointer entry reaches the same practical five-branch state.

The suite is retained in post-merge interaction smoke.

## Explicit non-goals

Phase G does **not** implement the final Phase H homepage composition:

- recruiter-oriented identity hierarchy;
- polished professional links;
- CV affordance;
- Quick Overview surface;
- final Atlas-return affordance;
- final branch visual hierarchy.

It also does not redesign Work FCA topology or ordinary Focus navigation.

Those remain Phase H and later roadmap ownership.
