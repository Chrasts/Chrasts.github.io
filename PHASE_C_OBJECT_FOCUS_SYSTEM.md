# Phase C — Object Focus System

Phase C promotes the accepted Phase B inspection behavior into one reusable Object Focus system. It does not introduce Scene Composition, which remains Phase D.

## Stable ownership

`object-focus-controller.js` owns deep artifact inspection:

- open and close lifecycle
- active and pending inspection state
- shared-element source/return flight
- cancellation and interruption tokens
- focus restoration
- reduced-motion behavior
- media construction
- image wheel/pinch zoom and drag pan
- PDF, video, audio and external media behavior
- route-owner invalidation

The public contract is `ProfileObjectFocus`:

```js
ProfileObjectFocus.open({ source, artifact, artifactId, owner, ownerValid })
ProfileObjectFocus.close({ restoreFocus })
ProfileObjectFocus.interrupt()
ProfileObjectFocus.snapshot()
```

`ObjectFocusController` is also exposed as the reusable controller class.

## Ownership boundary

Object Focus does not own scene selection.

Artifact recipes continue to own Ambient and Active states. They pass the selected DOM source and artifact to Object Focus only when the user requests Inspect. On close, the source returns to the state already represented by its scene owner.

This keeps graph and scene navigation out of the focus controller.

## Existing viewer surface

Phase C deliberately reuses the focus-viewer DOM created by `artifact-scene-runtime.js`. The controller owns the inspection behavior and content placed into that surface, while the artifact runtime still owns artifact-scene lifecycle, route visibility and graph tethering.

Replacing the viewer shell itself is not required for the extraction and would mix Phase C with later composition work.

## Media behavior

### Images

- fitted on entry
- continuous wheel zoom around the pointer
- drag pan when zoomed
- two-pointer pinch and pan
- double-click reset
- transient zoom readout and gesture hint

### PDF

- toolbar-free embedded document
- native document scrolling
- outside-stage dismissal

### Video and audio

- native playback controls
- no image gestures

### External or interactive artifacts

- lightweight launch object rather than a false embedded preview

## Certificate adapter

`object-focus-certificate-adapter.js` is intentionally thin. The Phase 8 certificate scene still owns which certificate is selected. The adapter maps the selected certificate into the shared Object Focus contract for deep inspection.

## Interruption

The Phase B compatibility repair is removed. The controller owns pending state and the viewer directly, so an interrupted opening increments the operation token, cancels any flight and closes the viewer deterministically. A delayed legacy opening callback can no longer resurrect it.

## Retired Phase B focus layer

The following pilot files are no longer loaded and are removed:

- `phase-b-object-focus-pilot.js`
- `phase-b-object-focus-pilot.css`
- `phase-b-object-focus-compat.js`

Their regression coverage is replaced by `tests/object-focus.spec.js`, which tests the stable controller contract rather than pilot implementation names.

## Related Phase B cleanup

The accepted object-emergence grammar remains in the Phase B emergence styles until Phase D. Hedgehog House now uses a safer desktop fan inset so all three rotated photographs remain inside the browser viewport.

Node-detail outside-click dismissal is also retained as a small stable interaction module. Its visibility check uses the panel's real `hidden` state rather than the delayed entrance-animation class.

## Non-goals

Phase C does not:

- introduce a Scene Composer
- change canonical graph geometry
- redesign artifact recipes
- consolidate all legacy Work code
- change camera ownership
- alter the accepted Phase B object-emergence visual grammar
