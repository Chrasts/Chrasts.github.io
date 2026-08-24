(() => {
  if (window.ProfileCameraMateriality) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const DEPTH = Object.freeze({
    BACKGROUND: 'DEPTH_BACKGROUND',
    GRAPH_BASE: 'DEPTH_GRAPH_BASE',
    GRAPH_ACTIVE: 'DEPTH_GRAPH_ACTIVE',
    SCENE_OBJECT: 'DEPTH_SCENE_OBJECT',
    SCENE_ACTIVE: 'DEPTH_SCENE_ACTIVE',
    FOCUS: 'DEPTH_FOCUS',
    HUD: 'DEPTH_HUD'
  });
  const MOTION = Object.freeze({
    FIT: 'FIT',
    FOCUS: 'FOCUS',
    FOLLOW: 'FOLLOW',
    PUSH: 'PUSH',
    PULL: 'PULL',
    MAKE_ROOM: 'MAKE_ROOM',
    INSPECT: 'INSPECT',
    PEEK: 'PEEK',
    RETURN: 'RETURN'
  });
  const PROFILES = Object.freeze({
    FIT: Object.freeze({ impulse: -.48, hold: 86, duration: 520, maxPan: 3.4, stiffness: 72, damping: 13.8 }),
    FOCUS: Object.freeze({ impulse: .62, hold: 105, duration: 590, maxPan: 4.5, stiffness: 78, damping: 14.1 }),
    FOLLOW: Object.freeze({ impulse: .28, hold: 82, duration: 500, maxPan: 5.2, stiffness: 75, damping: 14.8 }),
    PUSH: Object.freeze({ impulse: .86, hold: 118, duration: 650, maxPan: 4.8, stiffness: 80, damping: 13.6 }),
    PULL: Object.freeze({ impulse: -.78, hold: 108, duration: 620, maxPan: 4.4, stiffness: 78, damping: 13.9 }),
    MAKE_ROOM: Object.freeze({ impulse: .34, hold: 78, duration: 470, maxPan: 3.2, stiffness: 82, damping: 15.4 }),
    INSPECT: Object.freeze({ impulse: .74, hold: 112, duration: 620, maxPan: 4.4, stiffness: 80, damping: 13.8 }),
    PEEK: Object.freeze({ impulse: .18, hold: 54, duration: 330, maxPan: 1.8, stiffness: 88, damping: 17.2 }),
    RETURN: Object.freeze({ impulse: -.58, hold: 92, duration: 540, maxPan: 3.6, stiffness: 78, damping: 14.3 })
  });

  const PRESET_TO_MOTION = Object.freeze({
    MAKE_ROOM: MOTION.MAKE_ROOM,
    INSPECT: MOTION.INSPECT,
    PEEK: MOTION.PEEK,
    RETURN: MOTION.RETURN
  });

  let base = null;
  let graphRoot = null;
  let svg = null;
  let edges = null;
  let decorations = null;
  let nodes = null;
  let frame = 0;
  let bootFrame = 0;
  let bootAttempts = 0;
  let mutationObserver = null;
  let pendingSemantic = null;
  let lastCameraSample = null;
  let lastTime = 0;

  const state = {
    sequence: 0,
    token: 0,
    action: 'IDLE',
    lastAction: null,
    phase: 'idle',
    source: null,
    nodeId: null,
    pulse: 0,
    pulseVelocity: 0,
    pulseTarget: 0,
    panX: 0,
    panY: 0,
    panTargetX: 0,
    panTargetY: 0,
    releaseAt: 0,
    deadline: 0,
    startedAt: 0,
    completedAt: 0,
    cameraAdapter: null,
    cameraSamples: 0,
    retargets: 0
  };

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const copy = value => typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
  const introOwnsMotion = () => ['pending', 'running'].includes(document.documentElement.dataset.profileIntro || '');
  const structuralOwnsMotion = () => Boolean(
    document.body?.classList.contains('is-v9-transitioning') ||
    document.body?.classList.contains('is-crosslink-travelling') ||
    document.body?.classList.contains('is-atlas-handoff')
  );
  const profileFor = action => PROFILES[action] || PROFILES.FOCUS;

  const assignDepthChannels = () => {
    graphRoot = document.querySelector('#site-graph');
    svg = graphRoot?.querySelector('.site-graph-svg') || null;
    edges = svg?.querySelector(':scope > g > .site-graph-edges') || null;
    decorations = svg?.querySelector(':scope > g > .site-graph-decorations') || null;
    nodes = svg?.querySelector(':scope > g > .site-graph-nodes') || null;
    if (!graphRoot || !svg || !edges || !decorations || !nodes) return false;

    graphRoot.dataset.camera25d = 'ready';
    edges.dataset.depthChannel = DEPTH.BACKGROUND;
    decorations.dataset.depthChannel = DEPTH.GRAPH_BASE;
    nodes.dataset.depthChannel = DEPTH.GRAPH_BASE;

    graphRoot.querySelectorAll('.site-graph-node[data-node-id]').forEach(node => {
      const active = node.classList.contains('is-selected') ||
        node.classList.contains('is-previewed') ||
        node.classList.contains('is-feel-origin') ||
        node.matches(':focus-visible');
      node.dataset.depthChannel = active ? DEPTH.GRAPH_ACTIVE : DEPTH.GRAPH_BASE;
      node.querySelectorAll('.site-graph-halo-ring').forEach(ring => {
        ring.dataset.depthChannel = active ? DEPTH.GRAPH_ACTIVE : DEPTH.GRAPH_BASE;
      });
    });

    document.querySelectorAll('[data-scene-composed="true"]').forEach(element => {
      const active = element.classList.contains('is-active') || element.dataset.objectFocusState === 'active';
      element.dataset.depthChannel = active ? DEPTH.SCENE_ACTIVE : DEPTH.SCENE_OBJECT;
    });
    document.querySelectorAll('.artifact-focus-viewer,[data-object-focus-state="focus"],.object-focus-flight').forEach(element => {
      element.dataset.depthChannel = DEPTH.FOCUS;
    });
    document.querySelectorAll('#site-detail-panel,.graph-routebar,.site-graph-heading,.site-graph-help,.atlas-controls,.root-atlas-affordance').forEach(element => {
      element.dataset.depthChannel = DEPTH.HUD;
    });
    return true;
  };

  const clearLayerStyles = () => {
    if (!graphRoot) return;
    [
      '--camera-25d-bg-x', '--camera-25d-bg-y', '--camera-25d-bg-scale',
      '--camera-25d-mid-x', '--camera-25d-mid-y', '--camera-25d-mid-scale',
      '--camera-25d-fg-x', '--camera-25d-fg-y', '--camera-25d-fg-scale',
      '--camera-25d-pulse'
    ].forEach(name => graphRoot.style.removeProperty(name));
    graphRoot.classList.remove('is-camera-25d-moving');
    delete graphRoot.dataset.cameraMotion;
    delete document.body?.dataset.cameraMotion;
  };

  const neutralise = ({ keepAction = false } = {}) => {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    lastCameraSample = null;
    state.pulse = 0;
    state.pulseVelocity = 0;
    state.pulseTarget = 0;
    state.panX = 0;
    state.panY = 0;
    state.panTargetX = 0;
    state.panTargetY = 0;
    state.phase = 'idle';
    state.completedAt = performance.now();
    if (!keepAction) {
      state.lastAction = state.action === 'IDLE' ? state.lastAction : state.action;
      state.action = 'IDLE';
      state.source = null;
      state.nodeId = null;
    }
    clearLayerStyles();
  };

  const sampleCamera = () => {
    const mode = document.body?.dataset.graphMode || 'overview';
    if (mode === 'atlas') {
      const atlas = window.ProfileAtlasLOD?.snapshot?.();
      const camera = atlas?.camera;
      if (!camera || !Number.isFinite(camera.x) || !Number.isFinite(camera.y) || !Number.isFinite(camera.scale)) return null;
      return { adapter: 'atlas', x: camera.x, y: camera.y, scale: camera.scale, width: 2520, height: 1580 };
    }
    const box = svg?.viewBox?.baseVal;
    if (!box?.width || !box?.height) return null;
    return {
      adapter: 'desktop-local',
      x: box.x,
      y: box.y,
      scale: 1 / box.width,
      width: box.width,
      height: box.height
    };
  };

  const spring = (value, velocity, target, dt, stiffness, damping, maxVelocity = 7) => {
    const acceleration = (target - value) * stiffness - velocity * damping;
    const nextVelocity = clamp(velocity + acceleration * dt, -maxVelocity, maxVelocity);
    return [value + nextVelocity * dt, nextVelocity];
  };

  const lowPass = (value, target, dt, speed = 14) => {
    const weight = 1 - Math.exp(-speed * dt);
    return value + (target - value) * weight;
  };

  const applyVisualState = () => {
    if (!graphRoot || reducedMotion.matches || introOwnsMotion() || structuralOwnsMotion()) {
      clearLayerStyles();
      return;
    }

    const pulse = clamp(state.pulse, -1.08, 1.08);
    const bgX = state.panX * .30;
    const bgY = state.panY * .30;
    const midX = state.panX * .58;
    const midY = state.panY * .58;
    const fgX = state.panX * .86;
    const fgY = state.panY * .86;
    const bgScale = 1 - pulse * .0072;
    const midScale = 1 - pulse * .0022;
    const fgScale = 1 + pulse * .0028;

    graphRoot.style.setProperty('--camera-25d-bg-x', `${bgX.toFixed(3)}px`);
    graphRoot.style.setProperty('--camera-25d-bg-y', `${bgY.toFixed(3)}px`);
    graphRoot.style.setProperty('--camera-25d-bg-scale', bgScale.toFixed(5));
    graphRoot.style.setProperty('--camera-25d-mid-x', `${midX.toFixed(3)}px`);
    graphRoot.style.setProperty('--camera-25d-mid-y', `${midY.toFixed(3)}px`);
    graphRoot.style.setProperty('--camera-25d-mid-scale', midScale.toFixed(5));
    graphRoot.style.setProperty('--camera-25d-fg-x', `${fgX.toFixed(3)}px`);
    graphRoot.style.setProperty('--camera-25d-fg-y', `${fgY.toFixed(3)}px`);
    graphRoot.style.setProperty('--camera-25d-fg-scale', fgScale.toFixed(5));
    graphRoot.style.setProperty('--camera-25d-pulse', pulse.toFixed(4));
    graphRoot.classList.add('is-camera-25d-moving');
    graphRoot.dataset.cameraMotion = state.action.toLowerCase();
    if (document.body) document.body.dataset.cameraMotion = state.action.toLowerCase();
  };

  const begin = (action, meta = {}) => {
    const kind = MOTION[action] || (Object.values(MOTION).includes(action) ? action : MOTION.FOCUS);
    const profile = profileFor(kind);
    assignDepthChannels();

    state.sequence += 1;
    state.token += 1;
    if (state.phase !== 'idle') state.retargets += 1;
    state.lastAction = state.action === 'IDLE' ? state.lastAction : state.action;
    state.action = kind;
    state.phase = reducedMotion.matches || introOwnsMotion() || structuralOwnsMotion() ? 'semantic-only' : 'impulse';
    state.source = meta.source || 'api';
    state.nodeId = meta.nodeId || null;
    state.startedAt = performance.now();
    state.releaseAt = state.startedAt + profile.hold;
    state.deadline = state.startedAt + profile.duration;
    state.pulseTarget = profile.impulse;
    state.cameraAdapter = sampleCamera()?.adapter || null;
    lastCameraSample = sampleCamera();
    lastTime = 0;

    window.dispatchEvent(new CustomEvent('profile:camera-materiality', { detail: snapshot() }));
    if (state.phase === 'semantic-only') {
      clearLayerStyles();
      state.phase = 'idle';
      state.completedAt = performance.now();
      return state.token;
    }
    wake();
    return state.token;
  };

  const tick = now => {
    frame = 0;
    if (!graphRoot?.isConnected) {
      assignDepthChannels();
    }
    if (!graphRoot?.isConnected || reducedMotion.matches || introOwnsMotion() || structuralOwnsMotion()) {
      neutralise({ keepAction: false });
      return;
    }

    const profile = profileFor(state.action);
    const dt = lastTime ? clamp((now - lastTime) / 1000, 1 / 120, .034) : 1 / 60;
    lastTime = now;
    if (now >= state.releaseAt) {
      state.pulseTarget = 0;
      state.phase = 'settle';
    }

    [state.pulse, state.pulseVelocity] = spring(
      state.pulse,
      state.pulseVelocity,
      state.pulseTarget,
      dt,
      profile.stiffness,
      profile.damping,
      6.5
    );

    const current = sampleCamera();
    if (current && lastCameraSample && current.adapter === lastCameraSample.adapter) {
      const width = Math.max(1, current.width || 1);
      const height = Math.max(1, current.height || 1);
      const dx = (current.x - lastCameraSample.x) / width * 100;
      const dy = (current.y - lastCameraSample.y) / height * 100;
      state.panTargetX = clamp(-dx * 2.35, -profile.maxPan, profile.maxPan);
      state.panTargetY = clamp(-dy * 2.35, -profile.maxPan, profile.maxPan);
      state.cameraSamples += 1;
    } else {
      state.panTargetX = 0;
      state.panTargetY = 0;
    }
    lastCameraSample = current;

    state.panX = lowPass(state.panX, state.panTargetX, dt, 17);
    state.panY = lowPass(state.panY, state.panTargetY, dt, 17);
    state.panTargetX *= .42;
    state.panTargetY *= .42;
    applyVisualState();

    const settled = now >= state.deadline &&
      Math.abs(state.pulse) < .006 &&
      Math.abs(state.pulseVelocity) < .02 &&
      Math.abs(state.panX) < .025 &&
      Math.abs(state.panY) < .025;

    if (settled) {
      neutralise({ keepAction: false });
      window.dispatchEvent(new CustomEvent('profile:camera-materiality-settled', { detail: snapshot() }));
      return;
    }
    frame = requestAnimationFrame(tick);
  };

  function wake() {
    if (frame || reducedMotion.matches || introOwnsMotion() || structuralOwnsMotion()) return;
    frame = requestAnimationFrame(tick);
  }

  const semanticCall = (action, invoke, meta = {}) => {
    pendingSemantic = { action, meta };
    const beforeSequence = state.sequence;
    let result = false;
    try { result = invoke(); }
    finally {
      if (pendingSemantic?.action === action) pendingSemantic = null;
    }
    if (result && state.sequence === beforeSequence) begin(action, meta);
    return result;
  };

  const targetId = target => typeof target === 'string'
    ? target
    : target?.id || target?.nodeId || target?.targetId || target?.target || target?.to || target?.dataset?.nodeId || null;

  const upgradeComposition = () => {
    if (base) return true;
    const candidate = window.ProfileCameraComposition;
    if (!candidate?.command || !candidate?.snapshot) return false;
    base = candidate;

    const command = (preset, options = {}) => semanticCall(
      PRESET_TO_MOTION[preset] || MOTION.FOCUS,
      () => base.command(preset, options),
      { source: 'command', nodeId: options.nodeId || null }
    );

    const focusNode = (target, options = {}) => semanticCall(
      MOTION.INSPECT,
      () => base.focusNode(target, options),
      { source: 'focus', nodeId: targetId(target) }
    );

    const fit = (bounds = null, options = {}) => {
      const looksLikeOptions = bounds && !Number.isFinite(bounds.x) && !Number.isFinite(bounds.left) && Object.keys(options || {}).length === 0;
      const resolvedOptions = looksLikeOptions ? bounds : options;
      return semanticCall(MOTION.FIT, () => base.fit(resolvedOptions || {}), { source: 'fit' });
    };

    const follow = (path, options = {}) => {
      const id = targetId(path);
      if (!id) {
        begin(MOTION.FOLLOW, { source: 'follow' });
        return false;
      }
      return semanticCall(
        MOTION.FOLLOW,
        () => base.focusNode(id, { ...options, zoomFactor: options.zoomFactor ?? 1.02 }),
        { source: 'follow', nodeId: id }
      );
    };

    const pushIn = (target, options = {}) => {
      const id = targetId(target) || base.selectedNodeId?.();
      return semanticCall(
        MOTION.PUSH,
        () => base.command(base.PRESETS.INSPECT, { ...options, nodeId: id, zoomFactor: options.zoomFactor ?? 1.16 }),
        { source: 'pushIn', nodeId: id }
      );
    };

    const pullOut = (target = null, options = {}) => {
      const id = targetId(target);
      if (id) {
        const atlasScale = document.body?.dataset.graphMode === 'atlas'
          ? Math.max(1.05, (window.ProfileAtlasLOD?.snapshot?.().targetCamera?.scale || 1.2) * .84)
          : undefined;
        return semanticCall(
          MOTION.PULL,
          () => base.command(base.PRESETS.MAKE_ROOM, {
            ...options,
            nodeId: id,
            zoomFactor: options.zoomFactor ?? .92,
            ...(atlasScale ? { scale: options.scale ?? atlasScale } : {})
          }),
          { source: 'pullOut', nodeId: id }
        );
      }
      return semanticCall(MOTION.PULL, () => base.fit(options || {}), { source: 'pullOut' });
    };

    const makeRoom = (target, options = {}) => command(base.PRESETS.MAKE_ROOM, { ...options, nodeId: targetId(target) || options.nodeId });
    const inspect = (target, options = {}) => command(base.PRESETS.INSPECT, { ...options, nodeId: targetId(target) || options.nodeId });
    const peek = (target, options = {}) => command(base.PRESETS.PEEK, { ...options, nodeId: targetId(target) || options.nodeId });
    const returnCamera = (options = {}) => command(base.PRESETS.RETURN, options);
    const retarget = (action, target = null, options = {}) => {
      const kind = String(action || '').toUpperCase();
      if (kind === MOTION.FOLLOW) return follow(target, options);
      if (kind === MOTION.PUSH) return pushIn(target, options);
      if (kind === MOTION.PULL) return pullOut(target, options);
      if (kind === MOTION.MAKE_ROOM) return makeRoom(target, options);
      if (kind === MOTION.INSPECT || kind === MOTION.FOCUS) return inspect(target, options);
      if (kind === MOTION.PEEK) return peek(target, options);
      if (kind === MOTION.RETURN) return returnCamera(options);
      if (kind === MOTION.FIT) return fit(null, options);
      return false;
    };

    window.ProfileCameraComposition = Object.freeze({
      ...base,
      __camera25d: true,
      DEPTH,
      MOTION,
      command,
      fit,
      focus: focusNode,
      focusNode,
      follow,
      pushIn,
      pullOut,
      makeRoom,
      inspect,
      peek,
      return: returnCamera,
      retarget,
      serialize: () => ({
        camera: copy(base.snapshot()),
        materiality: snapshot()
      })
    });
    return true;
  };

  const handleCompositionEvent = event => {
    const fallback = PRESET_TO_MOTION[event.detail?.activePreset] || MOTION.FOCUS;
    const semantic = pendingSemantic || { action: fallback, meta: {} };
    pendingSemantic = null;
    begin(semantic.action, {
      source: semantic.meta.source || 'composition',
      nodeId: semantic.meta.nodeId || event.detail?.lastFocus?.id || event.detail?.nodeId || null
    });
  };

  const installObserver = () => {
    if (mutationObserver || !graphRoot) return;
    mutationObserver = new MutationObserver(mutations => {
      const relevant = mutations.some(mutation => mutation.type === 'childList' || mutation.attributeName === 'class');
      if (!relevant) return;
      requestAnimationFrame(assignDepthChannels);
    });
    mutationObserver.observe(graphRoot, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  };

  const boot = () => {
    if (!upgradeComposition()) return false;
    if (!assignDepthChannels()) return false;
    installObserver();
    window.dispatchEvent(new CustomEvent('profile:camera-materiality-ready', { detail: snapshot() }));
    return true;
  };

  const ensureBoot = () => {
    if (boot()) {
      cancelAnimationFrame(bootFrame);
      bootFrame = 0;
      return true;
    }
    if (bootAttempts++ > 420) return false;
    cancelAnimationFrame(bootFrame);
    bootFrame = requestAnimationFrame(ensureBoot);
    return false;
  };

  function snapshot() {
    const activeNodes = graphRoot
      ? graphRoot.querySelectorAll(`[data-depth-channel="${DEPTH.GRAPH_ACTIVE}"]`).length
      : 0;
    return {
      sequence: state.sequence,
      token: state.token,
      action: state.action,
      lastAction: state.lastAction,
      phase: state.phase,
      source: state.source,
      nodeId: state.nodeId,
      pulse: state.pulse,
      panX: state.panX,
      panY: state.panY,
      retargets: state.retargets,
      cameraAdapter: state.cameraAdapter,
      cameraSamples: state.cameraSamples,
      reducedMotion: reducedMotion.matches,
      introBlocked: introOwnsMotion(),
      structuralBlocked: structuralOwnsMotion(),
      depthChannels: { ...DEPTH },
      activeDepthNodeCount: activeNodes,
      ready: Boolean(base && graphRoot && svg && edges && decorations && nodes)
    };
  }

  window.addEventListener('profile:camera-composition', handleCompositionEvent);
  window.addEventListener('profile:node-interaction', assignDepthChannels);
  window.addEventListener('profile:scene-composition', assignDepthChannels);
  window.addEventListener('profile:artifact-scenes-ready', assignDepthChannels);
  window.addEventListener('profile:transition-begin', () => neutralise());
  window.addEventListener('profile:transition-finish', assignDepthChannels);
  window.addEventListener('profile:transition-cancel', assignDepthChannels);
  window.addEventListener('profile:intro-stage', () => {
    if (introOwnsMotion()) neutralise();
  });
  reducedMotion.addEventListener?.('change', () => {
    if (reducedMotion.matches) neutralise();
  });

  window.ProfileCameraMateriality = Object.freeze({
    DEPTH,
    MOTION,
    PROFILES,
    begin,
    retarget: (action, meta = {}) => begin(action, { ...meta, source: meta.source || 'materiality-retarget' }),
    reset: neutralise,
    assignDepthChannels,
    boot,
    snapshot
  });

  ensureBoot();
})();
