# Phase 7 — Atlas semantic zoom and level of detail

Phase 7 turns Atlas zoom from a purely geometric camera operation into semantic navigation. The topology and deterministic fan-v3 positions remain stable; zoom controls which structural level is legible.

## Geometry contract

Global compass remains:

```text
          About        Education
             ↖          ↑↗

 Experience ←── Štěpán ─────────→ Knowledge
                   |
                   ↓
                  Work
```

Work remains exactly downward. Knowledge remains the long right wing. Education is intentionally steeper and narrower than the previous fan-v3 revision so its labels and terminal nodes do not drift into Knowledge.

`radial-geometry.js` is the only owner of Atlas/Overview coordinates. In local Focus mode it no longer resets SVG label attributes.

## Local label continuity

The ancestor chain in Focus mode has one canonical label pose:

```text
node ●  Label
        meta
```

- `text-anchor: start`
- label `x=17, y=4`
- meta `x=17, y=20`

`phase7-atlas.js` installs a MutationObserver guard that corrects late writes in the same microtask checkpoint, before the browser can paint an intermediate pose. This removes the previous end-of-transition label blinking caused by multiple geometry layers writing `x`, `y` and `text-anchor` at different times.

## Semantic zoom thresholds

The public thresholds are available as `ProfileAtlasLOD.thresholds`.

| Camera scale | LOD | Visible structure |
| --- | --- | --- |
| `< 0.62` | `far` | root + five territories |
| `0.62–0.89` | `medium` | root, territories, second-level domains |
| `0.90–1.34` | `near` | all hierarchy nodes; cross-links only when contextually highlighted |
| `>= 1.35` | `detail` | all nodes, metadata and available cross-links |

Pinned Atlas selections preserve their primary ancestor path even if the current LOD would normally hide a deep node.

## Territory labels

Far and medium LOD show five screen-legible territory labels with node counts. Their text is inverse-scaled inside the Atlas camera, so labels remain readable instead of shrinking with the graph.

The ordinary section-node labels are suppressed at those levels to avoid duplicate text.

## Relation filtering

- far / medium: hierarchy only;
- near: hierarchy plus currently highlighted lateral relations;
- detail: all currently enabled Atlas relations;
- secondary relations remain detail-only.

The existing Atlas structure controls still decide whether those relation elements exist; LOD then decides whether the existing relations should be visible at the current scale.

## Camera bounds

Desktop Atlas pan/zoom now has explicit bounds:

- scale range: `0.48–2.8`;
- at scales `<= 1`, the graph remains centred;
- above `1`, panning is clamped so the graph cannot be thrown completely outside the viewport;
- mouse-wheel zoom is cursor-centred;
- `Fit all` enters scale `0.78`, i.e. the semantic medium overview.

Mobile retains its existing mobile camera ownership.

## Atlas entry affordance

The right-side Atlas button is now a larger graph-native control. It contains a small animated SVG network with hierarchy/cross-link-like edges and irregular nodes, visually previewing the dense full Atlas rather than using a generic map icon.

## Public API

```js
ProfileAtlasLOD.thresholds
ProfileAtlasLOD.applyLOD(scale?)
ProfileAtlasLOD.fit({ immediate? })
ProfileAtlasLOD.zoomIn()
ProfileAtlasLOD.zoomOut()
ProfileAtlasLOD.setScale(scale, { immediate? })
ProfileAtlasLOD.panTo(x, y, { immediate? })
ProfileAtlasLOD.applyLocalLabelPolicy()
ProfileAtlasLOD.snapshot()
```

`profile:atlas-lod-change` is dispatched whenever the semantic LOD changes.

## Acceptance surface

Phase 7 browser coverage checks:

1. Overview → Focus and deep Focus ancestor labels remain in one stable right-side pose after handoff.
2. Far Atlas contains only root + five territories.
3. Medium reveals second-level domains.
4. Near reveals the complete hierarchy while filtering idle cross-links.
5. Detail reveals available cross-links and metadata.
6. Territory labels remain available in far/medium.
7. Extreme desktop pan is clamped.
8. `Fit all` enters medium semantic overview.
9. Education remains spatially separated from Knowledge.
10. Atlas entry control is visibly larger and contains its graph glyph.
