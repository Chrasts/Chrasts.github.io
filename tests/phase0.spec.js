const { test, expect } = require('@playwright/test');

const settle = async page => {
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  await page.waitForTimeout(180);
};

const waitReady = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.ProfilePhase0?.checkGraphInvariants));
  await page.waitForFunction(() => Boolean(document.body.dataset.graphMode));
  await page.waitForFunction(() => Boolean(window.ProfileRootLanding));
  await settle(page);
};

const unfoldRoot = async page => {
  if (await page.evaluate(() => window.ProfileRootLanding?.isActive?.())) {
    await page.locator('.root-node-trigger').click();
    await page.waitForFunction(() => window.ProfileRootLanding.isActive() === false);
    await page.waitForTimeout(120);
  }
};

const invariants = async page => page.evaluate(() => window.ProfilePhase0.checkGraphInvariants());

const expectHealthyGraph = async page => {
  const snapshot = await invariants(page);
  expect(snapshot.transitioning).toBe(false);
  expect(snapshot.nodeCount).toBeGreaterThan(0);
  expect(snapshot.duplicateNodeIds).toEqual([]);
  expect(snapshot.orphanEdgeCount).toBe(0);
  return snapshot;
};

const goRoute = async (page, route) => {
  const target = page.locator(`#main-nav [data-route="${route}"]`).first();
  await target.click({ force: true });
  await page.waitForFunction(expected => document.body.dataset.graphRoute === expected, route);
  await settle(page);
};

const graphScreenSpread = async page => page.evaluate(() => {
  const nodes = [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
    .filter(element => !element.closest('.v9-transition-overlay'));
  const centres = nodes.map(node => {
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  if (!centres.length) return { width: 0, height: 0 };
  return {
    width: Math.max(...centres.map(point => point.x)) - Math.min(...centres.map(point => point.x)),
    height: Math.max(...centres.map(point => point.y)) - Math.min(...centres.map(point => point.y))
  };
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

  test('second route activation is ignored while transition owns the scene', async ({ page }) => {
    await waitReady(page);
    await unfoldRoot(page);

    await page.locator('#main-nav [data-route="knowledge"]').first().click({ force: true });
    await page.waitForFunction(() => document.body.classList.contains('is-v9-transitioning'));
    await page.locator('#main-nav [data-route="experience"]').first().click({ force: true });

    await settle(page);
    expect(await page.evaluate(() => document.body.dataset.graphRoute)).toBe('knowledge');
    await expectHealthyGraph(page);
  });

  test('Atlas has a non-collapsed graph and working fit/zoom/pan controls', async ({ page }) => {
    await waitReady(page);
    await unfoldRoot(page);
    await goRoute(page, 'atlas');

    const before = await expectHealthyGraph(page);
    expect(before.mode).toBe('atlas');
    expect(before.nodeCount).toBeGreaterThan(20);

    const spread = await graphScreenSpread(page);
    expect(spread.width).toBeGreaterThan(500);
    expect(spread.height).toBeGreaterThan(300);

    const camera = page.locator('#site-graph .site-graph-svg > g').first();
    const transformBeforeZoom = await camera.getAttribute('transform');
    await page.locator('#atlas-zoom-in').click();
    await page.waitForTimeout(180);
    const transformAfterZoom = await camera.getAttribute('transform');
    expect(transformAfterZoom).not.toBe(transformBeforeZoom);

    const box = await page.locator('#site-graph .site-graph-svg').boundingBox();
    expect(box).not.toBeNull();
    const transformBeforePan = await camera.getAttribute('transform');
    await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.68, box.y + box.height * 0.63, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(120);
    const transformAfterPan = await camera.getAttribute('transform');
    expect(transformAfterPan).not.toBe(transformBeforePan);

    await page.locator('#atlas-fit').click();
    await page.waitForTimeout(180);
    await expectHealthyGraph(page);
  });
});

test.describe('Phase 0 reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

  test('route handoff never blanks the live renderer', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await waitReady(page);
    await unfoldRoot(page);

    await page.evaluate(() => {
      window.__reducedMotionBlankObserved = false;
      window.__reducedMotionSampling = true;
      const sample = () => {
        const base = document.querySelector('#site-graph .site-graph-svg > g:not(.v9-transition-overlay)');
        if (base) {
          const style = getComputedStyle(base);
          if (Number(style.opacity) <= 0 || style.visibility === 'hidden' || style.display === 'none') {
            window.__reducedMotionBlankObserved = true;
          }
        }
        if (window.__reducedMotionSampling) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });

    await page.locator('#main-nav [data-route="knowledge"]').first().click({ force: true });
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge');
    await settle(page);
    await page.evaluate(() => { window.__reducedMotionSampling = false; });

    expect(await page.evaluate(() => window.__reducedMotionBlankObserved)).toBe(false);
    const baseVisibility = await page.evaluate(() => {
      const base = document.querySelector('#site-graph .site-graph-svg > g:not(.v9-transition-overlay)');
      if (!base) return null;
      const style = getComputedStyle(base);
      return { opacity: Number(style.opacity), visibility: style.visibility, display: style.display };
    });
    expect(baseVisibility).not.toBeNull();
    expect(baseVisibility.opacity).toBeGreaterThan(0);
    expect(baseVisibility.visibility).not.toBe('hidden');
    expect(baseVisibility.display).not.toBe('none');
    await expectHealthyGraph(page);
  });
});

test.describe('Phase 0 mobile stability', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('portrait overview is spread out and local camera controls work after root unfold', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await waitReady(page);
    await page.waitForFunction(() => Boolean(window.MobileProfileScene));
    await unfoldRoot(page);

    const snapshot = await expectHealthyGraph(page);
    expect(snapshot.mobileBreakpoint).toBe(true);
    expect(snapshot.mobileRuntimeLoaded).toBe(true);
    expect(snapshot.mobileRuntimeBooted).toBe(true);

    const spread = await graphScreenSpread(page);
    expect(spread.width).toBeGreaterThan(120);
    expect(spread.height).toBeGreaterThan(120);

    const svg = page.locator('#site-graph .site-graph-svg');
    const before = await svg.getAttribute('viewBox');
    await page.locator('.mobile-camera-button').filter({ hasText: '+' }).click();
    await page.waitForTimeout(120);
    const after = await svg.getAttribute('viewBox');
    expect(after).not.toBe(before);
    expect(pageErrors).toEqual([]);
  });

  test('mobile Atlas supports zoom and one-finger pan without corrupting the graph', async ({ page }) => {
    await waitReady(page);
    await page.waitForFunction(() => Boolean(window.MobileProfileScene));

    await page.locator('.root-atlas-affordance').click({ force: true });
    await page.waitForFunction(() => document.body.dataset.graphMode === 'atlas');
    await settle(page);

    const before = await expectHealthyGraph(page);
    expect(before.nodeCount).toBeGreaterThan(20);

    const camera = page.locator('#site-graph .site-graph-svg > g').first();
    const transformBeforeZoom = await camera.getAttribute('transform');
    await page.locator('.mobile-camera-button').filter({ hasText: '+' }).click();
    await page.waitForTimeout(160);
    const transformAfterZoom = await camera.getAttribute('transform');
    expect(transformAfterZoom).not.toBe(transformBeforeZoom);

    const svg = page.locator('#site-graph .site-graph-svg');
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();
    const transformBeforePan = await camera.getAttribute('transform');
    const startX = box.x + box.width * 0.52;
    const startY = box.y + box.height * 0.55;
    await svg.dispatchEvent('pointerdown', { pointerId: 41, pointerType: 'touch', button: 0, clientX: startX, clientY: startY });
    await svg.dispatchEvent('pointermove', { pointerId: 41, pointerType: 'touch', button: 0, clientX: startX + 55, clientY: startY + 34 });
    await svg.dispatchEvent('pointerup', { pointerId: 41, pointerType: 'touch', button: 0, clientX: startX + 55, clientY: startY + 34 });
    await page.waitForTimeout(120);
    const transformAfterPan = await camera.getAttribute('transform');
    expect(transformAfterPan).not.toBe(transformBeforePan);

    await expectHealthyGraph(page);
  });

  test('crossing mobile to desktop removes the mobile runtime via clean reload', async ({ page }) => {
    await waitReady(page);
    await page.waitForFunction(() => Boolean(window.MobileProfileScene));
    expect(await page.evaluate(() => document.documentElement.classList.contains('mobile-profile-app'))).toBe(true);

    let navigations = 0;
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) navigations += 1;
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForFunction(() => matchMedia('(max-width: 900px)').matches === false);
    await page.waitForFunction(() => !window.MobileProfileScene, null, { timeout: 8_000 });
    await page.waitForFunction(() => Boolean(window.ProfilePhase0?.checkGraphInvariants));

    expect(navigations).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.classList.contains('mobile-profile-app'))).toBe(false);
    const snapshot = await expectHealthyGraph(page);
    expect(snapshot.mobileBreakpoint).toBe(false);
    expect(snapshot.mobileRuntimeLoaded).toBe(false);
    expect(snapshot.mobileRuntimeBooted).toBe(false);
  });
});