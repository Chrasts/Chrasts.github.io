(() => {
  const realMatchMedia = window.matchMedia.bind(window);
  const realReduced = realMatchMedia('(prefers-reduced-motion: reduce)');

  let forceSnap = false;
  Object.defineProperty(window, '__GRAPH_V6_FORCE_SNAP__', {
    configurable: true,
    get: () => forceSnap,
    set: value => {
      forceSnap = Boolean(value);
      if (!forceSnap) return;
      // Keep the built-in renderer in reduced-motion/snap mode long enough to
      // finish its DOM diff, then release the flag before V6's own animation.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        forceSnap = false;
      }));
    }
  });

  const proxyReduced = {
    get matches() {
      return forceSnap || realReduced.matches;
    },
    media: realReduced.media,
    onchange: null,
    addListener: (...args) => realReduced.addListener?.(...args),
    removeListener: (...args) => realReduced.removeListener?.(...args),
    addEventListener: (...args) => realReduced.addEventListener?.(...args),
    removeEventListener: (...args) => realReduced.removeEventListener?.(...args),
    dispatchEvent: (...args) => realReduced.dispatchEvent?.(...args)
  };

  window.__GRAPH_V6_REAL_MATCH_MEDIA__ = realMatchMedia;
  window.__GRAPH_V6_RESTORE_MATCH_MEDIA__ = () => {
    // site-graph.js boots from a zero-delay timer. Queue restoration after that
    // timer so its stored media-query object remains the dynamic proxy.
    setTimeout(() => {
      window.matchMedia = realMatchMedia;
    }, 0);
  };
  window.matchMedia = query =>
    query === '(prefers-reduced-motion: reduce)'
      ? proxyReduced
      : realMatchMedia(query);
})();
