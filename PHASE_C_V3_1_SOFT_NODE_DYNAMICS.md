# V3.1 Phase C — Soft Node Dynamics

Status: implementation candidate

Primary specification: `Interactive Graph Portfolio - Agent-Executable Master Roadmap V3.1.md`, Phase C and sections 30–33. The V3.1 supplement retains the displacement-model and node-dynamics ownership details.

## Product target

Pointer and keyboard movement through the graph should produce clearly perceptible local material response without changing the visitor's mental map.

The intended qualitative effect is:

- the directly active node gains a small amount of visual mass;
- nearby nodes yield away from it;
- pressure falls off rapidly with canonical distance;
- semantic neighbours receive a restrained scale acknowledgement;
- graph edges remain attached continuously;
- node labels remain attached because the complete node group moves as one visual unit;
- everything relaxes back to the exact canonical graph after interaction ends.

This is deliberately not a force-directed layout.

## Ownership boundary

### Canonical graph renderer owns

- `data-x`
- `data-y`
- route-to-route geometry
- canonical edge paths
- node topology
- Work FCA geometry

`node-dynamics.js` never writes `data-x` or `data-y`.

### Node dynamics owns only ephemeral state

Per live node:

- `offsetX`
- `offsetY`
- spring velocity
- temporary scale response
- interaction targets

For edges it owns only a temporary visual path derived from the existing canonical quadratic path. The exact canonical `d` value is restored when the field settles or structural motion takes ownership.

### Transition system owns structural motion

Node dynamics suspends and resets on `profile:transition-begin` and resumes only after transition finish/cancel. Pointer/keyboard activation also clears the field before click/keyboard route handling can capture structural geometry.

## Field model

For an active node `a` and another visible node `n`:

```text
d = |targetPosition(n) - targetPosition(a)|
q = clamp(1 - d / influenceRadius, 0, 1)
falloff = q²(3 - 2q)
offsetTarget = normalize(n - a) * maxDisplacement * falloff
```

Semantic relations receive only a small multiplier before the final displacement clamp.

The active node itself has zero translation. This is intentional: the pointer target remains spatially stable while its neighbourhood responds around it.

## Spring model

Offsets and scale use critically damped / near-critically-damped spring integration with bounded velocity. Animation stops once all values reach their target tolerance; there is no permanent requestAnimationFrame loop.

Current offset is clamped to the mode's `maxDisplacement`, including any transient spring overshoot.

## Mode tuning

Desktop baseline:

| Mode | Radius | Max displacement | Active scale |
| --- | ---: | ---: | ---: |
| Overview | 260 | 22 | 1.055 |
| Focus | 220 | 18 | 1.052 |
| Work | 175 | 13 | 1.045 |
| Atlas | 140 | 10 | 1.038 |

Coarse-pointer/mobile composition uses a substantially weaker field and slightly smaller radius.

These values are perceptual tuning parameters, not graph geometry.

## Edge adaptation

The dynamics layer reads the renderer's existing quadratic path:

```text
M source Q control target
```

When either endpoint moves temporarily:

- source follows source offset;
- target follows target offset;
- the control point follows the mean endpoint offset.

This retains the renderer's chosen curve character instead of duplicating `site-graph.js` edge-generation mathematics.

## Label attachment

The temporary translation is applied to the existing `.site-graph-node` SVG group. Dot, label, metadata and halo therefore share the same temporary translation automatically.

The small active/related scale response is applied only through `--node-dynamics-scale` to the dot. Existing hover/selection transforms compose with it rather than being replaced.

## Accessibility and motion policy

With `prefers-reduced-motion: reduce`:

- interaction semantics remain active;
- halos/semantic relations continue to communicate state;
- node displacement is disabled;
- spring simulation does not run;
- edges remain canonical.

The visual meaning therefore never depends on motion alone.

## Performance policy

The implementation intentionally uses:

- existing SVG transforms;
- existing canonical node coordinates;
- one requestAnimationFrame loop only while settling;
- no layout reads in the frame loop;
- no global pairwise force simulation;
- no WebGL/canvas migration.

Each frame is O(visible nodes + visible graph edges), not O(n²).

## Public diagnostic API

`window.ProfileNodeDynamics` exposes:

```text
refresh()
reset()
suspend(reason)
resume()
stateFor(nodeId)
snapshot()
```

`snapshot()` reports the current mode tuning, maximum displacement, moving-node count, adapted-edge count and suspension state.

## Acceptance tests

`tests/node-dynamics.spec.js` verifies:

1. local pressure is visibly non-zero;
2. the active node remains translation-stable;
3. canonical `data-x/data-y` never change;
4. displacement never exceeds its clamp;
5. Atlas falloff leaves distant topology still;
6. edges adapt while endpoints move;
7. spring return restores exact canonical node transforms and edge paths;
8. route transitions preempt ephemeral motion;
9. reduced-motion interaction keeps semantics but disables displacement.

## Explicit non-goals

Phase C does not add:

- global force layout;
- persistent node drift;
- collision-chain reflow;
- inertial topology changes;
- camera motion;
- 2.5D depth;
- new route geometry;
- Work lattice restructuring.

Those would violate the V3.1 phase boundary or belong to later phases.
