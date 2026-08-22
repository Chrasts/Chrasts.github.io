(() => {
  const graph = window.SITE_DATA?.graph;
  if (!graph?.nodes?.length) return;

  const rootId = graph.rootId || 'stepan-chrast';
  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = () => window.matchMedia('(min-width: 901px)').matches;
  let labelFrame = 0;
  let transitionContext = null;
  let activeLabelCount = 0;
  let lastTargetId = null;
  let keyboardModality = false;

  const normalise = vector => {
    const length = Math.max(1e-6, Math.hypot(vector?.x || 0, vector?.y || 0));
    return { x: (vector?.x || 0) / length, y: (vector?.y || 0) / length };
  };
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const tangent = vector => ({ x: -vector.y, y: vector.x });
  const clamp01 = value => Math.max(0, Math.min(1, value));
  const ease = t => t < .5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';
  const routeNode = route => route === 'overview'
    ? nodeMap.get(rootId)
    : graph.nodes.find(node => node.route === route) || null;
  const routeForNode = node => node?.route || 'overview';
  const currentRoute = () => normaliseRoute(document.body?.dataset.graphRoute || location.hash);

  const routeTargetId = route => {
    if (route === 'overview') return rootId;
    if (route === 'work' || route.startsWith('work/')) return 'work';
    return routeNode(route)?.id || null;
  };

  const routeFromControl = target => {
    const routeControl = target.closest?.('[data-route]');
    if (routeControl) return normaliseRoute(routeControl.dataset.route || routeControl.getAttribute('href'));
    const node = target.closest?.('.site-graph-node[data-node-id]');
    if (!node) return null;
    const id = node.dataset.nodeId;
    if (id.startsWith('work-concept:')) return null;
    if (id === rootId) return 'overview';
    if (id === 'work') return 'work';
    return routeForNode(nodeMap.get(id));
  };

  const targetIdFromControl = (target, route) =>
    target.closest?.('.site-graph-node[data-node-id]')?.dataset.nodeId || routeTargetId(route);

  const isAncestor = (candidateId, nodeId) => {
    if (!candidateId || !nodeId || candidateId === nodeId) return false;
    const pending = [...(nodeMap.get(nodeId)?.parentIds || [])];
    const seen = new Set();
    while (pending.length) {
      const id = pending.pop();
      if (id === candidateId) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      pending.push(...(nodeMap.get(id)?.parentIds || []));
    }
    return false;
  };

  const transitionDuration = context => {
    const fromId = routeTargetId(context.fromRoute);
    const toId = context.targetId || routeTargetId(context.targetRoute);
    let direction = 'lateral';
    if (fromId && toId) {
      if (isAncestor(toId, fromId) || toId === rootId) direction = 'up';
      else if (isAncestor(fromId, toId)) direction = 'down';
    }
    if (context.fromRoute.startsWith('work') && context.targetRoute === 'overview') direction = 'up';
    if (context.fromRoute === 'overview' && context.targetRoute.startsWith('work')) direction = 'down';
    return direction === 'up' ? 1160 : direction === 'down' ? 1080 : 980;
  };

  /* ----------------------------------------------------------------------
     Global compass v2
     ---------------------------------------------------------------------- */
  const compassV2 = Object.freeze({
    work: normalise({ x: 0, y: 1 }),
    knowledge: normalise({ x: 1, y: -0.06 }),
    experience: normalise({ x: -0.72, y: -0.70 }),
    education: normalise({ x: 0.48, y: -0.88 }),
    about: normalise({ x: -0.96, y: 0.28 })
  });
  const sectionIds = Object.keys(compassV2);
  const overviewRadius = id => {
    if (!desktop()) return ({ work: 225, knowledge: 245, experience: 220, education: 228, about: 218 })[id] || 225;
    return ({ work: 292, knowledge: 348, experience: 304, education: 316, about: 286 })[id] || 300;
  };
  const atlasRadialScale = id => {
    if (!desktop()) return 1;
    return ({ work: 1.06, knowledge: 1.18, experience: 1.10, education: 1.12, about: 1.06 })[id] || 1.08;
  };
  const atlasTangentScale = id => {
    if (!desktop()) return 1;
    return ({ work: 1.05, knowledge: 1.12, experience: 1.06, education: 1.08, about: 1.05 })[id] || 1.06;
  };

  const installGeometryV2 = base => {
    if (!base || base.__profileCompassV2) return base;

    const baseSnapshot = () => base.snapshot?.() || {};
    const atlasCenter = () => baseSnapshot().center || base.atlasPoint?.(rootId) || { x: 1260, y: 790 };
    const overviewCenter = () => base.overviewPoint?.(rootId) || { x: 600, y: 350 };

    const sectionFor = id => base.sectionFor?.(id) || (sectionIds.includes(id) ? id : null);
    const overviewPoint = id => {
      if (id === rootId) return { ...overviewCenter() };
      const section = sectionFor(id);
      if (!section || id !== section) return base.overviewPoint?.(id) || null;
      const center = overviewCenter();
      const vector = compassV2[section];
      const radius = overviewRadius(section);
      return { x: center.x + vector.x * radius, y: center.y + vector.y * radius };
    };

    const atlasPoint = id => {
      const center = atlasCenter();
      if (id === rootId) return { ...center };
      const section = sectionFor(id);
      const oldPoint = base.atlasPoint?.(id);
      const oldVector = base.compass?.[section];
      const nextVector = compassV2[section];
      if (!section || !oldPoint || !oldVector || !nextVector) return oldPoint || null;
      const delta = { x: oldPoint.x - center.x, y: oldPoint.y - center.y };
      const oldTangent = tangent(oldVector);
      const nextTangent = tangent(nextVector);
      const radial = dot(delta, oldVector) * atlasRadialScale(section);
      const lateral = dot(delta, oldTangent) * atlasTangentScale(section);
      return {
        x: center.x + nextVector.x * radial + nextTangent.x * lateral,
        y: center.y + nextVector.y * radial + nextTangent.y * lateral
      };
    };

    const vectorBetween = (sourceId, targetId) => {
      const source = atlasPoint(sourceId);
      const target = atlasPoint(targetId);
      if (source && target && Math.hypot(target.x - source.x, target.y - source.y) > 2) {
        return normalise({ x: target.x - source.x, y: target.y - source.y });
      }
      const sourceVector = compassV2[sectionFor(sourceId)] || { x: 0, y: 0 };
      const targetVector = compassV2[sectionFor(targetId)] || { x: 1, y: 0 };
      return normalise({ x: targetVector.x - sourceVector.x || 1, y: targetVector.y - sourceVector.y });
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

    const nodeElements = () => [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
      .filter(element => !element.closest('.v9-transition-overlay'));
    const edgeElements = () => [...document.querySelectorAll('#site-graph .site-graph-edges path[data-source][data-target]')]
      .filter(element => !element.closest('.v9-transition-overlay'));
    const setPoint = (element, point) => {
      if (!element || !point) return;
      element.setAttribute('transform', `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`);
      element.dataset.x = String(point.x);
      element.dataset.y = String(point.y);
    };
    const placeLabel = (element, id) => {
      const label = element?.querySelector('.site-graph-label');
      const meta = element?.querySelector('.site-graph-meta');
      if (!label) return;
      const section = sectionFor(id);
      const vector = compassV2[section];
      if (id === rootId || !vector) {
        label.setAttribute('text-anchor', 'middle'); label.setAttribute('x', '0'); label.setAttribute('y', '-27');
        return;
      }
      element.dataset.globalSector = section;
      if (Math.abs(vector.x) > .58) {
        const sign = Math.sign(vector.x);
        label.setAttribute('text-anchor', sign > 0 ? 'start' : 'end');
        label.setAttribute('x', String(sign * 18));
        label.setAttribute('y', String(vector.y < -.42 ? -8 : vector.y > .42 ? 14 : 4));
        if (meta) {
          meta.setAttribute('text-anchor', sign > 0 ? 'start' : 'end');
          meta.setAttribute('x', String(sign * 18));
          meta.setAttribute('y', String(vector.y < -.42 ? -24 : vector.y > .42 ? 31 : 20));
        }
      } else {
        label.setAttribute('text-anchor', 'middle'); label.setAttribute('x', String(vector.x * 9)); label.setAttribute('y', vector.y < 0 ? '-21' : '29');
        if (meta) { meta.setAttribute('text-anchor', 'middle'); meta.setAttribute('x', String(vector.x * 10)); meta.setAttribute('y', vector.y < 0 ? '-37' : '45'); }
      }
    };
    const hierarchyPath = (from, to, sourceId, targetId) => {
      const vector = compassV2[sectionFor(targetId)] || compassV2[sectionFor(sourceId)];
      if (!vector || sourceId === rootId || targetId === rootId) return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} L ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
      const distance = Math.max(1, Math.hypot(to.x - from.x, to.y - from.y));
      const c1 = { x: from.x + vector.x * distance * .38, y: from.y + vector.y * distance * .38 };
      const c2 = { x: to.x - vector.x * distance * .28, y: to.y - vector.y * distance * .28 };
      return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
    };
    const crossPath = (from, to, center) => {
      const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      let outward = { x: mid.x - center.x, y: mid.y - center.y };
      if (Math.hypot(outward.x, outward.y) < 80) outward = { x: -(to.y - from.y), y: to.x - from.x };
      outward = normalise(outward);
      const distance = Math.hypot(to.x - from.x, to.y - from.y);
      const push = Math.min(260, Math.max(76, distance * .19));
      const control = { x: mid.x + outward.x * push, y: mid.y + outward.y * push };
      return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${control.x.toFixed(1)} ${control.y.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
    };

    const applyV2 = () => {
      base.apply?.();
      const mode = document.body?.dataset.graphMode;
      if (mode !== 'overview' && mode !== 'atlas') return true;
      const positions = new Map();
      if (mode === 'overview') {
        positions.set(rootId, overviewPoint(rootId));
        sectionIds.forEach(id => positions.set(id, overviewPoint(id)));
      } else {
        graph.nodes.forEach(node => {
          const point = atlasPoint(node.id);
          if (point) positions.set(node.id, point);
        });
      }
      const elements = new Map(nodeElements().map(element => [element.dataset.nodeId, element]));
      positions.forEach((point, id) => setPoint(elements.get(id), point));
      elements.forEach((element, id) => placeLabel(element, id));
      const center = positions.get(rootId) || (mode === 'atlas' ? atlasCenter() : overviewCenter());
      edgeElements().forEach(edge => {
        const from = positions.get(edge.dataset.source);
        const to = positions.get(edge.dataset.target);
        if (!from || !to) return;
        const type = edge.dataset.type || '';
        const hierarchy = type === 'hierarchy' || type === 'hierarchy-alt' || type === 'work-lattice';
        edge.setAttribute('d', hierarchy
          ? hierarchyPath(from, to, edge.dataset.source, edge.dataset.target)
          : crossPath(from, to, center));
      });
      document.body.dataset.globalCompass = 'fan-v2';
      return true;
    };

    let frame = 0;
    let pinUntil = 0;
    const stabilize = (duration = 900) => {
      base.stabilize?.(duration);
      pinUntil = Math.max(pinUntil, performance.now() + duration);
      if (frame) return;
      const tick = now => {
        applyV2();
        if (now < pinUntil) frame = requestAnimationFrame(tick);
        else frame = 0;
      };
      frame = requestAnimationFrame(tick);
    };

    const wrapper = Object.freeze({
      __profileCompassV2: true,
      compass: compassV2,
      sectionFor,
      atlasPoint,
      overviewPoint,
      vectorBetween,
      directionBetween: (sourceId, targetId) => directionName(vectorBetween(sourceId, targetId)),
      apply: applyV2,
      stabilize,
      snapshot: () => ({
        ...baseSnapshot(),
        geometry: document.body?.dataset.globalGeometry || null,
        compassVersion: 'fan-v2',
        sections: Object.fromEntries(sectionIds.map(id => [id, {
          vector: { ...compassV2[id] },
          atlas: atlasPoint(id),
          overview: overviewPoint(id)
        }]))
      })
    });

    const graphRoot = document.querySelector('#site-graph');
    if (graphRoot) new MutationObserver(() => stabilize(940)).observe(graphRoot, { childList: true, subtree: true });
    if (document.body) new MutationObserver(() => stabilize(940)).observe(document.body, {
      attributes: true,
      attributeFilter: ['data-graph-mode', 'data-graph-route', 'class']
    });
    window.addEventListener('hashchange', () => stabilize(980));
    window.addEventListener('resize', () => stabilize(1000));
    window.addEventListener('profile:geometry-applied', () => stabilize(880));
    requestAnimationFrame(() => stabilize(980));
    return wrapper;
  };

  const hookGeometry = () => {
    if (window.ProfileGeometry) {
      window.ProfileGeometry = installGeometryV2(window.ProfileGeometry);
      return;
    }
    let value = null;
    try {
      Object.defineProperty(window, 'ProfileGeometry', {
        configurable: true,
        enumerable: true,
        get: () => value,
        set: base => {
          value = installGeometryV2(base);
          Object.defineProperty(window, 'ProfileGeometry', {
            configurable: true,
            enumerable: true,
            writable: true,
            value
          });
        }
      });
    } catch (_) {
      const poll = () => {
        if (window.ProfileGeometry) window.ProfileGeometry = installGeometryV2(window.ProfileGeometry);
        else requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
    }
  };
  hookGeometry();

  /* ----------------------------------------------------------------------
     Intro gateway + root morph
     ---------------------------------------------------------------------- */
  document.addEventListener('keydown', event => {
    if (event.key === 'Tab' || event.key === 'Enter' || event.key === ' ') keyboardModality = true;
  }, true);
  document.addEventListener('pointerdown', () => { keyboardModality = false; }, true);

  const patchIntroOverlay = shell => {
    if (!shell || shell.dataset.motionPolished === 'true') return;
    shell.dataset.motionPolished = 'true';
    const enter = shell.querySelector('.profile-intro-enter');
    if (!enter) return;
    enter.querySelector('small')?.remove();
    enter.setAttribute('aria-label', 'Enter profile');
    const activate = () => shell.classList.add('is-enter-active');
    const deactivate = () => shell.classList.remove('is-enter-active');
    enter.addEventListener('pointerenter', activate);
    enter.addEventListener('pointerleave', deactivate);
    enter.addEventListener('focus', () => {
      if (!keyboardModality) {
        requestAnimationFrame(() => {
          if (document.activeElement === enter) enter.blur();
        });
        return;
      }
      activate();
    });
    enter.addEventListener('blur', deactivate);
  };

  const introObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.('.profile-intro-overlay')) patchIntroOverlay(node);
        node.querySelectorAll?.('.profile-intro-overlay').forEach(patchIntroOverlay);
      }
    }
  });
  if (document.body) introObserver.observe(document.body, { childList: true, subtree: true });
  document.querySelectorAll('.profile-intro-overlay').forEach(patchIntroOverlay);

  const hideConvergingLabels = shell => {
    shell.classList.add('is-root-merge');
    const labels = [...shell.querySelectorAll(
      '.profile-intro-graph .site-graph-node:not([data-intro-tier="root"]) .site-graph-label, ' +
      '.profile-intro-graph .site-graph-node:not([data-intro-tier="root"]) .site-graph-meta'
    )];
    setTimeout(() => {
      if (!shell.isConnected || !shell.classList.contains('is-root-merge')) return;
      labels.forEach(label => { label.style.visibility = 'hidden'; });
    }, reduced.matches ? 0 : 150);
  };

  const morphRootToIdentity = shell => {
    if (!shell || reduced.matches || shell.dataset.rootMorphStarted === 'true') return;
    const root = shell.querySelector(`.profile-intro-graph .site-graph-node[data-node-id="${rootId}"]`);
    const dotElement = root?.querySelector('.site-graph-dot');
    const label = root?.querySelector('.site-graph-label');
    const anchor = shell.querySelector('.profile-intro-identity-anchor');
    if (!dotElement || !anchor) return;

    shell.dataset.rootMorphStarted = 'true';
    shell.classList.add('is-root-morphing');
    anchor.classList.add('is-visible');

    const duration = 500;
    const dotAnimation = dotElement.animate([
      { transform: 'scale(1.72)', opacity: 1, offset: 0 },
      { transform: 'scale(3.4)', opacity: .78, offset: .46 },
      { transform: 'scale(5.6)', opacity: 0, offset: 1 }
    ], { duration, easing: 'cubic-bezier(.16,.76,.18,1)', fill: 'forwards' });

    label?.animate([
      { opacity: 1, transform: 'translateY(0px)' },
      { opacity: 0, transform: 'translateY(-8px)' }
    ], { duration: 230, easing: 'ease-out', fill: 'forwards' });

    const identityAnimation = anchor.animate([
      { transform: 'scale(.08)', opacity: 0, filter: 'blur(2.4px)', offset: 0 },
      { transform: 'scale(.42)', opacity: .48, filter: 'blur(1px)', offset: .34 },
      { transform: 'scale(1.035)', opacity: 1, filter: 'blur(0px)', offset: .84 },
      { transform: 'scale(1)', opacity: 1, filter: 'blur(0px)', offset: 1 }
    ], { duration, easing: 'cubic-bezier(.16,.76,.18,1)', fill: 'forwards' });

    Promise.allSettled([dotAnimation.finished, identityAnimation.finished]).then(() => {
      if (shell.isConnected) shell.classList.add('is-root-morph-complete');
    });
  };

  window.addEventListener('profile:intro-stage', event => {
    const shell = document.querySelector('.profile-intro-overlay');
    if (!shell) return;
    patchIntroOverlay(shell);
    if (event.detail?.stage === 'root') hideConvergingLabels(shell);
    if (event.detail?.stage === 'identity') morphRootToIdentity(shell);
  });

  /* ----------------------------------------------------------------------
     Structural transition focus continuity + label interpolation
     ---------------------------------------------------------------------- */
  const textWidth = element => {
    try { return element.getComputedTextLength?.() || element.getBBox?.().width || 0; }
    catch (_) { return 0; }
  };
  const visualTextPose = element => {
    if (!element) return null;
    const x = Number(element.getAttribute('x') || 0);
    const y = Number(element.getAttribute('y') || 0);
    const width = textWidth(element);
    const anchor = element.getAttribute('text-anchor') || 'start';
    const centerX = anchor === 'end' ? x - width / 2 : anchor === 'middle' ? x : x + width / 2;
    return { centerX, y };
  };
  const captureTransitionLabels = overlay => {
    overlay.querySelectorAll('.site-graph-node[data-node-id]').forEach(node => {
      node.querySelectorAll('.site-graph-label,.site-graph-meta').forEach(text => {
        const pose = visualTextPose(text);
        if (!pose) return;
        text.dataset.motionFromX = String(pose.centerX);
        text.dataset.motionFromY = String(pose.y);
        text.dataset.motionBaseTransform = text.getAttribute('transform') || '';
      });
    });
  };
  const promoteTransitionTarget = targetId => {
    const overlay = document.querySelector('#site-graph .v9-transition-overlay');
    if (!overlay) return;
    overlay.querySelectorAll('.site-graph-node[data-node-id]').forEach(node => {
      node.classList.remove('is-selected', 'is-previewed');
      delete node.dataset.transitionFocus;
    });
    const target = overlay.querySelector(`.site-graph-node[data-node-id="${CSS.escape(targetId || '')}"]`);
    if (target) {
      target.classList.add('is-selected');
      target.dataset.transitionFocus = 'true';
    }
    captureTransitionLabels(overlay);
    lastTargetId = targetId || null;
  };
  const baseNodeFor = id => [...document.querySelectorAll(`#site-graph .site-graph-node[data-node-id="${CSS.escape(id)}"]`)]
    .find(node => !node.closest('.v9-transition-overlay')) || null;

  const beginLabelInterpolation = context => {
    cancelAnimationFrame(labelFrame);
    const overlay = document.querySelector('#site-graph .v9-transition-overlay');
    if (!overlay || !document.body.classList.contains('is-v9-transitioning')) return;

    const records = [];
    overlay.querySelectorAll('.site-graph-node[data-node-id]').forEach(cloneNode => {
      const id = cloneNode.dataset.nodeId;
      const baseNode = baseNodeFor(id);
      if (!baseNode) return;
      ['.site-graph-label', '.site-graph-meta'].forEach(selector => {
        const cloneText = cloneNode.querySelector(selector);
        const baseText = baseNode.querySelector(selector);
        if (!cloneText || !baseText) return;
        const from = { centerX: Number(cloneText.dataset.motionFromX), y: Number(cloneText.dataset.motionFromY) };
        const to = visualTextPose(baseText);
        if (!Number.isFinite(from.centerX) || !Number.isFinite(from.y) || !to) return;
        const dx = to.centerX - from.centerX;
        const dy = to.y - from.y;
        if (Math.abs(dx) + Math.abs(dy) < .35) return;
        cloneText.dataset.motionLabel = 'true';
        cloneText.dataset.motionTargetDx = dx.toFixed(2);
        cloneText.dataset.motionTargetDy = dy.toFixed(2);
        records.push({ element: cloneText, baseTransform: cloneText.dataset.motionBaseTransform || '', dx, dy });
      });
    });

    activeLabelCount = records.length;
    if (!records.length || reduced.matches) return;
    const duration = transitionDuration(context);
    const started = performance.now();
    const frame = now => {
      const liveOverlay = document.querySelector('#site-graph .v9-transition-overlay');
      if (!liveOverlay || !document.body.classList.contains('is-v9-transitioning')) {
        activeLabelCount = 0;
        return;
      }
      const p = ease(clamp01((now - started) / duration));
      records.forEach(record => {
        const translate = `translate(${(record.dx * p).toFixed(2)} ${(record.dy * p).toFixed(2)})`;
        record.element.setAttribute('transform', `${record.baseTransform} ${translate}`.trim());
      });
      if (p < 1) labelFrame = requestAnimationFrame(frame);
      else activeLabelCount = 0;
    };
    labelFrame = requestAnimationFrame(frame);
  };

  const scheduleLabelInterpolation = context => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => beginLabelInterpolation(context))));
  };
  const captureNavigation = event => {
    if (event.defaultPrevented) return;
    const route = routeFromControl(event.target);
    if (!route) return;
    const fromRoute = currentRoute();
    if (route === fromRoute) return;
    const targetId = targetIdFromControl(event.target, route);
    transitionContext = { fromRoute, targetRoute: route, targetId };
    if (document.body.classList.contains('is-v9-transitioning')) promoteTransitionTarget(targetId);
    else requestAnimationFrame(() => promoteTransitionTarget(targetId));
  };
  const initStructuralPolish = () => {
    document.addEventListener('click', event => {
      if (event.button === 0) captureNavigation(event);
    }, true);
    document.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') captureNavigation(event);
    }, true);
    window.addEventListener('hashchange', () => {
      if (transitionContext && document.body.classList.contains('is-v9-transitioning')) scheduleLabelInterpolation(transitionContext);
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initStructuralPolish, { once: true });
  else initStructuralPolish();

  window.ProfileMotionPolish = Object.freeze({
    snapshot: () => ({
      lastTargetId,
      activeLabelCount,
      introMorphing: Boolean(document.querySelector('.profile-intro-overlay.is-root-morphing')),
      introMorphComplete: Boolean(document.querySelector('.profile-intro-overlay.is-root-morph-complete')),
      enterActive: Boolean(document.querySelector('.profile-intro-overlay.is-enter-active')),
      compassVersion: window.ProfileGeometry?.snapshot?.().compassVersion || null,
      transitionActive: document.body?.classList.contains('is-v9-transitioning') || false
    })
  });
})();
