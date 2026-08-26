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

  window.addEventListener('profile:graph-state-committed', () => {
    syncGraphState(document.body.classList.contains('is-v9-transitioning') ? 'transition-render' : 'renderer-state');
  });
  window.addEventListener('profile:transition-finish', () => {
    syncGraphState('transition-finish');
  });
  ['profile:detail-rendered', 'profile:detail-closed'].forEach(type => {
    window.addEventListener(type, () => manager.refreshObject('detail-panel', { reason: type }));
  });

  window.addEventListener('hashchange', () => {
    if (!document.body.classList.contains('is-v9-transitioning')) {
      requestAnimationFrame(() => {
        syncGraphState('hashchange');
      });
    }
  });

  window.addEventListener('resize', () => manager.scheduleRefresh('resize'));
  window.addEventListener('load', () => manager.scheduleRefresh('load'), { once: true });

  // This bridge is the sole owner of optional feature loading. Every resource
  // has one shared Promise, so route changes and intent prewarming cannot create
  // duplicate tags or parallel initialization chains.
  const resourcePromises = new Map();
  const featurePromises = new Map();
  const featureStates = new Map([
    ['bindings', 'notLoaded'],
    ['intro', 'notLoaded'],
    ['atlas-runtime', 'notLoaded'],
    ['atlas-interactions', 'notLoaded'],
    ['artifacts', 'notLoaded'],
    ['phase8', 'notLoaded']
  ]);

  const waitFor = (predicate, label, timeout = 6000) => new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const poll = () => {
      let value = false;
      try { value = predicate(); } catch (_) {}
      if (value) {
        resolve(value);
        return;
      }
      if (performance.now() - startedAt >= timeout) {
        reject(new Error(`Timed out waiting for ${label}`));
        return;
      }
      setTimeout(poll, 24);
    };
    poll();
  });

  const loadStyle = (href, marker) => {
    const key = `style:${href}`;
    if (resourcePromises.has(key)) return resourcePromises.get(key);
    const promise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`link[${marker}]`);
      if (existing?.sheet) {
        resolve(existing);
        return;
      }
      const link = existing || document.createElement('link');
      if (!existing) {
        link.rel = 'stylesheet';
        link.href = href;
        link.setAttribute(marker, 'true');
      }
      link.addEventListener('load', () => resolve(link), { once: true });
      link.addEventListener('error', () => reject(new Error(`Unable to load stylesheet: ${href}`)), { once: true });
      if (!existing) document.head.appendChild(link);
    });
    resourcePromises.set(key, promise);
    return promise;
  };

  const loadScript = (src, marker, ready) => {
    const key = `script:${src}`;
    if (resourcePromises.has(key)) return resourcePromises.get(key);
    const promise = new Promise((resolve, reject) => {
      if (ready?.()) {
        resolve(document.querySelector(`script[${marker}]`));
        return;
      }
      const existing = document.querySelector(`script[${marker}]`);
      const script = existing || document.createElement('script');
      if (!existing) {
        script.src = src;
        script.async = false;
        script.setAttribute(marker, 'true');
      }
      script.addEventListener('load', () => {
        if (!ready || ready()) resolve(script);
        else reject(new Error(`Script loaded without its readiness contract: ${src}`));
      }, { once: true });
      script.addEventListener('error', () => reject(new Error(`Unable to load script: ${src}`)), { once: true });
      if (!existing) document.head.appendChild(script);
    });
    resourcePromises.set(key, promise);
    return promise;
  };

  const loadFeature = (name, factory) => {
    if (featurePromises.has(name)) return featurePromises.get(name);
    featureStates.set(name, 'loading');
    const promise = Promise.resolve()
      .then(factory)
      .then(result => {
        featureStates.set(name, 'ready');
        return result;
      })
      .catch(error => {
        featureStates.set(name, 'failed');
        featurePromises.delete(name);
        console.error(`[ProfileFeatureBootstrap] ${name} failed`, error);
        throw error;
      });
    featurePromises.set(name, promise);
    return promise;
  };

  const loadBindings = () => loadFeature('bindings', () =>
    loadScript('artifact-scene-bindings.js', 'data-profile-artifact-scene-bindings', () => Array.isArray(window.ARTIFACT_SCENE_BINDINGS))
  );

  const loadArtifactData = () => loadFeature('artifact-data', () =>
    loadScript('artifact-data.js', 'data-profile-artifact-data', () => Boolean(window.ProfileArtifacts))
  );

  const loadObjectFocus = () => loadFeature('object-focus', async () => {
    // Object Focus is the base viewer layer. Artifact-specific emergence and
    // viewer refinements are loaded later, in a deterministic cascade order.
    await loadStyle('object-focus.css', 'data-profile-object-focus-style');
    await loadScript('object-focus-controller.js', 'data-profile-object-focus', () => Boolean(window.ProfileObjectFocus));
    await loadScript('object-focus-fit.js', 'data-profile-object-focus-fit', () => Boolean(window.ProfileObjectFocusFit));
  });

  const bootAtlasRuntime = () => loadFeature('atlas-runtime', async () => {
    await waitFor(
      () => Boolean(window.ProfileGeometry?.__profileCompassV3 && window.ProfileLocalLabelPolicy),
      'canonical geometry and local label policy'
    );
    await Promise.all([
      loadStyle('phase7-atlas.css', 'data-profile-atlas-lod-v7'),
      loadScript('phase7-atlas.js', 'data-profile-atlas-lod-v7', () => Boolean(window.ProfileAtlasLOD))
    ]);
  });

  const bootAtlasInteractions = () => loadFeature('atlas-interactions', async () => {
    const stylesReady = Promise.all([
      loadStyle('root-entry-portal.css', 'data-profile-root-entry-portal-style'),
      loadStyle('atlas-condensation.css', 'data-profile-atlas-condensation-style'),
      loadStyle('atlas-focus-unification.css', 'data-profile-atlas-focus-style')
    ]);
    await Promise.all([
      stylesReady,
      bootAtlasRuntime(),
      waitFor(() => Boolean(window.ProfileScene?.transitions), 'transition core')
    ]);
    await loadScript('atlas-drag-activation-guard.js', 'data-profile-atlas-drag-activation-guard', () => Boolean(window.ProfileAtlasDragActivationGuard));
    await loadScript('atlas-focus-unification.js', 'data-profile-atlas-focus-unification', () => Boolean(window.ProfileAtlasFocus));
    await loadScript('root-entry-portal.js', 'data-profile-root-entry-portal', () => Boolean(window.ProfileRootEntryPortal));
    await loadScript('atlas-condensation.js', 'data-profile-atlas-condensation', () => Boolean(window.ProfileAtlasCondensation));
    manager.scheduleRefresh('atlas-interactions-ready');
  });

  const bootIntro = () => loadFeature('intro', async () => {
    await Promise.all([
      bootAtlasInteractions(),
      loadStyle('intro-atlas-reveal.css', 'data-profile-intro-atlas-style')
    ]);
    await loadScript('intro-atlas-reveal.js', 'data-profile-intro-atlas-reveal', () => Boolean(window.ProfileIntro?.__v31));
  });

  const bootArtifactScenes = () => loadFeature('artifacts', async () => {
    // The artifact presentation is a deliberate cascade, not a bag of styles:
    // base scene -> base focus -> spatial emergence -> spatial refinements ->
    // layout refinements -> transparent viewer. Loading these in parallel made
    // the winning layer depend on network timing and caused both missing-looking
    // floating decks and the old grey Object Focus backdrop to reappear.
    await Promise.all([
      loadBindings(),
      loadArtifactData(),
      loadStyle('artifact-scenes.css', 'data-profile-artifact-scenes-style')
    ]);
    await loadObjectFocus();
    await loadStyle('phase-b-object-emergence.css', 'data-profile-phase-b-object-emergence-style');
    await loadStyle('phase-b-object-emergence-refinements.css', 'data-profile-phase-b-object-emergence-refinements');
    await loadStyle('artifact-scenes-layout.css', 'data-profile-artifact-scenes-layout-style');
    await loadStyle('artifact-viewer-v2.css', 'data-profile-artifact-viewer-v2-style');

    await loadScript('artifact-scene-recipes.js', 'data-profile-artifact-scene-recipes', () => Boolean(window.ProfileArtifactSceneRecipes));
    await loadScript('artifact-scene-runtime.js', 'data-profile-artifact-scene-runtime', () => Boolean(window.ProfileArtifactScenes));
    await loadScript('artifact-scene-layout-compat.js', 'data-profile-artifact-layout-compat', () => Boolean(window.ProfileArtifactSceneLayout));

    // Registering lazy scene definitions already schedules a refresh, but an
    // immediate final refresh removes the route-entry race where the destination
    // was committed before the artifact bundle finished mounting.
    manager.refresh({ reason: 'artifact-scenes-bundle-ready' });
  });

  const bootPhase8 = route => loadFeature('phase8', async () => {
    await Promise.all([
      loadArtifactData(),
      loadStyle('phase8-semantic-scenes.css', 'data-profile-phase8-style')
    ]);
    await loadScript('phase8-scene-data.js', 'data-profile-phase8-data', () => Boolean(window.PHASE8_SCENE_DATA));
    await loadScript('phase8-semantic-scenes.js', 'data-profile-phase8-scenes', () => Boolean(window.ProfilePhase8));
    manager.scheduleRefresh('phase8-bundle-ready');
  });

  const bootCertificateFocus = () => loadFeature('certificate-focus', async () => {
    // Certificates use the same canonical Object Focus viewer even though the
    // certificate stack is a Phase 8 semantic scene rather than an artifact
    // binding of its own.
    await Promise.all([bootPhase8('education/credentials'), bootArtifactScenes()]);
    await loadScript('object-focus-certificate-adapter.js', 'data-profile-object-focus-certificate-adapter', () => Boolean(window.ProfileObjectFocusCertificateAdapter));
  });

  const bindingOwnsRoute = (binding, route) => (binding.targets || []).some(target => {
    const value = normaliseRoute(target.route);
    return target.match === 'prefix' ? route === value || route.startsWith(`${value}/`) : route === value;
  });

  const phase8RoutePrefixes = [
    'experience',
    'education/charles-university/coursework',
    'education/credentials',
    'education/esslli',
    'education/prg-ai'
  ];
  const routeNeedsPhase8 = route => phase8RoutePrefixes.some(prefix =>
    route === prefix || route.startsWith(`${prefix}/`)
  );

  const ensureRoute = async routeValue => {
    const route = normaliseRoute(routeValue);
    await loadBindings();
    const tasks = [];
    if (window.__PROFILE_INTRO_BOOTSTRAP__?.eligible && route === 'overview') tasks.push(bootIntro());
    if (route === 'atlas') tasks.push(bootAtlasInteractions());
    if (window.ARTIFACT_SCENE_BINDINGS.some(binding => bindingOwnsRoute(binding, route))) tasks.push(bootArtifactScenes());
    if (routeNeedsPhase8(route)) tasks.push(bootPhase8(route));
    if (route === 'education/credentials' || route.startsWith('education/credentials/')) tasks.push(bootCertificateFocus());
    await Promise.all(tasks);
    return route;
  };

  const prewarmFromControl = event => {
    const control = event.target.closest?.('[data-route], a[href^="#"]');
    if (!control) return;
    const route = control.dataset.route || control.getAttribute('href');
    if (route) ensureRoute(route).catch(() => {});
  };

  let atlasIntentPending = false;
  const atlasIntentControl = target => {
    const atlasControl = target?.closest?.(
      '[data-route="atlas"], [data-route-target="atlas"], a[href="#atlas"]'
    );
    if (atlasControl && currentMode() !== 'atlas') return atlasControl;
    if (currentMode() !== 'atlas') return null;

    const selected = document.querySelector('#site-graph .site-graph-node.is-previewed[data-node-id]');
    const inspectorAction = target?.closest?.('#site-detail-panel .atlas-open-local');
    if (inspectorAction && selected && ![rootId, 'work'].includes(selected.dataset.nodeId)) return inspectorAction;
    const selectedNode = target?.closest?.('#site-graph .site-graph-node.is-previewed[data-node-id]');
    if (selectedNode && ![rootId, 'work'].includes(selectedNode.dataset.nodeId)) return selectedNode;
    const routeControl = target?.closest?.('[data-route], [data-route-target]');
    const targetRoute = normaliseRoute(
      routeControl?.dataset.route || routeControl?.dataset.routeTarget || routeControl?.getAttribute('href')
    );
    return routeControl && routeNodeMap.has(targetRoute) ? routeControl : null;
  };
  const holdAtlasIntent = event => {
    if (window.ProfileAtlasFocus || event.defaultPrevented) return;
    const control = atlasIntentControl(event.target);
    if (!control) return;
    if (event.type === 'click' && (
      event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
    )) return;
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (atlasIntentPending) return;
    atlasIntentPending = true;
    bootAtlasInteractions()
      .then(() => {
        atlasIntentPending = false;
        if (!control.isConnected) {
          location.hash = '#atlas';
          return;
        }
        control.click();
      })
      .catch(() => {
        atlasIntentPending = false;
        location.hash = '#atlas';
      });
  };

  window.addEventListener('profile:scene-state', event => {
    ensureRoute(event.detail?.current?.route || currentRoute()).catch(() => {});
  });
  window.addEventListener('hashchange', () => ensureRoute(currentRoute()).catch(() => {}));
  document.addEventListener('click', holdAtlasIntent, true);
  document.addEventListener('keydown', holdAtlasIntent, true);
  document.addEventListener('pointerdown', prewarmFromControl, { passive: true });
  document.addEventListener('pointerover', prewarmFromControl, { passive: true });
  document.addEventListener('focusin', prewarmFromControl);

  window.ProfileFeatureBootstrap = Object.freeze({
    ensureRoute,
    snapshot: () => ({
      route: currentRoute(),
      states: Object.fromEntries(featureStates),
      resources: [...resourcePromises.keys()]
    })
  });

  syncGraphState('legacy-bridge-boot');
  ensureRoute(currentRoute()).catch(() => {});
})();