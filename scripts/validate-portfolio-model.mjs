import fs from 'node:fs';
import vm from 'node:vm';

const files = ['site-data.js', 'artifact-data.js', 'phase8-scene-data.js'];
const context = vm.createContext({ window: {}, console });
for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error(`Portfolio model validation cannot find ${file}.`);
    process.exit(1);
  }
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}

const site = context.window.SITE_DATA;
const artifacts = context.window.ProfileArtifacts;
const phase8 = context.window.PHASE8_SCENE_DATA;
const issues = [];

const uniqueValues = (items, valueFor, label) => {
  const seen = new Map();
  for (const item of items || []) {
    const value = valueFor(item);
    if (value == null || value === '') {
      issues.push(`${label} is missing.`);
      continue;
    }
    if (seen.has(value)) issues.push(`Duplicate ${label}: ${value}`);
    else seen.set(value, item);
  }
  return seen;
};

if (!site?.graph?.nodes?.length) {
  issues.push('SITE_DATA.graph.nodes is missing or empty.');
} else {
  const nodes = site.graph.nodes;
  const nodeById = uniqueValues(nodes, node => node.id, 'graph node id');
  const rootId = site.graph.rootId;

  if (!rootId || !nodeById.has(rootId)) issues.push(`Graph root does not exist: ${rootId || '(missing)'}`);

  const routeOwners = new Map();
  for (const node of nodes) {
    if (node.id !== rootId && (!Array.isArray(node.parentIds) || !node.parentIds.length)) {
      issues.push(`Graph node has no parentIds: ${node.id}`);
    }
    for (const parentId of node.parentIds || []) {
      if (parentId === node.id) issues.push(`Graph node is its own parent: ${node.id}`);
      if (!nodeById.has(parentId)) issues.push(`Unknown parent ${parentId} on graph node ${node.id}`);
    }
    if (node.route) {
      if (routeOwners.has(node.route)) {
        issues.push(`Duplicate graph route ${node.route}: ${routeOwners.get(node.route)} and ${node.id}`);
      } else {
        routeOwners.set(node.route, node.id);
      }
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const visit = id => {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      issues.push(`Cycle detected in graph parent relation at ${id}`);
      return;
    }
    visiting.add(id);
    for (const parentId of nodeById.get(id)?.parentIds || []) {
      if (nodeById.has(parentId)) visit(parentId);
    }
    visiting.delete(id);
    visited.add(id);
  };
  nodes.forEach(node => visit(node.id));

  const edgeKeys = new Set();
  for (const edge of site.graph.edges || []) {
    if (!nodeById.has(edge.source)) issues.push(`Graph edge has unknown source: ${edge.source}`);
    if (!nodeById.has(edge.target)) issues.push(`Graph edge has unknown target: ${edge.target}`);
    if (edge.source === edge.target) issues.push(`Graph edge is a self-loop: ${edge.source} (${edge.type})`);
    const key = `${edge.source}|${edge.target}|${edge.type || ''}|${Boolean(edge.secondary)}`;
    if (edgeKeys.has(key)) issues.push(`Duplicate graph edge: ${key}`);
    edgeKeys.add(key);
  }

  const work = site.work;
  if (!work?.projects?.length) {
    issues.push('SITE_DATA.work.projects is missing or empty.');
  } else {
    const attributes = uniqueValues(work.attributes, item => item.id, 'Work attribute id');
    const contexts = uniqueValues(work.contextFilters, item => item.id, 'Work context id');
    const projects = uniqueValues(work.projects, item => item.id, 'Work project id');
    const orders = new Set();

    for (const project of work.projects) {
      if (!Number.isFinite(project.order)) issues.push(`Work project has invalid order: ${project.id}`);
      else if (orders.has(project.order)) issues.push(`Duplicate Work project order: ${project.order}`);
      else orders.add(project.order);

      for (const attributeId of project.lattice || []) {
        if (!attributes.has(attributeId)) issues.push(`Work project ${project.id} uses unknown lattice attribute: ${attributeId}`);
      }
      for (const contextId of project.contexts || []) {
        if (!contexts.has(contextId) || contextId === 'all') {
          issues.push(`Work project ${project.id} uses invalid context: ${contextId}`);
        }
      }

      const node = nodeById.get(`project-${project.id}`);
      if (!node) {
        issues.push(`Work project ${project.id} has no generated graph node.`);
      } else {
        const expectedRoute = `work/project/${project.id}`;
        if (node.route !== expectedRoute) issues.push(`Work project graph route mismatch for ${project.id}: ${node.route}`);
        for (const attributeId of project.lattice || []) {
          if (!node.parentIds?.includes(`work-theme-${attributeId}`)) {
            issues.push(`Work project ${project.id} is missing graph parent work-theme-${attributeId}`);
          }
        }
      }
    }

    for (const attributeId of attributes.keys()) {
      const node = nodeById.get(`work-theme-${attributeId}`);
      if (!node) issues.push(`Work attribute ${attributeId} has no generated graph node.`);
      else if (node.route !== `work/theme/${attributeId}`) issues.push(`Work theme graph route mismatch for ${attributeId}: ${node.route}`);
    }

    for (const node of nodes.filter(item => item.type === 'project')) {
      const projectId = node.id.replace(/^project-/, '');
      if (!projects.has(projectId)) issues.push(`Graph project node has no Work project record: ${node.id}`);
    }
  }

  const artifactIds = new Set(artifacts?.all?.().map(item => item.id) || []);
  const requireNode = (id, owner) => {
    if (!nodeById.has(id)) issues.push(`${owner} references unknown graph node: ${id}`);
  };
  const requireArtifact = (id, owner) => {
    if (!artifactIds.has(id)) issues.push(`${owner} references unknown artifact: ${id}`);
  };

  if (!phase8) {
    issues.push('PHASE8_SCENE_DATA did not initialize.');
  } else {
    (phase8.experience?.nodeIds || []).forEach(id => requireNode(id, 'Phase 8 experience'));
    (phase8.coursework?.anchorNodeIds || []).forEach(id => requireNode(id, 'Phase 8 coursework'));
    (phase8.coursework?.artifactIds || []).forEach(id => requireArtifact(id, 'Phase 8 coursework'));

    if (phase8.certifications?.nodeId) requireNode(phase8.certifications.nodeId, 'Phase 8 certifications');
    for (const item of phase8.certifications?.items || []) {
      requireNode(item.nodeId, 'Phase 8 certification');
      requireArtifact(item.artifactId, 'Phase 8 certification');
    }

    if (phase8.esslli?.nodeId) requireNode(phase8.esslli.nodeId, 'Phase 8 ESSLLI');
    for (const week of phase8.esslli?.weeks || []) {
      for (const session of week.sessions || []) {
        (session.links || []).forEach(id => requireNode(id, `Phase 8 ESSLLI session "${session.title}"`));
      }
    }

    if (phase8.prgAi?.nodeId) requireNode(phase8.prgAi.nodeId, 'Phase 8 prg.ai');
    (phase8.prgAi?.links || []).forEach(id => requireNode(id, 'Phase 8 prg.ai'));
  }
}

if (issues.length) {
  console.error('Portfolio model validation failed:');
  issues.forEach(issue => console.error(`- ${issue}`));
  process.exit(1);
}

console.log(`Portfolio model OK: ${site.graph.nodes.length} graph nodes, ${site.graph.edges.length} typed edges, ${site.work.projects.length} Work projects.`);
