const { test, expect } = require('@playwright/test');

const firstLevelIds = ['work', 'knowledge', 'experience', 'education', 'about'];

const blockAnalytics = async page => {
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const bootDesktopHome = async (page, { introSeen = true } = {}) => {
  if (introSeen) {
    await page.addInitScript(() => {
      sessionStorage.setItem('profileIntroSeen', 'true');
      sessionStorage.setItem('mobileConstructionPreview', 'true');
    });
  }
  await blockAnalytics(page);
  await page.goto('/#overview');
  await page.waitForFunction(() => Boolean(window.ProfileHomeOverviewV4));
  await page.waitForFunction(() => document.body.dataset.graphMode === 'overview');
  await page.waitForFunction(() => document.body.dataset.rootLanding === 'false');
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  await expect(page.locator('.home-v4-shell')).toBeVisible();
};

const waitRoute = async (page, route) => {
  await page.waitForFunction(expected => document.body.dataset.graphRoute === expected, route);
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
};

test.describe('V4 professional portfolio smoke', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Home exposes identity, current context, one profile root and selected work in one viewport', async ({ page }) => {
    await bootDesktopHome(page);

    await expect(page.locator('.home-v4-name')).toContainText('Štěpán Chrast');
    await expect(page.locator('.home-v4-role')).toContainText('Data Analysis');
    await expect(page.locator('.home-v4-current-item')).toHaveCount(2);
    await expect(page.locator('.home-v4-project-choice')).toHaveCount(4);
    await expect(page.locator('.home-v4-project-preview')).toBeVisible();
    await expect(page.locator('.profile-root-brief')).toBeHidden();
    await expect(page.locator('.hero')).toBeHidden();
    await expect(page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]')).toBeVisible();

    for (const id of firstLevelIds) {
      await expect(page.locator(`#site-graph .site-graph-node[data-node-id="${id}"]`)).toBeHidden();
    }

    const state = await page.evaluate(() => window.ProfileHomeOverviewV4.snapshot());
    expect(state.interactiveIntent).toBe(false);
    expect(state.interactivePhase).toBe('home');
    expect(state.rootActionPresent).toBe(true);

    const viewportFit = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight
    }));
    expect(viewportFit.scrollHeight).toBeLessThanOrEqual(viewportFit.innerHeight + 2);
  });

  test('profile root opt-in reveals the existing interactive Overview and reverses back to Home', async ({ page }) => {
    await bootDesktopHome(page);

    const root = page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').first();
    await root.hover();
    await expect(root.locator(':scope > .home-v4-root-entry-action')).toBeVisible();
    await expect(root.locator(':scope > .profile-node-portrait')).toBeVisible();

    await root.click();
    await page.waitForFunction(() => window.ProfileHomeOverviewV4?.snapshot().interactivePhase === 'interactive', null, { timeout: 5_000 });

    await expect(page.locator('.home-v4-profile')).toBeHidden();
    await expect(page.locator('.home-v4-work')).toBeHidden();
    await expect(page.locator('.header-linear-graph')).toBeVisible();
    await expect(page.locator('.home-v4-interactive-back')).toBeVisible();
    for (const id of firstLevelIds) {
      await expect(page.locator(`#site-graph .site-graph-node[data-node-id="${id}"]`)).toBeVisible();
    }

    await page.locator('.home-v4-interactive-back').click();
    await page.waitForFunction(() => window.ProfileHomeOverviewV4?.snapshot().interactivePhase === 'home', null, { timeout: 5_000 });
    await expect(page.locator('.home-v4-profile')).toBeVisible();
    await expect(page.locator('.home-v4-work')).toBeVisible();
    for (const id of firstLevelIds) {
      await expect(page.locator(`#site-graph .site-graph-node[data-node-id="${id}"]`)).toBeHidden();
    }
  });

  test('Selected Work switches evidence without expanding the Home layout', async ({ page }) => {
    await bootDesktopHome(page);

    const shell = page.locator('.home-v4-shell');
    const beforeBox = await shell.boundingBox();
    const beforeTitle = (await page.locator('.home-v4-project-title').textContent())?.trim();

    const choices = page.locator('.home-v4-project-choice');
    await choices.nth(1).click();
    await expect(choices.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.home-v4-project-title')).not.toHaveText(beforeTitle || '');

    const afterBox = await shell.boundingBox();
    expect(beforeBox).not.toBeNull();
    expect(afterBox).not.toBeNull();
    expect(Math.abs(afterBox.height - beforeBox.height)).toBeLessThan(3);
  });

  test('Contact is an explicit panel with visible email and deliberate mailto action', async ({ page }) => {
    await bootDesktopHome(page);

    await page.locator('.home-v4-contact-trigger').click();
    const dialog = page.locator('.home-v4-contact-dialog');
    await expect(dialog).toBeVisible();
    await expect(page.locator('.home-v4-contact-email')).toContainText('@');
    await expect(page.locator('.home-v4-contact-action', { hasText: 'Copy' })).toBeVisible();
    await expect(page.locator('[data-contact-send]')).toHaveAttribute('href', /^mailto:/);
  });

  test('conventional navigation can leave Home and return without resurrecting legacy overview UI', async ({ page }) => {
    await bootDesktopHome(page);

    await page.locator('#main-nav [data-route="work"]').click();
    await waitRoute(page, 'work');
    await expect(page.locator('.home-v4-shell')).toBeHidden();

    await page.locator('#main-nav [data-route="overview"]').click();
    await waitRoute(page, 'overview');
    await expect(page.locator('.home-v4-shell')).toBeVisible();
    await expect(page.locator('.profile-root-brief')).toBeHidden();
    await expect(page.locator('.hero')).toBeHidden();
  });

  test('Atlas remains optional and opens a healthy graph context', async ({ page }) => {
    await bootDesktopHome(page);

    await page.evaluate(() => { location.hash = '#atlas'; });
    await waitRoute(page, 'atlas');
    await page.waitForFunction(() => document.body.dataset.graphMode === 'atlas');
    await expect(page.locator('#atlas-controls')).toBeVisible();

    const graph = await page.evaluate(() => window.ProfilePhase0?.checkGraphInvariants?.() || null);
    expect(graph).not.toBeNull();
    expect(graph.nodeCount).toBeGreaterThan(20);
    expect(graph.orphanEdgeCount).toBe(0);
  });

  test('deep links bypass Home presentation and land in the requested profile context', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
    await blockAnalytics(page);
    await page.goto('/#knowledge');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge');
    await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));

    await expect(page.locator('.home-v4-shell')).toBeHidden();
    expect(await page.evaluate(() => document.body.dataset.graphMode)).toBe('focus');
    await expect(page.locator('#site-explorer')).toBeVisible();
  });

  test('fresh-session intro resolves automatically into root-only Home with no mandatory graph gate', async ({ page }) => {
    await blockAnalytics(page);
    await page.goto('/#overview');

    await page.waitForFunction(() => Boolean(window.ProfileHomeOverviewV4), null, { timeout: 10_000 });
    await page.waitForFunction(() => document.body.dataset.graphMode === 'overview', null, { timeout: 10_000 });
    await page.waitForFunction(() => document.body.classList.contains('is-entry-loader-complete'), null, { timeout: 10_000 });
    await expect(page.locator('.home-v4-shell')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-root-activate]')).toBeHidden();
    for (const id of firstLevelIds) {
      await expect(page.locator(`#site-graph .site-graph-node[data-node-id="${id}"]`)).toBeHidden();
    }
  });
});

test.describe('V4 mobile public surface', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('mobile defaults to the focused CV gate instead of booting the desktop graph product', async ({ page }) => {
    await blockAnalytics(page);
    await page.goto('/');

    const gate = page.locator('#mobile-construction-gate');
    await expect(gate).toBeVisible();
    await expect(page.locator('.mobile-cv-choice')).toHaveCount(2);
    await expect(page.locator('.mobile-cv-choice').first()).toHaveAttribute('href', /\/cv\//);
    await expect(page.locator('#main-content')).toHaveAttribute('inert', '');
  });
});
