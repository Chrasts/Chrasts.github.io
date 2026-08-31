const { test, expect } = require('@playwright/test');

const bypassIntro = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const nodePositions = page => page.evaluate(() => Object.fromEntries(
  [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
    .filter(element => !element.closest('.v9-transition-overlay'))
    .map(element => [element.dataset.nodeId, [Number(element.dataset.x), Number(element.dataset.y)]])
));

const labelPose = (page, id, overlayTarget = false) => page.evaluate(({ id, overlayTarget }) => {
  const selector = overlayTarget
    ? `.v9-transition-overlay .site-graph-node[data-node-id="${id}"] .v9-target-label`
    : `#site-graph .site-graph-node[data-node-id="${id}"] .site-graph-label`;
  const labels = [...document.querySelectorAll(selector)];
  const label = overlayTarget ? labels[0] : labels.find(element => !element.closest('.v9-transition-overlay'));
  return label ? [label.getAttribute('text-anchor'), label.getAttribute('x'), label.getAttribute('y')] : null;
}, { id, overlayTarget });

const waitForStableGraph = async page => {
  await page.waitForFunction(() => {
    const body = document.body;
    return body?.dataset.graphRoute && !body.classList.contains('is-v9-transitioning');
  });

  let previous = null;
  let stableSamples = 0;
  for (let attempt = 0; attempt < 12 && stableSamples < 2; attempt += 1) {
    await page.waitForTimeout(140);
    const current = await nodePositions(page);
    if (previous && JSON.stringify(current) === JSON.stringify(previous)) stableSamples += 1;
    else stableSamples = 0;
    previous = current;
  }
  expect(stableSamples).toBeGreaterThanOrEqual(2);
};

const activateOverview = async page => {
  await bypassIntro(page);
  await page.goto('/#overview');
  await page.waitForFunction(() => Boolean(window.ProfileRootLanding));
  if (await page.evaluate(() => window.ProfileRootLanding.isActive())) {
    await page.evaluate(() => window.ProfileRootLanding.activate({ focusGraph: false }));
  }
  await page.waitForFunction(() => document.body.dataset.graphMode === 'overview' && document.body.dataset.rootLanding === 'false');
  await waitForStableGraph(page);
};

test('active focus root is idempotent and does not re-layout its segment', async ({ page }) => {
  await page.goto('/#education');
  await waitForStableGraph(page);

  const before = await nodePositions(page);
  await page.locator('#site-graph .site-graph-node[data-node-id="education"]').click();
  await page.waitForTimeout(650);
  const after = await nodePositions(page);

  expect(await page.evaluate(() => location.hash)).toBe('#education');
  expect(await page.evaluate(() => document.body.classList.contains('is-v9-transitioning'))).toBe(false);
  expect(after).toEqual(before);
});

test('Work projects have primary hit targets and concept inspector promotes project choices', async ({ page }) => {
  await page.goto('/#work');
  await waitForStableGraph(page);
  await page.waitForFunction(() => Boolean(window.ProfileRefinements));
  await page.waitForFunction(() => document.querySelector('.work-project-anchor-v5[data-hitbox-enhanced="true"]'));

  const directProject = page.locator('.work-project-anchor-v5[data-hitbox-enhanced="true"]:not(.is-filtered-out)').first();
  const hitbox = directProject.locator('.work-project-hitbox-v5');
  await expect(hitbox).toBeVisible();
  const hitboxSize = await hitbox.evaluate(element => ({
    width: Number(element.getAttribute('width')),
    height: Number(element.getAttribute('height'))
  }));
  expect(hitboxSize.width).toBeGreaterThanOrEqual(104);
  expect(hitboxSize.height).toBeGreaterThanOrEqual(24);

  const initialGeometry = await nodePositions(page);
  await hitbox.click();
  await expect(page.locator('#site-detail-panel')).toHaveClass(/is-work-project-detail-local/);
  expect(await page.evaluate(() => location.hash.startsWith('#work/project/'))).toBe(true);
  expect(await nodePositions(page)).toEqual(initialGeometry);

  await page.locator('#site-detail-panel .detail-close').click();
  await expect(page.locator('#site-detail-panel')).not.toHaveClass(/is-work-project-detail-local/);
  await page.waitForFunction(() => location.hash === '#work');

  const theme = page.locator('.work-theme-label-v5[data-theme-id]').first();
  await expect(theme).toBeVisible();
  await theme.click();
  const panel = page.locator('#site-detail-panel.is-work-concept-detail');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveClass(/has-primary-project-choices/);
  await expect(panel.locator('.detail-list-title')).toHaveText('Open a project');
  const project = panel.locator('.work-concept-project').first();
  await expect(project).toBeVisible();
  await expect(project.locator('.work-concept-project-meta')).not.toBeEmpty();

  const before = await nodePositions(page);
  await project.click();
  await page.waitForTimeout(120);
  const after = await nodePositions(page);

  expect(await page.evaluate(() => location.hash.startsWith('#work/project/'))).toBe(true);
  expect(await page.evaluate(() => document.body.classList.contains('is-v9-transitioning'))).toBe(false);
  expect(after).toEqual(before);
  await expect(page.locator('#site-detail-panel')).toHaveClass(/is-open/);
});

test('focus transitions crossfade persistent label geometry before handoff', async ({ page }) => {
  await page.goto('/#education');
  await waitForStableGraph(page);

  await page.locator('#site-graph .site-graph-node[data-node-id="charles-university"]').click();
  await page.waitForFunction(() => document.body.classList.contains('is-v9-transitioning'));
  await expect(page.locator('.v9-transition-overlay .v9-target-label').first()).toBeAttached();
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));

  expect(await page.evaluate(() => location.hash)).toBe('#education/charles-university');
});

test('Atlas entry control always reflects the current mode', async ({ page }) => {
  await activateOverview(page);
  const button = page.locator('.atlas-button');

  await expect(button).toHaveAttribute('data-route', 'atlas');
  await expect(button).toContainText('Atlas');
  await button.click();
  await page.waitForFunction(() => document.body.dataset.graphMode === 'atlas');
  await page.waitForFunction(() => !document.body.classList.contains('is-atlas-handoff'));

  await expect(button).toHaveAttribute('data-route', 'overview');
  await expect(button).toContainText('Profile');
  await button.click();
  await page.waitForFunction(() => document.body.dataset.graphMode === 'overview');
  await page.waitForFunction(() => !document.body.classList.contains('is-atlas-handoff'));

  await expect(button).toHaveAttribute('data-route', 'atlas');
  await expect(button).toContainText('Atlas');
});

test('expanded graph routes are viewport-contained and cannot document-scroll', async ({ page }) => {
  await activateOverview(page);
  await page.locator('#site-graph .site-graph-node[data-node-id="about"]').click();
  await page.waitForFunction(() => document.body.dataset.graphRoute === 'about');
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  await page.waitForTimeout(120);

  const metrics = await page.evaluate(() => ({
    scrollHeight: document.scrollingElement.scrollHeight,
    viewportHeight: window.innerHeight,
    scrollY: window.scrollY,
    overflow: getComputedStyle(document.body).overflow
  }));
  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.viewportHeight + 2);
  expect(metrics.scrollY).toBe(0);
  expect(metrics.overflow).toBe('hidden');

  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(80);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('transition destination labels exactly match their post-handoff pose', async ({ page }) => {
  await activateOverview(page);

  await page.locator('#site-graph .site-graph-node[data-node-id="about"]').click();
  await page.waitForFunction(() => document.body.classList.contains('is-v9-transitioning'));
  await page.waitForFunction(() => Boolean(document.querySelector('.v9-transition-overlay .site-graph-node[data-node-id="stepan-chrast"] .v9-target-label')));
  const intoAboutTarget = await labelPose(page, 'stepan-chrast', true);
  expect(intoAboutTarget).toEqual(['start', '17', '4']);
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  const intoAboutFinal = await labelPose(page, 'stepan-chrast');
  expect(intoAboutFinal).toEqual(intoAboutTarget);
  await page.waitForTimeout(320);
  expect(await labelPose(page, 'stepan-chrast')).toEqual(intoAboutFinal);

  await page.locator('#site-graph .site-graph-node[data-node-id="stepan-chrast"]').click();
  await page.waitForFunction(() => document.body.classList.contains('is-v9-transitioning'));
  await page.waitForFunction(() => Boolean(document.querySelector('.v9-transition-overlay .site-graph-node[data-node-id="stepan-chrast"] .v9-target-label')));
  const intoOverviewTarget = await labelPose(page, 'stepan-chrast', true);
  expect(intoOverviewTarget).toEqual(['middle', '0', '-27']);
  await page.waitForFunction(() => !document.body.classList.contains('is-v9-transitioning'));
  const intoOverviewFinal = await labelPose(page, 'stepan-chrast');
  expect(intoOverviewFinal).toEqual(intoOverviewTarget);

  const sectionIds = ['work', 'knowledge', 'experience', 'education', 'about'];
  const before = Object.fromEntries(await Promise.all(sectionIds.map(async id => [id, await labelPose(page, id)])));
  await page.waitForTimeout(320);
  const after = Object.fromEntries(await Promise.all(sectionIds.map(async id => [id, await labelPose(page, id)])));
  expect(after).toEqual(before);
});
