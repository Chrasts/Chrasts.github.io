# Phase 2 — root landing state

Phase 2 changes the opening navigation model from an immediately expanded first-level graph to a standalone root scene.

Roadmap contract:

- the page settles on the Štěpán Chrast root scene;
- the first-level graph is not visible yet;
- activating the root unfolds Work, Knowledge, Experience, Education and About;
- portrait, intro and direct links remain part of the landing composition;
- Atlas remains available as a deliberately secondary affordance.

## State model

The canonical graph route remains `overview`.

Phase 2 adds a scene-level boolean:

```text
graphState.rootLanding
```

This is intentionally scene state rather than a new graph route. The graph structure still has the same root and the same first-level nodes; only the visible composition changes.

Two scene states can therefore share the same structural graph route:

```text
route = overview, rootLanding = true
    -> standalone identity/root scene

route = overview, rootLanding = false
    -> expanded first-level profile graph
```

That is the first concrete use of the Phase 1 distinction between graph state and scene state.

## Opening behaviour

A fresh load of `/` or `/#overview` starts with `rootLanding = true`.

The graph renderer is allowed to prepare the Overview graph in the DOM, but `#site-explorer` is visually guarded before the renderer boots. This avoids changing stable graph layout internals while still guaranteeing that first-level branches do not appear before activation.

The landing scene contains:

- existing portrait;
- existing role/discipline eyebrow;
- Štěpán Chrast heading;
- short existing introduction;
- Email, GitHub and LinkedIn links;
- a primary root-node button labelled `Open profile map`;
- a secondary `Explore Atlas` action.

The previous hero-level `Explore profile -> Work` shortcut is removed from the landing composition because it competed with the new primary root interaction. Work remains accessible from the global navigation and after root expansion.

## Root activation

`root-landing.js` exposes:

```js
ProfileRootLanding.activate()
ProfileRootLanding.reset()
ProfileRootLanding.isActive()
ProfileRootLanding.hasActivated()
```

Activating the root:

1. marks the root as activated for the current document lifetime;
2. sets `rootLanding = false` through `SceneManager`;
3. removes the explorer visibility guard;
4. hides the identity shell through its declarative scene visibility;
5. reveals the already prepared Overview graph;
6. applies a short opacity-only unfold treatment to the root, branches and edges;
7. asks the mobile runtime to repair/refit after reveal when it exists;
8. moves keyboard focus to the real graph root when available;
9. updates the graph live-region status.

The unfold animation deliberately avoids CSS transforms on SVG graph nodes because node transforms are renderer-owned geometry.

Reduced-motion mode disables the reveal animations while preserving the same state change and information.

## Returning to Overview

Root activation is remembered only for the lifetime of the current page document.

After the visitor has activated the root:

```text
Overview -> Knowledge -> Overview
```

returns to the expanded Overview graph rather than forcing the user through the landing action again.

A full reload of `/#overview` starts at the landing state again. Session-only persistence belongs to the Phase 3 intro behaviour, not Phase 2.

If the visitor enters through a deep link such as `/#knowledge`, the requested graph route opens directly and the root landing is not forced over it.

## Atlas

The root landing includes a secondary `Explore Atlas` affordance.

It uses the existing `data-route="atlas"` route contract, so Atlas continues to be rendered and controlled by the existing graph implementation and Phase 1 camera adapter.

Opening Atlas from the landing first releases the root visibility guard and then proceeds through the established route handler.

## Scene declarations

Phase 2 extends the common scene registry with:

- `root-activate-control`
- `root-atlas-affordance`
- `profile-graph-stage`

The existing root objects are also narrowed from generic `mode === overview` visibility to the actual landing predicate:

```text
mode === overview && rootLanding === true
```

This means the identity scene and expanded graph are now distinct scene compositions even though both are structurally rooted at Overview.

## Mobile composition

The mobile landing is no longer the former compressed Overview header sitting above the graph.

In the root state:

- portrait is centred near the top;
- identity copy is centred below it;
- links are visible rather than suppressed;
- the root action is the primary control;
- Atlas remains visually secondary;
- the graph stage is absent.

After root activation, the old 178 px Overview reservation for hero content is removed and the graph viewport returns to the normal 44 px top inset.

The existing mobile graph runtime still owns projection and gestures.

## Accessibility

- the root action is a real `<button>`;
- it has an explicit `Open the profile map` accessible name;
- it is linked to the intro text with `aria-describedby`;
- Enter/Space work through native button activation;
- after expansion, focus moves to the real graph root when available;
- the graph live region announces that the first-level map has opened;
- hidden first-level content is removed from the accessibility tree while the landing is active;
- reduced motion preserves all information and interaction.

## Tests

`tests/phase2-root-landing.spec.js` checks:

- fresh Overview is a standalone root scene;
- first-level graph nodes are not visible before activation;
- the primary root control is visible, enabled and labelled;
- root activation reveals all five first-level branches without changing the `overview` route;
- returning to Overview after activation stays expanded;
- Atlas can be opened directly from the secondary landing affordance;
- deep links bypass the landing correctly;
- mobile portrait contains portrait, intro, links and both root/Atlas affordances;
- mobile expanded Overview reclaims the graph viewport space.

Phase 0 mobile tests were also updated so graph spread/camera assertions happen after root activation rather than assuming an immediately visible Overview graph.

## Deliberately deferred to Phase 3

Phase 2 does **not** implement the opening Atlas condensation animation.

It also does not add:

- global Atlas snapshot choreography;
- semantic condensation stages;
- camera travel from Atlas to root;
- intro skip controls;
- returning-visitor/session intro suppression;
- a polished animated root-to-Overview geometry handoff.

The Phase 2 root unfold is intentionally simple. Phase 3 can now target a stable, explicit landing state as its destination instead of inventing that destination inside the intro animation.

## Acceptance mapping

Roadmap: **page settles on standalone Štěpán Chrast root scene**  
Implemented as `overview + rootLanding=true` with the graph stage guarded.

Roadmap: **Click root -> expand first-level branches**  
Implemented by `ProfileRootLanding.activate()` revealing the existing Overview graph.

Roadmap: **portrait / intro / links / secondary Atlas affordance**  
All present in the root scene; Atlas is separate from the primary root action.

Roadmap: **obvious what to click**  
The primary control is a labelled node-style button adjacent to the identity heading, with a larger visual hit target and focus/hover treatment.

Roadmap: **first-level graph does not appear until user activates root**  
The explorer is display-guarded from bootstrap until root activation. Deep links are the explicit exception because the visitor requested a non-root route directly.
