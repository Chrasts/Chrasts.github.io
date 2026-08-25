(() => {
  if (window.ProfileAccessibility) return;

  const site = window.SITE_DATA;
  const graph = site?.graph;
  const work = site?.work;
  if (!graph?.nodes?.length) return;

  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const attributeMap = new Map((work?.attributes || []).map(attribute => [attribute.id, attribute]));
  const rootId = graph.rootId || 'stepan-chrast';
  let root = null;
  let graphObserver = null;
  let bodyObserver = null;
  let frame = 0;
  let syncCount = 0;

  const normaliseRoute = value =>
    String(value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';
  const currentRoute = () => normaliseRoute(document.body?.dataset.graphRoute || location.hash);
  const currentMode = () => document.body?.dataset.graphMode || 'overview';
  const topRoute = route => {
    const value = normaliseRoute(route);
    if (value === 'overview' || value === 'atlas') return value;
    return value.split('/')[0] || 'overview';
  };
  const text = element => String(element?.textContent || '').replace(/\s+/g, ' ').trim();

  const humanType = type => ({
    profile: 'Profile',
    section: 'Profile area',
    knowledge: 'Knowledge topic',
    experience: 'Experience item',
    education: 'Education item',
    credential: 'Credential',
    interest: 'About item',
    project: 'Project',
    'work-theme': 'Work theme',
    'work-concept': 'Work concept'
  }[type] || 'Profile item');

  const workConceptLabel = id => {
    if (!String(id).startsWith('work-concept:')) return null;
    const key = String(id).slice('work-concept:'.length);
    if (!key || key === 'top') return 'Work';
    const labels = key.split('|')
      .map(attributeId => attributeMap.get(attributeId)?.label || attributeId)
      .filter(Boolean);
    return labels.length ? labels.join(' and ') : 'Work concept';
  };

  const modelLabel = (id, element) => {
    const node = nodeMap.get(id);
    return node?.detailLabel || node?.label || workConceptLabel(id) || text(element.querySelector('.site-graph-label')) || 'Profile item';
  };

  const nodeType = id => nodeMap.get(id)?.type || (String(id).startsWith('work-concept:') ? 'work-concept' : 'profile');

  const nodeAction = (id, element) => {
    const mode = currentMode();
    const route = currentRoute();
    const model = nodeMap.get(id);

    if (mode === 'atlas') {
      if (id === rootId) return 'Open profile entry';
      return element.classList.contains('is-previewed')
        ? 'Details open; activate again to enter this area'
        : 'Inspect in Atlas';
    }

    if (mode === 'work') {
      if (id === rootId) return 'Return to profile overview';
      if (id === 'work') return 'Clear Work concept filter';
      return 'Apply this Work concept filter';
    }

    const target = normaliseRoute(model?.route || 'overview');
    return target === route ? 'Current profile area' : 'Open this profile area';
  };

  const syncNode = element => {
    const id = element.dataset.nodeId;
    if (!id || element.closest('.v9-transition-overlay')) return;
    const label = modelLabel(id, element);
    const type = humanType(nodeType(id));
    element.setAttribute('role', 'button');
    element.setAttribute('tabindex', '0');
    element.setAttribute('aria-label', `${label}. ${type}. ${nodeAction(id, element)}.`);

    const model = nodeMap.get(id);
    const route = normaliseRoute(model?.route || '');
    if (currentMode() !== 'atlas' && route && route === currentRoute()) element.setAttribute('aria-current', 'page');
    else element.removeAttribute('aria-current');

    if (currentMode() === 'atlas' && id !== rootId) {
      element.setAttribute('aria-controls', 'site-detail-panel');
      element.setAttribute('aria-expanded', element.classList.contains('is-previewed') ? 'true' : 'false');
    } else {
      element.removeAttribute('aria-controls');
      element.removeAttribute('aria-expanded');
    }
  };

  const syncProjectAnchor = element => {
    const label = text(element) || element.dataset.projectId || 'project';
    const filtered = element.classList.contains('is-filtered-out');
    element.setAttribute('role', 'link');
    element.setAttribute('aria-label', `Open project ${label}.`);
    element.setAttribute('tabindex', filtered ? '-1' : '0');
    if (filtered) element.setAttribute('aria-hidden', 'true');
    else element.removeAttribute('aria-hidden');
    if (element.classList.contains('is-selected')) element.setAttribute('aria-current', 'page');
    else element.removeAttribute('aria-current');
  };

  const syncThemeControl = element => {
    const label = text(element) || element.dataset.themeId || 'theme';
    element.setAttribute('role', 'button');
    element.setAttribute('tabindex', '0');
    element.setAttribute('aria-label', `Toggle Work theme ${label}.`);
    element.setAttribute('aria-pressed', element.classList.contains('is-selected') ? 'true' : 'false');
  };

  const syncPrimaryNavigation = () => {
    const active = topRoute(currentRoute());
    document.querySelectorAll('#main-nav [data-route], .brand[data-route]').forEach(element => {
      const target = topRoute(element.dataset.route || element.getAttribute('href'));
      if (target === active) element.setAttribute('aria-current', 'page');
      else element.removeAttribute('aria-current');
    });
  };

  const sync = () => {
    frame = 0;
    root ||= document.querySelector('#site-graph');
    if (!root?.isConnected) return;

    const svg = root.querySelector('.site-graph-svg');
    if (svg) {
      svg.setAttribute('role', 'group');
      svg.setAttribute('aria-labelledby', 'site-graph-title site-graph-help');
      svg.setAttribute('focusable', 'false');
    }

    const edges = root.querySelector('.site-graph-edges');
    if (edges) {
      edges.setAttribute('aria-hidden', 'true');
      edges.setAttribute('focusable', 'false');
    }

    root.querySelectorAll('.site-graph-halo').forEach(element => {
      element.setAttribute('aria-hidden', 'true');
      element.setAttribute('focusable', 'false');
    });
    root.querySelectorAll('.site-graph-node[data-node-id]').forEach(syncNode);
    root.querySelectorAll('.work-project-anchor-v5[data-project-id]').forEach(syncProjectAnchor);
    root.querySelectorAll('.work-theme-label-v5[data-theme-id]').forEach(syncThemeControl);
    syncPrimaryNavigation();
    syncCount += 1;
  };

  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(sync);
  };

  const bind = () => {
    const next = document.querySelector('#site-graph');
    if (!next) return false;
    if (root === next && graphObserver) {
      schedule();
      return true;
    }

    graphObserver?.disconnect();
    bodyObserver?.disconnect();
    root = next;
    graphObserver = new MutationObserver(schedule);
    graphObserver.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    bodyObserver = new MutationObserver(schedule);
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['data-graph-route', 'data-graph-mode', 'data-root-landing'] });

    window.addEventListener('hashchange', schedule);
    window.addEventListener('profile:scene-state', schedule);
    window.addEventListener('profile:transition-finish', schedule);
    root.addEventListener('click', schedule, true);
    root.addEventListener('keydown', schedule, true);
    schedule();
    return true;
  };

  const snapshot = () => {
    const svg = root?.querySelector('.site-graph-svg');
    const interactive = [...(root?.querySelectorAll('.site-graph-node[data-node-id], .work-project-anchor-v5[data-project-id], .work-theme-label-v5[data-theme-id]') || [])]
      .filter(element => !element.closest('.v9-transition-overlay') && element.getAttribute('aria-hidden') !== 'true');
    return {
      ready: Boolean(root?.isConnected && svg),
      syncCount,
      graphRole: svg?.getAttribute('role') || null,
      graphLabelledBy: svg?.getAttribute('aria-labelledby') || null,
      edgesHidden: root?.querySelector('.site-graph-edges')?.getAttribute('aria-hidden') === 'true',
      interactiveCount: interactive.length,
      unnamedInteractiveCount: interactive.filter(element => !String(element.getAttribute('aria-label') || '').trim()).length,
      hiddenFocusableProjectCount: [...(root?.querySelectorAll('.work-project-anchor-v5.is-filtered-out') || [])]
        .filter(element => element.getAttribute('tabindex') !== '-1' || element.getAttribute('aria-hidden') !== 'true').length,
      currentNavigationCount: document.querySelectorAll('#main-nav [aria-current="page"], .brand[aria-current="page"]').length
    };
  };

  window.ProfileAccessibility = Object.freeze({ refresh: schedule, snapshot });

  if (!bind()) {
    const observer = new MutationObserver(() => {
      if (!bind()) return;
      observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
