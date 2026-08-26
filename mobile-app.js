(() => {
  const mq = window.matchMedia('(max-width: 900px)');
  if (!mq.matches) return;

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const modeNow = () => document.body.dataset.graphMode || 'overview';
  const localMode = () => modeNow() !== 'atlas';
  const routeKey = () => document.body.dataset.graphRoute || (location.hash || '#overview').replace(/^#/, '') || 'overview';

  /* ----------------------------------------------------------------------
     Portrait projection

     Desktop layout/data coordinates remain untouched. Mobile maps renderer
     coordinates into a portrait-friendly visual plane. Work deliberately keeps
     more horizontal room than the other fragments because its theme labels are
     wider and form the first lattice rank.
     ---------------------------------------------------------------------- */
  const projections = {
    local: { centreX: 600, originY: 42, scaleX: .58, scaleY: 1.30, fullHeight: 1020 },
    work: { centreX: 600, originY: 38, scaleX: .82, scaleY: 1.18, fullHeight: 1020 }
  };
  const projectionFor = mode => mode === 'work' ? projections.work : projections.local;
  const mapPoint = (point, mode = modeNow()) => {
    const p = projectionFor(mode);
    return {
      x: p.centreX + (point.x - p.centreX) * p.scaleX,
      y: p.originY + (point.y - p.originY) * p.scaleY
    };
  };

  const numberPattern = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;

  const projectPath = (value, mode = modeNow()) => {
    const p = projectionFor(mode);
    let index = 0;
    return String(value).replace(numberPattern, token => {
      const number = Number(token);
      const projected = index % 2 === 0
        ? p.centreX + (number - p.centreX) * p.scaleX
        : p.originY + (number - p.originY) * p.scaleY;
      index += 1;
      return projected.toFixed(1);
    });
  };

  window.ProfileMobileProjection = {
    activeFor: mode => mq.matches && mode !== 'atlas',
    mapPoint: (point, mode = modeNow()) => mapPoint(point, mode),
    projectPath: (value, mode = modeNow()) => projectPath(value, mode)
  };
  window.dispatchEvent(new CustomEvent('profile:mobile-projection-ready'));

  const baseNodes = () => $$('#site-graph .site-graph-node[data-node-id]')
    .filter(element => !element.closest('.v9-transition-overlay'));
  const baseEdges = () => $$('#site-graph .site-graph-edges path[data-source][data-target]')
    .filter(element => !element.closest('.v9-transition-overlay'));

  const dataPoint = element => {
    if (!element) return null;
    const x = Number(element.dataset.x);
    const y = Number(element.dataset.y);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  };

  const setProjectedTransform = (element, point, mode = modeNow()) => {
    const mapped = mapPoint(point, mode);
    element.setAttribute('transform', `translate(${mapped.x.toFixed(1)} ${mapped.y.toFixed(1)})`);
  };

  const stableNumber = value => {
    let number = 2166136261;
    for (const character of String(value)) number = Math.imul(number ^ character.charCodeAt(0), 16777619);
    return number >>> 0;
  };

  const edgeDesktopPath = (source, target, key) => {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    if (Math.abs(dx) < 5) return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const bend = Math.max(-28, Math.min(28, (stableNumber(key) % 35) - 17));
    const nx = -dy / distance;
    const ny = dx / distance;
    const control = {
      x: (source.x + target.x) / 2 + nx * bend,
      y: (source.y + target.y) / 2 + ny * bend
    };
    return `M ${source.x} ${source.y} Q ${control.x.toFixed(1)} ${control.y.toFixed(1)} ${target.x} ${target.y}`;
  };

  const syncEdgesFromData = () => {
    if (!localMode()) return;
    const points = new Map(baseNodes().map(element => [element.dataset.nodeId, dataPoint(element)]));
    baseEdges().forEach(edge => {
      const source = points.get(edge.dataset.source);
      const target = points.get(edge.dataset.target);
      if (!source || !target) return;
      const desktopPath = edgeDesktopPath(source, target, `${edge.dataset.source}|${edge.dataset.target}`);
      edge.setAttribute('d', projectPath(desktopPath));
    });
  };

  const projectBaseFromData = () => {
    if (!localMode()) return;
    baseNodes().forEach(element => {
      const point = dataPoint(element);
      if (point) setProjectedTransform(element, point);
    });
    syncEdgesFromData();
  };

  const unprojectBaseForAtlas = () => {
    if (modeNow() !== 'atlas') return;
    baseNodes().forEach(element => {
      const point = dataPoint(element);
      if (point) element.setAttribute('transform', `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`);
    });
  };

  /* ----------------------------------------------------------------------
     Stable-layout guard

     The desktop renderer and route-transition overlay settle asynchronously.
     Mobile now waits for the transition to finish, then validates the actual
     data coordinates. A known-good route snapshot is restored if a late render
     has collapsed several nodes onto one point. Overview/focus also have a
     deterministic fallback so the scene can recover on its first bad visit.
     ---------------------------------------------------------------------- */
  const layoutCache = new Map();
  const graphNodes = window.SITE_DATA?.graph?.nodes || [];
  const graphNodeMap = new Map(graphNodes.map(node => [node.id, node]));
  const childrenFor = id => graphNodes.filter(node => node.parentIds?.includes(id));

  const pointBounds = entries => {
    const points = entries.map(([, point]) => point).filter(Boolean);
    if (!points.length) return null;
    return {
      width: Math.max(...points.map(point => point.x)) - Math.min(...points.map(point => point.x)),
      height: Math.max(...points.map(point => point.y)) - Math.min(...points.map(point => point.y))
    };
  };

  const currentDataEntries = () => baseNodes()
    .map(element => [element.dataset.nodeId, dataPoint(element)])
    .filter(([, point]) => point);

  const collapsedLocalLayout = entries => {
    if (entries.length < 4) return false;
    const bounds = pointBounds(entries);
    return !bounds || bounds.width < 235 || bounds.height < 155;
  };

  const applyDataLayout = positions => {
    baseNodes().forEach(element => {
      const point = positions.get(element.dataset.nodeId);
      if (!point) return;
      element.dataset.x = String(point.x);
      element.dataset.y = String(point.y);
      setProjectedTransform(element, point);
    });
    syncEdgesFromData();
  };

  const overviewFallback = ids => {
    const positions = new Map();
    const desired = new Map([
      ['stepan-chrast', { x: 600, y: 145 }],
      ['work', { x: 350, y: 390 }],
      ['knowledge', { x: 600, y: 365 }],
      ['experience', { x: 850, y: 390 }],
      ['education', { x: 455, y: 575 }],
      ['about', { x: 745, y: 575 }]
    ]);
    ids.forEach(id => desired.has(id) && positions.set(id, desired.get(id)));
    return positions;
  };

  const focusFallback = ids => {
    const positions = new Map();
    const visible = new Set(ids);
    const selected = baseNodes().find(element => element.classList.contains('is-selected'))?.dataset.nodeId;
    const activeId = selected || ids.find(id => id !== 'stepan-chrast') || 'stepan-chrast';
    const active = graphNodeMap.get(activeId);
    if (!active) return positions;

    const path = [];
    const seen = new Set();
    let cursor = active;
    while (cursor && !seen.has(cursor.id)) {
      if (visible.has(cursor.id)) path.unshift(cursor.id);
      seen.add(cursor.id);
      cursor = cursor.parentIds?.[0] ? graphNodeMap.get(cursor.parentIds[0]) : null;
    }

    path.slice(0, -1).forEach((id, index, list) => {
      positions.set(id, {
        x: 455 + index * Math.min(62, 180 / Math.max(1, list.length)),
        y: 105 + index * 58
      });
    });
    positions.set(activeId, { x: 600, y: 275 });

    const depth = new Map([[activeId, 0]]);
    const queue = [activeId];
    while (queue.length) {
      const parent = queue.shift();
      const next = depth.get(parent) + 1;
      childrenFor(parent).forEach(child => {
        if (!visible.has(child.id) || depth.has(child.id)) return;
        depth.set(child.id, next);
        queue.push(child.id);
      });
    }

    [1, 2, 3].forEach(rank => {
      const rankIds = ids.filter(id => depth.get(id) === rank);
      rankIds.forEach((id, index) => {
        const columns = rankIds.length === 1 ? 1 : 2;
        const col = index % columns;
        const row = Math.floor(index / columns);
        const x = columns === 1 ? 600 : (col === 0 ? 455 : 745);
        const yBase = rank === 1 ? 455 : rank === 2 ? 665 : 845;
        positions.set(id, { x, y: yBase + row * 128 });
      });
    });

    ids.filter(id => !positions.has(id)).forEach((id, index) => {
      positions.set(id, { x: index % 2 ? 745 : 455, y: 835 + Math.floor(index / 2) * 120 });
    });
    return positions;
  };

  const repairLocalLayout = () => {
    if (!localMode()) return;
    const entries = currentDataEntries();
    const key = routeKey();
    const ids = entries.map(([id]) => id);
    const collapsed = collapsedLocalLayout(entries);

    if (!collapsed) {
      layoutCache.set(key, new Map(entries.map(([id, point]) => [id, { ...point }])));
      projectBaseFromData();
      return;
    }

    const cached = layoutCache.get(key);
    if (cached && ids.every(id => cached.has(id))) {
      applyDataLayout(cached);
      return;
    }

    if (modeNow() === 'overview') {
      applyDataLayout(overviewFallback(ids));
      return;
    }
    if (modeNow() === 'focus') {
      applyDataLayout(focusFallback(ids));
      return;
    }
    projectBaseFromData();
  };

  const atlasLooksCollapsed = () => {
    const entries = currentDataEntries();
    if (entries.length < 20) return false;
    const bounds = pointBounds(entries);
    return !bounds || bounds.width < 1050 || bounds.height < 650;
  };

  let atlasRepairing = false;
  const repairAtlasLayout = () => {
    if (modeNow() !== 'atlas' || atlasRepairing) return;
    unprojectBaseForAtlas();
    if (!atlasLooksCollapsed()) return;
    const control = $('#atlas-crosslinks');
    if (!control) return;
    atlasRepairing = true;
    const original = control.checked;
    control.checked = !original;
    control.dispatchEvent(new Event('change', { bubbles: true }));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      control.checked = original;
      control.dispatchEvent(new Event('change', { bubbles: true }));
      setTimeout(() => {
        $('#atlas-fit')?.click();
        atlasRepairing = false;
      }, 90);
    }));
  };

  const state = {
    ready: false,
    camera: { cx: 600, cy: 480, zoom: .78 },
    pointers: new Map(),
    gesture: null,
    dragged: false,
    suppressClickUntil: 0,
    atlasPointers: new Map(),
    atlasPinching: false,
    atlasPinchDistance: 0,
    cameraFrame: 0,
    settleTimer: 0,
    settleToken: 0,
    dock: null,
    modeButton: null,
    sheet: null,
    sheetBody: null,
    sheetTitle: null,
    sheetBackdrop: null,
    registeredObjects: new Map()
  };

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

  const visiblePoints = () => baseNodes().map(element => {
    const point = dataPoint(element);
    return point ? mapPoint(point) : null;
  }).filter(Boolean);

  const cameraAspect = () => {
    const vp = viewport();
    return clamp((vp?.clientWidth || innerWidth) / Math.max(1, vp?.clientHeight || innerHeight), .40, 1.35);
  };

  const cameraBox = () => {
    const fullHeight = projectionFor(modeNow()).fullHeight;
    const height = fullHeight / state.camera.zoom;
    const width = height * cameraAspect();
    return { width, height, x: state.camera.cx - width / 2, y: state.camera.cy - height / 2 };
  };

  const constrainCamera = () => {
    const box = cameraBox();
    const marginX = box.width * .30;
    const marginY = box.height * .24;
    state.camera.cx = clamp(state.camera.cx, 110 - marginX + box.width / 2, 1090 + marginX - box.width / 2);
    state.camera.cy = clamp(state.camera.cy, -120 - marginY + box.height / 2, 1210 + marginY - box.height / 2);
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
    state.cameraFrame = 0;
    const start = { ...state.camera };
    if (reduced.matches || !duration) {
      Object.assign(state.camera, target);
      applyCamera();
      return;
    }
    const started = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);
    const frame = now => {
      const raw = Math.min(1, (now - started) / duration);
      const progress = ease(raw);
      state.camera.cx = start.cx + (target.cx - start.cx) * progress;
      state.camera.cy = start.cy + (target.cy - start.cy) * progress;
      state.camera.zoom = start.zoom + (target.zoom - start.zoom) * progress;
      applyCamera();
      if (raw < 1) state.cameraFrame = requestAnimationFrame(frame);
      else state.cameraFrame = 0;
    };
    state.cameraFrame = requestAnimationFrame(frame);
  };

  const fitTarget = () => {
    const points = visiblePoints();
    if (!points.length) return { cx: 600, cy: 480, zoom: .68 };
    let minX = Math.min(...points.map(point => point.x));
    let maxX = Math.max(...points.map(point => point.x));
    let minY = Math.min(...points.map(point => point.y));
    let maxY = Math.max(...points.map(point => point.y));
    const padX = modeNow() === 'work' ? 92 : 78;
    const padY = modeNow() === 'overview' ? 64 : 86;
    minX -= padX; maxX += padX; minY -= padY; maxY += padY;
    const width = Math.max(320, maxX - minX);
    const height = Math.max(430, maxY - minY);
    const requiredHeight = Math.max(height, width / cameraAspect());
    let zoom = projectionFor(modeNow()).fullHeight / requiredHeight * .78;
    zoom = clamp(zoom, .46, modeNow() === 'work' ? .82 : .84);
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, zoom };
  };

  const resetCamera = ({ instant = false } = {}) => {
    if (!localMode()) return;
    animateCamera(fitTarget(), instant ? 0 : 380);
  };

  const settleScene = ({ instant = false } = {}) => {
    const token = ++state.settleToken;
    clearTimeout(state.settleTimer);
    const poll = attempt => {
      if (token !== state.settleToken) return;
      if (document.body.classList.contains('is-v9-transitioning')) {
        state.settleTimer = setTimeout(() => poll(attempt + 1), 55);
        return;
      }
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (token !== state.settleToken) return;
        if (localMode()) {
          repairLocalLayout();
          resetCamera({ instant });
        } else {
          repairAtlasLayout();
        }
      }));
    };
    state.settleTimer = setTimeout(() => poll(0), 45);
  };

  const interruptCameraAutomation = () => {
    ++state.settleToken;
    clearTimeout(state.settleTimer);
    state.settleTimer = 0;
    cancelAnimationFrame(state.cameraFrame);
    state.cameraFrame = 0;
  };

  const zoomAt = (factor, screenX = null, screenY = null) => {
    if (!localMode()) return;
    const vp = viewport();
    if (!vp) return;
    interruptCameraAutomation();
    const rect = vp.getBoundingClientRect();
    const before = cameraBox();
    const px = screenX == null ? rect.width / 2 : screenX - rect.left;
    const py = screenY == null ? rect.height / 2 : screenY - rect.top;
    const worldX = before.x + px / Math.max(1, rect.width) * before.width;
    const worldY = before.y + py / Math.max(1, rect.height) * before.height;
    state.camera.zoom = clamp(state.camera.zoom * factor, .40, 2.35);
    const after = cameraBox();
    state.camera.cx = worldX - px / Math.max(1, rect.width) * after.width + after.width / 2;
    state.camera.cy = worldY - py / Math.max(1, rect.height) * after.height + after.height / 2;
    applyCamera();
  };

  const panBy = (dx, dy) => {
    if (!localMode()) return;
    const vp = viewport();
    if (!vp) return;
    interruptCameraAutomation();
    const box = cameraBox();
    state.camera.cx -= dx * box.width / Math.max(1, vp.clientWidth);
    state.camera.cy -= dy * box.height / Math.max(1, vp.clientHeight);
    applyCamera();
  };

  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  const pointerDown = event => {
    if (!localMode() || event.button > 0) return;
    const vp = viewport();
    if (!vp?.contains(event.target)) return;
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
    if (!localMode() || !state.pointers.has(event.pointerId)) return;
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
      zoomAt(nextDistance / Math.max(1, state.gesture.distance), nextMidpoint.x, nextMidpoint.y);
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
      const point = [...state.pointers.values()][0];
      state.gesture = { type: 'pan', last: point };
    } else if (!state.pointers.size) {
      state.gesture = null;
    }
  };

  const suppressDraggedClick = event => {
    if (
      performance.now() < state.suppressClickUntil &&
      event.target.closest?.('.site-graph-node,.work-theme-label-v5,.work-project-anchor-v5')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  /* Atlas one-finger pan remains owned by site-graph.js. Pinch uses the real
     Atlas zoom buttons, which is more reliable on mobile Safari/Chrome than a
     synthetic wheel event. */
  const atlasDown = event => {
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

  const atlasMove = event => {
    if (modeNow() !== 'atlas' || !state.atlasPointers.has(event.pointerId)) return;
    state.atlasPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!state.atlasPinching || state.atlasPointers.size < 2) return;
    const [a, b] = [...state.atlasPointers.values()];
    const nextDistance = Math.max(1, distance(a, b));
    const ratio = nextDistance / Math.max(1, state.atlasPinchDistance);
    if (ratio > 1.035) {
      $('#atlas-zoom-in')?.click();
      state.atlasPinchDistance = nextDistance;
    } else if (ratio < .966) {
      $('#atlas-zoom-out')?.click();
      state.atlasPinchDistance = nextDistance;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  const atlasEnd = event => {
    if (!state.atlasPointers.has(event.pointerId)) return;
    state.atlasPointers.delete(event.pointerId);
    if (state.atlasPointers.size < 2) {
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
    if (modeNow() === 'work') openSheet('Work filters');
    else if (modeNow() === 'atlas') openSheet('Atlas layers');
  };

  const atlasClick = selector => document.querySelector(selector)?.click();

  const buildChrome = () => {
    const scene = $('.scene-canvas');
    if (!scene || state.dock) return;
    const dock = document.createElement('div');
    dock.className = 'mobile-graph-dock';
    dock.setAttribute('aria-label', 'Graph controls');
    dock.append(
      createButton('−', 'mobile-camera-button', () => localMode() ? zoomAt(.82) : atlasClick('#atlas-zoom-out'), 'Zoom out'),
      createButton('+', 'mobile-camera-button', () => localMode() ? zoomAt(1.22) : atlasClick('#atlas-zoom-in'), 'Zoom in'),
      createButton('Center', 'mobile-camera-fit', () => localMode() ? resetCamera() : atlasClick('#atlas-fit'), 'Center graph')
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
    Object.assign(state, { dock, modeButton, sheet, sheetBody: body, sheetTitle: title, sheetBackdrop: backdrop });
  };

  const adoptModeControls = () => {
    if (!state.sheetBody) return;
    const work = $('.integrated-work-controls');
    const atlas = $('#atlas-controls');
    if (work && work.parentElement !== state.sheetBody) {
      work.classList.add('mobile-adopted-controls');
      state.sheetBody.appendChild(work);
    }
    if (atlas && atlas.parentElement !== state.sheetBody) {
      atlas.classList.add('mobile-adopted-controls');
      state.sheetBody.appendChild(atlas);
    }
  };

  const registerSceneObject = (mode, element, options = {}) => {
    const target = typeof element === 'string' ? $(element) : element;
    if (!target) return null;
    const key = options.key || `${mode}:${state.registeredObjects.size}`;
    target.classList.add('mobile-scene-object');
    target.dataset.mobileScene = mode;
    if (options.slot) target.dataset.mobileSlot = options.slot;
    state.registeredObjects.set(key, { mode, element: target, ...options });
    return key;
  };

  const registerExistingObjects = () => {
    registerSceneObject('overview', '.hero-copy', { key: 'overview-copy', slot: 'north-west' });
    registerSceneObject('overview', '.hero-visual.profile-identity', { key: 'overview-portrait', slot: 'north-east' });
    const work = $('.integrated-work-controls');
    if (work) registerSceneObject('work', work, { key: 'work-controls', slot: 'sheet' });
    const atlas = $('#atlas-controls');
    if (atlas) registerSceneObject('atlas', atlas, { key: 'atlas-controls', slot: 'sheet' });
  };

  const syncMode = () => {
    document.body.classList.add('mobile-app-mode');
    document.body.dataset.mobileSceneMode = modeNow();
    adoptModeControls();
    registerExistingObjects();
    closeSheet();
    if (state.modeButton) {
      const hasSheet = modeNow() === 'work' || modeNow() === 'atlas';
      state.modeButton.hidden = !hasSheet;
      state.modeButton.textContent = modeNow() === 'atlas' ? 'Layers' : 'Filters';
    }
    state.dock?.classList.toggle('is-atlas', modeNow() === 'atlas');
    settleScene({ instant: true });
  };

  const bindViewport = () => {
    const vp = viewport();
    if (!vp || vp.dataset.mobileGestures === 'true') return;
    vp.dataset.mobileGestures = 'true';
    vp.addEventListener('pointerdown', atlasDown, { capture: true, passive: false });
    vp.addEventListener('pointermove', atlasMove, { capture: true, passive: false });
    vp.addEventListener('pointerup', atlasEnd, { capture: true, passive: true });
    vp.addEventListener('pointercancel', atlasEnd, { capture: true, passive: true });
    vp.addEventListener('pointerdown', pointerDown, { passive: true });
    vp.addEventListener('pointermove', pointerMove, { passive: false });
    vp.addEventListener('pointerup', pointerEnd, { passive: true });
    vp.addEventListener('pointercancel', pointerEnd, { passive: true });
    vp.addEventListener('click', suppressDraggedClick, true);
  };

  const projectInitialGraph = () => {
    if (localMode()) {
      projectBaseFromData();
      $$('#site-graph .work-project-anchor-v5,#site-graph .work-theme-label-v5').forEach(element => {
        const transform = element.getAttribute('transform');
        if (transform) element.setAttribute('transform', transform);
      });
    } else {
      unprojectBaseForAtlas();
    }
  };

  const boot = () => {
    if (!mq.matches || state.ready) return;
    if (!$('.scene-canvas') || !viewport() || !svg()) {
      setTimeout(boot, 60);
      return;
    }
    state.ready = true;
    document.documentElement.classList.add('mobile-profile-app');
    projectInitialGraph();
    buildChrome();
    bindViewport();
    adoptModeControls();
    registerExistingObjects();
    syncMode();

    const refreshRuntimeBindings = () => {
      adoptModeControls();
      bindViewport();
    };
    window.addEventListener('profile:scene-state', () => {
      syncMode();
      refreshRuntimeBindings();
    });
    window.addEventListener('profile:graph-render-settled', () => {
      refreshRuntimeBindings();
      settleScene({ instant: true });
    });
    ['profile:transition-finish', 'profile:transition-cancel', 'profile:graph-transition-interrupted']
      .forEach(type => window.addEventListener(type, () => {
        refreshRuntimeBindings();
        settleScene();
      }));

    window.addEventListener('hashchange', () => settleScene());
    window.addEventListener('orientationchange', () => setTimeout(() => settleScene({ instant: true }), 140));
    window.addEventListener('resize', () => {
      if (!mq.matches) return;
      settleScene({ instant: true });
    });

    window.MobileProfileScene = {
      registerSceneObject,
      resetCamera,
      fitGraph: resetCamera,
      repair: settleScene,
      zoomIn: () => localMode() ? zoomAt(1.2) : atlasClick('#atlas-zoom-in'),
      zoomOut: () => localMode() ? zoomAt(.84) : atlasClick('#atlas-zoom-out'),
      closeSheet,
      projectionFor,
      mapPoint,
      projectPath
    };
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 0), { once: true });
  } else {
    setTimeout(boot, 0);
  }
})();
