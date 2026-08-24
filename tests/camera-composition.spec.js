const { test, expect } = require('@playwright/test');

const bootAtlas = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#atlas');
  await page.waitForFunction(() => Boolean(window.ProfileAtlasLOD && window.ProfileCameraComposition && window.ProfileSceneComposer));
  await page.waitForFunction(() => window.ProfileCameraComposition.boot() === true);
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  await page.waitForTimeout(240);
};

test.describe('Phase E camera composition', () => {
  test('selected Atlas node focuses into the composed safe frame instead of behind the inspector', async ({ page }) => {
    await bootAtlas(page);
    const svg = page.locator('#site-graph .site-graph-svg');
    const node = page.locator('#site-graph .site-graph-node[data-node-id="sat-smt"]');
    const detail = page.locator('#site-detail-panel');

    await node.click();
    await expect(detail).toBeVisible();
    await expect(node).toHaveClass(/is-previewed/);

    const frameBefore = await page.evaluate(() => window.ProfileCameraComposition.safeFrame());
    const svgBox = await svg.boundingBox();
    expect(frameBefore.right).toBeLessThan(svgBox.x + svgBox.width - 30);

    const transformBefore = await page.locator('#site-graph .site-graph-svg > g').getAttribute('transform');
    await node.click();
    await page.waitForTimeout(650);
    const transformAfter = await page.locator('#site-graph .site-graph-svg > g').getAttribute('transform');
    expect(transformAfter).not.toBe(transformBefore);

    const result = await page.evaluate(() => {
      const node = document.querySelector('#site-graph .site-graph-node[data-node-id="sat-smt"]');
      const box = node.getBoundingClientRect();
      const frame = window.ProfileCameraComposition.safeFrame();
      return {
        nodeCenterX: box.left + box.width / 2,
        nodeCenterY: box.top + box.height / 2,
        frameCenterX: frame.centerX,
        frameCenterY: frame.centerY,
        lastFocus: window.ProfileCameraComposition.snapshot().lastFocus
      };
    });
    expect(Math.abs(result.nodeCenterX - result.frameCenterX)).toBeLessThan(95);
    expect(Math.abs(result.nodeCenterY - result.frameCenterY)).toBeLessThan(95);
    expect(result.lastFocus.id).toBe('sat-smt');
  });

  test('removing inspector occupancy expands the safe frame without moving the camera', async ({ page }) => {
    await bootAtlas(page);
    const node = page.locator('#site-graph .site-graph-node[data-node-id="sat-smt"]');
    const detail = page.locator('#site-detail-panel');
    await node.click();
    await node.click();
    await page.waitForTimeout(650);

    const camera = page.locator('#site-graph .site-graph-svg > g');
    const beforeTransform = await camera.getAttribute('transform');
    const beforeFrame = await page.evaluate(() => window.ProfileCameraComposition.safeFrame());
    await detail.locator('.detail-close').click();
    await expect(detail).toBeHidden();
    await page.waitForTimeout(180);
    const afterTransform = await camera.getAttribute('transform');
    const afterFrame = await page.evaluate(() => window.ProfileCameraComposition.safeFrame());

    expect(afterTransform).toBe(beforeTransform);
    expect(afterFrame.width).toBeGreaterThan(beforeFrame.width + 80);
  });
});
