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
    // site-graph.js boots from a zero-delay timer. Queue the restore after that
    // timer so the graph renderer keeps the dynamic reduced-motion proxy, while
    // later scripts receive the real matchMedia implementation.
    setTimeout(() => {
      window.matchMedia = realMatchMedia;
    }, 0);
  };
  window.matchMedia = query =>
    query === '(prefers-reduced-motion: reduce)'
      ? proxyReduced
      : realMatchMedia(query);
})();
