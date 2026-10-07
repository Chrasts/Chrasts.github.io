(() => {
  if (window.ProfileHomeOverviewV4) return;

  const site = window.SITE_DATA || {};
  const profile = site.profile || {};
  const graph = site.graph || {};
  const work = site.work || {};
  if (!graph.nodes?.length || !work.projects?.length) return;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const rootId = graph.rootId || 'stepan-chrast';
  const sectionIds = ['work', 'knowledge', 'experience', 'education', 'about'];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const featured = [...work.projects]
    .filter(project => Number.isFinite(project.featuredRank))
    .sort((a, b) => (a.featuredRank ?? 999) - (b.featuredRank ?? 999))
    .slice(0, 4);
  const currentExperience = [...graph.nodes]
    .filter(node => node.type === 'experience')
    .sort((a, b) => (b.timelineOrder || 0) - (a.timelineOrder || 0))[0] || null;
  const currentEducation = graph.nodes.find(node => node.id === 'charles-university-masters-logic') ||
    [...graph.nodes]
      .filter(node => node.type === 'education' && node.status === 'ongoing')
      .sort((a, b) => (a.layoutOrder || 99) - (b.layoutOrder || 99))[0] || null;

  let shell = null;
  let contactDialog = null;
  let interactiveBack = null;
  let activeProjectId = featured[0]?.id || null;
  let interactiveIntent = false;
  let interactivePhase = 'home';
  let transitionGeneration = 0;
  let branchMotionFrame = 0;

  const element = (tag, className = '', text = '') => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const clamp01 = value => Math.max(0, Math.min(1, value));
  const ease = value => {
    const t = clamp01(value);
    return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  const normaliseRoute = value => String(value || 'overview')
    .replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';
  const routeTo = target => {
    const next = normaliseRoute(target);
    if (location.hash !== `#${next}`) location.hash = `#${next}`;
    else dispatchEvent(new HashChangeEvent('hashchange'));
  };
  const linkFor = label => (profile.links || [])
    .find(item => item.label?.toLowerCase() === label.toLowerCase()) || null;
  const homeActive = () =>
    document.body?.dataset.graphMode === 'overview' &&
    document.body?.dataset.rootLanding === 'false';
  const liveRoot = () => [...document.querySelectorAll(
    `#site-graph .site-graph-node[data-node-id="${CSS.escape(rootId)}"]`
  )].find(node => !node.closest('.v9-transition-overlay')) || null;
  const liveBranchNodes = () => sectionIds.map(id => [...document.querySelectorAll(
    `#site-graph .site-graph-node[data-node-id="${CSS.escape(id)}"]`
  )].find(node => !node.closest('.v9-transition-overlay')) || null).filter(Boolean);

  const ensurePortalStyles = () => {
    if (document.querySelector('link[data-home-interactive-portal-style]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'home-interactive-portal-v4.css?v=20261007-home3';
    link.dataset.homeInteractivePortalStyle = 'true';
    document.head.appendChild(link);
  };

  const graphControl = (label, target, className = '') => {
    const button = element('button', `home-v4-link ${className}`.trim(), label);
    button.type = 'button';
    button.dataset.routeTarget = target;
    button.addEventListener('click', () => routeTo(target));
    return button;
  };

  const makeExternal = (label, href) => {
    const link = element('a', 'home-v4-link home-v4-link--external', label);
    link.href = href;
    link.target = '_blank';
    link.rel = 'noreferrer';
    return link;
  };

  const compactMethod = project => {
    const method = project.caseStudy?.method || '';
    if (!method) return (project.tech || []).slice(0, 4).join(' · ');
    const sentence = method.split(/(?<=[.!?])\s+/)[0] || method;
    return sentence.length > 180 ? `${sentence.slice(0, 177).trim()}…` : sentence;
  };

  const renderProjectPreview = project => {
    const preview = shell?.querySelector('.home-v4-project-preview');
    if (!preview || !project) return;
    preview.replaceChildren();

    const meta = element('p', 'home-v4-project-meta', project.type || 'Selected project');
    const title = element('h3', 'home-v4-project-title', project.title || project.graphLabel);
    const summary = element('p', 'home-v4-project-summary', project.caseStudy?.oneLine || project.description || '');
    preview.append(meta, title, summary);

    const facts = element('dl', 'home-v4-project-facts');
    const appendFact = (term, value) => {
      if (!value) return;
      const row = element('div', 'home-v4-project-fact');
      row.append(element('dt', '', term), element('dd', '', value));
      facts.appendChild(row);
    };
    appendFact('Role', project.caseStudy?.role);
    appendFact('Method', compactMethod(project));
    preview.appendChild(facts);

    const tech = (project.tech || []).slice(0, 4);
    if (tech.length) preview.append(element('p', 'home-v4-project-tech', tech.join(' · ')));
    preview.appendChild(graphControl('Open project →', `work/project/${project.id}`, 'home-v4-open-project'));

    shell.querySelectorAll('.home-v4-project-choice').forEach(button => {
      const active = button.dataset.projectId === project.id;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };

  const selectProject = projectId => {
    const project = featured.find(item => item.id === projectId) || featured[0];
    if (!project) return;
    activeProjectId = project.id;
    renderProjectPreview(project);
  };

  const buildProfilePanel = () => {
    const panel = element('section', 'home-v4-profile');
    panel.setAttribute('aria-labelledby', 'home-v4-name');

    const identity = element('div', 'home-v4-identity');
    const name = element('h1', 'home-v4-name', profile.name || 'Štěpán Chrast');
    name.id = 'home-v4-name';
    identity.append(
      name,
      element('p', 'home-v4-role', 'Data Analysis · Research · Mathematical Logic'),
      element('p', 'home-v4-summary', profile.intro || '')
    );

    const portrait = element('figure', 'home-v4-static-portrait');
    const portraitImage = document.createElement('img');
    portraitImage.src = 'assets/stepan-chrast.jpg';
    portraitImage.alt = 'Portrait of Štěpán Chrast';
    portraitImage.width = 720;
    portraitImage.height = 540;
    portraitImage.decoding = 'async';
    portrait.appendChild(portraitImage);

    const current = element('section', 'home-v4-current');
    current.appendChild(element('p', 'home-v4-eyebrow', 'Current'));
    const currentGrid = element('div', 'home-v4-current-grid');

    if (currentExperience) {
      const item = element('button', 'home-v4-current-item');
      item.type = 'button';
      item.addEventListener('click', () => routeTo(currentExperience.route || 'experience'));
      item.append(
        element('span', 'home-v4-current-kind', 'Role'),
        element('strong', '', currentExperience.role || currentExperience.label),
        element('span', '', currentExperience.label || '')
      );
      currentGrid.appendChild(item);
    }

    if (currentEducation) {
      const item = element('button', 'home-v4-current-item');
      item.type = 'button';
      item.addEventListener('click', () => routeTo(currentEducation.route || 'education'));
      item.append(
        element('span', 'home-v4-current-kind', 'Education'),
        element('strong', '', currentEducation.label || currentEducation.programme || 'MSc in Logic'),
        element('span', '', currentEducation.organisation || 'Charles University')
      );
      currentGrid.appendChild(item);
    }
    current.appendChild(currentGrid);

    panel.append(identity, portrait, current);
    return panel;
  };

  const buildWorkPanel = () => {
    const panel = element('section', 'home-v4-work');
    panel.setAttribute('aria-labelledby', 'home-v4-work-title');
    const head = element('header', 'home-v4-work-head');
    const title = element('h2', 'home-v4-work-title', 'Selected Work');
    title.id = 'home-v4-work-title';
    head.append(title);

    const choices = element('div', 'home-v4-project-list');
    choices.setAttribute('role', 'group');
    choices.setAttribute('aria-label', 'Selected projects');
    featured.forEach(project => {
      const button = element('button', 'home-v4-project-choice');
      button.type = 'button';
      button.dataset.projectId = project.id;
      button.setAttribute('aria-pressed', 'false');
      button.append(
        element('span', 'home-v4-project-node'),
        element('span', 'home-v4-project-choice-label', project.graphLabel || project.title)
      );
      button.addEventListener('click', () => selectProject(project.id));
      choices.appendChild(button);
    });

    const preview = element('article', 'home-v4-project-preview');
    preview.setAttribute('aria-live', 'polite');
    panel.append(head, choices, preview);
    return panel;
  };

  const buildPortraitEdge = () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.classList.add('home-v4-portrait-edge');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const line = document.createElementNS(SVG_NS, 'line');
    line.classList.add('home-v4-portrait-edge-line');
    svg.appendChild(line);
    return svg;
  };

  const syncPortraitEdge = () => {
    const edge = shell?.querySelector('.home-v4-portrait-edge');
    const line = edge?.querySelector('.home-v4-portrait-edge-line');
    const portrait = shell?.querySelector('.home-v4-static-portrait');
    const rootDot = liveRoot()?.querySelector(':scope > .site-graph-dot');
    if (!edge || !line || !portrait || !rootDot || !homeActive() || interactiveIntent) {
      if (edge) edge.dataset.ready = 'false';
      return false;
    }

    const hostRect = shell.getBoundingClientRect();
    const portraitRect = portrait.getBoundingClientRect();
    const rootRect = rootDot.getBoundingClientRect();
    if (hostRect.width < 1 || hostRect.height < 1 || portraitRect.width < 1 || rootRect.width < 1) {
      edge.dataset.ready = 'false';
      return false;
    }

    const px = portraitRect.left + portraitRect.width / 2 - hostRect.left;
    const py = portraitRect.top + portraitRect.height / 2 - hostRect.top;
    const rx = rootRect.left + rootRect.width / 2 - hostRect.left;
    const ry = rootRect.top + rootRect.height / 2 - hostRect.top;
    const dx = rx - px;
    const dy = ry - py;
    const distance = Math.hypot(dx, dy) || 1;
    const ux = dx / distance;
    const uy = dy / distance;
    const portraitRadius = Math.min(portraitRect.width, portraitRect.height) / 2 + 5;
    const rootRadius = Math.max(rootRect.width, rootRect.height) / 2 + 7;

    edge.setAttribute('viewBox', `0 0 ${hostRect.width} ${hostRect.height}`);
    line.setAttribute('x1', String(px + ux * portraitRadius));
    line.setAttribute('y1', String(py + uy * portraitRadius));
    line.setAttribute('x2', String(rx - ux * rootRadius));
    line.setAttribute('y2', String(ry - uy * rootRadius));
    edge.dataset.ready = 'true';
    return true;
  };

  const ensureShell = () => {
    if (shell?.isConnected) return shell;
    const panel = document.querySelector('.site-graph-panel');
    if (!panel) return null;
    shell = element('div', 'home-v4-shell');
    shell.dataset.homeOverview = 'true';
    shell.append(buildPortraitEdge(), buildProfilePanel(), buildWorkPanel());
    panel.appendChild(shell);
    selectProject(activeProjectId);
    requestAnimationFrame(syncPortraitEdge);
    return shell;
  };

  const ensureRootAction = () => {
    const root = liveRoot();
    if (!root) return null;
    let action = root.querySelector(':scope > .home-v4-root-entry-action');
    if (action) return action;

    action = document.createElementNS(SVG_NS, 'g');
    action.classList.add('home-v4-root-entry-action');
    action.setAttribute('aria-hidden', 'true');
    action.setAttribute('pointer-events', 'none');

    const rule = document.createElementNS(SVG_NS, 'line');
    rule.classList.add('home-v4-root-entry-rule');
    rule.setAttribute('x1', '-52');
    rule.setAttribute('x2', '52');
    rule.setAttribute('y1', '48');
    rule.setAttribute('y2', '48');

    const label = document.createElementNS(SVG_NS, 'text');
    label.classList.add('home-v4-root-entry-label');
    label.setAttribute('x', '0');
    label.setAttribute('y', '70');
    label.setAttribute('text-anchor', 'middle');
    label.textContent = 'Enter interactive graph';

    action.append(rule, label);
    root.appendChild(action);
    root.setAttribute('aria-label', interactiveIntent ? 'Return to professional Home' : 'Enter interactive graph - Štěpán Chrast');
    return action;
  };

  const ensureInteractiveBack = () => {
    if (interactiveBack?.isConnected) return interactiveBack;
    const slot = document.querySelector('.header-back-slot');
    if (!slot) return null;
    interactiveBack = element('button', 'home-v4-interactive-back graph-control graph-control--secondary', 'Back');
    interactiveBack.type = 'button';
    interactiveBack.setAttribute('aria-label', 'Back to professional Home');
    interactiveBack.addEventListener('click', () => {
      if (history.state?.profileHomeInteractive) return history.back();
      exitInteractive('header-back');
    });
    slot.appendChild(interactiveBack);
    return interactiveBack;
  };

  const ensureContactDialog = () => {
    if (contactDialog?.isConnected) return contactDialog;
    contactDialog = element('dialog', 'home-v4-contact-dialog');
    contactDialog.setAttribute('aria-labelledby', 'home-v4-contact-title');
    const card = element('div', 'home-v4-contact-card');
    const header = element('header', 'home-v4-contact-head');
    const titleWrap = element('div');
    titleWrap.append(element('p', 'home-v4-eyebrow', 'Contact'), element('h2', '', 'Get in touch'));
    titleWrap.querySelector('h2').id = 'home-v4-contact-title';
    const close = element('button', 'home-v4-contact-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close contact panel');
    close.addEventListener('click', () => contactDialog.close());
    header.append(titleWrap, close);

    const emailRow = element('div', 'home-v4-contact-email-row');
    const email = element('code', 'home-v4-contact-email', profile.email || '');
    const copy = element('button', 'home-v4-contact-action', 'Copy');
    copy.type = 'button';
    copy.addEventListener('click', async () => {
      const value = profile.email || '';
      let copied = false;
      try {
        await navigator.clipboard.writeText(value);
        copied = true;
      } catch (_) {
        const input = document.createElement('textarea');
        input.value = value;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        try { copied = document.execCommand('copy'); } catch (_) {}
        input.remove();
      }
      if (copied) {
        copy.textContent = 'Copied';
        setTimeout(() => { if (copy.isConnected) copy.textContent = 'Copy'; }, 1300);
      }
    });
    emailRow.append(email, copy);

    const actions = element('div', 'home-v4-contact-actions');
    const send = element('a', 'home-v4-contact-action home-v4-contact-action--primary', 'Send email');
    send.href = `mailto:${profile.email || ''}`;
    send.dataset.contactSend = 'true';
    actions.appendChild(send);
    const linkedin = linkFor('LinkedIn');
    if (linkedin?.href) actions.appendChild(makeExternal('LinkedIn ↗', linkedin.href));

    card.append(header, element('p', 'home-v4-contact-label', 'Email'), emailRow, actions);
    contactDialog.appendChild(card);
    contactDialog.addEventListener('click', event => {
      if (event.target === contactDialog) contactDialog.close();
    });
    contactDialog.addEventListener('cancel', event => {
      event.preventDefault();
      contactDialog.close();
    });
    document.body.appendChild(contactDialog);
    return contactDialog;
  };

  function openContact(source = 'api') {
    const dialog = ensureContactDialog();
    if (!dialog) return false;
    if (!dialog.open) dialog.showModal();
    try { window.umami?.track?.('contact_opened', { source }); } catch (_) {}
    return true;
  }

  const setBranchAccessibility = visible => {
    liveBranchNodes().forEach(node => {
      if (!node.dataset.homeV4TabindexSaved) {
        node.dataset.homeV4TabindexSaved = 'true';
        node.dataset.homeV4Tabindex = node.getAttribute('tabindex') ?? '';
      }
      if (visible) {
        node.removeAttribute('aria-hidden');
        if (node.dataset.homeV4Tabindex) node.setAttribute('tabindex', node.dataset.homeV4Tabindex);
        else node.removeAttribute('tabindex');
      } else {
        node.setAttribute('aria-hidden', 'true');
        node.setAttribute('tabindex', '-1');
      }
    });
  };

  const createEmergenceGroup = node => {
    const movable = [...node.children].filter(child => child.tagName?.toLowerCase() !== 'title');
    if (!movable.length) return null;
    const group = document.createElementNS(SVG_NS, 'g');
    group.classList.add('profile-root-emergence-motion');
    node.insertBefore(group, movable[0]);
    movable.forEach(child => group.appendChild(child));
    return group;
  };

  const restoreEmergenceGroup = record => {
    if (!record?.group?.isConnected || record.group.parentElement !== record.node) return;
    [...record.group.children].forEach(child => record.node.insertBefore(child, record.group));
    record.group.remove();
  };

  // Same Profile Root movement contract used by the existing segment/root
  // transition: temporary SVG motion wrappers + profile:profile-root-emergence
  // phases. The established ProfileMotionRefinements owner draws relations only
  // after the five nodes have settled.
  const animateMainBranches = (direction, options = {}) => new Promise(resolve => {
    cancelAnimationFrame(branchMotionFrame);
    branchMotionFrame = 0;
    const duration = Math.max(1, Number(options.duration) || (direction === 'in' ? 560 : 760));
    const stagger = Math.max(0, Number(options.stagger) || (direction === 'in' ? 42 : 68));
    const source = options.source || 'home-interactive';
    const generation = options.generation;
    const root = liveRoot();
    const rootPoint = root ? { x: Number(root.dataset.x), y: Number(root.dataset.y) } : null;
    if (!rootPoint || ![rootPoint.x, rootPoint.y].every(Number.isFinite)) return resolve(false);

    const records = sectionIds.map((id, index) => {
      const node = [...document.querySelectorAll(`#site-graph .site-graph-node[data-node-id="${CSS.escape(id)}"]`)]
        .find(candidate => !candidate.closest('.v9-transition-overlay'));
      const x = Number(node?.dataset.x);
      const y = Number(node?.dataset.y);
      const group = node ? createEmergenceGroup(node) : null;
      if (!node || !group || ![x, y].every(Number.isFinite)) return null;
      const rootDx = rootPoint.x - x;
      const rootDy = rootPoint.y - y;
      if (direction === 'out') {
        group.setAttribute('transform', `translate(${rootDx.toFixed(2)} ${rootDy.toFixed(2)}) scale(.16)`);
        group.style.opacity = '0';
      } else {
        group.setAttribute('transform', 'translate(0 0) scale(1)');
        group.style.opacity = '1';
      }
      return { id, index, node, rootDx, rootDy, group };
    }).filter(Boolean);

    if (records.length !== sectionIds.length) {
      records.forEach(restoreEmergenceGroup);
      return resolve(false);
    }

    document.body?.classList.add('is-profile-root-emerging');
    dispatchEvent(new CustomEvent('profile:profile-root-emergence', {
      detail: { phase: 'nodes', direction, source }
    }));

    const finish = (ok, phase) => {
      cancelAnimationFrame(branchMotionFrame);
      branchMotionFrame = 0;
      records.forEach(restoreEmergenceGroup);
      document.body?.classList.remove('is-profile-root-emerging');
      dispatchEvent(new CustomEvent('profile:profile-root-emergence', {
        detail: { phase, direction, source }
      }));
      resolve(ok);
    };

    if (reducedMotion.matches) return finish(true, direction === 'out' ? 'settled' : 'cancelled');

    const started = performance.now();
    const total = duration + stagger * Math.max(0, records.length - 1);
    const step = now => {
      branchMotionFrame = 0;
      if (generation !== transitionGeneration || !homeActive() || !interactiveIntent) return finish(false, 'cancelled');
      const elapsed = now - started;
      records.forEach(record => {
        const raw = clamp01((elapsed - record.index * stagger) / duration);
        const p = ease(raw);
        if (direction === 'out') {
          const dx = record.rootDx * (1 - p);
          const dy = record.rootDy * (1 - p);
          const scale = .16 + .84 * p;
          record.group.setAttribute('transform', `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) scale(${scale.toFixed(4)})`);
          record.group.style.opacity = String(ease(clamp01(raw / .60)));
        } else {
          const dx = record.rootDx * p;
          const dy = record.rootDy * p;
          const scale = 1 - .84 * p;
          const fade = ease(clamp01((raw - .34) / .66));
          record.group.setAttribute('transform', `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) scale(${scale.toFixed(4)})`);
          record.group.style.opacity = String(1 - fade);
        }
      });
      if (elapsed >= total) return finish(true, direction === 'out' ? 'settled' : 'cancelled');
      branchMotionFrame = requestAnimationFrame(step);
    };
    branchMotionFrame = requestAnimationFrame(step);
  });

  const waitForEdgeOwner = async timeout => {
    const started = performance.now();
    while (!window.ProfileMotionRefinements?.drawMainBranchEdges && performance.now() - started < timeout) {
      await wait(24);
    }
    return window.ProfileMotionRefinements || null;
  };

  const syncHeader = active => {
    const home = document.querySelector('#main-nav > a[data-route="overview"]');
    if (home && home.textContent.trim() !== 'Home') home.textContent = 'Home';
    document.querySelectorAll('a[href^="mailto:"]:not([data-contact-send])').forEach(link => {
      if (link.dataset.homeContactBound === 'true') return;
      link.dataset.homeContactBound = 'true';
      if (link.textContent.trim().toLowerCase() === 'email') link.textContent = 'Contact';
      link.addEventListener('click', event => {
        if (!window.ProfileHomeOverviewV4) return;
        event.preventDefault();
        openContact('legacy-link');
      });
    });

    document.body?.classList.toggle('is-home-v4-active', active);
    ensureInteractiveBack();
    if (interactiveBack) {
      const visible = active && interactiveIntent;
      interactiveBack.setAttribute('aria-hidden', String(!visible));
      interactiveBack.tabIndex = visible ? 0 : -1;
    }
    const location = document.querySelector('.header-location-label');
    if (active && location) location.textContent = interactiveIntent ? 'Overview' : 'Profile';
    const root = liveRoot();
    if (root) root.setAttribute('aria-label', interactiveIntent ? 'Return to professional Home' : 'Enter interactive graph - Štěpán Chrast');
  };

  const applyInteractiveClasses = active => {
    const body = document.body;
    if (!body) return;
    if (!active) {
      body.classList.remove('is-home-interactive-entering', 'is-home-branches-emerging', 'is-home-interactive', 'is-home-interactive-exiting');
      delete body.dataset.homeMode;
      return;
    }

    body.dataset.homeMode = interactivePhase;
    body.classList.toggle('is-home-interactive-entering', interactivePhase === 'entering');
    body.classList.toggle('is-home-interactive', interactiveIntent && ['interactive', 'exiting'].includes(interactivePhase));
    body.classList.toggle('is-home-interactive-exiting', interactivePhase === 'exiting');
    if (interactivePhase !== 'entering') body.classList.remove('is-home-branches-emerging');
  };

  const enterInteractive = async (source = 'root', options = {}) => {
    if (!homeActive() || interactiveIntent || interactivePhase === 'entering') return false;
    const animate = options.animate !== false && !reducedMotion.matches;
    const pushHistory = options.pushHistory !== false;
    const generation = ++transitionGeneration;

    interactiveIntent = true;
    interactivePhase = 'entering';
    applyInteractiveClasses(true);
    syncHeader(true);
    ensureRootAction();
    setBranchAccessibility(false);

    if (pushHistory) {
      try { history.pushState({ ...(history.state || {}), profileHomeInteractive: true }, '', location.href); } catch (_) {}
    }
    try { window.umami?.track?.('interactive_profile_entered', { source }); } catch (_) {}

    if (animate) await wait(300);
    if (generation !== transitionGeneration || !homeActive() || !interactiveIntent) return false;

    document.body?.classList.add('is-home-branches-emerging');
    setBranchAccessibility(true);
    await waitForEdgeOwner(1200);
    if (generation !== transitionGeneration || !homeActive() || !interactiveIntent) return false;

    if (animate) {
      await animateMainBranches('out', {
        generation,
        duration: 760,
        stagger: 68,
        source: 'home-interactive-entry'
      });
    }
    if (generation !== transitionGeneration || !homeActive() || !interactiveIntent) return false;

    interactivePhase = 'interactive';
    applyInteractiveClasses(true);
    syncHeader(true);
    liveRoot()?.focus?.({ preventScroll: true });
    dispatchEvent(new CustomEvent('profile:home-interactive', { detail: { phase: 'entered', source } }));
    return true;
  };

  const exitInteractive = async (source = 'api', options = {}) => {
    if (!interactiveIntent || interactivePhase === 'exiting') return false;
    const animate = options.animate !== false && !reducedMotion.matches;
    const generation = ++transitionGeneration;

    interactivePhase = 'exiting';
    applyInteractiveClasses(homeActive());
    syncHeader(homeActive());
    const edgeOwner = await waitForEdgeOwner(900);

    if (homeActive() && animate) {
      await animateMainBranches('in', {
        generation,
        duration: 560,
        stagger: 42,
        source: 'home-interactive-exit'
      });
    }
    if (generation !== transitionGeneration) return false;

    interactiveIntent = false;
    interactivePhase = 'home';
    edgeOwner?.restoreMainBranchEdges?.();
    setBranchAccessibility(false);
    applyInteractiveClasses(homeActive());
    syncHeader(homeActive());
    liveRoot()?.focus?.({ preventScroll: true });
    dispatchEvent(new CustomEvent('profile:home-interactive', { detail: { phase: 'exited', source } }));
    return true;
  };

  const sync = () => {
    const active = homeActive();
    const nextShell = ensureShell();
    ensureRootAction();
    ensureInteractiveBack();
    if (nextShell) {
      nextShell.hidden = !active;
      nextShell.setAttribute('aria-hidden', String(!active));
    }

    if (!active) {
      if (interactivePhase === 'entering' || interactivePhase === 'exiting') {
        ++transitionGeneration;
        interactivePhase = interactiveIntent ? 'suspended' : 'home';
      } else if (interactiveIntent) {
        interactivePhase = 'suspended';
      }
      applyInteractiveClasses(false);
    } else if (interactiveIntent) {
      if (!['entering', 'exiting'].includes(interactivePhase)) interactivePhase = 'interactive';
      setBranchAccessibility(true);
      applyInteractiveClasses(true);
    } else {
      interactivePhase = 'home';
      setBranchAccessibility(false);
      applyInteractiveClasses(true);
    }

    syncHeader(active);
    if (!active && contactDialog?.open) contactDialog.close();
    requestAnimationFrame(syncPortraitEdge);
  };

  document.addEventListener('click', event => {
    const contactTrigger = event.target.closest?.('[data-home-contact-trigger]');
    if (contactTrigger) {
      event.preventDefault();
      openContact('delegated');
      return;
    }

    const root = event.target.closest?.(`#site-graph .site-graph-node[data-node-id="${CSS.escape(rootId)}"]`);
    if (!root || !homeActive()) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    if (interactiveIntent) {
      if (interactivePhase !== 'interactive') return;
      if (history.state?.profileHomeInteractive) history.back();
      else exitInteractive('root-click-return');
      return;
    }
    enterInteractive('root-click');
  }, true);

  document.addEventListener('keydown', event => {
    if (!homeActive() || !['Enter', ' '].includes(event.key)) return;
    const root = event.target.closest?.(`#site-graph .site-graph-node[data-node-id="${CSS.escape(rootId)}"]`);
    if (!root) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    if (interactiveIntent) {
      if (interactivePhase !== 'interactive') return;
      if (history.state?.profileHomeInteractive) history.back();
      else exitInteractive('root-keyboard-return');
      return;
    }
    enterInteractive('root-keyboard');
  }, true);

  addEventListener('popstate', event => {
    if (!homeActive()) return;
    const wantsInteractive = Boolean(event.state?.profileHomeInteractive);
    if (wantsInteractive && !interactiveIntent) {
      enterInteractive('history-forward', { pushHistory: false, animate: false });
    } else if (!wantsInteractive && interactiveIntent) {
      exitInteractive('history-back');
    }
  });

  ['profile:graph-render-settled', 'profile:scene-state', 'profile:transition-finish', 'profile:transition-cancel',
   'profile:intro-stage', 'profile:intro-completed', 'profile:profile-root-emergence']
    .forEach(type => addEventListener(type, () => requestAnimationFrame(sync)));
  addEventListener('hashchange', () => requestAnimationFrame(sync));
  addEventListener('resize', () => requestAnimationFrame(sync));

  window.ProfileHomeOverviewV4 = Object.freeze({
    sync,
    openContact,
    selectProject,
    enterInteractive,
    exitInteractive,
    snapshot: () => ({
      active: homeActive(),
      activeProjectId,
      featuredProjectIds: featured.map(project => project.id),
      shellPresent: Boolean(shell?.isConnected),
      contactOpen: Boolean(contactDialog?.open),
      interactiveIntent,
      interactivePhase,
      rootActionPresent: Boolean(liveRoot()?.querySelector(':scope > .home-v4-root-entry-action')),
      portraitEdgeReady: shell?.querySelector('.home-v4-portrait-edge')?.dataset.ready === 'true',
      branchCount: liveBranchNodes().length
    })
  });

  ensurePortalStyles();
  ensureShell();
  ensureContactDialog();
  ensureInteractiveBack();
  ensureRootAction();
  sync();
})();
