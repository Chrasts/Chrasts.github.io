(() => {
  if (window.ProfileAtlasPolish) return;

  const graph = window.SITE_DATA?.graph;
  if (!graph?.nodes?.length) return;

  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const rootId = graph.rootId || 'stepan-chrast';
  const sections = new Set(['work', 'knowledge', 'experience', 'education', 'about']);
  const hierarchyTypes = new Set(['hierarchy', 'hierarchy-alt', 'work-lattice']);
  const semanticThresholds = Object.freeze({
    territory: 0.58,
    structure: 0.75,
    domain: 0.98,
    node: 1.38
  });
  const svgNS = 'http://www.w3.org/2000/svg';

  const typedEdges = (graph.edges || []).filter(edge => !hierarchyTypes.has(edge.type || ''));
  const evidenceEdges = (graph.edges || []).filter(edge => edge.type === 'evidence');
  const evidenceIds = new Set();
  evidenceEdges.forEach(edge => {
    evidenceIds.add(edge.source);
    evidenceIds.add(edge.target);
  });

  const depth = new Map([[rootId, 0]]);
  let changed = true;
  while (changed) {
    changed = false;
    graph.nodes.forEach(node => {
      if (node.id === rootId) return;
      const parents = (node.parentIds || []).map(id => depth.get(id)).filter(Number.isFinite);
      if (!parents.length) return;
      const next = Math.min(...parents) + 1;
      if (!depth.has(node.id) || next < depth.get(node.id)) {
        depth.set(node.id, next);
        changed = true;
      }
    });
  }

  let installed = false;
  let semanticLOD = null;
  let activeNodeId = null;
  let activeInput = null;
  let activeTerritory = null;
  let relatedIds = new Set();
  let localNodeId = null;
  let localIds = null;
  let labelSuppressedCount = 0;
  let projectMarkCount = 0;
  let evidenceMarkCount = 0;
  let observer = null;
  let detailObserver = null;
  let scheduled = 0;

  const graphRoot = () => document.querySelector('#site-graph');
  const liveNodes = () => [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
    .filter(element => !element.closest('.v9-transition-overlay'));
  const liveEdges = () => [...document.querySelectorAll('#site-graph .site-graph-edges path[data-source][data-target]')]
    .filter(element => !element.closest('.v9-transition-overlay'));
  const nodeElement = id => liveNodes().find(element => element.dataset.nodeId === id) || null;

  const primaryPath = node => {
    const result = [];
    const seen = new Set();
    let current = node;
    while (current && !seen.has(current.id)) {
      result.unshift(current);
      seen.add(current.id);
      current = current.parentIds?.[0] ? nodeMap.get(current.parentIds[0]) : null;
    }
    return result;
  };

  const semanticLODForScale = scale => {
    if (scale < semanticThresholds.territory) return 'territory';
    if (scale < semanticThresholds.structure) return 'structure';
    if (scale < semanticThresholds.domain) return 'domain';
    if (scale < semanticThresholds.node) return 'node';
    return 'evidence';
  };

  const currentScale = () => {
    const atlas = window.ProfileAtlasLOD?.snapshot?.();
    const scale = Number(atlas?.targetCamera?.scale ?? atlas?.camera?.scale ?? atlas?.scale);
    return Number.isFinite(scale) ? scale : 1;
  };

  const relationNeighbours = id => {
    const neighbours = new Set();
    typedEdges.forEach(edge => {
      if (edge.source === id) neighbours.add(edge.target);
      if (edge.target === id) neighbours.add(edge.source);
    });
    return neighbours;
  };

  const labelVisibleByLOD = (id, lod) => {
    const node = nodeMap.get(id);
    const d = depth.get(id) ?? 99;
    if (id === rootId || sections.has(id)) return true;
    if (localIds?.has(id)) return true;
    if (id === activeNodeId || relatedIds.has(id)) return true;
    if (lod === 'territory' || lod === 'structure') return d <= 1;
    if (lod === 'domain') return d <= 2;
    if (lod === 'node') return d <= 3 || node?.type === 'project';
    return true;
  };

  const ensureMarks = element => {
    const id = element.dataset.nodeId;
    const node = nodeMap.get(id);
    if (!node) return;
    const needsProject = node.type === 'project';
    const needsEvidence = evidenceIds.has(id);
    if (!needsProject && !needsEvidence) return;

    let marks = element.querySelector(':scope > .phase-i-node-marks');
    if (!marks) {
      marks = document.createElementNS(svgNS, 'g');
      marks.classList.add('phase-i-node-marks');
      marks.setAttribute('aria-hidden', 'true');
      marks.setAttribute('pointer-events', 'none');
      const dot = element.querySelector(':scope > .site-graph-dot');
      if (dot?.nextSibling) element.insertBefore(marks, dot.nextSibling);
      else element.appendChild(marks);
    }

    if (needsProject && !marks.querySelector('.phase-i-project-mark')) {
      const diamond = document.createElementNS(svgNS, 'path');
      diamond.classList.add('phase-i-project-mark');
      diamond.setAttribute('d', 'M -4 -13 L 0 -17 L 4 -13 L 0 -9 Z');
      marks.appendChild(diamond);
    }
    if (needsEvidence && !marks.querySelector('.phase-i-evidence-mark')) {
      const ring = document.createElementNS(svgNS, 'circle');
      ring.classList.add('phase-i-evidence-mark');
      ring.setAttribute('cx', '9');
      ring.setAttribute('cy', '-9');
      ring.setAttribute('r', '2.7');
      marks.appendChild(ring);
    }
  };

  const decorateNodes = () => {
    projectMarkCount = 0;
    evidenceMarkCount = 0;
    liveNodes().forEach(element => {
      const id = element.dataset.nodeId;
      const node = nodeMap.get(id);
      if (!node) return;
      element.dataset.phaseISemanticDepth = String(depth.get(id) ?? 99);
      element.dataset.phaseITerritory = window.ProfileGeometry?.sectionFor?.(id) || '';
      element.classList.toggle('is-phase-i-project', node.type === 'project');
      element.classList.toggle('is-phase-i-evidence', evidenceIds.has(id));
      ensureMarks(element);
      if (element.querySelector('.phase-i-project-mark')) projectMarkCount += 1;
      if (element.querySelector('.phase-i-evidence-mark')) evidenceMarkCount += 1;
    });
  };

  const applyLabelLOD = () => {
    if (document.body?.dataset.graphMode !== 'atlas') {
      document.body?.removeAttribute('data-atlas-semantic-lod');
      liveNodes().forEach(node => node.classList.remove('is-phase-i-label-suppressed'));
      labelSuppressedCount = 0;
      return false;
    }
    const next = semanticLODForScale(currentScale());
    const previous = semanticLOD;
    semanticLOD = next;
    document.body.dataset.atlasSemanticLod = next;
    let hidden = 0;
    liveNodes().forEach(node => {
      const suppress = !labelVisibleByLOD(node.dataset.nodeId, next);
      node.classList.toggle('is-phase-i-label-suppressed', suppress);
      if (suppress) hidden += 1;
    });
    labelSuppressedCount = hidden;
    if (previous !== next) {
      dispatchEvent(new CustomEvent('profile:atlas-semantic-lod-change', {
        detail: { lod: next, previous, scale: currentScale(), labelSuppressedCount }
      }));
    }
    return true;
  };

  const clearSemanticPreview = ({ keepSelection = true } = {}) => {
    activeNodeId = null;
    activeInput = null;
    activeTerritory = null;
    relatedIds = new Set();
    delete document.body?.dataset.atlasActiveTerritory;
    liveNodes().forEach(node => node.classList.remove(
      'is-phase-i-semantic-origin',
      'is-phase-i-related',
      'is-phase-i-territory-active',
      'is-phase-i-territory-muted'
    ));
    liveEdges().forEach(edge => {
      edge.classList.remove('is-phase-i-relation-active', 'is-phase-i-relation-muted');
      delete edge.dataset.phaseIRelation;
    });
    if (keepSelection && document.body?.dataset.graphMode === 'atlas') {
      const selected = document.querySelector('#site-graph .site-graph-node.is-previewed[data-node-id]');
      if (selected) applySemanticPreview(selected.dataset.nodeId, 'selection');
      else applyLabelLOD();
    } else applyLabelLOD();
  };

  const applySemanticPreview = (id, input = 'pointer') => {
    if (!nodeMap.has(id)) return false;
    activeNodeId = id;
    activeInput = input;
    activeTerritory = window.ProfileGeometry?.sectionFor?.(id) || null;
    relatedIds = relationNeighbours(id);
    if (document.body?.dataset.graphMode === 'atlas' && activeTerritory) {
      document.body.dataset.atlasActiveTerritory = activeTerritory;
    }

    liveNodes().forEach(node => {
      const nodeId = node.dataset.nodeId;
      const territory = window.ProfileGeometry?.sectionFor?.(nodeId) || null;
      const related = relatedIds.has(nodeId);
      const origin = nodeId === id;
      const sameTerritory = Boolean(activeTerritory && territory === activeTerritory);
      node.classList.toggle('is-phase-i-semantic-origin', origin);
      node.classList.toggle('is-phase-i-related', related);
      node.classList.toggle('is-phase-i-territory-active', document.body?.dataset.graphMode === 'atlas' && sameTerritory);
      node.classList.toggle('is-phase-i-territory-muted', document.body?.dataset.graphMode === 'atlas' && Boolean(activeTerritory) && !sameTerritory && !related);
    });

    liveEdges().forEach(edge => {
      const incident = typedEdges.some(model =>
        model.source === edge.dataset.source &&
        model.target === edge.dataset.target &&
        (model.source === id || model.target === id)
      );
      const typed = !hierarchyTypes.has(edge.dataset.type || '');
      edge.classList.toggle('is-phase-i-relation-active', incident);
      edge.classList.toggle('is-phase-i-relation-muted', typed && !incident && relatedIds.size > 0);
      if (incident) edge.dataset.phaseIRelation = edge.dataset.type || 'related';
      else delete edge.dataset.phaseIRelation;
    });
    applyLabelLOD();
    return true;
  };

  const buildLocalIds = id => {
    const result = new Set([id, rootId]);
    const node = nodeMap.get(id);
    if (!node) return result;
    primaryPath(node).forEach(item => result.add(item.id));
    graph.nodes.forEach(candidate => {
      if (candidate.parentIds?.includes(id)) result.add(candidate.id);
    });
    relationNeighbours(id).forEach(neighbour => result.add(neighbour));
    return result;
  };

  const applyLocalClasses = () => {
    const local = Boolean(localIds && localNodeId);
    let visible = 0;
    liveNodes().forEach(node => {
      const show = !local || localIds.has(node.dataset.nodeId);
      node.classList.toggle('is-phase-i-local-hidden', !show);
      node.classList.toggle('is-phase-i-local-member', local && show);
      if (show) visible += 1;
    });
    liveEdges().forEach(edge => {
      const show = !local || (localIds.has(edge.dataset.source) && localIds.has(edge.dataset.target));
      edge.classList.toggle('is-phase-i-local-hidden', !show);
    });
    if (local) {
      document.body.dataset.atlasSemanticScope = 'local';
      document.body.dataset.atlasSemanticOrigin = localNodeId;
    } else {
      delete document.body.dataset.atlasSemanticScope;
      delete document.body.dataset.atlasSemanticOrigin;
    }
    applyLabelLOD();
    return visible;
  };

  const setLocalZoom = id => {
    if (document.body?.dataset.graphMode !== 'atlas' || !nodeMap.has(id)) return false;
    localNodeId = id;
    localIds = buildLocalIds(id);
    applyLocalClasses();
    applySemanticPreview(id, 'local');
    window.ProfileAtlasLOD?.focusNode?.(id);
    decorateInspector();
    dispatchEvent(new CustomEvent('profile:atlas-local-semantic-zoom', {
      detail: { active: true, nodeId: id, visibleNodeCount: localIds.size }
    }));
    return true;
  };

  const clearLocalZoom = ({ fit = false } = {}) => {
    if (!localNodeId && !localIds) return false;
    const previous = localNodeId;
    localNodeId = null;
    localIds = null;
    applyLocalClasses();
    if (fit) window.ProfileAtlasLOD?.fit?.();
    decorateInspector();
    dispatchEvent(new CustomEvent('profile:atlas-local-semantic-zoom', {
      detail: { active: false, nodeId: previous }
    }));
    return true;
  };

  function decorateInspector() {
    const detail = document.querySelector('#site-detail-panel');
    if (!detail || detail.hidden || document.body?.dataset.graphMode !== 'atlas') return;
    const selected = document.querySelector('#site-graph .site-graph-node.is-previewed[data-node-id]');
    if (!selected) {
      detail.querySelector('.phase-i-neighborhood-toggle')?.remove();
      return;
    }
    let button = detail.querySelector('.phase-i-neighborhood-toggle');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'phase-i-neighborhood-toggle';
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const current = document.querySelector('#site-graph .site-graph-node.is-previewed[data-node-id]')?.dataset.nodeId;
        if (!current) return;
        if (localNodeId === current) clearLocalZoom({ fit: true });
        else setLocalZoom(current);
      });
      detail.appendChild(button);
    }
    const active = localNodeId === selected.dataset.nodeId;
    button.textContent = active ? 'Show full Atlas' : 'Focus neighborhood';
    button.setAttribute('aria-pressed', String(active));
    button.dataset.nodeId = selected.dataset.nodeId;
  }

  const cameraWithinBounds = () => {
    const snapshot = window.ProfileAtlasLOD?.snapshot?.();
    const camera = snapshot?.targetCamera || snapshot?.camera;
    const bounds = snapshot?.bounds;
    if (!camera || !bounds) return true;
    const epsilon = 1.5;
    return camera.x >= bounds.minX - epsilon && camera.x <= bounds.maxX + epsilon &&
      camera.y >= bounds.minY - epsilon && camera.y <= bounds.maxY + epsilon;
  };

  const refresh = () => {
    scheduled = 0;
    decorateNodes();
    applyLocalClasses();
    const selected = document.querySelector('#site-graph .site-graph-node.is-previewed[data-node-id]');
    if (!activeNodeId && selected) applySemanticPreview(selected.dataset.nodeId, 'selection');
    else applyLabelLOD();
    decorateInspector();
  };

  const scheduleRefresh = () => {
    if (scheduled) return;
    scheduled = requestAnimationFrame(() => requestAnimationFrame(refresh));
  };

  const bind = () => {
    const root = graphRoot();
    if (!root || !window.ProfileGeometry?.sectionFor || !window.ProfileAtlasLOD?.snapshot) return false;
    if (installed) return true;
    installed = true;
    document.body.dataset.phaseIAtlas = 'true';
    decorateNodes();
    refresh();

    root.addEventListener('pointerover', event => {
      const node = event.target.closest?.('.site-graph-node[data-node-id]');
      if (!node || node.closest('.v9-transition-overlay')) return;
      if (!['atlas', 'focus'].includes(document.body?.dataset.graphMode)) return;
      if (event.relatedTarget && node.contains(event.relatedTarget)) return;
      applySemanticPreview(node.dataset.nodeId, 'pointer');
    }, true);

    root.addEventListener('pointerout', event => {
      const node = event.target.closest?.('.site-graph-node[data-node-id]');
      if (!node || node.closest('.v9-transition-overlay')) return;
      if (event.relatedTarget && node.contains(event.relatedTarget)) return;
      if (activeInput === 'pointer' && activeNodeId === node.dataset.nodeId) clearSemanticPreview();
    }, true);

    root.addEventListener('focusin', event => {
      const node = event.target.closest?.('.site-graph-node[data-node-id]');
      if (node && ['atlas', 'focus'].includes(document.body?.dataset.graphMode)) {
        applySemanticPreview(node.dataset.nodeId, 'keyboard');
      }
    });
    root.addEventListener('focusout', event => {
      const node = event.target.closest?.('.site-graph-node[data-node-id]');
      if (node && activeInput === 'keyboard' && activeNodeId === node.dataset.nodeId) clearSemanticPreview();
    });

    document.addEventListener('click', event => {
      if (document.body?.dataset.graphMode !== 'atlas') return;
      if (event.target.closest?.('#atlas-fit,#atlas-reset')) clearLocalZoom();
      if (event.target.closest?.('#site-graph .site-graph-svg') && !event.target.closest?.('.site-graph-node[data-node-id]')) {
        clearLocalZoom();
        clearSemanticPreview({ keepSelection: false });
      }
      queueMicrotask(decorateInspector);
    }, true);

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && localNodeId && document.body?.dataset.graphMode === 'atlas') {
        event.preventDefault();
        event.stopImmediatePropagation();
        clearLocalZoom({ fit: true });
      }
    }, true);

    observer = new MutationObserver(mutations => {
      const modeChanged = mutations.some(mutation =>
        mutation.target === document.body &&
        mutation.type === 'attributes' &&
        ['data-graph-mode', 'data-graph-route'].includes(mutation.attributeName)
      );
      if (modeChanged && document.body?.dataset.graphMode !== 'atlas') {
        localNodeId = null;
        localIds = null;
        clearSemanticPreview({ keepSelection: false });
        applyLocalClasses();
      }
      scheduleRefresh();
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-graph-mode', 'data-graph-route', 'data-atlas-lod'],
      childList: false
    });
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class']
    });

    const detail = document.querySelector('#site-detail-panel');
    if (detail) {
      detailObserver = new MutationObserver(scheduleRefresh);
      detailObserver.observe(detail, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'class'] });
    }

    addEventListener('profile:atlas-lod-change', scheduleRefresh);
    addEventListener('profile:geometry-applied', scheduleRefresh);
    addEventListener('profile:transition-finish', scheduleRefresh);
    addEventListener('hashchange', scheduleRefresh);
    return true;
  };

  const boot = () => {
    if (bind()) return;
    requestAnimationFrame(boot);
  };

  const snapshot = () => ({
    installed,
    semanticLOD,
    scale: currentScale(),
    thresholds: { ...semanticThresholds },
    activeNodeId,
    activeInput,
    activeTerritory,
    relatedIds: [...relatedIds],
    relatedCount: relatedIds.size,
    localNodeId,
    localScope: Boolean(localNodeId && localIds),
    localVisibleNodeCount: localIds?.size || liveNodes().length,
    labelSuppressedCount,
    projectMarkCount,
    evidenceMarkCount,
    cameraWithinBounds: cameraWithinBounds()
  });

  window.ProfileAtlasPolish = Object.freeze({
    semanticThresholds,
    refresh: scheduleRefresh,
    preview: applySemanticPreview,
    clearPreview: clearSemanticPreview,
    focusNeighborhood: setLocalZoom,
    clearNeighborhood: clearLocalZoom,
    snapshot
  });

  boot();
})();
