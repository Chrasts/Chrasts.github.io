(() => {
  if (window.ProfileAtlasFocus) return;

  const graph = window.SITE_DATA?.graph;
  if (!graph?.nodes?.length) return;

  const scene = () => window.ProfileScene || null;
  const rootId = graph.rootId || 'stepan-chrast';
  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const svgNS = 'http://www.w3.org/2000/svg';
  const MAX_FOCUS_BRIDGE_NODES = 14;
  const FOCUS_DURATION = 680;
  const COLLAPSE_DURATION = 690;
  const ATLAS_UNFOLD_DURATION = 1280;

  let generation = 0;
  let active = null;
  let frame = 0;
  let copyFrame = 0;
  let lastResult = null;

  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';
  const mode = () => document.body?.dataset.graphMode || 'overview';
  const route = () => normaliseRoute(document.body?.dataset.graphRoute || location.hash);
  const hashRoute = () => normaliseRoute(location.hash);
  const clamp01 = value => Math.max(0, Math.min(1, value));
  const ease = value => {
    const t = clamp01(value);
    return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const raf = () => new Promise(resolve => requestAnimationFrame(resolve));
  const waitFor = (predicate, timeout = 4200) => new Promise(resolve => {
    const started = performance.now();
    const poll = () => {
      let value = false;
      try { value = Boolean(predicate()); } catch (_) {}
      if (value || performance.now() - started >= timeout) return resolve(value);
      setTimeout(poll, 22);
    };
    poll();
  });
  const stableNumber = value => {
    let number = 2166136261;
    for (const character of String(value)) number = Math.imul(number ^ character.charCodeAt(0), 16777619);
    return number >>> 0;
  };

  const routeForNode = node => {
    if (!node) return null;
    if (node.id === rootId) return 'overview';
    if (node.id === 'work') return 'work';
    return node.route ? normaliseRoute(node.route) : null;
  };
  const nodeForRoute = value => {
    const target = normaliseRoute(value);
    if (target === 'overview') return nodeMap.get(rootId) || null;
    if (target === 'work' || target.startsWith('work/')) return nodeMap.get('work') || null;
    return graph.nodes.find(node => normaliseRoute(node.route) === target) || null;
  };
  const isFocusRoute = value => {
    const target = normaliseRoute(value);
    if (['overview', 'atlas', 'work'].includes(target) || target.startsWith('work/')) return false;
    return Boolean(nodeForRoute(target));
  };
  const currentAnchorId = () => {
    const currentMode = mode();
    if (currentMode === 'overview') return rootId;
    if (currentMode === 'work') return 'work';
    return nodeForRoute(route())?.id || rootId;
  };

  const liveNodes = () => [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
    .filter(element => !element.closest('.v9-transition-overlay'));
  const liveNode = id => liveNodes().find(element => element.dataset.nodeId === id) || null;
  const liveEdges = () => [...document.querySelectorAll('#site-graph .site-graph-edges path[data-source][data-target]')]
    .filter(element => !element.closest('.v9-transition-overlay'));
  const selectedAtlasNode = () => document.querySelector('#site-graph .site-graph-node.is-previewed[data-node-id]');

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
  const childrenFor = id => graph.nodes.filter(node => node.parentIds?.includes(id));
  const typedNeighbours = id => {
    const result = [];
    (graph.edges || []).forEach(edge => {
      if (edge.source === id) result.push(nodeMap.get(edge.target));
      if (edge.target === id) result.push(nodeMap.get(edge.source));
    });
    return result.filter(Boolean);
  };
  const semanticSubset = anchorId => {
    const anchor = nodeMap.get(anchorId);
    if (!anchor) return [anchorId];
    const ids = [];
    const add = id => {
      if (!id || ids.includes(id) || ids.length >= MAX_FOCUS_BRIDGE_NODES) return;
      ids.push(id);
    };
    add(anchorId);
    [...primaryPath(anchor)].reverse().forEach(node => add(node.id));
    childrenFor(anchorId).forEach(node => add(node.id));
    typedNeighbours(anchorId).forEach(node => add(node.id));
    childrenFor(anchorId).slice(0, 4).forEach(child => childrenFor(child.id).slice(0, 1).forEach(node => add(node.id)));
    return ids;
  };

  const depth = new Map([[rootId, 0]]);
  let depthChanged = true;
  while (depthChanged) {
    depthChanged = false;
    graph.nodes.forEach(node => {
      if (node.id === rootId) return;
      const parents = (node.parentIds || []).map(id => depth.get(id)).filter(Number.isFinite);
      if (!parents.length) return;
      const next = Math.min(...parents) + 1;
      if (!depth.has(node.id) || next < depth.get(node.id)) {
        depth.set(node.id, next);
        depthChanged = true;
      }
    });
  }

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
  const compactMatrix = (matrix, anchor, scale = .14) => ({
    a: matrix.a * scale,
    b: matrix.b * scale,
    c: matrix.c * scale,
    d: matrix.d * scale,
    e: anchor.e,
    f: anchor.f
  });
  const setMatrix = (element, matrix) => {
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
    [...source.children].forEach((child, index) => materialiseStyles(child, clone.children[index], { root: false }));
  };
  const cloneNode = source => {
    const clone = source.cloneNode(true);
    clone.removeAttribute('tabindex');
    clone.removeAttribute('role');
    clone.querySelectorAll('[tabindex]').forEach(element => element.removeAttribute('tabindex'));
    clone.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
    clone.style.pointerEvents = 'none';
    materialiseStyles(source, clone, { root: true });
    clone.style.removeProperty('transform');
    clone.style.removeProperty('transform-origin');
    clone.style.removeProperty('transform-box');
    clone.style.removeProperty('scale');
    clone.style.removeProperty('opacity');
    clone.classList.remove('is-atlas-lod-hidden', 'is-muted-soft', 'is-filtered-work');
    clone.querySelectorAll('.v9-target-label').forEach(element => element.remove());
    return clone;
  };

  const capture = ids => {
    const wanted = ids ? new Set(ids) : null;
    const nodes = new Map();
    liveNodes().forEach(source => {
      const id = source.dataset.nodeId;
      if (wanted && !wanted.has(id)) return;
      const matrix = matrixOf(source);
      if (!matrix) return;
      nodes.set(id, { id, matrix, clone: cloneNode(source) });
    });
    return { mode: mode(), route: route(), nodes };
  };

  const modelEdges = ids => {
    const set = new Set(ids);
    const result = [];
    graph.nodes.forEach(node => (node.parentIds || []).forEach((parentId, index) => {
      if (!set.has(parentId) || !set.has(node.id)) return;
      result.push({ source: parentId, target: node.id, type: index ? 'hierarchy-alt' : 'hierarchy' });
    }));
    (graph.edges || []).forEach(edge => {
      if (!set.has(edge.source) || !set.has(edge.target)) return;
      result.push({ source: edge.source, target: edge.target, type: edge.type || 'relation' });
    });
    const unique = new Map();
    result.forEach(edge => unique.set(`${edge.source}|${edge.target}|${edge.type}`, edge));
    return [...unique.values()];
  };
  const renderedEdges = ids => {
    const set = new Set(ids);
    const result = liveEdges()
      .filter(edge => set.has(edge.dataset.source) && set.has(edge.dataset.target))
      .map(edge => ({ source: edge.dataset.source, target: edge.dataset.target, type: edge.dataset.type || 'hierarchy' }));
    return result.length ? result : modelEdges(ids);
  };

  const makeOverlay = ({ source, direction, edges = renderedEdges([...source.nodes.keys()]) }) => {
    const overlay = document.createElementNS(svgNS, 'svg');
    overlay.classList.add('atlas-focus-bridge');
    if (direction === 'profile-to-atlas') overlay.classList.add('profile-atlas-unfold-bridge');
    overlay.dataset.direction = direction;
    overlay.setAttribute('viewBox', `0 0 ${Math.max(1, innerWidth)} ${Math.max(1, innerHeight)}`);
    overlay.setAttribute('preserveAspectRatio', 'none');
    overlay.setAttribute('aria-hidden', 'true');
    const edgeLayer = document.createElementNS(svgNS, 'g');
    edgeLayer.classList.add('atlas-focus-bridge-edges');
    const nodeLayer = document.createElementNS(svgNS, 'g');
    nodeLayer.classList.add('atlas-focus-bridge-nodes');
    overlay.append(edgeLayer, nodeLayer);
    source.nodes.forEach(item => {
      item.clone.dataset.bridgeNodeId = item.id;
      setMatrix(item.clone, item.matrix);
      nodeLayer.appendChild(item.clone);
    });
    edges.forEach(edge => {
      const path = document.createElementNS(svgNS, 'path');
      path.dataset.source = edge.source;
      path.dataset.target = edge.target;
      path.dataset.type = edge.type;
      path.classList.add('atlas-focus-bridge-edge');
      path.setAttribute('pathLength', '1');
      edgeLayer.appendChild(path);
    });
    document.body.appendChild(overlay);
    return { overlay, edges: edgeLayer, nodes: nodeLayer };
  };

  const edgePath = (from, to) => {
    const dx = to.e - from.e;
    const dy = to.f - from.f;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / distance;
    const ny = dx / distance;
    const bend = Math.min(28, Math.max(7, distance * .055));
    const cx = (from.e + to.e) / 2 + nx * bend;
    const cy = (from.f + to.f) / 2 + ny * bend;
    return `M ${from.e.toFixed(2)} ${from.f.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${to.e.toFixed(2)} ${to.f.toFixed(2)}`;
  };
  const paintEdges = (edgeLayer, matrices, progressForEdge) => {
    edgeLayer.querySelectorAll('.atlas-focus-bridge-edge').forEach(path => {
      const from = matrices.get(path.dataset.source);
      const to = matrices.get(path.dataset.target);
      if (!from || !to) {
        path.style.opacity = '0';
        return;
      }
      path.setAttribute('d', edgePath(from, to));
      const p = clamp01(progressForEdge(path));
      path.style.strokeDasharray = `${Math.max(.0001, p).toFixed(4)} 1`;
      path.style.strokeDashoffset = '0';
      path.style.opacity = String(p * .72);
    });
  };

  const safeCenter = () => {
    const safe = window.ProfileCameraComposition?.safeFrame?.();
    return {
      e: Number.isFinite(safe?.centerX) ? safe.centerX : innerWidth / 2,
      f: Number.isFinite(safe?.centerY) ? safe.centerY : innerHeight / 2
    };
  };
  const centredRootMatrix = sourceRoot => {
    const center = safeCenter();
    return { ...sourceRoot, e: center.e, f: center.f };
  };

  const setRoute = targetRoute => {
    const next = `#${normaliseRoute(targetRoute)}`;
    if (location.hash !== next) location.hash = next;
    else dispatchEvent(new HashChangeEvent('hashchange'));
  };

  const tuneProfileRootGeometry = () => {
    const geometry = window.ProfileGeometry;
    const root = geometry?.overviewPoint?.(rootId);
    const work = geometry?.overviewPoint?.('work');
    if (!root || !work) return false;
    const desired = matchMedia('(max-width: 900px)').matches ? 210 : 270;
    const dx = work.x - root.x;
    const dy = work.y - root.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    if (Math.abs(distance - desired) < .5) return true;
    work.x = root.x + dx / distance * desired;
    work.y = root.y + dy / distance * desired;
    work.__profileRootRadiusV2 = desired;
    if (mode() === 'overview') geometry.apply?.();
    return true;
  };

  const prepareAtlasTarget = async expectedGeneration => {
    const ready = await waitFor(() =>
      expectedGeneration === generation &&
      mode() === 'atlas' &&
      window.ProfileGeometry &&
      window.ProfileAtlasLOD &&
      liveNodes().length >= graph.nodes.length,
    4600);
    if (!ready || expectedGeneration !== generation) return false;

    scene()?.camera?.use?.('atlas');
    window.ProfileGeometry?.stabilize?.(720);
    window.ProfileGeometry?.apply?.();
    window.ProfileAtlasLOD?.setTopologyMode?.('entry-full', { reason: 'profile-atlas-unfold', apply: false });
    window.ProfileAtlasLOD?.fit?.({ immediate: true, purpose: 'entry', recompute: true });
    const scale = window.ProfileAtlasLOD?.snapshot?.().camera?.scale;
    if (Number.isFinite(scale)) window.ProfileAtlasLOD?.applyLOD?.(scale);
    await raf();
    await raf();
    return expectedGeneration === generation && liveNodes().length >= graph.nodes.length;
  };

  const prepareFocusTarget = async ({ targetRoute, anchorId, expectedGeneration }) => {
    const ready = await waitFor(() =>
      expectedGeneration === generation &&
      mode() === 'focus' &&
      route() === normaliseRoute(targetRoute) &&
      Boolean(liveNode(anchorId)),
    4400);
    if (!ready || expectedGeneration !== generation) return false;
    if (matchMedia('(min-width: 901px)').matches) scene()?.camera?.use?.('desktop-local');
    window.ProfileGeometry?.stabilize?.(700);
    window.ProfileGeometry?.apply?.();
    window.ProfileAtlasLOD?.applyLocalLabelPolicy?.();
    await raf();
    await raf();
    return expectedGeneration === generation;
  };

  const cleanup = ({ result = 'cancelled' } = {}) => {
    cancelAnimationFrame(frame);
    frame = 0;
    const current = active;
    active = null;
    current?.overlay?.remove();
    document.body?.classList.remove('is-atlas-focus-transitioning', 'is-profile-atlas-transitioning', 'is-profile-atlas-collapsing', 'is-profile-atlas-unfolding');
    if (document.body) {
      delete document.body.dataset.atlasFocusDirection;
      delete document.body.dataset.atlasFocusAnchor;
      delete document.body.dataset.profileAtlasPhase;
    }
    if (current) {
      lastResult = {
        result,
        direction: current.direction,
        anchorId: current.anchorId,
        sourceRoute: current.sourceRoute,
        targetRoute: current.targetRoute,
        finishedAt: performance.now()
      };
    }
  };

  const animate = (duration, expectedGeneration, painter) => new Promise(resolve => {
    if (reducedMotion.matches) return resolve(true);
    const started = performance.now();
    const step = now => {
      if (expectedGeneration !== generation || !active) return resolve(false);
      const raw = clamp01((now - started) / duration);
      painter(raw);
      if (raw >= 1) {
        frame = 0;
        resolve(true);
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  });

  const collapseProfileIntoRoot = async (current, source, expectedGeneration) => {
    const rootItem = source.nodes.get(rootId);
    if (!rootItem) return false;
    const rootTarget = centredRootMatrix(rootItem.matrix);
    document.body?.classList.add('is-profile-atlas-collapsing');
    if (document.body) document.body.dataset.profileAtlasPhase = 'collapse';

    return animate(COLLAPSE_DURATION, expectedGeneration, raw => {
      const p = ease(raw);
      const matrices = new Map();
      source.nodes.forEach((item, id) => {
        let matrix;
        let opacity = 1;
        if (id === rootId) {
          matrix = interpolateMatrix(item.matrix, rootTarget, p);
        } else {
          const destination = compactMatrix(item.matrix, rootTarget, .12);
          matrix = interpolateMatrix(item.matrix, destination, p);
          opacity = 1 - ease(clamp01((raw - .58) / .42));
        }
        setMatrix(item.clone, matrix);
        item.clone.style.opacity = String(opacity);
        matrices.set(id, matrix);
      });
      paintEdges(current.edges, matrices, () => 1 - ease(clamp01(raw / .92)));
    });
  };

  const rebuildOverlayForAtlas = (current, target, rootStart) => {
    current.nodes.replaceChildren();
    target.nodes.forEach(item => {
      const clone = item.clone;
      clone.dataset.bridgeNodeId = item.id;
      const initial = item.id === rootId
        ? rootStart
        : compactMatrix(item.matrix, rootStart, .10);
      setMatrix(clone, initial);
      clone.style.opacity = item.id === rootId ? '1' : '0';
      current.nodes.appendChild(clone);
    });
    current.edges.replaceChildren();
    modelEdges([...target.nodes.keys()]).forEach(edge => {
      const path = document.createElementNS(svgNS, 'path');
      path.dataset.source = edge.source;
      path.dataset.target = edge.target;
      path.dataset.type = edge.type;
      path.classList.add('atlas-focus-bridge-edge');
      path.setAttribute('pathLength', '1');
      path.style.strokeDasharray = '0.0001 1';
      path.style.opacity = '0';
      current.edges.appendChild(path);
    });
  };

  const unfoldAtlasFromRoot = async (current, target, expectedGeneration) => {
    const rootTarget = target.nodes.get(rootId)?.matrix;
    if (!rootTarget) return false;
    const startRoot = centredRootMatrix(rootTarget);
    rebuildOverlayForAtlas(current, target, startRoot);
    document.body?.classList.remove('is-profile-atlas-collapsing');
    document.body?.classList.add('is-profile-atlas-unfolding');
    if (document.body) document.body.dataset.profileAtlasPhase = 'unfold';

    const progressById = new Map([[rootId, 1]]);
    return animate(ATLAS_UNFOLD_DURATION, expectedGeneration, raw => {
      const matrices = new Map();
      target.nodes.forEach((item, id) => {
        const clone = current.nodes.querySelector(`[data-bridge-node-id="${CSS.escape(id)}"]`);
        if (!clone) return;
        if (id === rootId) {
          const p = ease(clamp01(raw / .28));
          const matrix = interpolateMatrix(startRoot, item.matrix, p);
          setMatrix(clone, matrix);
          clone.style.opacity = '1';
          matrices.set(id, matrix);
          progressById.set(id, 1);
          return;
        }
        const d = depth.get(id) ?? 4;
        const wave = d <= 1 ? .02 : d === 2 ? .14 : d === 3 ? .27 : .38;
        const jitter = (stableNumber(`${id}:atlas-unfold`) % 50) / 1000;
        const local = clamp01((raw - wave - jitter) / Math.max(.38, .68 - wave));
        const p = ease(local);
        const origin = compactMatrix(item.matrix, startRoot, .10);
        const matrix = interpolateMatrix(origin, item.matrix, p);
        setMatrix(clone, matrix);
        clone.style.opacity = String(ease(clamp01(local / .72)));
        matrices.set(id, matrix);
        progressById.set(id, local);
      });
      paintEdges(current.edges, matrices, path => {
        const childProgress = progressById.get(path.dataset.target) ?? 0;
        const sourceProgress = progressById.get(path.dataset.source) ?? 0;
        return ease(clamp01((Math.min(childProgress, sourceProgress || childProgress) - .08) / .92));
      });
    });
  };

  const finishTransition = async ({ token, direction, anchorId, sourceRoute, targetRoute, sourceCount, targetCount, result = 'completed' }) => {
    if (active?.overlay) {
      active.overlay.classList.add('is-finishing');
      await wait(reducedMotion.matches ? 0 : 70);
    }
    active?.overlay?.remove();
    document.body?.classList.remove('is-atlas-focus-transitioning', 'is-profile-atlas-transitioning', 'is-profile-atlas-collapsing', 'is-profile-atlas-unfolding');
    if (document.body) {
      delete document.body.dataset.atlasFocusDirection;
      delete document.body.dataset.atlasFocusAnchor;
      delete document.body.dataset.profileAtlasPhase;
    }
    scene()?.transitions?.finish?.(token, { anchorId, direction, sourceRoute, targetRoute });
    lastResult = {
      result,
      direction,
      anchorId,
      sourceRoute,
      targetRoute,
      sourceNodeCount: sourceCount,
      targetNodeCount: targetCount,
      finishedAt: performance.now()
    };
    active = null;
    requestAnimationFrame(() => {
      const focusId = mode() === 'atlas' ? rootId : anchorId;
      liveNode(focusId)?.focus?.({ preventScroll: true });
      window.ProfileNodeInteraction?.refresh?.();
      window.ProfileHaloRenderer?.refresh?.();
      scheduleCopySync();
    });
    return true;
  };

  function currentClone(layer, id) {
    return layer.querySelector(`[data-bridge-node-id="${CSS.escape(id)}"]`);
  }

  const transitionAtlasToFocus = async ({ anchorId, targetRoute, history = false } = {}) => {
    const anchor = nodeMap.get(anchorId);
    const resolvedRoute = normaliseRoute(targetRoute || routeForNode(anchor));
    if (mode() !== 'atlas' || !anchor || !isFocusRoute(resolvedRoute)) return false;
    if (active) scene()?.transitions?.interrupt?.({ reason: 'atlas-focus-retarget', targetRoute: resolvedRoute, targetNodeId: anchorId });

    const ids = semanticSubset(anchorId);
    const source = capture(ids);
    if (!source.nodes.has(anchorId)) return false;
    const operation = ++generation;
    const direction = 'atlas-to-focus';
    const token = scene()?.transitions?.begin?.({ type: 'ATLAS_FOCUS', owner: 'atlas-focus-unification', direction, anchorId, sourceRoute: source.route, targetRoute: resolvedRoute }, { reason: 'atlas-focus-unification' });
    const bridge = reducedMotion.matches ? null : makeOverlay({ source, direction, edges: modelEdges(ids) });
    active = { ...(bridge || {}), token, operation, direction, anchorId, sourceRoute: source.route, targetRoute: resolvedRoute, ids };
    document.body?.classList.add('is-atlas-focus-transitioning');
    if (document.body) {
      document.body.dataset.atlasFocusDirection = direction;
      document.body.dataset.atlasFocusAnchor = anchorId;
    }
    scene()?.transitions?.prepare?.(token, { bridgeNodeCount: source.nodes.size });
    window.ProfileRootOverview?.closeQuickOverview?.('route');
    document.querySelector('#site-detail-panel .detail-close')?.click?.();

    if (!history) setRoute(resolvedRoute);
    const ready = await prepareFocusTarget({ targetRoute: resolvedRoute, anchorId, expectedGeneration: operation });
    if (!ready || operation !== generation) {
      cleanup({ result: 'target-unavailable' });
      scene()?.transitions?.cancel?.(token, { reason: 'target-unavailable' });
      return false;
    }
    const target = capture(ids);
    scene()?.transitions?.commit?.(token, { sourceNodeCount: source.nodes.size, targetNodeCount: target.nodes.size });

    if (bridge) {
      const targetAnchor = target.nodes.get(anchorId)?.matrix;
      const sourceAnchor = source.nodes.get(anchorId)?.matrix;
      const completed = await animate(FOCUS_DURATION, operation, raw => {
        const p = ease(raw);
        const movingAnchor = sourceAnchor && targetAnchor ? interpolateMatrix(sourceAnchor, targetAnchor, p) : (targetAnchor || sourceAnchor);
        const matrices = new Map();
        source.nodes.forEach((item, id) => {
          const targetItem = target.nodes.get(id);
          const matrix = targetItem
            ? interpolateMatrix(item.matrix, targetItem.matrix, p)
            : interpolateMatrix(item.matrix, compactMatrix(item.matrix, movingAnchor || item.matrix, .16), ease(clamp01(raw / .8)));
          setMatrix(item.clone, matrix);
          item.clone.style.opacity = targetItem ? '1' : String(1 - ease(clamp01((raw - .22) / .58)));
          matrices.set(id, matrix);
        });
        target.nodes.forEach((item, id) => {
          if (source.nodes.has(id)) return;
          let clone = currentClone(bridge.nodes, id);
          if (!clone) {
            clone = item.clone;
            clone.dataset.bridgeNodeId = id;
            bridge.nodes.appendChild(clone);
          }
          const origin = compactMatrix(item.matrix, movingAnchor || item.matrix, .16);
          const local = ease(clamp01((raw - .28) / .72));
          const matrix = interpolateMatrix(origin, item.matrix, local);
          setMatrix(clone, matrix);
          clone.style.opacity = String(local);
          matrices.set(id, matrix);
        });
        paintEdges(bridge.edges, matrices, () => clamp01(raw * 1.12));
      });
      if (!completed) return false;
    }
    return finishTransition({ token, direction, anchorId, sourceRoute: source.route, targetRoute: resolvedRoute, sourceCount: source.nodes.size, targetCount: target.nodes.size });
  };

  const transitionProfileToAtlas = async ({ anchorId = currentAnchorId(), history = false } = {}) => {
    const sourceMode = mode();
    if (sourceMode === 'atlas') return false;
    if (active) scene()?.transitions?.interrupt?.({ reason: 'profile-atlas-retarget', targetRoute: 'atlas', targetNodeId: rootId });

    tuneProfileRootGeometry();
    const source = capture();
    if (!source.nodes.has(rootId)) {
      const operation = ++generation;
      if (!history) setRoute('atlas');
      return prepareAtlasTarget(operation);
    }

    const operation = ++generation;
    const direction = sourceMode === 'focus' ? 'focus-to-atlas' : 'profile-to-atlas';
    const token = scene()?.transitions?.begin?.({ type: 'PROFILE_ATLAS', owner: 'atlas-focus-unification', direction, anchorId, sourceRoute: source.route, targetRoute: 'atlas' }, { reason: 'profile-atlas-unfold' });
    const bridge = reducedMotion.matches ? null : makeOverlay({ source, direction: 'profile-to-atlas' });
    active = { ...(bridge || {}), token, operation, direction, anchorId, sourceRoute: source.route, targetRoute: 'atlas', ids: [...source.nodes.keys()] };
    document.body?.classList.add('is-atlas-focus-transitioning', 'is-profile-atlas-transitioning');
    if (document.body) {
      document.body.dataset.atlasFocusDirection = direction;
      document.body.dataset.atlasFocusAnchor = anchorId;
      document.body.dataset.profileAtlasPhase = 'collapse';
    }
    scene()?.transitions?.prepare?.(token, { sourceNodeCount: source.nodes.size, semanticRootId: rootId });
    window.ProfileRootOverview?.closeQuickOverview?.('route');
    document.querySelector('#site-detail-panel .detail-close')?.click?.();

    if (bridge) {
      const collapsed = await collapseProfileIntoRoot(bridge, source, operation);
      if (!collapsed || operation !== generation) return false;
    }

    if (!history) setRoute('atlas');
    const ready = await prepareAtlasTarget(operation);
    if (!ready || operation !== generation) {
      cleanup({ result: 'target-unavailable' });
      scene()?.transitions?.cancel?.(token, { reason: 'target-unavailable' });
      return false;
    }
    const target = capture(graph.nodes.map(node => node.id));
    scene()?.transitions?.commit?.(token, { sourceNodeCount: source.nodes.size, targetNodeCount: target.nodes.size, semanticRootId: rootId });

    if (bridge) {
      const unfolded = await unfoldAtlasFromRoot(bridge, target, operation);
      if (!unfolded || operation !== generation) return false;
    }

    window.ProfileAtlasLOD?.setTopologyMode?.('entry-full', { reason: 'profile-atlas-unfold-complete' });
    return finishTransition({ token, direction, anchorId, sourceRoute: source.route, targetRoute: 'atlas', sourceCount: source.nodes.size, targetCount: target.nodes.size });
  };

  const routableAtlasAnchor = target => {
    if (mode() !== 'atlas') return null;
    const inspectorAction = target?.closest?.('#site-detail-panel .atlas-open-local');
    if (inspectorAction) {
      const selected = selectedAtlasNode();
      const anchor = selected ? nodeMap.get(selected.dataset.nodeId) : null;
      const targetRoute = routeForNode(anchor);
      return anchor && isFocusRoute(targetRoute) ? { anchorId: anchor.id, targetRoute } : null;
    }
    const selectedNode = target?.closest?.('#site-graph .site-graph-node.is-previewed[data-node-id]');
    if (selectedNode) {
      const anchor = nodeMap.get(selectedNode.dataset.nodeId);
      const targetRoute = routeForNode(anchor);
      return anchor && isFocusRoute(targetRoute) ? { anchorId: anchor.id, targetRoute } : null;
    }
    const routeControl = target?.closest?.('[data-route], [data-route-target]');
    if (!routeControl) return null;
    const targetRoute = normaliseRoute(routeControl.dataset.route || routeControl.dataset.routeTarget || routeControl.getAttribute('href'));
    if (!isFocusRoute(targetRoute)) return null;
    const anchor = nodeForRoute(targetRoute);
    return anchor ? { anchorId: anchor.id, targetRoute } : null;
  };
  const atlasIntent = target => {
    if (mode() === 'atlas') return null;
    const control = target?.closest?.('[data-route="atlas"], [data-route-target="atlas"], a[href="#atlas"]');
    if (!control) return null;
    return { anchorId: currentAnchorId(), targetRoute: 'atlas' };
  };

  const syncCopy = () => {
    copyFrame = 0;
    if (mode() !== 'atlas') return;
    const help = document.querySelector('#site-graph-help');
    if (help) help.textContent = 'Hover to trace structure and connections. Click a node for details; re-activate a local item to open the same node at local scale.';
    const detail = document.querySelector('#site-detail-panel');
    const selected = selectedAtlasNode();
    if (!detail || detail.hidden || !selected) return;
    const anchor = nodeMap.get(selected.dataset.nodeId);
    const targetRoute = routeForNode(anchor);
    const hint = detail.querySelector('.atlas-repeat-click-hint');
    if (hint && isFocusRoute(targetRoute)) hint.textContent = 'Activate the selected node again, or use the action below, to open it at local scale.';
  };
  function scheduleCopySync() {
    cancelAnimationFrame(copyFrame);
    copyFrame = requestAnimationFrame(() => requestAnimationFrame(syncCopy));
  }

  addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.defaultPrevented) return;
    const atlas = atlasIntent(event.target);
    if (atlas) {
      event.preventDefault();
      event.stopImmediatePropagation();
      transitionProfileToAtlas(atlas);
      return;
    }
    const focus = routableAtlasAnchor(event.target);
    if (focus) {
      event.preventDefault();
      event.stopImmediatePropagation();
      transitionAtlasToFocus(focus);
    }
  }, true);

  addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key) || event.defaultPrevented) return;
    const atlas = atlasIntent(event.target);
    if (atlas) {
      event.preventDefault();
      event.stopImmediatePropagation();
      transitionProfileToAtlas(atlas);
      return;
    }
    const focus = routableAtlasAnchor(event.target);
    if (focus) {
      event.preventDefault();
      event.stopImmediatePropagation();
      transitionAtlasToFocus(focus);
    }
  }, true);

  addEventListener('popstate', () => {
    const sourceMode = mode();
    const targetRoute = hashRoute();
    if (sourceMode === 'atlas' && isFocusRoute(targetRoute)) {
      const target = nodeForRoute(targetRoute);
      if (target) transitionAtlasToFocus({ anchorId: target.id, targetRoute, history: true });
      return;
    }
    if (sourceMode !== 'atlas' && targetRoute === 'atlas') {
      transitionProfileToAtlas({ anchorId: currentAnchorId(), history: true });
    }
  }, true);

  scene()?.transitions?.registerParticipant?.('atlas-focus-unification', {
    capture: () => snapshot(),
    cancel: payload => {
      if (!active) return false;
      ++generation;
      cleanup({ result: payload?.reason || 'coordinator-interrupt' });
      return true;
    }
  });

  addEventListener('profile:profile-root-settled', tuneProfileRootGeometry);
  addEventListener('profile:root-overview-ready', tuneProfileRootGeometry);
  addEventListener('profile:geometry-applied', () => {
    if (mode() === 'overview') tuneProfileRootGeometry();
  });
  addEventListener('profile:node-interaction', scheduleCopySync);
  addEventListener('profile:scene-state', scheduleCopySync);
  addEventListener('hashchange', scheduleCopySync);
  reducedMotion.addEventListener?.('change', () => {
    if (!active || !reducedMotion.matches) return;
    ++generation;
    cleanup({ result: 'reduced-motion-change' });
  });

  function snapshot() {
    return {
      ready: true,
      active: Boolean(active),
      direction: active?.direction || null,
      anchorId: active?.anchorId || null,
      sourceRoute: active?.sourceRoute || null,
      targetRoute: active?.targetRoute || null,
      bridgeNodeCount: active?.ids?.length || 0,
      transitionToken: active?.token || null,
      phase: document.body?.dataset.profileAtlasPhase || null,
      reducedMotion: reducedMotion.matches,
      lastResult
    };
  }

  window.ProfileAtlasFocus = Object.freeze({
    enterFocus: (anchorId, targetRoute = routeForNode(nodeMap.get(anchorId))) =>
      transitionAtlasToFocus({ anchorId, targetRoute }),
    returnToAtlas: anchorId => transitionProfileToAtlas({ anchorId: anchorId || currentAnchorId() }),
    enterAtlas: () => transitionProfileToAtlas({ anchorId: currentAnchorId() }),
    interrupt: reason => {
      if (!active) return false;
      scene()?.transitions?.interrupt?.({ reason: reason || 'atlas-focus-api-interrupt' });
      return true;
    },
    ownsBoundary: (sourceMode, targetRoute) =>
      (sourceMode === 'atlas' && isFocusRoute(targetRoute)) ||
      (sourceMode !== 'atlas' && normaliseRoute(targetRoute) === 'atlas'),
    snapshot
  });

  tuneProfileRootGeometry();
  scheduleCopySync();
  dispatchEvent(new CustomEvent('profile:atlas-focus-ready', { detail: snapshot() }));
})();
