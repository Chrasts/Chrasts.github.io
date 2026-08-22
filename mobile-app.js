(() => {
  const mq = window.matchMedia('(max-width: 900px)');
  if (!mq.matches) return;

  /* ----------------------------------------------------------------------
     Mobile-only visual projection

     The desktop graph is authored in a 1200px-wide landscape coordinate
     system. Phones are normally portrait. Rather than shrinking that landscape
     graph, mobile applies a deterministic projection to every local graph
     position: horizontal distances contract and vertical distances expand.
     The underlying data coordinates stay untouched, so desktop layout and the
     existing transition engine remain authoritative.
     ---------------------------------------------------------------------- */
  const projection = {
    centreX: 600,
    originY: 50,
    scaleX: .53,
    scaleY: 1.28,
    fullHeight: 980
  };

  const mapPoint = point => ({
    x: projection.centreX + (point.x - projection.centreX) * projection.scaleX,
    y: projection.originY + (point.y - projection.originY) * projection.scaleY
  });

  const modeNow = () => document.body.dataset.graphMode || 'overview';
  const localMode = () => modeNow() !== 'atlas';
  const numberPattern = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
  const nativeSvgSetAttribute = SVGElement.prototype.setAttribute;

  const projectTranslate = value => {
    const match = String(value).match(/^translate\(\s*(-?(?:\d+\.?\d*|\.\d+))[,\s]+(-?(?:\d+\.?\d*|\.\d+))\s*\)$/i);
    if (!match) return value;
    const point = mapPoint({ x: Number(match[1]), y: Number(match[2]) });
    return `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`;
  };

  const projectPath = value => {
    let index = 0;
    return String(value).replace(numberPattern, token => {
      const number = Number(token);
      const projected = index % 2 === 0
        ? projection.centreX + (number - projection.centreX) * projection.scaleX
        : projection.originY + (number - projection.originY) * projection.scaleY;
      index += 1;
      return projected.toFixed(1);
    });
  };

  const transformProjectedElement = element =>
    element?.classList?.contains('site-graph-node') ||
    element?.classList?.contains('work-project-anchor-v5') ||
    element?.classList?.contains('work-theme-label-v5');

  SVGElement.prototype.setAttribute = function(name, value) {
    if (mq.matches && localMode()) {
      if (name === 'transform' && transformProjectedElement(this)) {
        value = projectTranslate(value);
      } else if (
        name === 'd' &&
        this.tagName?.toLowerCase() === 'path' &&
        this.parentElement?.classList?.contains('site-graph-edges')
      ) {
        value = projectPath(value);
      } else if (this.classList?.contains('site-graph-timeline')) {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
          if (name === 'x1' || name === 'x2') {
            value = projection.centreX + (numeric - projection.centreX) * projection.scaleX;
          } else if (name === 'y1' || name === 'y2') {
            value = projection.originY + (numeric - projection.originY) * projection.scaleY;
          }
        }
      }
    }
    return nativeSvgSetAttribute.call(this, name, value);
  };

  const projectExistingGraph = () => {
    if (!localMode()) return;
    document.querySelectorAll('#site-graph .site-graph-node[data-node-id]').forEach(element => {
      if (element.closest('.v9-transition-overlay')) return;
      const x = Number(element.dataset.x);
      const y = Number(element.dataset.y);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        element.setAttribute('transform', `translate(${x} ${y})`);
      }
    });
    document.querySelectorAll('#site-graph .work-project-anchor-v5,#site-graph .work-theme-label-v5').forEach(element => {
      const value = element.getAttribute('transform');
      if (value) element.setAttribute('transform', value);
    });
    document.querySelectorAll('#site-graph .site-graph-edges path[d]').forEach(path => {
      if (path.closest('.v9-transition-overlay')) return;
      const value = path.getAttribute('d');
      if (value) path.setAttribute('d', value);
    });
    const timeline = document.querySelector('#site-graph .site-graph-timeline');
    if (timeline) {
      ['x1', 'x2', 'y1', 'y2'].forEach(attribute => {
        const value = timeline.getAttribute(attribute);
        if (value != null) timeline.setAttribute(attribute, value);
      });
    }
  };

  window.__MOBILE_GRAPH_PROJECTION__ = { ...projection, mapPoint };

  /* ----------------------------------------------------------------------
     Mobile app state / camera
     ---------------------------------------------------------------------- */
  const state = {
    ready: false,
    mode: 'overview',
    camera: { cx: 600, cy: 470, zoom: .9 },
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
    registeredObjects: new Map(),
    atlasPointers: new Map(),
    atlasPinching: false,
    atlasPinchDistance: 0
  };

  const $ = selector => document.querySelector(selector);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const svg = () => $('#site-graph .site-graph-svg');
  const viewport = () => $('.site-graph-viewport');

  const ensureStyle = href => {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.profileMobileV2 = 'true';
    document.head.appendChild(link);
  };
  ensureStyle('mobile-v2.css');

  const readNodePoint = element => {
    if (!element) return null;
    const x = Number(element.dataset.x);
    const y = Number(element.dataset.y);
    return Number.isFinite(x) && Number.isFinite(y) ? mapPoint({ x, y }) : null;
  };

  const activeNode = () => {
    const mode = modeNow();
    const selector = mode === 'overview'
      ? '#site-graph .site-graph-node[data-node-id="stepan-chrast"]'
      : '#site-graph .site-graph-node.is-selected:not(.v9-transition-overlay .site-graph-node)';
    return $(selector) ||
      $('#site-graph .site-graph-node[data-node-id="work"]:not(.v9-transition-overlay .site-graph-node)') ||
      $('#site-graph .site-graph-node[data-node-id="stepan-chrast"]:not(.v9-transition-overlay .site-graph-node)');
  };

  const cameraAspect = () => {
    const vp = viewport();
    return Math.max(.42, Math.min(1.35, (vp?.clientWidth || innerWidth) / Math.max(1, vp?.clientHeight || innerHeight)));
  };

  const cameraBox = () => {
    const height = projection.fullHeight / state.camera.zoom;
    const width = height * cameraAspect();
    return {
      width,
      height,
      x: state.camera.cx - width / 2,
      y: state.camera.cy - height / 2
    };
  };

  const constrainCamera = () => {
    const box = cameraBox();
    const bounds = { left: 205, right: 995, top: -80, bottom: 1030 };
    const marginX = box.width * .28;
    const marginY = box.height * .22;
    state.camera.cx = clamp(
      state.camera.cx,
      bounds.left - marginX + box.width / 2,
      bounds.right + marginX - box.width / 2
    );
    state.camera.cy = clamp(
      state.camera.cy,
      bounds.top - marginY + box.height / 2,
      bounds.bottom + marginY - box.height / 2
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

  const visibleProjectedPoints = () => [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
    .filter(element => !element.closest('.v9-transition-overlay'))
    .map(readNodePoint)
    .filter(Boolean);

  const fitTarget = () => {
    const points = visibleProjectedPoints();
    const fallback = readNodePoint(activeNode()) || { x: 600, y: 450 };
    if (!points.length) return { cx: fallback.x, cy: fallback.y, zoom: .82 };

    let minX = Math.min(...points.map(point => point.x));
    let maxX = Math.max(...points.map(point => point.x));
    let minY = Math.min(...points.map(point => point.y));
    let maxY = Math.max(...points.map(point => point.y));

    const xPad = modeNow() === 'work' ? 58 : 66;
    const yPad = modeNow() === 'overview' ? 54 : 72;
    minX -= xPad; maxX += xPad; minY -= yPad; maxY += yPad;

    const width = Math.max(300, maxX - minX);
    const height = Math.max(390, maxY - minY);
    const requiredHeight = Math.max(height, width / cameraAspect());
    let zoom = projection.fullHeight / requiredHeight * .88;
    const maxZoom = modeNow() === 'work' ? .96 : .93;
    zoom = clamp(zoom, .56, maxZoom);

    return {
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      zoom
    };
  };

  const resetCamera = ({ instant = false } = {}) => {
    if (!localMode()) return;
    if (document.body.classList.contains('is-v9-transitioning')) {
      scheduleStableReset({ instant });
      return;
    }
    animateCamera(fitTarget(), instant ? 0 : 420);
  };

  let stableResetTimer = 0;
  const scheduleStableReset = ({ instant = false, attempt = 0 } = {}) => {
    clearTimeout(stableResetTimer);
    stableResetTimer = setTimeout(() => {
      if (document.body.classList.contains('is-v9-transitioning') && attempt < 24) {
        scheduleStableReset({ instant, attempt: attempt + 1 });
        return;
      }
      requestAnimationFrame(() => {
        projectExistingGraph();
        resetCamera({ instant });
      });
    }, attempt ? 70 : 45);
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
    state.camera.zoom = clamp(state.camera.zoom * factor, .48, 2.5);
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

  /* Atlas already owns its one-finger drag camera. Mobile adds a two-finger
     pinch gesture by feeding the same wheel-zoom path that the desktop Atlas
     renderer uses, so zoom remains centred under the fingers. */
  const atlasPointerDown = event => {
    if (modeNow() !== 'atlas' || event.pointerType === 'mouse') return;
    state.atlasPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (state.atlasPointers.size === 2) {
      const [a, b] = [...state.atlasPointers.values()];
      state.atlasPinching = true;
      state.atlasPinchDistance = Math.max(1, distance(a, b));
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const atlasPointerMove = event => {
    if (modeNow() !== 'atlas' || !state.atlasPointers.has(event.pointerId)) return;
    state.atlasPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!state.atlasPinching || state.atlasPointers.size < 2) {
      if (state.atlasPinching) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    const [a, b] = [...state.atlasPointers.values()];
    const nextDistance = Math.max(1, distance(a, b));
    const centre = midpoint(a, b);
    const ratio = nextDistance / Math.max(1, state.atlasPinchDistance);
    if (Math.abs(ratio - 1) > .004) {
      const target = svg();
      if (target) {
        target.dispatchEvent(new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          clientX: centre.x,
          clientY: centre.y,
          deltaY: -Math.log(ratio) * 520,
          deltaMode: 0
        }));
      }
      state.atlasPinchDistance = nextDistance;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  const atlasPointerEnd = event => {
    if (!state.atlasPointers.has(event.pointerId)) return;
    state.atlasPointers.delete(event.pointerId);
    if (!state.atlasPointers.size) {
      state.atlasPinching = false;
      state.atlasPinchDistance = 0;
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

  const clickAtlasControl = id => document.querySelector(id)?.click();

  const buildChrome = () => {
    const scene = $('.scene-canvas');
    if (!scene || state.dock) return;

    const dock = document.createElement('div');
    dock.className = 'mobile-graph-dock';
    dock.setAttribute('aria-label', 'Graph controls');
    dock.append(
      createButton('−', 'mobile-camera-button', () => localMode() ? zoomAt(.82) : clickAtlasControl('#atlas-zoom-out'), 'Zoom out'),
      createButton('+', 'mobile-camera-button', () => localMode() ? zoomAt(1.22) : clickAtlasControl('#atlas-zoom-in'), 'Zoom in'),
      createButton('Center', 'mobile-camera-fit', () => localMode() ? resetCamera() : clickAtlasControl('#atlas-fit'), 'Center graph')
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

    if (reset && localMode()) scheduleStableReset({ instant: false });
  };

  const bindViewport = () => {
    const vp = viewport();
    if (!vp || vp.dataset.mobileGestures === 'true') return;
    vp.dataset.mobileGestures = 'true';
    vp.addEventListener('pointerdown', atlasPointerDown, { capture: true, passive: false });
    vp.addEventListener('pointermove', atlasPointerMove, { capture: true, passive: false });
    vp.addEventListener('pointerup', atlasPointerEnd, { capture: true, passive: true });
    vp.addEventListener('pointercancel', atlasPointerEnd, { capture: true, passive: true });
    vp.addEventListener('pointerdown', pointerDown, { passive: true });
    vp.addEventListener('pointermove', pointerMove, { passive: false });
    vp.addEventListener('pointerup', pointerEnd, { passive: true });
    vp.addEventListener('pointercancel', pointerEnd, { passive: true });
    vp.addEventListener('click', suppressDraggedClick, true);
  };

  const boot = () => {
    if (!mq.matches || state.ready) return;
    if (!$('.scene-canvas') || !viewport() || !svg()) {
      setTimeout(boot, 60);
      return;
    }
    state.ready = true;
    document.documentElement.classList.add('mobile-profile-app');
    projectExistingGraph();
    buildChrome();
    bindViewport();
    adoptModeControls();
    registerExistingObjects();
    syncMode({ reset: true });

    const observer = new MutationObserver(mutations => {
      const modeChanged = mutations.some(m => m.type === 'attributes' && m.target === document.body && m.attributeName === 'data-graph-mode');
      const transitionEnded = mutations.some(m =>
        m.type === 'attributes' &&
        m.target === document.body &&
        m.attributeName === 'class' &&
        !document.body.classList.contains('is-v9-transitioning')
      );
      if (modeChanged) syncMode({ reset: true });
      if (transitionEnded && localMode()) scheduleStableReset({ instant: false });
      adoptModeControls();
      bindViewport();
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-graph-mode', 'class'],
      childList: true,
      subtree: true
    });

    window.addEventListener('hashchange', () => localMode() && scheduleStableReset({ instant: false }));
    window.addEventListener('orientationchange', () => setTimeout(() => localMode() && scheduleStableReset({ instant: true }), 150));
    window.addEventListener('resize', () => {
      if (!mq.matches || !localMode()) return;
      scheduleStableReset({ instant: true });
    });

    window.MobileProfileScene = {
      registerSceneObject,
      resetCamera,
      fitGraph: resetCamera,
      zoomIn: () => localMode() ? zoomAt(1.2) : clickAtlasControl('#atlas-zoom-in'),
      zoomOut: () => localMode() ? zoomAt(.84) : clickAtlasControl('#atlas-zoom-out'),
      closeSheet,
      projection
    };
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 0), { once: true });
  } else {
    setTimeout(boot, 0);
  }
})();