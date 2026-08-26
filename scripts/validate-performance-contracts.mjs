import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const issues = [];
const bindings = read('artifact-scene-bindings.js');
const recipes = read('artifact-scene-recipes.js');
const bridge = read('scene-legacy-bridge.js');
const runtime = read('artifact-scene-runtime.js');
const definitions = read('scene-definitions.js');
const index = read('index.html');
const geometry = read('radial-geometry.js');
const introFixes = read('intro-fixes-v3.js');
const localLabels = read('local-label-policy.js');
const phase7 = read('phase7-atlas.js');
const postEntry = read('profile-post-entry.js');
const productionScripts = fs.readdirSync('.').filter(file => file.endsWith('.js'));

if (/createElement\(['"](?:script|link)['"]\)|ensureScript|ensureStyle/.test(bindings)) {
  issues.push('artifact-scene-bindings.js must remain declarative and must not load dependencies.');
}
if (/\bfetch\s*\(|\.arrayBuffer\s*\(|new\s+TextDecoder/.test(recipes)) {
  issues.push('Artifact recipes must not download or decode media to infer presentation geometry.');
}
if (!/const\s+resourcePromises\s*=\s*new\s+Map/.test(bridge) || !/const\s+featurePromises\s*=\s*new\s+Map/.test(bridge)) {
  issues.push('Optional feature loading must keep auditable Promise deduplication registries.');
}
if (/\bbootPhase8\(\)\s*;/.test(bridge)) {
  issues.push('Phase 8 must be route gated rather than booted unconditionally.');
}
if (!/resolve:\s*context\s*=>\s*resolveRoot/.test(runtime) || !/unmount:\s*context\s*=>\s*releaseRoot/.test(runtime)) {
  issues.push('Artifact runtime must mount and release scene roots through the scene lifecycle.');
}
if (/intro-atlas-reveal\.(?:js|css)/.test(definitions)) {
  issues.push('Intro reveal resources must not be loaded by the unconditional scene definition chain.');
}
if (/href=["']intro-animation\.css["']/.test(index)) {
  issues.push('The retired Phase H intro stylesheet must not be loaded by index.html.');
}
if (!/window\.__PROFILE_INTRO_BOOTSTRAP__\?\.eligible/.test(bridge) || !/const\s+bootIntro\s*=/.test(bridge)) {
  issues.push('The current intro feature must be gated by the early eligibility contract.');
}
const atlasInteractionFiles = [
  'atlas-drag-activation-guard.js',
  'atlas-focus-unification.js',
  'root-entry-portal.js',
  'atlas-condensation.js',
  'root-entry-portal.css',
  'atlas-condensation.css',
  'atlas-focus-unification.css'
];
if (atlasInteractionFiles.some(file => definitions.includes(file))) {
  issues.push('Atlas-only interaction resources must not be loaded by the unconditional scene definition chain.');
}
if (!/const\s+bootAtlasInteractions\s*=/.test(bridge) || !/const\s+holdAtlasIntent\s*=/.test(bridge)) {
  issues.push('Atlas interaction loading must retain the route gate and first-intent replay contract.');
}
if (/\bpinUntil\b|requestAnimationFrame\(tick\)/.test(geometry)) {
  issues.push('Canonical geometry must not use a duration-pinned RAF repair loop.');
}
if (/\blabelPinUntil\b|requestAnimationFrame\(tick\)/.test(introFixes)) {
  issues.push('Local label reconciliation must not use a duration-pinned RAF repair loop.');
}
if (/phase7-atlas\.(?:js|css)/.test(geometry) || /phase7-atlas\.(?:js|css)/.test(definitions)) {
  issues.push('Phase 7 Atlas LOD must not be loaded by canonical geometry or scene definitions.');
}
if (!/const\s+bootAtlasRuntime\s*=/.test(bridge)) {
  issues.push('The Atlas LOD runtime must have an explicit route/intent feature gate.');
}
if (/MutationObserver/.test(localLabels) || /applyLocalLabelPolicy/.test(phase7) || /applyLocalLabels/.test(introFixes)) {
  issues.push('Local label ownership must remain in the explicit-event ProfileLocalLabelPolicy module.');
}
if (/src=["']script\.js["']/.test(index) || /id=["']work["']/.test(index)) {
  issues.push('The retired Work renderer and hidden #work DOM reservoir must not return.');
}
if (!/window\.ProfileWorkController\s*=\s*Object\.freeze/.test(read('site-graph.js')) || fs.existsSync('script.js')) {
  issues.push('Work filtering and FCA projection must remain owned by the canonical site graph controller.');
}
if (fs.existsSync('global-geometry-ownership.js') || /global-geometry-ownership\.js/.test(definitions)) {
  issues.push('The global geometry repair observer must not return; canonical render events own reconciliation.');
}
if (/new\s+MutationObserver/.test(geometry) || !/profile:graph-render-settled/.test(geometry)) {
  issues.push('Canonical geometry must reconcile from explicit graph-render events, not subtree observation.');
}
if (fs.existsSync('phase7-pointer-hotfix.js') || /phase7-pointer-hotfix\.js/.test(definitions)) {
  issues.push('The Atlas pointer/prototype hotfix must not return; owners must use local event and CSS contracts.');
}
if (fs.existsSync('artifact-viewer-v2.js') || fs.existsSync('artifact-open-guard.js') || /artifact-(?:viewer-v2|open-guard)\.js/.test(bridge)) {
  issues.push('Artifact media and repeat-open handling must remain integrated into recipes and Object Focus.');
}
const prototypePatches = ['graph-transition-prelude.js', 'mobile-app.js', 'phase0-stability.js']
  .filter(file => /(?:Document|Element|SVGElement|Node|DOMTokenList)\.prototype\.[A-Za-z]+\s*=/.test(read(file)));
if (prototypePatches.length) {
  issues.push(`Global DOM prototype patches must stay absent: ${prototypePatches.join(', ')}`);
}
const mutationObserverOwners = productionScripts.filter(file => /\bnew\s+MutationObserver\b/.test(read(file)));
if (mutationObserverOwners.length) {
  issues.push(`Production state must use explicit lifecycle events, not DOM observers: ${mutationObserverOwners.join(', ')}`);
}
const retiredFiles = [
  'intro-animation.css', 'intro-unfold.js', 'intro-unfold.css',
  'intro-state-consistency.js', 'graph-v4.css', 'artifact-open-guard.css'
];
const returnedRetiredFiles = retiredFiles.filter(file => fs.existsSync(file));
if (returnedRetiredFiles.length) {
  issues.push(`Retired runtime assets must stay deleted: ${returnedRetiredFiles.join(', ')}`);
}
if (/createElement\(['"](?:script|link)['"]\)/.test(postEntry) || !/profile-motion-refinements\.js/.test(definitions)) {
  issues.push('Core motion resources must be owned by scene-definitions, not a nested post-entry loader chain.');
}

if (issues.length) {
  console.error('Performance contract validation failed:');
  issues.forEach(issue => console.error(`- ${issue}`));
  process.exit(1);
}

console.log('Performance contracts OK: route loader, metadata geometry and artifact lifecycle are guarded.');
