(() => {
  if (window.ProfileObjectFocus) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const supportedMediaKinds = Object.freeze(['image', 'pdf', 'video', 'audio', 'interactive', 'external', 'generic']);

  class ObjectFocusController {
    constructor() {
      this.active = null;
      this.pending = null;
      this.flight = null;
      this.animation = null;
      this.operation = 0;
      this.lastTransition = 'idle';
      this.mediaController = null;
      this.hideTimer = 0;
      this.attachedViewer = null;
      this.suppressStageClick = false;

      this.handleViewerClick = this.handleViewerClick.bind(this);
      this.handleKeydown = this.handleKeydown.bind(this);
      this.handleSceneState = this.handleSceneState.bind(this);
      this.handleResize = this.handleResize.bind(this);

      window.addEventListener('profile:artifact-scenes-ready', () => this.attach());
      window.addEventListener('profile:scene-state', this.handleSceneState);
      window.addEventListener('keydown', this.handleKeydown, true);
      window.addEventListener('resize', this.handleResize);
      this.attach();
    }

    viewer() {
      return window.ProfileArtifactScenes?.viewer || null;
    }

    artifactFor(id) {
      return window.ProfileArtifacts?.get?.(id) || null;
    }

    hrefFor(id) {
      return window.ProfileArtifacts?.hrefFor?.(id) || null;
    }

    mediaKindFor(artifact) {
      const type = artifact?.type || '';
      const mediaType = artifact?.mediaType || '';
      if (mediaType === 'application/pdf') return 'pdf';
      if (/^image\//i.test(mediaType)) return 'image';
      if (/^video\//i.test(mediaType)) return 'video';
      if (/^audio\//i.test(mediaType)) return 'audio';
      if (type === 'image' || type === 'diagram' || type === 'certificate') return 'image';
      if (type === 'document') return 'pdf';
      if (type === 'video') return 'video';
      if (type === 'audio') return 'audio';
      if (type === 'interactive') return 'interactive';
      if (type === 'external') return 'external';
      return 'generic';
    }

    attach() {
      const viewer = this.viewer();
      if (!viewer || this.attachedViewer === viewer) return Boolean(viewer);
      this.attachedViewer?.removeEventListener('click', this.handleViewerClick, true);
      this.attachedViewer = viewer;
      viewer.addEventListener('click', this.handleViewerClick, true);
      return true;
    }

    setSourceState(source, state) {
      if (source) source.dataset.objectFocusState = state;
    }

    restoreSource(source, restoreFocus) {
      if (!source) return;
      source.classList.remove('is-object-focus-origin');
      if (!source.isConnected) return;
      this.setSourceState(source, source.classList.contains('is-active') ? 'active' : 'ambient');
      if (restoreFocus) source.focus?.({ preventScroll: true });
    }

    clearAnimation() {
      try { this.animation?.cancel?.(); } catch (_) {}
      this.animation = null;
      this.flight?.remove();
      this.flight = null;
    }

    createFlightVisual(source) {
      const wrapper = document.createElement('div');
      wrapper.className = 'object-focus-flight-visual';
      wrapper.setAttribute('aria-hidden', 'true');

      const image = source?.querySelector?.('img');
      if (image) {
        const clone = image.cloneNode(false);
        clone.removeAttribute('loading');
        clone.removeAttribute('style');
        wrapper.appendChild(clone);
        return wrapper;
      }

      const pdfFallback = source?.querySelector?.('.artifact-pdf-fallback');
      if (pdfFallback) {
        wrapper.appendChild(pdfFallback.cloneNode(true));
        return wrapper;
      }

      if (source?.classList?.contains('phase8-certificate-paper')) {
        const certificate = document.createElement('div');
        certificate.className = 'object-focus-flight-certificate';
        const title = document.createElement('strong');
        title.textContent = source.querySelector('.phase8-certificate-title')?.textContent || 'Certificate';
        const meta = document.createElement('span');
        meta.textContent = source.querySelector('.phase8-certificate-meta')?.textContent || '';
        certificate.append(title, meta);
        wrapper.appendChild(certificate);
        return wrapper;
      }

      const label = document.createElement('strong');
      label.textContent = source?.textContent?.trim() || 'Artifact';
      wrapper.appendChild(label);
      return wrapper;
    }

    async animateFlight(source, target, direction, operation) {
      this.clearAnimation();
      if (reducedMotion.matches || !source?.isConnected || !target?.isConnected) {
        this.lastTransition = direction === 'open' ? 'reduced-open' : 'reduced-return';
        return;
      }

      const fromRect = direction === 'open' ? source.getBoundingClientRect() : target.getBoundingClientRect();
      const toRect = direction === 'open' ? target.getBoundingClientRect() : source.getBoundingClientRect();
      if (!fromRect.width || !fromRect.height || !toRect.width || !toRect.height) return;

      const node = document.createElement('div');
      node.className = 'object-focus-flight';
      node.style.left = `${toRect.left}px`;
      node.style.top = `${toRect.top}px`;
      node.style.width = `${toRect.width}px`;
      node.style.height = `${toRect.height}px`;
      node.appendChild(this.createFlightVisual(source));
      document.body.appendChild(node);
      this.flight = node;

      const dx = fromRect.left - toRect.left;
      const dy = fromRect.top - toRect.top;
      const sx = fromRect.width / toRect.width;
      const sy = fromRect.height / toRect.height;
      const fromTransform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;

      this.animation = node.animate([
        { transform: fromTransform, borderRadius: '10px', opacity: .96 },
        { transform: 'translate(0, 0) scale(1, 1)', borderRadius: direction === 'open' ? '18px' : '6px', opacity: 1 }
      ], {
        duration: direction === 'open' ? 330 : 250,
        easing: 'cubic-bezier(.22,.82,.2,1)',
        fill: 'forwards'
      });
      this.lastTransition = direction === 'open' ? 'shared-open' : 'shared-return';

      try { await this.animation.finished; } catch (_) {}
      if (operation !== this.operation) return;
      node.remove();
      if (this.flight === node) this.flight = null;
      this.animation = null;
    }

    targetMedia() {
      const surface = this.viewer()?.querySelector('.artifact-focus-media');
      return surface?.querySelector('.object-focus-primary') ||
        surface?.querySelector('img,iframe,video,audio,.artifact-focus-generic,.object-focus-external') ||
        surface || null;
    }

    clearMediaController() {
      try { this.mediaController?.destroy?.(); } catch (_) {}
      this.mediaController = null;
    }

    ensureStageOverlay(surface, kind) {
      surface.querySelectorAll('.object-focus-media-hint,.object-focus-media-zoom-readout').forEach(node => node.remove());
      const hint = document.createElement('div');
      hint.className = 'object-focus-media-hint';
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
      requestAnimationFrame(() => hint.classList.add('is-visible'));
      const timer = setTimeout(() => hint.classList.add('is-faded'), 2300);
      return {
        destroy() {
          clearTimeout(timer);
          hint.remove();
        }
      };
    }

    configureImageInteraction(surface, image, overlay) {
      const pointers = new Map();
      let scale = 1;
      let panX = 0;
      let panY = 0;
      let dragStart = null;
      let pinchStart = null;
      let moved = false;
      let readoutTimer = 0;

      image.draggable = false;
      image.classList.add('object-focus-primary', 'object-focus-panzoom-media');
      surface.dataset.mediaKind = 'image';

      const readout = document.createElement('div');
      readout.className = 'object-focus-media-zoom-readout';
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
        image.style.setProperty('--object-focus-media-scale', scale.toFixed(4));
        image.style.setProperty('--object-focus-media-pan-x', `${panX.toFixed(2)}px`);
        image.style.setProperty('--object-focus-media-pan-y', `${panY.toFixed(2)}px`);
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
          this.suppressStageClick = true;
          requestAnimationFrame(() => { this.suppressStageClick = false; });
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
        destroy: () => {
          clearTimeout(readoutTimer);
          surface.removeEventListener('wheel', onWheel);
          surface.removeEventListener('pointerdown', onPointerDown);
          surface.removeEventListener('pointermove', onPointerMove);
          surface.removeEventListener('pointerup', onPointerEnd);
          surface.removeEventListener('pointercancel', onPointerEnd);
          image.removeEventListener('dblclick', onDoubleClick);
          image.classList.remove('object-focus-primary', 'object-focus-panzoom-media', 'is-zoomed', 'is-transform-animating');
          image.style.removeProperty('--object-focus-media-scale');
          image.style.removeProperty('--object-focus-media-pan-x');
          image.style.removeProperty('--object-focus-media-pan-y');
          readout.remove();
          overlay.destroy();
        }
      };
    }

    configurePassiveMedia(surface, primary, kind, overlay) {
      primary?.classList.add('object-focus-primary');
      surface.dataset.mediaKind = kind;
      return {
        kind,
        reset: () => Promise.resolve(),
        snapshot: () => ({ kind, zoom: 1, panX: 0, panY: 0 }),
        destroy() {
          primary?.classList.remove('object-focus-primary');
          overlay.destroy();
        }
      };
    }

    makeMedia(artifact, href) {
      const kind = this.mediaKindFor(artifact);
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
        card.className = 'object-focus-external';
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
    }

    renderViewer(artifact, href) {
      const viewer = this.viewer();
      if (!viewer) return null;
      const kind = this.mediaKindFor(artifact);
      viewer.querySelector('.artifact-focus-title').textContent = artifact.title || 'Artifact';
      viewer.dataset.mediaKind = kind;
      viewer.dataset.mediaStage = 'object-focus';

      const surface = viewer.querySelector('.artifact-focus-media');
      const media = this.makeMedia(artifact, href);
      surface.classList.toggle('is-image', kind === 'image');
      surface.classList.remove('is-native-scale');
      surface.replaceChildren(media);

      const footer = viewer.querySelector('.artifact-focus-footer');
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
      open.textContent = kind === 'image' ? 'Open original ↗' : 'Open source ↗';
      footer.appendChild(open);
      return { viewer, surface, media, kind };
    }

    configureMediaStage(artifact) {
      const viewer = this.viewer();
      const surface = viewer?.querySelector('.artifact-focus-media');
      if (!viewer || !surface || viewer.hidden) return false;
      this.clearMediaController();
      viewer.querySelectorAll('[data-artifact-image-zoom="true"]').forEach(node => node.remove());
      const kind = this.mediaKindFor(artifact);
      viewer.dataset.mediaKind = kind;
      viewer.dataset.mediaStage = 'object-focus';
      surface.dataset.mediaKind = kind;
      const primary = surface.firstElementChild;
      if (!primary) return false;
      const overlay = this.ensureStageOverlay(surface, kind);
      this.mediaController = kind === 'image'
        ? this.configureImageInteraction(surface, primary, overlay)
        : this.configurePassiveMedia(surface, primary, kind, overlay);
      return true;
    }

    clearViewerState({ clearMedia = true } = {}) {
      const viewer = this.viewer();
      if (!viewer) return;
      viewer.classList.remove('is-shared-focus-pending', 'is-shared-focus-closing');
      delete viewer.dataset.sharedFocusArtifact;
      delete viewer.dataset.sharedFocusOwner;
      delete viewer.dataset.sharedFocusPhase;
      if (clearMedia) {
        const media = viewer.querySelector('.artifact-focus-media');
        media?.replaceChildren();
        media?.classList.remove('is-image', 'is-native-scale');
        if (media) delete media.dataset.mediaKind;
        viewer.querySelector('.artifact-focus-footer')?.replaceChildren();
      }
      delete viewer.dataset.mediaKind;
      delete viewer.dataset.mediaStage;
    }

    async open({ source, artifact = null, artifactId = null, owner = 'artifact', ownerValid = null } = {}) {
      this.attach();
      const viewer = this.viewer();
      const id = artifactId || artifact?.id || source?.dataset?.artifactId || null;
      artifact = artifact || this.artifactFor(id);
      const href = id ? this.hrefFor(id) : null;
      if (!viewer || !source || !artifact || !href) return false;

      if (this.active || this.pending) this.interrupt();
      clearTimeout(this.hideTimer);
      const operation = ++this.operation;
      const record = { source, artifactId: id, artifact, owner, ownerValid };
      this.pending = record;
      this.clearAnimation();
      this.clearMediaController();
      this.renderViewer(artifact, href);

      viewer.hidden = false;
      viewer.classList.add('is-shared-focus-pending');
      viewer.dataset.sharedFocusArtifact = id;
      viewer.dataset.sharedFocusOwner = owner;
      viewer.dataset.sharedFocusPhase = 'preparing';
      document.body.classList.add('has-artifact-focus', 'has-object-focus');
      this.configureMediaStage(artifact);

      requestAnimationFrame(async () => {
        if (operation !== this.operation || this.pending !== record) return;
        viewer.classList.add('is-open');
        this.pending = null;
        this.active = record;
        source.classList.add('is-object-focus-origin');
        this.setSourceState(source, 'inspect');
        viewer.dataset.sharedFocusPhase = 'moving-in';

        await this.animateFlight(source, this.targetMedia(), 'open', operation);
        if (operation !== this.operation || this.active !== record || viewer.hidden) return;
        viewer.classList.remove('is-shared-focus-pending');
        viewer.dataset.sharedFocusPhase = 'settled';
        viewer.querySelector('.artifact-focus-close')?.focus?.({ preventScroll: true });
      });
      return true;
    }

    async close({ restoreFocus = true, interrupted = false } = {}) {
      const viewer = this.viewer();
      const closing = this.active || this.pending;
      if (!closing) {
        if (viewer && !viewer.hidden) this.finishClose(null, false, true);
        return false;
      }

      const operation = ++this.operation;
      const wasActive = this.active === closing;
      this.active = null;
      this.pending = null;
      this.clearAnimation();

      if (wasActive && !interrupted) {
        await this.mediaController?.reset?.({ animate: !reducedMotion.matches });
        if (operation !== this.operation) return false;
        viewer?.classList.add('is-shared-focus-closing');
        if (viewer) viewer.dataset.sharedFocusPhase = 'returning';
        const target = this.targetMedia();
        if (target && closing.source?.isConnected) {
          await this.animateFlight(closing.source, target, 'return', operation);
          if (operation !== this.operation) return false;
        }
      } else {
        this.lastTransition = 'interrupted';
      }

      this.finishClose(closing, restoreFocus, interrupted);
      return true;
    }

    finishClose(record, restoreFocus, immediate) {
      const viewer = this.viewer();
      this.clearAnimation();
      this.clearMediaController();
      this.restoreSource(record?.source, restoreFocus);
      document.body.classList.remove('has-artifact-focus', 'has-object-focus');
      if (!viewer) return;

      viewer.classList.remove('is-open', 'is-shared-focus-pending', 'is-shared-focus-closing');
      const finalize = () => {
        if (viewer.classList.contains('is-open')) return;
        viewer.hidden = true;
        this.clearViewerState();
      };
      clearTimeout(this.hideTimer);
      if (immediate || reducedMotion.matches) finalize();
      else this.hideTimer = setTimeout(finalize, 180);
    }

    interrupt() {
      if (!this.active && !this.pending) return false;
      this.close({ restoreFocus: false, interrupted: true });
      return true;
    }

    handleViewerClick(event) {
      if (!this.active && !this.pending) return;
      if (this.suppressStageClick) return;
      const closeControl = event.target.closest?.('[data-artifact-viewer-close="true"]');
      const emptyStage = event.target.classList?.contains('artifact-focus-media') ||
        event.target.classList?.contains('artifact-focus-backdrop');
      if (!closeControl && !emptyStage) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.close({ interrupted: Boolean(this.pending && !this.active) });
    }

    handleKeydown(event) {
      if (event.key !== 'Escape' || (!this.active && !this.pending)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.close({ interrupted: Boolean(this.pending && !this.active) });
    }

    handleSceneState() {
      const record = this.active || this.pending;
      if (!record?.ownerValid) return;
      let valid = true;
      try { valid = record.ownerValid() !== false; } catch (_) { valid = false; }
      if (!valid) this.close({ restoreFocus: false, interrupted: true });
    }

    handleResize() {
      if (this.mediaController?.kind === 'image') this.mediaController.reset({ animate: false });
    }

    snapshot() {
      const viewer = this.viewer();
      return {
        activeArtifactId: this.active?.artifactId || null,
        owner: this.active?.owner || this.pending?.owner || null,
        pendingArtifactId: this.pending?.artifactId || null,
        phase: viewer?.dataset.sharedFocusPhase || 'idle',
        lastTransition: this.lastTransition,
        reducedMotion: reducedMotion.matches,
        supportedMediaKinds,
        media: this.mediaController?.snapshot?.() || {
          kind: viewer?.dataset.mediaKind || null,
          zoom: 1,
          panX: 0,
          panY: 0
        }
      };
    }
  }

  const controller = new ObjectFocusController();
  window.ObjectFocusController = ObjectFocusController;
  window.ProfileObjectFocus = Object.freeze({
    open: options => controller.open(options),
    close: options => controller.close(options),
    interrupt: () => controller.interrupt(),
    attach: () => controller.attach(),
    supportedMediaKinds,
    snapshot: () => controller.snapshot()
  });
  window.dispatchEvent(new CustomEvent('profile:object-focus-ready', { detail: window.ProfileObjectFocus.snapshot() }));
})();
