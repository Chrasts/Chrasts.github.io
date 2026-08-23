(() => {
  if (window.ProfileNodeDetailDismiss) return;

  const detail = document.querySelector('#site-detail-panel');
  if (!detail) return;

  const isOpen = () => !detail.hidden;
  let pendingDismiss = 0;

  const dismiss = () => {
    if (!isOpen()) return false;
    const close = detail.querySelector('.detail-close');
    if (!(close instanceof HTMLButtonElement)) return false;
    close.click();
    return true;
  };

  document.addEventListener('click', event => {
    if (!isOpen()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (detail.contains(target)) return;
    if (target.closest('#site-graph .site-graph-node')) return;

    /* Capture guarantees the outside gesture is observed even when a scene
       control stops bubbling. A timer, rather than a microtask, waits until the
       complete click dispatch has finished so no later handler from the same
       gesture can reopen the renderer-owned detail panel. */
    clearTimeout(pendingDismiss);
    pendingDismiss = setTimeout(() => {
      pendingDismiss = 0;
      if (isOpen()) dismiss();
    }, 0);
  }, true);

  window.ProfileNodeDetailDismiss = Object.freeze({
    dismiss,
    snapshot: () => ({ open: isOpen(), pending: Boolean(pendingDismiss) })
  });
})();
