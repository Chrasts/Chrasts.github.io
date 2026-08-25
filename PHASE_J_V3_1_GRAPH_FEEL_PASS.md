# V3.1 Phase J — Graph Feel Pass

Status: implementation candidate

Primary specification: `Interactive Graph Portfolio - Agent-Executable Master Roadmap V3.1.md`, Phase J. The V3.1 supplement supplies the retained motion-materiality and camera-semantic detail.

## Roadmap target

Phase J integrates the already-established interaction primitives into **normal graph navigation**:

- halos;
- node physics;
- edge motion;
- spring settle;
- semantic hover;
- camera behaviour;
- transition interruption.

The experiential target is that ordinary navigation approaches the motion quality of the polished entry experience.

The retained V3 material gives a useful materiality ordering:

1. node moves first;
2. edge follows continuously;
3. halo trails slightly;
4. label settles fractionally later;
5. camera has slower inertia.

This ordering is deliberately subtle. It is not a second structural transition system.

## Canonical ownership

### V9 graph transition owner

The existing V9 transition remains the **only structural geometry owner** for ordinary non-Atlas route changes.

Phase J does not:

- rewrite canonical `data-x` / `data-y`;
- replace route rendering;
- add a force layout;
- clone the whole graph;
- own Atlas ↔ Focus transitions (Phase I owns that boundary);
- own Work project scene transitions.

### `ProfileNodeDynamics`

Phase J extends the existing local-physics owner with one reusable `settleFromTransition()` primitive.

The primitive:

- applies a bounded one-shot offset to the arrival node;
- gives nearby nodes a smaller coherent impulse;
- keeps targets at zero so the existing spring is the return mechanism;
- adapts connected edges continuously while nodes settle;
- supports both quadratic (`Q`) and linear (`L`) canonical edge paths;
- restores the exact canonical transform/path when settled;
- is disabled under reduced motion.

There are no per-node timers and no persistent physics loop.

### `ProfileGraphFeel`

The existing GraphFeel owner remains responsible for halo state and edge emphasis.

During the short arrival settle it additionally marks:

- one `is-navigation-arrival` node;
- edges incident to that arrival node as `is-navigation-settling-edge`;
- the arrival halo as active.

These classes are derived from the one Phase J navigation state; they are not a second interaction model.

### `ProfileCameraMateriality`

Phase J uses the existing semantic camera-motion vocabulary from Phase D:

- navigation to a descendant → `PUSH`;
- navigation to an ancestor → `PULL`;
- navigation to a non-ancestor/non-descendant route → `FOLLOW`.

This retargets the 2.5D material response only. Structural camera/layout work remains with the existing transition/camera owners.

## Navigation coordinator

`ProfileGraphNavigation` listens to the canonical `ProfileScene.TransitionCoordinator` lifecycle rather than click or hash events.

For `kind: "graph-route"` transitions it records:

- source route/node;
- target route/node;
- semantic direction (`up`, `down`, `lateral`);
- normalized travel vector;
- semantic camera action.

The state progression is:

```text
idle
→ transition
→ handoff
→ settle
→ idle
```

`handoff` is important: `TransitionCoordinator.finish()` publishes its event before the structural owner has fully released its lock. Phase J therefore waits two animation frames before beginning arrival materiality. Structural and material motion never fight for the same frame.

## Interruption

A new ordinary route change during `handoff` or `settle`:

1. cancels any pending arrival frame;
2. clears transient navigation classes/CSS variables;
3. lets `NodeDynamics` reset through the normal structural transition lifecycle;
4. begins the new semantic navigation context.

No stale arrival timer can later restore the old target.

Phase J also registers as a `TransitionCoordinator` participant so external interruption clears its state through the same shared lifecycle.

## Reduced motion

Reduced motion preserves:

- source/target semantics;
- direction classification;
- PUSH/PULL/FOLLOW intent;
- final canonical route and graph state.

It omits:

- one-shot node displacement;
- edge-follow animation;
- halo trail animation;
- delayed label settle.

This follows the roadmap requirement that reduced motion preserve semantic meaning rather than simply leave a broken spatial state.

## Mobile consequences

No separate mobile transition engine is introduced.

`NodeDynamics` already weakens displacement for coarse pointers / narrow viewports. Phase J also reduces the label-settle distance on those layouts. Phase K remains the dedicated early mobile/accessibility/performance checkpoint.

## Regression coverage

`tests/graph-navigation-materiality.spec.js` verifies:

1. descendant navigation resolves to `PUSH`;
2. ancestor navigation resolves to `PULL`;
3. lateral navigation resolves to `FOLLOW`;
4. the arrival node receives the one-shot spring impulse;
5. connected edges are adapted during settle and restored afterwards;
6. the arrival halo/label state is visible only during settle;
7. canonical node coordinates remain unchanged;
8. a new route during settle cleanly supersedes all transient state;
9. Atlas ↔ Focus transitions remain exclusively owned by Phase I;
10. reduced motion keeps direction/camera semantics but skips physical settle.

The suite is retained in the permanent interaction smoke job.

## Definition of done

Phase J is complete only when:

- ordinary navigation exercises halo, node, edge and camera materiality coherently;
- transition interruption leaves no stale offsets/classes/timers;
- canonical topology/layout is unchanged;
- Atlas ↔ Focus ownership is not duplicated;
- reduced motion remains semantically coherent;
- relevant existing regression tests remain green;
- the dedicated Phase J regression suite is green.

## Explicit non-goals

Phase J does not implement Phase K's full mobile/accessibility/performance audit and does not begin Phase L scene-runtime work.
