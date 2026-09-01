const { test, expect } = require('@playwright/test');

const boot = async (page, route) => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
  await page.goto(`/#${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.ProfileSceneComposer && window.ProfileScene?.manager));
  if (route === 'about/woodworking/hedgehog-house') {
    await page.waitForFunction(() => Boolean(window.ProfileArtifactScenes));
  }
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
};

const viewportContained = boxes => boxes.every(box =>
  box.left >= 0 && box.right <= 1280 && box.top >= 0 && box.bottom <= 800
);

const waitStableAnchor = async (page, readAnchor) => {
  let previous = null;
  let latest = null;
  let stableSamples = 0;
  for (let attempt = 0; attempt < 30 && stableSamples < 3; attempt += 1) {
    await page.waitForTimeout(100);
    latest = await readAnchor();
    const stable = previous &&
      latest.side === previous.side &&
      Math.abs(latest.left - previous.left) <= .5 &&
      Math.abs(latest.availableWidth - previous.availableWidth) <= 1;
    stableSamples = stable ? stableSamples + 1 : 0;
    previous = latest;
  }
  expect(stableSamples).toBeGreaterThanOrEqual(3);
  return latest;
};

test.describe('Phase D scene composition', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('Hedgehog gallery resolves around the inspector and remains visually contained', async ({ page }) => {
    await boot(page, 'about/woodworking/hedgehog-house');
    const gallery = page.locator('[data-artifact-scene="hedgehog-house-gallery"]');
    await expect(gallery).toBeVisible();
    await expect(gallery).toHaveAttribute('data-scene-zone', 'side-stage');
    await expect(gallery).toHaveAttribute('data-scene-side', 'left');

    const readBoxes = () => gallery.locator('.artifact-deck-card').evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    }));
    await expect.poll(async () => viewportContained(await readBoxes())).toBe(true);

    const boxes = await readBoxes();
    boxes.forEach(box => {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(1280);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.bottom).toBeLessThanOrEqual(800);
    });
    const snapshot = await page.evaluate(() => window.ProfileSceneComposer.snapshot());
    expect(snapshot.assignments.find(item => item.id === 'detail-panel')).toMatchObject({ zone: 'inspector', side: 'right' });
    expect(snapshot.assignments.find(item => item.id === 'artifact-scene:hedgehog-house-gallery')).toMatchObject({ zone: 'side-stage', side: 'left', preferredSide: 'right', role: 'artifact' });
  });

  test('resolved artifact lane keeps its settled composer anchor after inspector dismissal', async ({ page }) => {
    await boot(page, 'about/woodworking/hedgehog-house');
    const detail = page.locator('#site-detail-panel');
    const gallery = page.locator('[data-artifact-scene="hedgehog-house-gallery"]');
    await expect(detail).toBeVisible();

    const readAnchor = () => gallery.evaluate(element => ({
      side: element.dataset.sceneSide || null,
      left: parseFloat(getComputedStyle(element).left),
      availableWidth: parseFloat(getComputedStyle(element).getPropertyValue('--scene-side-available-width'))
    }));
    const readBoxes = () => gallery.locator('.artifact-deck-card').evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    }));

    const before = await waitStableAnchor(page, readAnchor);
    expect(before.side).toBe('left');
    expect(Number.isFinite(before.left)).toBe(true);

    const point = await page.evaluate(() => {
      for (let y = 90; y < innerHeight - 80; y += 40) {
        for (let x = 520; x < innerWidth - 420; x += 40) {
          const target = document.elementFromPoint(x, y);
          if (!target) continue;
          if (target.closest('#site-detail-panel,[data-artifact-scene],#site-graph .site-graph-node')) continue;
          return { x, y };
        }
      }
      return { x: 640, y: 120 };
    });
    await page.mouse.click(point.x, point.y);
    await expect(detail).toBeHidden();

    const after = await waitStableAnchor(page, readAnchor);
    expect(Math.abs(after.left - before.left)).toBeLessThanOrEqual(6);
    expect(after.side).toBe('left');
    await expect.poll(async () => viewportContained(await readBoxes())).toBe(true);
  });

  test('declarative composition requests can reserve and flip a generic side-stage object', async ({ page }) => {
    await boot(page, 'education');
    await page.evaluate(() => {
      const canvas = document.querySelector('.scene-canvas');
      const blocker = document.createElement('section');
      blocker.className = 'phase-d-contract-blocker';
      blocker.style.cssText = 'position:absolute;width:180px;height:220px';
      const floating = document.createElement('section');
      floating.className = 'phase-d-contract-floating';
      floating.style.cssText = 'position:absolute;width:220px;height:160px';
      canvas.append(blocker, floating);
      window.ProfileScene.registry.register({ id: 'phase-d-contract-blocker', selector: '.phase-d-contract-blocker', visible: true, composition: { zone: 'inspector', side: 'right', preferredSide: 'right', allowFlip: false, blocksSideStage: true, priority: 1000, role: 'test-blocker' } });
      window.ProfileScene.registry.register({ id: 'phase-d-contract-floating', selector: '.phase-d-contract-floating', visible: true, composition: { zone: 'side-stage', preferredSide: 'right', allowFlip: true, priority: 20, role: 'semantic' } });
    });
    const floating = page.locator('.phase-d-contract-floating');
    await expect(floating).toHaveAttribute('data-scene-composed', 'true');
    await expect(floating).toHaveAttribute('data-scene-side', 'left');
  });
});
