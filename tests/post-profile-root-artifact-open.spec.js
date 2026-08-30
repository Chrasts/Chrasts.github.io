const { test, expect } = require('@playwright/test');

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const boot = async (page, route) => {
  await bypassIntro(page);
  await page.goto(`/#${route}`);
  await page.waitForFunction(() => Boolean(window.ProfilePostEntry));
  if (route !== 'overview') {
    await page.waitForFunction(() => Boolean(
      window.ProfileObjectFocus &&
      window.ProfileArtifactScenes
    ));
  }
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  await page.waitForTimeout(180);
};

const waitSettled = page => page.waitForFunction(() => window.ProfileObjectFocus?.snapshot().phase === 'settled');

const visibleIntroRootMaterial = page => page.evaluate(() =>
  [...document.querySelectorAll('.root-entry-portrait,.root-entry-action')].filter(element => {
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > .01;
  }).map(element => ({
    className: element.getAttribute('class'),
    overlay: Boolean(element.closest('.v9-transition-overlay'))
  }))
);

test('Profile Root permanently retires Enter profile and portrait while preserving the root node', async ({ page }) => {
  await boot(page, 'overview');
  await page.waitForFunction(() =>
    document.body.dataset.graphMode === 'overview' &&
    document.body.dataset.rootLanding === 'false' &&
    document.body.classList.contains('is-root-entry-retired')
  );

  const root = page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').first();
  await expect(root).toBeVisible();
  expect(await visibleIntroRootMaterial(page)).toEqual([]);
  expect(await page.evaluate(() => window.ProfilePostEntry.snapshot().retired)).toBe(true);

  const knowledge = page.locator('#site-graph .site-graph-node[data-node-id="knowledge"]').first();
  await knowledge.click();

  // Check both during and after the graph transition: cloned SVG roots must not
  // resurrect the portrait or entry CTA.
  await page.waitForTimeout(70);
  expect(await visibleIntroRootMaterial(page)).toEqual([]);
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  expect(await visibleIntroRootMaterial(page)).toEqual([]);
});

test('Modal Logic Lab double-click resolves to one stable Object Focus open', async ({ page }) => {
  await boot(page, 'work/project/modal-logic-lab');
  const card = page.locator('[data-artifact-scene="modal-logic-lab-screens"] .artifact-deck-card.is-active');
  await expect(card).toBeVisible();

  await card.dblclick();
  await waitSettled(page);

  const snapshot = await page.evaluate(() => window.ProfileObjectFocus.snapshot());
  expect(snapshot.activeArtifactId).toBe('modal-logic-lab-screenshot-lab');
  expect(snapshot.pendingArtifactId).toBeNull();
  await expect(page.locator('.artifact-focus-viewer')).toBeVisible();
  await expect(page.locator('.object-focus-flight')).toHaveCount(0);
  expect(snapshot.supportedMediaKinds).toContain('pdf');
});

test('BSc PDF uses an inert ambient preview and a reliable focused reader affordance', async ({ page }) => {
  await boot(page, 'work/project/bachelor-thesis');
  const card = page.locator('[data-artifact-scene="bachelor-thesis-diagrams"] .artifact-deck-card[data-artifact-id="bachelor-thesis-lattice-of-bands"]');
  const preview = card.locator('.artifact-media-preview.is-pdf');
  const expand = card.locator('.artifact-inline-expand');

  await expect(preview).toBeVisible();
  await expect(preview.locator('iframe')).toHaveCount(0);
  await expect(preview.locator('.artifact-pdf-mark')).toHaveText('PDF');
  await expect(expand).toBeVisible();
  await expect(expand).toContainText('Inspect');

  await expand.click();
  await waitSettled(page);

  const snapshot = await page.evaluate(() => window.ProfileObjectFocus.snapshot());
  expect(snapshot.activeArtifactId).toBe('bachelor-thesis-lattice-of-bands');
  expect(snapshot.pendingArtifactId).toBeNull();
  const focused = page.locator('.artifact-focus-viewer .artifact-focus-media iframe');
  await expect(focused).toBeVisible();
  expect(await focused.evaluate(element => getComputedStyle(element).pointerEvents)).not.toBe('none');
});
