(() => {
  if (window.ProfileNodeDetailDismiss) return;

  const detail = document.querySelector('#site-detail-panel');
  if (!detail) return;

  const isOpen = () => !detail.hidden;
  let pendingDismiss = 0;
  let dispatchingCanonicalAtlasClear = false;

  const dismiss = () => {
    if (!isOpen()) return false;

    if (document.body.dataset.graphMode === 'atlas') {
      const map = document.querySelector('#site-graph .site-graph-svg');
      if (map) {
        dispatchingCanonicalAtlasClear = true;
        try {
          map.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          }));
        } finally {
          dispatchingCanonicalAtlasClear = false;
        }
        return true;
      }
    }

    const close = detail.querySelector('.detail-close');
    if (!(close instanceof HTMLButtonElement)) return false;
    close.click();
    return true;
  };

  document.addEventListener('click', event => {
    if (dispatchingCanonicalAtlasClear || !isOpen()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (detail.contains(target)) return;
    if (target.closest('#site-graph .site-graph-node')) return;

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
