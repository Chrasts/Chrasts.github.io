const { test, expect } = require('@playwright/test');

test.describe('Work Layout Lab — A / Free Constellation', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('renders the canonical project model and preserves portfolio navigation', async ({ page }) => {
    await page.goto('/dev/work-layout-lab.html');
    await expect(page.locator('#project-layer .project-node')).toHaveCount(10);
    await expect(page.locator('#relation-layer .relation')).toHaveCount(13);
    await expect(page.locator('#lab-status')).toContainText('10 / 10 projects');

    const model = await page.locator('#project-layer .project-node').evaluateAll(nodes =>
      nodes.map(node => node.dataset.project)
    );
    expect(model).toContain('modal-logic-lab');
    expect(model).toContain('tachov-workshop');

    await page.locator('.project-node[data-project="modal-logic-lab"]').click();
    await expect(page.locator('#project-detail h2')).toHaveText('Modal Logic Lab');
    await expect(page.locator('#project-detail a[href="../#work/project/modal-logic-lab"]')).toBeVisible();
  });

  test('filters projects by All and Any themes', async ({ page }) => {
    await page.goto('/dev/work-layout-lab.html');
    await page.locator('button[data-theme="research"]').click();
    await expect(page.locator('#lab-status')).toContainText('6 / 10 projects');

    await page.locator('button[data-theme="logic"]').click();
    await expect(page.locator('#lab-status')).toContainText('3 / 10 projects');

    await page.locator('#match-mode').click();
    await expect(page.locator('#lab-status')).toContainText('8 / 10 projects');

    await page.locator('#show-all').click();
    await expect(page.locator('#lab-status')).toContainText('10 / 10 projects');
  });

  test('supports keyboard focus and reduced-motion preference', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/dev/work-layout-lab.html');
    await expect(page.locator('body')).toHaveClass(/motion-off/);
    await page.locator('.project-node[data-project="insolvency"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#project-detail h2')).toHaveText('Insolvency Analysis');
    await page.locator('#motion-toggle').click();
    await expect(page.locator('body')).not.toHaveClass(/motion-off/);
  });
});
