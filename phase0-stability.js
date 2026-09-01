(() => {
  /* Content-integrity pass.
     SITE_DATA deliberately keeps a richer ontology than the public graph needs
     to expose as first-class destinations. Before the graph runtime boots,
     collapse low-signal/course-only/tool-level nodes into their defensible
     parent areas while preserving project technology metadata and evidence. */
  const applyContentIntegrityPass = () => {
    const site = window.SITE_DATA;
    if (!site?.graph?.nodes?.length || !Array.isArray(site.graph.edges)) return;

    const collapseInto = new Map([
      ['dynamic-logic', 'modal-logic'],
      ['sat-smt', 'computational-logic'],
      ['logic-for-ai', 'computational-logic'],
      ['data-qa', 'data-analysis'],
      ['visualisation', 'data-analysis'],
      ['data-cleaning', 'data-analysis'],
      ['algorithms-data-structures', 'programming-automation'],
      ['git', 'programming-automation']
    ]);
    const collapsedIds = new Set(collapseInto.keys());
    const resolveId = id => collapseInto.get(id) || id;

    site.graph.nodes = site.graph.nodes.filter(node => !collapsedIds.has(node.id));

    const edgeKeys = new Set();
    site.graph.edges = site.graph.edges.flatMap(edge => {
      const source = resolveId(edge.source);
      const target = resolveId(edge.target);
      if (source === target) return [];
      const normalized = { ...edge, source, target };
      const key = `${source}|${target}|${normalized.type || ''}|${Boolean(normalized.secondary)}`;
      if (edgeKeys.has(key)) return [];
      edgeKeys.add(key);
      return [normalized];
    });

    const thesis = site.work?.projects?.find(project => project.id === 'bachelor-thesis');
    if (thesis) {
      thesis.facets.status = 'submitted';
      thesis.note = 'Bachelor thesis submitted; selected diagrams are available in the portfolio while the research repository remains private.';
    }
    const thesisNode = site.graph.nodes.find(node => node.id === 'project-bachelor-thesis');
    if (thesisNode) {
      thesisNode.status = 'submitted';
      thesisNode.summary = 'Submitted bachelor thesis on quantum logic and associative residuated ortholattices, focused on algebraic structure and related varieties.';
    }

    const modalLogicLab = site.work?.projects?.find(project => project.id === 'modal-logic-lab');
    if (modalLogicLab) {
      modalLogicLab.links = [
        { label: 'Play ↗', href: 'https://chrasts.github.io/Modal_Logic_Lab/' },
        { label: 'GitHub ↗', href: 'https://github.com/Chrasts/Modal_Logic_Lab' }
      ];
    }

    window.ProfileContentIntegrity = Object.freeze({
      collapsedNodeIds: Object.freeze([...collapsedIds]),
      collapseInto: Object.freeze(Object.fromEntries(collapseInto))
    });
  };
  applyContentIntegrityPass();

  /* P0 runtime guards. Scene declarations and the object runtime intentionally
     share lifecycle state, but local visibility changes are not owned by the
     global route-transition coordinator. Make those local enters settle on
     their own, reconcile serialized selection back to DOM atomically, and keep
     the SceneManager identity synchronized with the canonical graph DOM state. */
  const installSceneRuntimeGuards = () => {
    const scene = window.ProfileScene;
    const manager = scene?.manager;
    const objects = scene?.objects;
    if (!manager || !objects || manager.__phase0RuntimeGuards) return;
    manager.__phase0RuntimeGuards = true;

    const originalApplyDefinition = manager.applyDefinition.bind(manager);
    manager.applyDefinition = function phase0ApplyDefinition(definition, meta = {}) {
      const result = originalApplyDefinition(definition, meta);
      const instance = this.instances.get(definition.id);
      const element = instance?.element;
      if (element?.dataset.sceneLifecycle !== 'entering' || this.transitions.isLocked) return result;

      requestAnimationFrame(() => requestAnimationFrame(() => {
        const live = this.instances.get(definition.id);
        if (!live?.visible || live.element !== element || this.transitions.isLocked) return;
        if (element.dataset.sceneLifecycle === 'entering') delete element.dataset.sceneLifecycle;
        this.objects.updateScene(definition.id, this.objectContext(
          live.definition || definition,
          element,
          { reason: 'local-enter-settle' }
        ));
      }));
      return result;
    };

    const originalRestore = objects.restore.bind(objects);
    objects.restore = function phase0Restore(payload) {
      const restored = originalRestore(payload);
      if (!restored || !Array.isArray(payload?.objects)) return restored;
      const ids = payload.objects.map(record => record?.id).filter(Boolean);
      ids.forEach(id => this.apply(id));
      requestAnimationFrame(() => ids.forEach(id => this.apply(id)));
      return restored;
    };

    let graphSyncFrame = 0;
    const syncManagerToGraphDom = () => {
      graphSyncFrame = 0;
      if (manager.transitions?.isLocked) return;
      const route = (document.body?.dataset.graphRoute || 'overview')
        .replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';
      const mode = document.body?.dataset.graphMode || 'overview';
      const current = manager.context();
      if (current.route === route && current.mode === mode) return;
      manager.setGraphState({
        route,
        mode,
        workProjectId: route.match(/^work\/project\/([^/]+)$/)?.[1] || null
      }, { reason: 'phase0-graph-dom-sync' });
    };
    const scheduleGraphSync = () => {
      cancelAnimationFrame(graphSyncFrame);
      graphSyncFrame = requestAnimationFrame(syncManagerToGraphDom);
    };
    new MutationObserver(scheduleGraphSync).observe(document.body, {
      attributes: true,
      attributeFilter: ['data-graph-route', 'data-graph-mode']
    });
    addEventListener('profile:transition-finish', scheduleGraphSync);
    addEventListener('profile:transition-cancel', scheduleGraphSync);
    scheduleGraphSync();
  };

  const installComposerGuards = () => {
    const Composer = window.SceneComposer;
    if (!Composer?.prototype || Composer.prototype.__phase0ComposerGuards) return;
    Composer.prototype.__phase0ComposerGuards = true;
    const stableOffsets = new Map();
    const originalApplyAssignment = Composer.prototype.applyAssignment;
    const originalContainAssignment = Composer.prototype.containAssignment;
    const originalSideCorridor = Composer.prototype.sideCorridor;

    /* Graph avoidance is a hard scene constraint. The canonical composer used
       to discard the graph boundary whenever the remaining lane fell below its
       preferred minimum width, which let Work document folios overlap the FCA
       lattice. Keep the hard boundary and let side choice / responsive media
       sizing absorb the narrower corridor instead. */
    Composer.prototype.sideCorridor = function phase0SideCorridor(side, request, context, graphBounds) {
      const corridor = originalSideCorridor.call(this, side, request, context, graphBounds);
      if (!request?.avoidGraph || !graphBounds || context.variant === 'mobile') return corridor;
      const graphMargin = Number(request.graphMargin) || 0;
      if (side === 'left') {
        corridor.right = Math.min(corridor.right, graphBounds.left - graphMargin);
        if (corridor.right < corridor.left) corridor.right = corridor.left;
      } else {
        corridor.left = Math.max(corridor.left, graphBounds.right + graphMargin);
        if (corridor.left > corridor.right) corridor.left = corridor.right;
      }
      corridor.width = Math.max(0, corridor.right - corridor.left);
      return corridor;
    };

    Composer.prototype.applyAssignment = function phase0ApplyAssignment(assignment, context) {
      const previous = stableOffsets.get(assignment.id);
      const result = originalApplyAssignment.call(this, assignment, context);
      if (
        assignment.zone === 'side-stage' &&
        context.variant !== 'mobile' &&
        previous?.route === context.route &&
        previous.side === assignment.side &&
        Number.isFinite(previous.offset)
      ) {
        /* Within one route, opening/closing a local inspector may enlarge the
           free corridor. Expansion must not make an already settled object jump
           or fan back out. Shrinks remain allowed and containment can still move
           the object when a newly introduced hard boundary requires it. */
        if (
          Number.isFinite(previous.availableWidth) &&
          Number.isFinite(assignment.availableWidth) &&
          assignment.availableWidth >= previous.availableWidth
        ) {
          assignment.availableWidth = previous.availableWidth;
          assignment.element.style.setProperty('--scene-side-available-width', `${Math.round(previous.availableWidth)}px`);
          assignment.element.style.setProperty('max-width', `${Math.round(previous.availableWidth)}px`, 'important');
        }
        assignment.offset = Math.max(0, previous.offset);
        const property = assignment.side === 'left' ? 'left' : 'right';
        const oppositeProperty = assignment.side === 'left' ? 'right' : 'left';
        assignment.element.style.setProperty(property, `${Math.round(assignment.offset)}px`, 'important');
        assignment.element.style.setProperty(oppositeProperty, 'auto', 'important');
      }
      return result;
    };

    Composer.prototype.containAssignment = function phase0ContainAssignment(assignment, context) {
      if (assignment.request?.containViewport && assignment.zone === 'side-stage' && context.variant !== 'mobile') {
        for (let pass = 0; pass < 3; pass += 1) originalContainAssignment.call(this, assignment, context);

        const margin = assignment.request.viewportMargin || 0;
        const bounds = this.visualBounds(assignment.request);
        if (bounds) {
          const graphBounds = assignment.request.avoidGraph
            ? this.graphSafeBounds(
              context,
              bounds.top - context.canvas.top,
              bounds.bottom - bounds.top,
              assignment.request.graphMargin
            )
            : null;
          const corridor = this.sideCorridor(assignment.side, assignment.request, context, graphBounds);
          const horizontalFrame = assignment.request.avoidGraph && corridor.width > 0
            ? { left: corridor.left, right: corridor.right }
            : { left: context.canvas.left + margin, right: context.canvas.right - margin };
          const frame = {
            ...horizontalFrame,
            top: context.canvas.top + margin,
            bottom: context.canvas.bottom - margin
          };
          let shiftX = 0;
          let shiftY = 0;
          if (bounds.left < frame.left) shiftX = frame.left - bounds.left;
          else if (bounds.right > frame.right) shiftX = frame.right - bounds.right;
          if (bounds.top < frame.top) shiftY = frame.top - bounds.top;
          else if (bounds.bottom > frame.bottom) shiftY = frame.bottom - bounds.bottom;

          if (Math.abs(shiftX) > .5) {
            assignment.offset = Math.max(0, assignment.side === 'left'
              ? assignment.offset + shiftX
              : assignment.offset - shiftX);
            const property = assignment.side === 'left' ? 'left' : 'right';
            assignment.element.style.setProperty(property, `${Math.round(assignment.offset)}px`, 'important');
          }
          if (Math.abs(shiftY) > .5) {
            assignment.top += shiftY;
            assignment.element.style.setProperty('top', `${Math.round(assignment.top)}px`, 'important');
          }
          if (Math.abs(shiftX) > .5 || Math.abs(shiftY) > .5) {
            assignment.safeCorrection = {
              x: Math.round((assignment.safeCorrection?.x || 0) + shiftX),
              y: Math.round((assignment.safeCorrection?.y || 0) + shiftY)
            };
            assignment.element.dataset.sceneSafeAdjusted = 'true';
          }
        }
      } else {
        originalContainAssignment.call(this, assignment, context);
      }

      if (assignment.zone === 'side-stage' && Number.isFinite(assignment.offset)) {
        stableOffsets.set(assignment.id, {
          route: context.route,
          side: assignment.side,
          offset: assignment.offset,
          availableWidth: Number.isFinite(assignment.availableWidth) ? assignment.availableWidth : null
        });
      }
    };

    if (!window.__phase0ComposerSettleEvents) {
      window.__phase0ComposerSettleEvents = true;
      const scheduleArtifactSettle = event => {
        if (!event.target?.closest?.('[data-artifact-scene]')) return;
        window.ProfileSceneComposer?.schedule?.(`artifact-${event.type}-settled`);
      };
      document.addEventListener('animationend', scheduleArtifactSettle, true);
      document.addEventListener('load', scheduleArtifactSettle, true);
    }
  };

  installSceneRuntimeGuards();
  installComposerGuards();
  addEventListener('profile:scene-system-ready', installSceneRuntimeGuards);
  addEventListener('profile:scene-composer-ready', installComposerGuards);

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

  const syncCleanup = () => {
    syncAtlasEntryButton();
    window.ProfileLocalLabelPolicy?.schedule?.('phase0-cleanup');
    if (document.body?.dataset.rootLanding === 'false' && window.scrollY !== 0) window.scrollTo(0, 0);
  };
  let cleanupFrame = 0;
  const scheduleCleanup = () => {
    cancelAnimationFrame(cleanupFrame);
    cleanupFrame = requestAnimationFrame(() => {
      cleanupFrame = 0;
      syncCleanup();
    });
  };
  addEventListener('profile:graph-render-settled', scheduleCleanup);
  addEventListener('profile:scene-state', scheduleCleanup);
  addEventListener('profile:transition-finish', scheduleCleanup);
  addEventListener('profile:transition-cancel', scheduleCleanup);
  addEventListener('profile:root-landing', scheduleCleanup);
  addEventListener('hashchange', scheduleCleanup);
  addEventListener('resize', scheduleCleanup);
  scheduleCleanup();
})();