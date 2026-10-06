(() => {
  if (window.ProfileMotionRefinements) return;

  const graph = window.SITE_DATA?.graph;
  if (!graph?.nodes?.length) return;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const rootId = graph.rootId || 'stepan-chrast';
  const sectionIds = ['work', 'knowledge', 'experience', 'education', 'about'];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let branchEdgeFrame = 0;
  let branchMotionFrame = 0;
  let branchMotionGeneration = 0;
  let wasEmerging = false;

  const clamp01 = value => Math.max(0, Math.min(1, value));
  const ease = value => {
    const t = clamp01(value);
    return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  const refineProfileRootCopy = () => {
    document.querySelectorAll('.profile-root-guide').forEach(node => node.remove());
    const summary = document.querySelector('.profile-root-summary');
    if (summary?.textContent) summary.textContent = summary.textContent.replace(/^\s*Junior\s+/i, '');
  };

  addEventListener('profile:profile-root-settled', refineProfileRootCopy);
  addEventListener('profile:root-overview-ready', refineProfileRootCopy);
  addEventListener('profile:scene-state', refineProfileRootCopy);
  addEventListener('hashchange', () => requestAnimationFrame(refineProfileRootCopy));

  const liveNode = id => [...document.querySelectorAll(
    `#site-graph .site-graph-node[data-node-id="${CSS.escape(id)}"]`
  )].find(node => !node.closest('.v9-transition-overlay')) || null;

  const mainBranchEdges = () => [...document.querySelectorAll(
    `#site-graph .site-graph-edges path[data-source="${CSS.escape(rootId)}"][data-target]`
  )].filter(path => sectionIds.includes(path.dataset.target) && !path.closest('.v9-transition-overlay'));

  const markMainBranchEdges = () => {
    mainBranchEdges().forEach(path => { path.dataset.profileMainEdge = 'true'; });
  };

  // The Atlas → local transition replaces the SVG while an earlier profile
  // emergence can still have a scheduled frame. Never let that old frame keep
  // a newly-rendered root edge in its dashed/transparent intermediate state.
  const restoreMainBranchEdges = () => {
    cancelAnimationFrame(branchEdgeFrame);
    branchEdgeFrame = 0;
    mainBranchEdges().forEach(path => {
      if (path.dataset.profileMainEdge !== 'true') return;
      path.removeAttribute('pathLength');
      path.style.removeProperty('stroke-dasharray');
      path.style.removeProperty('stroke-dashoffset');
      path.style.removeProperty('opacity');
      path.style.removeProperty('visibility');
    });
    if (document.body) document.body.dataset.profileBranchEdgePhase = 'settled';
  };

  const drawMainBranchEdges = () => {
    cancelAnimationFrame(branchEdgeFrame);
    branchEdgeFrame = 0;
    const paths = mainBranchEdges();
    if (!paths.length) {
      if (document.body) document.body.dataset.profileBranchEdgePhase = 'settled';
      return;
    }
    markMainBranchEdges();

    if (reducedMotion.matches) {
      if (document.body) document.body.dataset.profileBranchEdgePhase = 'settled';
      return;
    }

    const records = paths.map(path => ({
      path,
      pathLength: path.getAttribute('pathLength'),
      dasharray: path.style.strokeDasharray,
      dashoffset: path.style.strokeDashoffset,
      opacity: path.style.opacity
    }));
    records.forEach(({ path }) => {
      path.setAttribute('pathLength', '1');
      path.style.strokeDasharray = '.0001 1';
      path.style.strokeDashoffset = '0';
      path.style.opacity = '0';
    });
    if (document.body) document.body.dataset.profileBranchEdgePhase = 'drawing';

    const duration = 330;
    const stagger = 46;
    const total = duration + stagger * Math.max(0, records.length - 1);
    const started = performance.now();
    const step = now => {
      const elapsed = now - started;
      records.forEach((record, index) => {
        const raw = clamp01((elapsed - index * stagger) / duration);
        const p = ease(raw);
        record.path.style.strokeDasharray = `${Math.max(.0001, p).toFixed(4)} 1`;
        record.path.style.opacity = String(.78 * p);
      });
      if (elapsed < total) {
        branchEdgeFrame = requestAnimationFrame(step);
        return;
      }
      branchEdgeFrame = 0;
      records.forEach(record => {
        if (record.pathLength == null) record.path.removeAttribute('pathLength');
        else record.path.setAttribute('pathLength', record.pathLength);
        record.path.style.strokeDasharray = record.dasharray;
        record.path.style.strokeDashoffset = record.dashoffset;
        record.path.style.opacity = record.opacity;
      });
      if (document.body) document.body.dataset.profileBranchEdgePhase = 'settled';
      dispatchEvent(new CustomEvent('profile:profile-root-edges-settled'));
    };
    branchEdgeFrame = requestAnimationFrame(step);
  };

  const syncEmergencePhase = phase => {
    const emerging = phase === 'nodes' || document.body?.classList.contains('is-profile-root-emerging');
    if (emerging && phase !== 'settled' && phase !== 'cancelled') {
      wasEmerging = true;
      markMainBranchEdges();
      if (document.body) document.body.dataset.profileBranchEdgePhase = 'nodes';
      return;
    }
    if (!wasEmerging || phase === 'cancelled') {
      wasEmerging = false;
      return;
    }
    wasEmerging = false;
    drawMainBranchEdges();
  };

  const createEmergenceGroup = node => {
    const movable = [...node.children].filter(child =>
      child.tagName?.toLowerCase() !== 'title' && !child.classList?.contains('home-v4-root-entry-action')
    );
    if (!movable.length) return null;
    const group = document.createElementNS(SVG_NS, 'g');
    group.classList.add('profile-root-emergence-motion');
    node.insertBefore(group, movable[0]);
    movable.forEach(child => group.appendChild(child));
    return group;
  };

  const restoreEmergenceGroup = record => {
    if (!record?.group?.isConnected || record.group.parentElement !== record.node) return;
    [...record.group.children].forEach(child => record.node.insertBefore(child, record.group));
    record.group.remove();
  };

  // Canonical Profile Root branch motion. This is deliberately shared by the
  // Atlas/Profile handoff and the professional Home -> Interactive Profile
  // portal, so the same five branches always use one semantic movement model.
  const animateMainBranches = (options = {}) => new Promise(resolve => {
    cancelAnimationFrame(branchMotionFrame);
    branchMotionFrame = 0;
    const generation = ++branchMotionGeneration;
    const direction = options.direction === 'in' ? 'in' : 'out';
    const duration = Math.max(1, Number(options.duration) || 760);
    const stagger = Math.max(0, Number(options.stagger) || 68);
    const source = options.source || 'shared';
    const guard = typeof options.guard === 'function' ? options.guard : () => true;
    const root = liveNode(rootId);
    const rootPoint = root ? { x: Number(root.dataset.x), y: Number(root.dataset.y) } : null;

    if (!rootPoint || ![rootPoint.x, rootPoint.y].every(Number.isFinite)) return resolve(false);

    const records = sectionIds.map((id, index) => {
      const node = liveNode(id);
      const x = Number(node?.dataset.x);
      const y = Number(node?.dataset.y);
      const group = node ? createEmergenceGroup(node) : null;
      if (!node || !group || ![x, y].every(Number.isFinite)) return null;
      const rootDx = rootPoint.x - x;
      const rootDy = rootPoint.y - y;
      if (direction === 'out') {
        group.setAttribute('transform', `translate(${rootDx.toFixed(2)} ${rootDy.toFixed(2)}) scale(.16)`);
        group.style.opacity = '0';
      } else {
        group.setAttribute('transform', 'translate(0 0) scale(1)');
        group.style.opacity = '1';
      }
      return { id, index, node, x, y, rootDx, rootDy, group };
    }).filter(Boolean);

    if (records.length !== sectionIds.length) {
      records.forEach(restoreEmergenceGroup);
      return resolve(false);
    }

    document.body?.classList.add('is-profile-root-emerging');
    dispatchEvent(new CustomEvent('profile:profile-root-emergence', {
      detail: { phase: 'nodes', direction, source }
    }));

    const finish = (ok, phase) => {
      cancelAnimationFrame(branchMotionFrame);
      branchMotionFrame = 0;
      records.forEach(restoreEmergenceGroup);
      document.body?.classList.remove('is-profile-root-emerging');
      dispatchEvent(new CustomEvent('profile:profile-root-emergence', {
        detail: { phase, direction, source }
      }));
      resolve(ok);
    };

    if (reducedMotion.matches) return finish(true, direction === 'out' ? 'settled' : 'cancelled');

    const started = performance.now();
    const total = duration + stagger * Math.max(0, records.length - 1);
    const step = now => {
      branchMotionFrame = 0;
      if (generation !== branchMotionGeneration || !guard()) return finish(false, 'cancelled');
      const elapsed = now - started;
      records.forEach(record => {
        const raw = clamp01((elapsed - record.index * stagger) / duration);
        const p = ease(raw);
        if (direction === 'out') {
          const dx = record.rootDx * (1 - p);
          const dy = record.rootDy * (1 - p);
          const scale = .16 + .84 * p;
          record.group.setAttribute('transform', `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) scale(${scale.toFixed(4)})`);
          record.group.style.opacity = String(ease(clamp01(raw / .60)));
        } else {
          const dx = record.rootDx * p;
          const dy = record.rootDy * p;
          const scale = 1 - .84 * p;
          const fade = ease(clamp01((raw - .34) / .66));
          record.group.setAttribute('transform', `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) scale(${scale.toFixed(4)})`);
          record.group.style.opacity = String(1 - fade);
        }
      });
      if (elapsed >= total) return finish(true, direction === 'out' ? 'settled' : 'cancelled');
      branchMotionFrame = requestAnimationFrame(step);
    };
    branchMotionFrame = requestAnimationFrame(step);
  });

  addEventListener('profile:profile-root-emergence', event => syncEmergencePhase(event.detail?.phase));
  addEventListener('profile:graph-render-settled', () => {
    refineProfileRootCopy();
    if (document.body?.classList.contains('is-profile-root-emerging')) {
      markMainBranchEdges();
      return;
    }
    // Rendering any new graph is a hard lifecycle boundary. In particular,
    // it covers a second Atlas click into a local segment and a subsequent
    // return to the profile root.
    requestAnimationFrame(restoreMainBranchEdges);
  });

  const boot = () => {
    if (!document.body) return requestAnimationFrame(boot);
    wasEmerging = document.body.classList.contains('is-profile-root-emerging');
    syncEmergencePhase(wasEmerging ? 'nodes' : null);
    refineProfileRootCopy();
  };

  window.ProfileMotionRefinements = Object.freeze({
    refineProfileRootCopy,
    drawMainBranchEdges,
    restoreMainBranchEdges,
    animateMainBranches,
    snapshot: () => ({
      active: Boolean(branchMotionFrame),
      phase: document.body?.classList.contains('is-profile-root-emerging') ? 'nodes' : null,
      branchEdgePhase: document.body?.dataset.profileBranchEdgePhase || null,
      lastResult: null,
      reducedMotion: reducedMotion.matches
    })
  });

  boot();
})();
