const { test, expect } = require('@playwright/test');

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const waitReady = async page => {
  await page.waitForFunction(() => Boolean(
    window.ProfileAccessibility?.snapshot?.().ready &&
    window.ProfileNodeDynamics?.snapshot &&
    window.ProfileGraphNavigation?.snapshot
  ), null, { timeout: 8000 });
};

const waitRoute = (page, route) => page.waitForFunction(expected =>
  document.body.dataset.graphRoute === expected &&
  !document.body.classList.contains('is-v9-transitioning'), route, { timeout: 8000 });

const waitNavigationIdle = page => page.waitForFunction(() =>
  window.ProfileGraphNavigation?.snapshot?.().phase === 'idle', null, { timeout: 8000 });

const setRoute = async (page, route) => {
  await page.evaluate(next => { location.hash = `#${next}`; }, route);
  await waitRoute(page, route);
};

const percentile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] || 0;
};

test.describe('V3.1 Phase K accessibility checkpoint', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('interactive graph is exposed as a labelled group with named keyboard controls and decorative edges hidden', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#overview');
    await waitReady(page);
    await page.waitForFunction(() => document.body.dataset.graphMode === 'overview' && document.body.dataset.rootLanding === 'false');

    const snapshot = await page.evaluate(() => window.ProfileAccessibility.snapshot());
    expect(snapshot.graphRole).toBe('group');
    expect(snapshot.graphLabelledBy).toContain('site-graph-title');
    expect(snapshot.graphLabelledBy).toContain('site-graph-help');
    expect(snapshot.edgesHidden).toBe(true);
    expect(snapshot.interactiveCount).toBeGreaterThanOrEqual(6);
    expect(snapshot.unnamedInteractiveCount).toBe(0);
    expect(snapshot.currentNavigationCount).toBeGreaterThanOrEqual(1);

    const knowledge = page.locator('#site-graph .site-graph-node[data-node-id="knowledge"]');
    await expect(knowledge).toHaveAttribute('role', 'button');
    await expect(knowledge).toHaveAttribute('tabindex', '0');
    await expect(knowledge).toHaveAttribute('aria-label', /Knowledge.*Open this profile area/i);
    await expect(page.locator('#site-graph .site-graph-edges')).toHaveAttribute('aria-hidden', 'true');

    await knowledge.focus();
    await expect(knowledge).toBeFocused();
    await page.keyboard.press('Enter');
    await waitRoute(page, 'knowledge');
    await expect(page.locator('#main-nav [data-route="knowledge"]')).toHaveAttribute('aria-current', 'page');
  });

  test('generated Work controls project canonical filter semantics and filtered projects leave the accessibility tab order', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#work');
    await waitReady(page);
    await page.waitForFunction(() =>
      document.body.dataset.graphMode === 'work' &&
      document.querySelectorAll('.work-theme-label-v5[data-theme-id]').length > 0 &&
      document.querySelectorAll('.work-project-anchor-v5[data-project-id]').length > 0
    );

    const themeId = await page.evaluate(() => {
      const projects = window.SITE_DATA?.work?.projects || [];
      const attributes = window.SITE_DATA?.work?.attributes || [];
      return attributes
        .map(attribute => ({ id: attribute.id, count: projects.filter(project => project.lattice?.includes(attribute.id)).length }))
        .filter(item => item.count > 0 && item.count < projects.length)
        .sort((a, b) => a.count - b.count)[0]?.id || attributes[0]?.id;
    });
    expect(themeId).toBeTruthy();

    const themes = page.locator('.work-theme-label-v5[data-theme-id]');
    const projects = page.locator('.work-project-anchor-v5[data-project-id]');
    expect(await themes.count()).toBeGreaterThan(0);
    expect(await projects.count()).toBeGreaterThan(0);

    for (let i = 0; i < await themes.count(); i += 1) {
      const control = themes.nth(i);
      await expect(control).toHaveAttribute('role', 'button');
      await expect(control).toHaveAttribute('aria-label', /Toggle Work theme/i);
      await expect(control).toHaveAttribute('aria-pressed', /true|false/);
    }
    for (let i = 0; i < await projects.count(); i += 1) {
      await expect(projects.nth(i)).toHaveAttribute('aria-label', /Open project/i);
    }

    // Drive the canonical Work filter control. The generated SVG theme label is
    // a projection of this state; Phase K is testing that projection contract,
    // while graph hit-testing is covered by the Work interaction suites.
    await page.evaluate(id => {
      const input = document.querySelector(`#work-theme-filters input[data-theme-id="${CSS.escape(id)}"]`);
      input?.click();
    }, themeId);
    await page.waitForFunction(id => document.querySelector(`#work-theme-filters input[data-theme-id="${CSS.escape(id)}"]`)?.checked, themeId);
    await expect(page.locator(`.work-theme-label-v5[data-theme-id="${themeId}"]`)).toHaveAttribute('aria-pressed', 'true');
    await page.waitForFunction(() => document.querySelectorAll('.work-project-anchor-v5.is-filtered-out').length > 0);
    await page.waitForFunction(() => window.ProfileAccessibility.snapshot().hiddenFocusableProjectCount === 0);

    const filtered = page.locator('.work-project-anchor-v5.is-filtered-out');
    expect(await filtered.count()).toBeGreaterThan(0);
    for (let i = 0; i < await filtered.count(); i += 1) {
      await expect(filtered.nth(i)).toHaveAttribute('tabindex', '-1');
      await expect(filtered.nth(i)).toHaveAttribute('aria-hidden', 'true');
    }
  });
});

test.describe('V3.1 Phase K mobile and motion checkpoint', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('touch Atlas preserves inspect-then-enter semantics with an explicit local action and mobile-weakened node dynamics', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#atlas');
    await waitReady(page);
    await page.waitForFunction(() => document.body.dataset.graphMode === 'atlas');

    const dynamics = await page.evaluate(() => window.ProfileNodeDynamics.snapshot());
    expect(dynamics.config.maxDisplacement).toBeLessThan(10);

    const knowledge = page.locator('#site-graph .site-graph-node[data-node-id="knowledge"]');
    await expect(knowledge).toHaveAttribute('aria-expanded', 'false');
    await knowledge.tap();
    await expect(knowledge).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#site-detail-panel')).toBeVisible();

    // Coarse-pointer UX has a stable explicit inspector action, so entering a
    // local graph does not depend on precisely re-tapping the same SVG point.
    const openLocal = page.locator('#site-detail-panel .atlas-open-local');
    await expect(openLocal).toBeVisible();
    await openLocal.tap();
    await page.waitForFunction(() => document.body.dataset.graphMode === 'focus' && document.body.dataset.graphRoute === 'knowledge', null, { timeout: 8000 });

    const viewport = await page.evaluate(() => ({
      scrollWidth: document.scrollingElement.scrollWidth,
      innerWidth,
      x: scrollX
    }));
    expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.innerWidth + 2);
    expect(Math.abs(viewport.x)).toBeLessThanOrEqual(1);
  });
});

test.describe('V3.1 Phase K reduced-motion semantic equivalence', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

  test('ordinary keyboard navigation keeps route and camera meaning while physical node motion stays disabled', async ({ page }) => {
    await bypassIntro(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#overview');
    await waitReady(page);

    const knowledge = page.locator('#site-graph .site-graph-node[data-node-id="knowledge"]');
    await knowledge.focus();
    await page.keyboard.press('Space');
    await waitRoute(page, 'knowledge');
    await waitNavigationIdle(page);

    const state = await page.evaluate(() => ({
      nav: window.ProfileGraphNavigation.snapshot(),
      dynamics: window.ProfileNodeDynamics.snapshot()
    }));
    expect(state.nav.lastResult.direction).toBe('down');
    expect(state.nav.lastResult.cameraAction).toBe('PUSH');
    expect(state.dynamics.enabled).toBe(false);
    expect(state.dynamics.maxDisplacement).toBe(0);
    expect(state.dynamics.adaptedEdgeCount).toBe(0);
  });
});

test.describe('V3.1 Phase K performance and retention checkpoint', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('repeated route stress does not retain transition DOM, dynamics records or material motion', async ({ page, context }) => {
    test.setTimeout(60000);
    await bypassIntro(page);
    await page.goto('/#overview');
    await waitReady(page);

    const client = await context.newCDPSession(page);
    await client.send('Performance.enable');
    await client.send('HeapProfiler.enable');
    const heap = async () => {
      const metrics = await client.send('Performance.getMetrics');
      return metrics.metrics.find(metric => metric.name === 'JSHeapUsedSize')?.value || 0;
    };

    const routes = ['knowledge', 'experience', 'education', 'about', 'work', 'overview'];
    for (const route of routes) await setRoute(page, route);
    await waitNavigationIdle(page);
    await client.send('HeapProfiler.collectGarbage');
    const beforeHeap = await heap();

    for (let round = 0; round < 2; round += 1) {
      for (const route of routes) await setRoute(page, route);
    }
    await waitNavigationIdle(page);
    await page.waitForFunction(() => {
      const state = window.ProfileNodeDynamics.snapshot();
      return state.movingNodeCount === 0 && state.adaptedEdgeCount === 0 && !state.transitionSettling;
    }, null, { timeout: 8000 });
    await client.send('HeapProfiler.collectGarbage');
    const afterHeap = await heap();

    const state = await page.evaluate(() => {
      const dynamics = window.ProfileNodeDynamics.snapshot();
      const liveNodes = [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
        .filter(node => !node.closest('.v9-transition-overlay')).length;
      return {
        dynamics,
        liveNodes,
        svgs: document.querySelectorAll('#site-graph .site-graph-svg').length,
        overlays: document.querySelectorAll('.v9-transition-overlay').length,
        detailPanels: document.querySelectorAll('#site-detail-panel').length,
        quickDialogs: document.querySelectorAll('.quick-overview-dialog').length,
        accessibilityScripts: document.querySelectorAll('script[data-profile-accessibility-runtime]').length
      };
    });

    expect(state.svgs).toBe(1);
    expect(state.overlays).toBe(0);
    expect(state.detailPanels).toBe(1);
    expect(state.quickDialogs).toBeLessThanOrEqual(1);
    expect(state.accessibilityScripts).toBe(1);
    expect(state.dynamics.nodeCount).toBe(state.liveNodes);
    expect(state.dynamics.movingNodeCount).toBe(0);
    expect(state.dynamics.adaptedEdgeCount).toBe(0);
    expect(afterHeap - beforeHeap).toBeLessThan(12 * 1024 * 1024);
  });

  test('Atlas dynamics stay inside an early frame-time budget and stop requesting frames after settle', async ({ page }) => {
    test.setTimeout(45000);
    await bypassIntro(page);
    await page.goto('/#atlas');
    await waitReady(page);
    await page.waitForFunction(() => document.body.dataset.graphMode === 'atlas' && document.querySelectorAll('#site-graph .site-graph-node[data-node-id]').length > 20);

    const readyAt = await page.evaluate(() => performance.now());
    expect(readyAt).toBeLessThan(5000);

    const intervals = await page.evaluate(() => new Promise(resolve => {
      const nodes = [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
        .filter(node => !node.closest('.v9-transition-overlay'))
        .slice(0, 8);
      const samples = [];
      let previous = 0;
      let index = 0;
      const step = now => {
        if (previous) samples.push(now - previous);
        previous = now;
        if (nodes.length && index % 8 === 0) {
          nodes[(index / 8) % nodes.length | 0].dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
        }
        index += 1;
        if (index < 90) requestAnimationFrame(step);
        else {
          nodes.forEach(node => node.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse' })));
          resolve(samples);
        }
      };
      requestAnimationFrame(step);
    }));

    expect(percentile(intervals, .5)).toBeLessThan(50);
    expect(percentile(intervals, .95)).toBeLessThan(120);

    await page.waitForFunction(() => {
      const state = window.ProfileNodeDynamics.snapshot();
      return state.movingNodeCount === 0 && state.adaptedEdgeCount === 0;
    }, null, { timeout: 8000 });
    const before = await page.evaluate(() => window.ProfileNodeDynamics.snapshot().frameCount);
    await page.waitForTimeout(220);
    const after = await page.evaluate(() => window.ProfileNodeDynamics.snapshot().frameCount);
    expect(after - before).toBeLessThanOrEqual(1);
  });
});
