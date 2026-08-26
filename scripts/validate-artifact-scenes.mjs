import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ window: {}, console });
for (const file of ['site-data.js', 'artifact-data.js', 'artifact-scene-bindings.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}

const site = context.window.SITE_DATA;
const artifacts = context.window.ProfileArtifacts;
const bindings = context.window.ARTIFACT_SCENE_BINDINGS;
const issues = [];
const allowedRecipes = new Set(['document-folio', 'media-deck']);

if (!site?.graph?.nodes?.length) issues.push('SITE_DATA graph is unavailable.');
if (!artifacts) issues.push('ProfileArtifacts registry is unavailable.');
if (!Array.isArray(bindings)) issues.push('ARTIFACT_SCENE_BINDINGS must be an array.');

if (!issues.length) {
  const nodeMap = new Map(site.graph.nodes.map(node => [node.id, node]));
  const seenBindingIds = new Set();
  const seenRoutes = new Map();

  for (const binding of bindings) {
    if (!binding?.id || seenBindingIds.has(binding.id)) {
      issues.push(`Artifact scene binding id must be unique: ${binding?.id || '(missing)'}`);
      continue;
    }
    seenBindingIds.add(binding.id);

    if (!allowedRecipes.has(binding.recipe)) issues.push(`Unknown recipe for ${binding.id}: ${binding.recipe}`);
    if (!Array.isArray(binding.artifactIds) || !binding.artifactIds.length) {
      issues.push(`${binding.id} must reference at least one artifact.`);
    } else {
      for (const artifactId of binding.artifactIds) {
        const artifact = artifacts.get(artifactId);
        if (!artifact) issues.push(`${binding.id} references unknown artifact: ${artifactId}`);
        else if (artifact.availability === 'planned') issues.push(`${binding.id} cannot render planned artifact: ${artifactId}`);
      }
      // A media deck is also the generic floating-media recipe. It may contain
      // one artifact (for example a single gameplay video) or several stacked
      // artifacts; cardinality is presentation data, not a validity rule.
    }

    for (const artifactId of binding.actionArtifactIds || []) {
      if (!artifacts.get(artifactId)) issues.push(`${binding.id} references unknown action artifact: ${artifactId}`);
    }

    if (!Array.isArray(binding.targets) || !binding.targets.length) {
      issues.push(`${binding.id} must define at least one target route.`);
      continue;
    }

    for (const target of binding.targets) {
      if (!target?.route || typeof target.route !== 'string') {
        issues.push(`${binding.id} has a target without a valid route.`);
        continue;
      }
      if (!target.anchorNodeId || !nodeMap.has(target.anchorNodeId)) {
        issues.push(`${binding.id} target ${target.route} has unknown anchor: ${target.anchorNodeId || '(missing)'}`);
      } else {
        const nodeRoute = nodeMap.get(target.anchorNodeId)?.route;
        if (target.match !== 'prefix' && nodeRoute && nodeRoute !== target.route) {
          issues.push(`${binding.id} target route ${target.route} does not match anchor route ${nodeRoute}.`);
        }
      }
      const previous = seenRoutes.get(target.route);
      if (previous && previous !== binding.id) issues.push(`Route ${target.route} is owned by multiple artifact scenes: ${previous}, ${binding.id}`);
      seenRoutes.set(target.route, binding.id);
      if (target.side && !['left', 'right'].includes(target.side)) issues.push(`${binding.id} target ${target.route} has invalid side: ${target.side}`);
      if (target.match && !['exact', 'prefix'].includes(target.match)) issues.push(`${binding.id} target ${target.route} has invalid match mode: ${target.match}`);
    }
  }
}

if (issues.length) {
  console.error('Artifact scene validation failed:');
  issues.forEach(issue => console.error(`- ${issue}`));
  process.exit(1);
}

console.log(`Artifact scenes OK: ${bindings.length} bindings, ${bindings.reduce((sum, binding) => sum + binding.targets.length, 0)} route targets.`);
