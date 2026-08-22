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

  /* Pre-Phase 8 compatibility cleanup. */
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

  const graphNode = id => [...document.querySelectorAll(`#site-graph .site-graph-node[data-node-id="${id}"]`)]
    .find(element => !element.closest('.v9-transition-overlay')) || null;
  const pointOf = element => ({ x: Number(element?.dataset.x || 0), y: Number(element?.dataset.y || 0) });
  const setPoint = (element, point) => {
    if (!element || !point) return;
    element.setAttribute('transform', `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`);
    element.dataset.x = String(point.x);
    element.dataset.y = String(point.y);
  };

  const syncAtlasWorkEdges = positions => {
    document.querySelectorAll('#site-graph .site-graph-edges path[data-source][data-target]').forEach(edge => {
      if (edge.closest('.v9-transition-overlay')) return;
      const source = edge.dataset.source;
      const target = edge.dataset.target;
      if (!positions.has(source) && !positions.has(target)) return;
      const sourceElement = graphNode(source);
      const targetElement = graphNode(target);
      const from = positions.get(source) || (sourceElement ? pointOf(sourceElement) : null);
      const to = positions.get(target) || (targetElement ? pointOf(targetElement) : null);
      if (!from || !to) return;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const bend = Math.min(34, Math.max(-34, dx * .035));
      const nx = -dy / distance;
      const ny = dx / distance;
      const cx = (from.x + to.x) / 2 + nx * bend;
      const cy = (from.y + to.y) / 2 + ny * bend;
      edge.setAttribute('d', `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`);
    });
  };

  const applyAtlasWorkLattice = () => {
    if (document.body?.dataset.graphMode !== 'atlas' || !window.SITE_DATA?.work) return false;
    const work = graphNode('work');
    if (!work) return false;
    const origin = pointOf(work);
    const attributes = window.SITE_DATA.work.attributes || [];
    const projects = window.SITE_DATA.work.projects || [];
    const positions = new Map([['work', origin]]);
    const themePositions = new Map();
    const span = 520;

    attributes.forEach((attribute, index) => {
      const t = attributes.length <= 1 ? .5 : index / (attributes.length - 1);
      const point = { x: origin.x - span / 2 + span * t, y: origin.y + 145 + Math.abs(t - .5) * 36 };
      const id = `work-theme-${attribute.id}`;
      themePositions.set(attribute.id, point);
      positions.set(id, point);
      setPoint(graphNode(id), point);
    });

    const rankBuckets = new Map();
    projects.forEach(project => {
      const rank = Math.max(1, project.lattice?.length || 1);
      if (!rankBuckets.has(rank)) rankBuckets.set(rank, []);
      rankBuckets.get(rank).push(project);
    });

    [...rankBuckets.keys()].sort((a, b) => a - b).forEach((rank, rankIndex) => {
      const desired = rankBuckets.get(rank).map(project => {
        const parents = (project.lattice || []).map(id => themePositions.get(id)).filter(Boolean);
        const barycentre = parents.length ? parents.reduce((sum, point) => sum + point.x, 0) / parents.length : origin.x;
        return { project, x: barycentre };
      }).sort((a, b) => a.x - b.x || a.project.order - b.project.order);

      const minGap = 118;
      for (let i = 1; i < desired.length; i += 1) desired[i].x = Math.max(desired[i].x, desired[i - 1].x + minGap);
      const left = origin.x - 430;
      const right = origin.x + 430;
      if (desired.length && desired.at(-1).x > right) {
        const shift = desired.at(-1).x - right;
        desired.forEach(item => { item.x -= shift; });
      }
      if (desired.length && desired[0].x < left) {
        const shift = left - desired[0].x;
        desired.forEach(item => { item.x += shift; });
      }

      desired.forEach((item, index) => {
        const id = `project-${item.project.id}`;
        const point = { x: item.x, y: origin.y + 315 + rankIndex * 145 + (index % 2 ? 8 : -8) };
        positions.set(id, point);
        setPoint(graphNode(id), point);
      });
    });

    syncAtlasWorkEdges(positions);
    return true;
  };

  let atlasPinFrame = 0;
  let atlasPinUntil = 0;
  const pinAtlasWorkLattice = (duration = 1350) => {
    if (document.body?.dataset.graphMode !== 'atlas') return;
    atlasPinUntil = Math.max(atlasPinUntil, performance.now() + duration);
    if (atlasPinFrame) return;
    const tick = now => {
      applyAtlasWorkLattice();
      if (now < atlasPinUntil) atlasPinFrame = requestAnimationFrame(tick);
      else atlasPinFrame = 0;
    };
    atlasPinFrame = requestAnimationFrame(tick);
  };

  let storedAtlasButtonMarkup = null;
  const syncAtlasEntryButton = () => {
    const button = document.querySelector('.atlas-button');
    if (!button) return;
    const atlas = document.body?.dataset.graphMode === 'atlas';
    if (!atlas) {
      if (button.classList.contains('atlas-entry-v7') && button.dataset.prePhase8Back !== 'true') storedAtlasButtonMarkup = button.innerHTML;
      button.dataset.route = 'atlas';
      button.setAttribute('aria-label', 'Open Atlas, the full profile map');
      if (storedAtlasButtonMarkup && button.dataset.prePhase8Back === 'true') button.innerHTML = storedAtlasButtonMarkup;
      delete button.dataset.prePhase8Back;
      return;
    }

    if (button.dataset.prePhase8Back === 'true') return;
    if (!storedAtlasButtonMarkup && button.classList.contains('atlas-entry-v7')) storedAtlasButtonMarkup = button.innerHTML;
    button.dataset.route = 'overview';
    button.dataset.prePhase8Back = 'true';
    button.setAttribute('aria-label', 'Back to profile');
    button.innerHTML = '<span class="atlas-entry-glyph" aria-hidden="true" style="display:grid;place-items:center;font-size:24px">←</span><span class="atlas-entry-copy"><strong>Profile</strong></span>';
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
    if (document.body?.dataset.graphMode === 'atlas') pinAtlasWorkLattice();
  };

  const cleanupObserver = new MutationObserver(mutations => {
    if (mutations.some(mutation => mutation.type === 'childList')) {
      if (document.body?.dataset.graphMode === 'atlas') pinAtlasWorkLattice(1450);
      requestAnimationFrame(syncAtlasEntryButton);
    }
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
  window.addEventListener('profile:geometry-applied', () => pinAtlasWorkLattice(1450));
})();
