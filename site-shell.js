(() => {
  const menuButton = document.querySelector('.menu-button');
  const navigation = document.querySelector('#main-nav');
  const themeButton = document.querySelector('.theme-toggle');
  const themeIcon = themeButton?.querySelector('span');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
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

  themeButton?.addEventListener('click', () => {
    const theme = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('theme', theme); } catch (_) {}
    updateThemeControl();
  });
  systemTheme.addEventListener('change', event => {
    if (savedTheme()) return;
    document.documentElement.dataset.theme = event.matches ? 'dark' : 'light';
    updateThemeControl();
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

  const year = document.querySelector('#year');
  if (year) year.textContent = new Date().getFullYear();
  const copyEmailButton = document.querySelector('.copy-email');
  copyEmailButton?.addEventListener('click', async () => {
    const email = copyEmailButton.dataset.email;
    try {
      await navigator.clipboard.writeText(email);
    } catch (_) {
      const input = document.createElement('textarea');
      input.value = email;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    copyEmailButton.textContent = 'Copied';
    setTimeout(() => { copyEmailButton.textContent = 'Copy'; }, 1600);
  });
})();
