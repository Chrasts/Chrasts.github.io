(() => {
  if (window.ProfileIntroEarlyRootEntry) return;

  const ROOT_ID = window.SITE_DATA?.graph?.rootId || 'stepan-chrast';
  const EARLY_ENTRY_LEAD_MS = 500;
  let activationTimer = 0;
  let positionFrame = 0;
  let button = null;
  let active = false;
  let entering = false;
  let targetAt = null;

  const introSnapshot = () => window.ProfileIntro?.snapshot?.() || null;
  const rootHit = () => document.querySelector(
    `#site-graph .site-graph-node[data-node-id="${CSS.escape(ROOT_ID)}"] > .site-graph-hit`
  );

  const syncPosition = () => {
    positionFrame = 0;
    if (!active || !button?.isConnected) return;
    const hit = rootHit();
    const bounds = hit?.getBoundingClientRect?.();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
      positionFrame = requestAnimationFrame(syncPosition);
      return;
    }
    button.style.left = `${bounds.left}px`;
    button.style.top = `${bounds.top}px`;
    button.style.width = `${bounds.width}px`;
    button.style.height = `${bounds.height}px`;
    positionFrame = requestAnimationFrame(syncPosition);
  };

  const removeButton = () => {
    active = false;
    cancelAnimationFrame(positionFrame);
    positionFrame = 0;
    button?.remove();
    button = null;
  };

  const enterProfile = async event => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (entering) return;
    entering = true;
    removeButton();

    const before = introSnapshot();
    if (before?.state === 'ATLAS_REVEAL') await window.ProfileIntro?.complete?.('pointer');

    const after = introSnapshot();
    if (!after || ['ATLAS_READY', 'BYPASSED'].includes(after.state)) {
      window.ProfileRootEntryPortal?.enterProfile?.('intro-root-early');
    }
    entering = false;
  };

  const activate = () => {
    activationTimer = 0;
    if (introSnapshot()?.state !== 'ATLAS_REVEAL') return;
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'intro-root-early-entry';
      button.setAttribute('aria-label', 'Enter profile — Štěpán Chrast');
      button.title = 'Enter profile';
      Object.assign(button.style, {
        position: 'fixed',
        zIndex: '140',
        margin: '0',
        padding: '0',
        border: '0',
        borderRadius: '50%',
        background: 'transparent',
        color: 'transparent',
        cursor: 'pointer',
        appearance: 'none',
        WebkitAppearance: 'none',
        touchAction: 'manipulation'
      });
      button.addEventListener('click', enterProfile);
      document.body.appendChild(button);
    }
    active = true;
    syncPosition();
  };

  const disarm = () => {
    clearTimeout(activationTimer);
    activationTimer = 0;
    targetAt = null;
    removeButton();
  };

  const arm = snapshot => {
    disarm();
    const intro = snapshot || introSnapshot();
    if (intro?.state !== 'ATLAS_REVEAL') return false;
    const ready = Number(intro.timing?.ready);
    const startedAt = Number(intro.startedAt);
    if (!Number.isFinite(ready) || !Number.isFinite(startedAt)) return false;
    targetAt = startedAt + Math.max(0, ready - EARLY_ENTRY_LEAD_MS);
    const delay = Math.max(0, targetAt - performance.now());
    activationTimer = setTimeout(activate, delay);
    return true;
  };

  addEventListener('profile:intro-started', event => arm(event.detail));
  addEventListener('profile:intro-completed', disarm);
  addEventListener('profile:intro-interrupted', disarm);
  addEventListener('profile:intro-fallback', disarm);
  addEventListener('profile:entry-fail-open', disarm);

  window.ProfileIntroEarlyRootEntry = Object.freeze({
    leadMs: EARLY_ENTRY_LEAD_MS,
    arm: () => arm(),
    snapshot: () => ({ active, entering, targetAt, buttonPresent: Boolean(button?.isConnected) })
  });

  arm();
})();
