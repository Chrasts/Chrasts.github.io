(() => {
  if (window.ProfileIntro?.__v31) return;

  const bootstrap = window.__PROFILE_INTRO_BOOTSTRAP__ || {};
  const graph = window.SITE_DATA?.graph;
  if (!graph?.nodes?.length) return;

  const scene = window.ProfileScene;
  const rootId = graph.rootId || 'stepan-chrast';
  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const sections = new Set(['work', 'knowledge', 'experience', 'education', 'about']);
  const reducedMotion = Boolean(bootstrap.reducedMotion) || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 900px)').matches;
  const STATES = Object.freeze({
    PREPARING: 'PREPARING',
    ATLAS_REVEAL: 'ATLAS_REVEAL',
    ATLAS_READY: 'ATLAS_READY',
    BYPASSED: 'BYPASSED'
  });
  const TIMING = Object.freeze(reducedMotion ? {
    primary: 80,
    territories: 140,
    structure: 220,
    deep: 300,
    labels: 360,
    cross: 420,
    settle: 480,
    ready: 560
  } : {
    primary: 360,
    territories: 760,
    structure: 1210,
    deep: 1590,
    labels: 1940,
    cross: 2200,
    settle: 2490,
    ready: 3000
  });

  const state = {
    eligible: Boolean(bootstrap.eligible),
    state: bootstrap.eligible ? STATES.PREPARING : STATES.BYPASSED,
    stage: bootstrap.eligible ? 'preparing' : 'bypassed',
    running: false,
    result: bootstrap.eligible ? null : 'bypassed',
    startedAt: null,
    elapsed: 0,
    readyAt: null,
    interrupted: false,
    targetRoute: null,
    realGraph: true,
    persistentRoot: true,
    reducedMotion,
    mobile,
    criticalReady: false,
    readiness: {},
    revealedWaves: [],
    keyboardCompletion: false
  };

  let generation = 0;
  let frame = 0;
  let skipButton = null;
  let participantInstalled = false;
  let interactionBound = false;
  let rootElement = null;
  let nodeElements = [];
  let edgeElements = [];
  let originalEdgeStyles = new WeakMap();

  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';
  const routeForNode = id => {
    if (id === rootId) return 'overview';
    if (id === 'work') return 'work';
    return nodeMap.get(id)?.route || null;
  };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const raf = () => new Promise(resolve => requestAnimationFrame(resolve));
  const emit = (name, detail = {}) => dispatchEvent(new CustomEvent(`profile:intro-${name}`, {
    detail: { ...snapshot(), ...detail }
  }));
  const track = name => { try { window.umami?.track?.(name); } catch (_) {} };
  const markSeen = () => { try { sessionStorage.setItem('profileIntroSeen', 'true'); } catch (_) {} };
  const waitFor = (predicate, timeout = 5000) => new Promise(resolve => {
    const started = performance.now();
    const poll = () => {
      let value = false;
      try { value = Boolean(predicate()); } catch (_) {}
      if (value || performance.now() - started >= timeout) return resolve(value);
      setTimeout(poll, 24);
    };
    poll();
  });
  const withTimeout = (promise, ms) => Promise.race([
    Promise.resolve(promise).then(() => true).catch(() => false),
    wait(ms).then(() => false)
  ]);

  const dispatchHashChange = (oldURL, newURL) => {
    try { dispatchEvent(new HashChangeEvent('hashchange', { oldURL, newURL })); }
    catch (_) { dispatchEvent(new Event('hashchange')); }
  };

  const internalRoute = async route => {
    const target = normaliseRoute(route);
    if (normaliseRoute(document.body?.dataset.graphRoute || location.hash) === target) return true;
    const oldURL = location.href;
    const next = new URL(location.href);
    next.hash = `#${target}`;
    window.__GRAPH_V6_FORCE_SNAP__ = true;
    history.replaceState(history.state, '', next.toString());
    dispatchHashChange(oldURL, next.toString());
    const reached = await waitFor(() =>
      normaliseRoute(document.body?.dataset.graphRoute || location.hash) === target,
    4200);
    window.__GRAPH_V6_FORCE_SNAP__ = false;
    return reached;
  };

  const depthMemo = new Map([[rootId, 0]]);
  const depthOf = (id, trail = new Set()) => {
    if (depthMemo.has(id)) return depthMemo.get(id);
    if (trail.has(id)) return 99;
    const node = nodeMap.get(id);
    if (!node) return 99;
    const nextTrail = new Set(trail).add(id);
    const parentDepths = (node.parentIds || [])
      .filter(parentId => nodeMap.has(parentId))
      .map(parentId => depthOf(parentId, nextTrail))
      .filter(Number.isFinite);
    const depth = parentDepths.length ? Math.min(...parentDepths) + 1 : 99;
    depthMemo.set(id, depth);
    return depth;
  };

  const waveForDepth = depth =>
    depth <= 0 ? 'root' :
    depth === 1 ? 'primary' :
    depth === 2 ? 'territory' :
    depth === 3 ? 'intermediate' : 'deep';

  const classifyLiveAtlas = () => {
    const root = document.querySelector('#site-graph');
    const svg = root?.querySelector('.site-graph-svg');
    if (!root || !svg) return false;
    nodeElements = [...svg.querySelectorAll('.site-graph-node[data-node-id]')]
      .filter(node => !node.closest('.v9-transition-overlay'));
    edgeElements = [...svg.querySelectorAll('.site-graph-edges path[data-source][data-target]')]
      .filter(edge => !edge.closest('.v9-transition-overlay'));
    if (nodeElements.length < graph.nodes.length) return false;

    rootElement = nodeElements.find(node => node.dataset.nodeId === rootId) || null;
    nodeElements.forEach(node => {
      const depth = depthOf(node.dataset.nodeId);
      node.dataset.introDepth = String(depth);
      node.dataset.introWave = waveForDepth(depth);
      node.classList.remove('is-intro-revealed', 'is-intro-label-revealed');
    });

    originalEdgeStyles = new WeakMap();
    edgeElements.forEach(edge => {
      const sourceDepth = depthOf(edge.dataset.source);
      const targetDepth = depthOf(edge.dataset.target);
      const cross = !['hierarchy', 'hierarchy-alt', 'work-lattice'].includes(edge.dataset.type || 'hierarchy');
      const depth = Math.max(sourceDepth, targetDepth);
      edge.dataset.introEdgeWave = cross
        ? 'cross'
        : depth <= 1 ? 'primary'
          : depth <= 2 ? 'territory'
            : depth <= 3 ? 'structure' : 'deep';
      let length = 1;
      try { length = Math.max(1, edge.getTotalLength()); } catch (_) {}
      originalEdgeStyles.set(edge, {
        introLength: edge.style.getPropertyValue('--intro-edge-length')
      });
      edge.style.setProperty('--intro-edge-length', length.toFixed(2));
      edge.classList.remove('is-intro-revealed');
    });
    return Boolean(rootElement);
  };

  const setStage = stage => {
    if (state.stage === stage) return;
    state.stage = stage;
    if (document.body) document.body.dataset.atlasRevealStage = stage;
    emit('stage', { stage, entryState: state.state });
  };

  const revealNodes = wave => {
    nodeElements.filter(node => node.dataset.introWave === wave).forEach(node => node.classList.add('is-intro-revealed'));
  };
  const revealEdges = wave => {
    edgeElements.filter(edge => edge.dataset.introEdgeWave === wave).forEach(edge => edge.classList.add('is-intro-revealed'));
  };
  const recordWave = wave => {
    if (!state.revealedWaves.includes(wave)) state.revealedWaves.push(wave);
  };

  const revealWave = wave => {
    if (state.revealedWaves.includes(wave)) return;
    recordWave(wave);
    if (wave === 'root') {
      rootElement?.classList.add('is-intro-revealed');
      rootElement?.classList.add('is-intro-label-revealed');
      return;
    }
    if (wave === 'primary') {
      revealNodes('primary');
      revealEdges('primary');
      return;
    }
    if (wave === 'territories') {
      revealNodes('territory');
      revealEdges('territory');
      return;
    }
    if (wave === 'structure') {
      revealNodes('intermediate');
      revealEdges('structure');
      return;
    }
    if (wave === 'deep') {
      revealNodes('deep');
      revealEdges('deep');
      return;
    }
    if (wave === 'labels') {
      nodeElements.forEach(node => {
        const nodeWave = node.dataset.introWave;
        if (nodeWave === 'root' || nodeWave === 'primary' || nodeWave === 'territory' || (!mobile && nodeWave === 'intermediate')) {
          node.classList.add('is-intro-label-revealed');
        }
      });
      document.body?.classList.add('is-atlas-reveal-late');
      return;
    }
    if (wave === 'cross') revealEdges('cross');
  };

  const revealEverything = () => {
    ['root', 'primary', 'territories', 'structure', 'deep', 'labels', 'cross'].forEach(revealWave);
  };

  const cleanupRevealPresentation = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    nodeElements.forEach(node => {
      node.classList.remove('is-intro-revealed', 'is-intro-label-revealed');
      delete node.dataset.introDepth;
      delete node.dataset.introWave;
    });
    edgeElements.forEach(edge => {
      edge.classList.remove('is-intro-revealed');
      delete edge.dataset.introEdgeWave;
      const previous = originalEdgeStyles.get(edge)?.introLength;
      if (previous) edge.style.setProperty('--intro-edge-length', previous);
      else edge.style.removeProperty('--intro-edge-length');
    });
    document.body?.classList.remove('is-atlas-reveal', 'is-atlas-reveal-late');
    if (document.body) delete document.body.dataset.atlasRevealStage;
    nodeElements = [];
    edgeElements = [];
    rootElement = null;
  };

  const createSkip = () => {
    if (skipButton?.isConnected) return skipButton;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'atlas-reveal-skip';
    button.textContent = 'Skip reveal';
    button.setAttribute('aria-label', 'Skip Atlas reveal');
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      completeToReady('skipped');
    });
    document.body.appendChild(button);
    skipButton = button;
    return button;
  };

  const removeSkip = () => {
    skipButton?.remove();
    skipButton = null;
  };

  const criticalReadiness = async currentGeneration => {
    const atlasRoute = await internalRoute('atlas');
    if (!atlasRoute || currentGeneration !== generation) return false;

    const graphReady = await waitFor(() =>
      document.body?.dataset.graphMode === 'atlas' &&
      document.querySelectorAll('#site-graph .site-graph-node[data-node-id]').length >= graph.nodes.length,
    5200);
    if (!graphReady || currentGeneration !== generation) return false;

    const modulesReady = await waitFor(() => Boolean(
      window.ProfileAtlasLOD &&
      window.ProfileGeometry &&
      window.ProfileHaloRenderer &&
      window.ProfileNodeInteraction &&
      window.ProfileCameraComposition?.boot?.() &&
      window.ProfileCameraMateriality?.snapshot?.().ready &&
      window.ProfileScene?.transitions
    ), 4200);

    const fontReady = document.fonts?.ready ? await withTimeout(document.fonts.ready, 1400) : true;
    const portrait = new Image();
    portrait.src = 'assets/stepan-chrast.jpg';
    const portraitReady = await withTimeout(
      typeof portrait.decode === 'function' ? portrait.decode() : new Promise(resolve => {
        portrait.onload = resolve;
        portrait.onerror = resolve;
      }),
    1200);

    await raf();
    window.ProfileAtlasLOD?.fit?.({ immediate: true });
    await raf();
    await raf();
    const classified = classifyLiveAtlas();

    state.readiness = {
      atlasRoute,
      graph: graphReady,
      modules: modulesReady,
      fonts: fontReady,
      portrait: portraitReady,
      classified
    };
    state.criticalReady = Boolean(atlasRoute && graphReady && modulesReady && classified);
    return state.criticalReady;
  };

  const focusRootForKeyboard = () => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const root = document.querySelector(`#site-graph .site-graph-node[data-node-id="${CSS.escape(rootId)}"]`);
      root?.focus?.({ preventScroll: true });
    }));
  };

  async function completeToReady(reason = 'completed') {
    if (!state.eligible || state.state === STATES.ATLAS_READY || state.state === STATES.BYPASSED) return false;
    ++generation;
    cancelAnimationFrame(frame);
    frame = 0;
    state.interrupted = reason === 'interrupted';
    state.keyboardCompletion = reason === 'keyboard';
    revealEverything();
    setStage('settle');
    window.ProfileCameraComposition?.fit?.({ duration: reducedMotion ? 0 : 360 });
    await wait(reducedMotion ? 0 : reason === 'completed' ? 260 : 90);

    cleanupRevealPresentation();
    removeSkip();
    document.documentElement.dataset.profileIntro = 'ready';
    document.body?.classList.add('is-atlas-ready');
    if (document.body) document.body.dataset.entryState = STATES.ATLAS_READY;
    state.state = STATES.ATLAS_READY;
    state.stage = 'ready';
    state.running = false;
    state.result = reason;
    state.elapsed = state.startedAt == null ? 0 : performance.now() - state.startedAt;
    state.readyAt = performance.now();
    markSeen();
    window.ProfileNodeInteraction?.refresh?.();
    window.ProfileHaloRenderer?.refresh?.();
    emit('completed', { reason, entryState: STATES.ATLAS_READY });
    dispatchEvent(new CustomEvent('profile:atlas-ready', { detail: snapshot() }));
    track(reason === 'skipped' ? 'intro_skipped' : 'atlas_reveal_completed');
    if (state.keyboardCompletion) focusRootForKeyboard();
    return true;
  }

  const interruptToRoute = async (targetRoute, reason = 'navigation-retarget') => {
    if (!state.running || state.state !== STATES.ATLAS_REVEAL) return false;
    const target = normaliseRoute(targetRoute);
    state.interrupted = true;
    state.targetRoute = target;
    ++generation;
    cleanupRevealPresentation();
    removeSkip();
    document.documentElement.dataset.profileIntro = 'complete';
    document.body?.classList.remove('is-atlas-ready');
    if (document.body) document.body.dataset.entryState = 'INTERRUPTED';
    state.running = false;
    state.result = 'interrupted';
    state.stage = 'interrupted';
    markSeen();
    emit('interrupted', { reason, targetRoute: target });
    await internalRoute(target);
    return true;
  };

  const installParticipant = () => {
    if (participantInstalled || !scene?.transitions?.registerParticipant) return;
    scene.transitions.registerParticipant('intro-v3-atlas-reveal', {
      capture: () => snapshot(),
      cancel: payload => {
        if (!state.running) return false;
        const target = payload?.targetRoute || 'atlas';
        return target === 'atlas'
          ? completeToReady('interrupted')
          : interruptToRoute(target, payload?.reason || 'coordinator-interrupt');
      }
    });
    participantInstalled = true;
  };

  const bindInteractions = () => {
    if (interactionBound) return;
    interactionBound = true;

    addEventListener('keydown', event => {
      if (!state.running || state.state !== STATES.ATLAS_REVEAL) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        completeToReady('skipped');
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        event.stopImmediatePropagation();
        completeToReady('keyboard');
        return;
      }
      if (!['Enter', ' '].includes(event.key)) return;
      const node = event.target.closest?.('#site-graph .site-graph-node[data-node-id]');
      if (!node) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (node.dataset.nodeId === rootId) completeToReady('keyboard');
    }, true);

    addEventListener('click', event => {
      if (!state.running || state.state !== STATES.ATLAS_REVEAL || event.button !== 0) return;
      if (event.target.closest?.('.atlas-reveal-skip')) return;

      const routeControl = event.target.closest?.('[data-route]');
      if (routeControl && !routeControl.closest('#site-graph')) {
        const route = normaliseRoute(routeControl.dataset.route || routeControl.getAttribute('href'));
        if (route && route !== 'atlas') {
          event.preventDefault();
          event.stopImmediatePropagation();
          interruptToRoute(route, 'intro-route-control');
          return;
        }
      }

      const node = event.target.closest?.('#site-graph .site-graph-node[data-node-id]');
      if (!node) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const id = node.dataset.nodeId;
      if (id === rootId) {
        completeToReady('pointer');
        return;
      }
      if (!document.body?.classList.contains('is-atlas-reveal-late')) return;
      const route = routeForNode(id);
      if (route && route !== 'overview') interruptToRoute(route, 'intro-node-retarget');
      else completeToReady('pointer');
    }, true);
  };

  const runTimeline = currentGeneration => new Promise(resolve => {
    state.startedAt = performance.now();
    const applied = new Set(['root']);
    revealWave('root');
    const tick = now => {
      if (currentGeneration !== generation || !state.running || state.state !== STATES.ATLAS_REVEAL) return resolve(false);
      const elapsed = now - state.startedAt;
      state.elapsed = elapsed;
      const apply = (name, at, stage, callback = () => revealWave(name)) => {
        if (elapsed < at || applied.has(name)) return;
        applied.add(name);
        callback();
        setStage(stage);
      };
      apply('primary', TIMING.primary, 'primary');
      apply('territories', TIMING.territories, 'territories');
      apply('structure', TIMING.structure, 'structure');
      apply('deep', TIMING.deep, 'deep');
      apply('labels', TIMING.labels, 'labels');
      apply('cross', TIMING.cross, 'crosslinks');
      apply('settle', TIMING.settle, 'settle', () => {
        recordWave('settle');
        window.ProfileCameraComposition?.fit?.({ duration: reducedMotion ? 0 : 420 });
      });
      if (elapsed >= TIMING.ready) return resolve(true);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  });

  const prepareAndRun = async () => {
    if (!state.eligible || state.running || state.state === STATES.ATLAS_READY) return false;
    const currentGeneration = ++generation;
    state.state = STATES.PREPARING;
    state.stage = 'preparing';
    state.running = false;
    state.result = null;
    state.revealedWaves = [];
    state.startedAt = performance.now();
    document.documentElement.dataset.profileIntro = 'preparing';
    if (document.body) document.body.dataset.entryState = STATES.PREPARING;
    markSeen();
    installParticipant();
    bindInteractions();

    const ready = await criticalReadiness(currentGeneration);
    if (!ready || currentGeneration !== generation) {
      return completeToReady('fallback');
    }

    state.state = STATES.ATLAS_REVEAL;
    state.stage = 'root';
    state.running = true;
    state.startedAt = performance.now();
    document.documentElement.dataset.profileIntro = 'running';
    document.body?.classList.remove('is-atlas-ready');
    document.body?.classList.add('is-atlas-reveal');
    if (document.body) {
      document.body.dataset.entryState = STATES.ATLAS_REVEAL;
      document.body.dataset.atlasRevealStage = 'root';
    }
    createSkip();
    revealWave('root');
    emit('started', { source: 'live-atlas', entryState: STATES.ATLAS_REVEAL });
    track('intro_started');

    const completed = await runTimeline(currentGeneration);
    if (!completed || currentGeneration !== generation || !state.running) return false;
    return completeToReady('completed');
  };

  const replay = async () => {
    if (state.running) return false;
    const route = normaliseRoute(document.body?.dataset.graphRoute || location.hash);
    if (route !== 'atlas' && route !== 'overview') return false;
    state.eligible = true;
    state.state = STATES.PREPARING;
    state.result = null;
    return prepareAndRun();
  };

  function snapshot() {
    return {
      ...state,
      route: normaliseRoute(document.body?.dataset.graphRoute || location.hash),
      graphMode: document.body?.dataset.graphMode || null,
      rootLanding: document.body?.dataset.rootLanding === 'true',
      liveGraphPresent: Boolean(document.querySelector('#site-graph .site-graph-svg')),
      rootPresent: Boolean(document.querySelector(`#site-graph .site-graph-node[data-node-id="${CSS.escape(rootId)}"]`)),
      cloneOverlayPresent: Boolean(document.querySelector('.profile-intro-overlay')),
      timing: TIMING,
      canonicalStates: { ...STATES }
    };
  }

  window.ProfileIntro = Object.freeze({
    __v31: true,
    STATES,
    skip: () => completeToReady('skipped'),
    complete: completeToReady,
    replay,
    snapshot
  });

  if (!state.eligible) {
    document.documentElement.dataset.profileIntro = 'bypass';
    if (document.body) document.body.dataset.entryState = STATES.BYPASSED;
    return;
  }

  prepareAndRun();
})();
