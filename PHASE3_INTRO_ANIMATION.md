# Phase 3 — intro animation contract

Phase 3 adds a first-session opening sequence above the Phase 2 root landing.

The narrative is deliberately structural rather than decorative:

```text
full real Atlas
    -> semantic territories / clusters
    -> first-level profile branches
    -> Štěpán Chrast root
    -> Phase 2 root landing
```

The intro does not introduce a second graph model and does not use video, canvas or an illustrative substitute for the portfolio graph.

## Eligibility and session behaviour

The bootstrap lives in `scene-definitions.js` because eligibility is scene-level state.

The full intro is eligible only when:

- the initial route is `overview`; and
- `sessionStorage.profileIntroSeen !== "true"`.

A completed or skipped intro stores:

```js
sessionStorage.setItem('profileIntroSeen', 'true')
```

Subsequent reloads in the same browser tab/session therefore go directly to the Phase 2 root landing.

An explicit deep link such as `#knowledge`, `#work` or `#atlas` bypasses the intro. That entry also marks the intro as seen for the current session so the visitor is not shown an unexpected cinematic sequence later after already entering specific content.

The session flag is deliberately not persisted in `localStorage`: a later browsing session may show the narrative again.

## Real-graph source contract

The source of the intro is the canonical renderer.

`intro-animation.js` performs this hidden setup:

1. wait for the shared graph renderer and root landing controller;
2. internally render the real `atlas` route;
3. wait until the live Atlas contains the complete `SITE_DATA.graph.nodes` set;
4. clone the actual `.site-graph-svg` DOM;
5. strip duplicate DOM IDs, focus attributes and interactive accessibility attributes from the clone;
6. return the live renderer to `overview` underneath the intro overlay;
7. animate only the frozen real-Atlas snapshot.

The clone therefore preserves:

- canonical Atlas node coordinates;
- canonical labels;
- canonical edge geometry;
- real graph relation classes;
- current graph visual styling.

The intro adds only semantic metadata used for level-of-detail choreography.

The overlay advertises this contract through:

```text
data-source="real-atlas"
data-source-node-count="..."
```

`ProfileIntro.snapshot()` exposes the same source information for diagnostics/tests.

## Internal route preparation

The hidden Atlas preparation must not pollute browser history.

Phase 3 therefore does **not** call normal route controls. It uses `history.replaceState()` plus a synthetic `hashchange` so the existing `site-graph.js` hash listener performs the real render without inserting Atlas into the visitor's back/forward history.

`graph-transitions-v6.js` does not receive a pending user route activation for these synthetic setup changes, so the normal visible structural transition overlay is not started.

After the Atlas snapshot has been captured, the live renderer is already restored to the Phase 2 root landing before the intro overlay begins its final condensation/handoff.

For a bare `/` entry the temporary internal `#overview` hash is removed again before handoff. An explicit `/#overview` entry keeps its original hash form.

## Semantic tiers

The snapshot reuses the actual `SITE_DATA.graph` parent hierarchy to compute minimum depth from the root.

Each cloned node is classified as:

```text
depth 0     -> root
depth 1     -> section
depth 2     -> cluster
depth >= 3  -> deep
```

Edges are classified from the deepest of their endpoints.

This creates a semantic LOD mechanism without changing graph topology or layout coordinates.

## Prototype stages

The first implementation intentionally follows the roadmap's three-stage prototype before trajectory polish.

### 1. `atlas`

The complete real Atlas snapshot is visible and fitted to the viewport.

This establishes scale: the profile is a connected system larger than the immediately visible navigation hierarchy.

### 2. `territories`

Deep nodes and deep edges recede strongly while depth-2 clusters remain partially visible and the five first-level sections become dominant.

The snapshot camera moves to the bounding region of root + sections + depth-2 clusters.

This is a semantic condensation, not a uniform SVG scale animation.

### 3. `branches` -> `root`

Depth-2 clusters then disappear, leaving the first-level profile areas around the root.

The final stage removes all non-root nodes/edges and moves the snapshot camera to the real root coordinate.

The final root-only image cross-fades into the already prepared Phase 2 root landing.

The separate `branches` and `root` stage names make the final part observable/testable while preserving the roadmap's conceptual three-step narrative: Atlas, semantic condensation, root.

## Camera choreography

Camera motion is performed by interpolating the cloned SVG `viewBox`.

No alternative node-coordinate model is computed.

Targets are derived from real snapshot coordinates:

- full Atlas viewBox;
- bounding box of depth <= 2 nodes;
- bounding box of depth <= 1 nodes;
- root-centred final viewBox.

This keeps the camera independent from the live Atlas pan/zoom state after the snapshot has been captured and prevents the intro from mutating the canonical renderer while it is transitioning toward the landing state.

Current non-reduced timing is approximately:

```text
Atlas establish / settle      ~0.5 s
Atlas hold                    ~0.5 s
territories camera move       ~0.7 s
branches camera move          ~0.6 s
root camera move              ~0.6 s
root hold + cross-fade         ~0.5 s
```

The visible semantic sequence is therefore around the roadmap target of roughly 2.5–3.5 seconds, excluding renderer/bootstrap latency before the snapshot is first shown.

Trajectory polish is intentionally deferred until browser acceptance confirms that the semantic story works.

## Handoff

The Phase 2 landing is prepared underneath the snapshot **before** the root stage finishes.

During handoff:

- underlying header/main/footer become non-inert;
- document intro state becomes `handoff`;
- the root landing fades in;
- the intro overlay fades out over the same interval;
- the overlay is removed only after the overlap completes.

This overlap is the Phase 3 mechanism for avoiding a discrete Atlas/root DOM replacement jump.

After cleanup:

```text
html[data-profile-intro="complete"]
ProfileRootLanding.isActive() === true
body[data-graph-route="overview"]
```

## Skip behaviour

Interaction must always win over the cinematic sequence.

While the intro is pending/running, any of these immediately use the quick handoff path:

- pointer down / tap;
- Enter;
- Space;
- Escape;
- the visible `Skip intro` control (through the same pointer/keyboard path).

The underlying site header/main/footer are `inert` while the intro owns interaction, so a skip gesture cannot simultaneously activate an underlying route or control.

Skip does not jump into the expanded Overview graph. It lands on the same standalone root scene that a normally completed intro targets.

The public API is:

```js
ProfileIntro.skip()
ProfileIntro.snapshot()
```

## Reduced motion

With `prefers-reduced-motion: reduce`, Phase 3 keeps the structural information but removes semantic camera travel.

The reduced path is:

```text
real Atlas snapshot
    -> short fade
    -> Phase 2 root landing
```

Only the `atlas` semantic stage is emitted in this mode.

The same skip controls remain active.

## Mobile

The intro uses the same real Atlas snapshot model on desktop and mobile.

Atlas coordinates remain canonical. The intro snapshot is displayed with its own responsive SVG viewBox and does not rely on the mobile local-graph projection.

The mobile runtime may boot while the underlying Phase 2 explorer is hidden. At handoff the destination remains the existing mobile root composition; later root activation continues to use the Phase 2 `MobileProfileScene.repair()` path.

The intro overlay itself is fixed to the dynamic viewport and respects safe-area insets for its skip/caption controls.

## Interaction and failure safety

The normal site is hidden during `pending`/`running` and made inert once the intro starts.

The intro does not assume that setup succeeds. It has explicit fallback exits for:

- runtime/bootstrap timeout;
- missing intro stylesheet;
- Atlas route timeout;
- incomplete Atlas render;
- missing Atlas SVG;
- Overview restore timeout;
- root landing restore timeout.

A setup failure follows the same fast root-landing handoff as an explicit skip rather than leaving an unusable hidden page.

The intro waits until `intro-animation.css` is present in `document.styleSheets` before changing from `pending` to `running`, preventing an unstyled overlay race.

## Analytics and diagnostic events

If the existing Umami runtime is available, Phase 3 emits:

```text
intro_completed
intro_skipped
```

The implementation also dispatches browser events:

```text
profile:intro-started
profile:intro-stage
profile:intro-completed
profile:intro-skipped
profile:intro-fallback
```

These are optional observability hooks; rendering does not depend on analytics.

## Regression tests

`tests/phase3-intro.spec.js` covers:

- first-session full intro eligibility;
- actual real-Atlas source and exact source node count;
- `atlas -> territories -> branches -> root` stage progression;
- overlapping root handoff rather than discrete replacement;
- pointer skip;
- Escape skip;
- session-only refresh bypass;
- deep-link bypass;
- reduced-motion Atlas -> root path;
- mobile portrait handoff.

Phase 0, Phase 1 and Phase 2 tests explicitly pre-mark `profileIntroSeen=true` before navigation. This isolates their original contracts from Phase 3 and prevents an intro failure from masquerading as a renderer/root-landing regression.

The repository workflow syntax-checks the Phase 3 runtime/test and runs them as part of the existing Playwright suite.

## Validation status

Static architecture review and failure-path review are complete.

The implementation does not modify the canonical:

- `site-graph.js`;
- `graph-transitions-v6.js`;
- `mobile-app.js`.

The current ChatGPT execution environment still does not expose a usable push-triggered GitHub Actions result for this repository, so a passing browser run is **not** claimed solely from the presence of the workflow/test files.

A final real-browser visual pass should still judge:

- whether the Atlas is readable enough during the first ~0.5 s;
- whether the semantic territory stage is perceptually clear;
- whether the root cross-fade reads as continuity rather than a cut;
- mobile frame pacing on an actual phone.

Those are perceptual acceptance questions, not reasons to replace the current real-graph architecture.

## Deliberately deferred

Phase 3 does not yet optimise individual node trajectories or introduce bespoke aggregate territory glyphs.

It also does not:

- rewrite Atlas layout;
- add semantic Atlas LOD for normal interactive Atlas use;
- replace the legacy structural route animation engine;
- add rich project-scene content;
- perform broad CSS consolidation.

Those are later roadmap concerns. The current prototype deliberately proves the narrative and handoff contract first.

## Acceptance mapping

Roadmap: **Atlas snapshot/state**  
Implemented by cloning the fully rendered canonical Atlas SVG after all real graph nodes are present.

Roadmap: **semantic condensation**  
Implemented through hierarchy-derived semantic depth tiers and staged LOD fading.

Roadmap: **camera choreography**  
Implemented by real-coordinate-derived `viewBox` interpolation.

Roadmap: **root landing handoff**  
The Phase 2 root landing is restored beneath the overlay before an overlapping cross-fade.

Roadmap: **skip**  
Pointer/tap, Enter, Space and Escape all terminate into the usable root scene.

Roadmap: **reduced motion**  
A short real-Atlas -> root fade replaces camera movement.

Roadmap: **session only**  
`sessionStorage.profileIntroSeen` suppresses later intros in the same session.

Roadmap acceptance: **intro uses real graph**  
The source is the live Atlas SVG, not an independently generated visual.

Roadmap acceptance: **interaction can skip**  
Interaction has a capture-phase escape path and underlying controls are inert.

Roadmap acceptance: **mobile and desktop both work**  
The same snapshot/state machine is responsive and has dedicated desktop/mobile Playwright coverage.
