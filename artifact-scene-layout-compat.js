(() => {
  const boot = () => {
    const composer = window.ProfileSceneComposer;
    const runtime = window.ProfileArtifactScenes;
    const Composer = window.SceneComposer;
    if (!composer || !runtime || !Composer?.prototype || window.ProfileArtifactSceneLayout) return false;

    /* SceneComposer correctly recomputes available side-stage width whenever an
       inspector opens or closes. That width may change, but an already resolved
       artifact lane should not slide horizontally on the same route merely
       because the corridor became less constrained. Preserve the last settled
       offset when it remains valid in the current horizontal safe frame;
       ordinary containment keeps priority otherwise. */
    if (!Composer.prototype.__artifactLaneOffsetGuard) {
      Composer.prototype.__artifactLaneOffsetGuard = true;
      const originalContainAssignment = Composer.prototype.containAssignment;
      const settledOffsets = new Map();

      Composer.prototype.containAssignment = function artifactLaneContainment(assignment, context) {
        const previous = settledOffsets.get(assignment.id);
        originalContainAssignment.call(this, assignment, context);

        const eligible = Boolean(
          assignment.request?.role === 'artifact' &&
          assignment.zone === 'side-stage' &&
          context.variant !== 'mobile' &&
          previous?.route === context.route &&
          previous?.side === assignment.side &&
          Number.isFinite(previous?.offset) &&
          Number.isFinite(assignment.offset)
        );

        if (eligible && Math.abs(assignment.offset - previous.offset) > .5) {
          const property = assignment.side === 'left' ? 'left' : 'right';
          const currentOffset = assignment.offset;
          assignment.offset = previous.offset;
          assignment.element.style.setProperty(property, `${Math.round(previous.offset)}px`, 'important');

          const bounds = this.visualBounds(assignment.request);
          const corridor = assignment.corridor;
          const margin = assignment.request.viewportMargin || 0;
          const viewportFrame = {
            left: context.canvas.left + margin,
            right: context.canvas.right - margin
          };
          const boundsWidth = bounds ? Math.max(0, bounds.right - bounds.left) : Infinity;
          const horizontalFrame = bounds && corridor && boundsWidth <= corridor.width + .5
            ? corridor
            : viewportFrame;
          const horizontalSafe = Boolean(bounds &&
            bounds.left >= horizontalFrame.left - .5 &&
            bounds.right <= horizontalFrame.right + .5);

          if (!horizontalSafe) {
            assignment.offset = currentOffset;
            assignment.element.style.setProperty(property, `${Math.round(currentOffset)}px`, 'important');
          }
        }

        if (assignment.request?.role === 'artifact' && assignment.zone === 'side-stage' && Number.isFinite(assignment.offset)) {
          settledOffsets.set(assignment.id, {
            route: context.route,
            side: assignment.side,
            offset: assignment.offset
          });
        }
      };

      window.addEventListener('resize', () => settledOffsets.clear());
    }

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
