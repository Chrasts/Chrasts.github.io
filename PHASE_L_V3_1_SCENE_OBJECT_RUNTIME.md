# Phase L V3.1 — Scene Object Runtime 2.0

## Scope

Phase L implements the V3.1 scene-object runtime without introducing a second scene renderer. The existing ownership model remains authoritative:

- `SceneManager` owns scene registration, DOM instances, visibility and object state.
- `ProfileSceneComposer` owns deterministic scene placement and safe-zone composition.
- `ProfileCameraComposition` owns camera semantics and graph-space movement.
- `ProfileObjectFocus` owns deep media inspection and shared-element return.
- `SceneObjectRuntime` / `ProfileSceneObjects` owns the semantic lifecycle, media policy, inspection orchestration and serialization that connect those systems.

No canonical graph coordinates, Work FCA relationships or route semantics are duplicated here.

## Lifecycle

The shared semantic lifecycle is:

`create → mount → enter → idle → activate → inspect → return → exit → destroy`

`SceneManager` remains responsible for the physical mount/visibility operations. The runtime observes manager instances and projects the semantic phase to `data-scene-runtime-phase` while retaining a bounded lifecycle history for diagnostics and regression tests.

`activate`, `inspect` and `return` are semantic active states. They do not create a new layout or coordinate owner.

## Composer contract

The runtime reads `ProfileSceneComposer.snapshot()` and stores the current deterministic assignment with each object. Return geometry captures:

- scene-object rectangle;
- inspection-source rectangle;
- composer assignment;
- semantic camera snapshot;
- composer sequence.

The runtime may request a composer reschedule after semantic state restoration, but it never calculates replacement side/slot geometry.

## Object Focus contract

`ProfileObjectFocus` is the canonical deep-inspection owner.

The runtime observes the existing Object Focus viewer/source state and maps `preparing`, `moving-in`, `settled` and `returning` onto `inspect` / `return`. Existing artifact recipes and the Phase 8 certificate adapter therefore participate in the same lifecycle without being rewritten around a new viewer.

`ProfileSceneObjects.inspect(...)` is an orchestration entry point for later scene objects. It delegates rendering and shared-element motion to `ProfileObjectFocus`.

The older `artifact-scene-runtime.js` viewer methods remain only as a degraded compatibility fallback for callers that boot without Object Focus. They are not a second canonical focus owner and should not be extended with new inspection behavior.

## Media policy

Phase L adds a shared media policy for `<audio>` and `<video>` inside scene objects:

- when an audible source starts, other audible sources are paused;
- media is paused when its owning scene object exits;
- all media is paused when the document becomes hidden;
- media position, mute, volume and playback rate can be serialized;
- restore may restore media position/state but never surprise-autoplays hidden or previously playing media.

This establishes the policy required for later video/audio pilots without forcing premature media recipes.

## Interruption

The runtime registers as a `TransitionCoordinator` participant. Structural transition cancellation interrupts active Object Focus, pauses media, normalizes the semantic phase and removes transient focus motion.

The runtime can also be interrupted directly through `ProfileSceneObjects.interrupt(reason)`.

## Serialization

`ProfileSceneObjects.serialize()` returns versioned state containing:

- graph route/mode/variant as context only;
- semantic camera snapshot;
- composer snapshot;
- Object Focus snapshot;
- per-object phase/visibility;
- existing `SceneManager` object state;
- deterministic composer assignment;
- captured return geometry;
- media state.

`restore()` restores object state and media position for live scene objects, normalizes transient inspection phases to `idle` or `exit`, and schedules composer reconciliation. It does **not** restore or mutate the route, canonical graph coordinates or Work FCA state.

## Bootstrap consolidation

Object Focus and Scene Object Runtime are now explicit canonical scene dependencies in `scene-definitions.js`. Dynamic script/style guards match both their ownership marker and actual `src`/`href`, preventing the artifact compatibility bundle from downloading a second copy under a different marker.

## Validation

`tests/scene-object-runtime.spec.js` validates:

1. shared lifecycle and deterministic composer assignment;
2. Object Focus inspection and return to the same source/object;
3. interruption cleanup;
4. one-audible-source and pause-on-exit media behavior;
5. versioned serialize/restore without route or canonical graph-geometry mutation.

The suite is retained in the permanent interaction smoke matrix.

## Acceptance

Phase L is complete when scene objects behave as inhabitants of the graph environment rather than embedded widgets: they share lifecycle semantics, deterministic composition, focus/return continuity, interruption, media policy and restorable state while preserving the established geometry, camera and semantic owners.

## Explicit non-goals

- No universal recipe language.
- No second scene renderer or coordinate system.
- No new permanent physics.
- No replacement of `ProfileObjectFocus`.
- No redesign of individual Work/Knowledge/Experience/Education/About scenes; those belong to later roadmap phases.
