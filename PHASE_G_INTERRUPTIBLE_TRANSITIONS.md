# Phase G — Interruptible Transition Coordination

Phase G removes animation locks from normal navigation. New navigation intent can supersede motion already in progress instead of waiting for it to finish.

## Contract

`ProfileScene.transitions` is the transaction owner for coordinated motion.

The coordinator now provides:

- monotonic transition tokens and generations
- superseding `begin()` semantics
- explicit `interrupt()` and `retarget()` phases
- participant registration for independently animated subsystems
- participant state capture before cancellation
- stale-token rejection for late callbacks
- diagnostics for the current transaction and last interruption

Registered participants include structural graph transitions, camera composition, Object Focus and cross-link travel.

## Structural graph retargeting

`graph-transitions-v6.js` captures the currently rendered transition overlay before interruption. The capture records the current node positions, opacity and the currently dominant label-morph pose.

A replacement transition consumes that capture as its source geometry. It therefore starts from the visible interpolated state rather than snapping back to the previous settled route.

Every graph transition owns an operation generation. Animation frames and delayed reconciliation callbacks abort when their generation is stale, so an interrupted transition cannot later overwrite the new destination.

## Coordinated interruption

`transition-coordination.js` is loaded immediately after `scene-system.js`, before the legacy Phase 0 interaction guard. Its capture-phase navigation listener can therefore interrupt active motion synchronously and allow the same click or keyboard activation to continue to the renderer.

On interruption:

- structural graph motion captures and preserves its current visual state
- desktop-local and Atlas camera motion stop at the currently rendered camera state
- Object Focus uses its existing interruption path and operation token
- cross-link travel removes its overlay, increments its sequence token and prevents stale async continuation

The legacy stability guard still blocks non-navigation mutations while a transition owns the scene.

## Acceptance coverage

`tests/transition-coordination.spec.js` covers:

1. Rapid route input retargeting an in-flight structural transition.
2. Route navigation interrupting Object Focus without viewer resurrection.
3. Ordinary navigation cancelling cross-link travel without a stale destination commit.
4. Atlas camera motion interrupted by immediate Focus navigation.
5. Coordinator token supersession rejecting stale completion.

Phase G is accepted when rapid navigation reaches the latest requested destination without waiting for the previous animation and without stale callbacks restoring an older state.
