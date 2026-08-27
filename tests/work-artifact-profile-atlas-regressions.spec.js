const { test, expect } = require('@playwright/test');

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const waitForGraph = async page => {
  await page.waitForFunction(() => Boolean(window.ProfileScene?.manager));
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
};

const navigateToArtifactTarget = async (page, route, binding) => {
  await page.evaluate(next => { location.hash = `#${next}`; }, route);
  await page.waitForFunction(expected => document.body.dataset.graphRoute === expected, route);
  await page.waitForFunction(() => Boolean(window.ProfileArtifactScenes && window.ProfileArtifactSceneLayout));
  await page.waitForFunction(expected => window.ProfileScene.manager.snapshot().graphState.route === expected, route);
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  await page.waitForFunction(id => {
    const element = document.querySelector(`[data-artifact-scene="${CSS.escape(id)}"]`);
    return Boolean(element && !element.hidden && element.dataset.sceneVisible === 'true' && element.dataset.sceneComposed === 'true');
  }, binding);
};

const artifactGeometry = async (page, binding) => page.evaluate(id => {
  const root = document.querySelector(`[data-artifact-scene="${CSS.escape(id)}"]`);
  const canvas = document.querySelector('.scene-canvas');
  if (!root || !canvas) return null;

  const visible = element => {
    if (!element?.getClientRects().length) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > .03;
  };
  const rectValue = rect => ({
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height
  });
  const union = rects => rects.reduce((result, rect) => ({
    left: Math.min(result.left, rect.left),
    top: Math.min(result.top, rect.top),
    right: Math.max(result.right, rect.right),
    bottom: Math.max(result.bottom, rect.bottom)
  }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
  const intersects = (a, b, gap = 0) =>
    a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;

  const visualElements = [
    root,
    ...root.querySelectorAll('.artifact-deck-card,.artifact-folio-page,.artifact-orbit-actions,[data-artifact-focus]')
  ].filter(visible);
  const visualRects = visualElements.map(element => element.getBoundingClientRect()).filter(rect => rect.width > .5 && rect.height > .5);
  const footprint = union(visualRects);
  const canvasRect = rectValue(canvas.getBoundingClientRect());

  const graphElements = [...document.querySelectorAll([
    '#site-graph .site-graph-node:not(.is-atlas-lod-hidden)',
    '#site-graph .work-project-anchor-v5:not(.is-filtered-out)',
    '#site-graph .work-theme-label-v5'
  ].join(','))].filter(element => !element.closest('.v9-transition-overlay') && visible(element));
  const graphCollisions = graphElements
    .map(element => ({
      id: element.dataset.nodeId || element.dataset.projectId || element.textContent?.trim() || element.tagName,
      rect: rectValue(element.getBoundingClientRect())
    }))
    .filter(item => item.rect.width > .5 && item.rect.height > .5 && intersects(footprint, item.rect, 8));

  const hardObstacles = [
    document.querySelector('#site-detail-panel:not([hidden])'),
    document.querySelector('.integrated-work-rail.is-left'),
    document.querySelector('.integrated-work-rail.is-right')
  ].filter(element => element && visible(element));
  const obstacleCollisions = hardObstacles
    .map(element => ({ className: element.className, rect: rectValue(element.getBoundingClientRect()) }))
    .filter(item => item.rect.width > .5 && item.rect.height > .5 && intersects(footprint, item.rect, 6));

  return {
    footprint,
    canvas: canvasRect,
    side: root.dataset.artifactSide || null,
    availableWidth: root.style.getPropertyValue('--scene-side-available-width') || null,
    graphCollisions,
    obstacleCollisions
  };
}, binding);

test('Work artifact scenes survive navigation into every artifact-bearing project', async ({ page }) => {
  await bypassIntro(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#work');
  await waitForGraph(page);
  await page.waitForFunction(() => Array.isArray(window.ARTIFACT_SCENE_BINDINGS));

  const cases = await page.evaluate(() => window.ARTIFACT_SCENE_BINDINGS.flatMap(binding =>
    (binding.targets || [])
      .filter(target => String(target.route || '').startsWith('work/project/'))
      .map(target => [target.route, binding.id])
  ));
  expect(cases.length).toBeGreaterThan(0);

  for (const [route, binding] of cases) {
    await navigateToArtifactTarget(page, route, binding);

    const scene = page.locator(`[data-artifact-scene="${binding}"]`);
    await expect(scene).toBeVisible();
    await expect(scene).toHaveAttribute('data-scene-visible', 'true');

    const geometry = await scene.evaluate(element => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        hidden: element.hidden,
        display: style.display,
        visibility: style.visibility,
        opacity: Number(style.opacity),
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom
      };
    });
    expect(geometry.hidden).toBe(false);
    expect(geometry.display).not.toBe('none');
    expect(geometry.visibility).toBe('visible');
    expect(geometry.opacity).toBeGreaterThan(.5);
    expect(geometry.right).toBeGreaterThan(0);
    expect(geometry.left).toBeLessThan(1440);
    expect(geometry.bottom).toBeGreaterThan(0);
    expect(geometry.top).toBeLessThan(900);

    await page.evaluate(() => { location.hash = '#work'; });
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'work');
    await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  }
});

test('every desktop artifact target stays inside the canvas and outside graph/hard safe zones', async ({ page }) => {
  await bypassIntro(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#overview');
  await waitForGraph(page);
  await page.waitForFunction(() => Array.isArray(window.ARTIFACT_SCENE_BINDINGS));

  const cases = await page.evaluate(() => window.ARTIFACT_SCENE_BINDINGS.flatMap(binding =>
    (binding.targets || []).map(target => [target.route, binding.id])
  ));

  for (const [route, binding] of cases) {
    await navigateToArtifactTarget(page, route, binding);
    const geometry = await artifactGeometry(page, binding);
    expect(geometry, `${binding} on ${route} should expose geometry`).not.toBeNull();
    expect(geometry.availableWidth, `${binding} should receive a composed side-lane width`).not.toBe('');
    expect(geometry.footprint.left, `${binding} left bound on ${route}`).toBeGreaterThanOrEqual(geometry.canvas.left + 20);
    expect(geometry.footprint.right, `${binding} right bound on ${route}`).toBeLessThanOrEqual(geometry.canvas.right - 20);
    expect(geometry.footprint.top, `${binding} top bound on ${route}`).toBeGreaterThanOrEqual(geometry.canvas.top + 20);
    expect(geometry.footprint.bottom, `${binding} bottom bound on ${route}`).toBeLessThanOrEqual(geometry.canvas.bottom - 20);
    expect(geometry.graphCollisions, `${binding} overlaps graph content on ${route}`).toEqual([]);
    expect(geometry.obstacleCollisions, `${binding} overlaps inspector/Work controls on ${route}`).toEqual([]);
  }
});

test('Profile Root identity stays in one left column outside the central graph field', async ({ page }) => {
  await bypassIntro(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#overview');
  await page.waitForFunction(() => document.body.classList.contains('is-profile-root-ready'));
  await page.waitForFunction(() => document.body.dataset.rootLanding === 'false');

  const layout = await page.evaluate(() => {
    const brief = document.querySelector('.profile-root-brief');
    const identity = document.querySelector('.profile-root-identity-copy');
    const summary = document.querySelector('.profile-root-summary');
    const actions = document.querySelector('.profile-root-actions');
    const rect = element => element.getBoundingClientRect();
    return {
      brief: rect(brief),
      identity: rect(identity),
      summary: rect(summary),
      actions: rect(actions)
    };
  });

  expect(layout.brief.width).toBeLessThanOrEqual(340);
  expect(Math.abs(layout.identity.left - layout.summary.left)).toBeLessThanOrEqual(4);
  expect(Math.abs(layout.identity.left - layout.actions.left)).toBeLessThanOrEqual(4);
  expect(layout.brief.right).toBeLessThan(430);
});

test('Atlas relation preview colors only relations while related nodes keep their colors', async ({ page }) => {
  await bypassIntro(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#atlas');
  await page.waitForFunction(() => Boolean(window.ProfileAtlasLOD) && document.body.dataset.graphMode === 'atlas');
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));

  const childId = await page.evaluate(() =>
    window.SITE_DATA.graph.nodes.find(node => node.parentIds?.includes('knowledge'))?.id || null
  );
  expect(childId).not.toBeNull();

  const child = page.locator(`#site-graph .site-graph-node[data-node-id="${childId}"]`).first();
  const parent = page.locator('#site-graph .site-graph-node[data-node-id="knowledge"]').first();
  const before = await child.evaluate(element => ({
    dot: getComputedStyle(element.querySelector('.site-graph-dot')).stroke,
    label: getComputedStyle(element.querySelector('.site-graph-label')).fill
  }));

  await parent.hover();
  await expect(child).toHaveClass(/is-downstream|is-lateral/);

  const after = await child.evaluate(element => ({
    dot: getComputedStyle(element.querySelector('.site-graph-dot')).stroke,
    label: getComputedStyle(element.querySelector('.site-graph-label')).fill,
    transform: getComputedStyle(element.querySelector('.site-graph-dot')).transform
  }));
  expect(after.dot).toBe(before.dot);
  expect(after.label).toBe(before.label);
  expect(after.transform).not.toBe('none');

  const relation = page.locator('#site-graph .site-graph-edges path.is-downstream, #site-graph .site-graph-edges path.is-lateral').first();
  await expect(relation).toHaveCount(1);
  const colors = await page.evaluate(() => {
    const relation = document.querySelector('#site-graph .site-graph-edges path.is-downstream, #site-graph .site-graph-edges path.is-lateral');
    const origin = document.querySelector('#site-graph .site-graph-node.is-atlas-origin .site-graph-dot');
    return {
      relation: relation ? getComputedStyle(relation).stroke : null,
      tealReference: origin ? getComputedStyle(origin).stroke : null
    };
  });
  expect(colors.relation).toBe(colors.tealReference);
});

test('Hedgehog photo fan uses the shared safe lane instead of a route-specific offset', async ({ page }) => {
  await bypassIntro(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#about/woodworking/hedgehog-house');
  await page.waitForFunction(() => Boolean(window.ProfileArtifactScenes));
  await waitForGraph(page);

  const gallery = page.locator('[data-artifact-scene="hedgehog-house-gallery"]');
  await expect(gallery).toBeVisible();
  await page.waitForFunction(() => document.querySelector('[data-artifact-scene="hedgehog-house-gallery"]')?.dataset.sceneComposed === 'true');

  const geometry = await artifactGeometry(page, 'hedgehog-house-gallery');
  expect(geometry.side).toBe('left');
  expect(geometry.footprint.left).toBeGreaterThanOrEqual(geometry.canvas.left + 48);
  expect(geometry.graphCollisions).toEqual([]);
  expect(geometry.obstacleCollisions).toEqual([]);
});
