const { test, expect } = require('@playwright/test');

const prepare = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const waitTravelComplete = async page => {
  await page.waitForFunction(() => window.ProfileCrossLinkTravel?.snapshot().result === 'completed', null, { timeout: 8_000 });
  return page.evaluate(() => window.ProfileCrossLinkTravel.snapshot());
};

const relationGeometry = async (page, sourceId, targetId) => page.evaluate(([source, target]) => {
  const vector = window.ProfileGeometry.vectorBetween(source, target);
  const direction = window.ProfileGeometry.directionBetween(source, target);
  return { vector, direction };
}, [sourceId, targetId]);

const expectVectorClose = (actual, expected) => {
  expect(actual).not.toBeNull();
  expect(Math.abs(actual.x - expected.x)).toBeLessThan(0.01);
  expect(Math.abs(actual.y - expected.y)).toBeLessThan(0.01);
};

test.describe('Phase 6 cross-link travel — desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Work project -> Knowledge evidence follows the exact canonical Atlas vector', async ({ page }) => {
    await prepare(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/#work/project/sql-schema');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'work/project/sql-schema');
    await page.waitForFunction(() => Boolean(window.ProfileCrossLinkTravel && window.ProfileGeometry));

    const expected = await relationGeometry(page, 'project-sql-schema', 'sql');
    const link = page.locator('.profile-crosslink[data-source-id="project-sql-schema"][data-target-id="sql"]');
    await expect(link).toBeVisible();
    await expect(link.locator('.profile-crosslink-relation')).toHaveText('Evidence');
    expect(await link.getAttribute('data-direction')).toBe(expected.direction);
    expectVectorClose({
      x: Number(await link.getAttribute('data-vector-x')),
      y: Number(await link.getAttribute('data-vector-y'))
    }, expected.vector);

    await link.click();
    await page.waitForSelector('.profile-crosslink-travel-overlay.is-vector-travel');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge/data-computing/data-management/sql');
    const snapshot = await waitTravelComplete(page);

    expect(snapshot.direction).toBe(expected.direction);
    expectVectorClose(snapshot.vector, expected.vector);
    expect(snapshot.relationType).toBe('evidence');
    expect(await page.evaluate(() => document.body.dataset.graphMode)).toBe('focus');
    await expect(page.locator('.profile-crosslink-travel-overlay')).toHaveCount(0);
    await expect(page.locator('#site-graph .site-graph-node[data-node-id="sql"]')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Education -> studied topic follows the exact Education-to-Knowledge Atlas vector', async ({ page }) => {
    await prepare(page);
    await page.goto('/#education/esslli');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'education/esslli');
    await page.waitForFunction(() => Boolean(window.ProfileCrossLinkTravel && window.ProfileGeometry));

    const expected = await relationGeometry(page, 'esslli', 'sat-smt');
    const link = page.locator('.profile-crosslink[data-target-id="sat-smt"]');
    await expect(link).toBeVisible();
    await expect(link.locator('.profile-crosslink-relation')).toHaveText('Studied topic');
    expect(await link.getAttribute('data-direction')).toBe(expected.direction);

    await link.click();
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge/logic-math/mathematical-logic/computational-logic/sat-smt');
    const snapshot = await waitTravelComplete(page);

    expect(snapshot.relationType).toBe('studied-in');
    expect(snapshot.direction).toBe(expected.direction);
    expectVectorClose(snapshot.vector, expected.vector);
    await expect(page.locator('#site-graph .site-graph-node[data-node-id="sat-smt"]')).toBeVisible();
  });

  test('Experience -> Work project follows the exact cross-territory Atlas vector', async ({ page }) => {
    await prepare(page);
    await page.goto('/#experience/ceske-priority');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'experience/ceske-priority');
    await page.waitForFunction(() => Boolean(window.ProfileCrossLinkTravel && window.ProfileGeometry));

    const expected = await relationGeometry(page, 'ceske-priority', 'project-social-workers-survey');
    const link = page.locator('.profile-crosslink[data-target-id="project-social-workers-survey"]');
    await expect(link).toBeVisible();
    await expect(link.locator('.profile-crosslink-relation')).toHaveText('Project');
    expect(await link.getAttribute('data-direction')).toBe(expected.direction);

    await link.click();
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'work/project/social-workers-survey');
    const snapshot = await waitTravelComplete(page);

    expect(snapshot.relationType).toBe('experience-link');
    expect(snapshot.direction).toBe(expected.direction);
    expectVectorClose(snapshot.vector, expected.vector);
    expect(await page.evaluate(() => document.body.dataset.graphMode)).toBe('work');
    await expect(page.locator('#site-detail-panel')).toBeVisible();
    await expect(page.locator('#site-detail-panel h2')).toContainText('Social Workers Survey Analysis');
  });

  test('ordinary parent/child navigation remains structural rather than cross-link travel', async ({ page }) => {
    await prepare(page);
    await page.goto('/#knowledge');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge');

    await page.locator('#site-graph .site-graph-node[data-node-id="logic-math"]').click();
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge/logic-math');

    await expect(page.locator('.profile-crosslink-travel-overlay')).toHaveCount(0);
    expect(await page.evaluate(() => window.ProfileCrossLinkTravel?.snapshot().result)).toBeNull();
  });
});

test.describe('Phase 6 reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

  test('keeps relation semantics and the same canonical vector with a short handoff', async ({ page }) => {
    await prepare(page);
    await page.goto('/#education/esslli');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'education/esslli');
    await page.waitForFunction(() => Boolean(window.ProfileCrossLinkTravel && window.ProfileGeometry));
    const expected = await relationGeometry(page, 'esslli', 'sat-smt');

    const link = page.locator('.profile-crosslink[data-target-id="sat-smt"]');
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge/logic-math/mathematical-logic/computational-logic/sat-smt');
    const snapshot = await waitTravelComplete(page);

    expect(snapshot.reducedMotion).toBe(true);
    expect(snapshot.relationType).toBe('studied-in');
    expectVectorClose(snapshot.vector, expected.vector);
  });
});

test.describe('Phase 6 cross-link rail — mobile portrait', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('keeps vector cross-links usable in the mobile local scene', async ({ page }) => {
    await prepare(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/#education/esslli');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'education/esslli');
    const rail = page.locator('.profile-crosslinks');
    await expect(rail).toBeVisible();

    const link = rail.locator('.profile-crosslink[data-target-id="logic-for-ai"]');
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge/logic-math/mathematical-logic/computational-logic/logic-for-ai');
    await waitTravelComplete(page);

    await expect(page.locator('#site-graph .site-graph-node[data-node-id="logic-for-ai"]')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
