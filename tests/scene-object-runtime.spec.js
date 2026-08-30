const { test, expect } = require('@playwright/test');

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const waitRuntime = async page => {
  await page.waitForFunction(() => Boolean(
    window.ProfileScene?.objects &&
    window.ProfileArtifactScenes &&
    window.ProfileObjectFocus
  ));
  await page.waitForFunction(() => window.ProfileScene.objects.snapshot().objects
    .filter(record => record.sceneId === 'artifact-scene:hedgehog-house-gallery').length === 3);
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
};

const deterministicRecord = record => ({
  id: record.id,
  kind: record.kind,
  layout: record.layout,
  depth: record.depth,
  composition: record.composition ? {
    zone: record.composition.zone,
    side: record.composition.side,
    slot: record.composition.slot,
    route: record.composition.route
  } : null
});

test.describe('Phase L Scene Object Runtime 2.0', () => {
  test.beforeEach(async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#about/woodworking/hedgehog-house');
    await waitRuntime(page);
  });

  test('exposes the five pilot object classes through one canonical runtime', async ({ page }) => {
    const contract = await page.evaluate(() => ({
      runtime: typeof window.ProfileScene.SceneObjectRuntime,
      classes: window.ProfileScene.objects.snapshot().classes,
      managerUsesRuntime: window.ProfileScene.manager.objects === window.ProfileScene.objects,
      transitionParticipant: window.ProfileScene.transitions.diagnostics().participants.includes('scene-objects')
    }));

    expect(contract.runtime).toBe('function');
    expect(contract.classes).toEqual(['image', 'document', 'video', 'diagram', 'data-visualisation']);
    expect(contract.managerUsesRuntime).toBe(true);
    expect(contract.transitionParticipant).toBe(true);
  });

  test('artifact objects receive deterministic layout, depth and composer state', async ({ page }) => {
    await page.waitForFunction(() => {
      const records = window.ProfileScene.objects.snapshot().objects;
      return records.filter(record => record.sceneId === 'artifact-scene:hedgehog-house-gallery')
        .every(record => record.composition?.zone === 'side-stage');
    });

    const before = (await page.evaluate(() => window.ProfileScene.objects.snapshot().objects
      .filter(record => record.sceneId === 'artifact-scene:hedgehog-house-gallery')))
      .map(deterministicRecord);

    await page.evaluate(() => window.ProfileScene.objects.layoutScene('artifact-scene:hedgehog-house-gallery'));
    const after = (await page.evaluate(() => window.ProfileScene.objects.snapshot().objects
      .filter(record => record.sceneId === 'artifact-scene:hedgehog-house-gallery')))
      .map(deterministicRecord);

    /* composition.sequence is a generation counter for recomposition, not part
       of an object's deterministic placement contract. */
    expect(before).toEqual(after);
    expect(before).toHaveLength(3);
    before.forEach(record => {
      expect(record.kind).toBe('image');
      expect(record.layout.strategy).toBe('fan');
      expect(record.depth.channel).toBe('content');
      expect(record.composition.zone).toBe('side-stage');
      expect(['left', 'right']).toContain(record.composition.side);
    });
  });

  test('focus captures exact return geometry and settles back into the same object', async ({ page }) => {
    const source = page.locator('.artifact-deck-card[data-artifact-id="hedgehog-house-inside"]');
    const runtimeId = 'artifact-object:hedgehog-house-gallery:hedgehog-house-inside';
    await source.hover();
    await page.waitForTimeout(360);
    const origin = await source.boundingBox();

    await source.click();
    await page.waitForFunction(() => window.ProfileObjectFocus.snapshot().phase === 'settled');
    const focused = await page.evaluate(id => window.ProfileScene.objects.getState(id), runtimeId);

    expect(focused.phase).toBe('inspect');
    expect(focused.selected).toBe(true);
    expect(Math.abs(focused.returnGeometry.x - origin.x)).toBeLessThan(2);
    expect(Math.abs(focused.returnGeometry.y - origin.y)).toBeLessThan(2);
    expect(Math.abs(focused.returnGeometry.width - origin.width)).toBeLessThan(2);
    expect((await page.evaluate(() => window.ProfileObjectFocus.snapshot())).runtimeId).toBe(runtimeId);

    await page.keyboard.press('Escape');
    await expect(page.locator('.artifact-focus-viewer')).toBeHidden({ timeout: 2000 });
    const returned = await page.evaluate(id => window.ProfileScene.objects.getState(id), runtimeId);
    expect(returned.phase).toBe('active');
    expect(returned.returnGeometry).toEqual(focused.returnGeometry);
    await expect(source).toHaveAttribute('data-scene-runtime-phase', 'active');
  });

  test('interruption cancels transient focus and pauses runtime media state', async ({ page }) => {
    const source = page.locator('.artifact-deck-card[data-artifact-id="hedgehog-house-outside"]');
    const runtimeId = 'artifact-object:hedgehog-house-gallery:hedgehog-house-outside';

    await source.click();
    await page.waitForFunction(() => window.ProfileObjectFocus.snapshot().phase === 'settled');
    await page.evaluate(id => {
      window.ProfileScene.objects.setMediaState(id, { status: 'playing', currentTime: 8.25 });
      window.ProfileScene.transitions.interrupt({ reason: 'phase-l-stress' });
    }, runtimeId);
    await expect(page.locator('.artifact-focus-viewer')).toBeHidden({ timeout: 2000 });

    const state = await page.evaluate(id => window.ProfileScene.objects.getState(id), runtimeId);
    expect(['active', 'ambient']).toContain(state.phase);
    expect(state.media.status).toBe('paused');
    expect(state.interruption.reason).toMatch(/phase-l-stress|object-focus-interrupted/);
    await expect(page.locator('.object-focus-flight')).toHaveCount(0);
  });

  test('versioned serialization restores selection and safe media state', async ({ page }) => {
    const inside = page.locator('.artifact-deck-card[data-artifact-id="hedgehog-house-inside"]');
    const outside = page.locator('.artifact-deck-card[data-artifact-id="hedgehog-house-outside"]');
    const runtimeId = 'artifact-object:hedgehog-house-gallery:hedgehog-house-inside';

    await inside.hover();
    await page.evaluate(id => window.ProfileScene.objects.setMediaState(id, {
      status: 'playing', currentTime: 12.5, duration: 42, muted: false, volume: .4
    }), runtimeId);
    const payload = await page.evaluate(() => window.ProfileScene.objects.serialize());
    await outside.hover();
    await page.evaluate(serialized => window.ProfileScene.objects.restore(serialized), payload);

    const restored = await page.evaluate(id => window.ProfileScene.objects.getState(id), runtimeId);
    expect(payload.version).toBe(2);
    expect(restored.selected).toBe(true);
    expect(restored.phase).toBe('active');
    expect(restored.media.currentTime).toBe(12.5);
    expect(restored.media.duration).toBe(42);
    expect(restored.media.volume).toBe(.4);
    expect(restored.media.status).toBe('paused');
    await expect(inside).toHaveClass(/is-active/);
    await expect(inside).toHaveAttribute('aria-current', 'true');
  });

  test('synthetic pilot objects share lifecycle and deterministic interruption rules', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const scene = window.ProfileScene;
      const canvas = document.querySelector('.scene-canvas');
      const root = document.createElement('section');
      root.dataset.phaseLObjectPilot = 'true';
      canvas.appendChild(root);
      const kinds = ['image', 'document', 'video', 'diagram', 'data-visualisation'];
      kinds.forEach((kind, index) => {
        const element = document.createElement('button');
        element.type = 'button';
        root.appendChild(element);
        scene.objects.register({
          id: `phase-l-pilot:${kind}`,
          sceneId: 'phase-l-pilot-scene',
          kind,
          element,
          layout: { strategy: 'scatter', seed: 'phase-l-contract', index, count: kinds.length }
        });
      });
      scene.registry.register({
        id: 'phase-l-pilot-scene',
        selector: '[data-phase-l-object-pilot]',
        visible: true,
        placement: 'artifact-contextual'
      });
      scene.manager.refresh({ reason: 'phase-l-contract' });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      scene.objects.activate('phase-l-pilot:video');
      scene.objects.setMediaState('phase-l-pilot:video', { status: 'playing', currentTime: 4 });
      scene.objects.beginFocus('phase-l-pilot:diagram');
      scene.objects.settleFocus('phase-l-pilot:diagram');
      const layouts = kinds.map(kind => scene.objects.getState(`phase-l-pilot:${kind}`).layout);
      const replay = kinds.map((kind, index) => ({
        strategy: 'scatter',
        ...scene.objects.deterministicLayout({
          strategy: 'scatter', seed: 'phase-l-contract', index, count: kinds.length
        })
      }));
      scene.objects.interruptAll('synthetic-stress');
      const interrupted = kinds.map(kind => scene.objects.getState(`phase-l-pilot:${kind}`));
      scene.registry.unregister('phase-l-pilot-scene');
      root.remove();
      return { layouts, replay, interrupted, remaining: scene.objects.getState('phase-l-pilot:image') };
    });

    expect(result.layouts).toEqual(result.replay);
    expect(result.interrupted.find(record => record.kind === 'video').media.status).toBe('paused');
    expect(result.interrupted.find(record => record.kind === 'diagram').phase).toBe('active');
    expect(result.remaining).toBeNull();
  });
});
