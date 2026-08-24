(() => {
  if (!window.ProfileIntro?.__phaseH) return;

  let lastReason = null;
  let focusedAfterKeyboard = false;

  addEventListener('profile:intro-completed', event => {
    lastReason = event.detail?.reason || null;
    if (lastReason !== 'keyboard') return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const trigger = document.querySelector('[data-root-activate]');
      if (!trigger || trigger.disabled) return;
      trigger.focus?.({ preventScroll: true });
      focusedAfterKeyboard = document.activeElement === trigger;
    }));
  });

  window.ProfileIntroStageConsistency = Object.freeze({
    active: false,
    retired: true,
    snapshot: () => ({
      installed: true,
      reportedStage: window.ProfileIntro.snapshot().stage,
      phaseH: true,
      lastReason,
      focusedAfterKeyboard
    })
  });
})();
