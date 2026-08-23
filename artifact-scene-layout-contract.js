(() => {
  if (window.ProfileArtifactSceneLayout || window.__profileArtifactSceneLayoutBooting) return;
  window.__profileArtifactSceneLayoutBooting = true;

  const ensureStyles = () => {
    if (document.querySelector('link[data-profile-artifact-layout-style]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'artifact-scenes-layout.css';
    link.setAttribute('data-profile-artifact-layout-style', 'true');
    document.head.appendChild(link);
  };

  const boot = () => {
    const scene = window.ProfileScene;
    const runtime = window.ProfileArtifactScenes;
    if (!scene?.manager || !runtime?.layer || !Array.isArray(runtime.bindings)) {
      window.__profileArtifactSceneLayoutBooting = false;
      return;
    }
    if (window.ProfileArtifactSceneLayout) return;

    const canvas = document.querySelector('.scene-canvas');
    const detail = document.querySelector('#site-detail-panel');
    if (!canvas) {
      window.__profileArtifactSceneLayoutBooting = false;
      return;
    }

    const normaliseRoute = value =>
      (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';

    const targetForRoute = (binding, routeValue) => {
      const route = normaliseRoute(routeValue);
      return (binding.targets || []).find(target => {
        const value = normaliseRoute(target.route);
        return target.match === 'prefix'
          ? route === value || route.startsWith(`${value}/`)
          : route === value;
      }) || null;
    };

    const opposite = side => side === 'left' ? 'right' : 'left';

    const inspectorLane = () => {
      if (!detail || detail.hidden || !detail.classList.contains('is-open')) return null;
      const detailRect = detail.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      if (detailRect.width < 2 || detailRect.height < 2 || canvasRect.width < 2) return null;
      const detailCenter = detailRect.left + detailRect.width / 2;
      const canvasCenter = canvasRect.left + canvasRect.width / 2;
      return detailCenter >= canvasCenter ? 'right' : 'left';
    };

    const applyPlacement = (binding, root, route) => {
      const target = targetForRoute(binding, route);
      if (!target || !root || root.hidden) return false;

      const preferred = target.side || 'right';
      root.dataset.artifactPreferredSide = preferred;

      if (scene.manager.variant === 'mobile') {
        root.dataset.artifactSide = preferred;
        delete root.dataset.artifactCollisionAdjusted;
        return false;
      }

      const occupiedLane = inspectorLane();
      const effective = occupiedLane === preferred ? opposite(preferred) : preferred;
      const changed = root.dataset.artifactSide !== effective;
      root.dataset.artifactSide = effective;

      if (effective !== preferred) root.dataset.artifactCollisionAdjusted = 'inspector-lane';
      else delete root.dataset.artifactCollisionAdjusted;

      return changed;
    };

    const refresh = reason => {
      const route = normaliseRoute(document.body.dataset.graphRoute || location.hash);
      let changed = false;
      runtime.bindings.forEach(binding => {
        const root = runtime.layer.querySelector(`[data-artifact-scene="${CSS.escape(binding.id)}"]`);
        if (!root || root.hidden) return;
        changed = applyPlacement(binding, root, route) || changed;
      });
      if (changed) {
        window.dispatchEvent(new CustomEvent('profile:artifact-layout', {
          detail: { reason, route, inspectorLane: inspectorLane() }
        }));
      }
      return changed;
    };

    let frame = 0;
    const schedule = reason => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        refresh(reason);
      });
    };

    if (detail) {
      const detailObserver = new MutationObserver(() => schedule('detail-panel'));
      detailObserver.observe(detail, {
        attributes: true,
        attributeFilter: ['hidden', 'class']
      });
    }

    const visibilityObserver = new MutationObserver(mutations => {
      if (mutations.some(mutation =>
        mutation.type === 'attributes' &&
        (mutation.attributeName === 'hidden' || mutation.attributeName === 'data-scene-visible')
      )) schedule('artifact-visibility');
    });
    visibilityObserver.observe(runtime.layer, {
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden', 'data-scene-visible']
    });

    window.addEventListener('profile:scene-state', () => schedule('scene-state'));
    window.addEventListener('resize', () => schedule('resize'));

    const snapshot = () => ({
      route: normaliseRoute(document.body.dataset.graphRoute || location.hash),
      inspectorLane: inspectorLane(),
      placements: runtime.bindings.map(binding => {
        const root = runtime.layer.querySelector(`[data-artifact-scene="${CSS.escape(binding.id)}"]`);
        return {
          id: binding.id,
          visible: Boolean(root && !root.hidden),
          preferredSide: root?.dataset.artifactPreferredSide || null,
          side: root?.dataset.artifactSide || null,
          collisionAdjusted: root?.dataset.artifactCollisionAdjusted || null
        };
      })
    });

    window.ProfileArtifactSceneLayout = Object.freeze({ refresh, snapshot });
    window.__profileArtifactSceneLayoutBooting = false;
    requestAnimationFrame(() => requestAnimationFrame(() => refresh('boot')));
  };

  ensureStyles();
  if (window.ProfileArtifactScenes) boot();
  else window.addEventListener('profile:artifact-scenes-ready', boot, { once: true });
})();
