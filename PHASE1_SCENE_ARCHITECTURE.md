# Phase 1 — scene architecture contract

This document formalises the scene layer introduced above the existing profile graph renderer.

The central distinction is:

- **graph state** describes structural entities, relations and the currently rendered graph context;
- **scene state** describes the visible and interactive composition around that graph context.

Phase 1 deliberately does not redesign the profile content, replace the graph renderer or add bespoke project scenes. It creates the architectural contract that later phases can use.

## Runtime layers

### `site-data.js`

Owns graph/content data.

### `scene-system.js`

Owns the generic scene abstractions:

- `SceneObjectRegistry`
- `SceneManager`
- `CameraController`
- `TransitionCoordinator`

They are exposed through `window.ProfileScene`.

### `scene-definitions.js`

Contains declarative registrations for the existing DOM objects migrated in Phase 1.

### `site-graph.js`

Remains the canonical graph renderer during Phase 1. It still owns graph structure, graph layout, Work FCA rendering and the existing Atlas implementation.

### `graph-transitions-v6.js`

Remains the structural graph-animation implementation during Phase 1.

### `scene-legacy-bridge.js`

Adapts the current renderer to the new scene contracts. It converts renderer state and transition lifecycle into SceneManager/TransitionCoordinator state and exposes the existing cameras through CameraController adapters.

This bridge is explicitly transitional architecture. Later phases can remove pieces of it as the legacy renderer adopts the formal interfaces directly.

### `mobile-app.js`

Still implements the existing mobile graph projection and gestures. Its public camera operations are adapted into the common CameraController API.

## Scene object declaration

A scene object registration can declare:

```js
ProfileScene.registry.register({
  id: 'example-object',
  selector: '.example-object',
  visible: context => context.mode === 'work',
  anchorNodeId: 'work',
  placement: 'example-slot',
  enter: 'example-enter',
  exit: 'example-exit',
  variants: {
    desktop: {
      placement: 'desktop-slot'
    },
    mobile: {
      placement: 'mobile-slot'
    }
  },
  mount(context) {},
  update(context) {},
  unmount(context) {}
});
```

The important Phase 1 contract is that visibility, placement, enter/exit semantics and responsive composition are data attached to the object definition rather than distributed among future route-specific switch statements.

## Scene object lifecycle

`SceneManager` resolves each definition against the current context and maintains a runtime instance.

Supported lifecycle points:

1. **mount** — matching DOM object becomes available;
2. **enter** — declared visibility changes from false to true;
3. **update** — object remains in the same visibility state while context changes;
4. **exit** — visibility changes from true to false;
5. **unmount** — previously resolved DOM object disappears.

The manager exposes the active declaration through `data-scene-*` attributes. These are both a debugging surface and a stable hook for later scene composition/animation CSS.

Current attributes include:

- `data-scene-object`
- `data-scene-visible`
- `data-scene-variant`
- `data-scene-placement`
- `data-scene-anchor`
- `data-scene-enter`
- `data-scene-exit`
- `data-scene-lifecycle`

## Scene context

A scene-object lifecycle receives a context containing:

- route;
- graph mode;
- active node id;
- Work project id when relevant;
- desktop/mobile variant;
- viewport dimensions;
- reduced-motion preference;
- current camera state;
- current transition state;
- object-local runtime state;
- references to manager, registry, camera controller and transition coordinator.

This is intended to be the common dependency surface for future rich objects.

## Initial migrated objects

Phase 1 intentionally migrates only existing objects.

| Scene object | Existing DOM | Desktop placement | Mobile placement | Visibility |
| --- | --- | --- | --- | --- |
| root profile copy | `.hero-copy` | `identity-copy-left` | `identity-copy-upper` | Overview |
| portrait | `.hero-visual.profile-identity` | `identity-portrait-right` | `identity-portrait-upper-right` | Overview |
| Work controls | `.integrated-work-controls` | `work-side-rails` | `control-sheet` | Work |
| Atlas controls | `#atlas-controls` | `atlas-bottom-toolbar` | `control-sheet` | Atlas |
| detail panel | `#site-detail-panel` | `inspector-right` | `detail-sheet` | legacy detail state |

The `.hero` shell is also registered as a structural wrapper so the existing parent-level visibility transition can remain intact.

### Compatibility visibility ownership

The root copy and portrait are declared separately but do **not** set their own `hidden` attribute. Existing transition CSS uses the parent `.hero[hidden]` state to animate those two children, so direct child hiding would destroy the existing exit choreography.

The detail panel likewise remains externally visibility-managed in Phase 1 because the current renderer and Work compatibility layer own exact open/close timing. SceneManager already owns its scene identity, placement, responsive variant and lifecycle observation.

These are deliberate migration boundaries rather than permanent API limitations.

## Camera abstraction

`ProfileScene.camera` exposes one common operation surface:

- `fit(bounds, options)`
- `focus(node, options)`
- `follow(path, options)`
- `zoomAt(point, factor, options)`
- `pan(delta, options)`
- `transitionTo(state, options)`
- `reset(options)`
- `read()`
- `serialize()`

Phase 1 adapts three existing camera contexts:

### `desktop-local`

Represents the ordinary desktop graph view. Its current renderer is mostly layout-driven rather than camera-driven, so the adapter is currently read-only for unsupported operations.

### `atlas`

Represents the real Atlas SVG transform and delegates fit/reset/zoom/pan to the existing Atlas controls/gesture implementation.

### `mobile-local`

Represents the mobile SVG viewBox camera and delegates supported operations to `MobileProfileScene`.

`SceneManager` selects the adapter from scene meaning:

- Atlas -> `atlas`
- non-Atlas mobile -> `mobile-local`
- non-Atlas desktop -> `desktop-local`

Future scenes should call CameraController rather than reaching into a renderer-specific camera implementation.

## Transition coordinator

`ProfileScene.transitions` formalises transition ownership independently of the current overlay implementation.

Phases:

1. `begin`
2. `prepare`
3. `commit`
4. `finish`

There is also `cancel` for future transactional flows.

Each transition receives an opaque token. Only the active token can advance or finish the transaction. `isLocked` is the shared interaction-lock signal.

During Phase 1, `scene-legacy-bridge.js` observes the established `.is-v9-transitioning` lifecycle and translates it into these hooks. `phase0-stability.js` now uses `TransitionCoordinator.isLocked` as the architectural lock owner, retaining the old body class only as a compatibility fallback.

This means future scene objects can hook transition phases without knowing that the current graph animation uses a temporary SVG overlay.

## Desktop/mobile variants

Responsive composition is defined per scene object rather than by creating different semantic objects for desktop and mobile.

The same `root-profile-copy`, for example, exists in both variants. Only its placement/transition declaration changes.

This preserves the desired model:

```text
scene meaning
    +-- desktop composition
    +-- mobile composition
```

rather than treating mobile as a scaled desktop canvas.

The current mobile runtime still needs a clean reload when crossing back to desktop because its legacy gesture hooks do not yet have an explicit unmount lifecycle. That Phase 0 compatibility guard remains until a later phase removes the underlying limitation.

## Public diagnostic surface

Useful console checks:

```js
ProfileScene.manager.snapshot()
ProfileScene.registry.all()
ProfileScene.camera.read()
ProfileScene.transitions.snapshot()
ProfilePhase0.checkGraphInvariants()
```

A healthy settled scene should have:

- `ProfileScene.transitions.isLocked === false`;
- SceneManager graph route/mode equal to the renderer route/mode;
- the expected camera adapter selected;
- the expected scene objects carrying the correct desktop/mobile placement declarations;
- Phase 0 duplicate/orphan graph invariants still healthy.

## Phase 1 acceptance mapping

Roadmap requirement: **SceneManager**  
Implemented by `SceneManager` in `scene-system.js` and connected to live renderer state through the bridge.

Roadmap requirement: **SceneObject registry**  
Implemented by `SceneObjectRegistry`; current real DOM objects are registered in `scene-definitions.js`.

Roadmap requirement: **Camera abstraction**  
Implemented by `CameraController` plus desktop-local, mobile-local and Atlas adapters.

Roadmap requirement: **TransitionCoordinator hooks**  
Implemented with explicit transaction tokens and begin/prepare/commit/finish/cancel hooks; the current graph transition is bridged into them.

Roadmap requirement: **desktop/mobile scene variants**  
Implemented as per-object `variants.desktop` / `variants.mobile` declarations resolved by SceneManager.

Roadmap requirement: objects declare **when visible**  
`visible(context)`.

Roadmap requirement: objects declare **where placed**  
`placement` and variant-specific placement.

Roadmap requirement: objects declare **enter/exit behaviour**  
`enter` / `exit` semantic presets plus lifecycle callbacks.

Roadmap requirement: objects declare **desktop/mobile variant**  
`variants.desktop` / `variants.mobile`.

## Deliberately deferred

Phase 1 does **not**:

- add the standalone root landing scene from Phase 2;
- build the Atlas condensation intro from Phase 3;
- add project-specific charts, diagrams, media or demos;
- replace the current graph renderer;
- replace the existing structural animation implementation;
- merge historical CSS layers;
- remove the mobile projection compatibility runtime;
- invent one generic modal/detail presentation for all future nodes.

The value of Phase 1 is that those later changes can now target explicit scene, camera and transition interfaces instead of adding more route-specific global behaviour.

## Regression tests

`tests/phase1-scene.spec.js` verifies:

- the five requested migrated objects expose complete declarations;
- desktop Overview composition;
- Work and Atlas scene-object selection;
- camera adapter selection;
- propagation of the real structural transition through TransitionCoordinator hooks;
- preservation of Phase 0 graph invariants;
- mobile variants using the same scene-object identities.

Run the complete browser suite with:

```bash
npx playwright test
```
