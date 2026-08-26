(() => {
  if (window.ProfileArtifactViewerV2) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const videoBindings = new WeakMap();
  let layerObserver = null;
  let viewerObserver = null;
  let installedViewer = null;

  const artifactFor = id => window.ProfileArtifacts?.get?.(id) || null;
  const hrefFor = id => window.ProfileArtifacts?.hrefFor?.(id) || null;
  const viewer = () => window.ProfileArtifactScenes?.viewer || document.querySelector('.artifact-focus-viewer');

  // Object Focus already owns media construction. Refine its generic PDF path
  // once, by media kind, while the iframe is still detached. Reassigning src on
  // a detached iframe does not create the second visible/native PDF navigation
  // that used to happen after the viewer was already on screen.
  const installPdfFocusUrlPolicy = () => {
    const Controller = window.ObjectFocusController;
    const prototype = Controller?.prototype;
    if (!prototype?.makeMedia || prototype.makeMedia.__artifactViewerV2) return Boolean(prototype?.makeMedia);
    const original = prototype.makeMedia;
    const refined = function (artifact, href) {
      const media = original.call(this, artifact, href);
      if (this.mediaKindFor?.(artifact) === 'pdf' && media instanceof HTMLIFrameElement) {
        media.src = `${href}#toolbar=1&navpanes=0&scrollbar=0&view=Fit`;
      }
      return media;
    };
    refined.__artifactViewerV2 = true;
    prototype.makeMedia = refined;
    return true;
  };

  const setMediaAspect = (frame, video) => {
    if (!frame || !video?.videoWidth || !video?.videoHeight) return;
    const ratio = video.videoWidth / video.videoHeight;
    if (!Number.isFinite(ratio) || ratio < .28 || ratio > 5) return;
    frame.style.aspectRatio = String(ratio);
    frame.dataset.mediaAspect = ratio.toFixed(4);
    frame.dataset.mediaAspectSource = 'video';
    frame.dataset.mediaAspectReady = 'true';
  };

  const bindInlineVideoLifecycle = (video, frame) => {
    if (videoBindings.has(video)) return;
    const root = frame.closest('.artifact-object');
    const source = frame.closest('[data-artifact-id]');
    const sync = () => {
      const routeVisible = Boolean(root && !root.hidden && root.isConnected);
      const inspecting = source?.dataset.objectFocusState === 'inspect';
      const shouldPlay = routeVisible && !inspecting && document.visibilityState === 'visible';
      if (shouldPlay) {
        video.muted = true;
        const play = video.play();
        play?.catch?.(() => {});
      } else if (!video.paused) {
        video.pause();
      }
    };

    const observer = new MutationObserver(sync);
    if (root) observer.observe(root, { attributes: true, attributeFilter: ['hidden'] });
    if (source) observer.observe(source, { attributes: true, attributeFilter: ['data-object-focus-state', 'class'] });
    const visibility = () => sync();
    document.addEventListener('visibilitychange', visibility);
    video.addEventListener('loadedmetadata', () => setMediaAspect(frame, video));
    videoBindings.set(video, { observer, visibility, sync });
    queueMicrotask(sync);
  };

  const enhanceVideoPreview = frame => {
    const artifactId = frame.dataset.artifactId;
    const artifact = artifactFor(artifactId);
    if (!artifact || !(artifact.type === 'video' || /^video\//i.test(artifact.mediaType || ''))) return false;
    const href = hrefFor(artifactId);
    if (!href) return false;

    let video = frame.querySelector('video[data-artifact-inline-video]');
    if (!video) {
      video = document.createElement('video');
      video.src = href;
      video.controls = true;
      video.autoplay = true;
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.dataset.artifactInlineVideo = 'true';
      video.setAttribute('aria-label', artifact.title || 'Video artifact');

      // Native controls own pointer input. They must not bubble into the card's
      // Object Focus click handler; expansion remains available from the card
      // surface around the player / keyboard focus on the artifact object.
      ['pointerdown', 'click', 'dblclick'].forEach(type => {
        video.addEventListener(type, event => event.stopPropagation());
      });
      frame.replaceChildren(video);
    }
    frame.classList.add('is-video', 'is-inline-interactive');
    bindInlineVideoLifecycle(video, frame);
    return true;
  };

  const enhancePdfPreview = frame => {
    const artifactId = frame.dataset.artifactId;
    const artifact = artifactFor(artifactId);
    if (!artifact || artifact.mediaType !== 'application/pdf') return false;
    const iframe = frame.querySelector('iframe');
    if (!iframe) return false;
    frame.classList.add('is-inline-interactive');
    iframe.tabIndex = 0;
    iframe.removeAttribute('aria-hidden');
    iframe.dataset.artifactInlinePdf = 'true';
    return true;
  };

  const enhancePreview = frame => enhanceVideoPreview(frame) || enhancePdfPreview(frame);

  const scanPreviews = root => {
    const scope = root || document;
    scope.querySelectorAll?.('.artifact-media-preview[data-artifact-id]').forEach(enhancePreview);
  };

  const syncFocusedPresentation = () => {
    const target = viewer();
    if (!target || target.hidden) return false;
    const artifactId = target.dataset.sharedFocusArtifact || null;
    const artifact = artifactFor(artifactId);
    if (!artifact) return false;

    // Fit must be resolved before the controller's requestAnimationFrame reads
    // the target rectangle for shared-element flight.
    window.ProfileObjectFocusFit?.syncNow?.();

    const footer = target.querySelector('.artifact-focus-footer');
    if (footer) {
      let caption = footer.querySelector('.artifact-focus-description');
      if (!caption) {
        caption = document.createElement('p');
        caption.className = 'artifact-focus-description';
        footer.prepend(caption);
      }
      caption.textContent = artifact.description || artifact.title || 'Artifact';

      const source = footer.querySelector('a.artifact-action[href]');
      if (source) {
        source.textContent = 'Source ↗';
        source.setAttribute('aria-label', `Open source for ${artifact.title || 'artifact'}`);
      }
    }
    return true;
  };

  const installViewerObserver = () => {
    const target = viewer();
    if (!target || target === installedViewer) return Boolean(target);
    viewerObserver?.disconnect();
    installedViewer = target;
    viewerObserver = new MutationObserver(() => {
      // MutationObserver runs before paint. Resolve sizing and metadata in this
      // microtask rather than another animation frame.
      syncFocusedPresentation();
    });
    viewerObserver.observe(target, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['hidden', 'data-shared-focus-artifact', 'data-shared-focus-phase', 'data-media-kind']
    });
    syncFocusedPresentation();
    return true;
  };

  const installLayerObserver = () => {
    const layer = document.querySelector('.artifact-scene-layer');
    if (!layer || layerObserver) return Boolean(layer);
    layerObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof Element)) return;
          if (node.matches?.('.artifact-media-preview[data-artifact-id]')) enhancePreview(node);
          scanPreviews(node);
        });
      });
      scanPreviews(layer);
      installViewerObserver();
    });
    layerObserver.observe(layer, { childList: true, subtree: true });
    scanPreviews(layer);
    return true;
  };

  const refresh = () => {
    installPdfFocusUrlPolicy();
    installLayerObserver();
    installViewerObserver();
    scanPreviews(document);
    syncFocusedPresentation();
  };

  // WeakMap is intentionally not enumerable; route refresh asks every inline
  // player currently in the DOM to resynchronise its stored lifecycle binding.
  const syncVisibleVideos = () => {
    document.querySelectorAll('video[data-artifact-inline-video]').forEach(video => {
      videoBindings.get(video)?.sync?.();
    });
  };

  addEventListener('profile:artifact-scenes-ready', () => {
    refresh();
    syncVisibleVideos();
  });
  addEventListener('profile:scene-state', () => {
    refresh();
    syncVisibleVideos();
  });
  addEventListener('hashchange', () => requestAnimationFrame(syncVisibleVideos));
  reducedMotion.addEventListener?.('change', refresh);

  window.ProfileArtifactViewerV2 = Object.freeze({
    refresh,
    syncFocusedPresentation,
    snapshot: () => ({
      viewerReady: Boolean(viewer()),
      focusedArtifactId: viewer()?.dataset.sharedFocusArtifact || null,
      inlineVideos: document.querySelectorAll('video[data-artifact-inline-video]').length,
      inlinePdfs: document.querySelectorAll('iframe[data-artifact-inline-pdf]').length
    })
  });

  refresh();
})();
