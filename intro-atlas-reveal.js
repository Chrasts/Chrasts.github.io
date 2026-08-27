(() => {
  if (window.ProfileIntro?.__v31) return;

  const bootstrap = window.__PROFILE_INTRO_BOOTSTRAP__ || {};
  const graph = window.SITE_DATA?.graph;
  if (!graph?.nodes?.length) return;

  const scene = window.ProfileScene;
  const rootId = graph.rootId || 'stepan-chrast';
  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const reducedMotion = Boolean(bootstrap.reducedMotion) || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobileQuery = matchMedia('(max-width: 900px)');
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
    primary: 900,
    territories: 1800,
    structure: 2800,
    deep: 3300,
    labels: 3600,
    cross: 3900,
    settle: 4150,
    ready: 4300
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
    mobile: mobileQuery.matches,
    criticalReady: false,
    readiness: {},
    revealedWaves: [],
    keyboardCompletion: false,
    entryCamera: null,
    loaderReleased: false
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
  let latentTimer = 0;
  let visibilityFieldPromise = Promise.resolve(true);
  let visibilityFrame = 0;
  let visibilityResolve = null;
  let visibilityInteractiveResolve = null;
  let visibilityInteractivePromise = Promise.resolve(true);
  let visibilityLayout = null;

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
  const clearFailOpen = () => {
    clearTimeout(window.__PROFILE_ENTRY_FAILOPEN__);
    window.__PROFILE_ENTRY_FAILOPEN__ = 0;
  };
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

  const visibilityMask = () => ({
    svg: document.querySelector('.entry-visibility-mask'),
    base: document.querySelector('.entry-visibility-base'),
    aperture: document.querySelector('.entry-visibility-aperture'),
    veil: document.querySelector('.entry-visibility-veil')
  });

  const measureVisibilityLayout = () => {
    const width = Math.max(1, innerWidth);
    const height = Math.max(1, innerHeight);
    const rootDot = rootElement?.querySelector(':scope > .site-graph-dot');
    const rootBounds = rootDot?.getBoundingClientRect?.();
    const cx = rootBounds?.width ? rootBounds.left + rootBounds.width / 2 : width / 2;
    const cy = rootBounds?.height ? rootBounds.top + rootBounds.height / 2 : height / 2;
    let graphDistance = 0;
    const content = [
      ...document.querySelectorAll(
        '#site-graph .site-graph-node[data-node-id] > :is(.site-graph-dot,.site-graph-halo,.site-graph-label,.site-graph-meta,[data-root-entry-portrait],[data-root-entry-action]),' +
        '#site-graph .atlas-territory-label-layer text'
      )
    ];
    content.forEach(element => {
      const bounds = element.getBoundingClientRect?.();
      if (!bounds || (!bounds.width && !bounds.height)) return;
      graphDistance = Math.max(
        graphDistance,
        Math.hypot(bounds.left - cx, bounds.top - cy),
        Math.hypot(bounds.right - cx, bounds.top - cy),
        Math.hypot(bounds.left - cx, bounds.bottom - cy),
        Math.hypot(bounds.right - cx, bounds.bottom - cy)
      );
    });
    if (!graphDistance) {
      graphDistance = Math.max(
        Math.hypot(cx, cy),
        Math.hypot(width - cx, cy),
        Math.hypot(cx, height - cy),
        Math.hypot(width - cx, height - cy)
      );
    }
    /* The clear core of the gradient ends at 52%. Finishing against the real
       content bounds (plus breathing room) makes visual completion and input
       activation the same frame instead of animating an invisible remainder
       toward empty viewport corners. */
    return { width, height, cx, cy, targetRadius: (graphDistance + 8) / .515 };
  };

  const visibilityMetrics = progress => {
    const { svg, base, aperture, veil } = visibilityMask();
    if (!svg || !base || !aperture || !veil) return null;
    if (!visibilityLayout || visibilityLayout.width !== innerWidth || visibilityLayout.height !== innerHeight) {
      visibilityLayout = measureVisibilityLayout();
    }
    const { width, height, cx, cy, targetRadius } = visibilityLayout;
    const radius = targetRadius * Math.max(0, Math.min(1, progress));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    base.setAttribute('x', '0');
    base.setAttribute('y', '0');
    base.setAttribute('width', width);
    base.setAttribute('height', height);
    veil.setAttribute('x', '0');
    veil.setAttribute('y', '0');
    veil.setAttribute('width', width);
    veil.setAttribute('height', height);
    aperture.setAttribute('cx', cx.toFixed(2));
    aperture.setAttribute('cy', cy.toFixed(2));
    aperture.setAttribute('r', radius.toFixed(2));
    return { width, height, cx, cy, radius };
  };

  const cancelVisibilityField = (result = false) => {
    cancelAnimationFrame(visibilityFrame);
    visibilityFrame = 0;
    const resolve = visibilityResolve;
    const resolveInteractive = visibilityInteractiveResolve;
    visibilityResolve = null;
    visibilityInteractiveResolve = null;
    resolveInteractive?.(result);
    resolve?.(result);
  };

  /* One SVG radius write per frame is substantially cheaper and smoother than
     repainting a multi-stop CSS gradient with several animated custom lengths. */
  const startVisibilityField = () => new Promise(resolve => {
    cancelVisibilityField(false);
    visibilityResolve = resolve;
    visibilityInteractivePromise = new Promise(interactiveResolve => {
      visibilityInteractiveResolve = interactiveResolve;
    });
    visibilityLayout = null;
    visibilityMetrics(0);
    if (reducedMotion) {
      visibilityMetrics(1);
      visibilityInteractiveResolve?.(true);
      visibilityInteractiveResolve = null;
      visibilityResolve = null;
      resolve(true);
      return;
    }
    const delay = 160;
    const duration = 6350;
    const accelerationStart = .50;
    const acceleratedCompleteAt = .75;
    const accelerationWindow = acceleratedCompleteAt - accelerationStart;
    const acceleration = (1 - acceleratedCompleteAt) / (accelerationWindow * accelerationWindow);
    const started = performance.now();
    const tick = now => {
      const elapsed = now - started - delay;
      const linearProgress = Math.max(0, Math.min(1, elapsed / duration));
      const tailProgress = Math.max(0, linearProgress - accelerationStart);
      const progress = linearProgress <= accelerationStart
        ? linearProgress
        : Math.min(1, linearProgress + acceleration * tailProgress * tailProgress);
      visibilityMetrics(progress);
      if (progress >= .76 && visibilityInteractiveResolve) {
        const resolveInteractive = visibilityInteractiveResolve;
        visibilityInteractiveResolve = null;
        resolveInteractive(true);
      }
      if (progress >= 1) {
        visibilityFrame = 0;
        visibilityInteractiveResolve?.(true);
        visibilityInteractiveResolve = null;
        visibilityResolve = null;
        resolve(true);
        return;
      }
      visibilityFrame = requestAnimationFrame(tick);
    };
    visibilityFrame = requestAnimationFrame(tick);
  });

  const labelGeometry = nodes => {
    const signature = [];
    try {
      for (const node of nodes) {
        const label = node.querySelector(':scope > .site-graph-label');
        const hit = node.querySelector(':scope > .site-graph-hit');
        if (!label || !hit || !label.textContent?.trim()) return { ready: false, signature: '' };
        const bounds = label.getBBox();
        if (![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) {
          return { ready: false, signature: '' };
        }
        signature.push([
          node.dataset.nodeId,
          node.dataset.x,
          node.dataset.y,
          label.getAttribute('x'),
          label.getAttribute('y'),
          label.getAttribute('text-anchor'),
          bounds.x.toFixed(2),
          bounds.y.toFixed(2),
          bounds.width.toFixed(2),
          bounds.height.toFixed(2)
        ].join(':'));
      }
    } catch (_) {
      return { ready: false, signature: '' };
    }
    return { ready: signature.length === graph.nodes.length, signature: signature.join('|') };
  };

  const atlasFullyReady = (preparedNodes = null, preparedLabels = null) => {
    const atlas = window.ProfileAtlasLOD?.snapshot?.();
    const nodes = preparedNodes || [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
      .filter(node => !node.closest('.v9-transition-overlay'));
    const edges = [...document.querySelectorAll('#site-graph .site-graph-edges path[data-source][data-target]')]
      .filter(edge => !edge.closest('.v9-transition-overlay'));
    const camera = atlas?.camera;
    const target = atlas?.targetCamera;
    const structureReady = Boolean(
      document.body?.dataset.graphMode === 'atlas' &&
      atlas?.topologyMode === 'entry-full' &&
      atlas?.visibleNodeCount === graph.nodes.length &&
      atlas?.hiddenNodeCount === 0 &&
      nodes.length === graph.nodes.length &&
      edges.length > 0 &&
      !nodes.some(node => node.classList.contains('is-atlas-lod-hidden')) &&
      nodes.every(node => Number.isFinite(Number(node.dataset.x)) && Number.isFinite(Number(node.dataset.y))) &&
      Number.isFinite(camera?.x) && Number.isFinite(camera?.y) && Number.isFinite(camera?.scale) &&
      Number.isFinite(target?.x) && Number.isFinite(target?.y) && Number.isFinite(target?.scale) &&
      Math.abs(camera.x - target.x) < .02 &&
      Math.abs(camera.y - target.y) < .02 &&
      Math.abs(camera.scale - target.scale) < .0005
    );
    if (!structureReady) return false;
    return (preparedLabels || labelGeometry(nodes)).ready;
  };

  const stabiliseAtlas = async (currentGeneration, timeout = 10000) => {
    const started = performance.now();
    let stableFrames = 0;
    let previousSignature = '';
    window.ProfileAtlasLOD?.setTopologyMode?.('entry-full', { reason: 'intro-stabilise' });
    const scale = window.ProfileAtlasLOD?.snapshot?.().camera?.scale;
    if (Number.isFinite(scale)) window.ProfileAtlasLOD?.applyLOD?.(scale);
    window.ProfileHaloRenderer?.refresh?.();
    while (currentGeneration === generation && performance.now() - started < timeout) {
      await raf();
      const liveNodes = [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
        .filter(node => !node.closest('.v9-transition-overlay'));
      const structureReady = atlasFullyReady(liveNodes, { ready: true });
      const labels = structureReady ? labelGeometry(liveNodes) : { ready: false, signature: '' };
      if (structureReady && labels.ready && labels.signature && labels.signature === previousSignature) stableFrames += 1;
      else {
        stableFrames = 0;
        window.ProfileAtlasLOD?.setTopologyMode?.('entry-full', { reason: 'intro-stabilise-retry' });
      }
      previousSignature = labels.signature;
      if (stableFrames >= 3) return true;
    }
    return false;
  };

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
    window.ProfileMotionPolicy?.setForceSnap?.(true);
    history.replaceState(history.state, '', next.toString());
    dispatchHashChange(oldURL, next.toString());
    const reached = await waitFor(() =>
      normaliseRoute(document.body?.dataset.graphRoute || location.hash) === target,
    4200);
    window.ProfileMotionPolicy?.setForceSnap?.(false);
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
  const stableNumber = value => {
    let number = 2166136261;
    for (const character of String(value)) number = Math.imul(number ^ character.charCodeAt(0), 16777619);
    return number >>> 0;
  };

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
    const rootPoint = window.ProfileGeometry?.atlasPoint?.(rootId) || { x: 0, y: 0 };
    const planned = nodeElements.map(node => {
      const id = node.dataset.nodeId;
      const point = window.ProfileGeometry?.atlasPoint?.(id) || { x: Number(node.dataset.x), y: Number(node.dataset.y) };
      return {
        node,
        id,
        depth: depthOf(id),
        distance: Math.hypot((point.x || 0) - rootPoint.x, (point.y || 0) - rootPoint.y)
      };
    });
    const maxDepth = Math.max(1, ...planned.filter(item => item.depth < 99).map(item => item.depth));
    const maxDistance = Math.max(1, ...planned.map(item => item.distance));
    planned.forEach(({ node, id, depth, distance }) => {
      const jitter = (stableNumber(id) % 1000) / 1000 * .018;
      const score = id === rootId ? 0 : Math.min(1, .7 * depth / maxDepth + .3 * distance / maxDistance + jitter);
      node.dataset.introDepth = String(depth);
      node.dataset.introWave = waveForDepth(depth);
      node.dataset.introScore = score.toFixed(4);
      node.style.setProperty('--intro-delay', `${Math.round(score * 86)}ms`);
      node.classList.remove('is-intro-revealed', 'is-intro-label-revealed');
    });

    originalEdgeStyles = new WeakMap();
    edgeElements.forEach(edge => {
      const sourceDepth = depthOf(edge.dataset.source);
      const targetDepth = depthOf(edge.dataset.target);
      const cross = !['hierarchy', 'hierarchy-alt', 'work-lattice'].includes(edge.dataset.type || 'hierarchy');
      const depth = Math.max(sourceDepth, targetDepth);
      const crossDelay = cross ? 88 : stableNumber(`${edge.dataset.source}:${edge.dataset.target}`) % 54;
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
      edge.style.setProperty('--intro-delay', `${crossDelay}ms`);
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
  const syncLabelDensity = () => {
    if (!state.revealedWaves.includes('labels')) return;
    /* The live entry Atlas is fully prepared behind the veil. Every label,
       including the two deepest Knowledge generations, belongs to that single
       prepared image; the mask alone decides when it becomes visible. */
    nodeElements.forEach(node => node.classList.add('is-intro-label-revealed'));
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
      syncLabelDensity();
      document.body?.classList.add('is-atlas-reveal-late');
      return;
    }
    if (wave === 'cross') revealEdges('cross');
  };

  const revealEverything = () => {
    ['root', 'primary', 'territories', 'structure', 'deep', 'labels', 'cross'].forEach(revealWave);
  };

  const cleanupRevealPresentation = ({ keepVisibility = false } = {}) => {
    cancelAnimationFrame(frame);
    frame = 0;
    if (!keepVisibility) cancelVisibilityField(false);
    nodeElements.forEach(node => {
      node.classList.remove('is-intro-revealed', 'is-intro-label-revealed');
      delete node.dataset.introDepth;
      delete node.dataset.introWave;
      delete node.dataset.introScore;
      node.style.removeProperty('--intro-delay');
    });
    edgeElements.forEach(edge => {
      edge.classList.remove('is-intro-revealed');
      delete edge.dataset.introEdgeWave;
      const previous = originalEdgeStyles.get(edge)?.introLength;
      if (previous) edge.style.setProperty('--intro-edge-length', previous);
      else edge.style.removeProperty('--intro-edge-length');
      edge.style.removeProperty('--intro-delay');
    });
    document.body?.classList.remove('is-atlas-reveal', 'is-atlas-reveal-late');
    document.body?.classList.remove('is-entry-latent');
    clearTimeout(latentTimer);
    latentTimer = 0;
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
    12000);
    if (!graphReady || currentGeneration !== generation) return false;

    const portrait = new Image();
    portrait.src = 'assets/stepan-chrast.jpg';
    const portraitPromise = typeof portrait.decode === 'function' ? portrait.decode() : new Promise((resolve, reject) => {
        portrait.onload = resolve;
        portrait.onerror = reject;
      });
    const [criticalCss, modulesReady, fontReady, portraitReady] = await Promise.all([
      waitFor(() => Boolean(document.querySelector('link[data-profile-intro-atlas-style]')?.sheet), 6000),
      waitFor(() => {
        const halo = window.ProfileHaloRenderer?.snapshot?.();
        return Boolean(
          window.ProfileAtlasLOD &&
          window.ProfileGeometry &&
          halo?.ringCount >= graph.nodes.length &&
          halo?.rootRingCount >= 2 &&
          window.ProfileNodeInteraction &&
          window.ProfileCameraComposition?.boot?.() &&
          window.ProfileCameraMateriality?.snapshot?.().ready &&
          window.ProfileScene?.transitions
        );
      }, 12000),
      document.fonts?.ready ? withTimeout(document.fonts.ready, 10000) : true,
      withTimeout(portraitPromise, 10000)
    ]);

    await raf();
    window.ProfileAtlasLOD?.setTopologyMode?.('entry-full', { reason: 'intro-readiness' });
    const fitted = window.ProfileAtlasLOD?.fit?.({ immediate: true, purpose: 'entry', recompute: true });
    state.entryCamera = fitted ? { x: fitted.x, y: fitted.y, scale: fitted.scale } : null;
    await raf();
    await raf();
    const classified = classifyLiveAtlas();
    const topologyReady = classified && await stabiliseAtlas(currentGeneration);
    const rootPoint = window.ProfileGeometry?.atlasPoint?.(rootId);
    const rootGeometry = Boolean(
      topologyReady &&
      Number.isFinite(rootPoint?.x) &&
      Number.isFinite(rootPoint?.y) &&
      Number.isFinite(Number(rootElement?.dataset.x)) &&
      Number.isFinite(Number(rootElement?.dataset.y))
    );

    state.readiness = {
      atlasRoute,
      graph: graphReady,
      css: criticalCss,
      modules: modulesReady,
      fonts: fontReady,
      portrait: portraitReady,
      rootGeometry,
      classified,
      topology: topologyReady,
      labels: topologyReady
    };
    state.criticalReady = Boolean(
      atlasRoute && graphReady && criticalCss && modulesReady && fontReady && portraitReady && rootGeometry && classified && topologyReady && state.entryCamera
    );
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

    if (document.body?.dataset.graphMode !== 'atlas') {
      const recovered = await internalRoute('atlas');
      if (!recovered) {
        cleanupRevealPresentation();
        removeSkip();
        document.documentElement.dataset.profileIntro = 'bypass';
        if (document.body) {
          document.body.dataset.entryState = 'profile';
          document.body.classList.add('is-entry-loader-complete');
          document.body.classList.remove('is-entry-loader-releasing', 'is-entry-mask-finishing');
        }
        state.state = STATES.BYPASSED;
        state.stage = 'fallback';
        state.running = false;
        state.result = 'fallback';
        clearFailOpen();
        markSeen();
        emit('fallback', { reason: 'atlas-route-unavailable' });
        return false;
      }
    }

    if (!nodeElements.length) classifyLiveAtlas();
    revealEverything();
    setStage('settle');
    if (!atlasFullyReady()) {
      window.ProfileAtlasLOD?.setTopologyMode?.('entry-full', { reason: 'intro-ready-prepaint' });
      const stableScale = window.ProfileAtlasLOD?.snapshot?.().camera?.scale;
      if (Number.isFinite(stableScale)) window.ProfileAtlasLOD?.applyLOD?.(stableScale);
    }
    window.ProfileHaloRenderer?.refresh?.();
    if (reason === 'completed') await visibilityInteractivePromise;
    else await wait(reducedMotion ? 0 : 60);

    const maskFinishing = reason === 'completed' && Boolean(visibilityFrame);
    cleanupRevealPresentation({ keepVisibility: maskFinishing });
    removeSkip();
    document.documentElement.dataset.profileIntro = 'ready';
    document.body?.classList.add('is-atlas-ready');
    if (document.body) {
      document.body.dataset.entryState = 'ready';
      document.body.dataset.atlasTopology = 'entry-full';
      document.body.classList.toggle('is-entry-mask-finishing', maskFinishing);
      document.body.classList.toggle('is-entry-loader-complete', !maskFinishing);
      if (!maskFinishing) document.body.classList.remove('is-entry-loader-releasing');
    }
    state.loaderReleased = true;
    clearFailOpen();
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
    if (maskFinishing) visibilityFieldPromise.then(() => {
      if (!document.body?.classList.contains('is-entry-mask-finishing')) return;
      document.body.classList.add('is-entry-loader-complete');
      document.body.classList.remove('is-entry-loader-releasing', 'is-entry-mask-finishing');
    });
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
    if (document.body) {
      document.body.dataset.entryState = 'profile';
      document.body.classList.add('is-entry-loader-complete');
      document.body.classList.remove('is-entry-loader-releasing', 'is-entry-mask-finishing');
    }
    state.running = false;
    state.result = 'interrupted';
    state.stage = 'interrupted';
    clearFailOpen();
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
    state.loaderReleased = false;
    state.startedAt = performance.now();
    state.mobile = mobileQuery.matches;
    document.documentElement.dataset.profileIntro = 'preparing';
    if (document.body) {
      document.body.dataset.entryState = 'preparing';
      document.body.classList.remove('is-entry-loader-complete', 'is-entry-loader-releasing', 'is-entry-mask-finishing');
    }
    clearTimeout(latentTimer);
    latentTimer = setTimeout(() => {
      if (state.state === STATES.PREPARING) document.body?.classList.add('is-entry-latent');
    }, 160);
    installParticipant();
    bindInteractions();

    const ready = await criticalReadiness(currentGeneration);
    if (!ready || currentGeneration !== generation) {
      if (currentGeneration !== generation) return false;
      return completeToReady('fallback');
    }

    /* Readiness is real, not a decorative delay: only now may the loading
       sphere collapse into the already-laid-out live root. */
    document.documentElement.dataset.profileIntro = 'running';
    document.body?.classList.remove('is-atlas-ready');
    document.body?.classList.remove('is-entry-latent');
    clearTimeout(latentTimer);
    latentTimer = 0;
    if (document.body) {
      document.body.dataset.entryState = 'ignition';
      document.body.classList.add('is-entry-loader-releasing');
    }
    visibilityFieldPromise = startVisibilityField();
    await wait(reducedMotion ? 0 : 620);
    if (currentGeneration !== generation) return false;

    state.state = STATES.ATLAS_REVEAL;
    state.stage = 'root';
    state.running = true;
    state.startedAt = performance.now();
    document.body?.classList.add('is-atlas-reveal');
    if (document.body) {
      document.body.dataset.entryState = 'reveal';
      document.body.dataset.atlasRevealStage = 'root';
    }
    createSkip();
    /* The complete live graph is present from the first reveal frame. The
       soft radial light field, not discrete node pop-ins, owns visibility. */
    revealEverything();
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

  mobileQuery.addEventListener?.('change', event => {
    state.mobile = event.matches;
    if (state.state === STATES.ATLAS_REVEAL) syncLabelDensity();
  });

  function snapshot() {
    return {
      ...state,
      mobile: mobileQuery.matches,
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
    clearFailOpen();
    document.documentElement.dataset.profileIntro = 'bypass';
    if (document.body) {
      document.body.dataset.entryState = 'profile';
      document.body.classList.add('is-entry-loader-complete');
    }
    return;
  }

  prepareAndRun();
})();