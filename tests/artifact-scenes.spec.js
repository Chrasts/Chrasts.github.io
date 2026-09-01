const { test, expect } = require('@playwright/test');

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const waitArtifactScenes = async page => {
  await page.waitForFunction(() => Boolean(window.ProfileArtifactScenes));
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
};

const waitSettled = async page => {
  await page.waitForFunction(() => Boolean(window.ProfileObjectFocus));
  await page.waitForFunction(() => ['idle', 'open'].includes(window.ProfileObjectFocus.snapshot().phase));
};

test('overview keeps the heavy artifact feature and artifact media dormant', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#overview');
  await page.waitForFunction(() => Boolean(window.ProfileScene));
  expect(await page.evaluate(() => ({
    artifacts: Boolean(window.ProfileArtifactScenes),
    bindings: Boolean(window.ARTIFACT_SCENE_BINDINGS),
    artifactScript: Boolean(document.querySelector('script[data-profile-artifact-scene-runtime]')),
    artifactImages: document.querySelectorAll('.artifact-scene-layer img').length,
    artifactFrames: document.querySelectorAll('.artifact-scene-layer iframe').length
  }))).toEqual({
    artifacts: false,
    bindings: false,
    artifactScript: false,
    artifactImages: 0,
    artifactFrames: 0
  });
});

test('artifact route mounts one scene, tears it down and remounts without multiplication', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#work/project/bachelor-thesis');
  await waitArtifactScenes(page);

  const scene = page.locator('[data-artifact-scene="bachelor-thesis-diagrams"]');
  await expect(scene).toBeVisible();
  await expect(page.locator('.artifact-scene-layer')).toHaveCount(1);
  await expect(scene).toHaveCount(1);

  await page.evaluate(() => { location.hash = '#overview'; });
  await page.waitForFunction(() => document.body.dataset.graphRoute === 'overview');
  await expect(scene).toBeHidden();

  await page.evaluate(() => { location.hash = '#work/project/bachelor-thesis'; });
  await page.waitForFunction(() => document.body.dataset.graphRoute === 'work/project/bachelor-thesis');
  await waitArtifactScenes(page);
  await expect(scene).toBeVisible();
  await expect(page.locator('.artifact-scene-layer')).toHaveCount(1);
  await expect(scene).toHaveCount(1);
});

test('Simulation Credence is a document object and opens in Object Focus', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#education/charles-university/coursework/simulation-credence');
  await waitArtifactScenes(page);

  const folio = page.locator('[data-artifact-scene="simulation-credence-document"]');
  await expect(folio).toBeVisible();
  await expect(folio).toHaveAttribute('data-artifact-recipe', 'document-folio');
  await expect(folio.locator('.artifact-folio-page')).toHaveCount(1);
  await expect(folio.locator('.artifact-folio-shadow-page')).toHaveCount(1);
  await expect(folio.locator('.artifact-folio-title')).toContainText('Simulation Credence and Its Consequences');
  await expect(folio.locator('iframe')).toHaveCount(0);
  await expect(folio.locator('.artifact-pdf-fallback')).toHaveCount(1);

  await folio.locator('.artifact-inline-expand').click();
  const viewer = page.locator('.artifact-focus-viewer');
  await waitSettled(page);
  await expect(viewer).toBeVisible();
  await expect(viewer).toHaveAttribute('data-media-stage', 'object-focus');
  await expect(viewer).toHaveAttribute('data-media-kind', 'pdf');
  await expect(viewer.locator('.artifact-focus-title')).toContainText('Simulation Credence and Its Consequences');
  await expect(viewer.locator('.artifact-focus-media iframe')).toHaveAttribute('src', /simulation-credence-and-its-consequences\.pdf#toolbar=1&navpanes=0&scrollbar=0&view=Fit/);
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
  await expect(cluster.locator('iframe')).toHaveCount(0);
  await expect(cluster.locator('.artifact-pdf-fallback')).toHaveCount(2);

  const previews = cluster.locator('.artifact-deck-preview');
  await expect(previews.nth(0)).toHaveAttribute('data-media-aspect-ready', 'true', { timeout: 5000 });
  await expect(previews.nth(1)).toHaveAttribute('data-media-aspect-ready', 'true', { timeout: 5000 });

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
    expect(item.source).toBe('metadata');
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
    // Ambient cards are responsive specimens, not the reading surface. In a
    // constrained Work lane they may compact, but must remain a real, usable
    // hit target; detailed reading belongs to the focused PDF viewer below.
    expect(box.width).toBeGreaterThanOrEqual(96);
  });

  await second.hover();
  await expect(second).toHaveClass(/is-active/);
  await second.locator('.artifact-inline-expand').click();
  await waitSettled(page);
  await expect(viewer).toHaveAttribute('data-shared-focus-artifact', 'bachelor-thesis-rol-non-a');
  await expect(viewer.locator('.artifact-focus-media iframe')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden({ timeout: 2000 });

  await first.hover();
  await first.locator('.artifact-inline-expand').click();
  await waitSettled(page);
  await expect(viewer).toHaveAttribute('data-shared-focus-artifact', 'bachelor-thesis-lattice-of-bands');
  await expect(viewer.locator('.artifact-focus-media iframe')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden({ timeout: 2000 });
});

test('Modal Logic Lab screenshots preserve the full intrinsic image instead of cropping', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#work/project/modal-logic-lab');
  await waitArtifactScenes(page);

  const cluster = page.locator('[data-artifact-scene="modal-logic-lab-screens"]');
  await expect(cluster).toBeVisible();
  const cards = cluster.locator('.artifact-deck-card');
  await expect(cards).toHaveCount(2);
  const previews = cluster.locator('.artifact-deck-preview');
  await expect(previews.nth(0)).toHaveAttribute('data-media-aspect-ready', 'true', { timeout: 5000 });
  await expect(previews.nth(1)).toHaveAttribute('data-media-aspect-ready', 'true', { timeout: 5000 });

  const geometry = await cards.evaluateAll(elements => elements.map(element => {
    const preview = element.querySelector('.artifact-deck-preview');
    const image = preview.querySelector('img');
    return {
      cardWidth: element.offsetWidth,
      cardHeight: element.offsetHeight,
      previewWidth: preview.offsetWidth,
      previewHeight: preview.offsetHeight,
      ratio: Number(preview.dataset.mediaAspect),
      source: preview.dataset.mediaAspectSource,
      fit: getComputedStyle(image).objectFit
    };
  }));
  geometry.forEach(item => {
    expect(item.source).toBe('intrinsic');
    expect(item.ratio).toBeGreaterThan(.5);
    expect(item.ratio).toBeLessThan(3);
    expect(item.fit).toBe('contain');
    expect(Math.abs(item.cardWidth - item.previewWidth)).toBeLessThanOrEqual(4);
    expect(Math.abs(item.cardHeight - item.previewHeight)).toBeLessThanOrEqual(4);
    expect(Math.abs(item.previewWidth / item.previewHeight - item.ratio)).toBeLessThan(.03);
  });
});

test('Hedgehog House photo fan keeps every rotated photograph inside the viewport', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#about/woodworking/hedgehog-house');
  await waitArtifactScenes(page);

  const cluster = page.locator('[data-artifact-scene="hedgehog-house-gallery"]');
  await expect(cluster).toBeVisible();
  const cards = cluster.locator('.artifact-deck-card');
  await expect(cards).toHaveCount(3);
  const boxes = await cards.evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  }));
  boxes.forEach(box => {
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(innerWidth);
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(innerHeight);
  });
});

test('desktop descriptive inspector ends with its content instead of filling the scene', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#knowledge/logic-math/mathematical-logic/algebraic-logic');
  await page.waitForFunction(() => Boolean(window.ProfileScene?.manager));
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));

  const detail = page.locator('#site-detail-panel');
  await expect(detail).toBeVisible();
  const geometry = await detail.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      height: rect.height,
      bottom: style.bottom,
      viewportHeight: innerHeight
    };
  });
  expect(geometry.height).toBeLessThan(geometry.viewportHeight * .8);
  expect(geometry.bottom).toBe('auto');
});

test('clicking elsewhere on the node view dismisses the open inspector like its close button', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#knowledge/logic-math/mathematical-logic/algebraic-logic');
  await page.waitForFunction(() => Boolean(window.ProfileScene?.manager));
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));

  const detail = page.locator('#site-detail-panel');
  await expect(detail).toBeVisible();
  const point = await page.evaluate(() => {
    for (let y = 90; y < innerHeight - 60; y += 40) {
      for (let x = 180; x < innerWidth - 400; x += 40) {
        const target = document.elementFromPoint(x, y);
        if (!target) continue;
        if (target.closest('#site-detail-panel,#site-graph .site-graph-node,[data-route]')) continue;
        return { x, y };
      }
    }
    return { x: 260, y: 130 };
  });
  await page.mouse.click(point.x, point.y);
  await expect(detail).toBeHidden();
});

test('artifact object clusters remain viewport-contained on mobile without a tray window', async ({ page }) => {
  await bypassIntro(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#work/project/modal-logic-lab');
  await waitArtifactScenes(page);

  const cluster = page.locator('[data-artifact-scene="modal-logic-lab-screens"]');
  await expect(cluster).toBeVisible();
  const geometry = await cluster.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      bodyWidth: document.body.scrollWidth,
      viewportWidth: innerWidth,
      hasTrayChrome: Boolean(element.closest('.mobile-control-sheet'))
    };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.bottom).toBeLessThanOrEqual(844);
  expect(geometry.bodyWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.hasTrayChrome).toBe(false);
});
