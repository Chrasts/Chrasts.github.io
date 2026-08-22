const { test, expect } = require('@playwright/test');

const boot = async (page, route = 'overview') => {
  await page.route('https://cloud.umami.is/**', response => response.abort());
  await page.goto(`/#${route}`);
  await page.waitForFunction(() => Boolean(window.ProfileScene?.manager));
  await page.waitForFunction(() => Boolean(window.ProfileRootLanding));
  await page.waitForFunction(() => Boolean(document.body.dataset.graphMode));
  await page.waitForFunction(() => Boolean(document.querySelector('#site-graph .site-graph-svg')));
  await page.waitForTimeout(180);
};

const firstLevelIds = ['work', 'knowledge', 'experience', 'education', 'about'];

test.describe('Phase 2 root landing — desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('opens on standalone root scene and keeps first-level navigation hidden', async ({ page }) => {
    await boot(page);

    expect(await page.evaluate(() => window.ProfileRootLanding.isActive())).toBe(true);
    expect(await page.evaluate(() => window.ProfileScene.manager.graphState.rootLanding)).toBe(true);
    await expect(page.locator('body')).toHaveAttribute('data-root-landing', 'true');
    await expect(page.locator('.hero')).toBeVisible();
    await expect(page.locator('.root-node-trigger')).toBeVisible();
    await expect(page.locator('.root-node-trigger')).toBeEnabled();
    await expect(page.locator('.root-node-trigger')).toContainText('Open profile map');
    await expect(page.locator('.root-atlas-affordance')).toBeVisible();
    await expect(page.locator('.root-atlas-affordance')).toBeEnabled();
    await expect(page.locator('#site-explorer')).toBeHidden();
    await expect(page.locator('#main-nav')).toBeHidden();
    await expect(page.locator('.header-utility').first()).toBeHidden();

    for (const id of firstLevelIds) {
      await expect(page.locator(`#site-graph .site-graph-node[data-node-id="${id}"]`)).toBeHidden();
    }
  });

  test('root activation unfolds the first-level profile graph without changing route', async ({ page }) => {
    await boot(page);
    await page.locator('.root-node-trigger').click();

    await page.waitForFunction(() => window.ProfileRootLanding.isActive() === false);
    await expect(page.locator('body')).toHaveAttribute('data-root-landing', 'false');
    expect(await page.evaluate(() => document.body.dataset.graphRoute)).toBe('overview');
    expect(await page.evaluate(() => window.ProfileScene.manager.graphState.rootLanding)).toBe(false);
    await expect(page.locator('.hero')).toBeHidden();
    await expect(page.locator('#site-explorer')).toBeVisible();
    await expect(page.locator('#main-nav')).toBeVisible();
    await expect(page.locator('.header-utility').first()).toBeVisible();

    for (const id of firstLevelIds) {
      await expect(page.locator(`#site-graph .site-graph-node[data-node-id="${id}"]`)).toBeVisible();
    }
  });

  test('once activated, returning to Overview keeps the expanded graph for the document lifetime', async ({ page }) => {
    await boot(page);
    await page.locator('.root-node-trigger').click();
    await page.waitForFunction(() => window.ProfileRootLanding.hasActivated());

    await page.locator('#main-nav [data-route="knowledge"]').click({ force: true });
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge');
    await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));

    await page.locator('#main-nav [data-route="overview"]').click({ force: true });
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'overview');
    await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));

    expect(await page.evaluate(() => window.ProfileRootLanding.isActive())).toBe(false);
    await expect(page.locator('#site-explorer')).toBeVisible();
    await expect(page.locator('.hero')).toBeHidden();
    await expect(page.locator('#main-nav')).toBeVisible();
  });

  test('secondary Atlas affordance bypasses unfolding and opens the full graph', async ({ page }) => {
    await boot(page);
    await page.locator('.root-atlas-affordance').click();

    await page.waitForFunction(() => document.body.dataset.graphMode === 'atlas');
    expect(await page.evaluate(() => window.ProfileRootLanding.isActive())).toBe(false);
    await expect(page.locator('#site-explorer')).toBeVisible();
    await expect(page.locator('#atlas-controls')).toBeVisible();
  });

  test('deep links do not force the root landing over requested content', async ({ page }) => {
    await boot(page, 'knowledge');

    expect(await page.evaluate(() => window.ProfileRootLanding.isActive())).toBe(false);
    await expect(page.locator('body')).toHaveAttribute('data-root-landing', 'false');
    await expect(page.locator('#site-explorer')).toBeVisible();
    await expect(page.locator('#main-nav')).toBeVisible();
    expect(await page.evaluate(() => document.body.dataset.graphMode)).toBe('focus');
    expect(await page.evaluate(() => document.body.dataset.graphRoute)).toBe('knowledge');
  });
});

test.describe('Phase 2 root landing — mobile portrait', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('presents portrait, intro, links and root action before the graph', async ({ page }) => {
    await boot(page);
    await page.waitForFunction(() => Boolean(window.MobileProfileScene));

    await expect(page.locator('.hero-visual.profile-identity')).toBeVisible();
    await expect(page.locator('.hero .intro')).toBeVisible();
    await expect(page.locator('.hero a[href^="mailto:"]')).toBeVisible();
    await expect(page.locator('.root-node-trigger')).toBeVisible();
    await expect(page.locator('.root-node-trigger')).toBeEnabled();
    await expect(page.locator('.root-atlas-affordance')).toBeVisible();
    await expect(page.locator('.root-atlas-affordance')).toBeEnabled();
    await expect(page.locator('#site-explorer')).toBeHidden();
    await expect(page.locator('.menu-button')).toBeHidden();
    await expect(page.locator('#main-nav')).toBeHidden();

    const hit = await page.locator('.root-node-trigger').boundingBox();
    expect(hit).toBeTruthy();
    expect(hit.height).toBeGreaterThanOrEqual(36);

    await page.locator('.root-node-trigger').click();
    await page.waitForFunction(() => window.ProfileRootLanding.isActive() === false);
    await expect(page.locator('#site-explorer')).toBeVisible();
    await expect(page.locator('.menu-button')).toBeVisible();

    const top = await page.locator('.site-graph-viewport').evaluate(element => getComputedStyle(element).top);
    expect(top).toBe('44px');
  });
});