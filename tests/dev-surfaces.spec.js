const { test, expect } = require('@playwright/test');

test.describe('V3.1 development experiment surfaces', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('interaction lab exposes the six roadmap experiment surfaces', async ({ page }) => {
    await page.goto('/dev/#halos');

    await expect(page.getByRole('heading', { name: 'Interaction Lab' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Halo renderer' })).toBeVisible();

    const surfaces = ['Halos', 'Node dynamics', 'Camera', 'Intro', 'Scene gallery', 'Transitions'];
    for (const surface of surfaces) {
      await expect(page.getByRole('link', { name: surface, exact: true })).toBeVisible();
    }

    await page.getByRole('link', { name: 'Node dynamics', exact: true }).click();
    await expect(page).toHaveURL(/\/dev\/#node-dynamics$/);
    await expect(page.getByRole('heading', { name: 'Soft node dynamics' })).toBeVisible();

    await page.getByRole('link', { name: 'Camera', exact: true }).click();
    await expect(page).toHaveURL(/\/dev\/#camera$/);
    await expect(page.getByRole('heading', { name: 'Camera + 2.5D' })).toBeVisible();
  });
});
