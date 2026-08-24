(() => {
  if (window.ProfileRootEntryPortal) return;

  const graph = window.SITE_DATA?.graph;
  if (!graph?.nodes?.length) return;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const XLINK_NS = 'http://www.w3.org/1999/xlink';
  const rootId = graph.rootId || 'stepan-chrast';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointer = matchMedia('(pointer: coarse)');
  const boundRoots = new WeakSet();

  let graphRoot = null;
  let rootNode = null;
  let portrait = null;
  let action = null;
  let observer = null;
  let bootObserver = null;
  let frame = 0;
  let closeTimer = 0;
  let open = false;
  let manualOpen = false;
  let entering = false;
  let sequence = 0;
  let lastReason = null;

  const introState = () => window.ProfileIntro?.snapshot?.().state || null;
  const mode = () => document.body?.dataset.graphMode || null;
  const route = () => document.body?.dataset.graphRoute || (location.hash || '#overview').slice(1);
  const available = () => {
    if (mode() !== 'atlas') return false;
    if (document.body?.classList.contains('is-atlas-reveal')) return false;
    if (['pending', 'preparing', 'running'].includes(document.documentElement.dataset.profileIntro || '')) return false;
    const state = introState();
    return !state || ['ATLAS_READY', 'BYPASSED'].includes(state);
  };
  const emit = (type, detail = {}) => {
    sequence += 1;
    dispatchEvent(new CustomEvent('profile:root-entry-portal', {
      detail: { type, ...snapshot(), ...detail }
    }));
  };
  const track = name => { try { window.umami?.track?.(name); } catch (_) {} };

  const ensureDefs = svg => {
    if (!svg) return null;
    let defs = svg.querySelector(':scope > defs[data-root-entry-defs]');
    if (!defs) {
      defs = document.createElementNS(SVG_NS, 'defs');
      defs.dataset.rootEntryDefs = 'true';
      svg.insertBefore(defs, svg.firstChild);
    }
    let clip = defs.querySelector('#profile-root-entry-portrait-clip');
    if (!clip) {
      clip = document.createElementNS(SVG_NS, 'clipPath');
      clip.id = 'profile-root-entry-portrait-clip';
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', '0');
      circle.setAttribute('cy', '0');
      circle.setAttribute('r', '14.6');
      clip.appendChild(circle);
      defs.appendChild(clip);
    }
    return clip;
  };

  const createPortrait = node => {
    const image = document.createElementNS(SVG_NS, 'image');
    image.classList.add('root-entry-portrait');
    image.dataset.rootEntryPortrait = 'true';
    image.setAttribute('x', '-15');
    image.setAttribute('y', '-15');
    image.setAttribute('width', '30');
    image.setAttribute('height', '30');
    image.setAttribute('href', 'assets/stepan-chrast.jpg');
    image.setAttributeNS(XLINK_NS, 'href', 'assets/stepan-chrast.jpg');
    image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    image.setAttribute('clip-path', 'url(#profile-root-entry-portrait-clip)');
    image.setAttribute('pointer-events', 'none');
    image.setAttribute('aria-hidden', 'true');
    const label = node.querySelector(':scope > .site-graph-label');
    node.insertBefore(image, label || null);
    return image;
  };

  const createAction = node => {
    const group = document.createElementNS(SVG_NS, 'g');
    group.classList.add('root-entry-action');
    group.dataset.rootEntryAction = 'true';
    group.setAttribute('role', 'button');
    group.setAttribute('tabindex', '-1');
    group.setAttribute('aria-label', 'Enter profile');
    group.setAttribute('aria-hidden', 'true');

    const hit = document.createElementNS(SVG_NS, 'rect');
    hit.classList.add('root-entry-action-hit');
    hit.setAttribute('x', '-54');
    hit.setAttribute('y', '31');
    hit.setAttribute('width', '108');
    hit.setAttribute('height', '30');
    hit.setAttribute('rx', '15');
    hit.setAttribute('fill', 'transparent');

    const rule = document.createElementNS(SVG_NS, 'line');
    rule.classList.add('root-entry-action-rule');
    rule.setAttribute('x1', '-17');
    rule.setAttribute('x2', '17');
    rule.setAttribute('y1', '35');
    rule.setAttribute('y2', '35');
    rule.setAttribute('aria-hidden', 'true');

    const text = document.createElementNS(SVG_NS, 'text');
    text.classList.add('root-entry-action-label');
    text.setAttribute('x', '0');
    text.setAttribute('y', '52');
    text.setAttribute('text-anchor', 'middle');
    text.textContent = 'Enter profile';
    text.setAttribute('aria-hidden', 'true');

    group.append(hit, rule, text);
    node.appendChild(group);
    return group;
  };

  const syncOpenPresentation = () => {
    if (!rootNode?.isConnected || !action?.isConnected) return;
    const visible = open && available();
    rootNode.classList.toggle('is-root-entry-open', visible);
    rootNode.dataset.rootEntryPortal = visible ? 'open' : 'latent';
    rootNode.setAttribute('aria-expanded', visible ? 'true' : 'false');
    action.setAttribute('tabindex', visible ? '0' : '-1');
    action.setAttribute('aria-hidden', visible ? 'false' : 'true');
  };

  const openPortal = (reason = 'api', { manual = false } = {}) => {
    if (!available() || !rootNode?.isConnected) return false;
    clearTimeout(closeTimer);
    const changed = !open;
    open = true;
    if (manual) manualOpen = true;
    lastReason = reason;
    syncOpenPresentation();
    if (changed) emit('open', { reason });
    return true;
  };

  const closePortal = (reason = 'api', { force = false } = {}) => {
    clearTimeout(closeTimer);
    if (entering && !force) return false;
    const changed = open || manualOpen;
    open = false;
    manualOpen = false;
    lastReason = reason;
    syncOpenPresentation();
    if (changed) emit('close', { reason });
    return true;
  };

  const scheduleClose = reason => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (manualOpen) return;
      const focused = document.activeElement;
      if (rootNode?.contains(focused)) return;
      closePortal(reason);
    }, reducedMotion.matches ? 0 : 120);
  };

  const focusExpandedRoot = attempt => {
    if (mode() === 'overview') {
      const node = document.querySelector(`#site-graph .site-graph-node[data-node-id="${CSS.escape(rootId)}"]`);
      node?.focus?.({ preventScroll: true });
      return;
    }
    if (attempt < 14) setTimeout(() => focusExpandedRoot(attempt + 1), 40);
  };

  const fallbackEnterProfile = source => {
    window.ProfileRootLanding?.commitExpanded?.({
      focusGraph: false,
      reason: 'root-entry-direct',
      animate: false
    });
    closePortal('enter-profile', { force: true });
    document.body?.classList.add('is-root-entry-committing');
    if (location.hash !== '#overview') location.hash = '#overview';
    else dispatchEvent(new HashChangeEvent('hashchange'));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.body?.classList.remove('is-root-entry-committing');
      entering = false;
      focusExpandedRoot(0);
      emit('entered', { source, delegated: false });
    }));
    track('enter_profile');
    return true;
  };

  const enterProfile = (source = 'api') => {
    if (!available() || entering) return false;
    entering = true;
    const request = new CustomEvent('profile:enter-profile-request', {
      cancelable: true,
      detail: { rootId, source, portal: snapshot() }
    });
    const acceptedFallback = dispatchEvent(request);
    if (!acceptedFallback) {
      closePortal('enter-profile-delegated', { force: true });
      entering = false;
      emit('enter-delegated', { source });
      track('enter_profile');
      return true;
    }
    return fallbackEnterProfile(source);
  };

  const bindAction = element => {
    element.addEventListener('pointerdown', event => event.stopPropagation());
    element.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      enterProfile('pointer-action');
    });
    element.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        closePortal('keyboard-escape');
        rootNode?.focus?.({ preventScroll: true });
        return;
      }
      if (!['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      enterProfile('keyboard-action');
    });
  };

  const bindRoot = node => {
    if (boundRoots.has(node)) return;
    boundRoots.add(node);
    node.setAttribute('aria-haspopup', 'false');

    node.addEventListener('pointerenter', event => {
      if (event.pointerType === 'touch' || coarsePointer.matches) return;
      openPortal('pointer-hover');
    });
    node.addEventListener('pointerleave', event => {
      if (event.pointerType === 'touch' || coarsePointer.matches) return;
      scheduleClose('pointer-leave');
    });
    node.addEventListener('focusin', () => openPortal('keyboard-focus'));
    node.addEventListener('focusout', event => {
      if (event.relatedTarget && node.contains(event.relatedTarget)) return;
      scheduleClose('keyboard-blur');
    });

    node.addEventListener('click', event => {
      if (!available() || event.target.closest?.('[data-root-entry-action]')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openPortal('root-activate', { manual: event.pointerType === 'touch' || coarsePointer.matches });
    }, true);

    node.addEventListener('keydown', event => {
      if (!available() || event.target.closest?.('[data-root-entry-action]')) return;
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closePortal('keyboard-escape');
        return;
      }
      if (!['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!open) openPortal('keyboard-activate');
      else enterProfile('keyboard-root');
    }, true);
  };

  const ensurePortal = () => {
    frame = 0;
    const nextGraph = document.querySelector('#site-graph');
    const nextRoot = nextGraph?.querySelector(`.site-graph-node[data-node-id="${CSS.escape(rootId)}"]`);
    const svg = nextGraph?.querySelector('.site-graph-svg');
    if (!nextGraph || !nextRoot || !svg) return false;

    graphRoot = nextGraph;
    rootNode = nextRoot;
    ensureDefs(svg);
    portrait = rootNode.querySelector(':scope > [data-root-entry-portrait]') || createPortrait(rootNode);
    action = rootNode.querySelector(':scope > [data-root-entry-action]') || createAction(rootNode);
    bindRoot(rootNode);
    if (action.dataset.rootEntryBound !== 'true') {
      action.dataset.rootEntryBound = 'true';
      bindAction(action);
    }
    rootNode.dataset.rootEntryMaterial = 'shared-root';
    syncOpenPresentation();

    if (!observer || observer.__root !== graphRoot) {
      observer?.disconnect();
      observer = new MutationObserver(mutations => {
        if (!mutations.some(mutation => mutation.type === 'childList')) return;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(ensurePortal);
      });
      observer.__root = graphRoot;
      observer.observe(graphRoot, { childList: true, subtree: true });
    }
    return true;
  };

  const refresh = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => requestAnimationFrame(() => {
      ensurePortal();
      if (!available()) closePortal('context-change', { force: true });
      else syncOpenPresentation();
    }));
  };

  addEventListener('profile:atlas-ready', refresh);
  addEventListener('profile:intro-completed', refresh);
  addEventListener('profile:scene-state', refresh);
  addEventListener('profile:transition-begin', () => closePortal('transition', { force: true }));
  addEventListener('hashchange', refresh);
  reducedMotion.addEventListener?.('change', refresh);
  coarsePointer.addEventListener?.('change', refresh);

  function snapshot() {
    return {
      sequence,
      rootId,
      mode: mode(),
      route: route(),
      introState: introState(),
      available: available(),
      open,
      manualOpen,
      entering,
      lastReason,
      reducedMotion: reducedMotion.matches,
      coarsePointer: coarsePointer.matches,
      rootPresent: Boolean(rootNode?.isConnected),
      portraitInsideRoot: Boolean(portrait?.isConnected && portrait.closest('.site-graph-node') === rootNode),
      actionInsideRoot: Boolean(action?.isConnected && action.closest('.site-graph-node') === rootNode),
      rootMaterial: rootNode?.dataset.rootEntryMaterial || null
    };
  }

  window.ProfileRootEntryPortal = Object.freeze({
    open: reason => openPortal(reason || 'api'),
    close: reason => closePortal(reason || 'api'),
    enterProfile,
    refresh,
    snapshot
  });

  if (!ensurePortal()) {
    bootObserver = new MutationObserver(() => {
      if (!ensurePortal()) return;
      bootObserver.disconnect();
      bootObserver = null;
    });
    bootObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
