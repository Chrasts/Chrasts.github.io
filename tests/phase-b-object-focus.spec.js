const { test, expect } = require('@playwright/test');

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const waitPhaseB = async page => {
  await page.waitForFunction(() => Boolean(
    window.ProfileArtifactScenes &&
    window.ProfilePhase8 &&
    window.ProfilePhaseBObjectFocus
  ));
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  await page.waitForTimeout(180);
};

const waitSettled = async page => {
  await page.waitForFunction(() => window.ProfilePhaseBObjectFocus?.snapshot().phase === 'settled');
};

const openHedgehog = async page => {
  await page.goto('/#about/woodworking/hedgehog-house');
  await waitPhaseB(page);
  const active = page.locator('[data-artifact-scene="hedgehog-house-gallery"] .artifact-deck-card.is-active');
  await active.click();
  await waitSettled(page);
  return { active, viewer: page.locator('.artifact-focus-viewer') };
};

test('Hedgehog House follows Ambient to Active to Inspect and returns to the same source', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#about/woodworking/hedgehog-house');
  await waitPhaseB(page);

  const gallery = page.locator('[data-artifact-scene="hedgehog-house-gallery"]');
  const outside = gallery.locator('.artifact-deck-card[data-artifact-id="hedgehog-house-outside"]');
  const inside = gallery.locator('.artifact-deck-card[data-artifact-id="hedgehog-house-inside"]');
  const viewer = page.locator('.artifact-focus-viewer');

  await expect(outside).toHaveAttribute('data-object-focus-state', 'active');
  await expect(inside).toHaveAttribute('data-object-focus-state', 'ambient');

  await inside.click();
  await expect(inside).toHaveAttribute('data-object-focus-state', 'active');
  await expect(outside).toHaveAttribute('data-object-focus-state', 'ambient');

  await inside.click();
  await waitSettled(page);
  await expect(viewer).toBeVisible();
  await expect(viewer).toHaveAttribute('data-shared-focus-artifact', 'hedgehog-house-inside');
  await expect(viewer).toHaveAttribute('data-shared-focus-owner', 'artifact');
  await expect(viewer).toHaveAttribute('data-media-kind', 'image');
  await expect(inside).toHaveAttribute('data-object-focus-state', 'inspect');
  await expect(viewer.locator('.artifact-focus-media img')).toHaveAttribute('src', /hedgehog-house\/inside\.jpg$/);

  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden({ timeout: 2000 });
  await expect(inside).toHaveAttribute('data-object-focus-state', 'active');
  await expect(inside).toBeFocused();
  expect((await page.evaluate(() => window.ProfilePhaseBObjectFocus.snapshot())).activeArtifactId).toBeNull();
});

test('certificate stack uses selection first and the same direct-manipulation image stage second', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#education/credentials');
  await waitPhaseB(page);

  const stack = page.locator('[data-phase8-object="certificate-stack"]');
  const ethics = stack.locator('.phase8-certificate-paper[data-artifact-id="ethics-ai-certificate"]');
  const viewer = page.locator('.artifact-focus-viewer');

  await ethics.click();
  await expect(ethics).toHaveAttribute('data-object-focus-state', 'active');
  await expect(stack.locator('[data-phase-b-certificate-inspect]')).toBeVisible();

  await ethics.click();
  await waitSettled(page);
  await expect(viewer).toBeVisible();
  await expect(viewer).toHaveAttribute('data-shared-focus-artifact', 'ethics-ai-certificate');
  await expect(viewer).toHaveAttribute('data-shared-focus-owner', 'certificate');
  await expect(viewer).toHaveAttribute('data-media-kind', 'image');
  await expect(ethics).toHaveAttribute('data-object-focus-state', 'inspect');
  await expect(viewer.locator('.artifact-focus-media img')).toHaveAttribute('src', /assets\/images\/certificates\/ethics-of-ai\.png$/);
  await expect(viewer.locator('[data-artifact-image-zoom="true"]')).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden({ timeout: 2000 });
  await expect(ethics).toHaveAttribute('data-object-focus-state', 'active');
});

test('BSc thesis diagram becomes a clean PDF inspection surface and returns', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#work/project/bachelor-thesis');
  await waitPhaseB(page);

  const deck = page.locator('[data-artifact-scene="bachelor-thesis-diagrams"]');
  const first = deck.locator('.artifact-deck-card[data-artifact-id="bachelor-thesis-lattice-of-bands"]');
  const viewer = page.locator('.artifact-focus-viewer');

  await expect(first).toHaveAttribute('data-object-focus-state', 'active');
  await first.click();
  await waitSettled(page);
  await expect(viewer).toHaveAttribute('data-shared-focus-artifact', 'bachelor-thesis-lattice-of-bands');
  await expect(viewer).toHaveAttribute('data-media-kind', 'pdf');
  await expect(first).toHaveAttribute('data-object-focus-state', 'inspect');
  await expect(viewer.locator('.artifact-focus-media iframe')).toHaveAttribute('src', /lattice-of-bands\.pdf#toolbar=0&navpanes=0&scrollbar=0&view=FitH/);

  await page.locator('.artifact-focus-close').click();
  await expect(viewer).toBeHidden({ timeout: 2000 });
  await expect(first).toHaveAttribute('data-object-focus-state', 'active');
});

test('image focus uses wheel zoom and cursor drag instead of a binary zoom button', async ({ page }) => {
  await bypassIntro(page);
  const { viewer } = await openHedgehog(page);
  const surface = viewer.locator('.artifact-focus-media');
  const image = surface.locator('img.phase-b-panzoom-media');

  await expect(viewer.locator('[data-artifact-image-zoom="true"]')).toHaveCount(0);
  expect(await image.evaluate(node => getComputedStyle(node).cursor)).toBe('grab');

  const imageBox = await image.boundingBox();
  await page.mouse.move(imageBox.x + imageBox.width / 2, imageBox.y + imageBox.height / 2);
  await page.mouse.wheel(0, -900);
  await page.waitForTimeout(100);
  let media = await page.evaluate(() => window.ProfilePhaseBObjectFocus.snapshot().media);
  expect(media.zoom).toBeGreaterThan(1.5);

  const zoomedBox = await image.boundingBox();
  await page.mouse.move(zoomedBox.x + zoomedBox.width / 2, zoomedBox.y + zoomedBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(zoomedBox.x + zoomedBox.width / 2 + 54, zoomedBox.y + zoomedBox.height / 2 + 34, { steps: 4 });
  await page.mouse.up();
  media = await page.evaluate(() => window.ProfilePhaseBObjectFocus.snapshot().media);
  expect(Math.abs(media.panX) + Math.abs(media.panY)).toBeGreaterThan(8);

  await image.dblclick();
  await page.waitForTimeout(180);
  media = await page.evaluate(() => window.ProfilePhaseBObjectFocus.snapshot().media);
  expect(media.zoom).toBeCloseTo(1, 2);
  expect(Math.abs(media.panX) + Math.abs(media.panY)).toBeLessThan(1);
});

test('clicking empty focus space dismisses once and cannot resurrect the viewer', async ({ page }) => {
  await bypassIntro(page);
  const { viewer } = await openHedgehog(page);
  const surface = viewer.locator('.artifact-focus-media');

  await surface.click({ position: { x: 3, y: 3 } });
  await expect(viewer).toBeHidden({ timeout: 2000 });
  await page.waitForTimeout(450);
  await expect(viewer).toBeHidden();
  await expect(page.locator('.phase-b-focus-flight')).toHaveCount(0);
  const snapshot = await page.evaluate(() => window.ProfilePhaseBObjectFocus.snapshot());
  expect(snapshot.activeArtifactId).toBeNull();
  expect(snapshot.pendingArtifactId).toBeNull();
});

test('Phase B has a reduced-motion focus path without a flight animation', async ({ page }) => {
  await bypassIntro(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#about/woodworking/hedgehog-house');
  await waitPhaseB(page);

  const active = page.locator('[data-artifact-scene="hedgehog-house-gallery"] .artifact-deck-card.is-active');
  await active.click();
  await waitSettled(page);

  const snapshot = await page.evaluate(() => window.ProfilePhaseBObjectFocus.snapshot());
  expect(snapshot.reducedMotion).toBe(true);
  expect(snapshot.lastTransition).toBe('reduced-open');
  await expect(page.locator('.phase-b-focus-flight')).toHaveCount(0);
});

test('rapid Escape during focus opening cancels pending state cleanly', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#about/woodworking/hedgehog-house');
  await waitPhaseB(page);

  await page.evaluate(() => {
    const card = document.querySelector('[data-artifact-scene="hedgehog-house-gallery"] .artifact-deck-card.is-active');
    card.click();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  });

  await expect(page.locator('.artifact-focus-viewer')).toBeHidden({ timeout: 2000 });
  const snapshot = await page.evaluate(() => window.ProfilePhaseBObjectFocus.snapshot());
  expect(snapshot.activeArtifactId).toBeNull();
  expect(snapshot.pendingArtifactId).toBeNull();
  expect(snapshot.lastTransition).toBe('interrupted');
  await expect(page.locator('.phase-b-focus-flight')).toHaveCount(0);
});

test('mobile image focus remains inside the application viewport and exposes touch pan/zoom semantics', async ({ page }) => {
  await bypassIntro(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const { viewer } = await openHedgehog(page);

  const bounds = await page.locator('.artifact-focus-shell').evaluate(element => {
    const box = element.getBoundingClientRect();
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: innerWidth, height: innerHeight };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.width + 1);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.height + 1);
  await expect(viewer.locator('.artifact-focus-media')).toHaveAttribute('data-media-kind', 'image');
  await expect(viewer.locator('.phase-b-media-hint')).toContainText('Scroll to zoom');
});
