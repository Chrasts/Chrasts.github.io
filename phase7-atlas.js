(() => {
  const graph = window.SITE_DATA?.graph;
  const geometry = window.ProfileGeometry;
  if (!graph?.nodes?.length || !geometry?.__profileCompassV3) return;

  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const rootId = graph.rootId || 'stepan-chrast';
  const sections = ['work', 'knowledge', 'experience', 'education', 'about'];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 901px)');
  const svgNS = 'http://www.w3.org/2000/svg';
  const thresholds = Object.freeze({ far: 0.62, medium: 0.90, detail: 1.35 });
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';

  const primaryPath = node => {
    const path = [];
    const seen = new Set();
    let current = node;
    while (current && !seen.has(current.id)) {
      path.unshift(current);
      seen.add(current.id);
      current = current.parentIds?.[0] ? nodeMap.get(current.parentIds[0]) : null;
    }
    return path;
  };
  const routeNode = route => route === 'overview'
    ? nodeMap.get(rootId)
    : graph.nodes.find(node => node.route === route) || null;
  const graphRoot = document.querySelector('#site-graph');
  const graphSvg = () => document.querySelector('#site-graph .site-graph-svg');
  const liveNodes = () => [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
    .filter(element => !element.closest('.v9-transition-overlay'));
  const liveEdges = () => [...document.querySelectorAll('#site-graph .site-graph-edges path[data-source][data-target]')]
    .filter(element => !element.closest('.v9-transition-overlay'));

  /* --------------------------------------------------------------------
     Local ancestor labels: one canonical pose, repaired before paint.
     -------------------------------------------------------------------- */
  let labelGuard = false;
  let correctedLabelWrites = 0;
  const setTextPose = (text, anchor, x, y) => {
    if (!text) return false;
    let changed = false;
    if (text.getAttribute('text-anchor') !== anchor) { text.setAttribute('text-anchor', anchor); changed = true; }
    if (text.getAttribute('x') !== String(x)) { text.setAttribute('x', String(x)); changed = true; }
    if (text.getAttribute('y') !== String(y)) { text.setAttribute('y', String(y)); changed = true; }
    return changed;
  };
  const applyLocalLabelPolicy = () => {
    if (labelGuard || document.body?.dataset.graphMode !== 'focus') return false;
    const target = routeNode(normaliseRoute(document.body?.dataset.graphRoute || location.hash));
    if (!target) return false;
    const ancestorIds = new Set(primaryPath(target).slice(0, -1).map(node => node.id));
    labelGuard = true;
    let changed = 0;
    try {
      liveNodes().forEach(node => {
        const id = node.dataset.nodeId;
        const label = node.querySelector('.site-graph-label');
        const meta = node.querySelector('.site-graph-meta');
        if (!label) return;
        if (ancestorIds.has(id)) {
          changed += Number(setTextPose(label, 'start', 17, 4));
          changed += Number(setTextPose(meta, 'start', 17, 20));
          node.dataset.localLabelRole = 'ancestor';
        } else {
          node.dataset.localLabelRole = id === target.id ? 'target' : 'branch';
        }
      });
    } finally {
      labelGuard = false;
    }
    correctedLabelWrites += changed;
    return Boolean(changed);
  };

  /* --------------------------------------------------------------------
     Structural depth / LOD.
     -------------------------------------------------------------------- */
  const depth = new Map([[rootId, 0]]);
  let depthChanged = true;
  while (depthChanged) {
    depthChanged = false;
    graph.nodes.forEach(node => {
      if (node.id === rootId) return;
      const parentDepths = (node.parentIds || []).map(id => depth.get(id)).filter(Number.isFinite);
      if (!parentDepths.length) return;
      const next = Math.min(...parentDepths) + 1;
      if (!depth.has(node.id) || next < depth.get(node.id)) {
        depth.set(node.id, next);
        depthChanged = true;
      }
    });
  }
  const territoryCount = Object.fromEntries(sections.map(section => [
    section,
    graph.nodes.filter(node => geometry.sectionFor(node.id) === section).length
  ]));
  const lodForScale = scale => scale < thresholds.far
    ? 'far'
    : scale < thresholds.medium
      ? 'medium'
      : scale < thresholds.detail
        ? 'near'
        : 'detail';
  const preservedSelectionIds = () => {
    const result = new Set([rootId]);
    const selected = document.querySelector('#site-graph .site-graph-node.is-previewed[data-node-id]');
    const node = selected ? nodeMap.get(selected.dataset.nodeId) : null;
    if (node) primaryPath(node).forEach(item => result.add(item.id));
    return result;
  };

  let currentLOD = null;
  let currentScale = 1;
  let visibleNodeCount = 0;
  let hiddenNodeCount = 0;
  const visibleAtLOD = (id, lod, preserved) => {
    if (preserved.has(id)) return true;
    const d = depth.get(id) ?? 99;
    if (lod === 'far') return d <= 1;
    if (lod === 'medium') return d <= 2;
    return true;
  };

  const ensureTerritoryLayer = () => {
    if (document.body?.dataset.graphMode !== 'atlas') return null;
    const svg = graphSvg();
    if (!svg) return null;
    const edges = svg.querySelector(':scope > g > .site-graph-edges');
    const camera = edges?.parentElement || svg.firstElementChild;
    if (!camera) return null;
    let layer = camera.querySelector(':scope > .atlas-territory-label-layer');
    if (layer) return layer;

    layer = document.createElementNS(svgNS, 'g');
    layer.classList.add('atlas-territory-label-layer');
    layer.setAttribute('aria-hidden', 'true');
    const nodeLayer = camera.querySelector(':scope > .site-graph-nodes');
    camera.insertBefore(layer, nodeLayer || null);
    sections.forEach(section => {
      const point = geometry.atlasPoint(section);
      const vector = geometry.compass[section];
      if (!point || !vector) return;
      const group = document.createElementNS(svgNS, 'g');
      group.classList.add('atlas-territory-label');
      group.dataset.territory = section;
      group.dataset.baseX = String(point.x + vector.x * 54);
      group.dataset.baseY = String(point.y + vector.y * 54);
      const title = document.createElementNS(svgNS, 'text');
      title.classList.add('atlas-territory-title');
      title.setAttribute('text-anchor', 'middle');
      title.textContent = nodeMap.get(section)?.label || section;
      const count = document.createElementNS(svgNS, 'text');
      count.classList.add('atlas-territory-count');
      count.setAttribute('text-anchor', 'middle');
      count.setAttribute('y', '17');
      count.textContent = `${territoryCount[section]} items`;
      group.append(title, count);
      layer.appendChild(group);
    });
    return layer;
  };
  const syncTerritoryLabels = scale => {
    const layer = ensureTerritoryLayer();
    if (!layer) return;
    const inverse = 1 / Math.max(0.001, scale);
    layer.querySelectorAll('.atlas-territory-label').forEach(group => {
      const x = Number(group.dataset.baseX);
      const y = Number(group.dataset.baseY);
      group.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${inverse.toFixed(4)})`);
    });
  };

  const applyLOD = (scale = currentScale) => {
    if (document.body?.dataset.graphMode !== 'atlas' || document.querySelector('.profile-intro-overlay')) return false;
    currentScale = Number.isFinite(scale) ? scale : currentScale;
    const lod = lodForScale(currentScale);
    const preserved = preservedSelectionIds();
    const visibility = new Map();

    liveNodes().forEach(node => {
      const id = node.dataset.nodeId;
      const show = visibleAtLOD(id, lod, preserved);
      visibility.set(id, show);
      node.classList.toggle('is-atlas-lod-hidden', !show);
      node.classList.toggle('is-atlas-territory-node', sections.includes(id));
      node.dataset.atlasDepth = String(depth.get(id) ?? 99);
      node.dataset.atlasTerritory = geometry.sectionFor(id) || '';
    });

    liveEdges().forEach(edge => {
      const hierarchy = ['hierarchy', 'hierarchy-alt', 'work-lattice'].includes(edge.dataset.type || '');
      const secondary = edge.classList.contains('is-secondary');
      const endpointsVisible = visibility.get(edge.dataset.source) !== false && visibility.get(edge.dataset.target) !== false;
      let show = endpointsVisible;
      if (secondary && lod !== 'detail') show = false;
      if (!hierarchy && (lod === 'far' || lod === 'medium')) show = false;
      edge.classList.toggle('is-atlas-lod-hidden', !show);
    });

    visibleNodeCount = [...visibility.values()].filter(Boolean).length;
    hiddenNodeCount = visibility.size - visibleNodeCount;
    const previous = currentLOD;
    currentLOD = lod;
    document.body.dataset.atlasLod = lod;
    syncTerritoryLabels(currentScale);
    scheduleLabelCollisionPass();

    if (previous !== lod) {
      dispatchEvent(new CustomEvent('profile:atlas-lod-change', {
        detail: { lod, previous, scale: currentScale, visibleNodeCount, hiddenNodeCount }
      }));
    }
    return true;
  };

  /* --------------------------------------------------------------------
     Atlas camera. Phase 7 owns desktop pan/zoom after initial render.
     -------------------------------------------------------------------- */
  const atlasSize = geometry.snapshot().atlasSize || { width: 2520, height: 1580 };
  const camera = { x: 0, y: 0, scale: 1, targetX: 0, targetY: 0, targetScale: 1, frame: 0 };
  let cameraWriting = false;
  let lastWrittenTransform = '';
  let gesture = null;
  let suppressAtlasClickUntil = 0;
  let preserveCameraUntil = 0;
  let preservedCamera = null;

  const cameraElement = () => {
    const svg = graphSvg();
    const edges = svg?.querySelector(':scope > g > .site-graph-edges');
    return edges?.parentElement || svg?.firstElementChild || null;
  };
  const cameraBounds = (scale = camera.targetScale) => {
    const margin = 82;
    if (scale <= 1) {
      const x = (atlasSize.width - atlasSize.width * scale) / 2;
      const y = (atlasSize.height - atlasSize.height * scale) / 2;
      return { minX: x, maxX: x, minY: y, maxY: y };
    }
    return {
      minX: atlasSize.width - margin - atlasSize.width * scale,
      maxX: margin,
      minY: atlasSize.height - margin - atlasSize.height * scale,
      maxY: margin
    };
  };
  const clampCamera = state => {
    state.scale = clamp(state.scale, 0.48, 2.8);
    const bounds = cameraBounds(state.scale);
    state.x = clamp(state.x, bounds.minX, bounds.maxX);
    state.y = clamp(state.y, bounds.minY, bounds.maxY);
    return state;
  };
  const writeCamera = () => {
    const element = cameraElement();
    if (!element || document.body?.dataset.graphMode !== 'atlas') return;
    const transform = `translate(${camera.x.toFixed(2)} ${camera.y.toFixed(2)}) scale(${camera.scale.toFixed(4)})`;
    cameraWriting = true;
    lastWrittenTransform = transform;
    if (element.getAttribute('transform') !== transform) element.setAttribute('transform', transform);
    cameraWriting = false;
    applyLOD(camera.scale);
  };
  const animateCamera = () => {
    if (camera.frame) return;
    const frame = () => {
      const factor = reduced.matches ? 1 : 0.28;
      camera.x += (camera.targetX - camera.x) * factor;
      camera.y += (camera.targetY - camera.y) * factor;
      camera.scale += (camera.targetScale - camera.scale) * factor;
      writeCamera();
      if (
        Math.abs(camera.targetX - camera.x) < 0.05 &&
        Math.abs(camera.targetY - camera.y) < 0.05 &&
        Math.abs(camera.targetScale - camera.scale) < 0.0006
      ) {
        camera.x = camera.targetX;
        camera.y = camera.targetY;
        camera.scale = camera.targetScale;
        camera.frame = 0;
        writeCamera();
        return;
      }
      camera.frame = requestAnimationFrame(frame);
    };
    camera.frame = requestAnimationFrame(frame);
  };
  const setCamera = ({ x = camera.targetX, y = camera.targetY, scale = camera.targetScale } = {}, { immediate = false } = {}) => {
    const next = clampCamera({ x, y, scale });
    camera.targetX = next.x;
    camera.targetY = next.y;
    camera.targetScale = next.scale;
    if (immediate || reduced.matches) {
      cancelAnimationFrame(camera.frame);
      camera.frame = 0;
      camera.x = next.x;
      camera.y = next.y;
      camera.scale = next.scale;
      writeCamera();
    } else animateCamera();
    return { ...next };
  };
  const fit = ({ immediate = false } = {}) => {
    const scale = 0.78;
    const bounds = cameraBounds(scale);
    return setCamera({ x: bounds.minX, y: bounds.minY, scale }, { immediate });
  };
  const zoomAt = (clientX, clientY, factor, immediate = false) => {
    const svg = graphSvg();
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = (clientX - rect.left) * atlasSize.width / Math.max(1, rect.width);
    const py = (clientY - rect.top) * atlasSize.height / Math.max(1, rect.height);
    const oldScale = camera.targetScale;
    const nextScale = clamp(oldScale * factor, 0.48, 2.8);
    const graphX = (px - camera.targetX) / oldScale;
    const graphY = (py - camera.targetY) / oldScale;
    setCamera({
      x: px - graphX * nextScale,
      y: py - graphY * nextScale,
      scale: nextScale
    }, { immediate });
  };
  const zoomCentre = factor => {
    const svg = graphSvg();
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor, false);
  };
  const focusNode = (id, { immediate = false } = {}) => {
    const point = geometry.atlasPoint(id);
    if (!point) return false;
    const scale = clamp(Math.max(1.35, camera.targetScale * 1.28), 1.35, 2.25);
    return setCamera({
      x: atlasSize.width / 2 - point.x * scale,
      y: atlasSize.height / 2 - point.y * scale,
      scale
    }, { immediate });
  };
  const syncCameraFromDOM = () => {
    if (document.body?.dataset.graphMode !== 'atlas') return;
    const transform = cameraElement()?.getAttribute('transform') || '';
    const translate = transform.match(/translate\(\s*(-?[\d.]+)[,\s]+(-?[\d.]+)\s*\)/i);
    const scale = transform.match(/scale\(\s*(-?[\d.]+)\s*\)/i);
    const next = clampCamera({
      x: translate ? Number(translate[1]) : 0,
      y: translate ? Number(translate[2]) : 0,
      scale: scale ? Number(scale[1]) : 1
    });
    Object.assign(camera, next, { targetX: next.x, targetY: next.y, targetScale: next.scale });
    applyLOD(camera.scale);
    syncTerritoryLabels(camera.scale);
  };
  const freezeCameraForRerender = (duration = 1100) => {
    cancelAnimationFrame(camera.frame);
    camera.frame = 0;
    camera.targetX = camera.x;
    camera.targetY = camera.y;
    camera.targetScale = camera.scale;
    preservedCamera = { x: camera.x, y: camera.y, scale: camera.scale };
    preserveCameraUntil = performance.now() + duration;
  };
  const restorePreservedCamera = () => {
    if (!preservedCamera) return;
    setCamera(preservedCamera, { immediate: true });
  };

  /* --------------------------------------------------------------------
     Atlas relation semantics and controls.
     -------------------------------------------------------------------- */
  const atlasHierarchy = () => document.querySelector('#atlas-hierarchy');
  const atlasCrosslinks = () => document.querySelector('#atlas-crosslinks');
  const atlasSecondary = () => document.querySelector('#atlas-secondary');

  const scrubLateralHighlight = () => {
    if (document.body?.dataset.graphMode !== 'atlas') return;
    const origin = document.querySelector('#site-graph .site-graph-node.is-atlas-origin[data-node-id]');
    if (!origin) return;
    const crossEnabled = atlasCrosslinks()?.checked ?? true;
    const secondaryEnabled = atlasSecondary()?.checked ?? false;
    const allowed = new Set();
    if (crossEnabled) {
      graph.edges.forEach(edge => {
        if (edge.secondary && !secondaryEnabled) return;
        if (edge.source === origin.dataset.nodeId) allowed.add(edge.target);
        if (edge.target === origin.dataset.nodeId) allowed.add(edge.source);
      });
    }
    liveNodes().forEach(node => {
      if (node.classList.contains('is-lateral') && !allowed.has(node.dataset.nodeId)) node.classList.remove('is-lateral');
    });
    liveEdges().forEach(edge => {
      if (!crossEnabled && edge.classList.contains('is-lateral')) edge.classList.remove('is-lateral');
    });
  };

  const replaceLabelText = (input, text) => {
    const label = input?.closest('label');
    if (!label) return;
    [...label.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).forEach(node => node.remove());
    label.append(document.createTextNode(` ${text}`));
  };
  const decorateAtlasControls = () => {
    const controls = document.querySelector('#atlas-controls');
    if (!controls) return;
    controls.setAttribute('aria-label', 'Atlas display controls');
    const title = controls.querySelector('.atlas-controls-title');
    if (title) title.textContent = 'Show';
    const hierarchy = atlasHierarchy();
    const cross = atlasCrosslinks();
    const secondary = atlasSecondary();
    replaceLabelText(hierarchy, 'Structure');
    replaceLabelText(cross, 'Connections');
    replaceLabelText(secondary, 'Additional links');
    hierarchy?.closest('label')?.setAttribute('title', 'Show the parent/child structure of the profile.');
    cross?.closest('label')?.setAttribute('title', 'Show direct connections between different parts of the profile.');
    secondary?.closest('label')?.setAttribute('title', 'Show weaker or supplementary relationships, such as related topics and planned study.');
    const structureOnly = controls.querySelector('.atlas-structure-only');
    if (structureOnly) structureOnly.textContent = 'Structure only';
    const all = document.querySelector('#atlas-show-all');
    if (all) all.textContent = 'All links';
    const fitButton = document.querySelector('#atlas-fit');
    if (fitButton) fitButton.textContent = 'Fit';
    const reset = document.querySelector('#atlas-reset');
    if (reset) reset.textContent = 'Reset';
    const overview = controls.querySelector('.atlas-overview');
    if (overview) overview.textContent = 'Overview';
  };

  const updateAtlasHelp = () => {
    if (document.body?.dataset.graphMode !== 'atlas') return;
    const help = document.querySelector('#site-graph-help');
    if (help) help.textContent = 'Hover to trace structure and connections. Click a node for details; click the same node again to centre and zoom.';
  };

  /* --------------------------------------------------------------------
     Inspector wording / click-away / second-click focus.
     -------------------------------------------------------------------- */
  const clearAtlasSelection = () => {
    const detail = document.querySelector('#site-detail-panel');
    const selected = document.querySelector('#site-graph .site-graph-node.is-previewed[data-node-id]');
    if (!selected && (detail?.hidden ?? true)) return false;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    liveNodes().forEach(node => node.classList.remove('is-previewed'));
    scrubLateralHighlight();
    return true;
  };
  const decorateInspector = () => {
    if (document.body?.dataset.graphMode !== 'atlas') return;
    const detail = document.querySelector('#site-detail-panel');
    if (!detail || detail.hidden) return;
    detail.classList.add('atlas-detail-compact');
    detail.querySelectorAll('.detail-list-title').forEach(title => {
      const text = title.textContent.trim();
      if (text === 'Upstream') title.textContent = 'Parents';
      else if (text === 'Downstream') title.textContent = 'Children';
      else if (text === 'Cross-links') title.textContent = 'Connections';
    });
    const action = detail.querySelector('.atlas-open-local');
    if (action) {
      const selectedId = document.querySelector('#site-graph .site-graph-node.is-previewed[data-node-id]')?.dataset.nodeId;
      action.textContent = selectedId === rootId ? 'Back to overview' : selectedId === 'work' ? 'Open Work' : 'Explore this section';
      if (!detail.querySelector('.atlas-repeat-click-hint')) {
        const hint = document.createElement('p');
        hint.className = 'atlas-repeat-click-hint';
        hint.textContent = 'Click the selected node again to centre and zoom.';
        detail.insertBefore(hint, action);
      }
    }
  };

  /* --------------------------------------------------------------------
     Atlas label collision pass. Coordinates stay canonical; only text gets
     small deterministic local offsets when labels overlap.
     -------------------------------------------------------------------- */
  let collisionFrame = 0;
  const clearAtlasLabelOffsets = () => {
    document.querySelectorAll('#site-graph .site-graph-label[data-atlas-label-offset]').forEach(label => {
      label.removeAttribute('transform');
      delete label.dataset.atlasLabelOffset;
    });
  };
  const overlapArea = (a, b, pad = 3) => {
    const left = Math.max(a.left - pad, b.left - pad);
    const right = Math.min(a.right + pad, b.right + pad);
    const top = Math.max(a.top - pad, b.top - pad);
    const bottom = Math.min(a.bottom + pad, b.bottom + pad);
    return Math.max(0, right - left) * Math.max(0, bottom - top);
  };
  const resolveAtlasLabelCollisions = () => {
    collisionFrame = 0;
    if (document.body?.dataset.graphMode !== 'atlas' || !['near', 'detail'].includes(document.body.dataset.atlasLod)) {
      clearAtlasLabelOffsets();
      return;
    }
    clearAtlasLabelOffsets();
    const candidates = liveNodes()
      .filter(node => !node.classList.contains('is-atlas-lod-hidden'))
      .map(node => ({ node, label: node.querySelector('.site-graph-label') }))
      .filter(item => item.label && getComputedStyle(item.label).opacity !== '0')
      .sort((a, b) => {
        const priority = item => item.node.classList.contains('is-previewed') ? -2 : item.node.dataset.nodeId === rootId ? -1 : sections.includes(item.node.dataset.nodeId) ? 0 : (depth.get(item.node.dataset.nodeId) ?? 99);
        return priority(a) - priority(b) || a.node.dataset.nodeId.localeCompare(b.node.dataset.nodeId);
      });
    const placed = [];
    candidates.forEach(({ node, label }) => {
      let rect = label.getBoundingClientRect();
      const conflicts = candidate => placed.reduce((sum, other) => sum + overlapArea(candidate, other), 0);
      if (conflicts(rect) <= 0) {
        placed.push(rect);
        return;
      }
      const section = geometry.sectionFor(node.dataset.nodeId);
      const vector = geometry.compass[section] || { x: 1, y: 0 };
      const perpendicular = { x: -vector.y, y: vector.x };
      const offsets = [
        16, -16, 30, -30, 44, -44
      ].map(amount => ({ x: perpendicular.x * amount, y: perpendicular.y * amount }))
        .concat([
          { x: vector.x * 18, y: vector.y * 18 },
          { x: -vector.x * 18, y: -vector.y * 18 },
          { x: perpendicular.x * 54 + vector.x * 12, y: perpendicular.y * 54 + vector.y * 12 },
          { x: -perpendicular.x * 54 + vector.x * 12, y: -perpendicular.y * 54 + vector.y * 12 }
        ]);
      let best = { score: conflicts(rect), offset: null, rect };
      offsets.forEach(offset => {
        label.setAttribute('transform', `translate(${offset.x.toFixed(1)} ${offset.y.toFixed(1)})`);
        const candidateRect = label.getBoundingClientRect();
        const score = conflicts(candidateRect);
        if (score < best.score) best = { score, offset, rect: candidateRect };
      });
      if (best.offset) {
        label.setAttribute('transform', `translate(${best.offset.x.toFixed(1)} ${best.offset.y.toFixed(1)})`);
        label.dataset.atlasLabelOffset = 'true';
        rect = best.rect;
      } else {
        label.removeAttribute('transform');
      }
      placed.push(rect);
    });
  };
  function scheduleLabelCollisionPass() {
    if (collisionFrame) cancelAnimationFrame(collisionFrame);
    collisionFrame = requestAnimationFrame(() => {
      collisionFrame = requestAnimationFrame(resolveAtlasLabelCollisions);
    });
  }

  /* --------------------------------------------------------------------
     Atlas entry affordance: graph glyph + plain-language label.
     -------------------------------------------------------------------- */
  const decorateAtlasButton = button => {
    if (!button || button.dataset.phase7V2Decorated === 'true') return;
    button.dataset.phase7V2Decorated = 'true';
    button.classList.add('atlas-entry-v7');
    button.setAttribute('aria-label', 'Open Atlas, the full profile map');
    button.replaceChildren();

    const glyph = document.createElementNS(svgNS, 'svg');
    glyph.classList.add('atlas-entry-glyph');
    glyph.setAttribute('viewBox', '0 0 88 52');
    glyph.setAttribute('aria-hidden', 'true');
    const edges = document.createElementNS(svgNS, 'g');
    edges.classList.add('atlas-entry-glyph-edges');
    [
      [44,26,13,10],[44,26,75,11],[44,26,14,40],[44,26,74,41],
      [44,26,61,25],[13,10,30,17],[75,11,61,25],[14,40,32,34],[74,41,61,25],[30,17,32,34]
    ].forEach(([x1,y1,x2,y2]) => {
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1);
      line.setAttribute('x2', x2); line.setAttribute('y2', y2);
      edges.appendChild(line);
    });
    const nodes = document.createElementNS(svgNS, 'g');
    nodes.classList.add('atlas-entry-glyph-nodes');
    [[44,26,4.2],[13,10,2.5],[75,11,2.3],[14,40,2.4],[74,41,2.7],[61,25,2.2],[30,17,1.8],[32,34,1.9]].forEach(([cx,cy,r]) => {
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', cx); circle.setAttribute('cy', cy); circle.setAttribute('r', r);
      nodes.appendChild(circle);
    });
    glyph.append(edges, nodes);
    const copy = document.createElement('span');
    copy.className = 'atlas-entry-copy';
    const title = document.createElement('strong');
    title.textContent = 'Atlas';
    copy.appendChild(title);
    button.append(glyph, copy);
  };

  /* --------------------------------------------------------------------
     Observers and interaction ownership.
     -------------------------------------------------------------------- */
  if (graphRoot) {
    new MutationObserver(mutations => {
      if (!labelGuard && document.body?.dataset.graphMode === 'focus' && mutations.some(mutation =>
        mutation.type === 'childList' || (mutation.type === 'attributes' && ['x', 'y', 'text-anchor'].includes(mutation.attributeName))
      )) applyLocalLabelPolicy();

      if (document.body?.dataset.graphMode === 'atlas') {
        requestAnimationFrame(() => {
          observeCamera();
          applyLOD(camera.scale);
          scrubLateralHighlight();
          decorateInspector();
          scheduleLabelCollisionPass();
        });
      }
    }).observe(graphRoot, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['x', 'y', 'text-anchor', 'class']
    });
  }

  if (document.body) {
    new MutationObserver(() => {
      applyLocalLabelPolicy();
      if (document.body.dataset.graphMode === 'atlas') {
        updateAtlasHelp();
        decorateAtlasControls();
        requestAnimationFrame(() => {
          syncCameraFromDOM();
          ensureTerritoryLayer();
          applyLOD(camera.scale);
          decorateInspector();
          scheduleLabelCollisionPass();
        });
      } else {
        delete document.body.dataset.atlasLod;
        clearAtlasLabelOffsets();
      }
    }).observe(document.body, { attributes: true, attributeFilter: ['data-graph-mode', 'data-graph-route', 'class'] });
  }

  const detail = document.querySelector('#site-detail-panel');
  if (detail) new MutationObserver(() => requestAnimationFrame(decorateInspector)).observe(detail, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });

  const cameraObserver = new MutationObserver(() => {
    if (cameraWriting || !desktop.matches || document.body?.dataset.graphMode !== 'atlas') return;
    const current = cameraElement()?.getAttribute('transform') || '';
    if (current === lastWrittenTransform) return;
    if (performance.now() < preserveCameraUntil && preservedCamera) {
      restorePreservedCamera();
      return;
    }
    syncCameraFromDOM();
  });
  let observedCamera = null;
  function observeCamera() {
    const element = cameraElement();
    if (!element || element === observedCamera) return;
    cameraObserver.disconnect();
    observedCamera = element;
    cameraObserver.observe(element, { attributes: true, attributeFilter: ['transform'] });
  }
  requestAnimationFrame(observeCamera);

  addEventListener('profile:geometry-applied', scheduleLabelCollisionPass);
  addEventListener('profile:atlas-lod-change', scheduleLabelCollisionPass);
  addEventListener('hashchange', applyLocalLabelPolicy);
  addEventListener('resize', scheduleLabelCollisionPass);

  document.addEventListener('change', event => {
    if (document.body?.dataset.graphMode !== 'atlas') return;
    if (!event.target.closest?.('#atlas-controls input')) return;
    freezeCameraForRerender();
    requestAnimationFrame(() => {
      decorateAtlasControls();
      scrubLateralHighlight();
    });
  }, true);

  document.addEventListener('click', event => {
    if (document.body?.dataset.graphMode !== 'atlas') return;

    const controlsPreset = event.target.closest?.('.atlas-structure-only,#atlas-show-all');
    if (controlsPreset) {
      freezeCameraForRerender();
      requestAnimationFrame(decorateAtlasControls);
      return;
    }

    const close = event.target.closest?.('#site-detail-panel .detail-close');
    if (close) {
      event.preventDefault();
      event.stopImmediatePropagation();
      clearAtlasSelection();
      return;
    }

    const node = event.target.closest?.('#site-graph .site-graph-node[data-node-id]');
    if (node && node.classList.contains('is-previewed')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      focusNode(node.dataset.nodeId);
      return;
    }

    const svg = event.target.closest?.('#site-graph .site-graph-svg');
    if (svg && !node) {
      if (performance.now() < suppressAtlasClickUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      clearAtlasSelection();
      return;
    }

    const cameraButton = event.target.closest?.('#atlas-fit,#atlas-zoom-in,#atlas-zoom-out');
    if (!cameraButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (cameraButton.id === 'atlas-fit') fit();
    else if (cameraButton.id === 'atlas-zoom-in') zoomCentre(1.28);
    else zoomCentre(1 / 1.28);
  }, true);

  document.addEventListener('wheel', event => {
    if (!desktop.matches || document.body?.dataset.graphMode !== 'atlas') return;
    if (!event.target.closest?.('#site-graph .site-graph-svg')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const delta = Math.max(-180, Math.min(180, event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY));
    zoomAt(event.clientX, event.clientY, Math.exp(-delta * 0.00235), false);
  }, { capture: true, passive: false });

  document.addEventListener('pointerdown', event => {
    if (!desktop.matches || document.body?.dataset.graphMode !== 'atlas' || event.button !== 0) return;
    const svg = event.target.closest?.('#site-graph .site-graph-svg');
    if (!svg) return;
    gesture = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    svg.setPointerCapture?.(event.pointerId);
    svg.classList.add('is-phase7-dragging');
    event.stopImmediatePropagation();
  }, true);
  document.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.pointerId || document.body?.dataset.graphMode !== 'atlas') return;
    const svg = graphSvg();
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const pixelDx = event.clientX - gesture.x;
    const pixelDy = event.clientY - gesture.y;
    if (Math.abs(pixelDx) + Math.abs(pixelDy) > 3) gesture.moved = true;
    const dx = pixelDx * atlasSize.width / Math.max(1, rect.width);
    const dy = pixelDy * atlasSize.height / Math.max(1, rect.height);
    gesture.x = event.clientX;
    gesture.y = event.clientY;
    setCamera({ x: camera.targetX + dx, y: camera.targetY + dy, scale: camera.targetScale }, { immediate: true });
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  const endGesture = event => {
    if (!gesture || (event.pointerId != null && event.pointerId !== gesture.pointerId)) return;
    if (gesture.moved) suppressAtlasClickUntil = performance.now() + 260;
    const svg = graphSvg();
    svg?.releasePointerCapture?.(gesture.pointerId);
    svg?.classList.remove('is-phase7-dragging');
    gesture = null;
  };
  document.addEventListener('pointerup', endGesture, true);
  document.addEventListener('pointercancel', endGesture, true);

  document.querySelectorAll('.atlas-button').forEach(decorateAtlasButton);
  decorateAtlasControls();

  window.ProfileAtlasLOD = Object.freeze({
    thresholds,
    applyLOD,
    fit,
    focusNode,
    zoomIn: () => zoomCentre(1.28),
    zoomOut: () => zoomCentre(1 / 1.28),
    setScale: (scale, { immediate = true } = {}) => {
      const bounds = cameraBounds(scale);
      return setCamera({ x: bounds.minX, y: bounds.minY, scale }, { immediate });
    },
    panTo: (x, y, { immediate = true } = {}) => setCamera({ x, y, scale: camera.targetScale }, { immediate }),
    applyLocalLabelPolicy,
    resolveLabelCollisions: resolveAtlasLabelCollisions,
    snapshot: () => ({
      lod: currentLOD,
      scale: camera.scale,
      camera: { x: camera.x, y: camera.y, scale: camera.scale },
      targetCamera: { x: camera.targetX, y: camera.targetY, scale: camera.targetScale },
      bounds: cameraBounds(camera.scale),
      visibleNodeCount,
      hiddenNodeCount,
      correctedLabelWrites,
      territoryLabels: document.querySelectorAll('.atlas-territory-label').length,
      selectedNodeId: document.querySelector('#site-graph .site-graph-node.is-previewed[data-node-id]')?.dataset.nodeId || null
    })
  });

  requestAnimationFrame(() => {
    applyLocalLabelPolicy();
    document.querySelectorAll('.atlas-button').forEach(decorateAtlasButton);
    decorateAtlasControls();
    if (document.body?.dataset.graphMode === 'atlas' && !document.querySelector('.profile-intro-overlay')) {
      updateAtlasHelp();
      observeCamera();
      syncCameraFromDOM();
      ensureTerritoryLayer();
      applyLOD(camera.scale);
      decorateInspector();
      scheduleLabelCollisionPass();
    }
  });
})();
