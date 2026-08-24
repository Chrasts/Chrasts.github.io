const { test, expect } = require('@playwright/test');

const boot = async (page, route = 'knowledge') => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/#${route}`);
  await page.waitForFunction(() => Boolean(window.ProfileGraphFeel && window.ProfileScene));
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  await page.waitForFunction(() => window.ProfileGraphFeel.snapshot().haloCount > 0);
  await page.waitForTimeout(180);
};

test.describe('Phase F graph feel', () => {
  test('pointer preview exposes one graph microstate and animates semantic relations', async ({ page }) => {
    await boot(page, 'knowledge');
    const node = page.locator('#site-graph .site-graph-node[data-node-id="logic"]');
    await node.hover();
    await page.waitForFunction(() => window.ProfileGraphFeel.snapshot().activeNodeId === 'logic');

    const state = await page.evaluate(() => window.ProfileGraphFeel.snapshot());
    expect(state.phase).toBe('preview');
    expect(state.input).toBe('pointer');
    expect(state.activeNodeId).toBe('logic');
    expect(state.flowingEdgeCount).toBeGreaterThan(0);
    await expect(node).toHaveClass(/is-feel-origin/);

    const halo = node.locator(':scope > .site-graph-halo');
    expect(Number(await halo.evaluate(element => getComputedStyle(element).opacity))).toBeGreaterThan(.2);
  });

  test('keyboard focus uses the same semantic feel with stronger focus indication', async ({ page }) => {
    await boot(page, 'knowledge');
    const node = page.locator('#site-graph .site-graph-node[data-node-id="logic"]');
    await node.focus();
    await page.waitForFunction(() => window.ProfileGraphFeel.snapshot().input === 'keyboard');

    const state = await page.evaluate(() => window.ProfileGraphFeel.snapshot());
    expect(state.phase).toBe('preview');
    expect(state.activeNodeId).toBe('logic');
    await expect(page.locator('#site-graph')).toHaveAttribute('data-graph-input', 'keyboard');
    expect(Number(await node.locator(':scope > .site-graph-halo').evaluate(element => getComputedStyle(element).opacity))).toBeGreaterThan(.6);
  });

  test('press feedback is transient and does not change route semantics', async ({ page }) => {
    await boot(page, 'knowledge');
    const node = page.locator('#site-graph .site-graph-node[data-node-id="logic"]');
    const box = await node.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(node).toHaveClass(/is-feel-pressed/);
    expect((await page.evaluate(() => window.ProfileGraphFeel.snapshot())).phase).toBe('pressed');
    await page.mouse.up();
    await expect(node).not.toHaveClass(/is-feel-pressed/);
    expect((await page.evaluate(() => window.ProfileGraphFeel.snapshot())).pressedNodeId).toBeNull();
  });

  test('artifact tether and graph halo reinforce the same linked node', async ({ page }) => {
    await boot(page, 'about/woodworking/hedgehog-house');
    await page.waitForFunction(() => Boolean(window.ProfileArtifactScenes));
    const gallery = page.locator('[data-artifact-scene="hedgehog-house-gallery"]');
    await expect(gallery).toBeVisible();
    await gallery.hover();

    const node = page.locator('#site-graph .site-graph-node[data-node-id="hedgehog-house"]');
    await expect(node).toHaveClass(/is-artifact-linked/);
    await page.evaluate(() => window.ProfileGraphFeel.refresh());
    await page.waitForTimeout(80);
    const halo = node.locator(':scope > .site-graph-halo');
    expect(Number(await halo.evaluate(element => getComputedStyle(element).opacity))).toBeGreaterThan(.3);
    await expect(page.locator('.artifact-tether-layer')).toHaveClass(/is-visible/);
  });

  test('reduced motion keeps graph feel semantics but removes repeating animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await boot(page, 'knowledge');
    const node = page.locator('#site-graph .site-graph-node[data-node-id="logic"]');
    await node.hover();
    await page.waitForFunction(() => window.ProfileGraphFeel.snapshot().activeNodeId === 'logic');

    expect((await page.evaluate(() => window.ProfileGraphFeel.snapshot())).reducedMotion).toBe(true);
    const edge = page.locator('#site-graph .site-graph-edges path.is-graph-flowing').first();
    await expect(edge).toBeVisible();
    expect(await edge.evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  });
});
