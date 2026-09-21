(() => {
  const html = document.documentElement;
  if (html.dataset.mobileGate !== 'active') return;

  const gate = document.getElementById('mobile-construction-gate');
  if (!gate) return;

  const quick = gate.querySelector('.mobile-gate-quick');
  const preview = gate.querySelector('.mobile-gate-preview');
  const status = gate.querySelector('.mobile-gate-status');
  const underlying = [
    document.querySelector('.skip-link'),
    document.querySelector('.site-header'),
    document.querySelector('#main-content')
  ].filter(Boolean);

  const setUnderlyingInert = inert => {
    underlying.forEach(element => {
      try { element.inert = inert; } catch (_) {}
    });
  };

  const restoreGateIsolation = () => {
    if (html.dataset.mobileGate !== 'active') return;
    setUnderlyingInert(true);
    try { gate.focus({ preventScroll: true }); } catch (_) {}
  };

  const waitForQuickOverview = (timeout = 7000) => new Promise(resolve => {
    const started = performance.now();
    const poll = () => {
      if (window.ProfileRootOverview?.openQuickOverview) {
        resolve(window.ProfileRootOverview);
        return;
      }
      if (performance.now() - started >= timeout) {
        resolve(null);
        return;
      }
      requestAnimationFrame(poll);
    };
    poll();
  });

  gate.hidden = false;
  gate.tabIndex = -1;
  setUnderlyingInert(true);
  requestAnimationFrame(() => gate.focus({ preventScroll: true }));

  quick?.addEventListener('click', async () => {
    quick.disabled = true;
    if (status) status.textContent = 'Opening profile summary…';

    const api = await waitForQuickOverview();
    if (!api) {
      quick.disabled = false;
      if (status) status.textContent = 'The summary is still loading. Please try again.';
      return;
    }

    // The Quick Overview dialog is mounted inside #main-content. Release the
    // inert subtree only while the native modal owns focus.
    setUnderlyingInert(false);
    const opened = api.openQuickOverview('mobile-construction-gate');
    quick.disabled = false;

    if (!opened) {
      restoreGateIsolation();
      if (status) status.textContent = 'The summary is not ready yet. Please try again.';
      return;
    }

    if (status) status.textContent = '';
    const dialog = document.querySelector('.quick-overview-dialog');
    dialog?.addEventListener('close', restoreGateIsolation, { once: true });
  });

  preview?.addEventListener('click', () => {
    try {
      sessionStorage.setItem('mobileConstructionPreview', 'true');
      sessionStorage.setItem('profileIntroSeen', 'true');
    } catch (_) {}
    html.dataset.mobileGate = 'preview';
    setUnderlyingInert(false);
    location.reload();
  });
})();
