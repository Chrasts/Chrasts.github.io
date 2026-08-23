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
  const stableNumber = value => {
    let number = 2166136261;
    for (const character of String(value)) number = Math.imul(number ^ character.charCodeAt(0), 16777619);
    return number >>> 0;
  };

  // Canonical fan-v3. Education is deliberately steeper than in the previous
  // pass so its Atlas territory does not drift into the long Knowledge wing.
  const compass = Object.freeze({
    work: normalise({ x: 0, y: 1 }),
    knowledge: normalise({ x: 1, y: -0.02 }),
    experience: normalise({ x: -0.99, y: 0.12 }),
    education: normalise({ x: 0.42, y: -0.91 }),
    about: normalise({ x: -0.72, y: -0.69 })
  });

  const OVERVIEW = Object.freeze({ width: 1200, height: 720, center: { x: 600, y: 350 } });
  const ATLAS = Object.freeze({ width: 2520, height: 1580, center: { x: 1260, y: 790 }, sectionRadius: 350 });
  const halfAngles = Object.freeze({ work: 0.66, knowledge: 0.76, experience: 0.58, education: 0.47, about: 0.58 });
  const overviewRadius = id => {
    const mobile = window.matchMedia('(max-width: 900px)').matches;
    const values = mobile
      ? { work: 225, knowledge: 250, education: 224, about: 222, experience: 218 }
      : { work: 302, knowledge: 365, education: 314, about: 314, experience: 292 };
    return values[id] || 230;
  };

  const sectionMemo = new Map([[rootId, rootId], ...sections.map(id => [id, id])]);
  const sectionFor = (id, trail = new Set()) => {
    if (sectionMemo.has(id)) return sectionMemo.get(id);
    if (trail.has(id)) return null;
    const node = nodeMap.get(id);
    if (!node) return null;
    if ((node.parentIds || []).includes(rootId)) {
      sectionMemo.set(id, id);
      return id;
    }
    const nextTrail = new Set(trail).add(id);
    for (const parentId of node.parentIds || []) {
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
    if (sectionId === 'work' && node.type === 'project') {
      // Work is a concept lattice, not a tree. Project depth is determined by
      // how many Work-theme concepts it instantiates. This keeps 1-, 2- and
      // 3-theme projects on distinct canonical Atlas tiers on every viewport.
      const themeParentCount = (node.parentIds || [])
        .filter(parentId => nodeMap.get(parentId)?.type === 'work-theme')
        .length;
      return 1 + Math.max(1, themeParentCount);
    }
    const nextTrail = new Set(trail).add(id);
    const values = (node.parentIds || [])
      .filter(parentId => parentId === sectionId || sectionFor(parentId) === sectionId)
      .map(parentId => depthWithin(parentId, sectionId, nextTrail))
      .filter(Number.isFinite);
    const depth = values.length ? Math.min(...values) + 1 : Infinity;
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
      const radius = overviewRadius(id);
      positions.set(id, {
        x: OVERVIEW.center.x + vector.x * radius,
        y: OVERVIEW.center.y + vector.y * radius
      });
    });
    return positions;
  };

  const atlasPositions = () => {
    const positions = new Map([[rootId, { ...ATLAS.center }]]);
    const tangentById = new Map([[rootId, 0]]);
    const hasChildInSection = (id, sectionId) => graph.nodes.some(candidate =>
      candidate.parentIds?.includes(id) && sectionFor(candidate.id) === sectionId
    );

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

      const limit = rayLimit(ATLAS.center, vector, ATLAS.width, ATLAS.height, 150);
      const usable = Math.max(ATLAS.sectionRadius + 120, limit - 56);
      const levelGap = maxDepth > 0
        ? Math.max(76, Math.min(sectionId === 'knowledge' ? 150 : 142, (usable - ATLAS.sectionRadius) / maxDepth))
        : 124;
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
        const tangentialCapacity = Math.max(160, baseRadius * Math.tan(halfAngles[sectionId]));
        const desiredGap = sectionId === 'knowledge'
          ? 108
          : sectionId === 'work'
            ? (depth === 2 ? 132 : 118)
            : sectionId === 'education' ? 110 : 120;
        const span = Math.min(tangentialCapacity * 2, desiredGap * Math.max(0, level.length - 1));

        level.forEach((node, index) => {
          const baseTangent = level.length <= 1 ? 0 : -span / 2 + span * index / (level.length - 1);
          const leaf = !hasChildInSection(node.id, sectionId);
          const seed = stableNumber(`${node.id}:terminal`);
          const tangentVariance = sectionId === 'work'
            ? 0
            : leaf
              ? ((seed >>> 9) % (sectionId === 'knowledge' ? 55 : 35)) - (sectionId === 'knowledge' ? 27 : 17)
              : ((seed >>> 12) % 15) - 7;
          const tangential = baseTangent + tangentVariance;

          let radialJitter = 0;
          if (sectionId === 'work') {
            radialJitter = ((stableNumber(`${node.id}:r`) % 11) - 5);
          } else if (leaf) {
            radialJitter = sectionId === 'knowledge'
              ? 28 + (seed % 116)
              : 18 + (seed % 68);
            if (depth === maxDepth) radialJitter += sectionId === 'knowledge' ? ((seed >>> 16) % 36) : ((seed >>> 16) % 18);
          } else {
            radialJitter = (stableNumber(`${node.id}:r`) % 31) - 15;
          }

          const radial = Math.min(usable, Math.max(baseRadius - 28, baseRadius + radialJitter));
          positions.set(node.id, {
            x: ATLAS.center.x + vector.x * radial + perpendicular.x * tangential,
            y: ATLAS.center.y + vector.y * radial + perpendicular.y * tangential
          });
          tangentById.set(node.id, tangential);
        });
      });
    });

    let maxDx = 1;
    let maxDy = 1;
    positions.forEach(point => {
      maxDx = Math.max(maxDx, Math.abs(point.x - ATLAS.center.x));
      maxDy = Math.max(maxDy, Math.abs(point.y - ATLAS.center.y));
    });
    const availableX = Math.min(ATLAS.center.x - 150, ATLAS.width - 150 - ATLAS.center.x);
    const availableY = Math.min(ATLAS.center.y - 160, ATLAS.height - 160 - ATLAS.center.y);
    const scaleX = Math.min(1, availableX / maxDx);
    const scaleY = Math.min(0.94, availableY / maxDy);
    positions.forEach((point, id) => {
      if (id === rootId) return;
      positions.set(id, {
        x: ATLAS.center.x + (point.x - ATLAS.center.x) * scaleX,
        y: ATLAS.center.y + (point.y - ATLAS.center.y) * scaleY
      });
    });
    return positions;
  };

  const cachedOverview = overviewPositions();
  const cachedAtlas = atlasPositions();
  const liveNodes = () => [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
    .filter(element => !element.closest('.v9-transition-overlay'));
  const liveEdges = () => [...document.querySelectorAll('#site-graph .site-graph-edges path[data-source][data-target]')]
    .filter(element => !element.closest('.v9-transition-overlay'));
  const pointOf = element => ({ x: Number(element?.dataset.x || 0), y: Number(element?.dataset.y || 0) });
  const setPoint = (element, point) => {
    if (!element || !point) return;
    element.setAttribute('transform', `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`);
    element.dataset.x = String(point.x);
    element.dataset.y = String(point.y);
  };

  const placeGlobalLabel = (element, id) => {
    const label = element?.querySelector('.site-graph-label');
    const meta = element?.querySelector('.site-graph-meta');
    if (!label) return;
    if (id === rootId) {
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('x', '0');
      label.setAttribute('y', '-27');
      return;
    }
    const sectionId = sectionFor(id);
    const vector = compass[sectionId];
    if (!vector) return;
    element.dataset.globalSector = sectionId;
    if (Math.abs(vector.x) > 0.58) {
      const sign = Math.sign(vector.x);
      label.setAttribute('text-anchor', sign > 0 ? 'start' : 'end');
      label.setAttribute('x', String(sign * 18));
      label.setAttribute('y', vector.y < -0.42 ? '-8' : vector.y > 0.42 ? '14' : '4');
      if (meta) {
        meta.setAttribute('text-anchor', sign > 0 ? 'start' : 'end');
        meta.setAttribute('x', String(sign * 18));
        meta.setAttribute('y', vector.y < -0.42 ? '-24' : vector.y > 0.42 ? '31' : '20');
      }
      return;
    }
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('x', String(vector.x * 9));
    label.setAttribute('y', vector.y < 0 ? '-21' : '29');
    if (meta) {
      meta.setAttribute('text-anchor', 'middle');
      meta.setAttribute('x', String(vector.x * 10));
      meta.setAttribute('y', vector.y < 0 ? '-37' : '45');
    }
  };

  const hierarchyPath = (from, to, sourceId, targetId) => {
    const vector = compass[sectionFor(targetId)] || compass[sectionFor(sourceId)];
    if (!vector || sourceId === rootId || targetId === rootId) {
      return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} L ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
    }
    const distance = Math.max(1, Math.hypot(to.x - from.x, to.y - from.y));
    const c1 = { x: from.x + vector.x * distance * 0.38, y: from.y + vector.y * distance * 0.38 };
    const c2 = { x: to.x - vector.x * distance * 0.28, y: to.y - vector.y * distance * 0.28 };
    return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
  };
  const crossLinkPath = (from, to) => {
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    let outward = { x: mid.x - ATLAS.center.x, y: mid.y - ATLAS.center.y };
    if (Math.hypot(outward.x, outward.y) < 80) outward = { x: -(to.y - from.y), y: to.x - from.x };
    outward = normalise(outward);
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const push = Math.min(250, Math.max(72, distance * 0.19));
    return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${(mid.x + outward.x * push).toFixed(1)} ${(mid.y + outward.y * push).toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
  };
  const syncEdges = positions => {
    const nodes = new Map(liveNodes().map(element => [element.dataset.nodeId, element]));
    liveEdges().forEach(edge => {
      const from = positions.get(edge.dataset.source) || pointOf(nodes.get(edge.dataset.source));
      const to = positions.get(edge.dataset.target) || pointOf(nodes.get(edge.dataset.target));
      if (!from || !to) return;
      const type = edge.dataset.type || '';
      const hierarchy = ['hierarchy', 'hierarchy-alt', 'work-lattice'].includes(type);
      edge.setAttribute('d', hierarchy
        ? hierarchyPath(from, to, edge.dataset.source, edge.dataset.target)
        : crossLinkPath(from, to));
    });
  };

  const applyOverview = () => {
    const nodes = new Map(liveNodes().map(element => [element.dataset.nodeId, element]));
    cachedOverview.forEach((point, id) => setPoint(nodes.get(id), point));
    nodes.forEach((element, id) => placeGlobalLabel(element, id));
    syncEdges(cachedOverview);
    document.body.dataset.globalGeometry = 'radial-overview';
    document.body.dataset.globalCompass = 'fan-v3';
  };
  const applyAtlas = () => {
    const nodes = new Map(liveNodes().map(element => [element.dataset.nodeId, element]));
    cachedAtlas.forEach((point, id) => setPoint(nodes.get(id), point));
    nodes.forEach((element, id) => placeGlobalLabel(element, id));
    syncEdges(cachedAtlas);
    document.body.dataset.globalGeometry = 'radial-atlas';
    document.body.dataset.globalCompass = 'fan-v3';
  };

  let lastGeometryEvent = '';
  const applyCurrent = () => {
    if (!document.body) return false;
    const mode = document.body.dataset.graphMode;
    if (mode === 'overview') applyOverview();
    else if (mode === 'atlas') applyAtlas();
    else {
      // Local label geometry belongs to graph-transitions / local composition.
      // Do not reset x/y/text-anchor here: doing so races the transition handoff
      // and is the source of the visible ancestor-label snaps.
      document.body.dataset.globalGeometry = 'local';
      document.body.dataset.globalCompass = 'fan-v3';
    }
    const eventKey = `${mode}|${document.body.dataset.globalGeometry}|fan-v3`;
    if (eventKey !== lastGeometryEvent) {
      lastGeometryEvent = eventKey;
      window.dispatchEvent(new CustomEvent('profile:geometry-applied', {
        detail: { mode, geometry: document.body.dataset.globalGeometry, compassVersion: 'fan-v3' }
      }));
    }
    return true;
  };

  let frame = 0;
  let pinUntil = 0;
  const stabilize = (duration = 760) => {
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
  const overviewPoint = id => cachedOverview.get(id) || null;
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
  if (graphRoot) new MutationObserver(mutations => {
    if (mutations.some(mutation => mutation.type === 'childList')) stabilize(900);
  }).observe(graphRoot, { childList: true, subtree: true });
  if (document.body) new MutationObserver(() => stabilize(960)).observe(document.body, {
    attributes: true,
    attributeFilter: ['data-graph-mode', 'data-graph-route', 'class']
  });
  window.addEventListener('hashchange', () => stabilize(1100));
  window.addEventListener('resize', () => stabilize(900));
  window.addEventListener('load', () => stabilize(900), { once: true });

  window.ProfileGeometry = Object.freeze({
    __profileCompassV3: true,
    compass,
    sectionFor,
    atlasPoint,
    overviewPoint,
    vectorBetween,
    directionBetween: (sourceId, targetId) => directionName(vectorBetween(sourceId, targetId)),
    apply: applyCurrent,
    stabilize,
    snapshot: () => ({
      mode: document.body?.dataset.graphMode || null,
      geometry: document.body?.dataset.globalGeometry || null,
      compassVersion: 'fan-v3',
      center: { ...ATLAS.center },
      atlasSize: { width: ATLAS.width, height: ATLAS.height },
      sections: Object.fromEntries(sections.map(id => [id, {
        vector: { ...compass[id] },
        atlas: atlasPoint(id),
        overview: overviewPoint(id)
      }]))
    })
  });

  const ensurePhase7 = () => {
    if (!document.querySelector('link[data-profile-atlas-lod-v7]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'phase7-atlas.css';
      link.dataset.profileAtlasLodV7 = 'true';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-profile-atlas-lod-v7]')) {
      const script = document.createElement('script');
      script.src = 'phase7-atlas.js';
      script.async = false;
      script.dataset.profileAtlasLodV7 = 'true';
      document.head.appendChild(script);
    }
  };

  stabilize(980);
  ensurePhase7();
})();