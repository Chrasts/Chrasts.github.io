(() => {
  const scene = window.ProfileScene;
  if (!scene?.registry) return;

  const modeIs = mode => context => context.mode === mode;
  const overview = modeIs('overview');
  const work = modeIs('work');
  const atlas = modeIs('atlas');

  /* Structural wrapper for the two root identity objects. It is intentionally
     not a new content object; it lets SceneManager own the existing hero shell
     while copy and portrait remain independently declared scene objects. */
  scene.registry.register({
    id: 'root-identity-shell',
    selector: '.hero',
    visible: overview,
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
    visible: overview,
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
        placement: 'identity-copy-upper',
        enter: 'fade-up',
        exit: 'fade-left'
      }
    }
  });

  scene.registry.register({
    id: 'portrait',
    selector: '.hero-visual.profile-identity',
    managedVisibility: false,
    visible: overview,
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
        placement: 'identity-portrait-upper-right',
        enter: 'fade-scale',
        exit: 'fade-right'
      }
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

  /* The legacy renderer still owns the exact open/close timing in Phase 1.
     SceneManager nevertheless owns its scene identity, placement, responsive
     variant and lifecycle metadata. Full visibility ownership can move here
     once the generic detail behaviour is replaced by richer scene objects. */
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

  scene.manager.scheduleRefresh('initial-definitions');
})();
