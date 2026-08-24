(() => {
  if (window.ProfileNodeInteraction) return;

  const rootId = window.SITE_DATA?.graph?.rootId || 'stepan-chrast';
  const STATES = Object.freeze({
    IDLE: 'idle',
    HOVERED: 'hovered',
    FOCUSED: 'focused',
    ACTIVE: 'active',
    TRANSITIONING: 'transitioning',
    SELECTED: 'selected',
    ENTRY_READY: 'entry-ready'
  });

  let root = null;
  let observer = null;
  let frame = 0;
  let sequence = 0;
  let input = 'pointer';
  let hoveredNodeId = null;
  let focusedNodeId = null;
  let pressedNodeId = null;
  let transitioning = false;
  const records = new Map();

  const liveNode = element => element?.closest?.('#site-graph .site-graph-node[data-node-id]') || null;
  const nodeById = id => id && root?.querySelector(`.site-graph-node[data-node-id="${CSS.escape(id)}"]`);
  const selectedByRenderer = node => Boolean(node?.classList.contains('is-selected') || node?.classList.contains('is-previewed'));
  const relationFor = node => {
    if (!node) return 'none';
    if (node.classList.contains('is-upstream')) return 'upstream';
    if (node.classList.contains('is-downstream')) return 'downstream';
    if (node.classList.contains('is-lateral')) return 'lateral';
    if (node.classList.contains('is-work-strong')) return 'work-strong';
    if (node.classList.contains('is-work-soft')) return 'work-soft';
    return 'none';
  };
  const rootEntryReady = id => {
    if (id !== rootId) return false;
    const mode = document.body?.dataset.graphMode;
    const route = document.body?.dataset.graphRoute || 'overview';
    return mode === 'atlas' || route === 'overview';
  };

  const stateForNode = node => {
    const id = node?.dataset?.nodeId;
    if (!id) return STATES.IDLE;
    if (transitioning) return STATES.TRANSITIONING;
    if (pressedNodeId === id) return STATES.ACTIVE;
    if (focusedNodeId === id) return STATES.FOCUSED;
    if (hoveredNodeId === id) return STATES.HOVERED;
    if (rootEntryReady(id)) return STATES.ENTRY_READY;
    if (selectedByRenderer(node)) return STATES.SELECTED;
    return STATES.IDLE;
  };

  const recordFor = node => {
    const id = node.dataset.nodeId;
    const next = {
      id,
      state: stateForNode(node),
      relation: relationFor(node),
      selected: selectedByRenderer(node),
      artifactLinked: node.classList.contains('is-artifact-linked'),
      input: pressedNodeId === id || focusedNodeId === id || hoveredNodeId === id ? input : null
    };
    records.set(id, next);
    node.dataset.nodeState = next.state;
    node.dataset.relationState = next.relation;
    if (next.selected) node.dataset.nodeSelected = 'true';
    else delete node.dataset.nodeSelected;
    return next;
  };

  const syncAll = () => {
    frame = 0;
    if (!root) return;
    const liveIds = new Set();
    root.querySelectorAll('.site-graph-node[data-node-id]').forEach(node => {
      liveIds.add(node.dataset.nodeId);
      recordFor(node);
    });
    [...records.keys()].forEach(id => {
      if (!liveIds.has(id)) records.delete(id);
    });
    sequence += 1;
    dispatchEvent(new CustomEvent('profile:node-interaction', { detail: snapshot() }));
  };

  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => requestAnimationFrame(syncAll));
  };

  const setHovered = node => {
    hoveredNodeId = node?.dataset?.nodeId || null;
    input = 'pointer';
    schedule();
  };
  const clearHovered = node => {
    if (node && hoveredNodeId && node.dataset.nodeId !== hoveredNodeId) return;
    hoveredNodeId = null;
    schedule();
  };
  const setFocused = node => {
    focusedNodeId = node?.dataset?.nodeId || null;
    input = 'keyboard';
    schedule();
  };
  const clearFocused = node => {
    if (node && focusedNodeId && node.dataset.nodeId !== focusedNodeId) return;
    focusedNodeId = null;
    schedule();
  };
  const setPressed = (node, modality) => {
    pressedNodeId = node?.dataset?.nodeId || null;
    if (modality) input = modality;
    schedule();
  };
  const clearPressed = () => {
    pressedNodeId = null;
    schedule();
  };

  const bind = () => {
    const next = document.querySelector('#site-graph');
    if (!next) return false;
    if (root === next && observer) return true;

    observer?.disconnect();
    root = next;
    root.dataset.nodeInteractionBound = 'true';

    root.addEventListener('pointerover', event => {
      const node = liveNode(event.target);
      if (!node || node.closest('.v9-transition-overlay')) return;
      if (event.relatedTarget && node.contains(event.relatedTarget)) return;
      setHovered(node);
    }, true);

    root.addEventListener('pointerout', event => {
      const node = liveNode(event.target);
      if (!node || node.closest('.v9-transition-overlay')) return;
      if (event.relatedTarget && node.contains(event.relatedTarget)) return;
      clearHovered(node);
    }, true);

    root.addEventListener('focusin', event => {
      const node = liveNode(event.target);
      if (node && !node.closest('.v9-transition-overlay')) setFocused(node);
    });

    root.addEventListener('focusout', event => {
      const node = liveNode(event.target);
      if (node && !node.closest('.v9-transition-overlay')) clearFocused(node);
    });

    root.addEventListener('pointerdown', event => {
      const node = liveNode(event.target);
      if (node && event.button === 0 && !node.closest('.v9-transition-overlay')) setPressed(node, 'pointer');
    }, true);

    root.addEventListener('pointerup', clearPressed, true);
    root.addEventListener('pointercancel', clearPressed, true);

    root.addEventListener('keydown', event => {
      const node = liveNode(event.target);
      if (!node || !['Enter', ' '].includes(event.key) || node.closest('.v9-transition-overlay')) return;
      setPressed(node, 'keyboard');
    }, true);

    root.addEventListener('keyup', event => {
      const node = liveNode(event.target);
      if (!node || !['Enter', ' '].includes(event.key)) return;
      clearPressed();
    }, true);

    observer = new MutationObserver(mutations => {
      if (mutations.some(mutation => mutation.type === 'childList' || mutation.attributeName === 'class')) schedule();
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });

    schedule();
    return true;
  };

  window.addEventListener('profile:transition-begin', () => {
    transitioning = true;
    hoveredNodeId = null;
    pressedNodeId = null;
    schedule();
  });
  window.addEventListener('profile:transition-finish', () => {
    transitioning = false;
    schedule();
  });
  window.addEventListener('profile:transition-cancel', () => {
    transitioning = false;
    schedule();
  });
  window.addEventListener('profile:scene-state', schedule);
  window.addEventListener('profile:atlas-lod-change', schedule);

  function stateFor(id) {
    const node = nodeById(id);
    if (!node) return null;
    return recordFor(node);
  }

  function snapshot() {
    const primaryNodeId = pressedNodeId || focusedNodeId || hoveredNodeId || null;
    const counts = {};
    records.forEach(record => {
      counts[record.state] = (counts[record.state] || 0) + 1;
    });
    return {
      sequence,
      input,
      transitioning,
      rootId,
      hoveredNodeId,
      focusedNodeId,
      pressedNodeId,
      primaryNodeId,
      counts,
      nodeCount: records.size
    };
  }

  window.ProfileNodeInteraction = Object.freeze({
    STATES,
    attach: bind,
    refresh: schedule,
    stateFor,
    snapshot
  });

  const boot = () => {
    if (bind()) return;
    const bootObserver = new MutationObserver(() => {
      if (!bind()) return;
      bootObserver.disconnect();
    });
    bootObserver.observe(document.documentElement, { childList: true, subtree: true });
  };
  boot();
})();
