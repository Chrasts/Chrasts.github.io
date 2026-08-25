# Rich Artifact Scene Architecture

This layer turns published portfolio artifacts into scene objects that live beside the graph instead of being reduced to links in an inspector.

## Ownership

- `artifact-data.js` remains the canonical artifact manifest: identity, semantic type, source location, availability and graph anchors.
- `artifact-scene-bindings.js` describes where an artifact experience appears: route targets, anchor nodes, scene recipe and placement side.
- `artifact-scene-recipes.js` owns reusable visual grammars and Ambient/Active selection state. A recipe must be generic enough to serve multiple real artifacts.
- `artifact-scene-runtime.js` owns artifact-scene route visibility, graph tethering, hover/focus coupling and responsive scene registration. It also provides the viewer DOM surface used by Object Focus.
- `scene-system.js` / `ProfileScene.objects` owns the common rich-object lifecycle, deterministic layout state, depth, return geometry, media state, interruption and serialization.
- `object-focus-controller.js` owns the deep Inspect presentation, media controls, shared-element flight, focus restoration and owner invalidation while reporting lifecycle/media changes to `ProfileScene.objects`.
- `object-focus.css` owns the reusable deep-inspection presentation.
- `artifact-scenes.css` and the object-emergence styles own ambient artifact presentation and motion.

Do not copy file paths into scene bindings. Bindings reference artifact IDs and resolve paths through `ProfileArtifacts`.

## Current recipes

### `document-folio`

For a substantial PDF or paper. The first page is shown as a live tilted folio preview. The artifact can be expanded into Object Focus without changing graph route, while the original file remains available through a conventional link.

Current uses:

- Simulation Credence and Its Consequences
- The Congruence Lattice Problem — Historical Survey

### `media-deck`

For two or more visual artifacts. Objects overlap spatially, selecting one changes depth and the selected object can be inspected directly through Object Focus.

Variants are data, not separate renderers:

- `diagram` — thesis figures / technical specimens
- `screens` — software screenshots
- `fan` — photographic gallery

Current uses:

- BSc thesis diagrams
- Modal Logic Lab screenshots
- Hedgehog House photographs

## Route targets

A binding contains one or more targets:

```js
{
  route: 'work/project/bachelor-thesis',
  anchorNodeId: 'project-bachelor-thesis',
  side: 'left'
}
```

The same artifact scene can therefore appear from multiple semantic entry points. The CLP paper, for example, is reachable from both its Work project and the Congruence Lattice Problem knowledge node.

Desktop `side` is contextual: Work artifacts normally occupy the left side because the existing project inspector uses the right side. Knowledge and About artifacts can use either side according to the current inspector lane. Mobile uses the shared mobile artifact placement.

## Graph coupling

Artifact scenes are not detached overlays. Hovering or focusing a scene traces a curved tether to its current graph anchor and highlights the node. Hovering a linked visible node performs the inverse cue. This relationship is intentionally transient so the graph remains the navigation backbone rather than becoming a permanently decorated diagram.

## Object Focus

Every inspectable artifact can use the reusable `ProfileObjectFocus` controller. The controller:

- receives the source object and canonical artifact rather than owning scene selection
- stays within the application scene
- supports Escape, close control and empty-stage dismissal
- restores focus after closing
- keeps direct source links as accessible fallbacks
- uses media-specific interaction for images, PDFs, video, audio and external artifacts
- cancels pending motion with an operation token
- accepts an `ownerValid` callback so route ownership remains outside the controller
- receives a runtime object ID so Inspect and Return update the same registered scene object

The Phase 8 certificate stack uses a thin adapter: certificate selection remains owned by the certificate scene, while deep inspection is delegated to the same Object Focus controller.

## Adding another artifact scene

1. Publish and register the artifact in `artifact-data.js`.
2. Add a binding in `artifact-scene-bindings.js` using an existing recipe if possible.
3. Add a new recipe only when at least 2–3 real artifacts require a genuinely different interaction grammar.
4. Keep Ambient/Active selection in the recipe or scene owner and call Object Focus only for Inspect.
5. Add a Playwright contract for the new interaction, not merely for DOM presence.
6. Run `scripts/validate-artifact-scenes.mjs`.

## Non-goals

- Files do not automatically become graph nodes.
- The artifact layer is not a bookmark manager.
- Object Focus does not own graph routes or scene selection.
- Deep inspection is not a replacement for scene-specific interaction.
- Animations must not alter canonical graph geometry or create a second navigation state owner.
- Scene composition remains a separate Phase D concern.
