const { test, expect } = require('@playwright/test');

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const waitRuntime = async page => {
  await page.waitForFunction(() => Boolean(
    window.ProfileSceneObjects &&
    window.ProfileSceneComposer &&
    window.ProfileObjectFocus &&
    window.ProfileArtifactScenes
  ));
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
};

const recordFor = async (page, id) => page.evaluate(sceneId =>
  window.ProfileSceneObjects.snapshot().records.find(record => record.id === sceneId) || null,
  id
);

test('scene objects share the V3.1 lifecycle and deterministic composer assignment', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#about/woodworking/hedgehog-house');
  await waitRuntime(page);
  await page.waitForFunction(() => {
    const record = window.ProfileSceneObjects.snapshot().records.find(item => item.id === 'artifact-scene:hedgehog-house-gallery');
    return record?.phase === 'idle' && record.assignment;
  });

  const record = await recordFor(page, 'artifact-scene:hedgehog-house-gallery');
  expect(record.phase).toBe('idle');
  expect(record.assignment.id).toBe('artifact-scene:hedgehog-house-gallery');
  expect(record.history.map(item => item.phase)).toEqual(expect.arrayContaining(['create', 'mount', 'enter', 'idle']));
  await expect(page.locator('[data-artifact-scene="hedgehog-house-gallery"]')).toHaveAttribute('data-scene-runtime-phase', 'idle');
});

test('Object Focus is the single deep-inspection owner and returns the scene object to idle', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#about/woodworking/hedgehog-house');
  await waitRuntime(page);

  const root = page.locator('[data-artifact-scene="hedgehog-house-gallery"]');
  const source = root.locator('.artifact-deck-card[data-artifact-id="hedgehog-house-outside"]');
  await expect(root).toBeVisible();
  await source.click();

  await page.waitForFunction(() => window.ProfileObjectFocus.snapshot().phase === 'settled');
  await page.waitForFunction(() => window.ProfileSceneObjects.snapshot().records
    .find(record => record.id === 'artifact-scene:hedgehog-house-gallery')?.phase === 'inspect');

  const inspecting = await recordFor(page, 'artifact-scene:hedgehog-house-gallery');
  expect(inspecting.returnGeometry?.object?.width).toBeGreaterThan(0);
  expect(inspecting.returnGeometry?.source?.width).toBeGreaterThan(0);
  expect(inspecting.returnGeometry?.assignment?.id).toBe('artifact-scene:hedgehog-house-gallery');
  expect((await page.locator('.artifact-focus-viewer').count())).toBe(1);

  await page.keyboard.press('Escape');
  await expect(page.locator('.artifact-focus-viewer')).toBeHidden({ timeout: 2500 });
  await page.waitForFunction(() => window.ProfileSceneObjects.snapshot().records
    .find(record => record.id === 'artifact-scene:hedgehog-house-gallery')?.phase === 'idle');
  await expect(source).toBeFocused();
});

test('runtime interruption cancels inspection without leaving focus flights or inspect state behind', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#about/woodworking/hedgehog-house');
  await waitRuntime(page);

  await page.locator('[data-artifact-scene="hedgehog-house-gallery"] .artifact-deck-card[data-artifact-id="hedgehog-house-inside"]').click();
  await page.waitForFunction(() => window.ProfileObjectFocus.snapshot().phase === 'settled');
  await page.evaluate(() => window.ProfileSceneObjects.interrupt('phase-l-test'));

  await page.waitForFunction(() => {
    const focus = window.ProfileObjectFocus.snapshot();
    const record = window.ProfileSceneObjects.snapshot().records.find(item => item.id === 'artifact-scene:hedgehog-house-gallery');
    return !focus.activeArtifactId && !focus.pendingArtifactId && record?.phase === 'idle';
  });
  await expect(page.locator('.object-focus-flight')).toHaveCount(0);
});

test('media policy allows only one audible source and pauses media when its scene exits', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#overview');
  await waitRuntime(page);

  const result = await page.evaluate(async () => {
    const canvas = document.querySelector('.scene-canvas');
    const root = document.createElement('div');
    root.id = 'phase-l-media-sandbox';
    root.innerHTML = '<audio data-media="a"></audio><audio data-media="b"></audio>';
    canvas.appendChild(root);
    window.__phaseLMediaVisible = true;
    window.ProfileScene.registry.register({
      id: 'phase-l-media-sandbox',
      selector: '#phase-l-media-sandbox',
      visible: () => window.__phaseLMediaVisible,
      placement: 'test-media'
    });
    window.ProfileScene.manager.refresh({ reason: 'phase-l-media-test' });
    window.ProfileSceneObjects.schedule('phase-l-media-test');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const a = root.querySelector('[data-media="a"]');
    const b = root.querySelector('[data-media="b"]');
    let pauses = 0;
    Object.defineProperty(b, 'paused', { configurable: true, get: () => false });
    b.pause = () => { pauses += 1; };
    a.muted = false;
    a.volume = 1;
    b.muted = false;
    b.volume = 1;
    a.dispatchEvent(new Event('play'));

    window.__phaseLMediaVisible = false;
    window.ProfileScene.manager.refreshObject('phase-l-media-sandbox', { reason: 'phase-l-hide' });
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const phase = window.ProfileSceneObjects.snapshot().records.find(record => record.id === 'phase-l-media-sandbox')?.phase;
    window.ProfileScene.registry.unregister('phase-l-media-sandbox');
    root.remove();
    return { pauses, phase };
  });

  expect(result.pauses).toBeGreaterThanOrEqual(2);
  expect(result.phase).toBe('exit');
});

test('serialization restores object state and media position without changing route or graph geometry', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#about/woodworking/hedgehog-house');
  await waitRuntime(page);

  const before = await page.evaluate(() => {
    const node = document.querySelector('#site-graph .site-graph-node[data-node-id="hedgehog-house"]');
    window.ProfileScene.manager.setObjectState('artifact-scene:hedgehog-house-gallery', { phaseLProbe: 'saved' });
    const snapshot = window.ProfileSceneObjects.serialize({ reason: 'phase-l-test' });
    window.ProfileScene.manager.setObjectState('artifact-scene:hedgehog-house-gallery', { phaseLProbe: 'mutated' });
    const route = location.hash;
    const geometry = { x: node?.dataset.x, y: node?.dataset.y };
    const restored = window.ProfileSceneObjects.restore(snapshot, { reason: 'phase-l-test-restore' });
    return { snapshot, route, geometry, restored };
  });

  expect(before.snapshot.version).toBe(2);
  expect(before.restored).toBe(true);
  await page.waitForFunction(() => window.ProfileScene.manager.getObjectState('artifact-scene:hedgehog-house-gallery').phaseLProbe === 'saved');
  const after = await page.evaluate(() => {
    const node = document.querySelector('#site-graph .site-graph-node[data-node-id="hedgehog-house"]');
    return {
      route: location.hash,
      geometry: { x: node?.dataset.x, y: node?.dataset.y },
      state: window.ProfileScene.manager.getObjectState('artifact-scene:hedgehog-house-gallery')
    };
  });
  expect(after.route).toBe(before.route);
  expect(after.geometry).toEqual(before.geometry);
  expect(after.state.phaseLProbe).toBe('saved');
});