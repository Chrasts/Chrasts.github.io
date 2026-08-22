const { test, expect } = require('@playwright/test');

const freshSession = async page => {
  await page.addInitScript(() => sessionStorage.removeItem('profileIntroSeen'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const waitIntro = async page => {
  await page.waitForFunction(() => Boolean(window.ProfileIntro));
  return page.evaluate(() => window.ProfileIntro.snapshot());
};

const waitComplete = async (page, result = 'completed') => {
  await page.waitForFunction(expected => window.ProfileIntro?.snapshot().result === expected, result, { timeout: 10_000 });
  return page.evaluate(() => window.ProfileIntro.snapshot());
};

test.describe('Phase 3 semantic intro — desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('uses the real Atlas graph and condenses through three semantic stages into the root landing', async ({ page }) => {
    await freshSession(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/#overview');
    await page.waitForFunction(() => window.ProfileIntro?.snapshot().running === true);
    await page.waitForSelector('.profile-intro-overlay[data-source="real-atlas"]');

    const source = await page.evaluate(() => ({
      expected: window.SITE_DATA.graph.nodes.length,
      cloned: document.querySelectorAll('.profile-intro-overlay .site-graph-node[data-node-id]').length,
      source: document.querySelector('.profile-intro-overlay')?.dataset.source,
      liveMode: document.body.dataset.graphMode
    }));
    expect(source.source).toBe('real-atlas');
    expect(source.cloned).toBe(source.expected);

    await page.waitForFunction(() => document.querySelector('.profile-intro-overlay')?.dataset.stage === 'territories', null, { timeout: 6_000 });
    await page.waitForFunction(() => document.querySelector('.profile-intro-overlay')?.dataset.stage === 'branches', null, { timeout: 6_000 });
    await page.waitForFunction(() => document.querySelector('.profile-intro-overlay')?.dataset.stage === 'root', null, { timeout: 6_000 });

    await page.waitForFunction(() => document.documentElement.dataset.profileIntro === 'handoff', null, { timeout: 6_000 });
    await page.waitForTimeout(90);
    const handoff = await page.evaluate(() => {
      const overlay = document.querySelector('.profile-intro-overlay');
      const app = document.querySelector('.profile-app');
      return {
        overlayOpacity: Number(getComputedStyle(overlay).opacity),
        appOpacity: Number(getComputedStyle(app).opacity),
        rootLanding: window.ProfileRootLanding?.isActive?.()
      };
    });
    expect(handoff.rootLanding).toBe(true);
    expect(handoff.overlayOpacity).toBeGreaterThan(0);
    expect(handoff.overlayOpacity).toBeLessThan(1);
    expect(handoff.appOpacity).toBeGreaterThan(0);

    const snapshot = await waitComplete(page);
    expect(snapshot.stages).toEqual(expect.arrayContaining(['atlas', 'territories', 'branches', 'root']));
    expect(snapshot.source).toBe('real-atlas');
    expect(snapshot.sourceNodeCount).toBe(source.expected);
    expect(await page.evaluate(() => sessionStorage.getItem('profileIntroSeen'))).toBe('true');
    expect(await page.evaluate(() => window.ProfileRootLanding.isActive())).toBe(true);
    expect(await page.evaluate(() => document.body.dataset.graphRoute)).toBe('overview');
    await expect(page.locator('.profile-intro-overlay')).toHaveCount(0);
    await expect(page.locator('.root-node-trigger')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('pointer interaction skips immediately to the usable root landing', async ({ page }) => {
    await freshSession(page);
    await page.goto('/#overview');
    await page.waitForSelector('.profile-intro-overlay.is-ready');

    await page.mouse.click(80, 80);
    const snapshot = await waitComplete(page, 'skipped');

    expect(snapshot.result).toBe('skipped');
    expect(await page.evaluate(() => window.ProfileRootLanding.isActive())).toBe(true);
    expect(await page.evaluate(() => document.body.dataset.graphRoute)).toBe('overview');
    await expect(page.locator('.profile-intro-overlay')).toHaveCount(0);
    await expect(page.locator('.root-node-trigger')).toBeVisible();
  });

  test('Escape also skips and does not activate an underlying route', async ({ page }) => {
    await freshSession(page);
    await page.goto('/#overview');
    await page.waitForFunction(() => window.ProfileIntro?.snapshot().running === true);

    await page.keyboard.press('Escape');
    await waitComplete(page, 'skipped');

    expect(await page.evaluate(() => document.body.dataset.graphRoute)).toBe('overview');
    expect(await page.evaluate(() => window.ProfileRootLanding.isActive())).toBe(true);
  });

  test('the intro is session-only; refresh goes directly to Phase 2 root landing', async ({ page }) => {
    await freshSession(page);
    await page.goto('/#overview');
    await page.waitForSelector('.profile-intro-overlay.is-ready');
    await page.mouse.click(80, 80);
    await waitComplete(page, 'skipped');

    await page.reload();
    const snapshot = await waitIntro(page);
    expect(snapshot.eligible).toBe(false);
    expect(snapshot.result).toBe('bypassed');
    await expect(page.locator('.profile-intro-overlay')).toHaveCount(0);
    await page.waitForFunction(() => Boolean(window.ProfileRootLanding));
    expect(await page.evaluate(() => window.ProfileRootLanding.isActive())).toBe(true);
  });

  test('deep links bypass the intro and mark the session seen', async ({ page }) => {
    await freshSession(page);
    await page.goto('/#knowledge');
    const snapshot = await waitIntro(page);

    expect(snapshot.eligible).toBe(false);
    expect(snapshot.result).toBe('bypassed');
    await expect(page.locator('.profile-intro-overlay')).toHaveCount(0);
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge');
    expect(await page.evaluate(() => document.body.dataset.graphMode)).toBe('focus');
    expect(await page.evaluate(() => sessionStorage.getItem('profileIntroSeen'))).toBe('true');
  });
});

test.describe('Phase 3 reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

  test('uses a short Atlas-to-root fade without semantic camera stages', async ({ page }) => {
    await freshSession(page);
    await page.goto('/#overview');
    await page.waitForSelector('.profile-intro-overlay[data-source="real-atlas"]');
    const snapshot = await waitComplete(page);

    expect(snapshot.reducedMotion).toBe(true);
    expect(snapshot.stages).toEqual(['atlas']);
    expect(await page.evaluate(() => window.ProfileRootLanding.isActive())).toBe(true);
    await expect(page.locator('.root-node-trigger')).toBeVisible();
  });
});

test.describe('Phase 3 semantic intro — mobile portrait', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('runs from the real Atlas and hands off to the mobile root composition', async ({ page }) => {
    await freshSession(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/#overview');
    await page.waitForSelector('.profile-intro-overlay[data-source="real-atlas"]');
    await waitComplete(page);

    await page.waitForFunction(() => Boolean(window.MobileProfileScene));
    expect(await page.evaluate(() => window.ProfileRootLanding.isActive())).toBe(true);
    await expect(page.locator('.root-node-trigger')).toBeVisible();
    await expect(page.locator('.hero-visual.profile-identity')).toBeVisible();
    await expect(page.locator('#site-explorer')).toBeHidden();
    expect(errors).toEqual([]);
  });
});
