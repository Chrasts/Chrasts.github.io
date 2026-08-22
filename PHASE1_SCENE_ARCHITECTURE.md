# Phase 1 — scene architecture contract

Phase 1 formalises the scene layer around the existing graph renderer. It deliberately does not replace the graph data model, FCA Work layout, Atlas layout, or structural transition choreography.

The central distinction is:

- **graph state** — structural nodes, edges, routes and graph-specific layout;
- **scene state** — visible interactive objects around that graph state, their placement, variant and transition semantics.

## Runtime surface

`scene-runtime.js` exposes one canonical runtime:

```js
window.ProfileScene
```

with:

- `SceneManager`
- `SceneObjectRegistry`
- `Camera`
- `TransitionCoordinator`
- `manager`
- `registry`
- `camera`
- `transitions`
- `inspect()`

`ProfileScene.inspect()` is the primary diagnostic snapshot.

## SceneObject registry

A scene object declaration can specify:

```js
{
  id,
  element,
  visibility,
  placement,
  enter,
  exit,
  variants: {
    desktop: { ... },
    mobile: { ... }
  }
}
```

### `visibility`

May be:

- boolean;
- predicate `(context, element) => boolean`;
- `manual` when the object has its own local open/close state.

### `placement`

A semantic slot name, not necessarily a DOM parent.

The current scene system records placement using `data-scene-placement`. Existing physical positioning remains in the stable CSS/mobile compatibility layers until a later phase needs managed scene slots.

### `enter` / `exit`

Semantic transition names attached as `data-scene-enter` / `data-scene-exit`.

Phase 1 does not introduce a second animation engine. Current visual choreography remains authoritative; these declarations give the future coordinator a stable contract.

### variants

Desktop/mobile variants override placement and transition declarations without duplicating the object definition.

The active variant is determined by the existing `900px` breakpoint and is exposed through:

- `body[data-scene-variant]`
- `element[data-scene-variant]`

## Initially migrated objects

The Phase 1 registry contains exactly the initial roadmap set:

| Scene object | Visibility declaration | Desktop placement | Mobile placement |
| --- | --- | --- | --- |
| `root-profile-copy` | Overview | `hero-copy` | `hero-copy-compact` |
| `root-portrait` | Overview | `hero-identity` | `hero-identity-compact` |
| `work-controls` | Work | `scene-rails` | `control-sheet` |
| `atlas-controls` | Atlas | `atlas-toolbar` | `control-sheet` |
| `detail-panel` | Manual | `scene-detail-right` | `scene-detail-sheet` |

### Compatibility ownership

The root copy and portrait declare scene visibility but do **not** add their own physical `hidden` state during Phase 1. Their parent `.hero` still owns the actual hide/show because the current transition CSS is defined around `.hero[hidden]`.

Work and Atlas controls already use their own `hidden` state and can therefore be managed declaratively without changing their animation semantics.

The detail panel remains `manual` because opening/closing it is currently local inspector state rather than route-level scene state.

## SceneManager

`SceneManager` resolves a context from the current runtime:

```js
{
  mode,
  route,
  variant,
  reducedMotion,
  transitioning
}
```

It then resolves every registered object and annotates the real DOM element with:

- `data-scene-object`
- `data-scene-variant`
- `data-scene-placement`
- `data-scene-enter`
- `data-scene-exit`
- `data-scene-presence`
- `data-scene-phase`

It synchronises on:

- graph mode/route changes;
- structural transition class changes;
- desktop/mobile breakpoint changes;
- late insertion of objects such as integrated Work controls.

## Camera abstraction

`ProfileScene.camera` is an adapter-based command/read boundary.

Current adapters:

### `desktop-local`

Represents the fixed desktop local graph camera.

### `mobile-local`

Reads the mobile SVG `viewBox` and delegates zoom/fit/reset commands to the existing `MobileProfileScene` implementation.

### `atlas`

Reads the Atlas transform camera and delegates zoom/fit/reset to the existing Atlas controls.

The abstraction intentionally does not rewrite the current physical camera implementation. Existing renderers remain authoritative while new scene code can now depend on one camera API.

Supported public commands:

```js
ProfileScene.camera.snapshot()
ProfileScene.camera.zoom(factor)
ProfileScene.camera.pan({ x, y })
ProfileScene.camera.fit()
ProfileScene.camera.reset()
```

A command returns `false` when the active adapter does not support it.

## TransitionCoordinator hooks

The current graph transition engine remains untouched.

`TransitionCoordinator` observes the established `.is-v9-transitioning` lifecycle and exposes:

```js
ProfileScene.transitions.on('before', handler)
ProfileScene.transitions.on('after', handler)
ProfileScene.transitions.on('cancel', handler)
```

Equivalent DOM events are emitted:

- `profile:transition-before`
- `profile:transition-after`
- `profile:transition-cancel`

Scene-object presence changes emit:

- `profile:scene-object-presence`

This provides stable hooks for later root, intro and cross-scene choreography without introducing competing transition ownership in Phase 1.

## Mobile compatibility

`mobile-app.js` still performs the physical mobile projection, gesture handling and movement of Work/Atlas controls into its sheet.

Its older local `registeredObjects` map is compatibility-only. `ProfileScene.registry` is the canonical cross-platform scene registry from Phase 1 onward.

The Phase 0 mobile -> desktop clean reload guard remains in place until a later explicit mobile mount/unmount lifecycle replaces it.

## Acceptance mapping

Phase 1 acceptance requires that scene objects can declare:

- **when visible** — `visibility`;
- **where placed** — `placement` + per-variant placement;
- **enter/exit behaviour** — `enter` / `exit`;
- **desktop/mobile variant** — `variants.desktop` / `variants.mobile`.

Those capabilities are covered by `tests/phase1.spec.js`, including a synthetic new registry object to verify that new scene objects can be introduced without editing the graph renderer.

## Deliberately deferred

Phase 1 does not:

- create the standalone root landing state;
- build the intro animation;
- replace graph layouts;
- replace Work FCA logic;
- rewrite transition geometry;
- remove Phase 0 guards;
- create rich project artefacts;
- consolidate historical CSS;
- implement semantic Atlas LOD.

Those remain later roadmap phases.
