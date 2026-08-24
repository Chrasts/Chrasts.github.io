(() => {
  if (window.ProfileAtlasCondensation) return;

  const graph = window.SITE_DATA?.graph;
  const scene = window.ProfileScene;
  const transitions = scene?.transitions;
  const geometry = window.ProfileGeometry;
  if (!graph?.nodes?.length || !transitions || !geometry?.__profileCompassV3) return;

  const rootId = graph.rootId || 'stepan-chrast';
  const sections = ['work', 'knowledge', 'experience', 'education', 'about'];
  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const HIERARCHY_TYPES = new Set(['hierarchy', 'hierarchy-alt', 'work-lattice']);
  const STATES = Object.freeze({
    IDLE: 'IDLE',
    PREPARING: 'PREPARING',
    CONDENSING: 'CONDENSING',
    COMMITTING: 'COMMITTING',
    COMPLETE: 'COMPLETE',
    CANCELLED: 'CANCELLED'
  });

  const NORMAL_TIMING = Object.freeze({
    deep: 90,
    intermediate: 285,
    territories: 470,
    branches: 675,
    durationDeep: 590,
    durationIntermediate: 565,
    durationTerritories: 540,
    durationBranches: 610,
    total: 1360
  });
  const REDUCED_TIMING = Object.freeze({
    deep: 0,
    intermediate: 34,
    territories: 68,
    branches: 102,
    durationDeep: 125,
    durationIntermediate: 115,
    durationTerritories: 105,
    durationBranches: 115,
    total: 265
  });

  const state = {
    state: STATES.IDLE,
    running: false,
    wave: null,
    waves: [],
    sequence: 0,
    generation: 0,
    token: null,
    source: null,
    startedAt: 0,
    completedAt: 0,
    elapsed: 0,
    progress: 0,
    absorbedCount: 0,
    nodeCount: 0,
    primaryEdgeCount: 0,
    parentMassPeak: 0,
    maxTravel: 0,
    lastResult: null,
    lastReason: null,
    initialCamera: null,
    reducedMotion: reducedMotion.matches
  };

  const depth = new Map([[rootId, 0]]);
  let depthChanged = true;
  while (depthChanged) {
    depthChanged = false;
    graph.nodes.forEach(node => {
      if (node.id === rootId) return;
      const parentDepths = (node.parentIds || []).map(id => depth.get(id)).filter(Number.isFinite);
      if (!parentDepths.length) return;
      const next = Math.min(...parentDepths) + 1;
      if (!depth.has(node.id) || next < depth.get(node.id)) {
        depth.set(node.id, next);
        depthChanged = true;
      }
    });
  }

  let frame = 0;
  let participantInstalled = false;
  let records = [];
  let edgeRecords = [];
  let massNodes = new Set();
  let graphRoot = null;
  let status = null;

  const clamp01 = value => Math.max(0, Math.min(1, value));
  const ease = value => {
    const t = clamp01(value);
    return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  const stableNumber = value => {
    let number = 2166136261;
    for (const character of String(value)) number = Math.imul(number ^ character.charCodeAt(0), 16777619);
    return number >>> 0;
  };
  const mode = () => document.body?.dataset.graphMode || null;
  const liveNode = id => [...document.querySelectorAll(`#site-graph .site-graph-node[data-node-id="${CSS.escape(id)}"]`)]
    .find(node => !node.closest('.v9-transition-overlay')) || null;
  const liveEdges = () => [...document.querySelectorAll('#site-graph .site-graph-edges path[data-source][data-target]')]
    .filter(edge => !edge.closest('.v9-transition-overlay'));
  const point = id => geometry.atlasPoint?.(id) || (() => {
    const node = liveNode(id);
    return node ? { x: Number(node.dataset.x), y: Number(node.dataset.y) } : null;
  })();
  const primaryParent = id => nodeMap.get(id)?.parentIds?.[0] || null;
  const waveForDepth = value => value >= 4
    ? 'deep'
    : value === 3
      ? 'intermediate'
      : value === 2
        ? 'territories'
        : 'branches';
  const timingFor = wave => {
    const timing = reducedMotion.matches ? REDUCED_TIMING : NORMAL_TIMING;
    return {
      start: timing[wave],
      duration: timing[`duration${wave[0].toUpperCase()}${wave.slice(1)}`]
    };
  };
  const emit = (type, detail = {}) => {
    state.sequence += 1;
    dispatchEvent(new CustomEvent('profile:atlas-condensation', {
      detail: { type, ...snapshot(), ...detail }
    }));
  };
  const track = name => { try { window.umami?.track?.(name); } catch (_) {} };

  const createMotionGroup = node => {
    let group = node.querySelector(':scope > .atlas-condense-motion');
    if (group) return group;
    const movable = [...node.children].filter(child => child.matches?.(
      '.site-graph-hit,.site-graph-dot,.site-graph-label,.site-graph-meta'
    ));
    if (!movable.length) return null;
    group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('atlas-condense-motion');
    group.dataset.condenseMotion = 'true';
    node.insertBefore(group, movable[0]);
    movable.forEach(child => group.appendChild(child));
    return group;
  };

  const findPrimaryEdge = (parentId, childId, edges) => {
    const exact = edges.find(edge =>
      HIERARCHY_TYPES.has(edge.dataset.type || '') &&
      edge.dataset.source === parentId && edge.dataset.target === childId
    );
    if (exact) return { edge: exact, parentAtSource: true };
    const reverse = edges.find(edge =>
      HIERARCHY_TYPES.has(edge.dataset.type || '') &&
      edge.dataset.source === childId && edge.dataset.target === parentId
    );
    return reverse ? { edge: reverse, parentAtSource: false } : { edge: null, parentAtSource: false };
  };

  const captureEdge = edge => ({
    edge,
    style: edge?.getAttribute('style'),
    pathLength: edge?.getAttribute('pathLength'),
    condensed: false
  });

  const prepareRecords = () => {
    const edges = liveEdges();
    const primaryEdges = new Set();
    const nextRecords = [];

    graph.nodes.forEach(model => {
      if (model.id === rootId) return;
      const node = liveNode(model.id);
      const parentId = primaryParent(model.id);
      const parent = parentId ? liveNode(parentId) : null;
      const from = point(model.id);
      const to = parentId ? point(parentId) : null;
      if (!node || !parent || !from || !to) return;

      const d = depth.get(model.id) ?? 1;
      const wave = waveForDepth(d);
      const timing = timingFor(wave);
      const stagger = reducedMotion.matches ? 0 : stableNumber(`${wave}:${model.id}`) % 92;
      const primary = findPrimaryEdge(parentId, model.id, edges);
      if (primary.edge) primaryEdges.add(primary.edge);
      const wrapper = createMotionGroup(node);
      if (!wrapper) return;

      nextRecords.push({
        id: model.id,
        node,
        parentId,
        parent,
        from,
        to,
        depth: d,
        wave,
        start: timing.start + stagger,
        duration: timing.duration,
        wrapper,
        halos: [...node.querySelectorAll(':scope > .site-graph-halo')].map(halo => ({
          halo,
          style: halo.getAttribute('style')
        })),
        edge: primary.edge ? captureEdge(primary.edge) : null,
        parentAtSource: primary.parentAtSource,
        progress: 0,
        absorbed: false
      });
    });

    edgeRecords = edges.map(captureEdge);
    records = nextRecords;
    state.nodeCount = records.length;
    state.primaryEdgeCount = primaryEdges.size;
    return records.length > 0;
  };

  const restoreEdgeRecord = record => {
    if (!record?.edge?.isConnected) return;
    if (record.style == null) record.edge.removeAttribute('style');
    else record.edge.setAttribute('style', record.style);
    if (record.pathLength == null) record.edge.removeAttribute('pathLength');
    else record.edge.setAttribute('pathLength', record.pathLength);
    delete record.edge.dataset.condensePrimary;
    delete record.edge.dataset.condenseContext;
  };

  const unwrapRecord = record => {
    const { node, wrapper } = record;
    if (wrapper?.isConnected && wrapper.parentElement === node) {
      [...wrapper.children].forEach(child => node.insertBefore(child, wrapper));
      wrapper.remove();
    }
    delete node.dataset.condenseProgress;
    delete node.dataset.condenseWave;
    node.classList.remove('is-condense-absorbed', 'is-condense-parent');
    node.style.removeProperty('--condense-parent-mass');
    record.halos.forEach(({ halo, style }) => {
      if (!halo?.isConnected) return;
      if (style == null) halo.removeAttribute('style');
      else halo.setAttribute('style', style);
    });
  };

  const clearMass = () => {
    massNodes.forEach(node => {
      node.classList.remove('is-condense-parent');
      node.style.removeProperty('--condense-parent-mass');
    });
    massNodes = new Set();
  };

  const cleanup = ({ result = 'cleanup', keepPortal = false, restoreCamera = false } = {}) => {
    cancelAnimationFrame(frame);
    frame = 0;
    clearMass();
    records.forEach(unwrapRecord);
    edgeRecords.forEach(restoreEdgeRecord);
    records = [];
    edgeRecords = [];
    document.body?.classList.remove('is-atlas-condensing', 'is-atlas-condensation-committing');
    if (graphRoot) {
      graphRoot.removeAttribute('aria-busy');
      delete graphRoot.dataset.condensationWave;
    }
    if (restoreCamera && state.initialCamera && mode() === 'atlas') {
      window.ProfileAtlasLOD?.setScale?.(state.initialCamera.scale, { immediate: true });
      window.ProfileAtlasLOD?.panTo?.(state.initialCamera.x, state.initialCamera.y, { immediate: true });
      window.ProfileAtlasLOD?.applyLOD?.(state.initialCamera.scale);
    } else if (mode() === 'atlas') {
      const scale = window.ProfileAtlasLOD?.snapshot?.().camera?.scale;
      if (Number.isFinite(scale)) window.ProfileAtlasLOD?.applyLOD?.(scale);
    }
    window.ProfileRootEntryPortal?.releaseEntry?.({ keepOpen: keepPortal && mode() === 'atlas', reason: `atlas-condensation:${result}` });
    state.running = false;
    state.lastResult = result;
    state.lastReason = result;
  };

  const applyPrimaryEdge = (record, progress, lateOpacity) => {
    const edgeRecord = record.edge;
    const edge = edgeRecord?.edge;
    if (!edge?.isConnected) return;
    edge.dataset.condensePrimary = 'true';
    edge.setAttribute('pathLength', '1');
    if (record.parentAtSource) {
      const remaining = Math.max(.001, 1 - ease(progress));
      edge.style.strokeDasharray = `${remaining.toFixed(4)} 1`;
      edge.style.strokeDashoffset = '0';
      edgeRecord.condensed = true;
    } else {
      // Reversed structural paths are uncommon; preserve semantic visibility
      // and fade them late rather than pretending the wrong endpoint retracts.
      edge.style.strokeDasharray = '1 0';
    }
    edge.style.opacity = String(Math.max(.08, 1 - lateOpacity * .68));
  };

  const applyRecord = (record, progress) => {
    const p = clamp01(progress);
    record.progress = p;
    record.node.dataset.condenseProgress = p.toFixed(4);
    record.node.dataset.condenseWave = record.wave;

    const travelFactor = reducedMotion.matches ? .075 : 1;
    const movement = ease(clamp01(p / .96)) * travelFactor;
    const dx = (record.to.x - record.from.x) * movement;
    const dy = (record.to.y - record.from.y) * movement;
    const scalePhase = ease(clamp01((p - .44) / .56));
    const opacityPhase = ease(clamp01((p - .64) / .36));
    const scale = reducedMotion.matches ? 1 - .06 * scalePhase : 1 - .82 * scalePhase;
    const opacity = 1 - opacityPhase;

    record.wrapper.setAttribute(
      'transform',
      `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) scale(${scale.toFixed(4)})`
    );
    record.wrapper.style.opacity = opacity.toFixed(4);
    record.halos.forEach(({ halo }) => {
      halo.style.setProperty('opacity', String(Math.max(0, 1 - ease(clamp01((p - .18) / .72)))), 'important');
      halo.style.setProperty('transform', `scale(${Math.max(.58, 1 - p * .34).toFixed(4)})`, 'important');
    });
    applyPrimaryEdge(record, p, opacityPhase);

    const travel = Math.hypot(dx, dy);
    state.maxTravel = Math.max(state.maxTravel, travel);
    if (p >= .985 && !record.absorbed) {
      record.absorbed = true;
      record.node.classList.add('is-condense-absorbed');
    }
  };

  const applyContextEdges = globalProgress => {
    const fade = ease(clamp01(globalProgress * 1.28));
    edgeRecords.forEach(record => {
      const edge = record.edge;
      if (!edge?.isConnected || edge.dataset.condensePrimary === 'true') return;
      edge.dataset.condenseContext = 'true';
      const hierarchy = HIERARCHY_TYPES.has(edge.dataset.type || '');
      edge.style.opacity = String(hierarchy ? Math.max(.18, 1 - fade * .72) : Math.max(.04, 1 - fade * .94));
    });
  };

  const applyParentMass = () => {
    clearMass();
    const masses = new Map();
    records.forEach(record => {
      const phase = clamp01((record.progress - .34) / .66);
      if (phase <= 0 || phase >= 1) return;
      const pulse = Math.sin(Math.PI * phase);
      masses.set(record.parentId, (masses.get(record.parentId) || 0) + pulse);
    });
    masses.forEach((raw, id) => {
      const node = liveNode(id);
      if (!node) return;
      const mass = Math.min(1, Math.sqrt(raw) * .58);
      node.classList.add('is-condense-parent');
      node.style.setProperty('--condense-parent-mass', mass.toFixed(4));
      massNodes.add(node);
      state.parentMassPeak = Math.max(state.parentMassPeak, mass);
    });
  };

  const noteWaves = elapsed => {
    const timing = reducedMotion.matches ? REDUCED_TIMING : NORMAL_TIMING;
    ['deep', 'intermediate', 'territories', 'branches'].forEach(wave => {
      if (elapsed < timing[wave] || state.waves.includes(wave)) return;
      state.waves.push(wave);
      state.wave = wave;
      if (graphRoot) graphRoot.dataset.condensationWave = wave;
      emit('wave', { wave });
    });
  };

  const waitForOverview = generation => new Promise(resolve => {
    const started = performance.now();
    const check = () => {
      if (generation !== state.generation) return resolve(false);
      if (mode() === 'overview' && document.body?.dataset.rootLanding === 'false') return resolve(true);
      if (performance.now() - started > 2600) return resolve(false);
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });

  const focusRoot = () => requestAnimationFrame(() => requestAnimationFrame(() => {
    liveNode(rootId)?.focus?.({ preventScroll: true });
  }));

  const commitProfile = async generation => {
    if (generation !== state.generation || !state.running) return false;
    cancelAnimationFrame(frame);
    frame = 0;
    state.state = STATES.COMMITTING;
    state.wave = 'root';
    state.waves.push('root');
    document.body?.classList.add('is-atlas-condensation-committing');
    if (graphRoot) graphRoot.dataset.condensationWave = 'root';
    transitions.commit(state.token, { operation: 'CONDENSE', targetRoute: 'overview', wave: 'root' });
    emit('wave', { wave: 'root' });

    window.ProfileRootLanding?.commitExpanded?.({
      focusGraph: false,
      animate: false,
      reason: 'atlas-condensation'
    });
    if (location.hash !== '#overview') location.hash = '#overview';
    else dispatchEvent(new HashChangeEvent('hashchange'));

    const routed = await waitForOverview(generation);
    if (generation !== state.generation || !state.running) return false;
    // site-graph owns the global Atlas→Overview RECOMPOSE. Keep absorbed
    // material hidden until its canonical outer-node transition has settled.
    if (routed && !reducedMotion.matches) await new Promise(resolve => setTimeout(resolve, 510));
    if (generation !== state.generation || !state.running) return false;

    cleanup({ result: routed ? 'completed' : 'fallback', keepPortal: false, restoreCamera: false });
    state.state = STATES.COMPLETE;
    state.completedAt = performance.now();
    state.elapsed = state.completedAt - state.startedAt;
    transitions.finish(state.token, {
      operation: 'CONDENSE',
      result: routed ? 'completed' : 'fallback',
      targetRoute: 'overview'
    });
    state.token = null;
    if (status) status.textContent = 'Profile overview open. Choose Work, Knowledge, Experience, Education or About.';
    focusRoot();
    emit('completed', { result: state.lastResult });
    dispatchEvent(new CustomEvent('profile:atlas-condensation-complete', { detail: snapshot() }));
    track('atlas_condensation_completed');
    return routed;
  };

  const tick = now => {
    frame = 0;
    if (!state.running || state.state !== STATES.CONDENSING) return;
    const timing = reducedMotion.matches ? REDUCED_TIMING : NORMAL_TIMING;
    const elapsed = now - state.startedAt;
    state.elapsed = elapsed;
    state.progress = clamp01(elapsed / timing.total);
    noteWaves(elapsed);

    let absorbed = 0;
    records.forEach(record => {
      const progress = (elapsed - record.start) / record.duration;
      applyRecord(record, progress);
      if (record.progress >= .985) absorbed += 1;
    });
    state.absorbedCount = absorbed;
    applyContextEdges(state.progress);
    applyParentMass();

    if (elapsed >= timing.total) {
      commitProfile(state.generation);
      return;
    }
    frame = requestAnimationFrame(tick);
  };

  const cancelFromCoordinator = payload => {
    if (!state.running) return false;
    const targetRoute = payload?.targetRoute || null;
    state.generation += 1;
    cancelAnimationFrame(frame);
    frame = 0;
    const keepPortal = !targetRoute || targetRoute === 'atlas';
    cleanup({ result: 'cancelled', keepPortal, restoreCamera: keepPortal });
    state.state = STATES.CANCELLED;
    state.completedAt = performance.now();
    state.elapsed = state.startedAt ? state.completedAt - state.startedAt : 0;
    state.token = null;
    if (status && keepPortal) status.textContent = 'Atlas restored. Enter profile when ready.';
    emit('cancelled', { reason: payload?.reason || 'transition-cancel', targetRoute });
    return true;
  };

  const installParticipant = () => {
    if (participantInstalled) return true;
    transitions.registerParticipant('atlas-condensation-v31', {
      capture: () => state.running ? snapshot() : null,
      cancel: payload => cancelFromCoordinator(payload)
    });
    participantInstalled = true;
    return true;
  };

  const start = ({ source = 'root-entry', rootId: requestedRoot = rootId } = {}) => {
    if (state.running || mode() !== 'atlas' || requestedRoot !== rootId) return false;
    installParticipant();
    graphRoot = document.querySelector('#site-graph');
    status = document.querySelector('#site-graph-status');
    if (!graphRoot) return false;

    const generation = ++state.generation;
    state.state = STATES.PREPARING;
    state.running = true;
    state.wave = null;
    state.waves = [];
    state.source = source;
    state.startedAt = performance.now();
    state.completedAt = 0;
    state.elapsed = 0;
    state.progress = 0;
    state.absorbedCount = 0;
    state.nodeCount = 0;
    state.primaryEdgeCount = 0;
    state.parentMassPeak = 0;
    state.maxTravel = 0;
    state.lastResult = null;
    state.lastReason = null;
    state.reducedMotion = reducedMotion.matches;
    state.initialCamera = window.ProfileAtlasLOD?.snapshot?.().camera || null;

    const token = transitions.begin({
      operation: 'CONDENSE',
      source,
      fromRoute: 'atlas',
      targetRoute: 'overview',
      rootId
    }, { reason: 'atlas-condensation' });
    if (!token) {
      state.running = false;
      state.state = STATES.IDLE;
      return false;
    }
    state.token = token;

    document.body.classList.add('is-atlas-condensing');
    graphRoot.setAttribute('aria-busy', 'true');
    if (status) status.textContent = 'Compressing the Atlas into the profile overview.';
    window.ProfileNodeDynamics?.suspend?.('atlas-condensation');
    window.ProfileCameraMateriality?.reset?.();
    window.ProfileAtlasLOD?.applyLOD?.(.94);
    window.ProfileAtlasLOD?.setScale?.(.94, { immediate: reducedMotion.matches });

    if (!prepareRecords()) {
      transitions.cancel(token, { reason: 'condensation-preparation-failed' });
      return false;
    }

    state.state = STATES.CONDENSING;
    state.startedAt = performance.now();
    transitions.prepare(token, { operation: 'CONDENSE', nodeCount: state.nodeCount });
    emit('started', { nodeCount: state.nodeCount, primaryEdgeCount: state.primaryEdgeCount });
    track('atlas_condensation_started');
    frame = requestAnimationFrame(tick);
    return true;
  };

  const cancel = (reason = 'api-cancel') => {
    if (!state.running || !state.token) return false;
    return transitions.cancel(state.token, { reason, targetRoute: 'atlas' });
  };

  const onEntryRequest = event => {
    if (mode() !== 'atlas' || state.running) return;
    event.preventDefault();
    start(event.detail || {});
  };

  addEventListener('profile:enter-profile-request', onEntryRequest);
  addEventListener('keydown', event => {
    if (!state.running || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    cancel('escape');
  }, true);
  reducedMotion.addEventListener?.('change', () => {
    state.reducedMotion = reducedMotion.matches;
  });

  function snapshot() {
    return {
      ...state,
      timing: { ...(reducedMotion.matches ? REDUCED_TIMING : NORMAL_TIMING) },
      mode: mode(),
      rootPresent: Boolean(liveNode(rootId)),
      rootMaterial: liveNode(rootId)?.dataset.rootEntryMaterial || null,
      wrapperCount: document.querySelectorAll('#site-graph .atlas-condense-motion').length,
      activePrimaryEdges: document.querySelectorAll('#site-graph [data-condense-primary="true"]').length,
      activeContextEdges: document.querySelectorAll('#site-graph [data-condense-context="true"]').length,
      sectionsPresent: sections.filter(id => Boolean(liveNode(id)))
    };
  }

  window.ProfileAtlasCondensation = Object.freeze({
    STATES,
    start,
    cancel,
    snapshot
  });

  installParticipant();
  dispatchEvent(new CustomEvent('profile:atlas-condensation-ready', { detail: snapshot() }));
})();
