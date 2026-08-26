(() => {
  if (window.ProfilePostEntry) return;

  const STORAGE_KEY = 'profileRootReached';
  let retired = false;

  const ensureMotionRefinements = () => {
    if (!document.querySelector('link[data-profile-motion-refinements-style]')) {
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = 'profile-motion-refinements.css';
      style.setAttribute('data-profile-motion-refinements-style', 'true');
      document.head.appendChild(style);
    }
    if (!window.ProfileMotionRefinements && !document.querySelector('script[data-profile-motion-refinements]')) {
      const script = document.createElement('script');
      script.src = 'profile-motion-refinements.js';
      script.async = false;
      script.setAttribute('data-profile-motion-refinements', 'true');
      document.head.appendChild(script);
    }
    if (!window.ProfileMotionCompat && !document.querySelector('script[data-profile-motion-compat]')) {
      const script = document.createElement('script');
      script.src = 'profile-motion-compat.js';
      script.async = false;
      script.setAttribute('data-profile-motion-compat', 'true');
      document.head.appendChild(script);
    }
  };

  const persist = () => {
    try { sessionStorage.setItem(STORAGE_KEY, 'true'); } catch (_) {}
  };

  const shouldAlreadyBeRetired = () => {
    let stored = false;
    try { stored = sessionStorage.getItem(STORAGE_KEY) === 'true'; } catch (_) {}
    return stored ||
      document.body?.dataset.entryState === 'profile' ||
      (document.body?.dataset.graphMode === 'overview' && document.body?.dataset.rootLanding === 'false') ||
      document.body?.classList.contains('is-profile-root-ready');
  };

  const retire = (reason = 'profile-root') => {
    if (!document.body) return false;
    retired = true;
    persist();
    document.body.classList.add('is-root-entry-retired');
    document.body.dataset.rootEntryMaterial = 'retired';

    // The visible "Enter profile" identity material belongs only to the entry
    // experience. Keep the semantic root node itself and its halos untouched.
    document.querySelectorAll('[data-root-entry-portrait],[data-root-entry-action]').forEach(element => {
      element.dataset.rootEntryRetired = 'true';
      element.setAttribute('aria-hidden', 'true');
    });

    dispatchEvent(new CustomEvent('profile:root-entry-retired', { detail: { reason } }));
    return true;
  };

  const sync = reason => {
    if (retired || shouldAlreadyBeRetired()) retire(reason || 'sync');
  };

  addEventListener('profile:profile-root-settled', () => retire('profile-root-settled'));
  addEventListener('profile:atlas-condensation-complete', () => requestAnimationFrame(() => sync('condensation-complete')));
  addEventListener('profile:scene-state', () => sync('scene-state'));
  addEventListener('profile:transition-finish', () => sync('transition-finish'));
  addEventListener('hashchange', () => requestAnimationFrame(() => sync('hashchange')));

  const observer = new MutationObserver(() => {
    if (!retired) sync('body-state');
    if (!retired) return;
    // Graph transitions clone SVG nodes. Mark newly created copies as retired
    // too; CSS uses the body marker so no portrait can flash in an overlay.
    document.querySelectorAll('[data-root-entry-portrait]:not([data-root-entry-retired]),[data-root-entry-action]:not([data-root-entry-retired])')
      .forEach(element => {
        element.dataset.rootEntryRetired = 'true';
        element.setAttribute('aria-hidden', 'true');
      });
  });

  const boot = () => {
    if (!document.body) return requestAnimationFrame(boot);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-entry-state', 'data-graph-mode', 'data-root-landing', 'class']
    });
    sync('boot');
  };

  window.ProfilePostEntry = Object.freeze({
    retire,
    snapshot: () => ({ retired, stored: (() => {
      try { return sessionStorage.getItem(STORAGE_KEY) === 'true'; } catch (_) { return false; }
    })() })
  });

  // Load before the Atlas interaction bundle is lazy-booted. The motion module
  // therefore registers the Profile -> Atlas boundary listener first, while the
  // existing Atlas -> local Focus owner remains available for the reverse side.
  ensureMotionRefinements();
  boot();
})();