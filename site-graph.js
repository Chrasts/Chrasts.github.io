(() => {
  const site = window.SITE_DATA;
  const graph = site?.graph;
  if (!site?.profile || !graph?.nodes?.length) return;

  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const childrenFor = id => graph.nodes.filter(node => node.parentIds?.includes(id));
  const root = nodeMap.get(graph.rootId);
  const hero = document.querySelector('.hero');
  const explorer = document.querySelector('#site-explorer');
  const graphRoot = document.querySelector('#site-graph');
  const graphPanel = graphRoot?.closest('.site-graph-panel');
  const sceneCanvas = document.querySelector('.scene-canvas');
  const graphRoutebar = document.querySelector('.graph-routebar');
  const breadcrumb = document.querySelector('#graph-breadcrumb');
  const workBreadcrumb = document.querySelector('#work-breadcrumb');
  const workRouteHeader = document.querySelector('#work-route-header');
  const workRouteBack = document.querySelector('#work-route-back');
  const detailPanel = document.querySelector('#site-detail-panel');
  const graphTitle = document.querySelector('#site-graph-title');
  const graphKicker = document.querySelector('#site-graph-kicker');
  const graphHelp = document.querySelector('#site-graph-help');
  const graphStatus = document.querySelector('#site-graph-status');
  const atlasControls = document.querySelector('#atlas-controls');
  const atlasHierarchy = document.querySelector('#atlas-hierarchy');
  const atlasCrosslinks = document.querySelector('#atlas-crosslinks');
  const atlasSecondary = document.querySelector('#atlas-secondary');
  const atlasShowAll = document.querySelector('#atlas-show-all');
  const atlasFit = document.querySelector('#atlas-fit');
  const atlasZoomIn = document.querySelector('#atlas-zoom-in');
  const atlasZoomOut = document.querySelector('#atlas-zoom-out');
  const atlasReset = document.querySelector('#atlas-reset');
  const workView = document.querySelector('#work');
  const legacyViews = [...document.querySelectorAll('.legacy-section')];
  const footer = document.querySelector('footer');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  if (!root || !hero || !explorer || !graphRoot || !graphPanel || !sceneCanvas || !breadcrumb || !detailPanel || !workView) return;

  // Work is a specialised graph state, not a separate document below the app.
  // Moving it into the shared canvas lets it preserve the same scene bounds,
  // z-order, and graph-path navigation as every other route.
  if (workView.parentElement !== sceneCanvas) sceneCanvas.appendChild(workView);

  let state = { route: 'overview', mode: 'overview', node: root };
  const atlasOptions = { hierarchy: true, crossLinks: true, secondary: false };
  const atlasTransform = { x: 0, y: 0, scale: 1, targetX: 0, targetY: 0, targetScale: 1, frame: 0 };
  const renderer = {
    svg: null,
    camera: null,
    edges: null,
    nodes: null,
    nodeElements: new Map(),
    edgeElements: new Map(),
    frame: 0,
    lastEdges: [],
    lastLayout: null,
    drag: null,
    timeline: null
  };

  const normaliseRoute = value => (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';

  const nodeForRoute = route => {
    if (route === 'overview') return root;
    return graph.nodes.find(node => node.route === route) || null;
  };

  const routeForNode = node => node?.route || 'overview';

  const ancestorIdsFor = nodeId => {
    const ancestors = new Set();
    const pending = [...(nodeMap.get(nodeId)?.parentIds || [])];
    while (pending.length) {
      const parentId = pending.pop();
      if (ancestors.has(parentId)) continue;
      ancestors.add(parentId);
      pending.push(...(nodeMap.get(parentId)?.parentIds || []));
    }
    return ancestors;
  };

  const edgeTypeLabel = type => ({
    hierarchy: 'Hierarchy',
    'hierarchy-alt': 'Additional hierarchy',
    evidence: 'Evidence in work',
    'used-in': 'Used in work',
    'experience-link': 'Experience connection',
    'education-link': 'Education connection',
    related: 'Related'
  }[type] || 'Profile connection');

  const primaryPath = node => {
    const path = [];
    const visited = new Set();
    let current = node;

    while (current && !visited.has(current.id)) {
      path.unshift(current);
      visited.add(current.id);
      current = current.parentIds?.length ? nodeMap.get(current.parentIds[0]) : null;
    }

    return path;
  };

  const humanType = type => ({
    section: 'Profile area',
    knowledge: 'Knowledge',
    experience: 'Experience',
    education: 'Education',
    credential: 'Credential',
    interest: 'About',
    project: 'Project',
    profile: 'Profile'
  }[type] || 'Profile item');

  const updateHash = route => {
    const target = `#${route}`;
    if (location.hash !== target) location.hash = target;
    else renderRoute(route);
  };

  const routeFromElement = element => element.dataset.route || normaliseRoute(element.getAttribute('href'));

  const bindRoute = element => {
    element.addEventListener('click', event => {
      event.preventDefault();
      updateHash(routeFromElement(element));
    });
  };

  document.querySelectorAll('[data-route]').forEach(bindRoute);

  const paintAtlasTransform = () => {
    renderer.camera?.setAttribute('transform', `translate(${atlasTransform.x} ${atlasTransform.y}) scale(${atlasTransform.scale})`);
  };

  const settleAtlasTransform = (immediate = false) => {
    cancelAnimationFrame(atlasTransform.frame);
    if (immediate || reducedMotion.matches) {
      atlasTransform.x = atlasTransform.targetX;
      atlasTransform.y = atlasTransform.targetY;
      atlasTransform.scale = atlasTransform.targetScale;
      paintAtlasTransform();
      return;
    }
    const frame = () => {
      atlasTransform.x += (atlasTransform.targetX - atlasTransform.x) * .24;
      atlasTransform.y += (atlasTransform.targetY - atlasTransform.y) * .24;
      atlasTransform.scale += (atlasTransform.targetScale - atlasTransform.scale) * .24;
      paintAtlasTransform();
      const settled = Math.abs(atlasTransform.targetX - atlasTransform.x) < .08 &&
        Math.abs(atlasTransform.targetY - atlasTransform.y) < .08 &&
        Math.abs(atlasTransform.targetScale - atlasTransform.scale) < .001;
      if (settled) {
        atlasTransform.x = atlasTransform.targetX;
        atlasTransform.y = atlasTransform.targetY;
        atlasTransform.scale = atlasTransform.targetScale;
        paintAtlasTransform();
        return;
      }
      atlasTransform.frame = requestAnimationFrame(frame);
    };
    atlasTransform.frame = requestAnimationFrame(frame);
  };

  const zoomAtlasAt = (point, factor) => {
    const previousScale = atlasTransform.targetScale;
    const nextScale = Math.max(.45, Math.min(2.8, previousScale * factor));
    if (nextScale === previousScale) return;
    const graphPoint = {
      x: (point.x - atlasTransform.targetX) / previousScale,
      y: (point.y - atlasTransform.targetY) / previousScale
    };
    atlasTransform.targetScale = nextScale;
    atlasTransform.targetX = point.x - graphPoint.x * nextScale;
    atlasTransform.targetY = point.y - graphPoint.y * nextScale;
    settleAtlasTransform();
  };

  const syncAtlasControls = () => {
    if (!atlasControls) return;
    atlasControls.hidden = state.mode !== 'atlas';
    if (atlasHierarchy) atlasHierarchy.checked = atlasOptions.hierarchy;
    if (atlasCrosslinks) atlasCrosslinks.checked = atlasOptions.crossLinks;
    if (atlasSecondary) atlasSecondary.checked = atlasOptions.secondary;
  };

  [atlasHierarchy, atlasCrosslinks, atlasSecondary].filter(Boolean).forEach(control => {
    control.addEventListener('change', () => {
      atlasOptions.hierarchy = atlasHierarchy?.checked ?? true;
      atlasOptions.crossLinks = atlasCrosslinks?.checked ?? true;
      atlasOptions.secondary = atlasSecondary?.checked ?? false;
      if (state.mode !== 'atlas') return;
      renderGraph();
      graphStatus.textContent = 'Atlas structure filters updated.';
    });
  });
  atlasShowAll?.addEventListener('click', () => {
    atlasOptions.hierarchy = true;
    atlasOptions.crossLinks = true;
    atlasOptions.secondary = true;
    syncAtlasControls();
    if (state.mode === 'atlas') {
      renderGraph();
      graphStatus.textContent = 'Atlas now shows all available relationships.';
    }
  });
  const fitAtlas = () => {
    atlasTransform.targetX = 0;
    atlasTransform.targetY = 0;
    atlasTransform.targetScale = 1;
    settleAtlasTransform();
  };
  atlasFit?.addEventListener('click', fitAtlas);
  atlasReset?.addEventListener('click', fitAtlas);
  atlasZoomIn?.addEventListener('click', () => {
    const layout = renderer.lastLayout;
    if (layout) zoomAtlasAt({ x: layout.width / 2, y: layout.height / 2 }, 1.22);
  });
  atlasZoomOut?.addEventListener('click', () => {
    const layout = renderer.lastLayout;
    if (layout) zoomAtlasAt({ x: layout.width / 2, y: layout.height / 2 }, 1 / 1.22);
  });

  const renderBreadcrumb = (target, container, atlas = false) => {
    container.innerHTML = '';
    const path = atlas ? [root, { label: 'Atlas', route: 'atlas' }] : primaryPath(target);

    path.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'graph-crumb';
      button.textContent = item.label;
      button.dataset.route = item.route || 'overview';
      button.setAttribute('aria-current', String(index === path.length - 1));
      bindRoute(button);
      container.appendChild(button);

      if (index < path.length - 1) {
        const edge = document.createElement('span');
        edge.className = 'graph-crumb-edge';
        edge.setAttribute('aria-hidden', 'true');
        container.appendChild(edge);
      }
    });
  };

  const visibleGraph = () => {
    if (state.mode === 'overview') {
      const nodes = [root, ...childrenFor(root.id)];
      return { nodes, hierarchyOnly: true };
    }

    if (state.mode === 'atlas') return { nodes: graph.nodes, hierarchyOnly: false };

    const visible = new Map(primaryPath(state.node).map(node => [node.id, node]));
    const children = childrenFor(state.node.id);
    children.slice(0, 7).forEach(node => visible.set(node.id, node));
    if (children.length <= 4) {
      children.forEach(child => childrenFor(child.id).slice(0, 2).forEach(grandchild => {
        if (visible.size < 12) visible.set(grandchild.id, grandchild);
      }));
    }
    return { nodes: [...visible.values()], hierarchyOnly: true };
  };

  const depthFor = (node, memo = new Map(), trail = new Set()) => {
    if (memo.has(node.id)) return memo.get(node.id);
    if (node.id === root.id || !node.parentIds?.length || trail.has(node.id)) return 0;
    const nextTrail = new Set(trail).add(node.id);
    const depth = 1 + Math.min(...node.parentIds
      .map(parentId => nodeMap.get(parentId))
      .filter(Boolean)
      .map(parent => depthFor(parent, memo, nextTrail)));
    memo.set(node.id, depth);
    return depth;
  };

  const stableNumber = value => {
    let number = 2166136261;
    for (const character of value) number = Math.imul(number ^ character.charCodeAt(0), 16777619);
    return number >>> 0;
  };

  const nodeFootprint = node => ({
    width: Math.max(72, Math.min(178, (node.detailLabel || node.label).length * 7.4 + 34)),
    height: node.id === root.id ? 62 : node.type === 'section' ? 48 : 42
  });

  // Semantic positions come first; this pass only separates colliding labels
  // and nodes, including labels whose width differs substantially.
  const resolveCollisions = (nodes, positions, width, height, padding = 64) => {
    const items = nodes.filter(node => positions.has(node.id));
    for (let pass = 0; pass < 96; pass += 1) {
      let changed = false;
      for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
          const left = items[leftIndex];
          const right = items[rightIndex];
          const leftPoint = positions.get(left.id);
          const rightPoint = positions.get(right.id);
          const leftBox = nodeFootprint(left);
          const rightBox = nodeFootprint(right);
          const neededX = (leftBox.width + rightBox.width) / 2 + 16;
          const neededY = (leftBox.height + rightBox.height) / 2 + 12;
          const differenceX = rightPoint.x - leftPoint.x;
          const differenceY = rightPoint.y - leftPoint.y;
          const overlapX = neededX - Math.abs(differenceX);
          const overlapY = neededY - Math.abs(differenceY);
          if (overlapX <= 0 || overlapY <= 0) continue;

          const horizontal = overlapX < overlapY * 1.65 || Math.abs(differenceY) < 18;
          const direction = horizontal
            ? (differenceX || ((stableNumber(`${left.id}:${right.id}`) % 2) ? 1 : -1))
            : (differenceY || ((stableNumber(`${left.id}:${right.id}`) % 2) ? 1 : -1));
          const movement = (horizontal ? overlapX : overlapY) / 2 + 1;
          if (horizontal) {
            leftPoint.x -= Math.sign(direction) * movement;
            rightPoint.x += Math.sign(direction) * movement;
          } else {
            leftPoint.y -= Math.sign(direction) * movement;
            rightPoint.y += Math.sign(direction) * movement;
          }
          changed = true;
        }
      }
      items.forEach(node => {
        const point = positions.get(node.id);
        const box = nodeFootprint(node);
        point.x = Math.max(padding + box.width / 2, Math.min(width - padding - box.width / 2, point.x));
        point.y = Math.max(padding + box.height / 2, Math.min(height - padding - box.height / 2, point.y));
      });
      if (!changed) break;
    }
    return positions;
  };

  const layoutGraph = nodes => {
    if (state.mode === 'overview') {
      const width = 1200;
      const height = 720;
      const positions = new Map([[root.id, { x: 610, y: 145 }]]);
      const anchors = {
        work: { x: 205, y: 410 },
        knowledge: { x: 610, y: 345 },
        experience: { x: 925, y: 385 },
        education: { x: 785, y: 555 },
        about: { x: 335, y: 565 }
      };
      nodes.filter(node => node.id !== root.id).forEach(node => positions.set(node.id, anchors[node.id] || { x: 610, y: 430 }));
      return { width, height, positions: resolveCollisions(nodes, positions, width, height) };
    }

    if (state.mode === 'focus') {
      const width = 1200;
      const height = 720;
      const positions = new Map();
      const trail = primaryPath(state.node);
      const children = childrenFor(state.node.id).filter(child => nodes.some(node => node.id === child.id));
      trail.slice(0, -1).forEach((node, index) => positions.set(node.id, { x: 210 + index * 112, y: 92 + index * 42 }));
      positions.set(state.node.id, { x: 610, y: 205 });

      if (state.node.id === 'experience') {
        const timelineChildren = [...children].sort((left, right) => (left.timelineOrder || 0) - (right.timelineOrder || 0));
        timelineChildren.forEach((node, index) => positions.set(node.id, {
          x: 250 + index * (700 / Math.max(timelineChildren.length - 1, 1)),
          y: 445
        }));
        return {
          width,
          height,
          positions: resolveCollisions(nodes, positions, width, height),
          timeline: { x1: 190, x2: width - 170, y: 445 }
        };
      }

      if (state.node.id === 'about') {
        const ring = [{ x: 350, y: 365 }, { x: 585, y: 420 }, { x: 850, y: 350 }, { x: 755, y: 530 }, { x: 420, y: 535 }];
        children.forEach((node, index) => positions.set(node.id, ring[index] || { x: 610, y: 470 }));
        return { width, height, positions: resolveCollisions(nodes, positions, width, height) };
      }

      children.forEach((node, index) => positions.set(node.id, {
        x: 150 + index * (900 / Math.max(children.length - 1, 1)),
        y: 390 + (index % 3 === 1 ? 28 : index % 3 === 2 ? -18 : 0)
      }));
      const childrenById = new Set(children.map(node => node.id));
      const descendants = nodes.filter(node => !positions.has(node.id));
      const descendantGroups = new Map(children.map(node => [node.id, []]));
      descendants.forEach(node => {
        const localParent = node.parentIds?.find(parentId => childrenById.has(parentId)) || children[0]?.id;
        if (localParent) descendantGroups.get(localParent).push(node);
      });
      descendantGroups.forEach((group, parentId) => {
        const anchor = positions.get(parentId) || { x: 610, y: 420 };
        group.sort((left, right) => left.label.localeCompare(right.label));
        group.forEach((node, index) => {
          const offset = (index - (group.length - 1) / 2) * 122;
          positions.set(node.id, {
            x: Math.max(110, Math.min(1090, anchor.x + offset)),
            y: 575 + (index % 2) * 34
          });
        });
      });
      return { width, height, positions: resolveCollisions(nodes, positions, width, height) };
    }

    const width = 2400;
    const height = 1550;
    const positions = new Map();
    positions.set(root.id, { x: 1200, y: 115 });
    const anchors = { work: { x: 390, y: 375 }, knowledge: { x: 1170, y: 310 }, experience: { x: 2010, y: 385 }, education: { x: 1770, y: 1070 }, about: { x: 535, y: 1080 } };
    Object.entries(anchors).forEach(([id, position]) => positions.set(id, position));
    const regions = {
      work: { left: 90, right: 760, top: 505, bottom: 1390 },
      knowledge: { left: 780, right: 1515, top: 445, bottom: 1370 },
      experience: { left: 1650, right: 2310, top: 525, bottom: 900 },
      education: { left: 1540, right: 2310, top: 1030, bottom: 1450 },
      about: { left: 90, right: 765, top: 1040, bottom: 1450 }
    };
    const owner = node => {
      if (node.type === 'project' || node.type === 'work-theme') return 'work';
      return node.parentIds?.find(parentId => anchors[parentId]) || primaryPath(node).find(item => anchors[item.id])?.id || 'knowledge';
    };
    const groups = new Map(Object.keys(anchors).map(id => [id, []]));
    nodes.filter(node => node.id !== root.id && !anchors[node.id]).forEach(node => groups.get(owner(node)).push(node));
    groups.forEach((group, section) => {
      const region = regions[section];
      group.sort((left, right) => depthFor(left) - depthFor(right) || left.label.localeCompare(right.label));
      const columns = Math.max(2, Math.min(5, Math.ceil(Math.sqrt(group.length))));
      const rows = Math.max(1, Math.ceil(group.length / columns));
      group.forEach((node, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const wobble = (stableNumber(node.id) % 31) - 15;
        positions.set(node.id, {
          x: region.left + (column + .5) * ((region.right - region.left) / columns) + wobble,
          y: region.top + (row + .5) * ((region.bottom - region.top) / rows) + (column % 2 ? 16 : -10)
        });
      });
    });
    return { width, height, positions: resolveCollisions(nodes, positions, width, height, 48) };
  };

  let detailCloseTimer = 0;
  let atlasPreviewNode = null;

  const closeDetail = () => {
    atlasPreviewNode = null;
    renderer.nodeElements.forEach(node => node.classList.remove('is-previewed'));
    detailPanel.classList.remove('is-open');
    window.clearTimeout(detailCloseTimer);
    detailCloseTimer = window.setTimeout(() => { detailPanel.hidden = true; }, reducedMotion.matches ? 0 : 220);
  };

  const openAtlasPreview = node => {
    atlasPreviewNode = node;
    window.clearTimeout(detailCloseTimer);
    renderer.nodeElements.forEach((element, id) => element.classList.toggle('is-previewed', id === node.id));
    detailPanel.innerHTML = '';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'detail-close';
    close.setAttribute('aria-label', 'Close preview');
    close.textContent = 'x';
    close.addEventListener('click', closeDetail);
    const eyebrow = document.createElement('p');
    eyebrow.className = 'detail-eyebrow';
    eyebrow.textContent = humanType(node.type);
    const title = document.createElement('h2');
    title.textContent = node.detailLabel || node.label;
    const summary = document.createElement('p');
    summary.className = 'detail-summary';
    summary.textContent = node.summary || 'A connected item in this profile map.';
    const hint = document.createElement('p');
    hint.className = 'atlas-preview-hint';
    hint.textContent = 'This node can be opened as a focused local graph.';
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'detail-route-action';
    action.dataset.route = routeForNode(node);
    action.textContent = node.id === root.id
      ? 'Open overview'
      : node.id === 'work'
        ? 'Open Work lattice'
        : 'Open local graph';
    bindRoute(action);
    detailPanel.append(close, eyebrow, title, summary, hint, action);
    detailPanel.hidden = false;
    requestAnimationFrame(() => detailPanel.classList.add('is-open'));
  };

  const renderDetail = () => {
    detailPanel.innerHTML = '';
    const target = state.node;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'detail-close';
    close.setAttribute('aria-label', 'Close detail');
    close.textContent = 'x';
    close.addEventListener('click', closeDetail);
    const title = document.createElement('h2');
    const eyebrow = document.createElement('p');
    eyebrow.className = 'detail-eyebrow';
    const summary = document.createElement('p');
    summary.className = 'detail-summary';

    if (state.mode === 'overview') {
      eyebrow.textContent = 'Overview';
      title.textContent = site.profile.name;
      summary.textContent = 'Select an area in the graph or the menu. Each view keeps the local structure readable and opens detail progressively.';
    } else if (state.mode === 'atlas') {
      eyebrow.textContent = 'Atlas · Full graph';
      title.textContent = 'Profile structure';
      summary.textContent = 'This exploratory view shows the current global structure and selected cross-links. Choose any node to return to its focused local view.';
    } else {
      eyebrow.textContent = humanType(target.type);
      title.textContent = target.detailLabel || target.label;
      summary.textContent = target.summary || 'A focused part of the profile.';
    }

    detailPanel.append(close, eyebrow, title, summary);

    if (target.status) {
      const status = document.createElement('p');
      status.className = 'detail-status';
      status.textContent = target.status;
      detailPanel.appendChild(status);
    }
    if (target.meta) {
      const meta = document.createElement('p');
      meta.className = 'detail-meta';
      meta.textContent = target.meta;
      detailPanel.appendChild(meta);
    }

    const facts = [
      ['Role', target.role],
      ['Programme', target.programme],
      ['Organisation', target.organisation]
    ].filter(([, value]) => value);
    if (facts.length && state.mode === 'focus') {
      const factList = document.createElement('dl');
      factList.className = 'detail-facts';
      facts.forEach(([label, value]) => {
        const term = document.createElement('dt');
        term.textContent = label;
        const description = document.createElement('dd');
        description.textContent = value;
        factList.append(term, description);
      });
      detailPanel.appendChild(factList);
    }

    if (target.highlights?.length && state.mode === 'focus') {
      const heading = document.createElement('p');
      heading.className = 'detail-list-title';
      heading.textContent = target.type === 'experience' ? 'Key responsibilities' : 'Key areas';
      const highlights = document.createElement('ul');
      highlights.className = 'detail-highlights';
      target.highlights.forEach(item => {
        const point = document.createElement('li');
        point.textContent = item;
        highlights.appendChild(point);
      });
      detailPanel.append(heading, highlights);
    }

    const children = state.mode === 'atlas' ? [] : childrenFor(target.id);
    if (children.length) {
      const heading = document.createElement('p');
      heading.className = 'detail-list-title';
      heading.textContent = 'Explore next';
      const list = document.createElement('div');
      list.className = 'detail-node-list';
      children.forEach(child => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = child.label;
        button.dataset.route = child.route;
        bindRoute(button);
        list.appendChild(button);
      });
      detailPanel.append(heading, list);
    }

    const relationLabels = {
      evidence: 'Evidence in work',
      'used-in': 'Used in work',
      'experience-link': 'Experience connection',
      'education-link': 'Education connection',
      related: 'Related in the profile'
    };
    const relatedByType = new Map();
    graph.edges
      .filter(edge => edge.source === target.id || edge.target === target.id)
      .forEach(edge => {
        const related = nodeMap.get(edge.source === target.id ? edge.target : edge.source);
        if (!related) return;
        if (!relatedByType.has(edge.type)) relatedByType.set(edge.type, []);
        relatedByType.get(edge.type).push(related);
      });
    if (state.mode === 'focus') {
      relatedByType.forEach((related, type) => {
        const heading = document.createElement('p');
        heading.className = 'detail-list-title';
        heading.textContent = relationLabels[type] || 'Connected in the profile';
        const list = document.createElement('div');
        list.className = 'detail-node-list is-secondary';
        [...new Map(related.map(node => [node.id, node])).values()].forEach(node => {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = node.label;
          button.dataset.route = node.route;
          bindRoute(button);
          list.appendChild(button);
        });
        detailPanel.append(heading, list);
      });
    }

    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'detail-route-action';
    const parent = state.mode === 'focus' ? nodeMap.get(target.parentIds?.[0]) : null;
    action.textContent = state.mode === 'atlas'
      ? 'Back to overview'
      : parent
        ? `Back to ${parent.label}`
        : 'Open Atlas';
    action.dataset.route = state.mode === 'atlas'
      ? 'overview'
      : parent
        ? routeForNode(parent)
        : 'atlas';
    bindRoute(action);
    detailPanel.appendChild(action);
  };

  const graphEdges = visible => {
    const ids = new Set(visible.map(node => node.id));
    const localParents = state.mode === 'focus'
      ? new Set([state.node.id, ...childrenFor(state.node.id).map(node => node.id)])
      : new Set();
    const hierarchy = [];
    const alternateHierarchy = [];
    visible.forEach(node => {
      (node.parentIds || []).forEach((parentId, index) => {
        if (!ids.has(parentId)) return;
        const edge = { source: parentId, target: node.id, type: index === 0 ? 'hierarchy' : 'hierarchy-alt' };
        if (index === 0 || (state.mode === 'focus' && localParents.has(parentId))) hierarchy.push(edge);
        else alternateHierarchy.push(edge);
      });
    });
    if (state.mode !== 'atlas') return hierarchy;

    const crossLinks = graph.edges.filter(edge => {
      if (!ids.has(edge.source) || !ids.has(edge.target)) return false;
      return edge.secondary ? atlasOptions.secondary : atlasOptions.crossLinks;
    });
    return [
      ...(atlasOptions.hierarchy ? hierarchy : []),
      ...(atlasOptions.secondary && atlasOptions.hierarchy ? alternateHierarchy : []),
      ...crossLinks
    ];
  };

  const renderGraph = () => {
    const view = visibleGraph();
    const layout = layoutGraph(view.nodes);
    const edges = graphEdges(view.nodes);
    const svgNS = 'http://www.w3.org/2000/svg';
    const edgeKey = edge => `${edge.source}|${edge.target}|${edge.type}`;
    const pointFor = element => ({ x: Number(element?.dataset.x || 0), y: Number(element?.dataset.y || 0) });
    const setPoint = (element, point) => {
      element.setAttribute('transform', `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`);
      element.dataset.x = point.x;
      element.dataset.y = point.y;
    };
    const interpolate = (from, to, progress) => ({ x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress });
    const edgePath = (from, to, id) => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const hashBend = (stableNumber(id) % 61) - 30;
      const bend = Math.max(-72, Math.min(72, hashBend + Math.min(22, distance * .045)));
      const control = {
        x: (from.x + to.x) / 2 + (-dy / distance) * bend,
        y: (from.y + to.y) / 2 + (dx / distance) * bend
      };
      return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${control.x.toFixed(1)} ${control.y.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
    };

    if (!renderer.svg) {
      renderer.svg = document.createElementNS(svgNS, 'svg');
      renderer.svg.classList.add('site-graph-svg', 'profile-map-svg');
      renderer.svg.setAttribute('role', 'img');
      renderer.svg.setAttribute('aria-labelledby', 'site-graph-title site-graph-help');
      renderer.camera = document.createElementNS(svgNS, 'g');
      renderer.camera.classList.add('profile-map-viewport');
      renderer.edges = document.createElementNS(svgNS, 'g');
      renderer.edges.classList.add('site-graph-edges');
      renderer.nodes = document.createElementNS(svgNS, 'g');
      renderer.nodes.classList.add('site-graph-nodes');
      renderer.camera.append(renderer.edges, renderer.nodes);
      renderer.svg.appendChild(renderer.camera);
      graphRoot.replaceChildren(renderer.svg);
      renderer.svg.addEventListener('wheel', event => {
        if (state.mode !== 'atlas') return;
        event.preventDefault();
        const bounds = renderer.svg.getBoundingClientRect();
        const activeLayout = renderer.lastLayout || layout;
        const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
        zoomAtlasAt({
          x: (event.clientX - bounds.left) * activeLayout.width / Math.max(bounds.width, 1),
          y: (event.clientY - bounds.top) * activeLayout.height / Math.max(bounds.height, 1)
        }, Math.exp(-delta * .0015));
      }, { passive: false });
      renderer.svg.addEventListener('pointerdown', event => {
        if (state.mode !== 'atlas') return;
        renderer.drag = { x: event.clientX, y: event.clientY, moved: false };
        renderer.svg.setPointerCapture?.(event.pointerId);
      });
      renderer.svg.addEventListener('pointermove', event => {
        if (!renderer.drag || state.mode !== 'atlas') return;
        const bounds = renderer.svg.getBoundingClientRect();
        const activeLayout = renderer.lastLayout || layout;
        const dx = (event.clientX - renderer.drag.x) * activeLayout.width / Math.max(bounds.width, 1);
        const dy = (event.clientY - renderer.drag.y) * activeLayout.height / Math.max(bounds.height, 1);
        renderer.drag.moved ||= Math.abs(dx) + Math.abs(dy) > 3;
        atlasTransform.x += dx;
        atlasTransform.y += dy;
        atlasTransform.targetX += dx;
        atlasTransform.targetY += dy;
        renderer.drag.x = event.clientX;
        renderer.drag.y = event.clientY;
        paintAtlasTransform();
      });
      renderer.svg.addEventListener('pointerup', event => {
        renderer.svg.releasePointerCapture?.(event.pointerId);
        window.setTimeout(() => { renderer.drag = null; }, 0);
      });
    }

    renderer.svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
    renderer.lastEdges = edges;
    renderer.lastLayout = layout;
    if (layout.timeline) {
      if (!renderer.timeline) {
        renderer.timeline = document.createElementNS(svgNS, 'line');
        renderer.timeline.classList.add('site-graph-timeline');
        renderer.edges.prepend(renderer.timeline);
      }
      renderer.timeline.setAttribute('x1', layout.timeline.x1);
      renderer.timeline.setAttribute('x2', layout.timeline.x2);
      renderer.timeline.setAttribute('y1', layout.timeline.y);
      renderer.timeline.setAttribute('y2', layout.timeline.y);
    } else if (renderer.timeline) {
      renderer.timeline.remove();
      renderer.timeline = null;
    }
    const visibleIds = new Set(view.nodes.map(node => node.id));
    const visibleEdgeKeys = new Set(edges.map(edgeKey));
    const focusPoint = renderer.nodeElements.has(state.node.id) ? pointFor(renderer.nodeElements.get(state.node.id)) : { x: layout.width / 2, y: layout.height / 2 };
    const starts = new Map();
    const targets = new Map();
    const enteringNodes = new Set();

    view.nodes.forEach(node => {
      const target = layout.positions.get(node.id) || focusPoint;
      let element = renderer.nodeElements.get(node.id);
      if (!element) {
        element = document.createElementNS(svgNS, 'g');
        element.classList.add('site-graph-node', `is-${node.type}`);
        element.dataset.nodeId = node.id;
        element.setAttribute('tabindex', '0');
        element.setAttribute('role', 'button');
        element.setAttribute('aria-label', `Explore ${node.label}`);
        const hit = document.createElementNS(svgNS, 'circle');
        hit.classList.add('site-graph-hit');
        hit.setAttribute('r', '19');
        hit.setAttribute('fill', 'transparent');
        const dot = document.createElementNS(svgNS, 'circle');
        dot.classList.add('site-graph-dot');
        dot.setAttribute('r', node.id === root.id ? '15' : node.type === 'section' ? '9' : node.type === 'project' ? '5' : '6');
        const label = document.createElementNS(svgNS, 'text');
        label.classList.add('site-graph-label');
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('y', node.id === root.id ? '-25' : '25');
        label.textContent = node.label;
        element.append(hit, dot, label);
        if (node.meta) {
          const meta = document.createElementNS(svgNS, 'text');
          meta.classList.add('site-graph-meta');
          meta.setAttribute('text-anchor', 'middle');
          meta.setAttribute('y', '42');
          meta.textContent = node.meta;
          element.appendChild(meta);
        }
        const preview = () => {
          const related = new Set([node.id, ...primaryPath(node).map(item => item.id), ...childrenFor(node.id).map(item => item.id)]);
          edges.forEach(edge => {
            if (edge.source === node.id) related.add(edge.target);
            if (edge.target === node.id) related.add(edge.source);
          });
          renderer.nodeElements.forEach((candidate, id) => candidate.classList.toggle('is-muted', !related.has(id)));
          renderer.edgeElements.forEach((candidate, id) => {
            const edge = renderer.lastEdges.find(item => edgeKey(item) === id);
            const active = edge && related.has(edge.source) && related.has(edge.target);
            candidate.classList.toggle('is-related', Boolean(active));
            candidate.classList.toggle('is-muted', !active);
          });
        };
        const clear = () => {
          renderer.nodeElements.forEach(candidate => candidate.classList.remove('is-muted', 'is-related'));
          renderer.edgeElements.forEach(candidate => candidate.classList.remove('is-muted', 'is-related'));
        };
        const activate = () => {
          if (state.mode === 'atlas') openAtlasPreview(node);
          else updateHash(routeForNode(node));
        };
        element.addEventListener('mouseenter', preview);
        element.addEventListener('mouseleave', clear);
        element.addEventListener('focus', preview);
        element.addEventListener('blur', clear);
        element.addEventListener('click', () => { if (!renderer.drag?.moved) activate(); });
        element.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); }
        });
        renderer.nodeElements.set(node.id, element);
        renderer.nodes.appendChild(element);
        enteringNodes.add(node.id);
        const parentElement = node.parentIds?.map(id => renderer.nodeElements.get(id)).find(Boolean);
        starts.set(node.id, parentElement ? pointFor(parentElement) : focusPoint);
        setPoint(element, starts.get(node.id));
        element.style.opacity = '0';
      } else starts.set(node.id, pointFor(element));
      targets.set(node.id, target);
      element.classList.toggle('is-selected', node.id === state.node.id && state.mode !== 'overview');
      element.classList.toggle('is-root', node.id === root.id);
      element.classList.toggle('is-section', node.type === 'section');
    });

    const leavingNodes = [...renderer.nodeElements.entries()].filter(([id]) => !visibleIds.has(id));
    const edgeStarts = new Map();
    const edgeTargets = new Map();
    const enteringEdges = new Set();
    edges.forEach(edge => {
      const id = edgeKey(edge);
      let element = renderer.edgeElements.get(id);
      if (!element) {
        element = document.createElementNS(svgNS, 'path');
        element.classList.add(`is-${edge.type}`);
        if (edge.type !== 'hierarchy') element.classList.add('is-cross-link');
        if (edge.type === 'hierarchy-alt') element.classList.add('is-secondary');
        if (edge.secondary) element.classList.add('is-secondary');
        const title = document.createElementNS(svgNS, 'title');
        title.textContent = `${edgeTypeLabel(edge.type)} connection`;
        element.appendChild(title);
        renderer.edgeElements.set(id, element);
        renderer.edges.appendChild(element);
        enteringEdges.add(id);
        element.style.opacity = '0';
      }
      edgeStarts.set(id, { source: starts.get(edge.source) || focusPoint, target: starts.get(edge.target) || focusPoint });
      edgeTargets.set(id, { source: targets.get(edge.source), target: targets.get(edge.target) });
    });
    const leavingEdges = [...renderer.edgeElements.entries()].filter(([id]) => !visibleEdgeKeys.has(id));

    cancelAnimationFrame(renderer.frame);
    const duration = reducedMotion.matches ? 70 : 430;
    const started = performance.now();
    const frame = now => {
      const raw = Math.min(1, (now - started) / duration);
      const progress = reducedMotion.matches ? raw : 1 - Math.pow(1 - raw, 3);
      targets.forEach((target, id) => {
        const element = renderer.nodeElements.get(id);
        setPoint(element, interpolate(starts.get(id), target, progress));
        element.style.opacity = String(enteringNodes.has(id) ? progress : 1);
      });
      leavingNodes.forEach(([, element]) => {
        setPoint(element, interpolate(pointFor(element), focusPoint, progress));
        element.style.opacity = String(1 - progress);
      });
      edgeTargets.forEach((target, id) => {
        const element = renderer.edgeElements.get(id);
        const start = edgeStarts.get(id);
        element.setAttribute('d', edgePath(interpolate(start.source, target.source, progress), interpolate(start.target, target.target, progress), id));
        element.style.opacity = String(enteringEdges.has(id) ? progress : 1);
        if (!reducedMotion.matches && raw < 1) {
          element.style.strokeDasharray = '900';
          element.style.strokeDashoffset = String(900 * (1 - raw));
        }
      });
      leavingEdges.forEach(([, element]) => { element.style.opacity = String(1 - progress); });
      if (raw < 1) renderer.frame = requestAnimationFrame(frame);
      else {
        leavingNodes.forEach(([id, element]) => { element.remove(); renderer.nodeElements.delete(id); });
        leavingEdges.forEach(([id, element]) => { element.remove(); renderer.edgeElements.delete(id); });
        renderer.nodeElements.forEach(element => { element.style.opacity = ''; });
        renderer.edgeElements.forEach(element => { element.style.opacity = ''; element.style.strokeDasharray = ''; element.style.strokeDashoffset = ''; });
        if (state.mode === 'atlas') paintAtlasTransform();
        else renderer.camera.setAttribute('transform', '');
      }
    };
    renderer.frame = requestAnimationFrame(frame);
  };

  const updateNavigation = () => {
    document.querySelectorAll('#main-nav [data-route]').forEach(item => {
      const current = item.dataset.route === state.route ||
        (state.mode === 'focus' && state.route.startsWith(`${item.dataset.route}/`)) ||
        (state.mode === 'work' && item.dataset.route === 'work');
      item.setAttribute('aria-current', current ? 'page' : 'false');
    });
  };

  const renderRoute = rawRoute => {
    const route = normaliseRoute(rawRoute);
    const atlas = route === 'atlas';
    const workProjectMatch = route.match(/^work\/project\/([^/]+)$/);
    const workThemeMatch = route.match(/^work\/theme\/([^/]+)$/);
    const routedNode = atlas ? null : nodeForRoute(route);
    const target = atlas ? root : routedNode || root;
    const workRoute = route === 'work' ||
      Boolean(workProjectMatch && routedNode?.type === 'project') ||
      Boolean(workThemeMatch && routedNode?.type === 'work-theme');
    const wasWorkRoute = state.mode === 'work';
    if (workRoute) {
      cancelAnimationFrame(atlasTransform.frame);
      state = { route, mode: 'work', node: target };
      hero.hidden = true;
      explorer.hidden = false;
      graphPanel.hidden = false;
      graphRoutebar.hidden = true;
      workView.hidden = false;
      workRouteHeader.hidden = false;
      closeDetail();
      legacyViews.forEach(view => { view.hidden = true; });
      if (footer) footer.hidden = true;
      document.body.dataset.graphMode = 'work';
      document.body.dataset.graphRoute = state.route;
      const workTarget = workProjectMatch || workThemeMatch ? target : nodeMap.get('work');
      renderBreadcrumb(workTarget, workBreadcrumb);
      if (workRouteBack) {
        const parent = workTarget?.parentIds?.map(parentId => nodeMap.get(parentId)).find(Boolean) || root;
        workRouteBack.dataset.route = routeForNode(parent);
        workRouteBack.textContent = parent.id === root.id ? 'Back to profile graph' : `Back to ${parent.label}`;
      }
      if (!wasWorkRoute) {
        workView.classList.remove('is-scene-entering');
        requestAnimationFrame(() => workView.classList.add('is-scene-entering'));
        window.setTimeout(() => workView.classList.remove('is-scene-entering'), reducedMotion.matches ? 0 : 520);
      }
      const projectId = workProjectMatch?.[1];
      if (projectId) {
        window.SITE_GRAPH_PENDING_WORK_PROJECT = projectId;
        window.dispatchEvent(new CustomEvent('site:open-work-project', { detail: { projectId } }));
      }
      const themeId = workThemeMatch?.[1];
      if (themeId) {
        window.SITE_GRAPH_PENDING_WORK_THEME = themeId;
        window.dispatchEvent(new CustomEvent('site:open-work-theme', { detail: { themeId } }));
      }
      graphStatus.textContent = projectId ? `${target.detailLabel || target.label} open in Work explorer.` : 'Work explorer open.';
      updateNavigation();
      return;
    }

    state = {
      route: atlas ? 'atlas' : routeForNode(target),
      mode: atlas ? 'atlas' : target.id === root.id ? 'overview' : 'focus',
      node: target
    };
    if (state.mode !== 'atlas') cancelAnimationFrame(atlasTransform.frame);
    hero.hidden = false;
    explorer.hidden = false;
    graphPanel.hidden = false;
    graphRoutebar.hidden = false;
    workView.hidden = true;
    workView.classList.remove('is-project-open');
    workRouteHeader.hidden = true;
    legacyViews.forEach(view => { view.hidden = true; });
    if (footer) footer.hidden = true;
    document.body.dataset.graphMode = state.mode;
    document.body.dataset.graphRoute = state.route;

    graphKicker.textContent = state.mode === 'atlas' ? 'Atlas' : state.mode === 'overview' ? 'Profile graph' : humanType(target.type);
    graphTitle.textContent = state.mode === 'overview' ? 'Explore the profile' : state.mode === 'atlas' ? 'Full profile graph' : target.label;
    graphHelp.textContent = state.mode === 'atlas'
      ? 'Atlas is an exploratory full view. Select any node to open its local graph.'
      : state.mode === 'overview'
        ? 'Select an area to explore its local structure.'
        : target.id === 'experience'
          ? 'A chronological view of roles. Select a role to inspect its connected work and knowledge.'
          : target.id === 'education'
            ? 'Select a programme to reveal its connected topics and evidence across the profile.'
          : 'Select a connected item to move deeper, or use the graph path to return.';
    renderBreadcrumb(target, breadcrumb, atlas);
    syncAtlasControls();
    renderGraph();
    const openLeafDetail = state.mode === 'focus' && childrenFor(target.id).length === 0;
    if (openLeafDetail) {
      detailPanel.hidden = false;
      renderDetail();
      requestAnimationFrame(() => detailPanel.classList.add('is-open'));
    } else closeDetail();
    updateNavigation();
    graphStatus.textContent = `${graphTitle.textContent} view open.`;
  };

  window.addEventListener('hashchange', () => renderRoute(normaliseRoute(location.hash)));
  let resizeTimer;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (state.mode !== 'work') renderGraph();
    }, 120);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!detailPanel.hidden) {
      event.preventDefault();
      closeDetail();
      return;
    }
    if (state.mode === 'work' || state.mode === 'atlas') {
      event.preventDefault();
      updateHash('overview');
      return;
    }
    if (state.mode === 'overview') return;
    event.preventDefault();
    const parent = state.mode === 'focus' ? nodeMap.get(state.node.parentIds?.[0]) : root;
    updateHash(routeForNode(parent || root));
  });

  renderRoute(normaliseRoute(location.hash));
})();
