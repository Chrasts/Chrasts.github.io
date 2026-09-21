(() => {
  const html = document.documentElement;
  if (html.dataset.mobileGate !== 'active') return;

  const gate = document.getElementById('mobile-construction-gate');
  if (!gate) return;

  const site = window.SITE_DATA || {};
  const profile = site.profile || {};
  const nodes = site.graph?.nodes || [];
  const projects = [...(site.work?.projects || [])];
  const preview = gate.querySelector('.mobile-gate-preview');
  const underlying = [
    document.querySelector('.skip-link'),
    document.querySelector('.site-header'),
    document.querySelector('#main-content')
  ].filter(Boolean);

  const clean = value => String(value || '')
    .replace(/\s*·\s*/g, ' / ')
    .replace(/\s*—\s*/g, ': ');

  const byParent = id => nodes.filter(node => node.parentIds?.includes(id));
  const element = (tag, className = '', text = '') => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = clean(text);
    return node;
  };
  const link = (label, href) => {
    const a = element('a', '', label);
    a.href = href;
    if (/^https?:/.test(href)) {
      a.target = '_blank';
      a.rel = 'noreferrer';
    }
    return a;
  };

  const setUnderlyingInert = inert => {
    underlying.forEach(node => {
      try { node.inert = inert; } catch (_) {}
    });
  };

  const renderHeader = () => {
    const title = gate.querySelector('#mobile-brief-title');
    const positioning = gate.querySelector('[data-mobile-profile-positioning]');
    const intro = gate.querySelector('[data-mobile-profile-intro]');
    const links = gate.querySelector('[data-mobile-profile-links]');
    if (title) title.textContent = profile.name || 'Štěpán Chrast';
    if (positioning) positioning.textContent = clean(profile.label || 'Data analysis / Research / Mathematical logic');
    if (intro) intro.textContent = clean(profile.intro || '');
    if (!links) return;
    links.replaceChildren();
    links.append(link('CV', '/cv/'));
    if (profile.email) links.append(link('Email', `mailto:${profile.email}`));
    (profile.links || []).forEach(item => links.append(link(item.label, item.href)));
  };

  const renderCurrent = () => {
    const host = gate.querySelector('[data-mobile-current]');
    if (!host) return;
    const current = byParent('experience')
      .filter(node => node.ongoing || node.status === 'ongoing')
      .sort((a, b) => (b.prominence || 0) - (a.prominence || 0))[0]
      || byParent('experience').sort((a, b) => (b.timelineOrder || 0) - (a.timelineOrder || 0))[0];
    host.replaceChildren();
    if (!current) return;
    const article = element('article', 'mobile-brief-item');
    article.append(element('h3', '', current.role ? `${current.role} / ${current.label}` : current.label));
    if (current.meta || current.status) article.append(element('p', 'mobile-brief-meta', current.meta || current.status));
    if (current.summary) article.append(element('p', 'mobile-brief-summary', current.summary));
    host.append(article);
  };

  const renderWork = () => {
    const host = gate.querySelector('[data-mobile-work]');
    if (!host) return;
    const selected = projects
      .filter(project => Number.isFinite(project.featuredRank))
      .sort((a, b) => a.featuredRank - b.featuredRank)
      .slice(0, 4);
    host.replaceChildren();
    selected.forEach(project => {
      const article = element('article', 'mobile-brief-item');
      article.append(element('h3', '', project.graphLabel || project.title));
      if (project.type) article.append(element('p', 'mobile-brief-meta', project.type));
      const summary = project.caseStudy?.oneLine || project.description;
      if (summary) article.append(element('p', 'mobile-brief-summary', summary));
      if (project.links?.length) {
        const links = element('div', 'mobile-brief-item-links');
        project.links.forEach(item => links.append(link(item.label.replace(/\s*↗\s*$/, ''), item.href)));
        article.append(links);
      }
      host.append(article);
    });
  };

  const renderAreas = () => {
    const host = gate.querySelector('[data-mobile-areas]');
    if (!host) return;
    host.replaceChildren();
    byParent('knowledge')
      .filter(node => node.id !== 'research-practice')
      .slice(0, 4)
      .forEach(node => {
        const article = element('article', 'mobile-brief-item');
        article.append(element('h3', '', node.label));
        if (node.summary) article.append(element('p', 'mobile-brief-summary', node.summary));
        host.append(article);
      });
  };

  const renderEducation = () => {
    const host = gate.querySelector('[data-mobile-education]');
    if (!host) return;
    host.replaceChildren();
    byParent('education')
      .filter(node => ['charles-university','charles-university-masters-logic','prg-ai','esslli'].includes(node.id))
      .sort((a, b) => {
        if (a.id === 'esslli') return 1;
        if (b.id === 'esslli') return -1;
        return (a.layoutOrder || 99) - (b.layoutOrder || 99);
      })
      .forEach(node => {
        const article = element('article', 'mobile-brief-item');
        article.append(element('h3', '', node.detailLabel || node.label));
        const meta = [node.organisation, node.meta].filter(Boolean).join(' / ');
        if (meta) article.append(element('p', 'mobile-brief-meta', meta));
        if (node.summary) article.append(element('p', 'mobile-brief-summary', node.summary));
        host.append(article);
      });
  };

  const renderCertifications = () => {
    const host = gate.querySelector('[data-mobile-certifications]');
    if (!host) return;
    host.replaceChildren();
    byParent('credentials')
      .sort((a, b) => (a.meta || '').localeCompare(b.meta || '') || a.label.localeCompare(b.label))
      .forEach(node => {
        const article = element('article', 'mobile-brief-item');
        article.append(element('h3', '', node.detailLabel || node.label));
        const meta = [node.organisation, node.meta].filter(Boolean).join(' / ');
        if (meta) article.append(element('p', 'mobile-brief-meta', meta));
        host.append(article);
      });
  };

  renderHeader();
  renderCurrent();
  renderWork();
  renderAreas();
  renderEducation();
  renderCertifications();

  gate.hidden = false;
  gate.tabIndex = -1;
  setUnderlyingInert(true);
  requestAnimationFrame(() => gate.focus({ preventScroll: true }));

  preview?.addEventListener('click', () => {
    try {
      sessionStorage.setItem('mobileConstructionPreview', 'true');
      sessionStorage.setItem('profileIntroSeen', 'true');
    } catch (_) {}
    html.dataset.mobileGate = 'preview';
    setUnderlyingInert(false);
    location.reload();
  });
})();
