# V3.1 Phase H — Practical Profile Root

Status: implementation candidate

Primary specification: `Interactive Graph Portfolio - Agent-Executable Master Roadmap V3.1.md`, especially Default Profile Root, Expected Root-Landing Qualitative Delta, Quick Overview and Phase H acceptance. The V3.1 supplement adds the requirement that Quick Overview is available at `ATLAS_READY` without forcing the visitor through Enter Profile.

## Product target

Phase H turns the post-condensation Overview into the practical professional homepage.

The target is not:

> the old hero page plus a graph

and not:

> the current Overview with five more visible nodes

The target is one graph-native home state in which a recruiter can immediately identify the person, understand the professional focus, open conventional professional links, scan a fast summary, and choose one of the five primary territories without learning the Atlas first.

The five canonical first-level branches remain:

```text
Work
Knowledge
Experience
Education
About
```

No extra activation is required to expose them.

## Legacy root retirement

The pre-V3.1 standalone `.hero` root is no longer a normal same-session destination.

`scene-definitions.js` now distinguishes:

- `initialOverview`: the route is Overview;
- `introEligible`: a real first-session intro should run;
- `initialRootLanding`: only `initialOverview && introEligible`.

Consequences:

- first-session `/` can retain the old root DOM only as a hidden/internal bootstrap while Intro owns the screen;
- same-session `#overview` starts directly in the expanded graph-native Profile Root;
- deep links remain direct;
- once the compatibility root is left, `root-landing.js` marks it retired for the document lifetime and normal navigation cannot resurrect it.

`ProfileRootLanding.commitExpanded()` is retained as an idempotent compatibility/transition primitive because Phase G and older runtime contracts still use it. It is no longer the primary user-facing homepage interaction.

## Identity composition

Phase H does not create another portrait object.

The portrait created by Phase F remains inside the same persistent root SVG node. Phase H only changes its settled Overview presentation so that the same semantic identity material survives:

```text
Atlas root
→ Phase F portal
→ Phase G condensation
→ Phase H Profile Root
```

A compact professional identity brief is attached to the existing graph heading region and derives its content from `SITE_DATA.profile`.

It includes:

- Štěpán Chrast;
- professional focus label;
- short profile summary;
- email;
- GitHub;
- LinkedIn;
- CV affordance;
- Quick Overview action.

The graph remains the primary spatial object. The brief is not a conventional hero card and does not replace the root node.

## CV honesty

The repository currently does not contain a published CV artifact.

Phase H therefore deliberately does **not** invent a PDF path or dead download button.

The current affordance is:

```text
CV on request
```

implemented as an email request with explicit metadata saying that no downloadable CV is currently published.

When a real CV file is added, this affordance can be switched to the canonical artifact URL without redesigning the Profile Root.

## Quick Overview

Quick Overview is the conventional fast path through the experimental interface.

It is a native modal dialog rendered in the top layer. Opening it does not change:

- route;
- graph mode;
- selected graph state;
- Atlas camera;
- local camera;
- condensation state.

Closing it restores focus to the trigger that opened it.

Its content is derived from the same canonical site data used by the graph:

- current role/experience;
- professional focus;
- selected tools derived from project metadata;
- selected Work projects;
- direct Knowledge working areas;
- Experience;
- Education;
- About;
- Atlas access;
- email;
- CV request.

Navigation actions inside Quick Overview deliberately call the existing hash router. There is no parallel content/navigation tree.

## Quick Overview at ATLAS_READY

The V3.1 supplement explicitly requires Quick Overview to be available without forcing the full cinematic/entry path.

Phase H therefore adds a compact global `Quick overview` trigger to the graph routebar whenever the graph is in a stable usable state.

This includes:

- `ATLAS_READY`;
- same-session Overview;
- Focus routes;
- Work;
- direct deep links.

During early Intro ownership it remains hidden.

This means a recruiter can choose:

```text
ATLAS_READY
→ Quick Overview
```

without triggering `Enter Profile` or Phase G condensation.

## Atlas access

Atlas remains permanently available through the existing graph route controls and from Quick Overview.

Phase H does not implement the final Focus ↔ Atlas spatial reconstruction. That remains Phase I ownership.

## Five-branch hierarchy

Phase H marks the canonical first-level nodes with `data-profile-root-branch="true"` only as a presentation hook.

It does not:

- create duplicate section nodes;
- rewrite parent relations;
- change canonical coordinates;
- alter Work FCA;
- change routes.

The presentation pass gives these branches slightly stronger material hierarchy in Overview while preserving the existing graph geometry.

## Scene-system integration

Phase H registers three late scene objects:

- `profile-root-brief`;
- `profile-quick-trigger`;
- `profile-quick-overview`.

They use `managedVisibility: false` and `unmanaged` composition roles because their DOM placement is deliberately tied to existing heading/routebar/top-layer surfaces rather than graph-safe-zone placement.

The scene registry still tracks their lifecycle so later runtime consolidation can reason about them consistently.

## Accessibility

Phase H provides:

- a visible identity heading in the practical Overview;
- conventional email/external links;
- native dialog semantics;
- `aria-labelledby` for Quick Overview;
- native Escape handling;
- focus restoration;
- keyboard-operable route actions;
- `aria-haspopup="dialog"` on the global trigger;
- reduced-motion parity;
- Quick Overview independent of graph understanding.

The experimental graph is therefore an enhancement rather than a gatekeeper.

## Mobile

Mobile keeps the same semantic state but uses a separate responsive composition:

- compact Profile Root copy;
- no large summary paragraph competing with the graph;
- global Quick Overview utility retained;
- Quick Overview becomes a one-column modal bounded by the dynamic viewport;
- no horizontal document overflow.

## Reduced motion

Reduced motion changes no information architecture or availability.

Profile Root, five branches, Quick Overview, professional links and Atlas access remain identical. H-specific transitions/animations are disabled.

## Regression coverage

`tests/profile-root.spec.js` verifies:

1. same-session Overview bypasses the standalone hero;
2. practical identity and professional actions are visible;
3. all five primary branches are immediately available;
4. the same Phase F root portrait is visible in Overview;
5. the CV action is honest and not a fabricated download;
6. Quick Overview preserves route and camera state;
7. Escape closes Quick Overview and restores focus;
8. Quick Overview route actions reuse the existing graph router;
9. `ATLAS_READY` exposes Quick Overview without Enter Profile or condensation;
10. mobile Quick Overview stays inside the application viewport;
11. reduced motion preserves the same semantic fast path.

`tests/phase2-root-landing.spec.js` is intentionally rebaselined from legacy landing acceptance to legacy landing **retirement** acceptance.

`tests/intro-unfold.spec.js` is updated so the root inspector is tested from the practical Phase H Overview rather than by manually activating the retired root landing.

The Phase H suite is retained in post-merge interaction smoke.

## Explicit non-goals

Phase H does not implement:

- direct Atlas node → Focus shared-element travel;
- Focus → Atlas topology reconstruction;
- full camera continuity between Atlas and Focus;
- spatial history;
- rich media scenes;
- final atmospheric theme;
- final CV artifact generation.

The first three are Phase I. Rich scene/runtime work begins after the early mobile/accessibility/performance checkpoint.

## Acceptance statement

Functional acceptance is reached when the practical profile root and Quick Overview work without corrupting graph state.

Experiential acceptance requires more:

> a recruiter should understand who Štěpán is, what he does, and where to go next without needing to understand or use the Atlas.

At the same time, the exploratory path must remain immediately available for visitors who want the graph-native experience.
