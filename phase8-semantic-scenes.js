(() => {
  const scene = window.ProfileScene;
  const artifacts = window.ProfileArtifacts;
  const data = window.PHASE8_SCENE_DATA;
  const site = window.SITE_DATA;
  if (!scene?.registry || !scene?.manager || !artifacts || !data || !site?.graph?.nodes) return;
  if (window.ProfilePhase8) return;

  const nodeMap = new Map(site.graph.nodes.map(node => [node.id, node]));
  const normaliseRoute = value =>
    (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';
  const routeForNode = id => nodeMap.get(id)?.route || null;
  const artifactHref = id => artifacts.hrefFor(id);
  const verificationHref = id => artifacts.verificationHrefFor?.(id) || artifacts.get(id)?.verificationUrl || null;
  const artifactFor = id => artifacts.get(id);

  const canvas = document.querySelector('.scene-canvas');
  if (!canvas) return;

  const layer = document.createElement('div');
  layer.className = 'phase8-semantic-layer';
  layer.dataset.phase8Layer = 'true';
  layer.setAttribute('aria-live', 'polite');
  canvas.appendChild(layer);

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  const routeControl = (label, nodeId, className = 'phase8-route-link') => {
    const route = routeForNode(nodeId);
    const button = element('button', className, label);
    button.type = 'button';
    if (route) button.dataset.route = route;
    else button.disabled = true;
    return button;
  };

  const externalLink = (label, href, className = 'phase8-link') => {
    if (!href) return null;
    const anchor = element('a', className, label);
    anchor.href = href;
    anchor.target = '_blank';
    anchor.rel = 'noreferrer';
    return anchor;
  };

  const shell = (kind, eyebrow, title) => {
    const root = element('section', `phase8-object phase8-${kind}`);
    const header = element('header', 'phase8-object-header');
    header.append(
      element('p', 'phase8-eyebrow', eyebrow),
      element('h3', 'phase8-object-title', title)
    );
    root.appendChild(header);
    return root;
  };

  const experience = shell('experience', 'Experience', 'Timeline');
  experience.dataset.phase8Object = 'experience-timeline';
  const experienceRail = element('div', 'phase8-experience-rail');
  const experienceRoles = data.experience.nodeIds
    .map(id => nodeMap.get(id))
    .filter(Boolean)
    .sort((a, b) => (a.timelineOrder || 0) - (b.timelineOrder || 0));

  experienceRoles.forEach(role => {
    const item = routeControl(role.label, role.id, 'phase8-experience-item');
    item.dataset.nodeId = role.id;
    const meta = element('span', 'phase8-experience-meta', role.meta || '');
    const job = element('strong', 'phase8-experience-role', role.role || role.label);
    const org = element('span', 'phase8-experience-org', role.organisation || '');
    item.replaceChildren(meta, job, org);
    experienceRail.appendChild(item);
  });
  experience.appendChild(experienceRail);
  layer.appendChild(experience);

  const syncExperience = context => {
    const route = normaliseRoute(context?.route || location.hash);
    experience.querySelectorAll('.phase8-experience-item').forEach(item => {
      const active = routeForNode(item.dataset.nodeId) === route;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-current', active ? 'page' : 'false');
    });
  };

  const coursework = shell('coursework', 'Charles University · selected coursework', 'Document shelf');
  coursework.dataset.phase8Object = 'coursework-documents';
  const courseworkShelf = element('div', 'phase8-document-shelf');

  data.coursework.artifactIds.forEach(id => {
    const artifact = artifactFor(id);
    if (!artifact) return;
    const card = element('article', 'phase8-document');
    card.dataset.artifactId = id;
    const page = element('div', 'phase8-document-page');
    page.append(
      element('span', 'phase8-document-kind', 'PDF'),
      element('strong', 'phase8-document-title', artifact.title),
      element('span', 'phase8-document-summary', artifact.description || '')
    );
    const actions = element('div', 'phase8-actions');
    const open = externalLink('Open paper ↗', artifactHref(id));
    if (open) actions.appendChild(open);
    const nodeId = artifact.anchorNodeIds.find(anchor => nodeMap.get(anchor)?.type === 'education') || artifact.anchorNodeIds[0];
    const inspect = routeControl('Open in graph', nodeId);
    if (inspect.dataset.route) actions.appendChild(inspect);
    card.append(page, actions);
    courseworkShelf.appendChild(card);
  });
  coursework.appendChild(courseworkShelf);
  layer.appendChild(coursework);

  const syncCoursework = context => {
    const route = normaliseRoute(context?.route || location.hash);
    coursework.classList.toggle('is-document-focus', route.endsWith('/simulation-credence'));
  };

  const credentials = shell('credentials', 'Education · credentials', 'Certificate stack');
  credentials.dataset.phase8Object = 'certificate-stack';
  const stack = element('div', 'phase8-certificate-stack');
  const certificateButtons = new Map();

  const certificateInfo = item => {
    const artifact = artifactFor(item.artifactId);
    const node = nodeMap.get(item.nodeId);
    return { item, artifact, node };
  };

  data.certifications.items.map(certificateInfo).filter(entry => entry.artifact && entry.node).forEach((entry, index) => {
    const paper = element('button', 'phase8-certificate-paper');
    paper.type = 'button';
    paper.dataset.artifactId = entry.item.artifactId;
    paper.dataset.nodeId = entry.item.nodeId;
    paper.style.setProperty('--paper-index', String(index));
    paper.setAttribute('aria-pressed', 'false');

    const source = entry.artifact.source;
    if (source?.kind === 'local' && /^image\//.test(entry.artifact.mediaType || '')) {
      const preview = document.createElement('img');
      preview.src = source.path;
      preview.alt = '';
      preview.loading = 'lazy';
      paper.appendChild(preview);
    } else {
      paper.appendChild(element('span', 'phase8-certificate-seal', 'CERT'));
    }
    paper.append(
      element('strong', 'phase8-certificate-title', entry.node.detailLabel || entry.node.label),
      element('span', 'phase8-certificate-meta', [entry.node.organisation, entry.node.meta].filter(Boolean).join(' · '))
    );
    stack.appendChild(paper);
    certificateButtons.set(entry.item.artifactId, paper);
  });

  const certificateInspector = element('div', 'phase8-certificate-inspector');
  credentials.append(stack, certificateInspector);
  layer.appendChild(credentials);
  let activeCertificateId = null;

  const inspectCertificate = artifactId => {
    const config = data.certifications.items.find(item => item.artifactId === artifactId);
    const artifact = artifactFor(artifactId);
    const node = config ? nodeMap.get(config.nodeId) : null;
    if (!config || !artifact || !node) return;
    activeCertificateId = artifactId;

    certificateButtons.forEach((button, id) => {
      const active = id === artifactId;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    certificateInspector.innerHTML = '';
    certificateInspector.append(
      element('p', 'phase8-eyebrow', node.organisation || 'Credential'),
      element('strong', 'phase8-inspector-title', artifact.title),
      element('span', 'phase8-inspector-meta', node.meta || '')
    );
    const actions = element('div', 'phase8-actions');
    const open = externalLink('Open certificate ↗', artifactHref(artifactId));
    const verify = externalLink('Verify ↗', verificationHref(artifactId));
    const graph = routeControl('Open node', config.nodeId);
    if (open) actions.appendChild(open);
    if (verify) actions.appendChild(verify);
    if (graph.dataset.route) actions.appendChild(graph);
    certificateInspector.appendChild(actions);
  };

  certificateButtons.forEach((button, artifactId) => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      inspectCertificate(artifactId);
    });
  });

  const syncCertificates = context => {
    const route = normaliseRoute(context?.route || location.hash);
    const direct = data.certifications.items.find(item => routeForNode(item.nodeId) === route);
    const desired = direct?.artifactId || activeCertificateId || data.certifications.items[0]?.artifactId;
    if (desired && desired !== activeCertificateId) inspectCertificate(desired);
  };

  const esslli = shell('esslli', 'ESSLLI 2026', data.esslli.label);
  esslli.dataset.phase8Object = 'esslli-timetable';
  const timetable = element('div', 'phase8-timetable');

  data.esslli.weeks.forEach(week => {
    const column = element('section', 'phase8-timetable-week');
    column.appendChild(element('h4', 'phase8-week-title', week.label));
    week.sessions.forEach(session => {
      const cell = element('article', 'phase8-course-cell');
      cell.append(
        element('time', 'phase8-course-time', session.time),
        element('strong', 'phase8-course-title', session.title)
      );
      if (session.note) cell.appendChild(element('span', 'phase8-course-note', session.note));
      if (session.links?.length) {
        const links = element('div', 'phase8-course-links');
        session.links.forEach(id => {
          const node = nodeMap.get(id);
          if (!node) return;
          links.appendChild(routeControl(node.label, id, 'phase8-topic-link'));
        });
        cell.appendChild(links);
      }
      column.appendChild(cell);
    });
    timetable.appendChild(column);
  });
  esslli.append(
    timetable,
    element('p', 'phase8-object-note', data.esslli.note)
  );
  layer.appendChild(esslli);

  const prgAi = shell('prg-ai', data.prgAi.status, data.prgAi.title);
  prgAi.dataset.phase8Object = 'prg-ai-route';
  prgAi.append(
    element('p', 'phase8-prg-subtitle', data.prgAi.subtitle),
    element('p', 'phase8-object-note', data.prgAi.note)
  );
  const prgLinks = element('div', 'phase8-prg-route');
  data.prgAi.links.forEach((id, index) => {
    const node = nodeMap.get(id);
    if (!node) return;
    const link = routeControl(node.label, id, 'phase8-prg-stop');
    link.style.setProperty('--stop-index', String(index));
    prgLinks.appendChild(link);
  });
  prgAi.appendChild(prgLinks);
  layer.appendChild(prgAi);

  const routeMatches = (route, prefixes) => prefixes.some(prefix => route === prefix || route.startsWith(`${prefix}/`));

  const definitions = [
    {
      id: 'phase8-experience-timeline',
      selector: '[data-phase8-object="experience-timeline"]',
      anchorNodeId: 'experience',
      placement: 'semantic-lower-rail',
      enter: 'semantic-rise',
      exit: 'semantic-fade',
      visible: context => routeMatches(normaliseRoute(context.route), ['experience']),
      mount: syncExperience,
      update: syncExperience,
      variants: { mobile: { placement: 'semantic-mobile-tray' } }
    },
    {
      id: 'phase8-coursework-documents',
      selector: '[data-phase8-object="coursework-documents"]',
      anchorNodeId: 'selected-coursework',
      placement: 'semantic-right-document',
      enter: 'document-lift',
      exit: 'semantic-fade',
      visible: context => routeMatches(normaliseRoute(context.route), [
        'education/charles-university/coursework',
        'education/charles-university/coursework/simulation-credence'
      ]),
      mount: syncCoursework,
      update: syncCoursework,
      variants: { mobile: { placement: 'semantic-mobile-tray' } }
    },
    {
      id: 'phase8-certificate-stack',
      selector: '[data-phase8-object="certificate-stack"]',
      anchorNodeId: 'credentials',
      placement: 'semantic-right-stack',
      enter: 'paper-stack-in',
      exit: 'semantic-fade',
      visible: context => routeMatches(normaliseRoute(context.route), ['education/credentials']),
      mount: syncCertificates,
      update: syncCertificates,
      variants: { mobile: { placement: 'semantic-mobile-tray' } }
    },
    {
      id: 'phase8-esslli-timetable',
      selector: '[data-phase8-object="esslli-timetable"]',
      anchorNodeId: 'esslli',
      placement: 'semantic-right-timetable',
      enter: 'timetable-unfold',
      exit: 'semantic-fade',
      visible: context => routeMatches(normaliseRoute(context.route), ['education/esslli']),
      variants: { mobile: { placement: 'semantic-mobile-tray' } }
    },
    {
      id: 'phase8-prg-ai-route',
      selector: '[data-phase8-object="prg-ai-route"]',
      anchorNodeId: 'prg-ai',
      placement: 'semantic-right-route',
      enter: 'semantic-rise',
      exit: 'semantic-fade',
      visible: context => routeMatches(normaliseRoute(context.route), ['education/prg-ai']),
      variants: { mobile: { placement: 'semantic-mobile-tray' } }
    }
  ];

  definitions.forEach(definition => scene.registry.register(definition));
  scene.manager.scheduleRefresh('phase8-semantic-scenes');

  const snapshot = () => ({
    route: normaliseRoute(document.body.dataset.graphRoute || location.hash),
    visibleObjects: definitions
      .map(definition => ({
        id: definition.id,
        visible: document.querySelector(definition.selector)?.dataset.sceneVisible === 'true'
      }))
      .filter(item => item.visible)
      .map(item => item.id),
    activeCertificateId
  });

  window.ProfilePhase8 = Object.freeze({
    data,
    layer,
    snapshot,
    inspectCertificate
  });
  window.dispatchEvent(new CustomEvent('profile:phase8-ready', { detail: snapshot() }));
})();
