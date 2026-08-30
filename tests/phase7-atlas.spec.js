const { test, expect } = require('@playwright/test');

const COMPUTATIONAL_ROUTE = 'knowledge/logic-math/mathematical-logic/computational-logic';
const COMPUTATIONAL_NODE = 'computational-logic';
const ANCESTOR_LABEL_POSE = ['end', '-15', '4'];

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const activateOverview = async page => {
  await page.goto('/#overview');
  await page.waitForFunction(() => Boolean(window.ProfileRootLanding && window.ProfileLocalLabelPolicy));
  await page.evaluate(() => window.ProfileRootLanding.activate({ focusGraph: false }));
  await page.waitForFunction(() => document.body.dataset.graphMode === 'overview' && document.body.dataset.rootLanding === 'false');
};

const liveLabelPose = (page, id) => page.evaluate(id => {
  const node = [...document.querySelectorAll(`#site-graph .site-graph-node[data-node-id="${id}"]`)]
    .find(element => !element.closest('.v9-transition-overlay'));
  const label = node?.querySelector('.site-graph-label');
  return label ? [label.getAttribute('text-anchor'), label.getAttribute('x'), label.getAttribute('y')] : null;
}, id);

const rectOverlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

test.describe('Phase 7 label continuity and Overview emphasis', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Overview to About keeps the root label in one stable ancestor pose', async ({ page }) => {
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
    poses.forEach(pose => expect(pose).toEqual(ANCESTOR_LABEL_POSE));
  });

  test('every ancestor in the canonical Computational Logic chain uses the stable side pose', async ({ page }) => {
    await bypassIntro(page);
    await page.goto(`/#${COMPUTATIONAL_ROUTE}`);
    await page.waitForFunction(() => Boolean(window.ProfileLocalLabelPolicy) && document.body.dataset.graphMode === 'focus');
    await page.evaluate(() => window.ProfileLocalLabelPolicy.apply('phase7-contract'));

    const ids = ['stepan-chrast', 'knowledge', 'logic-math', 'mathematical-logic'];
    for (const id of ids) expect(await liveLabelPose(page, id)).toEqual(ANCESTOR_LABEL_POSE);
    await page.waitForTimeout(500);
    for (const id of ids) expect(await liveLabelPose(page, id)).toEqual(ANCESTOR_LABEL_POSE);
  });

  test('the five Overview destinations read as large clickable choices', async ({ page }) => {
    await bypassIntro(page);
    await activateOverview(page);
    const metrics = await page.evaluate(() => {
      const section = document.querySelector('#site-graph .site-graph-node[data-node-id="knowledge"]');
      const work = document.querySelector('#site-graph .site-graph-node[data-node-id="work"]');
      return {
        labelSize: parseFloat(getComputedStyle(section.querySelector('.site-graph-label')).fontSize),
        dotTransform: getComputedStyle(section.querySelector('.site-graph-dot')).transform,
        workLabelTransform: getComputedStyle(work.querySelector('.site-graph-label')).transform
      };
    });
    expect(metrics.labelSize).toBeGreaterThanOrEqual(14);
    expect(metrics.dotTransform).not.toBe('none');
    expect(metrics.workLabelTransform).not.toBe('none');
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

  test('progressively reveals structure and keeps primary connections legible at near zoom', async ({ page }) => {
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
    const primaryCrosslinks = await page.evaluate(() => [...document.querySelectorAll('#site-graph .site-graph-edges path.is-cross-link:not(.is-secondary)')]
      .filter(edge => !edge.classList.contains('is-atlas-lod-hidden')).length);
    expect(primaryCrosslinks).toBeGreaterThan(0);

    await page.evaluate(() => window.ProfileAtlasLOD.setScale(1.5, { immediate: true }));
    await page.waitForFunction(() => document.body.dataset.atlasLod === 'detail');
    const detailedCrosslinks = await page.evaluate(() => [...document.querySelectorAll('#site-graph .site-graph-edges path.is-cross-link')]
      .filter(edge => !edge.classList.contains('is-atlas-lod-hidden')).length);
    expect(detailedCrosslinks).toBeGreaterThanOrEqual(primaryCrosslinks);
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
    expect(snap.scale).toBeGreaterThan(.9);
    expect(snap.scale).toBeLessThanOrEqual(1.16);
    expect(snap.lod).toBe('near');
    expect(snap.topologyBounds.width).toBeGreaterThan(1000);
  });

  test('layer toggles keep the camera fixed and change actual rendered relations', async ({ page }) => {
    await page.evaluate(() => {
      window.ProfileAtlasLOD.setScale(1.55, { immediate: true });
      window.ProfileAtlasLOD.panTo(-700, -350, { immediate: true });
    });
    const before = await page.evaluate(() => window.ProfileAtlasLOD.snapshot().camera);

    const connections = page.locator('#atlas-crosslinks');
    await connections.uncheck();
    await page.waitForTimeout(650);
    expect(await page.locator('#site-graph .site-graph-edges path.is-cross-link').count()).toBe(0);
    let after = await page.evaluate(() => window.ProfileAtlasLOD.snapshot().camera);
    expect(after.scale).toBeCloseTo(before.scale, 2);
    expect(after.x).toBeCloseTo(before.x, 0);
    expect(after.y).toBeCloseTo(before.y, 0);

    await connections.check();
    await page.waitForTimeout(650);
    expect(await page.locator('#site-graph .site-graph-edges path.is-cross-link').count()).toBeGreaterThan(0);
    after = await page.evaluate(() => window.ProfileAtlasLOD.snapshot().camera);
    expect(after.scale).toBeCloseTo(before.scale, 2);

    const additional = page.locator('#atlas-secondary');
    await additional.check();
    await page.waitForTimeout(650);
    expect(await page.locator('#site-graph .site-graph-edges path.is-secondary').count()).toBeGreaterThan(0);
    after = await page.evaluate(() => window.ProfileAtlasLOD.snapshot().camera);
    expect(after.scale).toBeCloseTo(before.scale, 2);
  });

  test('controls use plain-language layer names', async ({ page }) => {
    await expect(page.locator('#atlas-hierarchy').locator('..')).toContainText('Structure');
    await expect(page.locator('#atlas-crosslinks').locator('..')).toContainText('Connections');
    await expect(page.locator('#atlas-secondary').locator('..')).toContainText('Additional links');
    await expect(page.locator('#atlas-show-all')).toHaveText('All links');
  });

  test('Education stays distinctly separated from the Knowledge wing', async ({ page }) => {
    const points = await page.evaluate(() => ({
      root: window.ProfileGeometry.atlasPoint('stepan-chrast'),
      knowledge: window.ProfileGeometry.atlasPoint('knowledge'),
      education: window.ProfileGeometry.atlasPoint('education')
    }));
    expect(points.knowledge.x).toBeGreaterThan(points.root.x + 250);
    expect(points.education.y).toBeLessThan(points.root.y - 200);
    expect(points.education.x).toBeLessThan(points.knowledge.x - 120);
  });

  test('targeted Work theme labels are separated by the collision pass', async ({ page }) => {
    await page.evaluate(() => {
      window.ProfileAtlasLOD.setScale(1.1, { immediate: true });
      window.ProfileAtlasLOD.resolveLabelCollisions();
    });
    const rects = await page.evaluate(() => {
      const rect = id => {
        const label = document.querySelector(`#site-graph .site-graph-node[data-node-id="${id}"] .site-graph-label`).getBoundingClientRect();
        return { left: label.left, right: label.right, top: label.top, bottom: label.bottom };
      };
      return { logic: rect('work-theme-logic'), communication: rect('work-theme-education') };
    });
    expect(rectOverlap(rects.logic, rects.communication)).toBeLessThan(4);
  });
});

test.describe('Phase 7 Atlas selection and inspector', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await bypassIntro(page);
    await page.goto('/#atlas');
    await page.waitForFunction(() => Boolean(window.ProfileAtlasLOD) && document.body.dataset.graphMode === 'atlas');
  });

  test('single click opens compact details; repeated activation enters the selected local graph', async ({ page }) => {
    const node = page.locator(`#site-graph .site-graph-node[data-node-id="${COMPUTATIONAL_NODE}"]`);
    await node.click();
    await expect(page.locator('#site-detail-panel')).toBeVisible();
    await expect(page.locator('#site-detail-panel .atlas-open-local')).toHaveText('Explore this section');
    expect((await page.evaluate(() => window.ProfileAtlasLOD.snapshot())).selectedNodeId).toBe(COMPUTATIONAL_NODE);

    await node.click();
    await page.waitForFunction(() => document.body.classList.contains('is-atlas-focus-transitioning'));
    await page.waitForFunction(route => document.body.dataset.graphMode === 'focus' && document.body.dataset.graphRoute === route, COMPUTATIONAL_ROUTE);
    await page.waitForFunction(() => !window.ProfileAtlasFocus.snapshot().active, null, { timeout: 6000 });
    await expect(page.locator(`#site-graph .site-graph-node[data-node-id="${COMPUTATIONAL_NODE}"]`)).toHaveClass(/is-selected/);
  });

  test('clicking empty map clears both inspector and node focus without resetting camera', async ({ page }) => {
    const node = page.locator(`#site-graph .site-graph-node[data-node-id="${COMPUTATIONAL_NODE}"]`);
    await node.click();
    await page.evaluate(() => window.ProfileAtlasLOD.setScale(1.45, { immediate: true }));
    const before = await page.evaluate(() => window.ProfileAtlasLOD.snapshot().camera);

    await page.evaluate(() => document.querySelector('#site-graph .site-graph-svg').dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 12, clientY: 200 })));
    await page.waitForTimeout(230);
    await expect(page.locator('#site-detail-panel')).toBeHidden();
    const after = await page.evaluate(() => window.ProfileAtlasLOD.snapshot());
    expect(after.selectedNodeId).toBeNull();
    expect(after.camera.scale).toBeCloseTo(before.scale, 2);
  });

  test('hovered and related node labels are enlarged for readability', async ({ page }) => {
    const node = page.locator('#site-graph .site-graph-node[data-node-id="mathematical-logic"]');
    await node.hover();
    await page.waitForTimeout(180);
    const sizes = await page.evaluate(() => ({
      origin: parseFloat(getComputedStyle(document.querySelector('#site-graph .site-graph-node[data-node-id="mathematical-logic"] .site-graph-label')).fontSize),
      child: parseFloat(getComputedStyle(document.querySelector('#site-graph .site-graph-node[data-node-id="modal-logic"] .site-graph-label')).fontSize)
    }));
    expect(sizes.origin).toBeGreaterThanOrEqual(15);
    expect(sizes.child).toBeGreaterThanOrEqual(12);
  });
});

test.describe('Phase 7 Atlas affordance', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('right-side Atlas button is enlarged, graph-based and jargon-free', async ({ page }) => {
    await bypassIntro(page);
    await activateOverview(page);
    const button = page.locator('.atlas-button.atlas-entry-v7');
    await expect(button).toBeVisible();
    await expect(button.locator('.atlas-entry-glyph')).toHaveCount(1);
    await expect(button).toHaveText(/Atlas/);
    await expect(button).not.toContainText('semantic');
    await expect(button).not.toContainText('Full graph');
    const rect = await button.boundingBox();
    expect(rect.width).toBeGreaterThan(175);
    expect(rect.height).toBeGreaterThan(60);
  });
});
