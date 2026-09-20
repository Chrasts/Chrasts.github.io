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

  const cvText = await page.locator('#cv-content').innerText();
  expect(cvText).not.toMatch(/\bProfessional\b/);
  expect(cvText).not.toMatch(/\bPersonal\b/);
  expect(cvText).not.toContain('Research Practice');
  expect(cvText).not.toContain('Sponsorship');
  expect(cvText).not.toContain('vignette-oriented');
  expect(cvText).not.toContain(';');
  expect(cvText).not.toContain('—');
  expect(cvText).toContain('analysis of vignette responses');
  expect(cvText).toContain('visualisation');
  expect(cvText).toContain('interpretation of results');
  expect(cvText).toContain('Event coordination and logistics');

  const nameSize = await page.getByRole('heading', { level: 1, name: 'Štěpán Chrast' })
    .evaluate(element => parseFloat(getComputedStyle(element).fontSize));
  expect(nameSize).toBeLessThanOrEqual(42);

  const positioningColor = await page.locator('.cv-positioning').evaluate(element => getComputedStyle(element).color);
  const linkColor = await page.locator('.cv-contact a').first().evaluate(element => getComputedStyle(element).color);
  expect(positioningColor).not.toBe(linkColor);

  await expect(page.getByRole('button', { name: 'Print / Save PDF' })).toBeVisible();
});
