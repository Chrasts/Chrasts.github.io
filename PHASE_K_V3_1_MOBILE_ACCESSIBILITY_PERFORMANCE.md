# V3.1 Phase K — Early Mobile / Accessibility / Performance Checkpoint

## Roadmap target

Phase K is a checkpoint before rich-scene expansion. It verifies:

- intro mobile;
- Atlas mobile;
- root mobile;
- hover equivalents;
- touch focus;
- reduced motion;
- keyboard;
- screen-reader semantics;
- frame time;
- memory / retained state;
- node-dynamics cost.

Acceptance is architectural: no blocker discovered here should force a later redesign of the graph, camera, interaction or scene foundations.

## Canonical ownership

Phase K does not introduce a second graph renderer, router, camera or physics implementation.

- `site-graph.js` remains the canonical graph/topology/layout renderer.
- `ProfileNodeInteraction` remains the semantic node interaction owner.
- `ProfileNodeDynamics` remains the ephemeral node-motion owner.
- `ProfileGraphNavigation` remains the Phase J arrival-materiality owner.
- `ProfileCameraComposition` / `ProfileCameraMateriality` remain camera owners.
- `mobile-app.js` remains the mobile composition and gesture adaptation layer.
- `accessibility-runtime.js` is a projection layer only: it maps the existing interactive graph state to explicit accessibility semantics without changing route, graph, FCA, camera or geometry state.

## Accessibility findings and changes

### Confirmed blocker: interactive SVG exposed as an image

The shared graph SVG previously used `role="img"` while containing keyboard-focusable `role="button"` descendants. That representation can flatten or obscure interactive descendants in an accessibility tree.

Phase K now projects the live graph as a labelled `role="group"` using the existing graph title/help text.

### Explicit accessible names

Every live graph node receives an explicit semantic accessible name derived from existing canonical graph metadata.

Generated Work concept nodes use their existing theme IDs/labels to form a readable name; the accessibility layer does not recompute FCA closure or ownership.

Dynamic Work theme controls and project anchors receive explicit button/link names and state.

### Decorative structure

The graph edge layer and reusable halo primitives are marked as decorative for assistive technology. Meaning continues to be exposed through labelled nodes, route navigation, inspector content and Quick Overview.

### Filtered Work projects

Visually filtered project anchors are removed from the keyboard tab order and hidden from the accessibility tree until they become available again.

### Route orientation

Primary navigation exposes the current top-level route through `aria-current="page"`.

### Non-spatial path

Quick Overview, primary navigation, breadcrumbs, detail content and direct routes remain usable without understanding graph geometry. Phase K does not add a separate "accessible mode".

## Mobile / touch checkpoint

Existing Phase E–J regression coverage already verifies mobile intro, root, Atlas, condensation, Object Focus and route stability.

Phase K adds an integrated touch checkpoint that verifies:

- Atlas retains inspect-then-enter semantics on touch;
- inspector state is exposed through `aria-expanded`/`aria-controls`;
- mobile node dynamics remain weaker than desktop rather than copying desktop displacement;
- graph interaction does not introduce horizontal document overflow.

Mobile remains a separate composition sharing meaning/state/topology rather than desktop geometry.

## Reduced-motion checkpoint

Reduced motion retains route direction and semantic camera intent while physical node displacement and adapted-edge motion remain disabled.

This follows the roadmap requirement that reduced motion provide a semantic equivalent rather than simply deleting transitions and leaving broken spatial state.

## Performance checkpoint

### Deterministic retention checks

Repeated route stress verifies that:

- V9 transition overlays return to zero;
- exactly one live graph SVG remains;
- detail/Quick Overview DOM does not multiply;
- the accessibility runtime is booted once;
- `ProfileNodeDynamics` record count matches the current live-node set;
- moving nodes and adapted edges return to zero.

### Memory

The Chromium CI checkpoint warms the main route set, forces garbage collection through the DevTools protocol, repeats navigation, collects again, and guards retained JavaScript heap growth with a deliberately broad early-stage ceiling. This is a leak guard, not a production memory budget.

### Frame time

The Atlas checkpoint samples requestAnimationFrame intervals while repeatedly retargeting node dynamics. The guard is intentionally broad enough for shared CI while still detecting catastrophic frame degradation.

### Permanent physics

After pointer activity settles, `ProfileNodeDynamics.frameCount` must stop advancing (allowing at most one late housekeeping frame). This directly guards the roadmap prohibition on permanent physics simulation.

## Automated Phase K acceptance

`tests/phase-k-checkpoint.spec.js` covers:

1. labelled interactive graph semantics;
2. keyboard node activation;
3. generated Work accessibility and filtered tab order;
4. mobile touch Atlas semantics and weakened dynamics;
5. reduced-motion semantic equivalence;
6. route-stress retained state / heap guard;
7. Atlas frame-time and RAF-quiescence guard.

The test remains in the permanent interaction smoke set after merge.

## Existing regression evidence reused

Phase K deliberately reuses the already permanent suites for detailed intro/root/mobile/interruption behavior rather than duplicating them:

- `phase3-intro.spec.js`;
- `root-entry-portal.spec.js`;
- `atlas-condensation.spec.js`;
- `profile-root.spec.js`;
- `atlas-focus-unification.spec.js`;
- `pre-phase8-mobile.spec.js`;
- `phase0-breakpoint.spec.js`;
- `node-dynamics.spec.js`;
- `graph-feel.spec.js`;
- `graph-navigation-materiality.spec.js`;
- `object-focus.spec.js`.

## Limits of this checkpoint

Automated DOM/ARIA tests cannot prove real-world quality in NVDA, JAWS, VoiceOver or TalkBack. Phase K therefore verifies the architectural and semantic contract, while real assistive-technology testing remains part of later user validation / production accessibility audit.

Likewise, Chromium CI frame/heap thresholds are regression guards, not device-lab performance certification. Phase W still owns the final production performance/accessibility audit.

## Phase K acceptance decision

Phase K is complete only after:

- the new checkpoint suite passes;
- all existing regression tests remain green;
- mobile/reduced-motion behavior remains semantically equivalent;
- no retained-state or permanent-RAF leak is observed;
- no accessibility fix requires a parallel graph or navigation architecture.

If those conditions hold, there is no known architectural blocker to beginning Phase L Scene Object Runtime 2.0.
