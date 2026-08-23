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
    window.ProfileObjectFocus &&
    window.ProfileNodeDetailDismiss
  ));
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  await page.waitForTimeout(180);
};

const waitSettled = async page => {
  await page.waitForFunction(() => window.ProfileObjectFocus?.snapshot().phase === 'settled');
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

test('Simulation Credence is a document object and opens in Object Focus', async ({ page }) => {
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
  await waitSettled(page);
  await expect(viewer).toBeVisible();
  await expect(viewer).toHaveAttribute('data-media-stage', 'object-focus');
  await expect(viewer).toHaveAttribute('data-media-kind', 'pdf');
  await expect(viewer.locator('.artifact-focus-title')).toContainText('Simulation Credence and Its Consequences');
  await expect(viewer.locator('.artifact-focus-media iframe')).toHaveAttribute('src', /simulation-credence-and-its-consequences\.pdf#toolbar=0&navpanes=0&scrollbar=0&view=FitH/);
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
});

test('thesis diagrams use their PDF page aspect and show the whole page', async ({ page }) => {
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

  const previews = cluster.locator('.artifact-deck-preview');
  await expect(previews.nth(0)).toHaveAttribute('data-media-aspect-ready', 'true', { timeout: 5000 });
  await expect(previews.nth(1)).toHaveAttribute('data-media-aspect-ready', 'true', { timeout: 5000 });
  await expect(previews.nth(0).locator('iframe')).toHaveAttribute('src', /view=Fit$/);
  await expect(previews.nth(1).locator('iframe')).toHaveAttribute('src', /view=Fit$/);

  const mediaGeometry = await Promise.all([first, second].map(async card => card.evaluate(element => {
    const preview = element.querySelector('.artifact-deck-preview');
    return {
      cardWidth: element.offsetWidth,
      cardHeight: element.offsetHeight,
      previewWidth: preview.offsetWidth,
      previewHeight: preview.offsetHeight,
      ratio: Number(preview.dataset.mediaAspect),
      source: preview.dataset.mediaAspectSource
    };
  })));
  mediaGeometry.forEach(item => {
    expect(item.source).toBe('pdf-page');
    expect(item.ratio).toBeGreaterThan(.28);
    expect(item.ratio).toBeLessThan(5);
    expect(Math.abs(item.cardWidth - item.previewWidth)).toBeLessThanOrEqual(4);
    expect(Math.abs(item.cardHeight - item.previewHeight)).toBeLessThanOrEqual(4);
    expect(Math.abs(item.previewWidth / item.previewHeight - item.ratio)).toBeLessThan(.03);
  });

  const boxes = await Promise.all([first.boundingBox(), second.boundingBox()]);
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(boxes[0]).not.toBeNull();
  expect(boxes[1]).not.toBeNull();
  expect(Math.abs(boxes[0].x - boxes[1].x) + Math.abs(boxes[0].y - boxes[1].y)).toBeGreaterThan(80);
  boxes.forEach(box => {
    expect(box.x).toBeGreaterThanOrEqual(20);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width - 20);
    expect(box.y).toBeGreaterThanOrEqual(70);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - 20);
    expect(box.width).toBeGreaterThan(240);
  });

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

test('Modal Logic Lab screenshots preserve the full intrinsic image instead of cropping', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#work/project/modal-logic-lab');
  await waitArtifactScenes(page);

  const deck = page.locator('[data-artifact-scene="modal-logic-lab-screens"]');
  await expect(deck).toBeVisible();
  await expect(deck.locator('.artifact-object-header')).toHaveCount(0);
  await expect(deck.locator('.artifact-deck-card')).toHaveCount(2);
  await expect(deck.locator('img')).toHaveCount(2);
  await expect(deck.locator('a[data-support-artifact-id="modal-logic-lab-live"]')).toHaveAttribute('href', 'https://chrasts.github.io/Modal_Logic_Educational_Game/');

  const preview = deck.locator('.artifact-deck-preview').first();
  await expect(preview).toHaveAttribute('data-media-aspect-ready', 'true', { timeout: 5000 });
  expect(await preview.locator('img').evaluate(image => getComputedStyle(image).objectFit)).toBe('contain');
  const geometry = await preview.evaluate(element => {
    const card = element.closest('.artifact-deck-card');
    return { cardHeight: card.offsetHeight, previewHeight: element.offsetHeight, ratio: element.offsetWidth / element.offsetHeight, intrinsic: Number(element.dataset.mediaAspect) };
  });
  expect(Math.abs(geometry.cardHeight - geometry.previewHeight)).toBeLessThanOrEqual(4);
  expect(Math.abs(geometry.ratio - geometry.intrinsic)).toBeLessThan(.03);
});

test('Hedgehog House photo fan keeps every rotated photograph inside the viewport', async ({ page }) => {
  await bypassIntro(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/#about/woodworking/hedgehog-house');
  await waitArtifactScenes(page);

  const gallery = page.locator('[data-artifact-scene="hedgehog-house-gallery"]');
  const cards = gallery.locator('.artifact-deck-card');
  await expect(gallery).toBeVisible();
  await expect(cards).toHaveCount(3);
  await expect(gallery.locator('img')).toHaveCount(3);

  const boxes = await cards.evaluateAll(elements => elements.map(element => {
    const box = element.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width };
  }));
  boxes.forEach(box => {
    expect(box.left).toBeGreaterThanOrEqual(20);
    expect(box.right).toBeLessThanOrEqual(1260);
    expect(box.top).toBeGreaterThanOrEqual(60);
    expect(box.bottom).toBeLessThanOrEqual(790);
  });

  const outside = gallery.locator('.artifact-deck-card[data-artifact-id="hedgehog-house-outside"]');
  await expect(outside.locator('.artifact-deck-preview')).toHaveAttribute('data-media-aspect-ready', 'true', { timeout: 5000 });
  expect(await outside.locator('img').evaluate(image => getComputedStyle(image).objectFit)).toBe('contain');

  await gallery.hover();
  await expect(page.locator('#site-graph .site-graph-node[data-node-id="hedgehog-house"].is-artifact-linked')).toHaveCount(1);
  await expect(page.locator('.artifact-tether-layer')).toHaveClass(/is-visible/);

  await outside.hover();
  await expect(outside).toHaveClass(/is-active/);
  await outside.click();
  const viewer = page.locator('.artifact-focus-viewer');
  await waitSettled(page);
  await expect(viewer).toBeVisible();
  await expect(viewer).toHaveAttribute('data-media-kind', 'image');
  await expect(viewer).toHaveAttribute('data-shared-focus-artifact', 'hedgehog-house-outside');
  await expect(viewer.locator('.artifact-focus-media img.object-focus-panzoom-media')).toHaveAttribute('src', /assets\/images\/about\/woodworking\/hedgehog-house\/outside\.png$/);
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
});

test('desktop descriptive inspector ends with its content instead of filling the scene', async ({ page }) => {
  await bypassIntro(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#atlas');
  await page.waitForFunction(() => Boolean(window.ProfileAtlasLOD) && document.body.dataset.graphMode === 'atlas');

  const node = page.locator('#site-graph .site-graph-node[data-node-id="sat-smt"]');
  await node.click();
  const detail = page.locator('#site-detail-panel');
  await expect(detail).toBeVisible();

  const sizing = await detail.evaluate(element => {
    const box = element.getBoundingClientRect();
    return {
      height: box.height,
      scrollHeight: element.scrollHeight,
      viewportHeight: innerHeight,
      bottomGap: innerHeight - box.bottom
    };
  });
  expect(sizing.height).toBeLessThan(sizing.viewportHeight * 0.7);
  expect(sizing.bottomGap).toBeGreaterThan(100);
  expect(Math.abs(sizing.height - sizing.scrollHeight)).toBeLessThanOrEqual(4);
});

test('clicking elsewhere on the node view dismisses the open inspector like its close button', async ({ page }) => {
  await bypassIntro(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#atlas');
  await waitArtifactScenes(page);
  await page.waitForFunction(() => Boolean(window.ProfileAtlasLOD) && document.body.dataset.graphMode === 'atlas');

  const node = page.locator('#site-graph .site-graph-node[data-node-id="sat-smt"]');
  const detail = page.locator('#site-detail-panel');
  await node.click();
  await expect(detail).toBeVisible();
  await expect(detail.locator('.detail-close')).toBeVisible();

  await page.locator('.site-graph-heading').click({ force: true });
  await expect(detail).toBeHidden();
  expect((await page.evaluate(() => window.ProfileNodeDetailDismiss.snapshot())).open).toBe(false);
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
