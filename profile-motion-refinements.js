(() => {
  if (window.ProfileMotionRefinements) return;

  const graph = window.SITE_DATA?.graph;
  if (!graph?.nodes?.length) return;

  const rootId = graph.rootId || 'stepan-chrast';
  const sectionIds = ['work', 'knowledge', 'experience', 'education', 'about'];
  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const HIERARCHY_TYPES = new Set(['hierarchy', 'hierarchy-alt', 'work-lattice']);

  let branchEdgeFrame = 0;
  let wasEmerging = false;
  let transitionFrame = 0;
  let generation = 0;
  let active = null;
  let lastResult = null;

  const clamp01 = value => Math.max(0, Math.min(1, value));
  const ease = value => {
    const t = clamp01(value);
    return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  const raf = () => new Promise(resolve => requestAnimationFrame(resolve));
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';
  const mode = () => document.body?.dataset.graphMode || 'overview';
  const route = () => normaliseRoute(document.body?.dataset.graphRoute || location.hash);

  /* ----------------------------------------------------------------------
     Profile Root copy / compact composition
     ---------------------------------------------------------------------- */

  const refineProfileRootCopy = () => {
    document.querySelectorAll('.profile-root-guide').forEach(node => node.remove());
    const summary = document.querySelector('.profile-root-summary');
    if (summary?.textContent) summary.textContent = summary.textContent.replace(/^\s*Junior\s+/i, '');
  };

  addEventListener('profile:profile-root-settled', refineProfileRootCopy);
  addEventListener('profile:root-overview-ready', refineProfileRootCopy);
  addEventListener('profile:scene-state', refineProfileRootCopy);
  addEventListener('hashchange', () => requestAnimationFrame(refineProfileRootCopy));

  /* ----------------------------------------------------------------------
     Profile Root emergence: nodes first, then the five relations
     ---------------------------------------------------------------------- */

  const mainBranchEdges = () => [...document.querySelectorAll(
    `#site-graph .site-graph-edges path[data-source="${CSS.escape(rootId)}"][data-target]`
  )].filter(path => sectionIds.includes(path.dataset.target));

  const markMainBranchEdges = () => {
    mainBranchEdges().forEach(path => { path.dataset.profileMainEdge = 'true'; });
  };

  const drawMainBranchEdges = () => {
    cancelAnimationFrame(branchEdgeFrame);
    branchEdgeFrame = 0;
    const paths = mainBranchEdges();
    if (!paths.length) {
      if (document.body) document.body.dataset.profileBranchEdgePhase = 'settled';
      return;
    }
    markMainBranchEdges();

    if (reducedMotion.matches) {
      if (document.body) document.body.dataset.profileBranchEdgePhase = 'settled';
      return;
    }

    const records = paths.map(path => ({
      path,
      pathLength: path.getAttribute('pathLength'),
      dasharray: path.style.strokeDasharray,
      dashoffset: path.style.strokeDashoffset,
      opacity: path.style.opacity
    }));
    records.forEach(({ path }) => {
      path.setAttribute('pathLength', '1');
      path.style.strokeDasharray = '.0001 1';
      path.style.strokeDashoffset = '0';
      path.style.opacity = '0';
    });
    if (document.body) document.body.dataset.profileBranchEdgePhase = 'drawing';

    const duration = 330;
    const stagger = 46;
    const total = duration + stagger * Math.max(0, records.length - 1);
    const started = performance.now();
    const step = now => {
      const elapsed = now - started;
      records.forEach((record, index) => {
        const raw = clamp01((elapsed - index * stagger) / duration);
        const p = ease(raw);
        record.path.style.strokeDasharray = `${Math.max(.0001, p).toFixed(4)} 1`;
        record.path.style.opacity = String(.78 * p);
      });
      if (elapsed < total) {
        branchEdgeFrame = requestAnimationFrame(step);
        return;
      }
      branchEdgeFrame = 0;
      records.forEach(record => {
        if (record.pathLength == null) record.path.removeAttribute('pathLength');
        else record.path.setAttribute('pathLength', record.pathLength);
        record.path.style.strokeDasharray = record.dasharray;
        record.path.style.strokeDashoffset = record.dashoffset;
        record.path.style.opacity = record.opacity;
      });
      if (document.body) document.body.dataset.profileBranchEdgePhase = 'settled';
      dispatchEvent(new CustomEvent('profile:profile-root-edges-settled'));
    };
    branchEdgeFrame = requestAnimationFrame(step);
  };

  const syncEmergencePhase = phase => {
    const emerging = phase === 'nodes' || document.body?.classList.contains('is-profile-root-emerging');
    if (emerging && phase !== 'settled' && phase !== 'cancelled') {
      wasEmerging = true;
      markMainBranchEdges();
      if (document.body) document.body.dataset.profileBranchEdgePhase = 'nodes';
      return;
    }
    if (!wasEmerging || phase === 'cancelled') {
      wasEmerging = false;
      return;
    }
    wasEmerging = false;
    // Atlas condensation announces its settled commit after restoring canonical
    // edge styles, so the relation draw begins without an intermediate flash.
    drawMainBranchEdges();
  };

  /* ----------------------------------------------------------------------
     Shared geometry helpers for hierarchical Profile -> Atlas
     ---------------------------------------------------------------------- */

  const liveNodes = () => [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
    .filter(element => !element.closest('.v9-transition-overlay,.profile-hierarchy-atlas-bridge'));
  const liveEdges = () => [...document.querySelectorAll('#site-graph .site-graph-edges path[data-source][data-target]')]
    .filter(element => !element.closest('.v9-transition-overlay,.profile-hierarchy-atlas-bridge'));

  const matrixOf = element => {
    const matrix = element?.getScreenCTM?.();
    if (!matrix) return null;
    return { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d, e: matrix.e, f: matrix.f };
  };
  const interpolateMatrix = (from, to, t) => ({
    a: from.a + (to.a - from.a) * t,
    b: from.b + (to.b - from.b) * t,
    c: from.c + (to.c - from.c) * t,
    d: from.d + (to.d - from.d) * t,
    e: from.e + (to.e - from.e) * t,
    f: from.f + (to.f - from.f) * t
  });
  const compactAt = (matrix, anchor, scale = .12) => ({
    a: matrix.a * scale,
    b: matrix.b * scale,
    c: matrix.c * scale,
    d: matrix.d * scale,
    e: anchor.e,
    f: anchor.f
  });
  const setMatrix = (element, matrix) => {
    if (!element || !matrix) return;
    element.setAttribute('transform', `matrix(${matrix.a.toFixed(5)} ${matrix.b.toFixed(5)} ${matrix.c.toFixed(5)} ${matrix.d.toFixed(5)} ${matrix.e.toFixed(2)} ${matrix.f.toFixed(2)})`);
  };

  const PRESENTATION = [
    'fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-width',
    'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'filter',
    'font-family', 'font-size', 'font-style', 'font-weight', 'letter-spacing',
    'paint-order', 'vector-effect', 'transform', 'transform-origin', 'transform-box', 'scale'
  ];
  const materialiseStyles = (source, clone, { root = false } = {}) => {
    if (!(source instanceof Element) || !(clone instanceof Element)) return;
    const style = getComputedStyle(source);
    PRESENTATION.forEach(property => {
      if (root && ['transform', 'transform-origin', 'transform-box', 'scale'].includes(property)) return;
      const value = style.getPropertyValue(property);
      if (value) clone.style.setProperty(property, value);
    });
    [...source.children].forEach((child, index) => {
      if (clone.children[index]) materialiseStyles(child, clone.children[index], { root: false });
    });
  };
  const cloneNode = source => {
    const clone = source.cloneNode(true);
    clone.removeAttribute('tabindex');
    clone.removeAttribute('role');
    clone.querySelectorAll('[tabindex]').forEach(element => element.removeAttribute('tabindex'));
    clone.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
    clone.querySelectorAll('[data-root-entry-portrait],[data-root-entry-action]').forEach(element => element.remove());
    clone.querySelectorAll('.v9-target-label').forEach(element => element.remove());
    clone.style.pointerEvents = 'none';
    materialiseStyles(source, clone, { root: true });
    clone.style.removeProperty('transform');
    clone.style.removeProperty('transform-origin');
    clone.style.removeProperty('transform-box');
    clone.style.removeProperty('scale');
    clone.style.removeProperty('opacity');
    clone.classList.remove('is-atlas-lod-hidden', 'is-muted-soft', 'is-filtered-work');
    return clone;
  };

  const capture = (wantedIds = null) => {
    const wanted = wantedIds ? new Set(wantedIds) : null;
    const nodes = new Map();
    liveNodes().forEach(source => {
      const id = source.dataset.nodeId;
      if (wanted && !wanted.has(id)) return;
      const matrix = matrixOf(source);
      if (!matrix) return;
      nodes.set(id, { id, matrix, clone: cloneNode(source) });
    });
    const ids = new Set(nodes.keys());
    const edges = liveEdges()
      .filter(edge => ids.has(edge.dataset.source) && ids.has(edge.dataset.target))
      .map(edge => ({
        source: edge.dataset.source,
        target: edge.dataset.target,
        type: edge.dataset.type || 'hierarchy'
      }));
    return { mode: mode(), route: route(), nodes, edges };
  };

  const modelEdges = idsValue => {
    const ids = new Set(idsValue);
    const result = [];
    graph.nodes.forEach(node => (node.parentIds || []).forEach((parentId, index) => {
      if (ids.has(parentId) && ids.has(node.id)) {
        result.push({ source: parentId, target: node.id, type: index ? 'hierarchy-alt' : 'hierarchy' });
      }
    }));
    (graph.edges || []).forEach(edge => {
      if (ids.has(edge.source) && ids.has(edge.target)) {
        result.push({ source: edge.source, target: edge.target, type: edge.type || 'relation' });
      }
    });
    const unique = new Map();
    result.forEach(edge => unique.set(`${edge.source}|${edge.target}|${edge.type}`, edge));
    return [...unique.values()];
  };

  const hierarchyFor = captureState => {
    const ids = new Set(captureState.nodes.keys());
    const allEdges = captureState.edges.length ? captureState.edges : modelEdges(ids);
    const candidates = allEdges.filter(edge => HIERARCHY_TYPES.has(edge.type) ||
      nodeMap.get(edge.target)?.parentIds?.includes(edge.source));

    // Undirected BFS gives a robust semantic depth even for temporary Work
    // lattice nodes which are not part of SITE_DATA.
    const neighbours = new Map([...ids].map(id => [id, []]));
    candidates.forEach(edge => {
      if (!neighbours.has(edge.source) || !neighbours.has(edge.target)) return;
      neighbours.get(edge.source).push(edge.target);
      neighbours.get(edge.target).push(edge.source);
    });
    const depth = new Map([[rootId, 0]]);
    const queue = ids.has(rootId) ? [rootId] : [];
    while (queue.length) {
      const id = queue.shift();
      const nextDepth = depth.get(id) + 1;
      (neighbours.get(id) || []).forEach(next => {
        if (depth.has(next)) return;
        depth.set(next, nextDepth);
        queue.push(next);
      });
    }

    const parent = new Map();
    [...ids].forEach(id => {
      if (id === rootId) return;
      const modelParent = (nodeMap.get(id)?.parentIds || []).find(candidate => ids.has(candidate));
      if (modelParent) {
        parent.set(id, modelParent);
        return;
      }
      const d = depth.get(id);
      const previous = (neighbours.get(id) || []).find(candidate => depth.get(candidate) === d - 1);
      parent.set(id, previous || (ids.has(rootId) ? rootId : null));
    });

    // Recompute depth from the selected primary parent so each node belongs to
    // exactly one bottom-up / top-down wave.
    const semanticDepth = new Map([[rootId, 0]]);
    const depthOf = id => {
      if (semanticDepth.has(id)) return semanticDepth.get(id);
      const seen = new Set([id]);
      let current = id;
      let d = 0;
      while (current !== rootId && parent.get(current) && !seen.has(parent.get(current))) {
        current = parent.get(current);
        seen.add(current);
        d += 1;
      }
      if (current !== rootId) d = Math.max(1, depth.get(id) || 1);
      semanticDepth.set(id, d);
      return d;
    };
    [...ids].forEach(depthOf);

    const hierarchyEdges = [...parent.entries()]
      .filter(([, parentId]) => parentId)
      .map(([target, source]) => ({ source, target, type: 'hierarchy', role: 'hierarchy' }));
    const hierarchyKeys = new Set(hierarchyEdges.map(edge => `${edge.source}|${edge.target}`));
    const crossEdges = allEdges
      .filter(edge => !hierarchyKeys.has(`${edge.source}|${edge.target}`) && !hierarchyKeys.has(`${edge.target}|${edge.source}`))
      .map(edge => ({ ...edge, role: 'cross' }));
    return {
      parent,
      depth: semanticDepth,
      maxDepth: Math.max(0, ...semanticDepth.values()),
      hierarchyEdges,
      crossEdges,
      edges: [...hierarchyEdges, ...crossEdges]
    };
  };

  const targetHierarchy = target => {
    const state = { ...target, edges: modelEdges(target.nodes.keys()) };
    return hierarchyFor(state);
  };

  const makeOverlay = (source, hierarchy) => {
    const overlay = document.createElementNS(SVG_NS, 'svg');
    overlay.classList.add('profile-hierarchy-atlas-bridge');
    overlay.setAttribute('viewBox', `0 0 ${Math.max(1, innerWidth)} ${Math.max(1, innerHeight)}`);
    overlay.setAttribute('preserveAspectRatio', 'none');
    overlay.setAttribute('aria-hidden', 'true');
    const edgeLayer = document.createElementNS(SVG_NS, 'g');
    const nodeLayer = document.createElementNS(SVG_NS, 'g');
    overlay.append(edgeLayer, nodeLayer);
    source.nodes.forEach(item => {
      item.clone.dataset.hierarchyNodeId = item.id;
      setMatrix(item.clone, item.matrix);
      nodeLayer.appendChild(item.clone);
    });
    hierarchy.edges.forEach(edge => {
      const path = document.createElementNS(SVG_NS, 'path');
      path.classList.add('profile-hierarchy-edge');
      path.dataset.source = edge.source;
      path.dataset.target = edge.target;
      path.dataset.edgeRole = edge.role;
      path.dataset.type = edge.type || edge.role;
      path.setAttribute('pathLength', '1');
      edgeLayer.appendChild(path);
    });
    document.body.appendChild(overlay);
    dispatchEvent(new CustomEvent('profile:motion-bridge-created', { detail: { overlay } }));
    return { overlay, edgeLayer, nodeLayer };
  };

  const edgePath = (from, to) => {
    if (!from || !to) return '';
    const dx = to.e - from.e;
    const dy = to.f - from.f;
    if (Math.hypot(dx, dy) < 6) return `M ${from.e.toFixed(2)} ${from.f.toFixed(2)} L ${to.e.toFixed(2)} ${to.f.toFixed(2)}`;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / distance;
    const ny = dx / distance;
    const bend = Math.min(25, Math.max(5, distance * .045));
    const cx = (from.e + to.e) / 2 + nx * bend;
    const cy = (from.f + to.f) / 2 + ny * bend;
    return `M ${from.e.toFixed(2)} ${from.f.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${to.e.toFixed(2)} ${to.f.toFixed(2)}`;
  };

  const paintOverlayEdges = (bridge, matrices, opacityById, hierarchy, { drawCross = 0, hierarchyProgress = null } = {}) => {
    bridge.edgeLayer.querySelectorAll('.profile-hierarchy-edge').forEach(path => {
      const from = matrices.get(path.dataset.source);
      const to = matrices.get(path.dataset.target);
      if (!from || !to) {
        path.style.opacity = '0';
        return;
      }
      path.setAttribute('d', edgePath(from, to));
      const endpointOpacity = Math.min(opacityById.get(path.dataset.source) ?? 1, opacityById.get(path.dataset.target) ?? 1);
      if (path.dataset.edgeRole === 'cross') {
        const p = clamp01(drawCross);
        path.style.strokeDasharray = `${Math.max(.0001, p).toFixed(4)} 1`;
        path.style.opacity = String(.48 * p * endpointOpacity);
        return;
      }
      const p = hierarchyProgress ? clamp01(hierarchyProgress(path)) : 1;
      path.style.strokeDasharray = `${Math.max(.0001, p).toFixed(4)} 1`;
      path.style.opacity = String(.66 * p * endpointOpacity);
    });
  };

  const animate = (duration, operation, painter) => new Promise(resolve => {
    if (reducedMotion.matches) {
      painter(1);
      resolve(true);
      return;
    }
    const started = performance.now();
    const step = now => {
      if (!active || operation !== generation) {
        transitionFrame = 0;
        resolve(false);
        return;
      }
      const raw = clamp01((now - started) / Math.max(1, duration));
      painter(raw);
      if (raw >= 1) {
        transitionFrame = 0;
        resolve(true);
        return;
      }
      transitionFrame = requestAnimationFrame(step);
    };
    transitionFrame = requestAnimationFrame(step);
  });

  const safeCenter = () => {
    const safe = window.ProfileCameraComposition?.safeFrame?.();
    return {
      e: Number.isFinite(safe?.centerX) ? safe.centerX : innerWidth / 2,
      f: Number.isFinite(safe?.centerY) ? safe.centerY : innerHeight / 2
    };
  };

  const phase = value => {
    if (!document.body) return;
    document.body.dataset.profileAtlasHierarchyPhase = value;
    // Keep the legacy coarse phase contract for observers which only distinguish
    // collapse from unfold.
    document.body.dataset.profileAtlasPhase = value.startsWith('collapse') || value === 'center-root'
      ? 'collapse'
      : 'unfold';
  };

  const collapseHierarchy = async (bridge, source, hierarchy, operation) => {
    const matrices = new Map([...source.nodes].map(([id, item]) => [id, { ...item.matrix }]));
    const opacity = new Map([...source.nodes.keys()].map(id => [id, 1]));

    for (let d = hierarchy.maxDepth; d >= 1; d -= 1) {
      const ids = [...source.nodes.keys()].filter(id => hierarchy.depth.get(id) === d && hierarchy.parent.get(id));
      if (!ids.length) continue;
      phase(`collapse-depth-${d}`);
      const starts = new Map(ids.map(id => [id, { ...matrices.get(id) }]));
      const parents = new Map(ids.map(id => [id, { ...matrices.get(hierarchy.parent.get(id)) }]));
      const duration = 330 + Math.min(90, Math.max(0, ids.length - 1) * 12);
      const completed = await animate(duration, operation, raw => {
        ids.forEach((id, index) => {
          const stagger = ids.length <= 1 ? 0 : Math.min(.15, index * .018);
          const local = clamp01((raw - stagger) / Math.max(.7, 1 - stagger));
          const p = ease(local);
          const start = starts.get(id);
          const parentMatrix = parents.get(id);
          const position = interpolateMatrix(start, { ...start, e: parentMatrix.e, f: parentMatrix.f }, p);
          const shrink = 1 - .88 * ease(clamp01((local - .68) / .32));
          const current = {
            ...position,
            a: start.a * shrink,
            b: start.b * shrink,
            c: start.c * shrink,
            d: start.d * shrink
          };
          matrices.set(id, current);
          opacity.set(id, 1 - ease(clamp01((local - .78) / .22)));
          const clone = bridge.nodeLayer.querySelector(`[data-hierarchy-node-id="${CSS.escape(id)}"]`);
          setMatrix(clone, current);
          if (clone) clone.style.opacity = String(opacity.get(id));
        });
        paintOverlayEdges(bridge, matrices, opacity, hierarchy, {
          drawCross: 0,
          hierarchyProgress: path => {
            const targetId = path.dataset.target;
            if (!ids.includes(targetId)) return opacity.get(targetId) > .01 ? 1 : 0;
            return opacity.get(targetId) > .01 ? 1 : 0;
          }
        });
      });
      if (!completed) return null;
      ids.forEach(id => {
        const parentMatrix = matrices.get(hierarchy.parent.get(id));
        matrices.set(id, compactAt(starts.get(id), parentMatrix, .12));
        opacity.set(id, 0);
      });
    }

    phase('root-only');
    [...source.nodes.keys()].forEach(id => {
      if (id === rootId) return;
      const clone = bridge.nodeLayer.querySelector(`[data-hierarchy-node-id="${CSS.escape(id)}"]`);
      if (clone) clone.style.opacity = '0';
      opacity.set(id, 0);
    });
    bridge.edgeLayer.querySelectorAll('.profile-hierarchy-edge').forEach(path => { path.style.opacity = '0'; });
    await wait(reducedMotion.matches ? 0 : 55);

    const rootMatrix = matrices.get(rootId);
    if (!rootMatrix) return null;
    const center = safeCenter();
    const centred = { ...rootMatrix, e: center.e, f: center.f };
    phase('center-root');
    const centredOk = await animate(360, operation, raw => {
      const current = interpolateMatrix(rootMatrix, centred, ease(raw));
      matrices.set(rootId, current);
      const clone = bridge.nodeLayer.querySelector(`[data-hierarchy-node-id="${CSS.escape(rootId)}"]`);
      setMatrix(clone, current);
      if (clone) clone.style.opacity = '1';
    });
    return centredOk ? centred : null;
  };

  const waitFor = (predicate, timeout = 5200) => new Promise(resolve => {
    const started = performance.now();
    const poll = () => {
      let value = false;
      try { value = Boolean(predicate()); } catch (_) {}
      if (value || performance.now() - started >= timeout) {
        resolve(value);
        return;
      }
      setTimeout(poll, 24);
    };
    poll();
  });

  const prepareAtlasTarget = async operation => {
    const ready = await waitFor(() =>
      operation === generation &&
      mode() === 'atlas' &&
      window.ProfileGeometry &&
      window.ProfileAtlasLOD &&
      liveNodes().length >= graph.nodes.length,
    5200);
    if (!ready || operation !== generation) return false;

    window.ProfileScene?.camera?.use?.('atlas');
    window.ProfileGeometry?.stabilize?.(720);
    window.ProfileGeometry?.apply?.();
    window.ProfileAtlasLOD?.setTopologyMode?.('entry-full', { reason: 'hierarchical-profile-atlas', apply: false });
    window.ProfileAtlasLOD?.fit?.({ immediate: true, purpose: 'entry', recompute: true });
    const scale = window.ProfileAtlasLOD?.snapshot?.().camera?.scale;
    if (Number.isFinite(scale)) window.ProfileAtlasLOD?.applyLOD?.(scale);
    await raf();
    await raf();
    return operation === generation && liveNodes().length >= graph.nodes.length;
  };

  const rebuildForAtlas = (bridge, target, hierarchy, centredRoot) => {
    bridge.nodeLayer.replaceChildren();
    bridge.edgeLayer.replaceChildren();
    const rootTarget = target.nodes.get(rootId)?.matrix;
    if (!rootTarget) return null;
    const rootStart = { ...rootTarget, e: centredRoot.e, f: centredRoot.f };
    const matrices = new Map([[rootId, rootStart]]);
    const opacity = new Map([[rootId, 1]]);

    target.nodes.forEach((item, id) => {
      const clone = item.clone;
      clone.dataset.hierarchyNodeId = id;
      if (id === rootId) {
        setMatrix(clone, rootStart);
        clone.style.opacity = '1';
      } else {
        const parentId = hierarchy.parent.get(id) || rootId;
        const parentTarget = target.nodes.get(parentId)?.matrix || rootStart;
        const initial = compactAt(item.matrix, parentTarget, .12);
        setMatrix(clone, initial);
        clone.style.opacity = '0';
        matrices.set(id, initial);
        opacity.set(id, 0);
      }
      bridge.nodeLayer.appendChild(clone);
    });
    hierarchy.edges.forEach(edge => {
      const path = document.createElementNS(SVG_NS, 'path');
      path.classList.add('profile-hierarchy-edge');
      path.dataset.source = edge.source;
      path.dataset.target = edge.target;
      path.dataset.edgeRole = edge.role;
      path.dataset.type = edge.type || edge.role;
      path.setAttribute('pathLength', '1');
      path.style.strokeDasharray = '.0001 1';
      path.style.opacity = '0';
      bridge.edgeLayer.appendChild(path);
    });
    return { rootStart, rootTarget, matrices, opacity };
  };

  const unfoldHierarchy = async (bridge, target, hierarchy, centredRoot, operation) => {
    const state = rebuildForAtlas(bridge, target, hierarchy, centredRoot);
    if (!state) return false;
    const { rootStart, rootTarget, matrices, opacity } = state;

    phase('unfold-root');
    const rootSettled = await animate(260, operation, raw => {
      const current = interpolateMatrix(rootStart, rootTarget, ease(raw));
      matrices.set(rootId, current);
      setMatrix(bridge.nodeLayer.querySelector(`[data-hierarchy-node-id="${CSS.escape(rootId)}"]`), current);
    });
    if (!rootSettled) return false;
    matrices.set(rootId, { ...rootTarget });

    for (let d = 1; d <= hierarchy.maxDepth; d += 1) {
      const ids = [...target.nodes.keys()].filter(id => hierarchy.depth.get(id) === d && hierarchy.parent.get(id));
      if (!ids.length) continue;
      phase(`unfold-depth-${d}`);
      const origins = new Map(ids.map(id => {
        const parentId = hierarchy.parent.get(id);
        return [id, { ...(matrices.get(parentId) || target.nodes.get(parentId)?.matrix || rootTarget) }];
      }));
      const duration = 360 + Math.min(100, Math.max(0, ids.length - 1) * 10);
      const completed = await animate(duration, operation, raw => {
        ids.forEach((id, index) => {
          const stagger = ids.length <= 1 ? 0 : Math.min(.14, index * .014);
          const local = clamp01((raw - stagger) / Math.max(.72, 1 - stagger));
          const p = ease(local);
          const item = target.nodes.get(id);
          const origin = origins.get(id);
          const targetMatrix = item.matrix;
          const originCompact = compactAt(targetMatrix, origin, .12);
          const current = interpolateMatrix(originCompact, targetMatrix, p);
          matrices.set(id, current);
          opacity.set(id, ease(clamp01(local / .48)));
          const clone = bridge.nodeLayer.querySelector(`[data-hierarchy-node-id="${CSS.escape(id)}"]`);
          setMatrix(clone, current);
          if (clone) clone.style.opacity = String(opacity.get(id));
        });
        paintOverlayEdges(bridge, matrices, opacity, hierarchy, {
          drawCross: 0,
          hierarchyProgress: path => {
            const targetId = path.dataset.target;
            if (!ids.includes(targetId)) return opacity.get(targetId) > .98 ? 1 : 0;
            const nodeOpacity = opacity.get(targetId) || 0;
            // Relation follows the emerging node rather than preceding it.
            return ease(clamp01((nodeOpacity - .22) / .78));
          }
        });
      });
      if (!completed) return false;
      ids.forEach(id => {
        matrices.set(id, { ...target.nodes.get(id).matrix });
        opacity.set(id, 1);
      });
    }

    phase('unfold-crosslinks');
    return animate(280, operation, raw => {
      paintOverlayEdges(bridge, matrices, opacity, hierarchy, {
        drawCross: ease(raw),
        hierarchyProgress: () => 1
      });
    });
  };

  const cleanup = (result = 'cancelled') => {
    cancelAnimationFrame(transitionFrame);
    transitionFrame = 0;
    active?.bridge?.overlay?.remove();
    active = null;
    window.ProfileMotionPolicy?.setForceSnap?.(false);
    document.body?.classList.remove('is-profile-hierarchy-atlas-transitioning', 'is-atlas-focus-transitioning', 'is-profile-atlas-transitioning');
    if (document.body) {
      delete document.body.dataset.profileAtlasHierarchyPhase;
      delete document.body.dataset.profileAtlasPhase;
    }
    lastResult = { result, at: performance.now() };
  };

  const transitionProfileToAtlas = async ({ history = false } = {}) => {
    if (active || mode() === 'atlas') return false;
    const source = capture();
    if (!source.nodes.has(rootId)) {
      if (!history) location.hash = '#atlas';
      return false;
    }
    const hierarchy = hierarchyFor(source);
    const operation = ++generation;
    const bridge = makeOverlay(source, hierarchy);
    active = { operation, sourceRoute: source.route, bridge };

    document.body?.classList.add('is-profile-hierarchy-atlas-transitioning', 'is-atlas-focus-transitioning', 'is-profile-atlas-transitioning');
    document.body.dataset.atlasFocusDirection = 'profile-to-atlas-hierarchical';
    window.ProfileRootOverview?.closeQuickOverview?.('route');
    document.querySelector('#site-detail-panel .detail-close')?.click?.();

    // Warm the Atlas runtime while the visible graph is already folding.
    const atlasReady = window.ProfileFeatureBootstrap?.ensureRoute?.('atlas') || Promise.resolve('atlas');
    const centredRoot = await collapseHierarchy(bridge, source, hierarchy, operation);
    if (!centredRoot || operation !== generation) {
      cleanup('collapse-interrupted');
      return false;
    }

    await atlasReady.catch(() => false);
    if (operation !== generation) return false;
    window.ProfileMotionPolicy?.setForceSnap?.(true);
    if (!history) {
      if (location.hash !== '#atlas') location.hash = '#atlas';
      else dispatchEvent(new HashChangeEvent('hashchange'));
    }

    const ready = await prepareAtlasTarget(operation);
    window.ProfileMotionPolicy?.setForceSnap?.(false);
    if (!ready || operation !== generation) {
      cleanup('atlas-target-unavailable');
      return false;
    }

    const target = capture(graph.nodes.map(node => node.id));
    const targetTree = targetHierarchy(target);
    const unfolded = await unfoldHierarchy(bridge, target, targetTree, centredRoot, operation);
    if (!unfolded || operation !== generation) {
      cleanup('unfold-interrupted');
      return false;
    }

    window.ProfileAtlasLOD?.setTopologyMode?.('entry-full', { reason: 'hierarchical-profile-atlas-complete' });
    phase('settled');
    bridge.overlay.classList.add('is-finishing');
    await wait(reducedMotion.matches ? 0 : 70);
    bridge.overlay.remove();
    document.body?.classList.remove('is-profile-hierarchy-atlas-transitioning', 'is-atlas-focus-transitioning', 'is-profile-atlas-transitioning');
    if (document.body) {
      delete document.body.dataset.profileAtlasHierarchyPhase;
      delete document.body.dataset.profileAtlasPhase;
      delete document.body.dataset.atlasFocusDirection;
    }
    active = null;
    lastResult = {
      result: 'completed',
      sourceRoute: source.route,
      targetRoute: 'atlas',
      sourceNodeCount: source.nodes.size,
      targetNodeCount: target.nodes.size,
      maxCollapseDepth: hierarchy.maxDepth,
      maxUnfoldDepth: targetTree.maxDepth,
      at: performance.now()
    };
    requestAnimationFrame(() => {
      window.ProfileNodeInteraction?.refresh?.();
      window.ProfileHaloRenderer?.refresh?.();
    });
    return true;
  };

  const atlasControl = target => {
    if (mode() === 'atlas') return null;
    return target?.closest?.('[data-route="atlas"], [data-route-target="atlas"], a[href="#atlas"]') || null;
  };

  const ownAtlasClick = event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!atlasControl(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    transitionProfileToAtlas();
  };
  const ownAtlasKeyboard = event => {
    if (event.defaultPrevented || !['Enter', ' '].includes(event.key)) return;
    if (!atlasControl(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    transitionProfileToAtlas();
  };

  // Register on window before lazy atlas-focus-unification.js exists. This is
  // the single owner of non-Atlas -> Atlas; the older module still owns the
  // opposite Atlas -> local Focus boundary.
  addEventListener('click', ownAtlasClick, true);
  addEventListener('keydown', ownAtlasKeyboard, true);

  addEventListener('profile:profile-root-emergence', event => syncEmergencePhase(event.detail?.phase));
  addEventListener('profile:graph-render-settled', () => {
    refineProfileRootCopy();
    if (document.body?.classList.contains('is-profile-root-emerging')) markMainBranchEdges();
  });
  const boot = () => {
    if (!document.body) return requestAnimationFrame(boot);
    wasEmerging = document.body.classList.contains('is-profile-root-emerging');
    syncEmergencePhase(wasEmerging ? 'nodes' : null);
    refineProfileRootCopy();
  };

  reducedMotion.addEventListener?.('change', () => {
    if (!reducedMotion.matches || !active) return;
    generation += 1;
    cleanup('reduced-motion-change');
    if (mode() !== 'atlas') location.hash = '#atlas';
  });

  window.ProfileMotionRefinements = Object.freeze({
    transitionToAtlas: transitionProfileToAtlas,
    refineProfileRootCopy,
    drawMainBranchEdges,
    snapshot: () => ({
      active: Boolean(active),
      phase: document.body?.dataset.profileAtlasHierarchyPhase || null,
      branchEdgePhase: document.body?.dataset.profileBranchEdgePhase || null,
      lastResult,
      reducedMotion: reducedMotion.matches
    })
  });

  boot();
})();
