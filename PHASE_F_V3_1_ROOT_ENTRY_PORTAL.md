# V3.1 Phase F — Root Entry Portal

Status: implementation candidate

Primary specification: `Interactive Graph Portfolio - Agent-Executable Master Roadmap V3.1.md`, Phase F and the Root Entry Portal sections. The V3.1 supplement supplies the shared-root, reversal, touch and reduced-motion constraints.

## Product target

The root of the live Atlas should stop reading as an abstract node and become recognisably personal when directly engaged.

The intended sequence is:

1. the existing root acknowledges hover/focus/touch;
2. its existing two-ring halo becomes more expressive;
3. the portrait becomes visible **inside the same root SVG group**;
4. a restrained `Enter profile` affordance appears;
5. leaving/cancelling reverses the material change without rebuilding the graph.

This is not a tooltip, portrait card, modal or second identity scene.

## Ownership

### Graph renderer owns

- the one persistent root `.site-graph-node[data-node-id="stepan-chrast"]`;
- canonical `data-x` / `data-y` coordinates;
- root hit target, dot and label;
- Atlas topology and routing.

Phase F does not write canonical node coordinates and does not create a second root.

### HaloRenderer / GraphFeel own

- the actual halo primitives;
- ordinary node interaction state;
- Atlas `entry-ready` semantics.

Phase F only changes presentation while the root portal is open. It never adds replacement halo rings.

### Root Entry Portal owns

- one SVG portrait material directly inside the live root group;
- one compact SVG `Enter profile` action directly inside the same root group;
- latent/open/manual-open portal state;
- pointer, keyboard and coarse-pointer reversal semantics;
- the semantic `profile:enter-profile-request` handoff.

### Root landing compatibility owner

`ProfileRootLanding.commitExpanded()` is the current semantic fallback for reaching expanded Overview without resurrecting the retired standalone hero landing.

It deliberately performs no Phase G condensation.

### Phase G owns next

Phase G can claim `profile:enter-profile-request` by calling `preventDefault()` on that cancelable event. Once claimed, Phase F does not perform its direct Overview fallback.

This keeps the portal/material layer independent from structural condensation motion.

## Shared-root portrait

The portrait is an SVG `<image>` inserted directly into the existing root group:

- source: `assets/stepan-chrast.jpg`;
- circular SVG clip path;
- no overlay DOM;
- no clone of the root;
- no rectangular portrait container;
- pointer events remain owned by the semantic root.

The portrait is larger than the original dot but remains within the visual envelope of the richer root halo. The root label moves slightly upward while open so the identity remains readable at Atlas fit scale.

The original dot fades into the material rather than disappearing before the portrait arrives. This preserves the perception that the root changes material instead of being swapped for another object.

## Input model

### Fine pointer

- hover root → open;
- pointer leave → short delayed reversal;
- entering the action does not close the portal because the action is part of the same root.

### Keyboard

- focus root → open;
- `Enter` / `Space` activates the already-open semantic root and enters the profile;
- the visible `Enter profile` child is independently focusable;
- `Escape` on root or action reverses the portal and returns focus to the root where appropriate.

### Touch / coarse pointer

A tap opens the portal into a manual-open state. It remains available for a second explicit tap on `Enter profile`; hover-only interaction is never required.

## Reversal

Portal reversal is presentation-only:

- portrait returns to latent scale/opacity;
- action becomes non-focusable and hidden from accessibility APIs;
- root label returns to canonical local placement;
- halo presentation returns to GraphFeel ownership;
- root canonical transform and graph topology are unchanged.

Route changes and structural transitions force a clean close.

## `Enter profile` fallback

Until Phase G is installed, `Enter profile`:

1. marks the old root-landing controller as already expanded via `commitExpanded()`;
2. routes to `#overview`;
3. therefore exposes the five first-level branches immediately;
4. keeps `data-root-landing="false"` so the retired standalone hero identity is not resurrected;
5. retains the same live root DOM element where the renderer can reuse it.

This is a semantic fallback only. It is intentionally not presented as the final roadmap transition.

## Reduced motion

Reduced motion keeps the same portal states, portrait, action and keyboard/touch semantics but removes the reveal transitions and repeating secondary-halo animation.

No information or action is motion-dependent.

## Regression coverage

`tests/root-entry-portal.spec.js` verifies:

1. there is exactly one live root;
2. portrait and action are direct descendants of that same root;
3. legacy portrait/intro overlays remain absent;
4. opening the portal does not change root canonical geometry;
5. portrait and richer halo become materially visible;
6. pointer reversal restores the latent state;
7. root activation opens the portal rather than the Atlas inspector;
8. keyboard focus and Escape expose/reverse the same semantic state;
9. direct `Enter profile` fallback reaches expanded Overview with all five branches and no standalone root landing;
10. the root DOM identity survives that fallback handoff;
11. Phase G can claim the cancelable entry request without route fallback;
12. fresh-session `ATLAS_READY` exposes the portal;
13. coarse-pointer activation creates a stable second-tap action;
14. reduced motion preserves the same semantics without reveal transitions.

The test is also retained in the post-merge interaction smoke suite.

## Explicit non-goals

Phase F does **not** implement:

- Atlas condensation;
- leaf-to-parent absorption;
- edge retraction;
- parent mass accumulation;
- camera convergence during entry;
- final Profile Root composition/polish;
- a new graph topology or node renderer.

Those belong to Phases G and H.
