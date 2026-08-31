(() => {
  if (window.ProfileLocalLabelPolicy) return;

  const graph = window.SITE_DATA?.graph;
  if (!graph?.nodes?.length) return;

  const rootId = graph.rootId || 'stepan-chrast';
  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
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
  const liveNodes = () => [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
    .filter(element => !element.closest('.v9-transition-overlay'));
  const transitionNodes = () => [...document.querySelectorAll('#site-graph .v9-transition-overlay .site-graph-node[data-node-id]')];

  let guard = false;
  let frame = 0;
  let trailingFrame = 0;
  let applyCount = 0;
  let correctedWrites = 0;
  let lastReason = null;

  const setTextPose = (element, anchor, x, y) => {
    if (!element) return 0;
    let changed = 0;
    if (element.getAttribute('text-anchor') !== anchor) {
      element.setAttribute('text-anchor', anchor);
      changed += 1;
    }
    if (element.getAttribute('x') !== String(x)) {
      element.setAttribute('x', String(x));
      changed += 1;
    }
    if (element.getAttribute('y') !== String(y)) {
      element.setAttribute('y', String(y));
      changed += 1;
    }
    return changed;
  };

  const applyTransitionTargets = ancestorIds => {
    let changed = 0;
    transitionNodes().forEach(node => {
      if (!ancestorIds.has(node.dataset.nodeId)) return;
      changed += setTextPose(node.querySelector('.v9-target-label'), 'start', 17, 4);
      changed += setTextPose(node.querySelector('.v9-target-meta'), 'start', 17, 20);
    });
    return changed;
  };

  const apply = (reason = 'api') => {
    if (guard || document.body?.dataset.graphMode !== 'focus') return false;
    const target = routeNode(normaliseRoute(document.body.dataset.graphRoute || location.hash));
    if (!target) return false;

    guard = true;
    let changed = 0;
    try {
      applyCount += 1;
      lastReason = reason;
      const ancestorIds = new Set(primaryPath(target).slice(0, -1).map(node => node.id));
      liveNodes().forEach(node => {
        const id = node.dataset.nodeId;
        const label = node.querySelector('.site-graph-label');
        const meta = node.querySelector('.site-graph-meta');
        if (!label) return;
        if (ancestorIds.has(id)) {
          changed += setTextPose(label, 'start', 17, 4);
          changed += setTextPose(meta, 'start', 17, 20);
          node.dataset.localLabelRole = 'ancestor';
          return;
        }
        changed += setTextPose(label, 'middle', 0, id === rootId ? -25 : 25);
        changed += setTextPose(meta, 'middle', 0, 42);
        node.dataset.localLabelRole = id === target.id ? 'target' : 'branch';
      });
      changed += applyTransitionTargets(ancestorIds);
    } finally {
      guard = false;
    }
    correctedWrites += changed;
    return Boolean(changed);
  };

  const schedule = (reason = 'event') => {
    if (document.body?.dataset.graphMode !== 'focus') return false;
    apply(reason);
    if (frame || trailingFrame) return true;
    frame = requestAnimationFrame(() => {
      frame = 0;
      apply(`${reason}:frame`);
      trailingFrame = requestAnimationFrame(() => {
        trailingFrame = 0;
        apply(`${reason}:settled`);
      });
    });
    return true;
  };

  addEventListener('profile:graph-render-settled', () => schedule('graph-render-settled'));
  addEventListener('profile:geometry-applied', () => schedule('geometry-applied'));
  addEventListener('profile:scene-state', () => schedule('scene-state'));
  addEventListener('profile:transition-begin', () => schedule('transition-begin'));
  addEventListener('profile:transition-finish', () => schedule('transition-finish'));
  addEventListener('profile:transition-cancel', () => schedule('transition-cancel'));
  addEventListener('hashchange', () => schedule('hashchange'));

  window.ProfileLocalLabelPolicy = Object.freeze({
    apply,
    schedule,
    snapshot: () => ({
      pending: Boolean(frame || trailingFrame),
      applyCount,
      correctedWrites,
      lastReason,
      ancestorCount: document.querySelectorAll(
        '#site-graph .site-graph-node[data-local-label-role="ancestor"]:not(.v9-transition-overlay *)'
      ).length
    })
  });

  schedule('boot');
})();
