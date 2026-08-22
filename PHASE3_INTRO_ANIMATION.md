# Phase 3 — intro animation contract

Phase 3 adds a first-session opening sequence above the Phase 2 root landing.

```text
full real Atlas
    -> semantic territories / clusters
    -> first-level profile branches
    -> Štěpán Chrast root
    -> Phase 2 root landing
```

The intro is structural rather than decorative: it uses the actual portfolio graph and does not introduce video, canvas or a second graph model.

## Eligibility and first-paint guard

Eligibility is decided before first paint in the small bootstrap inside `index.html`.

The full intro is eligible only when:

- the initial route is `overview`; and
- `sessionStorage.profileIntroSeen !== "true"`.

The bootstrap sets:

```text
html[data-profile-intro="pending"]
```

before body rendering. `intro-animation.css` is loaded statically from `<head>`, so the Phase 2 root UI cannot flash briefly before the Atlas intro.

`scene-definitions.js` then confirms the same scene-level eligibility and exposes `window.__PROFILE_INTRO_BOOTSTRAP__` to the intro runtime.

If `sessionStorage` is unavailable, the intro is bypassed rather than repeated on every reload.

A completed or skipped intro stores:

```js
sessionStorage.setItem('profileIntroSeen', 'true')
```

Subsequent reloads in the same browser tab/session therefore go directly to the Phase 2 root landing.

An explicit deep link such as `#knowledge`, `#work` or `#atlas` bypasses the intro and marks it seen for that session. A visitor who intentionally entered specific content is not interrupted by the cinematic sequence later.

## Real-graph source contract

`intro-animation.js` uses the canonical renderer as its source:

1. wait for the shared graph renderer and root landing controller;
2. internally render the real `atlas` route;
3. wait until the live Atlas contains the complete `SITE_DATA.graph.nodes` set;
4. clone the actual `.site-graph-svg` DOM;
5. remove duplicate DOM IDs, focus attributes and interactive accessibility attributes from the clone;
6. restore the live renderer to `overview` underneath the intro overlay;
7. animate only the frozen real-Atlas snapshot.

The clone preserves canonical node coordinates, labels, edges and relation classes. The intro adds only semantic LOD metadata.

The overlay advertises its origin through:

```text
data-source="real-atlas"
data-source-node-count="..."
```

and `ProfileIntro.snapshot()` exposes the same diagnostic data.

## Internal route preparation

The hidden Atlas setup must not pollute browser history.

Phase 3 uses `history.replaceState()` plus a synthetic `hashchange`, allowing the existing `site-graph.js` hash listener to perform the real render without inserting a temporary Atlas entry into back/forward history.

Because this is not a captured user route activation, the normal `graph-transitions-v6.js` overlay does not start for the hidden setup.

After the snapshot is captured, the live renderer is already restored to the Phase 2 root landing before the visible condensation completes.

For a bare `/` entry, the temporary internal `#overview` hash is removed again before handoff. An explicit `/#overview` entry retains its original URL form.

## Semantic tiers

The snapshot reuses `SITE_DATA.graph` parent relationships to compute minimum depth from the root:

```text
depth 0     -> root
depth 1     -> section
depth 2     -> cluster
depth >= 3  -> deep
```

Edges are classified from the deepest endpoint. This produces semantic level-of-detail without changing graph topology or layout coordinates.

## Prototype stages

The implementation deliberately follows the roadmap's semantic prototype before trajectory polish.

### `atlas`

The complete real Atlas snapshot is visible and fitted to the viewport.

### `territories`

Deep nodes/edges recede strongly, depth-2 clusters remain partially visible, and the first-level sections become dominant. The camera moves to the real-coordinate bounds of depth <= 2 nodes.

### `branches`

Depth-2 clusters disappear, leaving the root and first-level profile areas. The camera moves to the real-coordinate bounds of depth <= 1 nodes.

### `root`

All non-root graph objects fade away and the snapshot camera moves to the real root coordinate.

`branches` and `root` are separate observable implementation stages, but conceptually form the roadmap's final condensation from the first-level profile structure into the person/root.

## Camera choreography

Camera movement interpolates only the cloned SVG `viewBox`.

No alternative node-coordinate model is computed. Targets are derived from the actual snapshot:

- full Atlas viewBox;
- depth <= 2 bounding region;
- depth <= 1 bounding region;
- root-centred final viewBox.

The live renderer is not mutated while the visible intro camera is moving.

Approximate non-reduced visible timing is:

```text
Atlas establish / settle      ~0.5 s
Atlas hold                    ~0.5 s
territories move              ~0.7 s
branches move                 ~0.6 s
root move                     ~0.6 s
root hold + cross-fade         ~0.5 s
```

This is around the roadmap's target of roughly 2.5–3.5 seconds once the real Atlas snapshot is available.

## Root landing handoff

The Phase 2 root landing is prepared underneath the snapshot before the final root stage finishes.

During handoff:

- underlying header/main/footer become non-inert;
- document intro state becomes `handoff`;
- the Phase 2 root scene fades in;
- the intro overlay fades out over the same interval;
- the overlay is removed only after the overlap completes.

After cleanup:

```text
html[data-profile-intro="complete"]
ProfileRootLanding.isActive() === true
body[data-graph-route="overview"]
```

The cross-fade is the current prototype mechanism for avoiding a discrete DOM handoff jump. Fine trajectory matching can be tuned only after visual acceptance.

## Skip behaviour

Interaction always wins over the intro.

While pending/running, any of these immediately use the quick handoff path:

- pointer down / tap;
- Enter;
- Space;
- Escape;
- the visible `Skip intro` control.

The underlying site header/main/footer are `inert` while the intro owns interaction, so a skip gesture cannot simultaneously activate an underlying route.

Skip lands on the same standalone Phase 2 root scene as a completed intro, not directly in the expanded Overview graph.

Public API:

```js
ProfileIntro.skip()
ProfileIntro.snapshot()
```

## Reduced motion

With `prefers-reduced-motion: reduce`, the semantic camera travel is removed.

```text
real Atlas snapshot
    -> short fade
    -> Phase 2 root landing
```

Only the `atlas` semantic stage is emitted. Information and skip controls remain available.

## Mobile

Desktop and mobile use the same real Atlas source and the same state machine.

The intro snapshot has its own responsive SVG viewBox and does not use the mobile local-graph projection. The destination remains the existing Phase 2 mobile root composition.

The overlay respects safe-area insets for skip/caption controls. After later root activation, Phase 2 still uses `MobileProfileScene.repair()` for the normal mobile graph.

## Failure safety

The intro explicitly fails open to the root landing for:

- runtime/bootstrap timeout;
- missing intro stylesheet;
- Atlas route timeout;
- incomplete Atlas render;
- missing Atlas SVG;
- Overview restore timeout;
- root landing restore timeout.

A setup failure uses the same fast handoff as an explicit skip instead of leaving a hidden or unusable page.

The runtime waits until `intro-animation.css` is present in `document.styleSheets` before changing `pending -> running`.

## Observability

If Umami is available, Phase 3 emits:

```text
intro_completed
intro_skipped
```

Browser events:

```text
profile:intro-started
profile:intro-stage
profile:intro-completed
profile:intro-skipped
profile:intro-fallback
```

Rendering does not depend on analytics.

## Regression tests

`tests/phase3-intro.spec.js` covers:

- first-session eligibility;
- real-Atlas source and exact source node count;
- `atlas -> territories -> branches -> root` progression;
- overlapping handoff;
- pointer skip;
- Escape skip;
- session-only refresh bypass;
- deep-link bypass;
- reduced-motion Atlas -> root path;
- mobile portrait handoff.

Phase 0, Phase 1 and Phase 2 tests pre-mark `profileIntroSeen=true` before navigation. Their original renderer/scene/root contracts therefore remain isolated from the new opening animation.

The portfolio workflow syntax-checks the Phase 3 runtime/test and runs the full Playwright suite.

## Validation status

Static architecture, failure-path and Phase 2 -> Phase 3 diff review are complete.

Phase 3 does not modify:

- `site-graph.js`;
- `graph-transitions-v6.js`;
- `mobile-app.js`.

The available GitHub connector still does not expose push-triggered Actions runs/checks for this repository, so a passing browser suite is **not** claimed solely from the committed workflow/tests.

A real-browser visual pass should still judge perceptual qualities that assertions cannot establish reliably:

- initial Atlas readability;
- semantic clarity of the territory stage;
- continuity of the root cross-fade;
- frame pacing on an actual phone.

## Deliberately deferred

Phase 3 does not yet optimise individual node trajectories or introduce bespoke aggregate territory glyphs.

It also does not:

- rewrite Atlas layout;
- add semantic LOD to normal interactive Atlas use;
- replace the legacy route animation engine;
- add rich project-scene content;
- perform broad CSS consolidation.

The current prototype proves the narrative/state/handoff contract first, as required by the roadmap.

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
