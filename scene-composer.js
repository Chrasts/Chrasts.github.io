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
  const normaliseRoute = value => (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';
  const visibleElement = element => {
    if (!element?.isConnected || !element.getClientRects().length) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > .03;
  };
  const unionRects = rects => rects.length ? rects.reduce((result, rect) => ({
    left: Math.min(result.left, rect.left),
    top: Math.min(result.top, rect.top),
    right: Math.max(result.right, rect.right),
    bottom: Math.max(result.bottom, rect.bottom)
  }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }) : null;

  class SceneComposer {
    constructor() {
      this.frame = 0;
      this.sequence = 0;
      this.lastReason = 'boot';
      this.canvas = document.querySelector('.scene-canvas');
      scene.registry.onChange(() => this.schedule('registry'));
      window.addEventListener('profile:scene-state', () => this.schedule('scene-state'));
      window.addEventListener('profile:transition-finish', () => this.schedule('transition-finish'));
      window.addEventListener('profile:artifact-scenes-ready', () => this.schedule('artifact-scenes-ready'));
      window.addEventListener('profile:phase8-ready', () => this.schedule('phase8-ready'));
      window.addEventListener('profile:detail-rendered', () => this.schedule('detail-rendered'));
      window.addEventListener('profile:detail-closed', () => this.schedule('detail-closed'));
      window.addEventListener('profile:graph-render-settled', () => this.schedule('graph-render-settled'));
      window.addEventListener('resize', () => this.schedule('resize'));
      mobileQuery.addEventListener?.('change', () => this.schedule('variant'));
      this.schedule('boot');
    }

    context(extra = {}) {
      const managed = scene.manager.context();
      const canvasRect = this.canvas?.getBoundingClientRect();
      return {
        ...managed,
        route: normaliseRoute(managed.route || 'overview'),
        mode: managed.mode || 'overview',
        variant: mobileQuery.matches ? 'mobile' : 'desktop',
        viewport: { width: innerWidth, height: innerHeight },
        canvas: canvasRect ? {
          left: canvasRect.left,
          top: canvasRect.top,
          right: canvasRect.right,
          bottom: canvasRect.bottom,
          width: canvasRect.width,
          height: canvasRect.height
        } : { left: 0, top: 0, right: innerWidth, bottom: innerHeight, width: innerWidth, height: innerHeight },
        ...extra
      };
    }

    artifactPreferredSide(element, context) {
      const bindingId = element.dataset.artifactScene;
      const binding = (window.ARTIFACT_SCENE_BINDINGS || []).find(item => item.id === bindingId);
      const route = normaliseRoute(context.route);
      const target = binding?.targets?.find(item => {
        const value = normaliseRoute(item.route);
        return item.match === 'prefix' ? route === value || route.startsWith(`${value}/`) : route === value;
      });
      return target?.side || element.dataset.artifactPreferredSide || element.dataset.artifactSide || 'right';
    }

    inferRequest(id, instance, context) {
      const element = instance.element;
      const placement = element.dataset.scenePlacement || instance.definition?.placement || '';
      if (context.variant === 'mobile') {
        if (/mobile-tray|detail-sheet|control-sheet/.test(placement)) return { zone: 'mobile-tray', priority: 50, role: 'mobile' };
        return { zone: 'unmanaged', priority: 0, role: 'legacy' };
      }
      if (placement === 'inspector-right' || placement === 'inspector') {
        return { zone: 'inspector', side: 'right', preferredSide: 'right', allowFlip: false, blocksSideStage: true, priority: 1000, role: 'inspector' };
      }
      if (placement === 'artifact-contextual') {
        return {
          zone: 'side-stage',
          preferredSide: this.artifactPreferredSide(element, context),
          allowFlip: true,
          priority: 50,
          role: 'artifact',
          containViewport: true,
          avoidGraph: true,
          viewportMargin: 28,
          graphMargin: 28
        };
      }
      if (/^semantic-right-/.test(placement)) {
        return { zone: 'side-stage', preferredSide: 'right', allowFlip: true, priority: 70, role: 'semantic', containViewport: true, viewportMargin: 18 };
      }
      if (placement === 'semantic-lower-rail') return { zone: 'lower-rail', priority: 60, role: 'semantic-rail' };
      return { zone: 'unmanaged', priority: 0, role: 'legacy' };
    }

    requestFor(id, instance, context = this.context()) {
      const definition = instance.definition || scene.registry.get(id) || {};
      const raw = typeof definition.composition === 'function'
        ? definition.composition({ ...context, element: instance.element, definition })
        : definition.composition;
      const inferred = this.inferRequest(id, instance, context);
      const request = raw && typeof raw === 'object' ? { ...inferred, ...raw } : inferred;
      return {
        id,
        zone: request.zone || 'unmanaged',
        side: request.side || null,
        preferredSide: request.preferredSide || request.side || null,
        allowFlip: request.allowFlip !== false,
        blocksSideStage: Boolean(request.blocksSideStage),
        priority: asNumber(request.priority, 0),
        role: request.role || 'scene',
        containViewport: Boolean(request.containViewport),
        avoidGraph: Boolean(request.avoidGraph),
        viewportMargin: asNumber(request.viewportMargin, 20),
        graphMargin: asNumber(request.graphMargin, 24),
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
      return { width: rect.width || request.element.offsetWidth || 0, height: rect.height || request.element.offsetHeight || 0 };
    }

    graphSafeBounds(context, top = null, height = null, margin = 24) {
      if (context.variant === 'mobile') return null;
      const rangeTop = Number.isFinite(top) ? context.canvas.top + top - margin : -Infinity;
      const rangeBottom = Number.isFinite(top) && Number.isFinite(height) ? context.canvas.top + top + height + margin : Infinity;
      const selectors = [
        '#site-graph .site-graph-node:not(.is-atlas-lod-hidden)',
        '#site-graph .work-project-anchor-v5:not(.is-filtered-out)',
        '#site-graph .work-theme-label-v5'
      ].join(',');
      const rects = [...document.querySelectorAll(selectors)]
        .filter(element => !element.closest('.v9-transition-overlay') && visibleElement(element))
        .map(element => element.getBoundingClientRect())
        .filter(rect => rect.width > .5 && rect.height > .5 && rect.bottom > rangeTop && rect.top < rangeBottom);
      const bounds = unionRects(rects);
      if (!bounds) return null;
      const selected = document.querySelector('#site-graph .site-graph-node.is-selected, #site-graph .site-graph-node.is-previewed');
      const selectedRect = visibleElement(selected) ? selected.getBoundingClientRect() : null;
      const padding = Math.max(margin, selectedRect ? 30 : 24);
      return {
        left: Math.max(context.canvas.left, bounds.left - padding),
        top: Math.max(context.canvas.top, bounds.top - padding),
        right: Math.min(context.canvas.right, bounds.right + padding),
        bottom: Math.min(context.canvas.bottom, bounds.bottom + padding)
      };
    }

    sideMargin(context) {
      return Math.max(52, Math.min(104, context.canvas.width * .07));
    }

    sideControlBoundary(side, context) {
      const selector = side === 'left' ? '.integrated-work-rail.is-left' : '.integrated-work-rail.is-right';
      const control = document.querySelector(selector);
      if (!visibleElement(control)) return null;
      const rect = control.getBoundingClientRect();
      if (rect.bottom <= context.canvas.top || rect.top >= context.canvas.bottom) return null;
      return side === 'left' ? rect.right + 24 : rect.left - 24;
    }

    sideCorridor(side, request, context, graphBounds) {
      const margin = Math.max(request.viewportMargin, this.sideMargin(context));
      const laneCap = Math.min(470, context.canvas.width * .42);
      let left = context.canvas.left + margin;
      let right = context.canvas.right - margin;

      if (side === 'left') {
        right = Math.min(right, left + laneCap);
        const controlRight = this.sideControlBoundary('left', context);
        if (Number.isFinite(controlRight)) left = Math.max(left, controlRight);
        if (request.avoidGraph && graphBounds) right = Math.min(right, graphBounds.left - request.graphMargin);
      } else {
        left = Math.max(left, right - laneCap);
        const controlLeft = this.sideControlBoundary('right', context);
        if (Number.isFinite(controlLeft)) right = Math.min(right, controlLeft);
        if (request.avoidGraph && graphBounds) left = Math.max(left, graphBounds.right + request.graphMargin);
      }

      return { left, right, width: Math.max(0, right - left) };
    }

    sideCost(side, request, lane, context, size) {
      const preferredPenalty = request.preferredSide && side !== request.preferredSide ? 36 : 0;
      const used = lane[side].used;
      const top = zones['side-stage'].top + used;
      const overflow = Math.max(0, top + size.height - (context.canvas.height - 64));
      const graphBounds = this.graphSafeBounds(context, top, size.height, request.graphMargin);
      const corridor = this.sideCorridor(side, request, context, graphBounds);
      const widthDeficit = Math.max(0, Math.min(size.width || 0, 470) - corridor.width);
      const noRoomPenalty = corridor.width < 150 ? 100000 : 0;
      return preferredPenalty + used * .075 + overflow * 4.5 + widthDeficit * 18 + noRoomPenalty;
    }

    chooseSide(request, lane, blockers, context, size) {
      if (request.side && !request.allowFlip) return request.side;
      const preferred = request.preferredSide || request.side || 'right';
      if (!request.allowFlip) return preferred;
      const alternate = opposite(preferred);

      const previous = assignments.get(request.id);
      if (previous?.route === context.route && previous.side && !blockers.has(previous.side)) {
        const previousCost = this.sideCost(previous.side, request, lane, context, size);
        const alternateSide = opposite(previous.side);
        const alternateCost = blockers.has(alternateSide)
          ? Infinity
          : this.sideCost(alternateSide, request, lane, context, size);
        if (previousCost <= alternateCost + 48) return previous.side;
      }

      if (blockers.has(preferred) && !blockers.has(alternate)) return alternate;
      if (!blockers.has(preferred) && blockers.has(alternate)) return preferred;

      const preferredCost = blockers.has(preferred)
        ? Infinity
        : this.sideCost(preferred, request, lane, context, size);
      const alternateCost = blockers.has(alternate)
        ? Infinity
        : this.sideCost(alternate, request, lane, context, size);
      return alternateCost + .01 < preferredCost ? alternate : preferred;
    }

    clearComposedGeometry(element) {
      if (element.dataset.sceneCompositionOwnsGeometry === 'true') {
        ['left', 'right', 'top', 'bottom', 'max-width', '--scene-side-available-width'].forEach(property => element.style.removeProperty(property));
      }
      delete element.dataset.sceneCompositionOwnsGeometry;
      delete element.dataset.sceneZone;
      delete element.dataset.sceneSide;
      delete element.dataset.sceneSlot;
      delete element.dataset.sceneCollisionAdjusted;
      delete element.dataset.sceneSafeAdjusted;
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

      const graphBounds = this.graphSafeBounds(context, assignment.top, assignment.size.height, assignment.request.graphMargin);
      const corridor = this.sideCorridor(assignment.side, assignment.request, context, graphBounds);
      assignment.corridor = corridor;
      const availableWidth = Math.max(0, Math.floor(corridor.width));
      const effectiveWidth = Math.min(assignment.size.width || availableWidth, availableWidth);
      const spare = Math.max(0, corridor.width - effectiveWidth);
      const centredInset = spare / 2;
      const offset = assignment.side === 'left'
        ? corridor.left - context.canvas.left + centredInset
        : context.canvas.right - corridor.right + centredInset;

      assignment.offset = Math.max(0, offset);
      assignment.availableWidth = availableWidth;
      element.dataset.sceneCompositionOwnsGeometry = 'true';
      element.style.setProperty('--scene-side-available-width', `${availableWidth}px`);
      element.style.setProperty('max-width', `${availableWidth}px`, 'important');
      element.style.setProperty('top', `${Math.round(assignment.top)}px`, 'important');
      element.style.setProperty('bottom', 'auto', 'important');
      if (assignment.side === 'left') {
        element.style.setProperty('left', `${Math.round(assignment.offset)}px`, 'important');
        element.style.setProperty('right', 'auto', 'important');
      } else {
        element.style.setProperty('right', `${Math.round(assignment.offset)}px`, 'important');
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
        request.element.querySelectorAll('.artifact-deck-card,.artifact-folio-page,.artifact-orbit-actions,[data-artifact-focus]').forEach(element => elements.push(element));
      }
      const rects = elements.map(element => element.getBoundingClientRect()).filter(rect => rect.width || rect.height);
      return unionRects(rects);
    }

    containAssignment(assignment, context) {
      if (!assignment.request.containViewport || assignment.zone !== 'side-stage' || context.variant === 'mobile') return;
      let bounds = this.visualBounds(assignment.request);
      if (!bounds) return;
      const actualGraphBounds = this.graphSafeBounds(
        context,
        bounds.top - context.canvas.top,
        bounds.bottom - bounds.top,
        assignment.request.graphMargin
      );
      let corridor = this.sideCorridor(assignment.side, assignment.request, context, actualGraphBounds);
      if (corridor.width + .5 < assignment.availableWidth) {
        assignment.availableWidth = Math.max(0, Math.floor(corridor.width));
        assignment.element.style.setProperty('--scene-side-available-width', `${assignment.availableWidth}px`);
        assignment.element.style.setProperty('max-width', `${assignment.availableWidth}px`, 'important');
        bounds = this.visualBounds(assignment.request) || bounds;
        corridor = this.sideCorridor(assignment.side, assignment.request, context, actualGraphBounds);
      }
      assignment.corridor = corridor;
      const topLimit = context.canvas.top + assignment.request.viewportMargin;
      const bottomLimit = context.canvas.bottom - assignment.request.viewportMargin;
      let shiftX = 0;
      let shiftY = 0;

      if (bounds.left < corridor.left) shiftX += corridor.left - bounds.left;
      if (bounds.right > corridor.right) shiftX -= bounds.right - corridor.right;
      if (bounds.top < topLimit) shiftY += topLimit - bounds.top;
      if (bounds.bottom > bottomLimit) shiftY -= bounds.bottom - bottomLimit;

      if (Math.abs(shiftX) > .5) {
        const nextOffset = assignment.side === 'left'
          ? assignment.offset + shiftX
          : assignment.offset - shiftX;
        assignment.offset = Math.max(0, nextOffset);
        const property = assignment.side === 'left' ? 'left' : 'right';
        assignment.element.style.setProperty(property, `${Math.round(assignment.offset)}px`, 'important');
      }
      if (Math.abs(shiftY) > .5) {
        assignment.top += shiftY;
        assignment.element.style.setProperty('top', `${Math.round(assignment.top)}px`, 'important');
      }
      if (Math.abs(shiftX) > .5 || Math.abs(shiftY) > .5) {
        assignment.safeCorrection = { x: Math.round(shiftX), y: Math.round(shiftY) };
        assignment.element.dataset.sceneSafeAdjusted = 'true';
        assignment.collisionAdjusted = assignment.collisionAdjusted || 'safe-frame';
        assignment.element.dataset.sceneCollisionAdjusted = assignment.collisionAdjusted;
        if (assignment.request.role === 'artifact') assignment.element.dataset.artifactCollisionAdjusted = 'scene-composer';
      }
    }

    compose(reason = 'manual') {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      const context = this.context();
      const requests = this.visibleRequests(context);
      const blockers = new Set(requests.filter(request => request.blocksSideStage && request.side).map(request => request.side));
      const lane = { left: { used: 0, count: 0 }, right: { used: 0, count: 0 } };
      const next = new Map();
      requests.filter(request => request.zone !== 'side-stage').forEach(request => {
        next.set(request.id, {
          id: request.id,
          zone: request.zone,
          side: request.side,
          slot: 0,
          route: context.route,
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
          ? blockers.has(request.preferredSide) ? `blocked-${request.preferredSide}` : `safe-${side}`
          : slot > 0 ? `stacked-${side}` : null;
        next.set(request.id, {
          id: request.id,
          zone: request.zone,
          side,
          slot,
          top,
          size,
          route: context.route,
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
      const managed = scene.manager.context();
      return {
        sequence: this.sequence,
        reason: this.lastReason,
        route: normaliseRoute(managed.route || 'overview'),
        mode: managed.mode || 'overview',
        variant: mobileQuery.matches ? 'mobile' : 'desktop',
        zones: Object.keys(zones),
        graphSafeBounds: this.graphSafeBounds(this.context()),
        assignments: [...assignments.values()].map(assignment => ({
          id: assignment.id,
          zone: assignment.zone,
          side: assignment.side || null,
          slot: Number.isFinite(assignment.slot) ? assignment.slot : null,
          preferredSide: assignment.request.preferredSide || null,
          role: assignment.request.role,
          collisionAdjusted: assignment.collisionAdjusted || null,
          safeCorrection: assignment.safeCorrection || null,
          availableWidth: assignment.availableWidth || null
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
