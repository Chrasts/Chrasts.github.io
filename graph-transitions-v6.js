(() => {
  window.__GRAPH_V6_RESTORE_MATCH_MEDIA__?.();

  const site = window.SITE_DATA;
  const graph = site?.graph;
  if (!graph?.nodes?.length) return;

  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const rootId = graph.rootId;
  const rootNode = nodeMap.get(rootId);
  const workData = site.work;
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
      nodes.set(element.dataset.nodeId, {
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
    const resolvedTargetRoute = normaliseRoute(
      targetRoute || routeForNode(nodeMap.get(targetId)) || location.hash
    );
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
    guardOverlay.classList.add('v7-static-guard');
    guardOverlay.style.pointerEvents = 'none';
    guardOverlay.style.opacity = '1';
    before.svg.appendChild(guardOverlay);
    before.camera.style.opacity = '0';

    // The underlying graph renderer should jump directly to its new layout;
    // this layer performs the visible transition from the captured state.
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
    for (const character of key) seed = (seed * 31 + character.charCodeAt(0)) >>> 0;
    const bend = Math.max(-40, Math.min(40, ((seed % 37) - 18) + Math.min(12, Math.abs(dx) * .027)));
    const nx = -dy / distance;
    const ny = dx / distance;
    const control = {
      x: (from.x + to.x) / 2 + nx * bend,
      y: (from.y + to.y) / 2 + ny * bend
    };
    return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${control.x.toFixed(1)} ${control.y.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
  };

  /* ------------------------------------------------------------------------
     Compact focus layout
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
    const current = { x: 620, y: 270 };
    const ancestorCount = Math.max(0, path.length - 1);

    // The root path occupies a compact diagonal corridor above-left of the
    // active node. Its total footprint is capped, so deeper navigation does not
    // stretch the whole scene or intrude into the current downset.
    if (ancestorCount) {
      const startX = current.x - Math.min(150, 42 + ancestorCount * 27);
      const startY = 112;
      const endX = current.x - 46;
      const endY = 214;

      path.slice(0, -1).forEach((node, index) => {
        const t = ancestorCount === 1 ? 1 : index / Math.max(1, ancestorCount - 1);
        const easeT = Math.pow(t, .9);
        positions.set(node.id, {
          x: startX + (endX - startX) * easeT,
          y: startY + (endY - startY) * t
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

    const direct = childrenFor(target.id)
      .filter(node => visibleIds.has(node.id))
      .sort((a, b) => a.label.localeCompare(b.label));

    const directY = target.id === 'experience' ? 458 : 448;
    const directPositions = placeTier(
      direct,
      directY,
      direct.length <= 3 ? 245 : 165,
      direct.length <= 3 ? 995 : 1035,
      direct.length > 5 ? 9 : 0
    );
    directPositions.forEach((point, id) => positions.set(id, point));

    // The next visible rank is always below its direct parent. This prevents a
    // newly opened subgraph from appearing above or inside the ancestor chain.
    const byParent = new Map();
    direct.forEach(parent => {
      const group = childrenFor(parent.id)
        .filter(node => visibleIds.has(node.id) && !positions.has(node.id));
      if (group.length) byParent.set(parent.id, group);
    });

    byParent.forEach((group, parentId) => {
      const parent = positions.get(parentId);
      if (!parent) return;
      const span = Math.min(260, Math.max(120, 86 * group.length));
      group.forEach((node, index) => {
        const t = group.length === 1 ? .5 : index / (group.length - 1);
        positions.set(node.id, {
          x: Math.max(115, Math.min(1085, parent.x - span / 2 + t * span)),
          y: 610 + (index % 2 ? 7 : -7)
        });
      });
    });

    const unplaced = [...visibleIds]
      .filter(id => !positions.has(id))
      .map(id => nodeMap.get(id))
      .filter(Boolean)
      .sort((a, b) => a.label.localeCompare(b.label));
    placeTier(unplaced, 610, 180, 1020, 7).forEach((point, id) => positions.set(id, point));

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
      timeline.setAttribute('y1', String(directY));
      timeline.setAttribute('y2', String(directY));
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

  /* ------------------------------------------------------------------------
     Direction-aware transition
     ------------------------------------------------------------------------ */
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
    const finalAnchor = after.get(finalTargetId) || after.get('work') || after.get(rootId) || { x: 620, y: 270 };
    const clickedBefore = before.get(current.targetId)?.point || before.get(finalTargetId)?.point || finalAnchor;

    const leavingLayer = document.createElementNS(svgNS, 'g');
    leavingLayer.classList.add('v7-leaving-layer');
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
      const from = before.get(id)?.point;
      if (!element || !from) return;
      setPoint(element, from);
      persistent.push({ id, element, from, to });
    });

    const entering = [];
    after.forEach((to, id) => {
      if (before.has(id)) return;
      const element = afterElements.get(id);
      if (!element) return;

      let origin = finalAnchor;
      if (current.direction === 'down') {
        // Every newly revealed descendant grows out of the node the user chose.
        origin = clickedBefore;
      } else if (current.direction === 'up') {
        // New siblings in the broader segment emerge only after the old downset
        // has collapsed into the selected ancestor.
        origin = finalAnchor;
      } else {
        const parentId = incomingParent(id);
        origin = parentId && after.has(parentId) ? after.get(parentId) : finalAnchor;
      }

      setPoint(element, origin);
      element.style.opacity = '0';
      entering.push({ id, element, from: origin, to });
    });

    const finalEdges = edgeElements();
    finalEdges.forEach(edge => edge.style.opacity = '0');

    camera.style.opacity = '1';
    removeGuard();
    camera.style.opacity = '1';

    if (realReduced.matches) {
      persistent.forEach(item => setPoint(item.element, item.to));
      entering.forEach(item => {
        setPoint(item.element, item.to);
        item.element.style.opacity = '';
      });
      finalEdges.forEach(edge => edge.style.opacity = '');
      leavingLayer.remove();
      window.__GRAPH_V6_FORCE_SNAP__ = false;
      return;
    }

    const duration = current.direction === 'up' ? 980 : current.direction === 'down' ? 900 : 820;
    const started = performance.now();
    const cubic = t => t < .5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const clamp01 = value => Math.max(0, Math.min(1, value));
    const lerpPoint = (from, to, t) => ({
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t
    });

    const targetPersistent = persistent.find(item => item.id === finalTargetId);

    const frame = now => {
      const raw = clamp01((now - started) / duration);
      const moveP = cubic(raw);

      persistent.forEach(item => setPoint(item.element, lerpPoint(item.from, item.to, moveP)));

      // Going UP: the old downset visibly folds back into the selected ancestor.
      // Going DOWN: the old surrounding segment simply dissolves in place.
      if (current.direction === 'up') {
        const collapseRaw = clamp01(raw / .68);
        const collapseP = cubic(collapseRaw);
        leaving.forEach(item => {
          setPoint(item.element, lerpPoint(item.from, finalAnchor, collapseP));
          item.element.style.opacity = String(1 - clamp01((collapseRaw - .66) / .34));
        });
      } else {
        const fadeRaw = current.direction === 'down'
          ? clamp01(raw / .48)
          : clamp01(raw / .58);
        leaving.forEach(item => {
          // Intentionally no spatial movement here. Siblings and their labels
          // fade away instead of nonsensically collapsing into a deeper node.
          setPoint(item.element, item.from);
          item.element.style.opacity = String(1 - cubic(fadeRaw));
        });
      }

      const enterStart = current.direction === 'up' ? .46 : current.direction === 'down' ? .20 : .28;
      const enterRaw = clamp01((raw - enterStart) / (1 - enterStart));
      const enterP = cubic(enterRaw);

      let movingOrigin = current.direction === 'down' && targetPersistent
        ? lerpPoint(targetPersistent.from, targetPersistent.to, moveP)
        : current.direction === 'down'
          ? clickedBefore
          : finalAnchor;

      entering.forEach(item => {
        const origin = current.direction === 'down' ? movingOrigin : item.from;
        setPoint(item.element, lerpPoint(origin, item.to, enterP));
        item.element.style.opacity = String(clamp01(enterRaw * 1.28));
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
        const touchesEntering = entering.some(item => item.id === edge.dataset.source || item.id === edge.dataset.target);
        edge.style.opacity = String(touchesEntering ? enterRaw : Math.max(.18, moveP));
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

  /* ------------------------------------------------------------------------
     Work concept inspection — graph nodes never change theme filters
     ------------------------------------------------------------------------ */
  const detailPanel = () => document.querySelector('#site-detail-panel');

  const closeConceptDetail = () => {
    const panel = detailPanel();
    if (!panel) return;
    panel.classList.remove('is-open');
    setTimeout(() => {
      if (!panel.classList.contains('is-open')) panel.hidden = true;
    }, realReduced.matches ? 0 : 180);
  };

  const openWorkConceptDetail = intent => {
    const panel = detailPanel();
    if (!panel || !workData) return;

    const attributeMap = new Map(workData.attributes.map(attribute => [attribute.id, attribute]));
    const themeIds = [...intent].filter(id => attributeMap.has(id));
    if (!themeIds.length) return;

    const projects = workData.projects
      .filter(project => themeIds.every(id => project.lattice.includes(id)))
      .sort((a, b) => a.order - b.order);
    const labels = themeIds.map(id => attributeMap.get(id).label);

    panel.innerHTML = '';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'detail-close';
    close.setAttribute('aria-label', 'Close Work concept detail');
    close.textContent = '×';
    close.addEventListener('click', closeConceptDetail);

    const eyebrow = document.createElement('p');
    eyebrow.className = 'detail-eyebrow';
    eyebrow.textContent = themeIds.length === 1 ? 'Work theme' : 'Work theme intersection';

    const heading = document.createElement('h2');
    heading.textContent = labels.join(' ∩ ');

    const summary = document.createElement('p');
    summary.className = 'detail-summary';
    summary.textContent = themeIds.length === 1
      ? `Projects classified under ${labels[0]}. Theme filters are changed only from the controls on the right.`
      : `Projects lying in the intersection of ${labels.join(', ')}. Theme filters are changed only from the controls on the right.`;

    panel.append(close, eyebrow, heading, summary);

    const listHeading = document.createElement('p');
    listHeading.className = 'detail-list-title';
    listHeading.textContent = projects.length
      ? `Projects in this ${themeIds.length === 1 ? 'theme' : 'intersection'}`
      : 'Projects';
    panel.appendChild(listHeading);

    if (projects.length) {
      const list = document.createElement('div');
      list.className = 'detail-node-list is-secondary';
      projects.forEach(project => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = project.graphLabel || project.title;
        button.addEventListener('click', () => {
          location.hash = `#work/project/${project.id}`;
        });
        list.appendChild(button);
      });
      panel.appendChild(list);
    } else {
      const empty = document.createElement('p');
      empty.className = 'detail-meta';
      empty.textContent = 'No project is currently assigned to this intersection.';
      panel.appendChild(empty);
    }

    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add('is-open'));
  };

  const workConceptIntentFromNode = element => {
    const id = element?.dataset.nodeId || '';
    if (!id.startsWith('work-concept:')) return null;
    const key = id.slice('work-concept:'.length);
    return key && key !== 'top' ? key.split('|').filter(Boolean) : [];
  };

  const interceptWorkGraphControl = (event, keyboard = false) => {
    if (document.body.dataset.graphMode !== 'work') return false;

    const conceptNode = event.target.closest?.('.site-graph-node[data-node-id^="work-concept:"]');
    if (conceptNode) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const intent = workConceptIntentFromNode(conceptNode);
      if (intent?.length) openWorkConceptDetail(intent);
      return true;
    }

    const themeLabel = event.target.closest?.('.work-theme-label-v5[data-theme-id]');
    if (themeLabel) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openWorkConceptDetail([themeLabel.dataset.themeId]);
      return true;
    }

    // The active Work top node is no longer a filter-reset control.
    const workNode = event.target.closest?.('.site-graph-node[data-node-id="work"]');
    if (workNode) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return true;
    }

    return false;
  };

  const routeFromControl = target => {
    const routeElement = target.closest?.('[data-route]');
    if (routeElement) return normaliseRoute(routeElement.dataset.route || routeElement.getAttribute('href'));

    const nodeElement = target.closest?.('.site-graph-node[data-node-id]');
    if (nodeElement) {
      const id = nodeElement.dataset.nodeId;
      if (id.startsWith('work-concept:')) return null;
      if (id === rootId) return 'overview';
      if (id === 'work') return 'work';
      return routeForNode(nodeMap.get(id));
    }
    return null;
  };

  document.addEventListener('click', event => {
    if (event.button !== 0) return;
    if (interceptWorkGraphControl(event)) return;

    const nodeElement = event.target.closest?.('.site-graph-node[data-node-id]');
    const route = routeFromControl(event.target);
    if (!route) return;
    const currentRoute = normaliseRoute(document.body.dataset.graphRoute || location.hash);
    if (nodeElement && route === currentRoute) return;

    prepare({
      targetId: nodeElement?.dataset.nodeId || routeTargetId(route),
      targetRoute: route,
      trigger: 'click'
    });
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      if (interceptWorkGraphControl(event, true)) return;
      const nodeElement = event.target.closest?.('.site-graph-node[data-node-id]');
      const route = routeFromControl(event.target);
      const currentRoute = normaliseRoute(document.body.dataset.graphRoute || location.hash);
      if (route && !(nodeElement && route === currentRoute)) {
        prepare({
          targetId: nodeElement?.dataset.nodeId || routeTargetId(route),
          targetRoute: route,
          trigger: 'keyboard'
        });
      }
      return;
    }

    if (event.key === 'Escape') {
      const panel = detailPanel();
      if (panel && !panel.hidden) return;
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