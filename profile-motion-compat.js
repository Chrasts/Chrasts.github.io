(() => {
  if (window.ProfileMotionCompat) return;

  const graph = window.SITE_DATA?.graph;
  const rootId = graph?.rootId || 'stepan-chrast';
  let wrappedLegacy = null;

  const anchorForRoute = route => {
    const value = String(route || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';
    if (value === 'overview') return rootId;
    if (value === 'work' || value.startsWith('work/')) return 'work';
    return graph?.nodes?.find(node => node.route === value)?.id || rootId;
  };

  const enrichMotionResult = result => {
    if (!result) return null;
    const sourceRoute = result.sourceRoute || 'overview';
    const focusSource = !['overview', 'work'].includes(sourceRoute) && !sourceRoute.startsWith('work/');
    return {
      ...result,
      direction: focusSource ? 'focus-to-atlas' : 'profile-to-atlas',
      anchorId: anchorForRoute(sourceRoute),
      targetRoute: result.targetRoute || 'atlas',
      finishedAt: result.finishedAt || result.at || performance.now()
    };
  };

  const markBridgeCompatibility = () => {
    document.querySelectorAll('.profile-hierarchy-atlas-bridge').forEach(bridge => {
      bridge.classList.add('atlas-focus-bridge', 'profile-atlas-unfold-bridge');
      bridge.querySelectorAll('[data-hierarchy-node-id]').forEach(node => {
        node.dataset.bridgeNodeId = node.dataset.hierarchyNodeId;
      });
    });
  };

  const hierarchicalAtlas = fallback => (...args) => {
    if (document.body?.dataset.graphMode !== 'atlas' && window.ProfileMotionRefinements?.transitionToAtlas) {
      return window.ProfileMotionRefinements.transitionToAtlas();
    }
    return fallback?.(...args) ?? false;
  };

  const installSnapshotAdapter = () => {
    const legacy = window.ProfileAtlasFocus;
    if (!legacy || legacy === wrappedLegacy || legacy.__profileMotionCompat) return Boolean(legacy);
    const legacySnapshot = legacy.snapshot;
    if (typeof legacySnapshot !== 'function') return false;

    const wrapper = {
      ...legacy,
      enterAtlas: hierarchicalAtlas(legacy.enterAtlas),
      returnToAtlas: hierarchicalAtlas(legacy.returnToAtlas),
      snapshot: () => {
        const base = legacySnapshot();
        const motion = window.ProfileMotionRefinements?.snapshot?.() || null;
        const motionLast = enrichMotionResult(motion?.lastResult);
        const legacyTime = Number(base?.lastResult?.finishedAt || 0);
        const motionTime = Number(motionLast?.finishedAt || 0);
        return {
          ...base,
          ready: true,
          active: Boolean(base?.active || motion?.active),
          phase: document.body?.dataset.profileAtlasPhase || base?.phase || null,
          lastResult: motionTime >= legacyTime && motionLast ? motionLast : base?.lastResult || null
        };
      }
    };
    Object.defineProperty(wrapper, '__profileMotionCompat', { value: true, enumerable: false });
    wrappedLegacy = Object.freeze(wrapper);
    window.ProfileAtlasFocus = wrappedLegacy;
    return true;
  };

  addEventListener('profile:atlas-focus-ready', () => {
    installSnapshotAdapter();
    markBridgeCompatibility();
  });

  const observer = new MutationObserver(() => {
    installSnapshotAdapter();
    markBridgeCompatibility();
  });

  const boot = () => {
    if (!document.body) return requestAnimationFrame(boot);
    observer.observe(document.body, { subtree: true, childList: true });
    installSnapshotAdapter();
    markBridgeCompatibility();
  };

  window.ProfileMotionCompat = Object.freeze({
    refresh: () => {
      installSnapshotAdapter();
      markBridgeCompatibility();
    },
    snapshot: () => ({
      legacyWrapped: Boolean(wrappedLegacy),
      bridgeCount: document.querySelectorAll('.profile-hierarchy-atlas-bridge').length
    })
  });

  boot();
})();
