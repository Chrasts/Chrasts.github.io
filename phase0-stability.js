(() => {
  const mobileBreakpoint = window.matchMedia('(max-width: 900px)');

  /*
   * Phase 0 invariant: desktop must not inherit a booted mobile runtime.
   *
   * mobile-app.js intentionally monkey-patches SVGElement#setAttribute and
   * attaches gesture handlers when it boots. Those hooks are safe while the
   * page remains mobile, but they are not fully unmounted when the viewport is
   * widened past 900px. A one-time reload on the mobile -> desktop crossing is
   * therefore the smallest reliable stabilisation before the scene lifecycle
   * is formalised in Phase 1.
   */
  mobileBreakpoint.addEventListener?.('change', event => {
    if (!event.matches && window.MobileProfileScene) {
      location.reload();
    }
  });

  const isRouteActivation = target => Boolean(
    target?.closest?.('[data-route], .site-graph-node[data-node-id]')
  );

  /*
   * The current graph transition implementation owns one route transition at a
   * time. A second activation while the overlay is running can otherwise move
   * location.hash underneath the in-flight transition and leave DOM geometry,
   * route state and the visible animation out of agreement.
   */
  const blockDuringTransition = event => {
    if (!document.body?.classList.contains('is-v9-transitioning')) return;
    if (!isRouteActivation(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  window.addEventListener('click', blockDuringTransition, true);
  window.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    blockDuringTransition(event);
  }, true);

  /*
   * Lightweight diagnostics for manual smoke testing. No renderer behaviour
   * depends on these checks; they only report violated Phase 0 assumptions.
   */
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
      mobileRuntimeBooted: Boolean(window.MobileProfileScene),
      mobileBreakpoint: mobileBreakpoint.matches
    };
  };

  window.ProfilePhase0 = Object.freeze({ checkGraphInvariants });
})();
