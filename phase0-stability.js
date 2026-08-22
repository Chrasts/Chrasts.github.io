(() => {
  if (!document.querySelector('script[data-profile-scene-runtime]')) {
    const script = document.createElement('script');
    script.src = 'scene-runtime.js';
    script.dataset.profileSceneRuntime = 'true';
    document.head.appendChild(script);
  }

  /* graph-v9.css is loaded by the compatibility prelude. Keep the critical
     reduced-motion handoff rule available synchronously so an immediate first
     interaction cannot blank the live renderer while that stylesheet loads. */
  if (!document.querySelector('style[data-profile-reduced-handoff]')) {
    const style = document.createElement('style');
    style.dataset.profileReducedHandoff = 'true';
    style.textContent = `@media (prefers-reduced-motion: reduce) {
      body.is-v9-transitioning #site-graph .site-graph-svg > g:not(.v9-transition-overlay) {
        opacity: 1 !important;
        visibility: visible !important;
      }
    }`;
    document.head.appendChild(style);
  }

  const mobileBreakpoint = window.matchMedia('(max-width: 900px)');

  /*
   * Phase 0 invariant: desktop must not inherit a loaded mobile runtime.
   *
   * mobile-app.js monkey-patches SVGElement#setAttribute and attaches gesture
   * handlers after it is injected. Those hooks are safe while the page remains
   * mobile, but there is not yet a formal unmount lifecycle. A one-time reload
   * on the mobile -> desktop crossing is therefore the smallest reliable
   * stabilisation before Phase 1 introduces explicit scene/runtime ownership.
   *
   * Detect the injected script as well as the completed MobileProfileScene boot
   * so a resize during the short script-load/boot window cannot leak the mobile
   * runtime into desktop.
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

  /*
   * The current graph transition implementation owns one route transition at a
   * time. Route controls, detail actions, Work/Atlas controls and camera
   * controls/gestures can mutate the graph or its camera, so none of them may
   * change renderer state while the transition overlay owns the scene.
   * Otherwise location/hash or underlying geometry can move beneath an
   * in-flight transition and make the final handoff inconsistent.
   */
  const blockDuringTransition = event => {
    if (!document.body?.classList.contains('is-v9-transitioning')) return;
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

  /*
   * Lightweight diagnostics for manual/browser smoke testing. No renderer
   * behaviour depends on these checks; they only report violated Phase 0
   * assumptions.
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
      mobileRuntimeLoaded: Boolean(document.querySelector('script[data-profile-mobile-app]')),
      mobileRuntimeBooted: Boolean(window.MobileProfileScene),
      mobileBreakpoint: mobileBreakpoint.matches
    };
  };

  window.ProfilePhase0 = Object.freeze({ checkGraphInvariants });
})();
