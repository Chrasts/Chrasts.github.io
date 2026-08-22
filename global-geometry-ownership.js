(() => {
  if (window.ProfileGlobalGeometryOwnership?.active) return;

  const rootId = window.SITE_DATA?.graph?.rootId || 'stepan-chrast';
  const EPSILON = 0.75;
  let installed = false;
  let queued = false;
  let repairs = 0;
  let lastReason = null;

  const geometry = () => window.ProfileGeometry;
  const expectedPoint = (mode, id) => {
    const api = geometry();
    if (!api?.__profileCompassV3) return null;
    if (mode === 'overview') return api.overviewPoint?.(id) || null;
    if (mode === 'atlas') return api.atlasPoint?.(id) || null;
    return null;
  };

  const liveNodes = () => [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
    .filter(node => !node.closest('.v9-transition-overlay'));

  const pointOf = node => ({
    x: Number(node?.dataset.x),
    y: Number(node?.dataset.y)
  });

  const nodeDrifted = (node, mode) => {
    const expected = expectedPoint(mode, node.dataset.nodeId);
    if (!expected) return false;
    const actual = pointOf(node);
    if (!Number.isFinite(actual.x) || !Number.isFinite(actual.y)) return true;
    return Math.abs(actual.x - expected.x) > EPSILON || Math.abs(actual.y - expected.y) > EPSILON;
  };

  const needsRepair = () => {
    const mode = document.body?.dataset.graphMode;
    if (mode !== 'overview' && mode !== 'atlas') return false;
    return liveNodes().some(node => nodeDrifted(node, mode));
  };

  const repair = reason => {
    queued = false;
    const api = geometry();
    const mode = document.body?.dataset.graphMode;
    if (!api?.__profileCompassV3 || (mode !== 'overview' && mode !== 'atlas')) return false;
    if (!needsRepair()) return false;
    repairs += 1;
    lastReason = reason || 'late-global-write';
    api.apply?.();
    document.body.dataset.globalGeometryOwner = 'fan-v3';
    window.dispatchEvent(new CustomEvent('profile:global-geometry-repaired', {
      detail: { mode, reason: lastReason, repairs }
    }));
    return true;
  };

  const queueRepair = reason => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => repair(reason));
  };

  const install = () => {
    if (installed) return true;
    const api = geometry();
    const graphRoot = document.querySelector('#site-graph');
    if (!api?.__profileCompassV3 || !graphRoot || !document.body) return false;
    installed = true;
    document.body.dataset.globalGeometryOwner = 'fan-v3';

    new MutationObserver(mutations => {
      const mode = document.body.dataset.graphMode;
      if (mode !== 'overview' && mode !== 'atlas') return;
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          queueRepair('graph-rerender');
          return;
        }
        const target = mutation.target;
        if (target?.matches?.('.site-graph-node[data-node-id]')) {
          queueRepair('node-transform-write');
          return;
        }
      }
    }).observe(graphRoot, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['transform', 'data-x', 'data-y']
    });

    new MutationObserver(() => queueRepair('mode-state-change')).observe(document.body, {
      attributes: true,
      attributeFilter: ['data-graph-mode', 'data-graph-route', 'data-root-landing', 'class']
    });

    addEventListener('profile:root-activated', () => {
      api.apply?.();
      queueRepair('root-activated');
      requestAnimationFrame(() => queueRepair('root-activated-frame'));
      requestAnimationFrame(() => requestAnimationFrame(() => queueRepair('root-activated-two-frame')));
    });
    addEventListener('hashchange', () => queueRepair('hashchange'));
    addEventListener('profile:geometry-applied', () => queueRepair('geometry-applied'));

    queueRepair('install');
    return true;
  };

  const boot = () => {
    if (install()) return;
    requestAnimationFrame(boot);
  };

  window.ProfileGlobalGeometryOwnership = Object.freeze({
    active: true,
    repair: reason => repair(reason || 'manual'),
    snapshot: () => ({
      installed,
      repairs,
      lastReason,
      owner: document.body?.dataset.globalGeometryOwner || null,
      mode: document.body?.dataset.graphMode || null,
      drifted: needsRepair()
    })
  });

  boot();
})();
