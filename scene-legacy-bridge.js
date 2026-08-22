(() => {
  const scene = window.ProfileScene;
  if (!scene?.manager || !scene?.camera || !scene?.transitions) return;

  const { manager, camera, transitions } = scene;
  const graphNodes = window.SITE_DATA?.graph?.nodes || [];
  const rootId = window.SITE_DATA?.graph?.rootId || 'stepan-chrast';
  const routeNodeMap = new Map(graphNodes.filter(node => node.route).map(node => [node.route, node]));

  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';

  const currentRoute = () => normaliseRoute(document.body.dataset.graphRoute || location.hash);
  const currentMode = () => document.body.dataset.graphMode || 'overview';

  const activeNodeId = () => {
    const route = currentRoute();
    if (route === 'overview' || route === 'atlas') return rootId;
    if (route === 'work' || route.startsWith('work/')) return 'work';
    return routeNodeMap.get(route)?.id ||
      document.querySelector('#site-graph .site-graph-node.is-selected[data-node-id]')?.dataset.nodeId ||
      rootId;
  };

  const workProjectId = () => currentRoute().match(/^work\/project\/([^/]+)$/)?.[1] || null;

  const syncGraphState = reason => {
    manager.setGraphState({
      route: currentRoute(),
      mode: currentMode(),
      activeNodeId: activeNodeId(),
      workProjectId: workProjectId()
    }, { reason });
  };

  /* ----------------------------------------------------------------------
     Camera adapters
     ---------------------------------------------------------------------- */
  const svg = () => document.querySelector('#site-graph .site-graph-svg');
  const graphCamera = () => {
    const target = svg();
    if (!target) return null;
    const edges = target.querySelector(':scope > g > .site-graph-edges');
    return edges?.parentElement || target.firstElementChild;
  };

  const readViewBox = () => {
    const target = svg();
    const viewBox = target?.viewBox?.baseVal;
    const viewport = target?.getBoundingClientRect();
    if (!viewBox) {
      return {
        x: 0,
        y: 0,
        scale: 1,
        viewportWidth: viewport?.width || innerWidth,
        viewportHeight: viewport?.height || innerHeight,
        mode: currentMode()
      };
    }
    const scale = viewport?.width && viewBox.width ? viewport.width / viewBox.width : 1;
    return {
      x: viewBox.x,
      y: viewBox.y,
      scale,
      viewportWidth: viewport?.width || innerWidth,
      viewportHeight: viewport?.height || innerHeight,
      mode: currentMode(),
      viewBox: {
        x: viewBox.x,
        y: viewBox.y,
        width: viewBox.width,
        height: viewBox.height
      }
    };
  };

  const readAtlasTransform = () => {
    const transform = graphCamera()?.getAttribute('transform') || '';
    const translate = transform.match(/translate\(\s*(-?[\d.]+)[,\s]+(-?[\d.]+)\s*\)/i);
    const scale = transform.match(/scale\(\s*(-?[\d.]+)\s*\)/i);
    const viewport = svg()?.getBoundingClientRect();
    return {
      x: translate ? Number(translate[1]) : 0,
      y: translate ? Number(translate[2]) : 0,
      scale: scale ? Number(scale[1]) : 1,
      viewportWidth: viewport?.width || innerWidth,
      viewportHeight: viewport?.height || innerHeight,
      mode: 'atlas'
    };
  };

  const clickAtlas = selector => {
    const control = document.querySelector(selector);
    if (!control) return false;
    control.click();
    return true;
  };

  camera.registerAdapter('desktop-local', {
    read: readViewBox,
    fit: () => false,
    focus: () => false,
    follow: () => false,
    zoomAt: () => false,
    pan: () => false,
    transitionTo: () => false,
    reset: () => false,
    serialize: readViewBox
  });

  camera.registerAdapter('atlas', {
    read: readAtlasTransform,
    fit: () => clickAtlas('#atlas-fit'),
    reset: () => clickAtlas('#atlas-reset'),
    zoomAt: (_point, factor) => factor >= 1
      ? clickAtlas('#atlas-zoom-in')
      : clickAtlas('#atlas-zoom-out'),
    pan: delta => {
      const target = svg();
      const box = target?.getBoundingClientRect();
      if (!target || !box || typeof PointerEvent === 'undefined') return false;
      const startX = box.left + box.width / 2;
      const startY = box.top + box.height / 2;
      const pointerId = 9051;
      target.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        pointerId,
        pointerType: 'mouse',
        button: 0,
        clientX: startX,
        clientY: startY
      }));
      target.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        pointerId,
        pointerType: 'mouse',
        button: 0,
        clientX: startX + (delta?.x || 0),
        clientY: startY + (delta?.y || 0)
      }));
      target.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        pointerId,
        pointerType: 'mouse',
        button: 0,
        clientX: startX + (delta?.x || 0),
        clientY: startY + (delta?.y || 0)
      }));
      return true;
    },
    transitionTo: () => false,
    serialize: readAtlasTransform
  });

  camera.registerAdapter('mobile-local', {
    read: readViewBox,
    fit: (_bounds, options = {}) => {
      const mobile = window.MobileProfileScene;
      if (!mobile?.fitGraph) return false;
      mobile.fitGraph({ instant: Boolean(options.immediate) });
      return true;
    },
    reset: options => {
      const mobile = window.MobileProfileScene;
      if (!mobile?.resetCamera) return false;
      mobile.resetCamera({ instant: Boolean(options?.immediate) });
      return true;
    },
    zoomAt: (_point, factor) => {
      const mobile = window.MobileProfileScene;
      if (!mobile) return false;
      if (factor >= 1) mobile.zoomIn?.();
      else mobile.zoomOut?.();
      return true;
    },
    pan: () => false,
    focus: () => false,
    follow: () => false,
    transitionTo: () => false,
    serialize: readViewBox
  });

  /* ----------------------------------------------------------------------
     Transition bridge

     graph-transitions-v6 remains the animation implementation in Phase 1.
     This observer converts its established body-class lifecycle into formal
     coordinator phases so new scene objects do not need to know about the
     legacy overlay implementation.
     ---------------------------------------------------------------------- */
  let transitionToken = null;
  let lastStableRoute = currentRoute();
  let commitFrame = 0;

  const scheduleCommit = () => {
    if (!transitionToken) return;
    cancelAnimationFrame(commitFrame);
    commitFrame = requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!transitionToken || !transitions.matches(transitionToken)) return;
      transitions.commit(transitionToken, {
        toRoute: currentRoute(),
        toMode: currentMode()
      });
    }));
  };

  const observer = new MutationObserver(mutations => {
    const classChanged = mutations.some(mutation =>
      mutation.type === 'attributes' && mutation.attributeName === 'class'
    );
    const graphStateChanged = mutations.some(mutation =>
      mutation.type === 'attributes' &&
      (mutation.attributeName === 'data-graph-mode' || mutation.attributeName === 'data-graph-route')
    );
    const transitioning = document.body.classList.contains('is-v9-transitioning');

    if (classChanged && transitioning && !transitionToken) {
      transitionToken = transitions.begin({
        fromRoute: lastStableRoute,
        fromMode: manager.graphState.mode,
        trigger: 'legacy-graph-transition'
      });
    }

    if (graphStateChanged) {
      syncGraphState(transitionToken ? 'transition-render' : 'renderer-state');
      if (transitionToken) {
        transitions.prepare(transitionToken, {
          toRoute: currentRoute(),
          toMode: currentMode(),
          activeNodeId: activeNodeId()
        });
        scheduleCommit();
      } else {
        lastStableRoute = currentRoute();
      }
    }

    if (classChanged && !transitioning && transitionToken) {
      cancelAnimationFrame(commitFrame);
      transitions.finish(transitionToken, {
        toRoute: currentRoute(),
        toMode: currentMode(),
        activeNodeId: activeNodeId()
      });
      transitionToken = null;
      lastStableRoute = currentRoute();
      syncGraphState('transition-finish');
    }
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class', 'data-graph-mode', 'data-graph-route']
  });

  /* The detail panel remains visibility-compatible with the legacy renderer,
     but its registry lifecycle is refreshed whenever that visibility changes. */
  const detail = document.querySelector('#site-detail-panel');
  if (detail) {
    const detailObserver = new MutationObserver(() => manager.refreshObject('detail-panel', { reason: 'detail-visibility' }));
    detailObserver.observe(detail, {
      attributes: true,
      attributeFilter: ['hidden', 'class']
    });
  }

  window.addEventListener('hashchange', () => {
    if (!document.body.classList.contains('is-v9-transitioning')) {
      requestAnimationFrame(() => {
        syncGraphState('hashchange');
        lastStableRoute = currentRoute();
      });
    }
  });

  window.addEventListener('resize', () => manager.scheduleRefresh('resize'));
  window.addEventListener('load', () => manager.scheduleRefresh('load'), { once: true });

  syncGraphState('legacy-bridge-boot');
})();
