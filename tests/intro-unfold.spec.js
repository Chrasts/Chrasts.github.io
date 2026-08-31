const { test, expect } = require('@playwright/test');

const fresh = async page => {
  await page.addInitScript(() => sessionStorage.removeItem('profileIntroSeen'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const bypass = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const waitReady = page => page.waitForFunction(() => window.ProfileIntro?.snapshot?.().state === 'ATLAS_READY', null, { timeout: 8_000 });

const graphPoints = (page, ids) => page.evaluate(sectionIds => Object.fromEntries(sectionIds.map(id => {
  const node = [...document.querySelectorAll(`#site-graph .site-graph-node[data-node-id="${id}"]`)]
    .find(element => !element.closest('.v9-transition-overlay'));
  return [id, { x: Number(node?.dataset.x), y: Number(node?.dataset.y) }];
})), ids);

test.describe('V3.1 entry retirement guards', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('retires the old gateway, portrait intermediary and Phase H wrapper runtime completely', async ({ page }) => {
    await fresh(page);
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.ProfileIntro?.__v31));
    expect(await page.locator('.profile-intro-enter').count()).toBe(0);
    expect(await page.locator('.profile-intro-identity').count()).toBe(0);
    expect(await page.locator('.profile-intro-overlay').count()).toBe(0);
    expect(await page.locator('#site-graph .phase-h-node-motion').count()).toBe(0);
    await waitReady(page);
    expect(await page.locator('.profile-intro-enter').count()).toBe(0);
    expect(await page.locator('.profile-intro-identity').count()).toBe(0);
    expect(await page.locator('#site-graph .phase-h-node-motion').count()).toBe(0);
  });

  test('first-session entry remains the live Atlas instead of exposing the old latent-root landing', async ({ page }) => {
    await fresh(page);
    await page.goto('/');
    await waitReady(page);
    await expect(page.locator('#site-explorer')).toBeVisible();
    await expect(page.locator('.phase-h-latent-stub')).toHaveCount(0);
    await expect(page.locator('.root-node-trigger')).toBeHidden();
    expect(await page.evaluate(() => document.body.dataset.graphMode)).toBe('atlas');
    expect(await page.evaluate(() => window.ProfileRootLanding.isActive())).toBe(false);
  });
});

test.describe('Phase H practical Overview preserves root inspector geometry', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('clicking the expanded Štěpán node opens profile info without reorganising the five-branch Overview', async ({ page }) => {
    await bypass(page);
    await page.goto('/#overview');
    await page.waitForFunction(() => Boolean(window.ProfileRootLanding && window.ProfileIntroFixesV3 && window.ProfileRootOverview));
    await page.waitForFunction(() => window.ProfileRootOverview.snapshot().visible === true);
    await page.waitForFunction(() => document.body.dataset.globalCompass === 'fan-v3');
    await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));

    const ids = ['work', 'knowledge', 'education', 'about', 'experience'];
    const before = await graphPoints(page, ids);

    await page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').click();
    await expect(page.locator('.profile-root-inspector')).toHaveClass(/is-open/);
    await expect(page.locator('.profile-root-inspector-portrait img')).toHaveAttribute('src', 'assets/stepan-chrast.jpg');
    await expect(page.locator('.profile-root-inspector h2')).toContainText('Štěpán Chrast');
    expect(await page.evaluate(() => document.body.dataset.graphRoute)).toBe('overview');

    await page.waitForTimeout(350);
    const after = await graphPoints(page, ids);
    expect(after).toEqual(before);
  });
});
