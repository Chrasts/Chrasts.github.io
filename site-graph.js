(() => {
  const site = window.SITE_DATA;
  const graph = site?.graph;
  if (!site?.profile || !graph?.nodes?.length) return;

  /* ------------------------------------------------------------------------
     Runtime stylesheet
     ------------------------------------------------------------------------ */
  if (!document.querySelector('link[data-profile-graph-v4]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'graph-v4.css';
    link.dataset.profileGraphV4 = 'true';
    document.head.appendChild(link);
  }

  // Defensive compatibility for one legacy Work branch that references a
  // global `count`. A post-render pass below restores the actual match depth.
  if (!('count' in window)) window.count = 1;

  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const root = nodeMap.get(graph.rootId);
  const childrenFor = id => graph.nodes.filter(node => node.parentIds?.includes(id));
  const workNode = nodeMap.get('work');

  const hero = document.querySelector('.hero');
  const explorer = document.querySelector('#site-explorer');
  const graphRoot = document.querySelector('#site-graph');
  const graphPanel = graphRoot?.closest('.site-graph-panel');
  const sceneCanvas = document.querySelector('.scene-canvas');
  const graphRoutebar = document.querySelector('.graph-routebar');
  const breadcrumb = document.querySelector('#graph-breadcrumb');
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
  const workRouteHeader = document.querySelector('#work-route-header');
  const legacyViews = [...document.querySelectorAll('.legacy-section')];
  const footer = document.querySelector('footer');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  if (
    !root || !workNode || !hero || !explorer || !graphRoot || !graphPanel ||
    !sceneCanvas || !breadcrumb || !detailPanel || !workView
  ) return;

  if (workView.parentElement !== sceneCanvas) sceneCanvas.appendChild(workView);

  const svgNS = 'http://www.w3.org/2000/svg';
  const SAFE = { top: 105, right: 88, bottom: 92, left: 88 };
  const FOCUS_SIZE = { width: 1200, height: 720 };

  let state = { route: 'overview', mode: 'overview', node: root };
  let routeToken = 0;
  let atlasPinnedId = null;
  let atlasHoveredId = null;

  const atlasOptions = {
    hierarchy: true,
    crossLinks: true,
    secondary: false
  };

  const atlasTransform = {
    x: 0,
    y: 0,
    scale: 1,
    targetX: 0,
    targetY: 0,
    targetScale: 1,
    frame: 0
  };

  const renderer = {
    svg: null,
    camera: null,
    edges: null,
    nodes: null,
    timeline: null,
    nodeElements: new Map(),
    edgeElements: new Map(),
    lastEdges: [],
    lastLayout: null,
    animationFrame: 0,
    drag: null
  };

  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';

  const nodeForRoute = route => {
    if (route === 'overview') return root;
    return graph.nodes.find(node => node.route === route) || null;
  };

  const routeForNode = node => node?.route || 'overview';

  const isWorkRoute = route =>
    route === 'work' ||
    /^work\/project\/[^/]+$/.test(route) ||
    /^work\/theme\/[^/]+$/.test(route);

  const primaryPath = node => {
    const path = [];
    const seen = new Set();
    let current = node;
    while (current && !seen.has(current.id)) {
      path.unshift(current);
      seen.add(current.id);
      const parentId = current.parentIds?.[0];
      current = parentId ? nodeMap.get(parentId) : null;
    }
    return path;
  };

  const allAncestorIds = nodeId => {
    const result = new Set();
    const pending = [...(nodeMap.get(nodeId)?.parentIds || [])];
    while (pending.length) {
      const id = pending.pop();
      if (result.has(id)) continue;
      result.add(id);
      pending.push(...(nodeMap.get(id)?.parentIds || []));
    }
    return result;
  };

  const allDescendantIds = nodeId => {
    const result = new Set();
    const pending = childrenFor(nodeId).map(node => node.id);
    while (pending.length) {
      const id = pending.pop();
      if (result.has(id)) continue;
      result.add(id);
      childrenFor(id).forEach(child => pending.push(child.id));
    }
    return result;
  };

  const topSectionFor = node => {
    if (!node || node.id === root.id) return null;
    const path = primaryPath(node);
    return path.find(item => item.parentIds?.includes(root.id)) || null;
  };

  const humanType = type => ({
    section: 'Profile area',
    knowledge: 'Knowledge',
    experience: 'Experience',
    education: 'Education',
    credential: 'Credential',
    interest: 'About',
    project: 'Project',
    'work-theme': 'Work theme',
    profile: 'Profile'
  }[type] || 'Profile item');

  const edgeTypeLabel = type => ({
    hierarchy: 'Hierarchy',
    'hierarchy-alt': 'Additional hierarchy',
    evidence: 'Evidence',
    'used-in': 'Used in',
    'experience-link': 'Experience connection',
    'education-link': 'Education connection',
    related: 'Related'
  }[type] || 'Connection');

  const stableNumber = value => {
    let number = 2166136261;
    for (const character of String(value)) {
      number = Math.imul(number ^ character.charCodeAt(0), 16777619);
    }
    return number >>> 0;
  };

  const updateHash = route => {
    const target = `#${normaliseRoute(route)}`;
    if (location.hash !== target) location.hash = target;
    else renderRoute(target);
  };

  const bindRoute = element => {
    if (!element || element.dataset.graphRouteBound === 'true') return;
    element.dataset.graphRouteBound = 'true';
    element.addEventListener('click', event => {
      event.preventDefault();
      const route = element.dataset.route ||
        normaliseRoute(element.getAttribute('href') || 'overview');
      updateHash(route);
    });
  };

  document.querySelectorAll('[data-route]').forEach(bindRoute);

  /* ------------------------------------------------------------------------
     Breadcrumb
     ------------------------------------------------------------------------ */
  const renderBreadcrumb = target => {
    breadcrumb.innerHTML = '';
    const path = state.mode === 'atlas'
      ? [root, { id: 'atlas', label: 'Atlas', route: 'atlas' }]
      : primaryPath(target);

    path.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'graph-crumb';
      button.textContent = item.label;
      button.dataset.route = item.route || 'overview';
      button.setAttribute('aria-current', String(index === path.length - 1));
      bindRoute(button);
      breadcrumb.appendChild(button);

      if (index < path.length - 1) {
        const edge = document.createElement('span');
        edge.className = 'graph-crumb-edge';
        edge.setAttribute('aria-hidden', 'true');
        breadcrumb.appendChild(edge);
      }
    });
  };

  /* ------------------------------------------------------------------------
     Visible graph model
     ------------------------------------------------------------------------ */
  const visibleGraph = () => {
    if (state.mode === 'overview') {
      return {
        nodes: [root, ...childrenFor(root.id)],
        hierarchyOnly: true
      };
    }

    if (state.mode === 'atlas') {
      return { nodes: graph.nodes, hierarchyOnly: false };
    }

    const visible = new Map();
    primaryPath(state.node).forEach(node => visible.set(node.id, node));

    // Work bridge is intentionally minimal. The true FCA view takes over after
    // this scene has organically focused on Work.
    if (state.node.id === 'work') {
      childrenFor('work')
        .filter(node => node.type === 'work-theme')
        .forEach(node => visible.set(node.id, node));
      return { nodes: [...visible.values()], hierarchyOnly: true };
    }

    const children = childrenFor(state.node.id);
    children.slice(0, 8).forEach(node => visible.set(node.id, node));

    // Show a limited preview of the next level where space allows.
    if (children.length <= 5) {
      for (const child of children) {
        for (const grandchild of childrenFor(child.id).slice(0, 2)) {
          if (visible.size >= 13) break;
          visible.set(grandchild.id, grandchild);
        }
      }
    }

    return { nodes: [...visible.values()], hierarchyOnly: true };
  };

  /* ------------------------------------------------------------------------
     Layout helpers
     ------------------------------------------------------------------------ */
  const nodeFootprint = node => ({
    width: Math.max(84, Math.min(188, (node.detailLabel || node.label).length * 7.1 + 34)),
    height: node.id === root.id ? 72 : node.type === 'section' ? 54 : 46
  });

  const clampToSafe = (node, point, width, height, safe = SAFE) => {
    const box = nodeFootprint(node);
    point.x = Math.max(
      safe.left + box.width / 2,
      Math.min(width - safe.right - box.width / 2, point.x)
    );
    point.y = Math.max(
      safe.top + box.height / 2,
      Math.min(height - safe.bottom - box.height / 2, point.y)
    );
  };

  const resolveCollisions = (nodes, positions, width, height, safe = SAFE) => {
    const items = nodes.filter(node => positions.has(node.id));
    for (let pass = 0; pass < 80; pass += 1) {
      let changed = false;
      for (let i = 0; i < items.length; i += 1) {
        for (let j = i + 1; j < items.length; j += 1) {
          const left = items[i];
          const right = items[j];
          const a = positions.get(left.id);
          const b = positions.get(right.id);
          const fa = nodeFootprint(left);
          const fb = nodeFootprint(right);
          const requiredX = (fa.width + fb.width) / 2 + 22;
          const requiredY = (fa.height + fb.height) / 2 + 18;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const overlapX = requiredX - Math.abs(dx);
          const overlapY = requiredY - Math.abs(dy);
          if (overlapX <= 0 || overlapY <= 0) continue;

          const horizontal = overlapX < overlapY * 1.45 || Math.abs(dy) < 24;
          const seed = stableNumber(`${left.id}:${right.id}`);
          if (horizontal) {
            const direction = Math.sign(dx || (seed % 2 ? 1 : -1));
            const move = overlapX / 2 + 2;
            a.x -= direction * move;
            b.x += direction * move;
          } else {
            const direction = Math.sign(dy || (seed % 2 ? 1 : -1));
            const move = overlapY / 2 + 2;
            a.y -= direction * move;
            b.y += direction * move;
          }
          changed = true;
        }
      }
      items.forEach(node => clampToSafe(node, positions.get(node.id), width, height, safe));
      if (!changed) break;
    }
    return positions;
  };

  const layoutOverview = nodes => {
    const { width, height } = FOCUS_SIZE;
    const positions = new Map([[root.id, { x: 600, y: 145 }]]);
    const anchors = {
      work: { x: 230, y: 390 },
      knowledge: { x: 565, y: 340 },
      experience: { x: 925, y: 400 },
      education: { x: 790, y: 560 },
      about: { x: 350, y: 555 }
    };
    nodes.filter(node => node.id !== root.id).forEach(node => {
      positions.set(node.id, { ...(anchors[node.id] || { x: 600, y: 430 }) });
    });
    return {
      width,
      height,
      positions: resolveCollisions(nodes, positions, width, height)
    };
  };

  const layoutExperienceFocus = nodes => {
    const { width, height } = FOCUS_SIZE;
    const positions = new Map();
    const path = primaryPath(state.node);
    const currentIndex = path.length - 1;

    path.forEach((node, index) => {
      const t = currentIndex ? index / currentIndex : 1;
      positions.set(node.id, {
        x: 250 + 360 * t,
        y: 120 + 120 * t
      });
    });

    const roles = childrenFor(state.node.id)
      .filter(node => nodes.some(item => item.id === node.id))
      .sort((a, b) => (a.timelineOrder || 0) - (b.timelineOrder || 0));

    const y = 455;
    roles.forEach((node, index) => {
      const x = roles.length === 1
        ? 680
        : 220 + index * (760 / Math.max(roles.length - 1, 1));
      positions.set(node.id, { x, y: y + (index % 2 ? 24 : -18) });
    });

    return {
      width,
      height,
      positions: resolveCollisions(nodes, positions, width, height),
      timeline: roles.length
        ? { x1: 175, x2: 1025, y }
        : null
    };
  };

  const layoutFocus = nodes => {
    if (state.node.id === 'experience') return layoutExperienceFocus(nodes);

    const { width, height } = FOCUS_SIZE;
    const positions = new Map();
    const path = primaryPath(state.node);
    const current = state.node;
    const directChildren = childrenFor(current.id)
      .filter(node => nodes.some(item => item.id === node.id));

    // Ancestor chain is physically retained in the scene. It gently curves
    // into the local root instead of becoming a detached breadcrumb only.
    if (path.length === 1) {
      positions.set(root.id, { x: 600, y: 150 });
    } else {
      path.forEach((node, index) => {
        const last = path.length - 1;
        const t = last ? index / last : 1;
        const curve = Math.sin(t * Math.PI) * 68;
        positions.set(node.id, {
          x: 255 + 350 * t + curve,
          y: 112 + 135 * t
        });
      });
    }

    // Ensure focused node owns a stable strong anchor.
    positions.set(current.id, {
      x: current.id === root.id ? 600 : 610,
      y: current.id === root.id ? 150 : 250
    });

    const count = directChildren.length;
    directChildren.forEach((child, index) => {
      const t = count <= 1 ? .5 : index / (count - 1);
      const x = 160 + t * 880;
      const arc = Math.sin(t * Math.PI);
      const hashOffset = ((stableNumber(child.id) % 31) - 15) * .8;
      const y = 430 - arc * 58 + (index % 2 ? 20 : -8) + hashOffset * .25;
      positions.set(child.id, { x, y });
    });

    // Grandchildren sit near their direct parent rather than in a universal row.
    directChildren.forEach((child, childIndex) => {
      const parentPoint = positions.get(child.id);
      const grandchildren = childrenFor(child.id)
        .filter(node => nodes.some(item => item.id === node.id));
      grandchildren.forEach((grandchild, index) => {
        const direction = index % 2 ? 1 : -1;
        const x = parentPoint.x + direction * (105 + 30 * index);
        const y = parentPoint.y + 130 + ((stableNumber(grandchild.id) % 25) - 12);
        positions.set(grandchild.id, { x, y });
      });
    });

    return {
      width,
      height,
      positions: resolveCollisions(nodes, positions, width, height)
    };
  };

  const relativeDepth = (node, sectionId, memo = new Map()) => {
    const key = `${sectionId}:${node.id}`;
    if (memo.has(key)) return memo.get(key);
    if (node.id === sectionId) return 0;
    const parents = (node.parentIds || [])
      .map(id => nodeMap.get(id))
      .filter(Boolean);
    const candidates = parents
      .map(parent => relativeDepth(parent, sectionId, memo))
      .filter(value => Number.isFinite(value));
    const depth = candidates.length ? 1 + Math.min(...candidates) : Infinity;
    memo.set(key, depth);
    return depth;
  };

  const layoutAtlas = nodes => {
    const width = 2520;
    const height = 1580;
    const positions = new Map([[root.id, { x: 1260, y: 105 }]]);

    const sectionAnchors = {
      work: { x: 390, y: 330 },
      knowledge: { x: 1130, y: 270 },
      experience: { x: 1990, y: 360 },
      education: { x: 1715, y: 965 },
      about: { x: 670, y: 1010 }
    };

    Object.entries(sectionAnchors).forEach(([id, point]) => {
      if (nodeMap.has(id)) positions.set(id, { ...point });
    });

    const regions = {
      work: { left: 80, right: 830, top: 430, bottom: 930 },
      knowledge: { left: 760, right: 1510, top: 380, bottom: 1120 },
      experience: { left: 1660, right: 2420, top: 475, bottom: 850 },
      education: { left: 1450, right: 2390, top: 1050, bottom: 1480 },
      about: { left: 120, right: 1040, top: 1070, bottom: 1490 }
    };

    const ownerFor = node => {
      if (node.type === 'project' || node.type === 'work-theme') return 'work';
      const path = primaryPath(node);
      const section = path.find(item => item.parentIds?.includes(root.id));
      return section?.id || 'knowledge';
    };

    const groups = new Map(Object.keys(regions).map(id => [id, []]));
    nodes.forEach(node => {
      if (node.id === root.id || sectionAnchors[node.id]) return;
      const owner = ownerFor(node);
      if (groups.has(owner)) groups.get(owner).push(node);
    });

    const depthMemo = new Map();

    groups.forEach((group, sectionId) => {
      const region = regions[sectionId];
      const levels = new Map();

      group.forEach(node => {
        let depth = relativeDepth(node, sectionId, depthMemo);
        if (!Number.isFinite(depth)) depth = 2;
        // Work projects hang below themes in Atlas even though Work is also a
        // direct parent in the canonical data.
        if (node.type === 'project') depth = 2;
        if (node.type === 'work-theme') depth = 1;
        if (!levels.has(depth)) levels.set(depth, []);
        levels.get(depth).push(node);
      });

      const orderedDepths = [...levels.keys()].sort((a, b) => a - b);
      const localPositions = new Map();

      orderedDepths.forEach((depth, levelIndex) => {
        const level = levels.get(depth);
        level.sort((a, b) => {
          const aParents = (a.parentIds || [])
            .map(id => localPositions.get(id)?.x)
            .filter(Number.isFinite);
          const bParents = (b.parentIds || [])
            .map(id => localPositions.get(id)?.x)
            .filter(Number.isFinite);
          const aBary = aParents.length
            ? aParents.reduce((sum, value) => sum + value, 0) / aParents.length
            : stableNumber(a.id) % 1000;
          const bBary = bParents.length
            ? bParents.reduce((sum, value) => sum + value, 0) / bParents.length
            : stableNumber(b.id) % 1000;
          return aBary - bBary || a.label.localeCompare(b.label);
        });

        const yBase = region.top +
          ((region.bottom - region.top) * (levelIndex + .7)) /
          Math.max(orderedDepths.length + .2, 1);

        level.forEach((node, index) => {
          const t = level.length <= 1 ? .5 : (index + .5) / level.length;
          const wobbleX = ((stableNumber(node.id) % 41) - 20) * 1.2;
          const wobbleY = ((stableNumber(`${node.id}:y`) % 37) - 18);
          const x = region.left + t * (region.right - region.left) + wobbleX;
          const y = yBase + (index % 2 ? 18 : -14) + wobbleY * .45;
          const point = { x, y };
          localPositions.set(node.id, point);
          positions.set(node.id, point);
        });
      });
    });

    const atlasSafe = { top: 55, right: 45, bottom: 45, left: 45 };
    return {
      width,
      height,
      positions: resolveCollisions(nodes, positions, width, height, atlasSafe)
    };
  };

  const layoutGraph = nodes => {
    if (state.mode === 'overview') return layoutOverview(nodes);
    if (state.mode === 'atlas') return layoutAtlas(nodes);
    return layoutFocus(nodes);
  };

  /* ------------------------------------------------------------------------
     Edge model
     ------------------------------------------------------------------------ */
  const graphEdges = visible => {
    const ids = new Set(visible.map(node => node.id));
    const edges = [];

    visible.forEach(node => {
      let parents = [...(node.parentIds || [])];

      // In Atlas, Work projects are structurally shown through Work themes.
      if (
        state.mode === 'atlas' &&
        node.type === 'project' &&
        parents.some(id => id.startsWith('work-theme-'))
      ) {
        parents = parents.filter(id => id !== 'work');
      }

      parents.forEach((parentId, index) => {
        if (!ids.has(parentId)) return;
        const type = index === 0 ? 'hierarchy' : 'hierarchy-alt';
        if (state.mode !== 'atlas') {
          edges.push({ source: parentId, target: node.id, type: 'hierarchy' });
          return;
        }
        if (!atlasOptions.hierarchy) return;
        if (type === 'hierarchy-alt' && !atlasOptions.secondary) {
          // Theme -> project edges are primary visual structure in Work Atlas.
          if (!(node.type === 'project' && parentId.startsWith('work-theme-'))) return;
        }
        edges.push({
          source: parentId,
          target: node.id,
          type: node.type === 'project' && parentId.startsWith('work-theme-')
            ? 'hierarchy'
            : type
        });
      });
    });

    if (state.mode === 'atlas' && atlasOptions.crossLinks) {
      graph.edges.forEach(edge => {
        if (!ids.has(edge.source) || !ids.has(edge.target)) return;
        if (edge.secondary && !atlasOptions.secondary) return;
        edges.push({ ...edge });
      });
    }

    // Deduplicate.
    const byKey = new Map();
    edges.forEach(edge => {
      const key = `${edge.source}|${edge.target}|${edge.type}`;
      if (!byKey.has(key)) byKey.set(key, edge);
    });
    return [...byKey.values()];
  };

  /* ------------------------------------------------------------------------
     Atlas camera
     ------------------------------------------------------------------------ */
  const paintAtlasTransform = () => {
    if (!renderer.camera) return;
    renderer.camera.setAttribute(
      'transform',
      `translate(${atlasTransform.x.toFixed(2)} ${atlasTransform.y.toFixed(2)}) scale(${atlasTransform.scale.toFixed(4)})`
    );
  };

  const runAtlasCamera = () => {
    if (atlasTransform.frame || reducedMotion.matches) {
      if (reducedMotion.matches) {
        atlasTransform.x = atlasTransform.targetX;
        atlasTransform.y = atlasTransform.targetY;
        atlasTransform.scale = atlasTransform.targetScale;
        paintAtlasTransform();
      }
      return;
    }

    const frame = () => {
      const factor = .42;
      atlasTransform.x += (atlasTransform.targetX - atlasTransform.x) * factor;
      atlasTransform.y += (atlasTransform.targetY - atlasTransform.y) * factor;
      atlasTransform.scale += (atlasTransform.targetScale - atlasTransform.scale) * factor;
      paintAtlasTransform();

      const settled =
        Math.abs(atlasTransform.targetX - atlasTransform.x) < .06 &&
        Math.abs(atlasTransform.targetY - atlasTransform.y) < .06 &&
        Math.abs(atlasTransform.targetScale - atlasTransform.scale) < .0007;

      if (settled) {
        atlasTransform.x = atlasTransform.targetX;
        atlasTransform.y = atlasTransform.targetY;
        atlasTransform.scale = atlasTransform.targetScale;
        paintAtlasTransform();
        atlasTransform.frame = 0;
        return;
      }
      atlasTransform.frame = requestAnimationFrame(frame);
    };

    atlasTransform.frame = requestAnimationFrame(frame);
  };

  const fitAtlas = (immediate = false) => {
    atlasTransform.targetX = 0;
    atlasTransform.targetY = 0;
    atlasTransform.targetScale = 1;
    if (immediate || reducedMotion.matches) {
      cancelAnimationFrame(atlasTransform.frame);
      atlasTransform.frame = 0;
      atlasTransform.x = 0;
      atlasTransform.y = 0;
      atlasTransform.scale = 1;
      paintAtlasTransform();
    } else {
      runAtlasCamera();
    }
  };

  const zoomAtlasAt = (point, factor) => {
    const previous = atlasTransform.targetScale;
    const next = Math.max(.42, Math.min(3.2, previous * factor));
    if (next === previous) return;

    const graphPoint = {
      x: (point.x - atlasTransform.targetX) / previous,
      y: (point.y - atlasTransform.targetY) / previous
    };

    atlasTransform.targetScale = next;
    atlasTransform.targetX = point.x - graphPoint.x * next;
    atlasTransform.targetY = point.y - graphPoint.y * next;
    runAtlasCamera();
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
      if (state.mode === 'atlas') renderGraph();
    });
  });

  const atlasStructureOnly = document.createElement('button');
  atlasStructureOnly.type = 'button';
  atlasStructureOnly.className = 'atlas-structure-only';
  atlasStructureOnly.textContent = 'Structure only';
  atlasStructureOnly.title = 'Show the hierarchy without cross-links';
  atlasStructureOnly.addEventListener('click', () => {
    atlasOptions.hierarchy = true;
    atlasOptions.crossLinks = false;
    atlasOptions.secondary = false;
    syncAtlasControls();
    if (state.mode === 'atlas') renderGraph();
  });
  if (atlasShowAll?.parentElement && !atlasShowAll.parentElement.querySelector('.atlas-structure-only')) {
    atlasShowAll.before(atlasStructureOnly);
    atlasShowAll.textContent = 'All relations';
  }

  atlasShowAll?.addEventListener('click', () => {
    atlasOptions.hierarchy = true;
    atlasOptions.crossLinks = true;
    atlasOptions.secondary = true;
    syncAtlasControls();
    if (state.mode === 'atlas') renderGraph();
  });

  atlasFit?.addEventListener('click', () => fitAtlas());
  atlasReset?.addEventListener('click', () => {
    atlasPinnedId = null;
    clearAtlasHighlight();
    closeDetail();
    fitAtlas();
  });
  atlasZoomIn?.addEventListener('click', () => {
    const layout = renderer.lastLayout;
    if (layout) zoomAtlasAt({ x: layout.width / 2, y: layout.height / 2 }, 1.26);
  });
  atlasZoomOut?.addEventListener('click', () => {
    const layout = renderer.lastLayout;
    if (layout) zoomAtlasAt({ x: layout.width / 2, y: layout.height / 2 }, 1 / 1.26);
  });

  /* ------------------------------------------------------------------------
     Detail / Atlas inspector
     ------------------------------------------------------------------------ */
  let detailCloseTimer = 0;

  const closeDetail = () => {
    window.clearTimeout(detailCloseTimer);
    detailPanel.classList.remove('is-open');
    detailCloseTimer = window.setTimeout(() => {
      detailPanel.hidden = true;
    }, reducedMotion.matches ? 0 : 190);
  };

  const appendInspectorNodeButtons = (container, label, nodes) => {
    if (!nodes.length) return;
    const heading = document.createElement('p');
    heading.className = 'detail-list-title';
    heading.textContent = label;
    const list = document.createElement('div');
    list.className = 'detail-node-list is-secondary';

    [...new Map(nodes.map(node => [node.id, node])).values()]
      .slice(0, 10)
      .forEach(node => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = node.detailLabel || node.label;
        button.addEventListener('click', () => {
          atlasPinnedId = node.id;
          applyAtlasHighlight(node.id, true);
          openAtlasInspector(node);
        });
        list.appendChild(button);
      });

    container.append(heading, list);
  };

  const openAtlasInspector = node => {
    window.clearTimeout(detailCloseTimer);
    detailPanel.innerHTML = '';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'detail-close';
    close.setAttribute('aria-label', 'Close Atlas inspector');
    close.textContent = '×';
    close.addEventListener('click', () => {
      atlasPinnedId = null;
      clearAtlasHighlight();
      closeDetail();
    });

    const eyebrow = document.createElement('p');
    eyebrow.className = 'detail-eyebrow';
    eyebrow.textContent = humanType(node.type);

    const title = document.createElement('h2');
    title.textContent = node.detailLabel || node.label;

    const summary = document.createElement('p');
    summary.className = 'detail-summary';
    summary.textContent = node.summary || 'A connected item in the profile map.';

    detailPanel.append(close, eyebrow, title, summary);

    const section = topSectionFor(node);
    if (section) {
      const facts = document.createElement('dl');
      facts.className = 'detail-facts atlas-facts';
      const dt = document.createElement('dt');
      dt.textContent = 'Part of';
      const dd = document.createElement('dd');
      dd.textContent = section.label;
      facts.append(dt, dd);

      const parents = (node.parentIds || []).map(id => nodeMap.get(id)).filter(Boolean);
      if (parents.length) {
        const pdt = document.createElement('dt');
        pdt.textContent = 'Parent';
        const pdd = document.createElement('dd');
        pdd.textContent = parents.map(parent => parent.label).join(' · ');
        facts.append(pdt, pdd);
      }

      const descendants = allDescendantIds(node.id);
      const cdt = document.createElement('dt');
      cdt.textContent = 'Below';
      const cdd = document.createElement('dd');
      cdd.textContent = descendants.size
        ? `${descendants.size} connected descendant${descendants.size === 1 ? '' : 's'}`
        : 'Leaf node';
      facts.append(cdt, cdd);
      detailPanel.appendChild(facts);
    }

    const parents = (node.parentIds || []).map(id => nodeMap.get(id)).filter(Boolean);
    const children = childrenFor(node.id);
    const lateral = graph.edges
      .filter(edge => edge.source === node.id || edge.target === node.id)
      .map(edge => nodeMap.get(edge.source === node.id ? edge.target : edge.source))
      .filter(Boolean);

    appendInspectorNodeButtons(detailPanel, 'Upstream', parents);
    appendInspectorNodeButtons(detailPanel, 'Downstream', children);
    appendInspectorNodeButtons(detailPanel, 'Cross-links', lateral);

    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'detail-route-action atlas-open-local';
    action.textContent = node.id === root.id
      ? 'Open overview'
      : node.id === 'work'
        ? 'Open Work graph'
        : 'Open local graph';
    action.addEventListener('click', () => updateHash(routeForNode(node)));
    detailPanel.appendChild(action);

    detailPanel.hidden = false;
    requestAnimationFrame(() => detailPanel.classList.add('is-open'));
  };

  const renderLeafDetail = target => {
    detailPanel.innerHTML = '';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'detail-close';
    close.setAttribute('aria-label', 'Close detail');
    close.textContent = '×';
    close.addEventListener('click', closeDetail);

    const eyebrow = document.createElement('p');
    eyebrow.className = 'detail-eyebrow';
    eyebrow.textContent = humanType(target.type);

    const title = document.createElement('h2');
    title.textContent = target.detailLabel || target.label;

    const summary = document.createElement('p');
    summary.className = 'detail-summary';
    summary.textContent = target.summary || 'A focused part of the profile.';

    detailPanel.append(close, eyebrow, title, summary);

    if (target.status || target.meta) {
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
    }

    const facts = [
      ['Role', target.role],
      ['Programme', target.programme],
      ['Organisation', target.organisation]
    ].filter(([, value]) => value);

    if (facts.length) {
      const dl = document.createElement('dl');
      dl.className = 'detail-facts';
      facts.forEach(([label, value]) => {
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = value;
        dl.append(dt, dd);
      });
      detailPanel.appendChild(dl);
    }

    if (target.highlights?.length) {
      const heading = document.createElement('p');
      heading.className = 'detail-list-title';
      heading.textContent = target.type === 'experience'
        ? 'Key responsibilities'
        : 'Key areas';
      const list = document.createElement('ul');
      list.className = 'detail-highlights';
      target.highlights.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li);
      });
      detailPanel.append(heading, list);
    }

    const related = graph.edges
      .filter(edge => edge.source === target.id || edge.target === target.id)
      .map(edge => nodeMap.get(edge.source === target.id ? edge.target : edge.source))
      .filter(Boolean);

    if (related.length) {
      const heading = document.createElement('p');
      heading.className = 'detail-list-title';
      heading.textContent = 'Connected in the profile';
      const list = document.createElement('div');
      list.className = 'detail-node-list is-secondary';
      [...new Map(related.map(node => [node.id, node])).values()].slice(0, 8).forEach(node => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = node.label;
        button.addEventListener('click', () => updateHash(routeForNode(node)));
        list.appendChild(button);
      });
      detailPanel.append(heading, list);
    }

    detailPanel.hidden = false;
    requestAnimationFrame(() => detailPanel.classList.add('is-open'));
  };

  /* ------------------------------------------------------------------------
     Atlas highlighting
     ------------------------------------------------------------------------ */
  const clearAtlasHighlight = () => {
    renderer.nodeElements.forEach(element => {
      element.classList.remove(
        'is-atlas-origin',
        'is-upstream',
        'is-downstream',
        'is-lateral',
        'is-muted-soft',
        'is-previewed'
      );
    });
    renderer.edgeElements.forEach(element => {
      element.classList.remove(
        'is-upstream',
        'is-downstream',
        'is-lateral',
        'is-muted-soft',
        'is-related'
      );
    });
  };

  const applyAtlasHighlight = (nodeId, pinned = false) => {
    if (state.mode !== 'atlas') return;
    const node = nodeMap.get(nodeId);
    if (!node) return;

    clearAtlasHighlight();

    const ancestors = allAncestorIds(nodeId);
    const descendants = allDescendantIds(nodeId);
    const lateral = new Set();

    graph.edges.forEach(edge => {
      if (edge.source === nodeId) lateral.add(edge.target);
      if (edge.target === nodeId) lateral.add(edge.source);
    });

    const relevant = new Set([nodeId, ...ancestors, ...descendants, ...lateral]);

    renderer.nodeElements.forEach((element, id) => {
      element.classList.toggle('is-atlas-origin', id === nodeId);
      element.classList.toggle('is-upstream', ancestors.has(id));
      element.classList.toggle('is-downstream', descendants.has(id));
      element.classList.toggle('is-lateral', lateral.has(id));
      element.classList.toggle('is-muted-soft', !relevant.has(id));
      element.classList.toggle('is-previewed', pinned && id === nodeId);
    });

    renderer.edgeElements.forEach((element, key) => {
      const edge = renderer.lastEdges.find(item => `${item.source}|${item.target}|${item.type}` === key);
      if (!edge) return;

      const hierarchy = edge.type === 'hierarchy' || edge.type === 'hierarchy-alt';
      const upstream =
        hierarchy &&
        (edge.target === nodeId || ancestors.has(edge.target)) &&
        (ancestors.has(edge.source) || edge.source === nodeId);

      const downstream =
        hierarchy &&
        (edge.source === nodeId || descendants.has(edge.source)) &&
        descendants.has(edge.target);

      const side =
        !hierarchy &&
        (edge.source === nodeId || edge.target === nodeId);

      element.classList.toggle('is-upstream', upstream);
      element.classList.toggle('is-downstream', downstream);
      element.classList.toggle('is-lateral', side);
      element.classList.toggle('is-muted-soft', !(upstream || downstream || side));
    });
  };

  const restoreAtlasHighlight = () => {
    if (atlasPinnedId) applyAtlasHighlight(atlasPinnedId, true);
    else clearAtlasHighlight();
  };

  /* ------------------------------------------------------------------------
     Renderer
     ------------------------------------------------------------------------ */
  const edgeKey = edge => `${edge.source}|${edge.target}|${edge.type}`;

  const pointForElement = element => ({
    x: Number(element?.dataset.x || 0),
    y: Number(element?.dataset.y || 0)
  });

  const setPoint = (element, point) => {
    element.setAttribute('transform', `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`);
    element.dataset.x = point.x;
    element.dataset.y = point.y;
  };

  const edgePath = (from, to, id) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const seedBend = ((stableNumber(id) % 71) - 35) * .9;
    const hierarchyBias = Math.min(26, Math.abs(dx) * .055);
    const bend = Math.max(-80, Math.min(80, seedBend + hierarchyBias));
    const nx = -dy / distance;
    const ny = dx / distance;
    const control = {
      x: (from.x + to.x) / 2 + nx * bend,
      y: (from.y + to.y) / 2 + ny * bend
    };
    return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${control.x.toFixed(1)} ${control.y.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
  };

  const ensureRenderer = layout => {
    if (renderer.svg) return;

    renderer.svg = document.createElementNS(svgNS, 'svg');
    renderer.svg.classList.add('site-graph-svg', 'profile-map-svg', 'profile-map-svg-v4');
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
      const active = renderer.lastLayout || layout;
      const rawDelta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      const delta = Math.max(-180, Math.min(180, rawDelta));
      const point = {
        x: (event.clientX - bounds.left) * active.width / Math.max(bounds.width, 1),
        y: (event.clientY - bounds.top) * active.height / Math.max(bounds.height, 1)
      };
      zoomAtlasAt(point, Math.exp(-delta * .00235));
    }, { passive: false });

    renderer.svg.addEventListener('pointerdown', event => {
      if (state.mode !== 'atlas' || event.button !== 0) return;
      renderer.drag = {
        x: event.clientX,
        y: event.clientY,
        moved: false,
        target: event.target
      };
      renderer.svg.setPointerCapture?.(event.pointerId);
      renderer.svg.classList.add('is-dragging');
    });

    renderer.svg.addEventListener('pointermove', event => {
      if (!renderer.drag || state.mode !== 'atlas') return;
      const bounds = renderer.svg.getBoundingClientRect();
      const active = renderer.lastLayout || layout;
      const dx = (event.clientX - renderer.drag.x) * active.width / Math.max(bounds.width, 1);
      const dy = (event.clientY - renderer.drag.y) * active.height / Math.max(bounds.height, 1);
      if (Math.abs(dx) + Math.abs(dy) > 2) renderer.drag.moved = true;

      // Direct 1:1 panning: no easing while the pointer is held.
      atlasTransform.x += dx;
      atlasTransform.y += dy;
      atlasTransform.targetX = atlasTransform.x;
      atlasTransform.targetY = atlasTransform.y;
      renderer.drag.x = event.clientX;
      renderer.drag.y = event.clientY;
      paintAtlasTransform();
    });

    const endDrag = event => {
      if (!renderer.drag) return;
      const moved = renderer.drag.moved;
      const target = renderer.drag.target;
      renderer.svg.releasePointerCapture?.(event.pointerId);
      renderer.drag = null;
      renderer.svg.classList.remove('is-dragging');

      if (!moved && target === renderer.svg) {
        atlasPinnedId = null;
        restoreAtlasHighlight();
        closeDetail();
      }
    };

    renderer.svg.addEventListener('pointerup', endDrag);
    renderer.svg.addEventListener('pointercancel', endDrag);
  };

  const createNodeElement = node => {
    const group = document.createElementNS(svgNS, 'g');
    group.classList.add('site-graph-node', `is-${node.type}`);
    group.dataset.nodeId = node.id;
    group.setAttribute('tabindex', '0');
    group.setAttribute('role', 'button');
    group.setAttribute('aria-label', `${node.label}. ${state.mode === 'atlas' ? 'Inspect node.' : 'Open local graph.'}`);

    const hit = document.createElementNS(svgNS, 'circle');
    hit.classList.add('site-graph-hit');
    hit.setAttribute('r', node.id === root.id ? '26' : '21');
    hit.setAttribute('fill', 'transparent');

    const dot = document.createElementNS(svgNS, 'circle');
    dot.classList.add('site-graph-dot');
    dot.setAttribute(
      'r',
      node.id === root.id ? '15' :
        node.type === 'section' ? '9' :
          node.type === 'project' ? '5' :
            node.type === 'work-theme' ? '6.5' : '6'
    );

    const label = document.createElementNS(svgNS, 'text');
    label.classList.add('site-graph-label');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('y', node.id === root.id ? '-25' : '25');
    label.textContent = node.label;

    group.append(hit, dot, label);

    if (node.meta) {
      const meta = document.createElementNS(svgNS, 'text');
      meta.classList.add('site-graph-meta');
      meta.setAttribute('text-anchor', 'middle');
      meta.setAttribute('y', '42');
      meta.textContent = node.meta;
      group.appendChild(meta);
    }

    const preview = () => {
      if (state.mode === 'atlas') {
        atlasHoveredId = node.id;
        applyAtlasHighlight(node.id, false);
        return;
      }

      const upstream = allAncestorIds(node.id);
      const downstream = allDescendantIds(node.id);
      const relevant = new Set([node.id, ...upstream, ...downstream]);

      renderer.nodeElements.forEach((element, id) => {
        element.classList.toggle('is-muted-soft', !relevant.has(id));
        element.classList.toggle('is-upstream', upstream.has(id));
        element.classList.toggle('is-downstream', downstream.has(id));
      });

      renderer.edgeElements.forEach((element, key) => {
        const edge = renderer.lastEdges.find(item => edgeKey(item) === key);
        if (!edge) return;
        const up = upstream.has(edge.source) && (upstream.has(edge.target) || edge.target === node.id);
        const down = (edge.source === node.id || downstream.has(edge.source)) && downstream.has(edge.target);
        element.classList.toggle('is-upstream', up);
        element.classList.toggle('is-downstream', down);
        element.classList.toggle('is-muted-soft', !(up || down));
      });
    };

    const clear = () => {
      if (state.mode === 'atlas') {
        atlasHoveredId = null;
        restoreAtlasHighlight();
        return;
      }
      renderer.nodeElements.forEach(element => {
        element.classList.remove('is-muted-soft', 'is-upstream', 'is-downstream');
      });
      renderer.edgeElements.forEach(element => {
        element.classList.remove('is-muted-soft', 'is-upstream', 'is-downstream');
      });
    };

    const activate = () => {
      if (state.mode === 'atlas') {
        atlasPinnedId = node.id;
        applyAtlasHighlight(node.id, true);
        openAtlasInspector(node);
      } else {
        updateHash(routeForNode(node));
      }
    };

    group.addEventListener('mouseenter', preview);
    group.addEventListener('mouseleave', clear);
    group.addEventListener('focus', preview);
    group.addEventListener('blur', clear);
    group.addEventListener('click', event => {
      event.stopPropagation();
      if (!renderer.drag?.moved) activate();
    });
    group.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activate();
      }
    });

    return group;
  };

  const renderGraph = () => {
    const view = visibleGraph();
    const layout = layoutGraph(view.nodes);
    const edges = graphEdges(view.nodes);

    ensureRenderer(layout);

    renderer.svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
    renderer.lastLayout = layout;
    renderer.lastEdges = edges;

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
    const previousPositions = new Map(
      [...renderer.nodeElements.entries()].map(([id, element]) => [id, pointForElement(element)])
    );

    const fallbackPoint =
      previousPositions.get(state.node.id) ||
      previousPositions.get(workNode.id) ||
      { x: layout.width / 2, y: layout.height / 2 };

    const starts = new Map();
    const targets = new Map();
    const enteringNodes = new Set();

    view.nodes.forEach(node => {
      let element = renderer.nodeElements.get(node.id);
      const target = layout.positions.get(node.id) || fallbackPoint;

      if (!element) {
        element = createNodeElement(node);
        renderer.nodeElements.set(node.id, element);
        renderer.nodes.appendChild(element);
        enteringNodes.add(node.id);

        const visibleParent = (node.parentIds || [])
          .map(id => renderer.nodeElements.get(id))
          .find(Boolean);
        const start = visibleParent
          ? pointForElement(visibleParent)
          : fallbackPoint;
        starts.set(node.id, start);
        setPoint(element, start);
        element.style.opacity = '0';
      } else {
        starts.set(node.id, pointForElement(element));
      }

      targets.set(node.id, target);
      element.classList.toggle('is-selected', node.id === state.node.id && state.mode !== 'overview');
      element.classList.toggle('is-root', node.id === root.id);
      element.classList.toggle('is-section', node.type === 'section');
    });

    const leavingNodes = [...renderer.nodeElements.entries()]
      .filter(([id]) => !visibleIds.has(id));

    const edgeStarts = new Map();
    const edgeTargets = new Map();
    const enteringEdges = new Set();

    edges.forEach(edge => {
      const key = edgeKey(edge);
      let element = renderer.edgeElements.get(key);
      if (!element) {
        element = document.createElementNS(svgNS, 'path');
        element.dataset.source = edge.source;
        element.dataset.target = edge.target;
        element.dataset.type = edge.type;
        element.classList.add(`is-${edge.type}`);
        if (edge.type !== 'hierarchy' && edge.type !== 'hierarchy-alt') {
          element.classList.add('is-cross-link');
        }
        if (edge.type === 'hierarchy-alt' || edge.secondary) {
          element.classList.add('is-secondary');
        }

        const title = document.createElementNS(svgNS, 'title');
        title.textContent = edgeTypeLabel(edge.type);
        element.appendChild(title);

        renderer.edgeElements.set(key, element);
        renderer.edges.appendChild(element);
        enteringEdges.add(key);
        element.style.opacity = '0';
      }

      const sourceStart = starts.get(edge.source) || previousPositions.get(edge.source) || fallbackPoint;
      const targetStart = starts.get(edge.target) || previousPositions.get(edge.target) || sourceStart;
      const sourceTarget = targets.get(edge.source) || sourceStart;
      const targetTarget = targets.get(edge.target) || targetStart;

      edgeStarts.set(key, { source: sourceStart, target: targetStart });
      edgeTargets.set(key, { source: sourceTarget, target: targetTarget });
    });

    const leavingEdges = [...renderer.edgeElements.entries()]
      .filter(([key]) => !visibleEdgeKeys.has(key));

    cancelAnimationFrame(renderer.animationFrame);

    const duration = reducedMotion.matches ? 0 : 430;
    const started = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);

    const frame = now => {
      const raw = duration ? Math.min(1, (now - started) / duration) : 1;
      const progress = ease(raw);

      view.nodes.forEach(node => {
        const element = renderer.nodeElements.get(node.id);
        const from = starts.get(node.id);
        const to = targets.get(node.id);
        if (!element || !from || !to) return;
        const point = {
          x: from.x + (to.x - from.x) * progress,
          y: from.y + (to.y - from.y) * progress
        };
        setPoint(element, point);
        if (enteringNodes.has(node.id)) element.style.opacity = String(progress);
      });

      edges.forEach(edge => {
        const key = edgeKey(edge);
        const element = renderer.edgeElements.get(key);
        const from = edgeStarts.get(key);
        const to = edgeTargets.get(key);
        if (!element || !from || !to) return;
        const source = {
          x: from.source.x + (to.source.x - from.source.x) * progress,
          y: from.source.y + (to.source.y - from.source.y) * progress
        };
        const target = {
          x: from.target.x + (to.target.x - from.target.x) * progress,
          y: from.target.y + (to.target.y - from.target.y) * progress
        };
        element.setAttribute('d', edgePath(source, target, key));
        if (enteringEdges.has(key)) element.style.opacity = String(progress);
      });

      leavingNodes.forEach(([, element]) => {
        element.style.opacity = String(1 - progress);
        const p = pointForElement(element);
        const target = targets.get(state.node.id) || fallbackPoint;
        setPoint(element, {
          x: p.x + (target.x - p.x) * progress * .24,
          y: p.y + (target.y - p.y) * progress * .24
        });
      });

      leavingEdges.forEach(([, element]) => {
        element.style.opacity = String(1 - progress);
      });

      if (raw < 1) {
        renderer.animationFrame = requestAnimationFrame(frame);
        return;
      }

      leavingNodes.forEach(([id, element]) => {
        element.remove();
        renderer.nodeElements.delete(id);
      });
      leavingEdges.forEach(([key, element]) => {
        element.remove();
        renderer.edgeElements.delete(key);
      });

      renderer.nodeElements.forEach(element => {
        element.style.opacity = '';
      });
      renderer.edgeElements.forEach(element => {
        element.style.opacity = '';
      });

      if (state.mode === 'atlas') {
        paintAtlasTransform();
        restoreAtlasHighlight();
      } else {
        renderer.camera.setAttribute('transform', '');
      }
    };

    renderer.animationFrame = requestAnimationFrame(frame);
  };

  /* ------------------------------------------------------------------------
     Work bridge / Work scene integration
     ------------------------------------------------------------------------ */
  const patchWorkMatchIntensity = () => {
    const selected = new Set(
      [...document.querySelectorAll('#work-theme-filters input[data-theme-id]:checked')]
        .map(input => input.dataset.themeId)
    );
    const mode = document.querySelector('[data-theme-mode][aria-pressed="true"]')?.dataset.themeMode || 'any';

    document.querySelectorAll('#work-lattice [data-project-anchor]').forEach(anchor => {
      anchor.classList.remove('theme-match-1', 'theme-match-2', 'theme-match-3', 'theme-match-4');
      if (!selected.size || mode !== 'any') return;
      const project = site.work.projects.find(item => item.id === anchor.dataset.projectAnchor);
      if (!project) return;
      const count = [...selected].filter(id => project.lattice.includes(id)).length;
      if (count) anchor.classList.add(`theme-match-${Math.min(count, 4)}`);
    });
  };

  const patchWorkLattice = () => {
    const svg = document.querySelector('#work-lattice .work-lattice-svg');
    if (!svg || svg.dataset.profileBridge === 'true') {
      patchWorkMatchIntensity();
      return;
    }

    svg.dataset.profileBridge = 'true';

    // Rename the mathematical top concept to the canonical global node.
    const topLabel = svg.querySelector('.concept-top-label');
    if (topLabel) topLabel.textContent = 'WORK';

    const viewBox = (svg.getAttribute('viewBox') || '0 0 900 500')
      .split(/\s+/)
      .map(Number);
    const [x, y, width, height] = viewBox;
    svg.setAttribute('viewBox', `${x} ${y - 92} ${width} ${height + 92}`);

    const topConcept = [...svg.querySelectorAll('.concept-node')]
      .sort((a, b) => Number(a.querySelector('.concept-top-label') ? 0 : 1))[0];
    const transform = topConcept?.getAttribute('transform') || 'translate(450 42)';
    const match = transform.match(/translate\(([-\d.]+)[ ,]+([-\d.]+)\)/);
    const topX = match ? Number(match[1]) : width / 2;
    const topY = match ? Number(match[2]) : 42;
    const rootY = topY - 72;

    const bridge = document.createElementNS(svgNS, 'g');
    bridge.classList.add('work-profile-bridge');

    const line = document.createElementNS(svgNS, 'path');
    line.classList.add('work-profile-bridge-edge');
    line.setAttribute('d', `M ${topX} ${rootY + 7} Q ${topX + 18} ${(rootY + topY) / 2} ${topX} ${topY - 7}`);

    const rootGroup = document.createElementNS(svgNS, 'g');
    rootGroup.classList.add('work-profile-root');
    rootGroup.setAttribute('transform', `translate(${topX} ${rootY})`);
    rootGroup.setAttribute('tabindex', '0');
    rootGroup.setAttribute('role', 'button');
    rootGroup.setAttribute('aria-label', 'Štěpán Chrast. Return to overview.');

    const hit = document.createElementNS(svgNS, 'circle');
    hit.classList.add('work-profile-root-hit');
    hit.setAttribute('r', '22');
    hit.setAttribute('fill', 'transparent');

    const dot = document.createElementNS(svgNS, 'circle');
    dot.classList.add('work-profile-root-dot');
    dot.setAttribute('r', '8');

    const label = document.createElementNS(svgNS, 'text');
    label.classList.add('work-profile-root-label');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('y', '-17');
    label.textContent = site.profile.name;

    rootGroup.append(hit, dot, label);
    const goHome = () => updateHash('overview');
    rootGroup.addEventListener('click', event => {
      event.stopPropagation();
      goHome();
    });
    rootGroup.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        goHome();
      }
    });

    bridge.append(line, rootGroup);
    svg.insertBefore(bridge, svg.firstChild);

    patchWorkMatchIntensity();
  };

  const watchWorkLattice = () => {
    const target = document.querySelector('#work-lattice');
    if (!target) return;
    const observer = new MutationObserver(() => patchWorkLattice());
    observer.observe(target, { childList: true, subtree: true });
    window.addEventListener('load', () => patchWorkLattice(), { once: true });
    document.addEventListener('change', event => {
      if (event.target.closest?.('#work-theme-filters, .theme-match-control')) {
        requestAnimationFrame(patchWorkMatchIntensity);
      }
    });
    document.addEventListener('click', event => {
      if (event.target.closest?.('#work-lattice .attribute-edge-label, .theme-match-button')) {
        requestAnimationFrame(() => requestAnimationFrame(patchWorkMatchIntensity));
      }
    });
  };
  watchWorkLattice();

  const hideLegacy = () => {
    legacyViews.forEach(view => { view.hidden = true; });
    if (footer) footer.hidden = true;
  };

  const updateNavigation = () => {
    document.querySelectorAll('#main-nav [data-route]').forEach(item => {
      const route = item.dataset.route;
      const current =
        route === state.route ||
        (route === 'work' && state.mode === 'work') ||
        (state.mode === 'focus' && state.route.startsWith(`${route}/`));
      item.setAttribute('aria-current', current ? 'page' : 'false');
    });
  };

  const setSceneCopy = target => {
    graphKicker.textContent =
      state.mode === 'atlas' ? 'Atlas' :
        state.mode === 'overview' ? 'Profile graph' :
          humanType(target.type);

    graphTitle.textContent =
      state.mode === 'overview' ? 'Explore the profile' :
        state.mode === 'atlas' ? 'Full profile graph' :
          target.label;

    graphHelp.textContent =
      state.mode === 'atlas'
        ? 'Hover to read upstream, downstream and cross-links. Click to pin a node; open its local graph from the inspector.'
        : state.mode === 'overview'
          ? 'Select an area to let the map unfold around it.'
          : target.id === 'experience'
            ? 'Roles remain chronological while the ancestor path stays visible.'
            : 'Select a connected node to move deeper. Ancestors remain in the graph so you can move back directly.';
  };

  const enterWorkScene = (route, token) => {
    const target = nodeForRoute(route) || workNode;

    // Phase 1: use the shared renderer to organically focus Work.
    state = { route: 'work', mode: 'focus', node: workNode };
    document.body.dataset.graphMode = 'focus';
    document.body.dataset.graphRoute = 'work';
    hero.hidden = true;
    explorer.hidden = false;
    graphPanel.hidden = false;
    graphRoutebar.hidden = false;
    workView.hidden = true;
    workView.classList.remove('is-project-open', 'is-work-leaving');
    renderBreadcrumb(workNode);
    setSceneCopy(workNode);
    syncAtlasControls();
    renderGraph();
    closeDetail();
    updateNavigation();

    const delay = reducedMotion.matches ? 0 : 300;
    window.setTimeout(() => {
      if (token !== routeToken) return;

      state = { route, mode: 'work', node: target };
      document.body.dataset.graphMode = 'work';
      document.body.dataset.graphRoute = route;
      graphRoutebar.hidden = true;
      workRouteHeader.hidden = true;
      workView.hidden = false;
      workView.classList.remove('is-work-leaving');
      workView.classList.add('is-work-entering-v4');
      patchWorkLattice();

      // Keep the bridge graph behind for the beginning of the morph, then let
      // the true FCA view fully take over.
      graphPanel.classList.add('is-work-transition-background');

      window.setTimeout(() => {
        if (token !== routeToken) return;
        graphPanel.hidden = true;
        graphPanel.classList.remove('is-work-transition-background');
        workView.classList.remove('is-work-entering-v4');
      }, reducedMotion.matches ? 0 : 460);

      const projectMatch = route.match(/^work\/project\/([^/]+)$/);
      const themeMatch = route.match(/^work\/theme\/([^/]+)$/);

      if (projectMatch) {
        const projectId = projectMatch[1];
        window.SITE_GRAPH_PENDING_WORK_PROJECT = projectId;
        window.dispatchEvent(new CustomEvent('site:open-work-project', {
          detail: { projectId }
        }));
      }

      if (themeMatch) {
        const themeId = themeMatch[1];
        window.SITE_GRAPH_PENDING_WORK_THEME = themeId;
        window.dispatchEvent(new CustomEvent('site:open-work-theme', {
          detail: { themeId }
        }));
        requestAnimationFrame(() => requestAnimationFrame(patchWorkMatchIntensity));
      }

      updateNavigation();
      graphStatus.textContent = 'Work graph open.';
    }, delay);
  };

  const finishNonWorkRoute = (route, target, atlas, token) => {
    if (token !== routeToken) return;

    state = {
      route: atlas ? 'atlas' : routeForNode(target),
      mode: atlas ? 'atlas' : target.id === root.id ? 'overview' : 'focus',
      node: target
    };

    document.body.dataset.graphMode = state.mode;
    document.body.dataset.graphRoute = state.route;
    hero.hidden = state.mode !== 'overview';
    explorer.hidden = false;
    graphPanel.hidden = false;
    graphRoutebar.hidden = false;
    workView.hidden = true;
    workView.classList.remove('is-project-open', 'is-work-leaving', 'is-work-entering-v4');
    workRouteHeader.hidden = true;
    hideLegacy();

    if (state.mode !== 'atlas') {
      cancelAnimationFrame(atlasTransform.frame);
      atlasTransform.frame = 0;
    }

    if (state.mode !== 'atlas') {
      atlasPinnedId = null;
      atlasHoveredId = null;
      clearAtlasHighlight();
    }

    setSceneCopy(target);
    renderBreadcrumb(target);
    syncAtlasControls();
    renderGraph();

    if (state.mode === 'atlas') {
      fitAtlas(true);
      closeDetail();
    } else {
      const isLeaf = childrenFor(target.id).length === 0;
      if (isLeaf && target.id !== root.id) renderLeafDetail(target);
      else closeDetail();
    }

    updateNavigation();
    graphStatus.textContent = `${graphTitle.textContent} view open.`;
  };

  const renderRoute = rawRoute => {
    const token = ++routeToken;
    const route = normaliseRoute(rawRoute);
    const atlas = route === 'atlas';
    const target = atlas ? root : (nodeForRoute(route) || root);
    const workRoute = isWorkRoute(route);

    hideLegacy();

    if (workRoute) {
      enterWorkScene(route, token);
      return;
    }

    if (state.mode === 'work') {
      // Reverse bridge: Work scene collapses back into the shared Work node,
      // then the normal target layout takes over.
      workView.classList.add('is-work-leaving');
      graphPanel.hidden = false;
      graphRoutebar.hidden = false;

      state = { route: 'work', mode: 'focus', node: workNode };
      document.body.dataset.graphMode = 'focus';
      document.body.dataset.graphRoute = 'work';
      renderBreadcrumb(workNode);
      setSceneCopy(workNode);
      renderGraph();

      window.setTimeout(() => {
        if (token !== routeToken) return;
        workView.hidden = true;
        workView.classList.remove('is-work-leaving');
        finishNonWorkRoute(route, target, atlas, token);
      }, reducedMotion.matches ? 0 : 270);
      return;
    }

    finishNonWorkRoute(route, target, atlas, token);
  };

  /* ------------------------------------------------------------------------
     Global events
     ------------------------------------------------------------------------ */
  window.addEventListener('hashchange', () => renderRoute(location.hash));

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (state.mode !== 'work') renderGraph();
      else patchWorkLattice();
    }, 100);
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;

    if (state.mode === 'atlas' && atlasPinnedId) {
      event.preventDefault();
      atlasPinnedId = null;
      clearAtlasHighlight();
      closeDetail();
      return;
    }

    if (!detailPanel.hidden) {
      event.preventDefault();
      closeDetail();
      return;
    }

    if (state.mode === 'work') {
      event.preventDefault();
      updateHash('overview');
      return;
    }

    if (state.mode === 'atlas') {
      event.preventDefault();
      updateHash('overview');
      return;
    }

    if (state.mode === 'focus') {
      event.preventDefault();
      const parent = nodeMap.get(state.node.parentIds?.[0]) || root;
      updateHash(routeForNode(parent));
    }
  });

  // Apply after the Work script renders as well.
  window.addEventListener('load', () => {
    patchWorkLattice();
    patchWorkMatchIntensity();
  });

  renderRoute(location.hash || '#overview');
})();