(() => {
  const graph = window.SITE_DATA?.graph;
  const profile = window.SITE_DATA?.profile || {};
  if (!graph?.nodes?.length) return;

  const rootId = graph.rootId || 'stepan-chrast';
  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const svgNS = 'http://www.w3.org/2000/svg';
  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';
  const routeNode = route => route === 'overview'
    ? nodeMap.get(rootId)
    : graph.nodes.find(node => node.route === route) || null;
  const primaryPath = node => {
    const path = [];
    const seen = new Set();
    let current = node;
    while (current && !seen.has(current.id)) {
      path.unshift(current);
      seen.add(current.id);
      current = current.parentIds?.[0] ? nodeMap.get(current.parentIds[0]) : null;
    }
    return path;
  };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const raf = () => new Promise(resolve => requestAnimationFrame(resolve));
  const waitFor = (predicate, timeout = 2600) => new Promise(resolve => {
    const started = performance.now();
    const poll = () => {
      let ok = false;
      try { ok = Boolean(predicate()); } catch (_) {}
      if (ok || performance.now() - started > timeout) return resolve(ok);
      setTimeout(poll, 24);
    };
    poll();
  });

  if (!document.querySelector('style[data-profile-intro-flash-guard]')) {
    const guard = document.createElement('style');
    guard.dataset.profileIntroFlashGuard = 'true';
    guard.textContent = [
      '.profile-intro-overlay[data-source="real-atlas"]:not(.is-auto-unfold-complete) .site-graph-node:not([data-intro-tier="root"]),',
      '.profile-intro-overlay[data-source="real-atlas"]:not(.is-auto-unfold-complete) .site-graph-edges path{opacity:0!important}',
      '.profile-intro-overlay[data-source="real-atlas"]:not(.is-auto-unfold-complete) .profile-intro-enter{opacity:0!important;pointer-events:none!important}'
    ].join('');
    document.head.appendChild(guard);
  }

  const norm = vector => {
    const length = Math.max(1e-6, Math.hypot(vector.x, vector.y));
    return { x: vector.x / length, y: vector.y / length };
  };
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const tangent = vector => ({ x: -vector.y, y: vector.x });
  const compass = Object.freeze({
    work: norm({ x: 0, y: 1 }),
    knowledge: norm({ x: 1, y: -0.02 }),
    education: norm({ x: 0.72, y: -0.69 }),
    about: norm({ x: -0.72, y: -0.69 }),
    experience: norm({ x: -0.99, y: 0.12 })
  });
  const sections = Object.keys(compass);
  const overviewRadius = id => {
    const mobile = matchMedia('(max-width: 900px)').matches;
    const map = mobile
      ? { work: 225, knowledge: 250, education: 224, about: 222, experience: 218 }
      : { work: 302, knowledge: 365, education: 322, about: 314, experience: 292 };
    return map[id] || 230;
  };
  const baseNodes = (includeOverlay = false) => [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
    .filter(element => includeOverlay || !element.closest('.v9-transition-overlay'));
  const baseEdges = () => [...document.querySelectorAll('#site-graph .site-graph-edges path[data-source][data-target]')]
    .filter(element => !element.closest('.v9-transition-overlay'));
  const setPoint = (element, point) => {
    if (!element || !point) return;
    element.setAttribute('transform', `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`);
    element.dataset.x = String(point.x);
    element.dataset.y = String(point.y);
  };
  const directionName = vector => {
    const angle = Math.atan2(vector.y, vector.x) * 180 / Math.PI;
    if (angle >= -22.5 && angle < 22.5) return 'right';
    if (angle >= 22.5 && angle < 67.5) return 'down-right';
    if (angle >= 67.5 && angle < 112.5) return 'down';
    if (angle >= 112.5 && angle < 157.5) return 'down-left';
    if (angle >= 157.5 || angle < -157.5) return 'left';
    if (angle >= -157.5 && angle < -112.5) return 'up-left';
    if (angle >= -112.5 && angle < -67.5) return 'up';
    return 'up-right';
  };

  let geometryFrame = 0;
  let geometryPinUntil = 0;
  const installGeometry = () => {
    const base = window.ProfileGeometry;
    if (!base || base.__profileCompassV3) return Boolean(base?.__profileCompassV3);
    if (base.snapshot?.().compassVersion !== 'fan-v2') return false;

    const sectionFor = id => base.sectionFor?.(id) || (sections.includes(id) ? id : null);
    const atlasCenter = base.atlasPoint(rootId) || base.snapshot?.().center || { x: 1260, y: 790 };
    const overviewCenter = base.overviewPoint(rootId) || { x: 600, y: 350 };
    const atlasCache = new Map();

    graph.nodes.forEach(node => {
      if (node.id === rootId) {
        atlasCache.set(node.id, { ...atlasCenter });
        return;
      }
      const section = sectionFor(node.id);
      const oldPoint = base.atlasPoint(node.id);
      const oldVector = base.compass?.[section];
      const nextVector = compass[section];
      if (!section || !oldPoint || !oldVector || !nextVector) {
        if (oldPoint) atlasCache.set(node.id, oldPoint);
        return;
      }
      const delta = { x: oldPoint.x - atlasCenter.x, y: oldPoint.y - atlasCenter.y };
      const radial = dot(delta, oldVector);
      const lateral = dot(delta, tangent(oldVector));
      const nextTangent = tangent(nextVector);
      atlasCache.set(node.id, {
        x: atlasCenter.x + nextVector.x * radial + nextTangent.x * lateral,
        y: atlasCenter.y + nextVector.y * radial + nextTangent.y * lateral
      });
    });

    const fitAtlas = () => {
      let maxDx = 1, maxDy = 1;
      atlasCache.forEach(point => {
        maxDx = Math.max(maxDx, Math.abs(point.x - atlasCenter.x));
        maxDy = Math.max(maxDy, Math.abs(point.y - atlasCenter.y));
      });
      const safeX = 142;
      const safeY = 132;
      const availableX = Math.min(atlasCenter.x - safeX, 2520 - safeX - atlasCenter.x);
      const availableY = Math.min(atlasCenter.y - safeY, 1580 - safeY - atlasCenter.y);
      const scaleX = Math.min(1, availableX / maxDx);
      const scaleY = Math.min(0.96, availableY / maxDy);
      atlasCache.forEach((point, id) => {
        if (id === rootId) return;
        atlasCache.set(id, {
          x: atlasCenter.x + (point.x - atlasCenter.x) * scaleX,
          y: atlasCenter.y + (point.y - atlasCenter.y) * scaleY
        });
      });
    };
    fitAtlas();

    const overviewPoint = id => {
      if (id === rootId) return { ...overviewCenter };
      const section = sectionFor(id);
      if (!section || id !== section) return base.overviewPoint(id);
      const vector = compass[section];
      const radius = overviewRadius(section);
      return {
        x: overviewCenter.x + vector.x * radius,
        y: overviewCenter.y + vector.y * radius
      };
    };
    const atlasPoint = id => atlasCache.get(id) || base.atlasPoint(id) || null;
    const vectorBetween = (sourceId, targetId) => {
      const source = atlasPoint(sourceId);
      const target = atlasPoint(targetId);
      if (source && target && Math.hypot(target.x - source.x, target.y - source.y) > 2) {
        return norm({ x: target.x - source.x, y: target.y - source.y });
      }
      const sourceVector = compass[sectionFor(sourceId)] || { x: 0, y: 0 };
      const targetVector = compass[sectionFor(targetId)] || { x: 1, y: 0 };
      return norm({ x: targetVector.x - sourceVector.x || 1, y: targetVector.y - sourceVector.y });
    };
    const placeGlobalLabel = (element, id) => {
      const label = element?.querySelector('.site-graph-label');
      const meta = element?.querySelector('.site-graph-meta');
      if (!label) return;
      if (id === rootId) {
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('x', '0');
        label.setAttribute('y', '-27');
        if (meta) {
          meta.setAttribute('text-anchor', 'middle');
          meta.setAttribute('x', '0');
          meta.setAttribute('y', '42');
        }
        return;
      }
      const vector = compass[sectionFor(id)];
      if (!vector) return;
      if (Math.abs(vector.x) > 0.58) {
        const sign = Math.sign(vector.x);
        label.setAttribute('text-anchor', sign > 0 ? 'start' : 'end');
        label.setAttribute('x', String(sign * 18));
        label.setAttribute('y', vector.y < -0.42 ? '-8' : vector.y > 0.42 ? '14' : '4');
        if (meta) {
          meta.setAttribute('text-anchor', sign > 0 ? 'start' : 'end');
          meta.setAttribute('x', String(sign * 18));
          meta.setAttribute('y', vector.y < -0.42 ? '-24' : vector.y > 0.42 ? '31' : '20');
        }
      } else {
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('x', String(vector.x * 9));
        label.setAttribute('y', vector.y < 0 ? '-21' : '29');
        if (meta) {
          meta.setAttribute('text-anchor', 'middle');
          meta.setAttribute('x', String(vector.x * 10));
          meta.setAttribute('y', vector.y < 0 ? '-37' : '45');
        }
      }
    };
    const edgePath = (from, to, edge, center) => {
      const type = edge.dataset.type || '';
      const hierarchy = ['hierarchy', 'hierarchy-alt', 'work-lattice'].includes(type);
      if (hierarchy) {
        const vector = compass[sectionFor(edge.dataset.target)] || compass[sectionFor(edge.dataset.source)];
        if (!vector || edge.dataset.source === rootId || edge.dataset.target === rootId) {
          return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} L ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
        }
        const distance = Math.max(1, Math.hypot(to.x - from.x, to.y - from.y));
        return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} C ${(from.x + vector.x * distance * 0.38).toFixed(1)} ${(from.y + vector.y * distance * 0.38).toFixed(1)} ${(to.x - vector.x * distance * 0.28).toFixed(1)} ${(to.y - vector.y * distance * 0.28).toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
      }
      const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      let outward = { x: mid.x - center.x, y: mid.y - center.y };
      if (Math.hypot(outward.x, outward.y) < 80) outward = { x: -(to.y - from.y), y: to.x - from.x };
      outward = norm(outward);
      const push = Math.min(260, Math.max(76, Math.hypot(to.x - from.x, to.y - from.y) * 0.19));
      return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${(mid.x + outward.x * push).toFixed(1)} ${(mid.y + outward.y * push).toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
    };
    const apply = () => {
      const mode = document.body?.dataset.graphMode;
      if (mode !== 'overview' && mode !== 'atlas') return true;
      const positions = new Map();
      if (mode === 'overview') {
        positions.set(rootId, overviewPoint(rootId));
        sections.forEach(id => positions.set(id, overviewPoint(id)));
      } else {
        graph.nodes.forEach(node => {
          const point = atlasPoint(node.id);
          if (point) positions.set(node.id, point);
        });
      }
      const nodes = new Map(baseNodes().map(element => [element.dataset.nodeId, element]));
      positions.forEach((point, id) => setPoint(nodes.get(id), point));
      nodes.forEach((element, id) => placeGlobalLabel(element, id));
      const center = positions.get(rootId) || atlasCenter;
      baseEdges().forEach(edge => {
        const from = positions.get(edge.dataset.source);
        const to = positions.get(edge.dataset.target);
        if (from && to) edge.setAttribute('d', edgePath(from, to, edge, center));
      });
      document.body.dataset.globalCompass = 'fan-v3';
      return true;
    };
    const stabilize = (ms = 1050) => {
      geometryPinUntil = Math.max(geometryPinUntil, performance.now() + ms);
      if (geometryFrame) return;
      const tick = now => {
        apply();
        if (now < geometryPinUntil) geometryFrame = requestAnimationFrame(tick);
        else {
          geometryFrame = 0;
          requestAnimationFrame(() => requestAnimationFrame(apply));
        }
      };
      geometryFrame = requestAnimationFrame(tick);
    };
    const api = Object.freeze({
      __profileCompassV3: true,
      compass,
      sectionFor,
      atlasPoint,
      overviewPoint,
      vectorBetween,
      directionBetween: (sourceId, targetId) => directionName(vectorBetween(sourceId, targetId)),
      apply,
      stabilize,
      snapshot: () => ({
        ...base.snapshot?.(),
        compassVersion: 'fan-v3',
        geometry: document.body?.dataset.globalGeometry || null,
        sections: Object.fromEntries(sections.map(id => [id, {
          vector: { ...compass[id] },
          atlas: atlasPoint(id),
          overview: overviewPoint(id)
        }]))
      })
    });

    window.ProfileGeometry = api;
    const graphRoot = document.querySelector('#site-graph');
    if (graphRoot) new MutationObserver(() => stabilize(1250)).observe(graphRoot, { childList: true, subtree: true });
    if (document.body) new MutationObserver(() => stabilize(1350)).observe(document.body, {
      attributes: true,
      attributeFilter: ['data-graph-mode', 'data-graph-route', 'class']
    });
    addEventListener('hashchange', () => stabilize(1500));
    addEventListener('resize', () => stabilize(1000));
    addEventListener('profile:root-activated', () => stabilize(2000));
    addEventListener('profile:intro-completed', () => stabilize(1900));
    stabilize(1450);
    return true;
  };
  const waitInstall = () => installGeometry() || requestAnimationFrame(waitInstall);
  waitInstall();

  let labelFrame = 0;
  let labelPinUntil = 0;
  let labelGuard = false;
  const setText = (element, anchor, x, y) => {
    if (!element) return;
    if (element.getAttribute('text-anchor') !== anchor) element.setAttribute('text-anchor', anchor);
    if (element.getAttribute('x') !== String(x)) element.setAttribute('x', String(x));
    if (element.getAttribute('y') !== String(y)) element.setAttribute('y', String(y));
  };
  const applyLocalLabels = () => {
    if (labelGuard || document.body?.dataset.graphMode !== 'focus') return false;
    const target = routeNode(normaliseRoute(document.body.dataset.graphRoute || location.hash));
    if (!target) return false;
    labelGuard = true;
    try {
      const path = primaryPath(target);
      const ancestorIds = new Set(path.slice(0, -1).map(node => node.id));
      baseNodes().forEach(node => {
        const id = node.dataset.nodeId;
        const label = node.querySelector('.site-graph-label');
        const meta = node.querySelector('.site-graph-meta');
        if (!label) return;
        if (ancestorIds.has(id)) {
          setText(label, 'start', 17, 4);
          setText(meta, 'start', 17, 20);
          node.dataset.localLabelRole = 'ancestor';
        } else {
          setText(label, 'middle', 0, id === rootId ? -25 : 25);
          setText(meta, 'middle', 0, 42);
          node.dataset.localLabelRole = id === target.id ? 'target' : 'branch';
        }
      });
      return true;
    } finally {
      labelGuard = false;
    }
  };
  const pinLocalLabels = (ms = 1450) => {
    labelPinUntil = Math.max(labelPinUntil, performance.now() + ms);
    if (labelFrame) return;
    const tick = now => {
      applyLocalLabels();
      if (now < labelPinUntil) labelFrame = requestAnimationFrame(tick);
      else {
        labelFrame = 0;
        requestAnimationFrame(() => requestAnimationFrame(applyLocalLabels));
      }
    };
    labelFrame = requestAnimationFrame(tick);
  };

  const graphRoot = document.querySelector('#site-graph');
  if (graphRoot) {
    new MutationObserver(mutations => {
      if (labelGuard) return;
      if (mutations.some(mutation => mutation.type === 'childList' || mutation.type === 'attributes')) pinLocalLabels(1200);
    }).observe(graphRoot, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['x', 'y', 'text-anchor']
    });
  }
  if (document.body) {
    new MutationObserver(() => {
      pinLocalLabels(1650);
      syncRootOrbit();
    }).observe(document.body, {
      attributes: true,
      attributeFilter: ['data-graph-mode', 'data-graph-route', 'data-root-landing', 'class']
    });
  }
  addEventListener('hashchange', () => pinLocalLabels(1800));

  const patchGateway = shell => {
    const enter = shell?.querySelector('.profile-intro-enter');
    if (!enter || enter.dataset.v3Gateway === 'true') return;
    enter.dataset.v3Gateway = 'true';
    ['inner', 'outer'].forEach(kind => {
      const orbit = document.createElement('i');
      orbit.className = `profile-intro-gateway-orbit is-${kind}`;
      orbit.setAttribute('aria-hidden', 'true');
      enter.prepend(orbit);
    });
  };
  const introObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        if (node.matches?.('.profile-intro-overlay')) patchGateway(node);
        node.querySelectorAll?.('.profile-intro-overlay').forEach(patchGateway);
      });
    }
  });
  if (document.body) introObserver.observe(document.body, { childList: true, subtree: true });
  document.querySelectorAll('.profile-intro-overlay').forEach(patchGateway);

  addEventListener('click', event => {
    const enter = event.target.closest?.('.profile-intro-enter');
    if (!enter) return;
    const shell = enter.closest('.profile-intro-overlay');
    shell?.classList.add('is-enter-committed');
    shell?.classList.remove('is-enter-active');
  }, true);

  const makeRootOrbit = root => {
    if (!root || root.querySelector(':scope > .profile-root-overview-orbit')) return;
    const orbit = document.createElementNS(svgNS, 'g');
    orbit.classList.add('profile-root-overview-orbit', 'is-entering');
    orbit.setAttribute('aria-hidden', 'true');
    [
      { r: 25, dash: '6 5 2 7 10 4', className: 'is-a' },
      { r: 34, dash: '3 9 12 5 4 10', className: 'is-b' }
    ].forEach(spec => {
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', '0');
      circle.setAttribute('cy', '0');
      circle.setAttribute('r', String(spec.r));
      circle.setAttribute('stroke-dasharray', spec.dash);
      circle.classList.add(spec.className);
      orbit.appendChild(circle);
    });
    const dotElement = root.querySelector('.site-graph-dot');
    root.insertBefore(orbit, dotElement || root.firstChild);
    requestAnimationFrame(() => orbit.classList.remove('is-entering'));
  };
  function syncRootOrbit() {
    if (document.querySelector('.profile-intro-overlay')) return;
    const active = document.body?.dataset.graphMode === 'overview' && document.body?.dataset.rootLanding !== 'true';
    const roots = [...document.querySelectorAll(`#site-graph .site-graph-node[data-node-id="${rootId}"]`)];
    roots.forEach(root => {
      let orbit = root.querySelector(':scope > .profile-root-overview-orbit');
      if (active) {
        if (!orbit) makeRootOrbit(root);
        else orbit.classList.remove('is-leaving');
        return;
      }
      if (!orbit) return;
      orbit.classList.add('is-leaving');
      if (!root.closest('.v9-transition-overlay')) {
        setTimeout(() => {
          if (document.body?.dataset.graphMode !== 'overview') orbit.remove();
        }, reduced.matches ? 0 : 360);
      }
    });
  }
  if (graphRoot) new MutationObserver(syncRootOrbit).observe(graphRoot, { childList: true, subtree: true });
  addEventListener('profile:root-activated', () => requestAnimationFrame(syncRootOrbit));
  addEventListener('profile:intro-completed', () => requestAnimationFrame(syncRootOrbit));
  requestAnimationFrame(syncRootOrbit);

  let atlasHandoff = null;
  const routeFromControl = target => {
    const control = target.closest?.('[data-route]');
    if (!control) return null;
    return normaliseRoute(control.dataset.route || control.getAttribute('href'));
  };
  const createAtlasSnapshot = () => {
    const viewport = document.querySelector('.site-graph-viewport');
    const svg = document.querySelector('#site-graph .site-graph-svg');
    if (!viewport || !svg || getComputedStyle(viewport).display === 'none') return null;
    const rect = viewport.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) return null;
    const shell = document.createElement('div');
    shell.className = 'profile-atlas-handoff';
    shell.setAttribute('aria-hidden', 'true');
    shell.style.left = `${rect.left}px`;
    shell.style.top = `${rect.top}px`;
    shell.style.width = `${rect.width}px`;
    shell.style.height = `${rect.height}px`;
    const clone = svg.cloneNode(true);
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
    clone.querySelectorAll('[tabindex]').forEach(element => element.removeAttribute('tabindex'));
    shell.appendChild(clone);
    document.body.appendChild(shell);
    return shell;
  };
  const setRoute = route => {
    const next = `#${route}`;
    if (location.hash === next) return;
    location.hash = next;
  };
  const beginAtlasHandoff = async targetRoute => {
    if (atlasHandoff) return false;
    const sourceMode = document.body?.dataset.graphMode;
    const shell = createAtlasSnapshot();
    atlasHandoff = { sourceMode, targetRoute, shell };
    document.body.classList.add('is-atlas-handoff');
    document.body.classList.remove('is-atlas-handoff-revealing');
    document.body.dataset.atlasHandoffTarget = targetRoute;
    setRoute(targetRoute);

    await waitFor(() => {
      const route = normaliseRoute(document.body?.dataset.graphRoute || location.hash);
      const mode = document.body?.dataset.graphMode;
      return targetRoute === 'atlas' ? mode === 'atlas' : route === targetRoute && mode !== 'atlas';
    });
    window.ProfileGeometry?.stabilize?.(1500);
    pinLocalLabels(1700);
    await raf();
    await raf();
    await raf();
    await wait(reduced.matches ? 0 : 70);
    window.ProfileGeometry?.apply?.();
    applyLocalLabels();
    syncRootOrbit();

    document.body.classList.add('is-atlas-handoff-revealing');
    shell?.classList.add('is-leaving');
    await wait(reduced.matches ? 40 : 720);
    shell?.remove();
    document.body.classList.remove('is-atlas-handoff', 'is-atlas-handoff-revealing');
    delete document.body.dataset.atlasHandoffTarget;
    atlasHandoff = null;
    window.ProfileGeometry?.stabilize?.(900);
    pinLocalLabels(900);
    return true;
  };
  const shouldOwnAtlasBoundary = targetRoute => {
    if (!targetRoute || document.querySelector('.profile-intro-overlay')) return false;
    const sourceMode = document.body?.dataset.graphMode;
    const currentRoute = normaliseRoute(document.body?.dataset.graphRoute || location.hash);
    if (targetRoute === currentRoute) return false;
    return sourceMode === 'atlas' || targetRoute === 'atlas';
  };
  addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const targetRoute = routeFromControl(event.target);
    if (!shouldOwnAtlasBoundary(targetRoute)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    beginAtlasHandoff(targetRoute);
  }, true);
  addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const targetRoute = routeFromControl(event.target);
    if (!shouldOwnAtlasBoundary(targetRoute)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    beginAtlasHandoff(targetRoute);
  }, true);

  let inspector = null;
  let returnFocus = null;
  const closeInspector = () => {
    if (!inspector) return;
    const old = inspector;
    inspector = null;
    old.classList.remove('is-open');
    document.body.classList.remove('has-root-inspector');
    setTimeout(() => old.remove(), reduced.matches ? 0 : 240);
    returnFocus?.focus?.({ preventScroll: true });
    returnFocus = null;
  };
  const openInspector = rootElement => {
    if (inspector) {
      closeInspector();
      return;
    }
    const shell = document.createElement('div');
    shell.className = 'profile-root-inspector';
    shell.setAttribute('role', 'dialog');
    shell.setAttribute('aria-modal', 'true');
    shell.setAttribute('aria-label', `${profile.name || 'Štěpán Chrast'} profile summary`);
    const backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'profile-root-inspector-backdrop';
    backdrop.setAttribute('aria-label', 'Close profile summary');
    const panel = document.createElement('section');
    panel.className = 'profile-root-inspector-panel';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'profile-root-inspector-close';
    close.setAttribute('aria-label', 'Close profile summary');
    close.textContent = '×';
    const portrait = document.createElement('div');
    portrait.className = 'profile-root-inspector-portrait';
    const image = document.createElement('img');
    image.src = 'assets/stepan-chrast.jpg';
    image.alt = '';
    portrait.appendChild(image);
    const copy = document.createElement('div');
    copy.className = 'profile-root-inspector-copy';
    const name = document.createElement('h2');
    name.textContent = profile.name || 'Štěpán Chrast';
    const label = document.createElement('p');
    label.className = 'profile-root-inspector-label';
    label.textContent = profile.label || '';
    const intro = document.createElement('p');
    intro.className = 'profile-root-inspector-intro';
    intro.textContent = profile.intro || '';
    const links = document.createElement('nav');
    links.className = 'profile-root-inspector-links';
    links.setAttribute('aria-label', 'Profile links');
    if (profile.email) {
      const anchor = document.createElement('a');
      anchor.href = `mailto:${profile.email}`;
      anchor.textContent = 'Email';
      links.appendChild(anchor);
    }
    (profile.links || []).forEach(item => {
      const anchor = document.createElement('a');
      anchor.href = item.href;
      anchor.textContent = `${item.label} ↗`;
      anchor.target = '_blank';
      anchor.rel = 'noreferrer';
      links.appendChild(anchor);
    });
    copy.append(name, label, intro, links);
    panel.append(close, portrait, copy);
    shell.append(backdrop, panel);
    document.body.appendChild(shell);
    inspector = shell;
    returnFocus = rootElement;
    document.body.classList.add('has-root-inspector');
    const rect = rootElement.getBoundingClientRect();
    shell.style.setProperty('--root-screen-x', `${rect.left + rect.width / 2}px`);
    shell.style.setProperty('--root-screen-y', `${rect.top + rect.height / 2}px`);
    backdrop.addEventListener('click', closeInspector);
    close.addEventListener('click', closeInspector);
    requestAnimationFrame(() => {
      shell.classList.add('is-open');
      close.focus({ preventScroll: true });
    });
  };
  const overviewRoot = target => {
    if (document.querySelector('.profile-intro-overlay') || document.body?.dataset.graphMode !== 'overview' || document.body?.dataset.rootLanding === 'true') return null;
    return target.closest?.(`#site-graph .site-graph-node[data-node-id="${rootId}"]`) || null;
  };
  addEventListener('click', event => {
    if (event.button !== 0) return;
    const root = overviewRoot(event.target);
    if (!root) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openInspector(root);
  }, true);
  addEventListener('keydown', event => {
    if (event.key === 'Escape' && inspector) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeInspector();
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const root = overviewRoot(event.target);
    if (!root) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openInspector(root);
  }, true);

  window.ProfileIntroFixesV3 = Object.freeze({
    snapshot: () => ({
      compassVersion: window.ProfileGeometry?.snapshot?.().compassVersion || null,
      inspectorOpen: Boolean(inspector),
      atlasHandoff: Boolean(atlasHandoff),
      localAncestorLabels: document.querySelectorAll('#site-graph .site-graph-node[data-local-label-role="ancestor"]:not(.v9-transition-overlay *)').length,
      rootOrbit: Boolean(document.querySelector(`#site-graph .site-graph-node[data-node-id="${rootId}"] > .profile-root-overview-orbit`)),
      gatewayOrbit: Boolean(document.querySelector('.profile-intro-enter .profile-intro-gateway-orbit'))
    }),
    openProfileSummary: () => {
      const root = baseNodes().find(element => element.dataset.nodeId === rootId);
      if (root) openInspector(root);
    },
    closeProfileSummary: closeInspector,
    applyLocalLabels,
    syncRootOrbit
  });
})();
