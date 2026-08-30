const { test, expect } = require('@playwright/test');

const COMPUTATIONAL_ROUTE = 'knowledge/logic-math/mathematical-logic/computational-logic';
const COMPUTATIONAL_NODE = 'computational-logic';

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const waitReady = async page => {
  await page.waitForFunction(() => Boolean(
    window.ProfileGraphNavigation?.snapshot?.().ready &&
    window.ProfileNodeDynamics &&
    window.ProfileGraphFeel &&
    window.ProfileCameraMateriality
  ));
};

const waitRoute = (page, route) => page.waitForFunction(expected =>
  document.body.dataset.graphRoute === expected &&
  !document.body.classList.contains('is-v9-transitioning'), route, { timeout: 6000 });

const waitSettle = (page, targetId) => page.waitForFunction(expected => {
  const state = window.ProfileGraphNavigation?.snapshot?.();
  return state?.phase === 'settle' && state.targetId === expected;
}, targetId, { timeout: 6000 });

const waitIdle = page => page.waitForFunction(() =>
  window.ProfileGraphNavigation?.snapshot?.().phase === 'idle', null, { timeout: 6000 });

const canonical = page => page.evaluate(() => Object.fromEntries(
  [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
    .filter(node => !node.closest('.v9-transition-overlay'))
    .map(node => [node.dataset.nodeId, { x: node.dataset.x, y: node.dataset.y }])
));

test.describe('V3.1 Phase J ordinary graph navigation materiality', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('downward navigation resolves to PUSH and settles node, edge, halo and label materiality around the arrival target', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#overview');
    await waitReady(page);
    await page.waitForFunction(() => document.body.dataset.graphMode === 'overview' && document.body.dataset.rootLanding === 'false');

    await page.locator('#site-graph .site-graph-node[data-node-id="knowledge"]').click();
    await waitRoute(page, 'knowledge');
    await waitSettle(page, 'knowledge');
    // V9 owns the route-dependent destination layout. Phase J begins only after
    // that handoff, so its invariant is that the destination canonical data-x/y
    // remain unchanged throughout the ephemeral arrival settle.
    const destinationCanonical = await canonical(page);

    let state = await page.evaluate(() => ({
      nav: window.ProfileGraphNavigation.snapshot(),
      dynamics: window.ProfileNodeDynamics.snapshot(),
      feel: window.ProfileGraphFeel.snapshot(),
      camera: window.ProfileCameraMateriality.snapshot(),
      arrivalClass: document.querySelector('#site-graph .site-graph-node[data-node-id="knowledge"]')?.classList.contains('is-navigation-arrival') || false
    }));
    expect(state.nav.direction).toBe('down');
    expect(state.nav.cameraAction).toBe('PUSH');
    expect(state.dynamics.transitionSettling).toBe(true);
    expect(state.dynamics.lastTransitionSettle.anchorId).toBe('knowledge');
    expect(state.dynamics.lastTransitionSettle.applied).toBe(true);
    expect(state.dynamics.maxDisplacement).toBeGreaterThan(.2);
    expect(state.feel.navigationTargetId).toBe('knowledge');
    expect(state.feel.navigationEdgeCount).toBeGreaterThan(0);
    expect(state.arrivalClass).toBe(true);
    expect(['PUSH', 'IDLE']).toContain(state.camera.action);
    expect(state.camera.action === 'PUSH' || state.camera.lastAction === 'PUSH').toBe(true);

    await waitIdle(page);
    state = await page.evaluate(() => ({
      nav: window.ProfileGraphNavigation.snapshot(),
      dynamics: window.ProfileNodeDynamics.snapshot(),
      feel: window.ProfileGraphFeel.snapshot()
    }));
    expect(state.nav.lastResult.result).toBe('completed');
    expect(state.nav.lastResult.direction).toBe('down');
    expect(state.nav.lastResult.cameraAction).toBe('PUSH');
    expect(state.dynamics.transitionSettling).toBe(false);
    expect(state.dynamics.maxDisplacement).toBeLessThan(.08);
    expect(state.dynamics.adaptedEdgeCount).toBe(0);
    expect(state.feel.navigationEdgeCount).toBe(0);

    const after = await canonical(page);
    Object.keys(destinationCanonical).filter(id => after[id]).forEach(id => expect(after[id]).toEqual(destinationCanonical[id]));
  });

  test('moving to an ancestor resolves to PULL', async ({ page }) => {
    await bypassIntro(page);
    const childRoute = 'knowledge/logic-math/mathematical-logic/modal-logic';
    const parentRoute = 'knowledge/logic-math/mathematical-logic';
    await page.goto(`/#${childRoute}`);
    await waitReady(page);
    await page.waitForFunction(expected => document.body.dataset.graphRoute === expected, childRoute);

    await page.evaluate(route => { location.hash = `#${route}`; }, parentRoute);
    await waitRoute(page, parentRoute);
    await waitSettle(page, 'mathematical-logic');
    const state = await page.evaluate(() => window.ProfileGraphNavigation.snapshot());
    expect(state.sourceId).toBe('modal-logic');
    expect(state.targetId).toBe('mathematical-logic');
    expect(state.direction).toBe('up');
    expect(state.cameraAction).toBe('PULL');
    await waitIdle(page);
    expect((await page.evaluate(() => window.ProfileGraphNavigation.snapshot().lastResult.cameraAction))).toBe('PULL');
  });

  test('lateral top-level navigation resolves to FOLLOW without inventing a hierarchy relation', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#knowledge');
    await waitReady(page);
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge');

    await page.locator('#main-nav [data-route="experience"]').first().click({ force: true });
    await waitRoute(page, 'experience');
    await waitSettle(page, 'experience');
    const state = await page.evaluate(() => window.ProfileGraphNavigation.snapshot());
    expect(state.sourceId).toBe('knowledge');
    expect(state.targetId).toBe('experience');
    expect(state.direction).toBe('lateral');
    expect(state.cameraAction).toBe('FOLLOW');
    await waitIdle(page);
  });

  test('a new route during arrival settle cleanly supersedes transient materiality', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#overview');
    await waitReady(page);
    await page.waitForFunction(() => document.body.dataset.graphMode === 'overview');

    await page.locator('#site-graph .site-graph-node[data-node-id="knowledge"]').click();
    await waitRoute(page, 'knowledge');
    await waitSettle(page, 'knowledge');
    const beforeInterrupt = await page.evaluate(() => window.ProfileGraphNavigation.snapshot().interruptionCount);

    await page.locator('#main-nav [data-route="experience"]').first().click({ force: true });
    await waitRoute(page, 'experience');
    await waitIdle(page);

    const final = await page.evaluate(() => ({
      nav: window.ProfileGraphNavigation.snapshot(),
      dynamics: window.ProfileNodeDynamics.snapshot(),
      feel: window.ProfileGraphFeel.snapshot(),
      arrivalClasses: document.querySelectorAll('#site-graph .site-graph-node.is-navigation-arrival').length,
      settlingEdges: document.querySelectorAll('#site-graph .site-graph-edges path.is-navigation-settling-edge').length
    }));
    expect(final.nav.interruptionCount).toBeGreaterThan(beforeInterrupt);
    expect(final.nav.lastResult.result).toBe('completed');
    expect(final.nav.lastResult.targetId).toBe('experience');
    expect(final.dynamics.transitionSettling).toBe(false);
    expect(final.dynamics.maxDisplacement).toBeLessThan(.08);
    expect(final.dynamics.adaptedEdgeCount).toBe(0);
    expect(final.feel.navigationEdgeCount).toBe(0);
    expect(final.arrivalClasses).toBe(0);
    expect(final.settlingEdges).toBe(0);
  });

  test('Atlas / Focus semantic-scale transitions remain owned by Phase I rather than receiving a second Phase J settle', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#atlas');
    await waitReady(page);
    await page.waitForFunction(() => Boolean(window.ProfileAtlasFocus) && document.body.dataset.graphMode === 'atlas');

    const node = page.locator(`#site-graph .site-graph-node[data-node-id="${COMPUTATIONAL_NODE}"]`);
    await node.click();
    await node.click();
    await page.waitForFunction(route => document.body.dataset.graphMode === 'focus' && document.body.dataset.graphRoute === route, COMPUTATIONAL_ROUTE);
    await page.waitForFunction(() => !window.ProfileAtlasFocus.snapshot().active, null, { timeout: 6000 });

    const state = await page.evaluate(() => window.ProfileGraphNavigation.snapshot());
    expect(state.phase).toBe('idle');
    expect(state.targetId).toBeNull();
  });
});

test.describe('V3.1 Phase J reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

  test('preserves semantic direction and camera intent without spring, label or edge motion', async ({ page }) => {
    await bypassIntro(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#overview');
    await waitReady(page);
    await page.locator('#site-graph .site-graph-node[data-node-id="knowledge"]').click();
    await waitRoute(page, 'knowledge');
    await waitIdle(page);

    const state = await page.evaluate(() => ({
      nav: window.ProfileGraphNavigation.snapshot(),
      dynamics: window.ProfileNodeDynamics.snapshot(),
      bodySettling: document.body.classList.contains('is-graph-navigation-settling'),
      arrivalClasses: document.querySelectorAll('#site-graph .site-graph-node.is-navigation-arrival').length,
      settlingEdges: document.querySelectorAll('#site-graph .site-graph-edges path.is-navigation-settling-edge').length
    }));
    expect(state.nav.reducedMotion).toBe(true);
    expect(state.nav.lastResult.result).toBe('completed');
    expect(state.nav.lastResult.direction).toBe('down');
    expect(state.nav.lastResult.cameraAction).toBe('PUSH');
    expect(state.nav.lastResult.impulseApplied).toBe(false);
    expect(state.dynamics.transitionSettling).toBe(false);
    expect(state.dynamics.maxDisplacement).toBe(0);
    expect(state.bodySettling).toBe(false);
    expect(state.arrivalClasses).toBe(0);
    expect(state.settlingEdges).toBe(0);
  });
});
