# Phase E: Camera Composition Upgrade

Phase E makes camera operations consume scene composition instead of treating the full graph viewport as permanently available.

## Canonical layer

`camera-composition.js` sits above the existing `CameraController` adapters and below interaction-specific callers.

It does not change canonical graph coordinates.

## Composed safe frame

The camera derives a safe frame from the live graph viewport and current scene occupancy.

It reserves space for:

- the visible detail inspector
- composed `side-stage` objects
- composed lower-rail content

The safe frame is expressed in screen coordinates and can be mapped back into graph coordinates for camera targets.

## Camera commands

The public command layer exposes four semantic presets.

### `MAKE_ROOM`

Keep the relevant node readable inside the remaining graph area after scene objects reserve space. It keeps zoom comparatively restrained.

### `INSPECT`

Focus a selected node into the composed safe frame. Atlas second activation uses this command instead of centring the node in the full SVG behind the inspector.

### `PEEK`

Provide a restrained temporary focus target suitable for later hover and relation previews. It stores a return state before retargeting.

### `RETURN`

Restore an explicitly remembered composition state.

`RETURN` is not automatically bound to ordinary inspector dismissal because existing Atlas semantics intentionally keep the camera stable when detail is closed.

## State memory and retargeting

Camera state memory is keyed by mode, route, and semantic slot. `INSPECT` retains an inspection origin and `PEEK` retains a temporary origin.

Each command receives a monotonically increasing operation token. Atlas camera animation already reads its target on every frame, so a newer command retargets the in-flight motion rather than waiting for the previous target to finish.

Full cross-system transition cancellation remains Phase G.

## Boot order

The module is dependency-aware. It waits until `ProfileGeometry`, `ProfileAtlasLOD`, and the legacy Atlas camera adapter all exist before wrapping that adapter. This removes dependence on dynamic script download timing.

## Current integration

- first Atlas node activation still owns selection and inspector opening
- second activation uses composition-aware `INSPECT`
- keyboard activation of an already selected Atlas node uses the same command
- closing the inspector expands the safe frame but does not itself move the camera
- the camera adapter exposes composition state through serialization

## Acceptance direction

The graph and root-level scene objects now share a common notion of available visual space. Further Phase E work can extend the same semantic camera commands to local Focus scenes without introducing route-specific camera patches.
