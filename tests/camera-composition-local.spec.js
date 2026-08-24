const { test, expect } = require('@playwright/test');

const bootFocus = async (page, route = 'about/woodworking/hedgehog-house') => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/#${route}`);
  await page.waitForFunction(() => Boolean(
    window.ProfileCameraComposition &&
    window.ProfileSceneComposer &&
    window.ProfileScene?.camera
  ));
  await page.waitForFunction(() => window.ProfileCameraComposition.boot() === true);
  await page.waitForFunction(() =>
    document.body.dataset.graphMode === 'focus' &&
    window.ProfileScene.camera.activeName === 'desktop-local' &&
    !document.body.classList.contains('is-v9-transitioning')
  );
  await page.waitForTimeout(320);
};

const localViewBox = page => page.evaluate(() => {
  const box = window.ProfileCameraComposition.snapshot().camera?.viewBox;
  return box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null;
});

const expectSameViewBox = (actual, expected, tolerance = .8) => {
  expect(actual).not.toBeNull();
  expect(expected).not.toBeNull();
  expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.width - expected.width)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.height - expected.height)).toBeLessThanOrEqual(tolerance);
};

test.describe('Phase E local camera composition', () => {
  test('desktop Focus uses a real local adapter and MAKE_ROOM keeps the selected node inside the composed safe frame', async ({ page }) => {
    await bootFocus(page);
    await expect(page.locator('#site-detail-panel')).toBeVisible();

    const applied = await page.evaluate(() => window.ProfileCameraComposition.command(
      window.ProfileCameraComposition.PRESETS.MAKE_ROOM,
      { nodeId: 'hedgehog-house', immediate: true }
    ));
    expect(applied).toBe(true);

    const state = await page.evaluate(() => {
      const camera = window.ProfileCameraComposition.snapshot();
      const node = document.querySelector('#site-graph .site-graph-node[data-node-id="hedgehog-house"]');
      const box = node.getBoundingClientRect();
      return {
        adapter: camera.adapter,
        cameraAdapter: camera.camera?.adapter,
        frame: camera.safeFrame,
        node: { x: box.left + box.width / 2, y: box.top + box.height / 2 }
      };
    });

    expect(state.adapter).toBe('desktop-local');
    expect(state.cameraAdapter).toBe('desktop-local');
    expect(state.frame.reserved.some(item => item.id === 'detail-panel')).toBe(true);
    expect(state.node.x).toBeGreaterThanOrEqual(state.frame.left - 8);
    expect(state.node.x).toBeLessThanOrEqual(state.frame.right + 8);
    expect(state.node.y).toBeGreaterThanOrEqual(state.frame.top - 8);
    expect(state.node.y).toBeLessThanOrEqual(state.frame.bottom + 8);
  });

  test('PEEK stores a local camera origin and RETURN restores the exact viewBox', async ({ page }) => {
    await bootFocus(page);
    await page.evaluate(() => window.ProfileCameraComposition.command(
      window.ProfileCameraComposition.PRESETS.MAKE_ROOM,
      { nodeId: 'hedgehog-house', immediate: true }
    ));
    const origin = await localViewBox(page);

    expect(await page.evaluate(() => window.ProfileCameraComposition.command(
      window.ProfileCameraComposition.PRESETS.PEEK,
      { nodeId: 'hedgehog-house', immediate: true }
    ))).toBe(true);
    const peek = await localViewBox(page);
    expect(peek.width).toBeLessThan(origin.width - 1);
    expect(peek.height).toBeLessThan(origin.height - 1);

    expect(await page.evaluate(() => window.ProfileCameraComposition.command(
      window.ProfileCameraComposition.PRESETS.RETURN,
      { immediate: true }
    ))).toBe(true);
    expectSameViewBox(await localViewBox(page), origin);
  });

  test('a newer local camera command retargets an in-flight move', async ({ page }) => {
    await bootFocus(page);
    const origin = await localViewBox(page);

    await page.evaluate(() => {
      const camera = window.ProfileCameraComposition;
      camera.command(camera.PRESETS.PEEK, { nodeId: 'hedgehog-house', duration: 620 });
      camera.command(camera.PRESETS.INSPECT, { nodeId: 'hedgehog-house', duration: 260 });
    });
    await page.waitForFunction(() => window.ProfileCameraComposition.snapshot().localAnimating === false);

    const state = await page.evaluate(() => window.ProfileCameraComposition.snapshot());
    expect(state.activePreset).toBe('INSPECT');
    expect(state.lastFocus.adapter).toBe('desktop-local');
    expect(state.lastFocus.id).toBe('hedgehog-house');
    expect(state.camera.viewBox.width).toBeLessThan(origin.width * .94);
  });

  test('closing the local inspector expands available space without moving the composed camera', async ({ page }) => {
    await bootFocus(page);
    await page.evaluate(() => window.ProfileCameraComposition.command(
      window.ProfileCameraComposition.PRESETS.INSPECT,
      { nodeId: 'hedgehog-house', immediate: true }
    ));

    const before = await localViewBox(page);
    const beforeFrame = await page.evaluate(() => window.ProfileCameraComposition.safeFrame());
    const detail = page.locator('#site-detail-panel');
    await detail.locator('.detail-close').click();
    await expect(detail).toBeHidden();
    await page.waitForTimeout(320);

    const after = await localViewBox(page);
    const afterFrame = await page.evaluate(() => window.ProfileCameraComposition.safeFrame());
    expectSameViewBox(after, before);
    expect(afterFrame.width).toBeGreaterThan(beforeFrame.width + 40);
  });
});
