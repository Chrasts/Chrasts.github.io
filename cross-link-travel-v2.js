(() => {
  const site = window.SITE_DATA;
  const graph = site?.graph;
  const scene = window.ProfileScene;
  const geometry = window.ProfileGeometry;
  if (!graph?.nodes?.length) return;

  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const rootId = graph.rootId;
  const explorer = document.querySelector('#site-explorer');
  const routebar = explorer?.querySelector('.graph-routebar');
  const detail = document.querySelector('#site-detail-panel');
  const status = document.querySelector('#site-graph-status');
  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedMotion = {
    get matches() {
      return Boolean(window.__PROFILE_INTRO_BOOTSTRAP__?.reducedMotion) || reducedQuery.matches;
    }
  };
  if (!explorer || !routebar) return;

  const relationCopy = {
    related: { forward: 'Related', reverse: 'Related', family: 'related' },
    evidence: { forward: 'Evidence', reverse: 'Project evidence', family: 'evidence' },
    'studied-in': { forward: 'Studied in', reverse: 'Studied topic', family: 'study' },
    'planned-study': { forward: 'Planned study', reverse: 'Planned topic', family: 'study' },
    'credential-link': { forward: 'Related area', reverse: 'Credential', family: 'study' },
    'role-project': { forward: 'Related Work', reverse: 'Produced during role', family: 'experience' },
    'professional-evidence': { forward: 'Professional evidence', reverse: 'Role evidence', family: 'experience' },
    'developed-through': { forward: 'Developed through role', reverse: 'Professional context', family: 'experience' },
    'thesis-of': { forward: 'Thesis', reverse: 'Degree programme', family: 'study' },
    'experience-link': { forward: 'Experience', reverse: 'Project', family: 'experience' },
    'education-link': { forward: 'Education', reverse: 'Project', family: 'study' }
  };

  const state = {
    travelling: false,
    sourceId: null,
    targetId: null,
    relationType: null,
    direction: null,
    vector: null,
    result: null,
    reducedMotion: reducedMotion.matches,
    history: []
  };

  let overlay = null;
  let sequence = 0;
  let activeTransitionToken = null;
  const routeHistory = [];
  let lastRoute = null;
  let expectedReturnRoute = null;

  const normaliseRoute = value => {
    const route = (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';
    return graph.routeAliases?.[route] || route;
  };
  const routeForNode = node => node?.route || 'overview';
  const currentRoute = () => normaliseRoute(location.hash || document.body?.dataset.graphRoute || 'overview');
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
  const normaliseVector = vector => {
    const length = Math.max(1e-6, Math.hypot(vector?.x || 0, vector?.y || 0));
    return { x: (vector?.x || 0) / length, y: (vector?.y || 0) / length };
  };
  const emit = (name, payload = {}) => window.dispatchEvent(new CustomEvent(`profile:crosslink-${name}`, {
    detail: { ...state, ...payload }
  }));
  const track = name => { try { window.umami?.track?.(name); } catch (_) {} };

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

  const fallbackVector = (sourceId, targetId) => {
    let hash = 2166136261;
    for (const character of `${sourceId}|${targetId}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    const angle = (hash >>> 0) / 0xffffffff * Math.PI * 2;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  };

  const relationVector = (sourceId, targetId) =>
    normaliseVector(geometry?.vectorBetween?.(sourceId, targetId) || fallbackVector(sourceId, targetId));
  const directionName = (sourceId, targetId, vector) =>
    geometry?.directionBetween?.(sourceId, targetId) || (() => {
      const angle = Math.atan2(vector.y, vector.x) * 180 / Math.PI;
      if (angle >= -22.5 && angle < 22.5) return 'right';
      if (angle >= 22.5 && angle < 67.5) return 'down-right';
      if (angle >= 67.5 && angle < 112.5) return 'down';
      if (angle >= 112.5 && angle < 157.5) return 'down-left';
      if (angle >= 157.5 || angle < -157.5) return 'left';
      if (angle >= -157.5 && angle < -112.5) return 'up-left';
      if (angle >= -112.5 && angle < -67.5) return 'up';
      return 'up-right';
    })();

  const relationsFor = sourceId => {
    if (!sourceId || !nodeMap.has(sourceId)) return [];
    return graph.edges
      .filter(edge => edge.source === sourceId || edge.target === sourceId)
      .map(edge => {
        const forward = edge.source === sourceId;
        const targetId = forward ? edge.target : edge.source;
        const target = nodeMap.get(targetId);
        if (!target?.route) return null;
        const copy = relationCopy[edge.type] || { forward: edge.type, reverse: edge.type, family: 'related' };
        const vector = relationVector(sourceId, targetId);
        return {
          sourceId,
          targetId,
          target,
          edge,
          type: edge.type,
          secondary: Boolean(edge.secondary),
          label: forward ? copy.forward : copy.reverse,
          family: copy.family,
          vector,
          direction: directionName(sourceId, targetId, vector)
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

  // Cross-links can be numerous, but returning across one is a single,
  // high-value action. Keep that action in the shared routebar so it remains
  // visible in Work, local semantic fragments and mobile navigation alike.
  const returnControl = document.createElement('button');
  returnControl.type = 'button';
  returnControl.className = 'crosslink-return-control';
  returnControl.hidden = true;
  returnControl.dataset.crosslinkReturn = 'true';
  const returnPrefix = document.createElement('span');
  returnPrefix.className = 'crosslink-return-prefix';
  returnPrefix.textContent = '← Back';
  const returnTarget = document.createElement('span');
  returnTarget.className = 'crosslink-return-target';
  returnControl.append(returnPrefix, returnTarget);
  const header = document.querySelector('.site-header');
  (header || routebar).appendChild(returnControl);

  const introOwnsScreen = () => ['pending', 'waiting', 'running', 'identity', 'expanding', 'handoff']
    .includes(document.documentElement.dataset.profileIntro);
  const openingAtlasOwnsScreen = () => document.body?.dataset.graphMode === 'atlas' &&
    ['preparing', 'ignition', 'reveal', 'ready'].includes(document.body?.dataset.entryState || '');

  const nodeForRoute = route => graph.nodes.find(node => normaliseRoute(node.route) === normaliseRoute(route)) || null;
  const labelForRoute = route => {
    const node = nodeForRoute(route);
    if (node) return node.detailLabel || node.label;
    return ({ atlas: 'Atlas', overview: 'Profile overview', work: 'Work' })[normaliseRoute(route)] || 'previous view';
  };

  const returnEntryForCurrentRoute = () => {
    const entry = state.history.at(-1);
    const sourceId = currentSourceId();
    return entry && entry.targetId === sourceId && nodeMap.has(entry.sourceId) ? entry : null;
  };

  const routeReturnForCurrentRoute = () => routeHistory.at(-1) || null;
  const returnDestination = () => {
    const crossLink = returnEntryForCurrentRoute();
    if (crossLink) return { kind: 'cross-link', route: crossLink.sourceRoute, label: labelForRoute(crossLink.sourceRoute) };
    const route = routeReturnForCurrentRoute();
    return route ? { kind: 'route', route, label: labelForRoute(route) } : null;
  };

  const updateReturnControl = destination => {
    const available = Boolean(destination) && !state.travelling && !introOwnsScreen() && !openingAtlasOwnsScreen();
    returnControl.hidden = !available;
    if (!available) return;
    const label = destination.label;
    returnTarget.textContent = label;
    returnControl.setAttribute('aria-label', `Return to ${label}. Keyboard shortcut Control or Command Z.`);
    returnControl.title = `Return to ${label} (Ctrl/Cmd+Z)`;
  };

  const renderRail = () => {
    if (state.travelling) return;
    const sourceId = currentSourceId();
    const relations = relationsFor(sourceId);
    updateReturnControl(returnDestination());
    railList.replaceChildren();
    // Return is deliberately singular: the persistent control beneath the
    // brand owns it.  Keeping a second copy inside the graph rail made the
    // navigation appear in the middle of otherwise local reading scenes.
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
      anchor.dataset.vectorX = relation.vector.x.toFixed(4);
      anchor.dataset.vectorY = relation.vector.y.toFixed(4);
      if (relation.secondary) anchor.dataset.secondary = 'true';
      anchor.setAttribute('aria-label', `${relation.label}: ${relation.target.detailLabel || relation.target.label}`);

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

  const recordRouteVisit = () => {
    const route = currentRoute();
    if (!lastRoute) {
      lastRoute = route;
      return;
    }
    if (route === lastRoute) return;
    if (expectedReturnRoute) {
      if (route === expectedReturnRoute && routeHistory.at(-1) === route) routeHistory.pop();
      expectedReturnRoute = null;
    } else {
      routeHistory.push(lastRoute);
      if (routeHistory.length > 16) routeHistory.splice(0, routeHistory.length - 16);
    }
    lastRoute = route;
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
    if (!rect) return fallback;
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, rect };
  };

  const fallbackGraphCenter = () => {
    const rect = document.querySelector('.site-graph-viewport')?.getBoundingClientRect();
    return rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, rect }
      : { x: window.innerWidth / 2, y: window.innerHeight / 2, rect: null };
  };

  const sanitizeSnapshot = clone => {
    clone.removeAttribute('id');
    clone.querySelectorAll('[id],[tabindex],[role],[aria-label]').forEach(element => {
      element.removeAttribute('id');
      element.removeAttribute('tabindex');
      element.removeAttribute('role');
      element.removeAttribute('aria-label');
    });
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

  const portalFor = (source, vector) => {
    const marginX = Math.min(132, Math.max(70, window.innerWidth * 0.075));
    const marginY = Math.min(120, Math.max(74, window.innerHeight * 0.085));
    const values = [];
    if (vector.x > 1e-5) values.push((window.innerWidth - marginX - source.x) / vector.x);
    if (vector.x < -1e-5) values.push((marginX - source.x) / vector.x);
    if (vector.y > 1e-5) values.push((window.innerHeight - marginY - source.y) / vector.y);
    if (vector.y < -1e-5) values.push((marginY - source.y) / vector.y);
    const distance = Math.min(...values.filter(value => Number.isFinite(value) && value > 0));
    if (!Number.isFinite(distance)) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    return {
      x: clamp(source.x + vector.x * distance, marginX, window.innerWidth - marginX),
      y: clamp(source.y + vector.y * distance, marginY, window.innerHeight - marginY)
    };
  };

  const tracePath = (svg, from, to, vectorInput, className) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('profile-crosslink-trace', className);
    const direct = normaliseVector({ x: to.x - from.x, y: to.y - from.y });
    const vector = vectorInput ? normaliseVector(vectorInput) : direct;
    const perpendicular = { x: -vector.y, y: vector.x };
    const distance = Math.max(1, Math.hypot(to.x - from.x, to.y - from.y));
    const cross = direct.x * vector.y - direct.y * vector.x;
    const bend = clamp(cross * 70, -48, 48);
    const c1 = {
      x: from.x + vector.x * distance * 0.36 + perpendicular.x * bend,
      y: from.y + vector.y * distance * 0.36 + perpendicular.y * bend
    };
    const c2 = {
      x: to.x - direct.x * distance * 0.25 + perpendicular.x * bend * 0.55,
      y: to.y - direct.y * distance * 0.25 + perpendicular.y * bend * 0.55
    };
    path.setAttribute('d', `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`);
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
    shell.className = 'profile-crosslink-travel-overlay is-vector-travel';
    shell.dataset.phase = 'trace';
    shell.dataset.direction = relation.direction;
    shell.dataset.relationType = relation.type;
    shell.style.setProperty('--crosslink-snapshot-x', `${(-relation.vector.x * 8).toFixed(2)}vw`);
    shell.style.setProperty('--crosslink-snapshot-y', `${(-relation.vector.y * 8).toFixed(2)}vh`);
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
    const portal = portalFor(source, relation.vector);
    const departure = tracePath(svg, source, portal, relation.vector, 'is-departure');

    const sourceRing = document.createElement('span');
    sourceRing.className = 'profile-crosslink-marker is-source';
    sourceRing.style.left = `${source.x}px`;
    sourceRing.style.top = `${source.y}px`;

    const token = document.createElement('span');
    token.className = 'profile-crosslink-token';
    const tokenInset = 58;
    token.style.left = `${clamp(portal.x - relation.vector.x * tokenInset, 92, window.innerWidth - 92)}px`;
    token.style.top = `${clamp(portal.y - relation.vector.y * tokenInset, 72, window.innerHeight - 72)}px`;
    const small = document.createElement('small');
    small.textContent = relation.label;
    const strong = document.createElement('strong');
    strong.textContent = relation.target.detailLabel || relation.target.label;
    token.append(small, strong);

    shell.append(svg, sourceRing, token);
    document.body.appendChild(shell);
    requestAnimationFrame(() => shell.classList.add('is-ready'));
    return { shell, svg, traveller, departure, portal };
  };

  const interruptTravel = (reason = 'interrupted') => {
    if (!state.travelling && !overlay) return false;
    sequence += 1;
    overlay?.shell?.remove();
    overlay = null;
    document.body.classList.remove('is-crosslink-travelling');
    delete document.body.dataset.crossLinkTravel;
    state.travelling = false;
    state.result = 'interrupted';
    const token = activeTransitionToken;
    activeTransitionToken = null;
    renderRail();
    emit('interrupt', { reason, transitionToken: token });
    return true;
  };

  scene?.transitions?.registerParticipant?.('cross-link-travel', {
    capture: () => ({
      travelling: state.travelling,
      sourceId: state.sourceId,
      targetId: state.targetId,
      relationType: state.relationType,
      phase: document.body.dataset.crossLinkTravel || null,
      sequence
    }),
    cancel: payload => interruptTravel(payload?.reason || 'coordinator-interrupt')
  });

  const finishTravel = (relation, transitionToken, result = 'completed') => {
    overlay?.shell?.remove();
    overlay = null;
    document.body.classList.remove('is-crosslink-travelling');
    delete document.body.dataset.crossLinkTravel;
    state.travelling = false;
    state.result = result;
    if (activeTransitionToken === transitionToken) activeTransitionToken = null;
    scene?.transitions?.finish?.(transitionToken, {
      kind: 'cross-link', sourceId: relation.sourceId, targetId: relation.targetId,
      relationType: relation.type, direction: relation.direction, vector: relation.vector, result
    });
    renderRail();
    emit('complete', { result });
    if (result === 'completed') track('cross_link_travel');
  };

  const navigate = async relationInput => {
    if (state.travelling) interruptTravel('retarget');
    if (document.body.classList.contains('is-v9-transitioning')) {
      window.ProfileTransitionCoordination?.interrupt?.({ reason: 'cross-link-retarget', input: 'cross-link' });
    }
    const sourceId = relationInput?.sourceId || currentSourceId();
    const targetId = relationInput?.targetId;
    const relation = relationsFor(sourceId).find(item =>
      item.targetId === targetId && (!relationInput?.type || item.type === relationInput.type));
    if (!relation) return false;
    const returnEntry = relationInput?.returnEntry || null;

    const transitionToken = scene?.transitions?.begin?.({
      kind: 'cross-link', sourceId: relation.sourceId, targetId: relation.targetId,
      relationType: relation.type, direction: relation.direction, vector: relation.vector
    }) || null;
    if (scene?.transitions?.isLocked && !transitionToken) return false;
    activeTransitionToken = transitionToken;

    state.travelling = true;
    state.sourceId = relation.sourceId;
    state.targetId = relation.targetId;
    state.relationType = relation.type;
    state.direction = relation.direction;
    state.vector = { ...relation.vector };
    state.result = null;
    state.reducedMotion = reducedMotion.matches;
    const id = ++sequence;
    document.body.classList.add('is-crosslink-travelling');
    document.body.dataset.crossLinkTravel = 'trace';
    rail.hidden = true;
    returnControl.hidden = true;
    overlay = createTravelOverlay(relation);
    scene?.transitions?.prepare?.(transitionToken, { phaseDetail: 'trace-relation' });
    emit('start', { relation });

    if (status) status.textContent = `${relation.label}: travelling to ${relation.target.detailLabel || relation.target.label}.`;
    await animateTrace(overlay.departure, overlay.traveller, reducedMotion.matches ? 0 : 420, id);
    if (id !== sequence || !state.travelling) return false;

    const portalRing = document.createElement('span');
    portalRing.className = 'profile-crosslink-marker is-portal';
    portalRing.style.left = `${overlay.portal.x}px`;
    portalRing.style.top = `${overlay.portal.y}px`;
    overlay.shell.appendChild(portalRing);

    overlay.shell.dataset.phase = 'travel';
    document.body.dataset.crossLinkTravel = 'travel';
    await wait(reducedMotion.matches ? 0 : 90);
    if (id !== sequence || !state.travelling) return false;
    const destinationRoute = routeForNode(relation.target);
    location.hash = `#${normaliseRoute(destinationRoute)}`;
    const routeReady = await waitFor(() => normaliseRoute(document.body?.dataset.graphRoute) === normaliseRoute(destinationRoute), 3200);
    if (!routeReady) {
      scene?.transitions?.cancel?.(transitionToken, { reason: 'route-timeout' });
      finishTravel(relation, null, 'fallback');
      return false;
    }

    if (!scene?.transitions?.matches?.(transitionToken) && activeTransitionToken !== transitionToken) return false;
    scene?.transitions?.commit?.(transitionToken, { phaseDetail: 'destination-rendered' });
    await wait(reducedMotion.matches ? 30 : 500);
    if (id !== sequence || !state.travelling) return false;

    const targetElement = elementForNode(relation.targetId);
    const target = centerOf(targetElement, fallbackGraphCenter());
    const arrivalVector = normaliseVector({ x: target.x - overlay.portal.x, y: target.y - overlay.portal.y });
    const arrival = tracePath(overlay.svg, overlay.portal, target, arrivalVector, 'is-arrival');
    const targetRing = document.createElement('span');
    targetRing.className = 'profile-crosslink-marker is-target';
    targetRing.style.left = `${target.x}px`;
    targetRing.style.top = `${target.y}px`;
    overlay.shell.appendChild(targetRing);
    overlay.shell.dataset.phase = 'arrive';
    document.body.dataset.crossLinkTravel = 'arrive';
    await animateTrace(arrival, overlay.traveller, reducedMotion.matches ? 0 : 390, id);
    await wait(reducedMotion.matches ? 70 : 220);
    if (id !== sequence || !state.travelling) return false;

    targetElement?.focus?.({ preventScroll: true });
    if (returnEntry) {
      const current = state.history.at(-1);
      if (current === returnEntry) state.history.pop();
      emit('return', { originId: relation.targetId, depth: state.history.length });
    } else {
      state.history.push({
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        relationType: relation.type,
        sourceRoute: routeForNode(nodeMap.get(relation.sourceId)),
        targetRoute: routeForNode(relation.target)
      });
      // Spatial history is intentionally short and semantic, never a general
      // browser-history replacement.
      if (state.history.length > 8) state.history.splice(0, state.history.length - 8);
    }
    if (status) status.textContent = `${relation.target.detailLabel || relation.target.label} local context open via ${relation.label.toLowerCase()} cross-link.`;
    finishTravel(relation, transitionToken, 'completed');
    return true;
  };

  const relationFromElement = element => {
    const sourceId = element?.dataset?.sourceId;
    const targetId = element?.dataset?.targetId;
    const type = element?.dataset?.relationType;
    return sourceId && targetId ? { sourceId, targetId, type } : null;
  };

  const returnToOrigin = () => {
    if (state.travelling) return false;
    const entry = returnEntryForCurrentRoute();
    const sourceId = currentSourceId();
    const relation = entry && relationsFor(sourceId).find(item => item.targetId === entry.sourceId);
    if (!relation) return false;
    expectedReturnRoute = routeForNode(relation.target);
    const started = navigate({ sourceId, targetId: relation.targetId, type: relation.type, returnEntry: entry });
    Promise.resolve(started).then(result => {
      if (!result && expectedReturnRoute === routeForNode(relation.target)) expectedReturnRoute = null;
    });
    return started;
  };

  const returnToPrevious = () => {
    if (state.travelling) return false;
    if (returnEntryForCurrentRoute()) return returnToOrigin();
    const route = routeReturnForCurrentRoute();
    if (!route) return false;
    expectedReturnRoute = route;
    if (location.hash !== `#${route}`) location.hash = `#${route}`;
    else {
      expectedReturnRoute = null;
      return false;
    }
    return true;
  };

  rail.addEventListener('click', event => {
    const returnButton = event.target.closest?.('[data-crosslink-return="true"]');
    if (returnButton) {
      event.preventDefault();
      returnToOrigin();
      return;
    }
    const anchor = event.target.closest?.('.profile-crosslink[data-target-id]');
    if (!anchor || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(relationFromElement(anchor));
  });

  const relationFromCrossLinkControl = control => {
    const sourceId = control?.dataset?.crosslinkSource || currentSourceId();
    const targetId = control?.dataset?.crosslinkTarget;
    const type = control?.dataset?.crosslinkType || null;
    if (!sourceId || !targetId) return null;
    return relationsFor(sourceId).find(item =>
      item.targetId === targetId &&
      !['hierarchy', 'hierarchy-alt', 'work-lattice'].includes(item.type) &&
      (!type || item.type === type)
    ) || null;
  };

  document.addEventListener('click', event => {
    if (document.body.dataset.graphMode === 'atlas' || state.travelling) return;
    const control = event.target.closest?.('[data-crosslink-target]');
    if (!control) return;
    const relation = relationFromCrossLinkControl(control);
    if (!relation) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    navigate(relation);
  }, true);

  // Compatibility fallback for older detail buttons which may survive in a
  // cached DOM during a same-session renderer handoff.
  detail?.addEventListener('click', event => {
    if (document.body.dataset.graphMode === 'atlas' || state.travelling) return;
    const button = event.target.closest?.('.detail-node-list.is-secondary button[data-node-id]');
    if (!button || button.dataset.crosslinkTarget) return;
    const sourceId = currentSourceId();
    const targetId = button.dataset.nodeId;
    const relation = relationsFor(sourceId).find(item =>
      item.targetId === targetId && !['hierarchy', 'hierarchy-alt', 'work-lattice'].includes(item.type));
    if (!relation) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    navigate(relation);
  }, true);

  returnControl.addEventListener('click', event => {
    event.preventDefault();
    returnToPrevious();
  });

  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.shiftKey || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
    const target = event.target;
    if (target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (returnToPrevious()) event.preventDefault();
  }, true);

  const scheduleRender = () => requestAnimationFrame(() => requestAnimationFrame(renderRail));
  lastRoute = currentRoute();
  window.addEventListener('hashchange', () => {
    recordRouteVisit();
    scheduleRender();
  });
  window.addEventListener('profile:scene-state', scheduleRender);
  window.addEventListener('profile:geometry-applied', scheduleRender);
  window.addEventListener('profile:intro-stage', scheduleRender);
  window.addEventListener('profile:intro-completed', scheduleRender);
  window.addEventListener('profile:graph-render-settled', scheduleRender);

  window.ProfileCrossLinkTravel = Object.freeze({
    navigate: (targetId, type = null) => navigate({ sourceId: currentSourceId(), targetId, type }),
    interrupt: reason => interruptTravel(reason || 'api-interrupt'),
    relationsFor: sourceId => relationsFor(sourceId).map(item => ({
      sourceId: item.sourceId, targetId: item.targetId, type: item.type, label: item.label,
      family: item.family, direction: item.direction, vector: { ...item.vector }, secondary: item.secondary
    })),
    snapshot: () => ({
      ...state,
      history: state.history.map(entry => ({ ...entry })),
      canReturn: Boolean(returnEntryForCurrentRoute()),
      canNavigateBack: Boolean(returnDestination()),
      routeHistory: [...routeHistory],
      vector: state.vector ? { ...state.vector } : null,
      currentSourceId: currentSourceId(),
      railVisible: !rail.hidden,
      relationCount: railList.children.length,
      overlayPresent: Boolean(overlay?.shell),
      sequence,
      transitionToken: activeTransitionToken
    }),
    returnToOrigin,
    returnToPrevious
  });

  scheduleRender();
})();
