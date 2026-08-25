# Intro / entry experience implementation

Implemented from `../INTRO-ENTRY-EXPERIENCE-MASTER-PROMPT.md` on 2026-08-25.

## Canonical state flow

```text
preparing -> ignition -> reveal -> ready -> condensing -> profile
```

- `body[data-entry-state]` exposes the public entry phase.
- `body[data-root-entry]` exposes `latent | idle | armed | committing | profile`.
- `body[data-atlas-topology]` exposes `entry-full | exploration-lod`.
- The real `#site-graph` and persistent `stepan-chrast` root own the complete flow.

## Implemented changes

- An inline first-paint guard owns the screen before external CSS or graph code can render. It prevents the partial-graph flash with a completely black surface.
- Preparing uses an unlabeled node-and-halo readiness object in the exact visual language of the graph. It is not a cosmetic timer: it remains until the live Atlas, every node and edge, `entry-full` topology, a settled camera, halo system, fonts and portrait are ready for three consecutive frames.
- At `ignition`, the readiness node compresses into the future root position. The complete live graph is already rendered underneath one broad radial light field: its transparent centre and graduated black falloff expand continuously from the real, screen-centred root instead of exposing a hard circular crop.
- The light field is the only large reveal animation. A single, broad SVG luminance mask expands from the live root for 6.35 seconds with one inexpensive radius update per animation frame; it avoids stepped custom-property gradient repaints and has no hard crop. Its target is measured from the real visible graph bounds rather than empty viewport corners.
- `ATLAS_READY` now coincides with the moment the field has made the whole graph legible. All intro input locks are released on that frame. The remaining subtle light falloff is explicitly pointer-transparent and may finish above the already interactive graph, eliminating the former roughly two-second inert interval without shortening the visual reveal.
- Readiness covers the entire `entry-full` topology, settled camera, all halo geometry, decoded portrait and fonts, a hit area plus non-empty measurable label for every node, and three consecutive frames with an identical label-layout signature. Deep Knowledge labels are part of the prepared live image from its first reveal frame; they are no longer enabled as a later density wave.
- Entry camera fit is computed once from live topology bounds, the enlarged entry-only root halo footprint and the full-viewport safe frame. It anchors the real root at the exact screen centre with desktop occupancy `1.04` and mobile occupancy `.94`.
- `entry-full` keeps all 94 topology nodes present after reveal. Exploration LOD begins only after deliberate zoom, pan, focus or fit interaction.
- Entry Atlas removes the Profile return control and the Atlas relation/zoom toolbar. Those utilities remain available in the ordinary Atlas reached after Profile.
- Root portrait is a 96-unit masked SVG image inside the persistent root. Entry-only structural halo radii are owned by `ProfileHaloRenderer` (`132`, `228`); ordinary Atlas retains (`27`, `42`). The inner ring is teal and the heavier outer ring is brown and counter-rotating. Real CSS pointer hover contracts both rings (`.90x`, `.94x`), accelerates their rotation and grows the portrait to `3.315x`; the inner ring therefore disappears beneath the expanded portrait as intended. Pointer leave reverses this material response; only click starts condensation.
- The whole root is the single pointer/keyboard control with `aria-label="Enter profile — Štěpán Chrast"`. The rendered CTA is visual-only and adds no tab stop. Touch enters in one tap.
- Condensation starts at the visible camera, captures all 93 non-root nodes, samples hierarchy paths, preserves children until the final absorption portion, retracts primary edges from the child side and attenuates cross-links early.
- Root acknowledgment, deep-first waves and final micro-compression share one time-based RAF timeline.
- The Atlas-to-Profile handoff awaits the canonical `profile:graph-render-settled` / Profile Root state instead of a fixed delay. The renderer snaps only while hidden, so its 94-node route reconciliation cannot compete with the visible motion.
- Entry route chrome, Quick Overview, Profile return controls and Atlas utilities stay suppressed through reveal, condensation, hidden route reconciliation and five-branch emergence; they cannot flash back during the handoff.
- After condensation the embedded entry portrait fades inside the root. The Profile root settles as a named node with two halos, then only the five canonical branches extend out from that same root on one staggered RAF timeline. Its existing detail dialog still owns the portrait.
- Escape restores Atlas geometry, camera, full topology, root availability and transition ownership without stale wrappers.

## Regression coverage

`tests/intro-entry-experience.spec.js` adds direct contracts for:

- first-paint loading ownership;
- full-screen entry composition and hidden ordinary Atlas utilities;
- entry-only large root material and hover expansion;
- full topology and retained entry camera at `ATLAS_READY`;
- deliberate transition into exploration LOD;
- one-button root semantics;
- complete non-root condensation capture at the visible camera;
- semantic Profile Root settlement with no fixed 510 ms timer.

Existing intro, root portal, condensation, Profile Root, camera, transition, mobile, accessibility, reduced-motion and retention suites remain part of the required gate.
