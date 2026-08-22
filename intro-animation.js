(() => {
  const bootstrap = window.__PROFILE_INTRO_BOOTSTRAP__ || {};
  const scene = window.ProfileScene;
  const graph = window.SITE_DATA?.graph;
  const rootId = graph?.rootId || 'stepan-chrast';
  const nodeMap = new Map((graph?.nodes || []).map(node => [node.id, node]));
  const reducedMotion = Boolean(bootstrap.reducedMotion) || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const initialHash = bootstrap.initialHash ?? location.hash;

  const state = {
    eligible: Boolean(bootstrap.eligible),
    running: false,
    stage: bootstrap.eligible ? 'pending' : 'bypassed',
    result: bootstrap.eligible ? null : 'bypassed',
    reducedMotion,
    source: null,
    sourceNodeCount: 0,
    stages: []
  };

  let overlay = null;
  let introSvg = null;
  let runId = 0;
  let finalising = false;
  let interruptBound = false;
  const inertRecords = new Map();

  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';

  const emit = (name, detail = {}) => {
    window.dispatchEvent(new CustomEvent(`profile:intro-${name}`, {
      detail: { ...state, ...detail }
    }));
  };

  const track = name => {
    try { window.umami?.track?.(name); } catch (_) {}
  };

  const markSeen = () => {
    try { sessionStorage.setItem('profileIntroSeen', 'true'); } catch (_) {}
  };

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
    const elements = [
      document.querySelector('.site-header'),
      document.querySelector('.profile-app'),
      document.querySelector('body > footer')
    ].filter(Boolean);

    elements.forEach(element => {
      if (value) {
        if (!inertRecords.has(element)) inertRecords.set(element, Boolean(element.inert));
        element.inert = true;
      } else if (inertRecords.has(element)) {
        element.inert = inertRecords.get(element);
      }
    });
    if (!value) inertRecords.clear();
  };

  const dispatchHashChange = (oldURL, newURL) => {
    try {
      window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL, newURL }));
    } catch (_) {
      window.dispatchEvent(new Event('hashchange'));
    }
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
    const parentDepths = (node.parentIds || [])
      .filter(parentId => nodeMap.has(parentId))
      .map(parentId => depthOf(parentId, nextTrail))
      .filter(Number.isFinite);
    const depth = parentDepths.length ? Math.min(...parentDepths) + 1 : 99;
    depthMemo.set(id, depth);
    return depth;
  };

  const tierForDepth = depth =>
    depth <= 0 ? 'root' : depth === 1 ? 'section' : depth === 2 ? 'cluster' : 'deep';

  const cleanClone = clone => {
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
    clone.querySelectorAll('[tabindex]').forEach(element => element.removeAttribute('tabindex'));
    clone.querySelectorAll('.v9-transition-overlay').forEach(element => element.remove());
    clone.querySelectorAll('.site-graph-node[data-node-id]').forEach(element => {
      const depth = depthOf(element.dataset.nodeId);
      element.dataset.introDepth = String(depth);
      element.dataset.introTier = tierForDepth(depth);
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

  const parseViewBox = svg => {
    const raw = (svg.getAttribute('viewBox') || '0 0 1200 720').trim().split(/\s+/).map(Number);
    return {
      x: Number.isFinite(raw[0]) ? raw[0] : 0,
      y: Number.isFinite(raw[1]) ? raw[1] : 0,
      width: Number.isFinite(raw[2]) && raw[2] > 0 ? raw[2] : 1200,
      height: Number.isFinite(raw[3]) && raw[3] > 0 ? raw[3] : 720
    };
  };

  const fitAspect = (box, aspect) => {
    let { x, y, width, height } = box;
    const current = width / height;
    if (current > aspect) {
      const desired = width / aspect;
      y -= (desired - height) / 2;
      height = desired;
    } else {
      const desired = height * aspect;
      x -= (desired - width) / 2;
      width = desired;
    }
    return { x, y, width, height };
  };

  const boundsFor = (svg, predicate, padding, fallback) => {
    const points = [...svg.querySelectorAll('.site-graph-node[data-node-id]')]
      .filter(predicate)
      .map(element => ({
        x: Number(element.dataset.x),
        y: Number(element.dataset.y)
      }))
      .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
    if (!points.length) return fallback;
    const minX = Math.min(...points.map(point => point.x));
    const maxX = Math.max(...points.map(point => point.x));
    const minY = Math.min(...points.map(point => point.y));
    const maxY = Math.max(...points.map(point => point.y));
    return {
      x: minX - padding,
      y: minY - padding,
      width: Math.max(520, maxX - minX + padding * 2),
      height: Math.max(360, maxY - minY + padding * 2)
    };
  };

  const viewBoxTargets = svg => {
    const full = parseViewBox(svg);
    const aspect = full.width / full.height;
    const territories = fitAspect(boundsFor(
      svg,
      element => Number(element.dataset.introDepth) <= 2,
      135,
      full
    ), aspect);
    const branches = fitAspect(boundsFor(
      svg,
      element => Number(element.dataset.introDepth) <= 1,
      175,
      territories
    ), aspect);
    const root = svg.querySelector(`.site-graph-node[data-node-id="${rootId}"]`);
    const rootX = Number(root?.dataset.x);
    const rootY = Number(root?.dataset.y);
    const rootWidth = Math.min(960, full.width * .42);
    const rootHeight = rootWidth / aspect;
    const rootBox = Number.isFinite(rootX) && Number.isFinite(rootY)
      ? { x: rootX - rootWidth / 2, y: rootY - rootHeight / 2, width: rootWidth, height: rootHeight }
      : branches;
    return { full, territories, branches, root: rootBox };
  };

  const setViewBox = (svg, box) => {
    svg.setAttribute('viewBox', `${box.x.toFixed(2)} ${box.y.toFixed(2)} ${box.width.toFixed(2)} ${box.height.toFixed(2)}`);
  };

  const animateViewBox = (svg, target, duration, id) => new Promise(resolve => {
    if (!svg || reducedMotion || duration <= 0) {
      if (svg) setViewBox(svg, target);
      resolve(true);
      return;
    }
    const from = parseViewBox(svg);
    const started = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);
    const frame = now => {
      if (id !== runId || finalising) return resolve(false);
      const raw = Math.min(1, (now - started) / duration);
      const p = ease(raw);
      setViewBox(svg, {
        x: from.x + (target.x - from.x) * p,
        y: from.y + (target.y - from.y) * p,
        width: from.width + (target.width - from.width) * p,
        height: from.height + (target.height - from.height) * p
      });
      if (raw < 1) requestAnimationFrame(frame);
      else resolve(true);
    };
    requestAnimationFrame(frame);
  });

  const setStage = stage => {
    state.stage = stage;
    if (!state.stages.includes(stage)) state.stages.push(stage);
    if (overlay) overlay.dataset.stage = stage;
    emit('stage', { stage });
  };

  const buildOverlay = sourceSvg => {
    const clone = sourceSvg.cloneNode(true);
    cleanClone(clone);
    clone.classList.add('profile-intro-graph');
    clone.setAttribute('aria-hidden', 'true');
    clone.setAttribute('focusable', 'false');
    clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const shell = document.createElement('section');
    shell.className = 'profile-intro-overlay';
    shell.dataset.stage = 'atlas';
    shell.dataset.source = 'real-atlas';
    shell.dataset.sourceNodeCount = String(clone.querySelectorAll('.site-graph-node[data-node-id]').length);
    shell.setAttribute('aria-label', 'Profile introduction');

    const surface = document.createElement('div');
    surface.className = 'profile-intro-surface';
    surface.appendChild(clone);

    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'profile-intro-skip';
    skip.textContent = 'Skip intro';
    skip.setAttribute('aria-label', 'Skip profile introduction');

    const caption = document.createElement('p');
    caption.className = 'profile-intro-caption';
    caption.textContent = 'Profile Atlas';
    caption.setAttribute('aria-hidden', 'true');

    shell.append(surface, skip, caption);
    document.body.appendChild(shell);
    overlay = shell;
    introSvg = clone;
    state.source = 'real-atlas';
    state.sourceNodeCount = Number(shell.dataset.sourceNodeCount);
    requestAnimationFrame(() => shell.classList.add('is-ready'));
    return clone;
  };

  const cleanupInterrupts = () => {
    if (!interruptBound) return;
    window.removeEventListener('pointerdown', interrupt, true);
    window.removeEventListener('keydown', interrupt, true);
    interruptBound = false;
  };

  const finish = async (result, { quick = false } = {}) => {
    if (finalising) return;
    finalising = true;
    ++runId;
    markSeen();

    await internalRoute('overview');
    await waitFor(() => window.ProfileRootLanding?.isActive?.() === true, 2200);
    restoreInitialOverviewURL();

    setUnderlyingInert(false);
    document.documentElement.dataset.profileIntro = 'handoff';
    if (overlay) overlay.classList.add(quick ? 'is-skipping' : 'is-handoff');
    await wait(quick ? 150 : reducedMotion ? 220 : 390);

    overlay?.remove();
    overlay = null;
    introSvg = null;
    document.documentElement.dataset.profileIntro = 'complete';
    document.body?.classList.remove('is-profile-intro');
    state.running = false;
    state.stage = 'complete';
    state.result = result;
    cleanupInterrupts();

    emit(result === 'skipped' ? 'skipped' : 'completed', { result });
    track(result === 'skipped' ? 'intro_skipped' : 'intro_completed');
    finalising = false;
  };

  const skip = () => {
    if (!state.eligible || (!state.running && state.stage !== 'pending') || finalising) return false;
    finish('skipped', { quick: true });
    return true;
  };

  function interrupt(event) {
    if (!state.running && state.stage !== 'pending') return;
    if (event.type === 'keydown' && !['Enter', 'Escape', ' '].includes(event.key)) return;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    skip();
  }

  const bindInterrupts = () => {
    if (interruptBound) return;
    interruptBound = true;
    window.addEventListener('pointerdown', interrupt, true);
    window.addEventListener('keydown', interrupt, true);
  };

  const failSafe = reason => {
    emit('fallback', { reason });
    if (!finalising) finish('skipped', { quick: true });
  };

  const play = async id => {
    const ready = await waitFor(() =>
      Boolean(window.ProfileRootLanding) &&
      Boolean(document.body?.dataset.graphMode) &&
      Boolean(document.querySelector('#site-graph .site-graph-svg')) &&
      stylesheetReady('intro-animation.css'),
    5000);
    if (!ready) return failSafe('setup-timeout');
    if (id !== runId || finalising) return;

    state.running = true;
    document.documentElement.dataset.profileIntro = 'running';
    document.body.classList.add('is-profile-intro');
    setUnderlyingInert(true);
    bindInterrupts();
    emit('started');

    const atlasRouteReady = await internalRoute('atlas');
    if (!atlasRouteReady) return failSafe('atlas-route-timeout');
    if (id !== runId || finalising) return;

    const atlasReady = await waitFor(() => {
      if (document.body?.dataset.graphMode !== 'atlas') return false;
      const count = document.querySelectorAll('#site-graph .site-graph-node[data-node-id]').length;
      return count >= (graph?.nodes?.length || 1);
    }, 5000);
    if (!atlasReady) return failSafe('atlas-render-timeout');
    if (id !== runId || finalising) return;

    await wait(reducedMotion ? 40 : 520);
    if (id !== runId || finalising) return;
    const sourceSvg = document.querySelector('#site-graph .site-graph-svg');
    if (!sourceSvg) return failSafe('atlas-svg-missing');

    const clone = buildOverlay(sourceSvg);
    const targets = viewBoxTargets(clone);
    setViewBox(clone, targets.full);
    setStage('atlas');

    const overviewReady = await internalRoute('overview');
    if (!overviewReady) return failSafe('overview-route-timeout');
    const landingReady = await waitFor(() => window.ProfileRootLanding?.isActive?.() === true, 2200);
    if (!landingReady) return failSafe('root-landing-timeout');
    restoreInitialOverviewURL();
    if (id !== runId || finalising) return;

    if (reducedMotion) {
      await wait(240);
      if (id !== runId || finalising) return;
      await finish('completed');
      return;
    }

    await wait(520);
    if (id !== runId || finalising) return;

    setStage('territories');
    await animateViewBox(clone, targets.territories, 700, id);
    if (id !== runId || finalising) return;

    setStage('branches');
    await animateViewBox(clone, targets.branches, 620, id);
    if (id !== runId || finalising) return;

    setStage('root');
    await animateViewBox(clone, targets.root, 620, id);
    if (id !== runId || finalising) return;

    await wait(120);
    if (id !== runId || finalising) return;
    await finish('completed');
  };

  window.ProfileIntro = Object.freeze({
    skip,
    snapshot: () => ({
      ...state,
      stages: [...state.stages],
      overlayPresent: Boolean(overlay),
      route: normaliseRoute(document.body?.dataset.graphRoute || location.hash)
    })
  });

  if (!state.eligible || !scene?.manager || !graph?.nodes?.length) {
    document.documentElement.dataset.profileIntro = 'bypass';
    return;
  }

  bindInterrupts();
  const id = ++runId;
  play(id);
})();
