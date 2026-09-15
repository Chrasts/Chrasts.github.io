/*
 * Section-specific geometry for domains which are not taxonomies.
 *
 * This module is intentionally pure: it owns deterministic positions and
 * non-interactive semantic guides, while site-graph keeps routing, rendering,
 * animation and interaction ownership.  That avoids a second graph runtime
 * and keeps the expensive work to a few small Maps per route change.
 */
(() => {
  const site = window.SITE_DATA;
  const graph = site?.graph;
  if (!graph?.nodes?.length || window.ProfileSemanticLayouts) return;

  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const rootId = graph.rootId || 'stepan-chrast';
  const normaliseMonth = value => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})/);
    return match ? Number(match[1]) * 12 + Number(match[2]) - 1 : null;
  };
  const isMobile = () => matchMedia('(max-width: 900px)').matches;
  const point = (x, y) => ({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  const includes = (nodes, id) => nodes.some(node => node.id === id);
  const hasAncestor = (node, id, seen = new Set()) => {
    if (!node || seen.has(node.id)) return false;
    if ((node.parentIds || []).includes(id)) return true;
    seen.add(node.id);
    return (node.parentIds || []).some(parentId => hasAncestor(nodeMap.get(parentId), id, seen));
  };

  const experienceLayout = ({ nodes, selectedNode, mobile }) => {
    const width = 1200, height = 720;
    const positions = new Map();
    const roles = nodes
      .filter(node => node.type === 'experience')
      .sort((a, b) => normaliseMonth(a.startDate) - normaliseMonth(b.startDate));
    const selectedId = selectedNode?.id || 'experience';
    const selectedRole = nodeMap.get(selectedId)?.type === 'experience' ? selectedId : null;

    positions.set(rootId, mobile ? point(600, 86) : point(258, 112));
    if (includes(nodes, 'experience')) positions.set('experience', mobile ? point(600, 192) : point(495, 222));

    const start = normaliseMonth('2019-01');
    const end = normaliseMonth('2026-10'); // a stable "present" anchor, not a timer
    const guides = [];
    if (mobile) {
      const y1 = 290, y2 = 620;
      guides.push({ id: 'experience-axis', kind: 'axis', x1: 600, y1, x2: 600, y2, label: 'Professional timeline' });
      roles.forEach((role, index) => {
        const month = normaliseMonth(role.startDate) ?? start;
        const t = Math.max(0, Math.min(1, (month - start) / Math.max(1, end - start)));
        const y = y1 + (y2 - y1) * t;
        const side = index % 2 ? 1 : -1;
        positions.set(role.id, point(600 + side * 185, y));
        guides.push({ id: `experience-duration-${role.id}`, kind: 'duration', x1: 600, y1: y, x2: 600 + side * 154, y2: y, current: Boolean(role.ongoing) });
      });
      guides.push({ id: 'experience-present', kind: 'present', x1: 582, y1: y2, x2: 618, y2, label: 'Present' });
    } else {
      const x1 = 164, x2 = 1082, y = 474;
      guides.push({ id: 'experience-axis', kind: 'axis', x1, y1: y, x2, y2: y, label: 'Professional timeline' });
      roles.forEach((role, index) => {
        const month = normaliseMonth(role.startDate) ?? start;
        const finish = role.ongoing ? end : (normaliseMonth(role.endDate) ?? month + 8);
        const t = Math.max(0, Math.min(1, (month - start) / Math.max(1, end - start)));
        const endT = Math.max(t + .025, Math.min(1, (finish - start) / Math.max(1, end - start)));
        const x = x1 + (x2 - x1) * t;
        positions.set(role.id, point(x, y + (index % 2 ? 26 : -25)));
        guides.push({ id: `experience-duration-${role.id}`, kind: 'duration', x1: x, y1: y, x2: x1 + (x2 - x1) * endT, y2: y, current: Boolean(role.ongoing) });
      });
      guides.push({ id: 'experience-present', kind: 'present', x1: x2, y1: y - 23, x2, y2: y + 23, label: 'Present' });
      [2019, 2021, 2023, 2026].forEach(year => {
        const tick = normaliseMonth(`${year}-01`);
        const x = x1 + (x2 - x1) * ((tick - start) / Math.max(1, end - start));
        guides.push({ id: `experience-year-${year}`, kind: 'tick', x1: x, y1: y - 7, x2: x, y2: y + 7, label: String(year) });
      });
    }

    // Related Work is an on-demand contextual reveal. The renderer includes
    // these nodes only for a focused role, never on the Experience overview.
    if (selectedRole) {
      const related = nodes.filter(node => node.type === 'project');
      related.forEach((project, index) => {
        const rolePoint = positions.get(selectedRole) || point(600, 450);
        positions.set(project.id, mobile
          ? point(600 + (index % 2 ? 172 : -172), Math.min(675, rolePoint.y + 104 + index * 54))
          : point(760 + index * 190, 300 + index * 94));
      });
    }
    return { width, height, positions, semanticGuides: guides, semanticKind: 'experience-temporal' };
  };

  const educationLayout = ({ nodes, selectedNode, mobile }) => {
    const width = 1200, height = 720;
    const positions = new Map();
    const guides = [];
    const visible = new Set(nodes.map(node => node.id));
    const bsc = 'charles-university';
    const msc = 'charles-university-masters-logic';
    const selectedId = selectedNode?.id || 'education';
    const evidenceConstellation = [];
    positions.set(rootId, mobile ? point(600, 78) : point(220, 110));
    if (visible.has('education')) positions.set('education', mobile ? point(600, 166) : point(420, 210));

    if (mobile) {
      const x = 600;
      if (visible.has(bsc)) positions.set(bsc, point(x, 292));
      if (visible.has(msc)) positions.set(msc, point(x, 478));
      if (visible.has('esslli')) positions.set('esslli', point(342, 355));
      if (visible.has('prg-ai')) positions.set('prg-ai', point(858, 542));
      if (visible.has('credentials')) positions.set('credentials', point(342, 580));
      guides.push({ id: 'education-trajectory', kind: 'trajectory', x1: x, y1: 255, x2: x, y2: 528, label: 'Academic trajectory' });
      [['education-esslli', x, 355, 372, 355], ['education-prg-ai', x, 478, 828, 542], ['education-credentials', x, 478, 372, 580]]
        .forEach(([id, x1, y1, x2, y2]) => guides.push({ id, kind: 'branch', x1, y1, x2, y2 }));
    } else {
      if (visible.has(bsc)) positions.set(bsc, point(400, 410));
      if (visible.has(msc)) positions.set(msc, point(752, 410));
      if (visible.has('esslli')) positions.set('esslli', point(694, 266));
      if (visible.has('prg-ai')) positions.set('prg-ai', point(900, 548));
      if (visible.has('credentials')) positions.set('credentials', point(1008, 236));
      guides.push({ id: 'education-trajectory', kind: 'trajectory', x1: 320, y1: 410, x2: 846, y2: 410, label: 'Academic trajectory' });
      [['education-esslli', 694, 410, 694, 292], ['education-prg-ai', 752, 410, 876, 522], ['education-credentials', 752, 410, 970, 258]]
        .forEach(([id, x1, y1, x2, y2]) => guides.push({ id, kind: 'branch', x1, y1, x2, y2 }));
    }

    // The thesis has one Work identity. It enters the Education view only at
    // programme focus, so the trajectory itself stays sparse.
    if (selectedId === bsc && visible.has('project-bachelor-thesis')) {
      positions.set('project-bachelor-thesis', mobile ? point(830, 352) : point(546, 564));
      const from = positions.get(bsc);
      const to = positions.get('project-bachelor-thesis');
      if (from && to) guides.push({ id: 'education-thesis', kind: 'evidence', x1: from.x, y1: from.y, x2: to.x, y2: to.y, label: 'Thesis' });
    }
    // Course groups are local evidence objects, not graph entities. They are
    // created only in the BSc focus and deliberately disappear again when the
    // user returns to the trajectory. A compact semantic panel owns mobile.
    if (selectedId === bsc && !mobile) {
      const anchor = positions.get(bsc) || point(400, 410);
      const offsets = [
        { x: -190, y: 116 }, { x: -38, y: 178 },
        { x: 194, y: 172 }, { x: 252, y: 74 }
      ];
      (site.semantics?.education?.courseEvidence || [])
        .filter(item => ['completed', 'recognized'].includes(item.status))
        .slice(0, offsets.length)
        .forEach((item, index) => {
          const offset = offsets[index];
          const position = point(anchor.x + offset.x, anchor.y + offset.y);
          evidenceConstellation.push({
            id: item.id,
            label: item.title,
            position,
            courseCount: item.courses?.length || 0,
            knowledgeIds: item.supportsKnowledgeIds || [],
            status: item.status
          });
          guides.push({ id: `education-evidence-${item.id}`, kind: 'evidence', x1: anchor.x, y1: anchor.y, x2: position.x, y2: position.y });
        });
    }
    return { width, height, positions, semanticGuides: guides, semanticEvidence: evidenceConstellation, semanticKind: 'education-trajectory' };
  };

  const compute = options => {
    const nodes = options?.nodes || [];
    const selectedNode = options?.selectedNode || null;
    const mobile = options?.mobile ?? isMobile();
    if (selectedNode?.id === 'experience' || selectedNode?.type === 'experience' || hasAncestor(selectedNode, 'experience')) {
      return experienceLayout({ nodes, selectedNode, mobile });
    }
    if (selectedNode?.id === 'education' || selectedNode?.type === 'education' || selectedNode?.type === 'credential' || hasAncestor(selectedNode, 'education')) {
      return educationLayout({ nodes, selectedNode, mobile });
    }
    return null;
  };

  window.ProfileSemanticLayouts = Object.freeze({
    compute,
    ExperienceTemporalLayout: experienceLayout,
    EducationTrajectoryLayout: educationLayout,
    snapshot: () => ({ experience: site.semantics?.experience?.entityIds || [], education: site.semantics?.education?.programmeIds || [] })
  });
})();
