const { test, expect } = require('@playwright/test');

const fresh = async page => {
  await page.addInitScript(() => {
    sessionStorage.removeItem('profileIntroSeen');
    sessionStorage.removeItem('__phase3FreshPrepared');
  });
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const bypass = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const waitComplete = page => page.waitForFunction(() => window.ProfileIntro?.snapshot().stage === 'complete', null, { timeout: 10_000 });

test.describe('Phase H intro regressions', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('retires the old gateway and portrait intermediary completely', async ({ page }) => {
    await fresh(page);
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.ProfileIntro?.__phaseH));
    expect(await page.locator('.profile-intro-enter').count()).toBe(0);
    expect(await page.locator('.profile-intro-identity').count()).toBe(0);
    expect(await page.locator('.profile-intro-overlay').count()).toBe(0);
    await waitComplete(page);
    expect(await page.locator('.profile-intro-enter').count()).toBe(0);
    expect(await page.locator('.profile-intro-identity').count()).toBe(0);
  });

  test('the root landing exposes five latent directions without immediately opening the graph', async ({ page }) => {
    await fresh(page);
    await page.goto('/');
    await waitComplete(page);
    await expect(page.locator('#site-explorer')).toBeHidden();
    const stubs = page.locator('.phase-h-latent-stub');
    await expect(stubs).toHaveCount(5);
    for (const id of ['work', 'knowledge', 'experience', 'education', 'about']) {
      await expect(page.locator(`.phase-h-latent-stub[data-section="${id}"]`)).toHaveCount(1);
    }

    const before = await stubs.first().evaluate(element => ({
      width: getComputedStyle(element).width,
      opacity: getComputedStyle(element).opacity
    }));
    await page.locator('.root-node-trigger').hover();
    await page.waitForTimeout(120);
    const after = await stubs.first().evaluate(element => ({
      width: getComputedStyle(element).width,
      opacity: getComputedStyle(element).opacity
    }));
    expect(parseFloat(after.width)).toBeGreaterThan(parseFloat(before.width));
    expect(Number(after.opacity)).toBeGreaterThan(Number(before.opacity));
  });
});

test.describe('Overview root identity remains compatible with Phase H', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('clicking the expanded Štěpán node still opens profile info without reorganising the Overview', async ({ page }) => {
    await bypass(page);
    await page.goto('/#overview');
    await page.waitForFunction(() => Boolean(window.ProfileRootLanding && window.ProfileIntroFixesV3));
    await page.evaluate(() => window.ProfileRootLanding.activate({ focusGraph: false }));
    await page.waitForFunction(() => document.body.dataset.globalCompass === 'fan-v3');
    await page.waitForFunction(() => !document.body.classList.contains('is-phase-h-root-expanding'), null, { timeout: 3_000 });

    const ids = ['work', 'knowledge', 'education', 'about', 'experience'];
    const before = await page.evaluate(sectionIds => Object.fromEntries(sectionIds.map(id => {
      const node = document.querySelector(`#site-graph .site-graph-node[data-node-id="${id}"]`);
      return [id, { x: Number(node.dataset.x), y: Number(node.dataset.y) }];
    })), ids);

    await page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').click();
    await expect(page.locator('.profile-root-inspector')).toHaveClass(/is-open/);
    await expect(page.locator('.profile-root-inspector-portrait img')).toHaveAttribute('src', 'assets/stepan-chrast.jpg');
    await expect(page.locator('.profile-root-inspector h2')).toContainText('Štěpán Chrast');
    expect(await page.evaluate(() => document.body.dataset.graphRoute)).toBe('overview');

    await page.waitForTimeout(350);
    const after = await page.evaluate(sectionIds => Object.fromEntries(sectionIds.map(id => {
      const node = document.querySelector(`#site-graph .site-graph-node[data-node-id="${id}"]`);
      return [id, { x: Number(node.dataset.x), y: Number(node.dataset.y) }];
    })), ids);
    for (const id of ids) expect(Math.hypot(after[id].x - before[id].x, after[id].y - before[id].y)).toBeLessThan(3);
  });
});
