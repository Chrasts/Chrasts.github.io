(() => {
  const site = window.SITE_DATA;
  const graphNodes = site?.graph?.nodes || [];
  const graphNodeMap = new Map(graphNodes.map(node => [node.id, node]));
  const childrenFor = id => graphNodes.filter(node => node.parentIds?.includes(id));
  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';
  const routeForNode = node => node?.route || 'overview';

  const patchWorkData = data => {
    if (!data) return;
    const research = data.attributes?.find(attribute => attribute.id === 'research');
    if (research) research.label = 'Research';
    const insolvency = data.projects?.find(project => project.id === 'insolvency');
    if (insolvency) {
      insolvency.graphLabel = 'Insolvency Analysis';
      insolvency.title = 'Insolvency Analysis';
    }
  };

  patchWorkData(site?.work);
  patchWorkData(window.PORTFOLIO_DATA);

  if (site?.graph?.nodes) {
    const insolvencyNode = site.graph.nodes.find(node => node.id === 'project-insolvency');
    if (insolvencyNode) {
      insolvencyNode.label = 'Insolvency Analysis';
      insolvencyNode.detailLabel = 'Insolvency Analysis';
    }
    const researchThemeNode = site.graph.nodes.find(node => node.id === 'work-theme-research');
    if (researchThemeNode) researchThemeNode.label = 'Research';
  }

  const ensureStylesheet = (href, marker) => {
    if (document.querySelector(`link[${marker}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute(marker, 'true');
    document.head.appendChild(link);
  };
  ensureStylesheet('graph-v8.css', 'data-profile-graph-v8');
  ensureStylesheet('graph-v9.css', 'data-profile-graph-v9');

  const mobileViewport = window.matchMedia('(max-width: 900px)');
  const ensureMobileLayer = () => {
    if (!mobileViewport.matches) return;
    setTimeout(() => setTimeout(() => {
      if (!mobileViewport.matches) return;
      ensureStylesheet('mobile.css', 'data-profile-mobile');
      if (!document.querySelector('script[data-profile-mobile-app]')) {
        const script = document.createElement('script');
        script.src = 'mobile-app.js';
        script.dataset.profileMobileApp = 'true';
        document.body.appendChild(script);
      }
    }, 0), 0);
  };
  ensureMobileLayer();
  mobileViewport.addEventListener?.('change', event => {
    if (event.matches) ensureMobileLayer();
  });

  const nativeDocumentQuerySelectorAll = Document.prototype.querySelectorAll;
  const transitionBaseSelectors = new Set([
    '#site-graph .site-graph-node[data-node-id]',
    '#site-graph .site-graph-edges path[data-source][data-target]'
  ]);

  Document.prototype.querySelectorAll = function(selector) {
    const result = nativeDocumentQuerySelectorAll.call(this, selector);
    if (
      this !== document ||
      !document.body?.classList.contains('is-v9-transitioning') ||
      !transitionBaseSelectors.has(selector)
    ) {
      return result;
    }
    return [...result].filter(element => !element.closest('.v9-transition-overlay'));
  };

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
    get matches() { return forceSnap || realReduced.matches; },
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
    setTimeout(() => { window.matchMedia = realMatchMedia; }, 0);
  };
  window.matchMedia = query =>
    query === '(prefers-reduced-motion: reduce)' ? proxyReduced : realMatchMedia(query);

  let atlasRootPinned = false;
  let atlasRootVisuallyCleared = false;

  const clearAtlasRootVisual = ({ closeDetail = true } = {}) => {
    if (document.body.dataset.graphMode !== 'atlas') return;
    document.querySelectorAll('#site-graph .site-graph-node').forEach(element => {
      element.classList.remove('is-atlas-origin', 'is-upstream', 'is-downstream', 'is-lateral', 'is-muted-soft');
    });
    document.querySelectorAll('#site-graph .site-graph-edges path').forEach(element => {
      element.classList.remove('is-upstream', 'is-downstream', 'is-lateral', 'is-muted-soft');
    });
    if (closeDetail) {
      const panel = document.querySelector('#site-detail-panel');
      if (panel?.classList.contains('is-open')) panel.querySelector('.detail-close')?.click();
    }
  };

  const scheduleAtlasRootClear = options => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (atlasRootVisuallyCleared) clearAtlasRootVisual(options);
    }));
  };

  document.addEventListener('click', event => {
    if (document.body.dataset.graphMode !== 'atlas') {
      atlasRootPinned = false;
      atlasRootVisuallyCleared = false;
      return;
    }

    const node = event.target.closest?.('.site-graph-node[data-node-id]');
    if (node?.dataset.nodeId === 'stepan-chrast') {
      const wasPinned = atlasRootPinned;
      if (wasPinned) {
        atlasRootPinned = false;
        atlasRootVisuallyCleared = true;
        scheduleAtlasRootClear({ closeDetail: true });
      } else {
        atlasRootPinned = true;
        atlasRootVisuallyCleared = false;
      }
      return;
    }

    if (node) {
      atlasRootPinned = false;
      atlasRootVisuallyCleared = false;
      return;
    }

    const insideGraph = event.target.closest?.('.site-graph-viewport');
    const utility = event.target.closest?.('.atlas-controls,.graph-routebar,.scene-detail,.mobile-graph-dock,.mobile-control-sheet');
    if (insideGraph && !utility && atlasRootPinned) {
      atlasRootPinned = false;
      atlasRootVisuallyCleared = true;
      scheduleAtlasRootClear({ closeDetail: true });
    }
  });

  document.addEventListener('mouseleave', event => {
    if (!atlasRootVisuallyCleared || document.body.dataset.graphMode !== 'atlas') return;
    if (event.target.closest?.('.site-graph-node[data-node-id]')) scheduleAtlasRootClear({ closeDetail: false });
  }, true);

  document.addEventListener('focusout', event => {
    if (!atlasRootVisuallyCleared || document.body.dataset.graphMode !== 'atlas') return;
    if (event.target.closest?.('.site-graph-node[data-node-id]')) scheduleAtlasRootClear({ closeDetail: false });
  }, true);

  document.addEventListener('change', event => {
    if (!atlasRootVisuallyCleared || document.body.dataset.graphMode !== 'atlas') return;
    if (event.target.closest?.('#atlas-controls')) scheduleAtlasRootClear({ closeDetail: false });
  });

  const work = site?.work;
  const detailPanel = () => document.querySelector('#site-detail-panel');
  const attributeIds = work?.attributes?.map(attribute => attribute.id) || [];
  const attributeMap = new Map((work?.attributes || []).map(attribute => [attribute.id, attribute]));
  const projects = work?.projects || [];
  const projectMap = new Map(projects.map(project => [project.id, project]));

  const subset = (left, right) => left.every(value => right.includes(value));
  const intersection = arrays => {
    if (!arrays.length) return [...attributeIds];
    return arrays.reduce(
      (result, current) => result.filter(value => current.includes(value)),
      [...arrays[0]]
    );
  };
  const conceptKey = intent => [...intent].sort().join('|');
  const closureIntent = seed => {
    const extent = projects.filter(project => subset(seed, project.lattice));
    if (!extent.length) return [...attributeIds].sort();
    return intersection(extent.map(project => project.lattice)).sort();
  };
  const projectConceptKey = project => conceptKey(closureIntent(project.lattice));

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

  const closeLocalWorkProjectDetail = () => {
    const panel = detailPanel();
    if (!panel?.classList.contains('is-work-project-detail-local')) return false;
    panel.classList.remove('is-open', 'is-work-project-detail-local');
    if (normaliseRoute(location.hash).startsWith('work/project/')) {
      history.replaceState(null, '', '#work');
      document.body.dataset.graphRoute = 'work';
    }
    setTimeout(() => {
      if (!panel.classList.contains('is-open')) panel.hidden = true;
    }, realReduced.matches ? 0 : 180);
    return true;
  };

  const openLocalWorkProjectDetail = projectId => {
    const project = projectMap.get(projectId);
    const panel = detailPanel();
    if (!project || !panel) return false;

    document.body.classList.remove('has-work-concept-detail');
    panel.classList.remove('is-work-concept-detail', 'is-work-project-detail-local');
    panel.innerHTML = '';
    panel.hidden = false;
    panel.classList.add('is-work-project-detail-local');

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'detail-close';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Close detail');
    close.addEventListener('click', closeLocalWorkProjectDetail);

    const eyebrow = document.createElement('p');
    eyebrow.className = 'detail-eyebrow';
    eyebrow.textContent = project.type;
    const heading = document.createElement('h2');
    heading.textContent = project.title;
    const summary = document.createElement('p');
    summary.className = 'detail-summary';
    summary.textContent = project.description;
    panel.append(close, eyebrow, heading, summary);

    const tech = document.createElement('p');
    tech.className = 'detail-meta';
    tech.textContent = project.tech.join(' · ');
    panel.appendChild(tech);

    if (project.note) {
      const note = document.createElement('p');
      note.className = 'detail-summary detail-note';
      note.textContent = project.note;
      panel.appendChild(note);
    }

    if (project.links?.length) {
      const linksHeading = document.createElement('p');
      linksHeading.className = 'detail-list-title';
      linksHeading.textContent = 'Links';
      const links = document.createElement('div');
      links.className = 'detail-node-list';
      project.links.forEach(link => {
        const anchor = document.createElement('a');
        anchor.href = link.href;
        anchor.target = '_blank';
        anchor.rel = 'noreferrer';
        anchor.textContent = link.label;
        links.appendChild(anchor);
      });
      panel.append(linksHeading, links);
    }

    const route = `work/project/${project.id}`;
    history.replaceState(null, '', `#${route}`);
    document.body.dataset.graphRoute = route;
    document.querySelectorAll('.work-project-anchor-v5[data-project-id]').forEach(element => {
      element.classList.toggle('is-selected', element.dataset.projectId === project.id);
    });
    requestAnimationFrame(() => panel.classList.add('is-open'));
    return true;
  };

  const openWorkConceptDetail = (themeIds, { exactNode = false } = {}) => {
    const panel = detailPanel();
    if (!work || !panel) return;

    const ids = [...new Set(themeIds)].filter(id => attributeMap.has(id));
    if (!ids.length) return;
    const key = conceptKey(ids);
    const labels = ids.map(id => attributeMap.get(id).label);
    const matchingProjects = projects
      .filter(project => exactNode
        ? projectConceptKey(project) === key
        : ids.every(id => project.lattice.includes(id)))
      .sort((a, b) => a.order - b.order);

    panel.innerHTML = '';
    panel.hidden = false;
    panel.classList.remove('is-work-project-detail-local');
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

    const listHeading = document.createElement('p');
    listHeading.className = 'detail-list-title';
    listHeading.textContent = ids.length === 1 && !exactNode
      ? 'Projects in this theme'
      : 'Projects in these themes';

    panel.append(close, heading, listHeading);

    if (matchingProjects.length) {
      const list = document.createElement('div');
      list.className = 'work-concept-projects';
      matchingProjects.forEach(project => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'work-concept-project';
        button.dataset.projectId = project.id;
        button.textContent = project.title;
        button.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          openLocalWorkProjectDetail(project.id);
        });
        list.appendChild(button);
      });
      panel.appendChild(list);
    } else {
      const empty = document.createElement('p');
      empty.className = 'work-concept-empty';
      empty.textContent = exactNode
        ? 'No projects are assigned directly to this node.'
        : 'No projects are currently assigned to these themes.';
      panel.appendChild(empty);
    }

    requestAnimationFrame(() => panel.classList.add('is-open'));
  };

  const workConceptThemes = element => {
    const id = element?.dataset?.nodeId || '';
    if (!id.startsWith('work-concept:')) return null;
    const key = id.slice('work-concept:'.length);
    return key && key !== 'top' ? key.split('|').filter(Boolean) : [];
  };

  const interceptWorkInspection = event => {
    if (document.body.dataset.graphMode !== 'work') return false;
    const target = event.target;

    const projectLabel = target.closest?.('.work-project-anchor-v5[data-project-id]');
    if (projectLabel) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openLocalWorkProjectDetail(projectLabel.dataset.projectId);
      return true;
    }

    const conceptNode = target.closest?.('.site-graph-node[data-node-id^="work-concept:"]');
    if (conceptNode) {
      const themes = workConceptThemes(conceptNode);
      if (themes?.length) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openWorkConceptDetail(themes, { exactNode: true });
        return true;
      }
    }

    const themeLabel = target.closest?.('.work-theme-label-v5[data-theme-id]');
    if (themeLabel) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openWorkConceptDetail([themeLabel.dataset.themeId], { exactNode: false });
      return true;
    }
    return false;
  };

  const routeFromActivationTarget = target => {
    const routeElement = target.closest?.('[data-route]');
    if (routeElement) {
      return normaliseRoute(routeElement.dataset.route || routeElement.getAttribute('href'));
    }
    const nodeElement = target.closest?.('.site-graph-node[data-node-id]');
    if (!nodeElement) return null;
    const node = graphNodeMap.get(nodeElement.dataset.nodeId);
    return node ? normaliseRoute(routeForNode(node)) : null;
  };

  const interceptRedundantActivation = event => {
    if (document.body.dataset.graphMode !== 'focus') return false;
    const route = routeFromActivationTarget(event.target);
    if (!route) return false;
    const currentRoute = normaliseRoute(document.body.dataset.graphRoute || location.hash);
    if (route !== currentRoute) return false;

    const nodeElement = event.target.closest?.('.site-graph-node[data-node-id]');
    if (nodeElement) {
      const nodeId = nodeElement.dataset.nodeId;
      if (!childrenFor(nodeId).length) return false;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    return true;
  };

  window.addEventListener('click', event => {
    if (event.button !== 0) return;
    if (interceptRedundantActivation(event)) return;
    interceptWorkInspection(event);
  }, true);

  window.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      if (interceptRedundantActivation(event)) return;
      if (interceptWorkInspection(event)) return;
    }
    if (event.key === 'Escape') {
      if (closeLocalWorkProjectDetail()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (document.body.classList.contains('has-work-concept-detail')) closeWorkConceptDetail();
    }
  }, true);

  window.addEventListener('hashchange', () => {
    const route = normaliseRoute(location.hash);
    if (!route.startsWith('work')) {
      closeWorkConceptDetail();
      const panel = detailPanel();
      panel?.classList.remove('is-work-project-detail-local');
    }
    if (route !== 'atlas') {
      atlasRootPinned = false;
      atlasRootVisuallyCleared = false;
    }
  });
})();
