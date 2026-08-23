(() => {
  if (window.ProfileNodeDetailDismiss) return;

  const detail = document.querySelector('#site-detail-panel');
  if (!detail) return;

  /* `hidden` is the actual visibility state. The `is-open` class is added one
     animation frame later and must not decide whether an outside click counts. */
  const isOpen = () => !detail.hidden;

  const dismiss = () => {
    if (!isOpen()) return false;
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      bubbles: true,
      cancelable: true
    }));
    return true;
  };

  document.addEventListener('click', event => {
    if (!isOpen()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (detail.contains(target)) return;

    /* A graph-node click owns selection/navigation itself. Everything else in
       the current node view behaves like the explicit close action. */
    if (target.closest('#site-graph .site-graph-node')) return;
    dismiss();
  });

  window.ProfileNodeDetailDismiss = Object.freeze({
    dismiss,
    snapshot: () => ({ open: isOpen() })
  });
})();
