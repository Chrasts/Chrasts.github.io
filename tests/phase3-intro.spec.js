const { test, expect } = require('@playwright/test');

const blockAnalytics = page =>
  page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});

const freshSession = async page => {
  await page.addInitScript(() => {
    sessionStorage.removeItem('profileIntroSeen');
    sessionStorage.removeItem('profileRootReached');
  });
  await blockAnalytics(page);
};

const waitReady = async (page, timeout = 10_000) => {
  await page.waitForFunction(() =>
    window.ProfileIntro?.snapshot?.().state === 'ATLAS_READY' &&
    document.body.dataset.graphMode === 'overview' &&
    document.body.dataset.entryState === 'profile' &&
    document.body.classList.contains('is-entry-loader-complete'),
  null, { timeout });
  return page.evaluate(() => window.ProfileIntro.snapshot());
};

test.describe('V4 professional-first entry', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('uses an inert static Atlas during loading and automatically lands in Overview', async ({ page }) => {
    await freshSession(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.entry-opening-atlas')).toHaveCount(1);
    await page.waitForFunction(() => Boolean(window.ProfileIntro?.__v4));

    const ready = await waitReady(page);
    expect(ready.staticOpeningAtlas).toBe(true);
    expect(ready.realGraph).toBe(false);
    expect(ready.graphMode).toBe('overview');
    expect(ready.rootLanding).toBe(false);
    expect(ready.result).toBe('completed');

    await expect(page.locator('#site-explorer')).toBeVisible();
    await expect(page.locator('[data-root-activate]')).toBeHidden();
    await expect(page.locator('.atlas-reveal-skip')).toHaveCount(0);
    await expect(page.locator('.entry-visibility-mask')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('reveals the five Profile branches from the root without a click-through gate', async ({ page }) => {
    await freshSession(page);
    await page.goto('/');
    await waitReady(page);

    const state = await page.evaluate(() => {
      const ids = ['work', 'knowledge', 'experience', 'education', 'about'];
      return {
        route: document.body.dataset.graphRoute,
        mode: document.body.dataset.graphMode,
        rootLanding: document.body.dataset.rootLanding,
        profileReady: document.body.classList.contains('is-profile-root-ready'),
        branches: ids.map(id => {
          const node = document.querySelector('#site-graph .site-graph-node[data-node-id="' + id + '"]');
          return { id, visible: Boolean(node) && getComputedStyle(node).opacity !== '0' };
        })
      };
    });

    expect(state.route).toBe('overview');
    expect(state.mode).toBe('overview');
    expect(state.rootLanding).toBe('false');
    expect(state.profileReady).toBe(true);
    expect(state.branches.every(branch => branch.visible)).toBe(true);
  });

  test('uses the active light or dark theme during loading instead of a black light-up mask', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await freshSession(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const dark = await page.evaluate(() => {
      const shell = document.querySelector('.entry-loading-shell');
      return {
        theme: document.documentElement.dataset.theme,
        background: getComputedStyle(shell).backgroundColor,
        maskCount: document.querySelectorAll('.entry-visibility-mask').length
      };
    });
    expect(dark.theme).toBe('dark');
    expect(dark.background).toBe('rgb(17, 25, 28)');
    expect(dark.maskCount).toBe(0);
  });

  test('same-session refresh bypasses entry motion and deep links never run it', async ({ page }) => {
    await freshSession(page);
    await page.goto('/');
    await waitReady(page);
    expect(await page.evaluate(() => sessionStorage.getItem('profileIntroSeen'))).toBe('true');

    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.profileIntro === 'bypass');
    expect(await page.evaluate(() => document.body.dataset.graphMode)).toBe('overview');
    expect(await page.evaluate(() => document.body.dataset.rootLanding)).toBe('false');

    const deepPage = await page.context().newPage();
    await deepPage.addInitScript(() => sessionStorage.clear());
    await blockAnalytics(deepPage);
    await deepPage.goto('/#knowledge');
    await deepPage.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge');
    expect(await deepPage.evaluate(() => document.documentElement.dataset.profileIntro)).toBe('bypass');
    expect(await deepPage.evaluate(() => Boolean(window.ProfileIntro))).toBe(false);
    await deepPage.close();
  });
});

test.describe('V4 reduced-motion entry', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

  test('lands directly in the professional Overview with a semantic no-motion handoff', async ({ page }) => {
    await freshSession(page);
    await page.goto('/');
    const ready = await waitReady(page, 5_000);
    expect(ready.reducedMotion).toBe(true);
    expect(ready.graphMode).toBe('overview');
    expect(ready.rootLanding).toBe(false);
    expect(ready.elapsed).toBeLessThan(1_500);
  });
});
