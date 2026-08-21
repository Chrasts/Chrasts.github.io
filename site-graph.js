(() => {
  const boot = () => {
    const site = window.SITE_DATA;
    const graph = site?.graph;
    const work = site?.work;
    if (!site?.profile || !graph?.nodes?.length || !work?.projects?.length) return;

    if (!document.querySelector('link[data-profile-graph-v5]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'graph-v5.css';
      link.dataset.profileGraphV5 = 'true';
      document.head.appendChild(link);
    }

    const root = document.querySelector('#site-graph');
    const graphPanel = root?.closest('.site-graph-panel');
    const explorer = document.querySelector('#site-explorer');
    const scene = document.querySelector('.scene-canvas');
    const breadcrumb = document.querySelector('#graph-breadcrumb');
    const routebar = document.querySelector('.graph-routebar');
    const title = document.querySelector('#site-graph-title');
    const kicker = document.querySelector('#site-graph-kicker');
    const help = document.querySelector('#site-graph-help');
    const status = document.querySelector('#site-graph-status');
    const detail = document.querySelector('#site-detail-panel');
    const atlasControls = document.querySelector('#atlas-controls');
    const atlasHierarchy = document.querySelector('#atlas-hierarchy');
    const atlasCrosslinks = document.querySelector('#atlas-crosslinks');
    const atlasSecondary = document.querySelector('#atlas-secondary');
    const atlasShowAll = document.querySelector('#atlas-show-all');
    const atlasFit = document.querySelector('#atlas-fit');
    const atlasZoomIn = document.querySelector('#atlas-zoom-in');
    const atlasZoomOut = document.querySelector('#atlas-zoom-out');
    const atlasReset = document.querySelector('#atlas-reset');
    const hero = document.querySelector('.hero');
    const workLegacy = document.querySelector('#work');
    const footer = document.querySelector('footer');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

    // Compatibility with a legacy hidden Work-renderer branch that references a global `count`.
    if (!('count' in window)) window.count = 1;

    if (!root || !graphPanel || !explorer || !scene || !breadcrumb || !detail || !hero) return;

    const svgNS = 'http://www.w3.org/2000/svg';
    const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
    const profileRoot = nodeMap.get(graph.rootId);
    const workRoot = nodeMap.get('work');
    if (!profileRoot || !workRoot) return;

    const childrenFor = id => graph.nodes.filter(node => node.parentIds?.includes(id));
    const routeForNode = node => node?.route || 'overview';
    const normaliseRoute = value => (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';
    const nodeForRoute = route => route === 'overview'
      ? profileRoot
      : graph.nodes.find(node => node.route === route) || null;

    const primaryPath = node => {
      const path = [];
      const seen = new Set();
      let current = node;
      while (current && !seen.has(current.id)) {
        path.unshift(current);
        seen.add(current.id);
        current = current.parentIds?.[0] ? nodeMap.get(current.parentIds[0]) : null;
      }
      return path;
    };

    const ancestorIds = id => {
      const result = new Set();
      const pending = [...(nodeMap.get(id)?.parentIds || [])];
      while (pending.length) {
        const current = pending.pop();
        if (result.has(current)) continue;
        result.add(current);
        pending.push(...(nodeMap.get(current)?.parentIds || []));
      }
      return result;
    };

    const descendantIds = id => {
      const result = new Set();
      const pending = childrenFor(id).map(node => node.id);
      while (pending.length) {
        const current = pending.pop();
        if (result.has(current)) continue;
        result.add(current);
        childrenFor(current).forEach(child => pending.push(child.id));
      }
      return result;
    };

    const stableNumber = value => {
      let number = 2166136261;
      for (const character of String(value)) {
        number = Math.imul(number ^ character.charCodeAt(0), 16777619);
      }
      return number >>> 0;
    };

    const humanType = type => ({
      profile: 'Profile',
      section: 'Profile area',
      knowledge: 'Knowledge',
      experience: 'Experience',
      education: 'Education',
      credential: 'Credential',
      interest: 'About',
      project: 'Project',
      'work-theme': 'Work theme',
      'work-concept': 'Work concept'
    }[type] || 'Profile item');

    /* ----------------------------------------------------------------------
       Work FCA model
       ---------------------------------------------------------------------- */
    const attributes = work.attributes;
    const attributeIds = attributes.map(attribute => attribute.id);
    const attributeMap = new Map(attributes.map(attribute => [attribute.id, attribute]));
    const projects = [...work.projects].sort((a, b) => a.order - b.order);
    const projectMap = new Map(projects.map(project => [project.id, project]));
    const subset = (left, right) => left.every(value => right.includes(value));
    const intersection = arrays => {
      if (!arrays.length) return [...attributeIds];
      return arrays.reduce(
        (result, current) => result.filter(value => current.includes(value)),
        [...arrays[0]]
      );
    };
    const keyForIntent = intent => [...intent].sort().join('|');
    const closure = seed => {
      const extent = projects.filter(project => subset(seed, project.lattice)).map(project => project.id);
      const intent = extent.length
        ? intersection(extent.map(id => projectMap.get(id).lattice))
        : [...attributeIds];
      return { extent: [...extent].sort(), intent: [...intent].sort() };
    };
    const powerSet = values => {
      const result = [[]];
      values.forEach(value => result.push(...result.map(existing => [...existing, value])));
      return result;
    };
    const byIntent = new Map();
    powerSet(attributeIds).forEach(seed => {
      const concept = closure(seed);
      const key = keyForIntent(concept.intent);
      if (!byIntent.has(key)) byIntent.set(key, { ...concept, key });
    });
    const workConcepts = [...byIntent.values()];
    const topConcept = [...workConcepts].sort((a, b) => a.intent.length - b.intent.length)[0];
    const attributeConcept = new Map(
      attributes.map(attribute => [attribute.id, keyForIntent(closure([attribute.id]).intent)])
    );
    const projectConcept = new Map(
      projects.map(project => [project.id, keyForIntent(closure(project.lattice).intent)])
    );

    workConcepts.forEach(concept => {
      concept.attributeLabels = attributes.filter(attribute => attributeConcept.get(attribute.id) === concept.key);
      concept.projectLabels = projects.filter(project => projectConcept.get(project.id) === concept.key);
    });

    const displayConcepts = workConcepts.filter(concept =>
      concept.key === topConcept.key ||
      concept.attributeLabels.length ||
      concept.projectLabels.length
    );

    displayConcepts.forEach(concept => {
      concept.upper = [];
      concept.lower = [];
    });
    displayConcepts.forEach(upper => {
      displayConcepts.forEach(lower => {
        if (upper === lower) return;
        if (!subset(upper.intent, lower.intent) || upper.intent.length >= lower.intent.length) return;
        const intermediate = displayConcepts.some(middle =>
          middle !== upper &&
          middle !== lower &&
          subset(upper.intent, middle.intent) &&
          subset(middle.intent, lower.intent) &&
          upper.intent.length < middle.intent.length &&
          middle.intent.length < lower.intent.length
        );
        if (!intermediate) {
          upper.lower.push(lower.key);
          lower.upper.push(upper.key);
        }
      });
    });

    const conceptNodeId = key => key === topConcept.key ? 'work' : `work-concept:${key || 'top'}`;
    const conceptByNodeId = new Map(
      displayConcepts.map(concept => [conceptNodeId(concept.key), concept])
    );

    const workConceptNodes = displayConcepts
      .filter(concept => concept.key !== topConcept.key)
      .map(concept => ({
        id: conceptNodeId(concept.key),
        type: 'work-concept',
        label: concept.intent.map(id => attributeMap.get(id)?.label || id).join(' ∩ '),
        parentIds: [],
        route: 'work',
        conceptKey: concept.key,
        intent: concept.intent,
        extent: concept.extent
      }));

    const workConceptNodeMap = new Map(workConceptNodes.map(node => [node.id, node]));

    const workEdgesModel = () => {
      const edges = [{ source: profileRoot.id, target: workRoot.id, type: 'hierarchy' }];
      displayConcepts.forEach(upper => {
        upper.lower.forEach(lowerKey => {
          edges.push({
            source: conceptNodeId(upper.key),
            target: conceptNodeId(lowerKey),
            type: 'work-lattice'
          });
        });
      });
      return edges;
    };

    /* ----------------------------------------------------------------------
       Move existing Work controls into the shared scene
       ---------------------------------------------------------------------- */
    const contextControl = document.querySelector('#work .work-context-control');
    const themeControl = document.querySelector('#work .work-theme-control');
    const matchControl = document.querySelector('#work .theme-match-control');
    const resetButton = document.querySelector('#work-reset');

    const controls = document.createElement('div');
    controls.className = 'integrated-work-controls';
    const leftRail = document.createElement('aside');
    leftRail.className = 'integrated-work-rail is-left';
    const rightRail = document.createElement('aside');
    rightRail.className = 'integrated-work-rail is-right';
    if (contextControl) leftRail.appendChild(contextControl);
    if (themeControl) rightRail.appendChild(themeControl);
    if (matchControl) rightRail.appendChild(matchControl);
    if (resetButton) {
      resetButton.classList.add('integrated-work-reset');
      rightRail.appendChild(resetButton);
    }
    controls.append(leftRail, rightRail);
    scene.appendChild(controls);

    if (workLegacy) {
      workLegacy.hidden = true;
      workLegacy.classList.add('legacy-work-source');
    }

    const readWorkState = () => {
      const context = document.querySelector('#work-context-filters .work-filter[aria-pressed="true"]')?.dataset.context || 'all';
      const selectedThemes = new Set(
        [...document.querySelectorAll('#work-theme-filters input[data-theme-id]:checked')]
          .map(input => input.dataset.themeId)
      );
      const mode = document.querySelector('[data-theme-mode][aria-pressed="true"]')?.dataset.themeMode || 'any';
      return { context, selectedThemes, mode };
    };

    const projectMatchesWork = (project, filterState = readWorkState()) => {
      if (filterState.context !== 'all' && !project.contexts.includes(filterState.context)) return false;
      if (!filterState.selectedThemes.size) return true;
      const count = [...filterState.selectedThemes].filter(id => project.lattice.includes(id)).length;
      return filterState.mode === 'all' ? count === filterState.selectedThemes.size : count > 0;
    };

    let suppressWorkControlRender = false;
    const setThemesViaControls = (themeIds, mode = null) => {
      const desired = new Set(themeIds);
      suppressWorkControlRender = true;
      document.querySelectorAll('#work-theme-filters input[data-theme-id]').forEach(input => {
        if (input.checked !== desired.has(input.dataset.themeId)) input.click();
      });
      const targetMode = mode || (desired.size > 1 ? 'all' : 'any');
      const modeButton = document.querySelector(`[data-theme-mode="${targetMode}"]`);
      if (modeButton && modeButton.getAttribute('aria-pressed') !== 'true' && !modeButton.disabled) modeButton.click();
      suppressWorkControlRender = false;
      requestAnimationFrame(() => {
        if (state.mode === 'work') renderGraph();
      });
    };

    /* ----------------------------------------------------------------------
       Shared renderer state
       ---------------------------------------------------------------------- */
    let state = { route: 'overview', mode: 'overview', node: profileRoot, workProjectId: null };
    let routeToken = 0;
    let atlasPinnedId = null;
    const atlasOptions = { hierarchy: true, crossLinks: true, secondary: false };
    const atlasCamera = {
      x: 0, y: 0, scale: 1,
      targetX: 0, targetY: 0, targetScale: 1,
      frame: 0
    };
    const renderer = {
      svg: null,
      camera: null,
      edges: null,
      decorations: null,
      nodes: null,
      nodeElements: new Map(),
      edgeElements: new Map(),
      decorationElements: new Map(),
      lastEdges: [],
      lastLayout: null,
      frame: 0,
      drag: null,
      timeline: null
    };

    const FOCUS = { width: 1200, height: 720 };
    const SAFE = { top: 105, right: 90, bottom: 95, left: 90 };

    const currentNodeById = id => nodeMap.get(id) || workConceptNodeMap.get(id) || null;

    const visibleGraph = () => {
      if (state.mode === 'overview') return [profileRoot, ...childrenFor(profileRoot.id)];
      if (state.mode === 'atlas') return graph.nodes;
      if (state.mode === 'work') return [profileRoot, workRoot, ...workConceptNodes];

      const visible = new Map(primaryPath(state.node).map(node => [node.id, node]));
      const children = childrenFor(state.node.id);
      children.slice(0, 8).forEach(node => visible.set(node.id, node));
      if (children.length <= 5) {
        children.forEach(child => {
          childrenFor(child.id).slice(0, 2).forEach(grandchild => {
            if (visible.size < 13) visible.set(grandchild.id, grandchild);
          });
        });
      }
      return [...visible.values()];
    };

    const nodeFootprint = node => {
      if (node.type === 'work-concept') {
        const concept = conceptByNodeId.get(node.id);
        const projectCount = concept?.projectLabels?.length || 0;
        return { width: 170, height: 54 + projectCount * 20 };
      }
      return {
        width: Math.max(84, Math.min(190, (node.detailLabel || node.label || '').length * 7 + 34)),
        height: node.id === profileRoot.id ? 70 : node.type === 'section' ? 54 : 46
      };
    };

    const clampPoint = (node, point, width, height, safe = SAFE) => {
      const box = nodeFootprint(node);
      point.x = Math.max(safe.left + box.width / 2, Math.min(width - safe.right - box.width / 2, point.x));
      point.y = Math.max(safe.top + box.height / 2, Math.min(height - safe.bottom - box.height / 2, point.y));
    };

    const resolveCollisions = (nodes, positions, width, height, safe = SAFE) => {
      const items = nodes.filter(node => positions.has(node.id));
      for (let pass = 0; pass < 72; pass += 1) {
        let changed = false;
        for (let i = 0; i < items.length; i += 1) {
          for (let j = i + 1; j < items.length; j += 1) {
            const left = items[i], right = items[j];
            const a = positions.get(left.id), b = positions.get(right.id);
            const fa = nodeFootprint(left), fb = nodeFootprint(right);
            const needX = (fa.width + fb.width) / 2 + 18;
            const needY = (fa.height + fb.height) / 2 + 14;
            const dx = b.x - a.x, dy = b.y - a.y;
            const ox = needX - Math.abs(dx), oy = needY - Math.abs(dy);
            if (ox <= 0 || oy <= 0) continue;
            const horizontal = ox < oy * 1.5 || Math.abs(dy) < 22;
            const seed = stableNumber(`${left.id}:${right.id}`);
            if (horizontal) {
              const direction = Math.sign(dx || (seed % 2 ? 1 : -1));
              a.x -= direction * (ox / 2 + 1);
              b.x += direction * (ox / 2 + 1);
            } else {
              const direction = Math.sign(dy || (seed % 2 ? 1 : -1));
              a.y -= direction * (oy / 2 + 1);
              b.y += direction * (oy / 2 + 1);
            }
            changed = true;
          }
        }
        items.forEach(node => clampPoint(node, positions.get(node.id), width, height, safe));
        if (!changed) break;
      }
      return positions;
    };

    const layoutOverview = nodes => {
      const { width, height } = FOCUS;
      const positions = new Map([[profileRoot.id, { x: 600, y: 145 }]]);
      const anchors = {
        work: { x: 225, y: 390 },
        knowledge: { x: 555, y: 338 },
        experience: { x: 925, y: 400 },
        education: { x: 790, y: 555 },
        about: { x: 350, y: 552 }
      };
      nodes.filter(node => node.id !== profileRoot.id).forEach(node => {
        positions.set(node.id, { ...(anchors[node.id] || { x: 600, y: 430 }) });
      });
      return { width, height, positions: resolveCollisions(nodes, positions, width, height) };
    };

    const layoutFocus = nodes => {
      const { width, height } = FOCUS;
      const positions = new Map();
      const path = primaryPath(state.node);

      if (state.node.id === 'experience') {
        path.forEach((node, index) => {
          const t = path.length <= 1 ? 1 : index / (path.length - 1);
          positions.set(node.id, { x: 255 + 355 * t, y: 118 + 130 * t });
        });
        const roles = childrenFor('experience')
          .filter(node => nodes.some(item => item.id === node.id))
          .sort((a, b) => (a.timelineOrder || 0) - (b.timelineOrder || 0));
        roles.forEach((node, index) => {
          positions.set(node.id, {
            x: roles.length === 1 ? 680 : 215 + index * (770 / Math.max(1, roles.length - 1)),
            y: 455 + (index % 2 ? 22 : -18)
          });
        });
        return {
          width, height,
          positions: resolveCollisions(nodes, positions, width, height),
          timeline: roles.length ? { x1: 170, x2: 1035, y: 455 } : null
        };
      }

      path.forEach((node, index) => {
        const t = path.length <= 1 ? 1 : index / (path.length - 1);
        positions.set(node.id, {
          x: 250 + 355 * t + Math.sin(t * Math.PI) * 62,
          y: 112 + 138 * t
        });
      });
      positions.set(state.node.id, { x: state.node.id === profileRoot.id ? 600 : 610, y: state.node.id === profileRoot.id ? 150 : 250 });

      const children = childrenFor(state.node.id).filter(node => nodes.some(item => item.id === node.id));
      children.forEach((child, index) => {
        const t = children.length <= 1 ? .5 : index / (children.length - 1);
        positions.set(child.id, {
          x: 160 + t * 880,
          y: 432 - Math.sin(t * Math.PI) * 58 + (index % 2 ? 18 : -8)
        });
      });

      children.forEach(child => {
        const parent = positions.get(child.id);
        childrenFor(child.id)
          .filter(node => nodes.some(item => item.id === node.id))
          .forEach((grandchild, index) => {
            positions.set(grandchild.id, {
              x: parent.x + (index % 2 ? 1 : -1) * (105 + 30 * index),
              y: parent.y + 128 + ((stableNumber(grandchild.id) % 25) - 12)
            });
          });
      });

      return { width, height, positions: resolveCollisions(nodes, positions, width, height) };
    };

    const layoutWork = nodes => {
      const width = 1200, height = 760;
      const positions = new Map([
        [profileRoot.id, { x: 600, y: 92 }],
        [workRoot.id, { x: 600, y: 205 }]
      ]);

      const themeAnchors = new Map(
        attributes.map((attribute, index) => [
          attribute.id,
          205 + index * (790 / Math.max(1, attributes.length - 1))
        ])
      );

      const ranks = [...new Set(displayConcepts.map(concept => concept.intent.length))].sort((a, b) => a - b);
      const maxRank = Math.max(...ranks, 1);

      const preferredX = concept => {
        if (!concept.intent.length) return 600;
        if (concept.intent.length === 1) return themeAnchors.get(concept.intent[0]) || 600;
        const mean = concept.intent.reduce((sum, id) => sum + (themeAnchors.get(id) || 600), 0) / concept.intent.length;
        return mean + ((stableNumber(concept.key) % 45) - 22);
      };

      ranks.filter(rank => rank > 0).forEach(rank => {
        const level = displayConcepts.filter(concept => concept.intent.length === rank);
        const y = 350 + ((rank - 1) * 275) / Math.max(1, maxRank - 1);
        const ordered = level.map(concept => ({ concept, x: preferredX(concept) })).sort((a, b) => a.x - b.x);
        const minGap = rank === 1 ? 190 : rank === 2 ? 165 : 150;
        for (let i = 1; i < ordered.length; i += 1) ordered[i].x = Math.max(ordered[i].x, ordered[i - 1].x + minGap);
        if (ordered.length && ordered.at(-1).x > 1030) {
          const shift = ordered.at(-1).x - 1030;
          ordered.forEach(item => item.x -= shift);
        }
        if (ordered.length && ordered[0].x < 170) {
          const shift = 170 - ordered[0].x;
          ordered.forEach(item => item.x += shift);
        }
        ordered.forEach(({ concept, x }, index) => {
          positions.set(conceptNodeId(concept.key), {
            x: x + (rank > 1 ? (index % 2 ? 10 : -10) : 0),
            y: y + (rank > 1 ? (index % 2 ? 9 : -9) : 0)
          });
        });
      });

      const safe = { top: 58, right: 70, bottom: 60, left: 70 };
      return { width, height, positions: resolveCollisions(nodes, positions, width, height, safe) };
    };

    const relativeDepth = (node, sectionId, memo = new Map()) => {
      const key = `${sectionId}:${node.id}`;
      if (memo.has(key)) return memo.get(key);
      if (node.id === sectionId) return 0;
      const parents = (node.parentIds || []).map(id => nodeMap.get(id)).filter(Boolean);
      const values = parents.map(parent => relativeDepth(parent, sectionId, memo)).filter(Number.isFinite);
      const depth = values.length ? 1 + Math.min(...values) : Infinity;
      memo.set(key, depth);
      return depth;
    };

    const layoutAtlas = nodes => {
      const width = 2520, height = 1580;
      const positions = new Map([[profileRoot.id, { x: 1260, y: 100 }]]);
      const anchors = {
        work: { x: 390, y: 320 },
        knowledge: { x: 1120, y: 265 },
        experience: { x: 1990, y: 355 },
        education: { x: 1710, y: 965 },
        about: { x: 660, y: 1010 }
      };
      Object.entries(anchors).forEach(([id, point]) => nodeMap.has(id) && positions.set(id, { ...point }));

      const regions = {
        work: { left: 80, right: 835, top: 430, bottom: 930 },
        knowledge: { left: 760, right: 1515, top: 375, bottom: 1125 },
        experience: { left: 1650, right: 2420, top: 470, bottom: 850 },
        education: { left: 1450, right: 2390, top: 1050, bottom: 1480 },
        about: { left: 120, right: 1040, top: 1070, bottom: 1490 }
      };

      const ownerFor = node => {
        if (node.type === 'project' || node.type === 'work-theme') return 'work';
        return primaryPath(node).find(item => item.parentIds?.includes(profileRoot.id))?.id || 'knowledge';
      };

      const groups = new Map(Object.keys(regions).map(id => [id, []]));
      nodes.forEach(node => {
        if (node.id === profileRoot.id || anchors[node.id]) return;
        const owner = ownerFor(node);
        groups.get(owner)?.push(node);
      });

      const memo = new Map();
      groups.forEach((group, sectionId) => {
        const region = regions[sectionId];
        const levels = new Map();
        group.forEach(node => {
          let depth = relativeDepth(node, sectionId, memo);
          if (!Number.isFinite(depth)) depth = 2;
          if (node.type === 'work-theme') depth = 1;
          if (node.type === 'project') depth = 2;
          if (!levels.has(depth)) levels.set(depth, []);
          levels.get(depth).push(node);
        });

        const depths = [...levels.keys()].sort((a, b) => a - b);
        const local = new Map();
        depths.forEach((depth, levelIndex) => {
          const level = levels.get(depth);
          level.sort((a, b) => {
            const bary = node => {
              const xs = (node.parentIds || []).map(id => local.get(id)?.x).filter(Number.isFinite);
              return xs.length ? xs.reduce((sum, x) => sum + x, 0) / xs.length : stableNumber(node.id) % 1000;
            };
            return bary(a) - bary(b) || a.label.localeCompare(b.label);
          });
          const y = region.top + ((region.bottom - region.top) * (levelIndex + .72)) / Math.max(depths.length + .25, 1);
          level.forEach((node, index) => {
            const t = level.length <= 1 ? .5 : (index + .5) / level.length;
            const point = {
              x: region.left + t * (region.right - region.left) + ((stableNumber(node.id) % 41) - 20),
              y: y + (index % 2 ? 18 : -14) + ((stableNumber(`${node.id}:y`) % 29) - 14) * .45
            };
            local.set(node.id, point);
            positions.set(node.id, point);
          });
        });
      });

      return {
        width, height,
        positions: resolveCollisions(nodes, positions, width, height, { top: 50, right: 42, bottom: 42, left: 42 })
      };
    };

    const layoutGraph = nodes =>
      state.mode === 'overview' ? layoutOverview(nodes) :
      state.mode === 'work' ? layoutWork(nodes) :
      state.mode === 'atlas' ? layoutAtlas(nodes) :
      layoutFocus(nodes);

    const graphEdges = nodes => {
      if (state.mode === 'work') return workEdgesModel();
      const ids = new Set(nodes.map(node => node.id));
      const edges = [];
      nodes.forEach(node => {
        let parents = [...(node.parentIds || [])];
        if (state.mode === 'atlas' && node.type === 'project' && parents.some(id => id.startsWith('work-theme-'))) {
          parents = parents.filter(id => id !== 'work');
        }
        parents.forEach((parentId, index) => {
          if (!ids.has(parentId)) return;
          if (state.mode === 'atlas') {
            if (!atlasOptions.hierarchy) return;
            if (index > 0 && !atlasOptions.secondary && !(node.type === 'project' && parentId.startsWith('work-theme-'))) return;
          }
          edges.push({
            source: parentId,
            target: node.id,
            type: index === 0 || (node.type === 'project' && parentId.startsWith('work-theme-')) ? 'hierarchy' : 'hierarchy-alt'
          });
        });
      });
      if (state.mode === 'atlas' && atlasOptions.crossLinks) {
        graph.edges.forEach(edge => {
          if (!ids.has(edge.source) || !ids.has(edge.target)) return;
          if (edge.secondary && !atlasOptions.secondary) return;
          edges.push({ ...edge });
        });
      }
      const byKey = new Map();
      edges.forEach(edge => {
        const key = `${edge.source}|${edge.target}|${edge.type}`;
        if (!byKey.has(key)) byKey.set(key, edge);
      });
      return [...byKey.values()];
    };

    /* ----------------------------------------------------------------------
       SVG renderer
       ---------------------------------------------------------------------- */
    const edgeKey = edge => `${edge.source}|${edge.target}|${edge.type}`;
    const pointOf = element => ({ x: Number(element?.dataset.x || 0), y: Number(element?.dataset.y || 0) });
    const setPoint = (element, point) => {
      element.setAttribute('transform', `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`);
      element.dataset.x = point.x;
      element.dataset.y = point.y;
    };
    const edgePath = (from, to, key) => {
      const dx = to.x - from.x, dy = to.y - from.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const bend = Math.max(-70, Math.min(70, ((stableNumber(key) % 61) - 30) + Math.min(22, Math.abs(dx) * .045)));
      return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${((from.x + to.x) / 2 - dy / distance * bend).toFixed(1)} ${((from.y + to.y) / 2 + dx / distance * bend).toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
    };

    const createNode = node => {
      const group = document.createElementNS(svgNS, 'g');
      group.classList.add('site-graph-node', `is-${node.type}`);
      group.dataset.nodeId = node.id;
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');

      const hit = document.createElementNS(svgNS, 'circle');
      hit.classList.add('site-graph-hit');
      hit.setAttribute('r', node.id === profileRoot.id ? '27' : node.type === 'work-concept' ? '19' : '21');
      hit.setAttribute('fill', 'transparent');

      const dot = document.createElementNS(svgNS, 'circle');
      dot.classList.add('site-graph-dot');
      dot.setAttribute('r',
        node.id === profileRoot.id ? '15' :
        node.id === workRoot.id ? '10' :
        node.type === 'section' ? '9' :
        node.type === 'project' ? '5' :
        node.type === 'work-concept' ? '5.5' : '6'
      );

      const label = document.createElementNS(svgNS, 'text');
      label.classList.add('site-graph-label');
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('y', node.id === profileRoot.id ? '-25' : '25');
      if (node.type === 'work-concept') {
        label.textContent = '';
      } else {
        label.textContent = node.id === workRoot.id && state.mode === 'work' ? 'WORK' : node.label;
      }

      group.append(hit, dot, label);

      if (node.meta && state.mode !== 'work') {
        const meta = document.createElementNS(svgNS, 'text');
        meta.classList.add('site-graph-meta');
        meta.setAttribute('text-anchor', 'middle');
        meta.setAttribute('y', '42');
        meta.textContent = node.meta;
        group.appendChild(meta);
      }

      const preview = () => {
        if (state.mode === 'work') {
          workPreviewNode(node.id);
        } else if (state.mode === 'atlas') {
          atlasHighlight(node.id, false);
        } else {
          localPreview(node.id);
        }
      };
      const clear = () => {
        if (state.mode === 'work') clearWorkPreview();
        else if (state.mode === 'atlas') restoreAtlasHighlight();
        else clearLocalPreview();
      };
      const activate = () => {
        if (state.mode === 'atlas') {
          atlasPinnedId = node.id;
          atlasHighlight(node.id, true);
          openAtlasInspector(node);
          return;
        }
        if (state.mode === 'work') {
          if (node.id === profileRoot.id) updateHash('overview');
          else if (node.id === workRoot.id) setThemesViaControls([]);
          else {
            const concept = conceptByNodeId.get(node.id);
            if (concept) setThemesViaControls(concept.intent, concept.intent.length > 1 ? 'all' : 'any');
          }
          return;
        }
        updateHash(routeForNode(node));
      };

      group.addEventListener('mouseenter', preview);
      group.addEventListener('mouseleave', clear);
      group.addEventListener('focus', preview);
      group.addEventListener('blur', clear);
      group.addEventListener('click', event => {
        event.stopPropagation();
        if (!renderer.drag?.moved) activate();
      });
      group.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate();
        }
      });
      return group;
    };

    const ensureRenderer = layout => {
      if (renderer.svg) return;
      renderer.svg = document.createElementNS(svgNS, 'svg');
      renderer.svg.classList.add('site-graph-svg', 'profile-map-svg', 'profile-map-svg-v5');
      renderer.svg.setAttribute('role', 'img');
      renderer.svg.setAttribute('aria-labelledby', 'site-graph-title site-graph-help');
      renderer.camera = document.createElementNS(svgNS, 'g');
      renderer.edges = document.createElementNS(svgNS, 'g');
      renderer.edges.classList.add('site-graph-edges');
      renderer.decorations = document.createElementNS(svgNS, 'g');
      renderer.decorations.classList.add('site-graph-decorations');
      renderer.nodes = document.createElementNS(svgNS, 'g');
      renderer.nodes.classList.add('site-graph-nodes');
      renderer.camera.append(renderer.edges, renderer.decorations, renderer.nodes);
      renderer.svg.appendChild(renderer.camera);
      root.replaceChildren(renderer.svg);

      renderer.svg.addEventListener('wheel', event => {
        if (state.mode !== 'atlas') return;
        event.preventDefault();
        const bounds = renderer.svg.getBoundingClientRect();
        const active = renderer.lastLayout || layout;
        const delta = Math.max(-180, Math.min(180, event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY));
        const point = {
          x: (event.clientX - bounds.left) * active.width / Math.max(1, bounds.width),
          y: (event.clientY - bounds.top) * active.height / Math.max(1, bounds.height)
        };
        zoomAtlas(point, Math.exp(-delta * .00235));
      }, { passive: false });

      renderer.svg.addEventListener('pointerdown', event => {
        if (state.mode !== 'atlas' || event.button !== 0) return;
        renderer.drag = { x: event.clientX, y: event.clientY, moved: false };
        renderer.svg.setPointerCapture?.(event.pointerId);
        renderer.svg.classList.add('is-dragging');
      });
      renderer.svg.addEventListener('pointermove', event => {
        if (!renderer.drag || state.mode !== 'atlas') return;
        const bounds = renderer.svg.getBoundingClientRect();
        const active = renderer.lastLayout;
        const dx = (event.clientX - renderer.drag.x) * active.width / Math.max(1, bounds.width);
        const dy = (event.clientY - renderer.drag.y) * active.height / Math.max(1, bounds.height);
        if (Math.abs(dx) + Math.abs(dy) > 2) renderer.drag.moved = true;
        atlasCamera.x += dx; atlasCamera.y += dy;
        atlasCamera.targetX = atlasCamera.x; atlasCamera.targetY = atlasCamera.y;
        renderer.drag.x = event.clientX; renderer.drag.y = event.clientY;
        paintAtlas();
      });
      const endDrag = event => {
        if (!renderer.drag) return;
        renderer.svg.releasePointerCapture?.(event.pointerId);
        renderer.drag = null;
        renderer.svg.classList.remove('is-dragging');
      };
      renderer.svg.addEventListener('pointerup', endDrag);
      renderer.svg.addEventListener('pointercancel', endDrag);
    };

    const syncWorkDecorations = layout => {
      const desired = new Set();
      if (state.mode !== 'work') {
        [...renderer.decorationElements.entries()].forEach(([key, element]) => {
          element.remove();
          renderer.decorationElements.delete(key);
        });
        return;
      }

      const filter = readWorkState();
      const visibleProjects = new Set(projects.filter(project => projectMatchesWork(project, filter)).map(project => project.id));

      displayConcepts.forEach(concept => {
        if (!concept.projectLabels.length) return;
        const nodeId = conceptNodeId(concept.key);
        const pos = layout.positions.get(nodeId);
        if (!pos) return;

        concept.projectLabels.forEach((project, index) => {
          const key = `project-label:${project.id}`;
          desired.add(key);
          let group = renderer.decorationElements.get(key);
          if (!group) {
            group = document.createElementNS(svgNS, 'g');
            group.classList.add('work-project-anchor-v5');
            group.dataset.projectId = project.id;
            group.setAttribute('tabindex', '0');
            group.setAttribute('role', 'link');

            const text = document.createElementNS(svgNS, 'text');
            text.setAttribute('text-anchor', 'middle');
            text.textContent = project.graphLabel;
            group.appendChild(text);

            const hover = () => workPreviewProject(project.id);
            group.addEventListener('mouseenter', hover);
            group.addEventListener('mouseleave', clearWorkPreview);
            group.addEventListener('focus', hover);
            group.addEventListener('blur', clearWorkPreview);
            group.addEventListener('click', event => {
              event.stopPropagation();
              updateHash(`work/project/${project.id}`);
            });
            group.addEventListener('keydown', event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                updateHash(`work/project/${project.id}`);
              }
            });
            renderer.decorationElements.set(key, group);
            renderer.decorations.appendChild(group);
          }
          group.setAttribute('transform', `translate(${pos.x} ${pos.y + 24 + index * 20})`);
          group.classList.toggle('is-filtered-out', !visibleProjects.has(project.id));
          group.classList.toggle('is-selected', state.workProjectId === project.id);

          const matches = [...filter.selectedThemes].filter(id => project.lattice.includes(id)).length;
          group.classList.remove('match-1', 'match-2', 'match-3', 'match-4');
          if (visibleProjects.has(project.id) && filter.mode === 'any' && matches) group.classList.add(`match-${Math.min(4, matches)}`);
        });
      });

      attributes.forEach(attribute => {
        const conceptId = conceptNodeId(attributeConcept.get(attribute.id));
        const top = layout.positions.get('work');
        const lower = layout.positions.get(conceptId);
        if (!top || !lower) return;
        const key = `theme-label:${attribute.id}`;
        desired.add(key);
        let group = renderer.decorationElements.get(key);
        if (!group) {
          group = document.createElementNS(svgNS, 'g');
          group.classList.add('work-theme-label-v5');
          group.dataset.themeId = attribute.id;
          group.setAttribute('tabindex', '0');
          group.setAttribute('role', 'button');
          const width = Math.max(96, 24 + attribute.label.length * 5.8);
          const rect = document.createElementNS(svgNS, 'rect');
          rect.setAttribute('x', -width / 2);
          rect.setAttribute('y', -13);
          rect.setAttribute('width', width);
          rect.setAttribute('height', 26);
          rect.setAttribute('rx', 4);
          const text = document.createElementNS(svgNS, 'text');
          text.setAttribute('text-anchor', 'middle');
          text.setAttribute('y', '3.5');
          text.textContent = attribute.label;
          group.append(rect, text);
          group.addEventListener('mouseenter', () => workPreviewTheme(attribute.id));
          group.addEventListener('mouseleave', clearWorkPreview);
          group.addEventListener('focus', () => workPreviewTheme(attribute.id));
          group.addEventListener('blur', clearWorkPreview);
          group.addEventListener('click', event => {
            event.stopPropagation();
            const input = document.querySelector(`#work-theme-filters input[data-theme-id="${attribute.id}"]`);
            input?.click();
          });
          group.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              document.querySelector(`#work-theme-filters input[data-theme-id="${attribute.id}"]`)?.click();
            }
          });
          renderer.decorationElements.set(key, group);
          renderer.decorations.appendChild(group);
        }
        const t = .64;
        group.setAttribute('transform', `translate(${top.x + (lower.x - top.x) * t} ${top.y + (lower.y - top.y) * t})`);
        group.classList.toggle('is-selected', filter.selectedThemes.has(attribute.id));
      });

      [...renderer.decorationElements.entries()].forEach(([key, element]) => {
        if (!desired.has(key)) {
          element.remove();
          renderer.decorationElements.delete(key);
        }
      });

      applyPersistentWorkHighlight();
    };

    const renderGraph = () => {
      const nodes = visibleGraph();
      const layout = layoutGraph(nodes);
      const edges = graphEdges(nodes);
      ensureRenderer(layout);
      renderer.svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
      renderer.lastLayout = layout;
      renderer.lastEdges = edges;

      if (layout.timeline) {
        if (!renderer.timeline) {
          renderer.timeline = document.createElementNS(svgNS, 'line');
          renderer.timeline.classList.add('site-graph-timeline');
          renderer.edges.prepend(renderer.timeline);
        }
        renderer.timeline.setAttribute('x1', layout.timeline.x1);
        renderer.timeline.setAttribute('x2', layout.timeline.x2);
        renderer.timeline.setAttribute('y1', layout.timeline.y);
        renderer.timeline.setAttribute('y2', layout.timeline.y);
      } else if (renderer.timeline) {
        renderer.timeline.remove();
        renderer.timeline = null;
      }

      const visibleIds = new Set(nodes.map(node => node.id));
      const edgeIds = new Set(edges.map(edgeKey));
      const previous = new Map([...renderer.nodeElements].map(([id, element]) => [id, pointOf(element)]));
      const focusPoint = previous.get(state.node?.id) || previous.get('work') || { x: layout.width / 2, y: layout.height / 2 };
      const starts = new Map(), targets = new Map(), entering = new Set();

      nodes.forEach(node => {
        let element = renderer.nodeElements.get(node.id);
        const target = layout.positions.get(node.id) || focusPoint;
        if (!element) {
          element = createNode(node);
          renderer.nodeElements.set(node.id, element);
          renderer.nodes.appendChild(element);
          entering.add(node.id);
          const visibleParent = (node.parentIds || []).map(id => renderer.nodeElements.get(id)).find(Boolean);
          const start = visibleParent ? pointOf(visibleParent) : (node.type === 'work-concept' && renderer.nodeElements.get('work') ? pointOf(renderer.nodeElements.get('work')) : focusPoint);
          starts.set(node.id, start);
          setPoint(element, start);
          element.style.opacity = '0';
        } else {
          starts.set(node.id, pointOf(element));
        }
        targets.set(node.id, target);
        element.classList.toggle('is-selected', node.id === state.node?.id && state.mode !== 'overview');
        element.classList.toggle('is-work-root', node.id === 'work' && state.mode === 'work');
        const label = element.querySelector('.site-graph-label');
        if (label && node.id === 'work') label.textContent = state.mode === 'work' ? 'WORK' : 'Work';
      });

      const leavingNodes = [...renderer.nodeElements].filter(([id]) => !visibleIds.has(id));
      const edgeStarts = new Map(), edgeTargets = new Map(), enteringEdges = new Set();

      edges.forEach(edge => {
        const key = edgeKey(edge);
        let element = renderer.edgeElements.get(key);
        if (!element) {
          element = document.createElementNS(svgNS, 'path');
          element.dataset.source = edge.source;
          element.dataset.target = edge.target;
          element.dataset.type = edge.type;
          element.classList.add(`is-${edge.type}`);
          if (!['hierarchy', 'hierarchy-alt', 'work-lattice'].includes(edge.type)) element.classList.add('is-cross-link');
          if (edge.type === 'hierarchy-alt' || edge.secondary) element.classList.add('is-secondary');
          renderer.edgeElements.set(key, element);
          renderer.edges.appendChild(element);
          enteringEdges.add(key);
          element.style.opacity = '0';
        }
        const sourceStart = starts.get(edge.source) || previous.get(edge.source) || focusPoint;
        const targetStart = starts.get(edge.target) || previous.get(edge.target) || sourceStart;
        const sourceTarget = targets.get(edge.source) || sourceStart;
        const targetTarget = targets.get(edge.target) || targetStart;
        edgeStarts.set(key, { source: sourceStart, target: targetStart });
        edgeTargets.set(key, { source: sourceTarget, target: targetTarget });
      });

      const leavingEdges = [...renderer.edgeElements].filter(([key]) => !edgeIds.has(key));
      cancelAnimationFrame(renderer.frame);
      const duration = reducedMotion.matches ? 0 : 450;
      const started = performance.now();
      const ease = t => 1 - Math.pow(1 - t, 3);

      const frame = now => {
        const raw = duration ? Math.min(1, (now - started) / duration) : 1;
        const progress = ease(raw);

        nodes.forEach(node => {
          const element = renderer.nodeElements.get(node.id);
          const from = starts.get(node.id), to = targets.get(node.id);
          if (!element || !from || !to) return;
          setPoint(element, {
            x: from.x + (to.x - from.x) * progress,
            y: from.y + (to.y - from.y) * progress
          });
          if (entering.has(node.id)) element.style.opacity = String(progress);
        });

        edges.forEach(edge => {
          const key = edgeKey(edge);
          const element = renderer.edgeElements.get(key);
          const from = edgeStarts.get(key), to = edgeTargets.get(key);
          if (!element || !from || !to) return;
          const source = {
            x: from.source.x + (to.source.x - from.source.x) * progress,
            y: from.source.y + (to.source.y - from.source.y) * progress
          };
          const target = {
            x: from.target.x + (to.target.x - from.target.x) * progress,
            y: from.target.y + (to.target.y - from.target.y) * progress
          };
          element.setAttribute('d', edgePath(source, target, key));
          if (enteringEdges.has(key)) element.style.opacity = String(progress);
        });

        leavingNodes.forEach(([, element]) => {
          element.style.opacity = String(1 - progress);
          const p = pointOf(element);
          const target = targets.get('work') || targets.get(state.node?.id) || focusPoint;
          setPoint(element, {
            x: p.x + (target.x - p.x) * progress * .22,
            y: p.y + (target.y - p.y) * progress * .22
          });
        });
        leavingEdges.forEach(([, element]) => element.style.opacity = String(1 - progress));

        if (raw < 1) {
          renderer.frame = requestAnimationFrame(frame);
          return;
        }

        leavingNodes.forEach(([id, element]) => {
          element.remove();
          renderer.nodeElements.delete(id);
        });
        leavingEdges.forEach(([key, element]) => {
          element.remove();
          renderer.edgeElements.delete(key);
        });
        renderer.nodeElements.forEach(element => element.style.opacity = '');
        renderer.edgeElements.forEach(element => element.style.opacity = '');

        if (state.mode === 'atlas') {
          paintAtlas();
          restoreAtlasHighlight();
        } else {
          renderer.camera.setAttribute('transform', '');
        }
        syncWorkDecorations(layout);
      };

      renderer.frame = requestAnimationFrame(frame);
      if (duration === 0) syncWorkDecorations(layout);
    };

    /* ----------------------------------------------------------------------
       Work highlighting
       ---------------------------------------------------------------------- */
    const clearWorkClasses = () => {
      renderer.nodeElements.forEach(element => {
        element.classList.remove('is-work-soft', 'is-work-strong', 'is-upstream', 'is-downstream', 'is-muted-soft', 'is-filtered-work', 'is-selected-downset');
      });
      renderer.edgeElements.forEach(element => {
        element.classList.remove('is-work-soft', 'is-work-strong', 'is-upstream', 'is-downstream', 'is-muted-soft', 'is-selected-downset');
      });
      renderer.decorationElements.forEach(element => {
        element.classList.remove('is-work-soft', 'is-work-strong', 'is-upstream', 'is-downstream', 'is-muted-soft');
      });
    };

    const conceptForId = id => id === 'work' ? topConcept : conceptByNodeId.get(id);

    const applyPersistentWorkHighlight = () => {
      if (state.mode !== 'work') return;
      const filter = readWorkState();
      const selected = [...filter.selectedThemes];

      renderer.nodeElements.forEach((element, id) => {
        const concept = conceptForId(id);
        if (!concept || id === profileRoot.id) return;
        const match = selected.length && (
          filter.mode === 'all'
            ? selected.every(theme => concept.intent.includes(theme))
            : selected.some(theme => concept.intent.includes(theme))
        );
        element.classList.toggle('is-selected-downset', Boolean(match));
        const hasVisible = concept.extent?.some(projectId => projectMatchesWork(projectMap.get(projectId), filter));
        element.classList.toggle('is-filtered-work', id !== 'work' && !hasVisible);
      });

      renderer.edgeElements.forEach((element, key) => {
        const edge = renderer.lastEdges.find(item => edgeKey(item) === key);
        if (!edge || edge.type !== 'work-lattice' || !selected.length) {
          element.classList.remove('is-selected-downset');
          return;
        }
        const upper = conceptForId(edge.source), lower = conceptForId(edge.target);
        const matchConcept = concept => filter.mode === 'all'
          ? selected.every(theme => concept.intent.includes(theme))
          : selected.some(theme => concept.intent.includes(theme));
        element.classList.toggle('is-selected-downset', matchConcept(upper) && matchConcept(lower));
      });
    };

    const clearWorkPreview = () => {
      clearWorkClasses();
      applyPersistentWorkHighlight();
    };

    const upstreamConceptIds = concept => new Set(
      displayConcepts.filter(candidate => subset(candidate.intent, concept.intent)).map(candidate => conceptNodeId(candidate.key))
    );

    const workPreviewTheme = themeId => {
      clearWorkClasses();
      const concept = workConcepts.find(item => item.key === attributeConcept.get(themeId));
      if (!concept) return;
      const down = new Set(displayConcepts.filter(candidate => subset(concept.intent, candidate.intent)).map(candidate => conceptNodeId(candidate.key)));
      const relatedProjects = new Set(concept.extent);

      renderer.nodeElements.forEach((element, id) => {
        if (id === profileRoot.id) return;
        element.classList.toggle('is-work-soft', down.has(id));
        element.classList.toggle('is-muted-soft', id !== 'work' && !down.has(id));
      });
      renderer.edgeElements.forEach((element, key) => {
        const edge = renderer.lastEdges.find(item => edgeKey(item) === key);
        if (!edge) return;
        const active = edge.type === 'work-lattice' && down.has(edge.source) && down.has(edge.target);
        element.classList.toggle('is-work-soft', active);
        element.classList.toggle('is-muted-soft', edge.type === 'work-lattice' && !active);
      });
      renderer.decorationElements.forEach((element, key) => {
        if (key.startsWith('project-label:')) {
          const id = key.split(':').slice(1).join(':');
          element.classList.toggle('is-work-soft', relatedProjects.has(id));
          element.classList.toggle('is-muted-soft', !relatedProjects.has(id));
        } else if (key.startsWith('theme-label:')) {
          const active = element.dataset.themeId === themeId;
          element.classList.toggle('is-work-strong', active);
          element.classList.toggle('is-muted-soft', !active && !readWorkState().selectedThemes.has(element.dataset.themeId));
        }
      });
    };

    const workPreviewProject = projectId => {
      clearWorkClasses();
      const project = projectMap.get(projectId);
      const concept = workConcepts.find(item => item.key === projectConcept.get(projectId));
      if (!project || !concept) return;
      const upstream = upstreamConceptIds(concept);

      renderer.nodeElements.forEach((element, id) => {
        element.classList.toggle('is-work-soft', id === conceptNodeId(concept.key));
      });
      renderer.edgeElements.forEach((element, key) => {
        const edge = renderer.lastEdges.find(item => edgeKey(item) === key);
        if (!edge) return;
        const active = edge.type === 'work-lattice' && upstream.has(edge.source) && upstream.has(edge.target);
        element.classList.toggle('is-upstream', active);
      });
      renderer.decorationElements.forEach((element, key) => {
        if (key.startsWith('project-label:')) {
          element.classList.toggle('is-work-strong', element.dataset.projectId === projectId);
        }
        if (key.startsWith('theme-label:')) {
          const active = project.lattice.includes(element.dataset.themeId);
          element.classList.toggle('is-upstream', active);
        }
      });
    };

    const workPreviewNode = nodeId => {
      clearWorkClasses();
      if (nodeId === profileRoot.id) {
        renderer.nodeElements.get(profileRoot.id)?.classList.add('is-work-strong');
        renderer.edgeElements.get(`${profileRoot.id}|work|hierarchy`)?.classList.add('is-work-strong');
        return;
      }
      if (nodeId === 'work') {
        renderer.nodeElements.get('work')?.classList.add('is-work-strong');
        const principals = new Set([...attributeConcept.values()].map(conceptNodeId));
        renderer.edgeElements.forEach((element, key) => {
          const edge = renderer.lastEdges.find(item => edgeKey(item) === key);
          if (edge?.source === 'work' && principals.has(edge.target)) element.classList.add('is-work-strong');
        });
        renderer.decorationElements.forEach((element, key) => {
          if (key.startsWith('theme-label:')) element.classList.add('is-work-strong');
        });
        return;
      }

      const concept = conceptForId(nodeId);
      if (!concept) return;
      const upstream = upstreamConceptIds(concept);
      renderer.nodeElements.forEach((element, id) => {
        const active = upstream.has(id);
        element.classList.toggle('is-upstream', active);
        element.classList.toggle('is-muted-soft', id !== profileRoot.id && !active);
      });
      renderer.edgeElements.forEach((element, key) => {
        const edge = renderer.lastEdges.find(item => edgeKey(item) === key);
        const active = edge && (
          (edge.type === 'work-lattice' && upstream.has(edge.source) && upstream.has(edge.target)) ||
          (edge.source === profileRoot.id && edge.target === 'work')
        );
        element.classList.toggle('is-upstream', Boolean(active));
        element.classList.toggle('is-muted-soft', edge?.type === 'work-lattice' && !active);
      });
      renderer.decorationElements.forEach((element, key) => {
        if (!key.startsWith('theme-label:')) return;
        const active = concept.intent.includes(element.dataset.themeId);
        element.classList.toggle('is-upstream', active);
        element.classList.toggle('is-muted-soft', !active);
      });
    };

    /* ----------------------------------------------------------------------
       Local and Atlas highlighting
       ---------------------------------------------------------------------- */
    const clearLocalPreview = () => {
      renderer.nodeElements.forEach(element => element.classList.remove('is-upstream', 'is-downstream', 'is-muted-soft'));
      renderer.edgeElements.forEach(element => element.classList.remove('is-upstream', 'is-downstream', 'is-muted-soft'));
    };

    const localPreview = nodeId => {
      clearLocalPreview();
      const up = ancestorIds(nodeId), down = descendantIds(nodeId);
      const relevant = new Set([nodeId, ...up, ...down]);
      renderer.nodeElements.forEach((element, id) => {
        element.classList.toggle('is-upstream', up.has(id));
        element.classList.toggle('is-downstream', down.has(id));
        element.classList.toggle('is-muted-soft', !relevant.has(id));
      });
      renderer.edgeElements.forEach((element, key) => {
        const edge = renderer.lastEdges.find(item => edgeKey(item) === key);
        if (!edge) return;
        const upstream = up.has(edge.source) && (up.has(edge.target) || edge.target === nodeId);
        const downstream = (edge.source === nodeId || down.has(edge.source)) && down.has(edge.target);
        element.classList.toggle('is-upstream', upstream);
        element.classList.toggle('is-downstream', downstream);
        element.classList.toggle('is-muted-soft', !(upstream || downstream));
      });
    };

    const clearAtlasHighlight = () => {
      renderer.nodeElements.forEach(element => element.classList.remove('is-atlas-origin', 'is-upstream', 'is-downstream', 'is-lateral', 'is-muted-soft'));
      renderer.edgeElements.forEach(element => element.classList.remove('is-upstream', 'is-downstream', 'is-lateral', 'is-muted-soft'));
    };

    const atlasHighlight = (nodeId, pinned) => {
      if (state.mode !== 'atlas') return;
      clearAtlasHighlight();
      const up = ancestorIds(nodeId), down = descendantIds(nodeId), lateral = new Set();
      graph.edges.forEach(edge => {
        if (edge.source === nodeId) lateral.add(edge.target);
        if (edge.target === nodeId) lateral.add(edge.source);
      });
      const relevant = new Set([nodeId, ...up, ...down, ...lateral]);
      renderer.nodeElements.forEach((element, id) => {
        element.classList.toggle('is-atlas-origin', id === nodeId);
        element.classList.toggle('is-upstream', up.has(id));
        element.classList.toggle('is-downstream', down.has(id));
        element.classList.toggle('is-lateral', lateral.has(id));
        element.classList.toggle('is-muted-soft', !relevant.has(id));
        element.classList.toggle('is-previewed', pinned && id === nodeId);
      });
      renderer.edgeElements.forEach((element, key) => {
        const edge = renderer.lastEdges.find(item => edgeKey(item) === key);
        if (!edge) return;
        const hierarchy = edge.type === 'hierarchy' || edge.type === 'hierarchy-alt';
        const upstream = hierarchy && (edge.target === nodeId || up.has(edge.target)) && (up.has(edge.source) || edge.source === nodeId);
        const downstream = hierarchy && (edge.source === nodeId || down.has(edge.source)) && down.has(edge.target);
        const lateralEdge = !hierarchy && (edge.source === nodeId || edge.target === nodeId);
        element.classList.toggle('is-upstream', upstream);
        element.classList.toggle('is-downstream', downstream);
        element.classList.toggle('is-lateral', lateralEdge);
        element.classList.toggle('is-muted-soft', !(upstream || downstream || lateralEdge));
      });
    };

    const restoreAtlasHighlight = () => atlasPinnedId ? atlasHighlight(atlasPinnedId, true) : clearAtlasHighlight();

    /* ----------------------------------------------------------------------
       Details
       ---------------------------------------------------------------------- */
    let detailTimer = 0;
    const closeDetail = () => {
      clearTimeout(detailTimer);
      detail.classList.remove('is-open');
      detailTimer = setTimeout(() => detail.hidden = true, reducedMotion.matches ? 0 : 180);
    };

    const showDetailShell = (eyebrowText, titleText, summaryText) => {
      clearTimeout(detailTimer);
      detail.innerHTML = '';
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'detail-close';
      close.textContent = '×';
      close.setAttribute('aria-label', 'Close detail');
      close.addEventListener('click', closeDetail);
      const eyebrow = document.createElement('p');
      eyebrow.className = 'detail-eyebrow';
      eyebrow.textContent = eyebrowText;
      const heading = document.createElement('h2');
      heading.textContent = titleText;
      const summary = document.createElement('p');
      summary.className = 'detail-summary';
      summary.textContent = summaryText;
      detail.append(close, eyebrow, heading, summary);
      detail.hidden = false;
      requestAnimationFrame(() => detail.classList.add('is-open'));
    };

    const appendNodeButtons = (label, nodes) => {
      if (!nodes.length) return;
      const heading = document.createElement('p');
      heading.className = 'detail-list-title';
      heading.textContent = label;
      const list = document.createElement('div');
      list.className = 'detail-node-list is-secondary';
      [...new Map(nodes.map(node => [node.id, node])).values()].slice(0, 10).forEach(node => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = node.detailLabel || node.label;
        button.addEventListener('click', () => {
          if (state.mode === 'atlas') {
            atlasPinnedId = node.id;
            atlasHighlight(node.id, true);
            openAtlasInspector(node);
          } else updateHash(routeForNode(node));
        });
        list.appendChild(button);
      });
      detail.append(heading, list);
    };

    const openAtlasInspector = node => {
      showDetailShell(humanType(node.type), node.detailLabel || node.label, node.summary || 'A connected item in the profile map.');
      const section = primaryPath(node).find(item => item.parentIds?.includes(profileRoot.id));
      const facts = document.createElement('dl');
      facts.className = 'detail-facts atlas-facts';
      const pairs = [
        ['Part of', section?.label],
        ['Parent', (node.parentIds || []).map(id => nodeMap.get(id)?.label).filter(Boolean).join(' · ') || null],
        ['Below', `${descendantIds(node.id).size} connected descendant${descendantIds(node.id).size === 1 ? '' : 's'}`]
      ].filter(([, value]) => value);
      pairs.forEach(([key, value]) => {
        const dt = document.createElement('dt'); dt.textContent = key;
        const dd = document.createElement('dd'); dd.textContent = value;
        facts.append(dt, dd);
      });
      detail.appendChild(facts);
      appendNodeButtons('Upstream', (node.parentIds || []).map(id => nodeMap.get(id)).filter(Boolean));
      appendNodeButtons('Downstream', childrenFor(node.id));
      appendNodeButtons('Cross-links', graph.edges
        .filter(edge => edge.source === node.id || edge.target === node.id)
        .map(edge => nodeMap.get(edge.source === node.id ? edge.target : edge.source))
        .filter(Boolean));
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'detail-route-action atlas-open-local';
      action.textContent = node.id === profileRoot.id ? 'Open overview' : node.id === 'work' ? 'Open Work graph' : 'Open local graph';
      action.addEventListener('click', () => updateHash(routeForNode(node)));
      detail.appendChild(action);
    };

    const openWorkProjectDetail = projectId => {
      const project = projectMap.get(projectId);
      if (!project) return;
      showDetailShell(project.type, project.title, project.description);
      const tech = document.createElement('p');
      tech.className = 'detail-meta';
      tech.textContent = project.tech.join(' · ');
      detail.appendChild(tech);
      if (project.note) {
        const note = document.createElement('p');
        note.className = 'detail-summary detail-note';
        note.textContent = project.note;
        detail.appendChild(note);
      }
      if (project.links?.length) {
        const heading = document.createElement('p');
        heading.className = 'detail-list-title';
        heading.textContent = 'Links';
        const links = document.createElement('div');
        links.className = 'detail-node-list';
        project.links.forEach(link => {
          const anchor = document.createElement('a');
          anchor.href = link.href;
          anchor.target = '_blank';
          anchor.rel = 'noreferrer';
          anchor.textContent = link.label;
          links.appendChild(anchor);
        });
        detail.append(heading, links);
      }
    };

    const openLeafDetail = node => {
      showDetailShell(humanType(node.type), node.detailLabel || node.label, node.summary || 'A focused part of the profile.');
      if (node.status) {
        const p = document.createElement('p'); p.className = 'detail-status'; p.textContent = node.status; detail.appendChild(p);
      }
      if (node.meta) {
        const p = document.createElement('p'); p.className = 'detail-meta'; p.textContent = node.meta; detail.appendChild(p);
      }
      appendNodeButtons('Connected in the profile', graph.edges
        .filter(edge => edge.source === node.id || edge.target === node.id)
        .map(edge => nodeMap.get(edge.source === node.id ? edge.target : edge.source))
        .filter(Boolean));
    };

    /* ----------------------------------------------------------------------
       Atlas camera
       ---------------------------------------------------------------------- */
    const paintAtlas = () => renderer.camera?.setAttribute('transform', `translate(${atlasCamera.x.toFixed(2)} ${atlasCamera.y.toFixed(2)}) scale(${atlasCamera.scale.toFixed(4)})`);
    const runAtlasCamera = () => {
      if (atlasCamera.frame) return;
      if (reducedMotion.matches) {
        atlasCamera.x = atlasCamera.targetX; atlasCamera.y = atlasCamera.targetY; atlasCamera.scale = atlasCamera.targetScale;
        paintAtlas();
        return;
      }
      const frame = () => {
        const factor = .42;
        atlasCamera.x += (atlasCamera.targetX - atlasCamera.x) * factor;
        atlasCamera.y += (atlasCamera.targetY - atlasCamera.y) * factor;
        atlasCamera.scale += (atlasCamera.targetScale - atlasCamera.scale) * factor;
        paintAtlas();
        if (
          Math.abs(atlasCamera.targetX - atlasCamera.x) < .06 &&
          Math.abs(atlasCamera.targetY - atlasCamera.y) < .06 &&
          Math.abs(atlasCamera.targetScale - atlasCamera.scale) < .0007
        ) {
          atlasCamera.x = atlasCamera.targetX; atlasCamera.y = atlasCamera.targetY; atlasCamera.scale = atlasCamera.targetScale;
          atlasCamera.frame = 0; paintAtlas(); return;
        }
        atlasCamera.frame = requestAnimationFrame(frame);
      };
      atlasCamera.frame = requestAnimationFrame(frame);
    };
    const fitAtlas = immediate => {
      atlasCamera.targetX = 0; atlasCamera.targetY = 0; atlasCamera.targetScale = 1;
      if (immediate || reducedMotion.matches) {
        cancelAnimationFrame(atlasCamera.frame); atlasCamera.frame = 0;
        atlasCamera.x = 0; atlasCamera.y = 0; atlasCamera.scale = 1; paintAtlas();
      } else runAtlasCamera();
    };
    const zoomAtlas = (point, factor) => {
      const previous = atlasCamera.targetScale;
      const next = Math.max(.42, Math.min(3.2, previous * factor));
      const graphPoint = {
        x: (point.x - atlasCamera.targetX) / previous,
        y: (point.y - atlasCamera.targetY) / previous
      };
      atlasCamera.targetScale = next;
      atlasCamera.targetX = point.x - graphPoint.x * next;
      atlasCamera.targetY = point.y - graphPoint.y * next;
      runAtlasCamera();
    };

    const syncAtlasControls = () => {
      if (!atlasControls) return;
      atlasControls.hidden = state.mode !== 'atlas';
      if (atlasHierarchy) atlasHierarchy.checked = atlasOptions.hierarchy;
      if (atlasCrosslinks) atlasCrosslinks.checked = atlasOptions.crossLinks;
      if (atlasSecondary) atlasSecondary.checked = atlasOptions.secondary;
    };
    [atlasHierarchy, atlasCrosslinks, atlasSecondary].filter(Boolean).forEach(control => {
      control.addEventListener('change', () => {
        atlasOptions.hierarchy = atlasHierarchy?.checked ?? true;
        atlasOptions.crossLinks = atlasCrosslinks?.checked ?? true;
        atlasOptions.secondary = atlasSecondary?.checked ?? false;
        if (state.mode === 'atlas') renderGraph();
      });
    });
    const structureOnly = document.createElement('button');
    structureOnly.type = 'button';
    structureOnly.className = 'atlas-structure-only';
    structureOnly.textContent = 'Structure only';
    structureOnly.addEventListener('click', () => {
      atlasOptions.hierarchy = true; atlasOptions.crossLinks = false; atlasOptions.secondary = false;
      syncAtlasControls(); if (state.mode === 'atlas') renderGraph();
    });
    if (atlasShowAll?.parentElement && !atlasShowAll.parentElement.querySelector('.atlas-structure-only')) {
      atlasShowAll.before(structureOnly);
      atlasShowAll.textContent = 'All relations';
    }
    atlasShowAll?.addEventListener('click', () => {
      atlasOptions.hierarchy = true; atlasOptions.crossLinks = true; atlasOptions.secondary = true;
      syncAtlasControls(); if (state.mode === 'atlas') renderGraph();
    });
    atlasFit?.addEventListener('click', () => fitAtlas(false));
    atlasReset?.addEventListener('click', () => {
      atlasPinnedId = null; clearAtlasHighlight(); closeDetail(); fitAtlas(false);
    });
    atlasZoomIn?.addEventListener('click', () => renderer.lastLayout && zoomAtlas({ x: renderer.lastLayout.width / 2, y: renderer.lastLayout.height / 2 }, 1.26));
    atlasZoomOut?.addEventListener('click', () => renderer.lastLayout && zoomAtlas({ x: renderer.lastLayout.width / 2, y: renderer.lastLayout.height / 2 }, 1 / 1.26));

    /* ----------------------------------------------------------------------
       Routing / chrome
       ---------------------------------------------------------------------- */
    const updateHash = route => {
      const target = `#${normaliseRoute(route)}`;
      if (location.hash !== target) location.hash = target;
      else renderRoute(target);
    };

    const bindRoute = element => {
      if (!element || element.dataset.graphRouteBound === 'true') return;
      element.dataset.graphRouteBound = 'true';
      element.addEventListener('click', event => {
        event.preventDefault();
        updateHash(element.dataset.route || normaliseRoute(element.getAttribute('href')));
      });
    };
    document.querySelectorAll('[data-route]').forEach(bindRoute);

    const renderBreadcrumb = target => {
      breadcrumb.innerHTML = '';
      const path = state.mode === 'atlas'
        ? [profileRoot, { label: 'Atlas', route: 'atlas' }]
        : state.mode === 'work'
          ? [profileRoot, workRoot]
          : primaryPath(target);
      path.forEach((item, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'graph-crumb';
        button.textContent = item.label;
        button.dataset.route = item.route || 'overview';
        button.setAttribute('aria-current', String(index === path.length - 1));
        bindRoute(button);
        breadcrumb.appendChild(button);
        if (index < path.length - 1) {
          const edge = document.createElement('span');
          edge.className = 'graph-crumb-edge';
          edge.setAttribute('aria-hidden', 'true');
          breadcrumb.appendChild(edge);
        }
      });
    };

    const setCopy = target => {
      kicker.textContent = state.mode === 'atlas' ? 'Atlas' : state.mode === 'work' ? 'Work' : state.mode === 'overview' ? 'Profile graph' : humanType(target.type);
      title.textContent = state.mode === 'overview'
        ? 'Explore the profile'
        : state.mode === 'atlas'
          ? 'Full profile graph'
          : state.mode === 'work'
            ? 'Work'
            : target.label;
      help.textContent = state.mode === 'atlas'
        ? 'Hover to distinguish upstream, downstream and cross-links. Click to pin a node and inspect it.'
        : state.mode === 'work'
          ? 'The Work concept lattice is part of the same map. Use the side filters, themes, concepts or project labels directly.'
          : state.mode === 'overview'
            ? 'Select an area to let the map unfold around it.'
            : 'Select a connected node to move deeper. Ancestors remain in the graph.';
    };

    const hideLegacy = () => {
      document.querySelectorAll('.legacy-section').forEach(element => element.hidden = true);
      if (footer) footer.hidden = true;
      if (workLegacy) workLegacy.hidden = true;
    };

    const updateNavigation = () => {
      document.querySelectorAll('#main-nav [data-route]').forEach(item => {
        const route = item.dataset.route;
        const current = route === state.route ||
          (state.mode === 'work' && route === 'work') ||
          (state.mode === 'focus' && state.route.startsWith(`${route}/`));
        item.setAttribute('aria-current', current ? 'page' : 'false');
      });
    };

    const renderRoute = rawRoute => {
      ++routeToken;
      const route = normaliseRoute(rawRoute);
      hideLegacy();

      const projectMatch = route.match(/^work\/project\/([^/]+)$/);
      const themeMatch = route.match(/^work\/theme\/([^/]+)$/);

      if (route === 'work' || projectMatch || themeMatch) {
        state = {
          route,
          mode: 'work',
          node: workRoot,
          workProjectId: projectMatch?.[1] || null
        };
        document.body.dataset.graphMode = 'work';
        document.body.dataset.graphRoute = route;
        hero.hidden = true;
        explorer.hidden = false;
        graphPanel.hidden = false;
        routebar.hidden = false;
        controls.hidden = false;
        atlasPinnedId = null;
        clearAtlasHighlight();

        if (themeMatch) {
          const themeId = themeMatch[1];
          if (attributeMap.has(themeId)) setThemesViaControls([themeId], 'any');
        }

        setCopy(workRoot);
        renderBreadcrumb(workRoot);
        syncAtlasControls();
        renderGraph();
        if (projectMatch) openWorkProjectDetail(projectMatch[1]);
        else closeDetail();
        updateNavigation();
        status.textContent = projectMatch ? `${projectMap.get(projectMatch[1])?.title || 'Project'} open in Work graph.` : 'Work graph open.';
        return;
      }

      const atlas = route === 'atlas';
      const target = atlas ? profileRoot : (nodeForRoute(route) || profileRoot);
      state = {
        route: atlas ? 'atlas' : routeForNode(target),
        mode: atlas ? 'atlas' : target.id === profileRoot.id ? 'overview' : 'focus',
        node: target,
        workProjectId: null
      };

      document.body.dataset.graphMode = state.mode;
      document.body.dataset.graphRoute = state.route;
      hero.hidden = state.mode !== 'overview';
      explorer.hidden = false;
      graphPanel.hidden = false;
      routebar.hidden = false;
      controls.hidden = true;
      setCopy(target);
      renderBreadcrumb(target);
      syncAtlasControls();
      renderGraph();

      if (state.mode === 'atlas') {
        fitAtlas(true);
        closeDetail();
      } else {
        atlasPinnedId = null;
        clearAtlasHighlight();
        if (state.mode === 'focus' && childrenFor(target.id).length === 0) openLeafDetail(target);
        else closeDetail();
      }
      updateNavigation();
      status.textContent = `${title.textContent} view open.`;
    };

    /* Work control events occur after the legacy Work script updates its state. */
    document.addEventListener('click', event => {
      if (suppressWorkControlRender || state.mode !== 'work') return;
      if (event.target.closest?.('.integrated-work-controls')) {
        setTimeout(() => renderGraph(), 0);
      }
    });
    document.addEventListener('change', event => {
      if (suppressWorkControlRender || state.mode !== 'work') return;
      if (event.target.closest?.('.integrated-work-controls')) {
        setTimeout(() => renderGraph(), 0);
      }
    });

    window.addEventListener('hashchange', () => renderRoute(location.hash));
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(renderGraph, 100);
    });

    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if (!detail.hidden) {
        event.preventDefault();
        if (state.mode === 'atlas' && atlasPinnedId) {
          atlasPinnedId = null;
          clearAtlasHighlight();
        }
        closeDetail();
        return;
      }
      if (state.mode === 'work' || state.mode === 'atlas') {
        event.preventDefault();
        updateHash('overview');
        return;
      }
      if (state.mode === 'focus') {
        event.preventDefault();
        updateHash(routeForNode(nodeMap.get(state.node.parentIds?.[0]) || profileRoot));
      }
    });

    controls.hidden = true;
    hideLegacy();
    renderRoute(location.hash || '#overview');
    window.addEventListener('load', () => {
      if (state.mode === 'work') renderGraph();
    }, { once: true });
  };

  setTimeout(boot, 0);
})();