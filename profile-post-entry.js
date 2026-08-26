(() => {
  if (window.ProfilePostEntry) return;

  const STORAGE_KEY = 'profileRootReached';
  let retired = false;

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

  const markRetiredMaterial = () => {
    if (!retired) return;
    document.querySelectorAll('[data-root-entry-portrait]:not([data-root-entry-retired]),[data-root-entry-action]:not([data-root-entry-retired])')
      .forEach(element => {
        element.dataset.rootEntryRetired = 'true';
        element.setAttribute('aria-hidden', 'true');
      });
  };

  addEventListener('profile:profile-root-settled', () => retire('profile-root-settled'));
  addEventListener('profile:atlas-condensation-complete', () => requestAnimationFrame(() => sync('condensation-complete')));
  addEventListener('profile:scene-state', () => sync('scene-state'));
  addEventListener('profile:transition-finish', () => sync('transition-finish'));
  addEventListener('profile:transition-begin', () => requestAnimationFrame(markRetiredMaterial));
  addEventListener('profile:graph-render-settled', markRetiredMaterial);
  addEventListener('hashchange', () => requestAnimationFrame(() => sync('hashchange')));

  const boot = () => {
    if (!document.body) return requestAnimationFrame(boot);
    sync('boot');
    markRetiredMaterial();
  };

  window.ProfilePostEntry = Object.freeze({
    retire,
    snapshot: () => ({ retired, stored: (() => {
      try { return sessionStorage.getItem(STORAGE_KEY) === 'true'; } catch (_) { return false; }
    })() })
  });

  boot();
})();
