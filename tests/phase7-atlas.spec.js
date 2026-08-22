const { test, expect } = require('@playwright/test');

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const activateOverview = async page => {
  await page.goto('/#overview');
  await page.waitForFunction(() => Boolean(window.ProfileRootLanding && window.ProfileAtlasLOD));
  await page.evaluate(() => window.ProfileRootLanding.activate({ focusGraph: false }));
  await page.waitForFunction(() => document.body.dataset.graphMode === 'overview' && document.body.dataset.rootLanding === 'false');
};

const liveLabelPose = (page, id) => page.evaluate(id => {
  const node = [...document.querySelectorAll(`#site-graph .site-graph-node[data-node-id="${id}"]`)]
    .find(element => !element.closest('.v9-transition-overlay'));
  const label = node?.querySelector('.site-graph-label');
  return label ? [label.getAttribute('text-anchor'), label.getAttribute('x'), label.getAttribute('y')] : null;
}, id);

test.describe('Phase 7 label continuity', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Overview to About hands root label to one stable right-side ancestor pose', async ({ page }) => {
    await bypassIntro(page);
    await activateOverview(page);
    await page.locator('#site-graph .site-graph-node[data-node-id="about"]').click();
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'about' && document.body.dataset.graphMode === 'focus');
    await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'), null, { timeout: 5000 });

    const poses = [];
    for (const delay of [0, 32, 90, 220, 480]) {
      if (delay) await page.waitForTimeout(delay);
      poses.push(await liveLabelPose(page, 'stepan-chrast'));
    }
    poses.forEach(pose => expect(pose).toEqual(['start', '17', '4']));
  });

  test('every ancestor in a deep Logic for AI chain uses the same stable side pose', async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#knowledge/logic-math/mathematical-logic/computational-logic/logic-for-ai');
    await page.waitForFunction(() => Boolean(window.ProfileAtlasLOD) && document.body.dataset.graphMode === 'focus');
    await page.evaluate(() => window.ProfileAtlasLOD.applyLocalLabelPolicy());

    const ids = ['stepan-chrast', 'knowledge', 'logic-math', 'mathematical-logic', 'computational-logic'];
    for (const id of ids) expect(await liveLabelPose(page, id)).toEqual(['start', '17', '4']);
    await page.waitForTimeout(500);
    for (const id of ids) expect(await liveLabelPose(page, id)).toEqual(['start', '17', '4']);
  });
});

test.describe('Phase 7 Atlas semantic zoom', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#atlas');
    await page.waitForFunction(() => Boolean(window.ProfileAtlasLOD) && document.body.dataset.graphMode === 'atlas');
    await page.waitForFunction(() => document.querySelectorAll('#site-graph .site-graph-node[data-node-id]').length === window.SITE_DATA.graph.nodes.length);
  });

  test('progressively reveals graph depth and territory labels', async ({ page }) => {
    const total = await page.evaluate(() => window.SITE_DATA.graph.nodes.length);

    await page.evaluate(() => window.ProfileAtlasLOD.setScale(0.50, { immediate: true }));
    await page.waitForFunction(() => document.body.dataset.atlasLod === 'far');
    let snap = await page.evaluate(() => window.ProfileAtlasLOD.snapshot());
    expect(snap.visibleNodeCount).toBe(6);
    expect(snap.hiddenNodeCount).toBe(total - 6);
    expect(snap.territoryLabels).toBe(5);

    await page.evaluate(() => window.ProfileAtlasLOD.setScale(0.76, { immediate: true }));
    await page.waitForFunction(() => document.body.dataset.atlasLod === 'medium');
    snap = await page.evaluate(() => window.ProfileAtlasLOD.snapshot());
    expect(snap.visibleNodeCount).toBeGreaterThan(6);
    expect(snap.visibleNodeCount).toBeLessThan(total);

    await page.evaluate(() => window.ProfileAtlasLOD.setScale(1.0, { immediate: true }));
    await page.waitForFunction(() => document.body.dataset.atlasLod === 'near');
    snap = await page.evaluate(() => window.ProfileAtlasLOD.snapshot());
    expect(snap.visibleNodeCount).toBe(total);
    const idleCrosslinksHidden = await page.evaluate(() => [...document.querySelectorAll('#site-graph .site-graph-edges path.is-cross-link')]
      .every(edge => edge.classList.contains('is-atlas-lod-hidden')));
    expect(idleCrosslinksHidden).toBe(true);

    await page.evaluate(() => window.ProfileAtlasLOD.setScale(1.5, { immediate: true }));
    await page.waitForFunction(() => document.body.dataset.atlasLod === 'detail');
    const detailedCrosslinks = await page.evaluate(() => [...document.querySelectorAll('#site-graph .site-graph-edges path.is-cross-link')]
      .filter(edge => !edge.classList.contains('is-atlas-lod-hidden')).length);
    expect(detailedCrosslinks).toBeGreaterThan(0);
  });

  test('camera clamps extreme pans and Fit enters the semantic overview', async ({ page }) => {
    await page.evaluate(() => window.ProfileAtlasLOD.setScale(1.6, { immediate: true }));
    await page.evaluate(() => window.ProfileAtlasLOD.panTo(100000, -100000, { immediate: true }));
    let snap = await page.evaluate(() => window.ProfileAtlasLOD.snapshot());
    expect(snap.camera.x).toBeGreaterThanOrEqual(snap.bounds.minX - 0.1);
    expect(snap.camera.x).toBeLessThanOrEqual(snap.bounds.maxX + 0.1);
    expect(snap.camera.y).toBeGreaterThanOrEqual(snap.bounds.minY - 0.1);
    expect(snap.camera.y).toBeLessThanOrEqual(snap.bounds.maxY + 0.1);

    await page.evaluate(() => window.ProfileAtlasLOD.fit({ immediate: true }));
    snap = await page.evaluate(() => window.ProfileAtlasLOD.snapshot());
    expect(snap.scale).toBeCloseTo(0.78, 2);
    expect(snap.lod).toBe('medium');
  });

  test('Education stays distinctly above-left of the Knowledge wing', async ({ page }) => {
    const points = await page.evaluate(() => ({
      root: window.ProfileGeometry.atlasPoint('stepan-chrast'),
      knowledge: window.ProfileGeometry.atlasPoint('knowledge'),
      education: window.ProfileGeometry.atlasPoint('education')
    }));
    expect(points.knowledge.x).toBeGreaterThan(points.root.x + 250);
    expect(points.education.y).toBeLessThan(points.root.y - 200);
    expect(points.education.x).toBeLessThan(points.knowledge.x - 120);
  });
});

test.describe('Phase 7 Atlas affordance', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('right-side Atlas button is enlarged and contains the graph glyph', async ({ page }) => {
    await bypassIntro(page);
    await activateOverview(page);
    const button = page.locator('.atlas-button.atlas-entry-v7');
    await expect(button).toBeVisible();
    await expect(button.locator('.atlas-entry-glyph')).toHaveCount(1);
    await expect(button).toContainText('Atlas');
    await expect(button).toContainText('Full semantic map');
    const rect = await button.boundingBox();
    expect(rect.width).toBeGreaterThan(185);
    expect(rect.height).toBeGreaterThan(60);
  });
});
