(() => {
  if (window.ProfilePhaseBObjectFocus) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const pilotBindings = new Set(['hedgehog-house-gallery', 'bachelor-thesis-diagrams']);
  let artifactReady = false;
  let phase8Ready = false;
  let pendingSource = null;
  let active = null;
  let flight = null;
  let animation = null;
  let transitionToken = 0;
  let lastTransition = 'idle';

  const viewer = () => window.ProfileArtifactScenes?.viewer || null;
  const artifactFor = id => window.ProfileArtifacts?.get(id) || null;
  const hrefFor = id => window.ProfileArtifacts?.hrefFor(id) || null;

  const setState = (element, state) => {
    if (!element) return;
    element.dataset.objectFocusState = state;
  };

  const sourceArtifactId = source => source?.dataset?.artifactId || null;

  const syncObjectStates = () => {
    document.querySelectorAll('[data-artifact-scene] .artifact-deck-card[data-artifact-id]').forEach(card => {
      const bindingId = card.closest('[data-artifact-scene]')?.dataset.artifactScene;
      if (!pilotBindings.has(bindingId)) return;
      if (active?.source === card) setState(card, 'inspect');
      else setState(card, card.classList.contains('is-active') ? 'active' : 'ambient');
    });

    document.querySelectorAll('.phase8-certificate-paper[data-artifact-id]').forEach(paper => {
      if (active?.source === paper) setState(paper, 'inspect');
      else setState(paper, paper.classList.contains('is-active') ? 'active' : 'ambient');
    });
  };

  const cancelFlight = () => {
    transitionToken += 1;
    try { animation?.cancel(); } catch (_) {}
    animation = null;
    flight?.remove();
    flight = null;
  };

  const createFlightVisual = source => {
    const wrapper = document.createElement('div');
    wrapper.className = 'phase-b-focus-flight-visual';
    wrapper.setAttribute('aria-hidden', 'true');

    const image = source.querySelector('img');
    if (image) {
      const clone = image.cloneNode(false);
      clone.removeAttribute('loading');
      wrapper.appendChild(clone);
      return wrapper;
    }

    const pdfFallback = source.querySelector('.artifact-pdf-fallback');
    if (pdfFallback) {
      wrapper.appendChild(pdfFallback.cloneNode(true));
      return wrapper;
    }

    if (source.classList.contains('phase8-certificate-paper')) {
      const certificate = document.createElement('div');
      certificate.className = 'phase-b-focus-flight-certificate';
      const title = document.createElement('strong');
      title.textContent = source.querySelector('.phase8-certificate-title')?.textContent || 'Certificate';
      const meta = document.createElement('span');
      meta.textContent = source.querySelector('.phase8-certificate-meta')?.textContent || '';
      certificate.append(title, meta);
      wrapper.appendChild(certificate);
      return wrapper;
    }

    const label = document.createElement('strong');
    label.textContent = source.textContent?.trim() || 'Artifact';
    wrapper.appendChild(label);
    return wrapper;
  };

  const animateFlight = async (source, target, direction) => {
    cancelFlight();
    if (reducedMotion.matches || !source?.isConnected || !target?.isConnected) {
      lastTransition = direction === 'open' ? 'reduced-open' : 'reduced-return';
      return;
    }

    const fromRect = direction === 'open' ? source.getBoundingClientRect() : target.getBoundingClientRect();
    const toRect = direction === 'open' ? target.getBoundingClientRect() : source.getBoundingClientRect();
    if (!fromRect.width || !fromRect.height || !toRect.width || !toRect.height) return;

    const token = transitionToken;
    const node = document.createElement('div');
    node.className = 'phase-b-focus-flight';
    node.style.left = `${toRect.left}px`;
    node.style.top = `${toRect.top}px`;
    node.style.width = `${toRect.width}px`;
    node.style.height = `${toRect.height}px`;
    node.appendChild(createFlightVisual(source));
    document.body.appendChild(node);
    flight = node;

    const dx = fromRect.left - toRect.left;
    const dy = fromRect.top - toRect.top;
    const sx = fromRect.width / toRect.width;
    const sy = fromRect.height / toRect.height;
    const compact = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    const frames = direction === 'open'
      ? [
          { transform: compact, borderRadius: '5px', opacity: 1 },
          { transform: 'translate(0, 0) scale(1, 1)', borderRadius: '0px', opacity: 1 }
        ]
      : [
          { transform: 'translate(0, 0) scale(1, 1)', borderRadius: '0px', opacity: 1 },
          { transform: compact, borderRadius: '5px', opacity: 1 }
        ];

    animation = node.animate(frames, {
      duration: direction === 'open' ? 360 : 320,
      easing: 'cubic-bezier(.2,.78,.18,1)',
      fill: 'forwards'
    });
    lastTransition = direction === 'open' ? 'shared-open' : 'shared-return';

    try { await animation.finished; } catch (_) {}
    if (token !== transitionToken) return;
    node.remove();
    if (flight === node) flight = null;
    animation = null;
  };

  const targetMedia = () => {
    const surface = viewer()?.querySelector('.artifact-focus-media');
    return surface?.firstElementChild || surface || null;
  };

  const settleOpen = async (source, owner) => {
    const currentViewer = viewer();
    const artifactId = sourceArtifactId(source);
    const target = targetMedia();
    if (!currentViewer || currentViewer.hidden || !artifactId || !target) {
      pendingSource = null;
      currentViewer?.classList.remove('is-shared-focus-pending');
      return;
    }

    pendingSource = null;
    active = { source, artifactId, owner };
    source.classList.add('is-object-focus-origin');
    setState(source, 'inspect');
    document.body.classList.add('has-phase-b-object-focus');
    currentViewer.dataset.sharedFocusArtifact = artifactId;
    currentViewer.dataset.sharedFocusOwner = owner;
    currentViewer.dataset.sharedFocusPhase = 'moving-in';

    await animateFlight(source, target, 'open');
    if (!active || active.source !== source || currentViewer.hidden) return;
    currentViewer.classList.remove('is-shared-focus-pending');
    currentViewer.dataset.sharedFocusPhase = 'settled';
    syncObjectStates();
  };

  const waitForArtifactViewer = (source, attempts = 0) => {
    requestAnimationFrame(() => {
      const currentViewer = viewer();
      if (!pendingSource || pendingSource !== source) return;
      if (currentViewer && !currentViewer.hidden && targetMedia()) {
        settleOpen(source, 'artifact');
        return;
      }
      if (attempts < 5) waitForArtifactViewer(source, attempts + 1);
      else {
        pendingSource = null;
        currentViewer?.classList.remove('is-shared-focus-pending');
      }
    });
  };

  const prepareArtifactOpen = source => {
    const currentViewer = viewer();
    if (!currentViewer || !source) return;
    pendingSource = source;
    currentViewer.classList.add('is-shared-focus-pending');
    currentViewer.dataset.sharedFocusPhase = 'preparing';
    waitForArtifactViewer(source);
  };

  const clearViewerPilotState = currentViewer => {
    if (!currentViewer) return;
    currentViewer.classList.remove('is-shared-focus-pending', 'is-shared-focus-closing');
    delete currentViewer.dataset.sharedFocusArtifact;
    delete currentViewer.dataset.sharedFocusOwner;
    delete currentViewer.dataset.sharedFocusPhase;
  };

  const restoreSource = (source, restoreFocus) => {
    if (!source) return;
    source.classList.remove('is-object-focus-origin');
    if (source.isConnected) {
      setState(source, source.classList.contains('is-active') ? 'active' : 'ambient');
      if (restoreFocus) source.focus({ preventScroll: true });
    }
  };

  const closeSharedFocus = async ({ restoreFocus = true, interrupted = false } = {}) => {
    const currentViewer = viewer();

    if (!active) {
      if (pendingSource) {
        pendingSource = null;
        cancelFlight();
        clearViewerPilotState(currentViewer);
        window.ProfileArtifactScenes?.closeFocus?.({ restoreFocus: false });
        lastTransition = 'interrupted';
      }
      return;
    }

    const closing = active;
    active = null;
    currentViewer?.classList.add('is-shared-focus-closing');
    if (currentViewer) currentViewer.dataset.sharedFocusPhase = 'returning';
    const target = targetMedia();

    if (!interrupted && target && closing.source?.isConnected) {
      await animateFlight(closing.source, target, 'return');
    } else {
      cancelFlight();
      lastTransition = interrupted ? 'interrupted' : 'reduced-return';
    }

    window.ProfileArtifactScenes?.closeFocus?.({ restoreFocus: false });
    restoreSource(closing.source, restoreFocus);
    document.body.classList.remove('has-phase-b-object-focus');
    clearViewerPilotState(currentViewer);
    syncObjectStates();
  };

  const makeMedia = (artifact, href) => {
    if (/^image\//.test(artifact.mediaType || '')) {
      const image = document.createElement('img');
      image.src = href;
      image.alt = artifact.title || '';
      image.decoding = 'async';
      return image;
    }
    if (artifact.mediaType === 'application/pdf') {
      const frame = document.createElement('iframe');
      frame.src = `${href}#toolbar=1&navpanes=0&view=FitH`;
      frame.title = artifact.title || 'Certificate';
      return frame;
    }
    const fallback = document.createElement('div');
    fallback.className = 'artifact-focus-generic';
    fallback.textContent = artifact.title || 'Artifact';
    return fallback;
  };

  const buildImageZoom = (surface, media) => {
    const zoom = document.createElement('button');
    zoom.type = 'button';
    zoom.className = 'artifact-action artifact-image-zoom';
    zoom.dataset.artifactImageZoom = 'true';
    zoom.setAttribute('aria-pressed', 'false');
    zoom.textContent = 'View 1:1';
    zoom.addEventListener('click', () => {
      const native = surface.classList.toggle('is-native-scale');
      zoom.setAttribute('aria-pressed', native ? 'true' : 'false');
      zoom.textContent = native ? 'Fit image' : 'View 1:1';
      if (!native) surface.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    });
    media.addEventListener('dblclick', () => zoom.click());
    return zoom;
  };

  const openCertificateFocus = source => {
    const currentViewer = viewer();
    const artifactId = sourceArtifactId(source);
    const artifact = artifactFor(artifactId);
    const href = hrefFor(artifactId);
    if (!currentViewer || !artifact || !href) return false;

    cancelFlight();
    pendingSource = null;
    currentViewer.classList.add('is-shared-focus-pending');
    currentViewer.dataset.sharedFocusPhase = 'preparing';
    currentViewer.querySelector('.artifact-focus-title').textContent = artifact.title;

    const surface = currentViewer.querySelector('.artifact-focus-media');
    const media = makeMedia(artifact, href);
    const isImage = /^image\//.test(artifact.mediaType || '');
    surface.classList.toggle('is-image', isImage);
    surface.classList.remove('is-native-scale');
    surface.replaceChildren(media);

    const footer = currentViewer.querySelector('.artifact-focus-footer');
    footer.replaceChildren();
    if (artifact.description) {
      const description = document.createElement('p');
      description.className = 'artifact-focus-description';
      description.textContent = artifact.description;
      footer.appendChild(description);
    }
    if (isImage) footer.appendChild(buildImageZoom(surface, media));

    const open = document.createElement('a');
    open.className = 'artifact-action';
    open.href = href;
    open.target = '_blank';
    open.rel = 'noreferrer';
    open.textContent = isImage ? 'Open full resolution ↗' : 'Open original ↗';
    footer.appendChild(open);

    currentViewer.hidden = false;
    document.body.classList.add('has-artifact-focus');
    requestAnimationFrame(() => {
      currentViewer.classList.add('is-open');
      currentViewer.querySelector('.artifact-focus-close')?.focus({ preventScroll: true });
      settleOpen(source, 'certificate');
    });
    return true;
  };

  const ensureCertificateInspectAction = () => {
    const inspector = document.querySelector('.phase8-certificate-inspector');
    const activePaper = document.querySelector('.phase8-certificate-paper.is-active[data-artifact-id]');
    const actions = inspector?.querySelector('.phase8-actions');
    if (!actions || !activePaper || actions.querySelector('[data-phase-b-certificate-inspect]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'phase8-route-link phase8-certificate-focus-action';
    button.dataset.phaseBCertificateInspect = 'true';
    button.textContent = 'Inspect certificate';
    actions.prepend(button);
  };

  const handleCaptureClick = event => {
    const certificateAction = event.target.closest?.('[data-phase-b-certificate-inspect]');
    if (certificateAction) {
      const source = document.querySelector('.phase8-certificate-paper.is-active[data-artifact-id]');
      if (source) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openCertificateFocus(source);
      }
      return;
    }

    const certificate = event.target.closest?.('.phase8-certificate-paper[data-artifact-id]');
    if (certificate) {
      if (certificate.classList.contains('is-active')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openCertificateFocus(certificate);
      } else {
        requestAnimationFrame(() => {
          syncObjectStates();
          ensureCertificateInspectAction();
        });
      }
      return;
    }

    const card = event.target.closest?.('.artifact-deck-card[data-artifact-id]');
    if (card) {
      const bindingId = card.closest('[data-artifact-scene]')?.dataset.artifactScene;
      if (pilotBindings.has(bindingId) && card.classList.contains('is-active')) prepareArtifactOpen(card);
      else requestAnimationFrame(syncObjectStates);
      return;
    }

    const inspect = event.target.closest?.('.artifact-deck-inspect');
    if (inspect) {
      const root = inspect.closest('[data-artifact-scene]');
      if (!pilotBindings.has(root?.dataset.artifactScene)) return;
      const source = root.querySelector('.artifact-deck-card.is-active[data-artifact-id]');
      if (source) prepareArtifactOpen(source);
    }
  };

  const attachArtifactRuntime = () => {
    if (artifactReady || !window.ProfileArtifactScenes?.viewer) return;
    artifactReady = true;
    const currentViewer = viewer();

    currentViewer.addEventListener('click', event => {
      if (!event.target.closest('[data-artifact-viewer-close="true"]')) return;
      if (!active && !pendingSource) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeSharedFocus();
    }, true);

    document.addEventListener('click', handleCaptureClick, true);
    window.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || (!active && !pendingSource)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeSharedFocus({ interrupted: Boolean(pendingSource && !active) });
    }, true);

    const artifactLayer = window.ProfileArtifactScenes.layer;
    if (artifactLayer) {
      new MutationObserver(syncObjectStates).observe(artifactLayer, {
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'hidden']
      });
    }
    syncObjectStates();
  };

  const attachPhase8 = () => {
    if (phase8Ready || !window.ProfilePhase8) return;
    phase8Ready = true;
    const inspector = document.querySelector('.phase8-certificate-inspector');
    const stack = document.querySelector('.phase8-certificate-stack');
    if (inspector) new MutationObserver(() => {
      ensureCertificateInspectAction();
      syncObjectStates();
    }).observe(inspector, { childList: true, subtree: true });
    if (stack) new MutationObserver(syncObjectStates).observe(stack, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
    ensureCertificateInspectAction();
    syncObjectStates();
  };

  window.addEventListener('profile:scene-state', event => {
    const route = (event.detail?.current?.route || '').replace(/^#/, '');
    if (active?.owner === 'certificate' && route && route !== 'education/credentials' && !route.startsWith('education/credentials/')) {
      closeSharedFocus({ restoreFocus: false, interrupted: true });
      return;
    }
    if (active?.owner === 'artifact') {
      requestAnimationFrame(() => {
        const root = active?.source?.closest('[data-artifact-scene]');
        if (active && (!root || root.hidden)) {
          restoreSource(active.source, false);
          active = null;
          cancelFlight();
          document.body.classList.remove('has-phase-b-object-focus');
          clearViewerPilotState(viewer());
          syncObjectStates();
        }
      });
    }
  });

  window.addEventListener('profile:artifact-scenes-ready', attachArtifactRuntime);
  window.addEventListener('profile:phase8-ready', attachPhase8);
  attachArtifactRuntime();
  attachPhase8();

  window.ProfilePhaseBObjectFocus = Object.freeze({
    close: closeSharedFocus,
    sync: syncObjectStates,
    snapshot: () => ({
      activeArtifactId: active?.artifactId || null,
      owner: active?.owner || null,
      pendingArtifactId: sourceArtifactId(pendingSource),
      phase: viewer()?.dataset.sharedFocusPhase || 'idle',
      lastTransition,
      reducedMotion: reducedMotion.matches
    })
  });
})();
