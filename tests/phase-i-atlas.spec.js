const { test, expect } = require('@playwright/test');

const bootAtlas = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#atlas');
  await page.waitForFunction(() => Boolean(window.ProfileAtlasLOD && window.ProfileAtlasPolish && window.ProfileGeometry));
  await page.waitForFunction(() => document.body.dataset.graphMode === 'atlas' && document.body.dataset.phaseIAtlas === 'true');
  await page.waitForFunction(() => window.ProfileAtlasPolish.snapshot().installed === true);
};

const semanticSnapshot = page => page.evaluate(() => window.ProfileAtlasPolish.snapshot());

test.describe('Phase I Atlas / Focus semantic zoom polish', () => {
  test('semantic label density reveals progressively without replacing Phase 7 structural LOD', async ({ page }) => {
    await bootAtlas(page);
    const total = await page.evaluate(() => window.SITE_DATA.graph.nodes.length);

    await page.evaluate(() => window.ProfileAtlasLOD.setScale(.52, { immediate: true }));
    await page.waitForFunction(() => window.ProfileAtlasPolish.snapshot().semanticLOD === 'territory');
    const far = await semanticSnapshot(page);
    const phase7Far = await page.evaluate(() => window.ProfileAtlasLOD.snapshot());

    await page.evaluate(() => window.ProfileAtlasLOD.setScale(.86, { immediate: true }));
    await page.waitForFunction(() => window.ProfileAtlasPolish.snapshot().semanticLOD === 'domain');
    const domain = await semanticSnapshot(page);

    await page.evaluate(() => window.ProfileAtlasLOD.setScale(1.12, { immediate: true }));
    await page.waitForFunction(() => window.ProfileAtlasPolish.snapshot().semanticLOD === 'node');
    const node = await semanticSnapshot(page);

    await page.evaluate(() => window.ProfileAtlasLOD.setScale(1.55, { immediate: true }));
    await page.waitForFunction(() => window.ProfileAtlasPolish.snapshot().semanticLOD === 'evidence');
    const evidence = await semanticSnapshot(page);
    const phase7Detail = await page.evaluate(() => window.ProfileAtlasLOD.snapshot());

    expect(far.labelSuppressedCount).toBeGreaterThan(domain.labelSuppressedCount);
    expect(domain.labelSuppressedCount).toBeGreaterThanOrEqual(node.labelSuppressedCount);
    expect(node.labelSuppressedCount).toBeGreaterThan(evidence.labelSuppressedCount);
    expect(evidence.labelSuppressedCount).toBe(0);

    expect(phase7Far.visibleNodeCount).toBeLessThan(total);
    expect(phase7Detail.visibleNodeCount).toBe(total);
    expect(await page.evaluate(() => document.body.dataset.globalCompass)).toBe('fan-v3');
  });

  test('project and evidence semantics are encoded as quiet graph marks', async ({ page }) => {
    await bootAtlas(page);
    await page.evaluate(() => window.ProfileAtlasLOD.setScale(1.55, { immediate: true }));
    await page.waitForFunction(() => window.ProfileAtlasPolish.snapshot().semanticLOD === 'evidence');

    const model = await page.evaluate(() => {
      const project = window.SITE_DATA.graph.nodes.find(node => node.type === 'project');
      const evidence = window.SITE_DATA.graph.edges.find(edge => edge.type === 'evidence');
      return { projectId: project?.id || null, evidence };
    });
    expect(model.projectId).not.toBeNull();
    expect(model.evidence).toBeTruthy();

    await expect(page.locator(`#site-graph .site-graph-node[data-node-id="${model.projectId}"] .phase-i-project-mark`)).toHaveCount(1);
    await expect(page.locator(`#site-graph .site-graph-node[data-node-id="${model.evidence.source}"] .phase-i-evidence-mark`)).toHaveCount(1);
    await expect(page.locator(`#site-graph .site-graph-node[data-node-id="${model.evidence.target}"] .phase-i-evidence-mark`)).toHaveCount(1);

    const snapshot = await semanticSnapshot(page);
    expect(snapshot.projectMarkCount).toBeGreaterThan(0);
    expect(snapshot.evidenceMarkCount).toBeGreaterThan(0);
  });

  test('hover exposes typed relation neighbours while softly emphasizing the owning territory', async ({ page }) => {
    await bootAtlas(page);
    await page.evaluate(() => window.ProfileAtlasLOD.setScale(1.55, { immediate: true }));
    await page.waitForFunction(() => window.ProfileAtlasPolish.snapshot().semanticLOD === 'evidence');

    const evidence = await page.evaluate(() => window.SITE_DATA.graph.edges.find(edge => edge.type === 'evidence'));
    expect(evidence).toBeTruthy();
    const source = page.locator(`#site-graph .site-graph-node[data-node-id="${evidence.source}"]`);
    await source.hover({ force: true });
    await page.waitForFunction(id => window.ProfileAtlasPolish.snapshot().activeNodeId === id, evidence.source);

    const snapshot = await semanticSnapshot(page);
    expect(snapshot.relatedIds).toContain(evidence.target);
    expect(snapshot.activeTerritory).toBe(await page.evaluate(id => window.ProfileGeometry.sectionFor(id), evidence.source));
    await expect(page.locator(`#site-graph .site-graph-node[data-node-id="${evidence.target}"]`)).toHaveClass(/is-phase-i-related/);

    const edge = page.locator(`#site-graph .site-graph-edges path[data-source="${evidence.source}"][data-target="${evidence.target}"]`).first();
    await expect(edge).toHaveClass(/is-phase-i-relation-active/);
    expect(snapshot.cameraWithinBounds).toBe(true);
  });

  test('optional neighborhood zoom is reversible and stays inside the Phase 7 camera clamp', async ({ page }) => {
    await bootAtlas(page);
    await page.evaluate(() => window.ProfileAtlasLOD.setScale(1.18, { immediate: true }));
    const targetId = 'logic-math';
    const target = page.locator(`#site-graph .site-graph-node[data-node-id="${targetId}"]`);
    await target.click({ force: true });
    await page.waitForFunction(id => document.querySelector(`#site-graph .site-graph-node[data-node-id="${id}"]`)?.classList.contains('is-previewed'), targetId);
    const toggle = page.locator('#site-detail-panel .phase-i-neighborhood-toggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveText('Focus neighborhood');

    await toggle.click();
    await page.waitForFunction(id => window.ProfileAtlasPolish.snapshot().localNodeId === id, targetId);
    const local = await semanticSnapshot(page);
    const total = await page.evaluate(() => window.SITE_DATA.graph.nodes.length);
    expect(local.localScope).toBe(true);
    expect(local.localVisibleNodeCount).toBeLessThan(total);
    expect(local.cameraWithinBounds).toBe(true);
    await expect(target).not.toHaveClass(/is-phase-i-local-hidden/);
    await expect(page.locator('#site-graph .site-graph-node.is-phase-i-local-hidden').first()).toHaveCount(1);
    await expect(toggle).toHaveText('Show full Atlas');

    await toggle.click();
    await page.waitForFunction(() => window.ProfileAtlasPolish.snapshot().localScope === false);
    expect((await semanticSnapshot(page)).cameraWithinBounds).toBe(true);
    await expect(page.locator('#site-graph .site-graph-node.is-phase-i-local-hidden')).toHaveCount(0);
  });

  test('typed semantic preview also works in Focus without creating a second renderer', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
    await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/#knowledge');
    await page.waitForFunction(() => Boolean(window.ProfileAtlasPolish && window.ProfileGeometry));
    await page.waitForFunction(() => document.body.dataset.graphMode === 'focus');

    const node = page.locator('#site-graph .site-graph-node[data-node-id="logic-math"]');
    await node.hover();
    await page.waitForFunction(() => window.ProfileAtlasPolish.snapshot().activeNodeId === 'logic-math');
    await expect(node).toHaveClass(/is-phase-i-semantic-origin/);
    expect(await page.evaluate(() => document.body.dataset.globalCompass)).toBe('fan-v3');
    expect(await page.evaluate(() => Boolean(document.querySelector('#site-graph .site-graph-svg')))).toBe(true);
  });
});
