# Phase 6 — cross-link travel contract

Phase 6 implements differentiated lateral navigation across the existing profile graph.

Phases 4 and 5 are intentionally not implemented yet. Phase 6 can nevertheless be built independently because the graph model already separates structural hierarchy from typed conceptual relations:

```text
parentIds       -> local hierarchy / parent-child navigation
graph.edges     -> lateral cross-links between profile areas
```

The Phase 6 rule is therefore simple: **hierarchy still unfolds/collapses structurally; a typed relation is travelled laterally.**

## Relation sources

No new semantic relationships are invented by Phase 6. `cross-link-travel.js` reads the existing `SITE_DATA.graph.edges` model, including:

- `related`;
- `evidence`;
- `studied-in`;
- `planned-study`;
- `credential-link`;
- `experience-link`;
- `education-link`.

The same edge is described from the current node's point of view. For example:

```text
project -> SQL                  Evidence
ESSLLI -> SAT / SMT             Studied topic
České priority -> survey        Project
knowledge -> ESSLLI             Studied in
```

This keeps the UI language directional without changing the underlying graph edge.

## Cross-link rail

A compact `.profile-crosslinks` rail is inserted immediately below the graph breadcrumb / route bar.

It is visible only when:

- the current local item has at least one typed `graph.edges` relation;
- the view is not Atlas;
- the Phase 3 intro does not own the screen;
- a cross-link travel is not already running.

Each relation is a real anchor with an `href` to the destination route. The relation kind and target are shown separately, for example:

```text
EVIDENCE       SQL
STUDIED TOPIC  SAT / SMT Solving
PROJECT        Social Workers Survey Analysis
```

The anchors deliberately do **not** use `data-route`. This prevents the legacy V9 parent/child transition capture from treating a lateral relation as a structural route change.

The rail is horizontally scrollable on narrow screens.

## Travel choreography

A normal cross-link follows four semantic phases:

```text
trace relation
    -> lateral travel
    -> arrive at target
    -> destination local context remains open
```

### 1. Trace

The runtime captures the current real graph SVG as a frozen visual snapshot.

The source node is measured once. A curved relation path is drawn from that node towards a side portal. A small travelling marker moves along the drawn relation.

This makes the reason for the transition visible before the route changes.

### 2. Travel

Once the relation has been traced, the actual destination hash is applied.

The canonical renderer builds the real destination scene underneath the Phase 6 overlay. The old snapshot moves laterally and recedes rather than collapsing into a parent or expanding from one.

### 3. Arrive

After the real destination renderer has settled, the actual target node is measured once. A second relation segment is drawn from the side portal to that real target position, with a target marker at the endpoint.

### 4. Local context

The overlay is removed only after arrival. The real destination graph remains on screen and the target node receives focus when possible.

The destination is not a detached detail card: it is the existing route/local context rendered by `site-graph.js`.

## Direction and Atlas geography

The lateral direction is deterministic and based on the same broad territory positions used by the canonical Atlas layout:

```text
Work          x ~ 390
About         x ~ 660
Knowledge     x ~ 1120
Education     x ~ 1710
Experience    x ~ 1990
```

Examples:

- Work -> Knowledge travels right;
- Education -> Knowledge travels left;
- Experience -> Work travels left;
- About -> Knowledge travels right.

A same-territory relation receives a stable deterministic direction from the source/target pair.

This does not replace the Atlas camera model. It only gives cross-scene travel a consistent spatial grammar.

## Work project relations

Work projects are represented semantically as `project-*` graph nodes, but the normal Work scene renders projects as labels attached to FCA concepts.

Phase 6 resolves a project endpoint to the real `.work-project-anchor-v5` when the Work scene is active. Therefore routes such as:

```text
work/project/sql-schema -> SQL
experience/ceske-priority -> work/project/social-workers-survey
```

can use the same cross-link travel without changing the Work lattice renderer.

This is intentionally not a Phase 4/5 rich project scene implementation.

## Existing detail-panel relations

Leaf details already expose a `Connected in the profile` list generated from `graph.edges`.

Outside Atlas, Phase 6 capture-intercepts those buttons and routes the selected direct relation through the same cross-link travel mechanism. The older detail UI therefore does not create a second lateral navigation behaviour.

Atlas remains different: its inspector keeps the user inside Atlas and pins/highlights cross-links locally.

## Structural navigation remains unchanged

Phase 6 does not modify:

- `site-graph.js`;
- `graph-transitions-v6.js`;
- the meaning of `parentIds`;
- Work FCA structure;
- Atlas rendering or pan/zoom ownership.

Ordinary parent/child navigation continues to use the existing structural V9 transition.

The visual difference is deliberate:

```text
parent/child       collapse / unfold through hierarchy
cross-link         relation trace / lateral travel / arrival
```

This is the central Phase 6 acceptance condition.

## Scene coordination

`cross-link-travel.js` uses `ProfileScene.transitions` as a transition lock and observability layer:

```text
begin -> prepare -> commit -> finish
```

It does not ask the coordinator to render the animation. The Phase 6 runtime owns its overlay while the canonical renderer owns the destination scene.

The legacy scene bridge does not start a competing transition because it only opens a legacy transition token when `body.is-v9-transitioning` appears. Cross-link travel deliberately never sets that class.

## Reduced motion

With `prefers-reduced-motion: reduce`:

- relation semantics and target selection remain identical;
- animated path travel is replaced by immediate path completion;
- the old snapshot does not perform lateral displacement;
- route handoff and arrival use short fades/timing only.

The destination still receives the same local context and focus treatment.

## Accessibility

- Cross-link controls are native anchors with meaningful `href` destinations.
- Relation and target labels are both exposed in the accessible name.
- Modifier-click behaviour is left to the browser.
- The transition overlay temporarily blocks accidental interaction while travel is running.
- On completion the real target node is focused when available.
- `#site-graph-status` announces the travel and destination.
- Reduced motion preserves all semantic information.

## Public API and observability

```js
ProfileCrossLinkTravel.navigate(targetId, type?)
ProfileCrossLinkTravel.relationsFor(sourceId)
ProfileCrossLinkTravel.snapshot()
```

Browser events:

```text
profile:crosslink-start
profile:crosslink-complete
```

If Umami is present, a completed lateral transition records:

```text
cross_link_travel
```

Rendering never depends on analytics.

## Regression coverage

`tests/phase6-cross-link.spec.js` covers:

1. Work project -> Knowledge evidence;
2. Education -> studied topic;
3. Experience -> project;
4. ordinary parent/child navigation remaining non-cross-link;
5. reduced-motion travel;
6. mobile portrait cross-link rail and travel.

Older Phase tests continue to exercise their own contracts unchanged.

## Acceptance mapping

Roadmap: **trace relation**  
Implemented by a relation-specific SVG path from the measured current node to the lateral portal.

Roadmap: **camera travel / cross-scene transition**  
Implemented by lateral motion/recession of the frozen real current graph while the canonical destination scene renders underneath.

Roadmap: **destination local context opens**  
The real destination route is opened and the arrival trace terminates at the measured real target node.

Roadmap: **cross-link visually feels different from parent/child navigation**  
Typed relation anchors bypass V9 structural capture and use trace -> lateral travel -> arrival; structural graph nodes retain the existing collapse/unfold transition.

## Deliberately deferred

Phase 6 does not:

- implement Phase 4 rich scene pilots;
- implement Phase 5 project artefacts;
- redesign Atlas semantic zoom / LOD (Phase 7);
- invent additional graph relations;
- rewrite the canonical renderer or V9 hierarchy transition engine.

The Phase 6 layer can therefore be refined independently when later rich scenes introduce additional cross-link endpoints.
