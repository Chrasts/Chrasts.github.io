(() => {
  const graph = window.SITE_DATA?.graph;
  if (!graph?.nodes?.length) return;

  const rootId = graph.rootId || 'stepan-chrast';
  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const svgNS = 'http://www.w3.org/2000/svg';
  const state = { stage: 'idle', running: false, completed: false, nodeCount: 0 };
  let runToken = 0;

  const clamp01 = value => Math.max(0, Math.min(1, value));
  const ease = t => 1 - Math.pow(1 - clamp01(t), 3);
  const stableNumber = value => {
    let number = 2166136261;
    for (const character of String(value)) number = Math.imul(number ^ character.charCodeAt(0), 16777619);
    return number >>> 0;
  };
  const point = element => ({
    x: Number(element?.dataset.introOriginX ?? element?.dataset.x ?? 0),
    y: Number(element?.dataset.introOriginY ?? element?.dataset.y ?? 0)
  });
  const setPoint = (element, value) => {
    if (!element || !value) return;
    element.setAttribute('transform', `translate(${value.x.toFixed(2)} ${value.y.toFixed(2)})`);
    element.dataset.x = String(value.x);
    element.dataset.y = String(value.y);
  };
  const lerp = (from, to, t) => ({
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t
  });

  const makeRootOrbit = root => {
    root.querySelector('.profile-intro-root-orbit')?.remove();
    const orbit = document.createElementNS(svgNS, 'g');
    orbit.classList.add('profile-intro-root-orbit');
    orbit.setAttribute('aria-hidden', 'true');
    [
      { r: 27, dash: '7 5 2 8 11 4', className: 'is-a' },
      { r: 36, dash: '2 9 13 5 4 11', className: 'is-b' },
      { r: 45, dash: '16 8 3 12 6 9', className: 'is-c' }
    ].forEach(spec => {
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', '0');
      circle.setAttribute('cy', '0');
      circle.setAttribute('r', String(spec.r));
      circle.setAttribute('stroke-dasharray', spec.dash);
      circle.classList.add(spec.className);
      orbit.appendChild(circle);
    });
    const dot = root.querySelector('.site-graph-dot');
    root.insertBefore(orbit, dot || root.firstChild);
    return orbit;
  };

  const parentStart = (id, records, rootPoint) => {
    const node = nodeMap.get(id);
    const parents = node?.parentIds || [];
    for (const parentId of parents) {
      if (records.has(parentId)) return records.get(parentId).to;
    }
    return rootPoint;
  };

  const edgePath = (from, to, edge, rootPoint) => {
    const cross = edge.classList.contains('is-cross-link') || edge.classList.contains('is-related') || edge.dataset.type === 'related';
    if (!cross) {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} C ${(from.x + dx * .38).toFixed(1)} ${(from.y + dy * .38).toFixed(1)} ${(from.x + dx * .72).toFixed(1)} ${(from.y + dy * .72).toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
    }
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    let ox = mid.x - rootPoint.x;
    let oy = mid.y - rootPoint.y;
    const length = Math.max(1, Math.hypot(ox, oy));
    ox /= length; oy /= length;
    const push = Math.min(180, Math.max(54, Math.hypot(to.x - from.x, to.y - from.y) * .14));
    return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${(mid.x + ox * push).toFixed(1)} ${(mid.y + oy * push).toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
  };

  const installSnapshotGate = () => {
    const base = window.ProfileIntro;
    if (!base || base.__autoUnfoldGate) return;
    window.ProfileIntro = Object.freeze({
      ...base,
      __autoUnfoldGate: true,
      snapshot: () => {
        const snapshot = base.snapshot();
        if (!state.completed && state.stage !== 'idle' && snapshot.stage === 'atlas') {
          return { ...snapshot, stage: 'unfolding', waiting: false, autoUnfoldStage: state.stage };
        }
        return { ...snapshot, autoUnfoldStage: state.stage };
      }
    });
  };
  installSnapshotGate();

  const run = async shell => {
    if (!shell || shell.dataset.autoUnfoldPrepared === 'true') return;
    const svg = shell.querySelector('.profile-intro-graph');
    const root = svg?.querySelector(`.site-graph-node[data-node-id="${rootId}"]`);
    const enter = shell.querySelector('.profile-intro-enter');
    if (!svg || !root || !enter) return;

    const nodes = [...svg.querySelectorAll('.site-graph-node[data-node-id]')];
    if (nodes.length < 2) return;

    shell.dataset.autoUnfoldPrepared = 'true';
    shell.classList.add('is-auto-unfolding');
    shell.dataset.autoUnfoldStage = 'root';
    state.stage = 'root';
    state.running = true;
    state.completed = false;
    state.nodeCount = nodes.length;
    const token = ++runToken;

    enter.tabIndex = -1;
    const rootPoint = point(root);
    const orbit = makeRootOrbit(root);
    const records = new Map();

    nodes.forEach(element => {
      const id = element.dataset.nodeId;
      const to = point(element);
      const depth = Math.max(0, Number(element.dataset.introDepth || 0));
      records.set(id, { id, element, to, depth, from: null, current: { ...to } });
    });
    records.forEach(record => {
      record.from = record.id === rootId ? record.to : parentStart(record.id, records, rootPoint);
      record.current = { ...record.from };
      if (record.id !== rootId) {
        setPoint(record.element, record.from);
        record.element.style.setProperty('opacity', '0', 'important');
        record.element.style.visibility = 'visible';
      }
    });

    const edges = [...svg.querySelectorAll('.site-graph-edges path[data-source][data-target]')].map(element => ({
      element,
      source: element.dataset.source,
      target: element.dataset.target,
      finalD: element.getAttribute('d') || '',
      cross: element.classList.contains('is-cross-link') || element.classList.contains('is-related') || !['hierarchy', 'hierarchy-alt', 'work-lattice'].includes(element.dataset.type || 'hierarchy')
    }));
    edges.forEach(record => {
      record.element.style.setProperty('opacity', '0', 'important');
      record.element.style.visibility = 'visible';
    });

    // Give the central node a short living, non-static beat before the graph grows.
    await new Promise(resolve => setTimeout(resolve, reduced ? 90 : 850));
    if (token !== runToken || !shell.isConnected) return;

    shell.dataset.autoUnfoldStage = 'unfolding';
    state.stage = 'unfolding';
    const duration = reduced ? 170 : 1780;
    const started = performance.now();

    await new Promise(resolve => {
      const frame = now => {
        if (token !== runToken || !shell.isConnected) return resolve();
        const raw = clamp01((now - started) / duration);
        const points = new Map([[rootId, rootPoint]]);

        records.forEach(record => {
          if (record.id === rootId) return;
          const depthStart = record.depth <= 1 ? 0 : record.depth === 2 ? .15 : .30 + Math.min(.12, record.depth * .018);
          const stagger = ((stableNumber(record.id) % 37) / 36) * (record.depth >= 3 ? .10 : .045);
          const local = clamp01((raw - depthStart - stagger) / Math.max(.18, 1 - depthStart - stagger));
          const p = ease(local);
          const current = lerp(record.from, record.to, p);
          record.current = current;
          points.set(record.id, current);
          setPoint(record.element, current);
          record.element.style.setProperty('opacity', String(clamp01(local * 1.55)), 'important');
        });

        edges.forEach(record => {
          const from = points.get(record.source) || records.get(record.source)?.current;
          const to = points.get(record.target) || records.get(record.target)?.current;
          if (!from || !to) return;
          record.element.setAttribute('d', edgePath(from, to, record.element, rootPoint));
          const targetDepth = records.get(record.target)?.depth || 1;
          const start = record.cross ? .72 : targetDepth <= 1 ? .03 : targetDepth === 2 ? .20 : .38;
          const visible = ease(clamp01((raw - start) / Math.max(.15, 1 - start)));
          record.element.style.setProperty('opacity', String(record.cross ? visible * .62 : visible), 'important');
        });

        orbit.style.opacity = String(1 - ease(clamp01((raw - .72) / .28)) * .82);
        if (raw < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });

    if (token !== runToken || !shell.isConnected) return;
    records.forEach(record => {
      setPoint(record.element, record.to);
      record.element.style.removeProperty('opacity');
      record.element.style.removeProperty('visibility');
    });
    edges.forEach(record => {
      if (record.finalD) record.element.setAttribute('d', record.finalD);
      record.element.style.removeProperty('opacity');
      record.element.style.removeProperty('visibility');
    });

    shell.dataset.autoUnfoldStage = 'complete';
    shell.classList.remove('is-auto-unfolding');
    shell.classList.add('is-auto-unfold-complete');
    state.stage = 'complete';
    state.running = false;
    state.completed = true;
    enter.disabled = false;
    enter.tabIndex = 0;
    requestAnimationFrame(() => shell.classList.add('is-gateway-revealed'));
    setTimeout(() => orbit.remove(), reduced ? 0 : 480);
    window.dispatchEvent(new CustomEvent('profile:intro-unfold-complete', { detail: { nodeCount: nodes.length } }));
  };

  const patch = shell => {
    if (!shell || shell.dataset.autoUnfoldQueued === 'true') return;
    shell.dataset.autoUnfoldQueued = 'true';
    requestAnimationFrame(() => requestAnimationFrame(() => run(shell)));
  };

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
      if (!(node instanceof Element)) return;
      if (node.matches?.('.profile-intro-overlay')) patch(node);
      node.querySelectorAll?.('.profile-intro-overlay').forEach(patch);
    }));
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  document.querySelectorAll('.profile-intro-overlay').forEach(patch);

  window.ProfileIntroUnfold = Object.freeze({
    snapshot: () => ({ ...state, overlayPresent: Boolean(document.querySelector('.profile-intro-overlay')) })
  });
})();