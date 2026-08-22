(() => {
  const proto = window.SVGSVGElement?.prototype;
  if (!proto || proto.__profileAtlasPointerCaptureHotfix) return;

  const originalSet = proto.setPointerCapture;
  const originalRelease = proto.releasePointerCapture;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';

  Object.defineProperty(proto, '__profileAtlasPointerCaptureHotfix', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });

  proto.setPointerCapture = function(pointerId) {
    if (
      document.body?.dataset.graphMode === 'atlas' &&
      this.matches?.('#site-graph .site-graph-svg')
    ) {
      return;
    }
    return originalSet?.call(this, pointerId);
  };

  proto.releasePointerCapture = function(pointerId) {
    if (
      document.body?.dataset.graphMode === 'atlas' &&
      this.matches?.('#site-graph .site-graph-svg')
    ) {
      return;
    }
    return originalRelease?.call(this, pointerId);
  };

  /*
   * Atlas boundary ownership must be established before graph-transitions-v6
   * sees the event. intro-fixes-v3 owns the actual visual handoff, but it is
   * loaded later in the dynamic script chain. Reserve the boundary here on
   * window-capture so V9 can never prepare an overlapping transition.
   */
  let replayingBoundary = false;
  const routeFromControl = target => {
    const control = target?.closest?.('[data-route]');
    if (!control) return null;
    return normaliseRoute(control.dataset.route || control.getAttribute('href'));
  };
  const isAtlasBoundary = targetRoute => {
    if (!targetRoute || document.querySelector('.profile-intro-overlay')) return false;
    const currentRoute = normaliseRoute(document.body?.dataset.graphRoute || location.hash);
    if (targetRoute === currentRoute) return false;
    return targetRoute === 'atlas' || document.body?.dataset.graphMode === 'atlas';
  };
  const replayWhenReady = control => {
    if (!control || replayingBoundary) return;
    replayingBoundary = true;
    const started = performance.now();
    const poll = () => {
      if (window.ProfileIntroFixesV3?.snapshot) {
        replayingBoundary = false;
        control.click();
        return;
      }
      if (performance.now() - started > 1800) {
        replayingBoundary = false;
        return;
      }
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  };

  addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const route = routeFromControl(event.target);
    if (!isAtlasBoundary(route)) return;

    // V9's document-capture handler explicitly ignores defaultPrevented events.
    event.preventDefault();
    if (window.ProfileIntroFixesV3?.snapshot) return;

    const control = event.target.closest?.('[data-route]');
    event.stopImmediatePropagation();
    replayWhenReady(control);
  }, true);

  addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const route = routeFromControl(event.target);
    if (!isAtlasBoundary(route)) return;

    event.preventDefault();
    if (window.ProfileIntroFixesV3?.snapshot) return;

    const control = event.target.closest?.('[data-route]');
    event.stopImmediatePropagation();
    replayWhenReady(control);
  }, true);

  /*
   * V9 hides its live camera with an inline opacity during animated handoff.
   * In true reduced-motion mode the overlay is intentionally absent, so that
   * inline write would create a blank frame if graph-v9.css has not finished
   * loading yet. Remove such writes synchronously in the mutation checkpoint.
   */
  const keepReducedBaseVisible = target => {
    if (!reduced.matches || !document.body?.classList.contains('is-v9-transitioning')) return;
    const camera = target?.matches?.('#site-graph .site-graph-svg > g:not(.v9-transition-overlay)')
      ? target
      : document.querySelector('#site-graph .site-graph-svg > g:not(.v9-transition-overlay)');
    if (!camera) return;
    if (camera.style.opacity === '0') camera.style.removeProperty('opacity');
    if (camera.style.visibility === 'hidden') camera.style.removeProperty('visibility');
  };

  const graphRoot = document.querySelector('#site-graph');
  if (graphRoot) {
    new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          keepReducedBaseVisible(mutation.target);
        }
      }
    }).observe(graphRoot, {
      subtree: true,
      attributes: true,
      attributeFilter: ['style']
    });
  }
  if (document.body) {
    new MutationObserver(() => keepReducedBaseVisible()).observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  window.ProfileAtlasPointerHotfix = Object.freeze({
    active: true,
    boundaryGuard: true,
    reducedMotionGuard: true,
    reason: 'Preserve Atlas pointer targets and keep Atlas/V9 transition ownership disjoint.'
  });
})();
