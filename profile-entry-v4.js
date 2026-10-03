(() => {
  if (window.ProfileIntro?.__v31) return;

  const bootstrap = window.__PROFILE_INTRO_BOOTSTRAP__ || {};
  const graph = window.SITE_DATA?.graph;
  if (!graph?.nodes?.length) return;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const rootId = graph.rootId || 'stepan-chrast';
  const sectionIds = ['work', 'knowledge', 'experience', 'education', 'about'];
  const reducedMotion = Boolean(bootstrap.reducedMotion) || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TIMING = Object.freeze({
    minimumLoader: 1450,
    condense: 720,
    handoff: 420,
    rootHold: 180,
    branchDuration: 820,
    branchStagger: 78,
    edgeDelay: 360,
    chromeDelay: 980,
    chromeFade: 520
  });
  const STATES = Object.freeze({
    PREPARING: 'PREPARING',
    ATLAS_REVEAL: 'ATLAS_REVEAL',
    ATLAS_READY: 'ATLAS_READY',
    BYPASSED: 'BYPASSED'
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
    realGraph: false,
    staticOpeningAtlas: true,
    persistentRoot: true,
    reducedMotion,
    loaderReleased: !bootstrap.eligible
  };

  let generation = 0;
  let completionInFlight = false;
  let skipRequested = false;
  const stagedNodes = new Map();
  const stagedEdges = new Map();

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const raf = () => new Promise(resolve => requestAnimationFrame(resolve));
  const emit = (name, detail = {}) => dispatchEvent(new CustomEvent('profile:intro-' + name, {
    detail: { ...snapshot(), ...detail }
  }));
  const track = name => { try { window.umami?.track?.(name); } catch (_) {} };
  const markSeen = () => { try { sessionStorage.setItem('profileIntroSeen', 'true'); } catch (_) {} };
  const clearFailOpen = () => {
    clearTimeout(window.__PROFILE_ENTRY_FAILOPEN__);
    window.__PROFILE_ENTRY_FAILOPEN__ = 0;
  };
  const waitFor = (predicate, timeout = 4200) => new Promise(resolve => {
    const started = performance.now();
    const poll = () => {
      let value = false;
      try { value = Boolean(predicate()); } catch (_) {}
      if (value || performance.now() - started >= timeout) return resolve(value);
      setTimeout(poll, 24);
    };
    poll();
  });
  const liveNode = id => [...document.querySelectorAll(
    '#site-graph .site-graph-node[data-node-id="' + CSS.escape(id) + '"]'
  )].find(node => !node.closest('.v9-transition-overlay')) || null;
  const mainEdges = () => [...document.querySelectorAll(
    '#site-graph .site-graph-edges path[data-source="' + CSS.escape(rootId) + '"][data-target]'
  )].filter(path => sectionIds.includes(path.dataset.target) && !path.closest('.v9-transition-overlay'));

  const liveRootScreenPoint = () => {
    const root = liveNode(rootId);
    if (!root) return null;
    const dot = root.querySelector(':scope > .site-graph-dot');
    const dotRect = dot?.getBoundingClientRect?.();
    if (dotRect && dotRect.width >= 0 && dotRect.height >= 0) {
      return {
        x: dotRect.left + dotRect.width / 2,
        y: dotRect.top + dotRect.height / 2
      };
    }
    try {
      const matrix = root.getScreenCTM?.();
      if (matrix) {
        const point = new DOMPoint(0, 0).matrixTransform(matrix);
        return { x: point.x, y: point.y };
      }
    } catch (_) {}
    return null;
  };

  const syncEntryTarget = pointOverride => {
    const shell = document.querySelector('.entry-loading-shell');
    const point = pointOverride || liveRootScreenPoint();
    if (!shell || !point) return false;
    const dx = point.x - innerWidth / 2;
    const dy = point.y - innerHeight / 2;
    shell.style.setProperty('--entry-target-x', dx.toFixed(2) + 'px');
    shell.style.setProperty('--entry-target-y', dy.toFixed(2) + 'px');
    shell.dataset.entryTarget = 'profile-root';
    return true;
  };

  const settleEntryTarget = async () => {
    let previous = null;
    let stableFrames = 0;
    let latest = null;
    for (let frame = 0; frame < 18; frame += 1) {
      await raf();
      latest = liveRootScreenPoint();
      if (!latest) continue;
      if (previous && Math.hypot(latest.x - previous.x, latest.y - previous.y) <= .3) {
        stableFrames += 1;
      } else {
        stableFrames = 0;
      }
      previous = latest;
      if (stableFrames >= 3) break;
    }
    return latest ? syncEntryTarget(latest) : false;
  };

  const freezeLoaderFloat = () => {
    const loader = document.querySelector('.entry-loading-object');
    if (!loader) return;
    const currentTransform = getComputedStyle(loader).transform;
    loader.style.animation = 'none';
    if (currentTransform && currentTransform !== 'none') loader.style.transform = currentTransform;
    loader.getBoundingClientRect();
  };

  const releaseFrozenLoader = () => {
    const loader = document.querySelector('.entry-loading-object');
    if (!loader) return;
    loader.style.removeProperty('transform');
  };

  const restoreStagedPresentation = () => {
    stagedNodes.forEach((previous, node) => {
      if (!node?.isConnected) return;
      if (previous == null || previous === '') node.style.removeProperty('opacity');
      else node.style.setProperty('opacity', previous);
    });
    stagedEdges.forEach((previous, edge) => {
      if (!edge?.isConnected) return;
      if (previous == null || previous === '') edge.style.removeProperty('opacity');
      else edge.style.setProperty('opacity', previous);
    });
    stagedNodes.clear();
    stagedEdges.clear();
  };

  const stageProfileGraph = () => {
    restoreStagedPresentation();
    sectionIds.forEach(id => {
      const node = liveNode(id);
      if (!node) return;
      stagedNodes.set(node, node.style.getPropertyValue('opacity'));
      node.style.setProperty('opacity', '0', 'important');
    });
    mainEdges().forEach(edge => {
      stagedEdges.set(edge, edge.style.getPropertyValue('opacity'));
      edge.style.setProperty('opacity', '0', 'important');
    });
    document.body?.classList.add('is-profile-entry-branches-staged');
  };

  const animateBranchNode = (node, root, index) => {
    if (!node || !root) return;
    const previous = stagedNodes.get(node);
    node.style.removeProperty('opacity');
    if (previous) node.style.setProperty('opacity', previous);

    if (reducedMotion) return;

    const rootX = Number(root.dataset.x);
    const rootY = Number(root.dataset.y);
    const nodeX = Number(node.dataset.x);
    const nodeY = Number(node.dataset.y);
    if (![rootX, rootY, nodeX, nodeY].every(Number.isFinite)) {
      node.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 300,
        delay: index * 30,
        easing: 'ease-out',
        fill: 'both'
      });
      return;
    }

    const delay = index * TIMING.branchStagger;
    const duration = TIMING.branchDuration;
    node.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration,
      delay,
      easing: 'cubic-bezier(.16,.78,.2,1)',
      fill: 'both'
    });

    const motion = document.createElementNS(SVG_NS, 'animateTransform');
    motion.setAttribute('attributeName', 'transform');
    motion.setAttribute('attributeType', 'XML');
    motion.setAttribute('type', 'translate');
    motion.setAttribute('additive', 'sum');
    motion.setAttribute('from', (rootX - nodeX).toFixed(2) + ' ' + (rootY - nodeY).toFixed(2));
    motion.setAttribute('to', '0 0');
    motion.setAttribute('dur', duration + 'ms');
    motion.setAttribute('begin', delay + 'ms');
    motion.setAttribute('fill', 'remove');
    motion.setAttribute('calcMode', 'spline');
    motion.setAttribute('keySplines', '.16 .78 .2 1');
    node.appendChild(motion);
    try { motion.beginElement?.(); } catch (_) {}
    setTimeout(() => motion.remove(), duration + delay + 90);
  };

  const animateMainEdges = () => {
    const edges = mainEdges();
    document.body?.classList.remove('is-profile-entry-branches-staged');
    edges.forEach(edge => {
      edge.style.removeProperty('opacity');
      const previous = stagedEdges.get(edge);
      if (previous) edge.style.setProperty('opacity', previous);
    });
    stagedEdges.clear();

    if (reducedMotion) return;
    if (window.ProfileMotionRefinements?.drawMainBranchEdges) {
      window.ProfileMotionRefinements.drawMainBranchEdges();
      return;
    }

    edges.forEach((edge, index) => {
      let length = 0;
      try { length = Math.max(1, edge.getTotalLength()); } catch (_) {}
      const previousDasharray = edge.style.strokeDasharray;
      const previousDashoffset = edge.style.strokeDashoffset;
      const previousOpacity = edge.style.opacity;
      edge.style.strokeDasharray = String(length);
      edge.style.strokeDashoffset = String(length);
      edge.style.opacity = '0';
      edge.animate([
        { strokeDashoffset: length, opacity: 0 },
        { strokeDashoffset: 0, opacity: .78 }
      ], {
        duration: 520,
        delay: index * 55,
        easing: 'cubic-bezier(.16,.78,.2,1)',
        fill: 'both'
      }).finished.finally(() => {
        edge.style.strokeDasharray = previousDasharray;
        edge.style.strokeDashoffset = previousDashoffset;
        edge.style.opacity = previousOpacity;
      });
    });
  };

  const animateProfileEmergence = () => {
    const root = liveNode(rootId);
    const branches = sectionIds.map(liveNode).filter(Boolean);
    branches.forEach((node, index) => animateBranchNode(node, root, index));
    stagedNodes.clear();
    setTimeout(animateMainEdges, reducedMotion ? 0 : TIMING.edgeDelay);
  };

  const failOpen = reason => {
    ++generation;
    restoreStagedPresentation();
    document.documentElement.dataset.profileIntro = 'bypass';
    if (document.body) {
      document.body.dataset.entryState = 'profile';
      document.body.classList.add('is-entry-loader-complete');
      document.body.classList.remove(
        'is-entry-loader-releasing',
        'is-entry-loader-handoff',
        'is-profile-entry-revealing',
        'is-profile-entry-chrome-visible',
        'is-profile-entry-branches-staged'
      );
    }
    state.state = STATES.BYPASSED;
    state.stage = 'fallback';
    state.running = false;
    state.result = 'fallback';
    state.loaderReleased = true;
    clearFailOpen();
    markSeen();
    emit('fallback', { reason });
    return false;
  };

  async function completeToProfile(reason = 'completed') {
    if (completionInFlight || !state.eligible || state.state === STATES.ATLAS_READY || state.state === STATES.BYPASSED) return false;
    completionInFlight = true;
    const currentGeneration = generation;
    const instant = reducedMotion || reason === 'skipped';
    const phaseWait = ms => wait(instant ? 0 : ms);
    state.running = true;
    state.state = STATES.ATLAS_REVEAL;
    state.stage = 'condensing';
    state.startedAt ||= performance.now();

    document.documentElement.dataset.profileIntro = 'running';
    if (document.body) {
      document.body.dataset.entryState = 'ignition';
      document.body.classList.add('is-profile-entry-revealing');
      document.body.classList.remove(
        'is-entry-loader-complete',
        'is-entry-loader-handoff',
        'is-profile-entry-chrome-visible'
      );
    }

    // The loader does not own a hard-coded destination. At this point the
    // Overview already uses its final document geometry behind the loader.
    // Wait until that live root is stationary for several frames, then target
    // its exact screen centre. This prevents the handoff from chasing an
    // intermediate layout position.
    await settleEntryTarget();
    freezeLoaderFloat();
    await raf();
    document.body?.classList.add('is-entry-loader-releasing');
    releaseFrozenLoader();

    emit('started', { source: 'static-opening-atlas' });
    emit('stage', { stage: 'condensing' });
    track('intro_started');

    await phaseWait(TIMING.condense);
    if (currentGeneration !== generation) return false;

    // At handoff the static loader has collapsed to its central node. The live
    // Overview is already staged behind it with only the canonical root visible.
    // Cross-fade those two roots before any branch or surrounding UI is shown.
    document.documentElement.dataset.profileIntro = 'ready';
    state.stage = 'root';
    if (document.body) {
      document.body.dataset.entryState = 'profile';
      document.body.classList.add('is-entry-loader-handoff');
    }
    emit('stage', { stage: 'root' });

    await phaseWait(TIMING.handoff);
    if (currentGeneration !== generation) return false;
    if (document.body) {
      document.body.classList.add('is-entry-loader-complete');
      document.body.classList.remove('is-entry-loader-releasing', 'is-entry-loader-handoff');
    }
    state.loaderReleased = true;

    await phaseWait(TIMING.rootHold);
    if (currentGeneration !== generation) return false;

    state.stage = 'branches';
    emit('stage', { stage: 'branches' });
    animateProfileEmergence();

    await phaseWait(TIMING.chromeDelay);
    if (currentGeneration !== generation) return false;

    // The graph establishes hierarchy first. Navigation, the profile brief and
    // supporting labels then anti-blend in as a separate, quieter layer.
    state.stage = 'chrome';
    if (document.body) document.body.classList.add('is-profile-entry-chrome-visible');
    emit('stage', { stage: 'chrome' });

    await phaseWait(TIMING.chromeFade);
    if (currentGeneration !== generation) return false;

    state.state = STATES.ATLAS_READY;
    state.stage = 'profile';
    state.running = false;
    state.result = reason;
    state.readyAt = performance.now();
    state.elapsed = state.readyAt - state.startedAt;
    if (document.body) {
      document.body.classList.remove(
        'is-profile-entry-revealing',
        'is-profile-entry-chrome-visible',
        'is-profile-entry-branches-staged'
      );
    }

    emit('stage', { stage: 'profile' });
    emit('completed', { reason, entryState: STATES.ATLAS_READY });
    dispatchEvent(new CustomEvent('profile:intro-completed', {
      detail: { ...snapshot(), reason, entryState: STATES.ATLAS_READY }
    }));

    clearFailOpen();
    markSeen();
    track(reason === 'skipped' ? 'intro_skipped' : 'intro_completed');
    completionInFlight = false;
    return true;
  }

  const prepareAndRun = async () => {
    if (!state.eligible || state.running || state.state === STATES.ATLAS_READY) return false;
    const currentGeneration = ++generation;
    state.state = STATES.PREPARING;
    state.stage = 'preparing';
    state.running = false;
    state.result = null;
    state.loaderReleased = false;
    state.startedAt = performance.now();
    document.documentElement.dataset.profileIntro = 'preparing';
    const loaderObject = document.querySelector('.entry-loading-object');
    if (loaderObject) {
      loaderObject.style.removeProperty('animation');
      loaderObject.style.removeProperty('transform');
    }
    if (document.body) {
      document.body.dataset.entryState = 'preparing';
      document.body.classList.remove(
        'is-entry-loader-complete',
        'is-entry-loader-releasing',
        'is-entry-loader-handoff',
        'is-profile-entry-branches-staged'
      );
    }
    emit('stage', { stage: 'preparing' });

    const graphReady = await waitFor(() =>
      document.body?.dataset.graphMode === 'overview' &&
      Boolean(window.ProfileRootLanding) &&
      Boolean(liveNode(rootId)) &&
      sectionIds.every(id => Boolean(liveNode(id)))
    );
    if (!graphReady || currentGeneration !== generation) {
      if (currentGeneration !== generation) return false;
      return failOpen('profile-graph-unavailable');
    }

    if (document.body?.dataset.rootLanding === 'true') {
      window.ProfileRootLanding?.commitExpanded?.({
        focusGraph: false,
        animate: false,
        reason: 'v4-static-entry'
      });
      await raf();
      await raf();
    }

    const settled = await waitFor(() =>
      document.body?.dataset.graphMode === 'overview' &&
      document.body?.dataset.rootLanding === 'false' &&
      Boolean(liveNode(rootId)) &&
      sectionIds.every(id => Boolean(liveNode(id))),
    1800);
    if (!settled || currentGeneration !== generation) {
      if (currentGeneration !== generation) return false;
      return failOpen('profile-root-unavailable');
    }

    syncEntryTarget();
    stageProfileGraph();
    if (skipRequested) return completeToProfile('skipped');

    if (!reducedMotion) {
      const elapsed = performance.now() - state.startedAt;
      const remaining = Math.max(0, TIMING.minimumLoader - elapsed);
      if (remaining) await wait(remaining);
      if (currentGeneration !== generation) return false;
    }
    return completeToProfile('completed');
  };

  const replay = async () => {
    if (state.running || document.body?.dataset.graphMode !== 'overview') return false;
    state.eligible = true;
    state.state = STATES.PREPARING;
    state.result = null;
    state.loaderReleased = false;
    skipRequested = false;
    document.body?.classList.remove('is-entry-loader-complete');
    return prepareAndRun();
  };

  function snapshot() {
    return {
      ...state,
      route: document.body?.dataset.graphRoute || (location.hash || '#overview').replace(/^#/, ''),
      graphMode: document.body?.dataset.graphMode || null,
      rootLanding: document.body?.dataset.rootLanding === 'true',
      liveGraphPresent: Boolean(document.querySelector('#site-graph .site-graph-svg')),
      rootPresent: Boolean(liveNode(rootId)),
      staticAtlasPresent: Boolean(document.querySelector('.entry-opening-atlas')),
      entryTarget: document.querySelector('.entry-loading-shell')?.dataset.entryTarget || null,
      canonicalStates: { ...STATES }
    };
  }

  window.ProfileIntro = Object.freeze({
    __v31: true,
    __v4: true,
    STATES,
    skip: () => {
      skipRequested = true;
      if (state.state === STATES.PREPARING) return true;
      return completeToProfile('skipped');
    },
    replay,
    snapshot
  });

  if (state.eligible) {
    prepareAndRun().catch(() => failOpen('unexpected-error'));
  } else {
    clearFailOpen();
    document.documentElement.dataset.profileIntro = 'bypass';
    if (document.body) {
      document.body.dataset.entryState ||= 'profile';
      document.body.classList.add('is-entry-loader-complete');
    }
  }
})();