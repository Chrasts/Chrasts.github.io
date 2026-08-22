const { test, expect } = require('@playwright/test');

const settle = async page => {
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  await page.waitForTimeout(220);
};

const boot = async page => {
  await page.route('https://cloud.umami.is/**', route => route.abort());
  await page.goto('/#overview');
  await page.waitForFunction(() => Boolean(window.ProfileScene?.manager));
  await page.waitForFunction(() => Boolean(document.body.dataset.graphMode));
  await page.waitForFunction(() => Boolean(document.querySelector('#site-graph .site-graph-svg')));
  await settle(page);
  await page.waitForFunction(() => window.ProfileScene.manager.snapshot().objects.length >= 5);
};

const goRoute = async (page, route) => {
  await page.locator(`#main-nav [data-route="${route}"]`).first().click({ force: true });
  await page.waitForFunction(expected => document.body.dataset.graphRoute === expected, route);
  await settle(page);
};

test.describe('Phase 1 scene architecture — desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('registers the initial real scene objects with declarative contracts', async ({ page }) => {
    await boot(page);

    const registry = await page.evaluate(() => window.ProfileScene.registry.all().map(definition => ({
      id: definition.id,
      hasVisible: typeof definition.visible === 'function' || typeof definition.visible === 'boolean',
      hasPlacement: Boolean(definition.placement),
      hasEnter: Boolean(definition.enter),
      hasExit: Boolean(definition.exit),
      desktop: Boolean(definition.variants?.desktop),
      mobile: Boolean(definition.variants?.mobile)
    })));

    for (const id of ['root-profile-copy', 'portrait', 'work-controls', 'atlas-controls', 'detail-panel']) {
      const definition = registry.find(item => item.id === id);
      expect(definition, `${id} should be registered`).toBeTruthy();
      expect(definition.hasVisible).toBe(true);
      expect(definition.hasPlacement).toBe(true);
      expect(definition.hasEnter).toBe(true);
      expect(definition.hasExit).toBe(true);
      expect(definition.desktop).toBe(true);
      expect(definition.mobile).toBe(true);
    }
  });

  test('overview exposes desktop scene composition without changing graph semantics', async ({ page }) => {
    await boot(page);

    const snapshot = await page.evaluate(() => window.ProfileScene.manager.snapshot());
    expect(snapshot.variant).toBe('desktop');
    expect(snapshot.graphState.mode).toBe('overview');
    expect(snapshot.graphState.route).toBe('overview');
    expect(snapshot.camera.adapter).toBe('desktop-local');

    await expect(page.locator('.hero-copy')).toHaveAttribute('data-scene-object', 'root-profile-copy');
    await expect(page.locator('.hero-copy')).toHaveAttribute('data-scene-placement', 'identity-copy-left');
    await expect(page.locator('.hero-visual.profile-identity')).toHaveAttribute('data-scene-placement', 'identity-portrait-right');
    await expect(page.locator('.hero')).toHaveAttribute('data-scene-visible', 'true');
  });

  test('Work and Atlas select their declared objects and camera adapters', async ({ page }) => {
    await boot(page);

    await goRoute(page, 'work');
    let snapshot = await page.evaluate(() => window.ProfileScene.manager.snapshot());
    expect(snapshot.graphState.mode).toBe('work');
    expect(snapshot.camera.adapter).toBe('desktop-local');
    await expect(page.locator('.integrated-work-controls')).toHaveAttribute('data-scene-visible', 'true');
    await expect(page.locator('.integrated-work-controls')).toHaveAttribute('data-scene-placement', 'work-side-rails');
    await expect(page.locator('.hero')).toHaveAttribute('data-scene-visible', 'false');

    await goRoute(page, 'atlas');
    snapshot = await page.evaluate(() => window.ProfileScene.manager.snapshot());
    expect(snapshot.graphState.mode).toBe('atlas');
    expect(snapshot.camera.adapter).toBe('atlas');
    await expect(page.locator('#atlas-controls')).toHaveAttribute('data-scene-visible', 'true');
    await expect(page.locator('#atlas-controls')).toHaveAttribute('data-scene-placement', 'atlas-bottom-toolbar');
  });

  test('legacy graph transition is surfaced through TransitionCoordinator hooks', async ({ page }) => {
    await boot(page);

    const phases = [];
    await page.exposeFunction('recordScenePhase', phase => phases.push(phase));
    await page.evaluate(() => {
      ['begin', 'prepare', 'commit', 'finish'].forEach(phase => {
        window.ProfileScene.transitions.hook(phase, () => window.recordScenePhase(phase));
      });
    });

    await page.locator('#main-nav [data-route="knowledge"]').first().click({ force: true });
    await page.waitForFunction(() =>
      window.ProfileScene.transitions.isLocked ||
      document.body.classList.contains('is-v9-transitioning')
    );
    await settle(page);
    await page.waitForFunction(() => window.ProfileScene.transitions.isLocked === false);

    expect(phases[0]).toBe('begin');
    expect(phases).toContain('prepare');
    expect(phases).toContain('commit');
    expect(phases.at(-1)).toBe('finish');
    expect(await page.evaluate(() => window.ProfileScene.manager.graphState.route)).toBe('knowledge');
  });

  test('Phase 0 graph invariants remain healthy with the scene layer active', async ({ page }) => {
    await boot(page);
    for (const route of ['knowledge', 'overview', 'work', 'overview', 'atlas', 'overview']) {
      await goRoute(page, route);
      const state = await page.evaluate(() => window.ProfilePhase0.checkGraphInvariants());
      expect(state.duplicateNodeIds).toEqual([]);
      expect(state.orphanEdgeCount).toBe(0);
      expect(state.sceneVariant).toBe('desktop');
      expect(state.sceneTransitionLocked).toBe(false);
    }
  });
});

test.describe('Phase 1 scene architecture — mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('uses mobile variants while preserving the same scene object identities', async ({ page }) => {
    await boot(page);
    await page.waitForFunction(() => Boolean(window.MobileProfileScene));
    await page.waitForTimeout(120);

    const snapshot = await page.evaluate(() => window.ProfileScene.manager.snapshot());
    expect(snapshot.variant).toBe('mobile');
    expect(snapshot.graphState.mode).toBe('overview');
    expect(snapshot.camera.adapter).toBe('mobile-local');

    await expect(page.locator('.hero-copy')).toHaveAttribute('data-scene-object', 'root-profile-copy');
    await expect(page.locator('.hero-copy')).toHaveAttribute('data-scene-placement', 'identity-copy-upper');
    await expect(page.locator('.hero-visual.profile-identity')).toHaveAttribute('data-scene-placement', 'identity-portrait-upper-right');

    await page.locator('#main-nav [data-route="work"]').first().click({ force: true });
    await page.waitForFunction(() => document.body.dataset.graphMode === 'work');
    await settle(page);
    await expect(page.locator('.integrated-work-controls')).toHaveAttribute('data-scene-placement', 'control-sheet');

    await page.locator('.atlas-button').click({ force: true });
    await page.waitForFunction(() => document.body.dataset.graphMode === 'atlas');
    await settle(page);
    expect(await page.evaluate(() => window.ProfileScene.camera.activeName)).toBe('atlas');
    await expect(page.locator('#atlas-controls')).toHaveAttribute('data-scene-placement', 'control-sheet');
  });
});
