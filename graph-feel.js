(() => {
  if (window.ProfileGraphFeel) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const interaction = window.ProfileNodeInteraction;
  const halos = window.ProfileHaloRenderer;
  const rootId = window.SITE_DATA?.graph?.rootId || 'stepan-chrast';
  if (!interaction || !halos) return;

  let root = null;
  let frame = 0;
  let sequence = 0;
  let phase = 'idle';
  let activatingNodeId = null;
  let activationTimer = 0;
  let dragging = false;
  let renderedState = null;

  const liveNode = element => element?.closest?.('#site-graph .site-graph-node[data-node-id]') || null;
  const liveSvg = element => element?.closest?.('#site-graph .site-graph-svg') || null;
  const navigationState = () => ({
    phase: document.body?.dataset.graphNavigationPhase || 'idle',
    targetId: document.body?.dataset.graphNavigationTarget || null,
    direction: document.body?.dataset.graphNavigationDirection || null
  });

  const haloStateFor = (node, record, navigation) => {
    if (!record) return 'idle';
    if (record.state === interaction.STATES.TRANSITIONING) return 'transitioning';
    if (navigation.phase === 'settle' && navigation.targetId === node.dataset.nodeId) return 'active';
    if (node.classList.contains('is-feel-activating') || record.state === interaction.STATES.ACTIVE) return 'active';
    if (record.state === interaction.STATES.FOCUSED) return 'focus';
    if (record.state === interaction.STATES.HOVERED) return 'hover';
    if (record.state === interaction.STATES.SELECTED) return 'selected';
    if (record.state === interaction.STATES.ENTRY_READY) return 'root-entry';
    if (record.artifactLinked || record.relation !== 'none') return 'related';
    return 'idle';
  };

  const updatePhase = (state, navigation) => {
    if (state.transitioning) phase = 'transition';
    else if (navigation.phase === 'settle') phase = 'settle';
    else if (dragging) phase = 'dragging';
    else if (state.pressedNodeId) phase = 'pressed';
    else if (state.primaryNodeId) phase = 'preview';
    else phase = 'idle';
  };

  const syncVisualState = () => {
    frame = 0;
    if (!root) return;
    halos.attach(root);
    const state = interaction.snapshot();
    const navigation = navigationState();
    updatePhase(state, navigation);

    root.dataset.graphFeel = phase;
    root.dataset.graphInput = state.input;
    if (state.primaryNodeId) root.dataset.graphActiveNode = state.primaryNodeId;
    else delete root.dataset.graphActiveNode;
    if (state.pressedNodeId) root.dataset.graphPressedNode = state.pressedNodeId;
    else delete root.dataset.graphPressedNode;

    root.querySelectorAll('.site-graph-node[data-node-id]').forEach(node => {
      const id = node.dataset.nodeId;
      const record = interaction.stateFor(id);
      const direct = state.primaryNodeId === id;
      const arrival = navigation.phase === 'settle' && navigation.targetId === id;
      node.classList.toggle('is-feel-origin', direct);
      node.classList.toggle('is-feel-pressed', state.pressedNodeId === id);
      node.classList.toggle('is-feel-activating', activatingNodeId === id);
      node.classList.toggle('is-navigation-arrival', arrival);
      halos.setState(node, haloStateFor(node, record, navigation), { relation: record?.relation || 'none' });
    });

    root.querySelectorAll('.site-graph-edges path').forEach(edge => {
      const related = edge.classList.contains('is-upstream') ||
        edge.classList.contains('is-downstream') ||
        edge.classList.contains('is-lateral') ||
        edge.classList.contains('is-work-strong') ||
        edge.classList.contains('is-work-soft');
      edge.classList.toggle('is-graph-flowing', Boolean(state.primaryNodeId && related));
      edge.classList.toggle('is-navigation-settling-edge', navigation.phase === 'settle' && Boolean(
        navigation.targetId && (edge.dataset.source === navigation.targetId || edge.dataset.target === navigation.targetId)
      ));
    });

    renderedState = state;
    sequence += 1;
    dispatchEvent(new CustomEvent('profile:graph-feel', { detail: snapshot() }));
  };

  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => requestAnimationFrame(syncVisualState));
  };

  const syncNow = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    syncVisualState();
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
    interaction.attach();
    halos.attach(root);

    root.addEventListener('pointerdown', event => {
      if (event.button === 0 && liveSvg(event.target) && !liveNode(event.target) && document.body.dataset.graphMode === 'atlas') {
        dragging = true;
        schedule();
      }
    }, true);
    root.addEventListener('pointerup', event => {
      const node = liveNode(event.target);
      if (node && event.button === 0) activate(node);
      dragging = false;
      schedule();
    }, true);
    root.addEventListener('pointercancel', () => {
      dragging = false;
      schedule();
    }, true);
    root.addEventListener('keyup', event => {
      const node = liveNode(event.target);
      if (node && ['Enter', ' '].includes(event.key)) activate(node);
    }, true);

    window.addEventListener('profile:node-interaction', schedule);
    window.addEventListener('profile:artifact-scenes-ready', schedule);
    window.addEventListener('profile:scene-state', schedule);
    window.addEventListener('profile:atlas-lod-change', schedule);
    window.addEventListener('profile:transition-begin', schedule);
    window.addEventListener('profile:transition-finish', schedule);
    window.addEventListener('profile:transition-cancel', schedule);
    window.addEventListener('profile:graph-navigation', schedule);
    window.addEventListener('profile:graph-render-settled', schedule);

    schedule();
    return true;
  };

  const boot = () => {
    if (bind()) return;
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  };

  function snapshot() {
    const state = renderedState || interaction.snapshot();
    const navigation = navigationState();
    return {
      sequence,
      phase,
      input: state.input,
      activeNodeId: state.primaryNodeId,
      pressedNodeId: state.pressedNodeId,
      activatingNodeId,
      navigationPhase: navigation.phase,
      navigationTargetId: navigation.targetId,
      navigationDirection: navigation.direction,
      reducedMotion: reduced.matches,
      haloCount: halos.snapshot().ringCount,
      flowingEdgeCount: root?.querySelectorAll('.site-graph-edges path.is-graph-flowing').length || 0,
      navigationEdgeCount: root?.querySelectorAll('.site-graph-edges path.is-navigation-settling-edge').length || 0,
      nodeInteractionSequence: state.sequence
    };
  }

  window.ProfileGraphFeel = Object.freeze({
    refresh: schedule,
    sync: syncNow,
    snapshot
  });
  boot();
})();
