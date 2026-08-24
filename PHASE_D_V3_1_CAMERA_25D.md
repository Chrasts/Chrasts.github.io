# V3.1 Phase D — Camera and 2.5D

Status: implementation candidate

Primary specification: V3.1 Phase D plus the roadmap's 2.5D / Camera 2.0 sections. The supplement retains the semantic depth-channel and camera-action vocabulary.

## Product target

Camera interaction should stop reading as flat viewport interpolation while preserving a deterministic 2D mental map.

This phase adds:

- semantic depth channels;
- camera push / pull materiality;
- differential layer parallax;
- restrained spring overshoot and controlled settle;
- semantic camera actions;
- existing inspect / make-room framing continuity;
- interruption-safe ownership boundaries.

It does **not** add arbitrary z coordinates, camera rotation or a second camera controller.

## Canonical ownership

### Existing camera adapters remain canonical

`ProfileCameraComposition` and the registered `desktop-local` / `atlas` adapters continue to own actual camera geometry.

They own:

- local SVG `viewBox`;
- Atlas camera x/y/scale;
- safe-frame composition;
- exact return memory;
- inspect framing;
- make-room geometry.

Phase D does not duplicate those coordinates.

### `camera-materiality.js` owns only perceived depth response

It owns:

- semantic camera action state;
- a small spring impulse;
- derived differential parallax;
- semantic depth-channel labels;
- temporary presentation variables.

It observes actual adapter motion and derives parallax from the real camera delta.

When the response settles, all presentation variables are removed.

## Semantic depth channels

The implementation exposes:

```text
DEPTH_BACKGROUND
DEPTH_GRAPH_BASE
DEPTH_GRAPH_ACTIVE
DEPTH_SCENE_OBJECT
DEPTH_SCENE_ACTIVE
DEPTH_FOCUS
DEPTH_HUD
```

Current mapping:

- graph edges → background;
- graph decorations → graph base;
- normal nodes → graph base;
- selected / previewed / directly active nodes → graph active;
- composed scene objects → scene object / scene active;
- focused artifact surfaces → focus;
- inspector / graph controls → HUD.

These are semantic channels, not arbitrary numeric z positions.

## Differential parallax

The live graph keeps its canonical 2D coordinates.

During a semantic camera move, the three stable SVG layer groups receive very small differential transforms:

```text
edges       ≈ 0.30 × camera-derived parallax
 decorations ≈ 0.58 × camera-derived parallax
 nodes       ≈ 0.86 × camera-derived parallax
```

The active node's canonical graph transform is untouched.

Phase C node dynamics can therefore continue to own per-node temporary offsets independently.

## Camera materiality

Each semantic action has a restrained motion profile with:

- impulse direction;
- hold time;
- spring stiffness;
- damping;
- maximum parallax;
- total settle window.

A slightly underdamped spring is allowed to overshoot minimally before converging.

The response is intentionally subtle: it should create depth, not camera wobble.

## Camera 2.0 semantic API

The upgraded `ProfileCameraComposition` surface exposes:

```text
fit(...)
focus(...)
follow(...)
pushIn(...)
pullOut(...)
makeRoom(...)
inspect(...)
peek(...)
return(...)
retarget(...)
serialize()
```

Legacy contracts remain available:

```text
PRESETS
command(...)
focusNode(...)
safeFrame()
remember(...)
recalled(...)
boot()
snapshot()
```

All semantic methods delegate to the existing camera composition owner.

There is no second camera coordinate state.

## Semantic motion vocabulary

Implemented material profiles:

```text
FIT
FOCUS
FOLLOW
PUSH
PULL
MAKE_ROOM
INSPECT
PEEK
RETURN
```

Existing presets map directly:

```text
INSPECT   → INSPECT
PEEK      → PEEK
MAKE_ROOM → MAKE_ROOM
RETURN    → RETURN
```

`pushIn`, `pullOut` and `follow` provide the richer Camera 2.0 surface for later phases.

## Interruption policy

A new camera materiality action retargets the current spring from its present state.

The layer immediately yields to structural owners during:

- graph route transitions;
- cross-link travel;
- Atlas handoff;
- intro ownership.

This preserves the central transition-ownership model.

Phase J can later integrate semantic camera motion into ordinary graph navigation without rewriting Phase D.

## Reduced motion

With `prefers-reduced-motion: reduce`:

- semantic camera commands still execute;
- inspect / make-room meaning is preserved;
- 2.5D parallax is disabled;
- spring impulse is disabled;
- no camera-motion dataset remains active.

## Performance

The materiality layer:

- uses one RAF loop only while a camera response is active;
- reads camera state, not DOM geometry, in the frame loop;
- applies transforms only to three stable SVG layer groups;
- performs no per-node simulation;
- leaves inactive media untouched.

## Acceptance tests

`tests/camera-materiality.spec.js` verifies:

1. one upgraded semantic camera API over the existing adapter;
2. deterministic semantic depth channels;
3. differential parallax during INSPECT;
4. no canonical node-coordinate mutation;
5. clean settle to zero presentation residue;
6. in-flight semantic retargeting;
7. Atlas use of the same semantic layer;
8. active-node foreground depth;
9. reduced-motion semantic equivalence.

Existing camera-composition tests remain regression guards for exact safe-frame, inspect, make-room, peek and return behaviour.

## Explicit non-goals

Phase D does not add:

- full 3D;
- free camera rotation;
- arbitrary node z positions;
- 3D force layout;
- per-node perspective transforms;
- ordinary-route camera integration (reserved for Phase J);
- Intro 3.0 choreography (Phase E).
