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

    /* Graph nodes retain their own selection/navigation semantics. Any other
       click in the current node view invokes exactly the same close control the
       user sees in the inspector. */
    if (target.closest('#site-graph .site-graph-node')) return;
    dismiss();
  });

  window.ProfileNodeDetailDismiss = Object.freeze({
    dismiss,
    snapshot: () => ({ open: isOpen() })
  });
})();
