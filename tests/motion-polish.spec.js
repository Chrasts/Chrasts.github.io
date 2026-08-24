const { test, expect } = require('@playwright/test');

const freshIntro = async page => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__phaseHMotionFresh') !== 'true') {
      sessionStorage.removeItem('profileIntroSeen');
      sessionStorage.removeItem('__phase3FreshPrepared');
      sessionStorage.setItem('__phaseHMotionFresh', 'true');
    }
  });
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

test.describe('Intro motion polish', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Phase H wakes the real network without restoring the old Enter gateway', async ({ page }) => {
    await freshIntro(page);
    await page.goto('/#overview');
    await page.waitForFunction(() => {
      const state = window.ProfileIntro?.snapshot?.();
      return Boolean(state?.running && state.realGraph && document.querySelector('#site-graph .phase-h-node-motion'));
    }, null, { timeout: 8_000 });
    await page.waitForFunction(() => Boolean(window.ProfileMotionPolish));
    await page.waitForTimeout(360);

    await expect(page.locator('.profile-intro-enter')).toHaveCount(0);
    await expect(page.locator('.profile-intro-overlay')).toHaveCount(0);
    const root = page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]');
    await expect(root).toBeVisible();
    await expect(root.locator('.site-graph-label')).toContainText('Štěpán Chrast');

    const wake = await page.evaluate(() => ({
      wrappers: document.querySelectorAll('#site-graph .phase-h-node-motion').length,
      traced: [...document.querySelectorAll('#site-graph .site-graph-edges path')]
        .filter(edge => parseFloat(edge.style.strokeDasharray || '0') > 0).length,
      stage: window.ProfileIntro.snapshot().stage,
      enterActive: window.ProfileMotionPolish.snapshot().enterActive
    }));
    expect(wake.wrappers).toBeGreaterThan(5);
    expect(wake.traced).toBeGreaterThan(0);
    expect(wake.enterActive).toBe(false);
  });

  test('final condensation cleans cinematic transforms and hands directly to the stable identity landing', async ({ page }) => {
    await freshIntro(page);
    await page.goto('/#overview');
    await page.waitForFunction(() => window.ProfileIntro?.snapshot().stage === 'complete', null, { timeout: 10_000 });

    await expect(page.locator('.profile-intro-enter')).toHaveCount(0);
    await expect(page.locator('.profile-intro-identity')).toHaveCount(0);
    await expect(page.locator('.profile-intro-overlay')).toHaveCount(0);
    await expect(page.locator('#site-graph .phase-h-node-motion')).toHaveCount(0);
    await expect(page.locator('.hero-visual.profile-identity')).toBeVisible();
    await expect(page.locator('.hero-copy h1')).toContainText('Štěpán');
    expect(await page.evaluate(() => window.ProfileRootLanding.isActive())).toBe(true);
  });
});

test.describe('Structural transition motion polish', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('clicked Work remains selected for the whole Overview -> Work transition', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#overview');
    await page.waitForFunction(() => Boolean(window.ProfileRootLanding && window.ProfileMotionPolish));
    await page.evaluate(() => window.ProfileRootLanding.activate({ focusGraph: false }));
    await page.waitForFunction(() => document.body.dataset.globalGeometry === 'radial-overview');

    await page.locator('#site-graph .site-graph-node[data-node-id="work"]').click();
    await page.waitForFunction(() => document.body.classList.contains('is-v9-transitioning'));

    const overlayWork = page.locator('#site-graph .v9-transition-overlay .site-graph-node[data-node-id="work"]');
    await expect(overlayWork).toHaveClass(/is-selected/);
    await expect(overlayWork).toHaveAttribute('data-transition-focus', 'true');
    const midStroke = await overlayWork.locator('.site-graph-dot').evaluate(dot => getComputedStyle(dot).stroke);
    await page.waitForTimeout(360);
    await expect(overlayWork).toHaveClass(/is-selected/);
    expect(await overlayWork.locator('.site-graph-dot').evaluate(dot => getComputedStyle(dot).stroke)).toBe(midStroke);

    await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'), null, { timeout: 5_000 });
    const liveWork = page.locator('#site-graph .site-graph-node[data-node-id="work"]');
    await expect(liveWork).toHaveClass(/is-selected/);
    expect(await liveWork.locator('.site-graph-dot').evaluate(dot => getComputedStyle(dot).stroke)).toBe(midStroke);
  });

  test('persistent labels interpolate their local placement during fragment travel', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#knowledge');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge' && Boolean(window.ProfileMotionPolish));

    await page.locator('#site-graph .site-graph-node[data-node-id="logic-math"]').click();
    await page.waitForFunction(() => document.body.classList.contains('is-v9-transitioning'));
    await page.waitForSelector('#site-graph .v9-transition-overlay .site-graph-node[data-node-id="knowledge"] .site-graph-label[data-motion-label="true"]', { timeout: 2_500 });

    const label = page.locator('#site-graph .v9-transition-overlay .site-graph-node[data-node-id="knowledge"] .site-graph-label[data-motion-label="true"]');
    const delta = await label.evaluate(element => ({
      dx: Number(element.dataset.motionTargetDx),
      dy: Number(element.dataset.motionTargetDy),
      transform: element.getAttribute('transform') || ''
    }));
    expect(Math.abs(delta.dx) + Math.abs(delta.dy)).toBeGreaterThan(1);

    await page.waitForTimeout(220);
    const moved = await label.getAttribute('transform');
    expect(moved).not.toBe(delta.transform);

    await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'), null, { timeout: 5_000 });
    await expect(page.locator('#site-graph .site-graph-node[data-node-id="logic-math"]')).toHaveClass(/is-selected/);
  });
});
