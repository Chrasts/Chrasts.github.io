(() => {
  const proto = window.SVGSVGElement?.prototype;
  if (!proto || proto.__profileAtlasPointerCaptureHotfix) return;

  const originalSet = proto.setPointerCapture;
  const originalRelease = proto.releasePointerCapture;
  const nativeMatchMedia = window.__GRAPH_V6_REAL_MATCH_MEDIA__ || window.matchMedia.bind(window);
  const desktop = nativeMatchMedia('(min-width: 901px)');
  const reducedQuery = nativeMatchMedia('(prefers-reduced-motion: reduce)');

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

  const cssReduced = () => {
    try {
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--profile-reduced-motion-probe').trim() === '1';
    } catch (_) {
      return false;
    }
  };
  const reducedMatches = () => Boolean(
    window.__PROFILE_INTRO_BOOTSTRAP__?.reducedMotion ||
    window.__PROFILE_REDUCED_MOTION__ ||
    reducedQuery.matches ||
    cssReduced()
  );
  window.__PROFILE_REDUCED_MOTION__ = reducedMatches();

  /* Phase 7's inspector observer decorates the same action node it observes.
     Ignore a same-value textContent write only for that node so the observer
     cannot generate an endless childList feedback loop. */
  const textContentDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
  if (textContentDescriptor?.get && textContentDescriptor?.set && !Node.prototype.__profileAtlasTextGuard) {
    Object.defineProperty(Node.prototype, '__profileAtlasTextGuard', {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false
    });
    Object.defineProperty(Node.prototype, 'textContent', {
      configurable: textContentDescriptor.configurable,
      enumerable: textContentDescriptor.enumerable,
      get: textContentDescriptor.get,
      set(value) {
        if (
          this instanceof Element &&
          this.matches?.('#site-detail-panel .atlas-open-local') &&
          textContentDescriptor.get.call(this) === String(value ?? '')
        ) return;
        textContentDescriptor.set.call(this, value);
      }
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

  const baseCamera = () => document.querySelector('#site-graph .site-graph-svg > g:not(.v9-transition-overlay)');
  const exclusiveTransitionOwner = () => Boolean(
    document.body?.classList.contains('is-atlas-handoff') ||
    document.body?.classList.contains('is-crosslink-travelling')
  );

  const setImportant = (element, name, value) => {
    if (!element) return false;
    if (element.style.getPropertyValue(name) === value && element.style.getPropertyPriority(name) === 'important') return false;
    element.style.setProperty(name, value, 'important');
    return true;
  };
  const removeInline = (element, name) => {
    if (!element?.style.getPropertyValue(name)) return false;
    element.style.removeProperty(name);
    return true;
  };

  const keepExclusiveBaseVisible = () => {
    const camera = baseCamera();
    if (!camera) return false;
    let changed = false;
    if (exclusiveTransitionOwner()) {
      if (camera.dataset.exclusiveVisibilityGuard !== 'true') {
        camera.dataset.exclusiveVisibilityGuard = 'true';
        changed = true;
      }
      changed = setImportant(camera, 'opacity', '1') || changed;
      changed = setImportant(camera, 'visibility', 'visible') || changed;
      return changed;
    }
    if (camera.dataset.exclusiveVisibilityGuard === 'true') {
      delete camera.dataset.exclusiveVisibilityGuard;
      changed = true;
      changed = removeInline(camera, 'opacity') || changed;
      changed = removeInline(camera, 'visibility') || changed;
    }
    return changed;
  };

  const cancelConcurrentV9 = () => {
    if (!exclusiveTransitionOwner()) return false;
    let changed = false;
    document.querySelectorAll('#site-graph .v9-transition-overlay').forEach(element => {
      element.remove();
      changed = true;
    });
    if (document.body.classList.contains('is-v9-transitioning')) {
      document.body.classList.remove('is-v9-transitioning');
      changed = true;
    }
    if (window.__GRAPH_V6_FORCE_SNAP__) {
      try { window.__GRAPH_V6_FORCE_SNAP__ = false; } catch (_) {}
      changed = true;
    }
    return keepExclusiveBaseVisible() || changed;
  };

  const keepReducedBaseVisible = target => {
    const camera = target?.matches?.('#site-graph .site-graph-svg > g:not(.v9-transition-overlay)')
      ? target
      : baseCamera();
    if (!camera) return false;
    if (exclusiveTransitionOwner()) return keepExclusiveBaseVisible();

    let changed = false;
    if (reducedMatches() && document.body?.classList.contains('is-v9-transitioning')) {
      if (camera.dataset.reducedVisibilityGuard !== 'true') {
        camera.dataset.reducedVisibilityGuard = 'true';
        changed = true;
      }
      changed = setImportant(camera, 'opacity', '1') || changed;
      changed = setImportant(camera, 'visibility', 'visible') || changed;
      return changed;
    }
    if (camera.dataset.reducedVisibilityGuard === 'true') {
      delete camera.dataset.reducedVisibilityGuard;
      changed = true;
      changed = removeInline(camera, 'opacity') || changed;
      changed = removeInline(camera, 'visibility') || changed;
    }
    return changed;
  };

  let cameraGuard = false;
  const expectedCameraTransform = () => {
    const state = window.ProfileAtlasLOD?.snapshot?.()?.camera;
    if (!state || !Number.isFinite(state.x) || !Number.isFinite(state.y) || !Number.isFinite(state.scale)) return null;
    return `translate(${state.x.toFixed(2)} ${state.y.toFixed(2)}) scale(${state.scale.toFixed(4)})`;
  };
  const guardAtlasCamera = target => {
    if (cameraGuard || !desktop.matches || document.body?.dataset.graphMode !== 'atlas' || !window.ProfileAtlasLOD) return false;
    const camera = target?.matches?.('#site-graph .site-graph-svg > g:not(.v9-transition-overlay)')
      ? target
      : baseCamera();
    const expected = expectedCameraTransform();
    if (!camera || !expected || camera.getAttribute('transform') === expected) return false;
    cameraGuard = true;
    try {
      camera.setAttribute('transform', expected);
    } finally {
      cameraGuard = false;
    }
    return true;
  };

  const graphRoot = document.querySelector('#site-graph');
  if (graphRoot) {
    new MutationObserver(mutations => {
      const exclusive = exclusiveTransitionOwner();
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          if (exclusive) cancelConcurrentV9();
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
    idempotentMutationGuards: true,
    inspectorTextGuard: true,
    reducedMotion: reducedMatches(),
    reason: 'Keep SVG nodes clickable without mutation feedback loops and keep transition ownership disjoint.'
  });
})();
