const menuButton = document.querySelector('.menu-button');
const navigation = document.querySelector('#main-nav');
const themeButton = document.querySelector('.theme-toggle');
const themeIcon = themeButton.querySelector('span');
const themeMeta = document.querySelector('meta[name="theme-color"]');
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
const savedTheme = () => {
  try { return localStorage.getItem('theme'); } catch (_) { return null; }
};

const currentTheme = () => document.documentElement.dataset.theme || 'light';

const updateThemeControl = () => {
  const dark = currentTheme() === 'dark';
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  themeButton.setAttribute('aria-label', label);
  themeButton.title = label;
  themeIcon.textContent = dark ? '☀' : '☾';
  themeMeta.setAttribute('content', dark ? '#11191c' : '#f7f3eb');
};

themeButton.addEventListener('click', () => {
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

menuButton.addEventListener('click', () => {
  const open = navigation.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
});

navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  navigation.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
}));

document.querySelector('#year').textContent = new Date().getFullYear();
