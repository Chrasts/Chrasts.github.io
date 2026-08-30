const { test, expect } = require('@playwright/test');

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

test('Work uses one canonical controller without the retired hidden renderer', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#work');
  await page.waitForFunction(() => Boolean(
    window.ProfileWorkController &&
    document.body.dataset.graphMode === 'work' &&
    document.querySelectorAll('.work-project-anchor-v5[data-project-id]').length
  ));

  await expect(page.locator('#work')).toHaveCount(0);
  await expect(page.locator('#work-lattice')).toHaveCount(0);
  await expect(page.locator('.integrated-work-controls')).toHaveCount(1);

  const initial = await page.evaluate(() => window.ProfileWorkController.snapshot());
  expect(initial.projectCount).toBe(10);
  expect(initial.visibleProjectCount).toBe(initial.projectCount);
  expect(initial.conceptCount).toBeGreaterThan(1);

  const themeId = await page.evaluate(() => {
    const projects = window.SITE_DATA.work.projects;
    return window.SITE_DATA.work.attributes
      .map(attribute => ({
        id: attribute.id,
        count: projects.filter(project => project.lattice.includes(attribute.id)).length
      }))
      .filter(item => item.count > 0 && item.count < projects.length)
      .sort((a, b) => a.count - b.count)[0].id;
  });
  await page.evaluate(id => window.ProfileWorkController.setThemes([id], 'any'), themeId);
  await page.waitForFunction(() => window.ProfileWorkController.snapshot().visibleProjectCount < window.ProfileWorkController.snapshot().projectCount);
  await page.waitForFunction(() => document.querySelectorAll('.work-project-anchor-v5.is-filtered-out').length > 0);

  const filtered = await page.evaluate(() => window.ProfileWorkController.snapshot());
  expect(filtered.selectedThemes).toEqual([themeId]);
  expect(await page.locator('.work-project-anchor-v5.is-filtered-out').count()).toBeGreaterThan(0);

  await page.evaluate(() => window.ProfileWorkController.reset());
  await page.waitForFunction(() => window.ProfileWorkController.snapshot().visibleProjectCount === window.ProfileWorkController.snapshot().projectCount);
  await page.waitForFunction(() => document.querySelectorAll('.work-project-anchor-v5.is-filtered-out').length === 0);
  expect((await page.evaluate(() => window.ProfileWorkController.snapshot())).selectedThemes).toEqual([]);
});
