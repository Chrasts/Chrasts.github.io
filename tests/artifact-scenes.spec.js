const { test, expect } = require('@playwright/test');

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const waitArtifactScenes = async page => {
  await page.waitForFunction(() => Boolean(
    window.ProfileArtifactScenes &&
    window.ProfileArtifactSceneLayout &&
    window.ProfileArtifacts &&
    window.ProfileRefinements &&
    window.ProfilePhaseBObjectFocus
  ));
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  await page.waitForTimeout(180);
};

const waitSettled = async page => {
  await page.waitForFunction(() => window.ProfilePhaseBObjectFocus?.snapshot().phase === 'settled');
};

test('artifact architecture boots with reusable folio and deck recipes', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#overview');
  await waitArtifactScenes(page);

  const snapshot = await page.evaluate(() => window.ProfileArtifactScenes.snapshot());
  expect(snapshot.issues).toEqual([]);
  expect(snapshot.recipeNames.sort()).toEqual(['document-folio', 'media-deck']);
  expect(await page.locator('[data-artifact-scene]').count()).toBe(5);
});

test('Simulation Credence is a document object and opens as a clean PDF stage', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#education/charles-university/coursework/simulation-credence');
  await waitArtifactScenes(page);

  const folio = page.locator('[data-artifact-scene="simulation-credence-paper"]');
  await expect(folio).toBeVisible();
  await expect(folio).toHaveAttribute('data-artifact-side', 'left');
  await expect(folio.locator('.artifact-object-header')).toHaveCount(0);
  await expect(folio.locator('iframe')).toHaveAttribute('src', /simulation-credence-and-its-consequences\.pdf#page=1/);

  await folio.locator('[data-artifact-focus="simulation-credence-coursework"]').click();
  const viewer = page.locator('.artifact-focus-viewer');
  await expect(viewer).toBeVisible();
  await expect(viewer).toHaveAttribute('data-media-stage', 'phase-b');
  await expect(viewer).toHaveAttribute('data-media-kind', 'pdf');
  await expect(viewer.locator('.artifact-focus-title')).toContainText('Simulation Credence and Its Consequences');
  await expect(viewer.locator('.artifact-focus-media iframe')).toHaveAttribute('src', /simulation-credence-and-its-consequences\.pdf#toolbar=0&navpanes=0&scrollbar=0&view=FitH/);
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
});

test('thesis diagrams emerge as two independent objects without panel copy', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#work/project/bachelor-thesis');
  await waitArtifactScenes(page);

  const cluster = page.locator('[data-artifact-scene="bachelor-thesis-diagrams"]');
  const first = cluster.locator('.artifact-deck-card[data-artifact-id="bachelor-thesis-lattice-of-bands"]');
  const second = cluster.locator('.artifact-deck-card[data-artifact-id="bachelor-thesis-rol-non-a"]');
  const viewer = page.locator('.artifact-focus-viewer');

  await expect(cluster).toBeVisible();
  await expect(cluster.locator('.artifact-deck-card')).toHaveCount(2);
  await expect(cluster.locator('.artifact-object-header')).toHaveCount(0);
  await expect(cluster.locator('.artifact-object-description')).toHaveCount(0);
  await expect(cluster.locator('.artifact-deck-footer')).toHaveCount(0);
  await expect(cluster.locator('.artifact-object-tag')).toHaveCount(2);

  const boxes = await Promise.all([first.boundingBox(), second.boundingBox()]);
  expect(boxes[0]).not.toBeNull();
  expect(boxes[1]).not.toBeNull();
  expect(Math.abs(boxes[0].x - boxes[1].x) + Math.abs(boxes[0].y - boxes[1].y)).toBeGreaterThan(80);

  await second.hover();
  await expect(second).toHaveClass(/is-active/);
  await second.click();
  await waitSettled(page);
  await expect(viewer).toHaveAttribute('data-shared-focus-artifact', 'bachelor-thesis-rol-non-a');
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden({ timeout: 2000 });

  await first.hover();
  await first.click();
  await waitSettled(page);
  await expect(viewer).toHaveAttribute('data-shared-focus-artifact', 'bachelor-thesis-lattice-of-bands');
  await page.keyboard.press('Escape');
});

test('Modal Logic Lab screenshots are floating screens with a live-app satellite action', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#work/project/modal-logic-lab');
  await waitArtifactScenes(page);

  const deck = page.locator('[data-artifact-scene="modal-logic-lab-screens"]');
  await expect(deck).toBeVisible();
  await expect(deck.locator('.artifact-object-header')).toHaveCount(0);
  await expect(deck.locator('.artifact-deck-card')).toHaveCount(2);
  await expect(deck.locator('img')).toHaveCount(2);
  await expect(deck.locator('a[data-support-artifact-id="modal-logic-lab-live"]')).toHaveAttribute('href', 'https://chrasts.github.io/Modal_Logic_Educational_Game/');
});

test('Hedgehog House is a loose photo fan with direct-manipulation focus and graph tether', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#about/woodworking/hedgehog-house');
  await waitArtifactScenes(page);

  const gallery = page.locator('[data-artifact-scene="hedgehog-house-gallery"]');
  await expect(gallery).toBeVisible();
  await expect(gallery.locator('.artifact-object-header')).toHaveCount(0);
  await expect(gallery.locator('.artifact-deck-card')).toHaveCount(3);
  await expect(gallery.locator('img')).toHaveCount(3);

  const dock = await gallery.evaluate(element => {
    const scene = element.closest('.scene-canvas').getBoundingClientRect();
    const box = element.getBoundingClientRect();
    return { left: box.left - scene.left, bottom: scene.bottom - box.bottom };
  });
  expect(dock.left).toBeLessThan(50);
  expect(dock.bottom).toBeLessThan(50);

  await gallery.hover();
  await expect(page.locator('#site-graph .site-graph-node[data-node-id="hedgehog-house"].is-artifact-linked')).toHaveCount(1);
  await expect(page.locator('.artifact-tether-layer')).toHaveClass(/is-visible/);

  const outside = gallery.locator('.artifact-deck-card[data-artifact-id="hedgehog-house-outside"]');
  await outside.hover();
  await expect(outside).toHaveClass(/is-active/);
  await outside.click();
  const viewer = page.locator('.artifact-focus-viewer');
  await waitSettled(page);
  await expect(viewer).toBeVisible();
  await expect(viewer).toHaveAttribute('data-media-kind', 'image');
  await expect(viewer).toHaveAttribute('data-shared-focus-artifact', 'hedgehog-house-outside');
  await expect(viewer.locator('.artifact-focus-media img.phase-b-panzoom-media')).toHaveAttribute('src', /assets\/images\/about\/woodworking\/hedgehog-house\/outside\.png$/);
  await expect(viewer.locator('[data-artifact-image-zoom="true"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
});

test('artifact object clusters remain viewport-contained on mobile without a tray window', async ({ page }) => {
  await bypassIntro(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#about/woodworking/hedgehog-house');
  await waitArtifactScenes(page);

  const gallery = page.locator('[data-artifact-scene="hedgehog-house-gallery"]');
  await expect(gallery).toBeVisible();
  await expect(gallery).toHaveAttribute('data-scene-placement', 'artifact-mobile-tray');
  expect(await gallery.evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgba(0, 0, 0, 0)');

  const metrics = await page.evaluate(() => ({
    scrollHeight: document.scrollingElement.scrollHeight,
    viewportHeight: innerHeight,
    scrollY
  }));
  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.viewportHeight + 2);
  expect(metrics.scrollY).toBe(0);
});
