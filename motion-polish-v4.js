(() => {
  const graph = window.SITE_DATA?.graph;
  if (!graph?.nodes?.length) return;

  const rootId = graph.rootId || 'stepan-chrast';
  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let labelFrame = 0;
  let transitionContext = null;
  let activeLabelCount = 0;
  let lastTargetId = null;
  let keyboardModality = false;

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

  /* Intro gateway interaction + final root -> portrait morph. */
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
    const dot = root?.querySelector('.site-graph-dot');
    const label = root?.querySelector('.site-graph-label');
    const anchor = shell.querySelector('.profile-intro-identity-anchor');
    if (!dot || !anchor) return;

    shell.dataset.rootMorphStarted = 'true';
    shell.classList.add('is-root-morphing');
    anchor.classList.add('is-visible');
    const duration = 500;
    const dotAnimation = dot.animate([
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

  /* Structural transition focus continuity + label interpolation. */
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
    window.ProfileIntroFixesV3?.applyLocalLabels?.();

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
    if (route === fromRoute || route === 'atlas' || document.body?.dataset.graphMode === 'atlas') return;
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
