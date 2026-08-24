# V3.1 Phase E — Intro Atlas Reveal

Status: implementation candidate after B–D ownership review

Primary specification: `Interactive Graph Portfolio - Agent-Executable Master Roadmap V3.1.md`, especially the entry state machine, loading behaviour, Intro 3.0, Atlas Reveal, Atlas Ready and Phase E acceptance sections. The V3.1 supplement supplies progressive-interactivity, session, interruption, reduced-motion and testing detail.

## Product target

The first visit is not a cinematic overlay followed by the real site. The real Atlas is the first application state.

Canonical lifecycle:

```text
PREPARING
    ↓
ATLAS_REVEAL
    ↓
ATLAS_READY
```

`ATLAS_READY` is stable and indefinite. Phase E never automatically condenses into the profile root. Root portal behaviour belongs to Phase F and semantic Atlas condensation belongs to Phase G.

## Canonical ownership

### Graph renderer owns

- graph topology;
- Atlas node coordinates;
- edge paths;
- Work FCA mathematics;
- route geometry;
- the persistent root DOM node.

The reveal never writes canonical `data-x` / `data-y` values and never creates a second graph renderer.

### Intro reveal owns only

- entry lifecycle state;
- critical-readiness gating;
- temporary reveal classification (`data-intro-wave`, edge wave metadata);
- reveal-only opacity / dot scale / label disclosure / edge trace state;
- progressive interaction availability;
- reveal interruption and session bookkeeping.

### Existing interaction layers retain ownership

- `ProfileNodeInteraction` owns node semantic state;
- `ProfileHaloRenderer` owns reusable halo primitives but not semantic meaning;
- `ProfileNodeDynamics` owns ephemeral local displacement after the intro yields;
- `ProfileCameraComposition` owns camera coordinates;
- `ProfileCameraMateriality` owns 2.5D presentation response;
- the transition coordinator owns structural interruption.

During `PREPARING` and `ATLAS_REVEAL`, Phase C and D material motion are suspended so the reveal has one motion owner.

## Critical readiness gate

The reveal does not begin until the initial visual state is coherent. The gate verifies:

- Atlas route is active;
- every graph node is rendered;
- Phase E critical stylesheet is loaded;
- Atlas geometry is available;
- root Atlas geometry is finite;
- halo primitives exist, including two root rings;
- node interaction is available;
- camera composition is booted;
- camera materiality is booted;
- transition system is available;
- usable font metrics are ready;
- the low-resolution portrait decodes;
- the live graph can be classified into reveal waves.

The portrait is prepared here because Phase F will reveal it inside the same root object; Phase E does not display it.

A readiness failure attempts to recover to a real Atlas. The runtime does not report `ATLAS_READY` while another graph mode is active.

## Reveal grammar

The live Atlas begins heavily attenuated but already exists. The root is present from the first meaningful frame.

Semantic waves:

1. root;
2. primary branches;
3. major territories;
4. intermediate structure;
5. deep structure;
6. labels according to density / viewport;
7. selected cross-links;
8. restrained camera settle;
9. `ATLAS_READY`.

Nodes are grouped by semantic depth rather than receiving independent timers. Edges wake in corresponding structural waves. Labels arrive after graph geometry, keeping the beginning structural rather than text-heavy.

## Interaction policy

Early reveal:

- pointer movement is allowed;
- root can acknowledge interaction;
- Skip / Escape / Tab are available;
- arbitrary graph navigation is suppressed.

Late reveal:

- primary Atlas nodes can become interactive;
- a meaningful node can retarget directly into its route;
- root activation accelerates to a stable Atlas state until Phase F owns `ENTER_PROFILE`.

Atlas Ready:

- normal Atlas interaction resumes;
- the visitor can remain indefinitely;
- no automatic profile entry occurs.

## Session / route policy

- first session visit to `/` / Overview: full live Atlas reveal;
- same-session refresh: no full replay;
- deep links: bypass the reveal;
- route interruption during reveal: mark the intro seen and navigate directly;
- replay remains a secondary diagnostic/API action, not a prominent CTA.

The historical `ATLAS_READY` entry state may survive subsequent navigation, but Atlas-only presentation must be scoped to the current Atlas graph mode.

## Accessibility

- Escape accelerates to a stable usable state;
- Tab accelerates and restores focus to the persistent root;
- keyboard activation uses the same state machine;
- the skip control is a real button with an accessible label;
- deep links never trap users inside the entry sequence;
- semantic node/halo state remains available independently of motion.

## Reduced motion

Reduced motion uses the same semantic wave ordering with a short timeline and no 2.5D / node-physics competition. It still reaches the same `ATLAS_READY` state.

## Mobile

Mobile is not a scaled desktop reveal. During label disclosure, intermediate and deep label density remains suppressed. The density policy reacts to breakpoint changes during an active reveal instead of being frozen at boot time.

## B–D review corrections made while implementing E

The integration review corrected several cross-phase ownership issues:

- root `ENTRY_READY` is Atlas-only rather than leaking into Overview;
- `HaloRenderer` defaults every new halo to `idle`; semantic `root-entry` comes from the interaction coordinator;
- node dynamics treat `PREPARING` as intro-owned motion;
- camera materiality treats `PREPARING` as intro-owned motion;
- camera materiality now assigns depth channels to the actual `.site-graph-halo` primitive;
- Phase C stress coverage includes rapid retargeting, zoomed Atlas and mobile weakening.

## Acceptance tests

The Phase E regression surface verifies:

1. real Atlas renderer, no clone overlay;
2. one persistent root;
3. no legacy Phase H node-motion wrappers;
4. centre-out semantic reveal waves;
5. canonical node coordinates remain unchanged;
6. labels appear after geometry and cross-links wake late;
7. critical readiness includes CSS, fonts, portrait, geometry, halos, camera and transitions;
8. `ATLAS_READY` remains stable and does not auto-condense;
9. Escape and Tab accelerate safely;
10. late reveal navigation retargets directly;
11. session refresh and deep links bypass correctly;
12. reduced-motion semantic equivalence;
13. mobile label-density behaviour;
14. earlier node/camera material layers remain suspended while the intro owns motion.

## Explicit non-goals

Phase E does not implement:

- portrait morph / `Enter profile` portal (Phase F);
- semantic absorption / condensation (Phase G);
- polished five-branch profile landing (Phase H);
- Quick Overview (subsequent roadmap step);
- general Atlas/Focus spatial unification (Phase I/J sequence).

Keeping these boundaries explicit prevents the old monolithic intro/landing architecture from reappearing under new names.
