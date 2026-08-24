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

const waitInspectorReservation = page => page.waitForFunction(() =>
  window.ProfileCameraComposition.safeFrame()?.reserved?.some(item => item.id === 'detail-panel')
);

const waitAtlasCameraSettled = page => page.waitForFunction(() => {
  const state = window.ProfileAtlasLOD?.snapshot();
  if (!state?.camera || !state?.targetCamera) return false;
  return Math.abs(state.camera.x - state.targetCamera.x) < .1 &&
    Math.abs(state.camera.y - state.targetCamera.y) < .1 &&
    Math.abs(state.camera.scale - state.targetCamera.scale) < .001;
});

test.describe('Phase E camera composition', () => {
  test('selected Atlas node focuses into the composed safe frame instead of behind the inspector', async ({ page }) => {
    await bootAtlas(page);
    const svg = page.locator('#site-graph .site-graph-svg');
    const node = page.locator('#site-graph .site-graph-node[data-node-id="sat-smt"]');
    const detail = page.locator('#site-detail-panel');

    await node.click();
    await expect(detail).toBeVisible();
    await expect(node).toHaveClass(/is-previewed/);
    await waitInspectorReservation(page);

    const frameBefore = await page.evaluate(() => window.ProfileCameraComposition.safeFrame());
    const svgBox = await svg.boundingBox();
    expect(frameBefore.reserved.some(item => item.id === 'detail-panel')).toBe(true);
    expect(frameBefore.width).toBeLessThanOrEqual(svgBox.width - 44);

    const camera = page.locator('#site-graph .site-graph-svg > g').first();
    const transformBefore = await camera.getAttribute('transform');
    await node.click();
    await waitAtlasCameraSettled(page);
    const transformAfter = await camera.getAttribute('transform');
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
    await waitInspectorReservation(page);
    expect(await page.evaluate(() => window.ProfileCameraComposition.command('INSPECT', { nodeId: 'sat-smt', immediate: true }))).toBe(true);

    const camera = page.locator('#site-graph .site-graph-svg > g').first();
    const beforeTransform = await camera.getAttribute('transform');
    const beforeFrame = await page.evaluate(() => window.ProfileCameraComposition.safeFrame());
    await detail.locator('.detail-close').click();
    await expect(detail).toBeHidden();
    await page.waitForTimeout(180);
    const afterTransform = await camera.getAttribute('transform');
    const afterFrame = await page.evaluate(() => window.ProfileCameraComposition.safeFrame());

    expect(afterTransform).toBe(beforeTransform);
    expect(afterFrame.reserved.some(item => item.id === 'detail-panel')).toBe(false);
    expect(afterFrame.width).toBeGreaterThanOrEqual(beforeFrame.width);
  });

  test('INSPECT, PEEK, MAKE_ROOM and RETURN share one retargetable camera state layer', async ({ page }) => {
    await bootAtlas(page);
    const api = await page.evaluate(() => ({ ...window.ProfileCameraComposition.PRESETS }));
    expect(api).toEqual({ MAKE_ROOM: 'MAKE_ROOM', INSPECT: 'INSPECT', PEEK: 'PEEK', RETURN: 'RETURN' });

    const origin = await page.evaluate(() => window.ProfileAtlasLOD.snapshot().targetCamera);
    expect(await page.evaluate(() => window.ProfileCameraComposition.command('INSPECT', { nodeId: 'sat-smt' }))).toBe(true);
    await page.waitForTimeout(90);
    let state = await page.evaluate(() => window.ProfileCameraComposition.snapshot());
    expect(state.activePreset).toBe('INSPECT');
    expect(state.lastFocus.id).toBe('sat-smt');
    expect(state.memory.some(item => item.key.endsWith(':inspect-origin'))).toBe(true);

    expect(await page.evaluate(() => window.ProfileCameraComposition.command('PEEK', { nodeId: 'modal-logic' }))).toBe(true);
    expect(await page.evaluate(() => window.ProfileCameraComposition.command('MAKE_ROOM', { nodeId: 'knowledge' }))).toBe(true);
    await page.waitForTimeout(420);
    state = await page.evaluate(() => window.ProfileCameraComposition.snapshot());
    expect(state.activePreset).toBe('MAKE_ROOM');
    expect(state.lastFocus.id).toBe('knowledge');

    expect(await page.evaluate(() => window.ProfileCameraComposition.command('RETURN', { slot: 'inspect-origin', immediate: true }))).toBe(true);
    const returned = await page.evaluate(() => window.ProfileAtlasLOD.snapshot().targetCamera);
    expect(returned.scale).toBeCloseTo(origin.scale, 3);
    expect(returned.x).toBeCloseTo(origin.x, 1);
    expect(returned.y).toBeCloseTo(origin.y, 1);
    state = await page.evaluate(() => window.ProfileCameraComposition.snapshot());
    expect(state.activePreset).toBe('RETURN');
  });
});
