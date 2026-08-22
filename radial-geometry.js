(() => {
  const graph = window.SITE_DATA?.graph;
  if (!graph?.nodes?.length) return;

  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const rootId = graph.rootId || 'stepan-chrast';
  const sections = ['work', 'knowledge', 'experience', 'education', 'about'];

  const normalise = vector => {
    const length = Math.max(1e-6, Math.hypot(vector.x, vector.y));
    return { x: vector.x / length, y: vector.y / length };
  };

  // One global compass for Overview, Atlas, intro geometry and cross-link travel.
  // Work deliberately points exactly down so the global root -> Work direction
  // continues naturally into the top-to-bottom FCA lattice.
  const compass = Object.freeze({
    work: normalise({ x: 0, y: 1 }),
    knowledge: normalise({ x: -0.25, y: -0.97 }),
    experience: normalise({ x: 0.95, y: -0.31 }),
    education: normalise({ x: 0.76, y: 0.65 }),
    about: normalise({ x: -0.95, y: 0.31 })
  });

  const OVERVIEW = Object.freeze({ width: 1200, height: 720, center: { x: 600, y: 350 }, radius: 230 });
  const ATLAS = Object.freeze({ width: 2520, height: 1580, center: { x: 1260, y: 790 }, sectionRadius: 300, safe: 78 });
  const halfAngles = Object.freeze({ work: 0.70, knowledge: 0.80, experience: 0.60, education: 0.58, about: 0.58 });

  const stableNumber = value => {
    let number = 2166136261;
    for (const character of String(value)) number = Math.imul(number ^ character.charCodeAt(0), 16777619);
    return number >>> 0;
  };

  const sectionMemo = new Map([[rootId, rootId], ...sections.map(id => [id, id])]);
  const sectionFor = (id, trail = new Set()) => {
    if (sectionMemo.has(id)) return sectionMemo.get(id);
    if (trail.has(id)) return null;
    const node = nodeMap.get(id);
    if (!node) return null;
    const parents = node.parentIds || [];
    if (parents.includes(rootId)) {
      sectionMemo.set(id, id);
      return id;
    }
    const nextTrail = new Set(trail).add(id);
    // First declared hierarchy keeps Work projects owned by Work even though
    // they also receive FCA theme parents later in site-data.js.
    for (const parentId of parents) {
      const section = sectionFor(parentId, nextTrail);
      if (section && section !== rootId) {
        sectionMemo.set(id, section);
        return section;
      }
    }
    return null;
  };

  const depthMemo = new Map();
  const depthWithin = (id, sectionId, trail = new Set()) => {
    const key = `${sectionId}:${id}`;
    if (depthMemo.has(key)) return depthMemo.get(key);
    if (id === sectionId) return 0;
    if (trail.has(id)) return Infinity;
    const node = nodeMap.get(id);
    if (!node) return Infinity;
    if (sectionId === 'work' && node.type === 'work-theme') return 1;
    if (sectionId === 'work' && node.type === 'project') return 2;
    const nextTrail = new Set(trail).add(id);
    const parentDepths = (node.parentIds || [])
      .filter(parentId => parentId === sectionId || sectionFor(parentId) === sectionId)
      .map(parentId => depthWithin(parentId, sectionId, nextTrail))
      .filter(Number.isFinite);
    const depth = parentDepths.length ? Math.min(...parentDepths) + 1 : Infinity;
    depthMemo.set(key, depth);
    return depth;
  };

  const rayLimit = (center, vector, width, height, safe) => {
    const candidates = [];
    if (vector.x > 1e-5) candidates.push((width - safe - center.x) / vector.x);
    if (vector.x < -1e-5) candidates.push((safe - center.x) / vector.x);
    if (vector.y > 1e-5) candidates.push((height - safe - center.y) / vector.y);
    if (vector.y < -1e-5) candidates.push((safe - center.y) / vector.y);
    return Math.min(...candidates.filter(value => Number.isFinite(value) && value > 0));
  };

  const overviewPositions = () => {
    const positions = new Map([[rootId, { ...OVERVIEW.center }]]);
    sections.forEach(id => {
      const vector = compass[id];
      positions.set(id, {
        x: OVERVIEW.center.x + vector.x * OVERVIEW.radius,
        y: OVERVIEW.center.y + vector.y * OVERVIEW.radius
      });
    });
    return positions;
  };

  const atlasPositions = () => {
    const positions = new Map([[rootId, { ...ATLAS.center }]]);
    const tangentById = new Map([[rootId, 0]]);

    sections.forEach(sectionId => {
      const vector = compass[sectionId];
      const perpendicular = { x: -vector.y, y: vector.x };
      const owned = graph.nodes.filter(node => node.id !== rootId && sectionFor(node.id) === sectionId);
      const levels = new Map();
      let maxDepth = 0;

      owned.forEach(node => {
        let depth = depthWithin(node.id, sectionId);
        if (!Number.isFinite(depth)) depth = node.id === sectionId ? 0 : 1;
        maxDepth = Math.max(maxDepth, depth);
        if (!levels.has(depth)) levels.set(depth, []);
        levels.get(depth).push(node);
      });

      const limit = rayLimit(ATLAS.center, vector, ATLAS.width, ATLAS.height, ATLAS.safe);
      const usable = Math.max(ATLAS.sectionRadius + 120, limit - 42);
      const levelGap = maxDepth > 0
        ? Math.max(72, Math.min(148, (usable - ATLAS.sectionRadius) / maxDepth))
        : 120;
      const sectionPoint = {
        x: ATLAS.center.x + vector.x * ATLAS.sectionRadius,
        y: ATLAS.center.y + vector.y * ATLAS.sectionRadius
      };
      positions.set(sectionId, sectionPoint);
      tangentById.set(sectionId, 0);

      [...levels.keys()].filter(depth => depth > 0).sort((a, b) => a - b).forEach(depth => {
        const level = levels.get(depth);
        const parentTangent = node => {
          const values = (node.parentIds || [])
            .map(parentId => tangentById.get(parentId))
            .filter(Number.isFinite);
          return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
        };

        level.sort((left, right) =>
          parentTangent(left) - parentTangent(right) ||
          (stableNumber(left.id) % 97) - (stableNumber(right.id) % 97) ||
          left.label.localeCompare(right.label)
        );

        const baseRadius = ATLAS.sectionRadius + levelGap * depth;
        const tangentialCapacity = Math.max(150, baseRadius * Math.tan(halfAngles[sectionId]));
        const desiredGap = sectionId === 'knowledge'
          ? 92
          : sectionId === 'work'
            ? (depth === 2 ? 132 : 118)
            : 116;
        const span = Math.min(tangentialCapacity * 2, desiredGap * Math.max(0, level.length - 1));

        level.forEach((node, index) => {
          const tangent = level.length <= 1 ? 0 : -span / 2 + span * index / (level.length - 1);
          const dense = level.length >= 8;
          const radialJitter = dense ? (index % 2 ? 24 : -18) : ((stableNumber(`${node.id}:r`) % 11) - 5);
          const radius = Math.min(usable, baseRadius + radialJitter);
          positions.set(node.id, {
            x: ATLAS.center.x + vector.x * radius + perpendicular.x * tangent,
            y: ATLAS.center.y + vector.y * radius + perpendicular.y * tangent
          });
          tangentById.set(node.id, tangent);
        });
      });
    });

    return positions;
  };

  // SITE_DATA is static during one document lifetime. Compute the two global
  // coordinate systems once and only re-apply them while the base renderer settles.
  const cachedOverview = overviewPositions();
  const cachedAtlas = atlasPositions();

  const baseNodes = () => [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
    .filter(element => !element.closest('.v9-transition-overlay'));
  const baseEdges = () => [...document.querySelectorAll('#site-graph .site-graph-edges path[data-source][data-target]')]
    .filter(element => !element.closest('.v9-transition-overlay'));

  const setPoint = (element, point) => {
    if (!element || !point) return;
    element.setAttribute('transform', `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`);
    element.dataset.x = String(point.x);
    element.dataset.y = String(point.y);
  };
  const pointForElement = element => ({ x: Number(element?.dataset.x || 0), y: Number(element?.dataset.y || 0) });

  const resetLabels = () => {
    baseNodes().forEach(element => {
      const id = element.dataset.nodeId;
      const label = element.querySelector('.site-graph-label');
      const meta = element.querySelector('.site-graph-meta');
      if (label) {
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('x', '0');
        label.setAttribute('y', id === rootId ? '-25' : '25');
      }
      if (meta) {
        meta.setAttribute('text-anchor', 'middle');
        meta.setAttribute('x', '0');
        meta.setAttribute('y', '42');
      }
      delete element.dataset.globalSector;
    });
  };

  const placeGlobalLabel = (element, id) => {
    const sectionId = sectionFor(id);
    const vector = compass[sectionId];
    const label = element.querySelector('.site-graph-label');
    const meta = element.querySelector('.site-graph-meta');
    if (!label) return;

    if (id === rootId || !vector) {
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('x', '0');
      label.setAttribute('y', '-27');
      return;
    }

    element.dataset.globalSector = sectionId;
    const signX = Math.sign(vector.x) || 0;
    if (Math.abs(vector.x) > .58) {
      label.setAttribute('text-anchor', signX > 0 ? 'start' : 'end');
      label.setAttribute('x', String(signX * 17));
      label.setAttribute('y', String(vector.y > .35 ? 14 : vector.y < -.35 ? -8 : 4));
      if (meta) {
        meta.setAttribute('text-anchor', signX > 0 ? 'start' : 'end');
        meta.setAttribute('x', String(signX * 17));
        meta.setAttribute('y', String(vector.y > .35 ? 31 : vector.y < -.35 ? -24 : 20));
      }
      return;
    }

    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('x', String(vector.x * 8));
    label.setAttribute('y', vector.y < 0 ? '-20' : '28');
    if (meta) {
      meta.setAttribute('text-anchor', 'middle');
      meta.setAttribute('x', String(vector.x * 10));
      meta.setAttribute('y', vector.y < 0 ? '-36' : '44');
    }
  };

  const hierarchyPath = (from, to, sourceId, targetId) => {
    const targetSection = sectionFor(targetId);
    const sourceSection = sectionFor(sourceId);
    const vector = compass[targetSection] || compass[sourceSection];
    if (!vector || sourceId === rootId || targetId === rootId) {
      return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} L ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
    }
    const distance = Math.max(1, Math.hypot(to.x - from.x, to.y - from.y));
    const c1 = { x: from.x + vector.x * distance * .38, y: from.y + vector.y * distance * .38 };
    const c2 = { x: to.x - vector.x * distance * .28, y: to.y - vector.y * distance * .28 };
    return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
  };

  const crossLinkPath = (from, to) => {
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    let outward = { x: mid.x - ATLAS.center.x, y: mid.y - ATLAS.center.y };
    if (Math.hypot(outward.x, outward.y) < 80) outward = { x: -(to.y - from.y), y: to.x - from.x };
    outward = normalise(outward);
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const push = Math.min(250, Math.max(72, distance * .19));
    const control = { x: mid.x + outward.x * push, y: mid.y + outward.y * push };
    return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${control.x.toFixed(1)} ${control.y.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
  };

  const syncEdges = positions => {
    const elements = new Map(baseNodes().map(element => [element.dataset.nodeId, element]));
    baseEdges().forEach(edge => {
      const sourceId = edge.dataset.source;
      const targetId = edge.dataset.target;
      const from = positions.get(sourceId) || pointForElement(elements.get(sourceId));
      const to = positions.get(targetId) || pointForElement(elements.get(targetId));
      if (!from || !to) return;
      const type = edge.dataset.type || '';
      const hierarchy = type === 'hierarchy' || type === 'hierarchy-alt' || type === 'work-lattice';
      edge.setAttribute('d', hierarchy ? hierarchyPath(from, to, sourceId, targetId) : crossLinkPath(from, to));
    });
  };

  const applyOverview = () => {
    const elements = new Map(baseNodes().map(element => [element.dataset.nodeId, element]));
    cachedOverview.forEach((point, id) => setPoint(elements.get(id), point));
    elements.forEach((element, id) => placeGlobalLabel(element, id));
    syncEdges(cachedOverview);
    document.body.dataset.globalGeometry = 'radial-overview';
  };

  const applyAtlas = () => {
    const elements = new Map(baseNodes().map(element => [element.dataset.nodeId, element]));
    cachedAtlas.forEach((point, id) => setPoint(elements.get(id), point));
    elements.forEach((element, id) => placeGlobalLabel(element, id));
    syncEdges(cachedAtlas);
    document.body.dataset.globalGeometry = 'radial-atlas';
  };

  let lastGeometryEvent = '';
  const applyCurrent = () => {
    if (!document.body) return false;
    const mode = document.body.dataset.graphMode;
    if (mode === 'overview') applyOverview();
    else if (mode === 'atlas') applyAtlas();
    else {
      resetLabels();
      document.body.dataset.globalGeometry = 'local';
    }

    const eventKey = `${mode}|${document.body.dataset.globalGeometry}`;
    if (eventKey !== lastGeometryEvent) {
      lastGeometryEvent = eventKey;
      window.dispatchEvent(new CustomEvent('profile:geometry-applied', {
        detail: { mode, geometry: document.body.dataset.globalGeometry }
      }));
    }
    return true;
  };

  let frame = 0;
  let pinUntil = 0;
  const stabilize = (duration = 620) => {
    pinUntil = Math.max(pinUntil, performance.now() + duration);
    if (frame) return;
    const tick = now => {
      applyCurrent();
      if (now < pinUntil) frame = requestAnimationFrame(tick);
      else {
        frame = 0;
        requestAnimationFrame(() => requestAnimationFrame(applyCurrent));
      }
    };
    frame = requestAnimationFrame(tick);
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

  const atlasPoint = id => cachedAtlas.get(id) || null;
  const vectorBetween = (sourceId, targetId) => {
    const source = atlasPoint(sourceId);
    const target = atlasPoint(targetId);
    if (source && target && Math.hypot(target.x - source.x, target.y - source.y) > 2) {
      return normalise({ x: target.x - source.x, y: target.y - source.y });
    }
    const sourceVector = compass[sectionFor(sourceId)] || { x: 0, y: 0 };
    const targetVector = compass[sectionFor(targetId)] || { x: 1, y: 0 };
    return normalise({ x: targetVector.x - sourceVector.x || 1, y: targetVector.y - sourceVector.y });
  };

  const graphRoot = document.querySelector('#site-graph');
  if (graphRoot) {
    const observer = new MutationObserver(mutations => {
      if (mutations.some(mutation => mutation.type === 'childList')) stabilize(660);
    });
    observer.observe(graphRoot, { childList: true, subtree: true });
  }

  if (document.body) {
    const bodyObserver = new MutationObserver(mutations => {
      if (mutations.some(mutation => mutation.type === 'attributes')) stabilize(660);
    });
    bodyObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-graph-mode', 'data-graph-route', 'class']
    });
  }

  window.addEventListener('hashchange', () => stabilize(680));
  window.addEventListener('resize', () => stabilize(720));
  window.addEventListener('load', () => stabilize(720), { once: true });

  window.ProfileGeometry = Object.freeze({
    compass,
    sectionFor,
    atlasPoint,
    overviewPoint: id => cachedOverview.get(id) || null,
    vectorBetween,
    directionBetween: (sourceId, targetId) => directionName(vectorBetween(sourceId, targetId)),
    apply: applyCurrent,
    stabilize,
    snapshot: () => ({
      mode: document.body?.dataset.graphMode || null,
      geometry: document.body?.dataset.globalGeometry || null,
      center: { ...ATLAS.center },
      sections: Object.fromEntries(sections.map(id => [id, {
        vector: { ...compass[id] },
        atlas: atlasPoint(id),
        overview: cachedOverview.get(id) || null
      }]))
    })
  });

  stabilize(760);
})();
