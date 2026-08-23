const { test, expect } = require('@playwright/test');

const waitForStableGraph = async page => {
  await page.waitForFunction(() => {
    const body = document.body;
    return body?.dataset.graphRoute && !body.classList.contains('is-v9-transitioning');
  });
  await page.waitForTimeout(80);
};

const nodePositions = page => page.evaluate(() => Object.fromEntries(
  [...document.querySelectorAll('#site-graph .site-graph-node[data-node-id]')]
    .filter(element => !element.closest('.v9-transition-overlay'))
    .map(element => [element.dataset.nodeId, [Number(element.dataset.x), Number(element.dataset.y)]])
));

test('active focus root is idempotent and does not re-layout its segment', async ({ page }) => {
  await page.goto('/#education');
  await waitForStableGraph(page);

  const before = await nodePositions(page);
  await page.locator('#site-graph .site-graph-node[data-node-id="education"]').click();
  await page.waitForTimeout(650);
  const after = await nodePositions(page);

  expect(await page.evaluate(() => location.hash)).toBe('#education');
  expect(after).toEqual(before);
});

test('selecting a Work project from a concept inspector keeps lattice geometry fixed', async ({ page }) => {
  await page.goto('/#work');
  await waitForStableGraph(page);

  const theme = page.locator('.work-theme-label-v5[data-theme-id]').first();
  await expect(theme).toBeVisible();
  await theme.click();
  const project = page.locator('.work-concept-project').first();
  await expect(project).toBeVisible();

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
