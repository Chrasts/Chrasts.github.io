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
  const stableNoise = value => (stableNumber(value) / 4294967295) * 2 - 1;

  // Canonical profile compass: Knowledge owns the eastern lane while About
  // occupies the broad western lane.
  const compass = Object.freeze({
    work: normalise({ x: .12, y: 1 }),
    knowledge: normalise({ x: 1, y: .10 }),
    experience: normalise({ x: -.42, y: -.91 }),
    education: normalise({ x: .42, y: -.91 }),
    about: normalise({ x: -1, y: 0 })
  });

  const OVERVIEW = Object.freeze({ width: 1200, height: 720, center: { x: 600, y: 350 } });
  // Leave a deliberate breathing ring around the root: the five section
  // anchors must clear its halo in both the intro and the live Atlas.
  // Keep the complete semantic field inside the renderer's compact canonical
  // viewBox. Scaling field positions here avoids a wider SVG/camera surface
  // merely because a new deep Knowledge specialization is present.
  const ATLAS = Object.freeze({ width: 2520, height: 1540, center: { x: 1260, y: 770 }, sectionRadius: 305 });
  // Atlas territories are bounded clouds rather than full wedges. Territory
  // anchors sit close to the profile root; their descendants begin on a
  // separate outer shell and then spread in two dimensions.
  const halfAngles = Object.freeze({ work: 0.62, knowledge: 0.74, experience: 0.52, education: 0.60, about: 0.76 });
  const territorySpan = Object.freeze({ work: 700, knowledge: 790, experience: 510, education: 560, about: 690 });
  const territoryBias = Object.freeze({ work: 58, knowledge: 78, experience: 10, education: -24, about: 12 });
  const childShellRadius = Object.freeze({ work: 440, knowledge: 470, experience: 425, education: 430, about: 430 });
  const childSpacing = Object.freeze({ work: 128, knowledge: 128, experience: 120, education: 122, about: 122 });
  const overviewRadius = id => {
    const mobile = window.matchMedia('(max-width: 900px)').matches;
    const values = mobile
      ? { work: 225, knowledge: 250, education: 224, about: 235, experience: 204 }
      : { work: 302, knowledge: 365, education: 314, about: 334, experience: 278 };
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
      // Work points straight toward the lower Atlas boundary and needs four
      // genuine radial tiers. The previous extra 56px reserve plus a hard
      // 76px minimum gap forced the last two tiers into the same clamped
      // radius. Give Work the available sector depth instead of collapsing it.
      const usableReserve = sectionId === 'work' ? 26 : 44;
      const firstChildRadius = childShellRadius[sectionId] || 430;
      const usable = Math.max(firstChildRadius + 145, limit - usableReserve);
      // Depth is encoded by compact shells around the territory rather than by
      // a long spoke from the root. This leaves room for sibling separation.
      const targetLevelGap = sectionId === 'knowledge' ? 82
        : sectionId === 'work' ? 72
          : sectionId === 'education' ? 78 : 76;
      const levelGap = maxDepth > 1
        ? Math.max(62, Math.min(targetLevelGap, (usable - firstChildRadius) / Math.max(1, maxDepth - 1)))
        : 72;
      const sectionPoint = {
        x: ATLAS.center.x + vector.x * ATLAS.sectionRadius,
        y: ATLAS.center.y + vector.y * ATLAS.sectionRadius
      };
      positions.set(sectionId, sectionPoint);
      tangentById.set(sectionId, territoryBias[sectionId] || 0);

      [...levels.keys()].filter(depth => depth > 0).sort((a, b) => a - b).forEach(depth => {
        const level = levels.get(depth);
        const parentTangent = node => {
          const values = (node.parentIds || [])
            .map(parentId => tangentById.get(parentId))
            .filter(Number.isFinite);
          return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : (territoryBias[sectionId] || 0);
        };
        level.sort((left, right) =>
          parentTangent(left) - parentTangent(right) ||
          (stableNumber(left.id) % 97) - (stableNumber(right.id) % 97) ||
          left.label.localeCompare(right.label)
        );

        const baseRadius = firstChildRadius + levelGap * Math.max(0, depth - 1);
        const tangentialCapacity = Math.max(170, baseRadius * Math.tan(halfAngles[sectionId]));
        const desiredGap = sectionId === 'knowledge' ? 160
          : sectionId === 'work' ? 166
            : sectionId === 'education' ? 150
              : sectionId === 'experience' ? 148 : 156;
        const naturalSpan = desiredGap * Math.max(0, level.length - 1);
        const span = Math.min(tangentialCapacity * 1.55, territorySpan[sectionId], naturalSpan);
        const levelBias = stableNoise(`${sectionId}:${depth}:level-bias`) * (sectionId === 'knowledge' ? 38 : 30);

        level.forEach((node, index) => {
          const rank = level.length <= 1 ? .5 : index / (level.length - 1);
          const warpedRank = Math.max(0, Math.min(1,
            rank + stableNoise(`${node.id}:rank`) * .18 * Math.sin(Math.PI * rank)
          ));
          const laneTangent = level.length <= 1 ? 0 : -span / 2 + span * warpedRank;
          const parentAnchor = parentTangent(node);
          const parentWeight = depth > 1 ? .42 : .14;
          const leaf = !hasChildInSection(node.id, sectionId);

          // Parent anchoring keeps related material together. Independent
          // tangent/radial offsets then turn each level into a cloud rather
          // than a row, while staying deterministic across renders.
          const tangentNoise = stableNoise(`${node.id}:tangent`) * (leaf ? 50 : 36) +
            stableNoise(`${node.id}:tangent-fine`) * 14;
          const tangential = (territoryBias[sectionId] || 0) +
            laneTangent * (1 - parentWeight) +
            (parentAnchor - (territoryBias[sectionId] || 0)) * parentWeight +
            levelBias + tangentNoise;

          const stagger = (index % 4 - 1.5) * (sectionId === 'work' ? 42 : 34);
          const radialNoise = stableNoise(`${node.id}:radial`) * (sectionId === 'knowledge' ? 66 : 58) +
            stableNoise(`${node.id}:radial-fine`) * 18 + stagger;
          const radial = Math.min(usable, Math.max(firstChildRadius - 18, baseRadius + radialNoise));

          positions.set(node.id, {
            x: ATLAS.center.x + vector.x * radial + perpendicular.x * tangential,
            y: ATLAS.center.y + vector.y * radial + perpendicular.y * tangential
          });
          tangentById.set(node.id, tangential);
        });
      });

      // Keep the territory shape compact, but enforce visibly larger gaps
      // between descendant nodes. Relaxation is deterministic because the
      // initial coordinates and pair ordering are deterministic.
      const descendantIds = owned.map(node => node.id).filter(id => id !== sectionId && positions.has(id));
      const minSpacing = childSpacing[sectionId] || 120;
      const tangentLimit = (territorySpan[sectionId] || 620) / 2;
      for (let pass = 0; pass < 12; pass += 1) {
        let moved = false;
        for (let leftIndex = 0; leftIndex < descendantIds.length; leftIndex += 1) {
          for (let rightIndex = leftIndex + 1; rightIndex < descendantIds.length; rightIndex += 1) {
            const leftId = descendantIds[leftIndex];
            const rightId = descendantIds[rightIndex];
            const left = positions.get(leftId);
            const right = positions.get(rightId);
            let dx = right.x - left.x;
            let dy = right.y - left.y;
            let distance = Math.hypot(dx, dy);
            if (distance >= minSpacing) continue;
            if (distance < 1e-3) {
              const angle = stableNoise(`${leftId}:${rightId}:collision`) * Math.PI;
              dx = Math.cos(angle);
              dy = Math.sin(angle);
              distance = 1;
            }
            const push = (minSpacing - distance) * .54;
            const ux = dx / distance;
            const uy = dy / distance;
            left.x -= ux * push;
            left.y -= uy * push;
            right.x += ux * push;
            right.y += uy * push;
            moved = true;
          }
        }

        descendantIds.forEach(id => {
          const point = positions.get(id);
          const dx = point.x - ATLAS.center.x;
          const dy = point.y - ATLAS.center.y;
          const radial = Math.max(firstChildRadius - 18, Math.min(usable, dx * vector.x + dy * vector.y));
          const tangent = Math.max(
            (territoryBias[sectionId] || 0) - tangentLimit,
            Math.min((territoryBias[sectionId] || 0) + tangentLimit, dx * perpendicular.x + dy * perpendicular.y)
          );
          point.x = ATLAS.center.x + vector.x * radial + perpendicular.x * tangent;
          point.y = ATLAS.center.y + vector.y * radial + perpendicular.y * tangent;
        });
        if (!moved) break;
      }
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
    const scaleY = Math.min(1, availableY / maxDy);
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
  let applyCount = 0;
  const applyCurrent = () => {
    if (!document.body) return false;
    applyCount += 1;
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
  let trailingFrame = 0;
  let lastRequestedDuration = 0;
  const stabilize = (duration = 0) => {
    // Preserve the public signature while retiring the old duration-based RAF
    // pin. Canonical geometry is applied now and reconciled once after layout;
    // later writes are handled by their explicit events/observer callbacks.
    lastRequestedDuration = Number(duration) || 0;
    applyCurrent();
    if (frame || trailingFrame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      applyCurrent();
      trailingFrame = requestAnimationFrame(() => {
        trailingFrame = 0;
        applyCurrent();
      });
    });
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

  window.addEventListener('hashchange', () => stabilize(1100));
  window.addEventListener('profile:graph-render-settled', () => stabilize());
  window.addEventListener('profile:scene-state', () => stabilize());
  window.addEventListener('profile:transition-finish', () => stabilize());
  window.addEventListener('profile:transition-cancel', () => stabilize());
  window.addEventListener('profile:root-activated', () => stabilize());
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
      reconciliation: {
        pending: Boolean(frame || trailingFrame),
        applyCount,
        lastRequestedDuration
      },
      sections: Object.fromEntries(sections.map(id => [id, {
        vector: { ...compass[id] },
        atlas: atlasPoint(id),
        overview: overviewPoint(id)
      }]))
    })
  });

  stabilize(980);
})();
