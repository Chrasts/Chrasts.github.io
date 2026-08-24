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
    pan: () => false,
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

  let transitionToken = null;
  let lastStableRoute = currentRoute();
  let commitFrame = 0;

  transitions.hook('cancel', payload => {
    if (!transitionToken || payload?.token !== transitionToken) return;
    cancelAnimationFrame(commitFrame);
    commitFrame = 0;
    transitionToken = null;
  });

  const scheduleCommit = () => {
    if (!transitionToken) return;
    cancelAnimationFrame(commitFrame);
    commitFrame = requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!transitionToken || !transitions.matches(transitionToken)) return;
      transitions.commit(transitionToken, {
        toRoute: currentRoute(),
        toMode: currentMode(),
        toScene: manager.snapshot()
      });
    }));
  };

  const observer = new MutationObserver(mutations => {
    if (transitionToken && !transitions.matches(transitionToken)) transitionToken = null;
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
        kind: 'graph-route',
        fromRoute: lastStableRoute,
        fromMode: manager.graphState.mode,
        fromScene: manager.snapshot(),
        trigger: 'legacy-graph-transition'
      });
    }

    if (graphStateChanged) {
      syncGraphState(transitionToken ? 'transition-render' : 'renderer-state');
      if (transitionToken) {
        transitions.prepare(transitionToken, {
          toRoute: currentRoute(),
          toMode: currentMode(),
          activeNodeId: activeNodeId(),
          toScene: manager.snapshot()
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
        activeNodeId: activeNodeId(),
        toScene: manager.snapshot()
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

  const ensureStylesheet = (href, marker) => {
    if (document.querySelector(`link[${marker}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute(marker, 'true');
    document.head.appendChild(link);
  };

  const ensureScript = (src, marker, ready, done) => {
    if (ready()) {
      done();
      return;
    }
    const existing = document.querySelector(`script[${marker}]`);
    if (existing) {
      existing.addEventListener('load', done, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.setAttribute(marker, 'true');
    script.addEventListener('load', done, { once: true });
    document.head.appendChild(script);
  };

  const bootArtifactScenes = () => {
    ensureStylesheet('artifact-scenes.css', 'data-profile-artifact-scenes-style');
    ensureScript('artifact-scene-bindings.js', 'data-profile-artifact-scene-bindings', () => Boolean(window.ARTIFACT_SCENE_BINDINGS), () => {
      ensureScript('artifact-scene-recipes.js', 'data-profile-artifact-scene-recipes', () => Boolean(window.ProfileArtifactSceneRecipes), () => {
        ensureScript('artifact-scene-runtime.js', 'data-profile-artifact-scene-runtime', () => Boolean(window.ProfileArtifactScenes), () => {
          manager.scheduleRefresh('artifact-scenes-bundle-ready');
        });
      });
    });
  };

  const bootPhase8 = () => {
    ensureStylesheet('phase8-semantic-scenes.css', 'data-profile-phase8-style');
    ensureScript('artifact-data.js', 'data-profile-artifact-data', () => Boolean(window.ProfileArtifacts), () => {
      bootArtifactScenes();
      ensureScript('phase8-scene-data.js', 'data-profile-phase8-data', () => Boolean(window.PHASE8_SCENE_DATA), () => {
        ensureScript('phase8-semantic-scenes.js', 'data-profile-phase8-scenes', () => Boolean(window.ProfilePhase8), () => {
          manager.scheduleRefresh('phase8-bundle-ready');
        });
      });
    });
  };

  syncGraphState('legacy-bridge-boot');
  bootPhase8();
})();
