(() => {
  if (window.ProfileNodeDynamics) return;

  const interaction = window.ProfileNodeInteraction;
  if (!interaction) return;
  const rootId = window.SITE_DATA?.graph?.rootId || 'stepan-chrast';

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointer = matchMedia('(pointer: coarse)');
  const MODE_CONFIG = Object.freeze({
    overview: Object.freeze({ influenceRadius: 260, maxDisplacement: 22, activeScale: 1.055, relatedScale: .014 }),
    focus: Object.freeze({ influenceRadius: 220, maxDisplacement: 18, activeScale: 1.052, relatedScale: .012 }),
    work: Object.freeze({ influenceRadius: 175, maxDisplacement: 13, activeScale: 1.045, relatedScale: .010 }),
    atlas: Object.freeze({ influenceRadius: 210, maxDisplacement: 10, activeScale: 1.038, relatedScale: .008 })
  });
  const SPRING = Object.freeze({ stiffness: 70, damping: 16.5, maxVelocity: 110 });
  const SCALE_SPRING = Object.freeze({ stiffness: 92, damping: 19, maxVelocity: 1.1 });
  const EPSILON = .035;
  const SCALE_EPSILON = .0008;

  let root = null;
  let frame = 0;
  let frameCount = 0;
  let lastTime = 0;
  let suspended = false;
  let suspensionReason = null;
  let activationHoldUntil = 0;
  let adaptedEdgeCount = 0;
  let lastActiveNodeId = null;
  let transitionSettling = false;
  let lastTransitionSettle = null;
  let mutationObserver = null;
  let environmentObserver = null;
  const records = new Map();
  const canonicalEdgePaths = new WeakMap();

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const magnitude = (x, y) => Math.hypot(x, y);
  const normaliseMode = () => {
    const mode = document.body?.dataset.graphMode;
    return MODE_CONFIG[mode] ? mode : 'focus';
  };
  const mobileFactor = () => coarsePointer.matches || innerWidth <= 900 ? .56 : 1;
  const currentConfig = () => {
    const mode = normaliseMode();
    const source = MODE_CONFIG[mode];
    const factor = mobileFactor();
    return {
      mode,
      influenceRadius: source.influenceRadius * (factor < 1 ? .86 : 1),
      maxDisplacement: source.maxDisplacement * factor,
      activeScale: 1 + (source.activeScale - 1) * (factor < 1 ? .72 : 1),
      relatedScale: source.relatedScale * (factor < 1 ? .7 : 1)
    };
  };
  const canonicalPoint = node => ({
    x: Number(node?.dataset?.x || 0),
    y: Number(node?.dataset?.y || 0)
  });
  const liveNodes = () => [...(root?.querySelectorAll('.site-graph-node[data-node-id]') || [])]
    .filter(node => !node.closest('.v9-transition-overlay'));
  const introOwned = () =>
    ['pending', 'preparing', 'running'].includes(document.documentElement?.dataset.profileIntro || '') ||
    document.body?.classList.contains('is-atlas-reveal');
  const blocked = () => Boolean(
    reducedMotion.matches ||
    suspended ||
    document.body?.classList.contains('is-v9-transitioning') ||
    document.body?.classList.contains('is-profile-root-emerging') ||
    introOwned()
  );

  const stableAngle = value => {
    let hash = 2166136261;
    for (const character of String(value)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return ((hash >>> 0) % 360) * Math.PI / 180;
  };

  const unitVector = vector => {
    const x = Number(vector?.x || 0);
    const y = Number(vector?.y || 0);
    const length = magnitude(x, y);
    if (length > .001) return { x: x / length, y: y / length };
    return { x: 1, y: 0 };
  };

  const ensureRecord = node => {
    const id = node.dataset.nodeId;
    let record = records.get(id);
    if (!record || record.node !== node) {
      record = {
        id,
        node,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        targetX: 0,
        targetY: 0,
        scale: 1,
        scaleVelocity: 0,
        targetScale: 1,
        lastAppliedX: null,
        lastAppliedY: null,
        lastAppliedScale: null
      };
      records.set(id, record);
    }
    return record;
  };

  const syncRecords = () => {
    const alive = new Set();
    liveNodes().forEach(node => {
      alive.add(node.dataset.nodeId);
      ensureRecord(node);
    });
    [...records.entries()].forEach(([id, record]) => {
      if (alive.has(id)) return;
      records.delete(id);
      record.node?.style?.removeProperty('--node-dynamics-scale');
    });
  };

  const restoreNode = record => {
    const node = record.node;
    if (!node?.isConnected) return;
    const point = canonicalPoint(node);
    node.setAttribute('transform', `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`);
    node.style.removeProperty('--node-dynamics-scale');
    delete node.dataset.nodeDynamics;
    record.lastAppliedX = 0;
    record.lastAppliedY = 0;
    record.lastAppliedScale = 1;
  };

  const restoreEdges = () => {
    if (!root) return;
    root.querySelectorAll('.site-graph-edges path[data-node-dynamics-adapted="true"]').forEach(edge => {
      const canonical = canonicalEdgePaths.get(edge);
      if (canonical) edge.setAttribute('d', canonical);
      delete edge.dataset.nodeDynamicsAdapted;
    });
    adaptedEdgeCount = 0;
  };

  const hardReset = ({ restore = true } = {}) => {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    records.forEach(record => {
      record.x = 0;
      record.y = 0;
      record.vx = 0;
      record.vy = 0;
      record.targetX = 0;
      record.targetY = 0;
      record.scale = 1;
      record.scaleVelocity = 0;
      record.targetScale = 1;
      if (restore) restoreNode(record);
    });
    if (restore) restoreEdges();
    lastActiveNodeId = null;
    transitionSettling = false;
  };

  const suspend = reason => {
    if (!suspended) hardReset();
    suspended = true;
    suspensionReason = reason || 'external';
  };

  const resume = () => {
    suspended = false;
    suspensionReason = null;
    wake();
  };

  const computeTargets = activeId => {
    const config = currentConfig();
    const active = activeId ? records.get(activeId) : null;
    const activePoint = active ? canonicalPoint(active.node) : null;

    records.forEach(record => {
      record.targetX = 0;
      record.targetY = 0;
      record.targetScale = 1;
    });

    if (!active || !activePoint) return config;
    active.targetScale = config.activeScale;

    records.forEach(record => {
      if (record === active) return;
      const point = canonicalPoint(record.node);
      let dx = point.x - activePoint.x;
      let dy = point.y - activePoint.y;
      let distance = magnitude(dx, dy);
      if (distance >= config.influenceRadius) return;

      if (distance < .001) {
        const angle = stableAngle(record.id);
        dx = Math.cos(angle);
        dy = Math.sin(angle);
        distance = 1;
      }

      const proximity = clamp(1 - distance / config.influenceRadius, 0, 1);
      const falloff = proximity * proximity * (3 - 2 * proximity);
      const relation = interaction.stateFor(record.id)?.relation || 'none';
      const relationWeight = relation === 'none' ? 1 : 1.08;
      const strength = Math.min(config.maxDisplacement, config.maxDisplacement * falloff * relationWeight);
      record.targetX = dx / distance * strength;
      record.targetY = dy / distance * strength;
      if (relation !== 'none') record.targetScale = 1 + config.relatedScale * falloff;
    });

    return config;
  };

  const springAxis = (value, velocity, target, dt, config) => {
    const acceleration = (target - value) * config.stiffness - velocity * config.damping;
    let nextVelocity = clamp(velocity + acceleration * dt, -config.maxVelocity, config.maxVelocity);
    let nextValue = value + nextVelocity * dt;
    if (Math.abs(target - nextValue) < EPSILON && Math.abs(nextVelocity) < .06) {
      nextValue = target;
      nextVelocity = 0;
    }
    return [nextValue, nextVelocity];
  };

  const springScale = (value, velocity, target, dt) => {
    const acceleration = (target - value) * SCALE_SPRING.stiffness - velocity * SCALE_SPRING.damping;
    let nextVelocity = clamp(velocity + acceleration * dt, -SCALE_SPRING.maxVelocity, SCALE_SPRING.maxVelocity);
    let nextValue = value + nextVelocity * dt;
    if (Math.abs(target - nextValue) < SCALE_EPSILON && Math.abs(nextVelocity) < .004) {
      nextValue = target;
      nextVelocity = 0;
    }
    return [nextValue, nextVelocity];
  };

  const clampOffset = (record, maxDisplacement) => {
    const length = magnitude(record.x, record.y);
    if (length <= maxDisplacement || !length) return;
    const factor = maxDisplacement / length;
    record.x *= factor;
    record.y *= factor;
    const radialVelocity = record.vx * record.x + record.vy * record.y;
    if (radialVelocity > 0) {
      record.vx *= .35;
      record.vy *= .35;
    }
  };

  const applyRecord = record => {
    const node = record.node;
    if (!node?.isConnected) return;
    const point = canonicalPoint(node);
    const x = Math.abs(record.x) < EPSILON ? 0 : record.x;
    const y = Math.abs(record.y) < EPSILON ? 0 : record.y;
    const scale = Math.abs(record.scale - 1) < SCALE_EPSILON ? 1 : record.scale;

    if (
      record.lastAppliedX !== null &&
      Math.abs(record.lastAppliedX - x) < .015 &&
      Math.abs(record.lastAppliedY - y) < .015 &&
      Math.abs(record.lastAppliedScale - scale) < .0005
    ) return;

    node.setAttribute('transform', `translate(${(point.x + x).toFixed(2)} ${(point.y + y).toFixed(2)})`);
    if (scale === 1) node.style.removeProperty('--node-dynamics-scale');
    else node.style.setProperty('--node-dynamics-scale', scale.toFixed(4));
    if (x || y || scale !== 1) node.dataset.nodeDynamics = 'active';
    else delete node.dataset.nodeDynamics;
    record.lastAppliedX = x;
    record.lastAppliedY = y;
    record.lastAppliedScale = scale;
  };

  const parseEdgePath = path => {
    if (!path) return null;
    const quadratic = path.match(/^\s*M\s*(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s+Q\s*(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s*$/i);
    if (quadratic) return { kind: 'Q', values: quadratic.slice(1).map(Number) };
    const line = path.match(/^\s*M\s*(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s+L\s*(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s*$/i);
    if (line) return { kind: 'L', values: line.slice(1).map(Number) };
    return null;
  };

  const adaptEdges = () => {
    if (!root) return 0;
    let count = 0;
    root.querySelectorAll('.site-graph-edges path[data-source][data-target]').forEach(edge => {
      if (edge.closest('.v9-transition-overlay')) return;
      const source = records.get(edge.dataset.source);
      const target = records.get(edge.dataset.target);
      const sx = source?.x || 0;
      const sy = source?.y || 0;
      const tx = target?.x || 0;
      const ty = target?.y || 0;
      const moving = magnitude(sx, sy) > EPSILON || magnitude(tx, ty) > EPSILON;

      if (edge.dataset.nodeDynamicsAdapted !== 'true') {
        canonicalEdgePaths.set(edge, edge.getAttribute('d') || '');
      }
      const canonical = canonicalEdgePaths.get(edge);
      if (!moving) {
        if (edge.dataset.nodeDynamicsAdapted === 'true' && canonical) edge.setAttribute('d', canonical);
        delete edge.dataset.nodeDynamicsAdapted;
        return;
      }

      const parsed = parseEdgePath(canonical);
      if (!parsed) return;
      if (parsed.kind === 'Q') {
        const [x1, y1, cx, cy, x2, y2] = parsed.values;
        edge.setAttribute('d', `M ${(x1 + sx).toFixed(1)} ${(y1 + sy).toFixed(1)} Q ${(cx + (sx + tx) / 2).toFixed(1)} ${(cy + (sy + ty) / 2).toFixed(1)} ${(x2 + tx).toFixed(1)} ${(y2 + ty).toFixed(1)}`);
      } else {
        const [x1, y1, x2, y2] = parsed.values;
        edge.setAttribute('d', `M ${(x1 + sx).toFixed(1)} ${(y1 + sy).toFixed(1)} L ${(x2 + tx).toFixed(1)} ${(y2 + ty).toFixed(1)}`);
      }
      edge.dataset.nodeDynamicsAdapted = 'true';
      count += 1;
    });
    adaptedEdgeCount = count;
    return count;
  };

  const settleExact = () => {
    let moving = false;
    records.forEach(record => {
      const offsetError = magnitude(record.targetX - record.x, record.targetY - record.y);
      const velocity = magnitude(record.vx, record.vy);
      const scaleError = Math.abs(record.targetScale - record.scale);
      if (offsetError > EPSILON || velocity > .06 || scaleError > SCALE_EPSILON || Math.abs(record.scaleVelocity) > .004) moving = true;
    });
    return moving;
  };

  const tick = now => {
    frame = 0;
    if (!root?.isConnected || blocked()) {
      if (!suspended) hardReset();
      return;
    }

    syncRecords();
    const dt = lastTime ? clamp((now - lastTime) / 1000, 1 / 120, .033) : 1 / 60;
    lastTime = now;
    const interactionState = interaction.snapshot();
    const requestedActiveId = now >= activationHoldUntil ? interactionState.primaryNodeId : null;
    const entryRootHover = requestedActiveId === rootId && document.body?.dataset.entryState === 'ready';
    const activeId = entryRootHover ? null : requestedActiveId;
    lastActiveNodeId = activeId || null;
    const config = computeTargets(activeId);

    records.forEach(record => {
      [record.x, record.vx] = springAxis(record.x, record.vx, record.targetX, dt, SPRING);
      [record.y, record.vy] = springAxis(record.y, record.vy, record.targetY, dt, SPRING);
      [record.scale, record.scaleVelocity] = springScale(record.scale, record.scaleVelocity, record.targetScale, dt);
      clampOffset(record, config.maxDisplacement);
      applyRecord(record);
    });
    adaptEdges();
    frameCount += 1;

    if (settleExact()) {
      frame = requestAnimationFrame(tick);
      return;
    }

    if (!activeId) {
      records.forEach(restoreNode);
      restoreEdges();
    }
    if (transitionSettling) {
      transitionSettling = false;
      if (lastTransitionSettle) lastTransitionSettle.completedAt = performance.now();
      dispatchEvent(new CustomEvent('profile:node-dynamics-settled', { detail: snapshot() }));
    }
    lastTime = 0;
  };

  function wake() {
    if (!root?.isConnected || blocked() || frame) return;
    frame = requestAnimationFrame(tick);
  }

  const settleFromTransition = (anchorId, options = {}) => {
    if (!root?.isConnected) bind();
    syncRecords();
    const anchor = records.get(anchorId);
    const direction = options.direction || 'lateral';
    const requestedStrength = clamp(Number(options.strength) || 1, .4, 1.45);
    const factor = mobileFactor();
    const vector = unitVector(options.vector || { x: direction === 'up' ? -1 : 1, y: 0 });
    const appliedAt = performance.now();

    lastTransitionSettle = {
      anchorId,
      direction,
      vector: { ...vector },
      strength: requestedStrength,
      mobileFactor: factor,
      applied: false,
      appliedAt,
      completedAt: null
    };

    if (!anchor || reducedMotion.matches || introOwned() || document.body?.classList.contains('is-v9-transitioning')) {
      return false;
    }

    hardReset();
    suspended = false;
    suspensionReason = null;
    syncRecords();
    const active = records.get(anchorId);
    if (!active) return false;

    const config = currentConfig();
    const impulse = Math.min(config.maxDisplacement * .62, 7.2 * factor) * requestedStrength;
    const activePoint = canonicalPoint(active.node);
    active.x = vector.x * impulse;
    active.y = vector.y * impulse;
    active.scale = 1 + .014 * factor * requestedStrength;
    active.targetX = 0;
    active.targetY = 0;
    active.targetScale = 1;

    records.forEach(record => {
      if (record === active) return;
      const point = canonicalPoint(record.node);
      const distance = magnitude(point.x - activePoint.x, point.y - activePoint.y);
      if (distance > config.influenceRadius * .72) return;
      const proximity = clamp(1 - distance / (config.influenceRadius * .72), 0, 1);
      const related = interaction.stateFor(record.id)?.relation !== 'none';
      const localImpulse = impulse * (.22 + .20 * proximity) * (related ? 1.12 : 1);
      record.x = vector.x * localImpulse;
      record.y = vector.y * localImpulse;
      record.targetX = 0;
      record.targetY = 0;
    });

    activationHoldUntil = appliedAt + 430;
    transitionSettling = true;
    lastTransitionSettle.applied = true;
    records.forEach(applyRecord);
    adaptEdges();
    wake();
    return true;
  };

  const bind = () => {
    const next = document.querySelector('#site-graph');
    if (!next) return false;
    if (root === next && mutationObserver) return true;

    mutationObserver?.disconnect();
    root = next;
    syncRecords();
    root.dataset.nodeDynamicsBound = 'true';

    root.addEventListener('pointerdown', event => {
      const node = event.target.closest?.('.site-graph-node[data-node-id]');
      if (!node || event.button !== 0 || node.closest('.v9-transition-overlay')) return;
      activationHoldUntil = performance.now() + 130;
      hardReset();
    }, true);

    root.addEventListener('keydown', event => {
      const node = event.target.closest?.('.site-graph-node[data-node-id]');
      if (!node || !['Enter', ' '].includes(event.key) || node.closest('.v9-transition-overlay')) return;
      activationHoldUntil = performance.now() + 130;
      hardReset();
    }, true);

    mutationObserver = new MutationObserver(mutations => {
      if (introOwned()) return;
      if (mutations.some(mutation => mutation.type === 'childList')) {
        hardReset({ restore: false });
        syncRecords();
        requestAnimationFrame(wake);
      }
    });
    mutationObserver.observe(root, { childList: true, subtree: true });

    window.addEventListener('profile:node-interaction', wake);
    window.addEventListener('profile:scene-state', () => requestAnimationFrame(wake));
    window.addEventListener('profile:atlas-lod-change', wake);
    window.addEventListener('profile:transition-begin', () => suspend('transition'));
    window.addEventListener('profile:transition-finish', resume);
    window.addEventListener('profile:transition-cancel', resume);

    const environmentChanged = () => {
      if (introOwned() || document.body.classList.contains('is-v9-transitioning')) {
        if (!suspended) suspend(introOwned() ? 'intro' : 'transition');
      } else if (suspended && suspensionReason === 'intro') {
        resume();
      }
    };
    environmentObserver?.disconnect();
    environmentObserver = new MutationObserver(environmentChanged);
    environmentObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-profile-intro'] });
    environmentObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    environmentChanged();

    return true;
  };

  const stateFor = id => {
    const record = records.get(id);
    if (!record) return null;
    const point = canonicalPoint(record.node);
    return {
      id,
      canonicalX: point.x,
      canonicalY: point.y,
      offsetX: record.x,
      offsetY: record.y,
      velocityX: record.vx,
      velocityY: record.vy,
      scale: record.scale,
      targetOffsetX: record.targetX,
      targetOffsetY: record.targetY,
      targetScale: record.targetScale
    };
  };

  const snapshot = () => {
    const config = currentConfig();
    let maxDisplacement = 0;
    let movingNodeCount = 0;
    records.forEach(record => {
      const displacement = magnitude(record.x, record.y);
      maxDisplacement = Math.max(maxDisplacement, displacement);
      if (displacement > EPSILON || magnitude(record.vx, record.vy) > .06 || Math.abs(record.scale - 1) > SCALE_EPSILON) movingNodeCount += 1;
    });
    return {
      enabled: !reducedMotion.matches,
      suspended,
      suspensionReason,
      frameCount,
      activeNodeId: lastActiveNodeId,
      nodeCount: records.size,
      movingNodeCount,
      maxDisplacement,
      adaptedEdgeCount,
      transitionSettling,
      lastTransitionSettle: lastTransitionSettle ? { ...lastTransitionSettle, vector: { ...lastTransitionSettle.vector } } : null,
      config
    };
  };

  window.ProfileNodeDynamics = Object.freeze({
    refresh: wake,
    reset: hardReset,
    suspend,
    resume,
    settleFromTransition,
    stateFor,
    snapshot
  });

  const boot = () => {
    if (bind()) {
      wake();
      return;
    }
    const observer = new MutationObserver(() => {
      if (!bind()) return;
      observer.disconnect();
      wake();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  boot();
})();
