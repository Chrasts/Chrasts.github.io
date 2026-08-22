# Phase 3 — interaction-gated Atlas intro

Phase 3 now uses a two-interaction onboarding sequence rather than an autoplay cinematic.

```text
first visit / overview
    -> full real Atlas, stationary
    -> explicit Enter profile interaction
    -> semantic folding toward first-level territories
    -> five first-level branches fold into the person/root
    -> large photographic Štěpán Chrast identity node
    -> explicit click on identity node
    -> identity node shrinks into the real SVG root
    -> Work / Knowledge / Experience / Education / About emerge
```

The animation remains structural: the Atlas source is the actual portfolio graph rendered by `site-graph.js`. No video, canvas, illustrative substitute or parallel graph layout is introduced.

## 1. Eligibility and session behaviour

Eligibility is still decided before first paint.

The intro is eligible only when:

- the initial route is `overview`; and
- `sessionStorage.profileIntroSeen !== "true"`.

Deep links such as `#knowledge`, `#work` or `#atlas` bypass the intro and mark it seen for the current session. If session storage is unavailable, the intro is bypassed rather than replayed on every reload.

The first-paint guard in `index.html` plus the statically loaded `intro-animation.css` prevent the normal root landing from flashing before the Atlas snapshot is ready.

The session marker is written when the condensation reaches the photographic identity node, or immediately when the intro is explicitly skipped. This means the visitor is not forced through the Atlas condensation again after already seeing it in the current session.

## 2. Initial Atlas state: no autoplay

The first visible intro state is the complete real Atlas.

After the Atlas snapshot is ready:

```text
ProfileIntro.snapshot().stage === "atlas"
ProfileIntro.snapshot().running === false
ProfileIntro.snapshot().waiting === true
```

No semantic animation starts automatically, regardless of how long the visitor remains on the page.

The primary affordance is a bottom-centred button:

```text
Enter profile
Condense the Atlas
```

This is intentionally explicit. Pointer movement, an ordinary click on the Atlas surface, or merely loading the page does not start the animation. Enter/Space work naturally when the control is focused.

A separate `Skip intro` control and Escape remain available.

## 3. Real-graph source contract

The runtime prepares the snapshot by:

1. waiting for the graph renderer and root landing controller;
2. internally rendering the real `atlas` route;
3. waiting until all `SITE_DATA.graph.nodes` are represented;
4. cloning the actual `.site-graph-svg` DOM;
5. removing duplicate IDs and interactive attributes from the clone;
6. recording each cloned node's canonical Atlas coordinates;
7. restoring the live renderer to `overview` underneath the overlay;
8. leaving the clone stationary until `Enter profile` is activated.

The internal Atlas route uses `history.replaceState()` plus a synthetic `hashchange`, so the preparation does not create a fake browser-history entry.

Diagnostics remain available through:

```text
data-source="real-atlas"
data-source-node-count="..."
ProfileIntro.snapshot()
```

## 4. Semantic folding model

Each node is classified from its real graph ancestry:

```text
depth 0     -> root
depth 1     -> section
depth 2     -> cluster
depth >= 3  -> deep
```

In addition, each non-root node is assigned its first-level section ancestor. The snapshot stores:

- original Atlas point;
- first-level section target point;
- root target point.

This allows the animation to perform actual node motion rather than only opacity changes.

### `territories`

Deep nodes recede and move partway toward their first-level section. Depth-2 clusters remain partially visible. The camera closes in on the depth <= 2 region.

### `branches`

Depth-2 and deeper nodes move fully into their corresponding first-level section and disappear. The visible structure becomes the root plus the five main profile branches.

### `root`

The five first-level branch nodes physically move into the real root coordinate while their connecting edges recede. At the same time the snapshot viewBox continues its root-centred camera move.

This is the main continuity improvement over the original Phase 3 prototype: the graph now visually folds into its parent structure rather than merely fading while the camera zooms.

## 5. Camera choreography

Camera movement still interpolates only the cloned SVG `viewBox`.

Targets are derived from the real Atlas coordinates:

- full Atlas viewBox;
- depth <= 2 bounds;
- depth <= 1 bounds;
- root-centred final viewBox.

Node folding and camera travel run concurrently via `Promise.all`, so the visual motion reads as one condensation rather than sequential zoom/fade cuts.

Approximate non-reduced motion after the user presses `Enter profile` is:

```text
territories     ~0.82 s
branches        ~0.80 s
root            ~0.90 s
identity morph  ~0.52 s
```

The page may remain indefinitely on the initial Atlas before this starts.

## 6. Photographic identity root

The terminal state of the condensation is no longer the Phase 2 hero/root landing.

The SVG root cross-fades into a large centred interactive identity node built from the existing profile asset:

```text
assets/stepan-chrast.jpg
```

The identity node contains:

- portrait;
- Štěpán Chrast name;
- three surrounding profile tags derived from `SITE_DATA.profile.label`:
  - Data analysis;
  - Research;
  - Mathematical logic;
- `Open profile map` interaction hint.

The identity node is a real `<button aria-label="Open the profile map">`.

### Interaction signalling

Hover and keyboard focus deliberately make interactivity visible:

- the identity node scales slightly;
- two concentric rings expand/emphasise;
- the portrait receives a small scale response;
- surrounding profile tags drift outward and switch toward the accent colour;
- the `Open profile map` hint becomes fully visible.

The effect is informational rather than decorative: the visitor should understand that the portrait/root is the next navigation action.

## 7. Identity node -> real Overview root

Clicking the photographic node performs the second onboarding transition.

The runtime first calls:

```js
ProfileRootLanding.activate({ focusGraph: false })
```

This prepares the actual Overview graph beneath the still-opaque intro overlay.

It then measures the real rendered root-dot using `getBoundingClientRect()`. The photographic identity node is animated from its centred large form to that exact screen-space target using the Web Animations API.

During the same interval:

- the identity metadata/rings fade;
- the intro overlay background becomes transparent;
- Phase 2's normal root-unfold animation begins underneath;
- Work, Knowledge, Experience, Education and About emerge around the destination root.

Only after the photographic node reaches the real root location is the intro overlay removed.

Final state:

```text
ProfileRootLanding.isActive() === false
body[data-graph-route="overview"]
#site-explorer visible
five first-level nodes visible
```

The handoff therefore targets measured live geometry rather than an estimated duplicate layout.

## 8. Skip semantics

`Skip intro` or Escape bypass the entire cinematic flow and land on the ordinary Phase 2 root landing.

An ordinary click/tap elsewhere on the Atlas does **not** skip and does **not** start condensation. This is deliberate: the first transition should result from a clear, intentional action.

Public API:

```js
ProfileIntro.start()
ProfileIntro.skip()
ProfileIntro.openProfile()
ProfileIntro.snapshot()
```

## 9. Reduced motion

Reduced-motion mode retains the two explicit interaction points but removes the large semantic travel.

```text
real Atlas, waiting
    -> Enter profile
    -> direct Atlas-to-photographic-identity handoff
    -> click identity
    -> short identity-to-root handoff
```

No territories/branches/root camera sequence is required to communicate the navigation state.

## 10. Mobile

Desktop and mobile use the same real-Atlas source and state machine.

On mobile:

- `Enter profile` remains above the safe-area inset;
- the photographic identity node is reduced to phone scale;
- the three profile tags are repositioned around the smaller portrait;
- the second click still targets the actual rendered mobile root-dot;
- the existing Phase 2 `MobileProfileScene.repair()` remains part of root activation.

The intro does not replace or modify the mobile graph renderer.

## 11. Failure safety

The runtime fails open to the usable Phase 2 root landing for:

- setup / stylesheet timeout;
- Atlas route timeout;
- incomplete Atlas render;
- missing Atlas SVG;
- Overview restore timeout;
- missing expanded root geometry.

Failure never leaves the user on a permanently hidden page.

## 12. Observability

Optional Umami events:

```text
intro_ready
intro_started
intro_condensed
intro_completed
intro_skipped
```

Browser events continue to expose intro state/stages and fallbacks. Rendering never depends on analytics.

## 13. Regression tests

`tests/phase3-intro.spec.js` now verifies:

- the complete real Atlas is visible first;
- the state remains on Atlas without autoplay;
- explicit `Enter profile` starts condensation;
- deep nodes physically reach their first-level section target;
- semantic stages reach `territories -> branches -> root -> identity`;
- identity node uses the real profile image and three profile tags;
- hover changes its interactive visual state;
- identity click ends with expanded Overview and all five first-level nodes;
- ordinary Atlas pointer interaction does not start the animation;
- Skip / Escape land on the Phase 2 root landing;
- session-only reload bypass;
- deep-link bypass;
- reduced-motion two-interaction path;
- mobile portrait -> expanded mobile Overview path.

Phase 0–2 tests continue to pre-mark `profileIntroSeen=true` so their renderer/scene/root contracts remain isolated.

## 14. Architectural boundary

This revision still does not modify the canonical:

- `site-graph.js`;
- `graph-transitions-v6.js`;
- `mobile-app.js`.

The intro owns only a frozen snapshot and a temporary HTML identity object. The final transition explicitly hands control back to the actual renderer.

## 15. Remaining Phase 3 visual tuning

The implementation now represents the intended interaction/state model. Remaining work inside Phase 3 should be perceptual tuning after a real browser pass rather than another architectural redesign:

- exact `Enter profile` placement/wording;
- folding trajectory/easing;
- identity-node size and tag placement;
- portrait crop;
- timing of background transparency versus branch emergence;
- final shrink scale and handoff pacing;
- phone frame pacing.

These should be tuned from the live result rather than guessed from static code.
