(() => {
  const boot = () => {
    const composer = window.ProfileSceneComposer;
    const runtime = window.ProfileArtifactScenes;
    const manager = window.ProfileScene?.manager;
    if (!composer || !runtime || !manager || window.ProfileArtifactSceneLayout) return false;

    const normaliseRoute = value =>
      (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';

    const syncCommittedRoute = reason => {
      const route = normaliseRoute(document.body.dataset.graphRoute || location.hash);
      const current = manager.snapshot?.().graphState || {};
      const mode = document.body.dataset.graphMode || current.mode || 'overview';
      const workProjectId = route.match(/^work\/project\/([^/]+)$/)?.[1] || null;

      if (current.route === route && current.mode === mode && current.workProjectId === workProjectId) {
        manager.scheduleRefresh(reason);
        return;
      }

      manager.setGraphState({ route, mode, workProjectId }, { reason });
    };

    const snapshot = () => {
      const composition = composer.snapshot();
      const byId = new Map(composition.assignments.map(item => [item.id, item]));
      return {
        deprecated: true,
        route: composition.route,
        inspectorLane: byId.get('detail-panel')?.side || null,
        placements: runtime.bindings.map(binding => {
          const root = runtime.layer.querySelector(`[data-artifact-scene="${CSS.escape(binding.id)}"]`);
          const assignment = byId.get(`artifact-scene:${binding.id}`);
          return {
            id: binding.id,
            visible: Boolean(root && !root.hidden),
            preferredSide: assignment?.preferredSide || root?.dataset.artifactPreferredSide || null,
            side: assignment?.side || root?.dataset.artifactSide || null,
            collisionAdjusted: assignment?.collisionAdjusted || null
          };
        })
      };
    };

    window.ProfileArtifactSceneLayout = Object.freeze({
      deprecated: true,
      refresh: reason => composer.compose(reason || 'artifact-layout-compat'),
      snapshot
    });

    // Lazy artifact code can finish after the graph transition that requested it.
    // Reconcile the SceneManager with the route already committed by the renderer
    // so Work-project artifacts cannot remain mounted against the previous route.
    requestAnimationFrame(() => syncCommittedRoute('artifact-layout-ready-route-sync'));
    window.addEventListener('profile:transition-finish', () => {
      requestAnimationFrame(() => syncCommittedRoute('artifact-transition-finish-route-sync'));
    });
    window.addEventListener('hashchange', () => {
      requestAnimationFrame(() => syncCommittedRoute('artifact-hash-route-sync'));
    });

    return true;
  };

  if (!boot()) {
    window.addEventListener('profile:scene-composer-ready', boot);
    window.addEventListener('profile:artifact-scenes-ready', boot);
  }
})();
