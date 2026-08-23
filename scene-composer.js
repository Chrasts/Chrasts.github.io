(() => {
  const scene = window.ProfileScene;
  if (!scene?.manager || !scene?.registry || window.ProfileSceneComposer) return;

  const mobileQuery = matchMedia(window.ProfileScene?.MOBILE_QUERY || '(max-width: 900px)');
  const assignments = new Map();
  const zones = Object.freeze({
    'side-stage': Object.freeze({ axis: 'vertical', sides: ['left', 'right'], gap: 18, top: 74 }),
    inspector: Object.freeze({ axis: 'fixed', sides: ['right'] }),
    'lower-rail': Object.freeze({ axis: 'horizontal' }),
    'mobile-tray': Object.freeze({ axis: 'stack' }),
    unmanaged: Object.freeze({ axis: 'none' })
  });

  const asNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const opposite = side => side === 'left' ? 'right' : 'left';

  class SceneComposer {
    constructor() {
      this.frame = 0;
      this.sequence = 0;
      this.lastReason = 'boot';
      this.canvas = document.querySelector('.scene-canvas');
      this.observer = null;

      scene.registry.onChange(() => this.schedule('registry'));
      window.addEventListener('profile:scene-state', () => this.schedule('scene-state'));
      window.addEventListener('profile:transition-finish', () => this.schedule('transition-finish'));
      window.addEventListener('profile:artifact-scenes-ready', () => this.schedule('artifact-scenes-ready'));
      window.addEventListener('profile:phase8-ready', () => this.schedule('phase8-ready'));
      window.addEventListener('resize', () => this.schedule('resize'));
      mobileQuery.addEventListener?.('change', () => this.schedule('variant'));

      if (this.canvas) {
        this.observer = new MutationObserver(mutations => {
          if (mutations.some(mutation =>
            mutation.type === 'childList' ||
            ['hidden', 'data-scene-visible', 'data-scene-placement', 'data-artifact-side'].includes(mutation.attributeName)
          )) this.schedule('scene-dom');
        });
        this.observer.observe(this.canvas, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['hidden', 'data-scene-visible', 'data-scene-placement', 'data-artifact-side']
        });
      }

      this.schedule('boot');
    }

    context(extra = {}) {
      return {
        ...scene.manager.context(),
        route: document.body.dataset.graphRoute || scene.manager.graphState?.route || 'overview',
        mode: document.body.dataset.graphMode || scene.manager.graphState?.mode || 'overview',
        variant: mobileQuery.matches ? 'mobile' : 'desktop',
        viewport: { width: innerWidth, height: innerHeight },
        ...extra
      };
    }

    inferRequest(id, instance, context) {
      const element = instance.element;
      const placement = element.dataset.scenePlacement || instance.definition?.placement || '';
      const mobile = context.variant === 'mobile';

      if (mobile) {
        if (/mobile-tray|detail-sheet|control-sheet/.test(placement)) {
          return { zone: 'mobile-tray', priority: 50, role: 'mobile' };
        }
        return { zone: 'unmanaged', priority: 0, role: 'legacy' };
      }

      if (placement === 'inspector-right' || placement === 'inspector') {
        return {
          zone: 'inspector',
          side: 'right',
          preferredSide: 'right',
          allowFlip: false,
          blocksSideStage: true,
          priority: 1000,
          role: 'inspector'
        };
      }

      if (placement === 'artifact-contextual') {
        return {
          zone: 'side-stage',
          preferredSide: element.dataset.artifactPreferredSide || element.dataset.artifactSide || 'right',
          allowFlip: true,
          priority: 50,
          role: 'artifact',
          containViewport: true,
          viewportMargin: 20
        };
      }

      if (/^semantic-right-/.test(placement)) {
        return {
          zone: 'side-stage',
          preferredSide: 'right',
          allowFlip: true,
          priority: 70,
          role: 'semantic',
          containViewport: true,
          viewportMargin: 18
        };
      }

      if (placement === 'semantic-lower-rail') {
        return { zone: 'lower-rail', priority: 60, role: 'semantic-rail' };
      }

      return { zone: 'unmanaged', priority: 0, role: 'legacy' };
    }

    requestFor(id, instance, context = this.context()) {
      const definition = instance.definition || scene.registry.get(id) || {};
      const raw = typeof definition.composition === 'function'
        ? definition.composition({ ...context, element: instance.element, definition })
        : definition.composition;
      const inferred = this.inferRequest(id, instance, context);
      const request = raw && typeof raw === 'object' ? { ...inferred, ...raw } : inferred;
      const preferredSide = request.preferredSide || request.side || null;
      return {
        id,
        zone: request.zone || 'unmanaged',
        side: request.side || null,
        preferredSide,
        allowFlip: request.allowFlip !== false,
        blocksSideStage: Boolean(request.blocksSideStage),
        priority: asNumber(request.priority, 0),
        role: request.role || 'scene',
        containViewport: Boolean(request.containViewport),
        viewportMargin: asNumber(request.viewportMargin, 20),
        element: instance.element,
        definition,
        request
      };
    }

    visibleRequests(context) {
      return [...scene.manager.instances.entries()]
        .filter(([, instance]) => instance?.element?.isConnected && instance.visible !== false && !instance.element.hidden)
        .map(([id, instance]) => this.requestFor(id, instance, context));
    }

    measure(request) {
      const rect = request.element.getBoundingClientRect();
      return {
        width: rect.width || request.element.offsetWidth || 0,
        height: rect.height || request.element.offsetHeight || 0
      };
    }

    sideCost(side, request, lane, blockers, context, size) {
      const preferredPenalty = request.preferredSide && side !== request.preferredSide ? 36 : 0;
      const blockerPenalty = blockers.has(side) ? 280 : 0;
      const used = lane[side].used;
      const top = zones['side-stage'].top + used;
      const availableBottom = context.viewport.height - 64;
      const overflow = Math.max(0, top + size.height - availableBottom);
      return preferredPenalty + blockerPenalty + used * .075 + overflow * 4.5;
    }

    chooseSide(request, lane, blockers, context, size) {
      if (request.side && !request.allowFlip) return request.side;
      const preferred = request.preferredSide || request.side || 'right';
      if (!request.allowFlip) return preferred;
      const alternate = opposite(preferred);
      const preferredCost = this.sideCost(preferred, request, lane, blockers, context, size);
      const alternateCost = this.sideCost(alternate, request, lane, blockers, context, size);
      return alternateCost + .01 < preferredCost ? alternate : preferred;
    }

    horizontalInset(request, side, context) {
      if (request.role === 'semantic') return '18px';
      if (request.role !== 'artifact') return '18px';
      if (context.mode === 'work' && side === 'left') return 'clamp(340px,31vw,450px)';
      return 'clamp(72px,11vw,168px)';
    }

    clearComposedGeometry(element) {
      ['left', 'right', 'top', 'bottom'].forEach(property => element.style.removeProperty(property));
      delete element.dataset.sceneZone;
      delete element.dataset.sceneSide;
      delete element.dataset.sceneSlot;
      delete element.dataset.sceneCollisionAdjusted;
      delete element.dataset.sceneComposed;
    }

    applyAssignment(assignment, context) {
      const { element } = assignment;
      this.clearComposedGeometry(element);
      element.dataset.sceneZone = assignment.zone;
      element.dataset.sceneComposed = 'true';
      if (assignment.side) element.dataset.sceneSide = assignment.side;
      if (Number.isFinite(assignment.slot)) element.dataset.sceneSlot = String(assignment.slot);
      if (assignment.collisionAdjusted) element.dataset.sceneCollisionAdjusted = assignment.collisionAdjusted;

      if (assignment.zone !== 'side-stage' || context.variant === 'mobile') return;
      const inset = this.horizontalInset(assignment.request, assignment.side, context);
      assignment.inset = inset;
      element.style.setProperty('top', `${Math.round(assignment.top)}px`, 'important');
      element.style.setProperty('bottom', 'auto', 'important');
      if (assignment.side === 'left') {
        element.style.setProperty('left', inset, 'important');
        element.style.setProperty('right', 'auto', 'important');
      } else {
        element.style.setProperty('right', inset, 'important');
        element.style.setProperty('left', 'auto', 'important');
      }

      if (assignment.request.role === 'artifact') {
        element.dataset.artifactPreferredSide = assignment.request.preferredSide || assignment.side;
        element.dataset.artifactSide = assignment.side;
        if (assignment.collisionAdjusted) element.dataset.artifactCollisionAdjusted = 'scene-composer';
        else delete element.dataset.artifactCollisionAdjusted;
      }
    }

    visualBounds(request) {
      const elements = [request.element];
      if (request.role === 'artifact') {
        request.element.querySelectorAll(
          '.artifact-deck-card,.artifact-folio-page,.artifact-orbit-actions,[data-artifact-focus]'
        ).forEach(element => elements.push(element));
      }
      const rects = elements.map(element => element.getBoundingClientRect()).filter(rect => rect.width || rect.height);
      if (!rects.length) return null;
      return rects.reduce((result, rect) => ({
        left: Math.min(result.left, rect.left),
        top: Math.min(result.top, rect.top),
        right: Math.max(result.right, rect.right),
        bottom: Math.max(result.bottom, rect.bottom)
      }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
    }

    containAssignment(assignment, context) {
      if (!assignment.request.containViewport || assignment.zone !== 'side-stage' || context.variant === 'mobile') return;
      const bounds = this.visualBounds(assignment.request);
      if (!bounds) return;
      const margin = assignment.request.viewportMargin;
      let correction = 0;
      if (assignment.side === 'left' && bounds.left < margin) correction = margin - bounds.left;
      if (assignment.side === 'right' && bounds.right > context.viewport.width - margin) {
        correction = bounds.right - (context.viewport.width - margin);
      }
      if (correction <= .5) return;

      const property = assignment.side === 'left' ? 'left' : 'right';
      assignment.element.style.setProperty(property, `calc(${assignment.inset} + ${Math.ceil(correction)}px)`, 'important');
      assignment.viewportCorrection = Math.ceil(correction);
    }

    compose(reason = 'manual') {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      const context = this.context();
      const requests = this.visibleRequests(context);
      const blockers = new Set(
        requests.filter(request => request.blocksSideStage && request.side).map(request => request.side)
      );
      const lane = {
        left: { used: 0, count: 0 },
        right: { used: 0, count: 0 }
      };
      const next = new Map();

      requests
        .filter(request => request.zone !== 'side-stage')
        .forEach(request => {
          next.set(request.id, {
            id: request.id,
            zone: request.zone,
            side: request.side,
            slot: 0,
            request,
            element: request.element,
            collisionAdjusted: null
          });
        });

      const stage = requests
        .filter(request => request.zone === 'side-stage')
        .map(request => ({ request, size: this.measure(request) }))
        .sort((a, b) => b.request.priority - a.request.priority || a.request.id.localeCompare(b.request.id));

      stage.forEach(({ request, size }) => {
        const side = this.chooseSide(request, lane, blockers, context, size);
        const slot = lane[side].count++;
        const top = zones['side-stage'].top + lane[side].used;
        lane[side].used += Math.max(1, size.height) + zones['side-stage'].gap;
        const collisionAdjusted = request.preferredSide && side !== request.preferredSide
          ? blockers.has(request.preferredSide) ? `blocked-${request.preferredSide}` : `occupied-${request.preferredSide}`
          : slot > 0 ? `stacked-${side}` : null;
        next.set(request.id, {
          id: request.id,
          zone: request.zone,
          side,
          slot,
          top,
          size,
          request,
          element: request.element,
          collisionAdjusted
        });
      });

      [...assignments.values()].forEach(previous => {
        if (!next.has(previous.id) && previous.element?.isConnected) this.clearComposedGeometry(previous.element);
      });

      next.forEach(assignment => this.applyAssignment(assignment, context));
      next.forEach(assignment => this.containAssignment(assignment, context));

      assignments.clear();
      next.forEach((value, key) => assignments.set(key, value));
      this.sequence += 1;
      this.lastReason = reason;
      window.dispatchEvent(new CustomEvent('profile:scene-composition', { detail: this.snapshot() }));
      return this.snapshot();
    }

    schedule(reason = 'scheduled') {
      this.lastReason = reason;
      cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.compose(reason);
      });
    }

    snapshot() {
      return {
        sequence: this.sequence,
        reason: this.lastReason,
        route: document.body.dataset.graphRoute || scene.manager.graphState?.route || 'overview',
        mode: document.body.dataset.graphMode || scene.manager.graphState?.mode || 'overview',
        variant: mobileQuery.matches ? 'mobile' : 'desktop',
        zones: Object.keys(zones),
        assignments: [...assignments.values()].map(assignment => ({
          id: assignment.id,
          zone: assignment.zone,
          side: assignment.side || null,
          slot: Number.isFinite(assignment.slot) ? assignment.slot : null,
          preferredSide: assignment.request.preferredSide || null,
          role: assignment.request.role,
          collisionAdjusted: assignment.collisionAdjusted || null,
          viewportCorrection: assignment.viewportCorrection || 0
        }))
      };
    }
  }

  const composer = new SceneComposer();
  window.SceneComposer = SceneComposer;
  window.ProfileSceneComposer = Object.freeze({
    zones,
    compose: reason => composer.compose(reason),
    schedule: reason => composer.schedule(reason),
    requestFor: (id, instance) => composer.requestFor(id, instance),
    snapshot: () => composer.snapshot()
  });
  window.dispatchEvent(new CustomEvent('profile:scene-composer-ready', { detail: composer.snapshot() }));
})();
