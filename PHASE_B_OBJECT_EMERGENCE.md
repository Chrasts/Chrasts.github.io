# Phase B: object emergence grammar

Status: implementation candidate

The Phase B scene layer now treats artifacts as spatial scene objects rather than mini information windows.

## Rules

- Media decks do not render a generic header, eyebrow, description, status row, or Inspect footer.
- The project or graph node already provides semantic context. The artifact scene should not repeat it as a card title and paragraph.
- Each visual artifact is independently interactive and occupies its own pose in the scene.
- Diagram pairs form a loose two-object constellation.
- Screenshot pairs form staggered floating screens.
- Photo groups form a loose photographic fan.
- Object names are available through accessibility labels and a small transient tag on hover/focus, not a persistent caption bar.
- Clicking a media object opens Inspect directly. Hover/focus only establishes the active object and visual emphasis.
- External actions such as a live application are satellites, not a footer inside a containing panel.
- Document objects may keep title/summary copy when that copy is physically part of the document object itself.
- Reduced motion removes emergence animation while preserving spatial composition.

## Boundary

This is still Phase B. The implementation deliberately keeps the existing artifact recipes and focus runtime rather than extracting a general ObjectFocus or Scene Composition API. Those abstractions remain Phase C/D work after this interaction grammar is validated in the real site.
