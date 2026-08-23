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

test('artifact architecture boots with reusable folio and deck recipes', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#overview');
  await waitArtifactScenes(page);

  const snapshot = await page.evaluate(() => window.ProfileArtifactScenes.snapshot());
  expect(snapshot.issues).toEqual([]);
  expect(snapshot.recipeNames.sort()).toEqual(['document-folio', 'media-deck']);
  expect(await page.locator('[data-artifact-scene]').count()).toBe(5);
});

test('Simulation Credence opens as a clean PDF stage without browser-style toolbar chrome', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#education/charles-university/coursework/simulation-credence');
  await waitArtifactScenes(page);

  const folio = page.locator('[data-artifact-scene="simulation-credence-paper"]');
  await expect(folio).toBeVisible();
  await expect(folio).toHaveAttribute('data-artifact-side', 'left');
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

test('thesis diagrams keep every specimen directly selectable while the active card stays in its slot', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#work/project/bachelor-thesis');
  await waitArtifactScenes(page);

  const deck = page.locator('[data-artifact-scene="bachelor-thesis-diagrams"]');
  await expect(deck).toBeVisible();
  await expect(deck.locator('.artifact-deck-card')).toHaveCount(2);
  await expect(deck).toHaveAttribute('data-active-artifact-id', 'bachelor-thesis-lattice-of-bands');

  const first = deck.locator('.artifact-deck-card[data-artifact-id="bachelor-thesis-lattice-of-bands"]');
  const second = deck.locator('.artifact-deck-card[data-artifact-id="bachelor-thesis-rol-non-a"]');

  await second.click();
  await expect(second).toHaveClass(/is-active/);
  await expect(deck).toHaveAttribute('data-active-artifact-id', 'bachelor-thesis-rol-non-a');

  await first.click();
  await expect(first).toHaveClass(/is-active/);
  await expect(deck).toHaveAttribute('data-active-artifact-id', 'bachelor-thesis-lattice-of-bands');
});

test('Modal Logic Lab screenshots are a screen deck with a live-app affordance', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#work/project/modal-logic-lab');
  await waitArtifactScenes(page);

  const deck = page.locator('[data-artifact-scene="modal-logic-lab-screens"]');
  await expect(deck).toBeVisible();
  await expect(deck.locator('.artifact-deck-card')).toHaveCount(2);
  await expect(deck.locator('img')).toHaveCount(2);
  await expect(deck.locator('a[data-support-artifact-id="modal-logic-lab-live"]')).toHaveAttribute('href', 'https://chrasts.github.io/Modal_Logic_Educational_Game/');
});

test('Hedgehog House docks low-left, opens original images in direct-manipulation focus and tethers to its graph node', async ({ page }) => {
  await bypassIntro(page);
  await page.goto('/#about/woodworking/hedgehog-house');
  await waitArtifactScenes(page);

  const gallery = page.locator('[data-artifact-scene="hedgehog-house-gallery"]');
  await expect(gallery).toBeVisible();
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

  const active = gallery.locator('.artifact-deck-card.is-active');
  await active.click();
  const viewer = page.locator('.artifact-focus-viewer');
  await page.waitForFunction(() => window.ProfilePhaseBObjectFocus?.snapshot().phase === 'settled');
  await expect(viewer).toBeVisible();
  await expect(viewer).toHaveAttribute('data-media-kind', 'image');
  await expect(viewer.locator('.artifact-focus-media img.phase-b-panzoom-media')).toHaveAttribute('src', /assets\/images\/about\/woodworking\/hedgehog-house\/outside\.png$/);
  await expect(viewer.locator('[data-artifact-image-zoom="true"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
});

test('artifact scenes collapse to a non-scrolling mobile tray', async ({ page }) => {
  await bypassIntro(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#about/woodworking/hedgehog-house');
  await waitArtifactScenes(page);

  const gallery = page.locator('[data-artifact-scene="hedgehog-house-gallery"]');
  await expect(gallery).toBeVisible();
  await expect(gallery).toHaveAttribute('data-scene-placement', 'artifact-mobile-tray');

  const metrics = await page.evaluate(() => ({
    scrollHeight: document.scrollingElement.scrollHeight,
    viewportHeight: innerHeight,
    scrollY
  }));
  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.viewportHeight + 2);
  expect(metrics.scrollY).toBe(0);
});
