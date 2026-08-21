(() => {
  const site = window.SITE_DATA;

  /* ------------------------------------------------------------------------
     Small data-label refinements applied before the graph renderer boots.
     ------------------------------------------------------------------------ */
  const patchData = data => {
    if (!data) return;
    const research = data.attributes?.find(attribute => attribute.id === 'research');
    if (research) research.label = 'Research';

    const insolvency = data.projects?.find(project => project.id === 'insolvency');
    if (insolvency) {
      insolvency.graphLabel = 'Insolvency Analysis';
      insolvency.title = 'Insolvency Analysis';
    }
  };

  patchData(site?.work);
  patchData(window.PORTFOLIO_DATA);

  if (site?.graph?.nodes) {
    const insolvencyNode = site.graph.nodes.find(node => node.id === 'project-insolvency');
    if (insolvencyNode) {
      insolvencyNode.label = 'Insolvency Analysis';
      insolvencyNode.detailLabel = 'Insolvency Analysis';
    }
    const researchThemeNode = site.graph.nodes.find(node => node.id === 'work-theme-research');
    if (researchThemeNode) researchThemeNode.label = 'Research';
  }

  if (!document.querySelector('link[data-profile-graph-v8]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'graph-v8.css';
    link.dataset.profileGraphV8 = 'true';
    document.head.appendChild(link);
  }

  /* ------------------------------------------------------------------------
     Existing reduced-motion bridge used by the keyed graph renderer.
     ------------------------------------------------------------------------ */
  const realMatchMedia = window.matchMedia.bind(window);
  const realReduced = realMatchMedia('(prefers-reduced-motion: reduce)');

  let forceSnap = false;
  Object.defineProperty(window, '__GRAPH_V6_FORCE_SNAP__', {
    configurable: true,
    get: () => forceSnap,
    set: value => {
      forceSnap = Boolean(value);
      if (!forceSnap) return;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        forceSnap = false;
      }));
    }
  });

  const proxyReduced = {
    get matches() {
      return forceSnap || realReduced.matches;
    },
    media: realReduced.media,
    onchange: null,
    addListener: (...args) => realReduced.addListener?.(...args),
    removeListener: (...args) => realReduced.removeListener?.(...args),
    addEventListener: (...args) => realReduced.addEventListener?.(...args),
    removeEventListener: (...args) => realReduced.removeEventListener?.(...args),
    dispatchEvent: (...args) => realReduced.dispatchEvent?.(...args)
  };

  window.__GRAPH_V6_REAL_MATCH_MEDIA__ = realMatchMedia;
  window.__GRAPH_V6_RESTORE_MATCH_MEDIA__ = () => {
    setTimeout(() => {
      window.matchMedia = realMatchMedia;
    }, 0);
  };
  window.matchMedia = query =>
    query === '(prefers-reduced-motion: reduce)'
      ? proxyReduced
      : realMatchMedia(query);

  /* ------------------------------------------------------------------------
     Slightly slower structural transitions.

     V6 owns the animation logic. Rather than duplicating that renderer, slow
     its requestAnimationFrame clock only while a route transition is active.
     This keeps every existing enter/collapse rule intact while making the
     movement roughly 25% more deliberate.
     ------------------------------------------------------------------------ */
  const nativeRAF = window.requestAnimationFrame.bind(window);
  let slowClock = null;
  let slowTimer = 0;

  window.requestAnimationFrame = callback => nativeRAF(realNow => {
    if (!slowClock || realReduced.matches) {
      callback(realNow);
      return;
    }
    const virtualNow = slowClock.virtualStart + (realNow - slowClock.realStart) * .78;
    callback(virtualNow);
  });

  const beginSlowTransition = () => {
    const now = performance.now();
    slowClock = { realStart: now, virtualStart: now };
    clearTimeout(slowTimer);
    slowTimer = setTimeout(() => {
      slowClock = null;
    }, 1900);
  };

  /* ------------------------------------------------------------------------
     Work concept inspection.

     Concept nodes and on-edge theme labels are informational. Theme selection
     is controlled only by the explicit controls on the right.
     ------------------------------------------------------------------------ */
  const detailPanel = () => document.querySelector('#site-detail-panel');

  const closeWorkConceptDetail = () => {
    const panel = detailPanel();
    document.body.classList.remove('has-work-concept-detail');
    if (!panel?.classList.contains('is-work-concept-detail')) return;
    panel.classList.remove('is-open');
    setTimeout(() => {
      if (!panel.classList.contains('is-open')) {
        panel.hidden = true;
        panel.classList.remove('is-work-concept-detail');
      }
    }, realReduced.matches ? 0 : 220);
  };

  const openWorkConceptDetail = themeIds => {
    const work = site?.work;
    const panel = detailPanel();
    if (!work || !panel) return;

    const attributeMap = new Map(work.attributes.map(attribute => [attribute.id, attribute]));
    const ids = [...new Set(themeIds)].filter(id => attributeMap.has(id));
    if (!ids.length) return;

    const labels = ids.map(id => attributeMap.get(id).label);
    const projects = work.projects
      .filter(project => ids.every(id => project.lattice.includes(id)))
      .sort((a, b) => a.order - b.order);

    panel.innerHTML = '';
    panel.hidden = false;
    panel.classList.add('is-work-concept-detail');
    document.body.classList.add('has-work-concept-detail');

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'detail-close';
    close.setAttribute('aria-label', 'Close Work detail');
    close.textContent = '×';
    close.addEventListener('click', closeWorkConceptDetail);

    const heading = document.createElement('h2');
    heading.textContent = labels.join(' & ');

    const summary = document.createElement('p');
    summary.className = 'detail-summary';
    summary.textContent = ids.length === 1
      ? 'Projects associated with this theme.'
      : 'Projects associated with all of these themes.';

    const listHeading = document.createElement('p');
    listHeading.className = 'detail-list-title';
    listHeading.textContent = ids.length === 1 ? 'Projects in this theme' : 'Projects in these themes';

    panel.append(close, heading, summary, listHeading);

    if (projects.length) {
      const list = document.createElement('div');
      list.className = 'work-concept-projects';
      projects.forEach(project => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'work-concept-project';
        button.textContent = project.title;
        button.addEventListener('click', () => {
          closeWorkConceptDetail();
          location.hash = `#work/project/${project.id}`;
        });
        list.appendChild(button);
      });
      panel.appendChild(list);
    } else {
      const empty = document.createElement('p');
      empty.className = 'work-concept-empty';
      empty.textContent = 'No projects are currently assigned to all of these themes.';
      panel.appendChild(empty);
    }

    requestAnimationFrame(() => panel.classList.add('is-open'));
  };

  const workConceptThemes = element => {
    const id = element?.dataset?.nodeId || '';
    if (!id.startsWith('work-concept:')) return null;
    const key = id.slice('work-concept:'.length);
    return key ? key.split('|').filter(Boolean) : [];
  };

  const interceptWorkInspection = event => {
    if (document.body.dataset.graphMode !== 'work') return false;
    const target = event.target;

    const conceptNode = target.closest?.('.site-graph-node[data-node-id^="work-concept:"]');
    if (conceptNode) {
      const themes = workConceptThemes(conceptNode);
      if (themes?.length) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openWorkConceptDetail(themes);
        return true;
      }
    }

    const themeLabel = target.closest?.('.work-theme-label-v5[data-theme-id]');
    if (themeLabel) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openWorkConceptDetail([themeLabel.dataset.themeId]);
      return true;
    }
    return false;
  };

  window.addEventListener('click', event => {
    if (event.button !== 0) return;
    interceptWorkInspection(event);
  }, true);

  window.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && interceptWorkInspection(event)) return;
    if (event.key === 'Escape' && document.body.classList.contains('has-work-concept-detail')) {
      document.body.classList.remove('has-work-concept-detail');
    }
  }, true);

  /* ------------------------------------------------------------------------
     Route-transition polish.

     Old segment edges disappear immediately. This prevents highlighted Work
     paths from leaking into a later segment. Work labels get their own brief
     fade ghost while the actual Work concept nodes are handled by V6's normal
     upward-collapse animation.
     ------------------------------------------------------------------------ */
  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';

  const routeForTarget = target => {
    const explicit = target.closest?.('[data-route]');
    if (explicit) return normaliseRoute(explicit.dataset.route || explicit.getAttribute('href'));

    const node = target.closest?.('.site-graph-node[data-node-id]');
    if (!node) return null;
    const id = node.dataset.nodeId;
    if (id.startsWith('work-concept:')) return null;
    if (id === site?.graph?.rootId) return 'overview';
    if (id === 'work') return 'work';
    return site?.graph?.nodes?.find(item => item.id === id)?.route || null;
  };

  const clearTransientGraphState = () => {
    document.querySelectorAll('#site-graph .site-graph-edges path').forEach(edge => {
      edge.classList.remove(
        'is-work-strong', 'is-work-soft', 'is-upstream', 'is-downstream',
        'is-lateral', 'is-muted-soft', 'is-selected-downset'
      );
      edge.style.opacity = '0';
    });
    document.querySelectorAll('#site-graph .site-graph-timeline').forEach(edge => {
      edge.style.opacity = '0';
    });
    document.querySelectorAll('#site-graph .site-graph-node').forEach(node => {
      node.classList.remove('is-work-strong', 'is-work-soft', 'is-upstream', 'is-downstream', 'is-lateral', 'is-muted-soft');
    });
  };

  const makeWorkDecorationGhost = () => {
    const svg = document.querySelector('#site-graph .site-graph-svg');
    const decorations = document.querySelector('#site-graph .site-graph-decorations');
    if (!svg || !decorations || !decorations.children.length) return;

    const ghost = decorations.cloneNode(true);
    ghost.classList.add('v8-work-decoration-ghost');
    ghost.removeAttribute('aria-live');
    ghost.style.pointerEvents = 'none';
    svg.appendChild(ghost);

    const animation = ghost.animate(
      [
        { opacity: 1, transform: 'translateY(0) scale(1)' },
        { opacity: 0, transform: 'translateY(-9px) scale(.965)' }
      ],
      {
        duration: realReduced.matches ? 1 : 720,
        easing: 'cubic-bezier(.22,.72,.22,1)',
        fill: 'forwards'
      }
    );
    animation.finished.finally(() => ghost.remove());
  };

  let transitionCleanup = 0;
  const beginRoutePolish = targetRoute => {
    const currentRoute = normaliseRoute(document.body.dataset.graphRoute || location.hash);
    if (!targetRoute || targetRoute === currentRoute) return;
    if (document.body.dataset.graphMode === 'atlas') return;

    beginSlowTransition();
    document.body.classList.add('is-v8-route-transition');

    const leavingWork = document.body.dataset.graphMode === 'work' && !targetRoute.startsWith('work');
    if (leavingWork) {
      document.body.classList.add('is-v8-departing-work');
      makeWorkDecorationGhost();
      closeWorkConceptDetail();
    }

    // This runs on window capture, before V6 snapshots the old scene. The
    // snapshot therefore already contains invisible edges.
    clearTransientGraphState();

    clearTimeout(transitionCleanup);
    transitionCleanup = setTimeout(() => {
      document.body.classList.remove('is-v8-route-transition', 'is-v8-departing-work');
      document.querySelectorAll('#site-graph .site-graph-edges path, #site-graph .site-graph-timeline').forEach(edge => {
        edge.style.opacity = '';
      });
    }, 1800);
  };

  window.addEventListener('click', event => {
    if (event.button !== 0) return;
    if (event.defaultPrevented) return;
    const route = routeForTarget(event.target);
    if (route) beginRoutePolish(route);
  }, true);

  window.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.defaultPrevented) return;
    const route = routeForTarget(event.target);
    if (route) beginRoutePolish(route);
  }, true);

  window.addEventListener('hashchange', () => {
    const route = normaliseRoute(location.hash);
    if (!route.startsWith('work')) closeWorkConceptDetail();
  });
})();
