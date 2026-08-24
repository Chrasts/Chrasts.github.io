const { test, expect } = require('@playwright/test');

const firstLevelIds = ['work', 'knowledge', 'experience', 'education', 'about'];

const boot = async (page, route = 'overview') => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', response => response.abort());
  await page.goto(`/#${route}`);
  await page.waitForFunction(() => Boolean(window.ProfileScene?.manager));
  await page.waitForFunction(() => Boolean(window.ProfileRootLanding && window.ProfileRootOverview));
  await page.waitForFunction(() => Boolean(document.body.dataset.graphMode));
  await page.waitForFunction(() => Boolean(document.querySelector('#site-graph .site-graph-svg')));
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
};

test.describe('Phase H legacy root-landing retirement — desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('same-session Overview starts directly in the expanded practical profile root', async ({ page }) => {
    await boot(page);
    await page.waitForFunction(() => window.ProfileRootOverview.snapshot().visible === true);

    expect(await page.evaluate(() => window.ProfileRootLanding.isActive())).toBe(false);
    expect(await page.evaluate(() => window.ProfileRootLanding.hasActivated())).toBe(true);
    expect(await page.evaluate(() => window.ProfileScene.manager.graphState.rootLanding)).toBe(false);
    await expect(page.locator('body')).toHaveAttribute('data-root-landing', 'false');
    await expect(page.locator('.hero')).toBeHidden();
    await expect(page.locator('#site-explorer')).toBeVisible();
    await expect(page.locator('#main-nav')).toBeVisible();
    await expect(page.locator('.header-utility').first()).toBeVisible();
    await expect(page.locator('.profile-root-brief')).toBeVisible();

    for (const id of firstLevelIds) {
      await expect(page.locator(`#site-graph .site-graph-node[data-node-id="${id}"]`)).toBeVisible();
    }
  });

  test('commitExpanded remains an idempotent compatibility primitive', async ({ page }) => {
    await boot(page);
    const result = await page.evaluate(() => {
      const first = window.ProfileRootLanding.commitExpanded({ focusGraph: false, animate: false, reason: 'phase-h-test' });
      const second = window.ProfileRootLanding.commitExpanded({ focusGraph: false, animate: false, reason: 'phase-h-test-repeat' });
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

  test('returning to Overview after normal navigation never resurrects the standalone hero', async ({ page }) => {
    await boot(page);
    await page.locator('#main-nav [data-route="knowledge"]').click({ force: true });
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge');
    await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));

    await page.locator('#main-nav [data-route="overview"]').click({ force: true });
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'overview');
    await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));

    expect(await page.evaluate(() => window.ProfileRootLanding.isActive())).toBe(false);
    expect(await page.evaluate(() => window.ProfileRootLanding.hasActivated())).toBe(true);
    await expect(page.locator('#site-explorer')).toBeVisible();
    await expect(page.locator('.hero')).toBeHidden();
    await expect(page.locator('.profile-root-brief')).toBeVisible();
  });

  test('deep links continue to bypass all root-landing presentation', async ({ page }) => {
    await boot(page, 'knowledge');

    expect(await page.evaluate(() => window.ProfileRootLanding.isActive())).toBe(false);
    await expect(page.locator('body')).toHaveAttribute('data-root-landing', 'false');
    await expect(page.locator('#site-explorer')).toBeVisible();
    await expect(page.locator('#main-nav')).toBeVisible();
    await expect(page.locator('.hero')).toBeHidden();
    expect(await page.evaluate(() => document.body.dataset.graphMode)).toBe('focus');
    expect(await page.evaluate(() => document.body.dataset.graphRoute)).toBe('knowledge');
    await expect(page.locator('.quick-overview-global-trigger')).toBeVisible();
  });
});

test.describe('Phase H legacy root-landing retirement — mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('same-session mobile opens the practical graph root rather than the old portrait hero', async ({ page }) => {
    await boot(page);
    await page.waitForFunction(() => Boolean(window.MobileProfileScene));
    await page.waitForFunction(() => window.ProfileRootOverview.snapshot().visible === true);

    await expect(page.locator('.hero')).toBeHidden();
    await expect(page.locator('#site-explorer')).toBeVisible();
    await expect(page.locator('.menu-button')).toBeVisible();
    await expect(page.locator('.profile-root-brief')).toBeVisible();
    await expect(page.locator('.profile-root-name')).toContainText('Štěpán Chrast');

    for (const id of firstLevelIds) {
      await expect(page.locator(`#site-graph .site-graph-node[data-node-id="${id}"]`)).toBeVisible();
    }
  });
});
