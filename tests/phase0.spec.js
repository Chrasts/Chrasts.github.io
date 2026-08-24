const { test, expect } = require('@playwright/test');

const waitReady = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
  await page.goto('/#overview');
  await page.waitForFunction(() => Boolean(window.ProfilePhase0));
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  await page.waitForTimeout(120);
};

const settle = async page => {
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
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

const unfoldRoot = async page => {
  if (await page.locator('[data-root-activate]').isVisible().catch(() => false)) {
    await page.locator('[data-root-activate]').click();
    await page.waitForFunction(() => document.body.dataset.rootLanding === 'false');
    await page.waitForTimeout(120);
  }
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

const dragGraph = async (page, dx, dy) => {
  const svg = page.locator('#site-graph .site-graph-svg');
  const box = await svg.boundingBox();
  expect(box).not.toBeNull();
  const startX = box.x + box.width * .52;
  const startY = box.y + box.height * .52;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps: 5 });
  await page.mouse.up();
};

const localViewBox = page => page.evaluate(() => {
  const viewBox = document.querySelector('#site-graph .site-graph-svg')?.viewBox?.baseVal;
  return viewBox ? { x: viewBox.x, y: viewBox.y, width: viewBox.width, height: viewBox.height } : null;
});

test.describe('Phase 0 desktop stability', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('repeated arbitrary top-level navigation keeps graph invariants', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await waitReady(page);

    expect((await invariants(page)).mode).toBe('overview');
    await expectHealthyGraph(page);
    await unfoldRoot(page);

    for (const route of ['work', 'knowledge', 'experience', 'education', 'about', 'overview', 'knowledge', 'overview']) {
      await goRoute(page, route);
      const state = await expectHealthyGraph(page);
      expect(state.route).toBe(route);
    }

    expect(pageErrors).toEqual([]);
  });

  test('second route activation retargets the active transition without breaking graph invariants', async ({ page }) => {
    await waitReady(page);
    await unfoldRoot(page);

    await page.locator('#main-nav [data-route="knowledge"]').first().click({ force: true });
    await page.waitForFunction(() => document.body.classList.contains('is-v9-transitioning'));
    await page.locator('#main-nav [data-route="experience"]').first().click({ force: true });

    await settle(page);
    expect(await page.evaluate(() => document.body.dataset.graphRoute)).toBe('experience');
    await expectHealthyGraph(page);
  });

  test('Atlas has a non-collapsed graph and working fit/zoom/pan controls', async ({ page }) => {
    await waitReady(page);
    await unfoldRoot(page);
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

    await dragGraph(page, -120, 70);
    const panned = await page.evaluate(() => window.ProfileAtlasLOD?.snapshot?.().camera || null);
    expect(Math.abs(panned.x - zoomed.x) + Math.abs(panned.y - zoomed.y)).toBeGreaterThan(10);

    await page.locator('#atlas-fit').click();
    await page.waitForTimeout(220);
    const fitted = await page.evaluate(() => window.ProfileAtlasLOD?.snapshot?.().camera || null);
    expect(fitted.scale).toBeLessThanOrEqual(zoomed.scale);
    await expectHealthyGraph(page);
  });

  test.describe('Phase 0 reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('route handoff never blanks the live renderer', async ({ page }) => {
      await waitReady(page);
      await unfoldRoot(page);
      await page.locator('#main-nav [data-route="knowledge"]').first().click({ force: true });
      await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge');
      await expect(page.locator('#site-graph .site-graph-svg')).toBeVisible();
      await settle(page);
      await expectHealthyGraph(page);
    });
  });
});

test.describe('Phase 0 mobile stability', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('portrait overview is spread out and local camera controls work after root unfold', async ({ page }) => {
    await waitReady(page);
    await unfoldRoot(page);
    await page.waitForFunction(() => Boolean(window.MobileProfileScene));
    await page.waitForTimeout(180);

    const initial = await localViewBox(page);
    expect(initial).not.toBeNull();

    await page.evaluate(() => window.MobileProfileScene.zoomIn());
    await page.waitForTimeout(80);
    const zoomed = await localViewBox(page);
    expect(zoomed.height).toBeLessThan(initial.height);

    await dragGraph(page, -60, 36);
    await page.waitForTimeout(80);
    const panned = await localViewBox(page);
    expect(Math.abs(panned.x - zoomed.x) + Math.abs(panned.y - zoomed.y)).toBeGreaterThan(5);
    await expectHealthyGraph(page);
  });

  test('mobile Atlas supports zoom and one-finger pan without corrupting the graph', async ({ page }) => {
    await waitReady(page);
    await unfoldRoot(page);
    await goRoute(page, 'atlas');
    await page.waitForFunction(() => Boolean(window.MobileProfileScene && window.ProfileAtlasLOD));

    const before = await page.evaluate(() => window.ProfileAtlasLOD.snapshot().camera);
    await page.evaluate(() => window.MobileProfileScene.zoomIn());
    await page.waitForTimeout(180);
    const zoomed = await page.evaluate(() => window.ProfileAtlasLOD.snapshot().camera);
    expect(zoomed.scale).toBeGreaterThan(before.scale);

    await dragGraph(page, -72, 48);
    await page.waitForTimeout(80);
    const panned = await page.evaluate(() => window.ProfileAtlasLOD.snapshot().camera);
    expect(Math.abs(panned.x - zoomed.x) + Math.abs(panned.y - zoomed.y)).toBeGreaterThan(10);
    await expectHealthyGraph(page);
  });

  test('crossing mobile to desktop removes the mobile runtime via clean reload', async ({ page }) => {
    await waitReady(page);
    await page.waitForFunction(() => Boolean(window.MobileProfileScene));
    await page.setViewportSize({ width: 1180, height: 800 });
    await page.waitForFunction(() => window.innerWidth > 900);
    await page.waitForTimeout(280);
    expect(await page.evaluate(() => Boolean(window.MobileProfileScene))).toBe(false);
    await expectHealthyGraph(page);
  });
});
