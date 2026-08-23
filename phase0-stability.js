(() => {
  const mobileBreakpoint = window.matchMedia('(max-width: 900px)');
  const graphNodes = window.SITE_DATA?.graph?.nodes || [];
  const graphNodeMap = new Map(graphNodes.map(node => [node.id, node]));
  const rootId = window.SITE_DATA?.graph?.rootId || 'stepan-chrast';

  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';

  const routeNode = route => route === 'overview'
    ? graphNodeMap.get(rootId)
    : graphNodes.find(node => node.route === route) || null;

  const primaryPath = node => {
    const path = [];
    const seen = new Set();
    let current = node;
    while (current && !seen.has(current.id)) {
      path.unshift(current);
      seen.add(current.id);
      current = current.parentIds?.[0] ? graphNodeMap.get(current.parentIds[0]) : null;
    }
    return path;
  };

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

  /* Global graph-app contracts. The graph is a viewport application once the
     root landing is left: hidden legacy/hero content must not create document
     scroll, and graph labels must have one canonical pose shared by renderer,
     transitions and post-transition observers. */
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
    html:has(body[data-root-landing="false"]),
    body[data-root-landing="false"]{overflow:hidden!important;height:100%!important}
    body[data-root-landing="false"] .profile-app{
      height:calc(100dvh - 72px)!important;
      min-height:0!important;
      overflow:hidden!important
    }
    body[data-root-landing="false"] .profile-app > .hero{display:none!important}
    body[data-root-landing="false"] #site-explorer.profile-scene{
      height:100%!important;
      min-height:0!important;
      padding-bottom:0!important
    }
    body[data-root-landing="false"] + footer,
    body[data-root-landing="false"] footer{display:none!important}
  `;
  document.head.appendChild(cleanupStyle);

  const atlasMarkup = () => {
    const wrap = document.createElement('div');
    wrap.innerHTML = '<svg class="atlas-entry-glyph" viewBox="0 0 88 52" aria-hidden="true"><g class="atlas-entry-glyph-edges"><line x1="44" y1="26" x2="13" y2="10"></line><line x1="44" y1="26" x2="75" y2="11"></line><line x1="44" y1="26" x2="14" y2="40"></line><line x1="44" y1="26" x2="74" y2="41"></line><line x1="44" y1="26" x2="61" y2="25"></line><line x1="13" y1="10" x2="30" y2="17"></line><line x1="75" y1="11" x2="61" y2="25"></line><line x1="14" y1="40" x2="32" y2="34"></line><line x1="74" y1="41" x2="61" y2="25"></line><line x1="30" y1="17" x2="32" y2="34"></line></g><g class="atlas-entry-glyph-nodes"><circle cx="44" cy="26" r="4.2"></circle><circle cx="13" cy="10" r="2.5"></circle><circle cx="75" cy="11" r="2.3"></circle><circle cx="14" cy="40" r="2.4"></circle><circle cx="74" cy="41" r="2.7"></circle><circle cx="61" cy="25" r="2.2"></circle><circle cx="30" cy="17" r="1.8"></circle><circle cx="32" cy="34" r="1.9"></circle></g></svg><span class="atlas-entry-copy"><strong>Atlas</strong></span>';
    return [...wrap.childNodes];
  };
  const backButtonMarkup = '<span class="atlas-entry-glyph" aria-hidden="true" style="display:grid;place-items:center;font-size:24px">←</span><span class="atlas-entry-copy"><strong>Profile</strong></span>';

  const syncAtlasEntryButton = () => {
    const button = document.querySelector('.atlas-button');
    if (!button) return;
    const atlas = document.body?.dataset.graphMode === 'atlas';
    button.classList.add('atlas-entry-v7');
    button.dataset.phase7V2Decorated = 'true';

    if (atlas) {
      button.dataset.route = 'overview';
      button.dataset.prePhase8Back = 'true';
      button.setAttribute('aria-label', 'Back to profile');
      if (button.innerHTML !== backButtonMarkup) button.innerHTML = backButtonMarkup;
      return;
    }

    button.dataset.route = 'atlas';
    delete button.dataset.prePhase8Back;
    button.setAttribute('aria-label', 'Open Atlas, the full profile map');
    const title = button.querySelector('.atlas-entry-copy strong')?.textContent;
    const hasGraphGlyph = Boolean(button.querySelector('svg.atlas-entry-glyph'));
    if (title !== 'Atlas' || !hasGraphGlyph) button.replaceChildren(...atlasMarkup());
  };

  /* Synchronous label-write canonicalisation. graph-transitions-v6 and Phase 7
     used to disagree about which side of ancestor nodes labels belonged on;
     that disagreement produced a visible one-frame snap after the overlay was
     removed. Normalising the write itself means the animation's destination is
     already the same pose that remains after handoff. */
  const nativeSetAttribute = Element.prototype.setAttribute;
  let labelWriteGuard = false;

  const canonicalLabelPose = label => {
    if (!label?.classList?.contains('site-graph-label')) return null;
    const nodeElement = label.closest?.('.site-graph-node[data-node-id]');
    if (!nodeElement) return null;
    const mode = document.body?.dataset.graphMode;
    if (mode !== 'focus' && mode !== 'overview') return null;

    const id = nodeElement.dataset.nodeId;
    if (mode === 'overview') {
      return { anchor: 'middle', x: '0', y: id === rootId ? '-25' : '25' };
    }

    const route = normaliseRoute(document.body?.dataset.graphRoute || location.hash);
    const target = routeNode(route);
    if (!target) return null;
    const ancestorIds = new Set(primaryPath(target).slice(0, -1).map(node => node.id));
    if (ancestorIds.has(id)) return { anchor: 'start', x: '17', y: '4' };
    return { anchor: 'middle', x: '0', y: id === rootId ? '-25' : '25' };
  };

  Element.prototype.setAttribute = function(name, value) {
    if (!labelWriteGuard && ['text-anchor', 'x', 'y'].includes(name) && this.classList?.contains('site-graph-label')) {
      const pose = canonicalLabelPose(this);
      if (pose) {
        labelWriteGuard = true;
        try {
          return nativeSetAttribute.call(this, name, name === 'text-anchor' ? pose.anchor : pose[name]);
        } finally {
          labelWriteGuard = false;
        }
      }
    }
    return nativeSetAttribute.call(this, name, value);
  };

  const syncCanonicalLabels = () => {
    if (labelWriteGuard) return;
    document.querySelectorAll('#site-graph .site-graph-node[data-node-id] .site-graph-label').forEach(label => {
      const pose = canonicalLabelPose(label);
      if (!pose) return;
      labelWriteGuard = true;
      try {
        nativeSetAttribute.call(label, 'text-anchor', pose.anchor);
        nativeSetAttribute.call(label, 'x', pose.x);
        nativeSetAttribute.call(label, 'y', pose.y);
      } finally {
        labelWriteGuard = false;
      }
    });
  };

  const syncCleanup = () => {
    syncAtlasEntryButton();
    syncCanonicalLabels();
    if (document.body?.dataset.rootLanding === 'false' && window.scrollY !== 0) window.scrollTo(0, 0);
  };

  const cleanupObserver = new MutationObserver(mutations => {
    if (mutations.some(mutation => mutation.type === 'childList')) requestAnimationFrame(syncCleanup);
    if (mutations.some(mutation => mutation.type === 'attributes')) requestAnimationFrame(syncCleanup);
  });

  const startCleanupObserver = () => {
    if (!document.body) return;
    cleanupObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-graph-mode', 'data-graph-route', 'data-root-landing', 'class']
    });
    syncCleanup();
  };

  if (document.body) startCleanupObserver();
  else document.addEventListener('DOMContentLoaded', startCleanupObserver, { once: true });
  window.addEventListener('hashchange', () => requestAnimationFrame(syncCleanup));
  window.addEventListener('resize', () => requestAnimationFrame(syncCleanup));
})();