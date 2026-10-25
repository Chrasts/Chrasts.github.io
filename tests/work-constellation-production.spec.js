const { test, expect } = require('@playwright/test');

test.describe('Production Work — project-first constellation', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Work defaults to ten canonical project nodes with shared-theme edges', async ({ page }) => {
    await page.goto('/#work');
    await page.waitForFunction(() => document.body.dataset.graphMode === 'work');
    await page.waitForFunction(() => window.ProfileWorkController?.snapshot?.().view === 'constellation');
    await expect(page.locator('#site-graph .site-graph-node.is-work-constellation-project')).toHaveCount(10);
    await expect(page.locator('#site-graph .site-graph-edges path.is-work-related')).toHaveCount(13);
    await expect(page.locator('.integrated-work-rail .work-view-button[data-view="constellation"]'))
      .toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#site-graph .site-graph-node.is-work-concept')).toHaveCount(0);
  });

  test('project selection opens the existing canonical Work inspector', async ({ page }) => {
    await page.goto('/#work');
    await page.waitForFunction(() => document.body.dataset.graphMode === 'work');
    const node = page.locator('#site-graph .site-graph-node[data-node-id="project-modal-logic-lab"]');
    await node.click();
    await page.waitForFunction(() => location.hash === '#work/project/modal-logic-lab');
    await expect(page.locator('#site-detail-panel')).not.toBeHidden();
    await expect(page.locator('#site-detail-panel h2')).toContainText('Modal Logic Lab');
    await expect(node).toHaveClass(/is-selected/);
  });

  test('switches to the FCA lattice and back without losing filter semantics', async ({ page }) => {
    await page.goto('/#work');
    await page.waitForFunction(() => document.body.dataset.graphMode === 'work');
    const research = page.locator('#work-theme-filters input[data-theme-id="research"]');
    const logic = page.locator('#work-theme-filters input[data-theme-id="logic"]');
    await research.check();
    await logic.check();
    await expect.poll(() => page.evaluate(() => window.ProfileWorkController.snapshot().visibleProjectCount))
      .toBe(8); // default Any semantics
    await page.locator('.work-view-button[data-view="lattice"]').click();
    await page.waitForFunction(() => document.body.dataset.workView === 'lattice');
    await page.waitForFunction(() => location.hash === '#work/lattice');
    await expect(page.locator('#site-graph .site-graph-node.is-work-concept')).toHaveCount(11);
    await expect(page.locator('#site-graph .site-graph-edges path.is-work-lattice')).not.toHaveCount(0);
    await expect(research).toBeChecked();
    await expect(logic).toBeChecked();
    await page.locator('.work-view-button[data-view="constellation"]').click();
    await page.waitForFunction(() => document.body.dataset.workView === 'constellation');
    await page.waitForFunction(() => location.hash === '#work');
    await expect(page.locator('#site-graph .site-graph-node.is-work-constellation-project')).toHaveCount(10);
    await expect(research).toBeChecked();
    await expect(logic).toBeChecked();
  });

  test('honors reduced motion and keeps all other sections accessible', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#work');
    await page.waitForFunction(() => document.body.dataset.graphMode === 'work');
    const orbit = page.locator('#site-graph .work-project-orbit').first();
    await expect(orbit).toBeVisible();
    const animation = await orbit.evaluate(el => getComputedStyle(el).animationName);
    expect(animation).toBe('none');
    await page.evaluate(() => { location.hash = '#education'; });
    await page.waitForFunction(() => document.body.dataset.graphMode === 'focus');
    await expect(page.locator('#site-graph .site-graph-node[data-node-id="education"]')).toBeVisible();
  });
});
