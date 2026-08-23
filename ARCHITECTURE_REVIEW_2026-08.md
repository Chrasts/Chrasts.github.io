# Architecture review — August 2026

This document records the current runtime ownership model, the safe cleanup performed in the August 2026 review, and the remaining technical debt that should be removed before adding many more rich artefact scenes.

## Current ownership contract

The intended owners are:

- `site-data.js` — semantic graph and Work project data.
- `artifact-data.js` — published artefact metadata and source locations.
- `scene-system.js` — scene-object registration, lifecycle, responsive variants and camera/transition coordination.
- `site-graph.js` — live graph DOM and local graph rendering.
- `radial-geometry.js` / `ProfileGeometry` — canonical Overview and Atlas coordinates.
- `graph-transitions-v6.js` — temporary transition overlay and transition interpolation; it must not become a settled-state geometry owner.
- `phase7-atlas.js` — Atlas LOD, camera interaction and Atlas-only presentation policy.
- `phase8-*` — semantic Experience/Education scene content.

New rich artefact work should build on `ProfileScene` and `ProfileArtifacts` rather than adding new route-specific observers or patching graph DOM globally.

## Changes made in this review

### Scene system

`SceneObjectRegistry` now rejects duplicate object IDs instead of silently replacing an existing definition. A duplicate ID is almost always an ownership bug.

Responsive variants are resolved before their selector/`resolve()` function is evaluated. A mobile or desktop variant can therefore own a different DOM root, not only a different placement.

Unregistering a scene object now detaches its mounted instance and removes scene-owned DOM metadata. Replacing a resolved DOM root through a responsive variant also unmounts the previous root before mounting the new one.

The scene manager no longer observes the entire document subtree for arbitrary child mutations. It observes graph-state attributes on `body` and direct scene-root insertions on `.scene-canvas`. This prevents graph transition overlays and node churn from triggering unrelated scene refreshes.

### Static validation

`scripts/validate-portfolio-model.mjs` validates the semantic model before browser tests:

- graph node IDs and routes are unique;
- parent references and typed edge endpoints exist;
- the parent relation is acyclic;
- Work attributes, contexts, project IDs and ordering are coherent;
- generated Work graph nodes correspond to Work data;
- Phase 8 node and artefact references resolve.

The workflow syntax check now covers all root JavaScript, validators and Playwright specs automatically, so a newly added runtime file cannot accidentally bypass syntax validation.

### CI

Push smoke tests are split into three independent browser jobs: core rendering, architecture contracts and interactions. This keeps failures independent and makes architecture regressions visible without serialising them behind the larger interaction suite.

## Remaining debt

### P1 — duplicated Work implementation

`script.js` still contains the original Work lattice/filter renderer while `site-graph.js` contains the integrated graph version of the same FCA model. The hidden legacy Work DOM is also used as a control source. There is even a compatibility shim in `site-graph.js` for an undefined `count` reference in the legacy renderer.

Target state: extract a small Work model/controller used by the integrated renderer, create the controls directly in the shared scene, then remove the old Work renderer and hidden `#work` DOM reservoir. Do this as one tested migration rather than deleting individual pieces.

### P1 — global prototype patches

Several stability layers still patch browser prototypes:

- `phase0-stability.js` intercepts `Element.prototype.setAttribute` for graph labels;
- `graph-transition-prelude.js` intercepts `Document.prototype.querySelectorAll` and temporarily proxies `matchMedia`;
- `phase7-pointer-hotfix.js` patches `Node.prototype.textContent`, `DOMTokenList.add/remove` and SVG pointer capture.

These patches solved real race conditions, but they make ownership implicit and can affect future scene objects. They should be removed only after their source races are eliminated and covered by tests.

### P1 — multiple geometry repair layers

Overview/Atlas geometry is currently protected by `radial-geometry.js`, `global-geometry-ownership.js`, and additional label policy in Phase 0 / Phase 7. `radial-geometry.js` also repeatedly re-applies geometry for a time window after mutations.

Target state: the graph renderer asks `ProfileGeometry` for settled Overview/Atlas positions before rendering. Transition code reads the same destination geometry. Once no second writer exists, delete the stabilisation loops and global repair observer.

### P2 — distributed bootstrap

Runtime files are loaded from several places: `index.html`, `scene-definitions.js`, `radial-geometry.js` and `scene-legacy-bridge.js`. This makes dependency order harder to audit.

Target state: one explicit bootstrap manifest/order for core runtime, optional mobile runtime, Atlas runtime and semantic/artefact scenes. Avoid introducing another loader for the upcoming artefact visualisation layer.

### P2 — legacy page sections

`index.html` still contains legacy Background, Methods, Contact and the original Work section. Some are hidden after the graph app starts; Work is additionally used as a source of controls.

Target state: once Work controls are extracted, delete runtime-only legacy content from the interactive application and keep any desired no-JS fallback as a deliberately separate fallback block.

## Next architectural step for rich artefacts

Before adding many image/PDF visualisations, introduce a thin data-driven artefact scene layer rather than route-specific code:

1. keep source/file metadata in `artifact-data.js`;
2. add scene bindings that map artefact IDs to semantic nodes/routes and a presentation recipe;
3. implement a small renderer registry for recipes such as document, floating diagram and image fan;
4. mount those objects as direct `.scene-canvas` children so they follow the scene-manager boundary established in this review;
5. keep graph highlighting/cross-link behaviour as an explicit interaction contract, not a DOM observer side effect.

The first 2–3 real visual objects should determine the abstraction. Do not create a general renderer hierarchy before those pilots expose shared requirements.
