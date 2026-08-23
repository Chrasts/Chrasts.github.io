(() => {
  if (window.ProfileObjectFocusFit) return;

  const mobile = matchMedia('(max-width: 900px)');
  let viewer = null;
  let observer = null;
  let frame = 0;

  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = 0;
      sync();
    });
  };

  const sourceAspect = artifactId => {
    if (!artifactId) return null;
    const source = document.querySelector(`[data-artifact-focus="${CSS.escape(artifactId)}"]`);
    const preview = source?.querySelector?.('[data-media-aspect]') || source?.closest?.('[data-media-aspect]');
    const ratio = Number(preview?.dataset.mediaAspect);
    return Number.isFinite(ratio) && ratio > .2 && ratio < 6 ? ratio : null;
  };

  const fitBox = (surface, ratio, { horizontal = .88, vertical = .82 } = {}) => {
    if (!surface || !ratio) return null;
    const availableWidth = Math.max(1, surface.clientWidth * horizontal);
    const availableHeight = Math.max(1, surface.clientHeight * vertical);
    let width = availableWidth;
    let height = width / ratio;
    if (height > availableHeight) {
      height = availableHeight;
      width = height * ratio;
    }
    return { width: Math.max(1, width), height: Math.max(1, height) };
  };

  const fitImage = (surface, image) => {
    const apply = () => {
      const naturalWidth = image.naturalWidth || 0;
      const naturalHeight = image.naturalHeight || 0;
      if (!naturalWidth || !naturalHeight) return;
      const box = fitBox(surface, naturalWidth / naturalHeight, mobile.matches
        ? { horizontal: .94, vertical: .88 }
        : { horizontal: .88, vertical: .82 });
      if (!box) return;
      image.style.setProperty('width', `${box.width.toFixed(1)}px`, 'important');
      image.style.setProperty('height', `${box.height.toFixed(1)}px`, 'important');
      image.style.setProperty('max-width', 'none', 'important');
      image.style.setProperty('max-height', 'none', 'important');
      image.dataset.objectFocusFit = 'contain';
    };
    if (image.complete && image.naturalWidth) apply();
    else image.addEventListener('load', apply, { once: true });
  };

  const fitPdf = (surface, iframe, artifactId) => {
    const current = iframe.getAttribute('src') || '';
    const base = current.split('#')[0];
    const desired = `${base}#toolbar=1&navpanes=0&scrollbar=0&view=Fit`;
    if (current !== desired) iframe.setAttribute('src', desired);

    const ratio = sourceAspect(artifactId) || .7071;
    const box = fitBox(surface, ratio, mobile.matches
      ? { horizontal: .94, vertical: .88 }
      : { horizontal: .82, vertical: .84 });
    if (!box) return;
    iframe.style.setProperty('width', `${box.width.toFixed(1)}px`, 'important');
    iframe.style.setProperty('height', `${box.height.toFixed(1)}px`, 'important');
    iframe.style.setProperty('max-width', 'none', 'important');
    iframe.style.setProperty('max-height', 'none', 'important');
    iframe.dataset.objectFocusFit = 'contain';
  };

  function sync() {
    const nextViewer = window.ProfileArtifactScenes?.viewer || document.querySelector('.artifact-focus-viewer');
    if (!nextViewer) return false;
    if (viewer !== nextViewer) {
      observer?.disconnect();
      viewer = nextViewer;
      observer = new MutationObserver(schedule);
      observer.observe(viewer, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['hidden', 'data-media-kind', 'data-shared-focus-artifact', 'data-shared-focus-phase']
      });
    }
    if (viewer.hidden) return true;

    const surface = viewer.querySelector('.artifact-focus-media');
    const primary = surface?.querySelector('.object-focus-primary') || surface?.firstElementChild;
    if (!surface || !primary) return true;
    const artifactId = viewer.dataset.sharedFocusArtifact || null;
    const kind = viewer.dataset.mediaKind || surface.dataset.mediaKind || '';
    if (kind === 'image' && primary instanceof HTMLImageElement) fitImage(surface, primary);
    else if (kind === 'pdf' && primary instanceof HTMLIFrameElement) fitPdf(surface, primary, artifactId);
    return true;
  }

  window.addEventListener('profile:artifact-scenes-ready', schedule);
  window.addEventListener('profile:object-focus-ready', schedule);
  window.addEventListener('resize', schedule);
  mobile.addEventListener?.('change', schedule);

  window.ProfileObjectFocusFit = Object.freeze({
    refresh: schedule,
    snapshot: () => ({
      active: Boolean(viewer && !viewer.hidden),
      artifactId: viewer?.dataset.sharedFocusArtifact || null,
      kind: viewer?.dataset.mediaKind || null,
      fit: viewer?.querySelector('.object-focus-primary')?.dataset.objectFocusFit || null
    })
  });
  schedule();
})();
