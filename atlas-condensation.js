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

  const NORMAL = Object.freeze({
    acknowledge: 90,
    nodeDuration: 410,
    depthOverlap: 42,
    siblingStagger: 28,
    rootHold: 260,
    branchDuration: 760,
    branchStagger: 68
  });
  const REDUCED = Object.freeze({
    acknowledge: 20,
    nodeDuration: 92,
    depthOverlap: 12,
    siblingStagger: 4,
    rootHold: 30,
    branchDuration: 120,
    branchStagger: 8
  });

  const depth = new Map([[rootId, 0]]);
  let depthChanged = true;
  while (depthChanged) {
    depthChanged = false;
    graph.nodes.forEach(node => {
      if (node.id === rootId) return;
      const parents = (node.parentIds || []).map(id => depth.get(id)).filter(Number.isFinite);
      if (!parents.length) return;
      const next = Math.min(...parents) + 1;
      if (!depth.has(node.id) || next < depth.get(node.id)) {
        depth.set(node.id, next);
        depthChanged = true;
      }
    });
  }
  const maxDepth = Math.max(1, ...depth.values());

  const state = {
    state: STATES.IDLE,
    running: false,
    wave: null,
    waves: [],
    depthWave: null,
    depthWaves: [],
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
    initialTopologyMode: null,
    entryOwned: false,
    expectedNodeCount: Math.max(0, graph.nodes.length - 1),
    maxDepth,
    totalDuration: 0,
    reducedMotion: reducedMotion.matches
  };

  let frame = 0;
  let emergenceFrame = 0;
  let participantInstalled = false;
  let records = [];
  let edgeRecords = [];
  let emergenceRecords = [];
  let massNodes = new Set();
  let graphRoot = null;
  let status = null;

  const clamp01 = value => Math.max(0, Math.min(1, value));
  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
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
  const primaryParent = id => nodeMap.get(id)?.parentIds?.[0] || null;
  const semanticWave = value => value >= 4
    ? 'deep'
    : value === 3
      ? 'intermediate'
      : value === 2
        ? 'territories'
        : 'branches';
  const timing = () => reducedMotion.matches ? REDUCED : NORMAL;
  const emit = (type, detail = {}) => {
    state.sequence += 1;
    dispatchEvent(new CustomEvent('profile:atlas-condensation', {
      detail: { type, ...snapshot(), ...detail }
    }));
  };
  const track = name => { try { window.umami?.track?.(name); } catch (_) {} };

  const captureStyle = element => ({
    element,
    style: element?.getAttribute('style'),
    pathLength: element?.getAttribute('pathLength')
  });
  const restoreStyle = record => {
    const element = record?.element;
    if (!element?.isConnected) return;
    if (record.style == null) element.removeAttribute('style');
    else element.setAttribute('style', record.style);
    if ('pathLength' in record) {
      if (record.pathLength == null) element.removeAttribute('pathLength');
      else element.setAttribute('pathLength', record.pathLength);
    }
    delete element.dataset.condensePrimary;
    delete element.dataset.condenseContext;
  };

  const createMotionGroup = node => {
    let group = node.querySelector(':scope > .atlas-condense-motion');
    if (group) return group;
    const movable = [...node.children].filter(child => child.tagName?.toLowerCase() !== 'title');
    if (!movable.length) return null;
    group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('atlas-condense-motion');
    group.dataset.condenseMotion = 'true';
    node.insertBefore(group, movable[0]);
    movable.forEach(child => group.appendChild(child));
    return group;
  };

  const unwrap = record => {
    const { node, wrapper } = record;
    if (wrapper?.isConnected && wrapper.parentElement === node) {
      [...wrapper.children].forEach(child => node.insertBefore(child, wrapper));
      wrapper.remove();
    }
    delete node.dataset.condenseProgress;
    delete node.dataset.condenseWave;
    delete node.dataset.condenseDepth;
    node.classList.remove('is-condense-absorbed', 'is-condense-parent');
    node.style.removeProperty('--condense-parent-mass');
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

  const samplePrimaryPath = (edge, parentAtSource) => {
    if (!edge) return null;
    try {
      const length = edge.getTotalLength();
      if (!Number.isFinite(length) || length <= 0) return null;
      return Array.from({ length: 33 }, (_, index) => {
        const progress = index / 32;
        const distance = parentAtSource ? length * (1 - progress) : length * progress;
        const sample = edge.getPointAtLength(distance);
        return { x: sample.x, y: sample.y };
      });
    } catch (_) {
      return null;
    }
  };

  const prepareRecords = () => {
    const edges = liveEdges();
    const primaryEdges = new Set();
    const config = timing();
    const next = [];

    graph.nodes.forEach(model => {
      if (model.id === rootId) return;
      const node = liveNode(model.id);
      const parentId = primaryParent(model.id);
      const parent = parentId ? liveNode(parentId) : null;
      if (!node || !parent) return;
      const x = Number(node.dataset.x);
      const y = Number(node.dataset.y);
      const px = Number(parent.dataset.x);
      const py = Number(parent.dataset.y);
      if (![x, y, px, py].every(Number.isFinite)) return;

      const d = depth.get(model.id) ?? 1;
      const levelIndex = maxDepth - d;
      const levelStart = config.acknowledge + levelIndex * (config.nodeDuration - config.depthOverlap);
      const stagger = reducedMotion.matches ? 0 : stableNumber(`${d}:${model.id}`) % config.siblingStagger;
      const primary = findPrimaryEdge(parentId, model.id, edges);
      if (primary.edge) primaryEdges.add(primary.edge);
      const wrapper = createMotionGroup(node);
      if (!wrapper) return;

      next.push({
        id: model.id,
        node,
        parent,
        parentId,
        depth: d,
        wave: semanticWave(d),
        from: { x, y },
        to: { x: px, y: py },
        start: levelStart + stagger,
        duration: config.nodeDuration,
        wrapper,
        edge: primary.edge ? { ...captureStyle(primary.edge), parentAtSource: primary.parentAtSource } : null,
        pathSamples: samplePrimaryPath(primary.edge, primary.parentAtSource),
        progress: 0,
        absorbed: false
      });
    });

    edgeRecords = edges.map(captureStyle);
    records = next;
    state.nodeCount = next.length;
    state.primaryEdgeCount = primaryEdges.size;
    const latest = next.reduce((value, record) => Math.max(value, record.start + record.duration), 0);
    state.totalDuration = latest + 24;
    return next.length === state.expectedNodeCount;
  };

  const clearMass = () => {
    massNodes.forEach(node => {
      node.classList.remove('is-condense-parent');
      node.style.removeProperty('--condense-parent-mass');
    });
    massNodes = new Set();
  };

  const restoreTransient = ({ keepRootOnly = false } = {}) => {
    cancelAnimationFrame(frame);
    frame = 0;
    clearMass();
    records.forEach(unwrap);
    edgeRecords.forEach(restoreStyle);
    records = [];
    edgeRecords = [];
    if (!keepRootOnly) {
      document.body?.classList.remove(
        'is-atlas-condensing',
        'is-atlas-condensation-committing',
        'is-atlas-condensation-handoff',
        'is-atlas-condensation-root-only',
        'is-profile-root-pending-emergence',
        'is-entry-atlas-condensation'
      );
    }
    graphRoot?.removeAttribute('aria-busy');
    if (graphRoot) {
      delete graphRoot.dataset.condensationWave;
      delete graphRoot.dataset.condensationDepth;
    }
  };

  const applyPrimaryEdge = (record, progress) => {
    const edge = record.edge?.element;
    if (!edge?.isConnected) return;
    const remaining = Math.max(.0001, 1 - ease(progress));
    edge.dataset.condensePrimary = 'true';
    edge.setAttribute('pathLength', '1');
    if (record.edge.parentAtSource) {
      edge.style.strokeDasharray = `${remaining.toFixed(4)} 1`;
      edge.style.strokeDashoffset = '0';
    } else {
      edge.style.strokeDasharray = `${remaining.toFixed(4)} ${(1 - remaining).toFixed(4)}`;
      edge.style.strokeDashoffset = `${(1 - remaining).toFixed(4)}`;
    }
    edge.style.opacity = String(Math.max(0, Math.min(.9, remaining * .9)));
  };

  const applyRecord = (record, progress) => {
    const p = clamp01(progress);
    record.progress = p;
    record.node.dataset.condenseProgress = p.toFixed(4);
    record.node.dataset.condenseWave = record.wave;
    record.node.dataset.condenseDepth = String(record.depth);

    const physical = reducedMotion.matches ? p * .10 : ease(p);
    const samples = record.pathSamples;
    const sample = samples?.length
      ? samples[Math.min(samples.length - 1, Math.round(physical * (samples.length - 1)))]
      : null;
    const dx = sample ? sample.x - record.from.x : (record.to.x - record.from.x) * physical;
    const dy = sample ? sample.y - record.from.y : (record.to.y - record.from.y) * physical;
    const shrink = ease(clamp01((p - .58) / .42));
    const fade = ease(clamp01((p - .76) / .24));
    const scale = reducedMotion.matches ? 1 - .05 * shrink : 1 - .88 * shrink;
    const opacity = 1 - fade;

    record.wrapper.setAttribute('transform', `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) scale(${scale.toFixed(4)})`);
    record.wrapper.style.opacity = opacity.toFixed(4);
    applyPrimaryEdge(record, p);

    state.maxTravel = Math.max(state.maxTravel, Math.hypot(dx, dy));
    if (p >= .995 && !record.absorbed) {
      record.absorbed = true;
      record.node.classList.add('is-condense-absorbed');
    }
  };

  const applyContextEdges = globalProgress => {
    const progressById = new Map(records.map(record => [record.id, record.progress]));
    edgeRecords.forEach(record => {
      const edge = record.element;
      if (!edge?.isConnected || edge.dataset.condensePrimary === 'true') return;
      edge.dataset.condenseContext = 'true';
      const structural = HIERARCHY_TYPES.has(edge.dataset.type || '');
      const endpointProgress = Math.max(
        progressById.get(edge.dataset.source) || 0,
        progressById.get(edge.dataset.target) || 0
      );
      const fade = structural
        ? ease(clamp01(endpointProgress * 1.08))
        : ease(clamp01(globalProgress * 1.42));
      edge.style.opacity = String(Math.max(0, 1 - fade));
    });
  };

  const applyParentMass = () => {
    clearMass();
    const masses = new Map();
    records.forEach(record => {
      if (record.progress <= .20 || record.progress >= 1) return;
      const phase = clamp01((record.progress - .20) / .80);
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
    const byDepth = [...new Set(records.map(record => record.depth))].sort((a, b) => b - a);
    byDepth.forEach(d => {
      const start = Math.min(...records.filter(record => record.depth === d).map(record => record.start));
      if (elapsed < start || state.depthWaves.includes(d)) return;
      state.depthWaves.push(d);
      state.depthWave = d;
      const wave = semanticWave(d);
      if (!state.waves.includes(wave)) state.waves.push(wave);
      state.wave = wave;
      if (graphRoot) {
        graphRoot.dataset.condensationWave = wave;
        graphRoot.dataset.condensationDepth = String(d);
      }
      emit('wave', { wave, depth: d });
    });
  };

  const profileCompositionReady = () => {
    if (mode() !== 'overview' || document.body?.dataset.rootLanding !== 'false') return false;
    return sections.every(id => Boolean(liveNode(id)));
  };
  const waitForOverview = generation => new Promise(resolve => {
    const started = performance.now();
    const poll = () => {
      if (generation !== state.generation) return resolve(false);
      if (profileCompositionReady()) return resolve(true);
      if (performance.now() - started > 3600) return resolve(false);
      requestAnimationFrame(poll);
    };
    poll();
  });

  const createEmergenceGroup = node => {
    const movable = [...node.children].filter(child => child.tagName?.toLowerCase() !== 'title');
    if (!movable.length) return null;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('profile-root-emergence-motion');
    node.insertBefore(group, movable[0]);
    movable.forEach(child => group.appendChild(child));
    return group;
  };
  const restoreEmergence = record => {
    if (record.group?.isConnected && record.group.parentElement === record.node) {
      [...record.group.children].forEach(child => record.node.insertBefore(child, record.group));
      record.group.remove();
    }
    if (record.edgeRecord) restoreStyle(record.edgeRecord);
  };

  const animateProfileBranches = generation => new Promise(resolve => {
    const root = liveNode(rootId);
    const rootPoint = root ? { x: Number(root.dataset.x), y: Number(root.dataset.y) } : null;
    const edges = liveEdges();
    if (!rootPoint || ![rootPoint.x, rootPoint.y].every(Number.isFinite)) return resolve(false);

    const config = timing();
    const branchRecords = sections.map((id, index) => {
      const node = liveNode(id);
      const x = Number(node?.dataset.x);
      const y = Number(node?.dataset.y);
      const group = node ? createEmergenceGroup(node) : null;
      if (!node || !group || ![x, y].every(Number.isFinite)) return null;
      const edge = findPrimaryEdge(rootId, id, edges).edge;
      const edgeRecord = edge ? captureStyle(edge) : null;
      const dx = rootPoint.x - x;
      const dy = rootPoint.y - y;
      group.setAttribute('transform', `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) scale(.16)`);
      group.style.opacity = '0';
      if (edge) {
        edge.setAttribute('pathLength', '1');
        edge.style.strokeDasharray = '.0001 1';
        edge.style.strokeDashoffset = '0';
        edge.style.opacity = '0';
      }
      return { id, index, node, x, y, group, edge, edgeRecord };
    }).filter(Boolean);

    if (branchRecords.length !== sections.length) {
      branchRecords.forEach(restoreEmergence);
      return resolve(false);
    }
    emergenceRecords = branchRecords;

    document.body?.classList.add('is-profile-root-emerging');
    document.body?.classList.remove(
      'is-profile-root-pending-emergence',
      'is-atlas-condensation-root-only',
      'is-atlas-condensation-handoff'
    );

    if (reducedMotion.matches) {
      branchRecords.forEach(restoreEmergence);
      emergenceRecords = [];
      document.body?.classList.remove('is-profile-root-emerging');
      return resolve(true);
    }

    const started = performance.now();
    const total = config.branchDuration + config.branchStagger * (branchRecords.length - 1);
    const step = now => {
      emergenceFrame = 0;
      if (generation !== state.generation || !state.running) {
        branchRecords.forEach(restoreEmergence);
        emergenceRecords = [];
        document.body?.classList.remove('is-profile-root-emerging');
        return resolve(false);
      }
      const elapsed = now - started;
      branchRecords.forEach(record => {
        const raw = clamp01((elapsed - record.index * config.branchStagger) / config.branchDuration);
        const p = ease(raw);
        const dx = (rootPoint.x - record.x) * (1 - p);
        const dy = (rootPoint.y - record.y) * (1 - p);
        const scale = .16 + .84 * p;
        record.group.setAttribute('transform', `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) scale(${scale.toFixed(4)})`);
        record.group.style.opacity = String(ease(clamp01(raw / .60)));
        if (record.edge?.isConnected) {
          const ep = ease(clamp01((raw - .06) / .94));
          record.edge.style.strokeDasharray = `${Math.max(.0001, ep).toFixed(4)} 1`;
          record.edge.style.opacity = String(ep * .82);
        }
      });
      if (elapsed >= total) {
        branchRecords.forEach(restoreEmergence);
        emergenceRecords = [];
        document.body?.classList.remove('is-profile-root-emerging');
        resolve(true);
        return;
      }
      emergenceFrame = requestAnimationFrame(step);
    };
    emergenceFrame = requestAnimationFrame(step);
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
    if (!state.waves.includes('root')) state.waves.push('root');
    document.body?.classList.add(
      'is-atlas-condensation-committing',
      'is-atlas-condensation-handoff',
      'is-atlas-condensation-root-only',
      'is-profile-root-pending-emergence'
    );
    if (graphRoot) graphRoot.dataset.condensationWave = 'root';
    transitions.commit(state.token, { operation: 'CONDENSE', targetRoute: 'overview', wave: 'root' });
    emit('wave', { wave: 'root', depth: 0 });

    await wait(timing().rootHold);
    if (generation !== state.generation || !state.running) return false;

    window.__GRAPH_V6_FORCE_SNAP__ = true;
    window.ProfileRootLanding?.commitExpanded?.({
      focusGraph: false,
      animate: false,
      reason: 'atlas-condensation'
    });
    if (location.hash !== '#overview') location.hash = '#overview';
    else dispatchEvent(new HashChangeEvent('hashchange'));

    const routed = await waitForOverview(generation);
    if (generation !== state.generation || !state.running) return false;
    window.__GRAPH_V6_FORCE_SNAP__ = false;

    // Old Atlas records may now be detached. Restore/remove their temporary
    // wrappers while the pending-emergence guard keeps the new Overview at a
    // strict root-only visual state.
    restoreTransient({ keepRootOnly: true });
    if (document.body) {
      document.body.dataset.entryState = 'profile';
      document.body.dataset.rootEntry = 'profile';
    }
    window.ProfileRootEntryPortal?.releaseEntry?.({ keepOpen: false, reason: 'atlas-condensation:profile-handoff' });
    window.ProfileNodeDynamics?.resume?.('atlas-condensation');

    await animateProfileBranches(generation);
    if (generation !== state.generation || !state.running) return false;

    document.body?.classList.remove(
      'is-atlas-condensing',
      'is-atlas-condensation-committing',
      'is-atlas-condensation-handoff',
      'is-atlas-condensation-root-only',
      'is-profile-root-pending-emergence',
      'is-entry-atlas-condensation'
    );
    graphRoot?.removeAttribute('aria-busy');
    window.ProfileHaloRenderer?.refresh?.();

    state.running = false;
    state.state = STATES.COMPLETE;
    state.completedAt = performance.now();
    state.elapsed = state.completedAt - state.startedAt;
    state.progress = 1;
    state.lastResult = routed ? 'completed' : 'fallback';
    state.lastReason = state.lastResult;
    transitions.finish(state.token, {
      operation: 'CONDENSE',
      result: state.lastResult,
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
    const elapsed = now - state.startedAt;
    state.elapsed = elapsed;
    state.progress = clamp01(elapsed / Math.max(1, state.totalDuration));
    noteWaves(elapsed);

    let absorbed = 0;
    records.forEach(record => {
      const progress = (elapsed - record.start) / record.duration;
      applyRecord(record, progress);
      if (record.progress >= .995) absorbed += 1;
    });
    state.absorbedCount = absorbed;
    applyContextEdges(state.progress);
    applyParentMass();

    if (absorbed >= records.length || elapsed >= state.totalDuration) {
      commitProfile(state.generation);
      return;
    }
    frame = requestAnimationFrame(tick);
  };

  const restoreAtlasCamera = () => {
    if (!state.initialCamera || mode() !== 'atlas') return;
    window.ProfileAtlasLOD?.setScale?.(state.initialCamera.scale, { immediate: true, preserveTopology: true });
    window.ProfileAtlasLOD?.panTo?.(state.initialCamera.x, state.initialCamera.y, { immediate: true, preserveTopology: true });
    window.ProfileAtlasLOD?.setTopologyMode?.('entry-full', { reason: 'condensation-restore' });
    window.ProfileAtlasLOD?.applyLOD?.(state.initialCamera.scale);
  };

  const cancelFromCoordinator = payload => {
    if (!state.running) return false;
    const reason = payload?.reason || 'transition-cancel';
    state.generation += 1;
    cancelAnimationFrame(frame);
    cancelAnimationFrame(emergenceFrame);
    frame = 0;
    emergenceFrame = 0;
    emergenceRecords.forEach(restoreEmergence);
    emergenceRecords = [];
    restoreTransient();
    window.__GRAPH_V6_FORCE_SNAP__ = false;

    if (location.hash !== '#atlas') location.hash = '#atlas';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      restoreAtlasCamera();
      window.ProfileRootEntryPortal?.releaseEntry?.({ keepOpen: true, reason: 'atlas-condensation:cancelled-restored' });
      window.ProfileNodeDynamics?.resume?.('atlas-condensation');
    }));

    state.running = false;
    state.state = STATES.CANCELLED;
    state.completedAt = performance.now();
    state.elapsed = state.startedAt ? state.completedAt - state.startedAt : 0;
    state.lastResult = 'cancelled';
    state.lastReason = reason;
    state.token = null;
    emit('cancelled', { reason, targetRoute: payload?.targetRoute || 'atlas' });
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
    state.depthWave = null;
    state.depthWaves = [];
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
    state.initialTopologyMode = window.ProfileAtlasLOD?.snapshot?.().topologyMode || null;
    state.entryOwned = document.body?.dataset.entryState === 'ready' && document.documentElement.dataset.profileIntro === 'ready';

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

    document.body.classList.add('is-atlas-condensing', 'is-root-entry-committing');
    document.body.classList.toggle('is-entry-atlas-condensation', state.entryOwned);
    document.body.dataset.entryState = 'condensing';
    document.body.dataset.rootEntry = 'committing';
    graphRoot.setAttribute('aria-busy', 'true');
    if (status) status.textContent = 'Folding the Atlas into the profile root.';
    window.ProfileNodeDynamics?.suspend?.('atlas-condensation');
    window.ProfileCameraMateriality?.reset?.();
    window.ProfileAtlasLOD?.setTopologyMode?.('entry-full', { reason: 'condensation-start' });
    const visibleScale = state.initialCamera?.scale;
    if (Number.isFinite(visibleScale)) window.ProfileAtlasLOD?.applyLOD?.(visibleScale);

    if (!prepareRecords()) {
      transitions.cancel(token, { reason: 'condensation-preparation-failed', targetRoute: 'atlas' });
      return false;
    }

    state.state = STATES.CONDENSING;
    state.startedAt = performance.now();
    transitions.prepare(token, {
      operation: 'CONDENSE',
      nodeCount: state.nodeCount,
      maxDepth: state.maxDepth,
      hierarchy: 'strict-bottom-up'
    });
    emit('started', { nodeCount: state.nodeCount, primaryEdgeCount: state.primaryEdgeCount, maxDepth });
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
  reducedMotion.addEventListener?.('change', () => { state.reducedMotion = reducedMotion.matches; });

  function snapshot() {
    return {
      ...state,
      timing: { ...timing() },
      mode: mode(),
      rootPresent: Boolean(liveNode(rootId)),
      rootMaterial: liveNode(rootId)?.dataset.rootEntryMaterial || null,
      wrapperCount: document.querySelectorAll('#site-graph .atlas-condense-motion').length,
      emergenceCount: document.querySelectorAll('#site-graph .profile-root-emergence-motion').length,
      activePrimaryEdges: document.querySelectorAll('#site-graph [data-condense-primary="true"]').length,
      activeContextEdges: document.querySelectorAll('#site-graph [data-condense-context="true"]').length,
      rootOnly: document.body?.classList.contains('is-atlas-condensation-root-only') || false,
      pendingEmergence: document.body?.classList.contains('is-profile-root-pending-emergence') || false,
      sectionsPresent: sections.filter(id => Boolean(liveNode(id)))
    };
  }

  window.ProfileAtlasCondensation = Object.freeze({ STATES, start, cancel, snapshot });
  installParticipant();
  dispatchEvent(new CustomEvent('profile:atlas-condensation-ready', { detail: snapshot() }));
})();