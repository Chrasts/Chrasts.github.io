(() => {
  if (window.ProfilePhaseBObjectFocusCompat) return;

  let attached = false;
  let frame = 0;

  const attach = () => {
    if (attached || !window.ProfilePhaseBObjectFocus || !window.ProfileArtifactScenes?.viewer) return;
    attached = true;
    const viewer = window.ProfileArtifactScenes.viewer;

    const settleInterruptedClose = () => {
      const snapshot = window.ProfilePhaseBObjectFocus?.snapshot?.();
      if (
        !snapshot ||
        snapshot.lastTransition !== 'interrupted' ||
        snapshot.activeArtifactId ||
        snapshot.pendingArtifactId ||
        (viewer.hidden && !viewer.classList.contains('is-open'))
      ) return;

      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        const latest = window.ProfilePhaseBObjectFocus?.snapshot?.();
        if (
          !latest ||
          latest.lastTransition !== 'interrupted' ||
          latest.activeArtifactId ||
          latest.pendingArtifactId
        ) return;

        /* The legacy viewer schedules its opening class one frame after content
           setup. Escape can legitimately arrive before that callback. Close the
           stale frame deterministically so interruption never resurrects a
           viewer that the pilot has already cancelled. */
        window.ProfileArtifactScenes.closeFocus({ restoreFocus: false });
        viewer.classList.remove('is-open');
        viewer.hidden = true;
        document.body.classList.remove('has-artifact-focus', 'has-phase-b-object-focus');
      });
    };

    new MutationObserver(settleInterruptedClose).observe(viewer, {
      attributes: true,
      attributeFilter: ['class', 'hidden']
    });

    settleInterruptedClose();
  };

  window.addEventListener('profile:artifact-scenes-ready', attach);
  attach();

  window.ProfilePhaseBObjectFocusCompat = Object.freeze({
    attach,
    snapshot: () => ({ attached })
  });
})();
