# Phase D: Scene Composition System

Phase D replaces artifact-specific root placement with one reusable scene composition layer.

## Canonical owner

`scene-composer.js` owns root-level scene placement. Internal visual grammar remains local to each scene object or recipe.

The composer resolves:

- broad scene zone
- preferred and effective side
- fixed occupancy such as the detail inspector
- measured vertical stacking
- viewport containment
- stable placement for the lifetime of one route

Current zones are `side-stage`, `inspector`, `lower-rail`, `mobile-tray`, and `unmanaged`.

## Stable side resolution

A flexible object may be displaced from its preferred side by fixed occupancy. For example, the Hedgehog House gallery prefers the right side but moves left while the right-side inspector is present.

Once a side is resolved for a route, removing the blocker does not immediately move the object back across the canvas. This prevents the large post-focus and outside-dismiss jumps that occurred when the inspector disappeared.

Fixed occupancy is a hard constraint. Overflow heuristics may choose between free lanes but may not place a flexible object underneath the inspector.

## Artifact interaction boundary

Artifact objects are part of the active node scene. Clicking a visible artifact is therefore not an outside click for the node inspector.

`node-detail-dismiss.js` ignores clicks inside artifact scenes and Object Focus. This allows thesis diagrams, Modal Logic Lab screenshots, and galleries to enter Object Focus without invalidating the active node first.

A genuine click elsewhere still dismisses node detail according to the existing interaction contract.

## Object Focus fit refinement

`object-focus-fit.js` refines the reusable Object Focus surface without taking over its lifecycle.

Images open substantially enlarged but fully contained at zoom 1. The intrinsic aspect ratio is preserved and users can zoom and pan explicitly.

PDF artifacts use whole-page `Fit` rather than `FitH`, with PDF viewer zoom controls available. The focused frame is sized from the source page aspect when known.

## Compatibility

`artifact-scene-layout-contract.js` has been removed.

`artifact-scene-layout-compat.js` temporarily exposes the old `ProfileArtifactSceneLayout` read and refresh API over `ProfileSceneComposer`. It is a compatibility facade, not a second layout owner.

## Phase boundary

The composer decides where scene objects live. It does not move graph camera geometry to compensate for those objects.

Camera-aware use of the composed safe frame is Phase E.
