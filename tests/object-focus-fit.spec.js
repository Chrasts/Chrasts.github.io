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
const artifactControl = (page, scene, artifact) =>
  page.locator(`[data-artifact-scene="${scene}"] [data-artifact-focus="${artifact}"]`);
const openArtifact = async control => {
  const expand = control.locator('.artifact-inline-expand');
  if (await expand.count()) await expand.click();
  else await control.click();
};

const expectDetailOwned = async detail => {
  await expect(detail).toHaveClass(/is-open/);
  await expect(detail).toHaveAttribute('data-scene-visible', 'true');
  expect(await detail.getAttribute('hidden')).toBeNull();
};

test('focused image opens as a contained fit and only zooms on user input', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await boot(page, 'about/woodworking/hedgehog-house');
  const detail = page.locator('#site-detail-panel');
  const card = artifactControl(page, 'hedgehog-house-gallery', 'hedgehog-house-outside');
  await expect(detail).toBeVisible();
  await card.click();
  await waitSettled(page);
  await expectDetailOwned(detail);

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

test('closing focused media keeps the artifact lane stable and node detail active', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await boot(page, 'about/woodworking/hedgehog-house');
  const detail = page.locator('#site-detail-panel');
  const gallery = page.locator('[data-artifact-scene="hedgehog-house-gallery"]');
  const card = artifactControl(page, 'hedgehog-house-gallery', 'hedgehog-house-inside');
  const before = await gallery.boundingBox();
  const sourceBefore = await card.boundingBox();
  const sideBefore = await gallery.getAttribute('data-scene-side');
  await card.click();
  await waitSettled(page);
  const returnFrames = await page.evaluate(async ({ artifactId }) => new Promise(resolve => {
    const frames = [];
    const source = document.querySelector(`[data-artifact-focus="${artifactId}"]`);
    document.querySelector('.artifact-focus-backdrop')?.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    }));
    const sample = remaining => {
      const rect = source?.getBoundingClientRect();
      const viewer = document.querySelector('.artifact-focus-viewer');
      const primary = viewer?.querySelector('.artifact-focus-media > :not(.object-focus-media-hint)');
      frames.push({
        x: rect?.x ?? NaN,
        visibility: source ? getComputedStyle(source).visibility : 'missing',
        closing: viewer?.classList.contains('is-shared-focus-closing') || false,
        mediaOpacity: primary ? Number(getComputedStyle(primary).opacity) : 0
      });
      if (remaining <= 0) return resolve(frames);
      requestAnimationFrame(() => sample(remaining - 1));
    };
    sample(34);
  }), { artifactId: 'hedgehog-house-inside' });
  await expect(page.locator('.artifact-focus-viewer')).toBeHidden();
  await expect(detail).toBeVisible();
  const after = await gallery.boundingBox();
  expect(await gallery.getAttribute('data-scene-side')).toBe(sideBefore);
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(3);
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(32);
  const visibleReturnFrames = returnFrames.filter(frame => frame.visibility !== 'hidden');
  expect(visibleReturnFrames.every(frame => Math.abs(frame.x - sourceBefore.x) <= 18)).toBe(true);
  // The stage may fade, but its full-size media must stay invisible until the
  // viewer is actually removed; otherwise it flashes in its stage position.
  expect(returnFrames.filter(frame => frame.closing).every(frame => frame.mediaOpacity < .01)).toBe(true);
});

test('thesis and Modal Lab artifacts open Object Focus without dismissing their node detail', async ({ page }) => {
  for (const sample of [
    { route: 'work/project/bachelor-thesis', scene: 'bachelor-thesis-paper', artifact: 'bachelor-thesis-rol-non-a', kind: 'pdf' },
    { route: 'work/project/modal-logic-lab', scene: 'modal-logic-lab-screens', artifact: 'modal-logic-lab-screenshot-lab', kind: 'image' }
  ]) {
    await boot(page, sample.route);
    const detail = page.locator('#site-detail-panel');
    const card = artifactControl(page, sample.scene, sample.artifact);
    await expect(detail).toBeVisible();
    await openArtifact(card);
    await waitSettled(page);
    await expect(page.locator('.artifact-focus-viewer')).toHaveAttribute('data-shared-focus-artifact', sample.artifact);
    await expect(page.locator('.artifact-focus-viewer')).toHaveAttribute('data-media-kind', sample.kind);
    await expectDetailOwned(detail);
    await page.keyboard.press('Escape');
    await expect(page.locator('.artifact-focus-viewer')).toBeHidden();
    await expect(detail).toBeVisible();
  }
});

test('all focused PDFs open as large page-width reading views', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await boot(page, 'work/project/bachelor-thesis');

  for (const artifact of ['bachelor-thesis-pdf', 'bachelor-thesis-lattice-of-bands']) {
    await openArtifact(artifactControl(page, 'bachelor-thesis-paper', artifact));
    await waitSettled(page);
    const frame = page.locator('.artifact-focus-media iframe.object-focus-primary');
    await expect(frame).toHaveAttribute('data-object-focus-fit', 'reading');
    await expect(frame).toHaveAttribute('src', /toolbar=1.*scrollbar=1.*zoom=page-width$/);
    const sizing = await frame.evaluate(element => {
      const frame = element.getBoundingClientRect();
      const surface = element.closest('.artifact-focus-media').getBoundingClientRect();
      return {
        width: frame.width,
        height: frame.height,
        surfaceWidth: surface.width,
        surfaceHeight: surface.height,
        viewportHeight: window.innerHeight
      };
    });
    expect(sizing.width).toBeGreaterThan(sizing.surfaceWidth * .9);
    expect(sizing.height).toBeGreaterThan(sizing.surfaceHeight * .93);
    expect(sizing.surfaceHeight).toBeGreaterThan(sizing.viewportHeight * .9);
    await page.keyboard.press('Escape');
    await expect(page.locator('.artifact-focus-viewer')).toBeHidden();
  }
});
