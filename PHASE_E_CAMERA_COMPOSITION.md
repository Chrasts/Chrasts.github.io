# Phase E: Camera Composition Upgrade

Phase E makes camera operations consume scene composition instead of treating the full graph viewport as permanently available.

## Canonical layer

`camera-composition.js` sits above `CameraController` and wraps the existing Atlas and desktop-local adapters with one semantic camera contract.

It does not change canonical graph coordinates. Phase D owns object placement, Phase E moves the camera inside the space that Phase D leaves available.

## Composed safe frame

The camera derives a safe frame from the live graph viewport and current scene occupancy.

It reserves space for:

- the visible detail inspector
- composed `side-stage` objects
- composed lower-rail content

The safe frame is expressed in screen coordinates. Atlas maps it through canonical Atlas geometry, while desktop Focus maps it through the live SVG viewBox.

## Camera commands

The public command layer exposes four semantic presets through `ProfileCameraComposition.PRESETS` and `ProfileCameraComposition.command()`.

### `MAKE_ROOM`

Keep the relevant node readable inside the remaining graph area after scene objects reserve space. It avoids unnecessary zoom.

Desktop Focus automatically uses this command when new scene occupancy appears. Removing occupancy does not automatically move the camera back, so closing an inspector cannot make the scene jump.

### `INSPECT`

Focus the selected node into the composed safe frame.

- Atlas repeated activation uses `INSPECT` instead of centring in the full SVG.
- Desktop Focus uses a restrained local zoom and re-centres the node in the available safe frame.

### `PEEK`

Provide a restrained temporary camera focus. It stores its origin before moving so a caller can later issue `RETURN`.

### `RETURN`

Restore an explicitly remembered camera state.

`RETURN` is intentionally not bound to ordinary inspector dismissal. Closing detail expands the safe frame but leaves the current camera stable.

## Desktop-local adapter

The old desktop-local adapter was a read-only compatibility adapter. Phase E replaces it at runtime with a real adapter supporting:

- `read`
- `fit`
- `reset`
- `focus`
- `zoomAt`
- `pan`
- `transitionTo`
- `serialize`

Local camera movement is implemented through the SVG `viewBox` rather than modifying canonical node coordinates.

A canonical home viewBox is remembered per mode and route. Local targets are clamped to a limited margin around that home frame to prevent composition requests from drifting the graph arbitrarily far away.

## Retargeting

Local camera animation reads one current target operation at a time. A newer camera command invalidates the previous animation token and starts from the currently rendered viewBox.

Atlas already has a continuously interpolated target camera, so newer commands retarget the existing motion directly.

This provides Phase E retargeting without introducing the broader transition-cancellation ownership that belongs to Phase G.

## State memory

Camera memory is keyed by mode, route, and semantic slot.

- `INSPECT` stores `inspect-origin`
- `PEEK` stores `peek-origin`
- `RETURN` restores the requested slot, preferring an outstanding peek origin

Stored state includes the adapter identity, so Atlas transform state and desktop-local viewBox state cannot be confused.

## Automatic Focus composition

Desktop Focus listens to scene-composition changes. When new reservations appear it issues one `MAKE_ROOM` for the selected node.

The reservation set is monotone for that reaction: additions may retarget the camera, removals do not. This is important for interaction stability:

- opening an inspector or materialising a side object may make room
- closing an inspector does not make the graph jump back
- opening or closing Object Focus does not change local composition

Work remains compatible with the desktop-local adapter, but automatic `MAKE_ROOM` is limited to Focus mode because Work has its own persistent FCA rails and project-selection semantics.

## Atlas integration

- first Atlas activation remains Phase 7 selection and inspector ownership
- repeated activation uses composition-aware `INSPECT`
- keyboard repeated activation uses the same command
- closing the inspector expands the safe frame without resetting camera state
- existing Atlas fit, pan and zoom controls remain Phase 7 owned

## Mobile boundary

Mobile continues to use `MobileProfileScene` through the existing `mobile-local` adapter. Phase E does not redesign mobile camera composition because the dedicated mobile spatial pass is Phase P.

## Runtime and boot order

`scene-definitions.js` loads `camera-composition.js` after the scene-composer bootstrap. The module is dependency-aware and waits for legacy adapters, `ProfileGeometry`, and `ProfileAtlasLOD` before declaring the full Phase E runtime ready.

## Regression contract

Phase E browser tests cover:

- Atlas safe-frame focus beside an inspector
- Atlas inspector dismissal without camera reset
- desktop Focus `MAKE_ROOM`
- local `PEEK` followed by exact `RETURN`
- in-flight local camera retargeting
- local inspector dismissal without camera movement

## Phase boundary

Phase E is complete when both Atlas and desktop Focus consume the same semantic camera layer. More advanced interruptible scene-to-scene transition ownership is deliberately deferred to Phase G, while mobile-specific camera composition remains Phase P.
