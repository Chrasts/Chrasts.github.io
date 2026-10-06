(() => {
  const scene = window.ProfileScene;
  if (!scene?.registry) return;

  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';
  const initialRoute = normaliseRoute(location.hash);
  const initialOverview = initialRoute === 'overview';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let storageAvailable = true;
  let introSeen = false;
  try {
    introSeen = sessionStorage.getItem('profileIntroSeen') === 'true';
  } catch (_) {
    storageAvailable = false;
  }

  const earlyIntroState = document.documentElement.dataset.profileIntro;
  const introEligible = earlyIntroState
    ? earlyIntroState === 'pending'
    : initialOverview && storageAvailable && !introSeen;
  // V4 removes the click-through root landing. First-load animation resolves
  // directly into the already expanded professional Overview.
  const initialRootLanding = false;

  if (!initialOverview && storageAvailable && !introSeen) {
    try { sessionStorage.setItem('profileIntroSeen', 'true'); } catch (_) {}
  }

  document.documentElement.dataset.profileIntro = introEligible ? 'pending' : 'bypass';
  window.__PROFILE_INTRO_BOOTSTRAP__ = Object.freeze({
    eligible: introEligible,
    initialRoute,
    initialHash: location.hash,
    initialRootLanding,
    reducedMotion,
    storageAvailable
  });

  if (introEligible && !document.querySelector('style[data-profile-intro-readiness-guard]')) {
    const guard = document.createElement('style');
    guard.dataset.profileIntroReadinessGuard = 'true';
    guard.textContent = [
      'html[data-profile-intro="pending"] .hero,html[data-profile-intro="preparing"] .hero{opacity:0!important;pointer-events:none!important}',
      'html[data-profile-intro="pending"] #site-explorer,html[data-profile-intro="preparing"] #site-explorer{opacity:0!important;pointer-events:none!important}'
    ].join('');
    document.head.appendChild(guard);
  }

  const releaseRevision = '20261006-home2';
  const versionedResource = resource =>
    `${resource}${resource.includes('?') ? '&' : '?'}v=${releaseRevision}`;

  const ensureStylesheet = (href, marker) => {
    if (marker && document.querySelector(`link[${marker}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = versionedResource(href);
    if (marker) link.setAttribute(marker, 'true');
    document.head.appendChild(link);
  };

  const prepareRootLandingDom = () => {
    const copy = document.querySelector('.hero-copy');
    const heading = copy?.querySelector('h1');
    const intro = copy?.querySelector('.intro');
    const links = copy?.querySelector('.inline-links');
    if (!copy || !heading || !intro || !links) return;
    intro.id ||= 'root-intro';
    const oldPrimary = links.querySelector('[data-route="work"]');
    if (oldPrimary?.textContent?.trim().toLowerCase().includes('explore')) oldPrimary.remove();

    if (!copy.querySelector('[data-root-activate]')) {
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'root-node-trigger';
      trigger.dataset.rootActivate = 'true';
      trigger.disabled = true;
      trigger.setAttribute('aria-describedby', intro.id);
      trigger.setAttribute('aria-label', 'Open the profile map');
      const dot = document.createElement('span');
      dot.className = 'root-node-dot';
      dot.setAttribute('aria-hidden', 'true');
      const action = document.createElement('span');
      action.className = 'root-node-action';
      action.textContent = 'Open profile map';
      trigger.append(dot, action);
      heading.after(trigger);
    }

    if (!copy.querySelector('[data-root-hint]')) {
      const hint = document.createElement('p');
      hint.className = 'root-landing-hint';
      hint.dataset.rootHint = 'true';
      hint.textContent = 'Activate the node to enter the interactive profile.';
      links.before(hint);
    }
  };

  const ensureHeaderGraph = () => {
    const header = document.querySelector('.app-header');
    if (!header || header.querySelector('.header-linear-graph')) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('header-linear-graph');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.classList.add('header-linear-graph-line');
    const atlas = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    atlas.classList.add('header-linear-graph-atlas-link');
    const nodes = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodes.classList.add('header-linear-graph-nodes');
    svg.append(line, atlas, nodes);
    header.appendChild(svg);
  };

  ensureHeaderGraph();
  prepareRootLandingDom();

  const ensureStyles = () => {
    ensureStylesheet('scene-system.css', 'data-profile-scene-style');
    ensureStylesheet('branch-colors.css?v=20260919-contrast10', 'data-profile-branch-colors-style');
    ensureStylesheet('profile-root.css', 'data-profile-root-overview-style');
    ensureStylesheet('intro-fixes-v3.css', 'data-profile-intro-fixes-v3-style');
    ensureStylesheet('graph-navigation-materiality.css', 'data-profile-graph-navigation-style');
    ensureStylesheet('portfolio-refinements.css?v=20260922-headergraph8', 'data-profile-refinements-style');
    ensureStylesheet('profile-post-entry.css', 'data-profile-post-entry-style');
    ensureStylesheet('profile-motion-refinements.css', 'data-profile-motion-refinements-style');
    ensureStylesheet('branch-colors.css?v=20260919-contrast10', 'data-profile-branch-colors-style');
  };
  ensureStyles();

  scene.registry.register({
    id: 'graph-routebar',
    selector: '.graph-routebar',
    managedVisibility: false,
    visible: () => true,
    anchorNodeId: graph?.rootId || 'stepan-chrast',
    placement: 'hud',
    composition: { zone: 'hud', role: 'navigation' },
    enter: 'utility-in',
    exit: 'utility-out'
  });
  scene.registry.register({
    id: 'site-graph-help',
    selector: '.site-graph-help',
    managedVisibility: false,
    visible: context => context.mode !== 'atlas',
    anchorNodeId: graph?.rootId || 'stepan-chrast',
    placement: 'hud',
    composition: { zone: 'hud', role: 'help' },
    enter: 'utility-in',
    exit: 'utility-out'
  });
  scene.registry.register({
    id: 'site-detail-panel',
    selector: '.scene-detail',
    managedVisibility: false,
    visible: context => Boolean(context.detailOpen),
    anchorNodeId: graph?.rootId || 'stepan-chrast',
    placement: 'inspector',
    composition: context => context.variant === 'mobile'
      ? { zone: 'mobile-tray', role: 'inspector' }
      : { zone: 'inspector', side: 'right', preferredSide: 'right', allowFlip: false, blocksSideStage: true, priority: 1000, role: 'inspector' },
    enter: 'inspector-in',
    exit: 'inspector-out',
    variants: { desktop: { placement: 'inspector-right', enter: 'inspector-in', exit: 'inspector-out' }, mobile: { placement: 'detail-sheet', enter: 'sheet-in', exit: 'sheet-out' } }
  });

  scene.manager.scheduleRefresh('v3-1-profile-root-definitions');

  const ensureScript = (src, marker) => {
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script');
    script.src = versionedResource(src);
    script.async = false;
    script.setAttribute(marker, 'true');
    document.head.appendChild(script);
  };

  ensureScript('scene-composer.js', 'data-profile-scene-composer');
  ensureScript('camera-composition.js', 'data-profile-camera-composition');
  ensureScript('camera-materiality.js', 'data-profile-camera-materiality');
  ensureScript('halo-renderer.js', 'data-profile-halo-renderer');
  ensureScript('node-interaction-state.js', 'data-profile-node-interaction');
  ensureScript('graph-feel.js', 'data-profile-graph-feel');
  ensureScript('node-dynamics.js', 'data-profile-node-dynamics');
  ensureScript('graph-navigation-materiality.js', 'data-profile-graph-navigation-materiality');
  ensureScript('root-landing.js', 'data-profile-root-landing');
  ensureScript('motion-polish.js', 'data-profile-motion-polish');
  ensureScript('local-label-policy.js', 'data-profile-local-label-policy');
  ensureScript('intro-fixes-v3.js', 'data-profile-intro-fixes-v3');
  ensureScript('profile-root.js?v=20260922-headergraph6', 'data-profile-root-overview');
  ensureScript('accessibility-runtime.js', 'data-profile-accessibility-runtime');
  ensureScript('portfolio-refinements.js', 'data-profile-refinements');
  ensureScript('profile-post-entry.js', 'data-profile-post-entry');
  ensureScript('home-overview-v4.js', 'data-profile-home-v4');
})();
