(() => {
  window.__GRAPH_V6_RESTORE_MATCH_MEDIA__?.();

  const site = window.SITE_DATA;
  const graph = site?.graph;
  if (!graph?.nodes?.length) return;

  const sceneTransitions = window.ProfileScene?.transitions || null;
  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const rootId = graph.rootId;
  const rootNode = nodeMap.get(rootId);
  const svgNS = 'http://www.w3.org/2000/svg';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';

  const routeNode = route => route === 'overview'
    ? rootNode
    : graph.nodes.find(node => node.route === route) || null;

  const routeForNode = node => node?.route || 'overview';
  const childrenFor = id => graph.nodes.filter(node => node.parentIds?.includes(id));
  const externalTransitionOwnsRoute = () =>
    document.body?.classList.contains('is-atlas-handoff') ||
    document.body?.classList.contains('is-crosslink-travelling');

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
    for (const character of String(value)) {
      number = Math.imul(number ^ character.charCodeAt(0), 16777619);
    }
    return number >>> 0;
  };

  const graphSvg = () => document.querySelector('#site-graph .site-graph-svg');
  const graphCamera = () => {
    const svg = graphSvg();
    if (!svg) return null;
    const edges = svg.querySelector(':scope > g > .site-graph-edges');
    return edges?.parentElement || svg.firstElementChild;
  };
  const nodeElements = () => [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
    .filter(element => !element.closest('.v9-transition-overlay'));
  const edgeElements = () => [...document.querySelectorAll('#site-graph .site-graph-edges path[data-source][data-target]')]
    .filter(element => !element.closest('.v9-transition-overlay'));

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

  const setTransitionOpacity = (element, value) => {
    if (!element) return;
    element.style.setProperty('opacity', String(value), 'important');
  };

  const labelGeometry = element => {
    const label = element?.querySelector('.site-graph-label');
    if (!label) return null;
    return {
      anchor: label.getAttribute('text-anchor') || 'middle',
      x: Number(label.getAttribute('x') || 0),
      y: Number(label.getAttribute('y') || 0),
      text: label.textContent || ''
    };
  };

  const sameLabelGeometry = (left, right) => Boolean(
    left && right &&
    left.anchor === right.anchor &&
    left.x === right.x &&
    left.y === right.y &&
    left.text === right.text
  );

  const prepareLabelMorph = (overlayNode, liveNode) => {
    const fromLabel = overlayNode?.querySelector('.site-graph-label');
    const liveLabel = liveNode?.querySelector('.site-graph-label');
    if (!fromLabel || !liveLabel) return null;
    if (sameLabelGeometry(labelGeometry(overlayNode), labelGeometry(liveNode))) return null;

    const targetLabel = liveLabel.cloneNode(true);
    targetLabel.classList.add('v9-target-label');
    targetLabel.style.pointerEvents = 'none';
    setTransitionOpacity(targetLabel, 0);
    overlayNode.appendChild(targetLabel);
    return { fromLabel, targetLabel };
  };

  const paintLabelMorph = (morph, raw) => {
    if (!morph) return;
    const phase = Math.max(0, Math.min(1, (raw - .18) / .56));
    const eased = phase < .5
      ? 4 * phase * phase * phase
      : 1 - Math.pow(-2 * phase + 2, 3) / 2;
    setTransitionOpacity(morph.fromLabel, 1 - eased);
    setTransitionOpacity(morph.targetLabel, eased);
  };

  const edgePath = (from, to, key, straight = false) => {
    if (!from || !to) return '';
    if (straight || Math.abs(from.x - to.x) < 4) {
      return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} L ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
    }
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const bend = Math.max(
      -34,
      Math.min(34, ((stableNumber(key) % 37) - 18) + Math.min(10, Math.abs(dx) * .023))
    );
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
    if (routeElement) {
      return normaliseRoute(routeElement.dataset.route || routeElement.getAttribute('href'));
    }

    const nodeElement = target.closest?.('.site-graph-node[data-node-id]');
    if (!nodeElement) return null;
    const id = nodeElement.dataset.nodeId;
    if (id.startsWith('work-concept:')) return null;
    if (id === rootId) return 'overview';
    if (id === 'work') return 'work';
    return routeForNode(nodeMap.get(id));
  };

  /* ----------------------------------------------------------------------
     Stable compact Focus layout
     ---------------------------------------------------------------------- */
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

  const visibleDepthsFrom = (targetId, visibleIds) => {
    const depth = new Map([[targetId, 0]]);
    const queue = [targetId];
    while (queue.length) {
      const parentId = queue.shift();
      const nextDepth = depth.get(parentId) + 1;
      childrenFor(parentId).forEach(child => {
        if (!visibleIds.has(child.id)) return;
        if (!depth.has(child.id) || nextDepth < depth.get(child.id)) {
          depth.set(child.id, nextDepth);
          queue.push(child.id);
        }
      });
    }
    return depth;
  };

  const arrangeRank = ({ rankNodes, rank, positions, target, targetId, visibleIds }) => {
    if (!rankNodes.length) return [];

    const left = rank === 1 ? 155 : 125;
    const right = rank === 1 ? 1045 : 1075;
    const y = rank === 1 ? 446 : 610;
    const parentBarycentre = node => {
      const xs = (node.parentIds || [])
        .filter(id => visibleIds.has(id))
        .map(id => positions.get(id)?.x)
        .filter(Number.isFinite);
      return xs.length ? xs.reduce((sum, x) => sum + x, 0) / xs.length : target.x;
    };

    let ordered = [...rankNodes];
    const explicitOrder = node => Number.isFinite(node.layoutOrder)
      ? node.layoutOrder
      : Number.isFinite(node.timelineOrder)
        ? node.timelineOrder
        : Number.POSITIVE_INFINITY;
    if (ordered.some(node => Number.isFinite(explicitOrder(node)))) {
      ordered.sort((a, b) => explicitOrder(a) - explicitOrder(b) || a.label.localeCompare(b.label));
    } else if (targetId === 'experience' && rank === 1) {
      ordered.sort((a, b) => (a.timelineOrder || 0) - (b.timelineOrder || 0));
    } else {
      ordered.sort((a, b) => parentBarycentre(a) - parentBarycentre(b) || a.label.localeCompare(b.label));
    }

    const items = ordered.map((node, index) => {
      let x;
      if (rank === 1) {
        const t = ordered.length === 1 ? .5 : index / (ordered.length - 1);
        x = ordered.length === 1
          ? target.x + (stableNumber(node.id) % 2 ? 132 : -132)
          : left + t * (right - left);
        if (Math.abs(x - target.x) < 86) {
          x += stableNumber(`${node.id}:fan`) % 2 ? 102 : -102;
        }
      } else {
        x = parentBarycentre(node);
        const onlyParent = (node.parentIds || []).filter(id => positions.has(id));
        if (onlyParent.length === 1 && Math.abs(x - positions.get(onlyParent[0]).x) < 30) {
          x += stableNumber(`${node.id}:branch`) % 2 ? 76 : -76;
        }
      }
      return {
        id: node.id,
        node,
        x,
        y: y + (index % 2 ? 8 : -8),
        barycentre: parentBarycentre(node)
      };
    });

    const gap = rank === 1
      ? (items.length > 5 ? 128 : 158)
      : (items.length > 6 ? 122 : 142);
    return enforceSpacing(items, left, right, gap);
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
      const start = {
        x: current.x - Math.min(154, 72 + ancestors.length * 20),
        y: 112
      };
      const end = { x: current.x - 54, y: current.y - 60 };
      ancestors.forEach((node, index) => {
        const t = ancestors.length === 1 ? 1 : index / Math.max(1, ancestors.length - 1);
        positions.set(node.id, {
          x: start.x + (end.x - start.x) * Math.pow(t, .88),
          y: start.y + (end.y - start.y) * t
        });
        const label = elements.get(node.id)?.querySelector('.site-graph-label');
        if (label) {
          label.setAttribute('text-anchor', 'end');
          label.setAttribute('x', '-15');
          label.setAttribute('y', '4');
        }
      });
    }

    positions.set(target.id, current);
    const depthMap = visibleDepthsFrom(target.id, visibleIds);
    const descendantNodes = [...visibleIds]
      .map(id => nodeMap.get(id))
      .filter(Boolean)
      .filter(node => depthMap.has(node.id) && depthMap.get(node.id) > 0);

    [1, 2].forEach(rank => {
      const rankNodes = descendantNodes.filter(node => depthMap.get(node.id) === rank);
      const items = arrangeRank({
        rankNodes,
        rank,
        positions,
        target: current,
        targetId: target.id,
        visibleIds
      });
      items.forEach(item => positions.set(item.id, { x: item.x, y: item.y }));
    });

    const fallback = [...visibleIds]
      .filter(id => !positions.has(id))
      .map(id => nodeMap.get(id))
      .filter(Boolean)
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((node, index, list) => ({
        id: node.id,
        node,
        x: 180 + (index + .5) * (840 / Math.max(1, list.length)),
        y: 612 + (index % 2 ? 8 : -8)
      }));
    enforceSpacing(fallback, 130, 1070, fallback.length > 6 ? 120 : 140)
      .forEach(item => positions.set(item.id, { x: item.x, y: item.y }));

    positions.forEach((point, id) => setPoint(elements.get(id), point));
    syncUnderlyingEdges(positions, target);

    const timeline = document.querySelector('#site-graph .site-graph-timeline');
    if (timeline && target.id === 'experience') {
      timeline.setAttribute('x1', '155');
      timeline.setAttribute('x2', '1045');
      timeline.setAttribute('y1', '448');
      timeline.setAttribute('y2', '448');
    }
  };

  const syncUnderlyingEdges = (positions = null, targetNode = null) => {
    const elements = new Map(nodeElements().map(element => [element.dataset.nodeId, element]));
    const points = positions || new Map([...elements].map(([id, element]) => [id, pointOf(element)]));
    const route = normaliseRoute(document.body.dataset.graphRoute || location.hash);
    const active = targetNode || routeNode(route);
    const pathIds = active ? new Set(primaryPath(active).map(node => node.id)) : new Set();

    edgeElements().forEach(edge => {
      const source = points.get(edge.dataset.source) || pointOf(elements.get(edge.dataset.source));
      const target = points.get(edge.dataset.target) || pointOf(elements.get(edge.dataset.target));
      if (!source || !target) return;
      const straight = pathIds.has(edge.dataset.source) && pathIds.has(edge.dataset.target);
      edge.setAttribute(
        'd',
        edgePath(source, target, `${edge.dataset.source}|${edge.dataset.target}`, straight)
      );
      edge.style.opacity = '';
    });
  };

  /* ----------------------------------------------------------------------
     Transition state
     ---------------------------------------------------------------------- */
  let pending = null;
  let activeTransition = null;
  let carriedSnapshot = null;
  let transitionFrame = 0;
  let transitionOperation = 0;
  let lastStableRoute = normaliseRoute(document.body.dataset.graphRoute || location.hash);

  const currentRouteNode = route =>
    routeNode(route) || (route.startsWith('work') ? nodeMap.get('work') : rootNode);

  const opacityOf = element => {
    const value = Number.parseFloat(getComputedStyle(element).opacity);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
  };

  const flattenTransitionClone = source => {
    const clone = source.cloneNode(true);
    clone.removeAttribute('tabindex');
    clone.style.pointerEvents = 'none';
    const sourceFrom = source.querySelector('.site-graph-label:not(.v9-target-label)');
    const sourceTarget = source.querySelector('.v9-target-label');
    const cloneFrom = clone.querySelector('.site-graph-label:not(.v9-target-label)');
    if (sourceFrom && sourceTarget && cloneFrom && opacityOf(sourceTarget) > opacityOf(sourceFrom)) {
      ['text-anchor', 'x', 'y'].forEach(name => {
        const value = sourceTarget.getAttribute(name);
        if (value != null) cloneFrom.setAttribute(name, value);
      });
      cloneFrom.textContent = sourceTarget.textContent || cloneFrom.textContent;
    }
    clone.querySelectorAll('.v9-target-label').forEach(label => label.remove());
    clone.querySelectorAll('.site-graph-label').forEach(label => label.style.removeProperty('opacity'));
    clone.classList.remove('is-feel-pressed', 'is-feel-activating');
    return clone;
  };

  const visualOverlayNodes = () => activeTransition?.overlayNodes || pending?.overlayNodes || null;

  const captureVisualSnapshot = () => {
    const source = visualOverlayNodes();
    if (!source) return null;
    const before = new Map();
    source.querySelectorAll(':scope > .site-graph-node[data-node-id]').forEach(element => {
      const opacity = opacityOf(element);
      if (opacity <= .015) return;
      const id = element.dataset.nodeId;
      before.set(id, {
        point: pointOf(element),
        clone: flattenTransitionClone(element),
        opacity
      });
    });
    return before.size ? {
      before,
      route: normaliseRoute(document.body.dataset.graphRoute || location.hash),
      capturedAt: performance.now()
    } : null;
  };

  const cleanupTransitionShell = current => {
    current?.overlay?.remove();
    const camera = graphCamera();
    camera?.style.removeProperty('opacity');
    current?.camera?.style?.removeProperty?.('opacity');
    document.body.classList.remove('is-v9-transitioning');
    window.__GRAPH_V6_FORCE_SNAP__ = false;
  };

  const interruptTransition = ({ reason = 'interrupted', preserveVisual = true } = {}) => {
    const hadTransition = Boolean(pending || activeTransition || document.body.classList.contains('is-v9-transitioning'));
    if (!hadTransition) return false;
    const snapshot = preserveVisual ? captureVisualSnapshot() : null;
    transitionOperation += 1;
    cancelAnimationFrame(transitionFrame);
    transitionFrame = 0;
    pending?.overlay?.remove();
    activeTransition?.overlay?.remove();
    pending = null;
    activeTransition = null;
    const camera = graphCamera();
    camera?.style.removeProperty('opacity');
    document.body.classList.remove('is-v9-transitioning');
    window.__GRAPH_V6_FORCE_SNAP__ = false;
    carriedSnapshot = snapshot;
    window.dispatchEvent(new CustomEvent('profile:graph-transition-interrupted', {
      detail: {
        reason,
        route: normaliseRoute(document.body.dataset.graphRoute || location.hash),
        capturedNodeCount: snapshot?.before?.size || 0,
        operation: transitionOperation
      }
    }));
    return true;
  };

  sceneTransitions?.registerParticipant?.('graph-transition', {
    capture: () => ({
      active: Boolean(pending || activeTransition || document.body.classList.contains('is-v9-transitioning')),
      route: normaliseRoute(document.body.dataset.graphRoute || location.hash),
      nodeCount: visualOverlayNodes()?.querySelectorAll(':scope > .site-graph-node[data-node-id]').length || 0,
      operation: transitionOperation
    }),
    cancel: payload => interruptTransition({ reason: payload?.reason || 'coordinator-interrupt' })
  });

  const prepare = ({ targetId = null, targetRoute = null, trigger = 'click' } = {}) => {
    if (document.body.dataset.graphMode === 'atlas') return;
    if (externalTransitionOwnsRoute()) return;
    if (document.body.classList.contains('is-v9-transitioning') || pending || activeTransition) {
      interruptTransition({ reason: 'direct-retarget' });
    }

    const svg = graphSvg();
    const camera = graphCamera();
    if (!svg || !camera) return;

    const currentRoute = normaliseRoute(document.body.dataset.graphRoute || location.hash);
    const resolvedTargetRoute = normaliseRoute(
      targetRoute || routeForNode(nodeMap.get(targetId)) || location.hash
    );
    if (resolvedTargetRoute === currentRoute || resolvedTargetRoute === 'atlas') return;

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
    const carried = carriedSnapshot;
    carriedSnapshot = null;

    if (carried?.before?.size) {
      carried.before.forEach((item, id) => {
        const clone = item.clone;
        clone.style.pointerEvents = 'none';
        setTransitionOpacity(clone, item.opacity);
        setPoint(clone, item.point);
        overlayNodes.appendChild(clone);
        before.set(id, { point: item.point, clone, opacity: item.opacity });
      });
    } else {
      nodeElements().forEach(element => {
        const id = element.dataset.nodeId;
        const clone = element.cloneNode(true);
        clone.removeAttribute('tabindex');
        clone.style.pointerEvents = 'none';
        setTransitionOpacity(clone, 1);
        const point = pointOf(element);
        setPoint(clone, point);
        overlayNodes.appendChild(clone);
        before.set(id, { point, clone, opacity: 1 });
      });
    }

    if (!reduced.matches) camera.style.opacity = '0';
    document.body.classList.add('is-v9-transitioning');
    window.__GRAPH_V6_FORCE_SNAP__ = true;

    const operation = ++transitionOperation;
    pending = {
      currentRoute,
      targetRoute: resolvedTargetRoute,
      currentId: currentNode?.id || null,
      targetId: targetNode?.id || targetId || routeTargetId(resolvedTargetRoute),
      direction,
      trigger,
      operation,
      retargeted: Boolean(carried?.before?.size),
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
    const distance = 54 + (stableNumber(`${id}:out`) % 18);
    return {
      x: from.x + (dx / length) * distance,
      y: from.y + (dy / length) * distance * .32 - 4
    };
  };

  const preservedIdsFor = current => {
    const target = nodeMap.get(current.targetId) || currentRouteNode(current.targetRoute);
    if (!target) return new Set([rootId]);
    return new Set(primaryPath(target).map(node => node.id));
  };

  const commitFinalGeometry = ({ afterElements, after, finalEdges, activeNode, camera }) => {
    after.forEach((point, id) => {
      const element = afterElements.get(id);
      if (!element) return;
      setPoint(element, point);
      element.style.opacity = '';
    });

    const pathIds = activeNode ? new Set(primaryPath(activeNode).map(node => node.id)) : new Set();
    finalEdges.forEach(edge => {
      const source = after.get(edge.dataset.source);
      const target = after.get(edge.dataset.target);
      if (!source || !target) return;
      const straight = pathIds.has(edge.dataset.source) && pathIds.has(edge.dataset.target);
      edge.setAttribute(
        'd',
        edgePath(source, target, `${edge.dataset.source}|${edge.dataset.target}`, straight)
      );
      edge.style.opacity = '';
    });

    camera.querySelectorAll(':scope > .site-graph-decorations > *').forEach(element => {
      element.style.opacity = '';
    });
  };

  const finishTransition = current => {
    if (!current || current.operation !== transitionOperation || activeTransition !== current) return false;
    const mode = document.body.dataset.graphMode;
    if (mode === 'focus') reflowFocus();
    else syncUnderlyingEdges();

    const camera = graphCamera();
    if (camera) camera.style.opacity = '';
    current.overlay.remove();
    document.body.classList.remove('is-v9-transitioning');
    window.__GRAPH_V6_FORCE_SNAP__ = false;
    lastStableRoute = normaliseRoute(document.body.dataset.graphRoute || location.hash);
    activeTransition = null;

    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (current.operation !== transitionOperation) return;
      if (document.body.classList.contains('is-v9-transitioning')) return;
      if (document.body.dataset.graphMode === 'focus') reflowFocus();
      else syncUnderlyingEdges();
    }));
    return true;
  };

  const startTransition = () => {
    if (!pending) return;
    const current = pending;
    pending = null;
    if (current.operation !== transitionOperation) {
      cleanupTransitionShell(current);
      return;
    }
    activeTransition = current;

    if (externalTransitionOwnsRoute() || current.targetRoute === 'atlas') {
      cleanupTransitionShell(current);
      activeTransition = null;
      return;
    }

    resetLabelGeometry();
    reflowFocus();

    const camera = graphCamera();
    if (!camera) {
      cleanupTransitionShell(current);
      activeTransition = null;
      return;
    }
    current.camera = camera;
    if (!reduced.matches) camera.style.opacity = '0';

    const afterElements = new Map(nodeElements().map(element => [element.dataset.nodeId, element]));
    const after = new Map([...afterElements].map(([id, element]) => [id, pointOf(element)]));
    const activeRoute = normaliseRoute(document.body.dataset.graphRoute || location.hash);
    const activeNode = routeNode(activeRoute) || (activeRoute.startsWith('work') ? nodeMap.get('work') : null);

    const finalTargetId = current.targetId && after.has(current.targetId)
      ? current.targetId
      : routeTargetId(activeRoute);
    const targetBefore = current.before.get(current.targetId)?.point || current.before.get(finalTargetId)?.point;
    const targetAfter = after.get(finalTargetId) || after.get('work') || after.get(rootId) || { x: 620, y: 270 };

    const preservedIds = preservedIdsFor(current);
    const persistent = [];
    const leaving = [];

    current.before.forEach((item, id) => {
      const preserved = preservedIds.has(id) && after.has(id);
      if (preserved) {
        persistent.push({
          id,
          element: item.clone,
          from: item.point,
          to: after.get(id),
          fromOpacity: Number.isFinite(item.opacity) ? item.opacity : 1,
          labelMorph: prepareLabelMorph(item.clone, afterElements.get(id))
        });
      } else {
        leaving.push({
          id,
          element: item.clone,
          from: item.point,
          fromOpacity: Number.isFinite(item.opacity) ? item.opacity : 1
        });
      }
    });

    const persistentMap = new Map(persistent.map(item => [item.id, item]));
    const targetPersistent = persistentMap.get(finalTargetId) || persistentMap.get(current.targetId) || null;

    const entering = [];
    after.forEach((to, id) => {
      if (preservedIds.has(id) && current.before.has(id)) return;
      const source = afterElements.get(id);
      if (!source) return;
      const clone = source.cloneNode(true);
      clone.removeAttribute('tabindex');
      clone.style.pointerEvents = 'none';
      setTransitionOpacity(clone, 0);
      const origin = current.direction === 'down'
        ? (targetBefore || targetAfter)
        : targetAfter;
      setPoint(clone, origin);
      current.overlayNodes.appendChild(clone);
      entering.push({ id, element: clone, from: origin, to });
    });

    const finalEdges = edgeElements();
    const transitionEdges = finalEdges.map(source => {
      const clone = source.cloneNode(true);
      clone.classList.remove('is-upstream', 'is-downstream', 'is-lateral', 'is-muted-soft', 'is-work-soft', 'is-work-strong', 'is-selected-downset');
      clone.style.visibility = 'hidden';
      setTransitionOpacity(clone, 0);
      current.overlayEdges.appendChild(clone);
      return clone;
    });

    const finalDecorations = [...camera.querySelectorAll(':scope > .site-graph-decorations > *')];
    finalDecorations.forEach(source => {
      const clone = source.cloneNode(true);
      setTransitionOpacity(clone, 0);
      clone.style.pointerEvents = 'none';
      current.overlayDecorations.appendChild(clone);
    });

    if (reduced.matches) {
      commitFinalGeometry({ afterElements, after, finalEdges, activeNode, camera });
      finishTransition(current);
      return;
    }

    const duration = current.direction === 'up' ? 1160 : current.direction === 'down' ? 1080 : 980;
    const started = performance.now();

    const frame = now => {
      if (current.operation !== transitionOperation || activeTransition !== current) return;
      const raw = clamp01((now - started) / duration);
      const moveP = ease(raw);
      const currentPoints = new Map();

      persistent.forEach(item => {
        const point = lerpPoint(item.from, item.to, moveP);
        setPoint(item.element, point);
        setTransitionOpacity(item.element, item.fromOpacity + (1 - item.fromOpacity) * moveP);
        paintLabelMorph(item.labelMorph, raw);
        currentPoints.set(item.id, point);
      });

      const movingTarget = targetPersistent
        ? lerpPoint(targetPersistent.from, targetPersistent.to, moveP)
        : targetAfter;

      if (current.direction === 'up') {
        const collapseRaw = clamp01(raw / .66);
        const collapseP = ease(collapseRaw);
        leaving.forEach(item => {
          const point = lerpPoint(item.from, movingTarget, collapseP);
          setPoint(item.element, point);
          const fade = clamp01((collapseRaw - .58) / .42);
          setTransitionOpacity(item.element, item.fromOpacity * (1 - ease(fade)));
        });
      } else if (current.direction === 'down') {
        const fadeRaw = clamp01(raw / .12);
        leaving.forEach(item => {
          const away = outwardPoint(item.from, targetBefore || targetAfter, item.id);
          setPoint(item.element, lerpPoint(item.from, away, ease(fadeRaw)));
          setTransitionOpacity(item.element, item.fromOpacity * (1 - ease(fadeRaw)));
        });
      } else {
        const fadeRaw = clamp01(raw / .48);
        leaving.forEach(item => {
          setPoint(item.element, item.from);
          setTransitionOpacity(item.element, item.fromOpacity * (1 - ease(fadeRaw)));
        });
      }

      const enterStart = current.direction === 'up' ? .57 : current.direction === 'down' ? .25 : .34;
      const enterRaw = clamp01((raw - enterStart) / (1 - enterStart));
      const enterP = ease(enterRaw);

      entering.forEach(item => {
        const origin = current.direction === 'down' ? movingTarget : targetAfter;
        const point = lerpPoint(origin, item.to, enterP);
        setPoint(item.element, point);
        setTransitionOpacity(item.element, clamp01(enterRaw * 1.35));
        currentPoints.set(item.id, point);
      });

      after.forEach((point, id) => {
        if (!currentPoints.has(id)) currentPoints.set(id, point);
      });

      const edgeStart = current.direction === 'up' ? .62 : current.direction === 'down' ? .36 : .48;
      const edgeRaw = clamp01((raw - edgeStart) / (1 - edgeStart));
      const pathIds = activeNode ? new Set(primaryPath(activeNode).map(node => node.id)) : new Set();

      transitionEdges.forEach(edge => {
        const source = currentPoints.get(edge.dataset.source);
        const target = currentPoints.get(edge.dataset.target);
        if (!source || !target) return;
        const straight = pathIds.has(edge.dataset.source) && pathIds.has(edge.dataset.target);
        edge.setAttribute(
          'd',
          edgePath(source, target, `${edge.dataset.source}|${edge.dataset.target}`, straight)
        );
        edge.style.visibility = edgeRaw > 0 ? 'visible' : 'hidden';
        setTransitionOpacity(edge, ease(edgeRaw));
      });

      const decorationStart = .60;
      const decorationRaw = clamp01((raw - decorationStart) / (1 - decorationStart));
      [...current.overlayDecorations.children].forEach(element => {
        setTransitionOpacity(element, ease(decorationRaw));
      });

      if (raw < 1) {
        transitionFrame = requestAnimationFrame(frame);
        return;
      }

      commitFinalGeometry({ afterElements, after, finalEdges, activeNode, camera });
      finishTransition(current);
    };

    transitionFrame = requestAnimationFrame(frame);
  };

  const scheduleTransition = () => {
    requestAnimationFrame(() => requestAnimationFrame(startTransition));
  };

  /* ----------------------------------------------------------------------
     Navigation capture
     ---------------------------------------------------------------------- */
  document.addEventListener('click', event => {
    if (event.button !== 0 || event.defaultPrevented || externalTransitionOwnsRoute()) return;
    const route = routeFromControl(event.target);
    if (!route || route === 'atlas') return;
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
      if (event.defaultPrevented || externalTransitionOwnsRoute()) return;
      const route = routeFromControl(event.target);
      if (!route || route === 'atlas') return;
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
      if (mode === 'atlas' || externalTransitionOwnsRoute()) return;
      const currentRoute = normaliseRoute(document.body.dataset.graphRoute || location.hash);
      const current = currentRouteNode(currentRoute);
      const target = mode === 'work'
        ? rootNode
        : nodeMap.get(current?.parentIds?.[0]) || rootNode;
      prepare({
        targetId: target?.id,
        targetRoute: routeForNode(target),
        trigger: 'escape'
      });
    }
  }, true);

  window.addEventListener('popstate', () => {
    if (document.body.dataset.graphMode === 'atlas' || externalTransitionOwnsRoute()) return;
    if (pending || activeTransition || document.body.classList.contains('is-v9-transitioning')) {
      interruptTransition({ reason: 'history-retarget' });
    }
    const targetRoute = normaliseRoute(location.hash);
    const currentRoute = normaliseRoute(document.body.dataset.graphRoute || lastStableRoute);
    if (targetRoute === currentRoute || targetRoute === 'atlas') return;
    prepare({
      targetId: routeTargetId(targetRoute),
      targetRoute,
      trigger: 'history'
    });
  }, true);

  window.addEventListener('hashchange', () => {
    if (pending && !externalTransitionOwnsRoute()) scheduleTransition();
    else if (!activeTransition) lastStableRoute = normaliseRoute(document.body.dataset.graphRoute || location.hash);
  });

  window.addEventListener('load', () => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      resetLabelGeometry();
      reflowFocus();
      if (document.body.dataset.graphMode !== 'focus') syncUnderlyingEdges();
    }));
  }, { once: true });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (document.body.classList.contains('is-v9-transitioning')) return;
      if (document.body.dataset.graphMode === 'focus') reflowFocus();
      else syncUnderlyingEdges();
    }, 140);
  });

  window.ProfileGraphTransitions = Object.freeze({
    interrupt: options => interruptTransition(options || {}),
    capture: () => {
      const snapshot = captureVisualSnapshot();
      return snapshot ? {
        route: snapshot.route,
        capturedAt: snapshot.capturedAt,
        nodeCount: snapshot.before.size
      } : null;
    },
    snapshot: () => ({
      operation: transitionOperation,
      pending: pending ? { from: pending.currentRoute, to: pending.targetRoute, retargeted: pending.retargeted } : null,
      active: activeTransition ? { from: activeTransition.currentRoute, to: activeTransition.targetRoute, retargeted: activeTransition.retargeted } : null,
      carriedNodeCount: carriedSnapshot?.before?.size || 0,
      transitioning: document.body.classList.contains('is-v9-transitioning')
    })
  });
})();
