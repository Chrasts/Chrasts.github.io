const { test, expect } = require('@playwright/test');

const boot = async (page, route = 'knowledge') => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/#${route}`);
  await page.waitForFunction(() => Boolean(window.ProfileGraphFeel && window.ProfileScene));
  await page.waitForFunction(() => Boolean(document.querySelector('link[href="graph-feel.css"]')?.sheet));
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  await page.waitForFunction(() => window.ProfileGraphFeel.snapshot().haloCount > 0);
  await page.waitForTimeout(180);
};

const haloOpacity = locator => locator.evaluate(element => Number(getComputedStyle(element).opacity));

test.describe('Phase F graph feel', () => {
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

    const halo = node.locator(':scope > .site-graph-halo');
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
    await expect.poll(() => haloOpacity(node.locator(':scope > .site-graph-halo'))).toBeGreaterThan(.6);
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
    const halo = node.locator(':scope > .site-graph-halo');
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
  });
});
