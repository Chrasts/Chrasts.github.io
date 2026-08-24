# Phase I — Atlas / Focus Semantic Zoom Polish

Status: implementation branch

## Roadmap objective

Make larger future graphs readable without introducing a second renderer or replacing deterministic fan-v3 geometry.

## Existing baseline retained

Phase 7 already provides:

- deterministic Atlas territories;
- four structural LOD bands (`far`, `medium`, `near`, `detail`);
- clamped pan/zoom and stable fit/focus camera operations;
- territory labels;
- label collision repair;
- selected-node focus and relation emphasis.

Phase I is therefore an additive semantic-polish layer rather than an Atlas rewrite.

## Phase I additions

### Refined semantic LOD

A second, presentation-only semantic band is derived from canonical Phase 7 camera scale:

- `territory` — root, territories and major structural labels dominate;
- `domain` — second-level domains gain readable labels;
- `node` — ordinary nodes become normally labelled;
- `evidence` — project/evidence detail is exposed.

This layer does not alter Phase 7 structural node visibility. It controls label and mark density only, preserving the established graph contract.

### Label choreography

Labels are progressively promoted rather than appearing as one bulk switch. Selected, hovered, directly related and local-neighbourhood nodes always override density suppression.

### Territory emphasis

Hover/focus/selection identifies the owning fan-v3 territory. The active territory gains emphasis while unrelated territories recede softly; direct typed relations remain legible across territory boundaries.

### Project and evidence marks

Project nodes receive a compact project mark. Nodes participating in typed `evidence` relations receive an evidence mark. Marks are intentionally quiet outside close semantic zoom.

### Typed relation preview

Hover/focus exposes direct typed graph relations independently of hierarchy-only ancestry. Incident edges and related nodes receive a semantic preview state without changing routes.

### Optional local semantic zoom

A selected Atlas node may enter a reversible neighbourhood view containing:

- the selected node;
- its primary ancestors;
- direct structural children;
- direct typed-relation neighbours.

The existing Phase 7 camera performs the actual focus operation and remains responsible for clamping.

### Stable camera contract

Phase I never writes raw camera transforms. It uses the existing `ProfileAtlasLOD` camera API, so Phase 7 remains the owner of camera bounds.

## Acceptance contract

Phase I is accepted when:

1. semantic label density changes progressively as Atlas scale changes;
2. project/evidence semantics are visually encoded without changing graph topology;
3. territory and typed-relation preview are readable and reversible;
4. optional neighbourhood zoom reduces local clutter and restores the complete Atlas cleanly;
5. camera state remains inside the established Phase 7 clamp;
6. existing Phase 7, Focus, transition and mobile tests remain green.
