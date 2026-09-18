(() => {
  const menuButton = document.querySelector('.menu-button');
  const navigation = document.querySelector('#main-nav');
  const themeButton = document.querySelector('.theme-toggle');
  const themeIcon = themeButton?.querySelector('span');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let themeTransitionTimer = 0;
  const savedTheme = () => {
    try { return localStorage.getItem('theme'); } catch (_) { return null; }
  };
  const currentTheme = () => document.documentElement.dataset.theme || 'light';
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
