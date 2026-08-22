(() => {
  const proto = window.SVGSVGElement?.prototype;
  if (!proto || proto.__profileAtlasPointerCaptureHotfix) return;

  const originalSet = proto.setPointerCapture;
  const originalRelease = proto.releasePointerCapture;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = window.matchMedia('(min-width: 901px)');
  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';

  Object.defineProperty(proto, '__profileAtlasPointerCaptureHotfix', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });

  /*
   * SVG groups have a bounding box that includes their labels. The labels used
   * to opt out of hit testing, so the centre point chosen by Playwright (and a
   * real pointer over the text) could fall through to the root <svg>. Make the
   * visible node group itself a hit target and keep the explicit hit circle as
   * a guaranteed fallback. Hidden Atlas LOD nodes remain non-interactive.
   */
  if (!document.querySelector('style[data-profile-node-hit-guard]')) {
    const style = document.createElement('style');
    style.dataset.profileNodeHitGuard = 'true';
    style.textContent = `
      #site-graph .site-graph-node:not(.is-atlas-lod-hidden){pointer-events:bounding-box!important}
      #site-graph .site-graph-node:not(.is-atlas-lod-hidden) .site-graph-hit{pointer-events:all!important}
      #site-graph .site-graph-node:not(.is-atlas-lod-hidden) .site-graph-label,
      #site-graph .site-graph-node:not(.is-atlas-lod-hidden) .site-graph-meta{pointer-events:visiblePainted!important;cursor:pointer}
      @media(prefers-reduced-motion:reduce){
        body.is-v9-transitioning #site-graph .site-graph-svg > g:not(.v9-transition-overlay){opacity:1!important;visibility:visible!important}
        .v9-transition-overlay{display:none!important}
      }
    `;
    document.head.appendChild(style);
  }

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

  /* ----------------------------------------------------------------------
     Atlas boundary ownership
     ---------------------------------------------------------------------- */
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

  const baseCamera = () => document.querySelector('#site-graph .site-graph-svg > g:not(.v9-transition-overlay)');
  const cancelConcurrentV9 = () => {
    if (!document.body?.classList.contains('is-atlas-handoff')) return false;
    document.querySelectorAll('#site-graph .v9-transition-overlay').forEach(element => element.remove());
    const camera = baseCamera();
    camera?.style.removeProperty('opacity');
    camera?.style.removeProperty('visibility');
    document.body.classList.remove('is-v9-transitioning');
    try { window.__GRAPH_V6_FORCE_SNAP__ = false; } catch (_) {}
    return true;
  };

  /* ----------------------------------------------------------------------
     Reduced-motion live-renderer visibility
     ---------------------------------------------------------------------- */
  const keepReducedBaseVisible = target => {
    const camera = target?.matches?.('#site-graph .site-graph-svg > g:not(.v9-transition-overlay)')
      ? target
      : baseCamera();
    if (!camera) return;
    if (reduced.matches && document.body?.classList.contains('is-v9-transitioning')) {
      camera.dataset.reducedVisibilityGuard = 'true';
      camera.style.setProperty('opacity', '1', 'important');
      camera.style.setProperty('visibility', 'visible', 'important');
      return;
    }
    if (camera.dataset.reducedVisibilityGuard === 'true') {
      delete camera.dataset.reducedVisibilityGuard;
      camera.style.removeProperty('opacity');
      camera.style.removeProperty('visibility');
    }
  };

  /* ----------------------------------------------------------------------
     Phase-7 desktop camera ownership
     ----------------------------------------------------------------------
     Once ProfileAtlasLOD exists, its camera state is authoritative. A legacy
     Atlas rerender may still write transform="... scale(1)"; repair that write
     in the same mutation checkpoint instead of allowing Phase 7 to adopt it.
   */
  let cameraGuard = false;
  const expectedCameraTransform = () => {
    const snap = window.ProfileAtlasLOD?.snapshot?.();
    const state = snap?.camera;
    if (!state || !Number.isFinite(state.x) || !Number.isFinite(state.y) || !Number.isFinite(state.scale)) return null;
    return `translate(${state.x.toFixed(2)} ${state.y.toFixed(2)}) scale(${state.scale.toFixed(4)})`;
  };
  const guardAtlasCamera = target => {
    if (cameraGuard || !desktop.matches || document.body?.dataset.graphMode !== 'atlas' || !window.ProfileAtlasLOD) return;
    const camera = target?.matches?.('#site-graph .site-graph-svg > g:not(.v9-transition-overlay)')
      ? target
      : baseCamera();
    const expected = expectedCameraTransform();
    if (!camera || !expected || camera.getAttribute('transform') === expected) return;
    cameraGuard = true;
    try {
      camera.setAttribute('transform', expected);
    } finally {
      cameraGuard = false;
    }
  };

  const graphRoot = document.querySelector('#site-graph');
  if (graphRoot) {
    new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type !== 'attributes') continue;
        if (mutation.attributeName === 'style') keepReducedBaseVisible(mutation.target);
        if (mutation.attributeName === 'transform') guardAtlasCamera(mutation.target);
      }
    }).observe(graphRoot, {
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'transform']
    });
  }

  if (document.body) {
    new MutationObserver(() => {
      cancelConcurrentV9();
      keepReducedBaseVisible();
      guardAtlasCamera();
    }).observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-graph-mode', 'data-graph-route']
    });
  }

  addEventListener('profile:atlas-lod-change', () => guardAtlasCamera());
  addEventListener('profile:geometry-applied', () => guardAtlasCamera());
  addEventListener('profile:crosslink-complete', () => {
    if (!document.body?.classList.contains('is-v9-transitioning')) {
      document.querySelectorAll('#site-graph .v9-transition-overlay').forEach(element => element.remove());
    }
  });

  window.ProfileAtlasPointerHotfix = Object.freeze({
    active: true,
    boundaryGuard: true,
    reducedMotionGuard: true,
    hitTargetGuard: true,
    cameraGuard: true,
    reason: 'Keep SVG nodes clickable and make Atlas/V9/camera ownership disjoint.'
  });
})();
