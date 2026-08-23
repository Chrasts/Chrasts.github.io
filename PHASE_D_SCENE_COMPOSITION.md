# Phase D — Scene Composition System

Phase D introduces one reusable composition layer for root-level scene objects. It does not redesign the internal visual grammar of artifacts, timelines, document stacks or the graph itself.

## Problem

Before Phase D, placement decisions were distributed across several unrelated mechanisms:

- `SceneManager` selected a scene object's named placement
- artifact scenes used a separate `artifact-scene-layout-contract.js` to flip left/right around the inspector
- Phase 8 semantic objects encoded their own `right/top/bottom` positions in CSS
- route-specific CSS patches moved individual media clusters when they crossed the viewport
- the inspector occupied a visual lane, but other objects did not consume that occupancy through one shared contract

That architecture could keep individual scenes working, but it could not answer the general question: given the objects visible in the current scene, where can each one live without competing with another object or leaving the viewport?

## Canonical contract

`scene-composer.js` now owns root-level composition.

A scene object can express composition intent through `definition.composition`. Existing `placement` values are still understood as a migration fallback, but they are no longer intended to become a second layout engine.

The composer resolves four concerns:

1. **Zone** — which broad scene region an object belongs to
2. **Side** — left/right choice for flexible side-stage objects
3. **Slot** — measured stacking order when several objects share a side
4. **Containment** — a final viewport correction based on the object's real rendered bounds

Current zones are:

- `side-stage` — flexible contextual objects beside the graph
- `inspector` — fixed detail-inspector occupancy
- `lower-rail` — horizontal semantic content below the graph
- `mobile-tray` — mobile composition classification
- `unmanaged` — legacy objects whose geometry remains outside the composer

## Composition intent

A reusable request can look like:

```js
composition: {
  zone: 'side-stage',
  preferredSide: 'right',
  allowFlip: true,
  priority: 50,
  role: 'artifact',
  containViewport: true,
  viewportMargin: 20
}
```

The composer measures currently visible scene objects and resolves the request against occupancy. A fixed right-side inspector, for example, makes a flexible object prefer the left side without requiring an artifact-specific collision rule.

## What the composer owns

The composer may write root-level `top`, `left`, `right` and `bottom` only for objects that it explicitly marks with `data-scene-composition-owns-geometry="true"`.

It also publishes resolved state through:

- `data-scene-zone`
- `data-scene-side`
- `data-scene-slot`
- `data-scene-collision-adjusted`
- `data-scene-composed`

`ProfileSceneComposer.snapshot()` exposes the same assignments for tests and future tooling.

## What it does not own

Internal object layout remains local to the object or recipe.

Examples:

- the three Hedgehog House photographs still form a fan in artifact CSS
- thesis figures still define their own two-object spatial relation
- document folios still own page/shadow construction
- certificate stacks still own their paper stack
- Experience still owns its timeline grammar

The composer moves the root scene object. It does not flatten every visual system into one generic grid.

## Artifact migration

The old `artifact-scene-layout-contract.js` has been removed.

Artifact scenes are now ordinary composition participants. Their preferred side comes from the canonical route target in `ARTIFACT_SCENE_BINDINGS`, while the composer decides the effective side from current occupancy.

The old `ProfileArtifactSceneLayout` API remains temporarily available through `artifact-scene-layout-compat.js`. It is a deprecated facade over `ProfileSceneComposer`, not a second owner.

`artifact-scenes-layout.css` remains because it controls internal deck/fan geometry and pointer semantics, not root composition.

## Viewport containment

Containment is based on the union of the actual rendered object and important descendants such as rotated artifact cards. This replaces the conceptual need for one-off fixes such as a special Hedgehog left-photo offset.

The current Work layout still receives a deeper left inset because its existing graph canvas is shifted by persistent side rails. That is a mode-level composition constraint rather than an individual artifact exception.

## Responsive boundary

Desktop composition now resolves side-stage occupancy and viewport containment. Mobile objects continue to use their existing scene variants and are classified as `mobile-tray` where applicable.

A more ambitious mobile spatial composition redesign is intentionally deferred to the dedicated mobile phase.

## Camera boundary

Phase D does not change canonical graph coordinates or camera ownership. The composer consumes the current scene and viewport, but it does not pan or zoom the graph to make room for objects.

Camera-aware composition is Phase E.
