# V3.1 Phase B — Node Interaction Foundation

Date: 2026-08-24  
Roadmap authority: V3.1 master roadmap, Phase B

## Goal

Make graph nodes explicit interactive entities without changing canonical topology, route semantics or graph ownership.

Phase B establishes the state/halo boundary that Phase C soft node dynamics can consume.

## Canonical ownership

### `ProfileNodeInteraction` — `node-interaction-state.js`

Owns ephemeral node interaction state only.

States:

- `idle`
- `hovered`
- `focused`
- `active`
- `transitioning`
- `selected`
- `entry-ready` for the persistent profile root while it is the Atlas entry portal

Deterministic precedence:

1. transition
2. active press
3. keyboard focus
4. pointer hover
5. root entry readiness
6. renderer selection
7. idle

The controller also mirrors semantic relation state already computed by `site-graph.js`:

- upstream
- downstream
- lateral
- Work strong/soft relation

It does **not** derive a second graph relationship model.

### `ProfileHaloRenderer` — `halo-renderer.js`

Owns halo DOM and semantic halo presets, but does not decide which semantic preset applies.

Presets:

- `idle`
- `hover`
- `focus`
- `active`
- `selected`
- `related`
- `root-entry`
- `transitioning`

Ordinary nodes receive one halo primitive. The profile root receives two rings and is currently the only richer halo object.

Every newly created halo starts in `idle`. The renderer does not infer root-entry semantics from node identity; `ProfileNodeInteraction` / `ProfileGraphFeel` supply that state.

Repeated refresh is idempotent; renderer rerenders must not accumulate rings.

### `ProfileGraphFeel` — `graph-feel.js`

Becomes a thin presentation coordinator.

It:

- consumes `ProfileNodeInteraction`;
- maps node/relationship state to `ProfileHaloRenderer` presets;
- preserves the existing `ProfileGraphFeel.snapshot()` compatibility contract;
- adds restrained edge-flow presentation for semantic relationships;
- reflects Atlas drag state;
- preserves transient activation feedback.

It does not own navigation, semantic graph relations or canonical coordinates.

## Semantic hover

Semantic hover remains based on existing renderer classes produced by `site-graph.js`.

For an ordinary node hover/focus:

- the direct node receives the active hover/focus halo;
- ancestors/descendants/lateral relations receive a weaker `related` halo state;
- existing graph muting remains the source of unrelated-context attenuation;
- active semantic edges receive restrained flow emphasis.

This avoids a second relationship calculation inside the interaction layer.

## Root halo

The root has an explicit `entry-ready` node state **only in Atlas**, where it can serve as the V3.1 entry portal, and maps to `root-entry` halo presentation.

Expanded Overview does not reuse the entry state. This prevents the temporary Atlas entry affordance from leaking into the later Profile Root semantics owned by Phase H.

The generic renderer `is-selected` class does not override the identity-specific Atlas entry state. Direct hover/focus/press still takes precedence.

Phase F will add portrait/entry portal behaviour; Phase B only establishes the visual/state primitive.

## Keyboard and reduced motion

Keyboard focus uses the same state model as pointer interaction, with a stronger focus halo rather than a separate interaction implementation.

Reduced motion keeps all semantic states and disables repeating halo/edge animation.

## Work project anchors

The current FCA Work renderer represents direct projects as `work-project-anchor-v5` decorations rather than circular `.site-graph-node` objects. Phase B does not fake a circular node halo around those text/link anchors merely to satisfy an old visual prototype assumption.

Their existing direct hit-target and focus semantics remain intact. When Work project presentation is redesigned under the V3.1 scene/Work phases, it can either adopt a dedicated anchor material primitive or migrate project identity into a shared node/object representation.

## Phase C contract

This phase intentionally does not move nodes.

Canonical coordinates remain owned by the graph/geometry layer. Phase C adds a distinct ephemeral dynamics owner for:

- interaction offset;
- spring velocity;
- local displacement;
- scale response.

`ProfileNodeInteraction` supplies the active semantic state; it must not become a geometry owner.

## Regression coverage

`tests/graph-feel.spec.js` verifies:

- pointer → canonical `hovered` state;
- keyboard → canonical `focused` state;
- semantic relation nodes receive `related` halo state;
- Atlas root uses `entry-ready` + two-ring `root-entry` halo;
- expanded Overview root does not leak `entry-ready` / `root-entry`;
- halo refresh is idempotent;
- transition state overrides direct interaction and settles cleanly;
- previous graph-feel compatibility behaviour still works;
- artifact-linked halo behaviour still works;
- reduced-motion semantic parity is preserved.

## Acceptance

### Functional

- [x] explicit deterministic node state model
- [x] reusable HaloRenderer
- [x] hover/focus/active/selected/transition states
- [x] semantic relationship response
- [x] Atlas-specific root halo state
- [x] keyboard equivalent
- [x] reduced-motion equivalent
- [x] no canonical geometry changes
- [x] existing `ProfileGraphFeel` compatibility surface retained

### Experiential

The interaction layer supports materially distinct direct, related, selected and Atlas-entry root states instead of treating every node as a static SVG control with one generic hover ring.

Phase C remains the owner of true local spatial pressure/materiality; Phase B deliberately does not claim displacement/physics ownership.
