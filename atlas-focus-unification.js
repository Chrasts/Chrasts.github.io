(() => {
  if (window.ProfileAtlasFocus) return;

  const scene = window.ProfileScene;
  const graph = window.SITE_DATA?.graph;
  if (!scene?.transitions || !scene?.camera || !graph?.nodes?.length) return;

  const rootId = graph.rootId || 'stepan-chrast';
  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const mediaMatches = query => window.matchMedia(query).matches;
  const prefersReducedMotion = () => mediaMatches('(prefers-reduced-motion: reduce)');
  const isDesktop = () => mediaMatches('(min-width: 901px)');
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const svgNS = 'http://www.w3.org/2000/svg';
  const MAX_BRIDGE_NODES = 14;
  const DURATION = 680;

  let generation = 0;
  let active = null;
  let frame = 0;
  let copyFrame = 0;
  let lastResult = null;

  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';
  const mode = () => document.body?.dataset.graphMode || 'overview';
  const route = () => normaliseRoute(document.body?.dataset.graphRoute || location.hash);
  const routeForNode = node => {
    if (!node) return null;
    if (node.id === rootId) return 'overview';
    if (node.id === 'work') return 'work';
    return node.route ? normaliseRoute(node.route) : null;
  };
  const nodeForRoute = value => {
    const target = normaliseRoute(value);
    return graph.nodes.find(node => normaliseRoute(node.route) === target) || null;
  };
  const isFocusRoute = value => {
    const target = normaliseRoute(value);
    if (['overview', 'atlas', 'work'].includes(target) || target.startsWith('work/')) return false;
    return Boolean(nodeForRoute(target));
  };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const raf = () => new Promise(resolve => requestAnimationFrame(resolve));
  const waitFor = (predicate, timeout = 3600) => new Promise(resolve => {
    const started = performance.now();
    const poll = () => {
      let value = false;
      try { value = Boolean(predicate()); } catch (_) {}
      if (value || performance.now() - started >= timeout) return resolve(value);
      setTimeout(poll, 20);
    };
    poll();
  });
  const clamp01 = value => Math.max(0, Math.min(1, value));
  const ease = value => value < .5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;

  const liveNode = id => [...document.querySelectorAll(`#site-graph .site-graph-node[data-node-id="${CSS.escape(id)}"]`)]
    .find(element => !element.closest('.v9-transition-overlay')) || null;
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
    graph.edges?.forEach(edge => {
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
      if (!id || ids.includes(id) || ids.length >= MAX_BRIDGE_NODES) return;
      ids.push(id);
    };
    add(anchorId);
    [...primaryPath(anchor)].reverse().forEach(node => add(node.id));
    childrenFor(anchorId).forEach(node => add(node.id));
    typedNeighbours(anchorId).forEach(node => add(node.id));
    childrenFor(anchorId).slice(0, 4).forEach(child => childrenFor(child.id).slice(0, 1).forEach(node => add(node.id)));
    return ids;
  };

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

  const capture = (ids, anchorId) => {
    const nodes = new Map();
    ids.forEach(id => {
      const source = liveNode(id);
      const matrix = matrixOf(source);
      if (!source || !matrix) return;
      nodes.set(id, { id, matrix, clone: cloneNode(source) });
    });
    return {
      mode: mode(),
      route: route(),
      anchorId,
      anchorMatrix: nodes.get(anchorId)?.matrix || null,
      nodes
    };
  };

  const relationEdges = ids => {
    const set = new Set(ids);
    const result = [];
    graph.nodes.forEach(node => (node.parentIds || []).forEach((parentId, index) => {
      if (set.has(node.id) && set.has(parentId)) result.push({ source: parentId, target: node.id, type: index ? 'hierarchy-alt' : 'hierarchy' });
    }));
    (graph.edges || []).forEach(edge => {
      if (!set.has(edge.source) || !set.has(edge.target)) return;
      if (result.some(item => item.source === edge.source && item.target === edge.target && item.type === edge.type)) return;
      result.push({ source: edge.source, target: edge.target, type: edge.type || 'relation' });
    });
    return result;
  };

  const makeOverlay = ({ ids, source }) => {
    const overlay = document.createElementNS(svgNS, 'svg');
    overlay.classList.add('atlas-focus-bridge');
    overlay.dataset.direction = source.mode === 'atlas' ? 'into-focus' : 'into-atlas';
    overlay.setAttribute('viewBox', `0 0 ${Math.max(1, innerWidth)} ${Math.max(1, innerHeight)}`);
    overlay.setAttribute('preserveAspectRatio', 'none');
    overlay.setAttribute('aria-hidden', 'true');
    const edges = document.createElementNS(svgNS, 'g');
    edges.classList.add('atlas-focus-bridge-edges');
    const nodes = document.createElementNS(svgNS, 'g');
    nodes.classList.add('atlas-focus-bridge-nodes');
    overlay.append(edges, nodes);
    source.nodes.forEach(item => {
      item.clone.dataset.bridgeNodeId = item.id;
      setMatrix(item.clone, item.matrix);
      nodes.appendChild(item.clone);
    });
    relationEdges(ids).forEach(edge => {
      const path = document.createElementNS(svgNS, 'path');
      path.dataset.source = edge.source;
      path.dataset.target = edge.target;
      path.dataset.type = edge.type;
      path.classList.add('atlas-focus-bridge-edge');
      edges.appendChild(path);
    });
    document.body.appendChild(overlay);
    return { overlay, edges, nodes };
  };

  const edgePath = (from, to) => {
    const dx = to.e - from.e;
    const dy = to.f - from.f;
    const bend = Math.max(-32, Math.min(32, (dx === 0 ? 1 : Math.sign(dx)) * Math.min(24, Math.abs(dy) * .08 + 8)));
    const cx = (from.e + to.e) / 2 - dy * .035 + bend;
    const cy = (from.f + to.f) / 2 + dx * .018;
    return `M ${from.e.toFixed(2)} ${from.f.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${to.e.toFixed(2)} ${to.f.toFixed(2)}`;
  };

  const setRoute = targetRoute => {
    const next = `#${normaliseRoute(targetRoute)}`;
    if (location.hash !== next) location.hash = next;
    else dispatchEvent(new HashChangeEvent('hashchange'));
  };

  const ensureCameraComposition = async () => {
    window.ProfileCameraComposition?.boot?.();
    if (!window.ProfileCameraComposition) return true;
    return waitFor(() => Boolean(window.ProfileCameraComposition?.snapshot?.().booted), 1600);
  };

  const targetReady = async ({ targetMode, targetRoute, anchorId, direction, generation: expectedGeneration }) => {
    const reached = await waitFor(() =>
      expectedGeneration === generation &&
      mode() === targetMode &&
      (targetMode === 'atlas' || route() === normaliseRoute(targetRoute)) &&
      Boolean(liveNode(anchorId)),
    4200);
    if (!reached || expectedGeneration !== generation) return false;
    await raf();
    await raf();
    await wait(prefersReducedMotion() ? 0 : 470);
    if (expectedGeneration !== generation) return false;

    await ensureCameraComposition();
    if (direction === 'focus-to-atlas') {
      scene.camera.use('atlas');
      const focused = window.ProfileCameraComposition?.focusNode?.(anchorId, {
        immediate: true,
        minScale: 1.28,
        maxScale: 1.72
      });
      if (!focused) window.ProfileAtlasLOD?.focusNode?.(anchorId, { immediate: true });
      await raf();
      await raf();
    } else {
      if (isDesktop()) scene.camera.use('desktop-local');
      window.ProfileGeometry?.stabilize?.(900);
      window.ProfileGeometry?.apply?.();
      window.ProfileAtlasLOD?.applyLocalLabelPolicy?.();
      await raf();
      await raf();
    }
    return expectedGeneration === generation && Boolean(liveNode(anchorId));
  };

  const cleanup = ({ result = 'cancelled' } = {}) => {
    cancelAnimationFrame(frame);
    frame = 0;
    const current = active;
    active = null;
    current?.overlay?.remove();
    document.body?.classList.remove('is-atlas-focus-transitioning');
    if (document.body) {
      delete document.body.dataset.atlasFocusDirection;
      delete document.body.dataset.atlasFocusAnchor;
    }
    lastResult = {
      result,
      direction: current?.direction || null,
      anchorId: current?.anchorId || null,
      sourceRoute: current?.sourceRoute || null,
      targetRoute: current?.targetRoute || null,
      finishedAt: performance.now()
    };
  };

  const cancelTransition = (token, result, reason = result) => {
    cleanup({ result });
    scene.transitions.cancel(token, { reason });
    return false;
  };

  const paint = (current, source, target, raw) => {
    const t = ease(raw);
    const anchorSource = source.nodes.get(current.anchorId)?.matrix || source.anchorMatrix;
    const anchorTarget = target.nodes.get(current.anchorId)?.matrix || target.anchorMatrix || anchorSource;
    const movingAnchor = anchorSource && anchorTarget ? interpolateMatrix(anchorSource, anchorTarget, t) : (anchorTarget || anchorSource);
    const currentMatrices = new Map();
    source.nodes.forEach((item, id) => {
      const targetItem = target.nodes.get(id);
      let matrix;
      let opacity = 1;
      if (targetItem) matrix = interpolateMatrix(item.matrix, targetItem.matrix, t);
      else {
        matrix = movingAnchor ? interpolateMatrix(item.matrix, movingAnchor, ease(clamp01(raw / .78))) : item.matrix;
        opacity = 1 - ease(clamp01((raw - .22) / .58));
      }
      setMatrix(item.clone, matrix);
      item.clone.style.opacity = String(clamp01(opacity));
      currentMatrices.set(id, matrix);
    });
    target.nodes.forEach((item, id) => {
      if (source.nodes.has(id)) return;
      let clone = current.nodes.querySelector(`[data-bridge-node-id="${CSS.escape(id)}"]`);
      if (!clone) {
        clone = item.clone;
        clone.dataset.bridgeNodeId = id;
        clone.style.opacity = '0';
        current.nodes.appendChild(clone);
      }
      const origin = movingAnchor || target.anchorMatrix || item.matrix;
      const enterT = ease(clamp01((raw - .30) / .70));
      const matrix = interpolateMatrix(origin, item.matrix, enterT);
      setMatrix(clone, matrix);
      clone.style.opacity = String(clamp01(enterT * 1.28));
      currentMatrices.set(id, matrix);
    });
    current.edges.querySelectorAll('.atlas-focus-bridge-edge').forEach(path => {
      const from = currentMatrices.get(path.dataset.source);
      const to = currentMatrices.get(path.dataset.target);
      if (!from || !to) {
        path.style.opacity = '0';
        return;
      }
      path.setAttribute('d', edgePath(from, to));
      const bothSource = source.nodes.has(path.dataset.source) && source.nodes.has(path.dataset.target);
      const bothTarget = target.nodes.has(path.dataset.source) && target.nodes.has(path.dataset.target);
      const opacity = bothSource && bothTarget
        ? .72
        : bothTarget
          ? clamp01((raw - .30) / .55) * .62
          : (1 - clamp01((raw - .15) / .55)) * .52;
      path.style.opacity = String(opacity);
    });
  };

  const animate = (current, source, target, expectedGeneration) => new Promise(resolve => {
    if (prefersReducedMotion()) return resolve(true);
    const started = performance.now();
    const step = now => {
      if (expectedGeneration !== generation || active !== current) return resolve(false);
      const raw = clamp01((now - started) / DURATION);
      paint(current, source, target, raw);
      if (raw >= 1) {
        frame = 0;
        resolve(true);
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  });

  const transition = async ({ direction, anchorId, targetRoute, history = false } = {}) => {
    const anchor = nodeMap.get(anchorId);
    const focusRoute = routeForNode(anchor);
    if (!anchor || !focusRoute || !isFocusRoute(focusRoute)) return false;
    if (active) scene.transitions.interrupt({ reason: 'atlas-focus-retarget', targetRoute, targetNodeId: anchorId });

    const sourceMode = mode();
    const expectedSource = direction === 'atlas-to-focus' ? 'atlas' : 'focus';
    const targetMode = direction === 'atlas-to-focus' ? 'focus' : 'atlas';
    if (sourceMode !== expectedSource) return false;

    const ids = semanticSubset(anchorId);
    const source = capture(ids, anchorId);
    if (!source.nodes.has(anchorId)) return false;

    const operation = ++generation;
    const token = scene.transitions.begin({
      type: 'ATLAS_FOCUS',
      owner: 'atlas-focus-unification',
      direction,
      anchorId,
      sourceRoute: source.route,
      targetRoute
    }, { reason: 'atlas-focus-unification' });
    if (!token) return false;

    const bridge = makeOverlay({ ids, source });
    active = { ...bridge, token, operation, direction, anchorId, sourceRoute: source.route, targetRoute, ids };
    document.body?.classList.add('is-atlas-focus-transitioning');
    if (document.body) {
      document.body.dataset.atlasFocusDirection = direction;
      document.body.dataset.atlasFocusAnchor = anchorId;
    }
    scene.transitions.prepare(token, { bridgeNodeCount: source.nodes.size });
    window.ProfileRootOverview?.closeQuickOverview?.('route');
    document.querySelector('#site-detail-panel .detail-close')?.click?.();

    if (!history) setRoute(targetRoute);
    const ready = await targetReady({ targetMode, targetRoute, anchorId, direction, generation: operation });
    if (!ready || operation !== generation || active?.token !== token) {
      return cancelTransition(token, 'target-unavailable');
    }

    const target = capture(ids, anchorId);
    if (!target.nodes.has(anchorId)) return cancelTransition(token, 'anchor-unavailable');

    scene.transitions.commit(token, { sourceNodeCount: source.nodes.size, targetNodeCount: target.nodes.size });
    paint(active, source, target, 0);
    const completed = await animate(active, source, target, operation);
    if (!completed || operation !== generation || active?.token !== token) return false;

    active.overlay.classList.add('is-finishing');
    await wait(prefersReducedMotion() ? 0 : 70);
    if (operation !== generation || active?.token !== token) return false;
    active.overlay.remove();
    document.body?.classList.remove('is-atlas-focus-transitioning');
    if (document.body) {
      delete document.body.dataset.atlasFocusDirection;
      delete document.body.dataset.atlasFocusAnchor;
    }
    scene.transitions.finish(token, { anchorId, direction, sourceRoute: source.route, targetRoute });
    lastResult = {
      result: 'completed', direction, anchorId, sourceRoute: source.route, targetRoute,
      sourceNodeCount: source.nodes.size, targetNodeCount: target.nodes.size, finishedAt: performance.now()
    };
    active = null;
    requestAnimationFrame(() => {
      liveNode(anchorId)?.focus?.({ preventScroll: true });
      window.ProfileNodeInteraction?.refresh?.();
      window.ProfileHaloRenderer?.refresh?.();
      scheduleCopySync();
    });
    return true;
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
    if (mode() !== 'focus') return null;
    const control = target?.closest?.('[data-route="atlas"], [data-route-target="atlas"]');
    if (!control) return null;
    const current = nodeForRoute(route());
    if (!current || !isFocusRoute(routeForNode(current))) return null;
    return { anchorId: current.id, targetRoute: 'atlas' };
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
    const focus = routableAtlasAnchor(event.target);
    if (focus) {
      event.preventDefault();
      event.stopImmediatePropagation();
      transition({ direction: 'atlas-to-focus', ...focus });
      return;
    }
    const atlas = atlasIntent(event.target);
    if (atlas) {
      event.preventDefault();
      event.stopImmediatePropagation();
      transition({ direction: 'focus-to-atlas', ...atlas });
    }
  }, true);

  addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key) || event.defaultPrevented) return;
    const focus = routableAtlasAnchor(event.target);
    if (focus) {
      event.preventDefault();
      event.stopImmediatePropagation();
      transition({ direction: 'atlas-to-focus', ...focus });
      return;
    }
    const atlas = atlasIntent(event.target);
    if (atlas) {
      event.preventDefault();
      event.stopImmediatePropagation();
      transition({ direction: 'focus-to-atlas', ...atlas });
    }
  }, true);

  addEventListener('popstate', () => {
    const sourceMode = mode();
    const targetRoute = normaliseRoute(location.hash);
    if (sourceMode === 'atlas' && isFocusRoute(targetRoute)) {
      const target = nodeForRoute(targetRoute);
      if (target) transition({ direction: 'atlas-to-focus', anchorId: target.id, targetRoute, history: true });
      return;
    }
    if (sourceMode === 'focus' && targetRoute === 'atlas') {
      const current = nodeForRoute(route());
      if (current) transition({ direction: 'focus-to-atlas', anchorId: current.id, targetRoute: 'atlas', history: true });
    }
  }, true);

  scene.transitions.registerParticipant('atlas-focus-unification', {
    capture: () => snapshot(),
    cancel: payload => {
      if (!active) return false;
      ++generation;
      cleanup({ result: payload?.reason || 'coordinator-interrupt' });
      return true;
    }
  });

  const detail = document.querySelector('#site-detail-panel');
  if (detail) new MutationObserver(scheduleCopySync).observe(detail, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['hidden', 'class']
  });
  if (document.body) new MutationObserver(scheduleCopySync).observe(document.body, {
    attributes: true,
    attributeFilter: ['data-graph-mode', 'data-graph-route']
  });
  addEventListener('profile:node-interaction', scheduleCopySync);
  addEventListener('profile:scene-state', scheduleCopySync);
  addEventListener('hashchange', scheduleCopySync);

  reducedMotionQuery.addEventListener?.('change', () => {
    if (!active || !prefersReducedMotion()) return;
    const token = active.token;
    ++generation;
    cleanup({ result: 'reduced-motion-change' });
    scene.transitions.cancel(token, { reason: 'reduced-motion-change' });
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
      reducedMotion: prefersReducedMotion(),
      lastResult
    };
  }

  window.ProfileAtlasFocus = Object.freeze({
    enterFocus: (anchorId, targetRoute = routeForNode(nodeMap.get(anchorId))) =>
      transition({ direction: 'atlas-to-focus', anchorId, targetRoute }),
    returnToAtlas: anchorId => transition({ direction: 'focus-to-atlas', anchorId, targetRoute: 'atlas' }),
    interrupt: reason => {
      if (!active) return false;
      scene.transitions.interrupt({ reason: reason || 'atlas-focus-api-interrupt' });
      return true;
    },
    ownsBoundary: (sourceMode, targetRoute) =>
      (sourceMode === 'atlas' && isFocusRoute(targetRoute)) ||
      (sourceMode === 'focus' && normaliseRoute(targetRoute) === 'atlas'),
    snapshot
  });

  scheduleCopySync();
  dispatchEvent(new CustomEvent('profile:atlas-focus-ready', { detail: snapshot() }));
})();