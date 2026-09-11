(() => {
  if (window.ProfileContentCopyPolicy) return;

  const COPY_ATTRIBUTES = ['aria-label', 'title', 'alt', 'placeholder'];
  const COPY_KEYS_TO_SKIP = new Set(['id', 'route', 'href', 'url', 'path']);
  const copyText = value => String(value)
    .replace(/\s*—\s*/g, ' - ')
    .replace(/;\s*/g, ', ');

  const normaliseModelCopy = (value, seen = new WeakSet()) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    Object.entries(value).forEach(([key, child]) => {
      if (typeof child === 'string') {
        if (!COPY_KEYS_TO_SKIP.has(key)) value[key] = copyText(child);
        return;
      }
      normaliseModelCopy(child, seen);
    });
  };

  normaliseModelCopy(window.SITE_DATA);
  normaliseModelCopy(window.PORTFOLIO_DATA);

  if (Array.isArray(window.SITE_DATA?.graph?.edges)) {
    window.SITE_DATA.graph.edges = window.SITE_DATA.graph.edges.filter(edge => {
      const pair = new Set([edge.source, edge.target]);
      return !(pair.has('scientific-writing') && pair.has('clp-historical-survey-coursework'));
    });
  }

  const policyStyle = document.createElement('style');
  policyStyle.dataset.contentCopyPolicy = 'true';
  policyStyle.textContent = `
    .phase8-course-cell{grid-template-columns:minmax(0,1fr)!important}
    .phase8-course-time{display:none!important}
  `;
  document.head.appendChild(policyStyle);

  const shouldSkipTextNode = node => Boolean(
    node.parentElement?.closest?.('script,style,noscript,textarea,code,pre')
  );

  const normaliseTextNode = node => {
    if (shouldSkipTextNode(node)) return;
    const next = copyText(node.nodeValue || '');
    if (next !== node.nodeValue) node.nodeValue = next;
  };

  const normaliseElement = element => {
    if (!(element instanceof Element)) return;
    if (element.matches('.phase8-course-time')) {
      element.remove();
      return;
    }
    element.querySelectorAll?.('.phase8-course-time').forEach(item => item.remove());
    COPY_ATTRIBUTES.forEach(attribute => {
      if (!element.hasAttribute(attribute)) return;
      const current = element.getAttribute(attribute) || '';
      const next = copyText(current);
      if (next !== current) element.setAttribute(attribute, next);
    });
  };

  const normaliseSubtree = root => {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      normaliseTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) normaliseElement(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let current;
    while ((current = walker.nextNode())) {
      if (current.nodeType === Node.TEXT_NODE) normaliseTextNode(current);
      else normaliseElement(current);
    }
  };

  normaliseSubtree(document.body);

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === 'characterData') normaliseTextNode(mutation.target);
      if (mutation.type === 'attributes') normaliseElement(mutation.target);
      mutation.addedNodes?.forEach(normaliseSubtree);
    });
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: COPY_ATTRIBUTES
  });

  window.ProfileContentCopyPolicy = Object.freeze({
    normalise: copyText,
    refresh: () => normaliseSubtree(document.body)
  });
})();
