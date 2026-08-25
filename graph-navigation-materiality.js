(() => {
  if (window.ProfileGraphNavigation) return;

  const graph = window.SITE_DATA?.graph;
  const scene = window.ProfileScene;
  if (!graph?.nodes?.length || !scene?.transitions) return;

  const rootId = graph.rootId || 'stepan-chrast';
  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const routeMap = new Map(graph.nodes.filter(node => node.route).map(node => [normaliseRoute(node.route), node]));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const CANONICAL_STABLE_FRAMES = 6;
  const CANONICAL_MAX_FRAMES = 90;

  let sequence = 0;
  let phase = 'idle';
  let context = null;
  let settleTimer = 0;
  let arrivalFrame = 0;
  let arrivalGeneration = 0;
  let interruptionCount = 0;
  let lastResult = null;

  function normaliseRoute(value) {
    return (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';
  }

  const routeNodeId = value => {
    const route = normaliseRoute(value);
    if (route === 'overview') return rootId;
    if (route === 'work') return 'work';
    if (route.startsWith('work/project/')) return null;
    return routeMap.get(route)?.id || null;
  };

  const ancestorsOf = id => {
    const result = new Set();
    const pending = [...(nodeMap.get(id)?.parentIds || [])];
    while (pending.length) {
      const candidate = pending.pop();
      if (!candidate || result.has(candidate)) continue;
      result.add(candidate);
      pending.push(...(nodeMap.get(candidate)?.parentIds || []));
    }
    return result;
  };

  const semanticDirection = (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return 'lateral';
    if (ancestorsOf(sourceId).has(targetId)) return 'up';
    if (ancestorsOf(targetId).has(sourceId)) return 'down';
    return 'lateral';
  };

  const vectorBetween = (sourceId, targetId, direction) => {
    const vector = window.ProfileGeometry?.vectorBetween?.(sourceId, targetId);
    const x = Number(vector?.x || 0);
    const y = Number(vector?.y || 0);
    const length = Math.hypot(x, y);
    if (length > .001) return { x: x / length, y: y / length };
    if (direction === 'up') return { x: 0, y: -1 };
    if (direction === 'down') return { x: 0, y: 1 };
    return { x: 1, y: 0 };
  };

  const cameraActionFor = direction => direction === 'down'
    ? 'PUSH'
    : direction === 'up'
      ? 'PULL'
      : 'FOLLOW';

  const structuralContext = payload => {
    if (!payload || payload.kind !== 'graph-route') return null;
    const sourceRoute = normaliseRoute(payload.fromRoute);
    const targetRoute = normaliseRoute(payload.toRoute || payload.next?.toRoute || document.body?.dataset.graphRoute);
    const sourceMode = payload.fromMode || null;
    const targetMode = payload.toMode || null;
    if (sourceMode === 'atlas' || targetMode === 'atlas' || sourceRoute === 'atlas' || targetRoute === 'atlas') return null;
    if (sourceRoute.startsWith('work/project/') || targetRoute.startsWith('work/project/')) return null;
    const sourceId = routeNodeId(sourceRoute);
    const targetId = payload.activeNodeId || routeNodeId(targetRoute);
    if (!sourceId || !targetId || sourceId === targetId) return null;
    const direction = semanticDirection(sourceId, targetId);
    return {
      token: payload.token || null,
      sourceRoute,
      targetRoute,
      sourceMode,
      targetMode,
      sourceId,
      targetId,
      direction,
      vector: vectorBetween(sourceId, targetId, direction),
      cameraAction: cameraActionFor(direction)
    };
  };

  const canonicalSignature = () => [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
    .filter(node => !node.closest('.v9-transition-overlay'))
    .map(node => `${node.dataset.nodeId}:${node.dataset.x || ''}:${node.dataset.y || ''}`)
    .sort()
    .join('|');

  const cancelArrivalFrame = () => {
    arrivalGeneration += 1;
    cancelAnimationFrame(arrivalFrame);
    arrivalFrame = 0;
  };

  const writeState = (nextPhase, nextContext = context) => {
    phase = nextPhase;
    context = nextContext;
    if (!document.body) return;
    document.body.dataset.graphNavigationPhase = nextPhase;
    if (nextContext?.targetId) document.body.dataset.graphNavigationTarget = nextContext.targetId;
    else delete document.body.dataset.graphNavigationTarget;
    if (nextContext?.direction) document.body.dataset.graphNavigationDirection = nextContext.direction;
    else delete document.body.dataset.graphNavigationDirection;
    document.body.classList.toggle('is-graph-navigation-settling', nextPhase === 'settle' && !reducedMotion.matches);
    if (nextPhase === 'settle' && nextContext?.vector) {
      const labelDistance = innerWidth <= 900 || matchMedia('(pointer: coarse)').matches ? 2.1 : 3.2;
      document.body.style.setProperty('--graph-nav-label-x', `${(nextContext.vector.x * labelDistance).toFixed(2)}px`);
      document.body.style.setProperty('--graph-nav-label-y', `${(nextContext.vector.y * labelDistance).toFixed(2)}px`);
    } else {
      document.body.style.removeProperty('--graph-nav-label-x');
      document.body.style.removeProperty('--graph-nav-label-y');
    }
    window.ProfileGraphFeel?.refresh?.();
    dispatchEvent(new CustomEvent('profile:graph-navigation', { detail: snapshot() }));
  };

  const clearVisualState = ({ cancelArrival = true } = {}) => {
    clearTimeout(settleTimer);
    settleTimer = 0;
    if (cancelArrival) cancelArrivalFrame();
    if (document.body) {
      delete document.body.dataset.graphNavigationPhase;
      delete document.body.dataset.graphNavigationTarget;
      delete document.body.dataset.graphNavigationDirection;
      document.body.classList.remove('is-graph-navigation-settling');
      document.body.style.removeProperty('--graph-nav-label-x');
      document.body.style.removeProperty('--graph-nav-label-y');
    }
    phase = 'idle';
    context = null;
    if (window.ProfileGraphFeel?.sync) window.ProfileGraphFeel.sync();
    else window.ProfileGraphFeel?.refresh?.();
  };

  const completeSettle = reason => {
    if (phase !== 'settle' || !context) return false;
    // The timer is a safety bound, not permission to leave a second owner in a
    // transient state. If a heavily loaded frame misses the spring event,
    // restore exact canonical geometry before publishing IDLE.
    if (reason === 'timeout' && window.ProfileNodeDynamics?.snapshot?.().transitionSettling) {
      window.ProfileNodeDynamics.reset?.();
    }
    const finished = context;
    lastResult = {
      ...(lastResult || {}),
      result: 'completed',
      sourceRoute: finished.sourceRoute,
      targetRoute: finished.targetRoute,
      sourceId: finished.sourceId,
      targetId: finished.targetId,
      direction: finished.direction,
      cameraAction: finished.cameraAction,
      settleReason: reason || 'settled',
      finishedAt: performance.now()
    };
    clearVisualState();
    dispatchEvent(new CustomEvent('profile:graph-navigation-settled', { detail: { ...lastResult } }));
    return true;
  };

  const beginTransition = payload => {
    if (payload?.kind !== 'graph-route') return;
    cancelArrivalFrame();
    if (phase === 'settle' || phase === 'handoff') {
      interruptionCount += 1;
      clearVisualState({ cancelArrival: false });
    }
    const sourceRoute = normaliseRoute(payload.fromRoute);
    if (payload.fromMode === 'atlas' || sourceRoute === 'atlas' || sourceRoute.startsWith('work/project/')) return;
    sequence += 1;
    writeState('transition', {
      token: payload.token || null,
      sourceRoute,
      sourceMode: payload.fromMode || null,
      sourceId: routeNodeId(sourceRoute),
      targetRoute: null,
      targetId: null,
      targetMode: null,
      direction: null,
      vector: null,
      cameraAction: null,
      startedAt: performance.now()
    });
  };

  const prepareTransition = payload => {
    if (payload?.kind !== 'graph-route' || phase !== 'transition') return;
    const resolved = structuralContext(payload);
    if (!resolved) return;
    writeState('transition', { ...context, ...resolved });
  };

  const beginArrival = full => {
    if (!full?.targetId) {
      clearVisualState();
      return;
    }

    if (reducedMotion.matches) {
      lastResult = {
        result: 'completed',
        sourceRoute: full.sourceRoute,
        targetRoute: full.targetRoute,
        sourceId: full.sourceId,
        targetId: full.targetId,
        direction: full.direction,
        cameraAction: full.cameraAction,
        impulseApplied: false,
        reducedMotion: true,
        finishedAt: performance.now()
      };
      clearVisualState();
      dispatchEvent(new CustomEvent('profile:graph-navigation-settled', { detail: { ...lastResult } }));
      return;
    }

    writeState('settle', full);
    const impulseApplied = Boolean(window.ProfileNodeDynamics?.settleFromTransition?.(full.targetId, {
      direction: full.direction,
      vector: full.vector,
      strength: 1
    }));
    window.ProfileCameraMateriality?.retarget?.(full.cameraAction, {
      source: 'graph-navigation',
      nodeId: full.targetId
    });
    window.ProfileGraphFeel?.refresh?.();

    lastResult = {
      result: 'settling',
      sourceRoute: full.sourceRoute,
      targetRoute: full.targetRoute,
      sourceId: full.sourceId,
      targetId: full.targetId,
      direction: full.direction,
      cameraAction: full.cameraAction,
      impulseApplied,
      reducedMotion: false,
      settledAt: null
    };
    settleTimer = setTimeout(() => completeSettle('timeout'), 1250);
  };

  const waitForCanonicalQuiescence = full => {
    const operation = ++arrivalGeneration;
    let previousSignature = '';
    let stableFrames = 0;
    let sampledFrames = 0;

    const sample = () => {
      arrivalFrame = 0;
      if (operation !== arrivalGeneration || phase !== 'handoff' || context?.targetId !== full.targetId) return;

      const signature = canonicalSignature();
      const structuralFree = !document.body.classList.contains('is-v9-transitioning') && !scene.transitions.isLocked;
      if (structuralFree && signature && signature === previousSignature) stableFrames += 1;
      else stableFrames = 0;
      previousSignature = signature;
      sampledFrames += 1;

      if (structuralFree && stableFrames >= CANONICAL_STABLE_FRAMES) {
        beginArrival({ ...full, canonicalStableFrames: stableFrames, canonicalWaitFrames: sampledFrames });
        return;
      }

      if (sampledFrames >= CANONICAL_MAX_FRAMES) {
        beginArrival({ ...full, canonicalStableFrames: stableFrames, canonicalWaitFrames: sampledFrames, canonicalWaitTimeout: true });
        return;
      }
      arrivalFrame = requestAnimationFrame(sample);
    };

    arrivalFrame = requestAnimationFrame(sample);
  };

  const finishTransition = payload => {
    if (payload?.kind !== 'graph-route') return;
    const resolved = structuralContext(payload) || (context?.targetId ? context : null);
    if (!resolved) {
      clearVisualState();
      return;
    }

    const full = { ...context, ...resolved, finishedTransitionAt: performance.now() };
    writeState('handoff', full);
    waitForCanonicalQuiescence(full);
  };

  const cancelTransition = payload => {
    if (payload?.kind !== 'graph-route' && phase === 'idle') return;
    if (phase !== 'idle') interruptionCount += 1;
    const cancelled = context;
    clearVisualState();
    if (cancelled) {
      lastResult = {
        result: 'cancelled',
        sourceRoute: cancelled.sourceRoute || null,
        targetRoute: cancelled.targetRoute || null,
        sourceId: cancelled.sourceId || null,
        targetId: cancelled.targetId || null,
        direction: cancelled.direction || null,
        cameraAction: cancelled.cameraAction || null,
        finishedAt: performance.now()
      };
    }
  };

  const onDynamicsSettled = event => {
    if (phase !== 'settle' || !context?.targetId) return;
    const settled = event.detail?.lastTransitionSettle;
    if (!settled || settled.anchorId !== context.targetId) return;
    completeSettle('spring');
  };

  function snapshot() {
    return {
      ready: true,
      sequence,
      phase,
      active: phase !== 'idle',
      sourceRoute: context?.sourceRoute || null,
      targetRoute: context?.targetRoute || null,
      sourceId: context?.sourceId || null,
      targetId: context?.targetId || null,
      direction: context?.direction || null,
      vector: context?.vector ? { ...context.vector } : null,
      cameraAction: context?.cameraAction || null,
      canonicalStableFrames: context?.canonicalStableFrames || 0,
      canonicalWaitFrames: context?.canonicalWaitFrames || 0,
      canonicalWaitTimeout: Boolean(context?.canonicalWaitTimeout),
      reducedMotion: reducedMotion.matches,
      interruptionCount,
      lastResult: lastResult ? { ...lastResult } : null
    };
  }

  addEventListener('profile:transition-begin', event => beginTransition(event.detail));
  addEventListener('profile:transition-prepare', event => prepareTransition(event.detail));
  addEventListener('profile:transition-retarget', event => prepareTransition(event.detail));
  addEventListener('profile:transition-finish', event => finishTransition(event.detail));
  addEventListener('profile:transition-cancel', event => cancelTransition(event.detail));
  addEventListener('profile:transition-interrupt', event => cancelTransition(event.detail));
  addEventListener('profile:node-dynamics-settled', onDynamicsSettled);

  scene.transitions.registerParticipant('graph-navigation-materiality', {
    capture: () => snapshot(),
    cancel: payload => {
      if (phase === 'idle') return false;
      cancelTransition(payload);
      return true;
    }
  });

  window.ProfileGraphNavigation = Object.freeze({
    directionBetween: semanticDirection,
    cameraActionFor,
    snapshot
  });

  dispatchEvent(new CustomEvent('profile:graph-navigation-ready', { detail: snapshot() }));
})();
