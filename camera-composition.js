(() => {
  if (window.ProfileCameraComposition) return;

  const scene = window.ProfileScene;
  if (!scene?.camera) return;

  const PRESETS = Object.freeze({
    MAKE_ROOM: 'MAKE_ROOM',
    INSPECT: 'INSPECT',
    PEEK: 'PEEK',
    RETURN: 'RETURN'
  });
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 901px)');

  let booted = false;
  let localBooted = false;
  let atlasBooted = false;
  let sequence = 0;
  let operation = 0;
  let lastFocus = null;
  let activePreset = null;
  let bootFrame = 0;
  let bootAttempts = 0;
  let localFrame = 0;
  let localAnimationToken = 0;
  let lastAutoRoomRoute = null;
  let lastAutoRoomReservations = new Set();

  const memory = new Map();
  const localHomes = new Map();

  const graphSvg = () => document.querySelector('#site-graph .site-graph-svg');
  const currentMode = () => document.body.dataset.graphMode || 'overview';
  const currentRoute = () => document.body.dataset.graphRoute || 'overview';
  const currentAdapter = () => scene.camera.activeName || (currentMode() === 'atlas' ? 'atlas' : 'desktop-local');
  const visible = element => Boolean(element && !element.hidden && element.getClientRects().length);
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const lerp = (from, to, t) => from + (to - from) * t;
  const ease = t => 1 - Math.pow(1 - t, 3);
  const routeKey = slot => `${currentMode()}:${currentRoute()}:${slot}`;

  const safeFrame = () => {
    const svg = graphSvg();
    const rect = svg?.getBoundingClientRect();
    if (!rect?.width || !rect?.height) return null;

    const gap = 22;
    let left = rect.left + gap;
    let right = rect.right - gap;
    let top = rect.top + gap;
    let bottom = rect.bottom - gap;
    const reserved = [];

    const inspector = document.querySelector('#site-detail-panel');
    if (visible(inspector)) {
      const box = inspector.getBoundingClientRect();
      const side = box.left >= rect.left + rect.width / 2 ? 'right' : 'left';
      if (side === 'right') right = Math.min(right, box.left - gap);
      else left = Math.max(left, box.right + gap);
      reserved.push({ id: 'detail-panel', side });
    }

    document.querySelectorAll('[data-scene-zone="side-stage"][data-scene-composed="true"]').forEach(element => {
      if (!visible(element)) return;
      const box = element.getBoundingClientRect();
      const side = element.dataset.sceneSide || (box.left + box.width / 2 < rect.left + rect.width / 2 ? 'left' : 'right');
      if (side === 'left') left = Math.max(left, box.right + gap);
      else right = Math.min(right, box.left - gap);
      reserved.push({ id: element.dataset.sceneObject || element.dataset.artifactScene || 'side-stage', side });
    });

    document.querySelectorAll('[data-scene-zone="lower-rail"][data-scene-composed="true"]').forEach(element => {
      if (!visible(element)) return;
      const box = element.getBoundingClientRect();
      bottom = Math.min(bottom, box.top - gap);
      reserved.push({ id: element.dataset.sceneObject || 'lower-rail', side: 'bottom' });
    });

    const minWidth = Math.min(520, rect.width * .46);
    const minHeight = Math.min(380, rect.height * .48);
    if (right - left < minWidth) {
      const hasRight = reserved.some(item => item.side === 'right');
      const hasLeft = reserved.some(item => item.side === 'left');
      if (hasRight && !hasLeft) {
        left = rect.left + gap;
        right = Math.min(rect.right - gap, left + minWidth);
      } else if (hasLeft && !hasRight) {
        right = rect.right - gap;
        left = Math.max(rect.left + gap, right - minWidth);
      } else {
        const centre = rect.left + rect.width / 2;
        left = Math.max(rect.left + gap, centre - minWidth / 2);
        right = Math.min(rect.right - gap, left + minWidth);
      }
    }
    if (bottom - top < minHeight) top = Math.max(rect.top + gap, bottom - minHeight);

    return {
      left,
      right,
      top,
      bottom,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
      centerX: (left + right) / 2,
      centerY: (top + bottom) / 2,
      reserved
    };
  };

  const selectedNodeId = () => {
    const selector = currentMode() === 'atlas'
      ? '#site-graph .site-graph-node.is-previewed[data-node-id]'
      : '#site-graph .site-graph-node.is-selected[data-node-id]';
    const selected = [...document.querySelectorAll(selector)]
      .find(element => !element.closest('.v9-transition-overlay'));
    return selected?.dataset.nodeId || scene.manager?.graphState?.activeNodeId || null;
  };

  /* ------------------------------------------------------------------
     Atlas camera bridge
     ------------------------------------------------------------------ */
  const atlasState = () => {
    const snapshot = window.ProfileAtlasLOD?.snapshot?.() || {};
    const camera = snapshot.targetCamera || snapshot.camera;
    if (!camera || !Number.isFinite(camera.scale)) return null;
    return { adapter: 'atlas', x: camera.x, y: camera.y, scale: camera.scale };
  };

  const applyAtlasState = (state, options = {}) => {
    const atlas = window.ProfileAtlasLOD;
    if (!atlas || !state) return false;
    const immediate = Boolean(options.immediate);
    atlas.setScale?.(state.scale, { immediate });
    atlas.panTo?.(state.x, state.y, { immediate });
    return true;
  };

  const focusAtlasNode = (nodeOrId, options = {}) => {
    const atlas = window.ProfileAtlasLOD;
    const geometry = window.ProfileGeometry;
    const svg = graphSvg();
    const id = typeof nodeOrId === 'string' ? nodeOrId : nodeOrId?.id || nodeOrId?.dataset?.nodeId;
    const point = id ? geometry?.atlasPoint?.(id) : null;
    const frame = safeFrame();
    if (!atlas || !geometry || !svg || !point || !frame || currentMode() !== 'atlas') return false;

    const viewBox = svg.viewBox?.baseVal;
    const rect = svg.getBoundingClientRect();
    if (!viewBox?.width || !viewBox?.height || !rect.width || !rect.height) return false;

    const current = atlasState() || { x: 0, y: 0, scale: 1 };
    const minScale = Number.isFinite(options.minScale) ? options.minScale : 1.35;
    const maxScale = Number.isFinite(options.maxScale) ? options.maxScale : 2.25;
    const requestedScale = Number.isFinite(options.scale) ? options.scale : Math.max(minScale, current.scale * 1.28);
    const scale = clamp(requestedScale, minScale, maxScale);
    const safeX = viewBox.x + (frame.centerX - rect.left) * viewBox.width / rect.width;
    const safeY = viewBox.y + (frame.centerY - rect.top) * viewBox.height / rect.height;
    const state = {
      adapter: 'atlas',
      x: safeX - point.x * scale,
      y: safeY - point.y * scale,
      scale
    };

    applyAtlasState(state, options);
    lastFocus = { adapter: 'atlas', id, scale, safeCenter: { x: frame.centerX, y: frame.centerY }, reserved: frame.reserved };
    return true;
  };

  /* ------------------------------------------------------------------
     Desktop local camera
     ------------------------------------------------------------------ */
  const readLocalState = () => {
    const svg = graphSvg();
    const viewBox = svg?.viewBox?.baseVal;
    const rect = svg?.getBoundingClientRect();
    if (!svg || !viewBox?.width || !viewBox?.height) return null;
    return {
      adapter: 'desktop-local',
      x: viewBox.x,
      y: viewBox.y,
      width: viewBox.width,
      height: viewBox.height,
      scale: rect?.width ? rect.width / viewBox.width : 1,
      viewportWidth: rect?.width || innerWidth,
      viewportHeight: rect?.height || innerHeight,
      viewBox: { x: viewBox.x, y: viewBox.y, width: viewBox.width, height: viewBox.height }
    };
  };

  const localHomeKey = () => `${currentMode()}:${currentRoute()}`;
  const captureLocalHome = ({ force = false } = {}) => {
    if (currentMode() === 'atlas' || !desktop.matches) return null;
    const state = readLocalState();
    if (!state) return null;
    const key = localHomeKey();
    if (force || !localHomes.has(key)) {
      localHomes.set(key, {
        adapter: 'desktop-local',
        x: state.x,
        y: state.y,
        width: state.width,
        height: state.height,
        scale: state.scale,
        viewBox: { ...state.viewBox }
      });
    }
    return localHomes.get(key);
  };

  const localHome = () => localHomes.get(localHomeKey()) || captureLocalHome();

  const normaliseLocalTarget = state => {
    const current = readLocalState();
    if (!current || !state) return null;
    const source = state.viewBox || state;
    return {
      adapter: 'desktop-local',
      x: Number.isFinite(source.x) ? source.x : current.x,
      y: Number.isFinite(source.y) ? source.y : current.y,
      width: Number.isFinite(source.width) && source.width > 0 ? source.width : current.width,
      height: Number.isFinite(source.height) && source.height > 0 ? source.height : current.height
    };
  };

  const writeLocalViewBox = state => {
    const svg = graphSvg();
    if (!svg || !state) return false;
    svg.setAttribute('viewBox', `${state.x.toFixed(3)} ${state.y.toFixed(3)} ${state.width.toFixed(3)} ${state.height.toFixed(3)}`);
    return true;
  };

  const applyLocalState = (state, options = {}) => {
    const target = normaliseLocalTarget(state);
    const start = readLocalState();
    if (!target || !start || currentMode() === 'atlas') return false;

    const token = ++localAnimationToken;
    cancelAnimationFrame(localFrame);
    localFrame = 0;
    if (options.immediate || reducedMotion.matches) return writeLocalViewBox(target);

    const started = performance.now();
    const duration = Number.isFinite(options.duration) ? clamp(options.duration, 120, 700) : 320;
    const route = currentRoute();
    const frame = now => {
      if (token !== localAnimationToken || currentRoute() !== route || currentMode() === 'atlas') {
        localFrame = 0;
        return;
      }
      const t = ease(clamp((now - started) / duration, 0, 1));
      writeLocalViewBox({
        x: lerp(start.x, target.x, t),
        y: lerp(start.y, target.y, t),
        width: lerp(start.width, target.width, t),
        height: lerp(start.height, target.height, t)
      });
      if (t >= .9999) {
        writeLocalViewBox(target);
        localFrame = 0;
        return;
      }
      localFrame = requestAnimationFrame(frame);
    };
    localFrame = requestAnimationFrame(frame);
    return true;
  };

  const clampLocalTarget = target => {
    const home = localHome();
    if (!home) return target;
    const marginX = home.width * .18;
    const marginY = home.height * .18;
    const minX = home.x - marginX;
    const maxX = home.x + home.width - target.width + marginX;
    const minY = home.y - marginY;
    const maxY = home.y + home.height - target.height + marginY;
    target.x = clamp(target.x, Math.min(minX, maxX), Math.max(minX, maxX));
    target.y = clamp(target.y, Math.min(minY, maxY), Math.max(minY, maxY));
    return target;
  };

  const localNodeElement = id => [...document.querySelectorAll(`#site-graph .site-graph-node[data-node-id="${CSS.escape(id)}"]`)]
    .find(element => !element.closest('.v9-transition-overlay')) || null;

  const focusLocalNode = (nodeOrId, options = {}) => {
    const svg = graphSvg();
    const id = typeof nodeOrId === 'string' ? nodeOrId : nodeOrId?.id || nodeOrId?.dataset?.nodeId;
    const node = id ? localNodeElement(id) : null;
    const frame = safeFrame();
    const current = readLocalState();
    if (!svg || !node || !frame || !current || currentMode() === 'atlas' || !desktop.matches) return false;
    captureLocalHome();

    const svgRect = svg.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    if (!svgRect.width || !svgRect.height || !nodeRect.width || !nodeRect.height) return false;

    const nodeX = current.x + ((nodeRect.left + nodeRect.width / 2 - svgRect.left) / svgRect.width) * current.width;
    const nodeY = current.y + ((nodeRect.top + nodeRect.height / 2 - svgRect.top) / svgRect.height) * current.height;
    const zoomFactor = clamp(Number(options.zoomFactor) || 1, .88, 1.28);
    const width = current.width / zoomFactor;
    const height = current.height / zoomFactor;
    const fx = clamp((frame.centerX - svgRect.left) / svgRect.width, .08, .92);
    const fy = clamp((frame.centerY - svgRect.top) / svgRect.height, .08, .92);
    const target = clampLocalTarget({
      adapter: 'desktop-local',
      x: nodeX - fx * width,
      y: nodeY - fy * height,
      width,
      height
    });

    const success = applyLocalState(target, options);
    if (success) {
      lastFocus = {
        adapter: 'desktop-local',
        id,
        zoomFactor,
        safeCenter: { x: frame.centerX, y: frame.centerY },
        reserved: frame.reserved
      };
    }
    return success;
  };

  const fitLocal = (_bounds = null, options = {}) => {
    const home = localHome();
    return home ? applyLocalState(home, options) : false;
  };

  const zoomLocalAt = (point, factor, options = {}) => {
    const current = readLocalState();
    const svg = graphSvg();
    const rect = svg?.getBoundingClientRect();
    if (!current || !rect?.width || !rect?.height || !Number.isFinite(factor) || factor <= 0) return false;
    captureLocalHome();
    const clientX = Number.isFinite(point?.x) ? point.x : rect.left + rect.width / 2;
    const clientY = Number.isFinite(point?.y) ? point.y : rect.top + rect.height / 2;
    const fx = clamp((clientX - rect.left) / rect.width, 0, 1);
    const fy = clamp((clientY - rect.top) / rect.height, 0, 1);
    const width = current.width / clamp(factor, .72, 1.38);
    const height = current.height / clamp(factor, .72, 1.38);
    return applyLocalState(clampLocalTarget({
      x: current.x + fx * current.width - fx * width,
      y: current.y + fy * current.height - fy * height,
      width,
      height
    }), options);
  };

  const panLocal = (delta, options = {}) => {
    const current = readLocalState();
    const svg = graphSvg();
    const rect = svg?.getBoundingClientRect();
    if (!current || !rect?.width || !rect?.height) return false;
    const dx = (Number(delta?.x) || 0) * current.width / rect.width;
    const dy = (Number(delta?.y) || 0) * current.height / rect.height;
    return applyLocalState(clampLocalTarget({
      x: current.x - dx,
      y: current.y - dy,
      width: current.width,
      height: current.height
    }), options);
  };

  /* ------------------------------------------------------------------
     Generic command layer and memory
     ------------------------------------------------------------------ */
  const cameraState = () => {
    if (currentMode() === 'atlas') return atlasState();
    if (currentAdapter() === 'desktop-local') return readLocalState();
    const state = scene.camera.read?.();
    return state ? { adapter: currentAdapter(), ...state } : null;
  };

  const remember = (slot, state = cameraState()) => {
    if (!state) return false;
    const copy = typeof structuredClone === 'function' ? structuredClone(state) : JSON.parse(JSON.stringify(state));
    memory.set(routeKey(slot), copy);
    return true;
  };

  const recalled = slot => {
    const state = memory.get(routeKey(slot));
    if (!state) return null;
    return typeof structuredClone === 'function' ? structuredClone(state) : JSON.parse(JSON.stringify(state));
  };

  const applyCameraState = (state, options = {}) => {
    if (!state) return false;
    if (state.adapter === 'atlas') return applyAtlasState(state, options);
    if (state.adapter === 'desktop-local') return applyLocalState(state, options);
    return scene.camera.transitionTo?.(state, options) || false;
  };

  const focusForPreset = (preset, nodeId, options = {}) => {
    if (!nodeId) return false;
    if (currentMode() === 'atlas') {
      const current = atlasState();
      if (preset === PRESETS.MAKE_ROOM) {
        return focusAtlasNode(nodeId, {
          ...options,
          scale: options.scale ?? Math.max(1.05, current?.scale || 1.05),
          minScale: 1.05,
          maxScale: 2.25
        });
      }
      if (preset === PRESETS.PEEK) {
        return focusAtlasNode(nodeId, {
          ...options,
          scale: options.scale ?? Math.max(1.08, Math.min(1.22, current?.scale || 1.08)),
          minScale: 1.05,
          maxScale: 1.35
        });
      }
      return focusAtlasNode(nodeId, { ...options, minScale: 1.35, maxScale: 2.25 });
    }

    if (currentAdapter() === 'desktop-local') {
      const zoomFactor = preset === PRESETS.INSPECT
        ? options.zoomFactor ?? 1.10
        : preset === PRESETS.PEEK
          ? options.zoomFactor ?? 1.04
          : options.zoomFactor ?? 1;
      return focusLocalNode(nodeId, { ...options, zoomFactor });
    }
    return false;
  };

  const dispatchState = (preset, token, extra = {}) => {
    sequence += 1;
    activePreset = preset;
    window.dispatchEvent(new CustomEvent('profile:camera-composition', {
      detail: { ...snapshotState(), token, ...extra }
    }));
  };

  const command = (preset, options = {}) => {
    if (!Object.values(PRESETS).includes(preset)) return false;
    ensureBoot();
    const token = ++operation;
    const nodeId = options.nodeId || selectedNodeId();

    if (preset === PRESETS.INSPECT) {
      const key = routeKey('inspect-origin');
      if (!memory.has(key)) remember('inspect-origin');
      const success = focusForPreset(preset, nodeId, options);
      if (success) dispatchState(preset, token, { nodeId });
      return success;
    }

    if (preset === PRESETS.MAKE_ROOM) {
      const success = focusForPreset(preset, nodeId, options);
      if (success) dispatchState(preset, token, { nodeId });
      return success;
    }

    if (preset === PRESETS.PEEK) {
      const key = routeKey('peek-origin');
      if (!memory.has(key)) remember('peek-origin');
      const success = focusForPreset(preset, nodeId, options);
      if (success) dispatchState(preset, token, { nodeId });
      return success;
    }

    const slot = options.slot || (memory.has(routeKey('peek-origin')) ? 'peek-origin' : 'inspect-origin');
    const state = recalled(slot);
    if (!state) return false;
    const success = applyCameraState(state, options);
    if (success) {
      memory.delete(routeKey(slot));
      dispatchState(preset, token, { slot });
    }
    return success;
  };

  const sceneAwareFit = options => {
    ensureBoot();
    const frame = safeFrame();
    const nodeId = selectedNodeId();
    if (nodeId && frame?.reserved?.length) return command(PRESETS.MAKE_ROOM, { ...options, nodeId });
    const adapter = scene.camera.adapters?.get?.(currentAdapter());
    return adapter?.__compositionBaseFit?.(null, options || {}) ?? false;
  };

  /* ------------------------------------------------------------------
     Adapter installation
     ------------------------------------------------------------------ */
  const installLocalAdapter = () => {
    if (localBooted) return true;
    const base = scene.camera.adapters?.get?.('desktop-local');
    if (!base) return false;
    captureLocalHome();
    scene.camera.registerAdapter('desktop-local', {
      ...base,
      __compositionCamera: true,
      __compositionBaseFit: fitLocal,
      read: () => readLocalState() || base.read?.() || {},
      fit: (_bounds, options = {}) => sceneAwareFit(options),
      reset: options => fitLocal(null, options || {}),
      focus: (node, options = {}) => command(PRESETS.INSPECT, {
        ...options,
        nodeId: typeof node === 'string' ? node : node?.id || node?.dataset?.nodeId
      }),
      zoomAt: zoomLocalAt,
      pan: panLocal,
      transitionTo: applyLocalState,
      serialize: () => readLocalState() || base.serialize?.() || base.read?.() || {}
    });
    localBooted = true;
    return true;
  };

  const installAtlasAdapter = () => {
    if (atlasBooted) return true;
    const base = scene.camera.adapters?.get?.('atlas');
    if (!base || !window.ProfileAtlasLOD || !window.ProfileGeometry) return false;
    const baseFit = base.fit?.bind(base);
    scene.camera.registerAdapter('atlas', {
      ...base,
      __compositionCamera: true,
      __compositionBaseFit: baseFit,
      focus: (node, options = {}) => command(PRESETS.INSPECT, {
        ...options,
        nodeId: typeof node === 'string' ? node : node?.id || node?.dataset?.nodeId
      }),
      fit: (_bounds, options = {}) => sceneAwareFit(options),
      transitionTo: applyAtlasState,
      serialize: () => ({ ...(base.serialize?.() || {}), composition: snapshotState() })
    });
    atlasBooted = true;
    return true;
  };

  const boot = () => {
    const localReady = installLocalAdapter();
    const atlasReady = installAtlasAdapter();
    booted = Boolean(localReady && atlasReady);
    if (booted) {
      cancelAnimationFrame(bootFrame);
      bootFrame = 0;
      window.dispatchEvent(new CustomEvent('profile:camera-composition-ready', { detail: snapshotState() }));
    }
    return booted;
  };

  const ensureBoot = () => {
    if (boot()) return true;
    if (bootAttempts++ > 360) return false;
    cancelAnimationFrame(bootFrame);
    bootFrame = requestAnimationFrame(ensureBoot);
    return false;
  };

  const scheduleLocalHomeCapture = ({ force = false } = {}) => {
    requestAnimationFrame(() => requestAnimationFrame(() => captureLocalHome({ force })));
  };

  const maybeAutoMakeRoom = () => {
    if (!booted || !desktop.matches || currentMode() !== 'focus' || document.body.classList.contains('has-object-focus')) return;
    const frame = safeFrame();
    const nodeId = selectedNodeId();
    if (!frame || !nodeId) return;

    const route = currentRoute();
    const reservations = new Set(frame.reserved.map(item => `${item.id}:${item.side}`));
    if (lastAutoRoomRoute !== route) {
      lastAutoRoomRoute = route;
      lastAutoRoomReservations = new Set();
    }
    const additions = [...reservations].filter(item => !lastAutoRoomReservations.has(item));
    lastAutoRoomReservations = reservations;
    if (!reservations.size || !additions.length) return;

    requestAnimationFrame(() => {
      if (currentRoute() !== route || currentMode() !== 'focus') return;
      command(PRESETS.MAKE_ROOM, { nodeId, duration: 280 });
    });
  };

  const snapshotState = () => ({
    sequence,
    operation,
    booted,
    localBooted,
    atlasBooted,
    activePreset,
    mode: currentMode(),
    route: currentRoute(),
    adapter: currentAdapter(),
    safeFrame: safeFrame(),
    camera: cameraState(),
    lastFocus,
    localAnimating: Boolean(localFrame),
    memory: [...memory.entries()].map(([key, state]) => ({ key, adapter: state.adapter || null })),
    localHomes: [...localHomes.keys()]
  });

  window.addEventListener('load', ensureBoot, { once: true });
  window.addEventListener('profile:scene-state', event => {
    ensureBoot();
    if (event.detail?.previous?.route !== event.detail?.current?.route) {
      lastAutoRoomRoute = null;
      lastAutoRoomReservations = new Set();
      scheduleLocalHomeCapture();
    }
    window.dispatchEvent(new CustomEvent('profile:camera-safe-frame', { detail: snapshotState() }));
  });
  window.addEventListener('profile:scene-composition', () => {
    ensureBoot();
    maybeAutoMakeRoom();
    window.dispatchEvent(new CustomEvent('profile:camera-safe-frame', { detail: snapshotState() }));
  });
  window.addEventListener('resize', () => {
    if (currentMode() !== 'atlas') {
      localHomes.delete(localHomeKey());
      scheduleLocalHomeCapture({ force: true });
    }
  });

  /* First activation remains owned by Phase 7. A repeated Atlas activation is
     the semantic INSPECT command and can retarget an in-flight camera move. */
  window.addEventListener('click', event => {
    if (!atlasBooted || currentMode() !== 'atlas' || event.button !== 0) return;
    const node = event.target.closest?.('#site-graph .site-graph-node.is-previewed[data-node-id]');
    if (!node) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    command(PRESETS.INSPECT, { nodeId: node.dataset.nodeId });
  }, true);

  window.addEventListener('keydown', event => {
    if (!atlasBooted || currentMode() !== 'atlas' || !['Enter', ' '].includes(event.key)) return;
    const node = event.target.closest?.('#site-graph .site-graph-node.is-previewed[data-node-id]');
    if (!node) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    command(PRESETS.INSPECT, { nodeId: node.dataset.nodeId });
  }, true);

  window.ProfileCameraComposition = Object.freeze({
    PRESETS,
    safeFrame,
    selectedNodeId,
    focusNode: (node, options) => command(PRESETS.INSPECT, {
      ...(options || {}),
      nodeId: typeof node === 'string' ? node : node?.id || node?.dataset?.nodeId
    }),
    command,
    fit: sceneAwareFit,
    remember,
    recalled,
    boot,
    snapshot: snapshotState
  });

  ensureBoot();
})();
