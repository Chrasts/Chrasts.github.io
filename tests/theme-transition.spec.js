const { test, expect } = require('@playwright/test');

const openThemeFixture = async page => {
  await page.addInitScript(() => localStorage.removeItem('theme'));
  await page.goto('/#overview', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.theme-toggle')).toBeVisible();
};

test('theme toggle uses a short, colour-only transition', async ({ page }) => {
  await openThemeFixture(page);
  const root = page.locator('html');
  const initialTheme = await root.getAttribute('data-theme');

  const duringTransition = await page.evaluate(() => {
    document.querySelector('.theme-toggle').click();
    return {
      transitioning: document.documentElement.classList.contains('is-theme-transitioning'),
      theme: document.documentElement.dataset.theme,
      transition: getComputedStyle(document.body).transitionProperty
    };
  });
  expect(duringTransition.transitioning).toBe(true);
  expect(duringTransition.transition).toContain('background-color');
  await expect(root).not.toHaveAttribute('data-theme', initialTheme);

  await page.waitForTimeout(340);
  await expect(root).not.toHaveClass(/is-theme-transitioning/);
});

test('theme toggle respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openThemeFixture(page);
  await page.locator('.theme-toggle').click();
  await expect(page.locator('html')).not.toHaveClass(/is-theme-transitioning/);
});
