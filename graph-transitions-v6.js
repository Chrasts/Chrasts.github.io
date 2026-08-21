(() => {
  window.__GRAPH_V6_RESTORE_MATCH_MEDIA__?.();

  const site = window.SITE_DATA;
  const graph = site?.graph;
  if (!graph?.nodes?.length) return;

  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const rootId = graph.rootId;
  const rootNode = nodeMap.get(rootId);
  const svgNS = 'http://www.w3.org/2000/svg';
  const realReduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  const childrenFor = id => graph.nodes.filter(node => node.parentIds?.includes(id));
  const routeForNode = node => node?.route || 'overview';
  const routeNode = route => route === 'overview'
    ? rootNode
    : graph.nodes.find(node => node.route === route) || null;
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

  const isAncestor = (candidateId, nodeId) => {
    if (!candidateId || !nodeId || candidateId === nodeId) return false;
    const pending = [...(nodeMap.get(nodeId)?.parentIds || [])];
    const seen = new Set();
    while (pending.length) {
      const id = pending.pop();
      if (id === candidateId) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      pending.push(...(nodeMap.get(id)?.parentIds || []));
    }
    return false;
  };

  const graphSvg = () => document.querySelector('#site-graph .site-graph-svg');
  const graphCamera = () => graphSvg()?.querySelector('.profile-map-viewport');
  const nodeElements = () => [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')];
  const edgeElements = () => [...document.querySelectorAll('#site-graph .site-graph-edges path[data-source][data-target]')];

  const pointOf = element => ({
    x: Number(element?.dataset.x || 0),
    y: Number(element?.dataset.y || 0)
  });

  const setPoint = (element, point) => {
    if (!element || !point) return;
    element.setAttribute('transform', `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`);
    element.dataset.x = point.x;
    element.dataset.y = point.y;
  };

  const snapshot = () => {
    const svg = graphSvg();
    const camera = graphCamera();
    if (!svg || !camera) return null;

    const nodes = new Map();
    nodeElements().forEach(element => {
      const id = element.dataset.nodeId;
      nodes.set(id, {
        point: pointOf(element),
        clone: element.cloneNode(true)
      });
    });

    return {
      svg,
      camera,
      mode: document.body.dataset.graphMode || 'overview',
      route: normaliseRoute(document.body.dataset.graphRoute || location.hash),
      nodes,
      cameraClone: camera.cloneNode(true)
    };
  };

  let pending = null;
  let transitionFrame = 0;
  let guardOverlay = null;

  const removeGuard = () => {
    guardOverlay?.remove();
    guardOverlay = null;
    const camera = graphCamera();
    if (camera) camera.style.opacity = '';
  };

  const prepare = ({ targetId = null, targetRoute = null, trigger = 'click' } = {}) => {
    if (document.body.dataset.graphMode === 'atlas') return;
    const before = snapshot();
    if (!before) return;

    cancelAnimationFrame(transitionFrame);
    removeGuard();

    const currentRoute = before.route;
    const currentNode = routeNode(currentRoute) ||
      (currentRoute.startsWith('work') ? nodeMap.get('work') : rootNode);
    const resolvedTargetRoute = normaliseRoute(targetRoute || routeForNode(nodeMap.get(targetId)) || location.hash);
    const targetNode = targetId ? nodeMap.get(targetId) : routeNode(resolvedTargetRoute);

    let direction = 'lateral';
    if (targetNode && currentNode) {
      if (isAncestor(targetNode.id, currentNode.id) || targetNode.id === rootId) direction = 'up';
      else if (isAncestor(currentNode.id, targetNode.id)) direction = 'down';
    }
    if (currentRoute.startsWith('work') && resolvedTargetRoute === 'overview') direction = 'up';
    if (currentRoute === 'overview' && resolvedTargetRoute.startsWith('work')) direction = 'down';

    pending = {
      before,
      targetId: targetNode?.id || targetId || null,
      targetRoute: resolvedTargetRoute,
      currentId: currentNode?.id || null,
      direction,
      trigger
    };

    guardOverlay = before.cameraClone;
    guardOverlay.classList.add('v6-static-guard');
    guardOverlay.style.pointerEvents = 'none';
    guardOverlay.style.opacity = '1';
    before.svg.appendChild(guardOverlay);
    before.camera.style.opacity = '0';
    window.__GRAPH_V6_FORCE_SNAP__ = true;
  };

  const edgePath = (from, to, key, straight = false) => {
    if (!from || !to) return '';
    if (straight || Math.abs(from.x - to.x) < 4) {
      return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} L ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
    }
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    let seed = 0;
    for (const c of key) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
    const bend = Math.max(-42, Math.min(42, ((seed % 39) - 19) + Math.min(13, Math.abs(dx) * .028)));
    const nx = -dy / distance;
    const ny = dx / distance;
    const control = {
      x: (from.x + to.x) / 2 + nx * bend,
      y: (from.y + to.y) / 2 + ny * bend
    };
    return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${control.x.toFixed(1)} ${control.y.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
  };

  const resetLabelGeometry = () => {
    nodeElements().forEach(element => {
      const id = element.dataset.nodeId;
      const label = element.querySelector('.site-graph-label');
      if (!label) return;
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('x', '0');
      label.setAttribute('y', id === rootId ? '-25' : '25');
    });
  };

  const placeTier = (items, y, left = 165, right = 1035, stagger = 0) => {
    const result = new Map();
    if (!items.length) return result;
    items.forEach((node, index) => {
      const t = items.length === 1 ? .5 : index / (items.length - 1);
      result.set(node.id, {
        x: left + t * (right - left),
        y: y + (stagger ? (index % 2 ? stagger : -stagger) : 0)
      });
    });
    return result;
  };

  const reflowFocus = () => {
    if (document.body.dataset.graphMode !== 'focus') return;
    const route = normaliseRoute(document.body.dataset.graphRoute || location.hash);
    const target = routeNode(route);
    if (!target) return;

    const elements = new Map(nodeElements().map(element => [element.dataset.nodeId, element]));
    const visibleIds = new Set(elements.keys());
    const path = primaryPath(target).filter(node => visibleIds.has(node.id));
    if (!path.length) return;

    resetLabelGeometry();

    const positions = new Map();
    const currentY = 252;
    const topY = 105;
    const step = path.length <= 1
      ? 0
      : Math.min(48, (currentY - topY) / Math.max(1, path.length - 1));
    const firstY = currentY - step * (path.length - 1);

    path.forEach((node, index) => {
      positions.set(node.id, { x: 600, y: firstY + index * step });
      const label = elements.get(node.id)?.querySelector('.site-graph-label');
      if (label && node.id !== target.id) {
        label.setAttribute('text-anchor', 'end');
        label.setAttribute('x', '-16');
        label.setAttribute('y', '4');
      }
    });

    const direct = childrenFor(target.id)
      .filter(node => visibleIds.has(node.id))
      .sort((a, b) => a.label.localeCompare(b.label));

    const directPositions = placeTier(direct, target.id === 'experience' ? 455 : 430, 170, 1030, direct.length > 5 ? 9 : 0);
    directPositions.forEach((point, id) => positions.set(id, point));

    const grandchildren = [];
    direct.forEach(parent => {
      childrenFor(parent.id)
        .filter(node => visibleIds.has(node.id) && !positions.has(node.id))
        .forEach(node => grandchildren.push({ node, parent }));
    });

    const byParent = new Map();
    grandchildren.forEach(item => {
      if (!byParent.has(item.parent.id)) byParent.set(item.parent.id, []);
      byParent.get(item.parent.id).push(item.node);
    });

    byParent.forEach((group, parentId) => {
      const parent = positions.get(parentId);
      if (!parent) return;
      const width = Math.min(260, 105 + group.length * 76);
      group.forEach((node, index) => {
        const t = group.length === 1 ? .5 : index / (group.length - 1);
        positions.set(node.id, {
          x: Math.max(120, Math.min(1080, parent.x - width / 2 + t * width)),
          y: 585 + (index % 2 ? 7 : -7)
        });
      });
    });

    const unplaced = [...visibleIds]
      .filter(id => !positions.has(id))
      .map(id => nodeMap.get(id))
      .filter(Boolean)
      .sort((a, b) => a.label.localeCompare(b.label));
    placeTier(unplaced, 585, 180, 1020, 7).forEach((point, id) => positions.set(id, point));

    positions.forEach((point, id) => setPoint(elements.get(id), point));

    const pathIds = new Set(path.map(node => node.id));
    edgeElements().forEach(edge => {
      const sourceId = edge.dataset.source;
      const targetId = edge.dataset.target;
      const source = positions.get(sourceId) || pointOf(elements.get(sourceId));
      const targetPoint = positions.get(targetId) || pointOf(elements.get(targetId));
      if (!source || !targetPoint) return;
      const straight = pathIds.has(sourceId) && pathIds.has(targetId);
      edge.setAttribute('d', edgePath(source, targetPoint, `${sourceId}|${targetId}`, straight));
    });

    const timeline = document.querySelector('#site-graph .site-graph-timeline');
    if (timeline && target.id === 'experience') {
      timeline.setAttribute('x1', '165');
      timeline.setAttribute('x2', '1035');
      timeline.setAttribute('y1', '455');
      timeline.setAttribute('y2', '455');
    }
  };

  const routeTargetId = route => {
    if (route === 'overview') return rootId;
    if (route === 'work' || route.startsWith('work/')) return 'work';
    return routeNode(route)?.id || null;
  };

  const incomingParent = id => {
    const edge = edgeElements().find(item => item.dataset.target === id);
    return edge?.dataset.source || null;
  };

  const startTransition = () => {
    if (!pending) {
      window.__GRAPH_V6_FORCE_SNAP__ = false;
      removeGuard();
      return;
    }

    const current = pending;
    pending = null;

    resetLabelGeometry();
    reflowFocus();

    const svg = graphSvg();
    const camera = graphCamera();
    if (!svg || !camera) {
      window.__GRAPH_V6_FORCE_SNAP__ = false;
      removeGuard();
      return;
    }

    const afterElements = new Map(nodeElements().map(element => [element.dataset.nodeId, element]));
    const after = new Map([...afterElements].map(([id, element]) => [id, pointOf(element)]));
    const before = current.before.nodes;

    const finalTargetId = current.targetId && after.has(current.targetId)
      ? current.targetId
      : routeTargetId(normaliseRoute(document.body.dataset.graphRoute || location.hash));
    const anchor = after.get(finalTargetId) || after.get('work') || after.get(rootId) || { x: 600, y: 250 };

    const leavingLayer = document.createElementNS(svgNS, 'g');
    leavingLayer.classList.add('v6-leaving-layer');
    leavingLayer.style.pointerEvents = 'none';
    camera.appendChild(leavingLayer);

    const leaving = [];
    before.forEach((item, id) => {
      if (after.has(id)) return;
      const clone = item.clone;
      clone.removeAttribute('tabindex');
      clone.style.pointerEvents = 'none';
      clone.style.opacity = '1';
      setPoint(clone, item.point);
      leavingLayer.appendChild(clone);
      leaving.push({ id, element: clone, from: item.point });
    });

    const persistent = [];
    after.forEach((to, id) => {
      const element = afterElements.get(id);
      if (!element) return;
      const from = before.get(id)?.point || null;
      if (from) {
        setPoint(element, from);
        persistent.push({ id, element, from, to });
      }
    });

    const entering = [];
    after.forEach((to, id) => {
      if (before.has(id)) return;
      const element = afterElements.get(id);
      if (!element) return;
      const parentId = incomingParent(id);
      const origin = parentId && after.has(parentId) ? after.get(parentId) : anchor;
      setPoint(element, origin);
      element.style.opacity = '0';
      entering.push({ id, element, from: origin, to, parentId });
    });

    const finalEdges = edgeElements();
    finalEdges.forEach(edge => edge.style.opacity = '0');

    camera.style.opacity = '1';
    removeGuard();
    camera.style.opacity = '1';

    if (realReduced.matches) {
      persistent.forEach(item => setPoint(item.element, item.to));
      entering.forEach(item => { setPoint(item.element, item.to); item.element.style.opacity = ''; });
      finalEdges.forEach(edge => edge.style.opacity = '');
      leavingLayer.remove();
      window.__GRAPH_V6_FORCE_SNAP__ = false;
      return;
    }

    const duration = current.direction === 'up' ? 820 : 760;
    const started = performance.now();
    const cubic = t => t < .5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const clamp01 = value => Math.max(0, Math.min(1, value));

    const frame = now => {
      const raw = clamp01((now - started) / duration);
      const moveP = cubic(raw);

      persistent.forEach(item => {
        setPoint(item.element, {
          x: item.from.x + (item.to.x - item.from.x) * moveP,
          y: item.from.y + (item.to.y - item.from.y) * moveP
        });
      });

      const collapseRaw = current.direction === 'up'
        ? clamp01(raw / .66)
        : clamp01(raw / .58);
      const collapseP = cubic(collapseRaw);
      leaving.forEach(item => {
        setPoint(item.element, {
          x: item.from.x + (anchor.x - item.from.x) * collapseP,
          y: item.from.y + (anchor.y - item.from.y) * collapseP
        });
        item.element.style.opacity = String(1 - clamp01((collapseRaw - .62) / .38));
      });

      const enterStart = current.direction === 'up' ? .30 : .14;
      const enterRaw = clamp01((raw - enterStart) / (1 - enterStart));
      const enterP = cubic(enterRaw);
      entering.forEach(item => {
        setPoint(item.element, {
          x: item.from.x + (item.to.x - item.from.x) * enterP,
          y: item.from.y + (item.to.y - item.from.y) * enterP
        });
        item.element.style.opacity = String(clamp01(enterRaw * 1.35));
      });

      const currentPoints = new Map([...afterElements].map(([id, element]) => [id, pointOf(element)]));
      finalEdges.forEach(edge => {
        const source = currentPoints.get(edge.dataset.source);
        const targetPoint = currentPoints.get(edge.dataset.target);
        if (!source || !targetPoint) return;
        const route = normaliseRoute(document.body.dataset.graphRoute || location.hash);
        const activeNode = routeNode(route);
        const pathIds = activeNode ? new Set(primaryPath(activeNode).map(node => node.id)) : new Set();
        const straight = pathIds.has(edge.dataset.source) && pathIds.has(edge.dataset.target);
        edge.setAttribute('d', edgePath(source, targetPoint, `${edge.dataset.source}|${edge.dataset.target}`, straight));
        const sourceEntering = entering.some(item => item.id === edge.dataset.source);
        const targetEntering = entering.some(item => item.id === edge.dataset.target);
        edge.style.opacity = String(sourceEntering || targetEntering ? enterRaw : Math.max(.22, moveP));
      });

      if (raw < 1) {
        transitionFrame = requestAnimationFrame(frame);
        return;
      }

      persistent.forEach(item => setPoint(item.element, item.to));
      entering.forEach(item => {
        setPoint(item.element, item.to);
        item.element.style.opacity = '';
      });
      finalEdges.forEach(edge => edge.style.opacity = '');
      leavingLayer.remove();
      window.__GRAPH_V6_FORCE_SNAP__ = false;
    };

    transitionFrame = requestAnimationFrame(frame);
  };

  const scheduleTransition = () => {
    requestAnimationFrame(() => requestAnimationFrame(startTransition));
  };

  const routeFromControl = target => {
    const routeElement = target.closest?.('[data-route]');
    if (routeElement) return normaliseRoute(routeElement.dataset.route || routeElement.getAttribute('href'));

    const nodeElement = target.closest?.('.site-graph-node[data-node-id]');
    if (nodeElement) {
      const id = nodeElement.dataset.nodeId;
      if (id === rootId) return 'overview';
      if (id === 'work') return 'work';
      return routeForNode(nodeMap.get(id));
    }
    return null;
  };

  document.addEventListener('click', event => {
    if (event.button !== 0) return;
    const nodeElement = event.target.closest?.('.site-graph-node[data-node-id]');
    const route = routeFromControl(event.target);
    if (!route) return;
    prepare({
      targetId: nodeElement?.dataset.nodeId || routeTargetId(route),
      targetRoute: route,
      trigger: 'click'
    });
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      const nodeElement = event.target.closest?.('.site-graph-node[data-node-id]');
      const route = routeFromControl(event.target);
      if (route) prepare({ targetId: nodeElement?.dataset.nodeId || routeTargetId(route), targetRoute: route, trigger: 'keyboard' });
      return;
    }

    if (event.key === 'Escape') {
      const mode = document.body.dataset.graphMode;
      if (mode === 'atlas') return;
      const currentRoute = normaliseRoute(document.body.dataset.graphRoute || location.hash);
      const current = routeNode(currentRoute) || (currentRoute.startsWith('work') ? nodeMap.get('work') : rootNode);
      const target = mode === 'work'
        ? rootNode
        : nodeMap.get(current?.parentIds?.[0]) || rootNode;
      prepare({ targetId: target?.id, targetRoute: routeForNode(target), trigger: 'escape' });
    }
  }, true);

  window.addEventListener('popstate', () => {
    if (pending || document.body.dataset.graphMode === 'atlas') return;
    const route = normaliseRoute(location.hash);
    prepare({ targetId: routeTargetId(route), targetRoute: route, trigger: 'history' });
  }, true);

  window.addEventListener('hashchange', () => {
    if (!pending) return;
    scheduleTransition();
  });

  window.addEventListener('load', () => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      resetLabelGeometry();
      reflowFocus();
    }));
  }, { once: true });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (document.body.dataset.graphMode === 'focus') reflowFocus();
    }, 140);
  });
})();
