(() => {
  const menuButton = document.querySelector('.menu-button');
  const navigation = document.querySelector('#main-nav');
  const themeButton = document.querySelector('.theme-toggle');
  const themeIcon = themeButton?.querySelector('span');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const locationLabel = document.querySelector('.header-location-label');
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let themeTransitionTimer = 0;
  const savedTheme = () => {
    try { return localStorage.getItem('theme'); } catch (_) { return null; }
  };
  const currentTheme = () => document.documentElement.dataset.theme || 'light';
  const header = document.querySelector('.app-header');
  const headerGraph = header?.querySelector('.header-linear-graph');
  const headerGraphLine = headerGraph?.querySelector('.header-linear-graph-line');
  const headerAtlasLink = headerGraph?.querySelector('.header-linear-graph-atlas-link');
  const headerGraphNodes = headerGraph?.querySelector('.header-linear-graph-nodes');
  let headerGraphFrame = 0;

  const headerGraphItems = () => {
    if (!header) return [];
    const quick = header.querySelector('.header-quick-overview');
    const navItems = [...header.querySelectorAll('#main-nav > a[data-route]')];
    const practical = [...header.querySelectorAll('.header-practical-actions .graph-control')]
      .filter(item => !item.hidden && getComputedStyle(item).display !== 'none');
    const leading = quick && !quick.hidden && getComputedStyle(quick).display !== 'none' ? [quick] : [];
    return [...leading, ...navItems, ...practical];
  };

  const headerGraphKey = (element, index) => {
    if (element.dataset.route) return `route-${element.dataset.route}`;
    if (element.classList.contains('header-quick-overview')) return 'profile-brief';
    if (element.matches('a[href="/cv/"]')) return 'cv';
    if (element.matches('a[href^="mailto:"]')) return 'email';
    if (element.href?.includes('github.com')) return 'github';
    if (element.href?.includes('linkedin.com')) return 'linkedin';
    return `header-item-${index}`;
  };

  const syncHeaderGraphStates = () => {
    if (!headerGraphNodes) return;
    headerGraphItems().forEach((item, index) => {
      const key = headerGraphKey(item, index);
      item.dataset.headerGraphKey = key;
      const node = headerGraphNodes.querySelector(`[data-header-graph-key="${key}"]`);
      node?.classList.toggle(
        'is-current',
        item.getAttribute('aria-current') === 'page' || item.getAttribute('aria-expanded') === 'true'
      );
    });
  };

  const drawHeaderGraph = () => {
    headerGraphFrame = 0;
    if (!header || !headerGraph || !headerGraphLine || !headerGraphNodes || !themeButton) return;
    if (innerWidth <= 900) {
      headerGraph.setAttribute('viewBox', '0 0 1 1');
      headerGraphLine.setAttribute('d', '');
      headerAtlasLink?.setAttribute('d', '');
      headerGraphNodes.replaceChildren();
      return;
    }

    const headerBox = header.getBoundingClientRect();
    if (!headerBox.width || !headerBox.height) return;

    const items = headerGraphItems();
    const yPattern = [45, 50, 46, 52, 44, 49, 53, 47, 51, 45, 50];
    const xPattern = [.34, .63, .43, .67, .37, .58, .46, .64, .35, .61, .42];
    const points = [];

    headerGraph.setAttribute('viewBox', `0 0 ${headerBox.width} ${headerBox.height}`);
    headerGraph.setAttribute('preserveAspectRatio', 'none');
    headerGraphNodes.replaceChildren();

    items.forEach((item, index) => {
      const box = item.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const key = headerGraphKey(item, index);
      item.dataset.headerGraphKey = key;
      const x = Math.max(4, Math.min(
        headerBox.width - 4,
        box.left - headerBox.left + box.width * xPattern[index % xPattern.length]
      ));
      const y = Math.min(headerBox.height - 5, yPattern[index % yPattern.length]);
      points.push({ x, y, key });

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x.toFixed(2));
      circle.setAttribute('cy', y.toFixed(2));
      circle.setAttribute('r', '3.15');
      circle.dataset.headerGraphKey = key;
      headerGraphNodes.append(circle);
    });

    const themeBox = themeButton.getBoundingClientRect();
    const themePoint = {
      x: Math.max(4, themeBox.left - headerBox.left + 1),
      y: themeBox.top - headerBox.top + themeBox.height / 2
    };

    const pathPoints = [...points, themePoint];
    headerGraphLine.setAttribute(
      'd',
      pathPoints.length
        ? pathPoints.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
        : ''
    );

    const atlasButton = document.querySelector('.graph-routebar .atlas-button');
    const atlasCentralNode = atlasButton?.querySelector('.atlas-entry-glyph-nodes circle:first-child');
    const atlasTargetBox = (atlasCentralNode || atlasButton)?.getBoundingClientRect();
    if (headerAtlasLink && atlasTargetBox?.width && getComputedStyle(atlasButton).display !== 'none') {
      const targetX = atlasTargetBox.left - headerBox.left + atlasTargetBox.width / 2;
      const targetY = atlasTargetBox.top - headerBox.top + atlasTargetBox.height / 2;
      const kneeY = headerBox.height + 9;
      const kneeX = Math.min(targetX - 10, themePoint.x + Math.max(12, (targetX - themePoint.x) * .38));
      headerAtlasLink.setAttribute(
        'd',
        `M ${themePoint.x.toFixed(2)} ${themePoint.y.toFixed(2)} L ${(themePoint.x + 8).toFixed(2)} ${kneeY.toFixed(2)} L ${kneeX.toFixed(2)} ${(kneeY + 4).toFixed(2)} L ${targetX.toFixed(2)} ${targetY.toFixed(2)}`
      );
    } else {
      headerAtlasLink?.setAttribute('d', '');
    }

    syncHeaderGraphStates();
  };

  const scheduleHeaderGraph = () => {
    cancelAnimationFrame(headerGraphFrame);
    headerGraphFrame = requestAnimationFrame(drawHeaderGraph);
  };

  const setHeaderGraphHot = (element, hot) => {
    const key = element?.dataset?.headerGraphKey;
    if (!key || !headerGraphNodes) return;
    headerGraphNodes
      .querySelector(`[data-header-graph-key="${key}"]`)
      ?.classList.toggle('is-hot', hot);
  };

  header?.addEventListener('pointerover', event => {
    const item = event.target.closest?.('[data-header-graph-key]');
    if (item && header.contains(item)) setHeaderGraphHot(item, true);
  });
  header?.addEventListener('pointerout', event => {
    const item = event.target.closest?.('[data-header-graph-key]');
    if (!item || !header.contains(item)) return;
    if (event.relatedTarget && item.contains(event.relatedTarget)) return;
    setHeaderGraphHot(item, false);
  });
  header?.addEventListener('focusin', event => {
    const item = event.target.closest?.('[data-header-graph-key]');
    if (item && header.contains(item)) setHeaderGraphHot(item, true);
  });
  header?.addEventListener('focusout', event => {
    const item = event.target.closest?.('[data-header-graph-key]');
    if (item && header.contains(item)) setHeaderGraphHot(item, false);
  });

  if (header) {
    const observedHeaderControls = header.querySelector('.header-actions');
    const observer = new MutationObserver(() => {
      syncHeaderGraphStates();
      scheduleHeaderGraph();
    });
    if (observedHeaderControls) {
      observer.observe(observedHeaderControls, {
        subtree: true,
        attributes: true,
        attributeFilter: ['aria-current', 'aria-expanded', 'hidden', 'class']
      });
    }
  }

  const updateThemeControl = () => {
    if (!themeButton || !themeIcon) return;
    const dark = currentTheme() === 'dark';
    const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
    themeButton.setAttribute('aria-label', label);
    themeButton.title = label;
    themeIcon.textContent = dark ? '☀' : '☾';
    themeMeta?.setAttribute('content', dark ? '#11191c' : '#f7f3eb');
  };

  const applyTheme = (theme, { animate = true } = {}) => {
    const root = document.documentElement;
    const shouldAnimate = animate && !reducedMotion.matches;
    clearTimeout(themeTransitionTimer);
    root.classList.remove('is-theme-transitioning');

    if (shouldAnimate) {
      root.classList.add('is-theme-transitioning');
      // Commit the transition rule before changing token-backed colors.
      void root.offsetWidth;
    }

    root.dataset.theme = theme;
    updateThemeControl();
    scheduleHeaderGraph();

    if (shouldAnimate) {
      themeTransitionTimer = window.setTimeout(() => {
        root.classList.remove('is-theme-transitioning');
      }, 300);
    }
  };

  themeButton?.addEventListener('click', () => {
    const theme = currentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    try { localStorage.setItem('theme', theme); } catch (_) {}
  });
  systemTheme.addEventListener('change', event => {
    if (savedTheme()) return;
    applyTheme(event.matches ? 'dark' : 'light');
  });
  updateThemeControl();

  const normaliseRoute = value => (value || 'overview').replace(/^#/, '').replace(/^\/+|\/+$/g, '') || 'overview';
  const contextLabelFor = () => {
    const mode = document.body?.dataset.graphMode || '';
    const route = normaliseRoute(document.body?.dataset.graphRoute || location.hash);
    if (mode === 'atlas' || route === 'atlas') return 'Atlas';
    if (mode === 'overview' || route === 'overview') return 'Profile';
    if (mode === 'work' || route === 'work' || route.startsWith('work/')) return 'Work';
    const branch = route.split('/')[0];
    return ({ knowledge:'Knowledge', experience:'Experience', education:'Education', about:'About' })[branch] || 'Profile';
  };
  const syncHeaderContext = () => {
    if (locationLabel) locationLabel.textContent = contextLabelFor();
  };
  ['profile:graph-state-committed','profile:graph-render-settled','profile:scene-state','profile:transition-finish','profile:transition-cancel','profile:root-landing']
    .forEach(name => addEventListener(name, () => {
      syncHeaderContext();
      scheduleHeaderGraph();
    }));
  addEventListener('hashchange', () => requestAnimationFrame(() => {
    syncHeaderContext();
    scheduleHeaderGraph();
  }));
  addEventListener('resize', scheduleHeaderGraph);
  addEventListener('load', scheduleHeaderGraph, { once: true });
  syncHeaderContext();
  scheduleHeaderGraph();

  const setMenuOpen = open => {
    if (!navigation || !menuButton) return;
    navigation.classList.toggle('open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.textContent = open ? 'Close' : 'Menu';
  };
  menuButton?.addEventListener('click', () => setMenuOpen(!navigation?.classList.contains('open')));
  navigation?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenuOpen(false)));
  document.addEventListener('click', event => {
    if (!navigation?.classList.contains('open')) return;
    if (navigation.contains(event.target) || menuButton?.contains(event.target)) return;
    setMenuOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !navigation?.classList.contains('open')) return;
    setMenuOpen(false);
    menuButton?.focus();
  });

})();
