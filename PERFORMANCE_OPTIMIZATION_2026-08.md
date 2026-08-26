# Performance and runtime consolidation — 2026-08

## Current architecture

- `site-graph.js` owns route projection, settled graph DOM, Work/FCA state and
  renderer commit events.
- `radial-geometry.js` owns settled Overview/Atlas coordinates.
- `local-label-policy.js` is the only settled local-label owner.
- `graph-transitions-v6.js` owns temporary transition geometry and now drives
  the shared transition coordinator directly.
- `scene-legacy-bridge.js` owns Promise-deduplicated feature loading for Intro,
  Atlas, artifacts, Phase 8 and certificate focus.
- Artifact scene roots are created only for a matching route and are released
  through Scene Object Runtime lifecycle.
- `object-focus-controller.js` owns artifact media construction, repeated-open
  protection and focused viewer presentation.

## Removed work

- duplicate legacy Work renderer, hidden `#work` DOM reservoir and `script.js`;
- eager Phase 7/local-label coupling;
- duration-pinned geometry and label repair loops;
- global geometry and pointer hotfix layers;
- global DOM, SVG and `matchMedia` prototype patches;
- artifact viewer/open monkey patches and their parallel observers;
- all production `MutationObserver` instances;
- retired intro/runtime assets: `intro-animation.css`, `intro-unfold.js/css`,
  `intro-state-consistency.js` and `graph-v4.css`.

The former observer responsibilities now use owner events including
`profile:graph-state-committed`, `profile:graph-render-settled`,
`profile:detail-rendered`, `profile:profile-root-emergence`,
`profile:scene-state` and transition coordinator phases.

## Asset result

The hedgehog-house exterior now uses the existing 1448 × 1086 WebP artifact.
The served file changed from 2,903,791 bytes to 351,008 bytes, a reduction of
2,552,783 bytes (87.9%) on the relevant About route. The obsolete PNG was
removed after the manifest switched to `image/webp`.

## Automated guards

- overview excludes Intro, Atlas interactions and unrelated artifact media;
- artifact roots and media remain absent on unrelated routes;
- Work has one public controller and no hidden legacy reservoir;
- settled geometry and labels remain RAF-quiescent;
- production DOM prototype assignments and `MutationObserver` construction are
  rejected by static validation;
- browser bootstrap checks additionally assert native DOM method identity;
- CI runs architecture, transition, performance, Work, Phase 7 and artifact
  lifecycle suites on pushes, plus the full suite on pull requests.

## Measurement status

Static validation currently reports zero production `MutationObserver`
constructors and zero global DOM prototype assignments. The optimized WebP
saving is measured from repository assets. Final request/transfer, DOM, heap,
long-task, RAF and Atlas frame-time figures must be captured by the browser/CDP
suite; this workspace did not expose a test browser. Until those results are
available, CI ceilings remain conservative rather than being presented as final
measurements.

## Intentionally not optimized

- SVG was not replaced with Canvas/WebGL: current graph scale does not justify
  a second renderer.
- FCA computation was not moved to a worker: ten projects are too small to
  repay the added lifecycle and transfer cost.
- A bundler/minifier was not introduced without measured evidence that it would
  outperform the current route-gated static-file architecture on GitHub Pages.
- The 22 MB gameplay video was not transcoded without an available media tool
  and visual/audio quality verification; its poster/caption/transcript work
  remains in Phase M.
