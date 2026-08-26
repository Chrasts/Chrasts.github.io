(() => {
  if (window.ProfileObjectFocusCertificateAdapter) return;

  let attached = false;

  const stack = () => document.querySelector('.phase8-certificate-stack');
  const inspector = () => document.querySelector('.phase8-certificate-inspector');
  const root = () => document.querySelector('[data-phase8-object="certificate-stack"]');
  const currentRoute = () => (document.body.dataset.graphRoute || location.hash || 'overview')
    .replace(/^#/, '')
    .replace(/^\/+|\/+$/g, '');

  const syncStates = () => {
    stack()?.querySelectorAll('.phase8-certificate-paper[data-artifact-id]').forEach(paper => {
      const focused = window.ProfileObjectFocus?.snapshot?.().activeArtifactId === paper.dataset.artifactId;
      paper.dataset.objectFocusState = focused
        ? 'inspect'
        : paper.classList.contains('is-active') ? 'active' : 'ambient';
    });
  };

  const activePaper = () => stack()?.querySelector('.phase8-certificate-paper.is-active[data-artifact-id]') || null;

  const openActive = () => {
    const source = activePaper();
    const sceneRoot = root();
    if (!source || !sceneRoot || !window.ProfileObjectFocus) return false;
    return window.ProfileObjectFocus.open({
      source,
      artifactId: source.dataset.artifactId,
      owner: 'certificate',
      ownerValid: () => {
        const route = currentRoute();
        return route === 'education/credentials' || route.startsWith('education/credentials/');
      }
    });
  };

  const ensureInspectAction = () => {
    const actions = inspector()?.querySelector('.phase8-actions');
    const source = activePaper();
    if (!actions || !source || actions.querySelector('[data-object-focus-certificate]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'phase8-route-link object-focus-certificate-action';
    button.dataset.objectFocusCertificate = 'true';
    button.textContent = 'Inspect certificate';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      openActive();
    });
    actions.prepend(button);
  };

  const handleCertificateClick = event => {
    const paper = event.target.closest?.('.phase8-certificate-paper[data-artifact-id]');
    if (!paper) return;
    const wasActive = paper.classList.contains('is-active');
    if (!wasActive) {
      requestAnimationFrame(() => {
        syncStates();
        ensureInspectAction();
      });
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    openActive();
  };

  const attach = () => {
    if (attached || !window.ProfilePhase8 || !window.ProfileObjectFocus || !stack()) return false;
    attached = true;
    document.addEventListener('click', handleCertificateClick, true);
    ensureInspectAction();
    syncStates();
    return true;
  };

  window.addEventListener('profile:phase8-ready', attach);
  window.addEventListener('profile:object-focus-ready', attach);
  window.addEventListener('profile:scene-state', () => requestAnimationFrame(syncStates));
  window.addEventListener('profile:graph-render-settled', () => requestAnimationFrame(() => {
    ensureInspectAction();
    syncStates();
  }));
  attach();

  window.ProfileObjectFocusCertificateAdapter = Object.freeze({
    attach,
    openActive,
    sync: syncStates,
    snapshot: () => ({ attached, activeArtifactId: activePaper()?.dataset.artifactId || null })
  });
})();
