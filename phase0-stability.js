(() => {
  const mobileBreakpoint = window.matchMedia('(max-width: 900px)');

  const mobileRuntimePresent = () => Boolean(
    window.MobileProfileScene ||
    document.querySelector('script[data-profile-mobile-app]') ||
    document.documentElement.classList.contains('mobile-profile-app')
  );

  mobileBreakpoint.addEventListener?.('change', event => {
    if (!event.matches && mobileRuntimePresent()) location.reload();
  });

  const isGraphMutationActivation = target => Boolean(
    target?.closest?.([
      '[data-route]', '.site-graph-node[data-node-id]', '.site-graph-viewport',
      '.work-theme-label-v5', '.work-project-anchor-v5', '.integrated-work-controls',
      '.atlas-controls', '.scene-detail', '.mobile-graph-dock', '.mobile-control-sheet'
    ].join(','))
  );

  const transitionLocked = () => Boolean(
    window.ProfileScene?.transitions?.isLocked ||
    document.body?.classList.contains('is-v9-transitioning')
  );

  const blockDuringTransition = event => {
    if (!transitionLocked() || !isGraphMutationActivation(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  window.addEventListener('click', blockDuringTransition, true);
  window.addEventListener('change', blockDuringTransition, true);
  window.addEventListener('pointerdown', blockDuringTransition, true);
  window.addEventListener('wheel', blockDuringTransition, { capture: true, passive: false });
  window.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') blockDuringTransition(event);
  }, true);

  const checkGraphInvariants = () => {
    const nodes = [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
      .filter(element => !element.closest('.v9-transition-overlay'));
    const edges = [...document.querySelectorAll('#site-graph .site-graph-edges path[data-source][data-target]')]
      .filter(element => !element.closest('.v9-transition-overlay'));
    const ids = new Set(nodes.map(node => node.dataset.nodeId));
    const orphanEdges = edges.filter(edge => !ids.has(edge.dataset.source) || !ids.has(edge.dataset.target));
    const duplicateIds = nodes.map(node => node.dataset.nodeId).filter((id, index, all) => all.indexOf(id) !== index);
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

  /* Pre-Phase 8 compatibility cleanup. This file deliberately does not own
     graph coordinates: radial-geometry.js is the canonical global geometry
     owner and the local renderer owns local fragments. */
  const cleanupStyle = document.createElement('style');
  cleanupStyle.dataset.prePhase8Cleanup = 'true';
  cleanupStyle.textContent = `
    .profile-crosslinks{display:none!important}
    body[data-graph-mode="atlas"] #site-graph .site-graph-node.is-project .site-graph-meta{display:none!important}
    body[data-graph-mode="atlas"] #site-graph-help{display:none!important}
    body[data-graph-mode="atlas"] .atlas-button.atlas-entry-v7{
      min-width:154px!important;
      grid-template-columns:38px minmax(70px,1fr)!important;
      padding-left:13px!important
    }
    body[data-graph-mode="atlas"] .atlas-button.atlas-entry-v7 .atlas-entry-glyph{
      width:34px!important;
      height:34px!important
    }
  `;
  document.head.appendChild(cleanupStyle);

  let storedAtlasButtonMarkup = null;
  const backButtonMarkup = '<span class="atlas-entry-glyph" aria-hidden="true" style="display:grid;place-items:center;font-size:24px">←</span><span class="atlas-entry-copy"><strong>Profile</strong></span>';

  const syncAtlasEntryButton = () => {
    const button = document.querySelector('.atlas-button');
    if (!button) return;
    const atlas = document.body?.dataset.graphMode === 'atlas';

    if (!atlas) {
      if (button.classList.contains('atlas-entry-v7') && button.dataset.prePhase8Back !== 'true') {
        storedAtlasButtonMarkup = button.innerHTML;
      }
      button.dataset.route = 'atlas';
      button.setAttribute('aria-label', 'Open Atlas, the full profile map');
      if (storedAtlasButtonMarkup && button.dataset.prePhase8Back === 'true') {
        button.innerHTML = storedAtlasButtonMarkup;
      }
      delete button.dataset.prePhase8Back;
      return;
    }

    if (!storedAtlasButtonMarkup && button.classList.contains('atlas-entry-v7') && button.dataset.prePhase8Back !== 'true') {
      storedAtlasButtonMarkup = button.innerHTML;
    }
    button.dataset.route = 'overview';
    button.dataset.prePhase8Back = 'true';
    button.setAttribute('aria-label', 'Back to profile');
    if (button.innerHTML !== backButtonMarkup) button.innerHTML = backButtonMarkup;
  };

  const repairOverviewTransitionRootLabel = () => {
    if (document.body?.dataset.graphMode !== 'overview' || !document.body.classList.contains('is-v9-transitioning')) return;
    document.querySelectorAll('.v9-transition-overlay .site-graph-node[data-node-id="stepan-chrast"] .site-graph-label').forEach(label => {
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('x', '0');
      label.setAttribute('y', '-27');
    });
  };

  const syncCleanup = () => {
    syncAtlasEntryButton();
    repairOverviewTransitionRootLabel();
  };

  const cleanupObserver = new MutationObserver(mutations => {
    if (mutations.some(mutation => mutation.type === 'childList')) requestAnimationFrame(syncAtlasEntryButton);
    if (mutations.some(mutation => mutation.type === 'attributes')) requestAnimationFrame(syncCleanup);
  });

  const startCleanupObserver = () => {
    if (!document.body) return;
    cleanupObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-graph-mode', 'data-graph-route', 'class']
    });
    syncCleanup();
  };

  if (document.body) startCleanupObserver();
  else document.addEventListener('DOMContentLoaded', startCleanupObserver, { once: true });
  window.addEventListener('hashchange', () => requestAnimationFrame(syncCleanup));
})();