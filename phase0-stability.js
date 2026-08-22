(() => {
  const mobileBreakpoint = window.matchMedia('(max-width: 900px)');

  /*
   * Phase 0 invariant retained during the Phase 1 migration: desktop must not
   * inherit a loaded mobile runtime until mobile-app.js has an explicit unmount
   * lifecycle. The SceneManager can already switch responsive composition, but
   * this reload remains the compatibility boundary for the old gesture hooks.
   */
  const mobileRuntimePresent = () => Boolean(
    window.MobileProfileScene ||
    document.querySelector('script[data-profile-mobile-app]') ||
    document.documentElement.classList.contains('mobile-profile-app')
  );

  mobileBreakpoint.addEventListener?.('change', event => {
    if (!event.matches && mobileRuntimePresent()) {
      location.reload();
    }
  });

  const isGraphMutationActivation = target => Boolean(
    target?.closest?.([
      '[data-route]',
      '.site-graph-node[data-node-id]',
      '.site-graph-viewport',
      '.work-theme-label-v5',
      '.work-project-anchor-v5',
      '.integrated-work-controls',
      '.atlas-controls',
      '.scene-detail',
      '.mobile-graph-dock',
      '.mobile-control-sheet'
    ].join(','))
  );

  const transitionLocked = () => Boolean(
    window.ProfileScene?.transitions?.isLocked ||
    document.body?.classList.contains('is-v9-transitioning')
  );

  /*
   * TransitionCoordinator is now the architectural lock owner. The legacy body
   * class remains a fallback while graph-transitions-v6 still implements the
   * actual structural animation.
   */
  const blockDuringTransition = event => {
    if (!transitionLocked()) return;
    if (!isGraphMutationActivation(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  window.addEventListener('click', blockDuringTransition, true);
  window.addEventListener('change', blockDuringTransition, true);
  window.addEventListener('pointerdown', blockDuringTransition, true);
  window.addEventListener('wheel', blockDuringTransition, { capture: true, passive: false });
  window.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    blockDuringTransition(event);
  }, true);

  /* Lightweight diagnostics retained as a regression surface for Phase 1. */
  const checkGraphInvariants = () => {
    const nodes = [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
      .filter(element => !element.closest('.v9-transition-overlay'));
    const edges = [...document.querySelectorAll('#site-graph .site-graph-edges path[data-source][data-target]')]
      .filter(element => !element.closest('.v9-transition-overlay'));
    const ids = new Set(nodes.map(node => node.dataset.nodeId));
    const orphanEdges = edges.filter(edge => !ids.has(edge.dataset.source) || !ids.has(edge.dataset.target));
    const duplicateIds = nodes
      .map(node => node.dataset.nodeId)
      .filter((id, index, all) => all.indexOf(id) !== index);

    return {
      mode: document.body?.dataset.graphMode || null,
      route: document.body?.dataset.graphRoute || null,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      duplicateNodeIds: [...new Set(duplicateIds)],
      orphanEdgeCount: orphanEdges.length,
      transitioning: document.body?.classList.contains('is-v9-transitioning') || false,
      sceneTransitionLocked: Boolean(window.ProfileScene?.transitions?.isLocked),
      sceneVariant: window.ProfileScene?.manager?.variant || null,
      mobileRuntimeLoaded: Boolean(document.querySelector('script[data-profile-mobile-app]')),
      mobileRuntimeBooted: Boolean(window.MobileProfileScene),
      mobileBreakpoint: mobileBreakpoint.matches
    };
  };

  window.ProfilePhase0 = Object.freeze({ checkGraphInvariants });
})();
