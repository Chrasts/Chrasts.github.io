(() => {
  if (window.ProfilePhaseBNodeDismiss) return;

  const detail = document.querySelector('#site-detail-panel');
  if (!detail) return;

  const isOpen = () => !detail.hidden && detail.classList.contains('is-open');
  const dismiss = () => {
    if (!isOpen()) return;

    /* The graph's Escape path is the canonical deactivation path: in Atlas it
       clears the pinned node and highlight before closing the inspector, while
       local focus views simply close the detail. Reusing that path prevents the
       selected-node synchroniser from immediately reopening an outside-dismissed
       inspector. */
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      bubbles: true,
      cancelable: true
    }));
  };

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