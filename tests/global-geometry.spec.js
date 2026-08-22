const { test, expect } = require('@playwright/test');

const prepare = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const point = (page, id) => page.evaluate(nodeId => {
  const element = document.querySelector(`#site-graph .site-graph-node[data-node-id="${nodeId}"]`);
  return element ? { x: Number(element.dataset.x), y: Number(element.dataset.y) } : null;
}, id);

const projection = (from, to, vector) => (to.x - from.x) * vector.x + (to.y - from.y) * vector.y;

test.describe('Radial global geometry — desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Overview is a radial compass with Work exactly below the central root', async ({ page }) => {
    await prepare(page);
    await page.goto('/#overview');
    await page.waitForFunction(() => window.ProfileGlobalGeometry?.snapshot().active === true);
    await page.waitForTimeout(760);

    const points = {};
    for (const id of ['stepan-chrast', 'work', 'knowledge', 'experience', 'education', 'about']) points[id] = await point(page, id);
    expect(points['stepan-chrast']).toBeTruthy();
    expect(Math.abs(points.work.x - points['stepan-chrast'].x)).toBeLessThan(2);
    expect(points.work.y).toBeGreaterThan(points['stepan-chrast'].y + 180);
    expect(points.knowledge.y).toBeLessThan(points['stepan-chrast'].y);
    expect(points.experience.x).toBeGreaterThan(points['stepan-chrast'].x);
    expect(points.education.x).toBeGreaterThan(points['stepan-chrast'].x);
    expect(points.education.y).toBeGreaterThan(points['stepan-chrast'].y);
    expect(points.about.x).toBeLessThan(points['stepan-chrast'].x);
  });

  test('Atlas keeps each subtree growing outward in its own territory vector', async ({ page }) => {
    await prepare(page);
    await page.goto('/#atlas');
    await page.waitForFunction(() => document.body.dataset.graphMode === 'atlas' && window.ProfileGlobalGeometry?.snapshot().active === true);
    await page.waitForTimeout(760);

    const checks = [
      ['work', 'work-theme-logic'],
      ['knowledge', 'logic-math'],
      ['experience', 'ceske-priority'],
      ['education', 'charles-university'],
      ['about', 'research-interests']
    ];
    for (const [sectionId, childId] of checks) {
      const section = await point(page, sectionId);
      const child = await point(page, childId);
      const vector = await page.evaluate(id => window.ProfileGlobalGeometry.vectorForSection(id), sectionId);
      expect(projection(section, child, vector)).toBeGreaterThan(55);
    }

    const root = await point(page, 'stepan-chrast');
    expect(root.x).toBeGreaterThan(1100);
    expect(root.x).toBeLessThan(1400);
    expect(root.y).toBeGreaterThan(650);
    expect(root.y).toBeLessThan(930);
  });

  test('entering a territory normalizes its local graph back to top-to-bottom', async ({ page }) => {
    await prepare(page);
    await page.goto('/#overview');
    await page.waitForFunction(() => window.ProfileGlobalGeometry?.snapshot().active === true);
    await page.locator('#site-graph .site-graph-node[data-node-id="knowledge"]').click();
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge');
    await page.waitForTimeout(1250);

    expect(await page.evaluate(() => document.body.dataset.globalGeometry || null)).toBeNull();
    const active = await point(page, 'knowledge');
    const child = await point(page, 'logic-math');
    expect(child.y).toBeGreaterThan(active.y + 80);
  });

  test('Work global direction and Work lattice use the same downward order', async ({ page }) => {
    await prepare(page);
    await page.goto('/#overview');
    await page.waitForFunction(() => window.ProfileGlobalGeometry?.snapshot().active === true);
    const root = await point(page, 'stepan-chrast');
    const work = await point(page, 'work');
    expect(work.y).toBeGreaterThan(root.y);

    await page.locator('#site-graph .site-graph-node[data-node-id="work"]').click();
    await page.waitForFunction(() => document.body.dataset.graphMode === 'work');
    await page.waitForTimeout(1250);
    const localRoot = await point(page, 'stepan-chrast');
    const localWork = await point(page, 'work');
    const concept = await point(page, 'work-concept:logic');
    expect(localWork.y).toBeGreaterThan(localRoot.y);
    expect(concept.y).toBeGreaterThan(localWork.y);
  });
});

test.describe('Radial global geometry — mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('retains the radial topology before mobile projection', async ({ page }) => {
    await prepare(page);
    await page.goto('/#overview');
    await page.waitForFunction(() => window.ProfileGlobalGeometry?.snapshot().active === true);
    await page.waitForTimeout(800);
    const root = await point(page, 'stepan-chrast');
    const work = await point(page, 'work');
    const knowledge = await point(page, 'knowledge');
    expect(work.y).toBeGreaterThan(root.y);
    expect(knowledge.y).toBeLessThan(root.y);
  });
});
