# Phase 8 — Experience / Education semantic geometries

Phase 8 adds the first domain-specific semantic objects outside Work while keeping the graph as the navigation backbone.

## Implemented scenes

### Experience

`#experience` and its child routes expose a compact chronological rail built from the canonical graph nodes and their `timelineOrder`, `meta`, `role`, and `organisation` fields. The rail is navigational rather than a duplicate CV list: selecting a role follows the same graph route and transition system as selecting the corresponding node.

### Charles University coursework

The selected-coursework branch exposes inspectable document objects. The first real document is `simulation-credence-coursework`, resolved through `ProfileArtifacts`; URLs are not duplicated in the renderer. On the deep Simulation Credence route the paper lifts into a focused state.

### Certifications

The Certifications branch renders three credentials as a physical paper stack. Selecting a paper lifts it into the foreground and updates an inspector with the artifact title, year, local/public source, and verification link when one exists. The stack uses the canonical artifact manifest for Cambridge B2 First, Ethics of AI, and Introduction to Artificial Intelligence.

### ESSLLI 2026

The ESSLLI route contains a compact two-week timetable artefact. It is explicitly labelled as a selected course plan, not as an attendance claim for every optional slot. Course cells can expose graph-native links to related Knowledge nodes such as SAT / SMT, Logic for AI, Language Models, Algebraic Logic, and Automated Reasoning.

### prg.ai Minor

The prg.ai route uses a status-aware study map. It intentionally distinguishes current/upcoming study context from already-mastered knowledge and exposes semantic links into the Knowledge graph without upgrading planned coursework into a competence claim.

## Architecture

Phase 8 is split into:

- `phase8-scene-data.js` — declarative scene-specific content and node/artifact references.
- `phase8-semantic-scenes.js` — scene object creation, artifact resolution, interaction, and ProfileScene registration.
- `phase8-semantic-scenes.css` — desktop/mobile composition and physical-document/timeline geometry.
- `artifact-data.js` — canonical source of local and external artifact URLs.

The existing `scene-legacy-bridge.js` only bootstraps the Phase 8 bundle after the core scene system is running. This keeps Phase 8 out of the graph renderer and avoids another route-specific switch inside `site-graph.js`.

## Ownership rules

- Graph renderer owns node and edge geometry.
- ProfileScene owns route/variant visibility lifecycle.
- Phase 8 owns only its semantic objects and their internal inspect state.
- `artifact-data.js` owns artifact URLs and verification URLs.
- Existing transition code continues to own graph transitions; Phase 8 route controls use `data-route` so they enter through the same navigation contract.

## Responsive behaviour

Desktop objects occupy a bounded semantic tray at the right or bottom of the graph scene. Mobile variants collapse into a bounded bottom tray. Neither mode creates document-level scrolling; the graph application remains viewport-contained.

## Tests

`tests/phase8-semantic-scenes.spec.js` checks:

- chronological Experience ordering;
- coursework document resolution through the artifact registry;
- certificate stack inspection and verification links;
- ESSLLI timetable content and Knowledge routing;
- mobile viewport containment / no document scroll.
