const { test, expect } = require('@playwright/test');

const waitReady = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
  await page.goto('/#overview');
  await page.waitForFunction(() => Boolean(window.ProfilePhase0));
  await page.waitForFunction(() => document.body.dataset.rootLanding === 'false');
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  await page.waitForTimeout(120);
};

const settle = async page => {
  await page.waitForFunction(() =>
    !document.body.classList.contains('is-v9-transitioning') &&
    !document.body.classList.contains('is-atlas-handoff')
  );
  await page.waitForTimeout(90);
};

const invariants = page => page.evaluate(() => window.ProfilePhase0.checkGraphInvariants());

const invalidCoordinateCount = page => page.evaluate(() =>
  [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
    .filter(element => !element.closest('.v9-transition-overlay'))
    .filter(element => !Number.isFinite(Number(element.dataset.x)) || !Number.isFinite(Number(element.dataset.y)))
    .length
);

const expectHealthyGraph = async page => {
  const state = await invariants(page);
  expect(state.nodeCount).toBeGreaterThan(0);
  expect(state.orphanEdgeCount).toBe(0);
  expect(state.duplicateNodeIds).toEqual([]);
  expect(await invalidCoordinateCount(page)).toBe(0);
  return state;
};

const goRoute = async (page, route) => {
  const control = page.locator(`#main-nav [data-route="${route}"]`).first();
  if (await control.isVisible().catch(() => false)) {
    await control.click({ force: true });
  } else {
    await page.evaluate(nextRoute => { location.hash = `#${nextRoute}`; }, route);
  }
  await page.waitForFunction(expected => document.body.dataset.graphRoute === expected, route);
  await settle(page);
};

test.describe('V4 desktop graph stability', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('repeated top-level navigation keeps graph invariants', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await waitReady(page);

    expect((await invariants(page)).mode).toBe('overview');
    await expectHealthyGraph(page);

    for (const route of ['work', 'knowledge', 'experience', 'education', 'about', 'overview', 'knowledge', 'overview']) {
      await goRoute(page, route);
      const state = await expectHealthyGraph(page);
      expect(state.route).toBe(route);
    }

    expect(pageErrors).toEqual([]);
  });

  test('second route activation retargets an active transition without corrupting the graph', async ({ page }) => {
    await waitReady(page);

    await page.locator('#main-nav [data-route="knowledge"]').first().click({ force: true });
    await page.waitForFunction(() => document.body.classList.contains('is-v9-transitioning'));
    await page.locator('#main-nav [data-route="experience"]').first().click({ force: true });

    await settle(page);
    expect(await page.evaluate(() => document.body.dataset.graphRoute)).toBe('experience');
    await expectHealthyGraph(page);
  });

  test('Atlas opens as a non-collapsed graph and basic zoom remains functional', async ({ page }) => {
    await waitReady(page);
    await goRoute(page, 'atlas');

    const before = await expectHealthyGraph(page);
    expect(before.mode).toBe('atlas');
    expect(before.nodeCount).toBeGreaterThan(20);

    const cameraBefore = await page.evaluate(() => window.ProfileAtlasLOD?.snapshot?.().camera || null);
    await page.locator('#atlas-zoom-in').click();
    await page.waitForTimeout(180);
    const zoomed = await page.evaluate(() => window.ProfileAtlasLOD?.snapshot?.().camera || null);
    expect(zoomed).not.toBeNull();
    expect(zoomed.scale).toBeGreaterThan(cameraBefore.scale);
    await expectHealthyGraph(page);
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('route handoff never blanks the live renderer', async ({ page }) => {
      await waitReady(page);
      await page.locator('#main-nav [data-route="knowledge"]').first().click({ force: true });
      await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge');
      await expect(page.locator('#site-graph .site-graph-svg')).toBeVisible();
      await settle(page);
      await expectHealthyGraph(page);
    });
  });
});
