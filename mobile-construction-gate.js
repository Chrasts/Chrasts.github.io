(() => {
  const html = document.documentElement;
  if (html.dataset.mobileGate !== 'active') return;

  const gate = document.getElementById('mobile-construction-gate');
  if (!gate) return;

  const underlying = [
    document.querySelector('.skip-link'),
    document.querySelector('.site-header'),
    document.querySelector('#main-content')
  ].filter(Boolean);

  underlying.forEach(node => {
    try { node.inert = true; } catch (_) {}
  });

  gate.hidden = false;
  gate.tabIndex = -1;
  requestAnimationFrame(() => gate.focus({ preventScroll: true }));
})();
