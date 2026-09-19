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

  const focusGraphTarget = nodeId => {
    const focus = () => {
      const projectId = String(nodeId || '').replace(/^project-/, '');
      const target = document.querySelector(`#site-graph .site-graph-node[data-node-id="${CSS.escape(nodeId)}"]`) ||
        document.querySelector(`.work-project-anchor-v5[data-project-id="${CSS.escape(projectId)}"]`);
      target?.focus?.({ preventScroll: true });
    };
    const focusAfterPaint = () => requestAnimationFrame(() => requestAnimationFrame(focus));
    let fallback = 0;
    const complete = () => {
      window.removeEventListener('profile:graph-navigation', onNavigation);
      clearTimeout(fallback);
      focusAfterPaint();
    };
    const onNavigation = event => {
      if (event.detail?.phase === 'idle') complete();
    };
    // A native button is removed when the route changes. Keyboard activation
    // must therefore land on its newly rendered graph counterpart instead of
    // silently dropping focus back to the document.
    window.addEventListener('profile:graph-navigation', onNavigation);
    // A non-animated or interrupted route may not publish a settle phase.
    // The bounded fallback keeps focus recovery deterministic in that case.
    fallback = window.setTimeout(complete, 1600);
  };

  const routeControl = (label, nodeId, className = 'phase8-route-link', options = {}) => {
    const route = routeForNode(nodeId);
    const button = element('button', className, label);
    button.type = 'button';
    if (!route) {
      button.disabled = true;
      return button;
    }
    button.dataset.route = route;
    if (options.crossLink) button.dataset.crosslinkTarget = nodeId;
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (options.crossLink && window.ProfileCrossLinkTravel?.navigate) {
        Promise.resolve(window.ProfileCrossLinkTravel.navigate(nodeId, options.crossLink))
          .then(started => {
            // Preserve an ordinary route as a safe fallback should the
            // semantic relation no longer exist in the canonical model.
            if (!started) location.hash = `#${route}`;
          });
        return;
      }
      if (event.detail === 0) focusGraphTarget(nodeId);
      location.hash = `#${route}`;
    });
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

  // Course evidence is intentionally instantiated only when Phase 8 is
  // requested for the BSc route. It remains compact, curated and carries a
  // positive completion status in the canonical data model.
  const bscData = data.education?.bsc;
  const bsc = shell('bsc-evidence', 'BSc in Logic · completed coursework', 'Verified course groups');
  bsc.dataset.phase8Object = 'bsc-course-constellation';
  const bscClusters = element('div', 'phase8-bsc-clusters');
  let activeBscEvidenceId = null;
  const selectBscEvidence = (evidenceId, { restoreFocus = false } = {}) => {
    const cluster = bscClusters.querySelector(`[data-evidence-id="${CSS.escape(evidenceId || '')}"]`);
    if (!cluster) return false;
    activeBscEvidenceId = evidenceId;
    bscClusters.querySelectorAll('[data-evidence-id]').forEach(item => {
      const active = item === cluster;
      item.classList.toggle('is-active', active);
      item.querySelector('.phase8-bsc-cluster-select')?.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    requestAnimationFrame(() => {
      cluster.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      if (restoreFocus) cluster.querySelector('.phase8-bsc-cluster-select')?.focus({ preventScroll: true });
    });
    return true;
  };
  (bscData?.courseEvidence || [])
    .filter(cluster => ['completed', 'recognized'].includes(cluster.status))
    .forEach(cluster => {
      const clusterElement = element('section', 'phase8-bsc-cluster');
      clusterElement.dataset.evidenceId = cluster.id;
      const select = element('button', 'phase8-bsc-cluster-select', cluster.title);
      select.type = 'button';
      select.setAttribute('aria-pressed', 'false');
      select.addEventListener('click', event => {
        event.stopPropagation();
        selectBscEvidence(cluster.id);
      });
      clusterElement.appendChild(select);
      const courses = element('p', 'phase8-bsc-course-list', cluster.courses.join(' · '));
      clusterElement.appendChild(courses);
      const knowledge = element('div', 'phase8-course-links');
      (cluster.supportsKnowledgeIds || []).forEach(id => {
        const node = nodeMap.get(id);
        if (node) knowledge.appendChild(routeControl(node.label, id, 'phase8-topic-link'));
      });
      clusterElement.appendChild(knowledge);
      bscClusters.appendChild(clusterElement);
    });
  const bscActions = element('div', 'phase8-actions');
  if (bscData?.thesisNodeId && nodeMap.has(bscData.thesisNodeId)) {
    bscActions.appendChild(routeControl('Open BSc thesis', bscData.thesisNodeId, 'phase8-route-link', { crossLink: 'thesis-of' }));
  }
  bsc.append(bscClusters, bscActions);
  if (bscData?.courseEvidence?.[0]?.id) selectBscEvidence(bscData.courseEvidence[0].id);
  layer.appendChild(bsc);
  window.addEventListener('profile:education-evidence-select', event => {
    selectBscEvidence(event.detail?.evidenceId, { restoreFocus: Boolean(event.detail?.restoreFocus) });
  });

  // MSc is deliberately a truthful ongoing-programme context. No speculative
  // course constellation is rendered until completed/recognized records are
  // present in the canonical Education data.
  const mscData = data.education?.msc;
  const mscNode = nodeMap.get(mscData?.nodeId);
  const msc = shell('msc-progress', 'MSc in Logic · ongoing', 'Programme context');
  msc.dataset.phase8Object = 'msc-programme-context';
  if (mscNode) {
    const facts = element('dl', 'phase8-role-facts');
    [
      ['Institution', mscNode.organisation],
      ['Programme', mscNode.programme],
      ['Period', mscNode.meta],
      ['Status', mscNode.status]
    ].forEach(([term, value]) => {
      if (!value) return;
      facts.append(element('dt', '', term), element('dd', '', value));
    });
    msc.append(facts);
  }
  layer.appendChild(msc);

  const syncExperience = context => {
    const route = normaliseRoute(context?.route || location.hash);
    experience.querySelectorAll('.phase8-experience-item').forEach(item => {
      const active = routeForNode(item.dataset.nodeId) === route;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-current', active ? 'page' : 'false');
    });
  };

  // Tier-A Experience focus: factual role context plus canonical Work links.
  // Responsibilities stay inspector content rather than becoming graph nodes.
  const currentRole = shell('current-role', 'Experience · current role', '');
  currentRole.dataset.phase8Object = 'experience-current-role';
  const syncCurrentRole = context => {
    const route = normaliseRoute(context?.route || location.hash);
    const role = [...nodeMap.values()].find(node => node.type === 'experience' && routeForNode(node.id) === route);
    if (!role) return;
    currentRole.querySelector('.phase8-object-title').textContent = role.label;
    const body = element('div', 'phase8-role-inspector-body');
    const facts = element('dl', 'phase8-role-facts');
    [['Organisation', role.organisation], ['Role', role.role], ['Period', role.meta]].forEach(([term, value]) => {
      if (!value) return;
      const dt = element('dt', '', term);
      const dd = element('dd', '', value);
      facts.append(dt, dd);
    });
    body.appendChild(facts);
    if (role.summary) body.appendChild(element('p', 'phase8-object-note', role.summary));
    if (role.highlights?.length) {
      const heading = element('p', 'phase8-eyebrow', 'Contributions');
      const list = element('ul', 'phase8-role-contributions');
      role.highlights.forEach(item => list.appendChild(element('li', '', item)));
      body.append(heading, list);
    }
    const related = (role.relatedWorkIds || []).map(id => nodeMap.get(`project-${id}`)).filter(Boolean);
    if (related.length) {
      const heading = element('p', 'phase8-eyebrow', 'Related Work');
      const links = element('div', 'phase8-actions');
      related.forEach(project => links.appendChild(routeControl(
        project.detailLabel || project.label,
        project.id,
        'phase8-route-link',
        { crossLink: 'role-project' }
      )));
      body.append(heading, links);
    }
    currentRole.querySelectorAll('.phase8-role-inspector-body').forEach(node => node.remove());
    currentRole.appendChild(body);
  };
  layer.appendChild(currentRole);

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
      if (session.time) {
        cell.classList.add('has-time');
        cell.appendChild(element('time', 'phase8-course-time', session.time));
      }
      cell.appendChild(element('strong', 'phase8-course-title', session.title));
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
  const prgTopics = element('div', 'phase8-prg-topics');
  prgTopics.appendChild(element('p', 'phase8-eyebrow', 'Related knowledge areas'));
  const prgTopicList = element('div', 'phase8-course-links');
  data.prgAi.links.forEach(id => {
    const node = nodeMap.get(id);
    if (node) prgTopicList.appendChild(routeControl(node.label, id, 'phase8-topic-link'));
  });
  prgTopics.appendChild(prgTopicList);
  prgAi.appendChild(prgTopics);
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
      // Role focus is handled by one primary inspector (or the normal leaf
      // detail for an earlier role). A second lower timeline repeats that
      // information and competes with the focused graph.
      visible: () => false,
      mount: syncExperience,
      update: syncExperience,
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
      id: 'phase8-current-experience-role',
      selector: '[data-phase8-object="experience-current-role"]',
      anchorNodeId: 'ceske-priority',
      placement: 'semantic-right-role',
      enter: 'semantic-rise',
      exit: 'semantic-fade',
      visible: context => normaliseRoute(context.route) === 'experience/ceske-priority',
      mount: syncCurrentRole,
      update: syncCurrentRole,
      variants: { mobile: { placement: 'semantic-mobile-tray' } }
    },
    {
      id: 'phase8-bsc-course-constellation',
      selector: '[data-phase8-object="bsc-course-constellation"]',
      anchorNodeId: 'charles-university',
      placement: 'semantic-right-evidence',
      enter: 'semantic-rise',
      exit: 'semantic-fade',
      visible: context => routeMatches(normaliseRoute(context.route), ['education/charles-university']),
      mount: () => selectBscEvidence(activeBscEvidenceId),
      update: () => selectBscEvidence(activeBscEvidenceId),
      variants: { mobile: { placement: 'semantic-mobile-tray' } }
    },
    {
      id: 'phase8-msc-programme-context',
      selector: '[data-phase8-object="msc-programme-context"]',
      anchorNodeId: 'charles-university-masters-logic',
      placement: 'semantic-right-msc',
      enter: 'semantic-rise',
      exit: 'semantic-fade',
      visible: context => normaliseRoute(context.route) === 'education/charles-university-masters-logic',
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
    activeCertificateId,
    activeBscEvidenceId
  });

  window.ProfilePhase8 = Object.freeze({
    data,
    layer,
    snapshot,
    inspectCertificate,
    selectBscEvidence
  });
  window.dispatchEvent(new CustomEvent('profile:phase8-ready', { detail: snapshot() }));
})();
