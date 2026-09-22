(() => {
  const site = window.SITE_DATA;
  const host = document.getElementById('cv-content');
  if (!site || !host) return;

  const profile = site.profile || {};
  const nodes = site.graph?.nodes || [];
  const projects = [...(site.work?.projects || [])];
  const byParent = id => nodes.filter(node => node.parentIds?.includes(id));
  const byId = id => nodes.find(node => node.id === id);
  const projectById = id => projects.find(project => project.id === id);
  const views = {
    academic: {
      key: 'academic',
      name: 'Academic CV',
      positioning: 'Mathematical logic · Algebraic logic · Research',
      summary: "Master's student in Logic focused on algebraic and non-classical logic, universal algebra and computational support for formal research.",
      projectIds: ['bachelor-thesis', 'arol-lab', 'clp-survey', 'modal-logic-lab'],
      experienceIds: ['ceske-priority'],
      areaIds: ['mathematical-logic', 'algebraic-logic', 'universal-algebra', 'lattice-theory', 'computational-logic'],
      areaTitle: 'Academic Focus',
      projectsTitle: 'Selected Research & Projects',
      credentialsTitle: 'Additional Credentials',
      sectionOrder: ['education', 'projects', 'areas', 'experience', 'credentials']
    },
    'data-analysis': {
      key: 'data-analysis',
      name: 'Data Analysis CV',
      positioning: 'Data analysis · Applied research · Reproducible workflows',
      summary: 'Data analyst and researcher working with Python-based analysis, data validation, visualisation and reproducible reporting.',
      projectIds: ['social-workers-survey', 'insolvency', 'film-splitter', 'sql-schema'],
      experienceIds: ['ceske-priority'],
      areaIds: ['data-analysis', 'statistics', 'survey-analysis', 'data-qa', 'visualisation', 'programming-automation', 'data-modelling'],
      areaTitle: 'Core Data Skills',
      tools: ['Python', 'pandas', 'SQL', 'MySQL', 'openpyxl', 'Matplotlib'],
      projectsTitle: 'Selected Projects',
      credentialsTitle: 'Additional Credentials',
      sectionOrder: ['experience', 'projects', 'areas', 'education', 'credentials']
    }
  };

  const cleanText = value => String(value ?? '')
    .replace(/\s*—\s*/g, ': ')
    .replace(/;\s*/g, '. ');
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = cleanText(text);
    return node;
  };
  const link = (label, href, cls = '') => {
    const a = el('a', cls, label);
    const target = /^assets\//.test(href) ? `/${href}` : href;
    a.href = target;
    if (/^https?:/.test(target)) {
      a.target = '_blank';
      a.rel = 'noreferrer';
    }
    return a;
  };
  const section = (title, key) => {
    const s = el('section', `cv-section cv-section-${key}`);
    s.append(el('h2', '', title));
    return s;
  };

  const printButton = document.getElementById('cv-print');
  const switchLink = document.getElementById('cv-switch');
  const params = new URLSearchParams(window.location.search);
  const view = views[params.get('view')];

  const setDocumentState = selected => {
    if (printButton) printButton.hidden = !selected;
    if (switchLink) switchLink.hidden = !selected;
    document.body.dataset.cvView = selected?.key || 'chooser';
    document.title = selected
      ? `Štěpán Chrast - ${selected.name}`
      : 'Štěpán Chrast - CV';
  };

  const renderChooser = () => {
    setDocumentState(null);

    const chooser = el('section', 'cv-chooser');
    const heading = el('h1', '', 'Choose CV');
    const intro = el(
      'p',
      'cv-chooser-intro',
      'Two focused versions built from the same portfolio. Choose the one closest to the role or context.'
    );
    const options = el('nav', 'cv-choice-grid');
    options.setAttribute('aria-label', 'CV versions');

    [
      {
        view: views.academic,
        description: 'Mathematical logic, research, thesis work and computational logic.'
      },
      {
        view: views['data-analysis'],
        description: 'Data analysis, applied research, reproducible workflows and data modelling.'
      }
    ].forEach(({ view: item, description }) => {
      const choice = link(item.name, `?view=${item.key}`, 'cv-choice');
      choice.append(el('span', 'cv-choice-description', description));
      options.append(choice);
    });

    chooser.append(heading, intro, options);
    host.replaceChildren(chooser);
  };

  const renderHeader = selected => {
    const header = el('header', 'cv-header');
    const title = el('div');
    title.append(
      el('h1', '', profile.name || 'Štěpán Chrast'),
      el('p', 'cv-positioning', selected.positioning)
    );

    const intro = el('p', 'cv-summary', selected.summary);
    const contacts = el('div', 'cv-contact');
    contacts.append(link(profile.email || 'Email', `mailto:${profile.email || ''}`));
    (profile.links || []).forEach(item => contacts.append(link(item.label, item.href)));
    contacts.append(link('Interactive portfolio', '/'));
    header.append(title, intro, contacts);

    return header;
  };

  const renderProjects = selected => {
    const work = section(selected.projectsTitle || 'Selected Projects', 'projects');

    selected.projectIds
      .map(projectById)
      .filter(Boolean)
      .forEach(project => {
        const article = el('article', 'cv-item cv-project cv-project-compact');
        article.append(
          el('h3', '', project.title),
          el('p', 'cv-meta', project.type || ''),
          el('p', 'cv-item-summary', project.caseStudy?.oneLine || project.description || '')
        );

        const details = [
          ['Role', project.caseStudy?.role],
          ['Method', project.caseStudy?.method],
          ['Evidence', project.caseStudy?.result]
        ].filter(([,value]) => value);
        if (details.length) {
          const dl = el('dl', 'cv-details cv-details-compact');
          details.forEach(([labelText, value]) => {
            dl.append(el('dt', '', labelText), el('dd', '', value));
          });
          article.append(dl);
        }

        if (project.links?.length) {
          const links = el('p', 'cv-links');
          project.links.forEach((item, index) => {
            if (index) links.append(document.createTextNode(' · '));
            links.append(link(item.label.replace(/\s*↗\s*$/, ''), item.href));
          });
          article.append(links);
        }

        if (project.facets?.visibility === 'private') {
          const privateLabel = project.contexts?.includes('professional')
            ? 'Private professional work'
            : 'Private research materials';
          article.append(el(
            'p',
            'cv-note cv-private-note',
            `${privateLabel}: ${project.note || 'Underlying materials are not public.'}`
          ));
        } else if (!project.links?.length && project.note) {
          article.append(el('p', 'cv-note', project.note));
        }

        work.append(article);
      });

    return work;
  };

  const renderExperience = selected => {
    const experience = section('Experience', 'experience');
    selected.experienceIds
      .map(byId)
      .filter(Boolean)
      .forEach(item => {
        const article = el('article', 'cv-item');
        article.append(el('h3', 'cv-role', item.role || item.label));
        const metaParts = [item.role ? item.label : null, item.organisation, item.meta]
          .filter((value, index, values) => value && values.indexOf(value) === index);
        article.append(el('p', 'cv-meta cv-experience-meta', metaParts.join(' · ')));
        if (item.summary) article.append(el('p', 'cv-item-summary', item.summary));
        if (item.highlights?.length) {
          const ul = el('ul', 'cv-compact-list');
          item.highlights.forEach(value => ul.append(el('li', '', value)));
          article.append(ul);
        }
        experience.append(article);
      });
    return experience;
  };

  const renderEducation = () => {
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
    return education;
  };

  const renderCertifications = selected => {
    const certifications = section(selected.credentialsTitle || 'Additional Credentials', 'certifications');
    byParent('credentials')
      .sort((a,b) => (a.meta || '').localeCompare(b.meta || '') || a.label.localeCompare(b.label))
      .forEach(item => {
        const article = el('article', 'cv-item cv-certificate');
        article.append(el('h3', '', item.detailLabel || item.label));
        article.append(el('p', 'cv-meta', [item.organisation, item.meta].filter(Boolean).join(' · ')));
        certifications.append(article);
      });
    return certifications;
  };

  const renderAreas = selected => {
    const areas = section(selected.areaTitle, 'areas');
    const areaList = el('ul', 'cv-area-list cv-area-list-compact');
    selected.areaIds
      .map(byId)
      .filter(Boolean)
      .forEach(item => areaList.append(el('li', '', item.label)));
    areas.append(areaList);
    if (selected.tools?.length) {
      const tools = el('p', 'cv-tech-stack');
      tools.append(
        el('strong', '', 'Technical tools: '),
        document.createTextNode(selected.tools.join(', '))
      );
      areas.append(tools);
    }
    return areas;
  };

  const renderCv = selected => {
    setDocumentState(selected);
    const renderers = {
      projects: () => renderProjects(selected),
      experience: () => renderExperience(selected),
      education: () => renderEducation(),
      credentials: () => renderCertifications(selected),
      areas: () => renderAreas(selected)
    };
    const sections = selected.sectionOrder
      .map(key => renderers[key]?.())
      .filter(Boolean);

    host.replaceChildren(renderHeader(selected), ...sections);
  };

  if (view) renderCv(view);
  else renderChooser();

  printButton?.addEventListener('click', () => window.print());
})();