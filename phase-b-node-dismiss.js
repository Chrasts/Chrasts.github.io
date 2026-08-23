(() => {
  if (window.ProfilePhaseBNodeDismiss) return;

  const detail = document.querySelector('#site-detail-panel');
  if (!detail) return;

  const isOpen = () => !detail.hidden && detail.classList.contains('is-open');
  const dismiss = () => detail.querySelector('.detail-close')?.click();

  document.addEventListener('pointerdown', event => {
    if (!isOpen()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (detail.contains(target)) return;

    /* Graph nodes retain their own click semantics. A click on another node may
       replace the inspector, while a second click in Atlas may centre/zoom it. */
    if (target.closest('#site-graph .site-graph-node')) return;

    dismiss();
  }, true);

  window.ProfilePhaseBNodeDismiss = Object.freeze({
    dismiss,
    snapshot: () => ({ open: isOpen() })
  });
})();