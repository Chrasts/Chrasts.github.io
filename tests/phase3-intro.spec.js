const { test, expect } = require('@playwright/test');

const freshSession = async page => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__v31IntroFreshPrepared') !== 'true') {
      sessionStorage.removeItem('profileIntroSeen');
      sessionStorage.setItem('__v31IntroFreshPrepared', 'true');
    }
  });
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const waitReveal = async (page, timeout = 8_000) => {
  await page.waitForFunction(() => Boolean(window.ProfileIntro?.__v31), null, { timeout });
  await page.evaluate(() => {
    if (window.ProfileIntro.snapshot().state === 'ATLAS_READY') window.ProfileIntro.replay();
  });
  await page.waitForFunction(() => {
    const state = window.ProfileIntro?.snapshot?.();
    return Boolean(state?.state === 'ATLAS_REVEAL' && state.running && state.liveGraphPresent);
  }, null, { timeout });
  return page.evaluate(() => window.ProfileIntro.snapshot());
};

const waitReady = async (page, timeout = 8_000) => {
  await page.waitForFunction(() => window.ProfileIntro?.snapshot?.().state === 'ATLAS_READY', null, { timeout });
  return page.evaluate(() => window.ProfileIntro.snapshot());
};

const waitStableAtlas = async (page, timeout = 10_000) => {
  await page.waitForFunction(() => {
    const intro = window.ProfileIntro?.snapshot?.();
    const marker = document.documentElement.dataset.profileIntro || '';
    const safeIntroState = ['ATLAS_REVEAL', 'ATLAS_READY', 'BYPASSED'].includes(intro?.state) ||
      ['bypass', 'ready', 'complete'].includes(marker);
    return Boolean(
      safeIntroState &&
      document.body?.dataset.graphMode === 'atlas' &&
      document.querySelector('#site-graph .site-graph-svg') &&
      document.querySelectorAll('#site-graph .site-graph-node[data-node-id]').length >= (window.SITE_DATA?.graph?.nodes?.length || 1) &&
      !document.querySelector('#site-graph .phase-h-node-motion')
    );
  }, null, { timeout });
};

test.describe('V3.1 Phase E live Atlas reveal — desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('uses the real Atlas with one persistent root and no cinematic clone or node wrappers', async ({ page }) => {
    await freshSession(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    const running = await waitReveal(page);

    const state = await page.evaluate(() => ({
      snapshot: window.ProfileIntro.snapshot(),
      expectedNodes: window.SITE_DATA.graph.nodes.length,
      actualNodes: document.querySelectorAll('#site-graph .site-graph-node[data-node-id]').length,
      cloneOverlays: document.querySelectorAll('.profile-intro-overlay').length,
      legacyWrappers: document.querySelectorAll('#site-graph .phase-h-node-motion').length,
      rootCount: document.querySelectorAll('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').length,
      rootWave: document.querySelector('#site-graph .site-graph-node[data-node-id="stepan-chrast"]')?.dataset.introWave
    }));

    expect(running.canonicalStates.PREPARING).toBe('PREPARING');
    expect(running.canonicalStates.ATLAS_REVEAL).toBe('ATLAS_REVEAL');
    expect(running.canonicalStates.ATLAS_READY).toBe('ATLAS_READY');
    expect(state.snapshot.realGraph).toBe(true);
    expect(state.snapshot.persistentRoot).toBe(true);
    expect(state.actualNodes).toBe(state.expectedNodes);
    expect(state.cloneOverlays).toBe(0);
    expect(state.legacyWrappers).toBe(0);
    expect(state.rootCount).toBe(1);
    expect(state.rootWave).toBe('root');
    expect(errors).toEqual([]);
  });

  test('reveals the network in semantic waves while canonical node coordinates remain fixed', async ({ page }) => {
    await freshSession(page);
    await page.goto('/');
    await waitReveal(page);

    const before = await page.evaluate(() => [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
      .map(node => ({ id: node.dataset.nodeId, x: node.dataset.x, y: node.dataset.y })));

    await page.waitForFunction(() => window.ProfileIntro.snapshot().revealedWaves.includes('territories'));
    const middle = await page.evaluate(() => ({
      waves: window.ProfileIntro.snapshot().revealedWaves,
      primary: document.querySelectorAll('#site-graph .site-graph-node[data-intro-wave="primary"].is-intro-revealed').length,
      territory: document.querySelectorAll('#site-graph .site-graph-node[data-intro-wave="territory"].is-intro-revealed').length,
      deep: document.querySelectorAll('#site-graph .site-graph-node[data-intro-wave="deep"].is-intro-revealed').length,
      traced: document.querySelectorAll('#site-graph .site-graph-edges path.is-intro-revealed').length,
      territoryLayerOpacity: Number(getComputedStyle(document.querySelector('#site-graph .atlas-territory-label-layer')).opacity),
      coords: [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
        .map(node => ({ id: node.dataset.nodeId, x: node.dataset.x, y: node.dataset.y }))
    }));

    expect(middle.waves).toEqual(expect.arrayContaining(['root', 'primary', 'territories']));
    expect(middle.primary).toBeGreaterThanOrEqual(5);
    expect(middle.territory).toBeGreaterThan(0);
    const territoriesIndex = middle.waves.indexOf('territories');
    const deepIndex = middle.waves.indexOf('deep');
    if (deepIndex < 0) expect(middle.deep).toBe(0);
    else {
      expect(deepIndex).toBeGreaterThan(territoriesIndex);
      expect(middle.deep).toBeGreaterThan(0);
    }
    expect(middle.traced).toBeGreaterThan(0);
    if (!middle.waves.includes('labels')) expect(middle.territoryLayerOpacity).toBeLessThan(.1);
    expect(middle.coords).toEqual(before);

    await waitReady(page);
    const after = await page.evaluate(() => [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
      .map(node => ({ id: node.dataset.nodeId, x: node.dataset.x, y: node.dataset.y })));
    expect(after).toEqual(before);
  });

  test('holds ATLAS_READY as a permanent usable state instead of auto-condensing into root landing', async ({ page }) => {
    await freshSession(page);
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.ProfileIntro?.__v31));
    await page.waitForFunction(() => document.querySelector('#site-graph .site-graph-node[data-node-id="stepan-chrast"]'));
    await page.evaluate(() => {
      document.querySelector('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').dataset.v31PersistentRootProbe = 'same-root';
    });

    const ready = await waitReady(page);
    expect(ready.result).toBe('completed');
    expect(ready.route).toBe('atlas');
    expect(ready.graphMode).toBe('atlas');
    expect(ready.rootLanding).toBe(false);
    expect(ready.cloneOverlayPresent).toBe(false);
    await expect(page.locator('#site-explorer')).toBeVisible();
    await expect(page.locator('.hero-visual.profile-identity')).toBeHidden();

    await page.waitForTimeout(900);
    const stable = await page.evaluate(() => ({
      state: window.ProfileIntro.snapshot().state,
      graphMode: document.body.dataset.graphMode,
      route: document.body.dataset.graphRoute,
      rootLanding: document.body.dataset.rootLanding,
      probe: document.querySelector('#site-graph .site-graph-node[data-node-id="stepan-chrast"]')?.dataset.v31PersistentRootProbe,
      legacyWrappers: document.querySelectorAll('#site-graph .phase-h-node-motion').length,
      handoff: document.querySelectorAll('.phase-h-root-handoff,.profile-intro-overlay').length
    }));
    expect(stable.state).toBe('ATLAS_READY');
    expect(stable.graphMode).toBe('atlas');
    expect(stable.route).toBe('atlas');
    expect(stable.rootLanding).toBe('false');
    expect(stable.probe).toBe('same-root');
    expect(stable.legacyWrappers).toBe(0);
    expect(stable.handoff).toBe(0);
    expect(await page.evaluate(() => sessionStorage.getItem('profileIntroSeen'))).toBe('true');
  });

  test('waits for every critical initial resource and gives the reveal exclusive material-motion ownership', async ({ page }) => {
    await freshSession(page);
    await page.goto('/');
    const reveal = await waitReveal(page);
    expect(reveal.criticalReady).toBe(true);
    expect(reveal.readiness.atlasRoute).toBe(true);
    expect(reveal.readiness.graph).toBe(true);
    expect(reveal.readiness.css).toBe(true);
    expect(reveal.readiness.modules).toBe(true);
    expect(reveal.readiness.fonts).toBe(true);
    expect(reveal.readiness.portrait).toBe(true);
    expect(reveal.readiness.rootGeometry).toBe(true);
    expect(reveal.readiness.classified).toBe(true);
    expect(reveal.rootPresent).toBe(true);
    expect(reveal.graphMode).toBe('atlas');

    const ownership = await page.evaluate(() => ({
      dynamics: window.ProfileNodeDynamics?.snapshot?.(),
      camera: window.ProfileCameraMateriality?.snapshot?.(),
      cameraMoving: document.querySelector('#site-graph')?.classList.contains('is-camera-25d-moving') || false
    }));
    expect(ownership.dynamics.suspended).toBe(true);
    expect(ownership.dynamics.suspensionReason).toBe('intro');
    expect(ownership.dynamics.maxDisplacement).toBeLessThan(.05);
    expect(ownership.camera.introBlocked).toBe(true);
    expect(ownership.cameraMoving).toBe(false);
  });

  test('reveals LOD-aware territory labels after geometry and wakes cross-links later', async ({ page }) => {
    await freshSession(page);
    await page.goto('/');
    await waitReveal(page);
    await page.waitForFunction(() => window.ProfileIntro.snapshot().revealedWaves.includes('labels'));
    await page.waitForFunction(() => {
      const layer = document.querySelector('#site-graph .atlas-territory-label-layer');
      return Boolean(layer && Number(getComputedStyle(layer).opacity) > .5);
    });

    const labels = await page.evaluate(() => {
      const layer = document.querySelector('#site-graph .atlas-territory-label-layer');
      return {
        waves: window.ProfileIntro.snapshot().revealedWaves,
        territoryLabels: layer?.querySelectorAll('.atlas-territory-label').length || 0,
        territoryLayerOpacity: layer ? Number(getComputedStyle(layer).opacity) : 0
      };
    });
    expect(labels.waves).toContain('labels');
    expect(labels.territoryLabels).toBeGreaterThanOrEqual(5);
    expect(labels.territoryLayerOpacity).toBeGreaterThan(.5);

    await page.waitForFunction(() => window.ProfileIntro.snapshot().revealedWaves.includes('cross'));
    const order = await page.evaluate(() => window.ProfileIntro.snapshot().revealedWaves);
    expect(order.indexOf('labels')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('cross')).toBeGreaterThan(order.indexOf('labels'));
    expect(await page.locator('#site-graph .site-graph-edges path[data-intro-edge-wave="cross"].is-intro-revealed').count()).toBeGreaterThan(0);
  });

  test('breakpoint crossing during reveal always resolves to a live stable Atlas', async ({ page }) => {
    await freshSession(page);
    await page.goto('/');
    await waitReveal(page);
    await page.waitForFunction(() => window.ProfileIntro.snapshot().revealedWaves.includes('labels'));

    // Mobile boundary crossing may perform a clean reload. The semantic contract is
    // therefore a complete live Atlas, whether the intro controller remains mounted
    // or the reloaded page has already entered the explicit bypass state.
    await page.setViewportSize({ width: 390, height: 844 });
    await waitStableAtlas(page);
    let state = await page.evaluate(() => ({
      mode: document.body.dataset.graphMode,
      intro: window.ProfileIntro?.snapshot?.().state || document.documentElement.dataset.profileIntro,
      cloneCount: document.querySelectorAll('.profile-intro-overlay,.phase-h-node-motion').length
    }));
    expect(state.mode).toBe('atlas');
    expect(['ATLAS_REVEAL', 'ATLAS_READY', 'BYPASSED', 'bypass', 'ready', 'complete']).toContain(state.intro);
    expect(state.cloneCount).toBe(0);

    await page.setViewportSize({ width: 1280, height: 800 });
    await waitStableAtlas(page);
    state = await page.evaluate(() => ({
      mode: document.body.dataset.graphMode,
      intro: window.ProfileIntro?.snapshot?.().state || document.documentElement.dataset.profileIntro,
      cloneCount: document.querySelectorAll('.profile-intro-overlay,.phase-h-node-motion').length
    }));
    expect(state.mode).toBe('atlas');
    expect(['ATLAS_REVEAL', 'ATLAS_READY', 'BYPASSED', 'bypass', 'ready', 'complete']).toContain(state.intro);
    expect(state.cloneCount).toBe(0);
  });

  test('Escape and Tab accelerate safely into ATLAS_READY; Tab restores keyboard focus to root', async ({ page }) => {
    await freshSession(page);
    await page.goto('/');
    await waitReveal(page);
    await page.keyboard.press('Escape');
    const skipped = await waitReady(page);
    expect(skipped.result).toBe('skipped');
    expect(skipped.graphMode).toBe('atlas');

    await page.evaluate(() => {
      sessionStorage.removeItem('profileIntroSeen');
      sessionStorage.removeItem('__v31IntroFreshPrepared');
    });
    await page.goto('/');
    await waitReveal(page);
    await page.keyboard.press('Tab');
    const keyboard = await waitReady(page);
    expect(keyboard.result).toBe('keyboard');
    await expect(page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]')).toBeFocused();
  });

  test('late reveal can retarget directly to a meaningful node without waiting for completion', async ({ page }) => {
    await freshSession(page);
    await page.goto('/');
    await waitReveal(page);
    await page.waitForFunction(() => document.body.classList.contains('is-atlas-reveal-late'));
    await page.evaluate(() => {
      const node = document.querySelector('#site-graph .site-graph-node[data-node-id="knowledge"]');
      node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    });
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge', null, { timeout: 6_000 });
    const snapshot = await page.evaluate(() => window.ProfileIntro.snapshot());
    expect(snapshot.result).toBe('interrupted');
    expect(snapshot.targetRoute).toBe('knowledge');
    expect(await page.evaluate(() => document.body.dataset.graphMode)).toBe('focus');
  });

  test('same-session refresh bypasses the reveal and deep links never run it', async ({ page }) => {
    await freshSession(page);
    await page.goto('/');
    await waitReady(page);
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.profileIntro === 'bypass');
    expect(await page.evaluate(() => Boolean(window.ProfileIntro))).toBe(false);
    expect(await page.evaluate(() => document.body.dataset.graphMode)).toBe('atlas');

    const deepPage = await page.context().newPage();
    await deepPage.addInitScript(() => sessionStorage.clear());
    await deepPage.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
    await deepPage.goto('/#knowledge');
    await deepPage.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge');
    expect(await deepPage.evaluate(() => Boolean(window.ProfileIntro))).toBe(false);
    expect(await deepPage.evaluate(() => document.documentElement.dataset.profileIntro)).toBe('bypass');
    expect(await deepPage.evaluate(() => document.body.dataset.graphRoute)).toBe('knowledge');
    await deepPage.close();
  });
});

test.describe('V3.1 Phase E reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

  test('uses a short semantic reveal and still ends in ATLAS_READY', async ({ page }) => {
    await freshSession(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const ready = await waitReady(page, 5_000);
    expect(ready.reducedMotion).toBe(true);
    expect(ready.state).toBe('ATLAS_READY');
    expect(ready.graphMode).toBe('atlas');
    expect(ready.elapsed).toBeLessThan(2_000);
  });
});

test.describe('V3.1 Phase E mobile composition', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('prepares the complete label field behind the reveal mask and lands in the live mobile Atlas', async ({ page }) => {
    await freshSession(page);
    await page.goto('/');
    await waitReveal(page);
    await page.waitForFunction(() => window.ProfileIntro.snapshot().revealedWaves.includes('labels'));
    const mobile = await page.evaluate(() => ({
      snapshot: window.ProfileIntro.snapshot(),
      deepLabelsTotal: document.querySelectorAll('#site-graph .site-graph-node[data-intro-wave="deep"] .site-graph-label').length,
      intermediateLabelsTotal: document.querySelectorAll('#site-graph .site-graph-node[data-intro-wave="intermediate"] .site-graph-label').length,
      labelledNodes: document.querySelectorAll('#site-graph .site-graph-node[data-node-id] .site-graph-label').length,
      graphNodes: document.querySelectorAll('#site-graph .site-graph-node[data-node-id]').length,
      revealActive: document.body.classList.contains('is-atlas-reveal'),
      topology: document.body.dataset.atlasTopology
    }));
    expect(mobile.snapshot.mobile).toBe(true);
    expect(mobile.snapshot.revealedWaves).toContain('labels');
    expect(mobile.deepLabelsTotal).toBeGreaterThan(0);
    expect(mobile.intermediateLabelsTotal).toBeGreaterThan(0);
    expect(mobile.labelledNodes).toBe(mobile.graphNodes);
    expect(mobile.revealActive).toBe(true);
    expect(mobile.topology).toBe('entry-full');

    const ready = await waitReady(page);
    expect(ready.graphMode).toBe('atlas');
    await expect(page.locator('#site-explorer')).toBeVisible();
  });
});
