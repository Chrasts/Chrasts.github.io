const { test, expect } = require('@playwright/test');

const freshSession = async page => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__phaseHFreshPrepared') !== 'true') {
      sessionStorage.removeItem('profileIntroSeen');
      sessionStorage.removeItem('__phase3FreshPrepared');
      sessionStorage.setItem('__phaseHFreshPrepared', 'true');
    }
  });
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const waitIntro = async page => {
  await page.waitForFunction(() => Boolean(window.ProfileIntro?.__phaseH), null, { timeout: 8_000 });
  return page.evaluate(() => window.ProfileIntro.snapshot());
};

const waitRunning = async (page, timeout = 8_000) => {
  await page.waitForFunction(() => {
    const state = window.ProfileIntro?.snapshot?.();
    return Boolean(state?.running && !state.result && state.liveGraphPresent);
  }, null, { timeout });
  return page.evaluate(() => window.ProfileIntro.snapshot());
};

const rank = stage => ({ pending: 0, atlas: 1, wake: 2, condensing: 3, branches: 4, absorbing: 5, handoff: 6, complete: 7 }[stage] ?? -1);

const waitAtLeast = async (page, expected, timeout = 8_000) => {
  const expectedRank = rank(expected);
  await page.waitForFunction(({ expectedRank }) => {
    const stage = window.ProfileIntro?.snapshot?.().stage;
    const ranks = { pending: 0, atlas: 1, wake: 2, condensing: 3, branches: 4, absorbing: 5, handoff: 6, complete: 7 };
    return (ranks[stage] ?? -1) >= expectedRank;
  }, { expectedRank }, { timeout });
  return page.evaluate(() => window.ProfileIntro.snapshot());
};

const waitComplete = async (page, timeout = 10_000) => {
  await page.waitForFunction(() => window.ProfileIntro?.snapshot().stage === 'complete', null, { timeout });
  return page.evaluate(() => window.ProfileIntro.snapshot());
};

test.describe('Phase H Intro Animation 2.0 — desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('uses the live Atlas rather than a cloned intro graph', async ({ page }) => {
    await freshSession(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await waitRunning(page);

    const state = await page.evaluate(() => ({
      snapshot: window.ProfileIntro.snapshot(),
      cloneOverlayCount: document.querySelectorAll('.profile-intro-overlay').length,
      motionWrapperCount: document.querySelectorAll('#site-graph .phase-h-node-motion').length,
      expectedNodes: window.SITE_DATA.graph.nodes.length,
      actualNodes: document.querySelectorAll('#site-graph .site-graph-node[data-node-id]').length
    }));

    expect(state.snapshot.realGraph).toBe(true);
    expect(state.snapshot.persistentRoot).toBe(true);
    expect(state.cloneOverlayCount).toBe(0);
    expect(state.motionWrapperCount).toBeGreaterThan(5);
    expect(state.actualNodes).toBe(state.expectedNodes);
    expect(errors).toEqual([]);
  });

  test('keeps the same root DOM node through semantic condensation and exposes a readable five-branch phase', async ({ page }) => {
    await freshSession(page);
    await page.goto('/');
    await waitRunning(page);

    await page.evaluate(() => {
      const root = document.querySelector('#site-graph .site-graph-node[data-node-id="stepan-chrast"]');
      root.dataset.phaseHIdentityProbe = 'persistent-root';
    });

    await waitAtLeast(page, 'condensing');
    const moved = await page.evaluate(() => {
      const deep = [...document.querySelectorAll('#site-graph .site-graph-node[data-phase-h-tier="deep"]')][0];
      const wrapper = deep?.querySelector(':scope > .phase-h-node-motion');
      return Boolean(wrapper && wrapper.getAttribute('transform') && wrapper.getAttribute('transform') !== 'translate(0.00 0.00) scale(1.0000)');
    });
    expect(moved).toBe(true);

    await page.waitForFunction(() => window.ProfileIntro?.snapshot().stage === 'branches', null, { timeout: 8_000 });
    const branches = await page.evaluate(() => ({
      probe: document.querySelector('#site-graph .site-graph-node[data-node-id="stepan-chrast"]')?.dataset.phaseHIdentityProbe,
      rootOpacity: Number(getComputedStyle(document.querySelector('#site-graph .site-graph-node[data-node-id="stepan-chrast"]')).opacity),
      sections: ['work', 'knowledge', 'experience', 'education', 'about'].map(id => {
        const node = document.querySelector(`#site-graph .site-graph-node[data-node-id="${id}"]`);
        return { id, opacity: Number(getComputedStyle(node).opacity) };
      }),
      deepVisible: [...document.querySelectorAll('#site-graph .site-graph-node[data-phase-h-tier="deep"]')]
        .filter(node => Number(getComputedStyle(node).opacity) > .08).length
    }));

    expect(branches.probe).toBe('persistent-root');
    expect(branches.rootOpacity).toBeGreaterThan(.8);
    expect(branches.sections.every(item => item.opacity > .55)).toBe(true);
    expect(branches.deepVisible).toBeLessThanOrEqual(2);
  });

  test('automatically folds into the stable root landing with no second gateway click', async ({ page }) => {
    await freshSession(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    const completed = await waitComplete(page);

    expect(completed.result).toBe('completed');
    expect(completed.route).toBe('overview');
    expect(completed.rootLanding).toBe(true);
    expect(completed.cloneOverlayPresent).toBe(false);
    expect(await page.evaluate(() => sessionStorage.getItem('profileIntroSeen'))).toBe('true');
    await expect(page.locator('.root-node-trigger')).toBeVisible();
    await expect(page.locator('.hero-visual.profile-identity')).toBeVisible();
    await expect(page.locator('.phase-h-latent-stub')).toHaveCount(5);
    await expect(page.locator('#site-explorer')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('Escape and Tab immediately complete the intro to an accessible root landing', async ({ page }) => {
    await freshSession(page);
    await page.goto('/');
    await waitRunning(page);
    await page.keyboard.press('Escape');
    const skipped = await waitComplete(page);
    expect(skipped.result).toBe('skipped');
    expect(skipped.rootLanding).toBe(true);

    await page.evaluate(() => {
      sessionStorage.removeItem('profileIntroSeen');
      sessionStorage.removeItem('__phaseHFreshPrepared');
    });
    await page.reload();
    await waitRunning(page);
    await page.keyboard.press('Tab');
    const keyboard = await waitComplete(page);
    expect(keyboard.result).toBe('completed');
    expect(keyboard.rootLanding).toBe(true);
    await expect(page.locator('.root-node-trigger')).toBeFocused();
  });

  test('clicking a visible Atlas node retargets out of the intro instead of waiting for the cinematic', async ({ page }) => {
    await freshSession(page);
    await page.goto('/');
    await waitRunning(page);
    await page.waitForTimeout(220);
    await page.locator('#site-graph .site-graph-node[data-node-id="knowledge"]').click({ force: true });
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge', null, { timeout: 6_000 });
    const snapshot = await page.evaluate(() => window.ProfileIntro.snapshot());
    expect(snapshot.result).toBe('interrupted');
    expect(snapshot.targetRoute).toBe('knowledge');
    expect(await page.evaluate(() => document.body.dataset.graphMode)).toBe('focus');
    expect(await page.evaluate(() => sessionStorage.getItem('profileIntroSeen'))).toBe('true');
  });

  test('refresh in the same session bypasses the cinematic and deep links never run it', async ({ page }) => {
    await freshSession(page);
    await page.goto('/');
    await waitComplete(page);
    await page.reload();
    const refreshed = await waitIntro(page);
    expect(refreshed.eligible).toBe(false);
    expect(refreshed.result).toBe('bypassed');
    expect(refreshed.rootLanding).toBe(true);

    const deepPage = await page.context().newPage();
    await deepPage.addInitScript(() => sessionStorage.clear());
    await deepPage.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
    await deepPage.goto('/#knowledge');
    await deepPage.waitForFunction(() => Boolean(window.ProfileIntro?.__phaseH));
    const deep = await deepPage.evaluate(() => window.ProfileIntro.snapshot());
    expect(deep.eligible).toBe(false);
    expect(deep.result).toBe('bypassed');
    expect(await deepPage.evaluate(() => document.body.dataset.graphRoute)).toBe('knowledge');
    await deepPage.close();
  });

  test('the first root action is a partial geometric reverse of the final absorption', async ({ page }) => {
    await freshSession(page);
    await page.goto('/');
    await waitComplete(page);
    await page.locator('.root-node-trigger').click();
    await page.waitForFunction(() => document.body.classList.contains('is-phase-h-root-expanding'), null, { timeout: 2_000 });

    const during = await page.evaluate(() => {
      const section = document.querySelector('#site-graph .site-graph-node[data-node-id="knowledge"]');
      const wrapper = section?.querySelector(':scope > .phase-h-node-motion');
      return wrapper?.getAttribute('transform') || '';
    });
    expect(during).toContain('translate');

    await page.waitForFunction(() => !document.body.classList.contains('is-phase-h-root-expanding'), null, { timeout: 3_000 });
    for (const id of ['work', 'knowledge', 'experience', 'education', 'about']) {
      const delta = await page.evaluate(sectionId => {
        const node = document.querySelector(`#site-graph .site-graph-node[data-node-id="${sectionId}"]`);
        const expected = window.ProfileGeometry.overviewPoint(sectionId);
        return Math.hypot(Number(node.dataset.x) - expected.x, Number(node.dataset.y) - expected.y);
      }, id);
      expect(delta).toBeLessThan(3);
    }
  });
});

test.describe('Phase H reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

  test('uses a short semantic Atlas to root transition', async ({ page }) => {
    await freshSession(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const completed = await waitComplete(page, 6_000);
    expect(completed.reducedMotion).toBe(true);
    expect(completed.rootLanding).toBe(true);
    expect(completed.elapsed).toBeLessThan(2_500);
  });
});

test.describe('Phase H mobile composition', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('keeps mobile intro label density intentionally low and lands on the mobile root composition', async ({ page }) => {
    await freshSession(page);
    await page.goto('/');
    await waitRunning(page);
    const mobile = await page.evaluate(() => ({
      snapshot: window.ProfileIntro.snapshot(),
      deepLabelsVisible: [...document.querySelectorAll('#site-graph .site-graph-node[data-phase-h-tier="deep"] .site-graph-label')]
        .filter(label => Number(getComputedStyle(label).opacity) > .05).length,
      clusterLabelsVisible: [...document.querySelectorAll('#site-graph .site-graph-node[data-phase-h-tier="cluster"] .site-graph-label')]
        .filter(label => Number(getComputedStyle(label).opacity) > .05).length
    }));
    expect(mobile.snapshot.mobile).toBe(true);
    expect(mobile.deepLabelsVisible).toBe(0);
    expect(mobile.clusterLabelsVisible).toBe(0);

    await waitComplete(page);
    await expect(page.locator('.root-node-trigger')).toBeVisible();
    await expect(page.locator('.phase-h-latent-stub')).toHaveCount(5);
  });
});
