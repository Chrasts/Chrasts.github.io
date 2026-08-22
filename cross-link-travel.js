(() => {
  const site = window.SITE_DATA;
  const graph = site?.graph;
  const scene = window.ProfileScene;
  if (!graph?.nodes?.length) return;

  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const rootId = graph.rootId;
  const explorer = document.querySelector('#site-explorer');
  const routebar = explorer?.querySelector('.graph-routebar');
  const detail = document.querySelector('#site-detail-panel');
  const status = document.querySelector('#site-graph-status');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!explorer || !routebar) return;

  const sectionAtlasX = {
    work: 390,
    about: 660,
    knowledge: 1120,
    education: 1710,
    experience: 1990
  };

  const relationCopy = {
    related: { forward: 'Related', reverse: 'Related', family: 'related' },
    evidence: { forward: 'Evidence', reverse: 'Project evidence', family: 'evidence' },
    'studied-in': { forward: 'Studied in', reverse: 'Studied topic', family: 'study' },
    'planned-study': { forward: 'Planned study', reverse: 'Planned topic', family: 'study' },
    'credential-link': { forward: 'Related area', reverse: 'Credential', family: 'study' },
    'experience-link': { forward: 'Experience', reverse: 'Project', family: 'experience' },
    'education-link': { forward: 'Education', reverse: 'Project', family: 'study' }
  };

  const state = {
    travelling: false,
    sourceId: null,
    targetId: null,
    relationType: null,
    direction: null,
    result: null,
    reducedMotion: reducedMotion.matches
  };

  let overlay = null;
  let sequence = 0;

  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';
  const routeForNode = node => node?.route || 'overview';
  const stableNumber = value => {
    let number = 2166136261;
    for (const character of String(value)) {
      number = Math.imul(number ^ character.charCodeAt(0), 16777619);
    }
    return number >>> 0;
  };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const waitFor = (predicate, timeout = 3500) => new Promise(resolve => {
    const started = performance.now();
    const poll = () => {
      let value = false;
      try { value = Boolean(predicate()); } catch (_) {}
      if (value) return resolve(true);
      if (performance.now() - started >= timeout) return resolve(false);
      setTimeout(poll, 24);
    };
    poll();
  });
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const emit = (name, detailPayload = {}) => {
    window.dispatchEvent(new CustomEvent(`profile:crosslink-${name}`, {
      detail: { ...state, ...detailPayload }
    }));
  };
  const track = name => {
    try { window.umami?.track?.(name); } catch (_) {}
  };

  const currentSourceId = () => {
    if (document.body?.dataset.graphMode === 'atlas') return null;
    const route = normaliseRoute(document.body?.dataset.graphRoute || location.hash);
    const project = route.match(/^work\/project\/([^/]+)$/);
    if (project) return `project-${project[1]}`;
    if (route === 'overview') return rootId;
    if (route === 'work') return 'work';
    const theme = route.match(/^work\/theme\/([^/]+)$/);
    if (theme) return `work-theme-${theme[1]}`;
    return graph.nodes.find(node => node.route === route)?.id || null;
  };

  const topSection = id => {
    let node = nodeMap.get(id);
    const seen = new Set();
    while (node && !seen.has(node.id)) {
      seen.add(node.id);
      const parentId = node.parentIds?.[0];
      if (!parentId) return node.id;
      if (parentId === rootId) return node.id;
      node = nodeMap.get(parentId);
    }
    return null;
  };

  const travelDirection = (sourceId, targetId) => {
    const sourceSection = topSection(sourceId);
    const targetSection = topSection(targetId);
    const sourceX = sectionAtlasX[sourceSection];
    const targetX = sectionAtlasX[targetSection];
    if (Number.isFinite(sourceX) && Number.isFinite(targetX) && sourceX !== targetX) {
      return targetX > sourceX ? 'right' : 'left';
    }
    return stableNumber(`${sourceId}|${targetId}`) % 2 ? 'right' : 'left';
  };

  const relationsFor = sourceId => {
    if (!sourceId || !nodeMap.has(sourceId)) return [];
    return graph.edges
      .filter(edge => edge.source === sourceId || edge.target === sourceId)
      .map(edge => {
        const forward = edge.source === sourceId;
        const targetId = forward ? edge.target : edge.source;
        const target = nodeMap.get(targetId);
        if (!target?.route) return null;
        const copy = relationCopy[edge.type] || {
          forward: edge.type,
          reverse: edge.type,
          family: 'related'
        };
        return {
          sourceId,
          targetId,
          target,
          edge,
          type: edge.type,
          secondary: Boolean(edge.secondary),
          label: forward ? copy.forward : copy.reverse,
          family: copy.family,
          direction: travelDirection(sourceId, targetId)
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        const priority = { evidence: 0, study: 1, experience: 2, related: 3 };
        return (priority[left.family] ?? 9) - (priority[right.family] ?? 9) ||
          left.target.label.localeCompare(right.target.label);
      });
  };

  const rail = document.createElement('nav');
  rail.className = 'profile-crosslinks';
  rail.hidden = true;
  rail.setAttribute('aria-label', 'Cross-links from the current profile item');
  const railTitle = document.createElement('span');
  railTitle.className = 'profile-crosslinks-title';
  railTitle.textContent = 'Cross-links';
  const railList = document.createElement('div');
  railList.className = 'profile-crosslinks-list';
  rail.append(railTitle, railList);
  routebar.insertAdjacentElement('afterend', rail);

  const introOwnsScreen = () => {
    const value = document.documentElement.dataset.profileIntro;
    return ['pending', 'waiting', 'running', 'identity', 'expanding', 'handoff'].includes(value);
  };

  const renderRail = () => {
    if (state.travelling) return;
    const sourceId = currentSourceId();
    const relations = relationsFor(sourceId);
    railList.replaceChildren();
    const hide = !sourceId || !relations.length || document.body?.dataset.graphMode === 'atlas' || introOwnsScreen();
    rail.hidden = hide;
    if (hide) return;

    relations.forEach(relation => {
      const anchor = document.createElement('a');
      anchor.className = `profile-crosslink is-${relation.family}`;
      anchor.href = `#${routeForNode(relation.target)}`;
      anchor.dataset.sourceId = relation.sourceId;
      anchor.dataset.targetId = relation.targetId;
      anchor.dataset.relationType = relation.type;
      anchor.dataset.direction = relation.direction;
      if (relation.secondary) anchor.dataset.secondary = 'true';
      anchor.setAttribute(
        'aria-label',
        `${relation.label}: ${relation.target.detailLabel || relation.target.label}`
      );

      const relationText = document.createElement('span');
      relationText.className = 'profile-crosslink-relation';
      relationText.textContent = relation.label;
      const targetText = document.createElement('span');
      targetText.className = 'profile-crosslink-target';
      targetText.textContent = relation.target.detailLabel || relation.target.label;
      anchor.append(relationText, targetText);
      railList.appendChild(anchor);
    });
  };

  const elementForNode = id => {
    if (!id) return null;
    if (id.startsWith('project-')) {
      const projectId = id.slice('project-'.length);
      return document.querySelector(`.work-project-anchor-v5[data-project-id="${projectId}"]`) ||
        document.querySelector(`#site-graph .site-graph-node[data-node-id="${id}"]`);
    }
    return document.querySelector(`#site-graph .site-graph-node[data-node-id="${id}"]`);
  };

  const centerOf = (element, fallback = null) => {
    const rect = element?.getBoundingClientRect?.();
    if (rect && rect.width >= 0 && rect.height >= 0) {
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        rect
      };
    }
    return fallback;
  };

  const fallbackGraphCenter = () => {
    const rect = document.querySelector('.site-graph-viewport')?.getBoundingClientRect();
    return rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, rect }
      : { x: window.innerWidth / 2, y: window.innerHeight / 2, rect: null };
  };

  const sanitizeSnapshot = clone => {
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
    clone.querySelectorAll('[tabindex]').forEach(element => element.removeAttribute('tabindex'));
    clone.querySelectorAll('[role]').forEach(element => element.removeAttribute('role'));
    clone.querySelectorAll('[aria-label]').forEach(element => element.removeAttribute('aria-label'));
    clone.querySelectorAll('.v9-transition-overlay').forEach(element => element.remove());
  };

  const makeSnapshot = shell => {
    const svg = document.querySelector('#site-graph .site-graph-svg');
    const rect = svg?.getBoundingClientRect();
    if (!svg || !rect?.width || !rect?.height) return null;
    const clone = svg.cloneNode(true);
    sanitizeSnapshot(clone);
    clone.classList.add('profile-crosslink-snapshot-svg');
    const holder = document.createElement('div');
    holder.className = 'profile-crosslink-snapshot';
    holder.style.left = `${rect.left}px`;
    holder.style.top = `${rect.top}px`;
    holder.style.width = `${rect.width}px`;
    holder.style.height = `${rect.height}px`;
    holder.appendChild(clone);
    shell.appendChild(holder);
    return holder;
  };

  const tracePath = (svg, from, to, className) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('profile-crosslink-trace', className);
    const sign = to.x >= from.x ? 1 : -1;
    const span = Math.max(90, Math.abs(to.x - from.x));
    const c1 = { x: from.x + sign * Math.min(220, span * .42), y: from.y };
    const c2 = { x: to.x - sign * Math.min(190, span * .36), y: to.y };
    path.setAttribute(
      'd',
      `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`
    );
    svg.appendChild(path);
    return path;
  };

  const animateTrace = (path, traveller, duration, id) => new Promise(resolve => {
    if (!path) return resolve(false);
    const length = Math.max(1, path.getTotalLength());
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;
    const finalPoint = path.getPointAtLength(length);
    if (reducedMotion.matches || duration <= 0) {
      path.style.strokeDashoffset = '0';
      if (traveller) {
        traveller.setAttribute('cx', finalPoint.x);
        traveller.setAttribute('cy', finalPoint.y);
      }
      return resolve(true);
    }
    const started = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);
    const frame = now => {
      if (id !== sequence || !state.travelling) return resolve(false);
      const raw = clamp((now - started) / duration, 0, 1);
      const progress = ease(raw);
      path.style.strokeDashoffset = `${length * (1 - progress)}`;
      if (traveller) {
        const point = path.getPointAtLength(length * progress);
        traveller.setAttribute('cx', point.x);
        traveller.setAttribute('cy', point.y);
      }
      if (raw < 1) requestAnimationFrame(frame);
      else resolve(true);
    };
    requestAnimationFrame(frame);
  });

  const createTravelOverlay = relation => {
    const shell = document.createElement('div');
    shell.className = 'profile-crosslink-travel-overlay';
    shell.dataset.phase = 'trace';
    shell.dataset.direction = relation.direction;
    shell.dataset.relationType = relation.type;
    shell.setAttribute('aria-hidden', 'true');
    makeSnapshot(shell);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('profile-crosslink-trace-layer');
    svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    const traveller = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    traveller.classList.add('profile-crosslink-traveller');
    traveller.setAttribute('r', '4.2');
    svg.appendChild(traveller);

    const source = centerOf(elementForNode(relation.sourceId), fallbackGraphCenter());
    const edge = Math.min(150, Math.max(76, window.innerWidth * .1));
    const portal = {
      x: relation.direction === 'right' ? window.innerWidth - edge : edge,
      y: clamp(source.y + (window.innerHeight / 2 - source.y) * .28, 118, window.innerHeight - 118)
    };
    const departure = tracePath(svg, source, portal, 'is-departure');

    const sourceRing = document.createElement('span');
    sourceRing.className = 'profile-crosslink-marker is-source';
    sourceRing.style.left = `${source.x}px`;
    sourceRing.style.top = `${source.y}px`;

    const token = document.createElement('span');
    token.className = 'profile-crosslink-token';
    token.style.left = `${portal.x}px`;
    token.style.top = `${portal.y}px`;
    token.innerHTML = `<small>${relation.label}</small><strong>${relation.target.detailLabel || relation.target.label}</strong>`;

    shell.append(svg, sourceRing, token);
    document.body.appendChild(shell);
    requestAnimationFrame(() => shell.classList.add('is-ready'));
    return { shell, svg, traveller, departure, portal };
  };

  const finishTravel = (relation, transitionToken, result = 'completed') => {
    overlay?.shell?.remove();
    overlay = null;
    document.body.classList.remove('is-crosslink-travelling');
    delete document.body.dataset.crossLinkTravel;
    state.travelling = false;
    state.result = result;
    scene?.transitions?.finish?.(transitionToken, {
      kind: 'cross-link',
      sourceId: relation.sourceId,
      targetId: relation.targetId,
      relationType: relation.type,
      result
    });
    renderRail();
    emit('complete', { result });
    if (result === 'completed') track('cross_link_travel');
  };

  const navigate = async relationInput => {
    if (state.travelling || document.body.classList.contains('is-v9-transitioning')) return false;
    const sourceId = relationInput?.sourceId || currentSourceId();
    const targetId = relationInput?.targetId;
    const relation = relationsFor(sourceId).find(item =>
      item.targetId === targetId && (!relationInput?.type || item.type === relationInput.type)
    );
    if (!relation) return false;

    const transitionToken = scene?.transitions?.begin?.({
      kind: 'cross-link',
      sourceId: relation.sourceId,
      targetId: relation.targetId,
      relationType: relation.type,
      direction: relation.direction
    }) || null;
    if (scene?.transitions?.isLocked && !transitionToken) return false;

    state.travelling = true;
    state.sourceId = relation.sourceId;
    state.targetId = relation.targetId;
    state.relationType = relation.type;
    state.direction = relation.direction;
    state.result = null;
    state.reducedMotion = reducedMotion.matches;
    const id = ++sequence;
    document.body.classList.add('is-crosslink-travelling');
    document.body.dataset.crossLinkTravel = 'trace';
    rail.hidden = true;
    overlay = createTravelOverlay(relation);
    scene?.transitions?.prepare?.(transitionToken, { phaseDetail: 'trace-relation' });
    emit('start', { relation });

    if (status) status.textContent = `${relation.label}: travelling to ${relation.target.detailLabel || relation.target.label}.`;
    await animateTrace(overlay.departure, overlay.traveller, reducedMotion.matches ? 0 : 330, id);
    if (id !== sequence || !state.travelling) return false;

    overlay.shell.dataset.phase = 'travel';
    document.body.dataset.crossLinkTravel = 'travel';
    const destinationRoute = routeForNode(relation.target);
    location.hash = `#${normaliseRoute(destinationRoute)}`;
    const routeReady = await waitFor(() =>
      normaliseRoute(document.body?.dataset.graphRoute) === normaliseRoute(destinationRoute),
    3200);
    if (!routeReady) {
      scene?.transitions?.cancel?.(transitionToken, { reason: 'route-timeout' });
      finishTravel(relation, null, 'fallback');
      return false;
    }

    scene?.transitions?.commit?.(transitionToken, { phaseDetail: 'destination-rendered' });
    await wait(reducedMotion.matches ? 30 : 500);
    if (id !== sequence || !state.travelling) return false;

    const targetElement = elementForNode(relation.targetId);
    const target = centerOf(targetElement, fallbackGraphCenter());
    const arrival = tracePath(overlay.svg, overlay.portal, target, 'is-arrival');
    const targetRing = document.createElement('span');
    targetRing.className = 'profile-crosslink-marker is-target';
    targetRing.style.left = `${target.x}px`;
    targetRing.style.top = `${target.y}px`;
    overlay.shell.appendChild(targetRing);
    overlay.shell.dataset.phase = 'arrive';
    document.body.dataset.crossLinkTravel = 'arrive';
    await animateTrace(arrival, overlay.traveller, reducedMotion.matches ? 0 : 300, id);
    await wait(reducedMotion.matches ? 70 : 190);
    if (id !== sequence || !state.travelling) return false;

    targetElement?.focus?.({ preventScroll: true });
    if (status) status.textContent = `${relation.target.detailLabel || relation.target.label} local context open via ${relation.label.toLowerCase()} cross-link.`;
    finishTravel(relation, transitionToken, 'completed');
    return true;
  };

  const relationFromElement = element => {
    const sourceId = element?.dataset?.sourceId;
    const targetId = element?.dataset?.targetId;
    const type = element?.dataset?.relationType;
    if (!sourceId || !targetId) return null;
    return { sourceId, targetId, type };
  };

  rail.addEventListener('click', event => {
    const anchor = event.target.closest?.('.profile-crosslink[data-target-id]');
    if (!anchor) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(relationFromElement(anchor));
  });

  detail?.addEventListener('click', event => {
    if (document.body.dataset.graphMode === 'atlas' || state.travelling) return;
    const button = event.target.closest?.('.detail-node-list.is-secondary button');
    if (!button) return;
    const list = button.closest('.detail-node-list');
    const heading = list?.previousElementSibling;
    if (!heading?.classList.contains('detail-list-title') || heading.textContent.trim() !== 'Connected in the profile') return;
    const sourceId = currentSourceId();
    const targetLabel = button.textContent.trim();
    const relation = relationsFor(sourceId).find(item =>
      (item.target.detailLabel || item.target.label) === targetLabel || item.target.label === targetLabel
    );
    if (!relation) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    navigate(relation);
  }, true);

  const scheduleRender = () => requestAnimationFrame(() => requestAnimationFrame(renderRail));
  window.addEventListener('hashchange', scheduleRender);
  window.addEventListener('profile:scene-state', scheduleRender);
  const observer = new MutationObserver(mutations => {
    if (mutations.some(mutation => mutation.type === 'attributes')) scheduleRender();
  });
  if (document.body) {
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-graph-mode', 'data-graph-route']
    });
  }
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-profile-intro']
  });

  window.ProfileCrossLinkTravel = Object.freeze({
    navigate: (targetId, type = null) => navigate({ sourceId: currentSourceId(), targetId, type }),
    relationsFor: sourceId => relationsFor(sourceId).map(item => ({
      sourceId: item.sourceId,
      targetId: item.targetId,
      type: item.type,
      label: item.label,
      family: item.family,
      direction: item.direction,
      secondary: item.secondary
    })),
    snapshot: () => ({
      ...state,
      currentSourceId: currentSourceId(),
      railVisible: !rail.hidden,
      relationCount: railList.children.length,
      overlayPresent: Boolean(overlay?.shell)
    })
  });

  scheduleRender();
})();