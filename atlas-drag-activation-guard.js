(() => {
  if (window.ProfileAtlasDragActivationGuard) return;

  let gesture = null;
  let suppressUntil = 0;
  const inAtlas = () => document.body?.dataset.graphMode === 'atlas';
  const inGraph = target => Boolean(target?.closest?.('#site-graph .site-graph-svg'));
  const selectedNodeId = () =>
    document.querySelector('#site-graph .site-graph-node.is-previewed[data-node-id]')?.dataset.nodeId || null;

  const restoreSelection = nodeId => {
    if (!nodeId || !inAtlas()) return false;
    const detail = document.querySelector('#site-detail-panel');
    if (!detail || detail.hidden) return false;
    const node = [...document.querySelectorAll(`#site-graph .site-graph-node[data-node-id="${CSS.escape(nodeId)}"]`)]
      .find(element => !element.closest('.v9-transition-overlay'));
    if (!node) return false;
    document.querySelectorAll('#site-graph .site-graph-node.is-previewed[data-node-id]')
      .forEach(element => {
        if (element !== node) element.classList.remove('is-previewed');
      });
    node.classList.add('is-previewed');
    window.ProfileAtlasLOD?.applyLOD?.();
    return true;
  };

  window.addEventListener('pointerdown', event => {
    if (!inAtlas() || event.button !== 0 || !inGraph(event.target)) return;
    gesture = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      selectedNodeId: selectedNodeId()
    };
  }, true);

  window.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (Math.abs(event.clientX - gesture.x) + Math.abs(event.clientY - gesture.y) > 4) {
      gesture.moved = true;
    }
  }, true);

  const finish = event => {
    if (!gesture || (event.pointerId != null && event.pointerId !== gesture.pointerId)) return;
    const completed = gesture;
    if (completed.moved) {
      suppressUntil = performance.now() + 320;
      requestAnimationFrame(() => restoreSelection(completed.selectedNodeId));
    }
    gesture = null;
  };
  window.addEventListener('pointerup', finish, true);
  window.addEventListener('pointercancel', finish, true);

  window.addEventListener('click', event => {
    if (!inAtlas() || performance.now() >= suppressUntil || !inGraph(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  window.ProfileAtlasDragActivationGuard = Object.freeze({
    isSuppressed: () => performance.now() < suppressUntil,
    snapshot: () => ({
      active: Boolean(gesture),
      selectedNodeId: gesture?.selectedNodeId || null,
      suppressUntil,
      suppressed: performance.now() < suppressUntil
    })
  });
})();
