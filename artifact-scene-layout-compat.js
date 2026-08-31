(() => {
  const boot = () => {
    const composer = window.ProfileSceneComposer;
    const runtime = window.ProfileArtifactScenes;
    if (!composer || !runtime || window.ProfileArtifactSceneLayout) return false;

    const stableLanes = new Map();
    const stabiliseRenderedLanes = () => {
      const composition = composer.snapshot();
      const byId = new Map(composition.assignments.map(item => [item.id, item]));
      runtime.bindings.forEach(binding => {
        const root = runtime.layer.querySelector(`[data-artifact-scene="${CSS.escape(binding.id)}"]`);
        const assignment = byId.get(`artifact-scene:${binding.id}`);
        if (!root || root.hidden || assignment?.zone !== 'side-stage' || !assignment.side) return;
        const key = `${composition.route}|${binding.id}|${assignment.side}`;
        const box = root.getBoundingClientRect();
        if (!box.width && !box.height) return;
        const previous = stableLanes.get(key);
        if (!previous) {
          stableLanes.set(key, { left: box.left });
          return;
        }

        const delta = previous.left - box.left;
        if (Math.abs(delta) <= .5) return;
        const property = assignment.side === 'left' ? 'left' : 'right';
        const current = Number.parseFloat(getComputedStyle(root)[property]);
        if (!Number.isFinite(current)) return;
        const next = assignment.side === 'left' ? current + delta : current - delta;
        root.style.setProperty(property, `${Math.round(next)}px`, 'important');
        root.dataset.artifactLaneStabilized = 'true';
      });
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

    // SceneComposer owns the semantic side assignment. Artifact emergence owns
    // the visual cluster inside that lane. Once a route has resolved a lane,
    // opening or dismissing its inspector must not make the cluster jump merely
    // because the graph corridor became wider again.
    window.addEventListener('profile:scene-composition', stabiliseRenderedLanes);
    window.addEventListener('resize', () => stableLanes.clear());

    // Compatibility exposes the old public facade only. Route ownership stays
    // in SceneManager; lazy artifact registration merely asks the composer to
    // reconcile the already-committed scene state.
    requestAnimationFrame(() => {
      composer.compose('artifact-layout-ready');
      stabiliseRenderedLanes();
    });
    return true;
  };

  if (!boot()) {
    window.addEventListener('profile:scene-composer-ready', boot);
    window.addEventListener('profile:artifact-scenes-ready', boot);
  }
})();
