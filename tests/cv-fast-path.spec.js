const { test, expect } = require('@playwright/test');

test('conventional CV fast path renders from canonical portfolio data', async ({ page }) => {
  await page.goto('/cv/');
  await expect(page.getByRole('heading', { level: 1, name: 'Štěpán Chrast' })).toBeVisible();
  await expect(page.getByText('Data analysis · Research · Mathematical logic')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Selected Projects' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Insolvency Analysis' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Survey Analysis and Open-Text Coding' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Modal Logic Lab' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Play' })).toHaveAttribute('href', 'https://chrasts.github.io/Modal_Logic_Lab/');
  await expect(page.getByRole('heading', { name: 'Bachelor Thesis - Quantum Logic & A-ROL' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Algebraic Logic SQL Schema' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Print / Save PDF' })).toBeVisible();
});
