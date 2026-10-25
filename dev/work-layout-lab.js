/* Work Layout Lab — Variant A: Free Constellation.
 * An isolated, data-driven SVG experiment. No production renderer is loaded.
 * Connections signify shared Work themes, NOT FCA cover relations.
 */
(() => {
  'use strict';
  const source = window.SITE_DATA && window.SITE_DATA.work;
  const svg = document.getElementById('constellation');
  if (!source || !svg || !Array.isArray(source.projects)) {
    document.getElementById('lab-status').textContent = 'Project data unavailable.';
    return;
  }

  const projects = [...source.projects].sort((a, b) => a.order - b.order);
  const projectById = new Map(projects.map(project => [project.id, project]));
  const themes = source.attributes;
  const themeById = new Map(themes.map(theme => [theme.id, theme]));
  const coordinates = {
    logic: { x: 206, y: 183 },
    'computing-data': { x: 811, y: 218 },
    research: { x: 318, y: 513 },
    education: { x: 806, y: 519 }
  };
  const palettes = {
    logic: '#c4a2d6',
    'computing-data': '#75bfbe',
    research: '#d5b887',
    education: '#91abc9'
  };
  const scene = { width: 1000, height: 680 };
  const state = {
    selectedId: null,
    hoverId: null,
    selectedThemes: new Set(),
    matchMode: 'all',
    connections: true,
    motion: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    zoom: 1,
    viewX: 0,
    viewY: 0
  };
  const linkLayer = document.getElementById('relation-layer');
  const nodeLayer = document.getElementById('project-layer');
  const panel = document.getElementById('project-detail');
  const filterRoot = document.getElementById('theme-buttons');
  const status = document.getElementById('lab-status');
  const elements = new Map();
  const linkElements = new Map();
  const positions = new Map();
  const ns = 'http://www.w3.org/2000/svg';

  const sharedThemes = (a, b) => a.lattice.filter(id => b.lattice.includes(id));
  const similarity = (a, b) => sharedThemes(a, b).length / new Set([...a.lattice, ...b.lattice]).size;
  const keyFor = (a, b) => [a, b].sort().join('|');
  const hash = value => {
    let number = 2166136261;
    for (const character of value) number = Math.imul(number ^ character.charCodeAt(0), 16777619);
    return number >>> 0;
  };

  // Sparse, explainable proximity graph: up to two strongest thematic neighbours
  // per project. No edge is presented as a causal or formal-order relation.
  const relationsByKey = new Map();
  projects.forEach(project => {
    const neighbours = projects
      .filter(other => other !== project && sharedThemes(project, other).length)
      .map(other => ({ other, weight: similarity(project, other) }))
      .sort((a, b) => b.weight - a.weight || a.other.order - b.other.order)
      .slice(0, 2);
    neighbours.forEach(({ other, weight }) => {
      const key = keyFor(project.id, other.id);
      if (!relationsByKey.has(key)) {
        relationsByKey.set(key, {
          key, source: project.id, target: other.id,
          shared: sharedThemes(project, other), weight
        });
      }
    });
  });
  const relations = [...relationsByKey.values()];

  // The broad four-theme context is expressed through a reproducible,
  // deterministic free-layout with semantic attraction and collision avoidance.
  const makeLayout = () => {
    const velocities = new Map();
    projects.forEach(project => {
      const origins = project.lattice.map(id => coordinates[id]).filter(Boolean);
      const centre = origins.length
        ? { x: origins.reduce((s, p) => s + p.x, 0) / origins.length,
            y: origins.reduce((s, p) => s + p.y, 0) / origins.length }
        : { x: 500, y: 335 };
      const h = hash(project.id);
      positions.set(project.id, {
        x: centre.x + (((h % 101) / 100) - .5) * 190,
        y: centre.y + ((((h >>> 8) % 101) / 100) - .5) * 162,
        homeX: centre.x, homeY: centre.y
      });
      velocities.set(project.id, { x: 0, y: 0 });
    });

    for (let step = 0; step < 400; step++) {
      const forces = new Map(projects.map(p => [p.id, { x: 0, y: 0 }]));
      for (let i = 0; i < projects.length; i++) {
        for (let j = i + 1; j < projects.length; j++) {
          const a = positions.get(projects[i].id);
          const b = positions.get(projects[j].id);
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distance = Math.max(1, Math.hypot(dx, dy));
          const repulsion = 12000 / (distance * distance + 3500);
          const overlap = Math.hypot(dx / 156, dy / 119);
          const separation = overlap < 1 ? (1 - overlap) * 3 : 0;
          const strength = repulsion + separation;
          const fx = dx / distance * strength;
          const fy = dy / distance * strength;
          forces.get(projects[i].id).x -= fx;
          forces.get(projects[i].id).y -= fy;
          forces.get(projects[j].id).x += fx;
          forces.get(projects[j].id).y += fy;
        }
      }
      relations.forEach(edge => {
        const a = positions.get(edge.source);
        const b = positions.get(edge.target);
        const dx = b.x - a.x, dy = b.y - a.y;
        const length = Math.max(1, Math.hypot(dx, dy));
        const pull = (length - 205) * .0038 * edge.weight;
        forces.get(edge.source).x += dx / length * pull;
        forces.get(edge.source).y += dy / length * pull;
        forces.get(edge.target).x -= dx / length * pull;
        forces.get(edge.target).y -= dy / length * pull;
      });
      projects.forEach(project => {
        const point = positions.get(project.id);
        const force = forces.get(project.id);
        const velocity = velocities.get(project.id);
        force.x += (point.homeX - point.x) * .003;
        force.y += (point.homeY - point.y) * .003;
        velocity.x = (velocity.x + force.x) * .82;
        velocity.y = (velocity.y + force.y) * .82;
        point.x = Math.max(97, Math.min(903, point.x + velocity.x));
        point.y = Math.max(94, Math.min(562, point.y + velocity.y));
      });
    }
  };

  const makeSvg = (name, attrs = {}) => {
    const element = document.createElementNS(ns, name);
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
    return element;
  };
  const addText = (target, label, attrs) => {
    const el = makeSvg('text', attrs);
    el.textContent = label;
    target.appendChild(el);
    return el;
  };
  const titleLines = label => {
    const parts = label.split(/\s+/);
    const lines = [''];
    parts.forEach(word => {
      const current = lines.length - 1;
      if (lines[current] && (lines[current] + ' ' + word).length > 20 && lines.length < 2) lines.push(word);
      else lines[current] += (lines[current] ? ' ' : '') + word;
    });
    return lines;
  };

  const inFilter = project => {
    const active = [...state.selectedThemes];
    if (!active.length) return true;
    return state.matchMode === 'all'
      ? active.every(id => project.lattice.includes(id))
      : active.some(id => project.lattice.includes(id));
  };
  const accentFor = project => palettes[project.lattice[0]] || '#8fb4ad';
  const isRelated = (a, b) => relationsByKey.has(keyFor(a, b));
  const displayTheme = id => themeById.get(id)?.label || id;

  const drawLinks = () => {
    relations.forEach(edge => {
      const path = makeSvg('path', {
        class: 'relation',
        'data-key': edge.key,
        'data-source': edge.source,
        'data-target': edge.target,
        'stroke-width': (1 + edge.shared.length * .34).toFixed(2)
      });
      const hint = makeSvg('title');
      hint.textContent = 'Shared themes: ' + edge.shared.map(displayTheme).join(', ');
      path.appendChild(hint);
      linkLayer.appendChild(path);
      linkElements.set(edge.key, path);
    });
    updateEdgeGeometry();
  };
  const updateEdgeGeometry = () => {
    relations.forEach(edge => {
      const a = positions.get(edge.source), b = positions.get(edge.target);
      const dx = b.x - a.x, dy = b.y - a.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      const bend = Math.min(31, length * .095) * (hash(edge.key) % 2 ? 1 : -1);
      const midX = (a.x + b.x) / 2 - dy / length * bend;
      const midY = (a.y + b.y) / 2 + dx / length * bend;
      linkElements.get(edge.key).setAttribute('d',
        'M ' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) +
        ' Q ' + midX.toFixed(1) + ' ' + midY.toFixed(1) +
        ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1));
    });
  };

  const createNode = project => {
    const group = makeSvg('g', {
      class: 'project-node',
      tabindex: 0,
      role: 'button',
      'aria-label': project.title + '; ' + project.type,
      'data-project': project.id
    });
    group.style.setProperty('--accent', accentFor(project));
    group.style.setProperty('--duration', (7.5 + hash(project.id) % 56 / 10) + 's');
    group.style.setProperty('--delay', '-' + ((hash(project.id) % 55) / 10) + 's');
    const floating = makeSvg('g', { class: 'node-float' });
    const orbit = makeSvg('g', { class: 'node-orbit' });
    orbit.appendChild(makeSvg('ellipse', { cx: 0, cy: 0, rx: 45, ry: 13, class: 'orbit-outline', transform: 'rotate(-29)' }));
    orbit.appendChild(makeSvg('ellipse', { cx: 0, cy: 0, rx: 40, ry: 17, class: 'orbit-inner', transform: 'rotate(33)' }));
    const shell = makeSvg('circle', { r: 28, class: 'node-shell' });
    const rim = makeSvg('circle', { r: 21, class: 'node-rim' });
    const core = makeSvg('circle', { r: 11, class: 'node-core' });
    const glint = makeSvg('circle', { cx: -5, cy: -5, r: 4, class: 'node-glint' });
    floating.append(orbit, shell, rim, core, glint);
    group.appendChild(floating);
    const text = makeSvg('text', { class: 'node-label', 'text-anchor': 'middle' });
    titleLines(project.graphLabel || project.title).forEach((part, index) => {
      const span = makeSvg('tspan', { x: 0, y: 56 + index * 15 });
      span.textContent = part;
      text.appendChild(span);
    });
    group.appendChild(text);
    const coord = positions.get(project.id);
    group.setAttribute('transform', 'translate(' + coord.x.toFixed(1) + ' ' + coord.y.toFixed(1) + ')');
    group.addEventListener('pointerenter', () => { state.hoverId = project.id; syncHighlight(); });
    group.addEventListener('pointerleave', () => { state.hoverId = null; syncHighlight(); });
    group.addEventListener('focus', () => { state.hoverId = project.id; syncHighlight(); });
    group.addEventListener('blur', () => { state.hoverId = null; syncHighlight(); });
    group.addEventListener('click', () => {
      if (performance.now() < suppressClickUntil) return;
      selectProject(project.id);
    });
    group.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectProject(project.id);
      }
    });
    nodeLayer.appendChild(group);
    elements.set(project.id, group);
  };

  const clearPanel = () => {
    panel.replaceChildren();
    const kicker = document.createElement('p');
    kicker.className = 'detail-eyebrow';
    kicker.textContent = 'PROJECT INSPECTOR';
    const heading = document.createElement('h2');
    heading.textContent = 'Choose a project';
    const description = document.createElement('p');
    description.className = 'detail-description';
    description.textContent = 'Hover over a node to reveal its thematic neighbourhood. Select it to inspect the actual project and its evidence.';
    const note = document.createElement('p');
    note.className = 'detail-note';
    note.textContent = 'This is an isolated layout experiment. Existing Work and the FCA lattice are unchanged.';
    panel.append(kicker, heading, description, note);
  };
  const selectProject = id => {
    state.selectedId = state.selectedId === id ? null : id;
    renderPanel();
    syncHighlight();
  };
  const renderPanel = () => {
    const project = projectById.get(state.selectedId);
    if (!project) return clearPanel();
    panel.replaceChildren();
    const p = (className, text) => {
      const el = document.createElement('p');
      el.className = className;
      el.textContent = text;
      return el;
    };
    const title = document.createElement('h2');
    title.textContent = project.title;
    const tags = document.createElement('div');
    tags.className = 'detail-tags';
    project.lattice.forEach(id => {
      const tag = document.createElement('span');
      tag.textContent = displayTheme(id);
      tags.appendChild(tag);
    });
    const section = document.createElement('div');
    section.className = 'detail-links';
    const destination = document.createElement('a');
    destination.href = '../#work/project/' + encodeURIComponent(project.id);
    destination.textContent = 'Open full project in portfolio ↗';
    section.appendChild(destination);
    (project.links || []).slice(0, 2).forEach(link => {
      const el = document.createElement('a');
      el.href = link.href;
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
      el.textContent = link.label;
      section.appendChild(el);
    });
    const peers = relations
      .filter(rel => rel.source === project.id || rel.target === project.id)
      .map(rel => projectById.get(rel.source === project.id ? rel.target : rel.source))
      .filter(Boolean);
    panel.append(
      p('detail-eyebrow', 'SELECTED PROJECT · ' + (project.type || 'WORK')),
      title,
      tags,
      p('detail-description', project.description),
      p('detail-subhead', 'TOOLS & METHODS'),
      p('detail-secondary', (project.tech || []).join(' · ') || 'See project details'),
      p('detail-subhead', 'CONNECTED PROJECTS'),
      p('detail-secondary', peers.map(peer => peer.graphLabel).join(' · ') || 'None within sparse graph'),
      section
    );
  };

  const syncHighlight = () => {
    const active = state.hoverId || state.selectedId;
    let visible = 0;
    projects.forEach(project => {
      const filtered = inFilter(project);
      if (filtered) visible++;
      const node = elements.get(project.id);
      node.classList.toggle('is-filtered', !filtered);
      node.classList.toggle('is-selected', project.id === state.selectedId);
      node.classList.toggle('is-hovered', project.id === state.hoverId);
      node.classList.toggle('is-neighbour', !!active && active !== project.id && isRelated(active, project.id));
      node.classList.toggle('is-dimmed', !!active && active !== project.id && !isRelated(active, project.id));
      node.setAttribute('aria-pressed', String(project.id === state.selectedId));
    });
    relations.forEach(edge => {
      const el = linkElements.get(edge.key);
      const isActive = !!active && (edge.source === active || edge.target === active);
      const matched = inFilter(projectById.get(edge.source)) && inFilter(projectById.get(edge.target));
      el.classList.toggle('is-highlighted', isActive);
      el.classList.toggle('is-dimmed', (!!active && !isActive) || !matched);
      el.classList.toggle('is-hidden', !state.connections);
    });
    status.textContent = visible + ' / ' + projects.length + ' projects · ' +
      relations.length + ' shared-theme connections · experimental layout';
  };

  const syncControls = () => {
    document.getElementById('show-all').setAttribute('aria-pressed', String(!state.selectedThemes.size));
    filterRoot.querySelectorAll('button[data-theme]').forEach(button => {
      button.setAttribute('aria-pressed', String(state.selectedThemes.has(button.dataset.theme)));
    });
    document.getElementById('match-mode').textContent = 'Match: ' +
      (state.matchMode === 'all' ? 'all selected' : 'any selected');
    document.getElementById('match-mode').disabled = state.selectedThemes.size < 2;
    document.getElementById('connection-toggle').setAttribute('aria-pressed', String(state.connections));
    document.getElementById('connection-toggle').textContent = state.connections ? 'Connections: on' : 'Connections: off';
    document.getElementById('motion-toggle').setAttribute('aria-pressed', String(state.motion));
    document.getElementById('motion-toggle').textContent = state.motion ? 'Ambient motion: on' : 'Ambient motion: off';
    document.body.classList.toggle('motion-off', !state.motion);
  };
  const renderThemeControls = () => {
    themes.forEach(theme => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'theme-button';
      button.dataset.theme = theme.id;
      button.style.setProperty('--theme', palettes[theme.id] || '#a4c4bc');
      button.textContent = theme.label;
      button.addEventListener('click', () => {
        if (state.selectedThemes.has(theme.id)) state.selectedThemes.delete(theme.id);
        else state.selectedThemes.add(theme.id);
        syncControls();
        syncHighlight();
      });
      filterRoot.appendChild(button);
    });
    document.getElementById('show-all').addEventListener('click', () => {
      state.selectedThemes.clear();
      syncControls(); syncHighlight();
    });
    document.getElementById('match-mode').addEventListener('click', () => {
      state.matchMode = state.matchMode === 'all' ? 'any' : 'all';
      syncControls(); syncHighlight();
    });
    document.getElementById('connection-toggle').addEventListener('click', () => {
      state.connections = !state.connections;
      syncControls(); syncHighlight();
    });
    document.getElementById('motion-toggle').addEventListener('click', () => {
      state.motion = !state.motion;
      syncControls();
    });
  };

  const setView = () => {
    const width = scene.width / state.zoom, height = scene.height / state.zoom;
    svg.setAttribute('viewBox', [state.viewX, state.viewY, width, height].map(n => n.toFixed(2)).join(' '));
    document.getElementById('zoom-value').textContent = Math.round(state.zoom * 100) + '%';
  };
  const zoomAt = (factor, x = scene.width / 2, y = scene.height / 2) => {
    const before = state.zoom;
    state.zoom = Math.max(.8, Math.min(2.35, state.zoom * factor));
    const oldWidth = scene.width / before, oldHeight = scene.height / before;
    const newWidth = scene.width / state.zoom, newHeight = scene.height / state.zoom;
    const fx = (x - state.viewX) / oldWidth, fy = (y - state.viewY) / oldHeight;
    state.viewX = x - fx * newWidth;
    state.viewY = y - fy * newHeight;
    setView();
  };
  const svgPoint = event => {
    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: event.clientX, y: event.clientY };
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  };
  let drag = null;
  let suppressClickUntil = 0;
  svg.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const element = event.target.closest?.('.project-node');
    const point = svgPoint(event);
    const id = element?.dataset.project;
    drag = {
      id: id || null, pointerId: event.pointerId,
      start: point, last: point, moved: false
    };
    svg.setPointerCapture(event.pointerId);
  });
  svg.addEventListener('pointermove', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = svgPoint(event);
    if (Math.hypot(point.x - drag.start.x, point.y - drag.start.y) > 5) drag.moved = true;
    if (drag.moved && drag.id) {
      const node = positions.get(drag.id);
      node.x = Math.max(70, Math.min(930, node.x + point.x - drag.last.x));
      node.y = Math.max(72, Math.min(585, node.y + point.y - drag.last.y));
      elements.get(drag.id).setAttribute('transform',
        'translate(' + node.x.toFixed(1) + ' ' + node.y.toFixed(1) + ')');
      updateEdgeGeometry();
    } else if (drag.moved) {
      state.viewX += drag.last.x - point.x;
      state.viewY += drag.last.y - point.y;
      setView();
    }
    drag.last = point;
  });
  const endDrag = event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) suppressClickUntil = performance.now() + 220;
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    drag = null;
  };
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener('wheel', event => {
    event.preventDefault();
    const p = svgPoint(event);
    zoomAt(event.deltaY < 0 ? 1.12 : 1 / 1.12, p.x, p.y);
  }, { passive: false });
  document.getElementById('zoom-in').addEventListener('click', () => zoomAt(1.2));
  document.getElementById('zoom-out').addEventListener('click', () => zoomAt(1 / 1.2));
  document.getElementById('fit-view').addEventListener('click', () => {
    state.zoom = 1; state.viewX = 0; state.viewY = 0; setView();
  });
  document.getElementById('reset-layout').addEventListener('click', () => {
    makeLayout();
    projects.forEach(project => {
      const point = positions.get(project.id);
      elements.get(project.id).setAttribute('transform',
        'translate(' + point.x.toFixed(1) + ' ' + point.y.toFixed(1) + ')');
    });
    updateEdgeGeometry();
    state.zoom = 1; state.viewX = 0; state.viewY = 0; setView();
    state.selectedId = null; state.hoverId = null;
    renderPanel(); syncHighlight();
  });

  makeLayout();
  drawLinks();
  projects.forEach(createNode);
  renderThemeControls();
  syncControls();
  setView();
  renderPanel();
  syncHighlight();
})();
