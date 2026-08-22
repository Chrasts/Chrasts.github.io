const { test, expect } = require('@playwright/test');

const prepareAtlas = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
  await page.goto('/#atlas');
  await page.waitForFunction(() => Boolean(window.ProfileAtlasLOD) && document.body.dataset.graphMode === 'atlas');
};

test.describe('Phase 7 Atlas drag semantics', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('dragging from a selected node pans without zooming or clearing selection', async ({ page }) => {
    await prepareAtlas(page);
    await page.evaluate(() => window.ProfileAtlasLOD.setScale(1.5, { immediate: true }));

    const node = page.locator('#site-graph .site-graph-node[data-node-id="sat-smt"]');
    await node.click();
    await expect(page.locator('#site-detail-panel')).toBeVisible();
    const before = await page.evaluate(() => window.ProfileAtlasLOD.snapshot());
    expect(before.selectedNodeId).toBe('sat-smt');

    const box = await node.boundingBox();
    expect(box).not.toBeNull();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 90, y + 55, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(320);

    const after = await page.evaluate(() => window.ProfileAtlasLOD.snapshot());
    expect(after.selectedNodeId).toBe('sat-smt');
    expect(after.camera.scale).toBeCloseTo(before.camera.scale, 2);
    expect(Math.abs(after.camera.x - before.camera.x) + Math.abs(after.camera.y - before.camera.y)).toBeGreaterThan(10);
    await expect(page.locator('#site-detail-panel')).toBeVisible();
  });
});
