const { test, expect } = require('@playwright/test');

const prepare = async page => {
  await page.addInitScript(() => sessionStorage.setItem('profileIntroSeen', 'true'));
  await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
};

const point = async (page, id) => page.locator(`#site-graph .site-graph-node[data-node-id="${id}"]`).evaluate(element => ({
  x: Number(element.dataset.x),
  y: Number(element.dataset.y)
}));

const dotFrom = (root, target, vector) =>
  (target.x - root.x) * vector.x + (target.y - root.y) * vector.y;

test.describe('Global radial geometry', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Overview keeps Štěpán in the centre and the five first-level sections on a stable compass', async ({ page }) => {
    await prepare(page);
    await page.goto('/#overview');
    await page.waitForFunction(() => Boolean(window.ProfileGeometry && window.ProfileRootLanding));
    await page.evaluate(() => window.ProfileRootLanding.activate({ focusGraph: false }));
    await page.waitForFunction(() => document.body.dataset.globalGeometry === 'radial-overview');

    const root = await point(page, 'stepan-chrast');
    const work = await point(page, 'work');
    const knowledge = await point(page, 'knowledge');
    const experience = await point(page, 'experience');
    const education = await point(page, 'education');
    const about = await point(page, 'about');

    expect(work.x).toBeLessThan(root.x - 170);
    expect(Math.abs(work.y - root.y)).toBeLessThan(55);
    expect(knowledge.y).toBeLessThan(root.y - 170);
    expect(Math.abs(knowledge.x - root.x)).toBeLessThan(55);
    expect(experience.x).toBeGreaterThan(root.x + 170);
    expect(education.x).toBeGreaterThan(root.x + 90);
    expect(education.y).toBeGreaterThan(root.y + 110);
    expect(about.x).toBeLessThan(root.x - 90);
    expect(about.y).toBeGreaterThan(root.y + 110);
  });

  test('Atlas is five outward-oriented trees rather than one downward hierarchy', async ({ page }) => {
    await prepare(page);
    await page.goto('/#atlas');
    await page.waitForFunction(() => document.body.dataset.globalGeometry === 'radial-atlas');
    await page.waitForFunction(() => document.querySelectorAll('#site-graph .site-graph-node[data-node-id]').length === window.SITE_DATA.graph.nodes.length);

    const snapshot = await page.evaluate(() => window.ProfileGeometry.snapshot());
    const root = await point(page, 'stepan-chrast');
    const samples = [
      ['work', 'project-sql-schema'],
      ['knowledge', 'logic-math'],
      ['experience', 'ceske-priority'],
      ['education', 'charles-university'],
      ['about', 'research-interests']
    ];

    for (const [sectionId, childId] of samples) {
      const section = await point(page, sectionId);
      const child = await point(page, childId);
      const vector = snapshot.sections[sectionId].vector;
      expect(dotFrom(root, child, vector)).toBeGreaterThan(dotFrom(root, section, vector) + 55);
    }

    expect(await page.locator('#site-graph .site-graph-node[data-node-id="work"]').getAttribute('data-global-sector')).toBe('work');
    expect(await page.locator('#site-graph .site-graph-node[data-node-id="knowledge"]').getAttribute('data-global-sector')).toBe('knowledge');
  });

  test('entering a territory normalises its local graph back to top-to-bottom navigation', async ({ page }) => {
    await prepare(page);
    await page.goto('/#overview');
    await page.waitForFunction(() => Boolean(window.ProfileGeometry && window.ProfileRootLanding));
    await page.evaluate(() => window.ProfileRootLanding.activate({ focusGraph: false }));
    await page.waitForFunction(() => document.body.dataset.globalGeometry === 'radial-overview');

    await page.locator('#site-graph .site-graph-node[data-node-id="knowledge"]').click();
    await page.waitForFunction(() => document.body.dataset.graphRoute === 'knowledge');
    await page.waitForFunction(() => document.body.dataset.globalGeometry === 'local');

    const knowledge = await point(page, 'knowledge');
    const child = await point(page, 'logic-math');
    const root = await point(page, 'stepan-chrast');
    expect(root.y).toBeLessThan(knowledge.y);
    expect(child.y).toBeGreaterThan(knowledge.y + 90);
  });
});

test.describe('Radial intro source', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the first-session intro captures the same centred radial Atlas', async ({ page }) => {
    await page.route('https://cloud.umami.is/**', route => route.abort()).catch(() => {});
    await page.goto('/');
    await page.waitForFunction(() => window.ProfileIntro?.snapshot().stage === 'atlas' && window.ProfileIntro.snapshot().waiting, null, { timeout: 8_000 });

    const points = await page.evaluate(() => {
      const node = id => {
        const element = document.querySelector(`.profile-intro-graph .site-graph-node[data-node-id="${id}"]`);
        return { x: Number(element.dataset.introOriginX), y: Number(element.dataset.introOriginY) };
      };
      return {
        root: node('stepan-chrast'),
        work: node('work'),
        knowledge: node('knowledge'),
        experience: node('experience'),
        education: node('education'),
        about: node('about')
      };
    });

    expect(points.work.x).toBeLessThan(points.root.x);
    expect(points.knowledge.y).toBeLessThan(points.root.y);
    expect(points.experience.x).toBeGreaterThan(points.root.x);
    expect(points.education.y).toBeGreaterThan(points.root.y);
    expect(points.about.y).toBeGreaterThan(points.root.y);
  });
});