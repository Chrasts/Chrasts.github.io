# Intro and entry experience baseline — 2026-08

This note records the implementation state immediately before the entry-experience redesign defined in `../INTRO-ENTRY-EXPERIENCE-MASTER-PROMPT.md`.

## Verified baseline

- The live `#site-graph` is already the only Atlas surface; there is no cloned intro graph.
- The semantic root is `stepan-chrast` throughout Atlas, condensation and Profile Root.
- Readiness already gates on the graph, critical CSS, fonts, portrait, geometry, halo, interaction, camera and transition modules.
- Reveal order is root → primary branches → territories → intermediate/deep structure → labels → cross-links.
- Escape and Tab can complete the reveal safely; deep links and same-session returns bypass it.
- Condensation already captures non-root nodes, primary parents and hierarchy edges, moves in deep-first waves and can restore Atlas on Escape.
- Profile Root already exposes the five canonical branches and keeps Quick Overview secondary.
- Targeted pre-change Playwright baseline: **65/65 passing**.

## Confirmed defects to remove

1. Atlas fit is a fixed `0.78`, which lands in medium LOD and hides deep topology immediately after reveal.
2. Reveal performs another camera fit during settle/finish, causing a visible handoff correction.
3. Root entry is a two-step portal interaction; touch explicitly requires a second tap.
4. The root portrait is only 54×54 SVG units and its structural halo radii are derived from generic dot sizing.
5. Condensation forces camera/LOD to `0.94` before capture instead of beginning from the visible frame.
6. The Atlas-to-Profile handoff waits a fixed 510 ms instead of awaiting semantic recomposition/camera settlement.
7. Public entry state and topology ownership are split across legacy markers instead of the explicit state contract required by the master prompt.

## Canonical owners retained

- `intro-atlas-reveal.js`: readiness, preparing, reveal plan/timeline and ready handoff.
- `phase7-atlas.js`: Atlas camera, topology mode, exploration LOD and label policy.
- `halo-renderer.js`: structural halo presets and radii.
- `root-entry-portal.js`: persistent root identity, pointer/keyboard semantics and commit request.
- `atlas-condensation.js`: capture, deep-first absorption, cancellation and Profile Root commit.
- `profile-root.js`: final five-branch practical root and Quick Overview.
- `transition-coordination.js` / `scene-system.js`: interruption and transition lifecycle.
