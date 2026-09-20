(() => {
  if (window.ProfilePostEntry) return;

  const STORAGE_KEY = 'profileRootReached';
  let retired = false;

  const persist = () => {
    try { sessionStorage.setItem(STORAGE_KEY, 'true'); } catch (_) {}
  };
  const clearPersisted = () => {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
  };
  const openingEntryAtlas = () => {
    const introState = window.ProfileIntro?.snapshot?.().state || '';
    const marker = document.documentElement.dataset.profileIntro || '';
    const entryState = document.body?.dataset.entryState || '';
    return document.body?.dataset.graphMode === 'atlas' &&
      !document.body?.classList.contains('is-root-entry-committing') &&
      (['reveal', 'ready'].includes(entryState) ||
       ['ATLAS_REVEAL', 'ATLAS_READY'].includes(introState) ||
       (window.__PROFILE_INTRO_BOOTSTRAP__?.eligible && ['pending', 'preparing', 'running', 'ready'].includes(marker)));
  };
  const restoreEntryMaterial = reason => {
    if (!document.body || !openingEntryAtlas()) return false;
    retired = false;
    clearPersisted();
    document.body.classList.remove('is-root-entry-retired');
    if (document.body.dataset.rootEntryMaterial === 'retired') delete document.body.dataset.rootEntryMaterial;
    document.querySelectorAll('[data-root-entry-portrait],[data-root-entry-action]').forEach(element => {
      delete element.dataset.rootEntryRetired;
      // Both SVG objects are intentionally presentation-only to AT; removing
      // the stale retirement marker is enough to restore visual ownership.
      element.setAttribute('aria-hidden', 'true');
    });
    dispatchEvent(new CustomEvent('profile:root-entry-restored', { detail: { reason } }));
    return true;
  };

  const shouldAlreadyBeRetired = () => {
    let stored = false;
    try { stored = sessionStorage.getItem(STORAGE_KEY) === 'true'; } catch (_) {}
    // On a first eligible visit the app briefly boots its ordinary overview
    // shell before the intro routes it into Atlas. That transient shell is
    // not evidence that the visitor has entered the profile; retiring here
    // used to hide the root portrait for the entire introductory Atlas.
    // The interactive opening Atlas is still entry state even after the
    // reveal has reached ready. Do not let compatibility cleanup retire the
    // canonical portrait before its root hover/focus interaction can use it.
    if (openingEntryAtlas()) return false;
    const initialIntro = window.__PROFILE_INTRO_BOOTSTRAP__?.eligible &&
      document.body?.dataset.entryState !== 'profile' &&
      !['ATLAS_READY', 'BYPASSED'].includes(window.ProfileIntro?.snapshot?.().state || '');
    if (initialIntro) return false;
    return stored ||
      document.body?.dataset.entryState === 'profile' ||
      (document.body?.dataset.graphMode === 'overview' && document.body?.dataset.rootLanding === 'false') ||
      document.body?.classList.contains('is-profile-root-ready');
  };

  const retire = (reason = 'profile-root') => {
    if (!document.body || openingEntryAtlas()) {
      restoreEntryMaterial(`blocked-retire:${reason}`);
      return false;
    }
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
    if (openingEntryAtlas()) {
      restoreEntryMaterial(reason || 'entry-atlas');
      return;
    }
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

  // Never bypass the ownership guard. This direct retire() call was the
  // recurring race: a transient Overview render could fire this event before
  // the intro moved to Atlas and permanently hide the portrait for the session.
  addEventListener('profile:profile-root-settled', () => sync('profile-root-settled'));
  addEventListener('profile:atlas-ready', () => sync('atlas-ready'));
  addEventListener('profile:intro-completed', () => sync('intro-completed'));
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
    restoreEntryMaterial,
    snapshot: () => ({ retired, openingEntryAtlas: openingEntryAtlas(), stored: (() => {
      try { return sessionStorage.getItem(STORAGE_KEY) === 'true'; } catch (_) { return false; }
    })() })
  });

  boot();
})();
