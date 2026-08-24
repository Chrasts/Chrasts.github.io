const { test, expect } = require('@playwright/test');

const bootFocus = async (page, route = 'about/woodworking/hedgehog-house') => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/#${route}`);
  await page.waitForFunction(() => Boolean(
    window.ProfileCameraMateriality?.snapshot?.().ready &&
    window.ProfileCameraComposition?.__camera25d &&
    window.ProfileCameraComposition?.boot?.()
  ));
  await page.waitForFunction(() =>
    document.body.dataset.graphMode === 'focus' &&
    !document.body.classList.contains('is-v9-transitioning')
  );
  await page.waitForTimeout(220);
};

const bootAtlas = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#atlas');
  await page.waitForFunction(() => Boolean(
    window.ProfileAtlasLOD &&
    window.ProfileCameraMateriality?.snapshot?.().ready &&
    window.ProfileCameraComposition?.__camera25d
  ));
  await page.waitForFunction(() => document.body.dataset.graphMode === 'atlas');
  await page.waitForTimeout(240);
};

test.describe('V3.1 Phase D camera + 2.5D', () => {
  test('camera exposes one semantic API and deterministic depth channels over the existing adapters', async ({ page }) => {
    await bootFocus(page);
    const state = await page.evaluate(() => {
      const camera = window.ProfileCameraComposition;
      const materiality = window.ProfileCameraMateriality.snapshot();
      return {
        adapter: window.ProfileScene.camera.activeName,
        upgraded: camera.__camera25d,
        methods: ['fit', 'focus', 'follow', 'pushIn', 'pullOut', 'makeRoom', 'inspect', 'peek', 'return', 'retarget', 'serialize']
          .filter(name => typeof camera[name] === 'function'),
        depth: camera.DEPTH,
        materialityDepth: materiality.depthChannels,
        layers: [...document.querySelectorAll('#site-graph .site-graph-edges,#site-graph .site-graph-decorations,#site-graph .site-graph-nodes')]
          .map(element => element.dataset.depthChannel)
      };
    });

    expect(state.upgraded).toBe(true);
    expect(state.adapter).toBe('desktop-local');
    expect(state.methods).toHaveLength(11);
    expect(state.depth).toEqual(state.materialityDepth);
    expect(state.layers).toEqual(['DEPTH_BACKGROUND', 'DEPTH_GRAPH_BASE', 'DEPTH_GRAPH_BASE']);
  });

  test('INSPECT produces differential parallax without mutating canonical node geometry and settles cleanly', async ({ page }) => {
    await bootFocus(page);
    const before = await page.evaluate(() => [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
      .map(node => ({ id: node.dataset.nodeId, x: node.dataset.x, y: node.dataset.y })));

    expect(await page.evaluate(() => window.ProfileCameraComposition.inspect('hedgehog-house', { duration: 440 }))).toBe(true);
    await page.waitForFunction(() => document.querySelector('#site-graph')?.classList.contains('is-camera-25d-moving'));
    await page.waitForFunction(() => Math.abs(window.ProfileCameraMateriality.snapshot().pulse) > .08);

    const moving = await page.evaluate(() => {
      const root = document.querySelector('#site-graph');
      const edgeLayer = root.querySelector('.site-graph-edges');
      const nodeLayer = root.querySelector('.site-graph-nodes');
      return {
        action: window.ProfileCameraMateriality.snapshot().action,
        edgeTransform: getComputedStyle(edgeLayer).transform,
        nodeTransform: getComputedStyle(nodeLayer).transform,
        pulse: Number(getComputedStyle(root).getPropertyValue('--camera-25d-pulse')),
        canonical: [...root.querySelectorAll('.site-graph-node[data-node-id]')]
          .map(node => ({ id: node.dataset.nodeId, x: node.dataset.x, y: node.dataset.y }))
      };
    });

    expect(moving.action).toBe('INSPECT');
    expect(Math.abs(moving.pulse)).toBeGreaterThan(.05);
    expect(moving.edgeTransform).not.toBe(moving.nodeTransform);
    expect(moving.canonical).toEqual(before);

    await page.waitForFunction(() => window.ProfileCameraMateriality.snapshot().phase === 'idle', null, { timeout: 2500 });
    const settled = await page.evaluate(() => ({
      action: window.ProfileCameraMateriality.snapshot().action,
      moving: document.querySelector('#site-graph').classList.contains('is-camera-25d-moving'),
      edgeInline: document.querySelector('#site-graph .site-graph-edges').style.transform,
      nodeInline: document.querySelector('#site-graph .site-graph-nodes').style.transform,
      canonical: [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
        .map(node => ({ id: node.dataset.nodeId, x: node.dataset.x, y: node.dataset.y }))
    }));
    expect(settled.action).toBe('IDLE');
    expect(settled.moving).toBe(false);
    expect(settled.edgeInline).toBe('');
    expect(settled.nodeInline).toBe('');
    expect(settled.canonical).toEqual(before);
  });

  test('new semantic commands retarget the current material response rather than starting a second camera owner', async ({ page }) => {
    await bootFocus(page);
    const before = await page.evaluate(() => window.ProfileCameraMateriality.snapshot());
    await page.evaluate(() => {
      const camera = window.ProfileCameraComposition;
      camera.pushIn('hedgehog-house', { duration: 520 });
      camera.makeRoom('hedgehog-house', { duration: 260 });
    });
    await page.waitForFunction(() => window.ProfileCameraMateriality.snapshot().action === 'MAKE_ROOM');

    const state = await page.evaluate(() => ({
      materiality: window.ProfileCameraMateriality.snapshot(),
      adapter: window.ProfileScene.camera.activeName,
      camera: window.ProfileCameraComposition.snapshot(),
      serialized: window.ProfileCameraComposition.serialize()
    }));
    expect(state.materiality.sequence).toBeGreaterThan(before.sequence);
    expect(state.materiality.retargets).toBeGreaterThan(before.retargets);
    expect(state.materiality.action).toBe('MAKE_ROOM');
    expect(state.adapter).toBe('desktop-local');
    expect(state.camera.adapter).toBe('desktop-local');
    expect(state.serialized.materiality.depthChannels.GRAPH_ACTIVE).toBe('DEPTH_GRAPH_ACTIVE');
  });

  test('Atlas push uses the same semantic layer and foregrounds the selected graph node', async ({ page }) => {
    await bootAtlas(page);
    const node = page.locator('#site-graph .site-graph-node[data-node-id="sat-smt"]');
    await node.click();
    await expect(node).toHaveClass(/is-previewed/);
    await page.waitForFunction(() => document.querySelector('#site-graph .site-graph-node[data-node-id="sat-smt"]')?.dataset.depthChannel === 'DEPTH_GRAPH_ACTIVE');

    const origin = await page.evaluate(() => window.ProfileAtlasLOD.snapshot().targetCamera);
    expect(await page.evaluate(() => window.ProfileCameraComposition.pushIn('sat-smt', { duration: 420 }))).toBe(true);
    await page.waitForFunction(() => window.ProfileCameraMateriality.snapshot().action === 'PUSH');
    await page.waitForFunction(() => {
      const state = window.ProfileAtlasLOD.snapshot();
      return Math.abs(state.camera.scale - state.targetCamera.scale) < .002;
    });

    const result = await page.evaluate(() => ({
      target: window.ProfileAtlasLOD.snapshot().targetCamera,
      motion: window.ProfileCameraMateriality.snapshot(),
      depth: document.querySelector('#site-graph .site-graph-node[data-node-id="sat-smt"]').dataset.depthChannel
    }));
    expect(result.target.scale).toBeGreaterThan(origin.scale);
    expect(result.motion.cameraAdapter).toBe('atlas');
    expect(result.depth).toBe('DEPTH_GRAPH_ACTIVE');
  });

  test('reduced motion preserves camera semantics but suppresses 2.5D displacement', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await bootFocus(page);
    expect(await page.evaluate(() => window.ProfileCameraComposition.inspect('hedgehog-house', { duration: 500 }))).toBe(true);
    await page.waitForTimeout(80);
    const state = await page.evaluate(() => ({
      materiality: window.ProfileCameraMateriality.snapshot(),
      rootMoving: document.querySelector('#site-graph').classList.contains('is-camera-25d-moving'),
      motionDataset: document.body.dataset.cameraMotion || null,
      activePreset: window.ProfileCameraComposition.snapshot().activePreset
    }));
    expect(state.materiality.reducedMotion).toBe(true);
    expect(state.rootMoving).toBe(false);
    expect(state.motionDataset).toBeNull();
    expect(state.activePreset).toBe('INSPECT');
  });
});
