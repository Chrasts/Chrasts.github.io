(() => {
  const site = window.SITE_DATA;
  const graph = site?.graph;
  if (!site?.profile || !graph?.nodes?.length) return;

  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const childrenFor = id => graph.nodes.filter(node => node.parentIds?.includes(id));
  const root = nodeMap.get(graph.rootId);
  const hero = document.querySelector('.hero');
  const explorer = document.querySelector('#site-explorer');
  const graphRoot = document.querySelector('#site-graph');
  const breadcrumb = document.querySelector('#graph-breadcrumb');
  const workBreadcrumb = document.querySelector('#work-breadcrumb');
  const workRouteHeader = document.querySelector('#work-route-header');
  const detailPanel = document.querySelector('#site-detail-panel');
  const graphTitle = document.querySelector('#site-graph-title');
  const graphKicker = document.querySelector('#site-graph-kicker');
  const graphHelp = document.querySelector('#site-graph-help');
  const graphStatus = document.querySelector('#site-graph-status');
  const atlasControls = document.querySelector('#atlas-controls');
  const atlasHierarchy = document.querySelector('#atlas-hierarchy');
  const atlasCrosslinks = document.querySelector('#atlas-crosslinks');
  const atlasSecondary = document.querySelector('#atlas-secondary');
  const atlasShowAll = document.querySelector('#atlas-show-all');
  const workView = document.querySelector('#work');
  const legacyViews = [...document.querySelectorAll('.legacy-section')];
  const footer = document.querySelector('footer');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  if (!root || !hero || !explorer || !graphRoot || !breadcrumb || !detailPanel || !workView) return;

  let state = { route: 'overview', mode: 'overview', node: root };
  const atlasOptions = { hierarchy: true, crossLinks: true, secondary: false };

  const normaliseRoute = value => (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';

  const nodeForRoute = route => {
    if (route === 'overview') return root;
    return graph.nodes.find(node => node.route === route) || null;
  };

  const routeForNode = node => node?.route || 'overview';

  const ancestorIdsFor = nodeId => {
    const ancestors = new Set();
    const pending = [...(nodeMap.get(nodeId)?.parentIds || [])];
    while (pending.length) {
      const parentId = pending.pop();
      if (ancestors.has(parentId)) continue;
      ancestors.add(parentId);
      pending.push(...(nodeMap.get(parentId)?.parentIds || []));
    }
    return ancestors;
  };

  const edgeTypeLabel = type => ({
    hierarchy: 'Hierarchy',
    evidence: 'Evidence in work',
    'used-in': 'Used in work',
    'experience-link': 'Experience connection',
    'education-link': 'Education connection',
    related: 'Related'
  }[type] || 'Profile connection');

  const primaryPath = node => {
    const path = [];
    const visited = new Set();
    let current = node;

    while (current && !visited.has(current.id)) {
      path.unshift(current);
      visited.add(current.id);
      current = current.parentIds?.length ? nodeMap.get(current.parentIds[0]) : null;
    }

    return path;
  };

  const humanType = type => ({
    section: 'Profile area',
    knowledge: 'Knowledge',
    experience: 'Experience',
    education: 'Education',
    credential: 'Credential',
    interest: 'About',
    project: 'Project',
    profile: 'Profile'
  }[type] || 'Profile item');

  const updateHash = route => {
    const target = `#${route}`;
    if (location.hash !== target) location.hash = target;
    else renderRoute(route);
  };

  const routeFromElement = element => element.dataset.route || normaliseRoute(element.getAttribute('href'));

  const bindRoute = element => {
    element.addEventListener('click', event => {
      event.preventDefault();
      updateHash(routeFromElement(element));
    });
  };

  document.querySelectorAll('[data-route]').forEach(bindRoute);

  const syncAtlasControls = () => {
    if (!atlasControls) return;
    atlasControls.hidden = state.mode !== 'atlas';
    if (atlasHierarchy) atlasHierarchy.checked = atlasOptions.hierarchy;
    if (atlasCrosslinks) atlasCrosslinks.checked = atlasOptions.crossLinks;
    if (atlasSecondary) atlasSecondary.checked = atlasOptions.secondary;
  };

  [atlasHierarchy, atlasCrosslinks, atlasSecondary].filter(Boolean).forEach(control => {
    control.addEventListener('change', () => {
      atlasOptions.hierarchy = atlasHierarchy?.checked ?? true;
      atlasOptions.crossLinks = atlasCrosslinks?.checked ?? true;
      atlasOptions.secondary = atlasSecondary?.checked ?? false;
      if (state.mode !== 'atlas') return;
      renderGraph();
      graphStatus.textContent = 'Atlas structure filters updated.';
    });
  });
  atlasShowAll?.addEventListener('click', () => {
    atlasOptions.hierarchy = true;
    atlasOptions.crossLinks = true;
    atlasOptions.secondary = true;
    syncAtlasControls();
    if (state.mode === 'atlas') {
      renderGraph();
      graphStatus.textContent = 'Atlas now shows all available relationships.';
    }
  });

  const renderBreadcrumb = (target, container, atlas = false) => {
    container.innerHTML = '';
    const path = atlas ? [root, { label: 'Atlas', route: 'atlas' }] : primaryPath(target);

    path.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'graph-crumb';
      button.textContent = item.label;
      button.dataset.route = item.route || 'overview';
      button.setAttribute('aria-current', String(index === path.length - 1));
      bindRoute(button);
      container.appendChild(button);

      if (index < path.length - 1) {
        const edge = document.createElement('span');
        edge.className = 'graph-crumb-edge';
        edge.setAttribute('aria-hidden', 'true');
        container.appendChild(edge);
      }
    });
  };

  const visibleGraph = () => {
    if (state.mode === 'overview') {
      const nodes = [root, ...childrenFor(root.id)];
      return { nodes, hierarchyOnly: true };
    }

    if (state.mode === 'atlas') return { nodes: graph.nodes, hierarchyOnly: false };

    const children = childrenFor(state.node.id);
    const parents = state.node.parentIds?.map(id => nodeMap.get(id)).filter(Boolean) || [];
    return {
      nodes: [...new Map([...parents, state.node, ...children].map(node => [node.id, node])).values()],
      hierarchyOnly: true
    };
  };

  const depthFor = (node, memo = new Map(), trail = new Set()) => {
    if (memo.has(node.id)) return memo.get(node.id);
    if (node.id === root.id || !node.parentIds?.length || trail.has(node.id)) return 0;
    const nextTrail = new Set(trail).add(node.id);
    const depth = 1 + Math.min(...node.parentIds
      .map(parentId => nodeMap.get(parentId))
      .filter(Boolean)
      .map(parent => depthFor(parent, memo, nextTrail)));
    memo.set(node.id, depth);
    return depth;
  };

  const layoutGraph = nodes => {
    if (state.mode === 'overview') {
      const width = 920;
      const height = 350;
      const positions = new Map([[root.id, { x: width / 2, y: 76 }]]);
      const sections = nodes.filter(node => node.id !== root.id);
      sections.forEach((node, index) => {
        positions.set(node.id, { x: 108 + index * ((width - 216) / Math.max(sections.length - 1, 1)), y: 245 });
      });
      return { width, height, positions };
    }

    if (state.mode === 'focus') {
      const width = 920;
      const height = 380;
      const positions = new Map();
      const children = childrenFor(state.node.id).filter(child => nodes.some(node => node.id === child.id));
      const parents = nodes.filter(node => state.node.parentIds?.includes(node.id));

      if (state.node.id === 'experience') {
        const timelineChildren = [...children].sort((left, right) => (left.timelineOrder || 0) - (right.timelineOrder || 0));
        parents.forEach((node, index) => positions.set(node.id, {
          x: width / 2 + (index - (parents.length - 1) / 2) * 180,
          y: 52
        }));
        positions.set(state.node.id, { x: width / 2, y: 135 });
        timelineChildren.forEach((node, index) => positions.set(node.id, {
          x: 135 + index * ((width - 270) / Math.max(timelineChildren.length - 1, 1)),
          y: 286
        }));
        return {
          width,
          height,
          positions,
          timeline: { x1: 112, x2: width - 112, y: 286 }
        };
      }

      positions.set(state.node.id, { x: width / 2, y: parents.length ? 150 : 78 });
      parents.forEach((node, index) => positions.set(node.id, {
        x: width / 2 + (index - (parents.length - 1) / 2) * 180,
        y: 60
      }));
      children.forEach((node, index) => positions.set(node.id, {
        x: 110 + index * ((width - 220) / Math.max(children.length - 1, 1)),
        y: 290
      }));
      return { width, height, positions };
    }

    const memo = new Map();
    const levels = new Map();
    nodes.forEach(node => {
      const depth = depthFor(node, memo);
      if (!levels.has(depth)) levels.set(depth, []);
      levels.get(depth).push(node);
    });
    const maxLevelSize = Math.max(...[...levels.values()].map(level => level.length));
    const width = Math.max(1000, 170 * maxLevelSize + 120);
    const height = Math.max(560, 135 * levels.size + 80);
    const positions = new Map();
    [...levels.entries()].forEach(([depth, level]) => {
      level.sort((left, right) => left.label.localeCompare(right.label));
      level.forEach((node, index) => positions.set(node.id, {
        x: 80 + index * ((width - 160) / Math.max(level.length - 1, 1)),
        y: 60 + depth * ((height - 120) / Math.max(levels.size - 1, 1))
      }));
    });
    return { width, height, positions };
  };

  const renderDetail = () => {
    detailPanel.innerHTML = '';
    const target = state.node;
    const title = document.createElement('h2');
    const eyebrow = document.createElement('p');
    eyebrow.className = 'detail-eyebrow';
    const summary = document.createElement('p');
    summary.className = 'detail-summary';

    if (state.mode === 'overview') {
      eyebrow.textContent = 'Overview';
      title.textContent = site.profile.name;
      summary.textContent = 'Select an area in the graph or the menu. Each view keeps the local structure readable and opens detail progressively.';
    } else if (state.mode === 'atlas') {
      eyebrow.textContent = 'Atlas · Full graph';
      title.textContent = 'Profile structure';
      summary.textContent = 'This exploratory view shows the current global structure and selected cross-links. Choose any node to return to its focused local view.';
    } else {
      eyebrow.textContent = humanType(target.type);
      title.textContent = target.detailLabel || target.label;
      summary.textContent = target.summary || 'A focused part of the profile.';
    }

    detailPanel.append(eyebrow, title, summary);

    if (target.status) {
      const status = document.createElement('p');
      status.className = 'detail-status';
      status.textContent = target.status;
      detailPanel.appendChild(status);
    }
    if (target.meta) {
      const meta = document.createElement('p');
      meta.className = 'detail-meta';
      meta.textContent = target.meta;
      detailPanel.appendChild(meta);
    }

    const facts = [
      ['Role', target.role],
      ['Programme', target.programme],
      ['Organisation', target.organisation]
    ].filter(([, value]) => value);
    if (facts.length && state.mode === 'focus') {
      const factList = document.createElement('dl');
      factList.className = 'detail-facts';
      facts.forEach(([label, value]) => {
        const term = document.createElement('dt');
        term.textContent = label;
        const description = document.createElement('dd');
        description.textContent = value;
        factList.append(term, description);
      });
      detailPanel.appendChild(factList);
    }

    if (target.highlights?.length && state.mode === 'focus') {
      const heading = document.createElement('p');
      heading.className = 'detail-list-title';
      heading.textContent = target.type === 'experience' ? 'Key responsibilities' : 'Key areas';
      const highlights = document.createElement('ul');
      highlights.className = 'detail-highlights';
      target.highlights.forEach(item => {
        const point = document.createElement('li');
        point.textContent = item;
        highlights.appendChild(point);
      });
      detailPanel.append(heading, highlights);
    }

    const children = state.mode === 'atlas' ? [] : childrenFor(target.id);
    if (children.length) {
      const heading = document.createElement('p');
      heading.className = 'detail-list-title';
      heading.textContent = 'Explore next';
      const list = document.createElement('div');
      list.className = 'detail-node-list';
      children.forEach(child => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = child.label;
        button.dataset.route = child.route;
        bindRoute(button);
        list.appendChild(button);
      });
      detailPanel.append(heading, list);
    }

    const relationLabels = {
      evidence: 'Evidence in work',
      'used-in': 'Used in work',
      'experience-link': 'Experience connection',
      'education-link': 'Education connection',
      related: 'Related in the profile'
    };
    const relatedByType = new Map();
    graph.edges
      .filter(edge => edge.source === target.id || edge.target === target.id)
      .forEach(edge => {
        const related = nodeMap.get(edge.source === target.id ? edge.target : edge.source);
        if (!related) return;
        if (!relatedByType.has(edge.type)) relatedByType.set(edge.type, []);
        relatedByType.get(edge.type).push(related);
      });
    if (state.mode === 'focus') {
      relatedByType.forEach((related, type) => {
        const heading = document.createElement('p');
        heading.className = 'detail-list-title';
        heading.textContent = relationLabels[type] || 'Connected in the profile';
        const list = document.createElement('div');
        list.className = 'detail-node-list is-secondary';
        [...new Map(related.map(node => [node.id, node])).values()].forEach(node => {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = node.label;
          button.dataset.route = node.route;
          bindRoute(button);
          list.appendChild(button);
        });
        detailPanel.append(heading, list);
      });
    }

    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'detail-route-action';
    const parent = state.mode === 'focus' ? nodeMap.get(target.parentIds?.[0]) : null;
    action.textContent = state.mode === 'atlas'
      ? 'Back to overview'
      : parent
        ? `Back to ${parent.label}`
        : 'Open Atlas';
    action.dataset.route = state.mode === 'atlas'
      ? 'overview'
      : parent
        ? routeForNode(parent)
        : 'atlas';
    bindRoute(action);
    detailPanel.appendChild(action);
  };

  const graphEdges = visible => {
    const ids = new Set(visible.map(node => node.id));
    const hierarchy = visible.flatMap(node => (node.parentIds || [])
      .filter(parentId => ids.has(parentId))
      .map(parentId => ({ source: parentId, target: node.id, type: 'hierarchy' })));
    if (state.mode !== 'atlas') return hierarchy;

    const crossLinks = graph.edges.filter(edge => {
      if (!ids.has(edge.source) || !ids.has(edge.target)) return false;
      return edge.secondary ? atlasOptions.secondary : atlasOptions.crossLinks;
    });
    return [...(atlasOptions.hierarchy ? hierarchy : []), ...crossLinks];
  };

  const renderGraph = () => {
    const view = visibleGraph();
    const layout = layoutGraph(view.nodes);
    const { width, height, positions } = layout;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.classList.add('site-graph-svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-labelledby', 'site-graph-title site-graph-help');

    const edges = graphEdges(view.nodes);
    const edgesGroup = document.createElementNS(svgNS, 'g');
    edgesGroup.classList.add('site-graph-edges');
    edges.forEach(edge => {
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      if (!source || !target) return;
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', source.x);
      line.setAttribute('y1', source.y);
      line.setAttribute('x2', target.x);
      line.setAttribute('y2', target.y);
      line.dataset.source = edge.source;
      line.dataset.target = edge.target;
      line.dataset.type = edge.type;
      line.classList.add(`is-${edge.type}`);
      if (edge.type !== 'hierarchy') line.classList.add('is-cross-link');
      if (edge.secondary) line.classList.add('is-secondary');
      const title = document.createElementNS(svgNS, 'title');
      title.textContent = edgeTypeLabel(edge.type) + ' connection between ' + (nodeMap.get(edge.source)?.label || edge.source) + ' and ' + (nodeMap.get(edge.target)?.label || edge.target);
      line.appendChild(title);
      line.addEventListener('mouseenter', () => {
        graphStatus.textContent = title.textContent;
      });
      edgesGroup.appendChild(line);
    });
    svg.appendChild(edgesGroup);

    if (layout.timeline) {
      const timeline = document.createElementNS(svgNS, 'line');
      timeline.classList.add('site-graph-timeline');
      timeline.setAttribute('x1', layout.timeline.x1);
      timeline.setAttribute('x2', layout.timeline.x2);
      timeline.setAttribute('y1', layout.timeline.y);
      timeline.setAttribute('y2', layout.timeline.y);
      svg.appendChild(timeline);
    }

    const nodesGroup = document.createElementNS(svgNS, 'g');
    nodesGroup.classList.add('site-graph-nodes');
    view.nodes.forEach(node => {
      const position = positions.get(node.id);
      if (!position) return;
      const group = document.createElementNS(svgNS, 'g');
      group.classList.add('site-graph-node');
      group.dataset.nodeId = node.id;
      group.setAttribute('transform', `translate(${position.x} ${position.y})`);
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      group.setAttribute('aria-label', `Explore ${node.label}`);
      if (node.id === state.node.id && state.mode !== 'overview') group.classList.add('is-selected');
      if (node.id === root.id) group.classList.add('is-root');
      if (node.type === 'section') group.classList.add('is-section');
      group.classList.add(`is-${node.type}`);

      const dot = document.createElementNS(svgNS, 'circle');
      dot.classList.add('site-graph-dot');
      dot.setAttribute('r', node.id === root.id ? '9' : node.type === 'section' ? '7' : '5.5');
      group.appendChild(dot);

      const label = document.createElementNS(svgNS, 'text');
      label.classList.add('site-graph-label');
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('y', node.id === root.id ? '-19' : '25');
      label.textContent = node.label;
      group.appendChild(label);

      if (state.mode === 'focus' && state.node.id === 'experience' && node.timelineOrder && node.meta) {
        const meta = document.createElementNS(svgNS, 'text');
        meta.classList.add('site-graph-meta');
        meta.setAttribute('text-anchor', 'middle');
        meta.setAttribute('y', '42');
        meta.textContent = node.meta;
        group.appendChild(meta);
      }

      const preview = () => {
        const ancestors = state.mode === 'atlas' ? ancestorIdsFor(node.id) : new Set();
        const pathIds = new Set([node.id, ...ancestors]);
        const neighboringIds = new Set([node.id]);
        edges.forEach(edge => {
          if (edge.source === node.id) neighboringIds.add(edge.target);
          if (edge.target === node.id) neighboringIds.add(edge.source);
        });

        svg.querySelectorAll('.site-graph-node').forEach(candidate => {
          const related = neighboringIds.has(candidate.dataset.nodeId) || pathIds.has(candidate.dataset.nodeId);
          candidate.classList.toggle('is-muted', !related);
        });
        svg.querySelectorAll('.site-graph-edges line').forEach(edge => {
          const direct = edge.dataset.source === node.id || edge.dataset.target === node.id;
          const onAncestorPath = edge.dataset.type === 'hierarchy' && pathIds.has(edge.dataset.source) && pathIds.has(edge.dataset.target);
          const related = direct || onAncestorPath;
          edge.classList.toggle('is-related', related);
          edge.classList.toggle('is-muted', !related);
        });
      };
      const clearPreview = () => {
        svg.querySelectorAll('.is-muted, .is-related').forEach(element => {
          element.classList.remove('is-muted', 'is-related');
        });
      };
      const activate = () => updateHash(routeForNode(node));

      group.addEventListener('mouseenter', preview);
      group.addEventListener('mouseleave', clearPreview);
      group.addEventListener('focus', preview);
      group.addEventListener('blur', clearPreview);
      group.addEventListener('click', activate);
      group.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate();
        }
      });
      nodesGroup.appendChild(group);
    });
    svg.appendChild(nodesGroup);
    graphRoot.replaceChildren(svg);
  };

  const updateNavigation = () => {
    document.querySelectorAll('#main-nav [data-route]').forEach(item => {
      const current = item.dataset.route === state.route || (state.mode === 'focus' && state.route.startsWith(`${item.dataset.route}/`));
      item.setAttribute('aria-current', current ? 'page' : 'false');
    });
  };

  const renderRoute = rawRoute => {
    const route = normaliseRoute(rawRoute);
    const atlas = route === 'atlas';
    const workProjectMatch = route.match(/^work\/project\/([^/]+)$/);
    const routedNode = atlas ? null : nodeForRoute(route);
    const target = atlas ? root : routedNode || root;
    const workRoute = route === 'work' || Boolean(workProjectMatch && routedNode?.type === 'project');
    const wasWorkRoute = state.route === 'work' || state.route.startsWith('work/project/');
    state = {
      route: atlas ? 'atlas' : routeForNode(target),
      mode: atlas ? 'atlas' : target.id === root.id ? 'overview' : 'focus',
      node: target
    };

    hero.hidden = workRoute || atlas;
    explorer.hidden = workRoute;
    workView.hidden = !workRoute;
    workRouteHeader.hidden = !workRoute;
    legacyViews.forEach(view => { view.hidden = true; });
    if (footer) footer.hidden = workRoute;
    document.body.dataset.graphMode = state.mode;
    document.body.dataset.graphRoute = state.route;

    if (workRoute) {
      renderBreadcrumb(workProjectMatch ? target : nodeMap.get('work'), workBreadcrumb);
      const projectId = workProjectMatch?.[1];
      if (projectId) {
        window.SITE_GRAPH_PENDING_WORK_PROJECT = projectId;
        window.dispatchEvent(new CustomEvent('site:open-work-project', { detail: { projectId } }));
      }
      graphStatus.textContent = projectId ? `${target.detailLabel || target.label} open in Work explorer.` : 'Work explorer open.';
      if (!wasWorkRoute) {
        if (!reducedMotion.matches) window.scrollTo({ top: 0, behavior: 'smooth' });
        else window.scrollTo(0, 0);
      }
      updateNavigation();
      return;
    }

    graphKicker.textContent = state.mode === 'atlas' ? 'Atlas' : state.mode === 'overview' ? 'Profile graph' : humanType(target.type);
    graphTitle.textContent = state.mode === 'overview' ? 'Explore the profile' : state.mode === 'atlas' ? 'Full profile graph' : target.label;
    graphHelp.textContent = state.mode === 'atlas'
      ? 'Atlas is an exploratory full view. Select any node to open its local graph.'
      : state.mode === 'overview'
        ? 'Select an area to explore its local structure.'
        : target.id === 'experience'
          ? 'A chronological view of roles. Select a role to inspect its connected work and knowledge.'
          : target.id === 'education'
            ? 'Select a programme to reveal its connected topics and evidence across the profile.'
          : 'Select a connected item to move deeper, or use the graph path to return.';
    renderBreadcrumb(target, breadcrumb, atlas);
    syncAtlasControls();
    renderGraph();
    renderDetail();
    updateNavigation();
    graphStatus.textContent = `${graphTitle.textContent} view open.`;
  };

  window.addEventListener('hashchange', () => renderRoute(normaliseRoute(location.hash)));
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || state.mode === 'overview') return;
    event.preventDefault();
    const parent = state.mode === 'focus' ? nodeMap.get(state.node.parentIds?.[0]) : root;
    updateHash(routeForNode(parent || root));
  });

  renderRoute(normaliseRoute(location.hash));
})();
