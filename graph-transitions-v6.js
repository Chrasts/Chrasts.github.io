(() => {
  window.__GRAPH_V6_RESTORE_MATCH_MEDIA__?.();

  const site = window.SITE_DATA;
  const graph = site?.graph;
  if (!graph?.nodes?.length) return;

  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const rootId = graph.rootId;
  const rootNode = nodeMap.get(rootId);
  const svgNS = 'http://www.w3.org/2000/svg';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

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

  const stableNumber = value => {
    let number = 2166136261;
    for (const character of String(value)) number = Math.imul(number ^ character.charCodeAt(0), 16777619);
    return number >>> 0;
  };

  const graphSvg = () => document.querySelector('#site-graph .site-graph-svg');
  const graphCamera = () => {
    const svg = graphSvg();
    if (!svg) return null;
    return svg.querySelector('.site-graph-edges')?.parentElement || svg.firstElementChild;
  };
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

  const edgePath = (from, to, key, straight = false) => {
    if (!from || !to) return '';
    if (straight || Math.abs(from.x - to.x) < 4) {
      return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} L ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
    }
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const bend = Math.max(-34, Math.min(34, ((stableNumber(key) % 37) - 18) + Math.min(10, Math.abs(dx) * .023)));
    const nx = -dy / distance;
    const ny = dx / distance;
    const control = {
      x: (from.x + to.x) / 2 + nx * bend,
      y: (from.y + to.y) / 2 + ny * bend
    };
    return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${control.x.toFixed(1)} ${control.y.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
  };

  const routeTargetId = route => {
    if (route === 'overview') return rootId;
    if (route === 'work' || route.startsWith('work/')) return 'work';
    return routeNode(route)?.id || null;
  };

  const routeFromControl = target => {
    const routeElement = target.closest?.('[data-route]');
    if (routeElement) return normaliseRoute(routeElement.dataset.route || routeElement.getAttribute('href'));

    const nodeElement = target.closest?.('.site-graph-node[data-node-id]');
    if (!nodeElement) return null;
    const id = nodeElement.dataset.nodeId;
    if (id.startsWith('work-concept:')) return null;
    if (id === rootId) return 'overview';
    if (id === 'work') return 'work';
    return routeForNode(nodeMap.get(id));
  };

  /* ------------------------------------------------------------------------
     Focus layout

     Ancestors occupy a short corridor above-left. The displayed downset uses
     rank-aware placement and barycentric ordering, with small offsets that stop
     parent/child chains from stacking directly behind one another.
     ------------------------------------------------------------------------ */
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

  const enforceSpacing = (items, left, right, gap) => {
    if (!items.length) return items;
    items.sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));

    for (let i = 1; i < items.length; i += 1) {
      items[i].x = Math.max(items[i].x, items[i - 1].x + gap);
    }
    if (items.at(-1).x > right) {
      const shift = items.at(-1).x - right;
      items.forEach(item => item.x -= shift);
    }
    for (let i = items.length - 2; i >= 0; i -= 1) {
      items[i].x = Math.min(items[i].x, items[i + 1].x - gap);
    }
    if (items[0].x < left) {
      const shift = left - items[0].x;
      items.forEach(item => item.x += shift);
    }
    return items;
  };

  const arrangeDirect = (nodes, current) => {
    if (!nodes.length) return [];
    const left = nodes.length <= 3 ? 235 : 150;
    const right = nodes.length <= 3 ? 1020 : 1050;
    const items = nodes.map((node, index) => {
      const t = nodes.length === 1 ? .5 : index / (nodes.length - 1);
      let x = left + t * (right - left);

      if (nodes.length === 1) {
        x = current.x + (stableNumber(node.id) % 2 ? 125 : -125);
      } else if (Math.abs(x - current.x) < 92) {
        const direction = stableNumber(`${node.id}:fan`) % 2 ? 1 : -1;
        x += direction * 105;
      }

      return {
        id: node.id,
        node,
        x,
        y: 448 + (index % 2 ? 10 : -8)
      };
    });
    return enforceSpacing(items, 145, 1055, nodes.length > 5 ? 132 : 165);
  };

  const arrangeSecondRank = (nodes, directItems, visibleIds) => {
    const directPosition = new Map(directItems.map(item => [item.id, item]));
    const secondMap = new Map();

    nodes.forEach(parent => {
      childrenFor(parent.id)
        .filter(child => visibleIds.has(child.id))
        .forEach(child => {
          if (!secondMap.has(child.id)) secondMap.set(child.id, { node: child, parentIds: [] });
          secondMap.get(child.id).parentIds.push(parent.id);
        });
    });

    const items = [...secondMap.values()].map(({ node, parentIds }, index) => {
      const parentXs = parentIds.map(id => directPosition.get(id)?.x).filter(Number.isFinite);
      let x = parentXs.length
        ? parentXs.reduce((sum, value) => sum + value, 0) / parentXs.length
        : 600;

      if (parentXs.length === 1 && Math.abs(x - parentXs[0]) < 62) {
        x += stableNumber(`${node.id}:branch`) % 2 ? 74 : -74;
      }

      return {
        id: node.id,
        node,
        x,
        y: 610 + (index % 2 ? 8 : -8),
        barycentre: parentXs.length ? parentXs.reduce((sum, value) => sum + value, 0) / parentXs.length : x
      };
    });

    items.sort((a, b) => a.barycentre - b.barycentre || a.node.label.localeCompare(b.node.label));
    return enforceSpacing(items, 125, 1075, items.length > 6 ? 126 : 145);
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
    const current = { x: 620, y: 270 };
    const ancestors = path.slice(0, -1);

    if (ancestors.length) {
      const totalRise = Math.min(118, 76 + ancestors.length * 12);
      const start = { x: current.x - Math.min(158, 70 + ancestors.length * 22), y: current.y - totalRise - 48 };
      const end = { x: current.x - 54, y: current.y - 58 };

      ancestors.forEach((node, index) => {
        const t = ancestors.length === 1 ? 1 : index / Math.max(1, ancestors.length - 1);
        const point = {
          x: start.x + (end.x - start.x) * Math.pow(t, .88),
          y: start.y + (end.y - start.y) * t
        };
        positions.set(node.id, point);

        const label = elements.get(node.id)?.querySelector('.site-graph-label');
        if (label) {
          label.setAttribute('text-anchor', 'end');
          label.setAttribute('x', '-15');
          label.setAttribute('y', '4');
        }
      });
    }

    positions.set(target.id, current);

    const direct = childrenFor(target.id)
      .filter(node => visibleIds.has(node.id))
      .sort((a, b) => a.label.localeCompare(b.label));
    const directItems = arrangeDirect(direct, current);
    directItems.forEach(item => positions.set(item.id, { x: item.x, y: item.y }));

    const secondItems = arrangeSecondRank(direct, directItems, visibleIds)
      .filter(item => !positions.has(item.id));
    secondItems.forEach(item => positions.set(item.id, { x: item.x, y: item.y }));

    const unplaced = [...visibleIds]
      .filter(id => !positions.has(id))
      .map(id => nodeMap.get(id))
      .filter(Boolean)
      .sort((a, b) => a.label.localeCompare(b.label));

    const fallback = unplaced.map((node, index) => ({
      id: node.id,
      node,
      x: 180 + (index + .5) * (840 / Math.max(1, unplaced.length)),
      y: 615 + (index % 2 ? 8 : -8)
    }));
    enforceSpacing(fallback, 130, 1070, fallback.length > 6 ? 122 : 142)
      .forEach(item => positions.set(item.id, { x: item.x, y: item.y }));

    positions.forEach((point, id) => setPoint(elements.get(id), point));

    const pathIds = new Set(path.map(node => node.id));
    edgeElements().forEach(edge => {
      const source = positions.get(edge.dataset.source) || pointOf(elements.get(edge.dataset.source));
      const targetPoint = positions.get(edge.dataset.target) || pointOf(elements.get(edge.dataset.target));
      if (!source || !targetPoint) return;
      const straight = pathIds.has(edge.dataset.source) && pathIds.has(edge.dataset.target);
      edge.setAttribute('d', edgePath(source, targetPoint, `${edge.dataset.source}|${edge.dataset.target}`, straight));
    });

    const timeline = document.querySelector('#site-graph .site-graph-timeline');
    if (timeline && target.id === 'experience') {
      timeline.setAttribute('x1', '155');
      timeline.setAttribute('x2', '1045');
      timeline.setAttribute('y1', '450');
      timeline.setAttribute('y2', '450');
    }
  };

  /* ------------------------------------------------------------------------
     Transition snapshot and preparation
     ------------------------------------------------------------------------ */
  let pending = null;
  let transitionFrame = 0;
  let lastStableRoute = normaliseRoute(document.body.dataset.graphRoute || location.hash);

  const currentRouteNode = route => routeNode(route) || (route.startsWith('work') ? nodeMap.get('work') : rootNode);

  const prepare = ({ targetId = null, targetRoute = null, trigger = 'click' } = {}) => {
    if (document.body.dataset.graphMode === 'atlas' || document.body.classList.contains('is-v9-transitioning')) return;

    const svg = graphSvg();
    const camera = graphCamera();
    if (!svg || !camera) return;

    const currentRoute = normaliseRoute(document.body.dataset.graphRoute || location.hash);
    const resolvedTargetRoute = normaliseRoute(targetRoute || routeForNode(nodeMap.get(targetId)) || location.hash);
    if (resolvedTargetRoute === currentRoute) return;

    const currentNode = currentRouteNode(currentRoute);
    const targetNode = targetId ? nodeMap.get(targetId) : currentRouteNode(resolvedTargetRoute);

    let direction = 'lateral';
    if (targetNode && currentNode) {
      if (isAncestor(targetNode.id, currentNode.id) || targetNode.id === rootId) direction = 'up';
      else if (isAncestor(currentNode.id, targetNode.id)) direction = 'down';
    }
    if (currentRoute.startsWith('work') && resolvedTargetRoute === 'overview') direction = 'up';
    if (currentRoute === 'overview' && resolvedTargetRoute.startsWith('work')) direction = 'down';

    cancelAnimationFrame(transitionFrame);

    const overlay = document.createElementNS(svgNS, 'g');
    overlay.classList.add('v9-transition-overlay');
    const overlayEdges = document.createElementNS(svgNS, 'g');
    overlayEdges.classList.add('site-graph-edges', 'v9-new-edges');
    const overlayDecorations = document.createElementNS(svgNS, 'g');
    overlayDecorations.classList.add('site-graph-decorations', 'v9-new-decorations');
    const overlayNodes = document.createElementNS(svgNS, 'g');
    overlayNodes.classList.add('site-graph-nodes', 'v9-transition-nodes');
    overlay.append(overlayEdges, overlayDecorations, overlayNodes);
    svg.appendChild(overlay);

    const before = new Map();
    const leavingWork = document.body.dataset.graphMode === 'work' && !resolvedTargetRoute.startsWith('work');

    nodeElements().forEach(element => {
      const id = element.dataset.nodeId;
      if (leavingWork && id.startsWith('work-concept:')) return;
      const clone = element.cloneNode(true);
      clone.removeAttribute('tabindex');
      clone.style.pointerEvents = 'none';
      clone.style.opacity = '1';
      const point = pointOf(element);
      setPoint(clone, point);
      overlayNodes.appendChild(clone);
      before.set(id, { point, clone });
    });

    // No old edge is copied. The previous segment therefore loses all of its
    // edges at the exact start of navigation. Work decorations are intentionally
    // omitted as well, so the Work lattice disappears immediately on exit.
    camera.style.opacity = '0';
    document.body.classList.add('is-v9-transitioning');
    window.__GRAPH_V6_FORCE_SNAP__ = true;

    pending = {
      currentRoute,
      targetRoute: resolvedTargetRoute,
      currentId: currentNode?.id || null,
      targetId: targetNode?.id || targetId || routeTargetId(resolvedTargetRoute),
      direction,
      trigger,
      before,
      overlay,
      overlayEdges,
      overlayDecorations,
      overlayNodes,
      camera
    };
  };

  const lerpPoint = (from, to, t) => ({
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t
  });
  const clamp01 = value => Math.max(0, Math.min(1, value));
  const ease = t => t < .5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const outwardPoint = (from, anchor, id) => {
    let dx = from.x - anchor.x;
    let dy = from.y - anchor.y;
    if (Math.abs(dx) < 20) dx = stableNumber(id) % 2 ? 1 : -1;
    const length = Math.max(1, Math.hypot(dx, dy));
    const horizontal = Math.abs(dx) / length;
    const distance = 52 + (stableNumber(`${id}:out`) % 19);
    return {
      x: from.x + Math.sign(dx) * distance * (.72 + horizontal * .28),
      y: from.y + (dy / length) * distance * .22 - 4
    };
  };

  const finishTransition = current => {
    current.overlay.remove();
    current.camera.style.opacity = '';
    document.body.classList.remove('is-v9-transitioning');
    window.__GRAPH_V6_FORCE_SNAP__ = false;
    lastStableRoute = normaliseRoute(document.body.dataset.graphRoute || location.hash);
  };

  const startTransition = () => {
    if (!pending) return;
    const current = pending;
    pending = null;

    // site-graph.js has already rendered the destination while its camera was
    // hidden. Reflow that destination before reading final positions.
    resetLabelGeometry();
    reflowFocus();

    const camera = graphCamera();
    if (!camera) {
      finishTransition(current);
      return;
    }
    current.camera = camera;
    camera.style.opacity = '0';

    const afterElements = new Map(nodeElements().map(element => [element.dataset.nodeId, element]));
    const after = new Map([...afterElements].map(([id, element]) => [id, pointOf(element)]));
    const finalTargetId = current.targetId && after.has(current.targetId)
      ? current.targetId
      : routeTargetId(normaliseRoute(document.body.dataset.graphRoute || location.hash));

    const targetBefore = current.before.get(finalTargetId)?.point || current.before.get(current.targetId)?.point;
    const targetAfter = after.get(finalTargetId) || after.get('work') || after.get(rootId) || { x: 620, y: 270 };

    const persistent = [];
    const leaving = [];
    current.before.forEach((item, id) => {
      if (after.has(id)) {
        persistent.push({ id, element: item.clone, from: item.point, to: after.get(id) });
      } else {
        leaving.push({ id, element: item.clone, from: item.point });
      }
    });

    const persistentMap = new Map(persistent.map(item => [item.id, item]));
    const targetPersistent = persistentMap.get(finalTargetId) || persistentMap.get(current.targetId) || null;

    const entering = [];
    after.forEach((to, id) => {
      if (current.before.has(id)) return;
      const source = afterElements.get(id);
      if (!source) return;
      const clone = source.cloneNode(true);
      clone.removeAttribute('tabindex');
      clone.style.pointerEvents = 'none';
      clone.style.opacity = '0';

      const origin = current.direction === 'down'
        ? (targetBefore || targetAfter)
        : current.direction === 'up'
          ? targetAfter
          : targetAfter;
      setPoint(clone, origin);
      current.overlayNodes.appendChild(clone);
      entering.push({ id, element: clone, from: origin, to });
    });

    const finalEdgeElements = edgeElements();
    const transitionEdges = finalEdgeElements.map(source => {
      const clone = source.cloneNode(true);
      clone.style.opacity = '0';
      current.overlayEdges.appendChild(clone);
      return clone;
    });

    const finalDecorations = [...camera.querySelectorAll(':scope > .site-graph-decorations > *')];
    finalDecorations.forEach(source => {
      const clone = source.cloneNode(true);
      clone.style.opacity = '0';
      clone.style.pointerEvents = 'none';
      current.overlayDecorations.appendChild(clone);
    });

    if (reduced.matches) {
      finishTransition(current);
      return;
    }

    const duration = current.direction === 'up' ? 1160 : current.direction === 'down' ? 1080 : 980;
    const started = performance.now();

    const frame = now => {
      const raw = clamp01((now - started) / duration);
      const moveP = ease(raw);

      const currentPoints = new Map();

      persistent.forEach(item => {
        const point = lerpPoint(item.from, item.to, moveP);
        setPoint(item.element, point);
        currentPoints.set(item.id, point);
      });

      const movingTarget = targetPersistent
        ? lerpPoint(targetPersistent.from, targetPersistent.to, moveP)
        : targetAfter;

      if (current.direction === 'up') {
        const collapseRaw = clamp01(raw / .66);
        const collapseP = ease(collapseRaw);
        leaving.forEach(item => {
          // Collapse follows the selected ancestor while that ancestor itself
          // moves into its broader-fragment position.
          const point = lerpPoint(item.from, movingTarget, collapseP);
          setPoint(item.element, point);
          const fade = clamp01((collapseRaw - .58) / .42);
          item.element.style.opacity = String(1 - ease(fade));
        });
      } else if (current.direction === 'down') {
        const fadeRaw = clamp01(raw / .38);
        leaving.forEach(item => {
          // Siblings from the old fragment never collapse into the node chosen
          // by the user. They leave quickly, with a small outward drift.
          const away = outwardPoint(item.from, targetBefore || targetAfter, item.id);
          setPoint(item.element, lerpPoint(item.from, away, ease(fadeRaw)));
          item.element.style.opacity = String(1 - ease(fadeRaw));
        });
      } else {
        const fadeRaw = clamp01(raw / .48);
        leaving.forEach(item => {
          setPoint(item.element, item.from);
          item.element.style.opacity = String(1 - ease(fadeRaw));
        });
      }

      const enterStart = current.direction === 'up' ? .57 : current.direction === 'down' ? .25 : .34;
      const enterRaw = clamp01((raw - enterStart) / (1 - enterStart));
      const enterP = ease(enterRaw);

      entering.forEach(item => {
        const origin = current.direction === 'down'
          ? movingTarget
          : current.direction === 'up'
            ? movingTarget
            : item.from;
        const point = lerpPoint(origin, item.to, enterP);
        setPoint(item.element, point);
        item.element.style.opacity = String(clamp01(enterRaw * 1.35));
        currentPoints.set(item.id, point);
      });

      // Persistent nodes not touched above still need a point for edge drawing.
      after.forEach((point, id) => {
        if (!currentPoints.has(id) && !entering.some(item => item.id === id)) currentPoints.set(id, point);
      });

      const edgeStart = current.direction === 'up' ? .62 : current.direction === 'down' ? .36 : .48;
      const edgeRaw = clamp01((raw - edgeStart) / (1 - edgeStart));
      const activeRoute = normaliseRoute(document.body.dataset.graphRoute || location.hash);
      const activeNode = routeNode(activeRoute);
      const pathIds = activeNode ? new Set(primaryPath(activeNode).map(node => node.id)) : new Set();

      transitionEdges.forEach(edge => {
        const source = currentPoints.get(edge.dataset.source);
        const targetPoint = currentPoints.get(edge.dataset.target);
        if (!source || !targetPoint) return;
        const straight = pathIds.has(edge.dataset.source) && pathIds.has(edge.dataset.target);
        edge.setAttribute('d', edgePath(source, targetPoint, `${edge.dataset.source}|${edge.dataset.target}`, straight));
        edge.style.opacity = String(ease(edgeRaw));
      });

      const decorationStart = current.direction === 'work' ? .5 : .60;
      const decorationRaw = clamp01((raw - decorationStart) / (1 - decorationStart));
      [...current.overlayDecorations.children].forEach(element => {
        element.style.opacity = String(ease(decorationRaw));
      });

      if (raw < 1) {
        transitionFrame = requestAnimationFrame(frame);
        return;
      }

      finishTransition(current);
    };

    transitionFrame = requestAnimationFrame(frame);
  };

  const scheduleTransition = () => {
    requestAnimationFrame(() => requestAnimationFrame(startTransition));
  };

  /* ------------------------------------------------------------------------
     Navigation capture
     ------------------------------------------------------------------------ */
  document.addEventListener('click', event => {
    if (event.button !== 0 || event.defaultPrevented) return;
    const route = routeFromControl(event.target);
    if (!route) return;
    const currentRoute = normaliseRoute(document.body.dataset.graphRoute || location.hash);
    if (route === currentRoute) return;

    const node = event.target.closest?.('.site-graph-node[data-node-id]');
    prepare({
      targetId: node?.dataset.nodeId || routeTargetId(route),
      targetRoute: route,
      trigger: 'click'
    });
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      if (event.defaultPrevented) return;
      const route = routeFromControl(event.target);
      if (!route) return;
      const currentRoute = normaliseRoute(document.body.dataset.graphRoute || location.hash);
      if (route === currentRoute) return;
      const node = event.target.closest?.('.site-graph-node[data-node-id]');
      prepare({
        targetId: node?.dataset.nodeId || routeTargetId(route),
        targetRoute: route,
        trigger: 'keyboard'
      });
      return;
    }

    if (event.key === 'Escape') {
      const panel = document.querySelector('#site-detail-panel');
      if (panel && !panel.hidden) return;
      const mode = document.body.dataset.graphMode;
      if (mode === 'atlas') return;
      const currentRoute = normaliseRoute(document.body.dataset.graphRoute || location.hash);
      const current = currentRouteNode(currentRoute);
      const target = mode === 'work'
        ? rootNode
        : nodeMap.get(current?.parentIds?.[0]) || rootNode;
      prepare({ targetId: target?.id, targetRoute: routeForNode(target), trigger: 'escape' });
    }
  }, true);

  window.addEventListener('popstate', () => {
    if (pending || document.body.dataset.graphMode === 'atlas') return;
    const targetRoute = normaliseRoute(location.hash);
    const currentRoute = normaliseRoute(document.body.dataset.graphRoute || lastStableRoute);
    if (targetRoute === currentRoute) return;
    prepare({ targetId: routeTargetId(targetRoute), targetRoute, trigger: 'history' });
  }, true);

  window.addEventListener('hashchange', () => {
    if (pending) scheduleTransition();
    else lastStableRoute = normaliseRoute(document.body.dataset.graphRoute || location.hash);
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
      if (!document.body.classList.contains('is-v9-transitioning')) reflowFocus();
    }, 140);
  });
})();