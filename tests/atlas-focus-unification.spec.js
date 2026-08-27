const { test, expect } = require('@playwright/test');

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const SAT_ROUTE = 'knowledge/logic-math/mathematical-logic/computational-logic/sat-smt';

const waitReady = async page => {
  await page.waitForFunction(() => Boolean(
    window.ProfileAtlasFocus?.snapshot?.().ready &&
    window.ProfileAtlasLOD &&
    !document.body.classList.contains('is-v9-transitioning') &&
    !window.ProfileScene?.transitions?.isLocked
  ));
};

const waitSettled = async page => {
  await page.waitForFunction(() => Boolean(window.ProfileAtlasFocus) && !window.ProfileAtlasFocus.snapshot().active, null, { timeout: 8_000 });
};

const waitRouteCore = async (page, route, mode) => {
  await page.waitForFunction(({ expectedRoute, expectedMode }) => Boolean(
    window.ProfileFeatureBootstrap?.snapshot?.().states.bindings === 'ready' &&
    document.body.dataset.graphRoute === expectedRoute &&
    document.body.dataset.graphMode === expectedMode &&
    !document.body.classList.contains('is-v9-transitioning') &&
    !window.ProfileScene?.transitions?.isLocked
  ), { expectedRoute: route, expectedMode: mode });
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
    expect((await page.evaluate(() => window.ProfileAtlasLOD.snapshot())).selectedNodeId).toBe('sat-smt');

    await node.click();
    await page.waitForFunction(() => document.body.classList.contains('is-atlas-focus-transitioning'));
    await expect(page.locator('.atlas-focus-bridge')).toHaveCount(1);
    await page.waitForFunction(route => document.body.dataset.graphMode === 'focus' && document.body.dataset.graphRoute === route, SAT_ROUTE);
    await waitSettled(page);
    await expect(page.locator('.atlas-focus-bridge')).toHaveCount(0);
    await expect(page.locator('#site-graph .site-graph-node[data-node-id="sat-smt"]')).toHaveClass(/is-selected/);

    const result = await page.evaluate(() => window.ProfileAtlasFocus.snapshot().lastResult);
    expect(result.result).toBe('completed');
    expect(result.direction).toBe('atlas-to-focus');
    expect(result.anchorId).toBe('sat-smt');
    expect(result.targetRoute).toBe(SAT_ROUTE);
  });

  test('Atlas inspector and route controls keep the same semantic-scale owner', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#atlas');
    await waitReady(page);
    await page.locator('#site-graph .site-graph-node[data-node-id="sat-smt"]').click();
    await expect(page.locator('#site-detail-panel .atlas-open-local')).toBeVisible();
    await page.locator('#site-detail-panel .atlas-open-local').click();
    await page.waitForFunction(route => document.body.dataset.graphMode === 'focus' && document.body.dataset.graphRoute === route, SAT_ROUTE);
    await waitSettled(page);
    expect((await page.evaluate(() => window.ProfileAtlasFocus.snapshot().lastResult)).direction).toBe('atlas-to-focus');

    await page.goto('/#atlas');
    await waitReady(page);
    await page.waitForFunction(() => document.body.dataset.graphMode === 'atlas');
    await page.locator('#main-nav [data-route="knowledge"]').click();
    await page.waitForFunction(() => document.body.classList.contains('is-atlas-focus-transitioning'));
    await page.waitForFunction(() => document.body.dataset.graphMode === 'focus' && document.body.dataset.graphRoute === 'knowledge');
    await waitSettled(page);
    const result = await page.evaluate(() => window.ProfileAtlasFocus.snapshot().lastResult);
    expect(result.direction).toBe('atlas-to-focus');
    expect(result.anchorId).toBe('knowledge');
  });

  test('deep Focus to Atlas collapses into the centred root, then unfolds the complete Atlas from that root', async ({ page }) => {
    await bypassIntro(page);
    await page.goto(`/#${SAT_ROUTE}`);
    await waitRouteCore(page, SAT_ROUTE, 'focus');
    expect(await page.evaluate(() => Boolean(window.ProfileAtlasFocus))).toBe(false);

    await page.locator('.atlas-button[data-route="atlas"]').click();
    await page.waitForFunction(() => Boolean(window.ProfileAtlasFocus?.snapshot?.().ready));
    await page.waitForFunction(() => document.body.dataset.profileAtlasPhase === 'collapse');
    await expect(page.locator('.profile-atlas-unfold-bridge')).toHaveCount(1);

    await page.waitForFunction(() => document.body.dataset.profileAtlasPhase === 'unfold', null, { timeout: 5_000 });
    const unfolding = await page.evaluate(() => {
      const bridge = document.querySelector('.profile-atlas-unfold-bridge');
      const root = bridge?.querySelector('[data-bridge-node-id="stepan-chrast"]');
      const matrix = root?.transform?.baseVal?.consolidate?.()?.matrix;
      const frame = window.ProfileCameraComposition?.safeFrame?.();
      return {
        nodeCount: bridge?.querySelectorAll('[data-bridge-node-id]').length || 0,
        graphCount: window.SITE_DATA.graph.nodes.length,
        rootX: matrix?.e ?? NaN,
        rootY: matrix?.f ?? NaN,
        centerX: frame?.centerX ?? innerWidth / 2,
        centerY: frame?.centerY ?? innerHeight / 2,
        phase: window.ProfileAtlasFocus.snapshot().phase
      };
    });
    expect(unfolding.nodeCount).toBe(unfolding.graphCount);
    expect(Math.abs(unfolding.rootX - unfolding.centerX)).toBeLessThan(36);
    expect(Math.abs(unfolding.rootY - unfolding.centerY)).toBeLessThan(36);
    expect(unfolding.phase).toBe('unfold');

    await page.waitForFunction(() => document.body.dataset.graphMode === 'atlas');
    await waitSettled(page);
    const final = await page.evaluate(() => ({
      atlas: window.ProfileAtlasLOD.snapshot(),
      last: window.ProfileAtlasFocus.snapshot().lastResult,
      hidden: document.querySelectorAll('#site-graph .site-graph-node.is-atlas-lod-hidden').length,
      graphCount: window.SITE_DATA.graph.nodes.length
    }));
    expect(final.atlas.topologyMode).toBe('entry-full');
    expect(final.atlas.visibleNodeCount).toBe(final.graphCount);
    expect(final.hidden).toBe(0);
    expect(final.last.direction).toBe('focus-to-atlas');
    expect(final.last.anchorId).toBe('sat-smt');
    expect(final.last.sourceRoute).toBe(SAT_ROUTE);
    expect(final.last.targetRoute).toBe('atlas');
  });

  for (const source of [
    { route: 'overview', mode: 'overview', anchor: 'stepan-chrast' },
    { route: 'work', mode: 'work', anchor: 'work' }
  ]) {
    test(`${source.mode} to Atlas uses the same root-collapse/full-unfold grammar`, async ({ page }) => {
      await bypassIntro(page);
      await page.goto(`/#${source.route}`);
      await waitRouteCore(page, source.route, source.mode);
      if (source.mode === 'overview') {
        await page.waitForFunction(() => window.ProfileRootOverview?.snapshot?.().visible === true);
      }

      await page.locator('.atlas-button[data-route="atlas"]').click();
      await page.waitForFunction(() => Boolean(window.ProfileAtlasFocus?.snapshot?.().ready));
      await page.waitForFunction(() => document.body.dataset.profileAtlasPhase === 'collapse');
      await page.waitForFunction(() => document.body.dataset.profileAtlasPhase === 'unfold', null, { timeout: 5_000 });
      await waitSettled(page);
      const result = await page.evaluate(() => ({
        mode: document.body.dataset.graphMode,
        last: window.ProfileAtlasFocus.snapshot().lastResult,
        topology: window.ProfileAtlasLOD.snapshot().topologyMode,
        hidden: document.querySelectorAll('#site-graph .site-graph-node.is-atlas-lod-hidden').length
      }));
      expect(result.mode).toBe('atlas');
      expect(result.last.direction).toBe('profile-to-atlas');
      expect(result.last.anchorId).toBe(source.anchor);
      expect(result.topology).toBe('entry-full');
      expect(result.hidden).toBe(0);
    });
  }

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
  test.use({ viewport: { width: 1440, height: 900 } });

  test('keeps route semantics while suppressing bridge flight', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await bypassIntro(page);
    await page.goto(`/#${SAT_ROUTE}`);
    await waitRouteCore(page, SAT_ROUTE, 'focus');
    await page.locator('.atlas-button[data-route="atlas"]').click();
    await page.waitForFunction(() => Boolean(window.ProfileAtlasFocus?.snapshot?.().ready));
    await page.waitForFunction(() => document.body.dataset.graphMode === 'atlas');
    await waitSettled(page);
    await expect(page.locator('.atlas-focus-bridge')).toHaveCount(0);
    const snapshot = await page.evaluate(() => window.ProfileAtlasFocus.snapshot());
    expect(snapshot.reducedMotion).toBe(true);
    expect(snapshot.lastResult.result).toBe('completed');
    expect(snapshot.lastResult.targetRoute).toBe('atlas');
  });
});
