(() => {
  const mq = window.matchMedia('(max-width: 900px)');
  if (!mq.matches) return;

  const state = {
    ready: false,
    mode: 'overview',
    camera: { cx: 600, cy: 360, zoom: 1 },
    full: { width: 1200, height: 720 },
    pointers: new Map(),
    gesture: null,
    dragged: false,
    suppressClickUntil: 0,
    sheet: null,
    sheetBody: null,
    sheetTitle: null,
    sheetBackdrop: null,
    dock: null,
    modeButton: null,
    cameraFrame: 0,
    registeredObjects: new Map()
  };

  const $ = selector => document.querySelector(selector);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  const modeNow = () => document.body.dataset.graphMode || 'overview';
  const localMode = () => modeNow() !== 'atlas';
  const fullForMode = mode => mode === 'work'
    ? { width: 1200, height: 760 }
    : { width: 1200, height: 720 };

  const svg = () => $('#site-graph .site-graph-svg');
  const viewport = () => $('.site-graph-viewport');
  const activeNode = () => {
    const mode = modeNow();
    if (mode === 'overview') return $('#site-graph .site-graph-node[data-node-id="stepan-chrast"]');
    return $('#site-graph .site-graph-node.is-selected') ||
      $('#site-graph .site-graph-node[data-node-id="work"]') ||
      $('#site-graph .site-graph-node[data-node-id="stepan-chrast"]');
  };

  const readNodePoint = element => {
    if (!element) return null;
    const x = Number(element.dataset.x);
    const y = Number(element.dataset.y);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  };

  const cameraBox = () => {
    const vp = viewport();
    const aspect = Math.max(.42, Math.min(1.35, (vp?.clientWidth || innerWidth) / Math.max(1, vp?.clientHeight || innerHeight)));
    const height = state.full.height / state.camera.zoom;
    const width = height * aspect;
    return {
      width,
      height,
      x: state.camera.cx - width / 2,
      y: state.camera.cy - height / 2
    };
  };

  const constrainCamera = () => {
    const box = cameraBox();
    const marginX = box.width * .34;
    const marginY = box.height * .28;
    state.camera.cx = clamp(
      state.camera.cx,
      -marginX + box.width / 2,
      state.full.width + marginX - box.width / 2
    );
    state.camera.cy = clamp(
      state.camera.cy,
      -marginY + box.height / 2,
      state.full.height + marginY - box.height / 2
    );
  };

  const applyCamera = () => {
    if (!localMode()) return;
    const target = svg();
    if (!target) return;
    constrainCamera();
    const box = cameraBox();
    target.setAttribute('viewBox', `${box.x.toFixed(2)} ${box.y.toFixed(2)} ${box.width.toFixed(2)} ${box.height.toFixed(2)}`);
    target.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  };

  const animateCamera = (target, duration = 360) => {
    cancelAnimationFrame(state.cameraFrame);
    const start = { ...state.camera };
    if (reduced.matches || duration === 0) {
      Object.assign(state.camera, target);
      applyCamera();
      return;
    }
    const started = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);
    const frame = now => {
      const raw = Math.min(1, (now - started) / duration);
      const t = ease(raw);
      state.camera.cx = start.cx + (target.cx - start.cx) * t;
      state.camera.cy = start.cy + (target.cy - start.cy) * t;
      state.camera.zoom = start.zoom + (target.zoom - start.zoom) * t;
      applyCamera();
      if (raw < 1) state.cameraFrame = requestAnimationFrame(frame);
    };
    state.cameraFrame = requestAnimationFrame(frame);
  };

  const defaultZoom = mode => {
    if (mode === 'work') return 1.18;
    if (mode === 'overview') return 1.04;
    return 1.22;
  };

  const resetCamera = ({ instant = false } = {}) => {
    if (!localMode()) return;
    state.full = fullForMode(modeNow());
    const point = readNodePoint(activeNode()) || { x: state.full.width / 2, y: state.full.height / 2 };
    let cx = point.x;
    let cy = point.y;
    if (modeNow() === 'overview') cy = 385;
    if (modeNow() === 'work') cy = 385;
    animateCamera({ cx, cy, zoom: defaultZoom(modeNow()) }, instant ? 0 : 420);
  };

  const zoomAt = (factor, screenX = null, screenY = null) => {
    if (!localMode()) return;
    const vp = viewport();
    if (!vp) return;
    const rect = vp.getBoundingClientRect();
    const before = cameraBox();
    const px = screenX == null ? rect.width / 2 : screenX - rect.left;
    const py = screenY == null ? rect.height / 2 : screenY - rect.top;
    const worldX = before.x + (px / Math.max(1, rect.width)) * before.width;
    const worldY = before.y + (py / Math.max(1, rect.height)) * before.height;
    const nextZoom = clamp(state.camera.zoom * factor, .68, 2.65);
    state.camera.zoom = nextZoom;
    const after = cameraBox();
    state.camera.cx = worldX - (px / Math.max(1, rect.width)) * after.width + after.width / 2;
    state.camera.cy = worldY - (py / Math.max(1, rect.height)) * after.height + after.height / 2;
    applyCamera();
  };

  const panBy = (dxPixels, dyPixels) => {
    if (!localMode()) return;
    const vp = viewport();
    if (!vp) return;
    const box = cameraBox();
    state.camera.cx -= dxPixels * box.width / Math.max(1, vp.clientWidth);
    state.camera.cy -= dyPixels * box.height / Math.max(1, vp.clientHeight);
    applyCamera();
  };

  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  const pointerDown = event => {
    if (!localMode() || event.button > 0) return;
    const vp = viewport();
    if (!vp || !vp.contains(event.target)) return;
    state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    state.dragged = false;
    vp.setPointerCapture?.(event.pointerId);
    if (state.pointers.size === 1) {
      state.gesture = { type: 'pan', last: { x: event.clientX, y: event.clientY } };
    } else if (state.pointers.size === 2) {
      const [a, b] = [...state.pointers.values()];
      state.gesture = { type: 'pinch', distance: distance(a, b), midpoint: midpoint(a, b) };
    }
  };

  const pointerMove = event => {
    if (!state.pointers.has(event.pointerId) || !localMode()) return;
    const previous = state.pointers.get(event.pointerId);
    state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (Math.hypot(event.clientX - previous.x, event.clientY - previous.y) > 2) state.dragged = true;

    if (state.pointers.size === 1 && state.gesture?.type === 'pan') {
      const current = { x: event.clientX, y: event.clientY };
      panBy(current.x - state.gesture.last.x, current.y - state.gesture.last.y);
      state.gesture.last = current;
      event.preventDefault();
      return;
    }
    if (state.pointers.size === 2) {
      const [a, b] = [...state.pointers.values()];
      const nextDistance = Math.max(1, distance(a, b));
      const nextMidpoint = midpoint(a, b);
      if (state.gesture?.type !== 'pinch') {
        state.gesture = { type: 'pinch', distance: nextDistance, midpoint: nextMidpoint };
        return;
      }
      const factor = nextDistance / Math.max(1, state.gesture.distance);
      zoomAt(factor, nextMidpoint.x, nextMidpoint.y);
      panBy(nextMidpoint.x - state.gesture.midpoint.x, nextMidpoint.y - state.gesture.midpoint.y);
      state.gesture.distance = nextDistance;
      state.gesture.midpoint = nextMidpoint;
      state.dragged = true;
      event.preventDefault();
    }
  };

  const pointerEnd = event => {
    const vp = viewport();
    if (state.pointers.has(event.pointerId)) {
      state.pointers.delete(event.pointerId);
      vp?.releasePointerCapture?.(event.pointerId);
    }
    if (state.dragged) state.suppressClickUntil = performance.now() + 120;
    if (state.pointers.size === 1) {
      const p = [...state.pointers.values()][0];
      state.gesture = { type: 'pan', last: p };
    } else if (!state.pointers.size) {
      state.gesture = null;
    }
  };

  const suppressDraggedClick = event => {
    if (performance.now() < state.suppressClickUntil && event.target.closest?.('.site-graph-node,.work-theme-label-v5,.work-project-anchor-v5')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  const createButton = (label, className, action, aria = label) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.setAttribute('aria-label', aria);
    button.addEventListener('click', action);
    return button;
  };

  const closeSheet = () => {
    if (!state.sheet) return;
    state.sheet.classList.remove('is-open');
    state.sheetBackdrop?.classList.remove('is-open');
    state.modeButton?.setAttribute('aria-expanded', 'false');
  };

  const openSheet = title => {
    if (!state.sheet) return;
    state.sheetTitle.textContent = title;
    state.sheet.classList.add('is-open');
    state.sheetBackdrop?.classList.add('is-open');
    state.modeButton?.setAttribute('aria-expanded', 'true');
  };

  const toggleModeSheet = () => {
    if (!state.sheet || !state.modeButton) return;
    if (state.sheet.classList.contains('is-open')) return closeSheet();
    const mode = modeNow();
    if (mode === 'work') openSheet('Work filters');
    else if (mode === 'atlas') openSheet('Atlas layers');
  };

  const buildChrome = () => {
    const scene = $('.scene-canvas');
    if (!scene || state.dock) return;

    const dock = document.createElement('div');
    dock.className = 'mobile-graph-dock';
    dock.setAttribute('aria-label', 'Graph controls');
    dock.append(
      createButton('−', 'mobile-camera-button', () => localMode() ? zoomAt(.82) : $('#atlas-zoom-out')?.click(), 'Zoom out'),
      createButton('+', 'mobile-camera-button', () => localMode() ? zoomAt(1.22) : $('#atlas-zoom-in')?.click(), 'Zoom in'),
      createButton('Center', 'mobile-camera-fit', () => localMode() ? resetCamera() : $('#atlas-fit')?.click(), 'Center graph')
    );
    const modeButton = createButton('Filters', 'mobile-mode-button', toggleModeSheet, 'Open segment controls');
    modeButton.setAttribute('aria-expanded', 'false');
    dock.append(modeButton);

    const backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'mobile-sheet-backdrop';
    backdrop.setAttribute('aria-label', 'Close controls');
    backdrop.addEventListener('click', closeSheet);

    const sheet = document.createElement('section');
    sheet.className = 'mobile-control-sheet';
    sheet.setAttribute('aria-label', 'Segment controls');
    const head = document.createElement('div');
    head.className = 'mobile-control-sheet-head';
    const title = document.createElement('strong');
    const close = createButton('×', 'mobile-sheet-close', closeSheet, 'Close controls');
    head.append(title, close);
    const body = document.createElement('div');
    body.className = 'mobile-control-sheet-body';
    sheet.append(head, body);
    scene.append(backdrop, sheet, dock);

    state.dock = dock;
    state.modeButton = modeButton;
    state.sheet = sheet;
    state.sheetBody = body;
    state.sheetTitle = title;
    state.sheetBackdrop = backdrop;
  };

  const adoptModeControls = () => {
    if (!state.sheetBody) return;
    const workControls = $('.integrated-work-controls');
    const atlasControls = $('#atlas-controls');
    if (workControls && workControls.parentElement !== state.sheetBody) {
      workControls.classList.add('mobile-adopted-controls');
      state.sheetBody.appendChild(workControls);
    }
    if (atlasControls && atlasControls.parentElement !== state.sheetBody) {
      atlasControls.classList.add('mobile-adopted-controls');
      state.sheetBody.appendChild(atlasControls);
    }
  };

  const registerSceneObject = (mode, element, options = {}) => {
    const el = typeof element === 'string' ? $(element) : element;
    if (!el) return null;
    const key = options.key || `${mode}:${state.registeredObjects.size}`;
    el.classList.add('mobile-scene-object');
    el.dataset.mobileScene = mode;
    if (options.slot) el.dataset.mobileSlot = options.slot;
    state.registeredObjects.set(key, { mode, element: el, ...options });
    return key;
  };

  const registerExistingObjects = () => {
    registerSceneObject('overview', '.hero-copy', { key: 'overview-copy', slot: 'north-west' });
    registerSceneObject('overview', '.hero-visual.profile-identity', { key: 'overview-portrait', slot: 'north-east' });
    const workControls = $('.integrated-work-controls');
    if (workControls) registerSceneObject('work', workControls, { key: 'work-controls', slot: 'sheet' });
    const atlasControls = $('#atlas-controls');
    if (atlasControls) registerSceneObject('atlas', atlasControls, { key: 'atlas-controls', slot: 'sheet' });
  };

  const syncMode = ({ reset = true } = {}) => {
    state.mode = modeNow();
    document.body.classList.add('mobile-app-mode');
    document.body.dataset.mobileSceneMode = state.mode;
    adoptModeControls();
    registerExistingObjects();
    closeSheet();

    if (state.modeButton) {
      const hasSheet = state.mode === 'work' || state.mode === 'atlas';
      state.modeButton.hidden = !hasSheet;
      state.modeButton.textContent = state.mode === 'atlas' ? 'Layers' : 'Filters';
    }
    if (state.dock) state.dock.classList.toggle('is-atlas', state.mode === 'atlas');

    if (reset && localMode()) {
      [70, 420, 1080].forEach((delay, index) => setTimeout(() => resetCamera({ instant: index < 2 }), delay));
    }
  };

  const bindViewport = () => {
    const vp = viewport();
    if (!vp || vp.dataset.mobileGestures === 'true') return;
    vp.dataset.mobileGestures = 'true';
    vp.addEventListener('pointerdown', pointerDown, { passive: true });
    vp.addEventListener('pointermove', pointerMove, { passive: false });
    vp.addEventListener('pointerup', pointerEnd, { passive: true });
    vp.addEventListener('pointercancel', pointerEnd, { passive: true });
    vp.addEventListener('click', suppressDraggedClick, true);
  };

  const boot = () => {
    if (!mq.matches || state.ready) return;
    if (!$('.scene-canvas') || !viewport()) {
      setTimeout(boot, 60);
      return;
    }
    state.ready = true;
    document.documentElement.classList.add('mobile-profile-app');
    buildChrome();
    bindViewport();
    adoptModeControls();
    registerExistingObjects();
    syncMode({ reset: true });

    const observer = new MutationObserver(mutations => {
      const modeChanged = mutations.some(m => m.type === 'attributes' && m.target === document.body && m.attributeName === 'data-graph-mode');
      if (modeChanged) syncMode({ reset: true });
      adoptModeControls();
      bindViewport();
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-graph-mode'], childList: true, subtree: true });

    window.addEventListener('hashchange', () => syncMode({ reset: true }));
    window.addEventListener('orientationchange', () => setTimeout(() => resetCamera({ instant: true }), 140));
    window.addEventListener('resize', () => {
      if (!mq.matches) return;
      applyCamera();
    });

    window.MobileProfileScene = {
      registerSceneObject,
      resetCamera,
      zoomIn: () => zoomAt(1.2),
      zoomOut: () => zoomAt(.84),
      closeSheet
    };
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 0), { once: true });
  } else {
    setTimeout(boot, 0);
  }
})();