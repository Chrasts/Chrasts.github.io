# Phase B — Media Focus v2

This note records the second Phase B iteration prompted by hands-on review of the first Object Focus pilots.

## Problem with the first pilot

The first pilot proved the Ambient → Active → Inspect state model, but the inspection surface still inherited too much of a conventional modal/browser-window metaphor:

- the focused image sat inside a framed shell;
- image zoom was a binary `View 1:1` control;
- the cursor advertised an old-style zoom action rather than direct manipulation;
- dismissing focus could replay the shared-element geometry in the wrong direction, making the media appear to expand again before disappearing;
- the interaction grammar did not yet distinguish images, documents, moving media and external/interactive artifacts strongly enough.

## Phase B v2 interaction grammar

### Image

- Focus opens as an immersive scene stage rather than a framed modal window.
- Mouse wheel zooms continuously around the pointer position.
- Drag pans the zoomed image.
- Two-pointer gestures support pinch-style scaling and panning.
- Double-click returns to fitted scale.
- A transient zoom percentage appears only while zooming.
- A short transient hint communicates the gesture model.
- Clicking empty stage space, the backdrop, close, or Escape dismisses focus.
- The old `View 1:1` button is removed from the active stage.

### PDF / document

- The PDF is presented as a document-shaped object floating directly in the focus stage.
- Browser toolbar/navigation chrome is disabled through the PDF fragment parameters.
- Native document scrolling remains available inside the document surface.
- Clicking outside the document dismisses focus.
- `Open source` remains a secondary escape hatch.

### Video

- Video uses the same spatial focus stage.
- The video itself keeps familiar native playback controls.
- No image pan/zoom gestures are imposed on moving media.

### Audio

- Audio uses a compact inline transport surface inside the focus stage.
- The surrounding focus/dismiss grammar remains the same as other media.

### Interactive / external artifacts

- External or interactive material is represented as a lightweight launch surface rather than pretending that every resource can or should be embedded.
- The route remains spatially grounded in the portfolio while the explicit launch action opens the external artifact.

## Motion correction

Shared-element animation is defined from the current media rectangle to the destination rectangle for both directions. The closing transition therefore contracts back toward the source object instead of replaying the opening transform and expanding again.

Before a zoomed image returns, direct-manipulation transforms settle back to fitted scale. This prevents a highly zoomed or panned rectangle from producing an unstable return flight.

## Scope

This remains Phase B pilot code. The implementation now demonstrates a richer media-specific grammar, but it is intentionally not yet promoted into the reusable Phase C `ObjectFocus` contract.
