# Phase 7.5 — Artifact foundation

## Purpose

Phase 7.5 introduces a publication-oriented artifact layer between the profile graph and future rich scene objects.

The graph continues to represent semantic entities and navigation. Artifacts represent concrete things attached to those entities: PDFs, images, diagrams, audio, datasets, live demos, certificates, or stable external resources.

This phase intentionally does not implement the final document/audio/diagram renderers. It creates the data and file conventions that Phases 4, 5, 8, and 9 can reuse.

## Core rule

The repository is the **published asset store**, not the master personal archive.

Commit only files that are intentionally publishable and useful to the website. Keep working files, raw source material, private documents, large masters, backups, and sensitive data elsewhere.

Anything committed to this repository or listed in `artifact-data.js` must be treated as public information. Never store secrets, access tokens, private share URLs, or confidential source material here.

## Artifact registry

`artifact-data.js` is the canonical manifest for publishable artifacts.

Each artifact has:

- `id`: stable kebab-case identifier;
- `type`: semantic artifact type;
- `title`;
- optional `description`, `year`, and `mediaType`;
- `anchorNodeIds`: graph nodes to which the artifact belongs;
- `source`: either a local repository path or an HTTPS external URL;
- `availability`: `public`, `unlisted`, or `planned`;
- optional `presentation`: hints for a future SceneObject renderer.

The current allowed semantic types are:

- `document`
- `certificate`
- `image`
- `diagram`
- `audio`
- `data`
- `interactive`
- `external`

Source location is deliberately independent of semantic type. A certificate can therefore be a local PDF or only an external verification URL without changing its meaning in the profile.

Example local document:

```js
{
  id: 'simulation-hypothesis-formalization',
  type: 'document',
  title: 'Formalisation of the Simulation Hypothesis',
  anchorNodeIds: ['some-future-graph-node'],
  source: {
    kind: 'local',
    path: 'assets/documents/education/simulation-hypothesis-formalization.pdf'
  },
  mediaType: 'application/pdf',
  availability: 'public'
}
```

Example online-only certificate:

```js
{
  id: 'example-certificate',
  type: 'certificate',
  title: 'Example Certificate',
  anchorNodeIds: ['cert-example'],
  source: {
    kind: 'external',
    url: 'https://provider.example/verify/...'
  },
  availability: 'public'
}
```

No local duplicate is required merely because the site supports local files.

## Graph relationship

Artifacts do not automatically become graph nodes.

A graph node should exist when the thing has semantic value as something a visitor may want to navigate to. A file can instead be one of several artifacts attached to an existing node.

Examples:

- one substantial coursework paper may justify a deep graph node;
- ten small exercises from one course should normally remain artifacts under one coursework node;
- a certificate is usually attached to its credential node;
- a project can expose a report, repository, screenshot, and live demo without creating four new graph nodes.

`ProfileArtifacts.forNode(nodeId)` provides the reverse lookup for future scene renderers.

## File layout

Local published files live under `assets/` by media class:

```text
assets/
├── documents/
├── images/
├── diagrams/
├── audio/
└── data/
```

The existing `assets/stepan-chrast.jpg` remains in place for compatibility. New files should use the structured directories.

Recommended subdirectories describe profile context, for example:

```text
assets/documents/education/
assets/documents/certificates/
assets/documents/work/
assets/images/work/
assets/diagrams/work/
assets/audio/music/
```

Use descriptive kebab-case names. Avoid filenames such as `final2.pdf`, `new_version.png`, or `scan001.jpg`.

## What belongs in this repository

Good candidates:

- final/public PDF papers and reports;
- certificates that are best represented as local files;
- optimized images and screenshots;
- SVG/PNG diagrams;
- small web-ready MP3/OGG audio;
- small sanitized datasets intended specifically for a portfolio visualization;
- static files required by interactive scene objects.

Prefer an external source or dedicated repository for:

- videos;
- large audio masters;
- large datasets;
- raw research data;
- generated build archives;
- files already maintained authoritatively by another service;
- credentials whose issuer provides a stable verification page.

## Source-of-truth policy

Use the most authoritative stable source available.

- If the artifact is authored and maintained in another public GitHub repository, linking there is often preferable to copying it.
- If a credential provider offers a stable verification URL, use the external URL.
- If the website itself needs to render or animate the content directly, keep an optimized local representation in `assets/`.
- A future artifact may have both a local preview and an authoritative external link, but this should be added only when a real renderer needs it.

## Phase boundaries

Phase 7.5 owns:

- artifact identifiers and metadata;
- local-vs-external source abstraction;
- graph-to-artifact relationships;
- repository file organization;
- publication/privacy rules.

Later phases own rendering:

- Phase 4: first generic rich scene pilots;
- Phase 5: Work project artifact presentations;
- Phase 8: education documents, certificates, coursework, ESSLLI objects;
- Phase 9: audio and other About-specific objects.

This prevents those phases from inventing incompatible file conventions independently.
