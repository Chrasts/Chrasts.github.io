# Phase F: Graph Feel and Microinteraction

Phase F adds one presentation-only interaction layer above the existing graph semantics.

It does not change routes, graph data, graph layout, camera ownership, scene composition or the meaning of relationship highlighting.

## Canonical runtime

`graph-feel.js` exposes `ProfileGraphFeel`.

The runtime observes the live graph and projects existing renderer state into a small interaction state machine:

- `idle`
- `preview`
- `pressed`
- `dragging`
- `transition`

It also tracks pointer versus keyboard modality and publishes the current active node through `data-graph-*` attributes on `#site-graph`.

## Renderer boundary

`site-graph.js` remains the semantic owner of:

- local ancestor and descendant previews
- Atlas upstream, downstream and lateral highlighting
- Work FCA preview semantics
- pinned Atlas selection
- route activation

Phase F reads those existing classes after interaction and does not calculate a second relationship model.

Active semantic paths receive only the presentation class `is-graph-flowing`.

## Node halo

Every live graph node receives one non-interactive SVG halo circle.

The halo is a presentation affordance for:

- pointer hover
- keyboard focus
- selected or pinned nodes
- upstream, downstream and lateral relations
- artifact-linked nodes
- activation feedback

The halo does not change node hit targets or graph geometry.

## Press and activation feedback

Pointer and keyboard activation use the same transient microstates.

`pressed` provides immediate tactile feedback before the existing renderer activation runs. A short activation echo then confirms intent while the route or camera transition begins.

No Phase F handler performs navigation itself.

## Relation flow

When the renderer marks edges as semantically active, Phase F adds a restrained visual emphasis. The effect uses filter intensity rather than replacing hierarchy edges with animated dashed paths, so structural edge grammar remains intact.

Artifact tethers remain owned by the artifact runtime. Phase F only reinforces their linked graph node with the same halo language.

## Input modality

Keyboard focus receives a stronger halo than pointer hover. Pointer interaction does not leave keyboard-style focus decoration behind.

The public state exposes the current modality as `pointer` or `keyboard`.

## Atlas dragging

Atlas drag remains owned by Phase 7. Phase F only reflects the drag state in the shared graph microstate so cursor and animation treatment stay coherent.

## Transition boundary

During structural graph transitions, repeating graph-feel animation is suppressed. Transition choreography remains owned by the existing transition system and later Phase G work.

## Reduced motion

Reduced-motion users keep the same semantic states and visual hierarchy, but repeating halo and edge animations are disabled and transitions collapse to effectively immediate state changes.

## Public diagnostic surface

```js
ProfileGraphFeel.snapshot()
```

The snapshot reports:

- sequence
- phase
- input modality
- active node
- pressed node
- activating node
- reduced-motion state
- halo count
- active flowing-edge count

## Regression contract

Phase F tests cover:

- pointer preview and semantic relation emphasis
- keyboard parity with stronger focus indication
- transient press feedback without route ownership
- artifact tether plus graph halo coherence
- reduced-motion semantics without repeating animation

## Phase boundary

Phase F is deliberately a feel layer, not another renderer. Interruptible structural transition coordination belongs to Phase G.
