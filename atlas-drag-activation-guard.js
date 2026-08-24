(() => {
  if (window.ProfileAtlasDragActivationGuard) return;

  let gesture = null;
  let suppressUntil = 0;
  const inAtlas = () => document.body?.dataset.graphMode === 'atlas';
  const inGraph = target => Boolean(target?.closest?.('#site-graph .site-graph-svg'));

  window.addEventListener('pointerdown', event => {
    if (!inAtlas() || event.button !== 0 || !inGraph(event.target)) return;
    gesture = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false
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
    if (gesture.moved) suppressUntil = performance.now() + 320;
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
    snapshot: () => ({ active: Boolean(gesture), suppressUntil, suppressed: performance.now() < suppressUntil })
  });
})();
