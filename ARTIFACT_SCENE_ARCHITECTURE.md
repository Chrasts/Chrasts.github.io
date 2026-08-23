# Rich Artifact Scene Architecture

This layer turns published portfolio artifacts into scene objects that live beside the graph instead of being reduced to links in an inspector.

## Ownership

- `artifact-data.js` remains the canonical artifact manifest: identity, semantic type, source location, availability and graph anchors.
- `artifact-scene-bindings.js` describes where an artifact experience appears: route targets, anchor nodes, scene recipe and placement side.
- `artifact-scene-recipes.js` owns reusable visual grammars. A recipe must be generic enough to serve multiple real artifacts.
- `artifact-scene-runtime.js` owns lifecycle, route visibility, focus viewing, graph tethering, hover/focus coupling and responsive behavior.
- `artifact-scenes.css` owns presentation and motion.

Do not copy file paths into scene bindings. Bindings reference artifact IDs and resolve paths through `ProfileArtifacts`.

## Current recipes

### `document-folio`

For a substantial PDF or paper. The first page is shown as a live tilted folio preview. The artifact can be expanded into an immersive viewer without changing graph route, while the original file remains available through a conventional link.

Current uses:

- Simulation Credence and Its Consequences
- The Congruence Lattice Problem — Historical Survey

### `media-deck`

For two or more visual artifacts. Cards overlap spatially; selecting one changes deck depth and an active item can be inspected in the focus viewer.

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

Desktop `side` is contextual: Work artifacts normally occupy the left side because the existing project inspector uses the right side; Knowledge/About artifacts can use the right side. Mobile ignores this and collapses the object into the shared artifact tray.

## Graph coupling

Artifact scenes are not detached overlays. Hovering or focusing a scene traces a curved tether to its current graph anchor and highlights the node. Hovering a linked visible node performs the inverse cue. This relationship is intentionally transient so the graph remains the navigation backbone rather than becoming a permanently decorated diagram.

## Focus viewer

Every inspectable local image/PDF can open in the generic focus viewer. The viewer:

- stays within the scene canvas;
- does not create document scrolling;
- supports Escape and backdrop close;
- restores focus after closing;
- keeps a direct `Open original` link as an accessible fallback.

## Adding another artifact scene

1. Publish and register the artifact in `artifact-data.js`.
2. Add a binding in `artifact-scene-bindings.js` using an existing recipe if possible.
3. Add a new recipe only when at least 2–3 real artifacts require a genuinely different interaction grammar.
4. Add a Playwright contract for the new interaction, not merely for DOM presence.
5. Run `scripts/validate-artifact-scenes.mjs`.

## Non-goals

- Files do not automatically become graph nodes.
- The artifact layer is not a bookmark manager.
- The generic focus viewer is not a replacement for scene-specific interaction; it is the accessible deep-inspection fallback.
- Animations must not alter canonical graph geometry or create a second navigation state owner.
