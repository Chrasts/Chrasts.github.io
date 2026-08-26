(() => {
  const graph = window.SITE_DATA?.graph;
  const profile = window.SITE_DATA?.profile || {};
  if (!graph?.nodes?.length) return;

  const rootId = graph.rootId || 'stepan-chrast';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const svgNS = 'http://www.w3.org/2000/svg';
  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const raf = () => new Promise(resolve => requestAnimationFrame(resolve));
  const waitFor = (predicate, timeout = 2600) => new Promise(resolve => {
    const started = performance.now();
    const poll = () => {
      let ok = false;
      try { ok = Boolean(predicate()); } catch (_) {}
      if (ok || performance.now() - started > timeout) return resolve(ok);
      setTimeout(poll, 24);
    };
    poll();
  });

  // This is synchronous because the intro clone may otherwise receive one paint
  // before the external stylesheet has finished loading.
  if (!document.querySelector('style[data-profile-intro-flash-guard]')) {
    const guard = document.createElement('style');
    guard.dataset.profileIntroFlashGuard = 'true';
    guard.textContent = [
      '.profile-intro-overlay[data-source="real-atlas"]:not(.is-auto-unfold-complete) .site-graph-node:not([data-intro-tier="root"]),',
      '.profile-intro-overlay[data-source="real-atlas"]:not(.is-auto-unfold-complete) .site-graph-edges path{opacity:0!important}',
      '.profile-intro-overlay[data-source="real-atlas"]:not(.is-auto-unfold-complete) .profile-intro-enter{opacity:0!important;pointer-events:none!important}',
      '.profile-intro-gateway-orbit{z-index:0!important}',
      '.profile-intro-enter>span,.profile-intro-enter>small{z-index:1}'
    ].join('');
    document.head.appendChild(guard);
  }

  const liveNodes = () => [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
    .filter(element => !element.closest('.v9-transition-overlay'));
  addEventListener('profile:scene-state', syncRootOrbit);

  /* ----------------------------------------------------------------------
     Intro Enter gateway
     ---------------------------------------------------------------------- */
  const patchGateway = shell => {
    const enter = shell?.querySelector('.profile-intro-enter');
    if (!enter || enter.dataset.v3Gateway === 'true') return;
    enter.dataset.v3Gateway = 'true';
    ['inner', 'outer'].forEach(kind => {
      const orbit = document.createElement('i');
      orbit.className = `profile-intro-gateway-orbit is-${kind}`;
      orbit.setAttribute('aria-hidden', 'true');
      enter.prepend(orbit);
    });
  };
  const patchCurrentGateway = () => document.querySelectorAll('.profile-intro-overlay').forEach(patchGateway);
  addEventListener('profile:intro-started', patchCurrentGateway);
  addEventListener('profile:intro-stage', patchCurrentGateway);
  document.querySelectorAll('.profile-intro-overlay').forEach(patchGateway);

  addEventListener('click', event => {
    const enter = event.target.closest?.('.profile-intro-enter');
    if (!enter) return;
    const shell = enter.closest('.profile-intro-overlay');
    shell?.classList.add('is-enter-committed');
    shell?.classList.remove('is-enter-active');
  }, true);

  /* ----------------------------------------------------------------------
     Rotating root state for expanded Overview only
     ---------------------------------------------------------------------- */
  const makeRootOrbit = root => {
    if (!root || root.querySelector(':scope > .profile-root-overview-orbit')) return;
    const orbit = document.createElementNS(svgNS, 'g');
    orbit.classList.add('profile-root-overview-orbit', 'is-entering');
    orbit.setAttribute('aria-hidden', 'true');
    [
      { r: 25, dash: '6 5 2 7 10 4', className: 'is-a' },
      { r: 34, dash: '3 9 12 5 4 10', className: 'is-b' }
    ].forEach(spec => {
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', '0');
      circle.setAttribute('cy', '0');
      circle.setAttribute('r', String(spec.r));
      circle.setAttribute('stroke-dasharray', spec.dash);
      circle.classList.add(spec.className);
      orbit.appendChild(circle);
    });
    const dot = root.querySelector('.site-graph-dot');
    root.insertBefore(orbit, dot || root.firstChild);
    requestAnimationFrame(() => orbit.classList.remove('is-entering'));
  };
  function syncRootOrbit() {
    if (document.querySelector('.profile-intro-overlay')) return;
    const active = document.body?.dataset.graphMode === 'overview' && document.body?.dataset.rootLanding !== 'true';
    const roots = [...document.querySelectorAll(`#site-graph .site-graph-node[data-node-id="${rootId}"]`)];
    roots.forEach(root => {
      let orbit = root.querySelector(':scope > .profile-root-overview-orbit');
      if (active) {
        if (!orbit) makeRootOrbit(root);
        else orbit.classList.remove('is-leaving');
        return;
      }
      if (!orbit) return;
      orbit.classList.add('is-leaving');
      if (!root.closest('.v9-transition-overlay')) {
        setTimeout(() => {
          if (document.body?.dataset.graphMode !== 'overview') orbit.remove();
        }, reduced.matches ? 0 : 360);
      }
    });
  }
  addEventListener('profile:graph-render-settled', () => requestAnimationFrame(syncRootOrbit));
  addEventListener('profile:root-activated', () => requestAnimationFrame(syncRootOrbit));
  addEventListener('profile:intro-completed', () => requestAnimationFrame(syncRootOrbit));
  requestAnimationFrame(syncRootOrbit);

  /* ----------------------------------------------------------------------
     Atlas <-> segmented navigation boundary
     ---------------------------------------------------------------------- */
  let atlasHandoff = null;
  const routeFromControl = target => {
    const control = target.closest?.('[data-route]');
    if (!control) return null;
    return normaliseRoute(control.dataset.route || control.getAttribute('href'));
  };
  const createAtlasSnapshot = () => {
    const viewport = document.querySelector('.site-graph-viewport');
    const svg = document.querySelector('#site-graph .site-graph-svg');
    if (!viewport || !svg || getComputedStyle(viewport).display === 'none') return null;
    const rect = viewport.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) return null;
    const shell = document.createElement('div');
    shell.className = 'profile-atlas-handoff';
    shell.setAttribute('aria-hidden', 'true');
    shell.style.left = `${rect.left}px`;
    shell.style.top = `${rect.top}px`;
    shell.style.width = `${rect.width}px`;
    shell.style.height = `${rect.height}px`;
    const clone = svg.cloneNode(true);
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
    clone.querySelectorAll('[tabindex]').forEach(element => element.removeAttribute('tabindex'));
    shell.appendChild(clone);
    document.body.appendChild(shell);
    return shell;
  };
  const setRoute = route => {
    const next = `#${route}`;
    if (location.hash !== next) location.hash = next;
  };
  const beginAtlasHandoff = async targetRoute => {
    if (atlasHandoff) return false;
    const shell = createAtlasSnapshot();
    atlasHandoff = { targetRoute, shell };
    document.body.classList.add('is-atlas-handoff');
    document.body.classList.remove('is-atlas-handoff-revealing');
    document.body.dataset.atlasHandoffTarget = targetRoute;
    setRoute(targetRoute);

    await waitFor(() => {
      const route = normaliseRoute(document.body?.dataset.graphRoute || location.hash);
      const mode = document.body?.dataset.graphMode;
      return targetRoute === 'atlas' ? mode === 'atlas' : route === targetRoute && mode !== 'atlas';
    });
    window.ProfileGeometry?.stabilize?.(1500);
    window.ProfileLocalLabelPolicy?.schedule?.('atlas-handoff-ready');
    await raf();
    await raf();
    await raf();
    await wait(reduced.matches ? 0 : 70);
    window.ProfileGeometry?.apply?.();
    window.ProfileLocalLabelPolicy?.apply?.('atlas-handoff-geometry');
    syncRootOrbit();

    document.body.classList.add('is-atlas-handoff-revealing');
    shell?.classList.add('is-leaving');
    await wait(reduced.matches ? 40 : 720);
    shell?.remove();
    document.body.classList.remove('is-atlas-handoff', 'is-atlas-handoff-revealing');
    delete document.body.dataset.atlasHandoffTarget;
    atlasHandoff = null;
    window.ProfileGeometry?.stabilize?.(900);
    window.ProfileLocalLabelPolicy?.schedule?.('atlas-handoff-complete');
    return true;
  };
  const shouldOwnAtlasBoundary = targetRoute => {
    if (!targetRoute || document.querySelector('.profile-intro-overlay')) return false;
    const currentRoute = normaliseRoute(document.body?.dataset.graphRoute || location.hash);
    if (targetRoute === currentRoute) return false;
    return document.body?.dataset.graphMode === 'atlas' || targetRoute === 'atlas';
  };
  addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const targetRoute = routeFromControl(event.target);
    if (!shouldOwnAtlasBoundary(targetRoute)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    beginAtlasHandoff(targetRoute);
  }, true);
  addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const targetRoute = routeFromControl(event.target);
    if (!shouldOwnAtlasBoundary(targetRoute)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    beginAtlasHandoff(targetRoute);
  }, true);

  /* ----------------------------------------------------------------------
     Root identity inspector
     ---------------------------------------------------------------------- */
  let inspector = null;
  let returnFocus = null;
  const closeInspector = () => {
    if (!inspector) return;
    const old = inspector;
    inspector = null;
    old.classList.remove('is-open');
    document.body.classList.remove('has-root-inspector');
    setTimeout(() => old.remove(), reduced.matches ? 0 : 240);
    returnFocus?.focus?.({ preventScroll: true });
    returnFocus = null;
  };
  const openInspector = rootElement => {
    if (inspector) {
      closeInspector();
      return;
    }
    const shell = document.createElement('div');
    shell.className = 'profile-root-inspector';
    shell.setAttribute('role', 'dialog');
    shell.setAttribute('aria-modal', 'true');
    shell.setAttribute('aria-label', `${profile.name || 'Štěpán Chrast'} profile summary`);
    const backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'profile-root-inspector-backdrop';
    backdrop.setAttribute('aria-label', 'Close profile summary');
    const panel = document.createElement('section');
    panel.className = 'profile-root-inspector-panel';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'profile-root-inspector-close';
    close.setAttribute('aria-label', 'Close profile summary');
    close.textContent = '×';
    const portrait = document.createElement('div');
    portrait.className = 'profile-root-inspector-portrait';
    const image = document.createElement('img');
    image.src = 'assets/stepan-chrast.jpg';
    image.alt = '';
    portrait.appendChild(image);
    const copy = document.createElement('div');
    copy.className = 'profile-root-inspector-copy';
    const name = document.createElement('h2');
    name.textContent = profile.name || 'Štěpán Chrast';
    const label = document.createElement('p');
    label.className = 'profile-root-inspector-label';
    label.textContent = profile.label || '';
    const intro = document.createElement('p');
    intro.className = 'profile-root-inspector-intro';
    intro.textContent = profile.intro || '';
    const links = document.createElement('nav');
    links.className = 'profile-root-inspector-links';
    links.setAttribute('aria-label', 'Profile links');
    if (profile.email) {
      const anchor = document.createElement('a');
      anchor.href = `mailto:${profile.email}`;
      anchor.textContent = 'Email';
      links.appendChild(anchor);
    }
    (profile.links || []).forEach(item => {
      const anchor = document.createElement('a');
      anchor.href = item.href;
      anchor.textContent = `${item.label} ↗`;
      anchor.target = '_blank';
      anchor.rel = 'noreferrer';
      links.appendChild(anchor);
    });
    copy.append(name, label, intro, links);
    panel.append(close, portrait, copy);
    shell.append(backdrop, panel);
    document.body.appendChild(shell);
    inspector = shell;
    returnFocus = rootElement;
    document.body.classList.add('has-root-inspector');
    backdrop.addEventListener('click', closeInspector);
    close.addEventListener('click', closeInspector);
    requestAnimationFrame(() => {
      shell.classList.add('is-open');
      close.focus({ preventScroll: true });
    });
  };
  const overviewRoot = target => {
    if (document.querySelector('.profile-intro-overlay')) return null;
    if (document.body?.dataset.graphMode !== 'overview' || document.body?.dataset.rootLanding === 'true') return null;
    return target.closest?.(`#site-graph .site-graph-node[data-node-id="${rootId}"]`) || null;
  };
  addEventListener('click', event => {
    if (event.button !== 0) return;
    const root = overviewRoot(event.target);
    if (!root) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openInspector(root);
  }, true);
  addEventListener('keydown', event => {
    if (event.key === 'Escape' && inspector) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeInspector();
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const root = overviewRoot(event.target);
    if (!root) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openInspector(root);
  }, true);

  window.ProfileIntroFixesV3 = Object.freeze({
    snapshot: () => ({
      compassVersion: window.ProfileGeometry?.snapshot?.().compassVersion || null,
      inspectorOpen: Boolean(inspector),
      atlasHandoff: Boolean(atlasHandoff),
      rootOrbit: Boolean(document.querySelector(`#site-graph .site-graph-node[data-node-id="${rootId}"] > .profile-root-overview-orbit`)),
      gatewayOrbit: Boolean(document.querySelector('.profile-intro-enter .profile-intro-gateway-orbit')),
      localLabelPolicyReady: Boolean(window.ProfileLocalLabelPolicy)
    }),
    openProfileSummary: () => {
      const root = liveNodes().find(element => element.dataset.nodeId === rootId);
      if (root) openInspector(root);
    },
    closeProfileSummary: closeInspector,
    syncRootOrbit
  });
})();
