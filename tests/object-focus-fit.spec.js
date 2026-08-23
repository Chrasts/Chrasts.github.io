const { test, expect } = require('@playwright/test');

const boot = async (page, route) => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
  await page.goto(`/#${route}`);
  await page.waitForFunction(() => Boolean(window.ProfileObjectFocus && window.ProfileObjectFocusFit && window.ProfileArtifactScenes));
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  await page.waitForTimeout(220);
};

const waitSettled = page => page.waitForFunction(() => window.ProfileObjectFocus?.snapshot().phase === 'settled');

test('focused image opens as a contained fit and only zooms on user input', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await boot(page, 'about/woodworking/hedgehog-house');
  const detail = page.locator('#site-detail-panel');
  const card = page.locator('[data-artifact-scene="hedgehog-house-gallery"] [data-artifact-id="hedgehog-house-outside"]');
  await expect(detail).toBeVisible();
  await card.click();
  await waitSettled(page);
  await expect(detail).toBeVisible();

  const image = page.locator('.artifact-focus-media img.object-focus-primary');
  await expect(image).toHaveAttribute('data-object-focus-fit', 'contain');
  const geometry = await image.evaluate(element => {
    const image = element.getBoundingClientRect();
    const surface = element.closest('.artifact-focus-media').getBoundingClientRect();
    return {
      image: { width: image.width, height: image.height },
      surface: { width: surface.width, height: surface.height },
      displayRatio: image.width / image.height,
      naturalRatio: element.naturalWidth / element.naturalHeight
    };
  });
  expect(geometry.image.width).toBeLessThanOrEqual(geometry.surface.width * .9);
  expect(geometry.image.height).toBeLessThanOrEqual(geometry.surface.height * .84);
  expect(Math.abs(geometry.displayRatio - geometry.naturalRatio)).toBeLessThan(.02);
  expect((await page.evaluate(() => window.ProfileObjectFocus.snapshot())).media.zoom).toBeCloseTo(1, 2);

  const box = await image.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -240);
  await expect.poll(async () => (await page.evaluate(() => window.ProfileObjectFocus.snapshot())).media.zoom).toBeGreaterThan(1.05);
});

test('closing focused media restores the same scene placement and keeps node detail active', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await boot(page, 'about/woodworking/hedgehog-house');
  const detail = page.locator('#site-detail-panel');
  const gallery = page.locator('[data-artifact-scene="hedgehog-house-gallery"]');
  const card = gallery.locator('[data-artifact-id="hedgehog-house-inside"]');
  const before = await gallery.boundingBox();
  await card.click();
  await waitSettled(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.artifact-focus-viewer')).toBeHidden();
  await expect(detail).toBeVisible();
  const after = await gallery.boundingBox();
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(3);
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(3);
});

test('thesis and Modal Lab artifacts open Object Focus without dismissing their node detail', async ({ page }) => {
  for (const sample of [
    { route: 'work/project/bachelor-thesis', scene: 'bachelor-thesis-diagrams', artifact: 'bachelor-thesis-rol-non-a', kind: 'pdf' },
    { route: 'work/project/modal-logic-lab', scene: 'modal-logic-lab-screens', artifact: 'modal-logic-lab-screenshot-lab', kind: 'image' }
  ]) {
    await boot(page, sample.route);
    const detail = page.locator('#site-detail-panel');
    const card = page.locator(`[data-artifact-scene="${sample.scene}"] [data-artifact-id="${sample.artifact}"]`);
    await expect(detail).toBeVisible();
    await card.click();
    await waitSettled(page);
    await expect(page.locator('.artifact-focus-viewer')).toHaveAttribute('data-shared-focus-artifact', sample.artifact);
    await expect(page.locator('.artifact-focus-viewer')).toHaveAttribute('data-media-kind', sample.kind);
    await expect(detail).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.artifact-focus-viewer')).toBeHidden();
  }
});

test('focused PDF uses whole-page fit with user zoom controls available', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await boot(page, 'work/project/bachelor-thesis');
  await page.locator('[data-artifact-scene="bachelor-thesis-diagrams"] [data-artifact-id="bachelor-thesis-lattice-of-bands"]').click();
  await waitSettled(page);
  const frame = page.locator('.artifact-focus-media iframe.object-focus-primary');
  await expect(frame).toHaveAttribute('data-object-focus-fit', 'contain');
  await expect(frame).toHaveAttribute('src', /toolbar=1.*view=Fit$/);
  const sizing = await frame.evaluate(element => {
    const frame = element.getBoundingClientRect();
    const surface = element.closest('.artifact-focus-media').getBoundingClientRect();
    return { width: frame.width, height: frame.height, surfaceWidth: surface.width, surfaceHeight: surface.height };
  });
  expect(sizing.width).toBeLessThan(sizing.surfaceWidth * .9);
  expect(sizing.height).toBeLessThan(sizing.surfaceHeight * .9);
});
