const { test, expect } = require('@playwright/test');

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const waitForGraph = async page => {
  await page.waitForFunction(() => Boolean(window.ProfileScene?.manager));
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
};

test('Work artifact scenes survive navigation into all artifact-bearing projects', async ({ page }) => {
  await bypassIntro(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#work');
  await waitForGraph(page);

  const cases = [
    ['work/project/bachelor-thesis', 'bachelor-thesis-diagrams'],
    ['work/project/modal-logic-lab', 'modal-logic-lab-screens'],
    ['work/project/axiom-wilds', 'axiom-wilds-gameplay']
  ];

  for (const [route, binding] of cases) {
    await page.evaluate(next => { location.hash = `#${next}`; }, route);
    await page.waitForFunction(expected => document.body.dataset.graphRoute === expected, route);
    await page.waitForFunction(() => Boolean(window.ProfileArtifactScenes && window.ProfileArtifactSceneLayout));
    await page.waitForFunction(expected => window.ProfileScene.manager.snapshot().graphState.route === expected, route);
    await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));

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

test('Hedgehog photo fan remains inside its left scene lane when inspector flips it', async ({ page }) => {
  await bypassIntro(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#about/woodworking/hedgehog-house');
  await page.waitForFunction(() => Boolean(window.ProfileArtifactScenes));
  await waitForGraph(page);

  const gallery = page.locator('[data-artifact-scene="hedgehog-house-gallery"]');
  await expect(gallery).toBeVisible();
  const side = await gallery.getAttribute('data-artifact-side');
  if (side === 'left') {
    const minLeft = await gallery.locator('.artifact-deck-card').evaluateAll(cards =>
      Math.min(...cards.map(card => card.getBoundingClientRect().left))
    );
    expect(minLeft).toBeGreaterThan(200);
  }
});
