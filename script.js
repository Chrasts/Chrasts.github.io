const menuButton = document.querySelector('.menu-button');
const navigation = document.querySelector('#main-nav');
const themeButton = document.querySelector('.theme-toggle');
const themeIcon = themeButton.querySelector('span');
const themeMeta = document.querySelector('meta[name="theme-color"]');
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
const savedTheme = () => {
  try { return localStorage.getItem('theme'); } catch (_) { return null; }
};

const currentTheme = () => document.documentElement.dataset.theme || 'light';

const updateThemeControl = () => {
  const dark = currentTheme() === 'dark';
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  themeButton.setAttribute('aria-label', label);
  themeButton.title = label;
  themeIcon.textContent = dark ? '☀' : '☾';
  themeMeta.setAttribute('content', dark ? '#11191c' : '#f7f3eb');
};

themeButton.addEventListener('click', () => {
  const theme = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('theme', theme); } catch (_) {}
  updateThemeControl();
});

systemTheme.addEventListener('change', event => {
  if (savedTheme()) return;
  document.documentElement.dataset.theme = event.matches ? 'dark' : 'light';
  updateThemeControl();
});

updateThemeControl();

const setMenuOpen = open => {
  navigation.classList.toggle('open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.textContent = open ? 'Close' : 'Menu';
};

menuButton.addEventListener('click', () => {
  setMenuOpen(!navigation.classList.contains('open'));
});

navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  setMenuOpen(false);
}));

document.addEventListener('click', event => {
  if (!navigation.classList.contains('open')) return;
  if (navigation.contains(event.target) || menuButton.contains(event.target)) return;
  setMenuOpen(false);
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !navigation.classList.contains('open')) return;
  setMenuOpen(false);
  menuButton.focus();
});

document.querySelector('#year').textContent = new Date().getFullYear();

const copyEmailButton = document.querySelector('.copy-email');
if (copyEmailButton) {
  copyEmailButton.addEventListener('click', async () => {
    const email = copyEmailButton.dataset.email;
    try {
      await navigator.clipboard.writeText(email);
      copyEmailButton.textContent = 'Copied';
    } catch (_) {
      const input = document.createElement('textarea');
      input.value = email;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
      copyEmailButton.textContent = 'Copied';
    }
    window.setTimeout(() => { copyEmailButton.textContent = 'Copy'; }, 1600);
  });
}

/* --------------------------------------------------------------------------
   WORK CONCEPT LATTICE
   -------------------------------------------------------------------------- */

(() => {
  const data = window.SITE_DATA?.work;
  const latticeRoot = document.querySelector('#work-lattice');
  const projectTabs = document.querySelector('#work-project-tabs');
  const projectDetail = document.querySelector('#work-project-detail');
  const contextRoot = document.querySelector('#work-context-filters');
  const themeRoot = document.querySelector('#work-theme-filters');
  const modeButtons = [...document.querySelectorAll('[data-theme-mode]')];
  const status = document.querySelector('#lattice-status');
  const resultCount = document.querySelector('#work-result-count');
  const resetButton = document.querySelector('#work-reset');
  const mapToggle = document.querySelector('#work-map-toggle');
  const mapContent = document.querySelector('#work-map-content');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  if (!data || !latticeRoot || !projectTabs || !projectDetail || !contextRoot || !themeRoot) return;

  const projects = [...data.projects].sort((a, b) => a.order - b.order);
  const attributes = data.attributes;
  const attributeIds = attributes.map(attribute => attribute.id);
  const attributeMap = new Map(attributes.map(attribute => [attribute.id, attribute]));
  const projectMap = new Map(projects.map(project => [project.id, project]));

  let activeContext = 'all';
  let selectedThemes = new Set();
  let themeMode = 'any';
  let selectedProjectId = projects[0]?.id || null;

  const subset = (left, right) => left.every(value => right.includes(value));
  const intersection = arrays => {
    if (!arrays.length) return [...attributeIds];
    return arrays.reduce(
      (result, current) => result.filter(value => current.includes(value)),
      [...arrays[0]]
    );
  };

  const keyForIntent = intent => [...intent].sort().join('|');

  const closure = seedIntent => {
    const extent = projects
      .filter(project => subset(seedIntent, project.lattice))
      .map(project => project.id);

    const intent = extent.length
      ? intersection(extent.map(id => projectMap.get(id).lattice))
      : [...attributeIds];

    return {
      extent: [...extent].sort(),
      intent: [...intent].sort()
    };
  };

  const powerSet = values => {
    const result = [[]];
    values.forEach(value => {
      result.push(...result.map(existing => [...existing, value]));
    });
    return result;
  };

  const buildConcepts = () => {
    const byIntent = new Map();

    powerSet(attributeIds).forEach(seed => {
      const concept = closure(seed);
      const key = keyForIntent(concept.intent);
      if (!byIntent.has(key)) byIntent.set(key, { ...concept, key });
    });

    return [...byIntent.values()];
  };

  const concepts = buildConcepts();
  const conceptMap = new Map(concepts.map(concept => [concept.key, concept]));
  const topConcept = [...concepts].sort((a, b) => a.intent.length - b.intent.length)[0];

  const attributeConcept = new Map(
    attributes.map(attribute => {
      const concept = closure([attribute.id]);
      return [attribute.id, keyForIntent(concept.intent)];
    })
  );

  const projectConcept = new Map(
    projects.map(project => {
      const concept = closure(project.lattice);
      return [project.id, keyForIntent(concept.intent)];
    })
  );

  concepts.forEach(concept => {
    concept.attributeLabels = attributes.filter(
      attribute => attributeConcept.get(attribute.id) === concept.key
    );
    concept.projectLabels = projects.filter(
      project => projectConcept.get(project.id) === concept.key
    );
  });

  // Keep the formal lattice internally, but suppress empty intermediate concepts
  // in the visual projection. Geometry remains stable under filtering.
  const displayConcepts = concepts.filter(concept =>
    concept.key === topConcept.key ||
    concept.attributeLabels.length > 0 ||
    concept.projectLabels.length > 0
  );

  const buildDisplayEdges = () => {
    displayConcepts.forEach(concept => {
      concept.displayUpper = [];
      concept.displayLower = [];
    });

    displayConcepts.forEach(upper => {
      displayConcepts.forEach(lower => {
        if (upper === lower) return;
        if (!subset(upper.intent, lower.intent)) return;
        if (upper.intent.length >= lower.intent.length) return;

        const hasVisibleIntermediate = displayConcepts.some(middle => {
          if (middle === upper || middle === lower) return false;
          return (
            subset(upper.intent, middle.intent) &&
            subset(middle.intent, lower.intent) &&
            upper.intent.length < middle.intent.length &&
            middle.intent.length < lower.intent.length
          );
        });

        if (!hasVisibleIntermediate) {
          upper.displayLower.push(lower.key);
          lower.displayUpper.push(upper.key);
        }
      });
    });
  };

  buildDisplayEdges();

  const renderContextFilters = () => {
    contextRoot.innerHTML = '';
    data.contextFilters.forEach(filter => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'work-filter';
      button.dataset.context = filter.id;
      button.textContent = filter.label;
      button.setAttribute('aria-pressed', String(filter.id === activeContext));
      button.addEventListener('click', () => {
        activeContext = filter.id;
        contextRoot.querySelectorAll('.work-filter').forEach(item => {
          item.setAttribute('aria-pressed', String(item.dataset.context === activeContext));
        });
        applyFilters();
      });
      contextRoot.appendChild(button);
    });
  };

  const syncThemeControls = () => {
    themeRoot.querySelectorAll('input[data-theme-id]').forEach(input => {
      input.checked = selectedThemes.has(input.dataset.themeId);
    });

    modeButtons.forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.themeMode === themeMode));
      button.disabled = selectedThemes.size < 2;
    });

    latticeRoot.querySelectorAll('.attribute-edge-label').forEach(label => {
      label.classList.toggle('is-selected', selectedThemes.has(label.dataset.attributeId));
    });
  };

  const toggleTheme = themeId => {
    if (selectedThemes.has(themeId)) selectedThemes.delete(themeId);
    else selectedThemes.add(themeId);
    if (selectedThemes.size < 2) themeMode = 'any';
    syncThemeControls();
    applyFilters();
  };

  const renderThemeFilters = () => {
    themeRoot.innerHTML = '';

    attributes.forEach(attribute => {
      const label = document.createElement('label');
      label.className = 'theme-filter-option';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.themeId = attribute.id;
      input.setAttribute('aria-label', attribute.label);

      const text = document.createElement('span');
      text.textContent = attribute.label;

      input.addEventListener('change', () => toggleTheme(attribute.id));
      label.addEventListener('mouseenter', () => focusTheme(attribute.id));
      label.addEventListener('mouseleave', clearFocus);
      input.addEventListener('focus', () => focusTheme(attribute.id));
      input.addEventListener('blur', clearFocus);

      label.append(input, text);
      themeRoot.appendChild(label);
    });

    modeButtons.forEach(button => {
      button.addEventListener('click', () => {
        themeMode = button.dataset.themeMode;
        syncThemeControls();
        applyFilters();
      });
    });
  };

  const renderProjectDetail = () => {
    const project = projectMap.get(selectedProjectId);
    projectDetail.innerHTML = '';

    if (!project || !projectMatchesFilters(project)) {
      const empty = document.createElement('p');
      empty.className = 'work-empty';
      empty.textContent = 'No projects match these filters. Reset them or choose a broader combination.';
      projectDetail.appendChild(empty);
      return;
    }

    const type = document.createElement('p');
    type.className = 'project-type';
    type.textContent = project.type;

    const title = document.createElement('h3');
    title.id = 'active-project-title';
    title.tabIndex = -1;
    title.textContent = project.title;

    const description = document.createElement('p');
    description.className = 'work-project-description';
    description.textContent = project.description;

    const tech = document.createElement('p');
    tech.className = 'work-project-tech';
    tech.textContent = project.tech.join(' · ');

    projectDetail.append(type, title, description, tech);

    if (project.note) {
      const note = document.createElement('span');
      note.className = 'project-note';
      note.textContent = project.note;
      projectDetail.appendChild(note);
    }

    if (project.links.length) {
      const links = document.createElement('div');
      links.className = 'work-project-links';
      project.links.forEach(link => {
        const anchor = document.createElement('a');
        anchor.href = link.href;
        anchor.target = '_blank';
        anchor.rel = 'noreferrer';
        anchor.textContent = link.label;
        links.appendChild(anchor);
      });
      projectDetail.appendChild(links);
    }
  };

  const selectProject = (projectId, { focusDetail = false } = {}) => {
    const project = projectMap.get(projectId);
    if (!project || !projectMatchesFilters(project)) return;

    selectedProjectId = projectId;
    projectTabs.querySelectorAll('.work-project-tab').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.projectId === selectedProjectId));
    });
    latticeRoot.querySelectorAll('[data-project-anchor]').forEach(anchor => {
      anchor.classList.toggle('is-active', anchor.dataset.projectAnchor === selectedProjectId);
    });
    renderProjectDetail();

    if (focusDetail) {
      projectDetail.querySelector('h3')?.focus({ preventScroll: true });
      if (matchMedia('(max-width: 900px)').matches) {
        projectDetail.scrollIntoView({
          behavior: reducedMotion.matches ? 'auto' : 'smooth',
          block: 'nearest'
        });
      }
    }
  };

  const renderProjects = () => {
    projectTabs.innerHTML = '';

    projects.forEach(project => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'work-project-tab';
      button.dataset.projectId = project.id;
      button.setAttribute('aria-pressed', String(project.id === selectedProjectId));
      button.setAttribute('aria-label', `Select ${project.title}`);

      const label = document.createElement('span');
      label.textContent = project.graphLabel;

      button.append(label);
      button.addEventListener('click', () => selectProject(project.id));
      button.addEventListener('mouseenter', () => focusProject(project.id));
      button.addEventListener('mouseleave', clearFocus);
      button.addEventListener('focus', () => focusProject(project.id));
      button.addEventListener('blur', clearFocus);
      projectTabs.appendChild(button);
    });

    renderProjectDetail();
  };

  const themeMatchCount = project =>
    [...selectedThemes].filter(themeId => project.lattice.includes(themeId)).length;

  const projectMatchesFilters = project => {
    const contextMatch =
      activeContext === 'all' || project.contexts.includes(activeContext);

    if (!contextMatch) return false;
    if (!selectedThemes.size) return true;

    const count = themeMatchCount(project);
    return themeMode === 'all'
      ? count === selectedThemes.size
      : count > 0;
  };

  const visibleProjects = () => projects.filter(projectMatchesFilters);

  const selectedDownsetKeys = () => {
    if (!selectedThemes.size) return new Set();

    const selected = [...selectedThemes];

    return new Set(
      displayConcepts
        .filter(concept => {
          const matches = selected.filter(themeId => concept.intent.includes(themeId)).length;
          return themeMode === 'all'
            ? matches === selected.length
            : matches > 0;
        })
        .map(concept => concept.key)
    );
  };

  const applySelectedThemeHighlight = () => {
    const downKeys = selectedDownsetKeys();

    latticeRoot.querySelectorAll('.concept-node').forEach(node => {
      node.classList.toggle(
        'is-selected-downset',
        downKeys.has(node.dataset.conceptKey)
      );
    });

    latticeRoot.querySelectorAll('.concept-edges line').forEach(edge => {
      const inSelectedDownset =
        downKeys.has(edge.dataset.edgeUpper) &&
        downKeys.has(edge.dataset.edgeLower);

      edge.classList.toggle('is-selected-downset', inSelectedDownset);
    });
  };

  const applyFilters = () => {
    const visible = visibleProjects();
    const visibleIds = new Set(visible.map(project => project.id));
    const selectedCount = selectedThemes.size;

    projectTabs.querySelectorAll('.work-project-tab').forEach(button => {
      button.hidden = !visibleIds.has(button.dataset.projectId);
    });

    if (!visibleIds.has(selectedProjectId)) selectedProjectId = visible[0]?.id || null;

    projectTabs.querySelectorAll('.work-project-tab').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.projectId === selectedProjectId));
    });
    latticeRoot.querySelectorAll('[data-project-anchor]').forEach(anchor => {
      anchor.classList.toggle('is-active', anchor.dataset.projectAnchor === selectedProjectId);
    });

    latticeRoot.querySelectorAll('[data-project-anchor]').forEach(anchor => {
      const project = projectMap.get(anchor.dataset.projectAnchor);
      const visible = visibleIds.has(project.id);
      const text = anchor.querySelector('text');
      const baseLabel = anchor.dataset.baseLabel;

      anchor.classList.toggle('is-filtered-out', !visible);
      anchor.classList.remove('theme-match-1', 'theme-match-2', 'theme-match-3', 'theme-match-4');

      if (visible && selectedCount && themeMode === 'any') {
        anchor.classList.add(`theme-match-${Math.min(count, 4)}`);
      }

      if (text) text.textContent = baseLabel;
    });

    latticeRoot.querySelectorAll('[data-concept-key]').forEach(node => {
      const concept = conceptMap.get(node.dataset.conceptKey);
      const hasVisibleExtent = concept.extent.some(id => visibleIds.has(id));
      node.classList.toggle('is-filtered-out', !hasVisibleExtent && concept.key !== topConcept.key);
    });

    latticeRoot.querySelectorAll('[data-attribute-concept]').forEach(label => {
      const concept = conceptMap.get(label.dataset.attributeConcept);
      const hasVisibleExtent = concept.extent.some(id => visibleIds.has(id));
      label.classList.toggle('is-filtered-out', !hasVisibleExtent);
    });

    const countLabel = `${visible.length} of ${projects.length} ${visible.length === 1 ? 'project' : 'projects'}`;
    if (resultCount) resultCount.textContent = countLabel;
    if (resetButton) resetButton.disabled = activeContext === 'all' && !selectedThemes.size && themeMode === 'any';

    syncThemeControls();
    clearFocus();
    renderProjectDetail();
  };

  if (resetButton) {
    resetButton.addEventListener('click', () => {
      activeContext = 'all';
      selectedThemes = new Set();
      themeMode = 'any';
      contextRoot.querySelectorAll('.work-filter').forEach(item => {
        item.setAttribute('aria-pressed', String(item.dataset.context === 'all'));
      });
      applyFilters();
    });
  }

  const setMapExpanded = expanded => {
    if (!mapToggle || !mapContent) return;
    mapContent.classList.toggle('is-collapsed', !expanded);
    mapToggle.setAttribute('aria-expanded', String(expanded));
    mapToggle.textContent = expanded ? 'Hide map' : 'Show map';
  };

  if (mapToggle && mapContent) {
    const mobileMap = matchMedia('(max-width: 900px)');
    setMapExpanded(!mobileMap.matches);
    mapToggle.addEventListener('click', () => {
      setMapExpanded(mapToggle.getAttribute('aria-expanded') !== 'true');
    });
    mobileMap.addEventListener('change', event => setMapExpanded(!event.matches));
  }

  const conceptLabel = concept => {
    if (concept.key === topConcept.key) return 'All work';
    return concept.intent.map(id => attributeMap.get(id)?.label || id).join(' ∩ ');
  };

  const activateConcept = concept => {
    selectedThemes = new Set(concept.key === topConcept.key ? [] : concept.intent);
    themeMode = selectedThemes.size > 1 ? 'all' : 'any';
    applyFilters();
    if (status) {
      status.textContent = concept.key === topConcept.key
        ? 'Theme filters cleared.'
        : `${conceptLabel(concept)} filters selected.`;
    }
  };

  const hashKey = key => {
    let hash = 0;
    for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return hash;
  };

  const spreadLevel = (level, preferred, left, right, minGap) => {
    if (level.length === 1) return [{ concept: level[0], x: preferred(level[0]) }];

    const items = level
      .map(concept => ({ concept, x: preferred(concept) }))
      .sort((a, b) => a.x - b.x);

    for (let i = 1; i < items.length; i += 1) {
      items[i].x = Math.max(items[i].x, items[i - 1].x + minGap);
    }

    if (items[items.length - 1].x > right) {
      const shift = items[items.length - 1].x - right;
      items.forEach(item => { item.x -= shift; });
    }

    for (let i = items.length - 2; i >= 0; i -= 1) {
      items[i].x = Math.min(items[i].x, items[i + 1].x - minGap);
    }

    if (items[0].x < left) {
      const shift = left - items[0].x;
      items.forEach(item => { item.x += shift; });
    }

    return items;
  };

  const layoutConcepts = () => {
    const width = 900;
    const height = 500;
    const left = 92;
    const right = 808;
    const top = 42;
    const bottom = 420;
    const positions = new Map();

    const themeAnchors = new Map(
      attributes.map((attribute, index) => [
        attribute.id,
        attributes.length === 1
          ? width / 2
          : left + ((right - left) * index) / (attributes.length - 1)
      ])
    );

    const ranks = [...new Set(displayConcepts.map(concept => concept.intent.length))]
      .sort((a, b) => a - b);
    const maxRank = Math.max(...ranks, 1);

    const preferredX = concept => {
      if (!concept.intent.length) return width / 2;
      if (concept.intent.length === 1) return themeAnchors.get(concept.intent[0]) ?? width / 2;

      const mean = concept.intent.reduce(
        (sum, id) => sum + (themeAnchors.get(id) ?? width / 2),
        0
      ) / concept.intent.length;

      const jitter = ((hashKey(concept.key) % 47) - 23) * 0.9;
      return mean + jitter;
    };

    ranks.forEach(rank => {
      const level = displayConcepts.filter(concept => concept.intent.length === rank);
      const y = top + ((bottom - top) * rank) / maxRank;

      if (rank === 0) {
        positions.set(level[0].key, { x: width / 2, y });
        return;
      }

      const gap = rank === 1 ? 180 : rank === 2 ? 155 : 142;
      spreadLevel(level, preferredX, left, right, gap).forEach(({ concept, x }, index) => {
        // Small alternating offset avoids visually rigid vertical columns without
        // changing the order of the concepts inside the rank.
        const stagger = rank > 1 ? (index % 2 === 0 ? -9 : 9) : 0;
        positions.set(concept.key, { x: x + stagger, y });
      });
    });

    return { width, height, positions };
  };

  const renderLattice = () => {
    const { width, height, positions } = layoutConcepts();
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute(
      'aria-label',
      'Reduced concept-lattice view grouping portfolio projects by shared themes.'
    );
    svg.classList.add('work-lattice-svg');

    const edgesGroup = document.createElementNS(svgNS, 'g');
    edgesGroup.classList.add('concept-edges');

    displayConcepts.forEach(upper => {
      upper.displayLower.forEach(lowerKey => {
        const start = positions.get(upper.key);
        const end = positions.get(lowerKey);
        const line = document.createElementNS(svgNS, 'line');

        line.setAttribute('x1', start.x);
        line.setAttribute('y1', start.y);
        line.setAttribute('x2', end.x);
        line.setAttribute('y2', end.y);
        line.dataset.edgeUpper = upper.key;
        line.dataset.edgeLower = lowerKey;
        edgesGroup.appendChild(line);
      });
    });

    svg.appendChild(edgesGroup);

    const attributeLabelsGroup = document.createElementNS(svgNS, 'g');
    attributeLabelsGroup.classList.add('attribute-edge-labels');
    const topPosition = positions.get(topConcept.key);

    attributes.forEach(attribute => {
      const conceptKey = attributeConcept.get(attribute.id);
      const conceptPosition = positions.get(conceptKey);
      if (!conceptPosition) return;

      const group = document.createElementNS(svgNS, 'g');
      group.classList.add('attribute-edge-label');
      group.dataset.attributeId = attribute.id;
      group.dataset.attributeConcept = conceptKey;

      // One third of the top edge away from the maximal node.
      const labelT = 2 / 3;
      const labelX = topPosition.x + (conceptPosition.x - topPosition.x) * labelT;
      const labelY = topPosition.y + (conceptPosition.y - topPosition.y) * labelT;
      group.setAttribute('transform', `translate(${labelX} ${labelY})`);
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      group.setAttribute('aria-label', `${attribute.label}. Preview or toggle this theme.`);

      const buttonGroup = document.createElementNS(svgNS, 'g');
      buttonGroup.classList.add('theme-edge-button');

      const labelWidth = Math.max(92, 22 + attribute.label.length * 5.7);
      const rect = document.createElementNS(svgNS, 'rect');
      rect.classList.add('theme-edge-box');
      rect.setAttribute('x', String(-labelWidth / 2));
      rect.setAttribute('y', '-13');
      rect.setAttribute('width', String(labelWidth));
      rect.setAttribute('height', '26');
      rect.setAttribute('rx', '4');

      const text = document.createElementNS(svgNS, 'text');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('y', '3.5');
      text.textContent = attribute.label;

      buttonGroup.append(rect, text);
      group.appendChild(buttonGroup);

      group.addEventListener('mouseenter', event => {
        event.stopPropagation();
        focusTheme(attribute.id);
      });
      group.addEventListener('mouseleave', event => {
        event.stopPropagation();
        clearFocus();
      });
      group.addEventListener('focus', event => {
        event.stopPropagation();
        focusTheme(attribute.id);
      });
      group.addEventListener('blur', clearFocus);
      group.addEventListener('click', event => {
        event.stopPropagation();
        toggleTheme(attribute.id);
      });
      group.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleTheme(attribute.id);
        }
      });

      attributeLabelsGroup.appendChild(group);
    });

    svg.appendChild(attributeLabelsGroup);

    const nodesGroup = document.createElementNS(svgNS, 'g');
    nodesGroup.classList.add('concept-nodes');

    displayConcepts.forEach(concept => {
      const position = positions.get(concept.key);
      const group = document.createElementNS(svgNS, 'g');
      group.classList.add('concept-node');
      group.dataset.conceptKey = concept.key;
      group.setAttribute('transform', `translate(${position.x} ${position.y})`);
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      group.setAttribute('aria-label', `${conceptLabel(concept)}. ${concept.extent.length} related projects. Activate to filter.`);

      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('r', concept.extent.length ? '5.6' : '4.2');
      circle.classList.add('concept-dot');
      group.appendChild(circle);

      if (concept.key === topConcept.key) {
        const topLabel = document.createElementNS(svgNS, 'text');
        topLabel.classList.add('concept-top-label');
        topLabel.setAttribute('text-anchor', 'middle');
        topLabel.setAttribute('y', '-16');
        topLabel.textContent = 'ALL WORK';
        group.appendChild(topLabel);
      }

      if (concept.projectLabels.length) {
        const projectGroup = document.createElementNS(svgNS, 'g');
        projectGroup.classList.add('concept-project-labels');

        concept.projectLabels.forEach((project, projectIndex) => {
          const anchor = document.createElementNS(svgNS, 'g');
          anchor.classList.add('concept-project-anchor');
          anchor.dataset.projectAnchor = project.id;
          anchor.dataset.baseLabel = project.graphLabel;
          anchor.setAttribute('tabindex', '0');
          anchor.setAttribute('role', 'link');
          anchor.setAttribute('aria-label', `${project.title}. Show project details.`);

          const yBase = 22 + projectIndex * 22;
          const text = document.createElementNS(svgNS, 'text');
          text.setAttribute('text-anchor', 'middle');
          text.setAttribute('y', String(yBase));
          text.textContent = anchor.dataset.baseLabel;
          anchor.appendChild(text);

          anchor.addEventListener('mouseenter', event => {
            event.stopPropagation();
            focusProject(project.id);
          });
          anchor.addEventListener('mouseleave', event => {
            event.stopPropagation();
            clearFocus();
          });
          anchor.addEventListener('focus', event => {
            event.stopPropagation();
            focusProject(project.id);
          });
          anchor.addEventListener('blur', clearFocus);
          anchor.addEventListener('click', event => {
            event.stopPropagation();
            selectProject(project.id, { focusDetail: true });
          });
          anchor.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.stopPropagation();
              selectProject(project.id, { focusDetail: true });
            }
          });

          projectGroup.appendChild(anchor);
        });

        group.appendChild(projectGroup);
      }

      group.addEventListener('mouseenter', () => focusNode(concept.key));
      group.addEventListener('mouseleave', clearFocus);
      group.addEventListener('focus', () => focusNode(concept.key));
      group.addEventListener('blur', clearFocus);
      group.addEventListener('click', () => activateConcept(concept));
      group.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activateConcept(concept);
        }
      });

      nodesGroup.appendChild(group);
    });

    svg.appendChild(nodesGroup);
    latticeRoot.innerHTML = '';
    latticeRoot.appendChild(svg);
  };

  const clearGraphClasses = () => {
    latticeRoot.querySelectorAll('.concept-node').forEach(node => {
      node.classList.remove(
        'is-path-soft', 'is-path-strong', 'is-origin-soft', 'is-origin-strong', 'is-muted'
      );
    });
    latticeRoot.querySelectorAll('.concept-edges line').forEach(edge => {
      edge.classList.remove('is-path-soft', 'is-path-strong', 'is-muted');
    });
    latticeRoot.querySelectorAll('.concept-project-anchor').forEach(anchor => {
      anchor.classList.remove('is-focus', 'is-related', 'is-muted');
    });
    projectTabs.querySelectorAll('.work-project-tab').forEach(tab => {
      tab.classList.remove('is-focus', 'is-muted');
    });
    latticeRoot.querySelectorAll('.attribute-edge-label').forEach(label => {
      label.classList.remove(
        'is-focus', 'is-path-soft', 'is-path-strong', 'is-project-related', 'is-node-related', 'is-muted'
      );
    });
  };

  const focusTheme = themeId => {
    clearGraphClasses();

    const conceptKey = attributeConcept.get(themeId);
    const themeConcept = conceptMap.get(conceptKey);
    const downKeys = new Set(
      displayConcepts
        .filter(candidate => subset(themeConcept.intent, candidate.intent))
        .map(candidate => candidate.key)
    );
    const relatedProjects = new Set(themeConcept.extent);

    latticeRoot.querySelectorAll('.concept-node').forEach(node => {
      const related = downKeys.has(node.dataset.conceptKey);
      node.classList.toggle('is-path-soft', related);
      node.classList.toggle('is-muted', !related);
    });

    latticeRoot.querySelectorAll('.concept-edges line').forEach(edge => {
      const related = downKeys.has(edge.dataset.edgeUpper) && downKeys.has(edge.dataset.edgeLower);
      edge.classList.toggle('is-path-soft', related);
      edge.classList.toggle('is-muted', !related);
    });

    latticeRoot.querySelectorAll('.concept-project-anchor').forEach(anchor => {
      const related = relatedProjects.has(anchor.dataset.projectAnchor);
      anchor.classList.toggle('is-related', related);
      anchor.classList.toggle('is-muted', !related);
    });

    latticeRoot.querySelectorAll('.attribute-edge-label').forEach(label => {
      const active = label.dataset.attributeId === themeId;
      label.classList.toggle('is-focus', active);
      label.classList.toggle('is-muted', !active && !selectedThemes.has(label.dataset.attributeId));
    });

    if (status) status.textContent = `${attributeMap.get(themeId)?.label || themeId}. Related projects highlighted.`;
  };

  const upstreamKeysForConcept = concept => new Set(
    displayConcepts
      .filter(candidate => subset(candidate.intent, concept.intent))
      .map(candidate => candidate.key)
  );

  const focusProject = projectId => {
    const project = projectMap.get(projectId);
    if (!project) return;

    clearGraphClasses();

    const objectConceptKey = projectConcept.get(projectId);
    const objectConcept = conceptMap.get(objectConceptKey);
    const upstreamKeys = upstreamKeysForConcept(objectConcept);

    latticeRoot.querySelectorAll('.concept-node').forEach(node => {
      node.classList.toggle('is-origin-soft', node.dataset.conceptKey === objectConceptKey);
    });

    latticeRoot.querySelectorAll('.concept-edges line').forEach(edge => {
      const onThemePath = upstreamKeys.has(edge.dataset.edgeUpper) && upstreamKeys.has(edge.dataset.edgeLower);
      edge.classList.toggle('is-path-soft', onThemePath);
      edge.classList.toggle('is-muted', !onThemePath);
    });

    latticeRoot.querySelectorAll('.concept-project-anchor').forEach(anchor => {
      const focused = anchor.dataset.projectAnchor === projectId;
      anchor.classList.toggle('is-focus', focused);
      anchor.classList.toggle('is-muted', !focused);
    });

    projectTabs.querySelectorAll('.work-project-tab').forEach(tab => {
      const focused = tab.dataset.projectId === projectId;
      tab.classList.toggle('is-focus', focused);
      tab.classList.toggle('is-muted', !focused);
    });

    latticeRoot.querySelectorAll('.attribute-edge-label').forEach(label => {
      const related = project.lattice.includes(label.dataset.attributeId);
      label.classList.toggle('is-project-related', related);
      label.classList.toggle('is-path-soft', related);
      label.classList.toggle('is-muted', !related);
    });

    if (status) {
      const attrNames = project.lattice.map(id => attributeMap.get(id)?.label || id).join(' · ');
      status.textContent = `${project.title}. ${attrNames}.`;
    }
  };

  const focusNode = conceptKey => {
    const concept = conceptMap.get(conceptKey);
    if (!concept) return;

    clearGraphClasses();

    // Top element: symbolically expose the four principal themes only.
    if (conceptKey === topConcept.key) {
      const principalConceptKeys = new Set(attributeConcept.values());

      latticeRoot.querySelectorAll('.concept-node').forEach(node => {
        node.classList.toggle('is-origin-strong', node.dataset.conceptKey === topConcept.key);
      });

      latticeRoot.querySelectorAll('.concept-edges line').forEach(edge => {
        const principalEdge =
          edge.dataset.edgeUpper === topConcept.key &&
          principalConceptKeys.has(edge.dataset.edgeLower);
        edge.classList.toggle('is-path-strong', principalEdge);
      });

      latticeRoot.querySelectorAll('.attribute-edge-label').forEach(label => {
        label.classList.add('is-node-related', 'is-path-strong');
      });

      if (status) status.textContent = 'All work. Principal themes highlighted.';
      return;
    }

    const upstreamKeys = upstreamKeysForConcept(concept);
    const relevantThemes = new Set(concept.intent);

    latticeRoot.querySelectorAll('.concept-node').forEach(node => {
      const related = upstreamKeys.has(node.dataset.conceptKey);
      node.classList.toggle('is-path-strong', related);
      node.classList.toggle('is-origin-strong', node.dataset.conceptKey === conceptKey);
      node.classList.toggle('is-muted', !related);
    });

    latticeRoot.querySelectorAll('.concept-edges line').forEach(edge => {
      const related = upstreamKeys.has(edge.dataset.edgeUpper) && upstreamKeys.has(edge.dataset.edgeLower);
      edge.classList.toggle('is-path-strong', related);
      edge.classList.toggle('is-muted', !related);
    });

    latticeRoot.querySelectorAll('.concept-project-anchor').forEach(anchor => {
      const belongsHere = projectConcept.get(anchor.dataset.projectAnchor) === conceptKey;
      anchor.classList.toggle('is-related', belongsHere);
      anchor.classList.toggle('is-muted', !belongsHere);
    });

    latticeRoot.querySelectorAll('.attribute-edge-label').forEach(label => {
      const related = relevantThemes.has(label.dataset.attributeId);
      label.classList.toggle('is-node-related', related);
      label.classList.toggle('is-path-strong', related);
      label.classList.toggle(
        'is-muted',
        !related && !selectedThemes.has(label.dataset.attributeId)
      );
    });

    if (status) status.textContent = `${conceptLabel(concept)}.`;
  };

  const clearFocus = () => {
    clearGraphClasses();
    syncThemeControls();
    applySelectedThemeHighlight();
    if (status) status.textContent = '';
  };

  renderContextFilters();
  renderThemeFilters();
  renderProjects();
  renderLattice();
  syncThemeControls();
  applyFilters();
})();
