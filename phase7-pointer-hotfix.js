(() => {
  const proto = window.SVGSVGElement?.prototype;
  if (!proto || proto.__profileAtlasPointerCaptureHotfix) return;

  const originalSet = proto.setPointerCapture;
  const originalRelease = proto.releasePointerCapture;
  const initialMatchMedia = window.matchMedia.bind(window);
  const reduced = initialMatchMedia('(prefers-reduced-motion: reduce)');
  const desktop = initialMatchMedia('(min-width: 901px)');
  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';

  Object.defineProperty(proto, '__profileAtlasPointerCaptureHotfix', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });

  if (!document.querySelector('style[data-profile-node-hit-guard]')) {
    const style = document.createElement('style');
    style.dataset.profileNodeHitGuard = 'true';
    style.textContent = `
      :root{--profile-reduced-motion-probe:0}
      #site-graph .site-graph-node:not(.is-atlas-lod-hidden){pointer-events:bounding-box!important}
      #site-graph .site-graph-node:not(.is-atlas-lod-hidden) .site-graph-hit{pointer-events:all!important}
      #site-graph .site-graph-node:not(.is-atlas-lod-hidden) .site-graph-label,
      #site-graph .site-graph-node:not(.is-atlas-lod-hidden) .site-graph-meta{pointer-events:visiblePainted!important;cursor:pointer}
      @media(prefers-reduced-motion:reduce){
        :root{--profile-reduced-motion-probe:1}
        body.is-v9-transitioning #site-graph .site-graph-svg > g:not(.v9-transition-overlay){opacity:1!important;visibility:visible!important}
        .v9-transition-overlay{display:none!important}
      }
    `;
    document.head.appendChild(style);
  }

  const cssReduced = (() => {
    try {
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--profile-reduced-motion-probe').trim() === '1';
    } catch (_) {
      return reduced.matches;
    }
  })();
  const reducedMatches = () => cssReduced || reduced.matches;
  window.__PROFILE_REDUCED_MOTION__ = reducedMatches();

  if (cssReduced && !reduced.matches) {
    window.matchMedia = query => {
      const result = initialMatchMedia(query);
      if (query !== '(prefers-reduced-motion: reduce)' || result.matches) return result;
      return new Proxy(result, {
        get(target, property) {
          if (property === 'matches') return true;
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        }
      });
    };
  }

  if (cssReduced && window.__PROFILE_INTRO_BOOTSTRAP__ && !window.__PROFILE_INTRO_BOOTSTRAP__.reducedMotion) {
    window.__PROFILE_INTRO_BOOTSTRAP__ = Object.freeze({
      ...window.__PROFILE_INTRO_BOOTSTRAP__,
      reducedMotion: true
    });
  }

  proto.setPointerCapture = function(pointerId) {
    if (
      document.body?.dataset.graphMode === 'atlas' &&
      this.matches?.('#site-graph .site-graph-svg')
    ) return;
    return originalSet?.call(this, pointerId);
  };

  proto.releasePointerCapture = function(pointerId) {
    if (
      document.body?.dataset.graphMode === 'atlas' &&
      this.matches?.('#site-graph .site-graph-svg')
    ) return;
    return originalRelease?.call(this, pointerId);
  };

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
  const exclusiveTransitionOwner = () =>
    document.body?.classList.contains('is-atlas-handoff') ||
    document.body?.classList.contains('is-crosslink-travelling');

  const keepExclusiveBaseVisible = () => {
    const camera = baseCamera();
    if (!camera) return;
    if (exclusiveTransitionOwner()) {
      camera.dataset.exclusiveVisibilityGuard = 'true';
      camera.style.setProperty('opacity', '1', 'important');
      camera.style.setProperty('visibility', 'visible', 'important');
      return;
    }
    if (camera.dataset.exclusiveVisibilityGuard === 'true') {
      delete camera.dataset.exclusiveVisibilityGuard;
      camera.style.removeProperty('opacity');
      camera.style.removeProperty('visibility');
    }
  };

  const cancelConcurrentV9 = () => {
    if (!exclusiveTransitionOwner()) return false;
    document.querySelectorAll('#site-graph .v9-transition-overlay').forEach(element => element.remove());
    document.body.classList.remove('is-v9-transitioning');
    try { window.__GRAPH_V6_FORCE_SNAP__ = false; } catch (_) {}
    keepExclusiveBaseVisible();
    return true;
  };

  const keepReducedBaseVisible = target => {
    const camera = target?.matches?.('#site-graph .site-graph-svg > g:not(.v9-transition-overlay)')
      ? target
      : baseCamera();
    if (!camera) return;
    if (exclusiveTransitionOwner()) {
      keepExclusiveBaseVisible();
      return;
    }
    if (reducedMatches() && document.body?.classList.contains('is-v9-transitioning')) {
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
      if (exclusiveTransitionOwner()) cancelConcurrentV9();
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && exclusiveTransitionOwner()) {
          cancelConcurrentV9();
          continue;
        }
        if (mutation.type !== 'attributes') continue;
        if (mutation.attributeName === 'style') keepReducedBaseVisible(mutation.target);
        if (mutation.attributeName === 'transform') guardAtlasCamera(mutation.target);
      }
    }).observe(graphRoot, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['style', 'transform']
    });
  }

  if (document.body) {
    new MutationObserver(() => {
      cancelConcurrentV9();
      keepExclusiveBaseVisible();
      keepReducedBaseVisible();
      guardAtlasCamera();
    }).observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-graph-mode', 'data-graph-route']
    });
  }

  addEventListener('profile:crosslink-start', () => {
    cancelConcurrentV9();
    keepExclusiveBaseVisible();
  });
  addEventListener('profile:crosslink-complete', () => {
    document.querySelectorAll('#site-graph .v9-transition-overlay').forEach(element => element.remove());
    keepExclusiveBaseVisible();
  });
  addEventListener('profile:atlas-lod-change', () => guardAtlasCamera());
  addEventListener('profile:geometry-applied', () => guardAtlasCamera());

  window.ProfileAtlasPointerHotfix = Object.freeze({
    active: true,
    boundaryGuard: true,
    reducedMotionGuard: true,
    hitTargetGuard: true,
    cameraGuard: true,
    crossLinkGuard: true,
    reducedMotion: reducedMatches(),
    reason: 'Keep SVG nodes clickable and make Atlas/cross-link/V9/camera ownership disjoint.'
  });
})();
