(() => {
  if (window.ProfilePhaseBObjectFocus) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const pilotBindings = new Set(['hedgehog-house-gallery', 'bachelor-thesis-diagrams']);
  const supportedMediaKinds = Object.freeze(['image', 'pdf', 'video', 'audio', 'interactive', 'external', 'generic']);

  let artifactReady = false;
  let phase8Ready = false;
  let pendingSource = null;
  let active = null;
  let flight = null;
  let animation = null;
  let transitionToken = 0;
  let lastTransition = 'idle';
  let mediaController = null;
  let viewerObserver = null;
  let suppressStageClick = false;

  const viewer = () => window.ProfileArtifactScenes?.viewer || null;
  const artifactFor = id => window.ProfileArtifacts?.get(id) || null;
  const hrefFor = id => window.ProfileArtifacts?.hrefFor(id) || null;

  const setState = (element, state) => {
    if (!element) return;
    element.dataset.objectFocusState = state;
  };

  const sourceArtifactId = source => source?.dataset?.artifactId || null;

  const mediaKindFor = artifact => {
    const type = artifact?.type || '';
    const mediaType = artifact?.mediaType || '';
    if (mediaType === 'application/pdf') return 'pdf';
    if (/^image\//i.test(mediaType)) return 'image';
    if (/^video\//i.test(mediaType)) return 'video';
    if (/^audio\//i.test(mediaType)) return 'audio';
    if (type === 'image' || type === 'diagram') return 'image';
    if (type === 'document' || type === 'certificate') return 'pdf';
    if (type === 'video') return 'video';
    if (type === 'audio') return 'audio';
    if (type === 'interactive') return 'interactive';
    if (type === 'external') return 'external';
    return 'generic';
  };

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
      clone.removeAttribute('style');
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
    const fromTransform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;

    animation = node.animate([
      { transform: fromTransform, borderRadius: '10px', opacity: .96 },
      { transform: 'translate(0, 0) scale(1, 1)', borderRadius: direction === 'open' ? '18px' : '6px', opacity: 1 }
    ], {
      duration: direction === 'open' ? 330 : 250,
      easing: 'cubic-bezier(.22,.82,.2,1)',
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
    return surface?.querySelector('.phase-b-focus-primary') ||
      surface?.querySelector('img,iframe,video,audio,.artifact-focus-generic,.phase-b-external-focus') ||
      surface || null;
  };

  const clearMediaController = () => {
    try { mediaController?.destroy?.(); } catch (_) {}
    mediaController = null;
  };

  const ensureStageOverlay = (surface, kind) => {
    surface.querySelectorAll('.phase-b-media-hint,.phase-b-media-zoom-readout').forEach(node => node.remove());

    const hint = document.createElement('div');
    hint.className = 'phase-b-media-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.textContent = kind === 'image'
      ? 'Scroll to zoom · drag to move · double-click to reset'
      : kind === 'pdf'
        ? 'Scroll the document · click outside to close'
        : kind === 'video'
          ? 'Play inline · click outside to close'
          : kind === 'audio'
            ? 'Play inline · click outside to close'
            : 'Click outside to close';
    surface.appendChild(hint);

    let hintTimer = 0;
    requestAnimationFrame(() => hint.classList.add('is-visible'));
    hintTimer = setTimeout(() => hint.classList.add('is-faded'), 2300);

    return {
      hint,
      destroy() {
        clearTimeout(hintTimer);
        hint.remove();
      }
    };
  };

  const configureImageInteraction = (surface, image, overlay) => {
    const pointers = new Map();
    let scale = 1;
    let panX = 0;
    let panY = 0;
    let dragStart = null;
    let pinchStart = null;
    let moved = false;
    let readoutTimer = 0;

    image.draggable = false;
    image.classList.add('phase-b-focus-primary', 'phase-b-panzoom-media');
    surface.dataset.mediaKind = 'image';

    const readout = document.createElement('div');
    readout.className = 'phase-b-media-zoom-readout';
    readout.setAttribute('aria-hidden', 'true');
    readout.textContent = '100%';
    surface.appendChild(readout);

    const clamp = value => Math.max(1, Math.min(6, value));
    const clampPan = () => {
      const width = image.offsetWidth * scale;
      const height = image.offsetHeight * scale;
      const maxX = Math.max(0, (width - surface.clientWidth) / 2 + 44);
      const maxY = Math.max(0, (height - surface.clientHeight) / 2 + 44);
      panX = Math.max(-maxX, Math.min(maxX, panX));
      panY = Math.max(-maxY, Math.min(maxY, panY));
      if (scale <= 1.001) {
        panX = 0;
        panY = 0;
      }
    };

    const apply = ({ animate = false } = {}) => {
      clampPan();
      image.classList.toggle('is-zoomed', scale > 1.01);
      image.classList.toggle('is-transform-animating', animate);
      image.style.setProperty('--phase-b-media-scale', scale.toFixed(4));
      image.style.setProperty('--phase-b-media-pan-x', `${panX.toFixed(2)}px`);
      image.style.setProperty('--phase-b-media-pan-y', `${panY.toFixed(2)}px`);
      readout.textContent = `${Math.round(scale * 100)}%`;
    };

    const showReadout = () => {
      clearTimeout(readoutTimer);
      readout.classList.add('is-visible');
      readoutTimer = setTimeout(() => readout.classList.remove('is-visible'), 850);
    };

    const zoomAt = (nextScale, clientX, clientY) => {
      const oldScale = scale;
      nextScale = clamp(nextScale);
      if (Math.abs(nextScale - oldScale) < .001) return;
      const rect = surface.getBoundingClientRect();
      const cx = clientX - (rect.left + rect.width / 2);
      const cy = clientY - (rect.top + rect.height / 2);
      const ratio = nextScale / oldScale;
      panX = cx - (cx - panX) * ratio;
      panY = cy - (cy - panY) * ratio;
      scale = nextScale;
      apply();
      showReadout();
    };

    const reset = ({ animate = false } = {}) => {
      scale = 1;
      panX = 0;
      panY = 0;
      apply({ animate });
      if (animate && !reducedMotion.matches) {
        return new Promise(resolve => setTimeout(() => {
          image.classList.remove('is-transform-animating');
          resolve();
        }, 120));
      }
      image.classList.remove('is-transform-animating');
      return Promise.resolve();
    };

    const onWheel = event => {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * .00135);
      zoomAt(scale * factor, event.clientX, event.clientY);
    };

    const pointerMidpoint = () => {
      const values = [...pointers.values()];
      if (values.length < 2) return null;
      return {
        x: (values[0].x + values[1].x) / 2,
        y: (values[0].y + values[1].y) / 2,
        distance: Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y)
      };
    };

    const onPointerDown = event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      try { surface.setPointerCapture(event.pointerId); } catch (_) {}
      image.classList.add('is-dragging');
      moved = false;

      if (pointers.size === 1) {
        dragStart = { x: event.clientX, y: event.clientY, panX, panY };
        pinchStart = null;
      } else if (pointers.size === 2) {
        const midpoint = pointerMidpoint();
        pinchStart = midpoint ? { ...midpoint, scale, panX, panY } : null;
        dragStart = null;
      }
    };

    const onPointerMove = event => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointers.size >= 2 && pinchStart) {
        const current = pointerMidpoint();
        if (!current || !pinchStart.distance) return;
        const nextScale = clamp(pinchStart.scale * current.distance / pinchStart.distance);
        const ratio = nextScale / pinchStart.scale;
        const rect = surface.getBoundingClientRect();
        const startX = pinchStart.x - (rect.left + rect.width / 2);
        const startY = pinchStart.y - (rect.top + rect.height / 2);
        const currentX = current.x - (rect.left + rect.width / 2);
        const currentY = current.y - (rect.top + rect.height / 2);
        panX = currentX - (startX - pinchStart.panX) * ratio;
        panY = currentY - (startY - pinchStart.panY) * ratio;
        scale = nextScale;
        moved = true;
        apply();
        showReadout();
        return;
      }

      if (!dragStart || scale <= 1.01) return;
      const dx = event.clientX - dragStart.x;
      const dy = event.clientY - dragStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      panX = dragStart.panX + dx;
      panY = dragStart.panY + dy;
      apply();
    };

    const onPointerEnd = event => {
      const wasMoved = moved;
      pointers.delete(event.pointerId);
      try { surface.releasePointerCapture(event.pointerId); } catch (_) {}
      if (!pointers.size) image.classList.remove('is-dragging');
      if (pointers.size === 1) {
        const [remaining] = [...pointers.values()];
        dragStart = { x: remaining.x, y: remaining.y, panX, panY };
      } else {
        dragStart = null;
      }
      pinchStart = null;
      if (wasMoved) {
        suppressStageClick = true;
        requestAnimationFrame(() => { suppressStageClick = false; });
      }
    };

    const onDoubleClick = event => {
      event.preventDefault();
      if (scale > 1.01) reset({ animate: true });
      else zoomAt(2.2, event.clientX, event.clientY);
    };

    surface.addEventListener('wheel', onWheel, { passive: false });
    surface.addEventListener('pointerdown', onPointerDown);
    surface.addEventListener('pointermove', onPointerMove);
    surface.addEventListener('pointerup', onPointerEnd);
    surface.addEventListener('pointercancel', onPointerEnd);
    image.addEventListener('dblclick', onDoubleClick);
    apply();

    return {
      kind: 'image',
      reset,
      snapshot: () => ({ kind: 'image', zoom: scale, panX, panY }),
      destroy() {
        clearTimeout(readoutTimer);
        surface.removeEventListener('wheel', onWheel);
        surface.removeEventListener('pointerdown', onPointerDown);
        surface.removeEventListener('pointermove', onPointerMove);
        surface.removeEventListener('pointerup', onPointerEnd);
        surface.removeEventListener('pointercancel', onPointerEnd);
        image.removeEventListener('dblclick', onDoubleClick);
        image.classList.remove('phase-b-focus-primary', 'phase-b-panzoom-media', 'is-zoomed', 'is-transform-animating');
        image.style.removeProperty('--phase-b-media-scale');
        image.style.removeProperty('--phase-b-media-pan-x');
        image.style.removeProperty('--phase-b-media-pan-y');
        readout.remove();
        overlay.destroy();
      }
    };
  };

  const configurePassiveMedia = (surface, primary, kind, overlay) => {
    primary?.classList.add('phase-b-focus-primary');
    surface.dataset.mediaKind = kind;
    return {
      kind,
      reset: () => Promise.resolve(),
      snapshot: () => ({ kind, zoom: 1, panX: 0, panY: 0 }),
      destroy() {
        primary?.classList.remove('phase-b-focus-primary');
        overlay.destroy();
      }
    };
  };

  const configureMediaStage = artifactId => {
    const currentViewer = viewer();
    const artifact = artifactFor(artifactId);
    const surface = currentViewer?.querySelector('.artifact-focus-media');
    if (!currentViewer || !artifact || !surface || currentViewer.hidden) return false;

    clearMediaController();
    currentViewer.querySelectorAll('[data-artifact-image-zoom="true"]').forEach(node => node.remove());
    currentViewer.dataset.mediaKind = mediaKindFor(artifact);
    currentViewer.dataset.mediaStage = 'phase-b';
    surface.classList.remove('is-native-scale');
    surface.dataset.mediaKind = currentViewer.dataset.mediaKind;

    const kind = currentViewer.dataset.mediaKind;
    const href = hrefFor(artifactId);
    let primary = kind === 'image'
      ? surface.querySelector('img')
      : kind === 'pdf'
        ? surface.querySelector('iframe')
        : kind === 'video'
          ? surface.querySelector('video')
          : kind === 'audio'
            ? surface.querySelector('audio')
            : kind === 'interactive' || kind === 'external'
              ? surface.querySelector('.phase-b-external-focus')
              : surface.firstElementChild;

    if (kind === 'pdf' && primary && href) {
      const desired = `${href}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`;
      if (primary.getAttribute('src') !== desired) primary.setAttribute('src', desired);
    }

    if ((!primary || primary.classList?.contains('artifact-focus-generic')) && href && ['video', 'audio', 'interactive', 'external'].includes(kind)) {
      primary = makeMedia(artifact, href);
      surface.replaceChildren(primary);
    }
    if (!primary) return false;

    const overlay = ensureStageOverlay(surface, kind);
    mediaController = kind === 'image'
      ? configureImageInteraction(surface, primary, overlay)
      : configurePassiveMedia(surface, primary, kind, overlay);
    return true;
  };

  const currentViewerArtifactId = () => {
    const currentViewer = viewer();
    return currentViewer?.dataset.sharedFocusArtifact ||
      sourceArtifactId(pendingSource) ||
      active?.artifactId ||
      window.ProfileArtifactScenes?.snapshot?.()?.viewer?.artifactId ||
      null;
  };

  const syncMediaStage = () => {
    const currentViewer = viewer();
    if (!currentViewer || currentViewer.hidden) {
      clearMediaController();
      return;
    }
    const artifactId = currentViewerArtifactId();
    if (!artifactId) return;
    const existingKind = mediaController?.kind;
    const desiredKind = mediaKindFor(artifactFor(artifactId));
    const primary = targetMedia();
    if (mediaController && existingKind === desiredKind && primary?.classList.contains('phase-b-focus-primary')) return;
    configureMediaStage(artifactId);
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
    configureMediaStage(artifactId);

    await animateFlight(source, targetMedia(), 'open');
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
      if (attempts < 7) waitForArtifactViewer(source, attempts + 1);
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
        clearMediaController();
        clearViewerPilotState(currentViewer);
        window.ProfileArtifactScenes?.closeFocus?.({ restoreFocus: false });
        lastTransition = 'interrupted';
      }
      return;
    }

    const closing = active;
    active = null;
    if (!interrupted) await mediaController?.reset?.({ animate: !reducedMotion.matches });
    currentViewer?.classList.add('is-shared-focus-closing');
    if (currentViewer) currentViewer.dataset.sharedFocusPhase = 'returning';
    const target = targetMedia();

    if (!interrupted && target && closing.source?.isConnected) {
      await animateFlight(closing.source, target, 'return');
    } else {
      cancelFlight();
      lastTransition = interrupted ? 'interrupted' : 'reduced-return';
    }

    clearMediaController();
    window.ProfileArtifactScenes?.closeFocus?.({ restoreFocus: false });
    restoreSource(closing.source, restoreFocus);
    document.body.classList.remove('has-phase-b-object-focus');
    clearViewerPilotState(currentViewer);
    syncObjectStates();
  };

  const makeMedia = (artifact, href) => {
    const kind = mediaKindFor(artifact);
    if (kind === 'image') {
      const image = document.createElement('img');
      image.src = href;
      image.alt = artifact.title || '';
      image.decoding = 'async';
      return image;
    }
    if (kind === 'pdf') {
      const frame = document.createElement('iframe');
      frame.src = `${href}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`;
      frame.title = artifact.title || 'PDF artifact';
      return frame;
    }
    if (kind === 'video') {
      const video = document.createElement('video');
      video.src = href;
      video.controls = true;
      video.playsInline = true;
      video.preload = 'metadata';
      return video;
    }
    if (kind === 'audio') {
      const audio = document.createElement('audio');
      audio.src = href;
      audio.controls = true;
      audio.preload = 'metadata';
      return audio;
    }
    if (kind === 'interactive' || kind === 'external') {
      const card = document.createElement('div');
      card.className = 'phase-b-external-focus';
      const label = document.createElement('span');
      label.textContent = artifact.title || 'External artifact';
      const open = document.createElement('a');
      open.href = href;
      open.target = '_blank';
      open.rel = 'noreferrer';
      open.textContent = kind === 'interactive' ? 'Open interactive ↗' : 'Open source ↗';
      card.append(label, open);
      return card;
    }
    const fallback = document.createElement('div');
    fallback.className = 'artifact-focus-generic';
    fallback.textContent = artifact.title || 'Artifact';
    return fallback;
  };

  const openCertificateFocus = source => {
    const currentViewer = viewer();
    const artifactId = sourceArtifactId(source);
    const artifact = artifactFor(artifactId);
    const href = hrefFor(artifactId);
    if (!currentViewer || !artifact || !href) return false;

    cancelFlight();
    clearMediaController();
    pendingSource = source;
    currentViewer.classList.add('is-shared-focus-pending');
    currentViewer.dataset.sharedFocusPhase = 'preparing';
    currentViewer.querySelector('.artifact-focus-title').textContent = artifact.title;

    const surface = currentViewer.querySelector('.artifact-focus-media');
    const media = makeMedia(artifact, href);
    surface.classList.toggle('is-image', mediaKindFor(artifact) === 'image');
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

    const open = document.createElement('a');
    open.className = 'artifact-action';
    open.href = href;
    open.target = '_blank';
    open.rel = 'noreferrer';
    open.textContent = mediaKindFor(artifact) === 'image' ? 'Open original ↗' : 'Open source ↗';
    footer.appendChild(open);

    currentViewer.hidden = false;
    document.body.classList.add('has-artifact-focus');
    configureMediaStage(artifactId);
    requestAnimationFrame(() => {
      if (source !== pendingSource) return;
      currentViewer.classList.add('is-open');
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

  const isStageDismissClick = event => {
    if (suppressStageClick) return false;
    if (event.target.closest?.('[data-artifact-viewer-close="true"]')) return true;
    return event.target.classList?.contains('artifact-focus-media') ||
      event.target.classList?.contains('artifact-focus-backdrop');
  };

  const attachArtifactRuntime = () => {
    if (artifactReady || !window.ProfileArtifactScenes?.viewer) return;
    artifactReady = true;
    const currentViewer = viewer();

    currentViewer.addEventListener('click', event => {
      if (!isStageDismissClick(event)) return;
      if (active || pendingSource) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeSharedFocus({ interrupted: Boolean(pendingSource && !active) });
        return;
      }
      if (event.target.classList?.contains('artifact-focus-media')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.ProfileArtifactScenes?.closeFocus?.();
      }
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

    viewerObserver = new MutationObserver(() => requestAnimationFrame(syncMediaStage));
    viewerObserver.observe(currentViewer, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'hidden']
    });
    syncObjectStates();
    syncMediaStage();
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
          clearMediaController();
          document.body.classList.remove('has-phase-b-object-focus');
          clearViewerPilotState(viewer());
          syncObjectStates();
        }
      });
    }
  });

  window.addEventListener('resize', () => {
    if (mediaController?.kind === 'image') mediaController.reset({ animate: false });
  });
  window.addEventListener('profile:artifact-scenes-ready', attachArtifactRuntime);
  window.addEventListener('profile:phase8-ready', attachPhase8);
  attachArtifactRuntime();
  attachPhase8();

  window.ProfilePhaseBObjectFocus = Object.freeze({
    close: closeSharedFocus,
    sync: syncObjectStates,
    syncMediaStage,
    supportedMediaKinds,
    snapshot: () => ({
      activeArtifactId: active?.artifactId || null,
      owner: active?.owner || null,
      pendingArtifactId: sourceArtifactId(pendingSource),
      phase: viewer()?.dataset.sharedFocusPhase || 'idle',
      lastTransition,
      reducedMotion: reducedMotion.matches,
      media: mediaController?.snapshot?.() || { kind: viewer()?.dataset.mediaKind || null, zoom: 1, panX: 0, panY: 0 }
    })
  });
})();
