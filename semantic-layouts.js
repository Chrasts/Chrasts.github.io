/*
 * Deterministic temporal projections for the two graph-native timeline
 * fragments. This module owns only pure time -> geometry computation; the
 * graph renderer continues to own SVG, routing, animation and interaction.
 */
(() => {
  const site = window.SITE_DATA;
  const graph = site?.graph;
  if (!graph?.nodes?.length || window.ProfileSemanticLayouts) return;

  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const rootId = graph.rootId || 'stepan-chrast';
  const isMobile = () => matchMedia('(max-width: 900px)').matches;
  const point = (x, y) => ({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  const includes = (nodes, id) => nodes.some(node => node.id === id);
  const temporalValue = value => {
    const match = String(value || '').match(/^(\d{4})(?:-(\d{2}))?$/);
    if (!match) return null;
    // Year precision is only a mid-year geometry anchor; the original YYYY
    // remains the displayed and accessible truth.
    return Number(match[1]) * 12 + (match[2] ? Number(match[2]) - 1 : 5);
  };
  const hasAncestor = (node, id, seen = new Set()) => {
    if (!node || seen.has(node.id)) return false;
    if ((node.parentIds || []).includes(id)) return true;
    seen.add(node.id);
    return (node.parentIds || []).some(parentId => hasAncestor(nodeMap.get(parentId), id, seen));
  };

  /* A compact, pure piecewise scale. It is shared by Experience and Education
     without becoming a second rendering/runtime system. */
  const TemporalScale = ({ segments, present }) => {
    const values = segments.map(segment => ({ ...segment, fromValue: temporalValue(segment.from), toValue: temporalValue(segment.to) }))
      .filter(segment => Number.isFinite(segment.fromValue) && Number.isFinite(segment.toValue));
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const segmentFor = value => values.find(segment => value >= segment.fromValue && value <= segment.toValue) ||
      (value < values[0]?.fromValue ? values[0] : values[values.length - 1]);
    const position = date => {
      const value = temporalValue(date), segment = segmentFor(value);
      if (!segment || !Number.isFinite(value)) return null;
      const progress = clamp((value - segment.fromValue) / Math.max(1, segment.toValue - segment.fromValue), 0, 1);
      return segment.positionStart + (segment.positionEnd - segment.positionStart) * progress;
    };
    return Object.freeze({
      position,
      interval: (start, end, ongoing = false) => ({ start: position(start), end: position(ongoing ? present : end || start) }),
      segmentFor,
      clamp,
      describeScale: () => values.map(value => ({ ...value }))
    });
  };

  const assignIntervalLanes = records => {
    const ends = [], lanes = new Map();
    [...records].sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id)).forEach(record => {
      let lane = ends.findIndex(end => end < record.start);
      if (lane < 0) lane = ends.length;
      ends[lane] = record.end;
      lanes.set(record.id, lane);
    });
    return lanes;
  };
  const rangeFor = (node, present) => ({ start: node.startDate, end: node.ongoing ? present : node.endDate || node.startDate, ongoing: Boolean(node.ongoing) });
  const experienceConfig = () => site.semantics?.experience?.timeline || ({ careerFocusStart: '2026-07', earlierStart: '2019-01', earlierEnd: '2023-12', present: '2026-10' });

  // A role detail changes semantic mode: dates remain in its inspector, while
  // this layout renders only the local relation graph. Keeping it separate
  // prevents temporal guides from leaking into focused-role scenes.
  const experienceRoleFocusLayout = ({ nodes, selectedNode, mobile }) => {
    const width = 1200, height = 720, positions = new Map();
    const roleId = selectedNode?.id;
    const projects = nodes.filter(node => node.type === 'project');
    const semanticNodeVariants = new Map();
    const semanticNodePriorities = new Map();

    // The persistent ancestor root stays below the graph HUD/breadcrumb lane.
    // This keeps the node and its halo from competing with route context.
    positions.set(rootId, mobile ? point(600, 78) : point(178, 180));
    if (includes(nodes, 'experience')) positions.set('experience', mobile ? point(410, 204) : point(274, 278));
    if (roleId) {
      positions.set(roleId, mobile ? point(560, 354) : point(474, 338));
      semanticNodeVariants.set(roleId, selectedNode?.ongoing ? 'experience-current' : 'experience-earlier');
      semanticNodePriorities.set(roleId, 'primary');
    }

    // The far-right desktop field is reserved for the one Phase 8 inspector.
    // Children remain fully visible in the centre/right local graph field.
    projects.forEach((project, index) => {
      const desktopOffsets = [{ x: 178, y: -88 }, { x: 208, y: 108 }, { x: 70, y: 202 }];
      const mobileOffsets = [{ x: -150, y: 140 }, { x: 156, y: 140 }, { x: 0, y: 252 }];
      const offset = (mobile ? mobileOffsets : desktopOffsets)[index] || (mobile
        ? { x: index % 2 ? 150 : -150, y: 140 + Math.floor(index / 2) * 112 }
        : { x: 160, y: -86 + index * 122 });
      const anchor = positions.get(roleId) || point(520, 340);
      positions.set(project.id, point(anchor.x + offset.x, anchor.y + offset.y));
      semanticNodePriorities.set(project.id, 'secondary');
    });

    return {
      width, height, positions,
      semanticGuides: [],
      timelineNodeIds: new Set(),
      semanticNodeVariants,
      semanticNodePriorities,
      semanticSectionAnchors: new Set(['experience']),
      semanticKind: 'experience-role-focus'
    };
  };

  const experienceLayout = ({ nodes, selectedNode, mobile }) => {
    if (selectedNode?.type === 'experience') return experienceRoleFocusLayout({ nodes, selectedNode, mobile });
    const width = 1200, height = 720, positions = new Map(), guides = [];
    const config = experienceConfig();
    const roles = nodes.filter(node => node.type === 'experience');
    const earlier = roles.filter(role => temporalValue(role.startDate) < temporalValue(config.careerFocusStart));
    const current = roles.filter(role => !earlier.includes(role));
    const timelineNodeIds = new Set(roles.map(role => role.id));
    const semanticNodeVariants = new Map(roles.map(role => [role.id, earlier.includes(role) ? 'experience-earlier' : 'experience-current']));
    const semanticSectionAnchors = new Set(['experience']);
    const semanticNodePriorities = new Map([
      ['ceske-priority', 'primary'],
      ['student-ball', 'tertiary'], ['escape-room', 'tertiary'],
      ['experience', 'tertiary']
    ]);
    const timelineLabelMeta = new Map([
      // The historic lanes stay readable by default; exact dates remain in
      // the accessible name and appear in the focused inspector.
      ['student-ball', { text: '', hidden: true }],
      ['escape-room', { text: '', hidden: true }],
      ['ceske-priority', { text: 'Jul 2026 - present' }]
    ]);
    const timelineTextOffsets = new Map([
      ['student-ball', { label: -16, meta: -29 }],
      ['escape-room', { label: -16, meta: -29 }],
      ['ceske-priority', { label: -18, meta: -32 }]
    ]);
    positions.set(rootId, mobile ? point(600, 74) : point(190, 94));
    if (includes(nodes, 'experience')) positions.set('experience', mobile ? point(482, 204) : point(236, 274));

    if (mobile) {
      const axisX = 600;
      const scale = TemporalScale({ present: config.present, segments: [
        { from: config.earlierStart, to: config.earlierEnd, positionStart: 260, positionEnd: 405 },
        { from: config.careerFocusStart, to: config.present, positionStart: 490, positionEnd: 642 }
      ] });
      guides.push({ id: 'experience-axis', kind: 'timeline-axis', x1: axisX, y1: 240, x2: axisX, y2: 660 });
      ['2019', '2021', '2023'].forEach(year => {
        const y = scale.position(year);
        guides.push({ id: `experience-tick-${year}`, kind: 'timeline-tick', x1: axisX - 7, y1: y, x2: axisX + 7, y2: y, label: year, labelX: axisX - 30, labelY: y + 3 });
      });
      const focusY = scale.position(config.careerFocusStart);
      guides.push({ id: 'experience-tick-career-focus', kind: 'timeline-tick', x1: axisX - 7, y1: focusY, x2: axisX + 7, y2: focusY });
      const lanes = assignIntervalLanes(earlier.map(role => { const range = rangeFor(role, config.present); return { id: role.id, start: temporalValue(range.start), end: temporalValue(range.end) }; }));
      earlier.forEach(role => {
        const range = rangeFor(role, config.present), interval = scale.interval(range.start, range.end, range.ongoing);
        const laneX = (lanes.get(role.id) || 0) ? 800 : 400;
        positions.set(role.id, point(laneX, (interval.start + interval.end) / 2));
        guides.push({ id: `experience-duration-${role.id}`, kind: 'temporal-range', x1: laneX, y1: interval.start, x2: laneX, y2: interval.end });
        guides.push({ id: `experience-stem-${role.id}`, kind: 'temporal-stem', x1: axisX, y1: (interval.start + interval.end) / 2, x2: laneX + (laneX < axisX ? 14 : -14), y2: (interval.start + interval.end) / 2 });
      });
      current.forEach((role, index) => {
        const range = rangeFor(role, config.present), interval = scale.interval(range.start, range.end, range.ongoing), laneX = 740 + index * 54;
        positions.set(role.id, point(laneX, (interval.start + interval.end) / 2));
        guides.push({ id: `experience-duration-${role.id}`, kind: 'temporal-range', x1: laneX, y1: interval.start, x2: laneX, y2: interval.end, current: range.ongoing });
        guides.push({ id: `experience-stem-${role.id}`, kind: 'temporal-stem', x1: axisX, y1: interval.start, x2: laneX - 14, y2: interval.start });
      });
      guides.push({ id: 'experience-present', kind: 'present', x1: axisX - 14, y1: 660, x2: axisX + 14, y2: 660, label: 'Present', labelX: 690, labelY: 664 });
    } else {
      const axisY = 390;
      const scale = TemporalScale({ present: config.present, segments: [
        { from: config.earlierStart, to: config.earlierEnd, positionStart: 210, positionEnd: 490 },
        { from: config.careerFocusStart, to: config.present, positionStart: 590, positionEnd: 1080 }
      ] });
      guides.push({ id: 'experience-axis', kind: 'timeline-axis', x1: 210, y1: axisY, x2: 1080, y2: axisY });
      ['2019', '2021', '2023'].forEach(year => {
        const x = scale.position(year);
        guides.push({ id: `experience-tick-${year}`, kind: 'timeline-tick', x1: x, y1: axisY - 7, x2: x, y2: axisY + 7, label: year, labelY: axisY + 27 });
      });
      const focusX = scale.position(config.careerFocusStart);
      guides.push({ id: 'experience-tick-career-focus', kind: 'timeline-tick', x1: focusX, y1: axisY - 7, x2: focusX, y2: axisY + 7 });
      const lanes = assignIntervalLanes(earlier.map(role => { const range = rangeFor(role, config.present); return { id: role.id, start: temporalValue(range.start), end: temporalValue(range.end) }; }));
      earlier.forEach(role => {
        const range = rangeFor(role, config.present), interval = scale.interval(range.start, range.end, range.ongoing);
        const laneY = axisY - 78 - (lanes.get(role.id) || 0) * 54;
        positions.set(role.id, point((interval.start + interval.end) / 2, laneY));
        guides.push({ id: `experience-duration-${role.id}`, kind: 'temporal-range', x1: interval.start, y1: laneY, x2: interval.end, y2: laneY });
        guides.push({ id: `experience-stem-${role.id}`, kind: 'temporal-stem', x1: (interval.start + interval.end) / 2, y1: laneY + 9, x2: (interval.start + interval.end) / 2, y2: axisY - 7 });
      });
      current.forEach((role, index) => {
        const range = rangeFor(role, config.present), interval = scale.interval(range.start, range.end, range.ongoing);
        const laneY = axisY - 84 - index * 42;
        positions.set(role.id, point((interval.start + interval.end) / 2, laneY));
        guides.push({ id: `experience-duration-${role.id}`, kind: 'temporal-range', x1: interval.start, y1: laneY, x2: interval.end, y2: laneY, current: range.ongoing });
        guides.push({ id: `experience-stem-${role.id}`, kind: 'temporal-stem', x1: interval.start, y1: laneY + 9, x2: interval.start, y2: axisY - 7 });
      });
      guides.push({ id: 'experience-present', kind: 'present', x1: 1080, y1: axisY - 13, x2: 1080, y2: axisY + 13, label: 'Present', labelY: axisY - 24 });
    }

    return { width, height, positions, semanticGuides: guides, timelineNodeIds, timelineTextOffsets, timelineLabelMeta, semanticNodeVariants, semanticNodePriorities, semanticSectionAnchors, semanticKind: 'experience-temporal' };
  };

  const educationLayout = ({ nodes, selectedNode, mobile }) => {
    const width = 1200, height = 720, positions = new Map(), guides = [];
    const visible = new Set(nodes.map(node => node.id));
    const bsc = 'charles-university', msc = 'charles-university-masters-logic', present = '2026-10';
    const selectedId = selectedNode?.id || 'education';
    const timelineNodeIds = new Set();
    const semanticSectionAnchors = new Set(['education']);
    const semanticNodePriorities = new Map([
      [bsc, 'primary'], [msc, 'primary'], ['prg-ai', 'primary'],
      ['esslli', 'secondary'],
      ['cert-cambridge-b2', 'tertiary'], ['cert-ethics-ai', 'tertiary'], ['cert-intro-ai', 'tertiary'],
      ['education', 'tertiary']
    ]);
    // Text is deliberately assigned to the free side of each rail. This
    // prevents date ticks, degree labels and credential labels occupying the
    // same narrow strip around the academic axis.
    const timelineTextOffsets = new Map([
      [bsc, { label: 18, meta: 32 }],
      [msc, { label: 18, meta: 32 }],
      ['esslli', { label: -16, meta: -29 }],
      ['prg-ai', { label: -16, meta: -29 }]
    ]);
    const timelineLabelMeta = new Map([
      [bsc, { text: '2022 - Sep 2026' }],
      [msc, { text: 'Sep 2026 - present' }],
      ['esslli', { text: '2026' }],
      ['prg-ai', { text: '2026 - present' }]
    ]);
    if (mobile) {
      // Phone labels are rendered at a much larger physical scale. Keep the
      // same truth-bearing rails, but use displaced, one-line overview labels
      // instead of allowing the 2026 cluster to turn into a text pile.
      timelineTextOffsets.set(bsc, { label: -42, meta: -27 });
      timelineTextOffsets.set(msc, { label: 12, meta: 28 });
      timelineTextOffsets.set('esslli', { label: -92, meta: -76 });
      timelineTextOffsets.set('prg-ai', { label: 108, meta: 124 });
      timelineLabelMeta.set(bsc, { text: '', hidden: true });
      timelineLabelMeta.set(msc, { text: '', hidden: true });
      timelineLabelMeta.set('esslli', { text: '', hidden: true });
      timelineLabelMeta.set('prg-ai', { text: '', hidden: true });
    }
    const semanticNodeVariants = new Map([[bsc, 'degree'], [msc, 'degree'], ['prg-ai', 'degree'], ['esslli', 'programme']]);
    const evidenceConstellation = [];
    positions.set(rootId, mobile ? point(600, 72) : point(190, 94));
    if (visible.has('education')) positions.set('education', mobile ? point(482, 198) : point(236, 264));
    const credentials = nodes.filter(node => node.parentIds?.includes('credentials'))
      .sort((a, b) => (temporalValue(a.awardDate) || 0) - (temporalValue(b.awardDate) || 0) || a.id.localeCompare(b.id));
    const programme = (id, scale, lane, vertical) => {
      const node = nodeMap.get(id);
      if (!node || !visible.has(id)) return null;
      const range = rangeFor(node, present), interval = scale.interval(range.start, range.end, range.ongoing);
      const position = vertical ? point(lane, (interval.start + interval.end) / 2) : point((interval.start + interval.end) / 2, lane);
      positions.set(id, position); timelineNodeIds.add(id);
      guides.push(vertical
        ? { id: `education-duration-${id}`, kind: 'temporal-range', x1: lane, y1: interval.start, x2: lane, y2: interval.end, current: range.ongoing }
        : { id: `education-duration-${id}`, kind: 'temporal-range', x1: interval.start, y1: lane, x2: interval.end, y2: lane, current: range.ongoing });
      return { interval, position };
    };

    if (mobile) {
      const axisX = 600, scale = TemporalScale({ present, segments: [{ from: '2021', to: present, positionStart: 246, positionEnd: 650 }] });
      guides.push({ id: 'education-trajectory', kind: 'timeline-axis', x1: axisX, y1: 230, x2: axisX, y2: 670 });
      ['2021', '2022', '2024', '2026'].forEach(year => { const y = scale.position(year); guides.push({ id: `education-tick-${year}`, kind: 'timeline-tick', x1: axisX - 7, y1: y, x2: axisX + 7, y2: y, label: year, labelX: axisX - 30, labelY: y + 3 }); });
      const bscProgramme = programme(bsc, scale, 520, true), mscProgramme = programme(msc, scale, 666, true);
      programme('esslli', scale, 780, true); const prgProgramme = programme('prg-ai', scale, 820, true);
      if (bscProgramme && mscProgramme) guides.push({ id: 'education-degree-continuation', kind: 'trajectory-continuation', x1: 520, y1: bscProgramme.interval.end, x2: 666, y2: mscProgramme.interval.start });
      if (mscProgramme && prgProgramme) guides.push({ id: 'education-minor-branch', kind: 'minor-branch', x1: 666, y1: mscProgramme.interval.start, x2: 820, y2: prgProgramme.interval.start });
      const credentialGroups = new Map();
      credentials.forEach(node => credentialGroups.set(node.awardDate, [...(credentialGroups.get(node.awardDate) || []), node]));
      [...credentialGroups].forEach(([date, group]) => {
        const y = scale.position(date), branchX = 300;
        if (group.length === 1) {
          const node = group[0];
          positions.set(node.id, point(branchX, y)); timelineNodeIds.add(node.id); semanticNodeVariants.set(node.id, 'credential');
          timelineTextOffsets.set(node.id, { label: 18, meta: 34 }); timelineLabelMeta.set(node.id, { text: date });
          guides.push({ id: `education-credential-stem-${node.id}`, kind: 'temporal-stem', x1: axisX - 8, y1: y, x2: branchX + 12, y2: y, label: 'Credentials', labelX: 294, labelY: y - 12 });
          return;
        }
        guides.push({ id: `education-credential-shared-${date}`, kind: 'temporal-stem', x1: axisX - 8, y1: y, x2: 530, y2: y });
        group.forEach((node, index) => {
          const x = index === 0 ? 240 : 960, nodeY = y - 48;
          positions.set(node.id, point(x, nodeY)); timelineNodeIds.add(node.id); semanticNodeVariants.set(node.id, 'credential');
          timelineTextOffsets.set(node.id, { label: 16, meta: 29 }); timelineLabelMeta.set(node.id, { text: '', hidden: true });
          guides.push({ id: `education-credential-stem-${node.id}`, kind: 'temporal-stem', x1: 530, y1: y, x2: x + (x < 530 ? 12 : -12), y2: nodeY });
        });
      });
      guides.push({ id: 'education-present', kind: 'present', x1: axisX - 14, y1: 670, x2: axisX + 14, y2: 670, label: 'Present', labelX: 686, labelY: 674 });
    } else {
      const axisY = 380, scale = TemporalScale({ present, segments: [{ from: '2021', to: present, positionStart: 220, positionEnd: 1080 }] });
      guides.push({ id: 'education-trajectory', kind: 'timeline-axis', x1: 220, y1: axisY, x2: 1080, y2: axisY });
      ['2021', '2022', '2024', '2026'].forEach(year => { const x = scale.position(year); guides.push({ id: `education-tick-${year}`, kind: 'timeline-tick', x1: x, y1: axisY - 7, x2: x, y2: axisY + 7, label: year, labelY: axisY + 27 }); });
      const bscProgramme = programme(bsc, scale, 430, false), mscProgramme = programme(msc, scale, 492, false);
      // Both programmes occur close to the 2026 boundary. Their time x
      // remains exact, while deliberately separated lanes keep their labels
      // independently readable.
      programme('esslli', scale, 244, false); const prgProgramme = programme('prg-ai', scale, 318, false);
      if (bscProgramme && mscProgramme) guides.push({ id: 'education-degree-continuation', kind: 'trajectory-continuation', x1: bscProgramme.interval.end, y1: 430, x2: mscProgramme.interval.start, y2: 492 });
      if (mscProgramme && prgProgramme) guides.push({ id: 'education-minor-branch', kind: 'minor-branch', x1: mscProgramme.interval.start, y1: 492, x2: prgProgramme.interval.start, y2: 318 });
      const credentialGroups = new Map();
      credentials.forEach(node => credentialGroups.set(node.awardDate, [...(credentialGroups.get(node.awardDate) || []), node]));
      [...credentialGroups].forEach(([date, group]) => {
        const x = scale.position(date), baseY = 508;
        if (group.length === 1) {
          const node = group[0], y = 540;
          positions.set(node.id, point(x, y)); timelineNodeIds.add(node.id); semanticNodeVariants.set(node.id, 'credential');
          timelineTextOffsets.set(node.id, { label: 16, meta: 29 }); timelineLabelMeta.set(node.id, { text: date });
          guides.push({ id: `education-credential-stem-${node.id}`, kind: 'temporal-stem', x1: x, y1: axisY + 8, x2: x, y2: y - 10, label: 'Credentials', labelX: x - 62, labelY: y - 18 });
          return;
        }
        guides.push({ id: `education-credential-shared-${date}`, kind: 'temporal-stem', x1: x, y1: axisY + 8, x2: x, y2: baseY });
        group.forEach((node, index) => {
          const nodeX = x + (index === 0 ? -86 : 86), nodeY = 542;
          positions.set(node.id, point(nodeX, nodeY)); timelineNodeIds.add(node.id); semanticNodeVariants.set(node.id, 'credential');
          timelineTextOffsets.set(node.id, { label: 16, meta: 29 }); timelineLabelMeta.set(node.id, { text: date });
          guides.push({ id: `education-credential-stem-${node.id}`, kind: 'temporal-stem', x1: x, y1: baseY, x2: nodeX, y2: nodeY - 10 });
        });
      });
      guides.push({ id: 'education-present', kind: 'present', x1: 1080, y1: axisY - 13, x2: 1080, y2: axisY + 13, label: 'Present', labelX: 1110, labelY: axisY + 3 });
    }

    const bscFocus = selectedId === bsc || selectedId === 'project-bachelor-thesis';
    if (bscFocus) {
      // The focused BSc scene reserves a stable left-centre constellation;
      // no evidence or thesis object enters the inspector's right-hand zone.
      positions.set(bsc, mobile ? point(520, 360) : point(410, 326));
    }
    if (bscFocus && visible.has('project-bachelor-thesis')) {
      const from = positions.get(bsc), thesis = mobile ? point(725, 468) : point(610, 332);
      positions.set('project-bachelor-thesis', thesis);
      if (from) guides.push({ id: 'education-thesis', kind: 'evidence', x1: from.x, y1: from.y, x2: thesis.x, y2: thesis.y, label: 'Thesis' });
    }
    if (selectedId === bsc && !mobile) {
      const anchor = positions.get(bsc) || point(410, 326);
      (site.semantics?.education?.courseEvidence || []).filter(item => ['completed', 'recognized'].includes(item.status)).slice(0, 4)
        .forEach((item, index) => {
          const offset = [{ x: 122, y: -96 }, { x: 252, y: -42 }, { x: 258, y: 72 }, { x: 118, y: 122 }][index];
          const position = point(anchor.x + offset.x, anchor.y + offset.y);
          evidenceConstellation.push({ id: item.id, label: item.title, position, knowledgeIds: item.supportsKnowledgeIds || [], status: item.status, programmeId: item.programmeId });
          guides.push({ id: `education-evidence-${item.id}`, kind: 'evidence', x1: anchor.x, y1: anchor.y, x2: position.x, y2: position.y });
        });
    }
    // Leaf programme focus uses a composed local anchor too, rather than
    // opening an inspector over the item at the far-right overview endpoint.
    if (['charles-university-masters-logic', 'esslli', 'prg-ai'].includes(selectedId)) {
      positions.set(selectedId, mobile ? point(570, 372) : point(470, 330));
    }
    return { width, height, positions, semanticGuides: guides, semanticEvidence: evidenceConstellation, timelineNodeIds, timelineTextOffsets, timelineLabelMeta, semanticNodeVariants, semanticNodePriorities, semanticSectionAnchors, semanticKind: 'education-trajectory' };
  };

  // A programme, certificate or thesis is a local reading scene, not a second
  // copy of the Education overview.  In particular, keeping the large
  // chronological rails out of this mode prevents them from briefly leaking
  // through while a cross-section route returns to a BSc-related detail.
  const educationFocusLayout = ({ nodes, selectedNode, mobile }) => {
    const width = 1200, height = 720, positions = new Map(), guides = [];
    const selectedId = selectedNode?.id || 'education';
    const visible = new Set(nodes.map(node => node.id));
    const semanticNodeVariants = new Map();
    const semanticNodePriorities = new Map();
    const evidenceConstellation = [];

    positions.set(rootId, mobile ? point(600, 78) : point(178, 108));
    if (visible.has('education')) positions.set('education', mobile ? point(410, 204) : point(274, 278));

    const focal = mobile ? point(570, 360) : point(466, 332);
    if (selectedId !== 'education' && visible.has(selectedId)) {
      positions.set(selectedId, focal);
      semanticNodePriorities.set(selectedId, 'primary');
      if (['charles-university', 'charles-university-masters-logic', 'prg-ai'].includes(selectedId)) semanticNodeVariants.set(selectedId, 'degree');
      else if (selectedId === 'esslli') semanticNodeVariants.set(selectedId, 'programme');
      else if (selectedNode?.type === 'credential') semanticNodeVariants.set(selectedId, 'credential');
    }

    if (visible.has('project-bachelor-thesis')) {
      const thesis = mobile ? point(774, 476) : point(654, 332);
      positions.set('project-bachelor-thesis', thesis);
      semanticNodePriorities.set('project-bachelor-thesis', 'secondary');
      if (positions.has('charles-university')) {
        const from = positions.get('charles-university');
        guides.push({ id: 'education-thesis', kind: 'evidence', x1: from.x, y1: from.y, x2: thesis.x, y2: thesis.y, label: 'Thesis' });
      }
    }

    if (selectedId === 'charles-university' && !mobile) {
      const anchor = positions.get(selectedId) || focal;
      (site.semantics?.education?.courseEvidence || [])
        .filter(item => ['completed', 'recognized'].includes(item.status))
        .slice(0, 4)
        .forEach((item, index) => {
          const offset = [{ x: 122, y: -96 }, { x: 260, y: -42 }, { x: 266, y: 72 }, { x: 122, y: 122 }][index];
          const position = point(anchor.x + offset.x, anchor.y + offset.y);
          evidenceConstellation.push({ id: item.id, label: item.title, position, knowledgeIds: item.supportsKnowledgeIds || [], status: item.status, programmeId: item.programmeId });
          guides.push({ id: `education-evidence-${item.id}`, kind: 'evidence', x1: anchor.x, y1: anchor.y, x2: position.x, y2: position.y });
        });
    }

    // Certificate routes retain enough nearby context to be intelligible,
    // while remaining a compact local scene rather than a dated axis.
    if (selectedNode?.type === 'credential') {
      nodes.filter(node => node.type === 'credential' && node.id !== selectedId).forEach((node, index) => {
        positions.set(node.id, mobile ? point(390 + index * 210, 514) : point(640 + index * 145, 432));
        semanticNodeVariants.set(node.id, 'credential');
        semanticNodePriorities.set(node.id, 'tertiary');
      });
    }

    return {
      width, height, positions,
      semanticGuides: guides,
      semanticEvidence: evidenceConstellation,
      timelineNodeIds: new Set(),
      semanticNodeVariants,
      semanticNodePriorities,
      semanticSectionAnchors: new Set(['education']),
      semanticKind: 'education-focus'
    };
  };

  const compute = options => {
    const nodes = options?.nodes || [], selectedNode = options?.selectedNode || null, mobile = options?.mobile ?? isMobile();
    if (selectedNode?.id === 'experience' || selectedNode?.type === 'experience' || hasAncestor(selectedNode, 'experience')) return experienceLayout({ nodes, selectedNode, mobile });
    if (selectedNode?.id === 'education') return educationLayout({ nodes, selectedNode, mobile });
    if (selectedNode?.type === 'education' || selectedNode?.type === 'credential' || hasAncestor(selectedNode, 'education')) return educationFocusLayout({ nodes, selectedNode, mobile });
    return null;
  };

  window.ProfileSemanticLayouts = Object.freeze({
    compute, TemporalScale, ExperienceTemporalLayout: experienceLayout, EducationTrajectoryLayout: educationLayout, EducationFocusLayout: educationFocusLayout,
    snapshot: () => ({ experience: site.semantics?.experience?.entityIds || [], education: site.semantics?.education?.programmeIds || [] })
  });
})();
