(() => {
  if (window.ProfileHaloRenderer) return;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const rootId = window.SITE_DATA?.graph?.rootId || 'stepan-chrast';
  const PRESETS = Object.freeze({
    idle: Object.freeze({ rings: 1, depth: 'graph-base' }),
    hover: Object.freeze({ rings: 1, depth: 'graph-active' }),
    focus: Object.freeze({ rings: 1, depth: 'graph-active' }),
    active: Object.freeze({ rings: 1, depth: 'graph-active' }),
    selected: Object.freeze({ rings: 1, depth: 'graph-active' }),
    related: Object.freeze({ rings: 1, depth: 'graph-base' }),
    'root-entry': Object.freeze({ rings: 2, depth: 'graph-active', radii: Object.freeze([27, 42]), aura: 1 }),
    'entry-hero': Object.freeze({ rings: 2, depth: 'graph-active', radii: Object.freeze([132, 228]), aura: 1 }),
    transitioning: Object.freeze({ rings: 1, depth: 'graph-base' })
  });

  let root = null;

  const entryHeroActive = () => ['preparing', 'ignition', 'reveal', 'ready']
    .includes(document.body?.dataset?.entryState || '') ||
    document.body?.classList.contains('is-entry-atlas-condensation');
  const rootPresetKey = () => entryHeroActive() ? 'entry-hero' : 'root-entry';
  const rootPreset = () => PRESETS[rootPresetKey()];

  const nodeId = node => node?.dataset?.nodeId || null;
  const dotFor = node => node?.querySelector?.(':scope > .site-graph-dot') || null;
  const ringRadius = (dot, index, preset = null) => {
    if (Number.isFinite(preset?.radii?.[index])) return preset.radii[index];
    const radius = Number(dot?.getAttribute('r') || 6);
    return index === 0
      ? radius + Math.max(5, radius * .55)
      : radius + Math.max(11, radius * 1.18);
  };

  const configureRing = (ring, dot, index, preset = null) => {
    ring.classList.add('site-graph-halo');
    ring.classList.toggle('site-graph-halo--primary', index === 0);
    ring.classList.toggle('site-graph-halo--secondary', index === 1);
    ring.classList.toggle('site-graph-halo--tertiary', index === 2);
    ring.dataset.haloRing = index === 0 ? 'primary' : index === 1 ? 'secondary' : 'tertiary';
    ring.setAttribute('r', String(ringRadius(dot, index, preset)));
    ring.setAttribute('fill', 'none');
    ring.setAttribute('pointer-events', 'none');
    ring.setAttribute('aria-hidden', 'true');
  };

  const ensureNode = node => {
    const dot = dotFor(node);
    if (!dot) return [];
    const isRoot = nodeId(node) === rootId;
    const preset = isRoot ? rootPreset() : PRESETS[node.dataset.haloState] || PRESETS.idle;
    const required = isRoot ? (preset.rings || 2) : 1;
    const existing = [...node.querySelectorAll(':scope > .site-graph-halo')];

    for (let index = 0; index < required; index += 1) {
      let ring = existing[index];
      if (!ring) {
        ring = document.createElementNS(SVG_NS, 'circle');
        node.insertBefore(ring, dot);
        existing.push(ring);
      }
      configureRing(ring, dot, index, preset);
    }

    existing.slice(required).forEach(ring => ring.remove());
    if (isRoot) node.dataset.haloProfile = rootPresetKey();
    else if (node.dataset.haloProfile) delete node.dataset.haloProfile;
    if (!node.dataset.haloState) node.dataset.haloState = 'idle';
    return existing.slice(0, required);
  };

  const ensureAll = () => {
    if (!root) return;
    root.querySelectorAll('.site-graph-node[data-node-id]').forEach(ensureNode);
  };

  const setState = (node, state, detail = {}) => {
    if (!node) return false;
    const preset = PRESETS[state] || PRESETS.idle;
    const next = PRESETS[state] ? state : 'idle';
    const isRoot = nodeId(node) === rootId;
    const rootProfile = isRoot ? rootPresetKey() : '';
    const aura = isRoot ? rootPreset().aura : preset.aura;
    const relation = detail.relation && detail.relation !== 'none' ? detail.relation : '';
    const requiredRings = isRoot ? (rootPreset().rings || 2) : 1;
    const ringCount = node.querySelectorAll(':scope > .site-graph-halo').length;
    if (
      node.dataset.haloState === next &&
      node.dataset.haloDepth === preset.depth &&
      (node.dataset.haloAura || '') === (aura ? String(aura) : '') &&
      (node.dataset.haloRelation || '') === relation &&
      (node.dataset.haloProfile || '') === rootProfile &&
      ringCount === requiredRings
    ) return true;

    ensureNode(node);
    if (node.dataset.haloState !== next) node.dataset.haloState = next;
    if (node.dataset.haloDepth !== preset.depth) node.dataset.haloDepth = preset.depth;
    if (aura && node.dataset.haloAura !== String(aura)) node.dataset.haloAura = String(aura);
    else if (!aura && node.dataset.haloAura) delete node.dataset.haloAura;
    if (relation && node.dataset.haloRelation !== relation) node.dataset.haloRelation = relation;
    else if (!relation && node.dataset.haloRelation) delete node.dataset.haloRelation;
    return true;
  };

  const stateOf = node => node?.dataset?.haloState || null;

  const attach = target => {
    const next = target || document.querySelector('#site-graph');
    if (!next) return false;
    if (root === next) {
      ensureAll();
      return true;
    }
    root = next;
    ensureAll();
    return true;
  };

  const detach = () => {
    root = null;
  };

  const snapshot = () => ({
    rootId,
    nodeCount: root?.querySelectorAll('.site-graph-node[data-node-id]').length || 0,
    ringCount: root?.querySelectorAll('.site-graph-halo').length || 0,
    rootRingCount: root?.querySelectorAll(`.site-graph-node[data-node-id="${CSS.escape(rootId)}"] > .site-graph-halo`).length || 0,
    states: [...(root?.querySelectorAll('.site-graph-node[data-node-id]') || [])].reduce((counts, node) => {
      const state = stateOf(node) || 'idle';
      counts[state] = (counts[state] || 0) + 1;
      return counts;
    }, {})
  });

  window.ProfileHaloRenderer = Object.freeze({
    PRESETS,
    attach,
    detach,
    ensureNode,
    radiiFor: preset => [...(PRESETS[preset]?.radii || [])],
    refresh: ensureAll,
    setState,
    stateOf,
    snapshot
  });

  const boot = () => {
    if (attach()) return;
    document.addEventListener('DOMContentLoaded', () => attach(), { once: true });
  };
  addEventListener('profile:graph-render-settled', ensureAll);
  addEventListener('profile:scene-state', ensureAll);
  addEventListener('profile:intro-stage', ensureAll);
  addEventListener('profile:profile-root-emergence', ensureAll);
  boot();
})();
