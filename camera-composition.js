(() => {
  if (window.ProfileCameraComposition) return;

  const scene = window.ProfileScene;
  const geometry = window.ProfileGeometry;
  if (!scene?.camera || !geometry) return;

  let booted = false;
  let sequence = 0;
  let lastFocus = null;

  const graphSvg = () => document.querySelector('#site-graph .site-graph-svg');
  const visible = element => Boolean(element && !element.hidden && element.getClientRects().length);
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  const safeFrame = () => {
    const svg = graphSvg();
    const rect = svg?.getBoundingClientRect();
    if (!rect?.width || !rect?.height) return null;

    const gap = 22;
    let left = rect.left + gap;
    let right = rect.right - gap;
    let top = rect.top + gap;
    let bottom = rect.bottom - gap;
    const reserved = [];

    const inspector = document.querySelector('#site-detail-panel');
    if (visible(inspector)) {
      const box = inspector.getBoundingClientRect();
      if (box.left >= rect.left + rect.width / 2) right = Math.min(right, box.left - gap);
      else left = Math.max(left, box.right + gap);
      reserved.push({ id: 'detail-panel', side: box.left >= rect.left + rect.width / 2 ? 'right' : 'left' });
    }

    document.querySelectorAll('[data-scene-zone="side-stage"][data-scene-composed="true"]').forEach(element => {
      if (!visible(element)) return;
      const box = element.getBoundingClientRect();
      const side = element.dataset.sceneSide || (box.left + box.width / 2 < rect.left + rect.width / 2 ? 'left' : 'right');
      if (side === 'left') left = Math.max(left, box.right + gap);
      else right = Math.min(right, box.left - gap);
      reserved.push({ id: element.dataset.sceneObject || element.dataset.artifactScene || 'side-stage', side });
    });

    document.querySelectorAll('[data-scene-zone="lower-rail"][data-scene-composed="true"]').forEach(element => {
      if (!visible(element)) return;
      const box = element.getBoundingClientRect();
      bottom = Math.min(bottom, box.top - gap);
      reserved.push({ id: element.dataset.sceneObject || 'lower-rail', side: 'bottom' });
    });

    const minWidth = Math.min(520, rect.width * .46);
    const minHeight = Math.min(380, rect.height * .48);
    if (right - left < minWidth) {
      const centre = rect.left + rect.width / 2;
      left = Math.max(rect.left + gap, centre - minWidth / 2);
      right = Math.min(rect.right - gap, left + minWidth);
    }
    if (bottom - top < minHeight) {
      const centre = rect.top + rect.height / 2;
      top = Math.max(rect.top + gap, centre - minHeight / 2);
      bottom = Math.min(rect.bottom - gap, top + minHeight);
    }

    return {
      left,
      right,
      top,
      bottom,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
      centerX: (left + right) / 2,
      centerY: (top + bottom) / 2,
      reserved
    };
  };

  const focusAtlasNode = (nodeOrId, options = {}) => {
    const atlas = window.ProfileAtlasLOD;
    const svg = graphSvg();
    const id = typeof nodeOrId === 'string' ? nodeOrId : nodeOrId?.id || nodeOrId?.dataset?.nodeId;
    const point = id ? geometry.atlasPoint?.(id) : null;
    const frame = safeFrame();
    if (!atlas || !svg || !point || !frame || document.body.dataset.graphMode !== 'atlas') return false;

    const viewBox = svg.viewBox?.baseVal;
    const rect = svg.getBoundingClientRect();
    if (!viewBox?.width || !viewBox?.height || !rect.width || !rect.height) return false;

    const snapshot = atlas.snapshot?.() || {};
    const currentScale = snapshot.targetCamera?.scale || snapshot.scale || 1;
    const scale = clamp(options.scale || Math.max(1.35, currentScale * 1.28), 1.35, 2.25);
    const safeX = viewBox.x + (frame.centerX - rect.left) * viewBox.width / rect.width;
    const safeY = viewBox.y + (frame.centerY - rect.top) * viewBox.height / rect.height;
    const x = safeX - point.x * scale;
    const y = safeY - point.y * scale;
    const immediate = Boolean(options.immediate);

    atlas.setScale?.(scale, { immediate });
    atlas.panTo?.(x, y, { immediate });
    lastFocus = { id, scale, safeCenter: { x: frame.centerX, y: frame.centerY }, reserved: frame.reserved };
    sequence += 1;
    window.dispatchEvent(new CustomEvent('profile:camera-composition', { detail: snapshotState() }));
    return true;
  };

  const snapshotState = () => ({
    sequence,
    mode: document.body.dataset.graphMode || 'overview',
    route: document.body.dataset.graphRoute || 'overview',
    safeFrame: safeFrame(),
    lastFocus
  });

  const boot = () => {
    if (booted) return true;
    const atlasBase = scene.camera.adapters?.get?.('atlas');
    if (!atlasBase || !window.ProfileAtlasLOD) return false;

    scene.camera.registerAdapter('atlas', {
      ...atlasBase,
      focus: (node, options = {}) => focusAtlasNode(node, options),
      serialize: () => ({ ...atlasBase.serialize?.(), composition: safeFrame() })
    });
    booted = true;
    window.dispatchEvent(new CustomEvent('profile:camera-composition-ready', { detail: snapshotState() }));
    return true;
  };

  window.addEventListener('load', boot, { once: true });
  window.addEventListener('profile:scene-state', () => {
    boot();
    window.dispatchEvent(new CustomEvent('profile:camera-safe-frame', { detail: snapshotState() }));
  });
  window.addEventListener('profile:scene-composition', () => {
    window.dispatchEvent(new CustomEvent('profile:camera-safe-frame', { detail: snapshotState() }));
  });

  /* Replace only the second activation of an already selected Atlas node. The
     first click keeps Phase 7 selection semantics. The second uses the composed
     safe frame instead of the geometric centre of the full SVG. */
  window.addEventListener('click', event => {
    if (!booted || document.body.dataset.graphMode !== 'atlas' || event.button !== 0) return;
    const node = event.target.closest?.('#site-graph .site-graph-node.is-previewed[data-node-id]');
    if (!node) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    scene.camera.focus(node.dataset.nodeId);
  }, true);

  window.addEventListener('keydown', event => {
    if (!booted || document.body.dataset.graphMode !== 'atlas' || !['Enter', ' '].includes(event.key)) return;
    const node = event.target.closest?.('#site-graph .site-graph-node.is-previewed[data-node-id]');
    if (!node) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    scene.camera.focus(node.dataset.nodeId);
  }, true);

  window.ProfileCameraComposition = Object.freeze({
    safeFrame,
    focusNode: focusAtlasNode,
    boot,
    snapshot: snapshotState
  });
  boot();
})();
