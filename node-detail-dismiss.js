(() => {
  if (window.ProfileNodeDetailDismiss) return;

  const detail = document.querySelector('#site-detail-panel');
  if (!detail) return;

  const isOpen = () => !detail.hidden;

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

    /* Capture guarantees we see clicks even when a scene control stops
       bubbling. Defer until that click has completed, then invoke the exact
       visible close control rather than inventing a second detail state path. */
    queueMicrotask(() => {
      if (isOpen()) dismiss();
    });
  }, true);

  window.ProfileNodeDetailDismiss = Object.freeze({
    dismiss,
    snapshot: () => ({ open: isOpen() })
  });
})();
