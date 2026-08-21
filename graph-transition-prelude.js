(() => {
  const realMatchMedia = window.matchMedia.bind(window);
  const realReduced = realMatchMedia('(prefers-reduced-motion: reduce)');

  const proxyReduced = {
    get matches() {
      return Boolean(window.__GRAPH_V6_FORCE_SNAP__) || realReduced.matches;
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
    window.matchMedia = realMatchMedia;
  };
  window.matchMedia = query =>
    query === '(prefers-reduced-motion: reduce)'
      ? proxyReduced
      : realMatchMedia(query);
})();
