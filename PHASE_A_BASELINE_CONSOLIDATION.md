# Phase A — V3.1 Rebaseline and Execution Boundaries

Date: 2026-08-24  
Roadmap authority: `Interactive Graph Portfolio - Agent-Executable Master Roadmap V3.1.md`  
Supplement: `Interactive Graph Portfolio - V3.1 Supplement - Additional Material from V3.md`  
Baseline audited: `main` at `ec0a1b831889aea2f4ba0270ff5e6d22b42623b6`

This document rebaselines the current runtime against V3.1. It supersedes the previous Phase A execution order in this file. Historical phase documents remain useful implementation evidence, but they are not the forward product specification where they conflict with V3.1.

## 1. Phase A conclusion

The current site already contains substantial infrastructure that V3.1 explicitly says to preserve when it represents sound canonical ownership. The next implementation cycle should therefore **not** restart the graph, routing, scene registry, FCA lattice, artifact metadata, mobile runtime or transition coordination from scratch.

The main architectural problem is different: several interaction/presentation systems were accumulated in earlier phases as bounded compatibility or polish layers. V3.1 now requires those layers to become a stronger canonical interaction architecture rather than receiving more local patches.

The immediate execution order after this rebaseline is:

1. explicit node interaction state system;
2. reusable `HaloRenderer`;
3. semantic hover integration through existing graph semantics;
4. soft local node dynamics;
5. 2.5D camera foundation;
6. Intro 3.0 Atlas reveal;
7. root entry portal;
8. semantic Atlas condensation;
9. polished root + five-branch profile landing;
10. Quick Overview;
11. Atlas / Focus spatial unification;
12. early mobile/accessibility/performance checkpoint.

This replaces the older post-Phase-A assumption that Object Focus pilots should be the next primary implementation target.

---

## 2. Protected canonical ownership

These systems are treated as high-value substrate unless a later phase demonstrates a concrete architectural conflict.

### Semantic profile / ontology

**Owner:** `site-data.js`

Preserve:
- node identity and hierarchy;
- typed semantic relations;
- route/node mapping;
- Work project/context/theme semantics.

Do not duplicate semantic graph knowledge inside interaction, halo, physics or scene code.

### Artifact metadata

**Owner:** `artifact-data.js` / `ProfileArtifacts`

Preserve artifact identity, source/file locations, semantic artifact types and graph anchors.

### Settled graph rendering

**Owner:** `site-graph.js`

Preserve its role as the settled graph/route renderer and owner of existing semantic relationship classes. New interaction layers may consume those classes but should not create a second graph model.

### Deterministic global target geometry

**Owner:** `radial-geometry.js` / `ProfileGeometry`

Canonical topology remains deterministic. V3.1 node dynamics must add only temporary interaction offsets; they must not rewrite these settled target coordinates.

### Atlas-specific structural behaviour

**Owner:** `phase7-atlas.js`

Preserve Atlas pan/zoom/LOD and structural visibility ownership until Atlas/Focus unification deliberately migrates that responsibility.

### Transition coordination

**Owner:** `transition-coordination.js` for supersedable transition state/tokens, with `graph-transitions-v6.js` owning current structural transition geometry.

Preserve the interruptible-transition contract. New motion primitives should integrate with this ownership rather than add independent timer/callback state machines.

### Scene lifecycle

**Owner:** `scene-system.js` / `ProfileScene`

Preserve registration, lifecycle, responsive variants and graph-state synchronisation contracts.

### Work FCA mathematics

Preserve the existing FCA lattice semantics and project relationships. V3.1 explicitly treats this mathematics as canonical substrate; later scene polish must not simplify it into a decorative project grid.

---

## 3. Existing substrate that partially satisfies new V3.1 phases

V3.1 phase names do not imply that every subsystem starts from zero.

### Node interaction / semantic hover

`graph-feel.js` already provides a bounded presentation microstate with pointer/keyboard parity and consumes semantic classes produced by the graph renderer. It currently tracks states such as `idle`, `preview`, `pressed`, `dragging` and `transition` and injects one SVG halo per node.

This is useful substrate, but it is **not yet the V3.1 Phase B target** because:
- state is primarily graph-global rather than an explicit reusable per-node state model;
- halo creation is coupled directly to `ProfileGraphFeel`;
- the halo is one fixed circle rather than a reusable semantic renderer/preset system;
- root-entry, related, selected and future depth states are not owned by a dedicated halo primitive;
- there is no canonical interaction-offset contract for Phase C node dynamics.

Phase B should therefore refactor/evolve this layer rather than stack another hover system on top of it.

### Semantic relationship response

The settled graph renderer already exposes upstream/downstream/lateral and Work relationship classes. Preserve that semantic source of truth. Phase B should improve presentation and coordination, not re-derive graph relationships independently.

### Camera

A camera abstraction and composition work already exist (`camera-composition.js` plus adapters registered through the scene bridge). V3.1 Phase D should extend this into a semantic 2.5D composition system, not invent a parallel camera API.

### Scene/object infrastructure

`scene-system.js`, `scene-composer.js`, artifact bindings/recipes/runtime and Object Focus infrastructure are real reusable substrate. They move later in the V3.1 execution order because the graph-native spatial interaction character now has priority.

---

## 4. Explicitly replaceable / migration-target subsystems

These are not protected merely because they currently work.

### Intro stack

Current active/historical intro layers include:
- `intro-animation.js` / `.css`;
- `intro-fixes-v3.js` / `.css`;
- `intro-unfold.js` / `.css`;
- Phase H intro behaviour layered onto the live graph.

V3.1 requires Intro 3.0 to be a live Atlas state (`PREPARING → ATLAS_REVEAL → ATLAS_READY`) with persistent Atlas exploration, root portal and later semantic condensation. Existing intro code may be substantially replaced when Phase E/F/G are implemented.

### Graph presentation layers

Multiple historical CSS generations remain in the repository (`graph-v4.css`, `graph-v5.css`, `graph-v8.css`, `graph-v9.css`, `graph-feel.css`, motion polish and Atlas layers). Do not perform an unrelated mass merge now, but do not treat this layering as a design constraint for the new renderer primitives.

### Legacy bridge / compatibility patches

`scene-legacy-bridge.js`, `graph-transition-prelude.js`, `phase0-stability.js`, `phase7-pointer-hotfix.js`, `global-geometry-ownership.js` and similar repair layers are migration/stability mechanisms, not preferred homes for new V3.1 behaviour.

Rule for new work: if a new feature would require another global prototype patch, repeated geometry repair loop, route-specific coordinate override or independent transition timer, stop and fix the abstraction instead.

### Root landing / profile entry composition

The current landing and Phase H portrait handoff are historical implementation evidence. V3.1 explicitly allows major DOM/composition changes here. The final profile root must show the five primary branches immediately and remain spatially continuous with Atlas condensation.

---

## 5. Current active bootstrap boundary

`index.html` directly loads the core runtime in this order:

1. `site-data.js`
2. `scene-system.js`
3. `transition-coordination.js`
4. `scene-definitions.js`
5. `phase0-stability.js`
6. `graph-transition-prelude.js`
7. `site-graph.js`
8. `radial-geometry.js`
9. `graph-transitions-v6.js`
10. `cross-link-travel-v2.js`
11. `scene-legacy-bridge.js`
12. `script.js`

The legacy bridge then boots artifact/semantic scene bundles dynamically.

V3.1 implementation should avoid adding a third independent bootstrap mechanism. New canonical node interaction and halo modules should have one explicit load/ownership path.

---

## 6. CI and regression baseline

Workflow: `.github/workflows/phase0-smoke.yml`.

Current CI already provides:
- JavaScript syntax validation;
- portfolio model validation;
- artifact manifest validation;
- artifact scene validation;
- push smoke matrices for core / architecture / interactions;
- full Playwright regression on pull requests/manual runs.

New architecture primitives should add focused contract tests rather than rely only on screenshots/manual inspection.

For major visual phases, functional CI is necessary but not sufficient: V3.1 also requires experiential acceptance.

---

## 7. Dev experiment surfaces

Phase A introduces an isolated `/dev/` experiment shell with hash-addressable surfaces:

- `/dev/#halos`
- `/dev/#node-dynamics`
- `/dev/#camera`
- `/dev/#intro`
- `/dev/#scene-gallery`
- `/dev/#transitions`

The shell intentionally does not boot the full production application by default. Each later phase can opt into only the production modules it is testing, which prevents experiments from becoming accidental runtime patches.

---

## 8. Open old-roadmap work

Open branches/PRs created under older phase numbering are **not automatically part of the V3.1 execution path**. They may contain reusable code, but should be evaluated against V3.1 before merge. In particular, implementation order is now determined by the V3.1 master roadmap, not by historical Phase letters.

---

## 9. Phase A acceptance

- [x] Current `main` rebaselined against V3.1.
- [x] Protected canonical ownership documented.
- [x] Replaceable/migration-target subsystems identified.
- [x] Existing Node/Camera/Scene substrate mapped onto new phases.
- [x] Historical post-Phase-A execution order removed.
- [x] CI baseline verified from workflow configuration.
- [x] Isolated dev experiment surfaces added.
- [x] No production visual behaviour intentionally changed by Phase A.

Phase A is architectural preparation. The first phase expected to produce a visible interaction change is **V3.1 Phase B — Node Interaction Foundation**.
