(() => {
  const site = window.SITE_DATA;
  const host = document.getElementById('cv-content');
  if (!site || !host) return;

  const profile = site.profile || {};
  const nodes = site.graph?.nodes || [];
  const projects = [...(site.work?.projects || [])];
  const byParent = id => nodes.filter(node => node.parentIds?.includes(id));
  const current = byParent('experience')
    .filter(node => node.ongoing || node.status === 'ongoing')
    .sort((a,b) => (b.prominence || 0) - (a.prominence || 0))[0]
    || byParent('experience').sort((a,b) => (b.timelineOrder || 0) - (a.timelineOrder || 0))[0];

  const cleanText = value => String(value ?? '')
    .replace(/\s*—\s*/g, ': ')
    .replace(/;\s*/g, '. ');
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = cleanText(text);
    return node;
  };
  const link = (label, href) => {
    const a = el('a', '', label);
    a.href = href;
    if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noreferrer'; }
    return a;
  };
  const section = (title, key) => {
    const s = el('section', `cv-section cv-section-${key}`);
    s.append(el('h2', '', title));
    return s;
  };

  const header = el('header', 'cv-header');
  const title = el('div');
  title.append(el('h1', '', profile.name || 'Štěpán Chrast'), el('p', 'cv-positioning', profile.label || ''));
  const intro = el('p', 'cv-summary', profile.intro || '');
  const contacts = el('div', 'cv-contact');
  contacts.append(link(profile.email || 'Email', `mailto:${profile.email || ''}`));
  (profile.links || []).forEach(item => contacts.append(link(item.label, item.href)));
  contacts.append(link('Interactive portfolio', '/'));
  header.append(title, intro, contacts);

  if (current) {
    const currentLine = el('p', 'cv-current');
    currentLine.append(el('strong', '', 'Current: '), document.createTextNode([current.role, current.label].filter(Boolean).join(' · ')));
    header.append(currentLine);
  }

  const work = section('Selected Projects', 'projects');
  projects
    .filter(project => Number.isFinite(project.featuredRank))
    .sort((a,b) => a.featuredRank - b.featuredRank)
    .forEach(project => {
      const article = el('article', 'cv-item cv-project');
      const h = el('h3', '', project.title);
      const meta = el('p', 'cv-meta', project.type || '');
      const oneLine = el('p', 'cv-item-summary', project.caseStudy?.oneLine || project.description || '');
      article.append(h, meta, oneLine);
      const details = [
        ['Problem / context', project.caseStudy?.problem],
        ['My role', project.caseStudy?.role],
        ['Method', project.caseStudy?.method],
        ['Result / evidence', project.caseStudy?.result],
        ['Technologies / methods', (project.tech || []).join(' · ')]
      ].filter(([,value]) => value);
      const dl = el('dl', 'cv-details');
      details.forEach(([labelText, value]) => {
        dl.append(el('dt', '', labelText), el('dd', '', value));
      });
      article.append(dl);
      if (project.links?.length) {
        const links = el('p', 'cv-links');
        project.links.forEach((item, index) => {
          if (index) links.append(document.createTextNode(' · '));
          links.append(link(item.label.replace(/\s*↗\s*$/, ''), item.href));
        });
        article.append(links);
      } else if (project.note) {
        article.append(el('p', 'cv-note', project.note));
      }
      work.append(article);
    });

  const experience = section('Experience', 'experience');
  byParent('experience')
    .sort((a,b) => (b.startDate || b.meta || '').localeCompare(a.startDate || a.meta || ''))
    .forEach(item => {
      const article = el('article', 'cv-item');
      article.append(el('h3', '', item.role ? `${item.role} · ${item.label}` : item.label));
      article.append(el('p', 'cv-meta', item.meta || ''));
      if (item.summary) article.append(el('p', 'cv-item-summary', item.summary));
      if (item.highlights?.length) {
        const ul = el('ul', 'cv-compact-list');
        item.highlights.forEach(value => ul.append(el('li', '', value)));
        article.append(ul);
      }
      experience.append(article);
    });

  const education = section('Education', 'education');
  byParent('education')
    .filter(item => ['charles-university','charles-university-masters-logic','prg-ai','esslli'].includes(item.id))
    .sort((a,b) => {
      if (a.id === 'esslli') return 1;
      if (b.id === 'esslli') return -1;
      return (a.layoutOrder || 99) - (b.layoutOrder || 99);
    })
    .forEach(item => {
      const article = el('article', 'cv-item');
      article.append(el('h3', '', item.detailLabel || item.label));
      article.append(el('p', 'cv-meta', [item.organisation, item.meta].filter(Boolean).join(' · ')));
      if (item.summary) article.append(el('p', 'cv-item-summary', item.summary));
      education.append(article);
    });

  const certifications = section('Certifications', 'certifications');
  byParent('credentials')
    .sort((a,b) => (a.meta || '').localeCompare(b.meta || '') || a.label.localeCompare(b.label))
    .forEach(item => {
      const article = el('article', 'cv-item cv-certificate');
      article.append(el('h3', '', item.detailLabel || item.label));
      article.append(el('p', 'cv-meta', [item.organisation, item.meta].filter(Boolean).join(' · ')));
      certifications.append(article);
    });

  const areas = section('Core Areas', 'areas');
  const areaList = el('ul', 'cv-area-list');
  byParent('knowledge')
    .filter(item => item.id !== 'research-practice')
    .forEach(item => {
      const li = el('li');
      li.append(
        el('strong', '', item.label),
        document.createTextNode(item.summary ? `: ${cleanText(item.summary)}` : '')
      );
      areaList.append(li);
    });
  areas.append(areaList);

  host.replaceChildren(header, work, experience, education, certifications, areas);
  document.getElementById('cv-print')?.addEventListener('click', () => window.print());
})();
