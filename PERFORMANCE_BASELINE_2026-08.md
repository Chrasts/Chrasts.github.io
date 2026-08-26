# Performance baseline — 2026-08

This document records the pre-optimization state required by
`chrasts_site_performance_optimization_agent_prompt.txt`. It is intentionally
kept beside the production source so later changes can be compared against a
stable, reviewable baseline.

## Measurement boundary

- Entry document: `index.html`
- Runtime: framework-free HTML, CSS and browser JavaScript
- Hosting model: static GitHub Pages-compatible files
- Package manager/build step: none
- Browser regression environment: Playwright in GitHub Actions
- Local browser trace: unavailable in the current workspace because the
  in-app browser has no attached browser instance. Network, long-task and heap
  deltas therefore remain CI/browser measurements rather than fabricated local
  numbers.

## Static request baseline

Following the synchronous entry scripts and every unconditional dynamic
loader gives this cold-load upper bound before route-specific user action:

| Resource class | Requests | Source bytes |
| --- | ---: | ---: |
| First-party JavaScript | 48 | 818,271 |
| First-party CSS | 28 | 233,069 |
| Artifact-related JavaScript subset | 15 | 127,019 |
| Artifact-related CSS subset | 9 | 69,225 |

These figures exclude HTML, fonts and media transfers. They are source-file
sizes, not compressed transfer sizes, and are intended as a reproducible
structural baseline.

Largest local payloads found during the audit:

| Asset | Bytes | Notes |
| --- | ---: | --- |
| Axiom Wilds gameplay video | 22.3 MB | Must remain route/action gated |
| Hedgehog house `outside.png` | 2,903,791 | Image-format optimization candidate |
| `debug.log` | 395,181 | Development residue; not linked by the site |

The production manifest now points at a visually verified WebP derivative of
`outside.png` (351,008 bytes, 87.9% smaller). The original is retained as the
source asset and is not requested by the site.

## Pre-change lifecycle and ownership findings

1. `scene-definitions.js` owns a broad unconditional feature chain.
2. `radial-geometry.js` injects the Atlas runtime and schedules a fixed 980 ms
   stabilization period.
3. `scene-legacy-bridge.js` unconditionally boots Phase 8 and the complete
   artifact stack on every route.
4. `artifact-scene-bindings.js` mixes declarative binding data with a second,
   hidden dependency loader.
5. `artifact-scene-runtime.js` renders all artifact roots at startup and only
   hides inactive ones. Images, PDF iframes and the associated observers/listeners
   therefore exist outside their owning routes.
6. `artifact-scene-recipes.js` downloads an entire local PDF and decodes its
   binary body merely to infer the first-page aspect ratio.

The immediate P0 target is consequently not cosmetic micro-optimization. It
is correcting feature ownership and lifecycle:

- one Promise-based, deduplicated route loader;
- light binding metadata allowed globally, heavy artifact code and media not;
- metadata dimensions instead of PDF probing;
- only the active artifact scene mounted, with deterministic teardown;
- CI assertions for network silence, DOM retention and re-entry.

## Required follow-up measurements

The Playwright suite must collect the browser-dependent evidence that could
not be captured locally:

- overview and direct non-intro cold-load request inventory;
- artifact-route request inventory before and after interaction;
- long tasks during intro, route change and artifact focus;
- retained artifact roots/media after route exit and repeated re-entry;
- request and DOM-count budgets that fail CI on regression.

## First implementation checkpoint

The first P0/P1 tranche produces this structurally derived overview delta. CI
now verifies the corresponding real browser ceiling.

| Overview resource class | Before | Current upper bound | Change |
| --- | ---: | ---: | ---: |
| First-party JavaScript requests | 48 | 37 | -22.9% |
| First-party JavaScript source bytes | 818,271 | ~710,224 | -13.2% |
| First-party CSS requests | 28 | 21 | -25.0% |
| Unrelated artifact PDF/image/video requests | possible | 0 by lifecycle contract | eliminated |

Implemented at this checkpoint:

- local PDF and image dimensions live in artifact metadata;
- artifact recipes no longer fetch/decode PDFs for layout;
- binding metadata no longer owns a hidden dependency loader;
- one Promise/dedup registry owns optional artifact and Phase 8 loading;
- artifact runtime mounts one matching scene and tears it down on route exit;
- the 2.9 MB photographic PNG is no longer a production request;
- Playwright now guards overview budgets, media silence and repeated artifact
  mount/unmount without multiplication.

The current byte figure accounts for the more explicit loader itself; it is
not a minified/gzip estimate. Final transfer, heap and frame metrics remain a
browser/CDP deliverable after CI has run on the modified tree.

## Second implementation checkpoint

The current Atlas reveal is now a genuinely intro-gated feature. A same-session
Overview or any direct deep link does not request `intro-atlas-reveal.js` or its
stylesheet and does not create `window.ProfileIntro`. The inline first-paint
guard remains in the document so a genuinely eligible first visit still starts
on black without exposing an incomplete graph.

| Overview resource class | First checkpoint | Second checkpoint |
| --- | ---: | ---: |
| First-party JavaScript requests | 37 | 36 |
| First-party JavaScript source bytes | ~710,224 | ~674,452 |
| First-party CSS requests | 21 | 19 |

The retired Phase H files `intro-animation.*`, `intro-unfold.*` and
`intro-state-consistency.js` were unreferenced and have been removed rather
than retained as a second dormant intro implementation.

The duration-pinned geometry and local-label repair loops have also been
removed. `ProfileGeometry.stabilize()` retains its compatibility signature but
now performs a synchronous canonical write plus at most two reconciliation
frames. Local labels follow the same bounded policy. Route, transition, resize
and graph-render events trigger reconciliation explicitly; stable UI no longer
runs either repair on every frame for 0.7–1.8 seconds. CI snapshots expose and
guard each reconciler's pending state and apply count.

## Third implementation checkpoint

Atlas boundary interactions are no longer part of a same-session Overview or
deep Focus bootstrap. The drag activation guard, Atlas/Focus transition owner,
root-entry portal and Atlas condensation controller now share one deduplicated
`atlas-interactions` feature gate. Their three styles follow the same route and
intent ownership.

| Overview resource class | Second checkpoint | Third checkpoint |
| --- | ---: | ---: |
| First-party JavaScript requests | 36 | 32 |
| First-party JavaScript source bytes | ~674,452 | ~599,000 |
| First-party CSS requests | 19 | 16 |

The deferred tranche contains 81,051 bytes of JavaScript and 21,410 bytes of
CSS before compression. The loader's first-intent contract prewarms on pointer,
focus and pointer-down intent; if a click or keyboard activation wins that race,
it is held and replayed exactly once after Atlas geometry, transitions and all
four controllers are ready. Phase 7 also delegates a very fast repeated-node
activation to the same Promise, preserving the animated Atlas/Focus boundary on
slow devices.

CI now rejects these resources on a settled non-intro Overview, checks that
their globals do not exist there, and uses tighter request, byte and stylesheet
ceilings. The remaining unconditional Phase 7 file still combines Atlas LOD
with local-route label policy; separating those responsibilities is the next
safe bootstrap cut.
