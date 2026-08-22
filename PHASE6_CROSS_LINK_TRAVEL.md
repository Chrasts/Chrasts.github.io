# Phase 6 — cross-link travel contract

Phase 6 implements differentiated navigation across typed non-hierarchical relations in the profile graph.

```text
parentIds       -> structural / parent-child navigation
graph.edges     -> typed cross-link travel
```

Phases 4 and 5 remain intentionally deferred.

## Relation source

No new semantic relations are invented here. `cross-link-travel-v2.js` reads the existing `SITE_DATA.graph.edges`, including:

- `related`;
- `evidence`;
- `studied-in`;
- `planned-study`;
- `credential-link`;
- `experience-link`;
- `education-link`.

The UI describes each edge from the active node's point of view. For example:

```text
SQL Schema -> SQL                 Evidence
ESSLLI -> SAT / SMT               Studied topic
České priority -> survey          Project
knowledge topic -> ESSLLI         Studied in
```

## Cross-link rail

A `.profile-crosslinks` rail appears below the breadcrumb when the current local item has typed relations.

It is hidden when:

- there are no direct typed relations;
- Atlas owns the screen;
- the Phase 3 intro owns the screen;
- another cross-link travel is already running.

Each relation remains a native anchor with a real destination `href`, but intentionally has no `data-route`. This prevents the structural V9 transition layer from interpreting it as parent/child navigation.

## Travel choreography

A cross-link uses a separate visual grammar:

```text
trace relation
    -> vector travel
    -> arrival trace
    -> real destination local context
```

### Trace

The current real graph SVG is frozen as the outgoing scene. A curved path is drawn from the measured source node toward a viewport portal and a marker travels along it.

### Vector travel

The destination route is then applied underneath the overlay. The old scene recedes in the opposite direction of the semantic travel vector rather than collapsing into a parent.

### Arrival

When the actual destination renderer has settled, the real target node is measured. A second path runs from the portal to that node.

### Local context

The overlay disappears only after the destination is real and stable. The target receives focus where possible.

## 2D Atlas geography

Cross-link travel now uses the radial global geometry instead of the older left/right approximation.

`ProfileGeometry.vectorBetween(sourceId, targetId)` measures the direction between the two nodes' canonical Atlas positions. The resulting unit vector drives:

- portal selection;
- departure path;
- old-scene recession;
- direction metadata.

Direction metadata can therefore be:

```text
left / right / up / down
up-left / up-right / down-left / down-right
```

Examples are now genuinely two-dimensional:

- Work project -> Knowledge topic generally travels up-right;
- Education -> Knowledge generally travels up-left;
- Experience -> Work travels leftward through the global map.

Same-territory links also receive a direction from the exact canonical Atlas node positions rather than from a hash fallback whenever radial geometry is available.

See `RADIAL_GLOBAL_GEOMETRY.md` for the shared compass and global/local geometry contract.

## Structural navigation remains different

Ordinary parent/child navigation still uses the existing V9 structural transition:

```text
parent/child       collapse / unfold through hierarchy
cross-link         relation trace / 2D vector travel / arrival
```

This is the central Phase 6 acceptance condition.

Entering a different territory through a cross-link still ends in the normal top-to-bottom local view. The global vector explains *where* the visitor travelled; it does not force the destination subtree to remain rotated.

## Work project endpoints

Work projects exist semantically as `project-*` graph nodes while the Work scene renders them as FCA concept labels.

The Phase 6 runtime resolves an active Work project endpoint to `.work-project-anchor-v5` where possible, so routes such as:

```text
work/project/sql-schema -> SQL
experience/ceske-priority -> work/project/social-workers-survey
```

can use the same cross-link travel without changing the Work lattice renderer.

## Detail-panel integration

Leaf details already expose `Connected in the profile` buttons generated from `graph.edges`.

Outside Atlas, Phase 6 intercepts direct relation buttons and sends them through the same vector travel mechanism. Atlas remains different: its inspector keeps the visitor inside Atlas and highlights the relation locally.

## Scene coordination

`ProfileScene.transitions` is used as a lock and observability layer:

```text
begin -> prepare -> commit -> finish
```

The Phase 6 runtime owns its overlay. The canonical renderer owns the destination scene.

The legacy bridge does not start a competing structural transition because cross-link travel never sets `body.is-v9-transitioning`.

## Reduced motion

With `prefers-reduced-motion: reduce`:

- relation semantics remain identical;
- path travel completes immediately;
- the outgoing scene does not perform the vector displacement;
- route handoff and arrival are shortened.

## Accessibility

- controls are native anchors with meaningful `href` values;
- relation and target are both represented in the accessible name;
- modifier-click remains browser-native;
- the travel overlay blocks accidental intermediate interaction;
- the real target receives focus when available;
- `#site-graph-status` announces the transition;
- reduced motion preserves all semantic information.

## Public API

```js
ProfileCrossLinkTravel.navigate(targetId, type?)
ProfileCrossLinkTravel.relationsFor(sourceId)
ProfileCrossLinkTravel.snapshot()
```

`relationsFor` and `snapshot` expose both `direction` and the normalised 2D `vector`.

Browser events:

```text
profile:crosslink-start
profile:crosslink-complete
```

Completed travel records `cross_link_travel` through Umami when analytics is available.

## Regression coverage

`tests/phase6-cross-link.spec.js` covers:

1. Work project -> Knowledge evidence with an up/right vector;
2. Education -> studied topic with an up/left vector;
3. Experience -> Work project;
4. parent/child navigation remaining structural;
5. reduced motion;
6. mobile portrait travel.

`tests/radial-geometry.spec.js` separately verifies the global compass and local normalisation on which vector travel depends.

## Deliberately deferred

Phase 6 still does not:

- implement Phase 4 rich scene pilots;
- implement Phase 5 project artefacts;
- implement Phase 7 semantic zoom / relation LOD;
- invent additional graph relations;
- alter the Work FCA order.
