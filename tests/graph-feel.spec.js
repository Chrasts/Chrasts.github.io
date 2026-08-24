const { test, expect } = require('@playwright/test');

const boot = async (page, route = 'knowledge') => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/#${route}`);
  await page.waitForFunction(() => Boolean(
    window.ProfileGraphFeel &&
    window.ProfileNodeInteraction &&
    window.ProfileHaloRenderer &&
    window.ProfileScene
  ));
  await page.waitForFunction(() => Boolean(document.querySelector('link[href="graph-feel.css"]')?.sheet));
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  await page.waitForFunction(() => window.ProfileHaloRenderer.snapshot().ringCount > 0);
  await page.waitForTimeout(180);
};

const haloOpacity = locator => locator.evaluate(element => Number(getComputedStyle(element).opacity));

test.describe('V3.1 Phase B node interaction foundation', () => {
  test('pointer preview has a canonical per-node state and semantic relation response', async ({ page }) => {
    await boot(page, 'knowledge');
    const node = page.locator('#site-graph .site-graph-node[data-node-id="logic-math"]');
    await node.hover();
    await page.waitForFunction(() => window.ProfileNodeInteraction.stateFor('logic-math')?.state === 'hovered');

    const state = await page.evaluate(() => window.ProfileNodeInteraction.stateFor('logic-math'));
    expect(state.state).toBe('hovered');
    expect(state.input).toBe('pointer');
    await expect(node).toHaveAttribute('data-node-state', 'hovered');
    await expect(node).toHaveAttribute('data-halo-state', 'hover');

    const related = page.locator('#site-graph .site-graph-node[data-halo-state="related"]');
    await expect.poll(() => related.count()).toBeGreaterThan(0);
    const semanticRelations = await page.locator('#site-graph .site-graph-node[data-relation-state]:not([data-relation-state="none"])').count();
    expect(semanticRelations).toBeGreaterThan(0);
  });

  test('keyboard focus maps to the same node model with a stronger halo state', async ({ page }) => {
    await boot(page, 'knowledge');
    const node = page.locator('#site-graph .site-graph-node[data-node-id="logic-math"]');
    await page.keyboard.press('Tab');
    await node.focus();
    await page.waitForFunction(() => window.ProfileNodeInteraction.stateFor('logic-math')?.state === 'focused');

    const state = await page.evaluate(() => window.ProfileNodeInteraction.stateFor('logic-math'));
    expect(state.input).toBe('keyboard');
    await expect(node).toHaveAttribute('data-halo-state', 'focus');
    await expect.poll(() => haloOpacity(node.locator(':scope > .site-graph-halo--primary'))).toBeGreaterThan(.6);
  });

  test('root entry halo is a richer reusable preset without duplicating rings', async ({ page }) => {
    await boot(page, 'atlas');
    const root = page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]');
    await page.waitForFunction(() => window.ProfileNodeInteraction.stateFor('stepan-chrast')?.state === 'entry-ready');
    await expect(root).toHaveAttribute('data-halo-state', 'root-entry');
    await expect(root.locator(':scope > .site-graph-halo')).toHaveCount(2);

    const before = await page.evaluate(() => window.ProfileHaloRenderer.snapshot());
    await page.evaluate(() => {
      window.ProfileHaloRenderer.refresh();
      window.ProfileHaloRenderer.refresh();
      window.ProfileGraphFeel.refresh();
    });
    await page.waitForTimeout(80);
    const after = await page.evaluate(() => window.ProfileHaloRenderer.snapshot());
    expect(after.rootRingCount).toBe(2);
    expect(after.ringCount).toBe(before.ringCount);
  });

  test('transition state deterministically overrides direct interaction and settles back', async ({ page }) => {
    await boot(page, 'knowledge');
    const node = page.locator('#site-graph .site-graph-node[data-node-id="logic-math"]');
    await node.hover();
    await page.waitForFunction(() => window.ProfileNodeInteraction.stateFor('logic-math')?.state === 'hovered');

    await page.evaluate(() => dispatchEvent(new CustomEvent('profile:transition-begin', { detail: { test: true } })));
    await page.waitForFunction(() => window.ProfileNodeInteraction.stateFor('logic-math')?.state === 'transitioning');
    await expect(node).toHaveAttribute('data-halo-state', 'transitioning');

    await page.evaluate(() => dispatchEvent(new CustomEvent('profile:transition-cancel', { detail: { test: true } })));
    await page.waitForFunction(() => window.ProfileNodeInteraction.snapshot().transitioning === false);
    expect((await page.evaluate(() => window.ProfileNodeInteraction.stateFor('logic-math'))).state).not.toBe('transitioning');
  });
});

test.describe('Graph feel compatibility contracts', () => {
  test('pointer preview exposes one graph microstate and animates semantic relations', async ({ page }) => {
    await boot(page, 'knowledge');
    const node = page.locator('#site-graph .site-graph-node[data-node-id="logic-math"]');
    await node.hover();
    await page.waitForFunction(() => window.ProfileGraphFeel.snapshot().activeNodeId === 'logic-math');

    const state = await page.evaluate(() => window.ProfileGraphFeel.snapshot());
    expect(state.phase).toBe('preview');
    expect(state.input).toBe('pointer');
    expect(state.activeNodeId).toBe('logic-math');
    expect(state.flowingEdgeCount).toBeGreaterThan(0);
    await expect(node).toHaveClass(/is-feel-origin/);

    const halo = node.locator(':scope > .site-graph-halo--primary');
    await expect.poll(() => haloOpacity(halo)).toBeGreaterThan(.2);
  });

  test('keyboard focus uses the same semantic feel with stronger focus indication', async ({ page }) => {
    await boot(page, 'knowledge');
    const node = page.locator('#site-graph .site-graph-node[data-node-id="logic-math"]');
    await page.keyboard.press('Tab');
    await node.focus();
    await page.waitForFunction(() => window.ProfileGraphFeel.snapshot().input === 'keyboard');

    const state = await page.evaluate(() => window.ProfileGraphFeel.snapshot());
    expect(state.phase).toBe('preview');
    expect(state.activeNodeId).toBe('logic-math');
    await expect(page.locator('#site-graph')).toHaveAttribute('data-graph-input', 'keyboard');
    await expect.poll(() => haloOpacity(node.locator(':scope > .site-graph-halo--primary'))).toBeGreaterThan(.6);
  });

  test('press feedback is transient and does not change route semantics', async ({ page }) => {
    await boot(page, 'knowledge');
    const node = page.locator('#site-graph .site-graph-node[data-node-id="logic-math"]');
    await node.dispatchEvent('pointerdown', { button: 0, pointerId: 1, pointerType: 'mouse' });
    await expect(node).toHaveClass(/is-feel-pressed/);
    expect((await page.evaluate(() => window.ProfileGraphFeel.snapshot())).phase).toBe('pressed');
    await node.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' });
    await expect(node).not.toHaveClass(/is-feel-pressed/);
    expect((await page.evaluate(() => window.ProfileGraphFeel.snapshot())).pressedNodeId).toBeNull();
    expect(await page.evaluate(() => document.body.dataset.graphRoute)).toBe('knowledge');
  });

  test('artifact tether and graph halo reinforce the same linked node', async ({ page }) => {
    await boot(page, 'about/woodworking/hedgehog-house');
    await page.waitForFunction(() => Boolean(
      window.ProfileArtifactScenes &&
      window.ProfileArtifactSceneLayout &&
      window.ProfileArtifacts &&
      window.ProfileRefinements &&
      window.ProfileObjectFocus &&
      window.ProfileNodeDetailDismiss
    ));
    await page.waitForTimeout(180);
    const gallery = page.locator('[data-artifact-scene="hedgehog-house-gallery"]');
    await expect(gallery).toBeVisible();
    await gallery.hover();

    const node = page.locator('#site-graph .site-graph-node[data-node-id="hedgehog-house"]');
    await expect(node).toHaveClass(/is-artifact-linked/);
    await expect(page.locator('.artifact-tether-layer')).toHaveClass(/is-visible/);

    await page.evaluate(() => window.ProfileGraphFeel.refresh());
    const halo = node.locator(':scope > .site-graph-halo--primary');
    await expect.poll(() => haloOpacity(halo)).toBeGreaterThan(.3);
  });

  test('reduced motion keeps graph feel semantics but removes repeating animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await boot(page, 'knowledge');
    const node = page.locator('#site-graph .site-graph-node[data-node-id="logic-math"]');
    await node.hover();
    await page.waitForFunction(() => window.ProfileGraphFeel.snapshot().activeNodeId === 'logic-math');

    expect((await page.evaluate(() => window.ProfileGraphFeel.snapshot())).reducedMotion).toBe(true);
    const edge = page.locator('#site-graph .site-graph-edges path.is-graph-flowing').first();
    await expect(edge).toBeVisible();
    expect(await edge.evaluate(element => getComputedStyle(element).animationName)).toBe('none');
    const rootSecondary = page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"] > .site-graph-halo--secondary');
    if (await rootSecondary.count()) expect(await rootSecondary.evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  });
});
