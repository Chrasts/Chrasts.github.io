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
  // Phase H retires the old standalone root as a normal destination. It is
  // retained only as an internal first-session bootstrap while Intro owns the
  // screen. Same-session Overview starts directly in the practical graph root.
  const initialRootLanding = initialOverview && introEligible;

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

  const ensureStylesheet = (href, marker) => {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
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

    if (!copy.querySelector('.root-atlas-affordance')) {
      const atlas = document.createElement('button');
      atlas.type = 'button';
      atlas.className = 'root-atlas-affordance';
      atlas.dataset.route = 'atlas';
      atlas.disabled = true;
      atlas.setAttribute('aria-label', 'Explore Atlas, the full profile graph');
      const label = document.createElement('span');
      label.textContent = 'Explore Atlas';
      const note = document.createElement('small');
      note.textContent = 'Full graph';
      atlas.append(label, note);
      links.after(atlas);
    }
  };

  ensureStylesheet('root-landing.css', 'data-profile-root-landing-style');
  ensureStylesheet('motion-polish.css', 'data-profile-motion-polish-style');
  ensureStylesheet('graph-feel.css', 'data-profile-graph-feel-style');
  ensureStylesheet('node-dynamics.css', 'data-profile-node-dynamics-style');
  ensureStylesheet('camera-materiality.css', 'data-profile-camera-materiality-style');
  ensureStylesheet('intro-fixes-v3.css', 'data-profile-intro-fixes-v3-style');
  ensureStylesheet('profile-root.css', 'data-profile-root-overview-style');
  ensureStylesheet('graph-navigation-materiality.css', 'data-profile-graph-navigation-style');
  ensureStylesheet('portfolio-refinements.css', 'data-profile-refinements-style');
  ensureStylesheet('profile-post-entry.css', 'data-profile-post-entry-style');
  ensureStylesheet('profile-motion-refinements.css', 'data-profile-motion-refinements-style');
  prepareRootLandingDom();

  document.body.dataset.rootLanding = initialRootLanding ? 'true' : 'false';
  document.body.classList.toggle('is-root-landing', initialRootLanding);
  const explorer = document.querySelector('#site-explorer');
  if (initialRootLanding && explorer) explorer.style.setProperty('display', 'none', 'important');
  scene.manager.setGraphState({ rootLanding: initialRootLanding }, { reason: 'root-landing-bootstrap' });

  const modeIs = mode => context => context.mode === mode;
  const rootLanding = context => context.mode === 'overview' && context.rootLanding === true;
  const graphScene = context => !rootLanding(context);
  const work = modeIs('work');
  const atlas = modeIs('atlas');

  scene.registry.register({ id: 'root-identity-shell', selector: '.hero', visible: rootLanding, placement: 'identity-shell', enter: 'root-shell-in', exit: 'root-shell-out', variants: { desktop: { placement: 'identity-shell-desktop' }, mobile: { placement: 'identity-shell-mobile' } } });
  scene.registry.register({ id: 'root-profile-copy', selector: '.hero-copy', managedVisibility: false, visible: rootLanding, anchorNodeId: 'stepan-chrast', placement: 'identity-copy', enter: 'from-left', exit: 'to-left', variants: { desktop: { placement: 'identity-copy-left', enter: 'from-left', exit: 'to-left' }, mobile: { placement: 'identity-copy-centre', enter: 'fade-up', exit: 'fade-left' } } });
  scene.registry.register({ id: 'portrait', selector: '.hero-visual.profile-identity', managedVisibility: false, visible: rootLanding, anchorNodeId: 'stepan-chrast', placement: 'identity-portrait', enter: 'from-right', exit: 'to-right', variants: { desktop: { placement: 'identity-portrait-right', enter: 'from-right', exit: 'to-right' }, mobile: { placement: 'identity-portrait-top', enter: 'fade-scale', exit: 'fade-right' } } });
  scene.registry.register({ id: 'root-activate-control', selector: '[data-root-activate]', managedVisibility: false, visible: rootLanding, anchorNodeId: 'stepan-chrast', placement: 'root-primary-action', enter: 'root-affordance-in', exit: 'root-affordance-out', variants: { desktop: { placement: 'root-primary-action' }, mobile: { placement: 'root-primary-action-centre' } } });
  scene.registry.register({ id: 'root-atlas-affordance', selector: '.root-atlas-affordance', managedVisibility: false, visible: rootLanding, anchorNodeId: 'stepan-chrast', placement: 'root-secondary-action', enter: 'utility-up', exit: 'utility-down', variants: { desktop: { placement: 'root-secondary-action' }, mobile: { placement: 'root-secondary-action-centre' } } });
  scene.registry.register({ id: 'profile-graph-stage', selector: '#site-explorer', managedVisibility: false, visible: graphScene, anchorNodeId: 'stepan-chrast', placement: 'graph-stage', enter: 'graph-unfold', exit: 'graph-fold', variants: { desktop: { placement: 'graph-stage-desktop' }, mobile: { placement: 'graph-stage-mobile' } } });
  scene.registry.register({ id: 'work-controls', selector: '.integrated-work-controls', visible: work, anchorNodeId: 'work', placement: 'work-rails', enter: 'rails-in', exit: 'rails-out', variants: { desktop: { placement: 'work-side-rails', enter: 'rails-in', exit: 'rails-out' }, mobile: { placement: 'control-sheet', enter: 'sheet-in', exit: 'sheet-out' } } });
  scene.registry.register({ id: 'atlas-controls', selector: '#atlas-controls', visible: atlas, anchorNodeId: 'stepan-chrast', placement: 'atlas-toolbar', enter: 'utility-up', exit: 'utility-down', variants: { desktop: { placement: 'atlas-bottom-toolbar', enter: 'utility-up', exit: 'utility-down' }, mobile: { placement: 'control-sheet', enter: 'sheet-in', exit: 'sheet-out' } } });

  scene.registry.register({
    id: 'detail-panel',
    selector: '#site-detail-panel',
    managedVisibility: false,
    visible: ({ element }) => !element.hidden || element.classList.contains('is-open'),
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
    script.src = src;
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
  ensureScript('profile-root.js', 'data-profile-root-overview');
  ensureScript('accessibility-runtime.js', 'data-profile-accessibility-runtime');
  ensureScript('portfolio-refinements.js', 'data-profile-refinements');
  ensureScript('profile-post-entry.js', 'data-profile-post-entry');
  ensureScript('profile-motion-refinements.js', 'data-profile-motion-refinements');
  ensureScript('profile-motion-compat.js', 'data-profile-motion-compat');
  ensureScript('node-detail-dismiss.js', 'data-profile-node-detail-dismiss');
})();
