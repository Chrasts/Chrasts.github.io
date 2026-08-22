(() => {
  const scene = window.ProfileScene;
  if (!scene?.registry) return;

  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';
  const initialRoute = normaliseRoute(location.hash);
  const initialRootLanding = initialRoute === 'overview';
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
    : initialRootLanding && storageAvailable && !introSeen;

  /* An explicit deep link takes precedence over the cinematic intro. Treat that
     entry as the current session's visit so a later refresh of Overview does not
     unexpectedly insert an intro after the visitor has already explored content. */
  if (!initialRootLanding && storageAvailable && !introSeen) {
    try { sessionStorage.setItem('profileIntroSeen', 'true'); } catch (_) {}
  }

  document.documentElement.dataset.profileIntro = introEligible ? 'pending' : 'bypass';
  window.__PROFILE_INTRO_BOOTSTRAP__ = Object.freeze({
    eligible: introEligible,
    initialRoute,
    initialHash: location.hash,
    reducedMotion,
    storageAvailable
  });

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
  ensureStylesheet('intro-animation.css', 'data-profile-intro-style');
  ensureStylesheet('motion-polish.css', 'data-profile-motion-polish-style');
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

  scene.registry.register({
    id: 'root-identity-shell',
    selector: '.hero',
    visible: rootLanding,
    placement: 'identity-shell',
    enter: 'root-shell-in',
    exit: 'root-shell-out',
    variants: {
      desktop: { placement: 'identity-shell-desktop' },
      mobile: { placement: 'identity-shell-mobile' }
    }
  });

  scene.registry.register({
    id: 'root-profile-copy',
    selector: '.hero-copy',
    managedVisibility: false,
    visible: rootLanding,
    anchorNodeId: 'stepan-chrast',
    placement: 'identity-copy',
    enter: 'from-left',
    exit: 'to-left',
    variants: {
      desktop: {
        placement: 'identity-copy-left',
        enter: 'from-left',
        exit: 'to-left'
      },
      mobile: {
        placement: 'identity-copy-centre',
        enter: 'fade-up',
        exit: 'fade-left'
      }
    }
  });

  scene.registry.register({
    id: 'portrait',
    selector: '.hero-visual.profile-identity',
    managedVisibility: false,
    visible: rootLanding,
    anchorNodeId: 'stepan-chrast',
    placement: 'identity-portrait',
    enter: 'from-right',
    exit: 'to-right',
    variants: {
      desktop: {
        placement: 'identity-portrait-right',
        enter: 'from-right',
        exit: 'to-right'
      },
      mobile: {
        placement: 'identity-portrait-top',
        enter: 'fade-scale',
        exit: 'fade-right'
      }
    }
  });

  scene.registry.register({
    id: 'root-activate-control',
    selector: '[data-root-activate]',
    managedVisibility: false,
    visible: rootLanding,
    anchorNodeId: 'stepan-chrast',
    placement: 'root-primary-action',
    enter: 'root-affordance-in',
    exit: 'root-affordance-out',
    variants: {
      desktop: { placement: 'root-primary-action' },
      mobile: { placement: 'root-primary-action-centre' }
    }
  });

  scene.registry.register({
    id: 'root-atlas-affordance',
    selector: '.root-atlas-affordance',
    managedVisibility: false,
    visible: rootLanding,
    anchorNodeId: 'stepan-chrast',
    placement: 'root-secondary-action',
    enter: 'utility-up',
    exit: 'utility-down',
    variants: {
      desktop: { placement: 'root-secondary-action' },
      mobile: { placement: 'root-secondary-action-centre' }
    }
  });

  scene.registry.register({
    id: 'profile-graph-stage',
    selector: '#site-explorer',
    managedVisibility: false,
    visible: graphScene,
    anchorNodeId: 'stepan-chrast',
    placement: 'graph-stage',
    enter: 'graph-unfold',
    exit: 'graph-fold',
    variants: {
      desktop: { placement: 'graph-stage-desktop' },
      mobile: { placement: 'graph-stage-mobile' }
    }
  });

  scene.registry.register({
    id: 'work-controls',
    selector: '.integrated-work-controls',
    visible: work,
    anchorNodeId: 'work',
    placement: 'work-rails',
    enter: 'rails-in',
    exit: 'rails-out',
    variants: {
      desktop: {
        placement: 'work-side-rails',
        enter: 'rails-in',
        exit: 'rails-out'
      },
      mobile: {
        placement: 'control-sheet',
        enter: 'sheet-in',
        exit: 'sheet-out'
      }
    }
  });

  scene.registry.register({
    id: 'atlas-controls',
    selector: '#atlas-controls',
    visible: atlas,
    anchorNodeId: 'stepan-chrast',
    placement: 'atlas-toolbar',
    enter: 'utility-up',
    exit: 'utility-down',
    variants: {
      desktop: {
        placement: 'atlas-bottom-toolbar',
        enter: 'utility-up',
        exit: 'utility-down'
      },
      mobile: {
        placement: 'control-sheet',
        enter: 'sheet-in',
        exit: 'sheet-out'
      }
    }
  });

  /* The current renderer still owns exact detail open/close timing. */
  scene.registry.register({
    id: 'detail-panel',
    selector: '#site-detail-panel',
    managedVisibility: false,
    visible: ({ element }) => !element.hidden || element.classList.contains('is-open'),
    placement: 'inspector',
    enter: 'inspector-in',
    exit: 'inspector-out',
    variants: {
      desktop: {
        placement: 'inspector-right',
        enter: 'inspector-in',
        exit: 'inspector-out'
      },
      mobile: {
        placement: 'detail-sheet',
        enter: 'sheet-in',
        exit: 'sheet-out'
      }
    }
  });

  scene.manager.scheduleRefresh('phase3-intro-definitions');

  const ensureScript = (src, marker) => {
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.setAttribute(marker, 'true');
    document.head.appendChild(script);
  };

  ensureScript('root-landing.js', 'data-profile-root-landing');
  ensureScript('intro-animation.js', 'data-profile-intro-animation');
  ensureScript('motion-polish.js', 'data-profile-motion-polish');
})();