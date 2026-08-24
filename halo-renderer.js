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
    'root-entry': Object.freeze({ rings: 2, depth: 'graph-active' }),
    transitioning: Object.freeze({ rings: 1, depth: 'graph-base' })
  });

  let root = null;
  let observer = null;

  const nodeId = node => node?.dataset?.nodeId || null;
  const dotFor = node => node?.querySelector?.(':scope > .site-graph-dot') || null;
  const ringRadius = (dot, index) => {
    const radius = Number(dot?.getAttribute('r') || 6);
    return index === 0
      ? radius + Math.max(5, radius * .55)
      : radius + Math.max(11, radius * 1.18);
  };

  const configureRing = (ring, dot, index) => {
    ring.classList.add('site-graph-halo');
    ring.classList.toggle('site-graph-halo--primary', index === 0);
    ring.classList.toggle('site-graph-halo--secondary', index === 1);
    ring.dataset.haloRing = index === 0 ? 'primary' : 'secondary';
    ring.setAttribute('r', String(ringRadius(dot, index)));
    ring.setAttribute('fill', 'none');
    ring.setAttribute('pointer-events', 'none');
    ring.setAttribute('aria-hidden', 'true');
  };

  const ensureNode = node => {
    const dot = dotFor(node);
    if (!dot) return [];
    const isRoot = nodeId(node) === rootId;
    const required = isRoot ? 2 : 1;
    const existing = [...node.querySelectorAll(':scope > .site-graph-halo')];

    for (let index = 0; index < required; index += 1) {
      let ring = existing[index];
      if (!ring) {
        ring = document.createElementNS(SVG_NS, 'circle');
        node.insertBefore(ring, dot);
        existing.push(ring);
      }
      configureRing(ring, dot, index);
    }

    existing.slice(required).forEach(ring => ring.remove());
    if (!node.dataset.haloState) node.dataset.haloState = isRoot ? 'root-entry' : 'idle';
    return existing.slice(0, required);
  };

  const ensureAll = () => {
    if (!root) return;
    root.querySelectorAll('.site-graph-node[data-node-id]').forEach(ensureNode);
  };

  const setState = (node, state, detail = {}) => {
    if (!node) return false;
    const preset = PRESETS[state] || PRESETS.idle;
    ensureNode(node);
    const next = PRESETS[state] ? state : 'idle';
    if (node.dataset.haloState !== next) node.dataset.haloState = next;
    node.dataset.haloDepth = preset.depth;
    if (detail.relation && detail.relation !== 'none') node.dataset.haloRelation = detail.relation;
    else delete node.dataset.haloRelation;
    return true;
  };

  const stateOf = node => node?.dataset?.haloState || null;

  const attach = target => {
    const next = target || document.querySelector('#site-graph');
    if (!next) return false;
    if (root === next && observer) {
      ensureAll();
      return true;
    }
    observer?.disconnect();
    root = next;
    ensureAll();
    observer = new MutationObserver(mutations => {
      if (mutations.some(mutation => mutation.type === 'childList')) ensureAll();
    });
    observer.observe(root, { childList: true, subtree: true });
    return true;
  };

  const detach = () => {
    observer?.disconnect();
    observer = null;
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
    refresh: ensureAll,
    setState,
    stateOf,
    snapshot
  });

  const boot = () => {
    if (attach()) return;
    const bootObserver = new MutationObserver(() => {
      if (!attach()) return;
      bootObserver.disconnect();
    });
    bootObserver.observe(document.documentElement, { childList: true, subtree: true });
  };
  boot();
})();
