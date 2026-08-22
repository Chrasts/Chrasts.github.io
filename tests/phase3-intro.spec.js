const { test, expect } = require('@playwright/test');

const freshSession = async page => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__phase3FreshPrepared') !== 'true') {
      sessionStorage.removeItem('profileIntroSeen');
      sessionStorage.setItem('__phase3FreshPrepared', 'true');
    }
  });
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const waitIntro = async page => {
  await page.waitForFunction(() => Boolean(window.ProfileIntro));
  return page.evaluate(() => window.ProfileIntro.snapshot());
};

const waitStage = async (page, stage, timeout = 8_000) => {
  await page.waitForFunction(expected => window.ProfileIntro?.snapshot().stage === expected, stage, { timeout });
  return page.evaluate(() => window.ProfileIntro.snapshot());
};

const waitAtlasReady = async page => {
  await waitStage(page, 'atlas');
  await page.waitForFunction(() => window.ProfileIntroUnfold?.snapshot().completed === true, null, { timeout: 8_000 });
  return page.evaluate(() => ({ intro: window.ProfileIntro.snapshot(), unfold: window.ProfileIntroUnfold.snapshot() }));
};

const waitComplete = async (page, result = 'completed') => {
  await page.waitForFunction(expected => window.ProfileIntro?.snapshot().result === expected, result, { timeout: 10_000 });
  return page.evaluate(() => window.ProfileIntro.snapshot());
};

const firstLevelIds = ['work', 'knowledge', 'experience', 'education', 'about'];

test.describe('Phase 3 interaction-gated intro — desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('automatically unfolds the real Atlas, then waits for explicit Enter profile interaction', async ({ page }) => {
    await freshSession(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/#overview');
    await page.waitForSelector('.profile-intro-overlay[data-source="real-atlas"]');
    const ready = await waitAtlasReady(page);

    const source = await page.evaluate(() => ({
      expected: window.SITE_DATA.graph.nodes.length,
      cloned: document.querySelectorAll('.profile-intro-overlay .site-graph-node[data-node-id]').length,
      source: document.querySelector('.profile-intro-overlay')?.dataset.source,
      snapshot: window.ProfileIntro.snapshot()
    }));
    expect(source.source).toBe('real-atlas');
    expect(source.cloned).toBe(source.expected);
    expect(ready.unfold.completed).toBe(true);
    expect(source.snapshot.running).toBe(false);
    expect(source.snapshot.waiting).toBe(true);
    await expect(page.locator('.profile-intro-enter')).toBeVisible();
    await expect(page.locator('.profile-intro-enter')).toBeEnabled();
    await expect(page.locator('.profile-intro-enter')).toContainText('Enter profile');

    await page.waitForTimeout(700);
    const stillWaiting = await page.evaluate(() => window.ProfileIntro.snapshot());
    expect(stillWaiting.stage).toBe('atlas');
    expect(stillWaiting.running).toBe(false);
    expect(errors).toEqual([]);
  });

  test('condenses semantic layers physically toward branches and then into the root', async ({ page }) => {
    await freshSession(page);
    await page.goto('/#overview');
    await waitAtlasReady(page);

    const deepBefore = await page.evaluate(() => {
      const node = document.querySelector('.profile-intro-overlay .site-graph-node[data-intro-tier="deep"]');
      return node ? {
        id: node.dataset.nodeId,
        x: Number(node.dataset.x),
        y: Number(node.dataset.y),
        sectionX: Number(node.dataset.introSectionX),
        sectionY: Number(node.dataset.introSectionY)
      } : null;
    });
    expect(deepBefore).toBeTruthy();

    await page.locator('.profile-intro-enter').click();
    await waitStage(page, 'territories');

    // Observe the branch contract atomically. The cinematic continues shortly
    // after publishing `branches`, so a second protocol round-trip can otherwise
    // sample the following root-collapse frame rather than the branch frame.
    await page.waitForFunction(expected => {
      if (window.ProfileIntro?.snapshot().stage !== 'branches') return false;
      const node = document.querySelector(`.profile-intro-overlay .site-graph-node[data-node-id="${expected.id}"]`);
      if (!node) return false;
      return Math.abs(Number(node.dataset.x) - expected.sectionX) < 1 &&
        Math.abs(Number(node.dataset.y) - expected.sectionY) < 1;
    }, { id: deepBefore.id, sectionX: deepBefore.sectionX, sectionY: deepBefore.sectionY }, { timeout: 8_000 });

    await waitStage(page, 'root');
    await waitStage(page, 'identity');
    const snapshot = await page.evaluate(() => window.ProfileIntro.snapshot());
    expect(snapshot.stages).toEqual(expect.arrayContaining(['atlas', 'territories', 'branches', 'root', 'identity']));
    expect(snapshot.running).toBe(false);
  });

  test('root becomes an interactive portrait identity node and then shrinks into the ordinary graph root', async ({ page }) => {
    await freshSession(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/#overview');
    await waitAtlasReady(page);
    await page.locator('.profile-intro-enter').click();
    await waitStage(page, 'identity');

    const identity = page.locator('.profile-intro-identity');
    await expect(identity).toBeVisible();
    await expect(identity).toHaveAttribute('aria-label', 'Open the profile map');
    await expect(identity.locator('img')).toHaveAttribute('src', 'assets/stepan-chrast.jpg');
    await expect(identity.locator('.profile-intro-identity-name')).toContainText('Štěpán Chrast');
    await expect(identity.locator('.profile-intro-identity-tag')).toHaveCount(3);

    // The identity appears where the previous Enter control lived, so the
    // pointer can already be over it. Move away before testing hover motion.
    await page.mouse.move(8, 8);
    await page.waitForTimeout(80);
    const transformBefore = await identity.evaluate(element => getComputedStyle(element).transform);
    await identity.hover();
    await page.waitForTimeout(140);
    const transformAfter = await identity.evaluate(element => getComputedStyle(element).transform);
    expect(transformAfter).not.toBe(transformBefore);

    await identity.click();
    const completed = await waitComplete(page);
    expect(completed.result).toBe('completed');
    expect(await page.evaluate(() => window.ProfileRootLanding.isActive())).toBe(false);
    expect(await page.evaluate(() => document.body.dataset.graphRoute)).toBe('overview');
    await expect(page.locator('#site-explorer')).toBeVisible();
    await expect(page.locator('.profile-intro-overlay')).toHaveCount(0);
    for (const id of firstLevelIds) {
      await expect(page.locator(`#site-graph .site-graph-node[data-node-id="${id}"]`)).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test('Skip intro bypasses the cinematic flow and lands on the Phase 2 root landing', async ({ page }) => {
    await freshSession(page);
    await page.goto('/#overview');
    await waitStage(page, 'atlas');
    await page.locator('.profile-intro-skip').click();
    const snapshot = await waitComplete(page, 'skipped');
    expect(snapshot.result).toBe('skipped');
    expect(await page.evaluate(() => window.ProfileRootLanding.isActive())).toBe(true);
    await expect(page.locator('.root-node-trigger')).toBeVisible();
    await expect(page.locator('#site-explorer')).toBeHidden();
  });

  test('Escape skips but ordinary pointer interaction with the unfolding Atlas does not start condensation', async ({ page }) => {
    await freshSession(page);
    await page.goto('/#overview');
    await waitStage(page, 'atlas');
    await page.mouse.click(80, 80);
    await page.waitForTimeout(250);
    expect((await page.evaluate(() => window.ProfileIntro.snapshot())).stage).toBe('atlas');
    await page.keyboard.press('Escape');
    await waitComplete(page, 'skipped');
    expect(await page.evaluate(() => window.ProfileRootLanding.isActive())).toBe(true);
  });

  test('the completed intro is session-only; refresh returns directly to the root landing', async ({ page }) => {
    await freshSession(page);
    await page.goto('/#overview');
    await waitAtlasReady(page);
    await page.locator('.profile-intro-enter').click();
    await waitStage(page, 'identity');
    await page.locator('.profile-intro-identity').click();
    await waitComplete(page);
    expect(await page.evaluate(() => sessionStorage.getItem('profileIntroSeen'))).toBe('true');

    await page.reload();
    const snapshot = await waitIntro(page);
    expect(snapshot.eligible).toBe(false);
    expect(snapshot.result).toBe('bypassed');
    await expect(page.locator('.profile-intro-overlay')).toHaveCount(0);
    await page.waitForFunction(() => Boolean(window.ProfileRootLanding));
    expect(await page.evaluate(() => window.ProfileRootLanding.isActive())).toBe(true);
  });

  test('deep links bypass the intro and mark the session seen', async ({ page }) => {
    await freshSession(page);
    await page.goto('/#knowledge');
    const snapshot = await waitIntro(page);
    expect(snapshot.eligible).toBe(false);
    expect(snapshot.result).toBe('bypassed');
    await expect(page.locator('.profile-intro-overlay')).toHaveCount(0);
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge');
    expect(await page.evaluate(() => document.body.dataset.graphMode)).toBe('focus');
    expect(await page.evaluate(() => sessionStorage.getItem('profileIntroSeen'))).toBe('true');
  });
});

test.describe('Phase 3 reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

  test('uses a short root-to-Atlas reveal, then waits for Enter profile and hands directly to identity', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await freshSession(page);
    await page.goto('/#overview');
    await waitAtlasReady(page);
    expect((await page.evaluate(() => window.ProfileIntro.snapshot())).stage).toBe('atlas');

    await page.locator('.profile-intro-enter').click();
    const identityState = await waitStage(page, 'identity');
    expect(identityState.reducedMotion).toBe(true);
    expect(identityState.stages).toEqual(['atlas', 'identity']);
    await expect(page.locator('.profile-intro-identity')).toBeVisible();

    await page.locator('.profile-intro-identity').click();
    await waitComplete(page);
    expect(await page.evaluate(() => window.ProfileRootLanding.isActive())).toBe(false);
  });
});

test.describe('Phase 3 interaction-gated intro — mobile portrait', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('auto-unfolds the real Atlas, forms the portrait identity node, then reveals the five-branch mobile graph', async ({ page }) => {
    await freshSession(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/#overview');
    await waitAtlasReady(page);
    await expect(page.locator('.profile-intro-enter')).toBeVisible();
    await page.locator('.profile-intro-enter').click();
    await waitStage(page, 'identity');
    await expect(page.locator('.profile-intro-identity img')).toBeVisible();
    await page.locator('.profile-intro-identity').click();
    await waitComplete(page);
    await page.waitForFunction(() => Boolean(window.MobileProfileScene));
    expect(await page.evaluate(() => window.ProfileRootLanding.isActive())).toBe(false);
    await expect(page.locator('#site-explorer')).toBeVisible();
    for (const id of firstLevelIds) {
      await expect(page.locator(`#site-graph .site-graph-node[data-node-id="${id}"]`)).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
});