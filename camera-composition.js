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

  let booted = false;
  let sequence = 0;
  let operation = 0;
  let lastFocus = null;
  let activePreset = null;
  let bootFrame = 0;
  let bootAttempts = 0;
  const memory = new Map();

  const graphSvg = () => document.querySelector('#site-graph .site-graph-svg');
  const visible = element => Boolean(element && !element.hidden && element.getClientRects().length);
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const routeKey = slot => `${document.body.dataset.graphMode || 'overview'}:${document.body.dataset.graphRoute || 'overview'}:${slot}`;

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
      if (box.left >= rect.left + rect.width / 2) right = Math.min(right, box.left - gap);
      else left = Math.max(left, box.right + gap);
      reserved.push({ id: 'detail-panel', side: box.left >= rect.left + rect.width / 2 ? 'right' : 'left' });
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
      if (reserved.some(item => item.side === 'right') && !reserved.some(item => item.side === 'left')) {
        left = rect.left + gap;
        right = Math.min(rect.right - gap, left + minWidth);
      } else if (reserved.some(item => item.side === 'left') && !reserved.some(item => item.side === 'right')) {
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

  const atlasState = () => {
    const snapshot = window.ProfileAtlasLOD?.snapshot?.() || {};
    const camera = snapshot.targetCamera || snapshot.camera;
    if (!camera || !Number.isFinite(camera.scale)) return null;
    return { x: camera.x, y: camera.y, scale: camera.scale };
  };

  const remember = (slot, state = atlasState()) => {
    if (!state) return false;
    memory.set(routeKey(slot), { ...state });
    return true;
  };

  const recalled = slot => {
    const state = memory.get(routeKey(slot));
    return state ? { ...state } : null;
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
    if (!atlas || !geometry || !svg || !point || !frame || document.body.dataset.graphMode !== 'atlas') return false;

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
      x: safeX - point.x * scale,
      y: safeY - point.y * scale,
      scale
    };

    applyAtlasState(state, options);
    lastFocus = { id, scale, safeCenter: { x: frame.centerX, y: frame.centerY }, reserved: frame.reserved };
    return true;
  };

  const selectedAtlasNodeId = () =>
    document.querySelector('#site-graph .site-graph-node.is-previewed[data-node-id]')?.dataset.nodeId || null;

  const dispatchState = (preset, token, extra = {}) => {
    sequence += 1;
    activePreset = preset;
    window.dispatchEvent(new CustomEvent('profile:camera-composition', {
      detail: { ...snapshotState(), token, ...extra }
    }));
  };

  const command = (preset, options = {}) => {
    if (!Object.values(PRESETS).includes(preset)) return false;
    if (!boot()) return false;
    const token = ++operation;
    const nodeId = options.nodeId || selectedAtlasNodeId();

    if (preset === PRESETS.INSPECT) {
      const key = routeKey('inspect-origin');
      if (!memory.has(key)) remember('inspect-origin');
      const success = Boolean(nodeId && focusAtlasNode(nodeId, {
        ...options,
        minScale: 1.35,
        maxScale: 2.25
      }));
      if (success) dispatchState(preset, token, { nodeId });
      return success;
    }

    if (preset === PRESETS.MAKE_ROOM) {
      if (!nodeId) return false;
      const current = atlasState();
      const success = focusAtlasNode(nodeId, {
        ...options,
        scale: options.scale ?? Math.max(1.05, current?.scale || 1.05),
        minScale: 1.05,
        maxScale: 2.25
      });
      if (success) dispatchState(preset, token, { nodeId });
      return success;
    }

    if (preset === PRESETS.PEEK) {
      if (!nodeId) return false;
      remember('peek-origin');
      const current = atlasState();
      const success = focusAtlasNode(nodeId, {
        ...options,
        scale: options.scale ?? Math.max(1.08, Math.min(1.22, current?.scale || 1.08)),
        minScale: 1.05,
        maxScale: 1.35
      });
      if (success) dispatchState(preset, token, { nodeId });
      return success;
    }

    const slot = options.slot || (memory.has(routeKey('peek-origin')) ? 'peek-origin' : 'inspect-origin');
    const state = recalled(slot);
    if (!state) return false;
    const success = applyAtlasState(state, options);
    if (success) {
      memory.delete(routeKey(slot));
      dispatchState(preset, token, { slot });
    }
    return success;
  };

  const sceneAwareFit = options => {
    if (document.body.dataset.graphMode !== 'atlas') return scene.camera.fit(null, options || {});
    const nodeId = selectedAtlasNodeId();
    if (nodeId && safeFrame()?.reserved?.length) return command(PRESETS.MAKE_ROOM, { ...options, nodeId });
    const atlasBase = scene.camera.adapters?.get?.('atlas');
    return atlasBase?.__compositionBaseFit?.(null, options || {}) ?? false;
  };

  const snapshotState = () => ({
    sequence,
    operation,
    booted,
    activePreset,
    mode: document.body.dataset.graphMode || 'overview',
    route: document.body.dataset.graphRoute || 'overview',
    safeFrame: safeFrame(),
    camera: atlasState(),
    lastFocus,
    memory: [...memory.entries()].map(([key, state]) => ({ key, ...state }))
  });

  const boot = () => {
    if (booted) return true;
    const atlasBase = scene.camera.adapters?.get?.('atlas');
    if (!atlasBase || !window.ProfileAtlasLOD || !window.ProfileGeometry) return false;

    const baseFit = atlasBase.fit?.bind(atlasBase);
    scene.camera.registerAdapter('atlas', {
      ...atlasBase,
      __compositionBaseFit: baseFit,
      focus: (node, options = {}) => command(PRESETS.INSPECT, {
        ...options,
        nodeId: typeof node === 'string' ? node : node?.id || node?.dataset?.nodeId
      }),
      fit: (_bounds, options = {}) => sceneAwareFit(options),
      serialize: () => ({ ...atlasBase.serialize?.(), composition: snapshotState() })
    });
    booted = true;
    cancelAnimationFrame(bootFrame);
    bootFrame = 0;
    window.dispatchEvent(new CustomEvent('profile:camera-composition-ready', { detail: snapshotState() }));
    return true;
  };

  const ensureBoot = () => {
    if (boot()) return;
    if (bootAttempts++ > 300) return;
    cancelAnimationFrame(bootFrame);
    bootFrame = requestAnimationFrame(ensureBoot);
  };

  window.addEventListener('load', ensureBoot, { once: true });
  window.addEventListener('profile:scene-state', () => {
    ensureBoot();
    window.dispatchEvent(new CustomEvent('profile:camera-safe-frame', { detail: snapshotState() }));
  });
  window.addEventListener('profile:scene-composition', () => {
    ensureBoot();
    window.dispatchEvent(new CustomEvent('profile:camera-safe-frame', { detail: snapshotState() }));
  });

  window.addEventListener('click', event => {
    if (!booted || document.body.dataset.graphMode !== 'atlas' || event.button !== 0) return;
    const node = event.target.closest?.('#site-graph .site-graph-node.is-previewed[data-node-id]');
    if (!node) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    command(PRESETS.INSPECT, { nodeId: node.dataset.nodeId });
  }, true);

  window.addEventListener('keydown', event => {
    if (!booted || document.body.dataset.graphMode !== 'atlas' || !['Enter', ' '].includes(event.key)) return;
    const node = event.target.closest?.('#site-graph .site-graph-node.is-previewed[data-node-id]');
    if (!node) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    command(PRESETS.INSPECT, { nodeId: node.dataset.nodeId });
  }, true);

  window.ProfileCameraComposition = Object.freeze({
    PRESETS,
    safeFrame,
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
