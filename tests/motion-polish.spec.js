const { test, expect } = require('@playwright/test');

const freshIntro = async page => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__v31MotionFresh') !== 'true') {
      sessionStorage.removeItem('profileIntroSeen');
      sessionStorage.setItem('__v31MotionFresh', 'true');
    }
  });
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

test.describe('V4 entry motion', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('condenses the inert opening Atlas without restoring retired gateway wrappers', async ({ page }) => {
    await freshIntro(page);
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.ProfileIntro?.__v4), null, { timeout: 8_000 });

    await expect(page.locator('.entry-opening-atlas')).toHaveCount(1);
    await expect(page.locator('.profile-intro-enter')).toHaveCount(0);
    await expect(page.locator('.profile-intro-overlay')).toHaveCount(0);
    await expect(page.locator('#site-graph .phase-h-node-motion')).toHaveCount(0);

    await page.waitForFunction(() =>
      window.ProfileIntro?.snapshot?.().state === 'ATLAS_READY' &&
      document.body.dataset.graphMode === 'overview' &&
      document.body.classList.contains('is-entry-loader-complete'),
    null, { timeout: 10_000 });

    const state = await page.evaluate(() => ({
      graphMode: document.body.dataset.graphMode,
      rootLanding: document.body.dataset.rootLanding,
      staticAtlas: window.ProfileIntro.snapshot().staticOpeningAtlas,
      profileReady: document.body.classList.contains('is-profile-root-ready')
    }));
    expect(state.graphMode).toBe('overview');
    expect(state.rootLanding).toBe('false');
    expect(state.staticAtlas).toBe(true);
    expect(state.profileReady).toBe(true);
  });

  test('leaves the stable five-branch Profile graph after the loading handoff', async ({ page }) => {
    await freshIntro(page);
    await page.goto('/');
    await page.waitForFunction(() =>
      window.ProfileIntro?.snapshot?.().state === 'ATLAS_READY' &&
      document.body.classList.contains('is-entry-loader-complete'),
    null, { timeout: 10_000 });

    const result = await page.evaluate(() => {
      const ids = ['work', 'knowledge', 'experience', 'education', 'about'];
      return {
        mode: document.body.dataset.graphMode,
        branches: ids.map(id => {
          const node = document.querySelector('#site-graph .site-graph-node[data-node-id="' + id + '"]');
          return Boolean(node) && getComputedStyle(node).opacity !== '0';
        }),
        legacyIntroNodes: document.querySelectorAll('#site-graph .site-graph-node[data-intro-wave]').length,
        legacyIntroEdges: document.querySelectorAll('#site-graph .site-graph-edges path[data-intro-edge-wave]').length
      };
    });
    expect(result.mode).toBe('overview');
    expect(result.branches.every(Boolean)).toBe(true);
    expect(result.legacyIntroNodes).toBe(0);
    expect(result.legacyIntroEdges).toBe(0);
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
