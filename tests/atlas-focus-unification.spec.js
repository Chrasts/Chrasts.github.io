const { test, expect } = require('@playwright/test');

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const SAT_ROUTE = 'knowledge/logic-math/mathematical-logic/computational-logic/sat-smt';

const waitReady = async page => {
  await page.waitForFunction(() => Boolean(window.ProfileAtlasFocus?.snapshot?.().ready && window.ProfileAtlasLOD));
};

const waitSettled = async page => {
  await page.waitForFunction(() => Boolean(window.ProfileAtlasFocus) && !window.ProfileAtlasFocus.snapshot().active, null, { timeout: 6_000 });
};

test.describe('V3.1 Phase I Atlas / Focus unification', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('first Atlas activation inspects; second activation enters Focus through the shared-node bridge', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#atlas');
    await waitReady(page);
    await page.waitForFunction(() => document.body.dataset.graphMode === 'atlas');

    const node = page.locator('#site-graph .site-graph-node[data-node-id="sat-smt"]');
    await node.click();
    await expect(page.locator('#site-detail-panel')).toBeVisible();
    expect(await page.evaluate(() => document.body.dataset.graphMode)).toBe('atlas');
    expect((await page.evaluate(() => window.ProfileAtlasLOD.snapshot())).selectedNodeId).toBe('sat-smt');

    await node.click();
    await page.waitForFunction(() => document.body.classList.contains('is-atlas-focus-transitioning'));
    await expect(page.locator('.atlas-focus-bridge')).toHaveCount(1);
    await expect(page.locator('.profile-atlas-handoff')).toHaveCount(0);
    expect(await page.evaluate(() => document.body.classList.contains('is-v9-transitioning'))).toBe(false);

    await page.waitForFunction(route => document.body.dataset.graphMode === 'focus' && document.body.dataset.graphRoute === route, SAT_ROUTE);
    await waitSettled(page);
    await expect(page.locator('.atlas-focus-bridge')).toHaveCount(0);
    await expect(page.locator('#site-graph .site-graph-node[data-node-id="sat-smt"]')).toHaveClass(/is-selected/);

    const result = await page.evaluate(() => window.ProfileAtlasFocus.snapshot().lastResult);
    expect(result.result).toBe('completed');
    expect(result.direction).toBe('atlas-to-focus');
    expect(result.anchorId).toBe('sat-smt');
    expect(result.sourceRoute).toBe('atlas');
    expect(result.targetRoute).toBe(SAT_ROUTE);
  });

  test('Atlas inspector action uses the same semantic-scale owner instead of bypassing it', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#atlas');
    await waitReady(page);
    await page.waitForFunction(() => document.body.dataset.graphMode === 'atlas');

    await page.locator('#site-graph .site-graph-node[data-node-id="sat-smt"]').click();
    await expect(page.locator('#site-detail-panel .atlas-open-local')).toBeVisible();
    await expect(page.locator('#site-detail-panel .atlas-repeat-click-hint')).toContainText('local scale');
    await page.locator('#site-detail-panel .atlas-open-local').click();

    await page.waitForFunction(() => document.body.classList.contains('is-atlas-focus-transitioning'));
    await expect(page.locator('.profile-atlas-handoff')).toHaveCount(0);
    await page.waitForFunction(route => document.body.dataset.graphMode === 'focus' && document.body.dataset.graphRoute === route, SAT_ROUTE);
    await waitSettled(page);
    expect((await page.evaluate(() => window.ProfileAtlasFocus.snapshot().lastResult)).direction).toBe('atlas-to-focus');
  });

  test('Atlas route controls into a local route use the same boundary owner', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#atlas');
    await waitReady(page);
    await page.waitForFunction(() => document.body.dataset.graphMode === 'atlas');

    await page.locator('#main-nav [data-route="knowledge"]').click();
    await page.waitForFunction(() => document.body.classList.contains('is-atlas-focus-transitioning'));
    await expect(page.locator('.atlas-focus-bridge')).toHaveCount(1);
    await page.waitForFunction(() => document.body.dataset.graphMode === 'focus' && document.body.dataset.graphRoute === 'knowledge');
    await waitSettled(page);

    const result = await page.evaluate(() => window.ProfileAtlasFocus.snapshot().lastResult);
    expect(result.result).toBe('completed');
    expect(result.direction).toBe('atlas-to-focus');
    expect(result.anchorId).toBe('knowledge');
    expect(result.targetRoute).toBe('knowledge');
  });

  test('Focus to Atlas reconstructs the full graph around the same semantic node without the legacy Atlas snapshot handoff', async ({ page }) => {
    await bypassIntro(page);
    await page.goto(`/#${SAT_ROUTE}`);
    await waitReady(page);
    await page.waitForFunction(route => document.body.dataset.graphMode === 'focus' && document.body.dataset.graphRoute === route, SAT_ROUTE);

    await page.locator('.atlas-button[data-route="atlas"]').click();
    await page.waitForFunction(() => document.body.classList.contains('is-atlas-focus-transitioning'));
    await expect(page.locator('.atlas-focus-bridge')).toHaveCount(1);
    await expect(page.locator('.profile-atlas-handoff')).toHaveCount(0);
    expect(await page.evaluate(() => document.body.classList.contains('is-v9-transitioning'))).toBe(false);

    await page.waitForFunction(() => document.body.dataset.graphMode === 'atlas');
    await waitSettled(page);
    const geometry = await page.evaluate(() => {
      const node = document.querySelector('#site-graph .site-graph-node[data-node-id="sat-smt"]');
      const svg = document.querySelector('#site-graph .site-graph-svg');
      const n = node.getBoundingClientRect();
      const s = svg.getBoundingClientRect();
      return {
        distance: Math.hypot(n.left + n.width / 2 - (s.left + s.width / 2), n.top + n.height / 2 - (s.top + s.height / 2)),
        camera: window.ProfileAtlasLOD.snapshot().camera,
        last: window.ProfileAtlasFocus.snapshot().lastResult
      };
    });
    expect(geometry.distance).toBeLessThan(260);
    expect(geometry.camera.scale).toBeGreaterThan(1.2);
    expect(geometry.last.direction).toBe('focus-to-atlas');
    expect(geometry.last.anchorId).toBe('sat-smt');
    expect(geometry.last.sourceRoute).toBe(SAT_ROUTE);
    expect(geometry.last.targetRoute).toBe('atlas');
  });

  test('browser history preserves Atlas / Focus semantic continuity in both directions', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#atlas');
    await waitReady(page);
    const node = page.locator('#site-graph .site-graph-node[data-node-id="sat-smt"]');
    await node.click();
    await node.click();
    await page.waitForFunction(route => document.body.dataset.graphRoute === route, SAT_ROUTE);
    await waitSettled(page);

    await page.locator('.atlas-button[data-route="atlas"]').click();
    await page.waitForFunction(() => document.body.dataset.graphMode === 'atlas');
    await waitSettled(page);

    await page.evaluate(() => history.back());
    await page.waitForFunction(route => document.body.dataset.graphMode === 'focus' && document.body.dataset.graphRoute === route, SAT_ROUTE);
    await waitSettled(page);
    expect((await page.evaluate(() => window.ProfileAtlasFocus.snapshot().lastResult)).direction).toBe('atlas-to-focus');

    await page.evaluate(() => history.forward());
    await page.waitForFunction(() => document.body.dataset.graphMode === 'atlas');
    await waitSettled(page);
    expect((await page.evaluate(() => window.ProfileAtlasFocus.snapshot().lastResult)).direction).toBe('focus-to-atlas');
  });
});

test.describe('V3.1 Phase I reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

  test('keeps the same anchor and route semantics without a bridge flight', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#atlas');
    await waitReady(page);
    const node = page.locator('#site-graph .site-graph-node[data-node-id="sat-smt"]');
    await node.click();
    await node.click();
    await page.waitForFunction(route => document.body.dataset.graphMode === 'focus' && document.body.dataset.graphRoute === route, SAT_ROUTE);
    await waitSettled(page);
    await expect(page.locator('.atlas-focus-bridge')).toHaveCount(0);
    const snapshot = await page.evaluate(() => window.ProfileAtlasFocus.snapshot());
    expect(snapshot.reducedMotion).toBe(true);
    expect(snapshot.lastResult.result).toBe('completed');
    expect(snapshot.lastResult.anchorId).toBe('sat-smt');
  });
});
