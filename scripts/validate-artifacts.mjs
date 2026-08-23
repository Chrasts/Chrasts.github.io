import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ window: {}, console });
for (const file of ['site-data.js', 'artifact-data.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}

const api = context.window.ProfileArtifacts;
if (!api) {
  console.error('ProfileArtifacts registry did not initialize.');
  process.exit(1);
}

const issues = api.issues();
for (const artifact of api.all()) {
  if (artifact.source?.kind !== 'local') continue;
  if (!fs.existsSync(artifact.source.path)) {
    issues.push(`Missing local artifact file for ${artifact.id}: ${artifact.source.path}`);
  }
}

if (issues.length) {
  console.error('Artifact manifest validation failed:');
  issues.forEach(issue => console.error(`- ${issue}`));
  process.exit(1);
}

const snapshot = api.snapshot();
console.log(`Artifact manifest OK: ${snapshot.count} records (${snapshot.localCount} local, ${snapshot.externalCount} external, ${snapshot.plannedCount} planned).`);
