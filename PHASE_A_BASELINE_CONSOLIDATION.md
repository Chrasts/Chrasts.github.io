# Phase A — Current Baseline Consolidation

Date: 2026-08-23  
Baseline audited: `main` at `bd1c80bd331f6388d48a7668583c07101a46d132` (`Keep artifact focus controls inside viewport`)

This document freezes the current runtime architecture before the Object Focus, Composition, Camera and Motion phases begin. It is intentionally an audit, not a cleanup pass.

## 1. Phase A scope

The current roadmap defines Phase A as:

- verify current CI;
- audit scene/graph ownership;
- document known legacy layers;
- identify fixed-position artifact patches that should later move into the composer;
- confirm mobile Focus/Atlas interaction;
- confirm Work direct project targets;
- verify current rich artifact scenes;
- remove obsolete assumptions from future planning.

Phase A explicitly does **not** include a broad rewrite, mass CSS merge or animation-library migration.

---

## 2. Canonical ownership map

### Semantic/profile data

**Owner:** `site-data.js`

Owns:
- graph nodes and hierarchy;
- typed relations/cross-links;
- Work project/context/theme data;
- canonical route/node identity used by the graph layer.

Do not duplicate semantic node/project definitions in scene code.

### Artifact metadata

**Owner:** `artifact-data.js` / `ProfileArtifacts`

Owns:
- artifact identity;
- source/file locations;
- semantic artifact type;
- publication/availability metadata;
- graph anchors.

`artifact-scene-bindings.js` references artifact IDs rather than owning file paths.

### Settled graph DOM and local graph state

**Owner:** `site-graph.js`

Owns:
- live graph DOM;
- route-local graph rendering;
- integrated Work lattice presentation;
- settled node/edge representation.

Transition overlays must not become settled geometry owners.

### Canonical Overview / Atlas geometry

**Owner:** `radial-geometry.js` / `ProfileGeometry`

Owns deterministic global target coordinates.

`global-geometry-ownership.js`, Phase 0/7 label policies and repeated repair/reapply logic are currently stabilisation layers around this owner, not alternate canonical geometry systems.

### Transitional graph geometry

**Owner:** `graph-transitions-v6.js`

Owns temporary transition overlay/interpolation state. It must hand off to the settled renderer rather than retain geometry ownership after a transition.

`graph-transition-prelude.js` is a compatibility/stability layer and should not be extended as a second transition architecture.

### Atlas-specific interaction and LOD

**Owner:** `phase7-atlas.js`

Owns:
- Atlas-only pan/zoom behaviour;
- Atlas LOD/presentation policy;
- Atlas controls and interaction state.

It consumes canonical profile/geometry data rather than defining a second graph model.

### Scene lifecycle

**Owner:** `scene-system.js` / `ProfileScene`

Owns:
- scene-object registration;
- object lifecycle;
- responsive scene variants;
- graph-state synchronisation contract;
- camera adapter registry;
- transition coordination hooks.

New rich scene work should register through `ProfileScene`; it should not add route-global DOM observers as an alternative lifecycle system.

### Legacy scene bridge

**Bridge:** `scene-legacy-bridge.js`

Current responsibilities:
- synchronise existing graph/body route state into `ProfileScene`;
- expose desktop/Atlas/mobile camera adapters over existing renderers;
- translate legacy transition state into the scene transition coordinator;
- boot Phase 8 and artifact-scene bundles.

This file is deliberately a bridge. Future architecture should reduce its responsibilities rather than make it a new canonical owner.

### Rich artifact scene presentation

**Owners:**
- `artifact-scene-bindings.js` — route/node placement bindings;
- `artifact-scene-recipes.js` — reusable scene visual grammar;
- `artifact-scene-runtime.js` — scene lifecycle, focus viewer, tethering and responsive behaviour;
- `artifact-scenes.css` / `artifact-scenes-layout.css` — current artifact presentation geometry.

### Current artifact placement heuristic

**Owner:** `artifact-scene-layout-contract.js`

Current contract:
- route target declares preferred left/right side;
- open inspector lane can flip the artifact to the opposite side;
- mobile delegates to the shared mobile tray.

This is an intentional interim heuristic, **not** the final Scene Composition system from Phase D.

### Phase 8 semantic scenes

**Owners:** `phase8-scene-data.js`, `phase8-semantic-scenes.js`, `phase8-semantic-scenes.css`

Own the current Experience/Education semantic scene objects. They should later migrate to the shared composition/focus primitives rather than spawn parallel systems.

### Work metadata/detail surface

**Owner:** current integrated graph/detail interaction in `site-graph.js` plus existing inspector/detail code.

The hidden legacy Work section in `index.html` / `script.js` is still used as a control/data compatibility reservoir and is not the desired long-term owner.

---

## 3. Known legacy and stabilisation layers

These are recorded now so later phases do not accidentally build new abstractions on top of them.

### P1 — duplicated Work implementation

`script.js` still contains the original Work lattice/filter implementation while `site-graph.js` contains the integrated graph version. The legacy Work DOM remains present and is still used as a control source.

Target cleanup belongs to the final legacy consolidation phase, unless a prerequisite is forced earlier by the new composition architecture.

### P1 — global prototype patches

Existing stability layers patch browser prototypes, including:

- `phase0-stability.js`;
- `graph-transition-prelude.js`;
- `phase7-pointer-hotfix.js`.

These solved real races but make ownership implicit. Do not add new global prototype patches for Object Focus, Composition or Camera work.

### P1 — multiple geometry repair layers

Current geometry is protected by:

- `radial-geometry.js`;
- `global-geometry-ownership.js`;
- Phase 0/7 label policies;
- repeated geometry reapplication after mutations.

The target is still one deterministic settled geometry owner. New motion should consume canonical target geometry instead of adding another repair loop.

### P2 — distributed bootstrap

Core files are loaded from `index.html`, while semantic/artifact bundles are additionally booted through `scene-legacy-bridge.js` and related runtime loaders.

Do not introduce another independent loader in Phase B/C/D.

### P2 — legacy page sections

`index.html` still contains legacy Work, Methods, Contact and other conventional-page material. Some of it is hidden after the graph app starts; Work still has runtime compatibility value.

Do not remove these sections piecemeal during motion work.

### Historical CSS/runtime layering

Several generations remain active or loadable, including graph, intro and mobile layers. This is technical debt but currently part of the tested baseline.

Phase A rule: document it now; merge/remove it only after the interaction architecture matures.

---

## 4. Fixed-position / ad hoc composition debt

These are concrete migration targets for Phase D — Scene Composition System.

### Artifact side docking

`artifact-scenes.css` currently places desktop artifact objects using fixed scene offsets such as:

- left/right `16px`;
- top `70px`.

`artifact-scene-layout-contract.js` only chooses left vs right and avoids the inspector lane.

### Media-deck card geometry

`artifact-scenes.css` and `artifact-scenes-layout.css` currently use fixed pixel widths, translations, rotations and `nth-child` rules for:

- `diagram` decks;
- `screens` decks;
- `fan` galleries.

These are valid current recipes but should eventually declare semantic placement preferences to the composer instead of owning global scene coordinates.

### Hedgehog House low-left dock

The current test intentionally verifies low-left docking. Treat this as a baseline behaviour to migrate, not a permanent composition API.

### Mobile artifact tray

The mobile tray is currently a strong explicit layout rule (`bottom: 64px`, viewport-relative sizing). Phase P may refine this, but Phase D should expose it as a semantic mobile placement policy rather than route-specific CSS.

### Focus viewer composition

The current focus viewer is bounded and working, but it is still an overlay-style scene surface. Phase B/C will replace the visual discontinuity with shared-element object focus while preserving its accessibility/fallback behaviour.

---

## 5. Mobile Focus / Atlas baseline

Current automated contracts already verify:

- mobile runtime boots only at mobile breakpoint;
- `ProfileScene.manager.variant === 'mobile'`;
- local mobile camera adapter is `mobile-local`;
- deep Focus routes return cleanly to Overview;
- removed mobile cross-link rail stays hidden;
- Work exposes mobile filter controls;
- Atlas exposes mobile Layers controls;
- Atlas has a compact Profile return action;
- Work remains lattice-shaped in Atlas with multiple project ranks;
- project metadata labels remain suppressed in the Atlas Work territory;
- rich artifact scenes collapse into a non-scrolling mobile tray.

Phase A conclusion: mobile Focus/Atlas semantics are present and contract-tested. Future phases must preserve semantic parity while changing composition/motion.

---

## 6. Work direct project target baseline

Current interaction contracts verify:

- direct project anchors receive enhanced primary hit targets;
- hitboxes are at least `104 × 24` SVG units;
- direct activation opens `#work/project/...`;
- project inspection does not re-layout the Work lattice;
- concept inspector presents linked projects as a primary `Open a project` action;
- opening a project from the concept inspector also preserves lattice geometry.

Phase A conclusion: direct project selection is already the primary interaction contract and must not regress when scene objects become richer.

---

## 7. Rich artifact scene baseline

Current artifact architecture exposes two reusable recipes:

- `document-folio`;
- `media-deck`.

Current verified scene bindings include:

1. Simulation Credence PDF folio;
2. CLP paper folio;
3. BSc thesis diagram deck;
4. Modal Logic Lab screenshot deck;
5. Hedgehog House photo gallery.

Additional semantic scene implementations already include the certification stack, ESSLLI timetable, Experience timeline and prg.ai route/status scene.

Current automated artifact contracts verify:

- artifact manifest/scene boot without registry issues;
- PDF folio preview and focus viewer;
- directly selectable thesis specimens;
- Modal Logic Lab live-app affordance;
- Hedgehog House graph tethering and original-resolution image focus;
- mobile non-scrolling artifact tray.

These scenes are pilots/evidence for the next architecture. Do not rebuild them from scratch.

---

## 8. CI baseline

Workflow: `.github/workflows/phase0-smoke.yml`

The workflow currently performs:

### Static validation
- JavaScript syntax checks;
- portfolio model validation;
- artifact manifest validation;
- artifact scene validation.

### Push browser smoke matrix
- core;
- architecture;
- interactions.

### Pull-request/manual regression
- full Playwright suite.

Phase A should only be marked fully complete after the branch/PR containing this audit passes the current workflow. The workflow configuration itself is present and covers the ownership/interaction areas relevant to this baseline.

---

## 9. Obsolete roadmap assumptions removed from future planning

Future work should **not** assume that the site still needs to invent from scratch:

- SceneManager / scene registry;
- camera abstraction;
- route synchronisation;
- Atlas mode;
- Focus mode;
- Work FCA lattice;
- typed cross-link travel;
- root landing;
- intro foundation;
- artifact metadata registry;
- artifact bindings/recipes/runtime;
- mobile graph runtime;
- Experience timeline;
- ESSLLI timetable;
- certification stack;
- current artifact pilots.

The new roadmap starts from these as existing substrate and focuses next on object continuity, scene composition, camera composition and interruptible motion.

---

## 10. Phase A acceptance checklist

- [x] Current scene/graph ownership audited.
- [x] Known legacy/stabilisation layers documented.
- [x] Fixed-position artifact composition debt identified.
- [x] Mobile Focus/Atlas interaction confirmed by existing automated contracts.
- [x] Work direct project targets confirmed by existing automated contracts.
- [x] Current rich artifact scenes verified against implementation/tests.
- [x] Obsolete pre-baseline roadmap assumptions removed from future planning.
- [ ] Current branch/PR CI confirmed green.
- [ ] No known broken core navigation after the Phase A commit.

The last two items are release gates rather than reasons to rewrite runtime code inside Phase A.

---

## 11. Next step after Phase A

When this baseline is green, proceed to **Phase B — Object Focus Pilot** in this order:

1. Hedgehog House image;
2. certificate;
3. BSc thesis diagram.

The pilot should preserve current routes, graph state, accessible fallback links and mobile behaviour while replacing the current overlay-like focus transition with shared-element spatial focus.
