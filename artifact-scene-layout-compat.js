(() => {
  const boot = () => {
    const composer = window.ProfileSceneComposer;
    const runtime = window.ProfileArtifactScenes;
    if (!composer || !runtime || window.ProfileArtifactSceneLayout) return false;

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

    // Compatibility exposes the old public facade only. Route ownership stays
    // in SceneManager; lazy artifact registration merely asks the composer to
    // reconcile the already-committed scene state.
    requestAnimationFrame(() => composer.compose('artifact-layout-ready'));
    return true;
  };

  if (!boot()) {
    window.addEventListener('profile:scene-composer-ready', boot);
    window.addEventListener('profile:artifact-scenes-ready', boot);
  }
})();
