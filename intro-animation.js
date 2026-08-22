(() => {
  const bootstrap = window.__PROFILE_INTRO_BOOTSTRAP__ || {};
  const scene = window.ProfileScene;
  const graph = window.SITE_DATA?.graph;
  const profile = window.SITE_DATA?.profile || {};
  const rootId = graph?.rootId || 'stepan-chrast';
  const nodeMap = new Map((graph?.nodes || []).map(node => [node.id, node]));
  const reducedMotion = Boolean(bootstrap.reducedMotion) || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const initialHash = bootstrap.initialHash ?? location.hash;

  const state = {
    eligible: Boolean(bootstrap.eligible),
    running: false,
    waiting: false,
    stage: bootstrap.eligible ? 'pending' : 'bypassed',
    result: bootstrap.eligible ? null : 'bypassed',
    reducedMotion,
    source: null,
    sourceNodeCount: 0,
    stages: []
  };

  let overlay = null;
  let introSvg = null;
  let enterControl = null;
  let identityAnchor = null;
  let runId = 0;
  let finalising = false;
  let escapeBound = false;
  const inertRecords = new Map();

  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';
  const emit = (name, detail = {}) => window.dispatchEvent(new CustomEvent(`profile:intro-${name}`, { detail: { ...state, ...detail } }));
  const track = name => { try { window.umami?.track?.(name); } catch (_) {} };
  const markSeen = () => { try { sessionStorage.setItem('profileIntroSeen', 'true'); } catch (_) {} };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const waitFor = (predicate, timeout = 5000) => new Promise(resolve => {
    const started = performance.now();
    const poll = () => {
      let value = false;
      try { value = Boolean(predicate()); } catch (_) {}
      if (value) return resolve(true);
      if (performance.now() - started >= timeout) return resolve(false);
      setTimeout(poll, 28);
    };
    poll();
  });
  const stylesheetReady = filename => [...document.styleSheets].some(sheet => {
    try { return Boolean(sheet.href && new URL(sheet.href, location.href).pathname.endsWith(`/${filename}`)); }
    catch (_) { return false; }
  });

  const setUnderlyingInert = value => {
    const elements = [document.querySelector('.site-header'), document.querySelector('.profile-app'), document.querySelector('body > footer')].filter(Boolean);
    elements.forEach(element => {
      if (value) {
        if (!inertRecords.has(element)) inertRecords.set(element, Boolean(element.inert));
        element.inert = true;
      } else if (inertRecords.has(element)) element.inert = inertRecords.get(element);
    });
    if (!value) inertRecords.clear();
  };

  const dispatchHashChange = (oldURL, newURL) => {
    try { window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL, newURL })); }
    catch (_) { window.dispatchEvent(new Event('hashchange')); }
  };
  const internalRoute = async route => {
    const targetRoute = normaliseRoute(route);
    const oldURL = location.href;
    const next = new URL(location.href);
    next.hash = `#${targetRoute}`;
    history.replaceState(history.state, '', next.toString());
    dispatchHashChange(oldURL, next.toString());
    await waitFor(() => document.body?.dataset.graphRoute === targetRoute, 3500);
    return document.body?.dataset.graphRoute === targetRoute;
  };
  const restoreInitialOverviewURL = () => {
    if (initialHash) return;
    const clean = `${location.pathname}${location.search}`;
    history.replaceState(history.state, '', clean || '/');
  };

  const depthMemo = new Map([[rootId, 0]]);
  const depthOf = (id, trail = new Set()) => {
    if (depthMemo.has(id)) return depthMemo.get(id);
    if (trail.has(id)) return 99;
    const node = nodeMap.get(id);
    if (!node) return 99;
    const nextTrail = new Set(trail).add(id);
    const parentDepths = (node.parentIds || []).filter(parentId => nodeMap.has(parentId)).map(parentId => depthOf(parentId, nextTrail)).filter(Number.isFinite);
    const depth = parentDepths.length ? Math.min(...parentDepths) + 1 : 99;
    depthMemo.set(id, depth);
    return depth;
  };
  const sectionMemo = new Map([[rootId, rootId]]);
  const sectionFor = (id, trail = new Set()) => {
    if (sectionMemo.has(id)) return sectionMemo.get(id);
    if (trail.has(id)) return rootId;
    const node = nodeMap.get(id);
    if (!node) return rootId;
    if ((node.parentIds || []).includes(rootId)) {
      sectionMemo.set(id, id);
      return id;
    }
    const nextTrail = new Set(trail).add(id);
    const parents = (node.parentIds || []).filter(parentId => nodeMap.has(parentId)).sort((a, b) => depthOf(a) - depthOf(b));
    const section = parents.length ? sectionFor(parents[0], nextTrail) : rootId;
    sectionMemo.set(id, section);
    return section;
  };
  const tierForDepth = depth => depth <= 0 ? 'root' : depth === 1 ? 'section' : depth === 2 ? 'cluster' : 'deep';

  const cleanClone = clone => {
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
    clone.querySelectorAll('[tabindex]').forEach(element => element.removeAttribute('tabindex'));
    clone.querySelectorAll('.v9-transition-overlay').forEach(element => element.remove());
    const points = new Map();
    clone.querySelectorAll('.site-graph-node[data-node-id]').forEach(element => {
      const x = Number(element.dataset.x), y = Number(element.dataset.y);
      if (Number.isFinite(x) && Number.isFinite(y)) points.set(element.dataset.nodeId, { x, y });
    });
    const rootPoint = points.get(rootId) || { x: 0, y: 0 };
    clone.querySelectorAll('.site-graph-node[data-node-id]').forEach(element => {
      const id = element.dataset.nodeId;
      const depth = depthOf(id);
      const origin = points.get(id) || rootPoint;
      const sectionId = sectionFor(id);
      const section = points.get(sectionId) || rootPoint;
      Object.assign(element.dataset, {
        introDepth: String(depth), introTier: tierForDepth(depth), introSectionId: sectionId,
        introOriginX: String(origin.x), introOriginY: String(origin.y),
        introSectionX: String(section.x), introSectionY: String(section.y),
        introRootX: String(rootPoint.x), introRootY: String(rootPoint.y)
      });
      element.removeAttribute('role');
      element.removeAttribute('aria-label');
      element.style.opacity = '';
    });
    clone.querySelectorAll('.site-graph-edges path[data-source][data-target]').forEach(edge => {
      const depth = Math.max(depthOf(edge.dataset.source), depthOf(edge.dataset.target));
      edge.dataset.introDepth = String(depth);
      edge.dataset.introTier = depth <= 1 ? 'section' : depth === 2 ? 'cluster' : 'deep';
      edge.style.opacity = '';
      edge.style.visibility = '';
    });
  };

  const pointOf = element => ({ x: Number(element?.dataset.x || 0), y: Number(element?.dataset.y || 0) });
  const setPoint = (element, point) => {
    if (!element || !point) return;
    element.setAttribute('transform', `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`);
    element.dataset.x = String(point.x);
    element.dataset.y = String(point.y);
  };
  const lerpPoint = (from, to, t) => ({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
  const parseViewBox = svg => {
    const raw = (svg.getAttribute('viewBox') || '0 0 1200 720').trim().split(/\s+/).map(Number);
    return { x: Number.isFinite(raw[0]) ? raw[0] : 0, y: Number.isFinite(raw[1]) ? raw[1] : 0, width: Number.isFinite(raw[2]) && raw[2] > 0 ? raw[2] : 1200, height: Number.isFinite(raw[3]) && raw[3] > 0 ? raw[3] : 720 };
  };
  const fitAspect = (box, aspect) => {
    let { x, y, width, height } = box;
    if (width / height > aspect) { const desired = width / aspect; y -= (desired - height) / 2; height = desired; }
    else { const desired = height * aspect; x -= (desired - width) / 2; width = desired; }
    return { x, y, width, height };
  };
  const boundsFor = (svg, predicate, padding, fallback) => {
    const points = [...svg.querySelectorAll('.site-graph-node[data-node-id]')].filter(predicate).map(element => ({ x: Number(element.dataset.introOriginX ?? element.dataset.x), y: Number(element.dataset.introOriginY ?? element.dataset.y) })).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
    if (!points.length) return fallback;
    const minX = Math.min(...points.map(point => point.x)), maxX = Math.max(...points.map(point => point.x));
    const minY = Math.min(...points.map(point => point.y)), maxY = Math.max(...points.map(point => point.y));
    return { x: minX - padding, y: minY - padding, width: Math.max(520, maxX - minX + padding * 2), height: Math.max(360, maxY - minY + padding * 2) };
  };
  const viewBoxTargets = svg => {
    const full = parseViewBox(svg), aspect = full.width / full.height;
    const territories = fitAspect(boundsFor(svg, element => Number(element.dataset.introDepth) <= 2, 150, full), aspect);
    const branches = fitAspect(boundsFor(svg, element => Number(element.dataset.introDepth) <= 1, 205, territories), aspect);
    const root = svg.querySelector(`.site-graph-node[data-node-id="${rootId}"]`);
    const rootX = Number(root?.dataset.introOriginX ?? root?.dataset.x), rootY = Number(root?.dataset.introOriginY ?? root?.dataset.y);
    const rootWidth = Math.min(760, full.width * .34), rootHeight = rootWidth / aspect;
    const rootBox = Number.isFinite(rootX) && Number.isFinite(rootY) ? { x: rootX - rootWidth / 2, y: rootY - rootHeight / 2, width: rootWidth, height: rootHeight } : branches;
    return { full, territories, branches, root: rootBox };
  };
  const setViewBox = (svg, box) => svg.setAttribute('viewBox', `${box.x.toFixed(2)} ${box.y.toFixed(2)} ${box.width.toFixed(2)} ${box.height.toFixed(2)}`);
  const animateViewBox = (svg, target, duration, id) => new Promise(resolve => {
    if (!svg || reducedMotion || duration <= 0) { if (svg) setViewBox(svg, target); resolve(true); return; }
    const from = parseViewBox(svg), started = performance.now(), ease = t => 1 - Math.pow(1 - t, 3);
    const frame = now => {
      if (id !== runId || finalising) return resolve(false);
      const raw = Math.min(1, (now - started) / duration), p = ease(raw);
      setViewBox(svg, { x: from.x + (target.x - from.x) * p, y: from.y + (target.y - from.y) * p, width: from.width + (target.width - from.width) * p, height: from.height + (target.height - from.height) * p });
      raw < 1 ? requestAnimationFrame(frame) : resolve(true);
    };
    requestAnimationFrame(frame);
  });

  const collapseTarget = (element, stage) => {
    const depth = Number(element.dataset.introDepth);
    const origin = { x: Number(element.dataset.introOriginX), y: Number(element.dataset.introOriginY) };
    const section = { x: Number(element.dataset.introSectionX), y: Number(element.dataset.introSectionY) };
    const root = { x: Number(element.dataset.introRootX), y: Number(element.dataset.introRootY) };
    if (stage === 'territories' && depth >= 3) return lerpPoint(origin, section, .24);
    if (stage === 'branches' && depth >= 2) return section;
    if (stage === 'root' && depth >= 1) return root;
    return pointOf(element);
  };
  const animateNodeCollapse = (svg, stage, duration, id) => new Promise(resolve => {
    const records = [...svg.querySelectorAll('.site-graph-node[data-node-id]')].map(element => ({ element, from: pointOf(element), to: collapseTarget(element, stage) }));
    if (reducedMotion || duration <= 0) { records.forEach(record => setPoint(record.element, record.to)); resolve(true); return; }
    const started = performance.now(), ease = t => 1 - Math.pow(1 - t, 3);
    const frame = now => {
      if (id !== runId || finalising) return resolve(false);
      const raw = Math.min(1, (now - started) / duration), p = ease(raw);
      records.forEach(record => setPoint(record.element, lerpPoint(record.from, record.to, p)));
      raw < 1 ? requestAnimationFrame(frame) : resolve(true);
    };
    requestAnimationFrame(frame);
  });
  const setStage = stage => {
    state.stage = stage;
    if (!state.stages.includes(stage)) state.stages.push(stage);
    if (overlay) overlay.dataset.stage = stage;
    emit('stage', { stage });
  };

  const profileTags = () => String(profile.label || 'Data analysis · Research · Mathematical logic').split('·').map(value => value.trim()).filter(Boolean).slice(0, 3);
  const buildIdentityNode = () => {
    if (!overlay || identityAnchor) return identityAnchor;
    const anchor = document.createElement('div'); anchor.className = 'profile-intro-identity-anchor';
    const button = document.createElement('button'); button.type = 'button'; button.className = 'profile-intro-identity'; button.setAttribute('aria-label', 'Open the profile map');
    const portrait = document.createElement('span'); portrait.className = 'profile-intro-identity-portrait';
    const image = document.createElement('img'); image.src = 'assets/stepan-chrast.jpg'; image.alt = ''; image.width = 720; image.height = 540; portrait.appendChild(image);
    const name = document.createElement('span'); name.className = 'profile-intro-identity-name'; name.textContent = profile.name || 'Štěpán Chrast';
    const hint = document.createElement('span'); hint.className = 'profile-intro-identity-hint'; hint.textContent = 'Open profile map';
    const orbit = document.createElement('span'); orbit.className = 'profile-intro-identity-orbit';
    profileTags().forEach((tag, index) => { const item = document.createElement('span'); item.className = `profile-intro-identity-tag is-${index + 1}`; item.textContent = tag; orbit.appendChild(item); });
    button.append(portrait, name, hint, orbit); anchor.appendChild(button); overlay.appendChild(anchor); identityAnchor = anchor;
    button.addEventListener('click', openProfile); requestAnimationFrame(() => anchor.classList.add('is-visible'));
    return anchor;
  };

  const buildOverlay = sourceSvg => {
    const clone = sourceSvg.cloneNode(true); cleanClone(clone); clone.classList.add('profile-intro-graph'); clone.setAttribute('aria-hidden', 'true'); clone.setAttribute('focusable', 'false'); clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const shell = document.createElement('section'); shell.className = 'profile-intro-overlay'; shell.dataset.stage = 'atlas'; shell.dataset.source = 'real-atlas'; shell.dataset.sourceNodeCount = String(clone.querySelectorAll('.site-graph-node[data-node-id]').length); shell.setAttribute('aria-label', 'Profile introduction');
    const surface = document.createElement('div'); surface.className = 'profile-intro-surface'; surface.appendChild(clone);
    const enter = document.createElement('button'); enter.type = 'button'; enter.className = 'profile-intro-enter'; enter.disabled = true; enter.innerHTML = '<span>Enter profile</span><small>Condense the Atlas</small>'; enter.setAttribute('aria-label', 'Enter profile and condense the Atlas'); enter.addEventListener('click', startCondensation);
    const skip = document.createElement('button'); skip.type = 'button'; skip.className = 'profile-intro-skip'; skip.textContent = 'Skip intro'; skip.setAttribute('aria-label', 'Skip profile introduction'); skip.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); skipToLanding(); });
    const caption = document.createElement('p'); caption.className = 'profile-intro-caption'; caption.textContent = 'Profile Atlas'; caption.setAttribute('aria-hidden', 'true');
    shell.append(surface, enter, skip, caption); document.body.appendChild(shell);
    overlay = shell; introSvg = clone; enterControl = enter; state.source = 'real-atlas'; state.sourceNodeCount = Number(shell.dataset.sourceNodeCount);
    requestAnimationFrame(() => shell.classList.add('is-ready'));
    return clone;
  };

  const cleanupEscape = () => { if (escapeBound) { window.removeEventListener('keydown', handleEscape, true); escapeBound = false; } };
  function handleEscape(event) {
    if (event.key !== 'Escape' || finalising || state.result) return;
    event.preventDefault(); event.stopImmediatePropagation?.(); skipToLanding();
  }
  const bindEscape = () => { if (!escapeBound) { escapeBound = true; window.addEventListener('keydown', handleEscape, true); } };
  const completeState = result => {
    overlay?.remove(); overlay = null; introSvg = null; enterControl = null; identityAnchor = null;
    document.documentElement.dataset.profileIntro = 'complete'; document.body?.classList.remove('is-profile-intro');
    state.running = false; state.waiting = false; state.stage = 'complete'; state.result = result; cleanupEscape();
    emit(result === 'skipped' ? 'skipped' : 'completed', { result }); track(result === 'skipped' ? 'intro_skipped' : 'intro_completed');
  };
  const skipToLanding = async () => {
    if (!state.eligible || finalising || state.result) return false;
    finalising = true; ++runId; markSeen(); await internalRoute('overview'); await waitFor(() => window.ProfileRootLanding?.isActive?.() === true, 2200); restoreInitialOverviewURL();
    setUnderlyingInert(false); document.documentElement.dataset.profileIntro = 'handoff'; overlay?.classList.add('is-skipping'); await wait(reducedMotion ? 80 : 150);
    completeState('skipped'); finalising = false; return true;
  };
  const failSafe = reason => { emit('fallback', { reason }); if (!finalising) skipToLanding(); };

  async function startCondensation() {
    if (!state.eligible || state.stage !== 'atlas' || !state.waiting || state.running || finalising || !introSvg) return false;
    state.running = true; state.waiting = false; if (enterControl) enterControl.disabled = true; overlay?.classList.add('is-condensing'); document.documentElement.dataset.profileIntro = 'running'; emit('started'); track('intro_started');
    const id = ++runId, targets = viewBoxTargets(introSvg);
    if (reducedMotion) {
      document.documentElement.dataset.profileIntro = 'identity'; setStage('identity'); setViewBox(introSvg, targets.root); buildIdentityNode(); markSeen(); state.running = false; await wait(30); identityAnchor?.querySelector('button')?.focus?.({ preventScroll: true }); return true;
    }
    setStage('territories'); await Promise.all([animateViewBox(introSvg, targets.territories, 820, id), animateNodeCollapse(introSvg, 'territories', 820, id)]); if (id !== runId || finalising) return false;
    setStage('branches'); await Promise.all([animateViewBox(introSvg, targets.branches, 800, id), animateNodeCollapse(introSvg, 'branches', 800, id)]); if (id !== runId || finalising) return false;
    setStage('root'); await Promise.all([animateViewBox(introSvg, targets.root, 900, id), animateNodeCollapse(introSvg, 'root', 900, id)]); if (id !== runId || finalising) return false;
    buildIdentityNode(); document.documentElement.dataset.profileIntro = 'identity'; setStage('identity'); markSeen(); state.running = false; await wait(520); identityAnchor?.querySelector('button')?.focus?.({ preventScroll: true }); emit('identity-ready'); track('intro_condensed'); return true;
  }

  async function openProfile() {
    if (state.stage !== 'identity' || finalising || !identityAnchor) return false;
    finalising = true; state.running = true; setStage('expanding'); document.documentElement.dataset.profileIntro = 'expanding';
    if (!window.ProfileRootLanding?.isActive?.()) {
      const overviewReady = await internalRoute('overview'); if (!overviewReady) { finalising = false; return failSafe('overview-before-expand-timeout'); }
      await waitFor(() => window.ProfileRootLanding?.isActive?.() === true, 2200);
    }
    window.ProfileRootLanding?.activate?.({ focusGraph: false });
    const graphReady = await waitFor(() => {
      const root = document.querySelector(`#site-graph .site-graph-node[data-node-id="${rootId}"]`), explorer = document.querySelector('#site-explorer');
      return Boolean(root && explorer && getComputedStyle(explorer).display !== 'none');
    }, 2500);
    if (!graphReady) { finalising = false; return failSafe('expanded-root-timeout'); }
    const realRoot = document.querySelector(`#site-graph .site-graph-node[data-node-id="${rootId}"]`), realDot = realRoot?.querySelector('.site-graph-dot') || realRoot;
    const targetRect = realDot?.getBoundingClientRect(), sourceRect = identityAnchor.getBoundingClientRect();
    if (!targetRect || !sourceRect.width || !sourceRect.height) { finalising = false; return failSafe('root-geometry-missing'); }
    const dx = targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2), dy = targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2);
    const scale = Math.max(.1, Math.min(.34, targetRect.width / sourceRect.width)); overlay?.classList.add('is-expanding-profile');
    const animation = identityAnchor.animate([{ transform: 'translate(0px, 0px) scale(1)', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: .96 }], { duration: reducedMotion ? 180 : 760, easing: 'cubic-bezier(.16,.76,.18,1)', fill: 'forwards' });
    await Promise.race([animation.finished.catch(() => undefined), wait(reducedMotion ? 200 : 820)]);
    setUnderlyingInert(false); restoreInitialOverviewURL(); completeState('completed'); realRoot?.focus?.({ preventScroll: true }); finalising = false; return true;
  }

  const prepare = async id => {
    const ready = await waitFor(() => Boolean(window.ProfileRootLanding) && Boolean(document.body?.dataset.graphMode) && Boolean(document.querySelector('#site-graph .site-graph-svg')) && stylesheetReady('intro-animation.css'), 5000);
    if (!ready) return failSafe('setup-timeout'); if (id !== runId || finalising) return;
    document.body.classList.add('is-profile-intro'); setUnderlyingInert(true); bindEscape();
    const atlasRouteReady = await internalRoute('atlas'); if (!atlasRouteReady) return failSafe('atlas-route-timeout'); if (id !== runId || finalising) return;
    const atlasReady = await waitFor(() => document.body?.dataset.graphMode === 'atlas' && document.querySelectorAll('#site-graph .site-graph-node[data-node-id]').length >= (graph?.nodes?.length || 1), 5000);
    if (!atlasReady) return failSafe('atlas-render-timeout'); if (id !== runId || finalising) return;
    await wait(reducedMotion ? 40 : 520); if (id !== runId || finalising) return;
    const sourceSvg = document.querySelector('#site-graph .site-graph-svg'); if (!sourceSvg) return failSafe('atlas-svg-missing');
    const clone = buildOverlay(sourceSvg), targets = viewBoxTargets(clone); setViewBox(clone, targets.full); setStage('atlas');
    const overviewReady = await internalRoute('overview'); if (!overviewReady) return failSafe('overview-route-timeout');
    const landingReady = await waitFor(() => window.ProfileRootLanding?.isActive?.() === true, 2200); if (!landingReady) return failSafe('root-landing-timeout');
    restoreInitialOverviewURL(); if (id !== runId || finalising) return;
    state.waiting = true; document.documentElement.dataset.profileIntro = 'waiting'; if (enterControl) enterControl.disabled = false; requestAnimationFrame(() => enterControl?.focus?.({ preventScroll: true })); emit('ready'); track('intro_ready');
  };

  window.ProfileIntro = Object.freeze({ start: startCondensation, skip: skipToLanding, openProfile, snapshot: () => ({ ...state, stages: [...state.stages], overlayPresent: Boolean(overlay), route: normaliseRoute(document.body?.dataset.graphRoute || location.hash) }) });
  if (!state.eligible || !scene?.manager || !graph?.nodes?.length) { document.documentElement.dataset.profileIntro = 'bypass'; return; }
  const id = ++runId; prepare(id);
})();
