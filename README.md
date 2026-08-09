# Logic Model Builder

Logic Model Builder is an interactive modal-logic laboratory and puzzle game
for constructing finite Kripke models, testing formulas, and exploring the
connection between modal axioms and relational properties.

## [Play online](https://chrasts.github.io/Modal_Logic_Educational_Game/)

The browser version is the primary way to play. It requires no installation,
and sandbox models and completed missions are saved locally in the browser.
The application opens on a home menu with a one-word **LEARN** button, followed
by a compact progress/next-lesson status, plus **CAMPAIGNS** and **SANDBOX**.
Create, Profile, settings, local data tools, and GitHub remain available in the
secondary More menu. Fullscreen is a direct topbar action rather than a More
menu item. Shared
mission URLs intentionally bypass the menu and launch their validated content.

## What you can do

- Build finite Kripke models visually by adding and moving worlds.
- Assign propositional atoms and draw accessibility relations.
- Evaluate formulas at a selected world or throughout a model.
- Check validity on a finite frame across every possible valuation.
- Compare two formulas at one world, throughout the displayed model, or under
  every valuation on a finite frame, with a distinguishing world and valuation
  when they are not equivalent.
- Work with reflexive, symmetric, transitive, Euclidean, serial, irreflexive,
  and acyclic relations.
- Validate relational properties or enforce supported relational closures.
- Compare modal axioms T, D, B, 4, and 5 with their characteristic frame
  properties on concrete finite frames.
- Inspect counterexample worlds and countervaluations when an objective fails.
- Expand a recursive evaluation tree showing subformulas, worlds, modal
  witnesses, counterexample successors, and vacuous truth.
- See the most actionable nested evaluation diagnostics summarized above the
  tree, without having to expand every subformula first.
- Navigate with a keyboard using a skip link, visible focus indicators, semantic
  landmarks, and live verification-result announcements.
- Enter browser fullscreen from the global toolbar where the Fullscreen API is
  available.
- Keep an anonymous browser-local guest history and export it as a JSON backup.
- Record structurally distinct successful solutions per mission up to finite
  Kripke-model isomorphism, so renaming worlds does not inflate the count.
- Record transparent construction metrics—worlds, explicit edges, true atom
  memberships, and semantic changes from the mission start—without presenting
  them as a proof of mathematical minimality.
- Summarize local practice by mission concept and classify failures into stable
  structural, frame-rule, answer, syntax/model, and finer semantic categories,
  including modal witnesses, box counterexamples, scope, and frame validity.
- Preview the exponential number of valuations required by frame validity and
  stop searches above the documented finite-browser limit before execution.
- Turn the current sandbox into a versioned custom mission, choose which editor
  parts remain unlocked, add size and frame-property constraints, predictions,
  required or forbidden edges and atoms, and an optional edge bonus, then share
  or launch the mission as JSON. Authors can capture a separate starting state
  and a mathematically verified reference solution; importing the mission loads
  only the player start. The author can restore that start or playtest the
  mission immediately in the same locked player workspace used by imports.
- Define repair missions with a maximum semantic-change budget measured against
  the initial model (worlds, explicit edges, and atom memberships).
- Collect authored missions into an ordered, versioned campaign package that
  can be shared as one JSON file and played as a multi-level sequence.
- Generate shareable mission or campaign URLs whose validated JSON payload is
  encoded entirely in the URL fragment and opened directly by the game.

The formula editor accepts `¬`, `∧`, `∨`, `→`, `□`, and `◇`, as well as the text
alternatives `!`, `&`, `|`, `->`, `box`, and `diamond`.

## Ways to play

### Sandbox

Build and inspect models freely. Choose whether a formula should hold at one
world, globally under the displayed valuation, or on the underlying frame under
all valuations.

### Learn Modal Logic

**Learn Modal Logic** is the single recommended route for new players. It
starts with a replayable **Welcome to Modal Logic** visual introduction, then
the replayable six-step **Learn the Controls** workspace tutorial, followed by
the complete 9-chapter, 50-lesson course: **Truth at a World**, **Worlds and
Accessibility**, **Possibility**, **Necessity**, **Box and Diamond**, **Nested
Modalities**, **Local, Global, and Frame Truth**, **Models and Countermodels**,
and **Frame Properties**. Together with the six controls lessons, the available
Learn path contains 56 tasks. The
overview and progress totals are calculated from the same `learnCourse` data
that defines the lessons.

Learn construction tasks use **Check task** after editing the model. Read-only
question tasks keep the question in the mission panel and use **Confirm answer**;
world answers are selected directly on the map. Successful Learn tasks finish
inside that panel without covering or resetting the map. The same header contains
the section/campaign, local progress, title, and a single objective; longer
briefings, concept help, analysis, hints, and reference solutions are available
under **Details & hints** instead of a second persistent strip.

Learn calls each guided unit a **lesson**, Campaigns and Practice call it a
**mission**, and Sandbox has no guided progress or mission header. Guided
workspaces render Verification by default and only expose world, valuation, or
accessibility panels that are useful for the current task.

The first workspace visit offers a versioned four-step tour that can be reopened
from **More** or the Guide without resetting the current mission. On the model
map, a mouse wheel zooms under the pointer, two-finger touchpad scrolling pans
freely in both axes, pinch zooms, and dragging empty space pans. Compact toolbar
controls provide Zoom in/out and Fit model. **Tidy model** deterministically
repositions worlds as one undoable presentation step; Fit changes only the
viewport. New worlds appear near the selected world or viewport centre, avoid
immediate spawn collisions, and can also be created by double-clicking empty
desktop map space.

Reverse directed pairs are normally presented as one bidirectional relation.
Clicking it temporarily expands the two directions for inspection or deletion.
Explicit and rule-derived directions keep distinct filled/open arrowheads, while
the table view always lists the underlying directed successors.

Campaigns is a secondary place for **General Challenges** and **Practice
Library**, with a clear link back to Learn for foundations.
Purely structural introductory tasks use construction-only objectives: they
check the required worlds, atoms, edges, and evaluation world without showing
an artificial tautological formula. Semantic lessons still show their concise,
read-only formula and only the workspace controls relevant to that lesson.

### Practice Library

The Practice Library is a non-linear secondary area within **Campaigns**. Its existing collections contain 33
missions organized by objective type:

- Local Models & Countermodels
- Global Model Building
- Countervaluations
- Frame Engineering
- Correspondence Lab
- Formula Equivalence Lab

Practice missions can restrict worlds, relations, valuations, editable inputs, and frame
properties. Some include optional bonus constraints revealed only after the
primary objective is completed. The game provides no solution hints beforehand.
Selected missions also require the player to identify a relational property;
an incorrect required answer prevents completion even when the accompanying
semantic check succeeds.
Countervaluation-choice missions present complete atom assignments per world
and require the player to select the assignment that distinguishes or refutes
the configured formula.
Candidate-model missions present several small pointed Kripke models side by
side, including their valuations and explicit relations, and require a semantic
choice rather than an edit to the active workspace.

### Local learning record

The browser keeps an anonymous guest profile with recent verification attempts,
concept and failure summaries, and distinct successful constructions. Players
can back up the full profile as JSON or export attempt-level results as CSV for
an educator or personal study review. Nothing is uploaded automatically.

### General Challenges

General Challenges are longer guided mission arcs with their own sequencing, hints,
debriefs, and learning objectives. The current built-in campaigns are:

- **Countermodel Hunter** — construct small Kripke models that refute invalid
  modal claims.
- **Frame Architect** — design accessibility relations with selected structural
  properties.
- **Formula Laboratory** — compare modal formulas and build distinguishing
  models.

### Modal Logic Guide

The in-game guide is a reference manual for formal Kripke semantics, box and
diamond, semantic scopes, relations and modal axioms, objectives, controls, and
the glossary. The dedicated Welcome and Learn the Controls experiences remain
replayable from its overview; the Guide does not duplicate them as a second
course.

Create keeps authored custom missions and custom campaign packages separate
from all built-in content.

### Workspace shortcuts

- Select an explicit edge, then press `Delete` or `Backspace` to remove it.
- Click a collapsed two-way relation to inspect its directions; press `Escape`
  or click empty space to collapse it again.
- Press `Escape` to clear the current world or edge selection.
- Use `Ctrl+Z` to undo and `Ctrl+Y` or `Ctrl+Shift+Z` to redo model edits.
  The short tutorial enables undo and redo only in its final combined step.

### Settings

Browser-local settings control workspace density, minimap visibility, derived
edge visibility, reduced interface motion, and optional sound effects. Sound is
off by default, uses only short local Web Audio cues, and never includes music.
Fullscreen is available directly
in the global toolbar when supported. Settings affect presentation only and
never change formulas, semantics, or mission constraints.

## Modal semantics

A finite Kripke frame is `F = ⟨W,R⟩`. A model is `M = ⟨W,R,ν⟩`, where
`ν: Prop → ℘(W)` is a valuation. The game uses the standard satisfaction
notation `M,w ⊨ φ`.

- `M,w ⊨ □φ` iff every `v` with `wRv` satisfies `φ`.
- `M,w ⊨ ◇φ` iff some `v` with `wRv` satisfies `φ`.
- `M ⊨ φ` checks every world under the current valuation.
- `F ⊨ φ` checks every world under every valuation.

Frame validity is computed exhaustively for the finite frame currently shown.
A correspondence result verifies agreement on that particular frame; it is not
by itself a general mathematical proof of a characteristic-class theorem.
The supported language is basic unimodal propositional logic. The application
does not solve infinite frames or claim absolute minimality for reduced models.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Vite will print the local address. If Windows PowerShell blocks `npm.ps1`, use
`npm.cmd run dev` instead.

## Documentation

- [Campaign guide](docs/CAMPAIGNS.md) — mission descriptions without solutions
- [Campaign solutions](docs/SOLUTIONS.md) — spoilers and reference constructions
- [Mathematical conventions](docs/MATHEMATICAL_NOTES.md) — semantics, notation, correspondences, and scope
- [Development guide](docs/DEVELOPMENT.md) — architecture, tests, and technical scope
- [Learn course architecture](docs/LEARN_COURSE.md) — data-driven guided-course structure and local progress
- [For educators](docs/FOR_EDUCATORS.md) — learning goals, misconceptions, suggested use, and limits
- [Pilot protocol](docs/PILOT_PROTOCOL.md) — cohorts, pre/post testing, observation, and retention
- [Privacy and analytics](docs/PRIVACY.md) — local storage, exports, hosting, cookies, and analytics policy
- [Accessibility audit](docs/ACCESSIBILITY_AUDIT.md) — implemented access paths and the manual release checklist
- [Countermodel Hunter](docs/COUNTERMODEL_HUNTER.md) — first guided campaign and its semantic strategies
- [Frame Architect](docs/FRAME_ARCHITECT.md) — guided campaign on relational frame properties
- [Formula Laboratory](docs/FORMULA_LABORATORY.md) — guided campaign on semantic formula comparison

## Technology

The application is built with React, TypeScript, Vite, and React Flow. The modal
logic engine is independent of the UI and is covered together with the primary
user interactions by an automated Vitest test suite.

## Author

Created and maintained by [Chrasts](https://github.com/Chrasts).

Copyright © 2026 Štěpán Chrast.

Released under the [MIT License](LICENSE).
