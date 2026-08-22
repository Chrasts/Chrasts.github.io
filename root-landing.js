(() => {
  const scene = window.ProfileScene;
  if (!scene?.manager) return;

  const { manager } = scene;
  const rootId = window.SITE_DATA?.graph?.rootId || 'stepan-chrast';
  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';
  const explorer = document.querySelector('#site-explorer');
  const status = document.querySelector('#site-graph-status');
  const trigger = document.querySelector('[data-root-activate]');

  let rootActivated = false;
  let active = normaliseRoute(location.hash) === 'overview';
  let unfoldingTimer = 0;

  const routeNow = () => normaliseRoute(document.body.dataset.graphRoute || location.hash);

  const guardExplorer = value => {
    if (!explorer) return;
    if (value) {
      explorer.style.setProperty('display', 'none', 'important');
    } else {
      explorer.style.removeProperty('display');
      explorer.hidden = false;
    }
  };

  const publish = (reason, previous) => {
    window.dispatchEvent(new CustomEvent('profile:root-landing', {
      detail: {
        active,
        rootActivated,
        route: routeNow(),
        previous,
        reason
      }
    }));
  };

  const setActive = (next, { reason = 'root-landing' } = {}) => {
    const previous = active;
    active = Boolean(next);
    document.body.dataset.rootLanding = active ? 'true' : 'false';
    document.body.classList.toggle('is-root-landing', active);
    guardExplorer(active);
    manager.setGraphState({ rootLanding: active }, { reason });
    manager.scheduleRefresh(reason);
    if (previous !== active) publish(reason, previous);
  };

  const focusExpandedRoot = attempt => {
    const root = document.querySelector(`#site-graph .site-graph-node[data-node-id="${rootId}"]`);
    if (root) {
      root.focus?.({ preventScroll: true });
      return;
    }
    if (attempt < 6) setTimeout(() => focusExpandedRoot(attempt + 1), 45);
  };

  const activate = ({ focusGraph = true } = {}) => {
    if (!active) return false;
    rootActivated = true;
    document.body.classList.add('is-root-unfolding');
    setActive(false, { reason: 'root-activate' });

    clearTimeout(unfoldingTimer);
    unfoldingTimer = setTimeout(() => {
      document.body.classList.remove('is-root-unfolding');
    }, 820);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (status) status.textContent = 'Profile map expanded. Choose Work, Knowledge, Experience, Education or About.';
      if (focusGraph) focusExpandedRoot(0);
    }));

    window.dispatchEvent(new CustomEvent('profile:root-activated', {
      detail: { rootId, route: routeNow() }
    }));
    return true;
  };

  const reset = () => {
    rootActivated = false;
    if (routeNow() === 'overview') setActive(true, { reason: 'root-reset' });
  };

  window.addEventListener('click', event => {
    const rootControl = event.target.closest?.('[data-root-activate]');
    if (rootControl) {
      event.preventDefault();
      activate();
      return;
    }

    const routeControl = event.target.closest?.('[data-route]');
    if (!routeControl || !active) return;
    const route = normaliseRoute(routeControl.dataset.route || routeControl.getAttribute('href'));
    if (route !== 'overview') setActive(false, { reason: `root-route:${route}` });
  }, true);

  window.addEventListener('hashchange', () => {
    const route = normaliseRoute(location.hash);
    if (route === 'overview') {
      setActive(!rootActivated, { reason: 'root-route-overview' });
    } else {
      setActive(false, { reason: `root-hash:${route}` });
    }
  });

  if (trigger) trigger.disabled = false;
  setActive(active, { reason: 'root-controller-boot' });

  window.ProfileRootLanding = Object.freeze({
    activate,
    reset,
    isActive: () => active,
    hasActivated: () => rootActivated
  });
})();