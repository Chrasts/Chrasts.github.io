(() => {
  if (window.ProfileRootOverview) return;

  const site = window.SITE_DATA;
  const graph = site?.graph;
  const profile = site?.profile;
  const work = site?.work;
  const scene = window.ProfileScene;
  if (!profile || !graph?.nodes?.length || !scene?.registry || !scene?.manager) return;

  const rootId = graph.rootId || 'stepan-chrast';
  const sections = ['work', 'knowledge', 'experience', 'education', 'about'];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let brief = null;
  let globalQuickTrigger = null;
  let quickDialog = null;
  let lastFocus = null;
  let pendingFocusRestore = null;
  let bootFrame = 0;
  let bootAttempts = 0;
  let legacyRetiredByPhaseH = false;

  const mode = () => document.body?.dataset.graphMode || null;
  const route = () => document.body?.dataset.graphRoute || (location.hash || '#overview').slice(1);
  const rootLanding = () => document.body?.dataset.rootLanding || null;
  const introState = () => window.ProfileIntro?.snapshot?.().state || null;
  const introStable = () => {
    const marker = document.documentElement.dataset.profileIntro || '';
    return ['bypass', 'ready', 'complete'].includes(marker) || ['ATLAS_READY', 'BYPASSED'].includes(introState());
  };
  const lateReveal = () =>
    introState() === 'ATLAS_REVEAL' && document.body?.classList.contains('is-atlas-reveal-late');
  const overviewActive = () => mode() === 'overview' && rootLanding() === 'false';
  const quickAvailable = () => {
    if (!mode() || !(introStable() || lateReveal())) return false;
    return mode() !== 'overview' || rootLanding() === 'false' || lateReveal();
  };
  const legacyRootNeedsRetirement = () => mode() === 'overview' && rootLanding() === 'true' && introStable();
  const track = name => { try { window.umami?.track?.(name); } catch (_) {} };

  const element = (tag, className = '', text = '') => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  const profileLink = label => (profile.links || []).find(link => link.label?.toLowerCase() === label.toLowerCase()) || null;
  const currentExperience = () => graph.nodes
    .filter(node => node.type === 'experience')
    .sort((a, b) => (b.timelineOrder || 0) - (a.timelineOrder || 0))[0] || null;
  const directChildren = (id, { newestFirst = false } = {}) => graph.nodes
    .filter(node => node.parentIds?.includes(id))
    .sort((a, b) => newestFirst
      ? (b.timelineOrder || 0) - (a.timelineOrder || 0)
      : (a.layoutOrder || a.timelineOrder || 99) - (b.layoutOrder || b.timelineOrder || 99));
  const selectedTools = () => {
    const counts = new Map();
    (work?.projects || []).forEach(project => (project.tech || []).forEach(tool => {
      counts.set(tool, (counts.get(tool) || 0) + 1);
    }));
    return [...counts]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([tool]) => tool);
  };

  const routeTo = target => {
    const next = String(target || 'overview').replace(/^#/, '');
    closeQuickOverview('route');
    if (location.hash !== `#${next}`) location.hash = `#${next}`;
    else dispatchEvent(new HashChangeEvent('hashchange'));
  };

  const makeRouteButton = (label, target) => {
    const button = element('button', 'profile-root-route', label);
    button.type = 'button';
    button.dataset.routeTarget = target;
    button.addEventListener('click', () => routeTo(target));
    return button;
  };

  const makeCvLink = className => {
    const cv = element('a', className, 'CV on request');
    cv.href = `mailto:${profile.email}?subject=${encodeURIComponent('CV request')}`;
    cv.title = 'A downloadable CV is not currently published on this site.';
    cv.dataset.cvState = 'request';
    return cv;
  };

  const ensureBrief = () => {
    if (brief?.isConnected) return brief;
    const heading = document.querySelector('.site-graph-heading');
    if (!heading) return null;

    brief = element('section', 'profile-root-brief');
    brief.dataset.profileRootBrief = 'true';
    brief.setAttribute('aria-label', 'Professional profile overview');

    const identity = element('div', 'profile-root-identity-copy');
    identity.append(
      element('p', 'profile-root-kicker', 'Profile'),
      element('h1', 'profile-root-name', profile.name || 'Štěpán Chrast'),
      element('p', 'profile-root-role', profile.label || 'Data analysis · Research · Mathematical logic')
    );
    const intro = element('p', 'profile-root-summary', profile.intro || '');
    const actions = element('div', 'profile-root-actions');

    const email = element('a', 'profile-root-action', 'Email');
    email.href = `mailto:${profile.email}`;
    actions.appendChild(email);

    for (const label of ['GitHub', 'LinkedIn']) {
      const data = profileLink(label);
      if (!data?.href) continue;
      const link = element('a', 'profile-root-action', `${label} ↗`);
      link.href = data.href;
      link.target = '_blank';
      link.rel = 'noreferrer';
      actions.appendChild(link);
    }

    actions.appendChild(makeCvLink('profile-root-action profile-root-cv'));

    const quick = element('button', 'profile-root-action profile-root-quick-trigger', 'Quick overview');
    quick.type = 'button';
    quick.setAttribute('aria-haspopup', 'dialog');
    quick.addEventListener('click', () => openQuickOverview('profile-root'));
    actions.appendChild(quick);

    const guide = element('p', 'profile-root-guide', 'Choose Work, Knowledge, Experience, Education or About in the graph. Atlas remains available for deeper exploration.');
    brief.append(identity, intro, actions, guide);
    heading.appendChild(brief);
    return brief;
  };

  const ensureGlobalQuickTrigger = () => {
    if (globalQuickTrigger?.isConnected) return globalQuickTrigger;
    const routebar = document.querySelector('.graph-routebar');
    if (!routebar) return null;
    globalQuickTrigger = element('button', 'quick-overview-global-trigger', 'Quick overview');
    globalQuickTrigger.type = 'button';
    globalQuickTrigger.hidden = true;
    globalQuickTrigger.setAttribute('aria-haspopup', 'dialog');
    globalQuickTrigger.addEventListener('click', () => openQuickOverview('routebar'));
    const atlas = routebar.querySelector('.atlas-button');
    if (atlas) routebar.insertBefore(globalQuickTrigger, atlas);
    else routebar.appendChild(globalQuickTrigger);
    return globalQuickTrigger;
  };

  const appendFact = (container, label, value) => {
    if (!value) return;
    const item = element('div', 'quick-overview-fact');
    item.append(element('dt', '', label), element('dd', '', value));
    container.appendChild(item);
  };

  const restoreQuickFocus = () => {
    const target = pendingFocusRestore;
    pendingFocusRestore = null;
    lastFocus = null;
    if (!target?.isConnected) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      target.focus?.({ preventScroll: true });
    }));
  };

  const ensureQuickDialog = () => {
    if (quickDialog?.isConnected) return quickDialog;
    const host = document.querySelector('.scene-canvas') || document.body;
    if (!host) return null;

    quickDialog = element('dialog', 'quick-overview-dialog');
    quickDialog.dataset.quickOverview = 'true';
    quickDialog.setAttribute('aria-labelledby', 'quick-overview-title');

    const shell = element('div', 'quick-overview-shell');
    const header = element('header', 'quick-overview-header');
    const titleWrap = element('div');
    titleWrap.append(
      element('p', 'quick-overview-kicker', 'Quick overview'),
      element('h2', '', profile.name || 'Štěpán Chrast')
    );
    titleWrap.querySelector('h2').id = 'quick-overview-title';
    const close = element('button', 'quick-overview-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close quick overview');
    close.addEventListener('click', () => closeQuickOverview('button'));
    header.append(titleWrap, close);

    const lead = element('p', 'quick-overview-lead', profile.intro || '');
    const facts = element('dl', 'quick-overview-facts');
    const current = currentExperience();
    appendFact(facts, 'Current', current ? [current.role, current.label].filter(Boolean).join(' · ') : null);
    appendFact(facts, 'Focus', profile.label || null);
    appendFact(facts, 'Selected tools', selectedTools().join(' · '));

    const grid = element('div', 'quick-overview-grid');

    const workSection = element('section', 'quick-overview-section');
    workSection.append(element('h3', '', 'Selected work'));
    const workList = element('ul', 'quick-overview-list');
    [...(work?.projects || [])].sort((a, b) => (a.order || 99) - (b.order || 99)).slice(0, 4).forEach(project => {
      const li = element('li');
      li.append(makeRouteButton(project.graphLabel || project.title, `work/project/${project.id}`));
      workList.appendChild(li);
    });
    workSection.append(workList, makeRouteButton('Open Work', 'work'));

    const knowledgeSection = element('section', 'quick-overview-section');
    knowledgeSection.append(element('h3', '', 'Working areas'));
    const knowledgeList = element('ul', 'quick-overview-list');
    directChildren('knowledge').slice(0, 4).forEach(node => {
      const li = element('li');
      li.append(makeRouteButton(node.label, node.route || 'knowledge'));
      knowledgeList.appendChild(li);
    });
    knowledgeSection.append(knowledgeList, makeRouteButton('Open Knowledge', 'knowledge'));

    const experienceSection = element('section', 'quick-overview-section');
    experienceSection.append(element('h3', '', 'Experience'));
    const experienceList = element('ul', 'quick-overview-list');
    directChildren('experience', { newestFirst: true }).slice(0, 3).forEach(node => {
      const li = element('li', '', `${node.label}${node.role ? ` — ${node.role}` : ''}`);
      experienceList.appendChild(li);
    });
    experienceSection.append(experienceList, makeRouteButton('Open Experience', 'experience'));

    const educationSection = element('section', 'quick-overview-section');
    educationSection.append(element('h3', '', 'Education'));
    const educationList = element('ul', 'quick-overview-list');
    directChildren('education').slice(0, 4).forEach(node => {
      const li = element('li', '', `${node.label}${node.meta ? ` · ${node.meta}` : ''}`);
      educationList.appendChild(li);
    });
    educationSection.append(educationList, makeRouteButton('Open Education', 'education'));

    grid.append(workSection, knowledgeSection, experienceSection, educationSection);

    const footer = element('footer', 'quick-overview-footer');
    footer.append(makeRouteButton('About', 'about'));
    const atlas = makeRouteButton('Open Atlas', 'atlas');
    atlas.classList.add('is-atlas');
    footer.append(atlas);
    const contact = element('a', 'profile-root-route', 'Email');
    contact.href = `mailto:${profile.email}`;
    footer.append(contact, makeCvLink('profile-root-route quick-overview-cv'));

    shell.append(header, lead, facts, grid, footer);
    quickDialog.appendChild(shell);
    quickDialog.addEventListener('cancel', event => {
      event.preventDefault();
      closeQuickOverview('escape');
    });
    quickDialog.addEventListener('close', () => {
      document.body.classList.remove('is-quick-overview-open');
      restoreQuickFocus();
    });
    quickDialog.addEventListener('click', event => {
      if (event.target === quickDialog) closeQuickOverview('backdrop');
    });
    host.appendChild(quickDialog);
    return quickDialog;
  };

  function openQuickOverview(source = 'api') {
    const dialog = ensureQuickDialog();
    if (!dialog || !quickAvailable()) return false;
    lastFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : (globalQuickTrigger || brief?.querySelector('.profile-root-quick-trigger'));
    pendingFocusRestore = null;
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('is-quick-overview-open');
    scene.manager.setObjectState('profile-quick-overview', { open: true, source });
    track('quick_overview_opened');
    return true;
  }

  function closeQuickOverview(reason = 'api') {
    if (!quickDialog?.open) return false;
    const shouldRestoreFocus = !['route', 'context-change'].includes(reason);
    pendingFocusRestore = shouldRestoreFocus ? lastFocus : null;
    if (!shouldRestoreFocus) lastFocus = null;
    quickDialog.close(reason);
    scene.manager.setObjectState('profile-quick-overview', { open: false, reason });
    return true;
  }

  const registerSceneObjects = () => {
    if (!scene.registry.has('profile-root-brief')) {
      scene.registry.register({
        id: 'profile-root-brief',
        selector: '.profile-root-brief',
        managedVisibility: false,
        visible: () => overviewActive(),
        anchorNodeId: rootId,
        placement: 'profile-root-brief',
        composition: { zone: 'unmanaged', role: 'profile-root' },
        enter: 'profile-root-in',
        exit: 'profile-root-out'
      });
    }
    if (!scene.registry.has('profile-quick-trigger')) {
      scene.registry.register({
        id: 'profile-quick-trigger',
        selector: '.quick-overview-global-trigger',
        managedVisibility: false,
        visible: () => quickAvailable() && !overviewActive(),
        anchorNodeId: rootId,
        placement: 'profile-utility',
        composition: { zone: 'unmanaged', role: 'profile-utility' },
        enter: 'utility-in',
        exit: 'utility-out'
      });
    }
    if (!scene.registry.has('profile-quick-overview')) {
      scene.registry.register({
        id: 'profile-quick-overview',
        selector: '.quick-overview-dialog',
        managedVisibility: false,
        visible: ({ element }) => Boolean(element.open),
        anchorNodeId: rootId,
        placement: 'quick-overview',
        composition: { zone: 'unmanaged', role: 'utility-overlay' },
        enter: 'utility-in',
        exit: 'utility-out'
      });
    }
  };

  const markBranches = () => {
    sections.forEach(id => {
      const node = [...document.querySelectorAll(`#site-graph .site-graph-node[data-node-id="${CSS.escape(id)}"]`)]
        .find(candidate => !candidate.closest('.v9-transition-overlay'));
      if (node) node.dataset.profileRootBranch = 'true';
    });
  };

  const retireLegacyRootLanding = () => {
    if (!legacyRootNeedsRetirement() || !window.ProfileRootLanding?.commitExpanded) return false;
    window.ProfileRootLanding.commitExpanded({
      focusGraph: false,
      animate: false,
      reason: 'phase-h-profile-root'
    });
    legacyRetiredByPhaseH = true;
    return true;
  };

  const sync = (reason = 'sync') => {
    ensureBrief();
    ensureGlobalQuickTrigger();
    ensureQuickDialog();
    registerSceneObjects();
    markBranches();
    retireLegacyRootLanding();

    const profileVisible = overviewActive();
    if (brief) brief.hidden = !profileVisible;
    if (globalQuickTrigger) globalQuickTrigger.hidden = !quickAvailable() || profileVisible;
    document.body.classList.toggle('is-profile-root-ready', profileVisible);
    if (profileVisible) {
      document.body.dataset.entryState = 'profile';
      document.body.dataset.rootEntry = 'profile';
    }
    if (!quickAvailable() && quickDialog?.open) closeQuickOverview('context-change');
    scene.manager.scheduleRefresh(`profile-root:${reason}`);
    if (profileVisible) {
      dispatchEvent(new CustomEvent('profile:profile-root-settled', {
        detail: { reason, route: route(), branchCount: sections.filter(id => Boolean(document.querySelector(`#site-graph .site-graph-node[data-node-id="${CSS.escape(id)}"]`))).length }
      }));
    }
  };

  const boot = () => {
    if (!window.ProfileRootLanding || !document.querySelector('#site-graph .site-graph-svg')) return false;
    sync('boot');
    dispatchEvent(new CustomEvent('profile:root-overview-ready', { detail: snapshot() }));
    return true;
  };

  const ensureBoot = () => {
    if (boot()) {
      cancelAnimationFrame(bootFrame);
      bootFrame = 0;
      return;
    }
    if (bootAttempts++ > 480) return;
    bootFrame = requestAnimationFrame(ensureBoot);
  };

  // Quick Overview is a modal scene. While it is open, Escape belongs to this
  // owner and must not leak to the graph-level Escape router (Atlas -> Overview).
  addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !quickDialog?.open) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeQuickOverview('escape');
  }, true);

  addEventListener('profile:root-landing', () => sync('root-landing'));
  addEventListener('profile:atlas-ready', () => sync('atlas-ready'));
  addEventListener('profile:intro-stage', event => sync(`intro-stage:${event.detail?.stage || 'unknown'}`));
  addEventListener('profile:intro-completed', () => sync('intro-completed'));
  addEventListener('profile:atlas-condensation-complete', () => sync('condensation-complete'));
  addEventListener('profile:scene-state', () => sync('scene-state'));
  addEventListener('profile:transition-finish', () => sync('transition-finish'));
  addEventListener('profile:transition-cancel', () => sync('transition-cancel'));
  addEventListener('hashchange', () => requestAnimationFrame(() => sync('hashchange')));
  reducedMotion.addEventListener?.('change', () => sync('motion-preference'));

  function snapshot() {
    const root = document.querySelector(`#site-graph .site-graph-node[data-node-id="${CSS.escape(rootId)}"]`);
    return {
      ready: Boolean(brief?.isConnected && globalQuickTrigger?.isConnected && quickDialog?.isConnected),
      visible: overviewActive() && !brief?.hidden,
      quickAvailable: quickAvailable(),
      route: route(),
      mode: mode(),
      rootLanding: rootLanding(),
      introState: introState(),
      lateReveal: lateReveal(),
      legacyRetiredByPhaseH,
      quickOpen: Boolean(quickDialog?.open),
      globalQuickVisible: Boolean(globalQuickTrigger?.isConnected && !globalQuickTrigger.hidden),
      branchCount: sections.filter(id => document.querySelector(`#site-graph .site-graph-node[data-node-id="${CSS.escape(id)}"][data-profile-root-branch="true"]`)).length,
      rootPresent: Boolean(root),
      rootMaterial: root?.dataset.rootEntryMaterial || null,
      cvState: brief?.querySelector('[data-cv-state]')?.dataset.cvState || null,
      professionalLinkCount: brief?.querySelectorAll('a.profile-root-action').length || 0,
      reducedMotion: reducedMotion.matches
    };
  }

  window.ProfileRootOverview = Object.freeze({
    openQuickOverview,
    closeQuickOverview,
    refresh: () => sync('api'),
    snapshot
  });

  ensureBoot();
})();
