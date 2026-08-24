const { test, expect } = require('@playwright/test');

const boot = async (page, route) => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/#${route}`);
  await page.waitForFunction(expected =>
    Boolean(
      window.ProfileTransitionCoordination &&
      window.ProfileGraphTransitions &&
      window.ProfileScene?.transitions &&
      document.body.dataset.graphRoute === expected
    ), route);
  await page.waitForFunction(() =>
    !document.body.classList.contains('is-v9-transitioning') &&
    !document.body.classList.contains('is-crosslink-travelling') &&
    !document.body.classList.contains('is-atlas-handoff'));
  await page.waitForTimeout(220);
};

const waitStableRoute = async (page, route) => {
  await page.waitForFunction(expected => document.body.dataset.graphRoute === expected, route);
  await page.waitForFunction(() =>
    !document.body.classList.contains('is-v9-transitioning') &&
    !document.body.classList.contains('is-crosslink-travelling') &&
    !document.body.classList.contains('is-atlas-handoff'));
};

test.describe('Phase G interruptible transition coordination', () => {
  test('rapid route input retargets the active graph transition from its interpolated state', async ({ page }) => {
    await boot(page, 'knowledge');

    await page.locator('#main-nav [data-route="experience"]').click();
    await page.waitForFunction(() => document.body.classList.contains('is-v9-transitioning'));
    await page.waitForTimeout(140);
    await page.locator('#main-nav [data-route="education"]').click();

    await waitStableRoute(page, 'education');
    await page.waitForTimeout(1150);
    expect(await page.evaluate(() => document.body.dataset.graphRoute)).toBe('education');

    const state = await page.evaluate(() => ({
      coordination: window.ProfileTransitionCoordination.snapshot(),
      graph: window.ProfileGraphTransitions.snapshot(),
      invariants: window.ProfilePhase0.checkGraphInvariants()
    }));
    expect(state.coordination.lastInterruption.targetRoute).toBe('education');
    expect(state.coordination.lastInterruption.captured['graph-transition'].active).toBe(true);
    expect(state.coordination.lastInterruption.captured['graph-transition'].nodeCount).toBeGreaterThan(0);
    expect(state.graph.transitioning).toBe(false);
    expect(state.invariants.orphanEdgeCount).toBe(0);
    expect(state.invariants.duplicateNodeIds).toEqual([]);
  });

  test('route navigation interrupts Object Focus without stale viewer resurrection', async ({ page }) => {
    await boot(page, 'work/project/bachelor-thesis');
    await page.waitForFunction(() => Boolean(window.ProfileObjectFocus));
    await page.waitForFunction(() => {
      window.ProfileTransitionCoordination.installParticipants();
      return window.ProfileScene.transitions.diagnostics().participants.includes('object-focus');
    });

    const card = page.locator('[data-artifact-scene="bachelor-thesis-diagrams"] button[data-artifact-id="bachelor-thesis-rol-non-a"]');
    await card.click();
    await page.waitForFunction(() => window.ProfileObjectFocus.snapshot().phase !== 'idle');
    await page.locator('#main-nav [data-route="knowledge"]').click({ force: true });

    await waitStableRoute(page, 'knowledge');
    await page.waitForTimeout(800);
    const state = await page.evaluate(() => ({
      focus: window.ProfileObjectFocus.snapshot(),
      coordination: window.ProfileTransitionCoordination.snapshot(),
      viewer: Boolean(document.querySelector('.artifact-focus-viewer:not([hidden])'))
    }));
    expect(state.focus.phase).toBe('idle');
    expect(state.viewer).toBe(false);
    expect(['opening', 'settled', 'closing']).toContain(state.coordination.lastInterruption.captured['object-focus'].phase);
    expect(await page.evaluate(() => document.body.dataset.graphRoute)).toBe('knowledge');
  });

  test('ordinary navigation cancels cross-link travel and prevents its stale destination commit', async ({ page }) => {
    await boot(page, 'work/project/modal-logic-lab');
    await page.waitForFunction(() => Boolean(window.ProfileCrossLinkTravel));
    const relation = await page.evaluate(() => {
      const source = window.ProfileCrossLinkTravel.snapshot().currentSourceId;
      return window.ProfileCrossLinkTravel.relationsFor(source)[0] || null;
    });
    expect(relation).not.toBeNull();

    await page.evaluate(item => {
      window.__phaseGTravel = window.ProfileCrossLinkTravel.navigate(item.targetId, item.type);
    }, relation);
    await page.waitForFunction(() => document.body.classList.contains('is-crosslink-travelling'));
    await page.waitForTimeout(100);
    await page.locator('#main-nav [data-route="education"]').click();

    await waitStableRoute(page, 'education');
    await page.waitForTimeout(1300);
    const state = await page.evaluate(() => ({
      route: document.body.dataset.graphRoute,
      travel: window.ProfileCrossLinkTravel.snapshot(),
      coordination: window.ProfileTransitionCoordination.snapshot()
    }));
    expect(state.route).toBe('education');
    expect(state.travel.travelling).toBe(false);
    expect(state.travel.overlayPresent).toBe(false);
    expect(state.travel.result).toBe('interrupted');
    expect(state.coordination.lastInterruption.captured['cross-link-travel'].travelling).toBe(true);
  });

  test('Atlas camera motion is interruptible by immediate Focus navigation', async ({ page }) => {
    await boot(page, 'atlas');
    await page.waitForFunction(() => Boolean(window.ProfileAtlasLOD && window.ProfileCameraComposition));
    await page.waitForFunction(() => window.ProfileCameraComposition.boot() === true);
    await page.waitForFunction(() => {
      window.ProfileTransitionCoordination.installParticipants();
      return window.ProfileScene.transitions.diagnostics().participants.includes('camera-composition');
    });

    const node = page.locator('#site-graph .site-graph-node[data-node-id="sat-smt"]');
    await node.click();
    await expect(node).toHaveClass(/is-previewed/);
    await node.click();
    await page.waitForFunction(() => window.ProfileTransitionCoordination.snapshot().cameraActive === true);
    await page.locator('#main-nav [data-route="knowledge"]').click();

    await page.waitForFunction(() =>
      document.body.dataset.graphRoute === 'knowledge' &&
      document.body.dataset.graphMode === 'focus');
    await page.waitForFunction(() => !document.body.classList.contains('is-atlas-handoff'));
    await page.waitForTimeout(500);

    const state = await page.evaluate(() => ({
      coordination: window.ProfileTransitionCoordination.snapshot(),
      camera: window.ProfileCameraComposition.snapshot(),
      route: document.body.dataset.graphRoute,
      mode: document.body.dataset.graphMode
    }));
    expect(state.route).toBe('knowledge');
    expect(state.mode).toBe('focus');
    expect(state.coordination.lastInterruption.captured['camera-composition'].adapter).toBe('atlas');
    expect(state.camera.adapter).toBe('desktop-local');
    expect(state.camera.localAnimating).toBe(false);
  });

  test('coordinator supersedes tokens and rejects stale completion', async ({ page }) => {
    await boot(page, 'knowledge');
    const result = await page.evaluate(() => {
      const transitions = window.ProfileScene.transitions;
      const first = transitions.begin({ kind: 'test', target: 'first' });
      const second = transitions.begin({ kind: 'test', target: 'second' });
      return {
        first,
        second,
        firstStillMatches: transitions.matches(first),
        secondMatches: transitions.matches(second),
        staleFinish: transitions.finish(first),
        secondFinish: transitions.finish(second),
        diagnostics: transitions.diagnostics()
      };
    });
    expect(result.first).not.toBe(result.second);
    expect(result.firstStillMatches).toBe(false);
    expect(result.secondMatches).toBe(true);
    expect(result.staleFinish).toBe(false);
    expect(result.secondFinish).toBe(true);
    expect(result.diagnostics.current).toBeNull();
  });
});
