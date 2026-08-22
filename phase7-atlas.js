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

  /* --------------------------------------------------------------------
     Canonical local-label guardian
     -------------------------------------------------------------------- */
  let labelGuard = false;
  let correctedLabelWrites = 0;

  const liveNodeElements = () => [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
    .filter(element => !element.closest('.v9-transition-overlay'));

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
      liveNodeElements().forEach(node => {
        const id = node.dataset.nodeId;
        const label = node.querySelector('.site-graph-label');
        const meta = node.querySelector('.site-graph-meta');
        if (!label) return;

        if (ancestorIds.has(id)) {
          changed += Number(setTextPose(label, 'start', 17, 4));
          changed += Number(setTextPose(meta, 'start', 17, 20));
          node.dataset.localLabelRole = 'ancestor';
          return;
        }

        node.dataset.localLabelRole = id === target.id ? 'target' : 'branch';
      });
    } finally {
      labelGuard = false;
    }
    correctedLabelWrites += changed;
    return Boolean(changed);
  };

  const graphRoot = document.querySelector('#site-graph');
  if (graphRoot) {
    new MutationObserver(mutations => {
      if (labelGuard || document.body?.dataset.graphMode !== 'focus') return;
      if (!mutations.some(mutation =>
        mutation.type === 'childList' ||
        (mutation.type === 'attributes' && ['x', 'y', 'text-anchor'].includes(mutation.attributeName))
      )) return;
      // MutationObserver callbacks run before paint, so a late renderer write is
      // corrected before an intermediate label pose can become visible.
      applyLocalLabelPolicy();
    }).observe(graphRoot, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['x', 'y', 'text-anchor']
    });
  }

  if (document.body) {
    new MutationObserver(() => applyLocalLabelPolicy()).observe(document.body, {
      attributes: true,
      attributeFilter: ['data-graph-mode', 'data-graph-route', 'class']
    });
  }
  addEventListener('hashchange', applyLocalLabelPolicy);
  addEventListener('load', () => requestAnimationFrame(applyLocalLabelPolicy), { once: true });

  /* --------------------------------------------------------------------
     Atlas depth model
     -------------------------------------------------------------------- */
  const depth = new Map([[rootId, 0]]);
  let changed = true;
  while (changed) {
    changed = false;
    graph.nodes.forEach(node => {
      if (node.id === rootId) return;
      const parentDepths = (node.parentIds || []).map(id => depth.get(id)).filter(Number.isFinite);
      if (!parentDepths.length) return;
      const next = Math.min(...parentDepths) + 1;
      if (!depth.has(node.id) || next < depth.get(node.id)) {
        depth.set(node.id, next);
        changed = true;
      }
    });
  }

  const territoryCount = Object.fromEntries(sections.map(section => [
    section,
    graph.nodes.filter(node => geometry.sectionFor(node.id) === section).length
  ]));

  const liveAtlasNodes = () => [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
    .filter(element => !element.closest('.v9-transition-overlay'));
  const liveAtlasEdges = () => [...document.querySelectorAll('#site-graph .site-graph-edges path[data-source][data-target]')]
    .filter(element => !element.closest('.v9-transition-overlay'));

  const lodForScale = scale => scale < thresholds.far
    ? 'far'
    : scale < thresholds.medium
      ? 'medium'
      : scale < thresholds.detail
        ? 'near'
        : 'detail';

  const preservedSelectionIds = () => {
    const result = new Set([rootId]);
    const selected = document.querySelector(
      '#site-graph .site-graph-node.is-atlas-origin[data-node-id], #site-graph .site-graph-node.is-previewed[data-node-id]'
    );
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
    const svg = document.querySelector('#site-graph .site-graph-svg');
    if (!svg) return null;
    const edges = svg.querySelector(':scope > g > .site-graph-edges');
    const camera = edges?.parentElement || svg.firstElementChild;
    if (!camera) return null;

    let layer = camera.querySelector(':scope > .atlas-territory-label-layer');
    if (!layer) {
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
        title.setAttribute('y', '0');
        title.textContent = nodeMap.get(section)?.label || section;
        const count = document.createElementNS(svgNS, 'text');
        count.classList.add('atlas-territory-count');
        count.setAttribute('text-anchor', 'middle');
        count.setAttribute('y', '17');
        count.textContent = `${territoryCount[section]} nodes`;
        group.append(title, count);
        layer.appendChild(group);
      });
    }
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

    liveAtlasNodes().forEach(node => {
      const id = node.dataset.nodeId;
      const show = visibleAtLOD(id, lod, preserved);
      visibility.set(id, show);
      node.classList.toggle('is-atlas-lod-hidden', !show);
      node.classList.toggle('is-atlas-territory-node', sections.includes(id));
      node.dataset.atlasDepth = String(depth.get(id) ?? 99);
      node.dataset.atlasTerritory = geometry.sectionFor(id) || '';
    });

    liveAtlasEdges().forEach(edge => {
      const hierarchy = ['hierarchy', 'hierarchy-alt', 'work-lattice'].includes(edge.dataset.type || '');
      const endpointsVisible = visibility.get(edge.dataset.source) !== false && visibility.get(edge.dataset.target) !== false;
      let show = endpointsVisible;
      if (!hierarchy) {
        if (lod === 'far' || lod === 'medium') show = false;
        else if (lod === 'near') show = show && edge.classList.contains('is-lateral');
      }
      if (edge.classList.contains('is-secondary') && lod !== 'detail') show = false;
      edge.classList.toggle('is-atlas-lod-hidden', !show);
    });

    visibleNodeCount = [...visibility.values()].filter(Boolean).length;
    hiddenNodeCount = visibility.size - visibleNodeCount;
    const previous = currentLOD;
    currentLOD = lod;
    document.body.dataset.atlasLod = lod;
    syncTerritoryLabels(currentScale);

    if (previous !== lod) {
      dispatchEvent(new CustomEvent('profile:atlas-lod-change', {
        detail: { lod, previous, scale: currentScale, visibleNodeCount, hiddenNodeCount }
      }));
    }
    return true;
  };

  /* --------------------------------------------------------------------
     Stable desktop Atlas camera
     -------------------------------------------------------------------- */
  const atlasSize = geometry.snapshot().atlasSize || { width: 2520, height: 1580 };
  const camera = { x: 0, y: 0, scale: 1, targetX: 0, targetY: 0, targetScale: 1, frame: 0 };
  let gesture = null;
  let suppressAtlasClickUntil = 0;
  let cameraWriting = false;
  let lastWrittenTransform = '';

  const cameraElement = () => {
    const svg = document.querySelector('#site-graph .site-graph-svg');
    const edges = svg?.querySelector(':scope > g > .site-graph-edges');
    return edges?.parentElement || svg?.firstElementChild || null;
  };
  const graphSvg = () => document.querySelector('#site-graph .site-graph-svg');

  const cameraBounds = (scale = camera.targetScale) => {
    const width = atlasSize.width;
    const height = atlasSize.height;
    const margin = 82;
    if (scale <= 1) {
      const x = (width - width * scale) / 2;
      const y = (height - height * scale) / 2;
      return { minX: x, maxX: x, minY: y, maxY: y };
    }
    return {
      minX: width - margin - width * scale,
      maxX: margin,
      minY: height - margin - height * scale,
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

  if (document.body) {
    new MutationObserver(() => {
      if (document.body.dataset.graphMode === 'atlas') {
        requestAnimationFrame(() => {
          syncCameraFromDOM();
          ensureTerritoryLayer();
          applyLOD(camera.scale);
        });
      } else {
        delete document.body.dataset.atlasLod;
      }
    }).observe(document.body, { attributes: true, attributeFilter: ['data-graph-mode', 'data-graph-route'] });
  }

  const cameraObserver = new MutationObserver(() => {
    if (cameraWriting || !desktop.matches || document.body?.dataset.graphMode !== 'atlas') return;
    const current = cameraElement()?.getAttribute('transform') || '';
    if (current === lastWrittenTransform) return;
    syncCameraFromDOM();
  });
  const observeCamera = () => {
    const element = cameraElement();
    if (element) cameraObserver.observe(element, { attributes: true, attributeFilter: ['transform'] });
  };
  if (graphRoot) new MutationObserver(() => requestAnimationFrame(observeCamera)).observe(graphRoot, { childList: true, subtree: true });
  requestAnimationFrame(observeCamera);

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
    if (!event.target.closest?.('#site-graph .site-graph-svg')) return;
    gesture = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    graphSvg()?.classList.add('is-phase7-dragging');
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
    gesture = null;
    graphSvg()?.classList.remove('is-phase7-dragging');
  };
  document.addEventListener('pointerup', endGesture, true);
  document.addEventListener('pointercancel', endGesture, true);

  document.addEventListener('click', event => {
    if (document.body?.dataset.graphMode !== 'atlas') return;
    if (performance.now() < suppressAtlasClickUntil && event.target.closest?.('#site-graph .site-graph-svg')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const button = event.target.closest?.('#atlas-fit,#atlas-reset,#atlas-zoom-in,#atlas-zoom-out');
    if (!button) return;
    // Reset remains owned by site-graph because it also clears its private pinned
    // selection. We only resynchronise Phase 7 with the resulting camera.
    if (button.id === 'atlas-reset') {
      requestAnimationFrame(() => requestAnimationFrame(syncCameraFromDOM));
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (button.id === 'atlas-fit') fit();
    else if (button.id === 'atlas-zoom-in') zoomCentre(1.28);
    else if (button.id === 'atlas-zoom-out') zoomCentre(1 / 1.28);
  }, true);

  /* --------------------------------------------------------------------
     Atlas entry affordance
     -------------------------------------------------------------------- */
  const decorateAtlasButton = button => {
    if (!button || button.dataset.phase7Decorated === 'true') return;
    button.dataset.phase7Decorated = 'true';
    button.classList.add('atlas-entry-v7');
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
    ].forEach(([x1,y1,x2,y2], index) => {
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1);
      line.setAttribute('x2', x2); line.setAttribute('y2', y2);
      line.dataset.index = String(index);
      edges.appendChild(line);
    });
    glyph.appendChild(edges);

    const nodes = document.createElementNS(svgNS, 'g');
    nodes.classList.add('atlas-entry-glyph-nodes');
    [[44,26,4.2],[13,10,2.5],[75,11,2.3],[14,40,2.4],[74,41,2.7],[61,25,2.2],[30,17,1.8],[32,34,1.9]].forEach(([cx,cy,r], index) => {
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', cx); circle.setAttribute('cy', cy); circle.setAttribute('r', r);
      circle.dataset.index = String(index);
      nodes.appendChild(circle);
    });
    glyph.appendChild(nodes);

    const copy = document.createElement('span');
    copy.className = 'atlas-entry-copy';
    const title = document.createElement('strong');
    title.textContent = 'Atlas';
    const note = document.createElement('small');
    note.textContent = 'Full semantic map';
    copy.append(title, note);
    button.append(glyph, copy);
  };

  document.querySelectorAll('.atlas-button').forEach(decorateAtlasButton);
  new MutationObserver(mutations => mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
    if (!(node instanceof Element)) return;
    if (node.matches?.('.atlas-button')) decorateAtlasButton(node);
    node.querySelectorAll?.('.atlas-button').forEach(decorateAtlasButton);
  }))).observe(document.body, { childList: true, subtree: true });

  window.ProfileAtlasLOD = Object.freeze({
    thresholds,
    applyLOD,
    fit,
    zoomIn: () => zoomCentre(1.28),
    zoomOut: () => zoomCentre(1 / 1.28),
    setScale: (scale, { immediate = true } = {}) => {
      const bounds = cameraBounds(scale);
      return setCamera({ x: bounds.minX, y: bounds.minY, scale }, { immediate });
    },
    panTo: (x, y, { immediate = true } = {}) => setCamera({ x, y, scale: camera.targetScale }, { immediate }),
    applyLocalLabelPolicy,
    snapshot: () => ({
      lod: currentLOD,
      scale: camera.scale,
      camera: { x: camera.x, y: camera.y, scale: camera.scale },
      targetCamera: { x: camera.targetX, y: camera.targetY, scale: camera.targetScale },
      bounds: cameraBounds(camera.scale),
      visibleNodeCount,
      hiddenNodeCount,
      correctedLabelWrites,
      territoryLabels: document.querySelectorAll('.atlas-territory-label').length
    })
  });

  requestAnimationFrame(() => {
    applyLocalLabelPolicy();
    decorateAtlasButton(document.querySelector('.atlas-button'));
    if (document.body?.dataset.graphMode === 'atlas' && !document.querySelector('.profile-intro-overlay')) {
      syncCameraFromDOM();
      ensureTerritoryLayer();
      applyLOD(camera.scale);
    }
  });
})();
