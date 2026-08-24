(() => {
  if (window.ProfileGraphFeel) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let root = null;
  let frame = 0;
  let sequence = 0;
  let input = 'pointer';
  let phase = 'idle';
  let activeNodeId = null;
  let pressedNodeId = null;
  let activatingNodeId = null;
  let activationTimer = 0;

  const liveNode = element => element?.closest?.('#site-graph .site-graph-node[data-node-id]') || null;
  const liveSvg = element => element?.closest?.('#site-graph .site-graph-svg') || null;

  const setRootState = () => {
    if (!root) return;
    root.dataset.graphFeel = phase;
    root.dataset.graphInput = input;
    if (activeNodeId) root.dataset.graphActiveNode = activeNodeId;
    else delete root.dataset.graphActiveNode;
    if (pressedNodeId) root.dataset.graphPressedNode = pressedNodeId;
    else delete root.dataset.graphPressedNode;
  };

  const ensureHalo = node => {
    if (node.querySelector(':scope > .site-graph-halo')) return;
    const dot = node.querySelector(':scope > .site-graph-dot');
    if (!dot) return;
    const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    halo.classList.add('site-graph-halo');
    const radius = Number(dot.getAttribute('r') || 6);
    halo.setAttribute('r', String(radius + Math.max(5, radius * .55)));
    halo.setAttribute('aria-hidden', 'true');
    node.insertBefore(halo, dot);
  };

  const ensureHalos = () => {
    root?.querySelectorAll('.site-graph-node[data-node-id]').forEach(ensureHalo);
  };

  const syncVisualState = () => {
    frame = 0;
    if (!root) return;
    ensureHalos();

    root.querySelectorAll('.site-graph-node[data-node-id]').forEach(node => {
      const id = node.dataset.nodeId;
      node.classList.toggle('is-feel-origin', Boolean(activeNodeId && id === activeNodeId));
      node.classList.toggle('is-feel-pressed', Boolean(pressedNodeId && id === pressedNodeId));
      node.classList.toggle('is-feel-activating', Boolean(activatingNodeId && id === activatingNodeId));
    });

    root.querySelectorAll('.site-graph-edges path').forEach(edge => {
      const active = edge.classList.contains('is-upstream') ||
        edge.classList.contains('is-downstream') ||
        edge.classList.contains('is-lateral') ||
        edge.classList.contains('is-work-strong') ||
        edge.classList.contains('is-work-soft');
      edge.classList.toggle('is-graph-flowing', Boolean(activeNodeId && active));
    });

    setRootState();
    sequence += 1;
    dispatchEvent(new CustomEvent('profile:graph-feel', { detail: snapshot() }));
  };

  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => requestAnimationFrame(syncVisualState));
  };

  const setPreview = (node, modality) => {
    if (!node) return;
    input = modality;
    activeNodeId = node.dataset.nodeId || null;
    phase = pressedNodeId ? 'pressed' : 'preview';
    schedule();
  };

  const clearPreview = node => {
    if (node && activeNodeId && node.dataset.nodeId !== activeNodeId) return;
    activeNodeId = null;
    phase = pressedNodeId ? 'pressed' : 'idle';
    schedule();
  };

  const press = node => {
    if (!node) return;
    pressedNodeId = node.dataset.nodeId || null;
    activeNodeId = pressedNodeId;
    phase = 'pressed';
    schedule();
  };

  const release = () => {
    pressedNodeId = null;
    phase = activeNodeId ? 'preview' : 'idle';
    schedule();
  };

  const activate = node => {
    if (!node) return;
    clearTimeout(activationTimer);
    activatingNodeId = node.dataset.nodeId || null;
    schedule();
    activationTimer = setTimeout(() => {
      activatingNodeId = null;
      schedule();
    }, reduced.matches ? 0 : 360);
  };

  const bind = () => {
    root = document.querySelector('#site-graph');
    if (!root) return false;
    if (root.dataset.graphFeelBound === 'true') return true;
    root.dataset.graphFeelBound = 'true';
    setRootState();
    ensureHalos();

    root.addEventListener('pointerover', event => {
      const node = liveNode(event.target);
      if (!node) return;
      if (event.relatedTarget && node.contains(event.relatedTarget)) return;
      setPreview(node, 'pointer');
    }, true);

    root.addEventListener('pointerout', event => {
      const node = liveNode(event.target);
      if (!node) return;
      if (event.relatedTarget && node.contains(event.relatedTarget)) return;
      clearPreview(node);
    }, true);

    root.addEventListener('focusin', event => {
      const node = liveNode(event.target);
      if (node) setPreview(node, 'keyboard');
    });
    root.addEventListener('focusout', event => {
      const node = liveNode(event.target);
      if (node) clearPreview(node);
    });

    root.addEventListener('pointerdown', event => {
      input = 'pointer';
      const node = liveNode(event.target);
      if (node && event.button === 0) {
        press(node);
        return;
      }
      if (event.button === 0 && liveSvg(event.target) && document.body.dataset.graphMode === 'atlas') {
        phase = 'dragging';
        activeNodeId = null;
        setRootState();
      }
    }, true);

    root.addEventListener('pointerup', event => {
      if (liveNode(event.target) && event.button === 0) activate(liveNode(event.target));
      release();
    }, true);
    root.addEventListener('pointercancel', release, true);

    root.addEventListener('keydown', event => {
      const node = liveNode(event.target);
      if (!node || !['Enter', ' '].includes(event.key)) return;
      input = 'keyboard';
      press(node);
    }, true);
    root.addEventListener('keyup', event => {
      const node = liveNode(event.target);
      if (!node || !['Enter', ' '].includes(event.key)) return;
      activate(node);
      release();
    }, true);

    new MutationObserver(mutations => {
      if (mutations.some(mutation => mutation.type === 'childList')) {
        ensureHalos();
        schedule();
      }
    }).observe(root, { childList: true, subtree: true });

    window.addEventListener('profile:artifact-scenes-ready', schedule);
    window.addEventListener('profile:scene-state', schedule);
    window.addEventListener('profile:atlas-lod-change', schedule);
    window.addEventListener('profile:transition-begin', () => {
      phase = 'transition';
      activeNodeId = null;
      pressedNodeId = null;
      schedule();
    });
    window.addEventListener('profile:transition-finish', () => {
      phase = 'idle';
      schedule();
    });
    window.addEventListener('profile:transition-cancel', () => {
      phase = 'idle';
      schedule();
    });

    return true;
  };

  const boot = () => {
    if (bind()) return;
    const observer = new MutationObserver(() => {
      if (!bind()) return;
      observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  function snapshot() {
    return {
      sequence,
      phase,
      input,
      activeNodeId,
      pressedNodeId,
      activatingNodeId,
      reducedMotion: reduced.matches,
      haloCount: root?.querySelectorAll('.site-graph-halo').length || 0,
      flowingEdgeCount: root?.querySelectorAll('.site-graph-edges path.is-graph-flowing').length || 0
    };
  }

  window.ProfileGraphFeel = Object.freeze({
    refresh: schedule,
    snapshot
  });
  boot();
})();
