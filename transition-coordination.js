(() => {
  if (window.ProfileTransitionCoordination) return;
  const scene = window.ProfileScene;
  const transitions = scene?.transitions;
  if (!transitions) return;

  const graphNodes = window.SITE_DATA?.graph?.nodes || [];
  const nodeMap = new Map(graphNodes.map(node => [node.id, node]));
  const rootId = window.SITE_DATA?.graph?.rootId || 'stepan-chrast';
  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';

  const graphRouteState = detail => {
    const route = normaliseRoute(detail?.route || document.body?.dataset.graphRoute || location.hash);
    const mode = detail?.mode || document.body?.dataset.graphMode || 'overview';
    const routeNode = graphNodes.find(node => normaliseRoute(node.route) === route);
    const activeNodeId = route === 'overview' || route === 'atlas'
      ? rootId
      : route === 'work' || route.startsWith('work/')
        ? 'work'
        : routeNode?.id || scene.manager.context().activeNodeId || rootId;
    return {
      route,
      mode,
      activeNodeId,
      workProjectId: route.match(/^work\/project\/([^/]+)$/)?.[1] || null
    };
  };

  const syncCommittedGraphState = (reason, detail = null) => {
    const next = graphRouteState(detail);
    const current = scene.manager.context();
    if (
      normaliseRoute(current.route) === next.route &&
      current.mode === next.mode &&
      current.activeNodeId === next.activeNodeId &&
      (current.workProjectId || null) === next.workProjectId
    ) return false;
    scene.manager.setGraphState(next, { reason });
    return true;
  };

  let sequence = 0;
  let installFrame = 0;
  let installAttempts = 0;
  let objectFocusRegistered = false;
  let cameraRegistered = false;
  let lastInterruption = null;

  const objectFocusActive = () => {
    const snapshot = window.ProfileObjectFocus?.snapshot?.();
    return Boolean(snapshot && snapshot.phase && snapshot.phase !== 'idle');
  };

  const cameraActive = () => {
    const composition = window.ProfileCameraComposition?.snapshot?.();
    if (composition?.localAnimating) return true;
    if (composition?.adapter !== 'atlas') return false;
    const atlas = window.ProfileAtlasLOD?.snapshot?.();
    const current = atlas?.camera;
    const target = atlas?.targetCamera;
    if (!current || !target) return false;
    return Math.abs(current.x - target.x) > .25 ||
      Math.abs(current.y - target.y) > .25 ||
      Math.abs(current.scale - target.scale) > .001;
  };

  const routeForNode = id => {
    if (!id) return null;
    if (id === rootId) return 'overview';
    if (id === 'work') return 'work';
    const node = nodeMap.get(id);
    return node?.route ? normaliseRoute(node.route) : null;
  };

  const navigationIntent = target => {
    const routeElement = target?.closest?.('[data-route]');
    if (routeElement) {
      return {
        route: normaliseRoute(routeElement.dataset.route || routeElement.getAttribute('href')),
        source: 'route-control'
      };
    }

    const project = target?.closest?.('.work-project-anchor-v5[data-project-id]');
    if (project) {
      return { route: `work/project/${project.dataset.projectId}`, source: 'work-project' };
    }

    const node = target?.closest?.('#site-graph .site-graph-node[data-node-id]');
    if (!node || node.closest('.v9-transition-overlay')) return null;
    const route = routeForNode(node.dataset.nodeId);
    return route ? { route, source: 'graph-node', nodeId: node.dataset.nodeId } : null;
  };

  const stopCameraAtCurrentState = () => {
    const composition = window.ProfileCameraComposition;
    if (!composition?.snapshot) return false;
    const snapshot = composition.snapshot();
    if (snapshot.adapter === 'desktop-local' && snapshot.camera) {
      return scene.camera.transitionTo(snapshot.camera, { immediate: true });
    }
    if (snapshot.adapter === 'atlas') {
      const visible = window.ProfileAtlasLOD?.snapshot?.().camera;
      if (!visible) return false;
      return scene.camera.transitionTo({ adapter: 'atlas', ...visible }, { immediate: true });
    }
    return false;
  };

  const installParticipants = () => {
    if (!objectFocusRegistered && window.ProfileObjectFocus) {
      transitions.registerParticipant('object-focus', {
        capture: () => window.ProfileObjectFocus.snapshot?.() || null,
        cancel: () => window.ProfileObjectFocus.interrupt?.()
      });
      objectFocusRegistered = true;
    }

    if (!cameraRegistered && window.ProfileCameraComposition) {
      transitions.registerParticipant('camera-composition', {
        capture: () => window.ProfileCameraComposition.snapshot?.() || null,
        cancel: stopCameraAtCurrentState
      });
      cameraRegistered = true;
    }

    if (objectFocusRegistered && cameraRegistered) {
      cancelAnimationFrame(installFrame);
      installFrame = 0;
      return true;
    }
    if (installAttempts++ > 480) return false;
    cancelAnimationFrame(installFrame);
    installFrame = requestAnimationFrame(installParticipants);
    return false;
  };

  const needsInterruption = () => Boolean(
    transitions.isLocked ||
    document.body?.classList.contains('is-v9-transitioning') ||
    document.body?.classList.contains('is-crosslink-travelling') ||
    objectFocusActive() ||
    cameraActive()
  );

  const interrupt = (payload = {}) => {
    installParticipants();
    const id = ++sequence;
    const result = transitions.interrupt({
      reason: payload.reason || 'interaction-retarget',
      inputSequence: id,
      ...payload
    });
    lastInterruption = {
      id,
      at: performance.now(),
      ...payload,
      captured: result?.captured || null
    };
    return result;
  };

  const maybeInterruptNavigation = (event, input) => {
    if (event.defaultPrevented) return;
    if (event.type === 'click' && (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
    const intent = navigationIntent(event.target);
    if (!intent) return;
    const current = normaliseRoute(document.body?.dataset.graphRoute || location.hash);
    if (intent.route === current && !document.body?.classList.contains('is-crosslink-travelling')) return;
    if (!needsInterruption()) return;
    interrupt({
      reason: 'navigation-retarget',
      input,
      targetRoute: intent.route,
      targetNodeId: intent.nodeId || null,
      source: intent.source
    });
  };

  window.addEventListener('profile:graph-state-committed', event => {
    syncCommittedGraphState('transition-graph-commit', event.detail || null);
  });
  if (document.body) {
    const graphStateObserver = new MutationObserver(() => {
      syncCommittedGraphState('transition-graph-attributes');
    });
    graphStateObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-graph-route', 'data-graph-mode']
    });
  }

  window.addEventListener('click', event => maybeInterruptNavigation(event, 'pointer'), true);
  window.addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key)) return;
    maybeInterruptNavigation(event, 'keyboard');
  }, true);

  window.addEventListener('profile:camera-composition-ready', installParticipants);
  window.addEventListener('profile:object-focus-ready', installParticipants);
  window.addEventListener('load', installParticipants, { once: true });

  window.ProfileTransitionCoordination = Object.freeze({
    interrupt,
    installParticipants,
    navigationIntent,
    syncCommittedGraphState,
    snapshot: () => ({
      sequence,
      locked: transitions.isLocked,
      cameraActive: cameraActive(),
      objectFocusActive: objectFocusActive(),
      transition: transitions.snapshot(),
      participants: transitions.diagnostics?.().participants || [],
      lastInterruption
    })
  });

  syncCommittedGraphState('transition-coordination-boot');
  installParticipants();
})();
