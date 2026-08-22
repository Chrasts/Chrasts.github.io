(() => {
  if (window.ProfileGlobalGeometry) return;
  const graph = window.SITE_DATA?.graph;
  if (!graph?.nodes?.length) return;

  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const rootId = graph.rootId || 'stepan-chrast';
  const sectionIds = ['work', 'knowledge', 'experience', 'education', 'about'];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  const unit = (x, y) => {
    const length = Math.max(1, Math.hypot(x, y));
    return { x: x / length, y: y / length };
  };
  const vectors = Object.freeze({
    work: unit(0, 1),
    knowledge: unit(-0.25, -0.97),
    experience: unit(0.95, -0.31),
    education: unit(0.76, 0.65),
    about: unit(-0.95, 0.31)
  });
  const perpendicular = vector => ({ x: -vector.y, y: vector.x });
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const scale = (vector, amount) => ({ x: vector.x * amount, y: vector.y * amount });
  const dot = (point, vector) => point.x * vector.x + point.y * vector.y;

  const stableNumber = value => {
    let number = 2166136261;
    for (const character of String(value)) number = Math.imul(number ^ character.charCodeAt(0), 16777619);
    return number >>> 0;
  };

  const topSection = id => {
    if (sectionIds.includes(id)) return id;
    let node = nodeMap.get(id);
    const seen = new Set();
    while (node && !seen.has(node.id)) {
      seen.add(node.id);
      const parentId = node.parentIds?.[0];
      if (!parentId) return null;
      if (parentId === rootId) return node.id;
      node = nodeMap.get(parentId);
    }
    return null;
  };

  const relativeDepth = (id, sectionId, memo = new Map(), trail = new Set()) => {
    const key = `${sectionId}:${id}`;
    if (memo.has(key)) return memo.get(key);
    if (id === sectionId) return 0;
    if (trail.has(id)) return Infinity;
    const node = nodeMap.get(id);
    if (!node) return Infinity;
    if (node.type === 'work-theme' && sectionId === 'work') return 1;
    if (node.type === 'project' && sectionId === 'work') return 2;
    const nextTrail = new Set(trail).add(id);
    const depths = (node.parentIds || [])
      .filter(parentId => nodeMap.has(parentId))
      .map(parentId => relativeDepth(parentId, sectionId, memo, nextTrail))
      .filter(Number.isFinite);
    const depth = depths.length ? Math.min(...depths) + 1 : Infinity;
    memo.set(key, depth);
    return depth;
  };

  const OVERVIEW = Object.freeze({
    width: 1200,
    height: 720,
    root: { x: 600, y: 340 },
    radius: 245
  });
  const ATLAS = Object.freeze({
    width: 2520,
    height: 1580,
    root: { x: 1260, y: 790 },
    radius: 330
  });

  const overviewPositions = () => {
    const positions = new Map([[rootId, { ...OVERVIEW.root }]]);
    sectionIds.forEach(id => {
      positions.set(id, add(OVERVIEW.root, scale(vectors[id], OVERVIEW.radius)));
    });
    return positions;
  };

  const depthStepFor = sectionId => ({
    work: 150,
    knowledge: 92,
    experience: 150,
    education: 132,
    about: 132
  }[sectionId] || 120);

  const gapFor = (sectionId, count, depth) => {
    if (sectionId === 'work' && depth === 2) return Math.min(145, 1040 / Math.max(1, count - 1));
    if (sectionId === 'knowledge') return Math.min(depth <= 2 ? 122 : 112, 1180 / Math.max(1, count - 1));
    return Math.min(148, 560 / Math.max(1, count - 1));
  };

  const atlasPositions = () => {
    const positions = new Map([[rootId, { ...ATLAS.root }]]);
    const sectionAnchors = new Map();
    sectionIds.forEach(id => {
      const anchor = add(ATLAS.root, scale(vectors[id], ATLAS.radius));
      sectionAnchors.set(id, anchor);
      positions.set(id, anchor);
    });

    const memo = new Map();
    sectionIds.forEach(sectionId => {
      const vector = vectors[sectionId];
      const cross = perpendicular(vector);
      const anchor = sectionAnchors.get(sectionId);
      const grouped = new Map();
      graph.nodes.forEach(node => {
        if (node.id === rootId || sectionIds.includes(node.id)) return;
        if (topSection(node.id) !== sectionId) return;
        let depth = relativeDepth(node.id, sectionId, memo);
        if (!Number.isFinite(depth)) return;
        if (!grouped.has(depth)) grouped.set(depth, []);
        grouped.get(depth).push(node);
      });

      [...grouped.keys()].sort((a, b) => a - b).forEach(depth => {
        const nodes = grouped.get(depth);
        const base = add(anchor, scale(vector, depthStepFor(sectionId) * depth));
        nodes.sort((left, right) => {
          const bary = node => {
            const parentPoints = (node.parentIds || []).map(id => positions.get(id)).filter(Boolean);
            if (!parentPoints.length) return (stableNumber(node.id) % 1000) - 500;
            const avg = parentPoints.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
            avg.x /= parentPoints.length;
            avg.y /= parentPoints.length;
            return dot({ x: avg.x - base.x, y: avg.y - base.y }, cross);
          };
          return bary(left) - bary(right) || left.label.localeCompare(right.label);
        });

        const gap = gapFor(sectionId, nodes.length, depth);
        const span = gap * Math.max(0, nodes.length - 1);
        nodes.forEach((node, index) => {
          const lateral = nodes.length <= 1 ? 0 : -span / 2 + index * gap;
          const jitter = nodes.length <= 1 ? 0 : ((stableNumber(`${node.id}:radial`) % 17) - 8) * .55;
          positions.set(node.id, add(base, scale(cross, lateral + jitter)));
        });
      });
    });

    return positions;
  };

  const geometryForMode = mode => mode === 'atlas' ? atlasPositions() : overviewPositions();
  const nodeElements = () => [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
    .filter(element => !element.closest('.v9-transition-overlay'));
  const edgeElements = () => [...document.querySelectorAll('#site-graph .site-graph-edges path[data-source][data-target]')]
    .filter(element => !element.closest('.v9-transition-overlay'));

  const setPoint = (element, point) => {
    if (!element || !point) return;
    element.dataset.x = String(point.x);
    element.dataset.y = String(point.y);
    element.setAttribute('transform', `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`);
  };

  const setLabel = (element, id) => {
    const label = element?.querySelector('.site-graph-label');
    const meta = element?.querySelector('.site-graph-meta');
    if (!label) return;
    if (id === rootId) {
      label.setAttribute('x', '0');
      label.setAttribute('y', '-27');
      label.setAttribute('text-anchor', 'middle');
      if (meta) { meta.setAttribute('x', '0'); meta.setAttribute('y', '35'); meta.setAttribute('text-anchor', 'middle'); }
      return;
    }
    const sectionId = topSection(id) || id;
    const vector = vectors[sectionId] || { x: 0, y: 1 };
    const x = vector.x * 19;
    const y = vector.y * 21 + 4;
    label.setAttribute('x', x.toFixed(1));
    label.setAttribute('y', y.toFixed(1));
    label.setAttribute('text-anchor', vector.x > .34 ? 'start' : vector.x < -.34 ? 'end' : 'middle');
    if (meta) {
      meta.setAttribute('x', (vector.x * 25).toFixed(1));
      meta.setAttribute('y', (vector.y * 36 + 5).toFixed(1));
      meta.setAttribute('text-anchor', vector.x > .34 ? 'start' : vector.x < -.34 ? 'end' : 'middle');
    }
  };

  const normalizeLocalLabels = () => {
    nodeElements().forEach(element => {
      const id = element.dataset.nodeId;
      const label = element.querySelector('.site-graph-label');
      const meta = element.querySelector('.site-graph-meta');
      if (label) {
        label.setAttribute('x', '0');
        label.setAttribute('y', id === rootId ? '-25' : '25');
        label.setAttribute('text-anchor', 'middle');
      }
      if (meta) {
        meta.setAttribute('x', '0');
        meta.setAttribute('y', '42');
        meta.setAttribute('text-anchor', 'middle');
      }
    });
  };

  const crossPath = (from, to, key) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / length;
    const ny = dx / length;
    const bend = ((stableNumber(key) % 2) ? 1 : -1) * Math.min(118, 46 + length * .055);
    const control = { x: (from.x + to.x) / 2 + nx * bend, y: (from.y + to.y) / 2 + ny * bend };
    return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${control.x.toFixed(1)} ${control.y.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
  };

  const syncEdges = positions => {
    edgeElements().forEach(edge => {
      const from = positions.get(edge.dataset.source);
      const to = positions.get(edge.dataset.target);
      if (!from || !to) return;
      const type = edge.dataset.type || '';
      const hierarchy = type === 'hierarchy' || type === 'hierarchy-alt' || type === 'work-lattice';
      edge.setAttribute('d', hierarchy
        ? `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} L ${to.x.toFixed(1)} ${to.y.toFixed(1)}`
        : crossPath(from, to, `${edge.dataset.source}|${edge.dataset.target}|${type}`));
    });
  };

  let enforcementFrame = 0;
  let enforceUntil = 0;
  let lastMode = null;

  const apply = () => {
    const mode = document.body?.dataset.graphMode || 'overview';
    const global = mode === 'overview' || mode === 'atlas';
    if (!global) {
      if (lastMode === 'overview' || lastMode === 'atlas') normalizeLocalLabels();
      document.body?.removeAttribute('data-global-geometry');
      lastMode = mode;
      return false;
    }
    const positions = geometryForMode(mode);
    const elements = nodeElements();
    elements.forEach(element => {
      const id = element.dataset.nodeId;
      const point = positions.get(id);
      if (!point) return;
      setPoint(element, point);
      setLabel(element, id);
      const section = topSection(id);
      if (section) element.dataset.radialSection = section;
    });
    syncEdges(positions);
    document.body.dataset.globalGeometry = 'radial';
    lastMode = mode;
    return true;
  };

  const enforceFrame = now => {
    apply();
    if (now < enforceUntil) enforcementFrame = requestAnimationFrame(enforceFrame);
    else {
      enforcementFrame = 0;
      requestAnimationFrame(() => requestAnimationFrame(apply));
    }
  };

  const schedule = (duration = reduced.matches ? 100 : 720) => {
    enforceUntil = Math.max(enforceUntil, performance.now() + duration);
    if (!enforcementFrame) enforcementFrame = requestAnimationFrame(enforceFrame);
  };

  const vectorBetween = (sourceId, targetId) => {
    const sourceSection = topSection(sourceId);
    const targetSection = topSection(targetId);
    if (sourceSection && targetSection && sourceSection !== targetSection) {
      const positions = atlasPositions();
      const from = positions.get(sourceSection);
      const to = positions.get(targetSection);
      return unit(to.x - from.x, to.y - from.y);
    }
    if (targetSection && vectors[targetSection]) return { ...vectors[targetSection] };
    const seed = stableNumber(`${sourceId}|${targetId}`) / 0xffffffff * Math.PI * 2;
    return { x: Math.cos(seed), y: Math.sin(seed) };
  };

  const directionName = vector => {
    const angle = Math.atan2(vector.y, vector.x) * 180 / Math.PI;
    if (angle >= -22.5 && angle < 22.5) return 'right';
    if (angle >= 22.5 && angle < 67.5) return 'down-right';
    if (angle >= 67.5 && angle < 112.5) return 'down';
    if (angle >= 112.5 && angle < 157.5) return 'down-left';
    if (angle >= 157.5 || angle < -157.5) return 'left';
    if (angle >= -157.5 && angle < -112.5) return 'up-left';
    if (angle >= -112.5 && angle < -67.5) return 'up';
    return 'up-right';
  };

  const style = document.createElement('link');
  if (!document.querySelector('link[data-profile-global-geometry]')) {
    style.rel = 'stylesheet';
    style.href = 'global-geometry.css';
    style.dataset.profileGlobalGeometry = 'true';
    document.head.appendChild(style);
  }

  const graphRoot = document.querySelector('#site-graph');
  if (graphRoot) {
    new MutationObserver(mutations => {
      if (mutations.some(mutation => mutation.type === 'childList')) schedule();
    }).observe(graphRoot, { childList: true, subtree: true });
  }
  if (document.body) {
    new MutationObserver(() => schedule()).observe(document.body, {
      attributes: true,
      attributeFilter: ['data-graph-mode', 'data-graph-route']
    });
  }
  window.addEventListener('hashchange', () => schedule());
  window.addEventListener('profile:scene-state', () => schedule());
  window.addEventListener('resize', () => schedule(260));
  window.addEventListener('load', () => schedule(), { once: true });

  window.ProfileGlobalGeometry = Object.freeze({
    rootId,
    sectionIds: [...sectionIds],
    vectorForSection: id => vectors[id] ? { ...vectors[id] } : null,
    topSection,
    overviewPositions: () => new Map(overviewPositions()),
    atlasPositions: () => new Map(atlasPositions()),
    vectorBetween,
    directionName,
    apply,
    schedule,
    snapshot: () => ({
      mode: document.body?.dataset.graphMode || 'overview',
      active: document.body?.dataset.globalGeometry === 'radial',
      root: (document.body?.dataset.graphMode === 'atlas' ? atlasPositions() : overviewPositions()).get(rootId),
      workVector: { ...vectors.work }
    })
  });

  schedule();
  window.dispatchEvent(new CustomEvent('profile:global-geometry-ready'));
})();
