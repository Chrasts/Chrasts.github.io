(() => {
  if (window.ProfileMotionRefinements) return;

  const graph = window.SITE_DATA?.graph;
  if (!graph?.nodes?.length) return;

  const rootId = graph.rootId || 'stepan-chrast';
  const sectionIds = ['work', 'knowledge', 'experience', 'education', 'about'];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let branchEdgeFrame = 0;
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

  const mainBranchEdges = () => [...document.querySelectorAll(
    `#site-graph .site-graph-edges path[data-source="${CSS.escape(rootId)}"][data-target]`
  )].filter(path => sectionIds.includes(path.dataset.target));

  const markMainBranchEdges = () => {
    mainBranchEdges().forEach(path => { path.dataset.profileMainEdge = 'true'; });
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

  addEventListener('profile:profile-root-emergence', event => syncEmergencePhase(event.detail?.phase));
  addEventListener('profile:graph-render-settled', () => {
    refineProfileRootCopy();
    if (document.body?.classList.contains('is-profile-root-emerging')) markMainBranchEdges();
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
    snapshot: () => ({
      active: false,
      phase: null,
      branchEdgePhase: document.body?.dataset.profileBranchEdgePhase || null,
      lastResult: null,
      reducedMotion: reducedMotion.matches
    })
  });

  boot();
})();
