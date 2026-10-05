const { test, expect } = require('@playwright/test');

const firstLevelIds = ['work', 'knowledge', 'experience', 'education', 'about'];

const boot = async (page, route = 'overview') => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', response => response.abort());
  await page.goto(`/#${route}`);
  await page.waitForFunction(() => Boolean(window.ProfileScene?.manager));
  await page.waitForFunction(() => Boolean(window.ProfileRootLanding && window.ProfileHomeOverviewV4));
  await page.waitForFunction(() => Boolean(document.body.dataset.graphMode));
  await page.waitForFunction(() => Boolean(document.querySelector('#site-graph .site-graph-svg')));
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
};

test.describe('V4 legacy root-landing retirement compatibility', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('same-session Overview opens the professional Home directly', async ({ page }) => {
    await boot(page);

    expect(await page.evaluate(() => window.ProfileRootLanding.isActive())).toBe(false);
    expect(await page.evaluate(() => window.ProfileRootLanding.hasActivated())).toBe(true);
    expect(await page.evaluate(() => window.ProfileScene.manager.graphState.rootLanding)).toBe(false);
    expect(await page.evaluate(() => window.ProfileHomeOverviewV4.snapshot().active)).toBe(true);

    await expect(page.locator('body')).toHaveAttribute('data-root-landing', 'false');
    await expect(page.locator('.hero')).toBeHidden();
    await expect(page.locator('.profile-root-brief')).toBeHidden();
    await expect(page.locator('.home-v4-shell')).toBeVisible();
    await expect(page.locator('#site-explorer')).toBeVisible();
    await expect(page.locator('#main-nav')).toBeVisible();

    for (const id of firstLevelIds) {
      await expect(page.locator(`#site-graph .site-graph-node[data-node-id="${id}"]`)).toBeVisible();
    }
  });

  test('commitExpanded remains an idempotent compatibility primitive', async ({ page }) => {
    await boot(page);
    const result = await page.evaluate(() => {
      const first = window.ProfileRootLanding.commitExpanded({ focusGraph: false, animate: false, reason: 'v4-test' });
      const second = window.ProfileRootLanding.commitExpanded({ focusGraph: false, animate: false, reason: 'v4-test-repeat' });
      return {
        first,
        second,
        active: window.ProfileRootLanding.isActive(),
        activated: window.ProfileRootLanding.hasActivated(),
        rootLanding: document.body.dataset.rootLanding,
        route: document.body.dataset.graphRoute
      };
    });

    expect(result.first).toBe(true);
    expect(result.second).toBe(true);
    expect(result.active).toBe(false);
    expect(result.activated).toBe(true);
    expect(result.rootLanding).toBe('false');
    expect(result.route).toBe('overview');
  });

  test('returning to Home after normal navigation restores V4 Home, not the retired brief or hero', async ({ page }) => {
    await boot(page);
    await page.locator('#main-nav [data-route="knowledge"]').click({ force: true });
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge');
    await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));

    await page.locator('#main-nav [data-route="overview"]').click({ force: true });
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'overview');
    await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));

    expect(await page.evaluate(() => window.ProfileRootLanding.isActive())).toBe(false);
    expect(await page.evaluate(() => window.ProfileHomeOverviewV4.snapshot().active)).toBe(true);
    await expect(page.locator('.home-v4-shell')).toBeVisible();
    await expect(page.locator('.hero')).toBeHidden();
    await expect(page.locator('.profile-root-brief')).toBeHidden();
  });

  test('deep links bypass Home presentation and retain the requested focused route', async ({ page }) => {
    await boot(page, 'knowledge');

    expect(await page.evaluate(() => window.ProfileRootLanding.isActive())).toBe(false);
    expect(await page.evaluate(() => window.ProfileHomeOverviewV4.snapshot().active)).toBe(false);
    await expect(page.locator('body')).toHaveAttribute('data-root-landing', 'false');
    await expect(page.locator('#site-explorer')).toBeVisible();
    await expect(page.locator('.home-v4-shell')).toBeHidden();
    await expect(page.locator('.hero')).toBeHidden();
    expect(await page.evaluate(() => document.body.dataset.graphMode)).toBe('focus');
    expect(await page.evaluate(() => document.body.dataset.graphRoute)).toBe('knowledge');
  });
});
