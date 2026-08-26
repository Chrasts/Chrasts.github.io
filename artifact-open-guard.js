(() => {
  if (window.ProfileArtifactOpenGuard) return;

  const enhancedFrames = new WeakSet();
  let observer = null;

  const installIdempotentOpen = () => {
    const Controller = window.ObjectFocusController;
    const prototype = Controller?.prototype;
    if (!prototype?.open) return false;
    if (prototype.open.__profileArtifactOpenGuard) return true;

    const original = prototype.open;
    const guarded = async function (options = {}) {
      const source = options.source || null;
      const artifactId = options.artifactId || options.artifact?.id || source?.dataset?.artifactId || null;
      const current = this.active || this.pending || null;

      // Double-click emits multiple click/open requests. Reopening the same
      // source while its first shared-element flight is still pending used to
      // interrupt that flight and could leave the viewer half-open. Treat the
      // second request as confirmation of the same operation instead.
      if (current && artifactId && current.artifactId === artifactId && current.source === source) {
        return true;
      }

      return original.call(this, options);
    };
    guarded.__profileArtifactOpenGuard = true;
    prototype.open = guarded;
    return true;
  };

  const openFromFrame = frame => {
    const source = frame.closest('[data-artifact-focus]');
    if (!source) return false;
    source.click?.();
    return true;
  };

  const enhancePdfFrame = frame => {
    if (!frame || enhancedFrames.has(frame) || !frame.classList.contains('is-pdf')) return false;
    const iframe = frame.querySelector('iframe');
    if (!iframe) return false;

    enhancedFrames.add(frame);
    frame.classList.add('has-inline-expand');

    let affordance = frame.querySelector(':scope > .artifact-inline-expand');
    if (!affordance) {
      affordance = document.createElement('span');
      affordance.className = 'artifact-inline-expand';
      affordance.textContent = 'Expand ↗';
      affordance.setAttribute('aria-hidden', 'true');
      affordance.title = 'Expand artifact';
      frame.appendChild(affordance);
    }

    const trigger = event => {
      event.preventDefault();
      event.stopPropagation();
      openFromFrame(frame);
    };
    affordance.addEventListener('click', trigger);
    affordance.addEventListener('dblclick', event => {
      // The first click already opens the artifact. Swallow the synthetic
      // second activation so the parent button cannot begin a second flight.
      event.preventDefault();
      event.stopPropagation();
    });
    return true;
  };

  const scan = root => {
    const scope = root || document;
    if (scope.matches?.('.artifact-media-preview.is-pdf')) enhancePdfFrame(scope);
    scope.querySelectorAll?.('.artifact-media-preview.is-pdf').forEach(enhancePdfFrame);
  };

  const installObserver = () => {
    if (observer) return;
    observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
        if (node instanceof Element) scan(node);
      }));
      installIdempotentOpen();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  const refresh = () => {
    installIdempotentOpen();
    scan(document);
  };

  addEventListener('profile:object-focus-ready', refresh);
  addEventListener('profile:artifact-scenes-ready', refresh);
  addEventListener('profile:scene-state', refresh);
  addEventListener('hashchange', () => requestAnimationFrame(refresh));

  window.ProfileArtifactOpenGuard = Object.freeze({
    refresh,
    snapshot: () => ({
      installed: Boolean(window.ObjectFocusController?.prototype?.open?.__profileArtifactOpenGuard),
      pdfExpandControls: document.querySelectorAll('.artifact-inline-expand').length
    })
  });

  installObserver();
  refresh();
})();
