const { test, expect } = require('@playwright/test');

const COMPUTATIONAL_NODE = 'computational-logic';
const COMPUTATIONAL_ROUTE = 'knowledge/logic-math/mathematical-logic/computational-logic';
const ESSLLI_STUDIED_NODE = 'sat-smt';
const ESSLLI_STUDIED_ROUTE = 'knowledge/logic-math/mathematical-logic/computational-logic/sat-smt';

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

const relationFor = async (page, sourceId, targetId) => page.evaluate(([source, target]) =>
  window.ProfileCrossLinkTravel.relationsFor(source).find(relation => relation.targetId === target) || null,
[sourceId, targetId]);

const navigateCrossLink = async (page, targetId, type = null) => page.evaluate(([target, relationType]) =>
  window.ProfileCrossLinkTravel.navigate(target, relationType), [targetId, type]);

const expectVectorClose = (actual, expected) => {
  expect(actual).not.toBeNull();
  expect(Math.abs(actual.x - expected.x)).toBeLessThan(0.01);
  expect(Math.abs(actual.y - expected.y)).toBeLessThan(0.01);
};

test.describe('Phase 6 cross-link travel - desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Work project -> Knowledge evidence follows the exact canonical Atlas vector', async ({ page }) => {
    await prepare(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/#work/project/sql-schema');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'work/project/sql-schema');
    await page.waitForFunction(() => Boolean(window.ProfileCrossLinkTravel && window.ProfileGeometry));

    const expected = await relationGeometry(page, 'project-sql-schema', 'data-modelling');
    const relation = await relationFor(page, 'project-sql-schema', 'data-modelling');
    expect(relation).not.toBeNull();
    expect(relation.label).toBe('Evidence');
    expect(relation.direction).toBe(expected.direction);
    expectVectorClose(relation.vector, expected.vector);
    await expect(page.locator('.profile-crosslinks')).toBeHidden();

    await navigateCrossLink(page, 'data-modelling', 'evidence');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge/data-computing/data-management/data-modelling');
    const snapshot = await waitTravelComplete(page);

    expect(snapshot.direction).toBe(expected.direction);
    expectVectorClose(snapshot.vector, expected.vector);
    expect(snapshot.relationType).toBe('evidence');
    expect(await page.evaluate(() => document.body.dataset.graphMode)).toBe('focus');
    await expect(page.locator('.profile-crosslink-travel-overlay')).toHaveCount(0);
    await expect(page.locator('#site-graph .site-graph-node[data-node-id="data-modelling"]')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Education -> studied topic follows the exact Education-to-Knowledge Atlas vector', async ({ page }) => {
    await prepare(page);
    await page.goto('/#education/esslli');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'education/esslli');
    await page.waitForFunction(() => Boolean(window.ProfileCrossLinkTravel && window.ProfileGeometry));

    const expected = await relationGeometry(page, 'esslli', ESSLLI_STUDIED_NODE);
    const relation = await relationFor(page, 'esslli', ESSLLI_STUDIED_NODE);
    expect(relation).not.toBeNull();
    expect(relation.label).toBe('Studied topic');
    expect(relation.direction).toBe(expected.direction);
    await expect(page.locator('.profile-crosslinks')).toBeHidden();

    await navigateCrossLink(page, ESSLLI_STUDIED_NODE, 'studied-in');
    await page.waitForFunction(route => document.body.dataset.graphRoute === route, ESSLLI_STUDIED_ROUTE);
    const snapshot = await waitTravelComplete(page);

    expect(snapshot.relationType).toBe('studied-in');
    expect(snapshot.direction).toBe(expected.direction);
    expectVectorClose(snapshot.vector, expected.vector);
    await expect(page.locator(`#site-graph .site-graph-node[data-node-id="${ESSLLI_STUDIED_NODE}"]`)).toBeVisible();
  });

  test('Experience -> Work project follows the exact cross-territory Atlas vector', async ({ page }) => {
    await prepare(page);
    await page.goto('/#experience/ceske-priority');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'experience/ceske-priority');
    await page.waitForFunction(() => Boolean(window.ProfileCrossLinkTravel && window.ProfileGeometry));

    const expected = await relationGeometry(page, 'ceske-priority', 'project-social-workers-survey');
    const relation = await relationFor(page, 'ceske-priority', 'project-social-workers-survey');
    expect(relation).not.toBeNull();
    expect(relation.label).toBe('Related Work');
    expect(relation.direction).toBe(expected.direction);
    await expect(page.locator('.profile-crosslinks')).toBeHidden();

    await navigateCrossLink(page, 'project-social-workers-survey', 'role-project');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'work/project/social-workers-survey');
    const snapshot = await waitTravelComplete(page);

    expect(snapshot.relationType).toBe('role-project');
    expect(snapshot.direction).toBe(expected.direction);
    expectVectorClose(snapshot.vector, expected.vector);
    expect(await page.evaluate(() => document.body.dataset.graphMode)).toBe('work');
    await expect(page.locator('#site-detail-panel')).toBeVisible();
    await expect(page.locator('#site-detail-panel h2')).toContainText('Survey Analysis and Open-Text Coding');
  });

  test('BSc thesis connected control performs visible cross-section edge travel', async ({ page }) => {
    await prepare(page);
    await page.goto('/#education/charles-university');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'education/charles-university');
    await page.waitForFunction(() => Boolean(window.ProfileCrossLinkTravel && window.ProfilePhase8));

    const thesis = page.getByRole('button', { name: 'Open BSc thesis' });
    await expect(thesis).toHaveAttribute('data-crosslink-target', 'project-bachelor-thesis');
    await thesis.click();

    await page.waitForFunction(() => window.ProfileCrossLinkTravel?.snapshot().travelling === true);
    await expect(page.locator('.profile-crosslink-travel-overlay')).toBeVisible();
    await expect(page.locator('.profile-crosslink-trace.is-departure')).toHaveCount(1);
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'work/project/bachelor-thesis');
    const snapshot = await waitTravelComplete(page);

    expect(snapshot.relationType).toBe('thesis-of');
    expect(snapshot.sourceId).toBe('charles-university');
    expect(snapshot.targetId).toBe('project-bachelor-thesis');
    await expect(page.locator('.profile-crosslink-travel-overlay')).toHaveCount(0);
  });

  test('Work connected-node control uses the visible two-stage bridge into Experience', async ({ page }) => {
    await prepare(page);
    await page.goto('/#work/project/social-workers-survey');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'work/project/social-workers-survey');
    await page.waitForFunction(() => Boolean(window.ProfileCrossLinkTravel));

    const connected = page.locator('#site-detail-panel [data-crosslink-target="ceske-priority"]');
    await expect(connected).toBeVisible();
    await connected.click();

    await page.waitForFunction(() => window.ProfileCrossLinkTravel?.snapshot().travelling === true);
    await expect(page.locator('.profile-crosslink-travel-overlay')).toBeVisible();
    await expect(page.locator('.profile-crosslink-trace.is-departure')).toHaveCount(1);
    await page.waitForFunction(() => document.body.dataset.crossLinkTravel === 'arrive');
    await expect(page.locator('.profile-crosslink-trace.is-arrival')).toHaveCount(1);
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'experience/ceske-priority');
    const snapshot = await waitTravelComplete(page);

    expect(snapshot.sourceId).toBe('project-social-workers-survey');
    expect(snapshot.targetId).toBe('ceske-priority');
    expect(snapshot.relationType).toBe('role-project');
  });

  test('local Work project inspector also routes Connected nodes through cross-tree travel', async ({ page }) => {
    await prepare(page);
    await page.goto('/#work');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'work');

    const project = page.locator('.work-project-anchor-v5[data-project-id="social-workers-survey"]');
    await expect(project).toBeVisible();
    await project.click();

    const connected = page.locator('#site-detail-panel.is-work-project-detail-local [data-crosslink-target="ceske-priority"]');
    await expect(connected).toBeVisible();
    await expect(connected).toHaveAttribute('data-crosslink-type', 'role-project');
    await connected.click();

    await page.waitForFunction(() => window.ProfileCrossLinkTravel?.snapshot().travelling === true);
    await expect(page.locator('.profile-crosslink-trace.is-departure')).toHaveCount(1);
    await page.waitForFunction(() => document.body.dataset.crossLinkTravel === 'arrive');
    await expect(page.locator('.profile-crosslink-trace.is-arrival')).toHaveCount(1);
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'experience/ceske-priority');
    const snapshot = await waitTravelComplete(page);
    expect(snapshot.sourceId).toBe('project-social-workers-survey');
    expect(snapshot.targetId).toBe('ceske-priority');
  });

  test('Experience Related Work control uses the same visible bridge back into Work', async ({ page }) => {
    await prepare(page);
    await page.goto('/#experience/ceske-priority');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'experience/ceske-priority');
    await page.waitForFunction(() => Boolean(window.ProfileCrossLinkTravel && window.ProfilePhase8));

    const connected = page.locator('[data-phase8-object="experience-current-role"] [data-crosslink-target="project-social-workers-survey"]');
    await expect(connected).toBeVisible();
    await expect(connected).toHaveAttribute('data-crosslink-type', 'role-project');
    await connected.click();

    await page.waitForFunction(() => window.ProfileCrossLinkTravel?.snapshot().travelling === true);
    await expect(page.locator('.profile-crosslink-travel-overlay')).toBeVisible();
    await expect(page.locator('.profile-crosslink-trace.is-departure')).toHaveCount(1);
    await page.waitForFunction(() => document.body.dataset.crossLinkTravel === 'arrive');
    await expect(page.locator('.profile-crosslink-trace.is-arrival')).toHaveCount(1);
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'work/project/social-workers-survey');
    const snapshot = await waitTravelComplete(page);

    expect(snapshot.sourceId).toBe('ceske-priority');
    expect(snapshot.targetId).toBe('project-social-workers-survey');
    expect(snapshot.relationType).toBe('role-project');
  });

  test('cross-section travel offers both a visible return action and Ctrl/Cmd+Z', async ({ page }) => {
    await prepare(page);
    await page.goto('/#experience/ceske-priority');
    await page.waitForFunction(() => Boolean(window.ProfileCrossLinkTravel));

    await navigateCrossLink(page, 'project-social-workers-survey', 'role-project');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'work/project/social-workers-survey');
    await waitTravelComplete(page);
    const travelled = await page.evaluate(() => window.ProfileCrossLinkTravel.snapshot());
    expect(travelled.canReturn).toBe(true);
    expect(travelled.history).toHaveLength(1);

    const returnControl = page.getByRole('button', { name: /Return to Česk/i });
    await expect(returnControl).toBeVisible();
    await returnControl.click();
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'experience/ceske-priority');
    await waitTravelComplete(page);
    const returned = await page.evaluate(() => window.ProfileCrossLinkTravel.snapshot());
    expect(returned.canReturn).toBe(false);
    expect(returned.history).toHaveLength(0);

    await navigateCrossLink(page, 'project-social-workers-survey', 'role-project');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'work/project/social-workers-survey');
    await waitTravelComplete(page);
    await page.keyboard.press('Control+Z');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'experience/ceske-priority');
    await waitTravelComplete(page);
    expect((await page.evaluate(() => window.ProfileCrossLinkTravel.snapshot())).history).toHaveLength(0);
  });

  test('ordinary route changes retain a local Back path, including Atlas', async ({ page }) => {
    await prepare(page);
    await page.goto('/#education');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'education');

    await page.locator('#main-nav [data-route="work"]').click();
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'work');
    const back = page.getByRole('button', { name: /Return to Education/i });
    await expect(back).toBeVisible();
    await expect(back.locator('xpath=..')).toHaveClass(/site-header/);
    await back.click();
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'education');

    await page.evaluate(() => { location.hash = '#atlas'; });
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'atlas');
    await expect(page.getByRole('button', { name: /Return to Education/i })).toBeVisible();
    await page.keyboard.press('Control+Z');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'education');
  });

  test('local information panels own foreground over graph route controls', async ({ page }) => {
    await prepare(page);

    await page.goto('/#work/project/sql-schema');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'work/project/sql-schema');
    const workZ = await page.evaluate(() => ({
      panel: Number(getComputedStyle(document.querySelector('#site-detail-panel')).zIndex || 0),
      routebar: Number(getComputedStyle(document.querySelector('.graph-routebar')).zIndex || 0)
    }));
    expect(workZ.panel).toBeGreaterThan(workZ.routebar);

    await page.goto('/#knowledge/logic-math/mathematical-logic/modal-logic');
    await page.waitForFunction(() => document.body.dataset.graphRoute.endsWith('/modal-logic'));
    const knowledgeZ = await page.evaluate(() => ({
      panel: Number(getComputedStyle(document.querySelector('#site-detail-panel')).zIndex || 0),
      routebar: Number(getComputedStyle(document.querySelector('.graph-routebar')).zIndex || 0)
    }));
    expect(knowledgeZ.panel).toBeGreaterThan(knowledgeZ.routebar);

    await page.goto('/#education/charles-university');
    await page.waitForFunction(() => Boolean(window.ProfilePhase8));
    const educationZ = await page.evaluate(() => ({
      panel: Number(getComputedStyle(document.querySelector('.phase8-semantic-layer')).zIndex || 0),
      routebar: Number(getComputedStyle(document.querySelector('.graph-routebar')).zIndex || 0)
    }));
    expect(educationZ.panel).toBeGreaterThan(educationZ.routebar);
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
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await prepare(page);
    await page.goto('/#education/esslli');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'education/esslli');
    await page.waitForFunction(() => Boolean(window.ProfileCrossLinkTravel && window.ProfileGeometry));
    const expected = await relationGeometry(page, 'esslli', ESSLLI_STUDIED_NODE);
    const relation = await relationFor(page, 'esslli', ESSLLI_STUDIED_NODE);
    expect(relation).not.toBeNull();
    await expect(page.locator('.profile-crosslinks')).toBeHidden();

    await navigateCrossLink(page, ESSLLI_STUDIED_NODE, 'studied-in');
    await page.waitForFunction(route => document.body.dataset.graphRoute === route, ESSLLI_STUDIED_ROUTE);
    const snapshot = await waitTravelComplete(page);

    expect(snapshot.reducedMotion).toBe(true);
    expect(snapshot.relationType).toBe('studied-in');
    expectVectorClose(snapshot.vector, expected.vector);

    // The short semantic return must retain the same no-motion contract.
    await page.evaluate(() => window.ProfileCrossLinkTravel.returnToOrigin());
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'education/esslli');
    const returned = await waitTravelComplete(page);
    expect(returned.reducedMotion).toBe(true);
    expect(returned.history).toHaveLength(0);
    await expect(page.locator('.profile-crosslink-travel-overlay')).toHaveCount(0);
  });
});

test.describe('Phase 6 cross-link data - mobile portrait', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('keeps vector cross-links available while the legacy rail stays hidden', async ({ page }) => {
    await prepare(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/#education/esslli');
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'education/esslli');
    await page.waitForFunction(() => Boolean(window.ProfileCrossLinkTravel));
    await expect(page.locator('.profile-crosslinks')).toBeHidden();

    const relation = await relationFor(page, 'esslli', ESSLLI_STUDIED_NODE);
    expect(relation).not.toBeNull();
    expect(relation.type).toBe('studied-in');

    await navigateCrossLink(page, ESSLLI_STUDIED_NODE, 'studied-in');
    await page.waitForFunction(route => document.body.dataset.graphRoute === route, ESSLLI_STUDIED_ROUTE);
    await waitTravelComplete(page);

    await expect(page.locator(`#site-graph .site-graph-node[data-node-id="${ESSLLI_STUDIED_NODE}"]`)).toBeVisible();
    expect(errors).toEqual([]);
  });
});
