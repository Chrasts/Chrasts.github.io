(() => {
  const bootstrap = window.__PROFILE_INTRO_BOOTSTRAP__ || {};
  const graph = window.SITE_DATA?.graph;
  const scene = window.ProfileScene;
  if (!graph?.nodes?.length || !scene?.manager) return;

  const rootId = graph.rootId || 'stepan-chrast';
  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const reducedMotion = Boolean(window.__PROFILE_REDUCED_MOTION__) ||
    Boolean(bootstrap.reducedMotion) ||
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  const initialHash = bootstrap.initialHash ?? location.hash;
  const svgNS = 'http://www.w3.org/2000/svg';
  const sections = ['work', 'knowledge', 'experience', 'education', 'about'];

  const state = {
    eligible: Boolean(bootstrap.eligible),
    running: false,
    stage: bootstrap.eligible ? 'pending' : 'bypassed',
    result: bootstrap.eligible ? null : 'bypassed',
    reducedMotion,
    startedAt: null,
    elapsed: 0,
    nodeCount: 0,
    edgeCount: 0,
    interrupted: false,
    targetRoute: null,
    persistentRoot: true,
    realGraph: true,
    mobile: matchMedia('(max-width: 900px)').matches
  };

  let runGeneration = 0;
  let frame = 0;
  let finalising = false;
  let transitionToken = null;
  let participantInstalled = false;
  let graphSvg = null;
  let rootElement = null;
  let nodeRecords = new Map();
  let edgeRecords = [];
  let tracedEdges = [];
  let skipButton = null;
  let sharedHandoff = null;
  let interactionBound = false;
  let replayRequested = false;

  const clamp01 = value => Math.max(0, Math.min(1, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => 1 - Math.pow(1 - clamp01(t), 3);
  const smooth = t => {
    const p = clamp01(t);
    return p * p * (3 - 2 * p);
  };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const raf = () => new Promise(resolve => requestAnimationFrame(resolve));
  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';
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
  const stage = name => {
    if (state.stage === name) return;
    state.stage = name;
    if (document.body) document.body.dataset.phaseHIntroStage = name;
    emit('stage', { stage: name });
  };

  const restoreInitialOverviewURL = () => {
    if (initialHash && !replayRequested) return;
    const clean = `${location.pathname}${location.search}`;
    history.replaceState(history.state, '', clean || '/');
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
    window.__GRAPH_V6_FORCE_SNAP__ = true;
    history.replaceState(history.state, '', next.toString());
    dispatchHashChange(oldURL, next.toString());
    return waitFor(() => normaliseRoute(document.body?.dataset.graphRoute || location.hash) === target, 3800);
  };

  const depthMemo = new Map([[rootId, 0]]);
  const depthOf = (id, trail = new Set()) => {
    if (depthMemo.has(id)) return depthMemo.get(id);
    if (trail.has(id)) return 99;
    const node = nodeMap.get(id);
    if (!node) return 99;
    const nextTrail = new Set(trail).add(id);
    const values = (node.parentIds || [])
      .filter(parentId => nodeMap.has(parentId))
      .map(parentId => depthOf(parentId, nextTrail))
      .filter(Number.isFinite);
    const depth = values.length ? Math.min(...values) + 1 : 99;
    depthMemo.set(id, depth);
    return depth;
  };

  const sectionMemo = new Map([[rootId, rootId], ...sections.map(id => [id, id])]);
  const sectionFor = (id, trail = new Set()) => {
    if (sectionMemo.has(id)) return sectionMemo.get(id);
    if (trail.has(id)) return rootId;
    const node = nodeMap.get(id);
    if (!node) return rootId;
    const nextTrail = new Set(trail).add(id);
    for (const parentId of node.parentIds || []) {
      if (sections.includes(parentId)) {
        sectionMemo.set(id, parentId);
        return parentId;
      }
      const section = sectionFor(parentId, nextTrail);
      if (sections.includes(section)) {
        sectionMemo.set(id, section);
        return section;
      }
    }
    return rootId;
  };

  const primaryParent = id => {
    const parents = (nodeMap.get(id)?.parentIds || []).filter(parentId => nodeMap.has(parentId));
    if (!parents.length) return rootId;
    return [...parents].sort((a, b) => depthOf(a) - depthOf(b) || a.localeCompare(b))[0];
  };

  const tierFor = depth => depth <= 0 ? 'root' : depth === 1 ? 'section' : depth === 2 ? 'cluster' : 'deep';
  const pointOf = element => ({ x: Number(element?.dataset.x || 0), y: Number(element?.dataset.y || 0) });

  const wrapNode = element => {
    if (!element) return null;
    const existing = element.querySelector(':scope > .phase-h-node-motion');
    if (existing) return existing;
    const wrapper = document.createElementNS(svgNS, 'g');
    wrapper.classList.add('phase-h-node-motion');
    const children = [...element.childNodes];
    children.forEach(child => wrapper.appendChild(child));
    element.appendChild(wrapper);
    return wrapper;
  };

  const unwrapNode = element => {
    const wrapper = element?.querySelector(':scope > .phase-h-node-motion');
    if (!wrapper) return;
    while (wrapper.firstChild) element.insertBefore(wrapper.firstChild, wrapper);
    wrapper.remove();
  };

  const setVisualPoint = (record, point, scale = 1) => {
    record.current = point;
    const dx = point.x - record.origin.x;
    const dy = point.y - record.origin.y;
    record.wrapper?.setAttribute('transform', `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) scale(${scale.toFixed(4)})`);
  };

  const setNodeOpacity = (record, value) => {
    record.opacity = clamp01(value);
    record.element.style.setProperty('opacity', String(record.opacity), 'important');
  };

  const setLabelOpacity = (record, value) => {
    record.label?.style.setProperty('opacity', String(clamp01(value)), 'important');
    record.meta?.style.setProperty('opacity', String(clamp01(value)), 'important');
  };

  const edgePath = (from, to, edge) => {
    const hierarchy = ['hierarchy', 'hierarchy-alt', 'work-lattice'].includes(edge.dataset.type || 'hierarchy');
    if (hierarchy) {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} C ${(from.x + dx * .34).toFixed(1)} ${(from.y + dy * .34).toFixed(1)} ${(from.x + dx * .74).toFixed(1)} ${(from.y + dy * .74).toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
    }
    const root = nodeRecords.get(rootId)?.origin || { x: 0, y: 0 };
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    let ox = mid.x - root.x;
    let oy = mid.y - root.y;
    const length = Math.max(1, Math.hypot(ox, oy));
    ox /= length; oy /= length;
    const push = Math.min(150, Math.max(42, Math.hypot(to.x - from.x, to.y - from.y) * .12));
    return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${(mid.x + ox * push).toFixed(1)} ${(mid.y + oy * push).toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
  };

  const buildRecords = () => {
    graphSvg = document.querySelector('#site-graph .site-graph-svg');
    if (!graphSvg) return false;
    const nodes = [...graphSvg.querySelectorAll('.site-graph-node[data-node-id]')]
      .filter(element => !element.closest('.v9-transition-overlay'));
    nodeRecords = new Map();
    nodes.forEach(element => {
      const id = element.dataset.nodeId;
      const depth = depthOf(id);
      const origin = pointOf(element);
      const wrapper = wrapNode(element);
      const record = {
        id,
        element,
        wrapper,
        label: element.querySelector('.site-graph-label'),
        meta: element.querySelector('.site-graph-meta'),
        dot: element.querySelector('.site-graph-dot'),
        depth,
        tier: tierFor(depth),
        section: sectionFor(id),
        parentId: id === rootId ? null : primaryParent(id),
        origin,
        current: { ...origin },
        opacity: 1
      };
      element.dataset.phaseHTier = record.tier;
      element.dataset.phaseHDepth = String(depth);
      setVisualPoint(record, origin, 1);
      const initialOpacity = record.tier === 'deep' ? .44 : record.tier === 'cluster' ? .78 : 1;
      setNodeOpacity(record, initialOpacity);
      if (record.tier === 'deep') setLabelOpacity(record, 0);
      else if (record.tier === 'cluster') setLabelOpacity(record, state.mobile ? 0 : .62);
      else setLabelOpacity(record, 1);
      nodeRecords.set(id, record);
    });

    rootElement = nodeRecords.get(rootId)?.element || null;
    edgeRecords = [...graphSvg.querySelectorAll('.site-graph-edges path[data-source][data-target]')]
      .filter(element => !element.closest('.v9-transition-overlay'))
      .map(element => ({
        element,
        source: element.dataset.source,
        target: element.dataset.target,
        type: element.dataset.type || 'hierarchy',
        originalD: element.getAttribute('d') || '',
        originalDasharray: element.style.strokeDasharray,
        originalDashoffset: element.style.strokeDashoffset,
        originalOpacity: element.style.opacity,
        length: 0
      }));

    edgeRecords.forEach(record => {
      const cross = !['hierarchy', 'hierarchy-alt', 'work-lattice'].includes(record.type);
      record.element.style.setProperty('opacity', cross ? '.12' : '.42', 'important');
    });

    state.nodeCount = nodeRecords.size;
    state.edgeCount = edgeRecords.length;
    return Boolean(rootElement && nodeRecords.size > 5);
  };

  const chooseWakeEdges = () => {
    const cross = edgeRecords.filter(record => !['hierarchy', 'hierarchy-alt', 'work-lattice'].includes(record.type));
    const score = record => {
      const a = sectionFor(record.source);
      const b = sectionFor(record.target);
      let value = a !== b ? 20 : 0;
      if (new Set([a, b]).has('education') && new Set([a, b]).has('knowledge')) value += 20;
      if (new Set([a, b]).has('experience') && new Set([a, b]).has('work')) value += 18;
      if (new Set([a, b]).has('knowledge') && new Set([a, b]).has('work')) value += 12;
      return value;
    };
    const selected = [...cross].sort((a, b) => score(b) - score(a)).slice(0, 3);
    const hierarchy = edgeRecords.filter(record =>
      ['hierarchy', 'hierarchy-alt', 'work-lattice'].includes(record.type) &&
      depthOf(record.source) <= 1 && depthOf(record.target) === 2
    );
    if (hierarchy.length) selected.push(hierarchy[0]);
    tracedEdges = [...new Set(selected)].slice(0, 4);
    tracedEdges.forEach(record => {
      try { record.length = Math.max(1, record.element.getTotalLength()); }
      catch (_) { record.length = 120; }
      record.element.style.setProperty('stroke-dasharray', `${record.length.toFixed(1)} ${record.length.toFixed(1)}`, 'important');
      record.element.style.setProperty('stroke-dashoffset', record.length.toFixed(1), 'important');
    });
  };

  const condensationWindow = record => {
    if (record.depth <= 0) return null;
    if (record.depth === 1) return { start: 1900, end: 2200 };
    if (record.depth === 2) return { start: 820, end: 1420 };
    const deep = Math.max(3, record.depth);
    const start = 450 + Math.max(0, 5 - deep) * 72 + (record.id.length % 5) * 13;
    const end = Math.min(1270, start + 610 + Math.min(120, (deep - 3) * 35));
    return { start, end };
  };

  const updateWake = elapsed => {
    const p = clamp01((elapsed - 250) / 400);
    tracedEdges.forEach((record, index) => {
      const local = clamp01((p - index * .08) / .76);
      const traced = ease(local);
      record.element.style.setProperty('stroke-dashoffset', String(record.length * (1 - traced)), 'important');
      const fade = elapsed > 570 ? 1 - clamp01((elapsed - 570) / 180) : 1;
      record.element.style.setProperty('opacity', String(.26 + .66 * Math.sin(Math.PI * local) * fade), 'important');
    });
  };

  const updateCamera = elapsed => {
    const camera = window.ProfileCameraComposition;
    if (!camera?.focusNode) return;
    if (elapsed >= 850 && !document.body.dataset.phaseHCameraFollow) {
      document.body.dataset.phaseHCameraFollow = 'true';
      camera.focusNode(rootId, { scale: 1.36 });
    }
    if (elapsed >= 1540 && !document.body.dataset.phaseHCameraPush) {
      document.body.dataset.phaseHCameraPush = 'true';
      camera.focusNode(rootId, { scale: state.mobile ? 1.48 : 1.64 });
    }
  };

  const updateCondensation = elapsed => {
    const ordered = [...nodeRecords.values()].sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id));
    const impacts = new Map();

    ordered.forEach(record => {
      if (record.id === rootId) return;
      const window = condensationWindow(record);
      if (!window) return;
      const raw = clamp01((elapsed - window.start) / Math.max(1, window.end - window.start));
      const p = ease(raw);
      const parent = nodeRecords.get(record.parentId) || nodeRecords.get(rootId);
      const target = parent?.current || nodeRecords.get(rootId)?.current || record.origin;
      const point = {
        x: lerp(record.origin.x, target.x, p),
        y: lerp(record.origin.y, target.y, p)
      };
      const scale = 1 - .24 * smooth(clamp01((raw - .12) / .88));
      setVisualPoint(record, point, scale);

      const fadeStart = record.depth === 1 ? .66 : .70;
      const opacity = record.depth === 1
        ? 1 - smooth(clamp01((raw - .70) / .30))
        : (record.tier === 'deep' ? .44 : record.tier === 'cluster' ? .78 : 1) *
          (1 - smooth(clamp01((raw - fadeStart) / (1 - fadeStart))));
      setNodeOpacity(record, opacity);

      if (record.depth === 1) {
        const labelOpacity = 1 - smooth(clamp01((raw - .08) / .46));
        setLabelOpacity(record, labelOpacity);
      } else if (record.depth === 2) {
        setLabelOpacity(record, (state.mobile ? 0 : .62) * (1 - smooth(clamp01((raw - .42) / .48))));
      }

      const impact = Math.sin(Math.PI * clamp01((raw - .58) / .42));
      if (impact > 0 && parent) impacts.set(parent.id, (impacts.get(parent.id) || 0) + impact);
    });

    nodeRecords.forEach(record => {
      const impact = Math.min(1, impacts.get(record.id) || 0);
      if (!record.dot) return;
      if (impact > .001) {
        record.dot.style.setProperty('transform', `scale(${(1 + impact * .075).toFixed(4)})`, 'important');
        record.dot.style.setProperty('stroke-width', String(1.4 + impact * .85), 'important');
      } else {
        record.dot.style.removeProperty('transform');
        record.dot.style.removeProperty('stroke-width');
      }
    });

    edgeRecords.forEach(record => {
      const from = nodeRecords.get(record.source)?.current;
      const to = nodeRecords.get(record.target)?.current;
      if (!from || !to) return;
      record.element.setAttribute('d', edgePath(from, to, record.element));
      const cross = !['hierarchy', 'hierarchy-alt', 'work-lattice'].includes(record.type);
      if (cross) {
        if (elapsed < 650 && tracedEdges.includes(record)) return;
        const opacity = .12 * (1 - smooth(clamp01((elapsed - 480) / 260)));
        record.element.style.setProperty('opacity', String(opacity), 'important');
        return;
      }
      const targetRecord = nodeRecords.get(record.target);
      const window = targetRecord ? condensationWindow(targetRecord) : null;
      const raw = window ? clamp01((elapsed - window.start) / Math.max(1, window.end - window.start)) : 0;
      const base = targetRecord?.depth === 1 ? .72 : .42;
      const opacity = base * (1 - smooth(clamp01((raw - .58) / .42)));
      record.element.style.setProperty('opacity', String(opacity), 'important');
    });
  };

  const stageForElapsed = elapsed => {
    if (elapsed < 250) return 'atlas';
    if (elapsed < 650) return 'wake';
    if (elapsed < 1250) return 'condensing';
    if (elapsed < 1900) return 'branches';
    if (elapsed < 2200) return 'absorbing';
    return 'handoff';
  };

  const clearRunFrame = () => {
    cancelAnimationFrame(frame);
    frame = 0;
  };

  const cleanupGraphMotion = ({ restoreEdges = true } = {}) => {
    clearRunFrame();
    nodeRecords.forEach(record => {
      record.element.style.removeProperty('opacity');
      record.label?.style.removeProperty('opacity');
      record.meta?.style.removeProperty('opacity');
      record.dot?.style.removeProperty('transform');
      record.dot?.style.removeProperty('stroke-width');
      delete record.element.dataset.phaseHTier;
      delete record.element.dataset.phaseHDepth;
      unwrapNode(record.element);
    });
    edgeRecords.forEach(record => {
      if (restoreEdges && record.originalD) record.element.setAttribute('d', record.originalD);
      record.element.style.removeProperty('opacity');
      record.element.style.strokeDasharray = record.originalDasharray;
      record.element.style.strokeDashoffset = record.originalDashoffset;
    });
    nodeRecords = new Map();
    edgeRecords = [];
    tracedEdges = [];
    graphSvg = null;
    rootElement = null;
  };

  const removeIntroChrome = () => {
    skipButton?.remove();
    skipButton = null;
    delete document.body.dataset.phaseHCameraFollow;
    delete document.body.dataset.phaseHCameraPush;
    delete document.body.dataset.phaseHIntroStage;
  };

  const createSkip = () => {
    if (skipButton) return skipButton;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'phase-h-intro-skip';
    button.textContent = 'Skip intro';
    button.setAttribute('aria-label', 'Skip profile introduction');
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      settleToLanding('skip');
    });
    document.body.appendChild(button);
    skipButton = button;
    return button;
  };

  const finishTransitionToken = reason => {
    if (!transitionToken) return;
    if (scene.transitions?.matches?.(transitionToken)) {
      scene.transitions.finish(transitionToken, { kind: 'intro-v2', reason, toRoute: 'overview' });
    }
    transitionToken = null;
  };

  const createSharedHandoff = root => {
    const dot = root?.querySelector('.site-graph-dot');
    const label = root?.querySelector('.site-graph-label');
    const dotRect = dot?.getBoundingClientRect();
    const labelRect = label?.getBoundingClientRect();
    if (!dotRect?.width || !labelRect?.width) return null;

    const shell = document.createElement('div');
    shell.className = 'phase-h-root-handoff';
    shell.setAttribute('aria-hidden', 'true');
    const sharedDot = document.createElement('span');
    sharedDot.className = 'phase-h-root-handoff-dot';
    const sharedLabel = document.createElement('span');
    sharedLabel.className = 'phase-h-root-handoff-label';
    sharedLabel.textContent = nodeMap.get(rootId)?.label || 'Štěpán Chrast';
    Object.assign(sharedDot.style, {
      left: `${dotRect.left}px`, top: `${dotRect.top}px`, width: `${dotRect.width}px`, height: `${dotRect.height}px`
    });
    Object.assign(sharedLabel.style, {
      left: `${labelRect.left}px`, top: `${labelRect.top}px`, width: `${labelRect.width}px`, height: `${labelRect.height}px`
    });
    shell.append(sharedDot, sharedLabel);
    document.body.appendChild(shell);
    sharedHandoff = { shell, dot: sharedDot, label: sharedLabel, dotRect, labelRect };
    return sharedHandoff;
  };

  const animateSharedHandoff = async (handoff, fast = false) => {
    if (!handoff) return;
    await raf();
    await raf();
    const targetDot = document.querySelector('.root-node-dot');
    const targetTitle = document.querySelector('.hero-copy h1');
    const dotRect = targetDot?.getBoundingClientRect();
    const titleRect = targetTitle?.getBoundingClientRect();
    if (!dotRect?.width || !titleRect?.width) return;

    const duration = reducedMotion ? 120 : fast ? 220 : 430;
    const dotDx = dotRect.left + dotRect.width / 2 - (handoff.dotRect.left + handoff.dotRect.width / 2);
    const dotDy = dotRect.top + dotRect.height / 2 - (handoff.dotRect.top + handoff.dotRect.height / 2);
    const dotScale = Math.max(.4, Math.min(4, dotRect.width / handoff.dotRect.width));
    const labelDx = titleRect.left + titleRect.width / 2 - (handoff.labelRect.left + handoff.labelRect.width / 2);
    const labelDy = titleRect.top + titleRect.height * .42 - (handoff.labelRect.top + handoff.labelRect.height / 2);
    const labelScale = Math.max(1, Math.min(4.8, titleRect.width / Math.max(1, handoff.labelRect.width)));

    const dotAnimation = handoff.dot.animate([
      { transform: 'translate(0px,0px) scale(1)', opacity: 1 },
      { transform: `translate(${dotDx}px,${dotDy}px) scale(${dotScale})`, opacity: .96 }
    ], { duration, easing: 'cubic-bezier(.18,.74,.2,1)', fill: 'forwards' });
    const labelAnimation = handoff.label.animate([
      { transform: 'translate(0px,0px) scale(1)', opacity: 1 },
      { transform: `translate(${labelDx}px,${labelDy}px) scale(${labelScale})`, opacity: .12 }
    ], { duration, easing: 'cubic-bezier(.18,.74,.2,1)', fill: 'forwards' });

    await Promise.race([
      Promise.allSettled([dotAnimation.finished, labelAnimation.finished]),
      wait(duration + 80)
    ]);
  };

  const finalLandingReveal = async ({ fast = false, reason = 'completed' } = {}) => {
    if (finalising && state.result) return false;
    finalising = true;
    clearRunFrame();
    finishTransitionToken(reason);
    markSeen();
    stage('handoff');
    document.documentElement.dataset.profileIntro = 'handoff';
    document.body.classList.add('is-phase-h-handoff');

    const handoff = createSharedHandoff(rootElement);
    cleanupGraphMotion({ restoreEdges: false });
    const overviewReady = await internalRoute('overview');
    if (!overviewReady) {
      document.body.classList.remove('is-profile-intro-v2', 'is-phase-h-handoff');
      removeIntroChrome();
      state.running = false;
      state.stage = 'complete';
      state.result = 'fallback';
      finalising = false;
      return false;
    }
    restoreInitialOverviewURL();
    await waitFor(() => window.ProfileRootLanding?.isActive?.() === true, 1800);
    document.body.classList.add('is-phase-h-landing-revealed');
    await animateSharedHandoff(handoff, fast);
    sharedHandoff?.shell?.remove();
    sharedHandoff = null;

    document.body.classList.remove('is-profile-intro-v2', 'is-phase-h-handoff');
    await wait(reducedMotion ? 20 : fast ? 70 : 150);
    document.body.classList.remove('is-phase-h-landing-revealed');
    removeIntroChrome();
    document.documentElement.dataset.profileIntro = 'complete';
    state.running = false;
    state.stage = 'complete';
    state.result = reason === 'skip' ? 'skipped' : 'completed';
    state.elapsed = state.startedAt == null ? 0 : performance.now() - state.startedAt;
    emit(state.result === 'skipped' ? 'skipped' : 'completed', { reason });
    track(state.result === 'skipped' ? 'intro_skipped' : 'intro_completed');
    buildLatentTopology();
    finalising = false;
    return true;
  };

  async function settleToLanding(reason = 'skip') {
    if (!state.eligible || state.result || finalising) return false;
    ++runGeneration;
    state.interrupted = reason !== 'completed';
    return finalLandingReveal({ fast: true, reason });
  }

  const hardInterrupt = payload => {
    if (!state.running || state.result || finalising) return false;
    const targetRoute = normaliseRoute(payload?.targetRoute || 'overview');
    ++runGeneration;
    clearRunFrame();
    state.interrupted = true;
    state.targetRoute = targetRoute;
    markSeen();
    finishTransitionToken('interrupted');
    cleanupGraphMotion();
    sharedHandoff?.shell?.remove();
    sharedHandoff = null;
    removeIntroChrome();
    document.body.classList.remove('is-profile-intro-v2', 'is-phase-h-handoff', 'is-phase-h-landing-revealed');
    document.documentElement.dataset.profileIntro = 'complete';
    state.running = false;
    state.stage = 'complete';
    state.result = 'interrupted';
    emit('interrupted', { targetRoute, reason: payload?.reason || 'navigation-retarget' });
    queueMicrotask(() => internalRoute(targetRoute));
    return true;
  };

  const installParticipant = () => {
    if (participantInstalled || !scene.transitions?.registerParticipant) return;
    scene.transitions.registerParticipant('intro-v2', {
      capture: () => snapshot(),
      cancel: payload => hardInterrupt(payload)
    });
    participantInstalled = true;
  };

  const bindInteractions = () => {
    if (interactionBound) return;
    interactionBound = true;

    addEventListener('keydown', event => {
      if (!state.running || state.result || finalising) return;
      if (event.key === 'Tab') {
        event.preventDefault();
        event.stopImmediatePropagation();
        settleToLanding('keyboard');
        return;
      }
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopImmediatePropagation();
        settleToLanding(event.key === 'Escape' ? 'skip' : 'keyboard');
      }
    }, true);

    addEventListener('click', event => {
      if (!state.running || state.result || finalising || event.button !== 0) return;
      const elapsed = state.startedAt == null ? 0 : performance.now() - state.startedAt;
      if (elapsed < 180) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (event.target.closest?.('.phase-h-intro-skip')) return;
      const node = event.target.closest?.('#site-graph .site-graph-node[data-node-id]');
      if (node) {
        const route = normaliseRoute(nodeMap.get(node.dataset.nodeId)?.route || (node.dataset.nodeId === rootId ? 'overview' : 'overview'));
        event.preventDefault();
        event.stopImmediatePropagation();
        if (route === 'overview') settleToLanding('pointer');
        else hardInterrupt({ reason: 'intro-node-retarget', targetRoute: route });
        return;
      }
      if (event.target.closest?.('#site-explorer')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        settleToLanding('pointer');
      }
    }, true);
  };

  const runReduced = async generation => {
    stage('atlas');
    await wait(110);
    if (generation !== runGeneration || finalising) return;
    stage('condensing');
    nodeRecords.forEach(record => {
      if (record.id === rootId) return;
      setNodeOpacity(record, record.depth === 1 ? .18 : 0);
    });
    edgeRecords.forEach(record => record.element.style.setProperty('opacity', '0', 'important'));
    await wait(90);
    if (generation !== runGeneration || finalising) return;
    await finalLandingReveal({ fast: true, reason: 'completed' });
  };

  const runTimeline = generation => new Promise(resolve => {
    state.startedAt = performance.now();
    const tick = now => {
      if (generation !== runGeneration || finalising || !state.running) return resolve(false);
      const elapsed = now - state.startedAt;
      state.elapsed = elapsed;
      stage(stageForElapsed(elapsed));
      updateWake(elapsed);
      updateCondensation(elapsed);
      updateCamera(elapsed);
      if (elapsed >= 2200) return resolve(true);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  });

  const startTransitionToken = () => {
    if (!scene.transitions?.begin || scene.transitions.isLocked) return null;
    transitionToken = scene.transitions.begin({
      kind: 'intro-v2',
      fromRoute: 'atlas',
      toRoute: 'overview',
      trigger: 'first-session-intro'
    }, { supersede: false });
    return transitionToken;
  };

  const prepareAndRun = async () => {
    if (!state.eligible || state.running || finalising) return false;
    const generation = ++runGeneration;
    state.running = true;
    state.result = null;
    state.interrupted = false;
    state.targetRoute = null;
    state.startedAt = performance.now();
    document.documentElement.dataset.profileIntro = 'running';
    document.body.classList.add('is-profile-intro-v2');
    createSkip();
    bindInteractions();
    installParticipant();
    markSeen();

    const atlasReady = await internalRoute('atlas');
    if (!atlasReady || generation !== runGeneration || finalising) return false;
    const rendered = await waitFor(() =>
      document.body?.dataset.graphMode === 'atlas' &&
      document.querySelectorAll('#site-graph .site-graph-node[data-node-id]').length >= graph.nodes.length,
    5000);
    if (!rendered || generation !== runGeneration || finalising) return settleToLanding('fallback');

    await raf();
    await raf();
    window.ProfileAtlasLOD?.fit?.({ immediate: true });
    await raf();
    if (!buildRecords()) return settleToLanding('fallback');
    chooseWakeEdges();
    startTransitionToken();
    state.startedAt = performance.now();
    emit('started', { source: 'real-live-graph' });
    track('intro_started');

    if (reducedMotion) {
      await runReduced(generation);
      return true;
    }

    const completed = await runTimeline(generation);
    if (!completed || generation !== runGeneration || finalising) return false;
    await finalLandingReveal({ fast: false, reason: 'completed' });
    return true;
  };

  const buildLatentTopology = () => {
    const trigger = document.querySelector('[data-root-activate]');
    const dot = trigger?.querySelector('.root-node-dot');
    if (!trigger || !dot || trigger.querySelector('.phase-h-latent-topology')) return;
    const geometry = window.ProfileGeometry?.snapshot?.();
    const shell = document.createElement('span');
    shell.className = 'phase-h-latent-topology';
    shell.setAttribute('aria-hidden', 'true');
    sections.forEach(id => {
      const vector = geometry?.sections?.[id]?.vector;
      if (!vector) return;
      const stub = document.createElement('span');
      stub.className = 'phase-h-latent-stub';
      stub.dataset.section = id;
      stub.style.setProperty('--vx', String(vector.x));
      stub.style.setProperty('--vy', String(vector.y));
      const angle = Math.atan2(vector.y, vector.x) * 180 / Math.PI;
      stub.style.setProperty('--angle', `${angle}deg`);
      stub.style.setProperty('--inverse-angle', `${-angle}deg`);
      const label = document.createElement('span');
      label.className = 'phase-h-latent-label';
      label.textContent = nodeMap.get(id)?.label || id;
      stub.appendChild(label);
      shell.appendChild(stub);
    });
    dot.appendChild(shell);
  };

  const animateRootExpansion = async () => {
    if (document.body?.dataset.graphRoute !== 'overview' || document.body?.dataset.rootLanding === 'true') return false;
    await raf();
    await raf();
    const svg = document.querySelector('#site-graph .site-graph-svg');
    const root = svg?.querySelector(`.site-graph-node[data-node-id="${rootId}"]`);
    if (!svg || !root) return false;
    const rootPoint = pointOf(root);
    const records = sections.map(id => {
      const element = svg.querySelector(`.site-graph-node[data-node-id="${id}"]`);
      if (!element) return null;
      const origin = pointOf(element);
      const wrapper = wrapNode(element);
      const label = element.querySelector('.site-graph-label');
      const edge = svg.querySelector(`.site-graph-edges path[data-source="${rootId}"][data-target="${id}"]`) ||
        svg.querySelector(`.site-graph-edges path[data-source="${id}"][data-target="${rootId}"]`);
      let length = 0;
      try { length = edge?.getTotalLength?.() || 0; } catch (_) {}
      if (edge && length) {
        edge.style.setProperty('stroke-dasharray', `${length} ${length}`, 'important');
        edge.style.setProperty('stroke-dashoffset', String(length), 'important');
      }
      if (label) label.style.setProperty('opacity', '0', 'important');
      wrapper?.setAttribute('transform', `translate(${(rootPoint.x - origin.x).toFixed(2)} ${(rootPoint.y - origin.y).toFixed(2)}) scale(.56)`);
      return { id, element, wrapper, label, edge, length, origin };
    }).filter(Boolean);
    if (!records.length) return false;

    document.body.classList.add('is-phase-h-root-expanding');
    const started = performance.now();
    const duration = reducedMotion ? 120 : 520;
    await new Promise(resolve => {
      const tick = now => {
        const raw = clamp01((now - started) / duration);
        records.forEach((record, index) => {
          const local = clamp01((raw - index * .045) / Math.max(.6, 1 - index * .045));
          const q = ease(local);
          const dx = (rootPoint.x - record.origin.x) * (1 - q);
          const dy = (rootPoint.y - record.origin.y) * (1 - q);
          record.wrapper?.setAttribute('transform', `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) scale(${lerp(.56, 1, q).toFixed(4)})`);
          record.label?.style.setProperty('opacity', String(smooth(clamp01((local - .36) / .64))), 'important');
          if (record.edge && record.length) record.edge.style.setProperty('stroke-dashoffset', String(record.length * (1 - q)), 'important');
        });
        if (raw < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });

    records.forEach(record => {
      record.label?.style.removeProperty('opacity');
      if (record.edge) {
        record.edge.style.removeProperty('stroke-dasharray');
        record.edge.style.removeProperty('stroke-dashoffset');
      }
      unwrapNode(record.element);
    });
    document.body.classList.remove('is-phase-h-root-expanding');
    return true;
  };

  addEventListener('profile:root-landing', event => {
    if (event.detail?.active) requestAnimationFrame(buildLatentTopology);
  });
  addEventListener('profile:root-activated', () => {
    requestAnimationFrame(() => animateRootExpansion());
  });

  const replay = async () => {
    if (state.running || finalising) return false;
    if (normaliseRoute(document.body?.dataset.graphRoute || location.hash) !== 'overview') return false;
    replayRequested = true;
    window.ProfileRootLanding?.reset?.();
    state.eligible = true;
    state.result = null;
    state.stage = 'pending';
    await raf();
    return prepareAndRun();
  };

  function snapshot() {
    return {
      ...state,
      route: normaliseRoute(document.body?.dataset.graphRoute || location.hash),
      graphMode: document.body?.dataset.graphMode || null,
      rootLanding: document.body?.dataset.rootLanding === 'true',
      liveGraphPresent: Boolean(document.querySelector('#site-graph .site-graph-svg')),
      cloneOverlayPresent: Boolean(document.querySelector('.profile-intro-overlay')),
      sharedHandoffPresent: Boolean(sharedHandoff?.shell?.isConnected),
      transitionToken
    };
  }

  window.ProfileIntro = Object.freeze({
    __phaseH: true,
    skip: () => settleToLanding('skip'),
    replay,
    snapshot
  });

  if (!state.eligible) {
    document.documentElement.dataset.profileIntro = 'bypass';
    requestAnimationFrame(buildLatentTopology);
    return;
  }

  prepareAndRun();
})();
